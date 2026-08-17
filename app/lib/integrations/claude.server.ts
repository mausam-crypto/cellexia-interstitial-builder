/**
 * Claude (Anthropic) integration: translation, section copywriting, SVG diagrams
 * and image-prompt refinement — all through the official @anthropic-ai/sdk.
 *
 * Every helper takes the API key explicitly (it lives in ShopSecrets, never in
 * process env at call time) and throws plain Errors with readable messages.
 * The key is never logged.
 */
import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_CLAUDE_MODEL = "claude-opus-5";

/** Response budget (thinking + text) for the structured calls. */
const MAX_TOKENS = 16000;
/** Claude structured-output batches: keeps each JSON response comfortably inside MAX_TOKENS. */
const TRANSLATE_BATCH = 40;

const BRAND_CONTEXT =
  "Cellexia is a premium, science-led skincare brand (cellexialabs.com) selling to women 45+ across Europe. " +
  "Product / ingredient names must stay untranslated and unchanged: Cellexia, Granactive AGE, DC Instalift Goji GF, Bamboo Beauty Towel.";

/* ------------------------------------------------------------------ */
/* Client + shared helpers                                              */
/* ------------------------------------------------------------------ */

export function claudeClient(apiKey: string): Anthropic {
  const key = String(apiKey || "").trim();
  if (!key) throw new Error("Anthropic API key is missing. Add it in Settings → Integrations.");
  return new Anthropic({ apiKey: key });
}

/** Turn SDK errors into short human-readable messages (never echo the key). */
function describeClaudeError(err: unknown): Error {
  if (err instanceof Anthropic.AuthenticationError) return new Error("Anthropic rejected the API key (401). Check the key in Settings.");
  if (err instanceof Anthropic.PermissionDeniedError) return new Error("The Anthropic API key has no access to this model (403).");
  if (err instanceof Anthropic.NotFoundError) return new Error("Unknown Claude model. Check the model name in Brand → AI settings.");
  if (err instanceof Anthropic.RateLimitError) return new Error("Anthropic rate limit reached (429). Try again in a moment.");
  if (err instanceof Anthropic.BadRequestError) return new Error(`Anthropic rejected the request (400): ${err.message}`);
  if (err instanceof Anthropic.APIConnectionError) return new Error("Could not reach the Anthropic API (network error).");
  if (err instanceof Anthropic.APIError) return new Error(`Anthropic API error ${err.status ?? ""}: ${err.message}`.trim());
  return err instanceof Error ? err : new Error(String(err));
}

/** First text block of a response, after guarding refusal / truncation. */
function firstText(response: Anthropic.Message, what: string): string {
  if (response.stop_reason === "refusal") {
    const why = response.stop_details?.explanation || "";
    throw new Error(`Claude declined to ${what}${why ? `: ${why}` : "."}`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error(`Claude ran out of output tokens while trying to ${what}. Try a smaller batch or a shorter brief.`);
  }
  const block = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!block || !block.text.trim()) throw new Error(`Claude returned no text while trying to ${what}.`);
  return block.text;
}

function parseJson<T>(text: string, what: string): T {
  // Structured outputs guarantee JSON, but be tolerant of stray fences just in case.
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`Claude returned invalid JSON while trying to ${what}.`);
  }
}

async function createMessage(client: Anthropic, params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
  try {
    return await client.messages.create(params);
  } catch (err) {
    throw describeClaudeError(err);
  }
}

/* ------------------------------------------------------------------ */
/* Translation                                                          */
/* ------------------------------------------------------------------ */

export interface ClaudeTranslateOpts {
  apiKey: string;
  model?: string;
  texts: string[];
  /** Shopify locale, e.g. "de", "fr", "pt-BR" */
  targetLocale: string;
  sourceLocale?: string;
  /** Extra context for the translator (page angle, product…). */
  context?: string;
}

const TRANSLATIONS_SCHEMA = {
  type: "object",
  properties: { translations: { type: "array", items: { type: "string" } } },
  required: ["translations"],
  additionalProperties: false,
} as const;

/** Translate marketing copy. The result is index-aligned with `texts`. */
export async function claudeTranslate(opts: ClaudeTranslateOpts): Promise<string[]> {
  const texts = opts.texts || [];
  if (!texts.length) return [];
  const client = claudeClient(opts.apiKey);
  const model = opts.model || DEFAULT_CLAUDE_MODEL;

  const system =
    `You are a senior native-speaking marketing translator for a premium skincare brand. ${BRAND_CONTEXT}\n\n` +
    `Translate each string from ${opts.sourceLocale || "English"} into the locale "${opts.targetLocale}" with natural, native phrasing a local copywriter would use — not literal.\n` +
    "Rules:\n" +
    "- Return exactly the same number of items, in the same order, one translation per input string.\n" +
    "- Keep markdown emphasis markers exactly as in the source: **bold** stays **bold**, *italic* stays *italic* (same words emphasised).\n" +
    "- Keep bracketed placeholders untouched and in place, e.g. [12,000], [n], [Lead author], [FULL NAME].\n" +
    "- Keep product names untranslated (Cellexia, Granactive AGE, DC Instalift Goji GF, Bamboo Beauty Towel).\n" +
    "- Keep currency amounts and numbers as written (e.g. €57.00 stays €57.00).\n" +
    "- Preserve ' · ' separators, line breaks, HTML tags and their order when present.\n" +
    "- Keep tone: confident, warm, premium, never medical claims stronger than the source.\n" +
    "- Never add commentary; if a string is untranslatable (URL, code, empty), return it unchanged." +
    (opts.context ? `\n\nContext for this page: ${opts.context}` : "");

  const out: string[] = new Array(texts.length);
  for (let start = 0; start < texts.length; start += TRANSLATE_BATCH) {
    const chunk = texts.slice(start, start + TRANSLATE_BATCH);
    const response = await createMessage(client, {
      model,
      max_tokens: MAX_TOKENS,
      system,
      messages: [
        {
          role: "user",
          content:
            `Translate these ${chunk.length} strings into "${opts.targetLocale}". ` +
            `Return JSON {"translations": [...]} with exactly ${chunk.length} strings in the same order.\n\n` +
            JSON.stringify(chunk, null, 2),
        },
      ],
      output_config: { format: { type: "json_schema", schema: TRANSLATIONS_SCHEMA as unknown as Record<string, unknown> } },
    });
    const parsed = parseJson<{ translations?: unknown }>(firstText(response, `translate into ${opts.targetLocale}`), "translate");
    const translations = Array.isArray(parsed.translations) ? parsed.translations : [];
    if (translations.length !== chunk.length) {
      throw new Error(`Claude returned ${translations.length} translations for ${chunk.length} strings (batch starting at ${start}).`);
    }
    translations.forEach((t, i) => (out[start + i] = String(t ?? "")));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Section copy generation                                              */
/* ------------------------------------------------------------------ */

/** Minimal field description (compatible with FieldDef from app/lib/types). */
export interface CopyFieldDef {
  key: string;
  label: string;
  type: string;
  help?: string;
  item?: any[];
  options?: Array<{ label: string; value: string }>;
  /** Commerce/config fields rendered by dedicated UI — never rewritten. */
  advanced?: boolean;
  translatable?: boolean;
}

export interface ClaudeSectionCopyOpts {
  apiKey: string;
  model?: string;
  sectionType: string;
  sectionLabel: string;
  fields: CopyFieldDef[];
  currentData: Record<string, any>;
  /** What to write about: product, angle, key numbers/claims allowed. */
  brief: string;
  brandVoice?: string;
  productName?: string;
}

const isImageField = (f: CopyFieldDef) => f.type === "image";
/** Fields Claude may rewrite. Images are preserved; advanced (commerce) fields are never touched. */
const isCopyField = (f: CopyFieldDef) => !isImageField(f) && !f.advanced && f.type !== "color";

/** JSON schema property for one field (undefined = excluded). */
function schemaFor(f: CopyFieldDef): Record<string, unknown> | undefined {
  switch (f.type) {
    case "text":
    case "textarea":
    case "richtext":
    case "select":
    case "url":
      return { type: "string" };
    case "boolean":
      return { type: "boolean" };
    case "number":
    case "stars":
      return { type: "number" };
    case "list": {
      const props: Record<string, unknown> = {};
      const required: string[] = [];
      for (const sub of (f.item || []) as CopyFieldDef[]) {
        if (!isCopyField(sub)) continue;
        const s = schemaFor(sub);
        if (!s) continue;
        props[sub.key] = s;
        required.push(sub.key);
      }
      if (!required.length) return undefined;
      return { type: "array", items: { type: "object", properties: props, required, additionalProperties: false } };
    }
    default:
      return undefined;
  }
}

function describeFields(fields: CopyFieldDef[], indent = ""): string {
  return fields
    .filter(isCopyField)
    .map((f) => {
      const bits = [`${indent}- ${f.key} (${f.type}): ${f.label}`];
      if (f.help) bits.push(`— ${f.help}`);
      if (f.options?.length) bits.push(`— allowed values: ${f.options.map((o) => o.value).join(" | ")}`);
      let line = bits.join(" ");
      if (f.type === "list" && f.item?.length) line += `\n${indent}  each item has:\n${describeFields(f.item as CopyFieldDef[], indent + "    ")}`;
      return line;
    })
    .join("\n");
}

/** Strip images / advanced fields from the data shown to Claude (keeps the prompt focused). */
function copyOnlyData(fields: CopyFieldDef[], data: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of fields) {
    if (!isCopyField(f)) continue;
    const v = data?.[f.key];
    if (v === undefined) continue;
    if (f.type === "list" && Array.isArray(v)) {
      out[f.key] = v.map((item: any) => copyOnlyData((f.item || []) as CopyFieldDef[], item || {}));
    } else {
      out[f.key] = v;
    }
  }
  return out;
}

/** Merge generated copy over current data, preserving images (top level + list items by index) and advanced fields. */
function mergeGenerated(fields: CopyFieldDef[], current: Record<string, any>, generated: Record<string, any>): Record<string, any> {
  const merged: Record<string, any> = { ...current };
  for (const f of fields) {
    if (!isCopyField(f)) continue; // images / advanced: keep current
    if (!(f.key in generated)) continue;
    const g = generated[f.key];
    if (f.type === "list") {
      if (!Array.isArray(g)) continue;
      const cur: any[] = Array.isArray(current?.[f.key]) ? current[f.key] : [];
      merged[f.key] = g.map((item: any, i: number) => mergeGenerated((f.item || []) as CopyFieldDef[], cur[i] || {}, item || {}));
      continue;
    }
    // Light type coercion so a stray "true"/"3" never breaks the editor.
    if (f.type === "boolean") merged[f.key] = typeof g === "boolean" ? g : String(g) === "true";
    else if (f.type === "number" || f.type === "stars") merged[f.key] = typeof g === "number" ? g : Number(g) || current?.[f.key] || 0;
    else merged[f.key] = g == null ? "" : String(g);
  }
  return merged;
}

/**
 * Rewrite one section's copy for a new product / angle. Returns the full merged
 * data object ({...currentData, ...generated}) with all images preserved.
 */
export async function claudeGenerateSectionCopy(opts: ClaudeSectionCopyOpts): Promise<Record<string, any>> {
  const client = claudeClient(opts.apiKey);
  const model = opts.model || DEFAULT_CLAUDE_MODEL;
  const fields = opts.fields || [];

  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const f of fields) {
    if (!isCopyField(f)) continue;
    const s = schemaFor(f);
    if (!s) continue;
    properties[f.key] = s;
    required.push(f.key);
  }
  if (!required.length) return { ...opts.currentData };
  const schema = { type: "object", properties, required, additionalProperties: false };

  const currentCopy = copyOnlyData(fields, opts.currentData || {});
  const system =
    `You are the senior conversion copywriter for Cellexia. ${BRAND_CONTEXT}\n` +
    (opts.brandVoice ? `Brand voice: ${opts.brandVoice}\n` : "") +
    "You rewrite one section of a native-ads interstitial (listicle-style landing page) for a new product or angle.\n" +
    "Rules:\n" +
    "- Keep the same structure, tone, register and approximate length as the current copy — this is a rewrite for a new brief, not a redesign.\n" +
    "- Keep bracketed placeholders like [12,000] or [Lead author] exactly as they are unless the brief provides the real value.\n" +
    "- Never invent clinical results, study figures, percentages, expert names or certifications that are not in the brief. Prefer a placeholder in brackets over a made-up number.\n" +
    "- Keep the same list lengths (same number of cards, steps, items…) unless the brief says otherwise.\n" +
    "- Keep markdown emphasis (**bold**) and ' · ' separators where the current copy uses them; keep richtext paragraphs separated by blank lines.\n" +
    "- Non-copy settings (booleans, selects, numbers, URLs) must be returned unchanged from the current data unless the brief explicitly asks for a change. Select values must be one of the allowed values.\n" +
    "- Product names stay exactly as given. Currency amounts stay as given unless the brief provides new prices.\n" +
    "- Return only the JSON object described by the schema — every listed key, nothing else.";

  const user =
    `Section: ${opts.sectionLabel} (type "${opts.sectionType}")\n` +
    (opts.productName ? `Product: ${opts.productName}\n` : "") +
    `Brief:\n${opts.brief}\n\n` +
    `Fields to write:\n${describeFields(fields)}\n\n` +
    `Current copy (JSON):\n${JSON.stringify(currentCopy, null, 2)}\n\n` +
    "Rewrite the copy for the brief and return the JSON object.";

  const response = await createMessage(client, {
    model,
    max_tokens: MAX_TOKENS,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { format: { type: "json_schema", schema } },
  });
  const generated = parseJson<Record<string, any>>(firstText(response, `write copy for the "${opts.sectionLabel}" section`), "generate section copy");
  if (!generated || typeof generated !== "object" || Array.isArray(generated)) throw new Error("Claude returned an unexpected shape for the section copy.");
  return mergeGenerated(fields, opts.currentData || {}, generated);
}

/* ------------------------------------------------------------------ */
/* SVG diagrams                                                         */
/* ------------------------------------------------------------------ */

export interface ClaudeSvgOpts {
  apiKey: string;
  model?: string;
  prompt: string;
  width?: number;
  height?: number;
  /** Hex colours the diagram should stick to. */
  palette?: string[];
}

/** Remove anything that could execute or load remote content from an SVG string. */
export function sanitizeSvg(svg: string): string {
  let s = svg;
  s = s.replace(/<script[\s\S]*?<\/script\s*>/gi, "");
  s = s.replace(/<script\b[^>]*\/?>/gi, "");
  s = s.replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "");
  s = s.replace(/<foreignObject\b[^>]*\/?>/gi, "");
  // on* event handler attributes (onclick="..", onload='..', onload=x)
  s = s.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // external / dangerous hrefs (keep #fragment references)
  s = s.replace(/\s+(xlink:href|href)\s*=\s*("|')(?:\s*(?:https?:|\/\/|javascript:|data:(?!image\/)))[^"']*\2/gi, "");
  // remote CSS imports / url() references
  s = s.replace(/@import\s+[^;]+;?/gi, "");
  s = s.replace(/url\(\s*("|')?\s*(?:https?:|\/\/|javascript:)[^)]*\)/gi, "none");
  return s.trim();
}

/** Ask Claude for a self-contained editorial diagram and return sanitized <svg> markup. */
export async function claudeGenerateSvg(opts: ClaudeSvgOpts): Promise<string> {
  const client = claudeClient(opts.apiKey);
  const model = opts.model || DEFAULT_CLAUDE_MODEL;
  const width = opts.width || 1200;
  const height = opts.height || 675;
  const palette = (opts.palette || []).filter(Boolean);

  const system =
    "You are an editorial illustrator producing clean, minimal SVG diagrams for a premium skincare brand's landing pages.\n" +
    "Output rules:\n" +
    `- Return ONE self-contained <svg> element and nothing else (no markdown fences, no explanation). Root: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">.\n` +
    "- No external resources: no <image> with URLs, no @import, no web fonts, no <script>, no <foreignObject>, no event attributes.\n" +
    "- Use font-family Inter, Arial, sans-serif for any text; keep text minimal (short labels only), legible at 40% scale.\n" +
    (palette.length ? `- Restrained palette — use only these colours plus white: ${palette.join(", ")}.\n` : "- Restrained palette: 2–3 muted colours plus white.\n") +
    "- Style: airy editorial diagram, thin strokes, rounded shapes, generous whitespace, no gradients or drop shadows, no clip art, no watermark.\n" +
    "- Keep the file compact (< 40 KB): simple paths, no embedded raster.";

  const response = await createMessage(client, {
    model,
    max_tokens: MAX_TOKENS,
    system,
    messages: [{ role: "user", content: `Diagram brief: ${opts.prompt}` }],
  });
  const text = firstText(response, "generate the diagram");
  const match = text.match(/<svg[\s\S]*?<\/svg\s*>/i);
  if (!match) throw new Error("Claude did not return an <svg> element.");
  const svg = sanitizeSvg(match[0]);
  if (!/^<svg[\s>]/i.test(svg) || !/<\/svg>$/i.test(svg)) throw new Error("Claude returned malformed SVG.");
  return svg;
}

/* ------------------------------------------------------------------ */
/* Image prompt refinement                                              */
/* ------------------------------------------------------------------ */

export interface ClaudeImprovePromptOpts {
  apiKey: string;
  model?: string;
  /** What the image slot is for, e.g. "Hero image — confident woman around 60". */
  slotDescription: string;
  /** Brand image style guide (brand.ai.imageStyle). */
  brandStyle: string;
  /** Optional page / product brief. */
  brief?: string;
}

/** Returns one refined image-generation prompt as a single plain-text paragraph. */
export async function claudeImprovePrompt(opts: ClaudeImprovePromptOpts): Promise<string> {
  const client = claudeClient(opts.apiKey);
  const model = opts.model || DEFAULT_CLAUDE_MODEL;
  const system =
    "You write prompts for photorealistic image-generation models (Higgsfield Soul, Flux, Nano Banana) used on a premium skincare brand's landing pages. " +
    "Given an image slot description, a brand style guide and an optional brief, write ONE refined prompt.\n" +
    "Rules:\n" +
    "- Plain text, a single paragraph of 40–90 words. No headings, bullets, quotes, labels or commentary — output the prompt only.\n" +
    "- Describe subject, age and expression realistically (no airbrushed 'model' look), setting, lighting, camera/lens feel, framing and mood.\n" +
    "- Always end with the brand style constraints (unretouched skin texture, natural light, candid phone-photo feel, no text, no logos, no watermark) unless the brief says otherwise.\n" +
    "- Never include product labels, brand names, celebrities or real people's names in the prompt.";
  const user =
    `Image slot: ${opts.slotDescription}\n` +
    `Brand style: ${opts.brandStyle}\n` +
    (opts.brief ? `Brief: ${opts.brief}\n` : "") +
    "Write the refined prompt.";
  const response = await createMessage(client, {
    model,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = firstText(response, "refine the image prompt");
  // Collapse to one paragraph and strip accidental wrapping quotes.
  return text
    .trim()
    .replace(/^["'“]+|["'”]+$/g, "")
    .replace(/\s*\n+\s*/g, " ")
    .trim();
}
