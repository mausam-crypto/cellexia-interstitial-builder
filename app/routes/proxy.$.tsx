/**
 * App Proxy endpoint — Shopify forwards https://cellexialabs.com/a/go/* here.
 *
 *   GET  /a/go/<slug>                  → published page (Liquid, rendered inside the theme layout)
 *   GET  /a/go/<slug>?_preview=<token> → draft preview (token from the admin), no-cache
 *   POST /a/go/_e                      → analytics beacon (view / clicks / add-to-cart)
 *
 * The response uses Content-Type application/liquid, so Shopify wraps it in the
 * store's theme.liquid (real header + footer) and evaluates {{ money }}, routes,
 * request.locale, localization.country — this is what makes multi-market /
 * multi-language / multi-currency work on a vintage (non-OS 2.0) theme.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getPageBySlug, getSettings, recordEvent } from "../lib/pages.server";
import { renderPage } from "../lib/render/render-page";
import { normalizePage } from "../lib/brand";

// Small in-memory cache of compiled Liquid per (shop, slug) — cleared on publish via compiledAt check.
const cache = new Map<string, { compiledAt: number; html: string }>();

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { liquid, session } = await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const shop = session?.shop || url.searchParams.get("shop") || "";
  const raw = (params["*"] || "").replace(/^\/+|\/+$/g, "");
  const slug = raw.split("/")[0];

  if (!shop || !slug || slug.startsWith("_")) {
    return liquid(notFound("Page not found"), { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const previewToken = url.searchParams.get("_preview");
  const page = await getPageBySlug(shop, slug);
  if (!page || page.status === "archived") return liquid(notFound("Page not found"), { status: 404, headers: { "Cache-Control": "no-store" } });

  const { brand, defaults } = await getSettings(shop);

  // Draft preview on the real storefront (header/footer/prices), protected by the page's preview token.
  if (previewToken && previewToken === page.previewToken) {
    const rendered = renderPage({ page: page.draft, brand, pageId: page.id, slug: page.slug, mode: "liquid", proxyPath: defaults.proxyPrefix, banner: "DRAFT PREVIEW — this is not the published version" });
    return liquid(rendered.html, { headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" } });
  }

  if (page.status !== "published" || !page.published) {
    return liquid(notFound("This page is not published yet"), { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const key = `${shop}:${slug}`;
  const compiledAt = page.compiledAt ? page.compiledAt.getTime() : 0;
  let html = page.compiled || "";
  const cached = cache.get(key);
  if (cached && cached.compiledAt === compiledAt) html = cached.html;
  else if (!html) {
    const rendered = renderPage({ page: normalizePage(page.published), brand, pageId: page.id, slug: page.slug, mode: "liquid", proxyPath: defaults.proxyPrefix });
    html = rendered.html;
    await prisma.page.update({ where: { id: page.id }, data: { compiled: html, compiledAt: new Date() } });
  }
  cache.set(key, { compiledAt, html });

  return liquid(html, {
    headers: {
      // Shopify's CDN may cache proxied responses briefly; keep it short so publishes propagate fast.
      "Cache-Control": "public, max-age=60, s-maxage=60",
      "X-Robots-Tag": page.published.seo?.noindex === false ? "all" : "noindex, nofollow",
    },
  });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const shop = session?.shop || url.searchParams.get("shop") || "";
  const raw = (params["*"] || "").replace(/^\/+|\/+$/g, "");
  if (raw !== "_e" || !shop) return new Response("not found", { status: 404 });
  let body: any = {};
  try {
    body = JSON.parse(await request.text());
  } catch {
    return new Response("bad request", { status: 400 });
  }
  const pageId = String(body.p || "");
  if (!pageId) return new Response("bad request", { status: 400 });
  const page = await prisma.page.findFirst({ where: { id: pageId, shop }, select: { id: true } });
  if (!page) return new Response("not found", { status: 404 });
  await recordEvent(shop, pageId, {
    type: String(body.t || ""),
    sessionId: body.s ? String(body.s) : undefined,
    cardIndex: typeof body.c === "number" ? body.c : null,
    market: body.m ? String(body.m) : undefined,
    locale: body.l ? String(body.l) : undefined,
    utm: body.utm && typeof body.utm === "object" ? body.utm : undefined,
    referrer: body.r ? String(body.r) : undefined,
    device: body.d ? String(body.d) : undefined,
  });
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
};

function notFound(msg: string): string {
  return `<div style="max-width:720px;margin:80px auto;padding:0 20px;text-align:center;font-family:system-ui"><h1 style="font-size:28px">${msg}</h1><p><a href="{{ routes.root_url }}">Back to the store</a></p></div>`;
}
