/** Prints the compiled Liquid size of every page in the local DB against Shopify's limits. */
import prisma from "../app/db.server";
import { listPages, getSettings } from "../app/lib/pages.server";
import { renderPage, LIQUID_HARD_LIMIT, LIQUID_SOFT_LIMIT } from "../app/lib/render/render-page";

async function main() {
  const shop = process.env.BUILDER_DEV_SHOP || process.argv[2] || "cellexia-labs.myshopify.com";
  const pages = await listPages(shop);
  const { brand } = await getSettings(shop);
  let worst = 0;
  for (const p of pages) {
    const out = renderPage({ page: p.draft, brand, pageId: p.id, slug: p.slug, mode: "liquid" });
    worst = Math.max(worst, out.bytes);
    const flag = out.bytes > LIQUID_HARD_LIMIT ? "OVER LIMIT" : out.bytes > LIQUID_SOFT_LIMIT ? "close to limit" : "ok";
    console.log(`${p.slug.padEnd(24)} ${(out.bytes / 1024).toFixed(1).padStart(7)} KB  ${flag}${out.warnings.length ? "  " + out.warnings.join("; ") : ""}`);
  }
  console.log(`\nLimit per Liquid file: ${LIQUID_HARD_LIMIT / 1024} KB (Shopify) · largest page: ${(worst / 1024).toFixed(1)} KB`);
  await prisma.$disconnect();
}
main();
