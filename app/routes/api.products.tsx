import type { ActionFunctionArgs } from "react-router";
import { requireAdmin } from "../lib/auth.server";

/** Small JSON helpers used by the editor / wizard: product lookup, variant listing, discount-code check. */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await requireAdmin(request);
  const body = await request.json().catch(() => ({}));
  const act = String(body.action || "");
  if (!admin) return Response.json({ error: "Not connected to Shopify (dev mode)" }, { status: 400 });
  try {
    if (act === "byHandle") {
      const res = await admin.graphql(`query($handle: String!) { productByHandle(handle: $handle) { id title handle status featuredImage { url } variants(first: 50) { nodes { id title price sku } } } }`, { variables: { handle: String(body.handle || "") } });
      const json: any = await res.json();
      const p = json.data?.productByHandle;
      if (!p) return Response.json({ error: "Product not found" }, { status: 404 });
      return Response.json({ product: { id: p.id, title: p.title, handle: p.handle, status: p.status, image: p.featuredImage?.url, variants: p.variants.nodes.map((v: any) => ({ id: v.id, title: v.title, price: v.price, sku: v.sku })) } });
    }
    if (act === "search") {
      const res = await admin.graphql(`query($q: String!) { products(first: 20, query: $q, sortKey: TITLE) { nodes { id title handle status featuredImage { url } variants(first: 20) { nodes { id title price sku } } } } }`, { variables: { q: String(body.q || "") } });
      const json: any = await res.json();
      return Response.json({ products: (json.data?.products?.nodes || []).map((p: any) => ({ id: p.id, title: p.title, handle: p.handle, status: p.status, image: p.featuredImage?.url, variants: p.variants.nodes.map((v: any) => ({ id: v.id, title: v.title, price: v.price, sku: v.sku })) })) });
    }
    if (act === "checkDiscount") {
      const code = String(body.code || "").trim();
      const res = await admin.graphql(`query($code: String!) { codeDiscountNodeByCode(code: $code) { id codeDiscount { __typename ... on DiscountCodeBasic { title status summary } ... on DiscountCodeBxgy { title status summary } ... on DiscountCodeFreeShipping { title status summary } } } }`, { variables: { code } });
      const json: any = await res.json();
      const node = json.data?.codeDiscountNodeByCode;
      if (!node) return Response.json({ exists: false });
      const d = node.codeDiscount || {};
      return Response.json({ exists: true, summary: `${d.title || code} · ${d.status || ""} · ${d.summary || ""}` });
    }
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
};
