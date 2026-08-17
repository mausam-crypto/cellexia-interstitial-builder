/**
 * In-admin live preview document, loaded in the editor's iframe and openable
 * standalone. Protected by the page's unguessable previewToken (no Shopify
 * session needed, so it works inside iframes and for sharing a draft link).
 *
 *   /preview/<pageId>?token=<previewToken>&device=mobile|desktop&locale=fr&market=DE&version=draft|published
 */
import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { getSettings } from "../lib/pages.server";
import { normalizePage } from "../lib/brand";
import { renderPage } from "../lib/render/render-page";
import { safeJson } from "../lib/pages.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const row = await prisma.page.findFirst({ where: { id: params.id } });
  if (!row || !token || token !== row.previewToken) return new Response("Not found", { status: 404 });
  const version = url.searchParams.get("version") === "published" ? "published" : "draft";
  const content = normalizePage(safeJson(version === "published" ? row.published || row.draft : row.draft));
  const { brand, defaults } = await getSettings(row.shop);
  const rendered = renderPage({
    page: content,
    brand,
    pageId: row.id,
    slug: row.slug,
    mode: "preview",
    previewLocale: url.searchParams.get("locale") || undefined,
    previewMarket: url.searchParams.get("market") || undefined,
    storeRoot: brand.storeUrl || "",
    proxyPath: defaults.proxyPrefix,
    mockChrome: url.searchParams.get("chrome") !== "0",
    standalone: true,
    banner: version === "draft" ? undefined : undefined,
  });
  return new Response(rendered.html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
};
