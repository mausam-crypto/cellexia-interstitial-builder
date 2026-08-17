import crypto from "node:crypto";
import prisma from "../db.server";
import type { BrandSettings, PageContent } from "./types";
import { mergeBrand, normalizePage } from "./brand";
import { renderPage } from "./render/render-page";
import { newSectionId } from "./sections/registry";

/* ------------------------------------------------------------------ */
/* Settings                                                             */
/* ------------------------------------------------------------------ */

export interface ShopSecrets {
  anthropicApiKey?: string;
  deeplApiKey?: string;
  deeplApiUrl?: string;
  higgsfieldKeyId?: string;
  higgsfieldKeySecret?: string;
}

export interface ShopDefaults {
  proxyPrefix: string; // "/a/go"
  storeDomain?: string; // "cellexialabs.com"
}

const secretKey = () => crypto.createHash("sha256").update(process.env.SESSION_SECRET || process.env.SHOPIFY_API_SECRET || "dev-secret").digest();

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}
export function decrypt(payload: string): string {
  try {
    if (!payload?.startsWith("v1:")) return payload || "";
    const [, ivb, tagb, encb] = payload.split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(ivb, "base64"));
    decipher.setAuthTag(Buffer.from(tagb, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encb, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export async function getSettings(shop: string): Promise<{ brand: BrandSettings; secrets: ShopSecrets; defaults: ShopDefaults; seededAt: Date | null; seedVersion: number }> {
  const row = await prisma.shopSettings.findUnique({ where: { shop } });
  const brand = mergeBrand(safeJson(row?.brand));
  const rawSecrets = safeJson(row?.secrets) || {};
  const secrets: ShopSecrets = {};
  for (const [k, v] of Object.entries(rawSecrets)) secrets[k as keyof ShopSecrets] = decrypt(String(v));
  // env fallbacks
  secrets.anthropicApiKey ||= process.env.ANTHROPIC_API_KEY || "";
  secrets.deeplApiKey ||= process.env.DEEPL_API_KEY || "";
  secrets.deeplApiUrl ||= process.env.DEEPL_API_URL || "";
  secrets.higgsfieldKeyId ||= process.env.HIGGSFIELD_API_KEY_ID || "";
  secrets.higgsfieldKeySecret ||= process.env.HIGGSFIELD_API_KEY_SECRET || "";
  const defaults: ShopDefaults = { proxyPrefix: "/a/go", ...(safeJson(row?.defaults) || {}) };
  return { brand, secrets, defaults, seededAt: row?.seededAt || null, seedVersion: row?.seedVersion || 0 };
}

export async function saveBrand(shop: string, brand: Partial<BrandSettings>) {
  const current = await getSettings(shop);
  const merged = mergeBrand({ ...current.brand, ...brand });
  await prisma.shopSettings.upsert({
    where: { shop },
    create: { shop, brand: JSON.stringify(merged) },
    update: { brand: JSON.stringify(merged) },
  });
  return merged;
}

export async function saveSecrets(shop: string, secrets: Partial<ShopSecrets>) {
  const row = await prisma.shopSettings.findUnique({ where: { shop } });
  const existing = safeJson(row?.secrets) || {};
  for (const [k, v] of Object.entries(secrets)) {
    if (v === undefined) continue;
    if (v === "") delete existing[k];
    else existing[k] = encrypt(String(v));
  }
  await prisma.shopSettings.upsert({
    where: { shop },
    create: { shop, secrets: JSON.stringify(existing) },
    update: { secrets: JSON.stringify(existing) },
  });
}

export async function saveDefaults(shop: string, defaults: Partial<ShopDefaults>) {
  const row = await prisma.shopSettings.findUnique({ where: { shop } });
  const merged = { ...(safeJson(row?.defaults) || {}), ...defaults };
  await prisma.shopSettings.upsert({
    where: { shop },
    create: { shop, defaults: JSON.stringify(merged) },
    update: { defaults: JSON.stringify(merged) },
  });
}

/* ------------------------------------------------------------------ */
/* Pages                                                                */
/* ------------------------------------------------------------------ */

export interface PageRecord {
  id: string;
  shop: string;
  slug: string;
  title: string;
  productHandle: string | null;
  productTitle: string | null;
  isTemplate: boolean;
  status: string;
  draft: PageContent;
  published: PageContent | null;
  compiled: string | null;
  compiledAt: Date | null;
  previewToken: string;
  hasUnpublishedChanges: boolean;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}

function toRecord(row: any): PageRecord {
  return {
    ...row,
    draft: normalizePage(safeJson(row.draft)),
    published: row.published ? normalizePage(safeJson(row.published)) : null,
  };
}

export async function listPages(shop: string) {
  const rows = await prisma.page.findMany({ where: { shop, NOT: { status: "archived" } }, orderBy: [{ isTemplate: "desc" }, { updatedAt: "desc" }] });
  return rows.map(toRecord);
}

export async function getPage(shop: string, id: string): Promise<PageRecord | null> {
  const row = await prisma.page.findFirst({ where: { shop, id } });
  return row ? toRecord(row) : null;
}

export async function getPageBySlug(shop: string, slug: string): Promise<PageRecord | null> {
  const row = await prisma.page.findFirst({ where: { shop, slug } });
  return row ? toRecord(row) : null;
}

export { slugify } from "./slug";
import { slugify } from "./slug";

export async function uniqueSlug(shop: string, base: string, ignoreId?: string): Promise<string> {
  let slug = slugify(base);
  let i = 2;
  while (true) {
    const existing = await prisma.page.findFirst({ where: { shop, slug } });
    if (!existing || existing.id === ignoreId) return slug;
    slug = `${slugify(base)}-${i++}`;
  }
}

export async function createPage(shop: string, args: { title: string; slug?: string; content: PageContent; productHandle?: string; productTitle?: string; isTemplate?: boolean; status?: string }) {
  const slug = await uniqueSlug(shop, args.slug || args.title);
  const row = await prisma.page.create({
    data: {
      shop,
      slug,
      title: args.title,
      productHandle: args.productHandle || args.content.commerce?.productHandle || null,
      productTitle: args.productTitle || args.content.commerce?.productTitle || null,
      isTemplate: !!args.isTemplate,
      status: args.status || "draft",
      draft: JSON.stringify(normalizePage(args.content)),
      hasUnpublishedChanges: true,
    },
  });
  return toRecord(row);
}

export async function saveDraft(shop: string, id: string, patch: { title?: string; slug?: string; content?: PageContent; productHandle?: string | null; productTitle?: string | null; isTemplate?: boolean }) {
  const data: any = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.slug !== undefined) data.slug = await uniqueSlug(shop, patch.slug, id);
  if (patch.content !== undefined) data.draft = JSON.stringify(normalizePage(patch.content));
  if (patch.productHandle !== undefined) data.productHandle = patch.productHandle;
  if (patch.productTitle !== undefined) data.productTitle = patch.productTitle;
  if (patch.isTemplate !== undefined) data.isTemplate = patch.isTemplate;
  data.hasUnpublishedChanges = true;
  const row = await prisma.page.update({ where: { id }, data });
  return toRecord(row);
}

/** Publish: freeze the draft as the live snapshot and compile the Liquid once. */
export async function publishPage(shop: string, id: string) {
  const page = await getPage(shop, id);
  if (!page) throw new Error("Page not found");
  const { brand, defaults } = await getSettings(shop);
  const rendered = renderPage({ page: page.draft, brand, pageId: page.id, slug: page.slug, mode: "liquid", proxyPath: defaults.proxyPrefix });
  const row = await prisma.page.update({
    where: { id },
    data: {
      published: JSON.stringify(page.draft),
      compiled: rendered.html,
      compiledAt: new Date(),
      status: "published",
      publishedAt: new Date(),
      hasUnpublishedChanges: false,
    },
  });
  return { page: toRecord(row), warnings: rendered.warnings, bytes: rendered.bytes };
}

export async function unpublishPage(shop: string, id: string) {
  const row = await prisma.page.update({ where: { id }, data: { status: "draft" } });
  return toRecord(row);
}

export async function archivePage(shop: string, id: string) {
  await prisma.page.update({ where: { id }, data: { status: "archived" } });
}

export async function deletePage(shop: string, id: string) {
  await prisma.page.delete({ where: { id } });
}

/** Re-compile every published page (after brand settings change). */
export async function recompileAll(shop: string) {
  const pages = await prisma.page.findMany({ where: { shop, status: "published" } });
  const { brand, defaults } = await getSettings(shop);
  for (const p of pages) {
    const content = normalizePage(safeJson(p.published));
    const rendered = renderPage({ page: content, brand, pageId: p.id, slug: p.slug, mode: "liquid", proxyPath: defaults.proxyPrefix });
    await prisma.page.update({ where: { id: p.id }, data: { compiled: rendered.html, compiledAt: new Date() } });
  }
  return pages.length;
}

/** Deep-copy a page's draft into a new draft with fresh section ids (translations re-keyed). */
export function clonePageContent(content: PageContent): PageContent {
  const idMap: Record<string, string> = {};
  const sections = content.sections.map((s) => {
    const nid = newSectionId(s.type);
    idMap[s.id] = nid;
    return { ...JSON.parse(JSON.stringify(s)), id: nid };
  });
  const translations: PageContent["translations"] = {};
  for (const [loc, map] of Object.entries(content.translations || {})) {
    translations[loc] = {};
    for (const [path, v] of Object.entries(map)) {
      const m = path.match(/^sections\.([^.]+)\.(.*)$/);
      const np = m && idMap[m[1]] ? `sections.${idMap[m[1]]}.${m[2]}` : path;
      translations[loc][np] = v;
    }
  }
  return normalizePage({ ...JSON.parse(JSON.stringify(content)), sections, translations });
}

export async function duplicatePage(shop: string, sourceId: string, args: { title: string; slug?: string }) {
  const src = await getPage(shop, sourceId);
  if (!src) throw new Error("Source page not found");
  const content = clonePageContent(src.draft);
  return createPage(shop, { title: args.title, slug: args.slug || args.title, content, productHandle: src.productHandle || undefined, productTitle: src.productTitle || undefined, isTemplate: false, status: "draft" });
}

export function safeJson(s: string | null | undefined): any {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Analytics                                                            */
/* ------------------------------------------------------------------ */

export async function recordEvent(shop: string, pageId: string, ev: { type: string; sessionId?: string; cardIndex?: number | null; market?: string; locale?: string; utm?: Record<string, string>; referrer?: string; device?: string }) {
  const allowed = new Set(["view", "cta_click", "card_click", "add_to_cart", "sticky_cta_click", "cross_sell_click"]);
  if (!allowed.has(ev.type)) return;
  await prisma.event.create({
    data: {
      shop,
      pageId,
      type: ev.type,
      sessionId: ev.sessionId?.slice(0, 64),
      cardIndex: typeof ev.cardIndex === "number" ? ev.cardIndex : null,
      market: ev.market?.slice(0, 8),
      locale: ev.locale?.slice(0, 12),
      utmSource: ev.utm?.utm_source?.slice(0, 120),
      utmMedium: ev.utm?.utm_medium?.slice(0, 120),
      utmCampaign: ev.utm?.utm_campaign?.slice(0, 160),
      referrer: ev.referrer?.slice(0, 200),
      device: ev.device?.slice(0, 12),
    },
  });
}

export interface PageStats {
  views: number;
  visitors: number;
  ctaClicks: number;
  cardClicks: number[]; // by card index
  addToCarts: number;
  ctr: number; // add_to_cart / visitors
  byDay: Array<{ day: string; views: number; addToCarts: number }>;
  bySource: Array<{ source: string; views: number; addToCarts: number }>;
  byMarket: Array<{ market: string; views: number; addToCarts: number }>;
}

export async function getPageStats(shop: string, pageId: string, sinceDays = 30): Promise<PageStats> {
  const since = new Date(Date.now() - sinceDays * 86400000);
  const events = await prisma.event.findMany({ where: { shop, pageId, createdAt: { gte: since } }, select: { type: true, sessionId: true, cardIndex: true, createdAt: true, utmSource: true, market: true } });
  const sessions = new Set<string>();
  const cardClicks: number[] = [];
  let views = 0,
    cta = 0,
    atc = 0;
  const byDay: Record<string, { views: number; addToCarts: number }> = {};
  const bySource: Record<string, { views: number; addToCarts: number }> = {};
  const byMarket: Record<string, { views: number; addToCarts: number }> = {};
  for (const e of events) {
    const day = e.createdAt.toISOString().slice(0, 10);
    byDay[day] ||= { views: 0, addToCarts: 0 };
    const src = e.utmSource || "(direct)";
    bySource[src] ||= { views: 0, addToCarts: 0 };
    const mk = e.market || "(unknown)";
    byMarket[mk] ||= { views: 0, addToCarts: 0 };
    if (e.type === "view") {
      views++;
      byDay[day].views++;
      bySource[src].views++;
      byMarket[mk].views++;
      if (e.sessionId) sessions.add(e.sessionId);
    } else if (e.type === "cta_click" || e.type === "sticky_cta_click") cta++;
    else if (e.type === "card_click") {
      const i = e.cardIndex ?? 0;
      cardClicks[i] = (cardClicks[i] || 0) + 1;
    } else if (e.type === "add_to_cart") {
      atc++;
      byDay[day].addToCarts++;
      bySource[src].addToCarts++;
      byMarket[mk].addToCarts++;
    }
  }
  const visitors = sessions.size || views;
  return {
    views,
    visitors,
    ctaClicks: cta,
    cardClicks: Array.from({ length: Math.max(3, cardClicks.length) }, (_, i) => cardClicks[i] || 0),
    addToCarts: atc,
    ctr: visitors ? atc / visitors : 0,
    byDay: Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, ...v })),
    bySource: Object.entries(bySource).sort((a, b) => b[1].views - a[1].views).slice(0, 10).map(([source, v]) => ({ source, ...v })),
    byMarket: Object.entries(byMarket).sort((a, b) => b[1].views - a[1].views).slice(0, 10).map(([market, v]) => ({ market, ...v })),
  };
}
