/**
 * Real store header/footer for previews.
 *
 * On the storefront the app proxy response is wrapped by the theme automatically.
 * Previews (in-admin iframe, static previews) run outside Shopify, and the store
 * cannot be iframed (X-Frame-Options: DENY), so we fetch the store's homepage once,
 * keep everything outside <main> (the theme's announcement bar, header, footer,
 * mini-cart) plus the theme's stylesheets, and wrap the preview in it.
 * Theme scripts are stripped (the shell is visual only). Cached ~15 minutes.
 */

export interface ThemeShell {
  head: string; // <link>/<style>/<meta> tags from the theme's <head>
  bodyAttrs: string; // attributes of the theme <body> (classes the CSS relies on)
  before: string; // markup before <main>
  after: string; // markup after </main>
  base: string; // store origin the shell was fetched from
  fetchedAt: number;
}

const cache = new Map<string, { at: number; shell: ThemeShell | null }>();
const TTL = 15 * 60 * 1000;

export async function getThemeShell(storeUrl: string, opts: { force?: boolean; timeoutMs?: number } = {}): Promise<ThemeShell | null> {
  const origin = (storeUrl || "").replace(/\/+$/, "");
  if (!/^https?:\/\//.test(origin)) return null;
  const hit = cache.get(origin);
  if (hit && !opts.force && Date.now() - hit.at < TTL) return hit.shell;
  let shell: ThemeShell | null = null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000);
    const res = await fetch(origin + "/", {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 Chrome/124 Safari/537.36 CellexiaInterstitialPreview", Accept: "text/html" },
      signal: ctrl.signal,
      redirect: "follow",
    });
    clearTimeout(t);
    if (res.ok) shell = extractShell(await res.text(), origin);
  } catch (e) {
    console.warn("[theme-shell] fetch failed:", (e as any)?.message);
  }
  cache.set(origin, { at: Date.now(), shell });
  return shell;
}

export function extractShell(html: string, origin: string): ThemeShell | null {
  const headM = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const bodyM = html.match(/<body([^>]*)>([\s\S]*)<\/body>/i);
  if (!headM || !bodyM) return null;
  const body = bodyM[2];
  const mainStart = body.search(/<main[\s>]/i);
  const mainEndM = body.match(/<\/main>/i);
  if (mainStart < 0 || !mainEndM || mainEndM.index == null) return null;
  const mainEnd = mainEndM.index + mainEndM[0].length;

  // Root-relative URLs in the shell must keep pointing at the store (no <base>, so the
  // preview's own /builder/... assets still resolve against the app).
  const absolutize = (s: string) =>
    s
      .replace(/(\s(?:href|src|action|poster|data-src)=)(["'])\/(?!\/)/gi, `$1$2${origin}/`)
      .replace(/(\s(?:srcset|data-srcset)=")([^"]*)"/gi, (_m, pre: string, val: string) => `${pre}${val.replace(/(^|,\s*)\/(?!\/)/g, `$1${origin}/`)}"`)
      .replace(/url\((["']?)\/(?!\/)/gi, `url($1${origin}/`);
  const strip = (s: string) =>
    absolutize(
      s
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
        .replace(/\son[a-z]+="[^"]*"/gi, "")
        .replace(/<link[^>]+rel=["']?(preload|modulepreload|prefetch)["']?[^>]*>/gi, ""),
    );

  // Keep stylesheets, inline styles, font links and the viewport meta from the theme head.
  const headParts: string[] = [];
  const headHtml = headM[1];
  const tagRe = /<link[^>]*>|<style[\s\S]*?<\/style>|<meta[^>]*name=["']viewport["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(headHtml))) {
    const tag = m[0];
    if (/^<link/i.test(tag) && !/rel=["']?(stylesheet|preconnect|dns-prefetch|icon|shortcut icon)["']?/i.test(tag)) continue;
    if (/^<link/i.test(tag) && /rel=["']?(preload|modulepreload|prefetch)["']?/i.test(tag)) continue;
    headParts.push(tag);
  }
  return {
    head: absolutize(headParts.join("\n")),
    bodyAttrs: bodyM[1] || "",
    before: strip(body.slice(0, mainStart)),
    after: strip(body.slice(mainEnd)),
    base: origin + "/",
    fetchedAt: Date.now(),
  };
}

/**
 * Theme scripts are stripped, so re-create the one layout behaviour the page depends on:
 * the Cellexia theme keeps its announcement bar + header in a position:fixed wrapper and
 * lets JS set main{padding-top} to its height. Generic: find the fixed/sticky ancestor of the
 * header section and offset <main> by its height (0 when the header is hidden).
 */
const SHELL_SCRIPT = `(function(){var m=document.querySelector('main');if(!m)return;function fixedAncestor(){var h=document.getElementById('shopify-section-header')||document.querySelector('.site-header,header');var el=h;while(el&&el!==document.body){var p=getComputedStyle(el).position;if(p==='fixed'||p==='sticky')return el;el=el.parentElement}return null}function apply(){var el=fixedAncestor();m.style.paddingTop=el?el.getBoundingClientRect().height+'px':''}apply();window.addEventListener('resize',apply);window.addEventListener('load',apply);setTimeout(apply,300)})();`;

/** Wrap a rendered preview body in the theme shell (falls back to a plain document when no shell). */
export function wrapInThemeShell(pageBody: string, shell: ThemeShell | null, opts: { title: string; extraHead?: string; hideHeaderCss?: string }): string {
  const extra = `${opts.extraHead || ""}${opts.hideHeaderCss ? `<style>${opts.hideHeaderCss}</style>` : ""}`;
  if (!shell) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${opts.title}</title><link rel="stylesheet" href="https://use.typekit.net/xkb1ajw.css"><style>html,body{margin:0;padding:0;background:#fff;overflow-x:hidden}</style>${extra}</head><body>${pageBody}</body></html>`;
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${opts.title}</title>${shell.head}<style>html,body{overflow-x:hidden}.cx-preview-note{position:fixed;left:8px;bottom:8px;z-index:99999;font:11px system-ui;background:rgba(0,0,0,.7);color:#fff;padding:4px 8px;border-radius:6px;pointer-events:none}</style>${extra}</head><body${shell.bodyAttrs}>${shell.before}<main id="main">${pageBody}</main>${shell.after}<div class="cx-preview-note">Preview · real theme header/footer (visual only)</div><script>${SHELL_SCRIPT}</script></body></html>`;
}

export function hideHeaderCss(selectors: string): string {
  const sel = (selectors || "").trim().replace(/[{}]/g, "");
  return sel ? `${sel}{display:none!important}` : "";
}
