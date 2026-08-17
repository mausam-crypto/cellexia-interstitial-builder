import type {
  BrandSettings,
  ImageValue,
  PageContent,
  RenderContext,
  SectionInstance,
} from "../types";
import { buildCartUrl, type CartItem } from "../commerce/cart-links";

/** HTML-escape. In liquid mode also neutralise `{` so user text can never open a Liquid tag. */
export function esc(input: unknown, mode: "liquid" | "preview" = "preview"): string {
  const s = input == null ? "" : String(input);
  let out = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  if (mode === "liquid") out = out.replace(/\{/g, "&#123;").replace(/\}/g, "&#125;");
  return out;
}

/** Escape for use inside an attribute that will be a URL (keeps :/?&=#, escapes quotes). */
export function escAttr(input: unknown, mode: "liquid" | "preview" = "preview"): string {
  return esc(input, mode);
}

/**
 * Minimal markdown-ish rich text: paragraphs (blank line), **bold**, *italic*, line breaks.
 * Also supports `- ` bullet lists. Output is safe HTML.
 */
export function richText(input: string, mode: "liquid" | "preview"): string {
  if (!input) return "";
  const blocks = String(input).replace(/\r\n/g, "\n").split(/\n{2,}/);
  const html = blocks
    .map((block) => {
      const lines = block.split("\n");
      const isList = lines.every((l) => /^\s*[-•]\s+/.test(l));
      if (isList) {
        return `<ul>${lines
          .map((l) => `<li>${inline(l.replace(/^\s*[-•]\s+/, ""), mode)}</li>`)
          .join("")}</ul>`;
      }
      return `<p>${lines.map((l) => inline(l, mode)).join("<br>")}</p>`;
    })
    .join("");
  return html;
}

export function inline(text: string, mode: "liquid" | "preview"): string {
  let s = esc(text, mode);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*(?!\*)([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>");
  return s;
}

/** Split "a · b · c" style strings into items (used for trust bars / icon rows). */
export function splitDots(s: string): string[] {
  return String(s || "")
    .split(/\s+[·•|]\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Wrap a translatable string in a Liquid locale switch when translations exist. */
export function localizedText(
  ctx: RenderContext,
  path: string,
  value: string,
  transform: (v: string) => string,
): string {
  const base = transform(value ?? "");
  if (ctx.mode === "preview") {
    const loc = ctx.previewLocale;
    if (loc && ctx.page.translations?.[loc]?.[path]) return transform(ctx.page.translations[loc][path]);
    return base;
  }
  const variants: Array<[string, string]> = [];
  for (const loc of ctx.locales) {
    const t = ctx.page.translations?.[loc]?.[path];
    if (t && t !== value) variants.push([loc, transform(t)]);
  }
  if (!variants.length) return base;
  let out = "";
  variants.forEach(([loc, html], i) => {
    out += `{% ${i === 0 ? "if" : "elsif"} _l == '${loc}' %}${html}`;
  });
  out += `{% else %}${base}{% endif %}`;
  return out;
}

export function shopifyImageUrl(src: string, width: number): string {
  if (!src) return src;
  if (/cdn\.shopify\.com\//.test(src)) {
    const [base, query = ""] = src.split("?");
    const params = new URLSearchParams(query);
    params.set("width", String(width));
    return `${base}?${params.toString()}`;
  }
  return src;
}

export interface ImgOptions {
  cls?: string;
  eager?: boolean;
  sizes?: string;
  widths?: number[];
  aspect?: string; // e.g. "4/3" — used for the placeholder box
  fallbackLabel?: string;
}

export function imgTag(ctx: RenderContext, img: ImageValue | undefined, opts: ImgOptions = {}): string {
  const mode = ctx.mode;
  const cls = opts.cls ? ` class="${opts.cls}"` : "";
  if (!img || !img.src) {
    // Visible placeholder so the team sees the slot in the editor and nothing renders broken.
    const label = esc(opts.fallbackLabel || "Image slot — add an image in the editor", mode);
    const ratio = opts.aspect ? ` style="aspect-ratio:${esc(opts.aspect, mode)}"` : "";
    return `<div class="cx-img-placeholder${opts.cls ? " " + esc(opts.cls, mode) : ""}"${ratio}><span>${label}</span></div>`;
  }
  const src = img.src;
  const alt = esc(img.alt || "", mode);
  const isCdn = /cdn\.shopify\.com\//.test(src);
  const isSvgData = /^data:image\/svg/.test(src) || /\.svg(\?|$)/.test(src);
  const widths = opts.widths || [480, 768, 1080, 1400];
  let srcset = "";
  let mainSrc = escAttr(src, mode);
  if (isCdn && !isSvgData) {
    srcset = ` srcset="${widths.map((w) => `${escAttr(shopifyImageUrl(src, w), mode)} ${w}w`).join(", ")}"`;
    mainSrc = escAttr(shopifyImageUrl(src, 1080), mode);
  }
  const sizes = opts.sizes ? ` sizes="${esc(opts.sizes, mode)}"` : srcset ? ` sizes="(min-width: 900px) 800px, 100vw"` : "";
  const loading = opts.eager ? ` loading="eager" fetchpriority="high"` : ` loading="lazy" decoding="async"`;
  const dims = img.width && img.height ? ` width="${img.width}" height="${img.height}"` : "";
  return `<img${cls} src="${mainSrc}"${srcset}${sizes} alt="${alt}"${loading}${dims}>`;
}

/** Icons used in the purity/guarantee rows and comparison table (inline SVG, currentColor). */
export const ICONS: Record<string, string> = {
  check:
    '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M7.6 14.4 3.4 10.2l1.4-1.4 2.8 2.8 7.6-7.6 1.4 1.4z"/></svg>',
  cross:
    '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="m5.4 4 4.6 4.6L14.6 4 16 5.4 11.4 10l4.6 4.6-1.4 1.4-4.6-4.6L5.4 16 4 14.6 8.6 10 4 5.4z"/></svg>',
  dash:
    '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 9h12v2H4z"/></svg>',
  leaf:
    '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 20c0-8 5-14 14-15-1 9-7 14-14 15Z"/><path d="M5 20c3-5 6-8 10-11"/></svg>',
  shield:
    '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
  drop:
    '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/></svg>',
  lock:
    '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  truck:
    '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg>',
  eu: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3c-3 3-3 15 0 18M12 3c3 3 3 15 0 18M3 12h18"/></svg>',
  star: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="m10 1.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 14.9l-5.2 2.8 1-5.9L1.5 7.7l5.9-.8z"/></svg>',
  ban: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m5.5 5.5 13 13"/></svg>',
  sparkle:
    '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/></svg>',
  clock:
    '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  gift: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="8" width="18" height="4"/><path d="M5 12v9h14v-9M12 8v13M12 8c-2-4-6-4-6-1s4 1 6 1Zm0 0c2-4 6-4 6-1s-4 1-6 1Z"/></svg>',
  chevron:
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  arrowLeft:
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  arrowRight:
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>',
  verified:
    '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M10 1.5 12 3.6l2.9-.5.6 2.9L18 7.5l-1.4 2.6 1.3 2.6-2.5 1.5-.7 2.9-2.9-.6-2 2.1-2-2.1-2.9.6-.7-2.9-2.5-1.5 1.3-2.6L2 7.5l2.5-1.5.6-2.9 2.9.5z"/><path fill="#fff" d="m8.6 13.2-2.7-2.7 1.1-1.1 1.6 1.6 4.4-4.4 1.1 1.1z"/></svg>',
};

/** Guess an icon name from a label ("Hypoallergenic" → shield, "Free express shipping" → truck …). */
export function iconFor(label: string): string {
  const l = label.toLowerCase();
  if (/ship|deliver|warehouse/.test(l)) return "truck";
  if (/secure|encrypt|payment/.test(l)) return "lock";
  if (/europe|made in|eu\b|🇪🇺/.test(l)) return "eu";
  if (/hypoallergen|derma|approved|safe|clinic/.test(l)) return "shield";
  if (/free of|no fragrance|no harmful|preservative|irritant|non-comedogenic|fragrance/.test(l)) return "ban";
  if (/skin type|sensitive|gentle/.test(l)) return "drop";
  if (/proven|clinical|science/.test(l)) return "sparkle";
  if (/day|week|month|30 sec|minute/.test(l)) return "clock";
  return "leaf";
}

export function stripEmojiPrefix(s: string): string {
  return String(s || "").replace(/^[\p{Extended_Pictographic}️‍🇪🇺]+\s*/u, "").trim();
}

/** Stars row (★★★★★) */
export function stars(n = 5): string {
  return `<span class="cx-stars" aria-label="${n} out of 5 stars">${ICONS.star.repeat(Math.max(1, Math.min(5, n)))}</span>`;
}

/* ------------------------------------------------------------------ */
/* Per-section render helper                                            */
/* ------------------------------------------------------------------ */

export interface SectionHelpers {
  ctx: RenderContext;
  brand: BrandSettings;
  mode: "liquid" | "preview";
  section: SectionInstance;
  d: Record<string, any>;
  /** translatable plain text (escaped) */
  t: (key: string, value?: string) => string;
  /** translatable rich text → HTML */
  rt: (key: string, value?: string) => string;
  /** non-translatable escaped text */
  e: (value: unknown) => string;
  img: (value: ImageValue | undefined, opts?: ImgOptions) => string;
  /** the anchor every non-cart CTA points at */
  offerHref: string;
  /** primary CTA button */
  cta: (label: string, opts?: { key?: string; secondary?: boolean; href?: string; extraClass?: string; event?: string }) => string;
  /** cart link for a pricing card */
  cartHref: (cardIndex: number, items: CartItem[]) => string;
  band: (inner: string, opts?: { tone?: "white" | "soft" | "highlight"; id?: string; extraClass?: string; narrow?: boolean }) => string;
  heading: (key: string, value: string, opts?: { level?: 2 | 3; align?: "left" | "center"; cls?: string }) => string;
  icons: typeof ICONS;
  sectionAnchor: string;
}

export function makeHelpers(ctx: RenderContext, section: SectionInstance): SectionHelpers {
  const mode = ctx.mode;
  const base = `sections.${section.id}`;
  const d = section.data || {};
  const t = (key: string, value?: string) =>
    localizedText(ctx, `${base}.${key}`, value ?? "", (v) => inline(v, mode));
  const rt = (key: string, value?: string) =>
    localizedText(ctx, `${base}.${key}`, value ?? "", (v) => richText(v, mode));
  const e = (value: unknown) => esc(value, mode);
  const offerHref = "#cx-offer";
  const btnClass = ctx.brand.ctaStyle === "ink" ? "cx-btn cx-btn--ink" : "cx-btn cx-btn--accent";
  const cta: SectionHelpers["cta"] = (label, opts = {}) => {
    const href = opts.href || offerHref;
    const cls = `${opts.secondary ? "cx-btn cx-btn--secondary" : btnClass}${opts.extraClass ? " " + opts.extraClass : ""}`;
    const text = opts.key ? t(opts.key, label) : inline(label, mode);
    const ev = opts.event || "cta_click";
    return `<a class="${cls}" href="${escAttr(href, mode)}" data-cx-event="${ev}" data-cx-section="${e(section.id)}"><span>${text}</span></a>`;
  };
  const cartHref: SectionHelpers["cartHref"] = (cardIndex, items) =>
    buildCartUrl({ ctx, items, cardIndex });
  const band: SectionHelpers["band"] = (inner, opts = {}) => {
    const tone = opts.tone || "white";
    const cls = ["cx-band", `cx-band--${tone}`, opts.extraClass || ""].filter(Boolean).join(" ");
    const id = opts.id ? ` id="${e(opts.id)}"` : ` id="cx-s-${e(section.id)}"`;
    return `<section class="${cls}"${id} data-cx-type="${e(section.type)}"><div class="cx-wrap${opts.narrow ? " cx-wrap--narrow" : ""}">${inner}</div></section>`;
  };
  const heading: SectionHelpers["heading"] = (key, value, opts = {}) => {
    const level = opts.level || 2;
    const cls = ["cx-h", opts.align === "center" ? "cx-h--center" : "", opts.cls || ""].filter(Boolean).join(" ");
    return `<h${level} class="${cls}">${t(key, value)}</h${level}>`;
  };
  return {
    ctx,
    brand: ctx.brand,
    mode,
    section,
    d,
    t,
    rt,
    e,
    img: (value, opts) => imgTag(ctx, value, opts),
    offerHref,
    cta,
    cartHref,
    band,
    heading,
    icons: ICONS,
    sectionAnchor: `cx-s-${section.id}`,
  };
}

/** Helper for list-item translatable text: path "cards.0.title" */
export function itemT(h: SectionHelpers, listKey: string, index: number, key: string, value?: string): string {
  return h.t(`${listKey}.${index}.${key}`, value);
}
export function itemRT(h: SectionHelpers, listKey: string, index: number, key: string, value?: string): string {
  return h.rt(`${listKey}.${index}.${key}`, value);
}

export function brandString(brand: BrandSettings, key: keyof BrandSettings, ctx: RenderContext, transform: (v: string) => string): string {
  const value = String((brand as any)[key] ?? "");
  const mode = ctx.mode;
  const map = brand.translations || {};
  if (mode === "preview") {
    const loc = ctx.previewLocale;
    if (loc && map[loc]?.[key as string]) return transform(map[loc][key as string]);
    return transform(value);
  }
  const variants: Array<[string, string]> = [];
  for (const loc of ctx.locales) {
    const t = map[loc]?.[key as string];
    if (t && t !== value) variants.push([loc, transform(t)]);
  }
  if (!variants.length) return transform(value);
  let out = "";
  variants.forEach(([loc, html], i) => {
    out += `{% ${i === 0 ? "if" : "elsif"} _l == '${loc}' %}${html}`;
  });
  out += `{% else %}${transform(value)}{% endif %}`;
  return out;
}

export function pageOf(ctx: RenderContext): PageContent {
  return ctx.page;
}
