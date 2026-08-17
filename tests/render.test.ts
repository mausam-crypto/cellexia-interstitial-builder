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
  "announcement_bar", "hero", "reason", "reason", "reason", "text_block", "purity", "science", "evidence", "pillars", "expert_quote", "pricing", "guarantee", "comparison", "timeline", "testimonials", "reviews", "faq", "final_cta",
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
      it("has all 19 sections in the doc's order", () => {
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
        const html = renderPage({ page: content, brand: DEFAULT_BRAND, pageId: "t", slug: seed.slug, mode: "preview", storeRoot: "https://cellexialabs.com" }).html;
        expect(html).toContain(`https://cellexialabs.com/cart/${cards[0].variantId}:1"`);
        expect(html).toContain(`https://cellexialabs.com/cart/${cards[1].variantId}:1,55089188438391:1"`);
        expect(html).toContain(`https://cellexialabs.com/cart/${cards[2].variantId}:1"`);
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
  it("applies the discount code in checkout mode when enabled", () => {
    const url = buildCartUrl({ ctx: ctx({ discountEnabled: true, discountCode: "CREPE20" }), items: [{ variantId: "1", quantity: 1 }, { variantId: "2", quantity: 1 }], cardIndex: 0 });
    expect(url).toBe("https://cellexialabs.com/cart/1:1,2:1?discount=CREPE20");
  });
  it("omits the discount when disabled or when the code is a placeholder", () => {
    expect(buildCartUrl({ ctx: ctx({ discountEnabled: false, discountCode: "X" }), items: [{ variantId: "1", quantity: 1 }], cardIndex: 0 })).toBe("https://cellexialabs.com/cart/1:1");
    expect(buildCartUrl({ ctx: ctx({ discountEnabled: true, discountCode: "[FUNNEL-CODE]" }), items: [{ variantId: "1", quantity: 1 }], cardIndex: 0 })).toBe("https://cellexialabs.com/cart/1:1");
  });
  it("builds the Glow25-style discount → add → cart chain in cart mode", () => {
    const url = buildCartUrl({ ctx: ctx({ checkoutMode: "cart", discountEnabled: true, discountCode: "CREPE20" }), items: [{ variantId: "1", quantity: 1 }, { variantId: "9", quantity: 1 }], cardIndex: 0 });
    expect(url).toBe("https://cellexialabs.com/discount/CREPE20?redirect=https://cellexialabs.com/cart/add?items[][id]=1%26items[][quantity]=1%26items[][id]=9%26items[][quantity]=1%26return_to=/cart");
  });
  it("uses locale-aware storefront routes in Liquid mode and branches per market", () => {
    const url = buildCartUrl({ ctx: ctx({ discountEnabled: true, discountCode: "CREPE20", marketOverrides: { DE: { discountCode: "CREPE20DE" }, FR: { cardVariantIds: { "0": "777" } } } }, "liquid"), items: [{ variantId: "1", quantity: 1 }], cardIndex: 0 });
    expect(url).toContain("{% if _c == 'DE' %}{{ routes.cart_url }}/1:1?discount=CREPE20DE");
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
    content.sections[1].data.eyebrow = "{{ shop.name }} {% raw %}";
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
    expect(out.html).toContain("42739675037832:1,55089188438391:1");
    // shared elements carried over untouched
    expect(out.html).toContain("60-day money-back guarantee");
    expect(out.html).toContain("Formulated and made in Europe");
    expect(out.html).toContain('id="cx-disclaimer"');
  });
});
