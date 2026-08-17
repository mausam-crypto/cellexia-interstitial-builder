/**
 * First-install seeding: brand settings + the three baseline pages
 * (Crepey Skin = master template, Jawline, Dark Spots).
 *
 * `seed:<file>` image references are resolved to real URLs:
 *   1. uploaded to Shopify Files (CDN) using the app's admin session — preferred
 *   2. fallback: served by the app itself from /seed and /builder (absolute app URL)
 */
import fs from "node:fs/promises";
import path from "node:path";
import prisma from "../../db.server";
import { CREPEY_SKIN_SEED } from "./pages/crepey-skin";
import { JAWLINE_SEED } from "./pages/jawline";
import { DARK_SPOTS_SEED } from "./pages/dark-spots";
import { DEFAULT_BRAND, normalizePage } from "../brand";
import type { PageContent } from "../types";
import { createPage, getSettings, saveBrand, recompileAll, safeJson } from "../pages.server";
import { uploadFileBuffer, mimeFromName } from "../integrations/shopify-files.server";

/**
 * Bump when existing shops need a data migration on next load (see migrateShopData):
 *  1 — initial seed
 *  2 — free gift (Bamboo Beauty Towel) removed from every interstitial (2026-08-17)
 */
export const SEED_VERSION = 2;

/** Strip the towel free gift from a page: add-on line item, gift line/image, their translations. */
export function stripTowelGift(content: PageContent): { content: PageContent; changed: boolean } {
  let changed = false;
  const isTowel = (v: any) =>
    String(v?.variantId || "") === "55089188438391" || /bamboo-beauty-towel/i.test(String(v?.productHandle || "")) || /towel/i.test(String(v?.label || ""));
  const c: PageContent = JSON.parse(JSON.stringify(content));
  for (const sec of c.sections) {
    if (sec.type !== "pricing" || !Array.isArray(sec.data?.cards)) continue;
    sec.data.cards.forEach((card: any, i: number) => {
      if (Array.isArray(card.addOns) && card.addOns.some(isTowel)) {
        card.addOns = card.addOns.filter((a: any) => !isTowel(a));
        changed = true;
      }
      if (/towel/i.test(String(card.giftLine || "")) || /towel/i.test(String(card.giftImage?.alt || card.giftImage?.src || ""))) {
        card.giftLine = "";
        delete card.giftImage;
        changed = true;
        for (const loc of Object.keys(c.translations || {})) {
          const key = `sections.${sec.id}.cards.${i}.giftLine`;
          if (c.translations[loc] && key in c.translations[loc]) {
            delete c.translations[loc][key];
            changed = true;
          }
        }
      }
    });
  }
  return { content: c, changed };
}

/** Data migrations for shops seeded with an older SEED_VERSION. Idempotent. */
async function migrateShopData(shop: string, fromVersion: number, log: (m: string) => void) {
  if (fromVersion < 2) {
    // v2: no free gift on the interstitials — remove the towel from every page (draft + published), recompile.
    const pages = await prisma.page.findMany({ where: { shop } });
    let touched = 0;
    for (const p of pages) {
      const data: any = {};
      const d = stripTowelGift(normalizePage(safeJson(p.draft)));
      if (d.changed) data.draft = JSON.stringify(d.content);
      if (p.published) {
        const pub = stripTowelGift(normalizePage(safeJson(p.published)));
        if (pub.changed) data.published = JSON.stringify(pub.content);
      }
      if (Object.keys(data).length) {
        await prisma.page.update({ where: { id: p.id }, data });
        touched++;
      }
    }
    if (touched) await recompileAll(shop);
    log(`migration v2: removed the free-gift towel from ${touched} page(s)`);
  }
}

export interface SeedDef {
  slug: string;
  title: string;
  productHandle: string;
  productTitle: string;
  content: PageContent;
}

export const SEEDS: Array<SeedDef & { isTemplate: boolean }> = [
  { ...CREPEY_SKIN_SEED, isTemplate: true },
  { ...JAWLINE_SEED, isTemplate: false },
  { ...DARK_SPOTS_SEED, isTemplate: false },
];

type Admin = { graphql: (query: string, opts?: { variables?: Record<string, any> }) => Promise<Response> } | null;

/** Where a `seed:` file lives on disk + its public path on the app host. */
function seedFileLocation(name: string): { disk: string; publicPath: string } {
  const isBuilder = /\.svg$/i.test(name);
  const dir = isBuilder ? "builder" : "seed";
  return { disk: path.join(process.cwd(), "public", dir, name), publicPath: `/${dir}/${name}` };
}

export function collectSeedRefs(obj: any, out = new Set<string>()): Set<string> {
  if (!obj) return out;
  if (typeof obj === "string") {
    if (obj.startsWith("seed:")) out.add(obj.slice(5));
    return out;
  }
  if (Array.isArray(obj)) obj.forEach((x) => collectSeedRefs(x, out));
  else if (typeof obj === "object") Object.values(obj).forEach((x) => collectSeedRefs(x, out));
  return out;
}

export function replaceSeedRefs<T>(obj: T, map: Record<string, string>): T {
  if (obj == null) return obj;
  if (typeof obj === "string") return (obj.startsWith("seed:") ? map[obj.slice(5)] || obj : obj) as any;
  if (Array.isArray(obj)) return obj.map((x) => replaceSeedRefs(x, map)) as any;
  if (typeof obj === "object") {
    const o: any = {};
    for (const [k, v] of Object.entries(obj as any)) o[k] = replaceSeedRefs(v, map);
    return o;
  }
  return obj;
}

/**
 * Resolve every seed: reference to a URL. Uploads to Shopify Files when an admin
 * client is available; otherwise falls back to app-hosted URLs.
 */
export async function resolveSeedAssets(admin: Admin, appUrl: string, refs: Iterable<string>, log: (m: string) => void = () => {}): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const name of refs) {
    const { disk, publicPath } = seedFileLocation(name);
    const fallback = `${appUrl.replace(/\/$/, "")}${publicPath}`;
    map[name] = fallback;
    if (!admin) continue;
    try {
      const buf = await fs.readFile(disk);
      const uploaded = await uploadFileBuffer(admin, buf, `cellexia-interstitial-${name}`, mimeFromName(name), name.replace(/[-_]/g, " ").replace(/\.\w+$/, ""));
      map[name] = uploaded.url;
      log(`uploaded ${name} → ${uploaded.url}`);
    } catch (e: any) {
      log(`upload failed for ${name}: ${e?.message || e} — using app-hosted URL`);
    }
  }
  return map;
}

/** Idempotent: seeds settings + pages once per shop (tracked by ShopSettings.seedVersion). */
export async function ensureSeeded(shop: string, opts: { admin?: Admin; appUrl?: string; force?: boolean; log?: (m: string) => void } = {}) {
  const log = opts.log || ((m: string) => console.log(`[seed:${shop}] ${m}`));
  const settings = await getSettings(shop);
  if (settings.seedVersion >= SEED_VERSION && !opts.force) return { seeded: false, pages: [] as string[] };
  if (settings.seedVersion > 0 && settings.seedVersion < SEED_VERSION) await migrateShopData(shop, settings.seedVersion, log);

  const appUrl = opts.appUrl || process.env.SHOPIFY_APP_URL || "";
  let admin: Admin = opts.admin || null;
  if (!admin) {
    try {
      // Lazy import to avoid a circular import at module load (shopify.server imports this file).
      const { unauthenticated } = await import("../../shopify.server");
      const ctx = await unauthenticated.admin(shop);
      admin = ctx.admin as any;
    } catch (e: any) {
      log(`no admin session available (${e?.message || e}); images will be app-hosted`);
    }
  }

  // Brand: keep whatever exists, fill defaults; award seal → uploaded/hosted URL.
  const refs = new Set<string>(["award-seal.svg"]);
  for (const s of SEEDS) collectSeedRefs(s.content, refs);
  const assetMap = await resolveSeedAssets(admin, appUrl, refs, log);
  const brand = { ...DEFAULT_BRAND, ...settings.brand, awardSealUrl: assetMap["award-seal.svg"] };
  await saveBrand(shop, brand);

  const created: string[] = [];
  for (const s of SEEDS) {
    const existing = await prisma.page.findFirst({ where: { shop, slug: s.slug } });
    if (existing && !opts.force) {
      log(`page ${s.slug} exists — skipped`);
      continue;
    }
    const content = replaceSeedRefs(s.content, assetMap);
    if (existing && opts.force) {
      await prisma.page.update({ where: { id: existing.id }, data: { draft: JSON.stringify(content), title: s.title, isTemplate: s.isTemplate, hasUnpublishedChanges: true } });
      created.push(s.slug);
      log(`page ${s.slug} re-seeded`);
      continue;
    }
    await createPage(shop, { title: s.title, slug: s.slug, content, productHandle: s.productHandle, productTitle: s.productTitle, isTemplate: s.isTemplate, status: "draft" });
    created.push(s.slug);
    log(`page ${s.slug} created`);
  }

  // Register the seed images in the library so the editor can offer them.
  for (const [name, url] of Object.entries(assetMap)) {
    const exists = await prisma.imageAsset.findFirst({ where: { shop, url } });
    if (!exists) await prisma.imageAsset.create({ data: { shop, url, source: "seed", alt: name.replace(/\.\w+$/, ""), prompt: null } });
  }

  await prisma.shopSettings.update({ where: { shop }, data: { seededAt: new Date(), seedVersion: SEED_VERSION } });
  return { seeded: true, pages: created };
}
