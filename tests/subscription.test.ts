import { describe, it, expect } from "vitest";
import { Liquid } from "liquidjs";
import { SEEDS } from "../app/lib/seed/seed.server";
import { normalizePage, DEFAULT_BRAND } from "../app/lib/brand";
import { renderPage } from "../app/lib/render/render-page";
import { buildCartUrl, cardItems } from "../app/lib/commerce/cart-links";
import { sellingPlanInfoFromNode, detectOfferType, offerLineFor, deliveryLineFor, applySubscriptionPresets, removeSubscriptionPresets, subscriptionBrief, resetPlansForNewProduct, manualSubscriptionPrices } from "../app/lib/commerce/subscription";
import { SECTION_MAP } from "../app/lib/sections/registry";
import type { PageContent, RenderContext, SellingPlanInfo } from "../app/lib/types";

const seed = (slug: string): PageContent => normalizePage(JSON.parse(JSON.stringify(SEEDS.find((s) => s.slug === slug)!.content)));

// Real nodes from cellexialabs.com (Body Wrinkle Cream, 2026-08-17) + a synthetic intro plan.
const NODE_3M = { id: "gid://shopify/SellingPlan/718190281079", name: "Every 3 Months", options: ["Every 3 Months"], billingPolicy: { __typename: "SellingPlanRecurringBillingPolicy", interval: "MONTH", intervalCount: 3 }, deliveryPolicy: { __typename: "SellingPlanRecurringDeliveryPolicy", interval: "MONTH", intervalCount: 3 }, pricingPolicies: [{ __typename: "SellingPlanFixedPricingPolicy", adjustmentType: "PERCENTAGE", adjustmentValue: { __typename: "SellingPlanPricingPolicyPercentageValue", percentage: 5 } }] };
const NODE_2M = { ...NODE_3M, id: "gid://shopify/SellingPlan/718190313847", name: "Every 2 Months", options: ["Every 2 Months"], billingPolicy: { ...NODE_3M.billingPolicy, intervalCount: 2 }, deliveryPolicy: { ...NODE_3M.deliveryPolicy, intervalCount: 2 } };
const NODE_INTRO = { id: "gid://shopify/SellingPlan/999", name: "Every 4 weeks", options: ["Every 4 weeks"], billingPolicy: { __typename: "SellingPlanRecurringBillingPolicy", interval: "WEEK", intervalCount: 4 }, deliveryPolicy: { __typename: "SellingPlanRecurringDeliveryPolicy", interval: "WEEK", intervalCount: 4 }, pricingPolicies: [{ __typename: "SellingPlanFixedPricingPolicy", adjustmentType: "PERCENTAGE", adjustmentValue: { __typename: "SellingPlanPricingPolicyPercentageValue", percentage: 50 } }, { __typename: "SellingPlanRecurringPricingPolicy", adjustmentType: "PERCENTAGE", afterCycle: 1, adjustmentValue: { __typename: "SellingPlanPricingPolicyPercentageValue", percentage: 10 } }] };

describe("selling plans → SellingPlanInfo", () => {
  it("flattens Admin API nodes (frequency, percentages, summary) and detects the offer type", () => {
    const p3 = sellingPlanInfoFromNode(NODE_3M, "Every 3 months");
    expect(p3).toMatchObject({ id: "718190281079", frequency: "every 3 months", recurringPct: 5 });
    expect(p3.firstPct).toBeUndefined();
    expect(p3.summary).toBe("every 3 months · 5% off every delivery");
    const pi = sellingPlanInfoFromNode(NODE_INTRO, "Trial");
    expect(pi).toMatchObject({ id: "999", frequency: "every 4 weeks", firstPct: 50, recurringPct: 10, afterCycle: 1 });
    expect(pi.summary).toBe("every 4 weeks · 50% off first order, then 10% off");
    expect(detectOfferType([p3])).toBe("simple");
    expect(detectOfferType([pi])).toBe("trial");
    expect(detectOfferType([{ ...pi, firstPct: 20 }])).toBe("intro");
    expect(offerLineFor("simple", p3)).toBe("Save 5% on every delivery");
    expect(offerLineFor("trial", pi)).toContain("50% off your first delivery");
    expect(offerLineFor("intro", { ...pi, firstPct: 20 })).toBe("20% off your first order, then 10% off every delivery");
    expect(deliveryLineFor(p3)).toBe("Delivered every 3 months · skip, pause or cancel anytime");
  });
});

describe("subscription cart links", () => {
  const ctx = (page: PageContent, mode: "liquid" | "preview" = "preview", brand = DEFAULT_BRAND): RenderContext => ({ mode, brand, page, pageId: "t", slug: "t", locales: [], storeRoot: "https://cellexialabs.com", eventsPath: "/a/go/_e", proxyPath: "/a/go" });
  it("adds the line with its selling plan; store default lands on Shop All with the drawer; checkout mode goes /cart/add → /checkout (permalinks can't carry plans)", () => {
    const page = seed("crepey-skin");
    const items = cardItems({ variantId: "42686740791432", quantity: 1, sellingPlanId: "gid://shopify/SellingPlan/718190281079", addOns: [] });
    expect(items[0].sellingPlanId).toBe("718190281079");
    expect(buildCartUrl({ ctx: ctx(page), items, cardIndex: 0 })).toBe("https://cellexialabs.com/cart/add?items[][id]=42686740791432&items[][quantity]=1&items[][selling_plan]=718190281079&return_to=https://cellexialabs.com/collections/shop-all?cx_cart=open");
    const checkout = { ...page, commerce: { ...page.commerce, checkoutMode: "checkout" as const } };
    expect(buildCartUrl({ ctx: ctx(checkout), items, cardIndex: 0 })).toBe("https://cellexialabs.com/cart/add?items[][id]=42686740791432&items[][quantity]=1&items[][selling_plan]=718190281079&return_to=/checkout");
    expect(buildCartUrl({ ctx: ctx(checkout, "liquid"), items, cardIndex: 0 })).toBe("{{ routes.cart_url }}/add?items[][id]=42686740791432&items[][quantity]=1&items[][selling_plan]=718190281079&return_to=/checkout");
    // without a plan the permalink stays
    expect(buildCartUrl({ ctx: ctx(checkout), items: [{ variantId: "1", quantity: 1 }], cardIndex: 0 })).toBe("https://cellexialabs.com/cart/1:1");
  });
});

describe("subscription mode on a page", () => {
  const plans: SellingPlanInfo[] = [sellingPlanInfoFromNode(NODE_2M, "Every 2 months"), sellingPlanInfoFromNode(NODE_3M, "Every 3 months")];
  const subPage = () => applySubscriptionPresets(seed("crepey-skin"), { plans, cardPlans: { "0": "718190313847", "1": "718190281079", "2": "718190313847" } });

  it("presets: wires cards, fills delivery/offer lines, terms, FAQ items, benefits row and button labels; removal undoes it", () => {
    const base = seed("crepey-skin");
    const p = subPage();
    expect(p.commerce.purchaseMode).toBe("subscription");
    expect(p.commerce.subscription.offerType).toBe("simple");
    const pricing = p.sections.find((s) => s.type === "pricing")!;
    expect(pricing.data.cards[0].sellingPlanId).toBe("718190313847");
    expect(pricing.data.cards[1].sellingPlanId).toBe("718190281079");
    expect(pricing.data.cards[0].deliveryLine).toBe("Delivered every 2 months · skip, pause or cancel anytime");
    expect(pricing.data.cards[1].offerLine).toBe("Save 5% on every delivery");
    expect(pricing.data.cards[0].buttonLabel).toBe("Subscribe & save");
    expect(pricing.data.subscriptionTerms).toContain("charged at each delivery");
    expect(pricing.data.labelPerDelivery).toBe("per delivery"); // wording fields exist → collected for translation
    const faq = p.sections.find((s) => s.type === "faq")!;
    expect(faq.data.items.filter((it: any) => it.preset === "subscription").length).toBe(4);
    const i = p.sections.findIndex((s) => s.type === "pricing");
    expect(p.sections[i + 1].type).toBe("purity");
    expect(p.sections[i + 1].data.preset).toBe("subscription");
    expect(p.stickyBar.buttonLabel).toBe("Subscribe & save");
    expect(p.sections.length).toBe(base.sections.length + 1);
    // idempotent
    expect(applySubscriptionPresets(p, { plans }).sections.length).toBe(p.sections.length);
    // trial gets the extra FAQ
    expect(applySubscriptionPresets(seed("crepey-skin"), { plans, offerType: "trial" }).sections.find((s) => s.type === "faq")!.data.items.filter((it: any) => it.preset === "subscription").length).toBe(5);
    // remove
    const back = removeSubscriptionPresets(p);
    expect(back.commerce.purchaseMode).toBe("one-time");
    expect(back.sections.length).toBe(base.sections.length);
    expect(back.sections.find((s) => s.type === "faq")!.data.items.some((it: any) => it.preset === "subscription")).toBe(false);
    expect(back.sections.find((s) => s.type === "pricing")!.data.cards[0].buttonLabel).toBe("Add to cart");
    expect(subscriptionBrief(p)).toContain("SUBSCRIPTION only");
    expect(subscriptionBrief(back)).toBe("");
  });

  it("preview: cards show delivery + offer lines, terms under the cards, subscription hrefs; no gift", () => {
    const p = subPage();
    const html = renderPage({ page: p, brand: DEFAULT_BRAND, pageId: "t", slug: "t", mode: "preview", storeRoot: "https://cellexialabs.com" }).html;
    expect(html).toContain('data-cx-purchase="subscription"');
    expect(html).toContain('<p class="cx-card__delivery">');
    expect(html).toContain("Delivered every 2 months");
    expect(html).toContain("Save 5% on every delivery");
    expect(html).toContain("cx-pricing__terms");
    expect(html).toContain("items[][id]=42686740791432&items[][quantity]=1&items[][selling_plan]=718190313847");
    expect(html).toContain("items[][id]=42739679559816&items[][quantity]=1&items[][selling_plan]=718190281079");
    expect(html).toContain('data-cx-mode="subscription"');
    expect(html).toContain("Subscribe &amp; save");
    expect(html).not.toMatch(/towel/i);
    // one-time page has none of it
    const one = renderPage({ page: seed("crepey-skin"), brand: DEFAULT_BRAND, pageId: "t", slug: "t", mode: "preview", storeRoot: "https://cellexialabs.com" }).html;
    expect(one).not.toContain("selling_plan");
    expect(one).not.toContain('<p class="cx-card__delivery">');
  });

  it("Liquid: live subscription prices from selling_plan_allocations, intro pricing, market without the plan → one-time fallback or hidden card", async () => {
    const p = subPage();
    const out = renderPage({ page: p, brand: DEFAULT_BRAND, pageId: "t", slug: "crepey-skin", mode: "liquid" });
    expect(out.warnings).toEqual([]);
    expect(out.html).toContain("selling_plan_allocations");
    const engine = new Liquid({ strictFilters: true, strictVariables: false });
    engine.registerFilter("money", (cents: number) => `€${(Number(cents) / 100).toFixed(2)}`);
    const alloc = (planId: number, price: number, compare: number, adjustments: number[] = []) => ({ selling_plan: { id: planId }, price, compare_at_price: compare, price_adjustments: adjustments.map((pr, i) => ({ position: i + 1, price: pr })) });
    const globals = (withPlan: boolean) => ({
      request: { locale: { iso_code: "en" } },
      localization: { country: { iso_code: "IE" } },
      routes: { cart_url: "/cart", root_url: "/", collections_url: "/collections" },
      all_products: {
        "body-wrinkle-cream": {
          variants: [
            { id: 42686740791432, price: 5700, compare_at_price: null, selling_plan_allocations: withPlan ? [alloc(718190313847, 5415, 5700)] : [] },
            { id: 42686740824200, price: 9690, compare_at_price: 11400, selling_plan_allocations: withPlan ? [alloc(718190313847, 9205, 9690)] : [] },
            // 3-jar card on the 3-month plan, priced as an intro plan: first 6840 then 12312
            { id: 42739679559816, price: 13680, compare_at_price: 17100, selling_plan_allocations: withPlan ? [alloc(718190281079, 6840, 13680, [6840, 12312])] : [] },
          ],
        },
      },
    });
    const html = await engine.parseAndRender(out.html, globals(true));
    expect(html).not.toContain("{%");
    expect(html).toContain("€54.15"); // 1 jar every 2 months, 5% off
    expect(html).toContain("per delivery");
    expect(html).toContain("€68.40"); // first delivery of the intro-priced 3-jar plan
    expect(html).toContain("then €123.12 per delivery");
    expect(html).toContain('href="/cart/add?items[][id]=42686740791432&items[][quantity]=1&items[][selling_plan]=718190313847&return_to=/collections/shop-all?cx_cart=open"');
    // market without the plan → one-time button (default policy) and manual prices
    const none = await engine.parseAndRender(out.html, globals(false));
    expect(none).toContain('href="/cart/add?items[][id]=42686740791432&items[][quantity]=1&return_to=/collections/shop-all?cx_cart=open"');
    expect(none).not.toContain("selling_plan=");
    expect(none).toContain("€57.00"); // manual fallback
    // hide policy
    const hide = { ...p, commerce: { ...p.commerce, subscription: { ...p.commerce.subscription, unavailable: "hide" as const } } };
    const outHide = renderPage({ page: hide, brand: DEFAULT_BRAND, pageId: "t", slug: "crepey-skin", mode: "liquid" });
    const hidden = await engine.parseAndRender(outHide.html, globals(false));
    expect(hidden).not.toContain('data-cx-card="0"');
    const shown = await engine.parseAndRender(outHide.html, globals(true));
    expect(shown).toContain('data-cx-card="0"');
    expect(out.bytes).toBeLessThan(256 * 1024);
  });
});

describe("manual (preview/fallback) subscription prices", () => {
  it("derives subscriber prices from the manual one-time price and keeps the currency format", async () => {
    const simple = { id: "1", gid: "", name: "", groupName: "", frequency: "every 2 months", recurringPct: 5, summary: "" };
    expect(manualSubscriptionPrices("€57.00", simple)).toMatchObject({ first: "€54.15", recurring: "€54.15", compare: "€57.00", recurringPct: 5, saveLine: "5% {every}" });
    expect(manualSubscriptionPrices("57,00 €", simple)).toMatchObject({ recurring: "54,15 €" });
    expect(manualSubscriptionPrices("$1,140.00", { ...simple, recurringPct: 10 })).toMatchObject({ recurring: "$1026.00" });
    const trial = { ...simple, firstPct: 50, recurringPct: 10 };
    expect(manualSubscriptionPrices("€136.80", trial)).toMatchObject({ first: "€68.40", recurring: "€123.12", compare: "€136.80" });
    expect(manualSubscriptionPrices("", simple)).toBeNull();
    expect(manualSubscriptionPrices("€57.00", undefined)).toBeNull();
    expect(manualSubscriptionPrices("[PRICE]", simple)).toBeNull();
  });
  it("preview shows the derived subscriber price when plans are known", async () => {
    const { applySubscriptionPresets, sellingPlanInfoFromNode } = await import("../app/lib/commerce/subscription");
    const plan = sellingPlanInfoFromNode({ id: "gid://shopify/SellingPlan/5", name: "Every month", billingPolicy: { interval: "MONTH", intervalCount: 1 }, deliveryPolicy: { interval: "MONTH", intervalCount: 1 }, pricingPolicies: [{ __typename: "SellingPlanFixedPricingPolicy", adjustmentValue: { __typename: "SellingPlanPricingPolicyPercentageValue", percentage: 10 } }] }, "Monthly");
    const page = applySubscriptionPresets(normalizePage(JSON.parse(JSON.stringify(SEEDS[0].content))), { plans: [plan], cardPlans: { "0": "5", "1": "5", "2": "5" } });
    const html = renderPage({ page, brand: DEFAULT_BRAND, pageId: "t", slug: "t", mode: "preview", storeRoot: "https://cellexialabs.com" }).html;
    expect(html).toContain("€51.30"); // 57 × 0.9
    expect(html).toContain("€123.12 per delivery"); // 136.80 × 0.9
    expect(html).toContain("You save 10% every delivery");
  });
});

describe("subscription mode — hardening (adversarial review)", () => {
  const plans2 = () => [sellingPlanInfoFromNode(NODE_2M, "Every 2 months"), sellingPlanInfoFromNode(NODE_3M, "Every 3 months")];
  const engine = () => { const e = new Liquid({ strictFilters: true, strictVariables: false }); e.registerFilter("money", (c: number) => `€${(Number(c) / 100).toFixed(2)}`); return e; };
  const alloc = (planId: number, price: number, compare: number, adjustments: number[] = [], perDelivery?: number) => ({ selling_plan: { id: planId }, price, compare_at_price: compare, per_delivery_price: perDelivery ?? price, price_adjustments: adjustments.map((pr, i) => ({ position: i + 1, price: pr, per_delivery_price: pr })) });
  const globals = (variants: any[]) => ({ request: { locale: { iso_code: "en" } }, localization: { country: { iso_code: "IE" } }, routes: { cart_url: "/cart", root_url: "/", collections_url: "/collections" }, all_products: { "body-wrinkle-cream": { variants } } });

  it("market without the plan: the WHOLE card falls back to one-time (price, no delivery/offer lines, 'Add to cart', one-time href, non-subscription mode attr)", async () => {
    const p = applySubscriptionPresets(seed("crepey-skin"), { plans: plans2(), cardPlans: { "0": "718190313847", "1": "718190281079", "2": "718190313847" } });
    const out = renderPage({ page: p, brand: DEFAULT_BRAND, pageId: "t", slug: "crepey-skin", mode: "liquid" });
    const html = await engine().parseAndRender(out.html, globals([
      { id: 42686740791432, price: 5700, compare_at_price: null, selling_plan_allocations: [] },
      { id: 42686740824200, price: 9690, compare_at_price: 11400, selling_plan_allocations: [] },
      { id: 42739679559816, price: 13680, compare_at_price: 17100, selling_plan_allocations: [] },
    ]));
    const card0 = html.slice(html.indexOf('data-cx-card="0"'), html.indexOf('data-cx-card="1"'));
    expect(card0).toContain('<span class="cx-price__now">€57.00</span>'); // the live ONE-TIME price, not a subscriber price
    expect(card0).not.toContain("per delivery");
    expect(card0).not.toContain('<p class="cx-card__delivery">');
    expect(card0).not.toContain("Save 5%");
    expect(card0).toContain(">Add to cart</a>");
    expect(card0).not.toContain('data-cx-mode="subscription"');
    expect(card0).toContain('href="/cart/add?items[][id]=42686740791432&items[][quantity]=1&return_to=/collections/shop-all?cx_cart=open"');
    // …and with the plan present the same template shows the subscription card
    const html2 = await engine().parseAndRender(out.html, globals([{ id: 42686740791432, price: 5700, compare_at_price: null, selling_plan_allocations: [alloc(718190313847, 5415, 5700)] }]));
    const c0 = html2.slice(html2.indexOf('data-cx-card="0"'), html2.indexOf('data-cx-card="1"'));
    expect(c0).toContain("€54.15");
    expect(c0).toContain("per delivery");
    expect(c0).toContain('<p class="cx-card__delivery">');
    expect(c0).toContain(">Subscribe &amp; save</a>");
    expect(c0).toContain('data-cx-mode="subscription"');
  });

  it("availability check happens even with live prices OFF (lookup still emitted); prepaid plans show the per-delivery price", async () => {
    const p = applySubscriptionPresets(seed("crepey-skin"), { plans: plans2(), cardPlans: { "0": "718190313847", "1": "718190281079", "2": "718190313847" } });
    const off = { ...p, commerce: { ...p.commerce, livePrices: false } };
    const out = renderPage({ page: off, brand: DEFAULT_BRAND, pageId: "t", slug: "crepey-skin", mode: "liquid" });
    expect(out.html).toContain("selling_plan_allocations");
    const html = await engine().parseAndRender(out.html, globals([{ id: 42686740791432, price: 5700, compare_at_price: null, selling_plan_allocations: [] }]));
    const card0 = html.slice(html.indexOf('data-cx-card="0"'), html.indexOf('data-cx-card="1"'));
    expect(card0).toContain(">Add to cart</a>"); // fallback still applied
    expect(card0).not.toContain("selling_plan=");
    // prepaid: price = 3 deliveries charged at once, per_delivery_price = one delivery
    const live = renderPage({ page: p, brand: DEFAULT_BRAND, pageId: "t", slug: "crepey-skin", mode: "liquid" });
    const html2 = await engine().parseAndRender(live.html, globals([{ id: 42686740791432, price: 5700, compare_at_price: null, selling_plan_allocations: [alloc(718190313847, 16245, 17100, [], 5415)] }]));
    const c0 = html2.slice(html2.indexOf('data-cx-card="0"'), html2.indexOf('data-cx-card="1"'));
    expect(c0).toContain('<span class="cx-price__now">€54.15</span>');
    expect(c0).toContain("€54.15 per jar · per delivery");
  });

  it("presets never fabricate numbers, refresh their own lines when plans arrive, keep team edits, restore the sticky label, re-key FAQ translations", () => {
    const base = seed("crepey-skin");
    base.stickyBar.buttonLabel = "Order now · free shipping today";
    // 1) mode switched before plans are loaded → placeholders, no invented "10% / every 4 weeks"
    const first = applySubscriptionPresets(base, { plans: [] });
    const c0 = first.sections.find((s) => s.type === "pricing")!.data.cards[0];
    expect(c0.deliveryLine).toBe("Delivered [every N weeks] · skip, pause or cancel anytime");
    expect(c0.offerLine).toBe("Save [10]% on every delivery");
    expect(first.stickyBar.buttonLabel).toBe("Subscribe & save");
    expect(first.stickyBar.prevButtonLabel).toBe("Order now · free shipping today");
    // team edits card 2's offer line
    const edited = { ...first, sections: first.sections.map((s) => (s.type === "pricing" ? { ...s, data: { ...s.data, cards: s.data.cards.map((c: any, i: number) => (i === 1 ? { ...c, offerLine: "Our best value — hand-written" } : c)) } } : s)) };
    // 2) plans loaded → preset lines refreshed with real data, the edited one kept
    const loaded = applySubscriptionPresets(edited, { plans: plans2(), cardPlans: { "0": "718190313847", "1": "718190281079", "2": "718190313847" } });
    const cards = loaded.sections.find((s) => s.type === "pricing")!.data.cards;
    expect(cards[0].deliveryLine).toBe("Delivered every 2 months · skip, pause or cancel anytime");
    expect(cards[0].offerLine).toBe("Save 5% on every delivery");
    expect(cards[1].offerLine).toBe("Our best value — hand-written");
    expect(cards[1].deliveryLine).toBe("Delivered every 3 months · skip, pause or cancel anytime");
    expect(loaded.sections.find((s) => s.type === "pricing")!.data.subscriptionTerms).toContain("every 2 months / every 3 months");
    // 3) FAQ translations: an fr translation of the last original FAQ item + one for a preset item; removal drops the preset's and keeps the original's index
    const faq = loaded.sections.find((s) => s.type === "faq")!;
    const nOrig = faq.data.items.filter((it: any) => it.preset !== "subscription").length;
    const withTr = { ...loaded, translations: { fr: { [`sections.${faq.id}.items.${nOrig - 1}.q`]: "Dernière question", [`sections.${faq.id}.items.${nOrig}.q`]: "Comment ça marche ?" } } };
    const back = removeSubscriptionPresets(withTr);
    expect(back.translations.fr[`sections.${faq.id}.items.${nOrig - 1}.q`]).toBe("Dernière question");
    expect(back.translations.fr[`sections.${faq.id}.items.${nOrig}.q`]).toBeUndefined();
    expect(back.stickyBar.buttonLabel).toBe("Order now · free shipping today");
    expect(back.commerce.purchaseMode).toBe("one-time");
    // 4) product change clears plans + card ids
    const reset = resetPlansForNewProduct(loaded);
    expect(reset.commerce.subscription.plans).toEqual([]);
    expect(reset.sections.find((s) => s.type === "pricing")!.data.cards.every((c: any) => !c.sellingPlanId)).toBe(true);
  });

  it("non-percentage policies (fixed amount off / fixed price) and prepaid billing are described honestly", () => {
    const amountOff = sellingPlanInfoFromNode({ id: "gid://shopify/SellingPlan/77", name: "Monthly", billingPolicy: { interval: "MONTH", intervalCount: 1 }, deliveryPolicy: { interval: "MONTH", intervalCount: 1 }, pricingPolicies: [{ __typename: "SellingPlanFixedPricingPolicy", adjustmentType: "FIXED_AMOUNT", adjustmentValue: { __typename: "MoneyV2", amount: "5.0", currencyCode: "EUR" } }] }, "Monthly");
    expect(amountOff.recurringMoney).toEqual({ kind: "amount_off", amount: 5, currency: "EUR" });
    expect(amountOff.summary).toBe("every month · €5 off every delivery");
    expect(offerLineFor("simple", amountOff)).toBe("Save €5 on every delivery");
    expect(manualSubscriptionPrices("€57.00", amountOff)).toMatchObject({ recurring: "€52.00", saveLine: "€5 {every}" });
    const fixedPrice = sellingPlanInfoFromNode({ id: "gid://shopify/SellingPlan/78", name: "Monthly", billingPolicy: { interval: "MONTH", intervalCount: 1 }, deliveryPolicy: { interval: "MONTH", intervalCount: 1 }, pricingPolicies: [{ __typename: "SellingPlanFixedPricingPolicy", adjustmentType: "PRICE", adjustmentValue: { __typename: "MoneyV2", amount: "49.0", currencyCode: "EUR" } }] }, "Monthly");
    expect(offerLineFor("simple", fixedPrice)).toBe("Subscriber price: €49 per delivery");
    expect(manualSubscriptionPrices("€57.00", fixedPrice)).toMatchObject({ recurring: "€49.00" });
    const prepaid = sellingPlanInfoFromNode({ id: "gid://shopify/SellingPlan/79", name: "3 months prepaid", billingPolicy: { interval: "MONTH", intervalCount: 3 }, deliveryPolicy: { interval: "MONTH", intervalCount: 1 }, pricingPolicies: [] }, "Prepaid");
    expect(prepaid.prepaid).toBe(true);
    expect(prepaid.summary).toBe("every month · no discount · prepaid, billed every 3 months");
    expect(offerLineFor("simple", prepaid)).toBe("Subscriber price on every delivery");
    // wording fields are real section fields (translatable) — present on the pricing definition
    expect(SECTION_MAP.pricing.fields.some((f: any) => f.key === "labelPerDelivery")).toBe(true);
  });
});
