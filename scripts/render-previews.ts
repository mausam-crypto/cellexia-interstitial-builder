/**
 * Renders the three seed pages to static HTML (preview mode, wrapped in the real
 * store header/footer fetched from the live storefront)
 * into ./preview-out so they can be opened in a browser without Shopify:
 *
 *   npm run preview:static && npx serve -l 4321 .   (or any static server)
 *   → http://localhost:4321/preview-out/crepey-skin.html
 *
 * Also writes the compiled Liquid for each page (what the storefront receives)
 * and prints byte sizes against the Shopify limits.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { SEEDS, replaceSeedRefs, collectSeedRefs } from "../app/lib/seed/seed.server";
import { renderPage, LIQUID_HARD_LIMIT } from "../app/lib/render/render-page";
import { DEFAULT_BRAND } from "../app/lib/brand";
import { getThemeShell, wrapInThemeShell } from "../app/lib/render/theme-shell.server";

async function main() {
  const out = path.join(process.cwd(), "preview-out");
  await fs.mkdir(out, { recursive: true });
  const brand = { ...DEFAULT_BRAND, awardSealUrl: "/public/builder/award-seal.svg" };
  const base = process.env.PREVIEW_BASE || "/public"; // static server root = repo root
  // Real store header/footer around the preview (fetched from the live store; falls back to a plain document offline).
  const shell = process.env.PREVIEW_NO_SHELL ? null : await getThemeShell(DEFAULT_BRAND.storeUrl);
  console.log(shell ? `Theme shell fetched from ${DEFAULT_BRAND.storeUrl} (real header/footer)` : "No theme shell (offline?) — plain preview");
  for (const seed of SEEDS) {
    const refs = collectSeedRefs(seed.content);
    const map: Record<string, string> = {};
    for (const r of refs) map[r] = /\.svg$/.test(r) ? `${base}/builder/${r}` : `${base}/seed/${r}`;
    const content = replaceSeedRefs(seed.content, map);
    const body = renderPage({ page: content, brand, pageId: `preview-${seed.slug}`, slug: seed.slug, mode: "preview", storeRoot: "https://cellexialabs.com", previewLocale: "en" });
    const preview = { ...body, html: wrapInThemeShell(body.html, shell, { title: content.seo?.title || seed.title }) };
    const liquid = renderPage({ page: content, brand, pageId: `preview-${seed.slug}`, slug: seed.slug, mode: "liquid" });
    await fs.writeFile(path.join(out, `${seed.slug}.html`), preview.html);
    await fs.writeFile(path.join(out, `${seed.slug}.liquid`), liquid.html);
    const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
    console.log(`${seed.slug.padEnd(16)} preview ${kb(preview.bytes)} · liquid ${kb(liquid.bytes)} / limit ${kb(LIQUID_HARD_LIMIT)} · sections ${liquid.sectionCount}${liquid.warnings.length ? "\n  warnings: " + liquid.warnings.join("; ") : ""}`);
  }
  console.log(`\nWritten to ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
