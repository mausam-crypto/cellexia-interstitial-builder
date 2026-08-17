import type { BrandSettings, PageContent, RenderContext, RenderedPage } from "../types";
import { renderSection } from "../sections/registry";
import { esc, inline, brandString, stars, richText } from "../sections/helpers";
import { pageCss } from "./page-css";
import { pageScript } from "./page-script";

/** Shopify Liquid file limit is 256 KB; theme-app-extension Liquid files are 100 KB. We stay well under both. */
export const LIQUID_SOFT_LIMIT = 200 * 1024;
export const LIQUID_HARD_LIMIT = 256 * 1024;

export interface RenderPageOptions {
  page: PageContent;
  brand: BrandSettings;
  pageId: string;
  slug: string;
  mode: "liquid" | "preview";
  previewLocale?: string;
  previewMarket?: string;
  /** e.g. "https://cellexialabs.com" for preview links; "" for liquid (uses routes.*) */
  storeRoot?: string;
  proxyPath?: string; // "/a/go"
  /** For preview: wrap in a mock store chrome (header/footer). */
  mockChrome?: boolean;
  /** Extra <head> for standalone preview documents */
  standalone?: boolean;
  /** Draft preview banner text */
  banner?: string;
}

export function renderPage(opts: RenderPageOptions): RenderedPage {
  const { page, brand, pageId, slug, mode } = opts;
  const proxyPath = opts.proxyPath || "/a/go";
  const locales = Object.keys(page.translations || {}).filter((l) => Object.keys(page.translations[l] || {}).length);
  const ctx: RenderContext = {
    mode,
    brand,
    page,
    pageId,
    slug,
    locales,
    previewLocale: opts.previewLocale,
    previewMarket: opts.previewMarket,
    storeRoot: opts.storeRoot ?? (mode === "liquid" ? "" : brand.storeUrl || ""),
    eventsPath: `${proxyPath}/_e`,
    proxyPath,
  };
  const warnings: string[] = [];

  const sectionsHtml = page.sections
    .map((s) => {
      try {
        return renderSection(s, ctx);
      } catch (e: any) {
        warnings.push(`Section ${s.type} (${s.id}) failed to render: ${e?.message || e}`);
        return `<!-- section ${esc(s.id)} failed -->`;
      }
    })
    .join("\n");

  // Disclaimer — always rendered, cannot be removed (page-level override of the text only).
  const disclaimerText = page.disclaimerOverride?.trim()
    ? inline(page.disclaimerOverride, mode)
    : brandString(brand, "disclaimer", ctx, (v) => inline(v, mode));
  const disclaimer = `<div class="cx-disclaimer" id="cx-disclaimer" data-cx-locked="true"><div class="cx-wrap cx-wrap--narrow">${disclaimerText}</div></div>`;

  // Sticky mobile bar
  const sb = page.stickyBar;
  let sticky = "";
  let stickyAfter: string | null = null;
  const pricing = page.sections.find((s) => s.type === "pricing" && !s.hidden);
  if (sb?.enabled) {
    const visible = page.sections.filter((s) => !s.hidden && s.type !== "announcement_bar");
    const trigger = visible[Math.min(sb.showAfterSectionIndex ?? 0, Math.max(0, visible.length - 1))];
    stickyAfter = trigger ? `cx-s-${trigger.id}` : null;
    const txt = localizedPageString(ctx, "stickyBar.text", (sb.text || "").replace(/^[★☆⭐\s]+/u, ""));
    const btn = localizedPageString(ctx, "stickyBar.buttonLabel", sb.buttonLabel || "Order now");
    const btnCls = brand.ctaStyle === "ink" ? "cx-btn cx-btn--ink" : "cx-btn cx-btn--accent";
    sticky = `<div class="cx-sticky" id="cx-sticky" role="complementary" aria-label="Order"><div class="cx-sticky__txt">${stars(5)}<span>${txt}</span></div><a class="${btnCls}" href="#cx-offer" data-cx-event="sticky_cta_click">${btn} →</a></div>`;
  }
  if (!pricing) warnings.push("No pricing section: CTAs point at #cx-offer which does not exist.");

  const css = `<style id="cx-css">${pageCss(brand)}</style>`;
  const scriptCfg = {
    pageId,
    eventsUrl: mode === "liquid" ? `${proxyPath}/_e` : `${opts.storeRoot ?? ""}${proxyPath}/_e`,
    utm: !!page.commerce?.utmPassthrough,
    stickyAfter,
    hasCards: !!pricing,
  };
  const js = `<script id="cx-js">${pageScript(scriptCfg)}</script>`;

  // Liquid preamble: locale + country used by translation / market switches.
  const preamble =
    mode === "liquid"
      ? `{% assign _l = request.locale.iso_code %}{% assign _c = localization.country.iso_code %}`
      : "";
  const dataAttrs =
    mode === "liquid"
      ? ` data-cx-locale="{{ request.locale.iso_code }}" data-cx-market="{{ localization.country.iso_code }}"`
      : ` data-cx-locale="${esc(opts.previewLocale || "en")}" data-cx-market="${esc(opts.previewMarket || "")}"`;

  const seoTitle = page.seo?.title ? `<script>document.title=${JSON.stringify(page.seo.title)};</script>` : "";
  const noindex = page.seo?.noindex !== false ? `<meta name="robots" content="noindex,nofollow">` : "";
  const banner = opts.banner ? `<div class="cx-preview-banner" style="background:#FFF3C4;color:#5B4A00;text-align:center;font:600 13px system-ui;padding:8px 12px;border-bottom:1px solid #F0D96B">${esc(opts.banner)}</div>` : "";

  let body = `${preamble}${banner}<div id="cx-page" data-cx-page="${esc(pageId)}" data-cx-slug="${esc(slug)}"${dataAttrs}>${css}${noindex}${sectionsHtml}${disclaimer}${sticky}${js}${seoTitle}</div>`;

  if (opts.mockChrome) body = wrapWithMockChrome(body, brand);
  if (opts.standalone) body = standaloneDocument(body, page, brand);

  const bytes = Buffer.byteLength(body, "utf8");
  if (mode === "liquid" && bytes > LIQUID_HARD_LIMIT) warnings.push(`Rendered Liquid is ${(bytes / 1024).toFixed(0)} KB — over the 256 KB Shopify Liquid limit. Remove translations or sections.`);
  else if (mode === "liquid" && bytes > LIQUID_SOFT_LIMIT) warnings.push(`Rendered Liquid is ${(bytes / 1024).toFixed(0)} KB — close to the 256 KB limit.`);

  return { html: body, bytes, warnings, sectionCount: page.sections.filter((s) => !s.hidden).length };
}

function localizedPageString(ctx: RenderContext, path: string, value: string): string {
  const mode = ctx.mode;
  const map = ctx.page.translations || {};
  if (mode === "preview") {
    const loc = ctx.previewLocale;
    if (loc && map[loc]?.[path]) return inline(map[loc][path], mode);
    return inline(value, mode);
  }
  const variants: Array<[string, string]> = [];
  for (const loc of ctx.locales) {
    const t = map[loc]?.[path];
    if (t && t !== value) variants.push([loc, inline(t, mode)]);
  }
  if (!variants.length) return inline(value, mode);
  let out = "";
  variants.forEach(([loc, html], i) => {
    out += `{% ${i === 0 ? "if" : "elsif"} _l == '${loc}' %}${html}`;
  });
  out += `{% else %}${inline(value, mode)}{% endif %}`;
  return out;
}

/** A neutral stand-in for the store header/footer used by the in-admin preview only. */
export function wrapWithMockChrome(inner: string, brand: BrandSettings): string {
  const name = esc(brand.storeName || "Store");
  const header = `<div class="cx-mock-header" style="font:600 13px system-ui;color:#1D1D1B;border-bottom:1px solid #eee;background:#fff"><div style="max-width:1080px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:14px 20px"><span style="letter-spacing:.2em;font-weight:800">${name.toUpperCase()}</span><span style="opacity:.6">Store header (theme) · Shop · About · FAQ · Cart</span></div></div>`;
  const footer = `<div class="cx-mock-footer" style="font:13px system-ui;color:#fff;background:#1D1D1B;padding:32px 20px;text-align:center"><div style="max-width:1080px;margin:0 auto">Store footer (theme): navigation · newsletter · legal links · payment icons<br><span style="opacity:.6">© ${new Date().getFullYear()} ${name}. All rights reserved.</span></div></div>`;
  return `${header}${inner}${footer}`;
}

export function standaloneDocument(body: string, page: PageContent, brand: BrandSettings): string {
  const title = esc(page.seo?.title || "Preview");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="stylesheet" href="https://use.typekit.net/xkb1ajw.css"><style>html,body{margin:0;padding:0;background:#fff;overflow-x:hidden}body{font-family:${brand.fontBody || "system-ui"}}</style></head><body>${body}</body></html>`;
}

export { richText };
