/**
 * Renders the compiled storefront Liquid through a real Liquid engine (liquidjs)
 * with mocked Shopify globals — proves the tags/loops/filters are well-formed and
 * that live prices, locale switches and market overrides evaluate correctly.
 */
import { describe, it, expect } from "vitest";
import { Liquid } from "liquidjs";
import { SEEDS, replaceSeedRefs, collectSeedRefs } from "../app/lib/seed/seed.server";
import { renderPage } from "../app/lib/render/render-page";
import { DEFAULT_BRAND, normalizePage } from "../app/lib/brand";

function content(slug: string) {
  const seed = SEEDS.find((s) => s.slug === slug)!;
  const map: Record<string, string> = {};
  for (const r of collectSeedRefs(seed.content)) map[r] = `https://cdn.example.com/${r}`;
  return normalizePage(replaceSeedRefs(seed.content, map));
}

function engine(currency = "€") {
  const liquid = new Liquid({ strictFilters: true, strictVariables: false });
  liquid.registerFilter("money", (cents: number) => `${currency}${(Number(cents) / 100).toFixed(2)}`);
  return liquid;
}

const shopGlobals = (overrides: any = {}) => ({
  request: { locale: { iso_code: "en" } },
  localization: { country: { iso_code: "IE" } },
  routes: { cart_url: "/cart", root_url: "/", collections_url: "/collections" },
  all_products: {
    "body-wrinkle-cream": {
      variants: [
        { id: 42686740791432, price: 5700, compare_at_price: null },
        { id: 42686740824200, price: 9690, compare_at_price: 11400 },
        { id: 42739679559816, price: 13680, compare_at_price: 17100 },
      ],
    },
    "gift-product": { available: true, variants: [{ id: 999, price: 0, compare_at_price: null }] },
  },
  ...overrides,
});

describe("compiled Liquid evaluates in a Liquid engine", () => {
  it("renders live, localised prices with per-unit and you-save math", async () => {
    const page = content("crepey-skin");
    const out = renderPage({ page, brand: DEFAULT_BRAND, pageId: "p1", slug: "crepey-skin", mode: "liquid" });
    const html = await engine().parseAndRender(out.html, shopGlobals());
    expect(html).not.toContain("{%");
    expect(html).not.toContain("{{");
    // 3-jar card: live compare-at + price + per-unit + save
    expect(html).toContain("€171.00");
    expect(html).toContain("€136.80");
    expect(html).toContain("€45.60 per jar");
    expect(html).toContain("You save €34.20 (20%)");
    // 2-jar card
    expect(html).toContain("€48.45 per jar");
    expect(html).toContain("You save €17.10 (15%)");
    // cart links use routes.cart_url / routes.collections_url (store default: add → Shop All with the drawer open)
    expect(html).toContain('href="/cart/add?items[][id]=42739679559816&items[][quantity]=1&return_to=/collections/shop-all?cx_cart=open"');
    expect(html).not.toMatch(/towel|55089188438391/i);
    expect(html).toContain('data-cx-locale="en"');
  });
  it("switches to French strings when the storefront locale is fr and to the market override for DE", async () => {
    const page = content("crepey-skin");
    const hero = page.sections.find((s) => s.type === "hero")!;
    page.translations = { fr: { [`sections.${hero.id}.headline`]: "3 raisons pour lesquelles…", "stickyBar.buttonLabel": "Commander" } };
    page.commerce.checkoutMode = "checkout";
    page.commerce.discountEnabled = true;
    page.commerce.discountCode = "CREPE20";
    page.commerce.marketOverrides = { DE: { discountCode: "CREPE20DE" } };
    const out = renderPage({ page, brand: DEFAULT_BRAND, pageId: "p1", slug: "crepey-skin", mode: "liquid" });
    const fr = await engine().parseAndRender(out.html, shopGlobals({ request: { locale: { iso_code: "fr" } }, localization: { country: { iso_code: "DE" } }, routes: { cart_url: "/fr/cart", root_url: "/fr", collections_url: "/fr/collections" } }));
    expect(fr).toContain("3 raisons pour lesquelles…");
    expect(fr).toContain("Commander");
    expect(fr).toContain('href="/fr/cart/42739679559816:1?discount=CREPE20DE"');
    const en = await engine().parseAndRender(out.html, shopGlobals());
    expect(en).toContain("3 reasons why thousands of women over 50");
    expect(en).toContain("?discount=CREPE20\"");
  });
  it("an optional add-on with a product handle is dropped from the button when its product is not published/available", async () => {
    const page = content("crepey-skin");
    const pricing = page.sections.find((s) => s.type === "pricing")!;
    pricing.data.cards[1].addOns = [{ variantId: "999", quantity: 1, label: "Gift", productHandle: "gift-product" }];
    const out = renderPage({ page, brand: DEFAULT_BRAND, pageId: "p1", slug: "crepey-skin", mode: "liquid" });
    expect(out.html).toContain("{% if all_products['gift-product'].available %}");
    const g = shopGlobals();
    delete g.all_products["gift-product"]; // unpublished → all_products[handle] is empty
    const html = await engine().parseAndRender(out.html, g);
    expect(html).toContain('href="/cart/add?items[][id]=42739679559816&items[][quantity]=1&return_to=/collections/shop-all?cx_cart=open"');
    expect(html).not.toContain("items[][id]=999");
    // published → add-on included
    const html2 = await engine().parseAndRender(out.html, shopGlobals());
    expect(html2).toContain("items[][id]=42739679559816&items[][quantity]=1&items[][id]=999&items[][quantity]=1");
  });
  it("falls back to manual prices when the variant is not found in the product", async () => {
    const page = content("dark-spots");
    const out = renderPage({ page, brand: DEFAULT_BRAND, pageId: "p3", slug: "dark-spots", mode: "liquid" });
    const html = await engine().parseAndRender(out.html, shopGlobals({ all_products: { "dark-spot-precision-corrector": { variants: [] } } }));
    expect(html).toContain("€136.80");
    expect(html).toContain("You save €34.20 (20%)");
  });
  for (const seed of SEEDS) {
    it(`${seed.slug}: whole page evaluates without Liquid errors`, async () => {
      const page = content(seed.slug);
      const out = renderPage({ page, brand: DEFAULT_BRAND, pageId: "p", slug: seed.slug, mode: "liquid" });
      const html = await engine().parseAndRender(out.html, shopGlobals({ all_products: {} }));
      expect(html.length).toBeGreaterThan(20000);
      expect(html).toContain('id="cx-disclaimer"');
    });
  }
});
