import { authenticate } from "../shopify.server";

/**
 * Admin auth wrapper. In local development you can set BUILDER_DEV_SHOP=<shop>.myshopify.com
 * to work on the admin UI without a Shopify session (never active in production).
 */
export async function requireAdmin(request: Request): Promise<{ shop: string; admin: any | null; devMode: boolean }> {
  const devShop = process.env.BUILDER_DEV_SHOP;
  if (devShop && process.env.NODE_ENV !== "production") {
    return { shop: devShop, admin: null, devMode: true };
  }
  const { session, admin } = await authenticate.admin(request);
  return { shop: session.shop, admin, devMode: false };
}

export function isDevMode(): boolean {
  return !!process.env.BUILDER_DEV_SHOP && process.env.NODE_ENV !== "production";
}
