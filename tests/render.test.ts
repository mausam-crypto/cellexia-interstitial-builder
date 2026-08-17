import { describe, it, expect } from "vitest";
import { SEEDS, replaceSeedRefs, collectSeedRefs } from "../app/lib/seed/seed.server";
import { renderPage, LIQUID_HARD_LIMIT } from "../app/lib/render/render-page";
import { DEFAULT_BRAND, normalizePage } from "../app/lib/brand";
import { SECTION_DEFS, SECTION_MAP, createSection, collectTranslatableStrings } from "../app/lib/sections/registry";
import { buildCartUrl, cardItems } from "../app/lib/commerce/cart-links";
import { clonePageContent } from "../app/lib/pages.server";
import type { RenderContext, PageContent } from "../app/lib/types";

function seedContent(slug: string): PageContent {
  const seed = SEEDS.find((s) => s.slug === slug)!;
  const map: Record<string, string> = {};
  for (const r of collectSeedRefs(seed.content)) map[r] = `https://cdn.example.com/${r}`;
  return normalizePage(replaceSeedRefs(seed.content, map));
}

const EXPECTED_ORDER = [
  "hero", "reason", "reason", "reason", "text_block", "purity", "science", "evidence", "pillars", "expert_quote", "pricing", "guarantee", "comparison", "timeline", "testimonials", "reviews", "faq", "final_cta",
];

describe("section library", () => {
  it("has every Glow25-modeled section type", () => {
    const types = SECTION_DEFS.map((d) => d.type);
    for (const t of ["announcement_bar", "hero", "reason", "text_block", "purity", "science", "evidence", "pillars", "expert_quote", "pricing", "guarantee", "comparison", "timeline", "testimonials", "reviews", "faq", "final_cta"]) {
      expect(types).toContain(t);
    }
  });
  it("creates sections with defaults and renders each type without throwing", () => {
    const page = normalizePage({ sections: SECTION_DEFS.map((d) => createSection(d.type)) });
    const out = renderPage({ page, brand: DEFAULT_BRAND, pageId: "t", slug: "t", mode: "preview" });
    expect(out.html).toContain("cx-page");
    expect(out.html).toContain("cx-disclaimer");
  });
});

describe("seed pages", () => {
  for (const seed of SEEDS) {
    describe(seed.slug, () => {
      const content = seedContent(seed.slug);
      it("has all 18 page sections in the doc's order (the theme supplies the announcement bar, header and footer)", () => {
        expect(content.sections.map((s) => s.type)).toEqual(EXPECTED_ORDER);
      });
      it("keeps the bracketed placeholders visible (nothing invented)", () => {
        const html = renderPage({ page: content, brand: DEFAULT_BRAND, pageId: "t", slug: seed.slug, mode: "preview" }).html;
        expect(html).toContain("[12,000]");
        expect(html).toContain("Dr. [FULL NAME]");
        expect(html).toContain("[Lead author]");
      });
      it("renders every button to a proper destination (offer anchor, cart, or cross-sell product)", () => {
        const html = renderPage({ page: content, brand: DEFAULT_BRAND, pageId: "t", slug: seed.slug, mode: "preview", storeRoot: "https://cellexialabs.com" }).html;
        const hrefs = [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);
        expect(hrefs.length).toBeGreaterThan(5);
        for (const h of hrefs) {
          const ok = h === "#cx-offer" || h.startsWith("https://cellexialabs.com/cart/") || h.startsWith("https://cellexialabs.com/products/") || h.startsWith("https://cellexialabs.com/discount/");
          expect(ok, `unexpected link ${h}`).toBe(true);
        }
        // pricing anchor exists
        expect(html).toContain('id="cx-offer"');
      });
      it("wires the pricing cards to the doc's variant ids (+ free towel on the 3-pack)", () => {
        const pricing = content.sections.find((s) => s.type === "pricing")!;
        const cards = pricing.data.cards;
        expect(cards).toHaveLength(3);
        expect(cards[1].highlight).toBe(true);
        expect(cards[1].addOns[0].variantId).toBe("55089188438391");
        // Store default (Settings → After add to cart): add to cart → Shop All collection with the cart drawer open
        const html = renderPage({ page: content, brand: DEFAULT_BRAND, pageId: "t", slug: seed.slug, mode: "preview", storeRoot: "https://cellexialabs.com" }).html;
        const shopAll = "&return_to=https://cellexialabs.com/collections/shop-all?cx_cart=open\"";
        expect(html).toContain(`https://cellexialabs.com/cart/add?items[][id]=${cards[0].variantId}&items[][quantity]=1${shopAll}`);
        expect(html).toContain(`https://cellexialabs.com/cart/add?items[][id]=${cards[1].variantId}&items[][quantity]=1&items[][id]=55089188438391&items[][quantity]=1${shopAll}`);
        expect(html).toContain(`https://cellexialabs.com/cart/add?items[][id]=${cards[2].variantId}&items[][quantity]=1${shopAll}`);
        expect(html).toContain('data-cx-mode="collection"');
        // Page override: straight to checkout via cart permalink
        const checkout = { ...content, commerce: { ...content.commerce, checkoutMode: "checkout" as const } };
        const html2 = renderPage({ page: checkout, brand: DEFAULT_BRAND, pageId: "t", slug: seed.slug, mode: "preview", storeRoot: "https://cellexialabs.com" }).html;
        expect(html2).toContain(`https://cellexialabs.com/cart/${cards[0].variantId}:1"`);
        expect(html2).toContain(`https://cellexialabs.com/cart/${cards[1].variantId}:1,55089188438391:1"`);
        expect(html2).toContain(`https://cellexialabs.com/cart/${cards[2].variantId}:1"`);
        expect(html2).toContain('data-cx-mode="checkout"');
      });
      it("shows the store header by default and can hide it per page or globally", () => {
        const base = renderPage({ page: content, brand: DEFAULT_BRAND, pageId: "t", slug: seed.slug, mode: "liquid" }).html;
        expect(base).not.toContain("cx-hide-header");
        const perPage = renderPage({ page: { ...content, header: "hide" }, brand: DEFAULT_BRAND, pageId: "t", slug: seed.slug, mode: "liquid" }).html;
        expect(perPage).toContain('<style id="cx-hide-header">#shopify-section-header, #shopify-section-alert-bar');
        expect(perPage).toContain("{display:none!important}</style>");
        const globalHide = renderPage({ page: content, brand: { ...DEFAULT_BRAND, showHeader: false }, pageId: "t", slug: seed.slug, mode: "preview", storeRoot: "https://cellexialabs.com" }).html;
        expect(globalHide).toContain("cx-hide-header");
        const forceShow = renderPage({ page: { ...content, header: "show" }, brand: { ...DEFAULT_BRAND, showHeader: false }, pageId: "t", slug: seed.slug, mode: "liquid" }).html;
        expect(forceShow).not.toContain("cx-hide-header");
      });
      it("compiles to Liquid under the Shopify limit, with locale/market preamble and live prices", () => {
        const out = renderPage({ page: content, brand: DEFAULT_BRAND, pageId: "t", slug: seed.slug, mode: "liquid" });
        expect(out.bytes).toBeLessThan(LIQUID_HARD_LIMIT);
        expect(out.html).toContain("{% assign _l = request.locale.iso_code %}");
        expect(out.html).toContain(`all_products['${content.commerce.productHandle}']`);
        expect(out.html).toContain("| money }}");
        expect(out.html).toContain("{{ routes.cart_url }}/");
        expect(out.warnings).toEqual([]);
      });
      it("always renders the disclaimer, even if someone tries to remove it", () => {
        const stripped = { ...content, disclaimerOverride: "" };
        const html = renderPage({ page: stripped, brand: DEFAULT_BRAND, pageId: "t", slug: seed.slug, mode: "preview" }).html;
        expect(html).toContain('id="cx-disclaimer"');
        expect(html).toContain("not intended as medical advice");
      });
    });
  }
});

describe("cart links", () => {
  const base = seedContent("crepey-skin");
  const ctx = (patch: Partial<PageContent["commerce"]>, mode: "liquid" | "preview" = "preview", extra: Partial<RenderContext> = {}): RenderContext => ({
    mode,
    brand: DEFAULT_BRAND,
    page: { ...base, commerce: { ...base.commerce, ...patch } },
    pageId: "t",
    slug: "t",
    locales: [],
    storeRoot: "https://cellexialabs.com",
    eventsPath: "/a/go/_e",
    proxyPath: "/a/go",
    ...extra,
  });
  it("store default: adds to cart then lands on the Shop All collection with the cart drawer open", () => {
    expect(base.commerce.checkoutMode).toBe("default");
    expect(DEFAULT_BRAND.afterAddToCart).toEqual({ mode: "collection", collectionHandle: "shop-all", openCart: true });
    const url = buildCartUrl({ ctx: ctx({}), items: [{ variantId: "1", quantity: 1 }, { variantId: "2", quantity: 1 }], cardIndex: 0 });
    expect(url).toBe("https://cellexialabs.com/cart/add?items[][id]=1&items[][quantity]=1&items[][id]=2&items[][quantity]=1&return_to=https://cellexialabs.com/collections/shop-all?cx_cart=open");
    // with a discount code the chain starts at /discount/CODE
    const withCode = buildCartUrl({ ctx: ctx({ discountEnabled: true, discountCode: "CREPE20" }), items: [{ variantId: "1", quantity: 1 }], cardIndex: 0 });
    expect(withCode).toBe("https://cellexialabs.com/discount/CREPE20?redirect=https://cellexialabs.com/cart/add?items[][id]=1%26items[][quantity]=1%26return_to=https://cellexialabs.com/collections/shop-all?cx_cart=open");
    // Liquid mode uses the storefront routes (locale-prefixed markets)
    const liquid = buildCartUrl({ ctx: ctx({}, "liquid"), items: [{ variantId: "1", quantity: 1 }], cardIndex: 0 });
    expect(liquid).toBe("{{ routes.cart_url }}/add?items[][id]=1&items[][quantity]=1&return_to={{ routes.collections_url }}/shop-all?cx_cart=open");
    // Settings: other collection, drawer off
    const brand = { ...DEFAULT_BRAND, afterAddToCart: { mode: "collection" as const, collectionHandle: "best-sellers", openCart: false } };
    expect(buildCartUrl({ ctx: ctx({}, "preview", { brand }), items: [{ variantId: "1", quantity: 1 }], cardIndex: 0 })).toBe("https://cellexialabs.com/cart/add?items[][id]=1&items[][quantity]=1&return_to=https://cellexialabs.com/collections/best-sellers");
    // Settings: straight to checkout for every "default" page
    const brand2 = { ...DEFAULT_BRAND, afterAddToCart: { ...DEFAULT_BRAND.afterAddToCart, mode: "checkout" as const } };
    expect(buildCartUrl({ ctx: ctx({}, "preview", { brand: brand2 }), items: [{ variantId: "1", quantity: 1 }], cardIndex: 0 })).toBe("https://cellexialabs.com/cart/1:1");
  });
  it("applies the discount code in checkout mode when enabled", () => {
    const url = buildCartUrl({ ctx: ctx({ checkoutMode: "checkout", discountEnabled: true, discountCode: "CREPE20" }), items: [{ variantId: "1", quantity: 1 }, { variantId: "2", quantity: 1 }], cardIndex: 0 });
    expect(url).toBe("https://cellexialabs.com/cart/1:1,2:1?discount=CREPE20");
  });
  it("omits the discount when disabled or when the code is a placeholder", () => {
    expect(buildCartUrl({ ctx: ctx({ checkoutMode: "checkout", discountEnabled: false, discountCode: "X" }), items: [{ variantId: "1", quantity: 1 }], cardIndex: 0 })).toBe("https://cellexialabs.com/cart/1:1");
    expect(buildCartUrl({ ctx: ctx({ checkoutMode: "checkout", discountEnabled: true, discountCode: "[FUNNEL-CODE]" }), items: [{ variantId: "1", quantity: 1 }], cardIndex: 0 })).toBe("https://cellexialabs.com/cart/1:1");
    expect(buildCartUrl({ ctx: ctx({ discountEnabled: true, discountCode: "[FUNNEL-CODE]" }), items: [{ variantId: "1", quantity: 1 }], cardIndex: 0 })).not.toContain("/discount/");
  });
  it("builds the Glow25-style discount → add → cart chain in cart mode", () => {
    const url = buildCartUrl({ ctx: ctx({ checkoutMode: "cart", discountEnabled: true, discountCode: "CREPE20" }), items: [{ variantId: "1", quantity: 1 }, { variantId: "9", quantity: 1 }], cardIndex: 0 });
    expect(url).toBe("https://cellexialabs.com/discount/CREPE20?redirect=https://cellexialabs.com/cart/add?items[][id]=1%26items[][quantity]=1%26items[][id]=9%26items[][quantity]=1%26return_to=/cart");
  });
  it("uses locale-aware storefront routes in Liquid mode and branches per market", () => {
    const url = buildCartUrl({ ctx: ctx({ checkoutMode: "checkout", discountEnabled: true, discountCode: "CREPE20", marketOverrides: { DE: { discountCode: "CREPE20DE" }, FR: { cardVariantIds: { "0": "777" } } } }, "liquid"), items: [{ variantId: "1", quantity: 1 }], cardIndex: 0 });
    expect(url).toContain("{% if _c == 'DE' %}{{ routes.cart_url }}/1:1?discount=CREPE20DE");
    const coll = buildCartUrl({ ctx: ctx({ marketOverrides: { DE: { discountEnabled: true, discountCode: "CREPE20DE" } } }, "liquid"), items: [{ variantId: "1", quantity: 1 }], cardIndex: 0 });
    expect(coll).toContain("{% if _c == 'DE' %}/discount/CREPE20DE?redirect={{ routes.cart_url }}/add?items[][id]=1%26items[][quantity]=1%26return_to={{ routes.collections_url }}/shop-all?cx_cart=open");
    expect(coll).toContain("{% else %}{{ routes.cart_url }}/add?items[][id]=1&items[][quantity]=1&return_to={{ routes.collections_url }}/shop-all?cx_cart=open{% endif %}");
    expect(url).toContain("{% elsif _c == 'FR' %}{{ routes.cart_url }}/777:1?discount=CREPE20");
    expect(url).toContain("{% else %}{{ routes.cart_url }}/1:1?discount=CREPE20{% endif %}");
  });
  it("collects add-ons", () => {
    expect(cardItems({ variantId: "1", quantity: 1, addOns: [{ variantId: "2", quantity: 3 }] })).toEqual([{ variantId: "1", quantity: 1 }, { variantId: "2", quantity: 3 }]);
  });
});

describe("translations", () => {
  it("emits a Liquid locale switch for translated strings and keeps the source as fallback", () => {
    const content = seedContent("crepey-skin");
    const hero = content.sections.find((s) => s.type === "hero")!;
    content.translations = { fr: { [`sections.${hero.id}.eyebrow`]: "Recommandé par les dermatologues" } };
    const out = renderPage({ page: content, brand: DEFAULT_BRAND, pageId: "t", slug: "t", mode: "liquid" });
    expect(out.html).toContain("{% if _l == 'fr' %}Recommandé par les dermatologues{% else %}Recommended by dermatologists across Europe{% endif %}");
    const fr = renderPage({ page: content, brand: DEFAULT_BRAND, pageId: "t", slug: "t", mode: "preview", previewLocale: "fr" });
    expect(fr.html).toContain("Recommandé par les dermatologues");
  });
  it("collects translatable strings incl. split trust-bar items and comparison cells", () => {
    const content = seedContent("crepey-skin");
    const hero = content.sections.find((s) => s.type === "hero")!;
    const strings = collectTranslatableStrings(hero);
    expect(strings.some((s) => s.path.endsWith(".trust.0") && s.value.startsWith("Used in 100+"))).toBe(true);
    const cmp = content.sections.find((s) => s.type === "comparison")!;
    const cmpStrings = collectTranslatableStrings(cmp);
    expect(cmpStrings.some((s) => s.value === "(RF results fade in ~8 months)")).toBe(true);
  });
  it("neutralises Liquid tags typed into content", () => {
    const content = seedContent("crepey-skin");
    content.sections.find((s) => s.type === "hero")!.data.eyebrow = "{{ shop.name }} {% raw %}";
    const out = renderPage({ page: content, brand: DEFAULT_BRAND, pageId: "t", slug: "t", mode: "liquid" });
    expect(out.html).not.toContain("{{ shop.name }}");
    expect(out.html).toContain("&#123;&#123; shop.name &#125;&#125;");
  });
});

describe("duplication", () => {
  it("clones a page with fresh section ids and re-keyed translations", () => {
    const content = seedContent("crepey-skin");
    const hero = content.sections.find((s) => s.type === "hero")!;
    content.translations = { fr: { [`sections.${hero.id}.eyebrow`]: "FR" } };
    const copy = clonePageContent(content);
    expect(copy.sections.length).toBe(content.sections.length);
    expect(copy.sections.map((s) => s.type)).toEqual(content.sections.map((s) => s.type));
    const newHero = copy.sections.find((s) => s.type === "hero")!;
    expect(newHero.id).not.toBe(hero.id);
    expect(copy.translations.fr[`sections.${newHero.id}.eyebrow`]).toBe("FR");
    // deep copy: mutating the copy never touches the source
    newHero.data.headline = "changed";
    expect(hero.data.headline).not.toBe("changed");
  });
  it("swapping product-specific fields yields a coherent, publishable page (jawline from crepey)", () => {
    const source = seedContent("crepey-skin");
    const target = seedContent("jawline-ritual");
    const copy = clonePageContent(source);
    // simulate the wizard: swap commerce + product-specific fields
    copy.commerce = { ...target.commerce };
    for (let i = 0; i < copy.sections.length; i++) {
      const def = SECTION_MAP[copy.sections[i].type];
      for (const f of def.fields.filter((f) => f.productSpecific)) copy.sections[i].data[f.key] = target.sections[i].data[f.key];
    }
    const out = renderPage({ page: copy, brand: DEFAULT_BRAND, pageId: "t", slug: "jawline-copy", mode: "liquid" });
    expect(out.warnings).toEqual([]);
    expect(out.html).toContain("jawlines look years younger");
    expect(out.html).toContain("all_products['jawline-contour-tightening-cream']");
    expect(out.html).toContain("items[][id]=42739675037832&items[][quantity]=1&items[][id]=55089188438391&items[][quantity]=1");
    // shared elements carried over untouched
    expect(out.html).toContain("60-day money-back guarantee");
    expect(out.html).toContain("Formulated and made in Europe");
    expect(out.html).toContain('id="cx-disclaimer"');
  });
});

describe("theme shell (real store header/footer around previews)", () => {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/cdn/shop/t/1/assets/theme.css"><link rel="preload" href="/x.js" as="script"><script>window.x=1</script><style>.a{background:url(/cdn/a.png)}</style></head><body class="template__index"><div class="fixed-wrap"><div id="shopify-section-alert-bar">bar</div><div id="shopify-section-header"><img src="/cdn/logo.svg" srcset="/cdn/logo.svg 1x, /cdn/logo@2x.svg 2x"><a href="/collections/shop-all" onclick="evil()">Shop</a><script>alert(1)</script></div></div><main id="main" class="x"><h1>Home</h1></main><div id="shopify-section-footer">foot</div><noscript>n</noscript></body></html>`;
  it("keeps everything outside <main>, strips scripts and re-points root-relative URLs at the store", async () => {
    const { extractShell, wrapInThemeShell } = await import("../app/lib/render/theme-shell.server");
    const shell = extractShell(html, "https://cellexialabs.com")!;
    expect(shell).toBeTruthy();
    expect(shell.bodyAttrs).toContain('class="template__index"');
    expect(shell.head).toContain('href="https://cellexialabs.com/cdn/shop/t/1/assets/theme.css"');
    expect(shell.head).toContain("url(https://cellexialabs.com/cdn/a.png)");
    expect(shell.head).not.toContain("preload");
    expect(shell.head).not.toContain("<script");
    expect(shell.before).toContain("shopify-section-alert-bar");
    expect(shell.before).toContain("shopify-section-header");
    expect(shell.before).toContain('src="https://cellexialabs.com/cdn/logo.svg"');
    expect(shell.before).toContain('srcset="https://cellexialabs.com/cdn/logo.svg 1x, https://cellexialabs.com/cdn/logo@2x.svg 2x"');
    expect(shell.before).toContain('href="https://cellexialabs.com/collections/shop-all"');
    expect(shell.before).not.toContain("<script");
    expect(shell.before).not.toContain("onclick");
    expect(shell.before).not.toContain("<h1>Home</h1>");
    expect(shell.after).toContain("shopify-section-footer");
    expect(shell.after).not.toContain("<noscript");
    const doc = wrapInThemeShell('<div id="cx-page"><img src="/builder/seed/hero.jpg"></div>', shell, { title: "T" });
    expect(doc).toContain('<main id="main"><div id="cx-page">');
    expect(doc).toContain('src="/builder/seed/hero.jpg"'); // the page's own assets stay app-relative
    expect(doc).not.toContain("<base ");
    expect(doc.indexOf("shopify-section-header")).toBeLessThan(doc.indexOf('id="cx-page"'));
    expect(doc.indexOf('id="cx-page"')).toBeLessThan(doc.indexOf("shopify-section-footer"));
    // no shell (offline) → plain standalone document
    expect(wrapInThemeShell("<div>x</div>", null, { title: "T" })).toContain("<!doctype html>");
  });
});
