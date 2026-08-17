/**
 * Translation orchestration: collects every translatable string of a page,
 * dedupes, sends it to DeepL or Claude, and writes the results back into
 * `content.translations[locale][path]` (the shape the renderer reads).
 */
import type { ShopSecrets } from "../pages.server";
import type { BrandSettings, PageContent } from "../types";
import { collectTranslatableStrings } from "../sections/registry";
import { deeplSupportedTarget, deeplTranslate } from "./deepl.server";
import { claudeTranslate } from "./claude.server";

export type TranslateProvider = "deepl" | "claude";

export interface TranslateItem {
  /** Translation path, e.g. "sections.<id>.heading" or "stickyBar.text". */
  path: string;
  value: string;
  fieldType?: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

/** Strings that are just a bracketed placeholder ("[12,000]", "[n]") are never translated. */
const PLACEHOLDER_ONLY = /^\s*\[[^\]]*\]\s*$/;
/** Product / ingredient names that must survive DeepL untouched. */
const KEEP_TERMS = ["Cellexia", "Granactive AGE", "DC Instalift Goji GF", "Bamboo Beauty Towel"];

const shouldTranslate = (v: string) => typeof v === "string" && v.trim().length > 0 && !PLACEHOLDER_ONLY.test(v);

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unescapeHtml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Prepare a markdown-ish string for DeepL's HTML tag handling:
 * **bold** → <b>, *italic* → <i>, and wrap placeholders / product names in
 * `translate="no"` spans so DeepL leaves them alone.
 */
export function markdownToDeeplHtml(src: string): string {
  let s = escapeHtml(src);
  s = s.replace(/\*\*([^*\n][\s\S]*?)\*\*/g, "<b>$1</b>");
  s = s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1<i>$2</i>");
  s = s.replace(/\[[^\]\n]*\]/g, (m) => `<span translate="no">${m}</span>`);
  for (const term of KEEP_TERMS) {
    s = s.replace(new RegExp(`(?<![\\w-])${escapeRe(escapeHtml(term))}(?![\\w-])`, "g"), (m) => `<span translate="no">${m}</span>`);
  }
  return s;
}

/** Reverse of markdownToDeeplHtml. */
export function deeplHtmlToMarkdown(html: string): string {
  let s = html;
  s = s.replace(/<span\s+translate="no"\s*>([\s\S]*?)<\/span>/gi, "$1");
  s = s.replace(/<(b|strong)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, "**$2**");
  s = s.replace(/<(i|em)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, "*$2*");
  // anything else DeepL may have echoed (stray tags) is dropped
  s = s.replace(/<\/?(?:span|b|strong|i|em)\b[^>]*>/gi, "");
  return unescapeHtml(s);
}

/* ------------------------------------------------------------------ */
/* Core: translate a list of items                                      */
/* ------------------------------------------------------------------ */

export interface TranslateItemsOpts {
  provider: TranslateProvider;
  secrets: ShopSecrets;
  /** Claude model override (ignored for DeepL). */
  model?: string;
  sourceLocale: string;
  targetLocale: string;
  items: TranslateItem[];
  /** Extra context for Claude (page angle, product…). */
  context?: string;
}

/**
 * Translate items into one locale. Identical source strings are sent once.
 * Empty and placeholder-only values are skipped (they keep the source at render time).
 * Returns path → translated string.
 */
export async function translateItems(opts: TranslateItemsOpts): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const items = (opts.items || []).filter((it) => it && it.path && shouldTranslate(it.value));
  if (!items.length) return result;

  // Dedupe identical source strings.
  const unique: string[] = [];
  const indexOf = new Map<string, number>();
  for (const it of items) {
    if (!indexOf.has(it.value)) {
      indexOf.set(it.value, unique.length);
      unique.push(it.value);
    }
  }

  let translated: string[];
  if (opts.provider === "deepl") {
    if (!deeplSupportedTarget(opts.targetLocale)) {
      throw new Error(`DeepL does not support the locale "${opts.targetLocale}". Use Claude for this language.`);
    }
    const prepared = unique.map(markdownToDeeplHtml);
    const raw = await deeplTranslate({
      apiKey: opts.secrets.deeplApiKey || "",
      apiUrl: opts.secrets.deeplApiUrl || undefined,
      texts: prepared,
      targetLang: opts.targetLocale,
      sourceLang: opts.sourceLocale,
      tagHandling: "html",
    });
    translated = raw.map(deeplHtmlToMarkdown);
  } else if (opts.provider === "claude") {
    translated = await claudeTranslate({
      apiKey: opts.secrets.anthropicApiKey || "",
      model: opts.model,
      texts: unique,
      targetLocale: opts.targetLocale,
      sourceLocale: opts.sourceLocale,
      context: opts.context,
    });
  } else {
    throw new Error(`Unknown translation provider "${String(opts.provider)}".`);
  }

  if (translated.length !== unique.length) {
    throw new Error(`Translation provider returned ${translated.length} strings for ${unique.length} inputs.`);
  }
  for (const it of items) {
    const t = translated[indexOf.get(it.value)!];
    // Fall back to the source when the provider returns an empty string.
    result[it.path] = t && t.trim() ? t : it.value;
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Page-level                                                           */
/* ------------------------------------------------------------------ */

/**
 * Every translatable string of a page: section fields (non-hidden sections),
 * the sticky bar, and the render-time derived strings (per-unit suffix,
 * "You save " prefix, guarantee seal text) that the renderer looks up by path.
 */
export function collectPageStrings(content: PageContent): TranslateItem[] {
  const out: TranslateItem[] = [];
  const seen = new Set<string>();
  const push = (item: TranslateItem) => {
    if (seen.has(item.path)) return;
    seen.add(item.path);
    out.push(item);
  };

  for (const section of content.sections || []) {
    if (section.hidden) continue;
    for (const s of collectTranslatableStrings(section)) push(s);

    const base = `sections.${section.id}`;
    if (section.type === "pricing") {
      const cards: any[] = Array.isArray(section.data?.cards) ? section.data.cards : [];
      cards.forEach((card, i) => {
        if (card?.unitLabel) push({ path: `${base}.cards.${i}.perUnitSuffix`, value: ` per ${card.unitLabel}`, fieldType: "text" });
        push({ path: `${base}.cards.${i}.savePrefix`, value: "You save ", fieldType: "text" });
      });
    }
    if (section.type === "guarantee") {
      push({ path: `${base}.sealText`, value: "day money-back guarantee", fieldType: "text" });
    }
  }

  const sb = content.stickyBar;
  if (sb?.text) push({ path: "stickyBar.text", value: sb.text, fieldType: "text" });
  if (sb?.buttonLabel) push({ path: "stickyBar.buttonLabel", value: sb.buttonLabel, fieldType: "text" });

  return out;
}

export interface TranslatePageOpts {
  content: PageContent;
  provider: TranslateProvider;
  secrets: ShopSecrets;
  model?: string;
  sourceLocale: string;
  targetLocales: string[];
  /** Keep existing translations and only fill in paths that have none. */
  onlyMissing?: boolean;
  context?: string;
}

/**
 * Translate a whole page into the given locales. Returns a copy of `content`
 * with `translations[locale][path]` filled. Existing entries are kept when
 * `onlyMissing` is set (otherwise overwritten for the collected paths).
 */
export async function translatePage(opts: TranslatePageOpts): Promise<PageContent> {
  const content: PageContent = { ...opts.content, translations: { ...(opts.content.translations || {}) } };
  const all = collectPageStrings(content);
  const source = String(opts.sourceLocale || "en").toLowerCase();

  for (const locale of opts.targetLocales || []) {
    if (!locale || locale.toLowerCase() === source) continue;
    const existing = { ...(content.translations[locale] || {}) };
    const items = opts.onlyMissing ? all.filter((it) => !existing[it.path]) : all;
    if (!items.length) {
      content.translations[locale] = existing;
      continue;
    }
    const translated = await translateItems({
      provider: opts.provider,
      secrets: opts.secrets,
      model: opts.model,
      sourceLocale: opts.sourceLocale,
      targetLocale: locale,
      items,
      context: opts.context,
    });
    content.translations[locale] = { ...existing, ...translated };
  }
  return content;
}

/* ------------------------------------------------------------------ */
/* Brand strings                                                        */
/* ------------------------------------------------------------------ */

const BRAND_STRING_KEYS = ["guaranteeShort", "shippingLine", "disclaimer", "clinicsClaim"] as const;

export interface TranslateBrandOpts {
  brand: BrandSettings;
  provider: TranslateProvider;
  secrets: ShopSecrets;
  model?: string;
  sourceLocale: string;
  targetLocales: string[];
}

/**
 * Translate the global brand strings (guarantee, shipping line, disclaimer,
 * clinics claim). Returns locale → key → translation, ready to merge into
 * `brand.translations`.
 */
export async function translateBrandStrings(opts: TranslateBrandOpts): Promise<Record<string, Record<string, string>>> {
  const items: TranslateItem[] = BRAND_STRING_KEYS.map((key) => ({ path: key, value: String(opts.brand[key] || ""), fieldType: "text" })).filter((it) => shouldTranslate(it.value));
  const out: Record<string, Record<string, string>> = {};
  const source = String(opts.sourceLocale || "en").toLowerCase();
  for (const locale of opts.targetLocales || []) {
    if (!locale || locale.toLowerCase() === source) continue;
    out[locale] = await translateItems({
      provider: opts.provider,
      secrets: opts.secrets,
      model: opts.model,
      sourceLocale: opts.sourceLocale,
      targetLocale: locale,
      items,
      context: "Global brand strings shown on every page (announcement bar, pricing cards, footer disclaimer).",
    });
  }
  return out;
}
