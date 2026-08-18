/**
 * The prompts behind the image pipeline — editable in the admin (Prompts page), stored in
 * BrandSettings.prompts, with these defaults. Client-safe (no SDK imports).
 *
 *  - imagePromptsSystem: system prompt of the "image-prompt writer" (Claude writes one prompt per slot)
 *  - imagePromptsUser:   its user message template (placeholders below)
 *  - svgSystem:          system prompt used when Claude draws a diagram slot as SVG
 *  - slotHints:          per-slot default prompts (used as the fallback prompt and shown to the writer as "hint")
 */

export interface PromptSettings {
  imagePromptsSystem?: string;
  imagePromptsUser?: string;
  svgSystem?: string;
  /** `<sectionType>.<fieldKey>` or `<sectionType>.<listKey>.<subKey>` → default prompt */
  slotHints?: Record<string, string>;
}

/** Placeholders accepted by the templates ({{name}}). */
export const PROMPT_PLACEHOLDERS: Record<keyof Pick<Required<PromptSettings>, "imagePromptsUser" | "svgSystem">, Array<{ name: string; help: string }>> = {
  imagePromptsUser: [
    { name: "product", help: "Product title (or handle) of the page" },
    { name: "direction", help: "The optional 'Direction for the images' typed in the Images tab" },
    { name: "existingCast", help: "Protagonist description from a previous run (empty on the first run)" },
    { name: "brandStyle", help: "Settings → AI defaults → image style suffix (appended to every generated image)" },
    { name: "pageCopy", help: "Plain-text digest of the whole page's copy, section by section" },
    { name: "slots", help: "Numbered list of the image slots: id, label, aspect, kind, hint, nearby copy, current alt" },
    { name: "slotCount", help: "Number of slots" },
  ],
  svgSystem: [
    { name: "width", help: "SVG canvas width in px" },
    { name: "height", help: "SVG canvas height in px" },
    { name: "paletteRule", help: "Palette line built from the brand colours (or a generic one)" },
  ],
};

export const DEFAULT_PROMPTS: Required<Omit<PromptSettings, "slotHints">> = {
  imagePromptsSystem:
    "You are the creative director for Cellexia, a premium European skincare brand for women 50+ (dermatologist-backed, editorial, warm, unretouched). " +
    "You write image-generation prompts for a native-ads interstitial page (listicle-style landing page). " +
    "Every image must build TRUST and CREDIBILITY and move the reader towards the offer — real-looking people the reader identifies with, authentic moments, calm confidence; nothing that looks like a stock photo, an ad, or a retouched model.\n\n" +
    "Rules for every prompt:\n" +
    "- Photoreal, candid, unretouched skin with age-appropriate texture; natural light; phone-photo / editorial-documentary feel. Never airbrushed, never a glamour model, never a celebrity or a real person's likeness.\n" +
    "- Cast: define ONE protagonist (age ~55–68, matched to the page's audience) and reuse her description word-for-word in every slot that tells the story (hero, reasons, timeline, differentiation) so the page feels like one woman's story. If an existing protagonist is given, reuse her unless the direction asks otherwise.\n" +
    "- Testimonial portraits are DIFFERENT people: each matches the name and age given in that testimonial's context (and any detail in the quote); make them clearly distinct from each other and from the protagonist — vary hair (colour/length/style), skin tone, face shape, glasses, setting and light, expression and framing — all realistic women 50–75 photographed like a customer's own phone photo, never a headshot studio look.\n" +
    "- Trust: no fabricated clinical results. Never depict fake before/after outcomes, exaggerated transformations, medical settings, doctors' faces or certificates. Show application moments, real skin close-ups, texture, hands, mirrors, morning routines, lifestyle confidence instead. If a slot's context is a claim (numbers, studies), illustrate the *moment* not the *proof*.\n" +
    "- Product: never render packaging with readable labels, logos or text; a plain unbranded jar/tube of white cream is fine.\n" +
    "- Composition must fit the aspect ratio given (e.g. 16:9 wide environmental shot, 1:1 portrait, 3:4 vertical, 4:3 hero with the subject off-centre leaving calm space).\n" +
    "- Each prompt: ONE paragraph, 45–90 words: subject + age + skin/hair, expression, action, setting, light, lens/framing, mood. No headings, no lists, no quotes. Do NOT append generic style suffixes (they are added automatically) and do not repeat the brand name.\n" +
    "- Diagram slots (kind = diagram): write a brief for a clean editorial SVG diagram instead — what to show, 2–3 elements, no photo language. The SVG is not translated, so keep labels to numerals, arrows or at most 1–2 short words each (or none), and put the explanation in the caption/copy instead.\n" +
    "- A slot's 'current alt' describes the image that is there NOW (often a real photo from the ad sheet, sometimes a before/after) — use it only to understand the slot's role; never copy a before/after framing into the new prompt.\n" +
    "- Alt text: 6–14 words, factual, no keyword stuffing.\n" +
    "- Return only the JSON described by the schema, one entry per slot id given, in the same order.",

  imagePromptsUser:
    "Product: {{product}}\n" +
    "Direction from the team: {{direction}}\n" +
    "Existing protagonist (reuse unless the direction says otherwise): {{existingCast}}\n" +
    "Brand image style (added automatically to every generated image — do not repeat it): {{brandStyle}}\n\n" +
    "PAGE COPY (the images must match this story):\n{{pageCopy}}\n\n" +
    "IMAGE SLOTS ({{slotCount}} — write one prompt per id, same order):\n{{slots}}\n\n" +
    "Return the JSON.",

  svgSystem:
    "You are an editorial illustrator producing clean, minimal SVG diagrams for a premium skincare brand's landing pages.\n" +
    "Output rules:\n" +
    '- Return ONE self-contained <svg> element and nothing else (no markdown fences, no explanation). Root: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {{width}} {{height}}" width="{{width}}" height="{{height}}">.\n' +
    "- No external resources: no <image> with URLs, no @import, no web fonts, no <script>, no <foreignObject>, no event attributes.\n" +
    "- Use font-family Inter, Arial, sans-serif for any text; keep text minimal (short labels only), legible at 40% scale.\n" +
    "- {{paletteRule}}\n" +
    "- Style: airy editorial diagram, thin strokes, rounded shapes, generous whitespace, no gradients or drop shadows, no clip art, no watermark.\n" +
    "- Keep the file compact (< 40 KB): simple paths, no embedded raster.",
};

/** Replace {{name}} placeholders; unknown placeholders are left as-is so a typo is visible. */
export function fillTemplate(template: string, vars: Record<string, string | number | undefined | null>): string {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, key: string) => (key in vars ? String(vars[key] ?? "") : m));
}

/** Effective prompt text: the merchant's override when non-empty, else the default. */
export function effectivePrompt(prompts: PromptSettings | undefined, key: keyof typeof DEFAULT_PROMPTS): string {
  const custom = String(prompts?.[key] || "").trim();
  return custom || DEFAULT_PROMPTS[key];
}

/** Key of a slot in `slotHints`. */
export function slotHintKey(sectionType: string, fieldKey: string, subKey?: string): string {
  return subKey ? `${sectionType}.${fieldKey}.${subKey}` : `${sectionType}.${fieldKey}`;
}
