import type { RenderContext, CommerceSettings, MarketOverride } from "../types";

export interface CartItem {
  variantId: string;
  quantity: number;
}

/**
 * Builds the URL a pricing-card button points at.
 *
 * Two modes (page-level `commerce.checkoutMode`):
 *  - "checkout": Shopify cart permalink → straight to checkout with every item,
 *      e.g. /cart/42739679559816:1,55089188438391:1?discount=CREPE20
 *      (this is exactly the wiring specified in the copy docs).
 *  - "cart": Glow25-style chain: /discount/CODE?redirect=/cart/add?items[][id]=…&return_to=/cart
 *      (applies the code as a cookie, adds the items, lands on the cart page).
 *
 * In Liquid mode the storefront routes are used ({{ routes.cart_url }} etc.) so the
 * link is automatically correct for locale-prefixed markets (/fr/cart/…).
 * UTM parameters are appended client-side by the page script (see page-script.ts).
 *
 * If per-market overrides exist, the Liquid output branches on the visitor's country.
 */
export function buildCartUrl(args: { ctx: RenderContext; items: CartItem[]; cardIndex: number }): string {
  const { ctx, items, cardIndex } = args;
  const commerce = ctx.page.commerce;
  const overrides = commerce.marketOverrides || {};
  const overrideCodes = Object.keys(overrides).filter((cc) => {
    const o = overrides[cc];
    return (
      o &&
      (o.discountCode !== undefined ||
        o.discountEnabled !== undefined ||
        (o.cardVariantIds && o.cardVariantIds[String(cardIndex)]))
    );
  });

  const single = (o?: MarketOverride) => buildSingleUrl(ctx, commerce, items, cardIndex, o);

  if (ctx.mode === "preview") {
    const o = ctx.previewMarket ? overrides[ctx.previewMarket] : undefined;
    return single(o);
  }
  if (!overrideCodes.length) return single();
  let out = "";
  overrideCodes.forEach((cc, i) => {
    out += `{% ${i === 0 ? "if" : "elsif"} _c == '${cc}' %}${single(overrides[cc])}`;
  });
  out += `{% else %}${single()}{% endif %}`;
  return out;
}

function buildSingleUrl(
  ctx: RenderContext,
  commerce: CommerceSettings,
  items: CartItem[],
  cardIndex: number,
  o?: MarketOverride,
): string {
  const liquid = ctx.mode === "liquid";
  const cartUrl = liquid ? "{{ routes.cart_url }}" : `${ctx.storeRoot}/cart`;
  // /discount/CODE is a root-level storefront route (not locale-prefixed).
  const discountBase = liquid ? "" : ctx.storeRoot;
  const enabled = o?.discountEnabled ?? commerce.discountEnabled;
  const code = (o?.discountCode ?? commerce.discountCode ?? "").trim();
  const useCode = enabled && code && !/^\[.*\]$/.test(code);
  const effectiveItems = items.map((it, i) =>
    i === 0 && o?.cardVariantIds?.[String(cardIndex)]
      ? { ...it, variantId: o.cardVariantIds[String(cardIndex)] }
      : it,
  );
  const validItems = effectiveItems.filter((it) => it.variantId && String(it.variantId).trim());
  if (!validItems.length) return "#cx-offer";

  if (commerce.checkoutMode === "cart") {
    // /cart/add?items[][id]=X&items[][quantity]=1&items[][id]=Y&items[][quantity]=1&return_to=/cart
    const addParams = validItems
      .map((it) => `items[][id]=${encodeURIComponent(it.variantId)}&items[][quantity]=${it.quantity || 1}`)
      .join("&");
    const addUrl = `${cartUrl}/add?${addParams}&return_to=${liquid ? "{{ routes.cart_url }}" : "/cart"}`;
    if (useCode) {
      // The redirect value must keep its own '&' escaped as %26 so the outer URL parser leaves it intact.
      const redirect = addUrl.replace(/&/g, "%26");
      return `${discountBase}/discount/${encodeURIComponent(code)}?redirect=${redirect}`;
    }
    return addUrl;
  }
  // "checkout" mode: cart permalink
  const permalink = validItems.map((it) => `${it.variantId}:${it.quantity || 1}`).join(",");
  const q = useCode ? `?discount=${encodeURIComponent(code)}` : "";
  return `${cartUrl}/${permalink}${q}`;
}

/** Items a card adds to the cart: main variant + add-ons (gift). */
export function cardItems(card: { variantId?: string; quantity?: number; addOns?: Array<{ variantId: string; quantity: number }> }): CartItem[] {
  const items: CartItem[] = [];
  if (card.variantId) items.push({ variantId: String(card.variantId), quantity: Number(card.quantity) || 1 });
  for (const a of card.addOns || []) {
    if (a.variantId) items.push({ variantId: String(a.variantId), quantity: Number(a.quantity) || 1 });
  }
  return items;
}

/** Extract a numeric variant id from a GID or a plain number/string. */
export function numericVariantId(v: string | number | undefined | null): string {
  if (v == null) return "";
  const s = String(v);
  const m = s.match(/(\d+)\s*$/);
  return m ? m[1] : s;
}
