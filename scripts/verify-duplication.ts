/**
 * End-to-end check of the duplication promise against the local database:
 *  1. duplicates the master template (crepey-skin) into a new draft
 *  2. swaps the product-specific fields for the Jawline product (as the wizard does)
 *  3. renders the result and verifies it is coherent + publishable
 *  4. removes the test page again
 *
 *   BUILDER_DEV_SHOP=<shop> npx tsx scripts/verify-duplication.ts
 *
 * Note: it runs against DATABASE_URL. Prisma resolves a relative SQLite path
 * (file:./dev.sqlite) relative to prisma/, i.e. prisma/dev.sqlite — not the project root.
 * The seed only runs when the shop has never been seeded, so a leftover database from an
 * older version keeps its old drafts; delete prisma/dev.sqlite (or `npm run seed -- <shop> --force`)
 * for a genuinely fresh check.
 */
import prisma from "../app/db.server";
import { duplicatePage, getPage, getPageBySlug, saveDraft, deletePage, getSettings } from "../app/lib/pages.server";
import { ensureSeeded } from "../app/lib/seed/seed.server";
import { SECTION_MAP } from "../app/lib/sections/registry";
import { renderPage } from "../app/lib/render/render-page";

async function main() {
  const shop = process.env.BUILDER_DEV_SHOP || process.argv[2] || "cellexia-labs.myshopify.com";
  console.log(`0. database ${process.env.DATABASE_URL || "(DATABASE_URL unset)"} · shop ${shop}`);
  await ensureSeeded(shop, { appUrl: "http://localhost:3000" });
  const template = await getPageBySlug(shop, "crepey-skin");
  const jawline = await getPageBySlug(shop, "jawline-ritual");
  if (!template || !jawline) throw new Error("Seed pages missing");
  const copy = await duplicatePage(shop, template.id, { title: "VERIFY — duplicate of template" });
  console.log(`1. duplicated "${template.title}" → "${copy.title}" (/a/go/${copy.slug}), ${copy.draft.sections.length} sections, ids re-generated: ${copy.draft.sections[0].id !== template.draft.sections[0].id}`);

  // 2. swap product-specific fields + commerce (what the wizard does)
  const content = copy.draft;
  content.commerce = { ...jawline.draft.commerce };
  let swapped = 0;
  content.sections.forEach((s, i) => {
    const def = SECTION_MAP[s.type];
    const src = jawline.draft.sections[i];
    if (!def || !src || src.type !== s.type) return;
    for (const f of def.fields.filter((f) => f.productSpecific)) {
      if (src.data[f.key] !== undefined) {
        s.data[f.key] = src.data[f.key];
        swapped++;
      }
    }
  });
  const saved = await saveDraft(shop, copy.id, { content, title: "VERIFY — Jawline from template", slug: "verify-jawline" });
  console.log(`2. swapped ${swapped} product-specific fields; commerce → ${saved.draft.commerce.productHandle}`);

  // 3. render + checks
  const { brand } = await getSettings(shop);
  const out = renderPage({ page: saved.draft, brand, pageId: saved.id, slug: saved.slug, mode: "liquid" });
  const checks: Array<[string, boolean]> = [
    ["no render warnings", out.warnings.length === 0],
    ["under 256 KB", out.bytes < 256 * 1024],
    ["headline is the jawline one", out.html.includes("jawlines look years younger")],
    // 3-pack card = jawline 3-pack, in whichever add-to-cart mode is in effect
    // (store default "collection"/"cart" → /cart/add?items[][id]=…; "checkout" → permalink ID:1)
    ["pricing sells jawline variants", /items\[\]\[id\]=42739675037832&items\[\]\[quantity\]=1|\/42739675037832:1/.test(out.html) && !/towel|55089188438391/i.test(out.html)],
    ["shared guarantee carried over", out.html.includes("60-day money-back guarantee")],
    ["shared purity/pillars/disclaimer present", out.html.includes('id="cx-disclaimer"') && out.html.includes("Prize-winning science")],
    ["18 sections", out.sectionCount === 18],
    ["every CTA anchors to the offer", (out.html.match(/href="#cx-offer"/g) || []).length >= 4],
  ];
  for (const [label, ok] of checks) console.log(`   ${ok ? "✓" : "✗"} ${label}`);
  const allOk = checks.every(([, ok]) => ok);
  console.log(`3. rendered ${(out.bytes / 1024).toFixed(0)} KB Liquid — ${allOk ? "coherent, publishable" : "PROBLEMS FOUND"}`);

  // 4. cleanup
  await deletePage(shop, saved.id);
  console.log("4. test page removed");
  await prisma.$disconnect();
  process.exit(allOk ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
