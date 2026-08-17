/** Seed (or force re-seed) the baseline pages for a shop from the CLI: npx tsx scripts/seed-cli.ts <shop> [--force] */
import prisma from "../app/db.server";
import { ensureSeeded } from "../app/lib/seed/seed.server";
async function main() {
  const shop = process.argv[2] || process.env.BUILDER_DEV_SHOP;
  if (!shop) throw new Error("usage: tsx scripts/seed-cli.ts <shop.myshopify.com> [--force]");
  const r = await ensureSeeded(shop, { force: process.argv.includes("--force") });
  console.log(r.seeded ? `Seeded: ${r.pages.join(", ")}` : "Already seeded (use --force to overwrite the baseline drafts)");
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
