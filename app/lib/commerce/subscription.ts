/**
 * Subscription mode helpers (client-safe): describe Shopify selling plans, derive the offer type,
 * and apply/remove the subscription copy presets on a page.
 *
 * Native Shopify subscriptions: a selling plan = billing/delivery interval + pricing policies
 * (fixed = applies to the first N cycles / recurring = after `afterCycle`). The cart line carries
 * `selling_plan`; Liquid exposes the plan's price per market via `variant.selling_plan_allocations`.
 *
 * Preset copy written by this module is remembered on the item (`_presetDeliveryLine`, `_presetOfferLine`,
 * `_presetTerms`) so it can be refreshed when the plans change, while text the team edited is never touched.
 */
import type { PageContent, SectionInstance, SellingPlanInfo, SubscriptionSettings } from "../types";

export type OfferType = SubscriptionSettings["offerType"];

/** "every 4 weeks" / "every month" / "every 3 months". */
export function describeFrequency(interval: string | undefined, count: number | undefined): string {
  const n = Number(count) || 1;
  const unit = String(interval || "").toLowerCase().replace(/s$/, "");
  const word = unit === "week" ? "week" : unit === "day" ? "day" : unit === "year" ? "year" : "month";
  return n === 1 ? `every ${word}` : `every ${n} ${word}s`;
}

type MoneyPolicy = { kind: "amount_off" | "price"; amount: number; currency: string };

function policyValue(p: any): { pct?: number; money?: MoneyPolicy } {
  const v = p?.adjustmentValue;
  const type = String(p?.adjustmentType || "").toUpperCase();
  if (v?.__typename === "SellingPlanPricingPolicyPercentageValue" || typeof v?.percentage === "number") return { pct: Number(v.percentage) };
  if (v?.__typename === "MoneyV2" || v?.amount != null) {
    const amount = Number(v.amount);
    if (Number.isFinite(amount)) return { money: { kind: type === "PRICE" ? "price" : "amount_off", amount, currency: String(v.currencyCode || "") } };
  }
  return {};
}

function fmtMoney(m: MoneyPolicy): string {
  const sym = m.currency === "EUR" ? "€" : m.currency === "USD" ? "$" : m.currency === "GBP" ? "£" : `${m.currency} `;
  return `${sym}${Number.isInteger(m.amount) ? m.amount : m.amount.toFixed(2)}`;
}

/** Raw Admin API selling plan node → SellingPlanInfo (what the editor and cart need). */
export function sellingPlanInfoFromNode(node: any, groupName: string): SellingPlanInfo {
  const gid = String(node?.id || "");
  const id = gid.replace(/\D/g, "");
  const del = node?.deliveryPolicy || node?.billingPolicy || {};
  const bill = node?.billingPolicy || {};
  const frequency = describeFrequency(del.interval, del.intervalCount);
  const billing = bill.interval ? describeFrequency(bill.interval, bill.intervalCount) : undefined;
  const prepaid = !!(billing && billing !== frequency);
  const policies: any[] = node?.pricingPolicies || [];
  const fixed = policies.find((p) => p.__typename === "SellingPlanFixedPricingPolicy");
  const recurring = policies.find((p) => p.__typename === "SellingPlanRecurringPricingPolicy");
  let firstPct: number | undefined;
  let recurringPct: number | undefined;
  let afterCycle: number | undefined;
  let firstMoney: MoneyPolicy | undefined;
  let recurringMoney: MoneyPolicy | undefined;
  if (recurring) {
    const rv = policyValue(recurring);
    recurringPct = rv.pct;
    recurringMoney = rv.money;
    afterCycle = Number(recurring.afterCycle) || undefined;
    if (fixed) {
      const fv = policyValue(fixed);
      firstPct = fv.pct;
      firstMoney = fv.money;
    }
  } else if (fixed) {
    // a single fixed policy applies to every order of the plan
    const fv = policyValue(fixed);
    recurringPct = fv.pct;
    recurringMoney = fv.money;
  }
  const describe = (pct?: number, money?: MoneyPolicy) => (pct != null ? `${pct}% off` : money ? (money.kind === "price" ? `${fmtMoney(money)} fixed price` : `${fmtMoney(money)} off`) : "");
  const first = describe(firstPct, firstMoney);
  const rec = describe(recurringPct, recurringMoney);
  const parts: string[] = [];
  if (first && rec && first !== rec) parts.push(`${first} first ${afterCycle && afterCycle > 1 ? `${afterCycle} orders` : "order"}, then ${rec}`);
  else if (rec) parts.push(`${rec} every delivery`);
  else parts.push("no discount");
  if (prepaid) parts.push(`prepaid, billed ${billing}`);
  return {
    id,
    gid,
    name: String(node?.name || node?.options?.[0] || frequency),
    groupName,
    frequency,
    firstPct,
    recurringPct,
    afterCycle,
    firstMoney,
    recurringMoney,
    prepaid: prepaid || undefined,
    billing,
    summary: `${frequency} · ${parts.join(" · ")}`,
  };
}

/** Guess the offer type from the plans' pricing: 40%+ intro → trial; intro ≠ recurring → intro; else simple. */
export function detectOfferType(plans: SellingPlanInfo[]): OfferType {
  const p = plans.find((x) => (x.firstPct != null && x.recurringPct != null && x.firstPct !== x.recurringPct) || (x.firstMoney && x.recurringMoney && x.firstMoney.amount !== x.recurringMoney.amount));
  if (!p) return "simple";
  return (p.firstPct || 0) >= 40 ? "trial" : "intro";
}

/** Human "X% / €5 off" for a policy (empty when the plan has no known discount). */
function discountWord(pct?: number, money?: MoneyPolicy): string {
  if (pct != null) return `${pct}%`;
  if (money) return money.kind === "price" ? "" : fmtMoney(money);
  return "";
}

/**
 * Default "offer line" of a card. Never invents numbers: without a plan (or without percentages/amounts)
 * it falls back to bracketed placeholders / neutral wording, following the page's [placeholder] convention.
 */
export function offerLineFor(type: OfferType, plan?: SellingPlanInfo): string {
  const first = discountWord(plan?.firstPct, plan?.firstMoney);
  const rec = discountWord(plan?.recurringPct, plan?.recurringMoney);
  if (plan?.recurringMoney?.kind === "price" && !rec) {
    const p = fmtMoney(plan.recurringMoney);
    return type === "simple" ? `Subscriber price: ${p} per delivery` : `${first ? `${first} off your first delivery, then ` : ""}${p} per delivery`;
  }
  if (!plan) {
    if (type === "trial") return "Try it: [50]% off your first delivery — then [10]% off every delivery, cancel anytime";
    if (type === "intro") return "[20]% off your first order, then [10]% off every delivery";
    return "Save [10]% on every delivery";
  }
  if (type === "trial") return first ? `Try it: ${first} off your first delivery — then ${rec ? `${rec} off every delivery` : "the subscriber price"}, cancel anytime` : rec ? `Save ${rec} on every delivery` : "Subscriber price on every delivery";
  if (type === "intro") return first ? `${first} off your first order, then ${rec ? `${rec} off every delivery` : "the subscriber price"}` : rec ? `Save ${rec} on every delivery` : "Subscriber price on every delivery";
  return rec ? `Save ${rec} on every delivery` : "Subscriber price on every delivery";
}

/** Default "delivery line" of a card (placeholder frequency when the plan is unknown). */
export function deliveryLineFor(plan?: SellingPlanInfo): string {
  const f = plan?.frequency || "[every N weeks]";
  return `Delivered ${f} · skip, pause or cancel anytime`;
}

/** Default recurring-payment disclosure under the cards (editable). */
export function defaultSubscriptionTerms(type: OfferType, plans: SellingPlanInfo[] = []): string {
  const freqs = Array.from(new Set(plans.map((p) => p.frequency))).filter(Boolean);
  const freq = freqs.length ? freqs.join(" / ") : "the frequency you choose";
  const prepaid = plans.some((p) => p.prepaid);
  const charge = prepaid ? "your card is charged per billing period shown, covering the deliveries of that period," : `your card is charged at each delivery (${freq}) at the price shown per delivery,`;
  const intro =
    type === "trial"
      ? " Your first delivery is charged at the trial price shown; every following delivery is charged at the recurring price shown next to it."
      : type === "intro"
        ? " Your first order is charged at the introductory price shown; every following delivery is charged at the recurring price shown next to it."
        : "";
  return `Subscription: ${charge} until you cancel.${intro} Skip, pause, change frequency or cancel anytime from your account or by emailing us — no minimum term, no cancellation fee. Prices include VAT; shipping as stated at checkout.`;
}

/** Subscription FAQ presets (marked so they can be removed again). */
export function subscriptionFaqItems(type: OfferType, plans: SellingPlanInfo[] = []): Array<{ q: string; a: string; preset: "subscription" }> {
  const freq = Array.from(new Set(plans.map((p) => p.frequency))).filter(Boolean).join(" or ") || "the frequency you pick";
  const items: Array<{ q: string; a: string; preset: "subscription" }> = [
    { q: "How does the subscription work?", a: `<p>You choose how often you want your delivery (${freq}). We ship automatically at that rhythm and charge your card each time a delivery ships — never in advance for future deliveries.</p>`, preset: "subscription" },
    { q: "Can I skip, pause or cancel?", a: "<p>Yes — anytime, in two clicks from your account (or by emailing us). No minimum term, no cancellation fee. Skip a delivery if you still have plenty, pause for a holiday, or change the frequency whenever you like.</p>", preset: "subscription" },
    { q: "When exactly am I charged?", a: "<p>Today for the first delivery, then on the day each following delivery ships. You'll get an email a few days before every renewal so there are never surprises.</p>", preset: "subscription" },
    { q: "Do I keep the subscriber price?", a: "<p>Yes. As long as your subscription is active you keep your subscriber discount on every delivery, even if the regular price changes.</p>", preset: "subscription" },
  ];
  if (type === "trial") items.splice(3, 0, { q: "What happens after the trial delivery?", a: "<p>Nothing surprising: your next delivery ships at the chosen frequency at the recurring subscriber price shown on the card. If the trial isn't for you, cancel before it ships — you keep the trial jar and pay nothing more.</p>", preset: "subscription" });
  if (type === "intro") items.splice(3, 0, { q: "What happens after the introductory price?", a: "<p>From your second delivery you pay the recurring subscriber price shown next to the introductory price — still below the one-time price — and you can cancel anytime before a delivery ships.</p>", preset: "subscription" });
  return items;
}

/** The "subscription benefits" icon row (a purity section instance, marked as preset). */
export function subscriptionBenefitsSection(id = "sub_benefits"): SectionInstance {
  return {
    id,
    type: "purity",
    data: {
      preset: "subscription",
      heading: "Why subscribers get the best results",
      body: "Skin renews itself in ~28-day cycles — the women who see the biggest change are the ones who never run out. A subscription keeps the ritual going, at the lowest price, with zero effort.",
      icons: [
        { label: "Never run out — delivered on your rhythm", icon: "truck" },
        { label: "Subscriber price locked in", icon: "lock" },
        { label: "Skip, pause or cancel anytime", icon: "clock" },
        { label: "Free shipping on every delivery", icon: "sparkle" },
      ],
      image: undefined,
    },
  };
}

const SUB_BUTTON = "Subscribe & save";
const ONE_TIME_BUTTON = "Add to cart";

/** Value the team can edit freely: keep it unless it is exactly the preset we wrote earlier (or empty). */
function keepOrPreset(current: string | undefined, previousPreset: string | undefined, next: string): string {
  const cur = String(current || "");
  if (!cur.trim() || cur === previousPreset) return next;
  return cur;
}

/**
 * Switch a page to subscription mode: mark the commerce, wire cards to plans (by index when plans are
 * given), fill delivery/offer lines, terms, button labels, sticky bar, add FAQ items and the benefits row.
 * Text the team edited is never overwritten; text this function wrote earlier is refreshed for the new plans.
 */
export function applySubscriptionPresets(content: PageContent, opts: { plans?: SellingPlanInfo[]; offerType?: OfferType; cardPlans?: Record<string, string> } = {}): PageContent {
  const plans = opts.plans || content.commerce.subscription?.plans || [];
  const type: OfferType = opts.offerType || content.commerce.subscription?.offerType || detectOfferType(plans);
  const planById = new Map(plans.map((p) => [p.id, p]));
  const sections = content.sections.map((s) => {
    if (s.type === "pricing") {
      const cards = (s.data.cards || []).map((c: any, i: number) => {
        const planId = String(opts.cardPlans?.[String(i)] ?? c.sellingPlanId ?? "").replace(/\D/g, "");
        const plan = planById.get(planId);
        const dl = deliveryLineFor(plan);
        const ol = offerLineFor(type, plan);
        return {
          ...c,
          sellingPlanId: planId,
          sellingPlanName: plan ? `${plan.groupName && plan.groupName !== plan.name ? plan.groupName + " · " : ""}${plan.name} (${plan.summary})` : planId ? c.sellingPlanName || "" : "",
          deliveryLine: keepOrPreset(c.deliveryLine, c._presetDeliveryLine, dl),
          offerLine: keepOrPreset(c.offerLine, c._presetOfferLine, ol),
          _presetDeliveryLine: dl,
          _presetOfferLine: ol,
          buttonLabel: !c.buttonLabel || c.buttonLabel === ONE_TIME_BUTTON ? SUB_BUTTON : c.buttonLabel,
        };
      });
      const terms = defaultSubscriptionTerms(type, plans);
      // Wording fields: filled with the defaults so they exist as translatable strings (the team can rephrase them).
      const words: Record<string, string> = { labelPerDelivery: "per delivery", labelFirstDelivery: "First delivery", labelThen: "then", labelEveryDelivery: "every delivery", labelOnFirst: "on your first delivery", labelSubscribeButton: "Subscribe & save", labelOneTimeButton: "Add to cart" };
      const filled: Record<string, string> = {};
      for (const [k, v] of Object.entries(words)) filled[k] = String(s.data[k] || "").trim() ? s.data[k] : v;
      return { ...s, data: { ...s.data, ...filled, cards, subscriptionTerms: keepOrPreset(s.data.subscriptionTerms, s.data._presetTerms, terms), _presetTerms: terms } };
    }
    if (s.type === "faq") {
      const items: any[] = s.data.items || [];
      if (items.some((it) => it?.preset === "subscription")) return s;
      return { ...s, data: { ...s.data, items: [...items, ...subscriptionFaqItems(type, plans)] } };
    }
    return s;
  });
  // benefits row right after the pricing section (once)
  if (!sections.some((s) => s.type === "purity" && s.data?.preset === "subscription")) {
    const i = sections.findIndex((s) => s.type === "pricing");
    if (i >= 0) sections.splice(i + 1, 0, subscriptionBenefitsSection());
  }
  const sticky = content.stickyBar || ({} as PageContent["stickyBar"]);
  const stickyIsSub = sticky.buttonLabel === SUB_BUTTON;
  return {
    ...content,
    sections,
    commerce: { ...content.commerce, purchaseMode: "subscription", subscription: { ...(content.commerce.subscription || { unavailable: "one-time", plans: [] }), offerType: type, plans } },
    stickyBar: stickyIsSub ? sticky : { ...sticky, prevButtonLabel: sticky.buttonLabel, buttonLabel: SUB_BUTTON },
  };
}

/** Re-key `sections.<id>.<listKey>.<i>.…` translation paths after items were removed (oldIndex → newIndex). */
function rekeyListTranslations(content: PageContent, sectionId: string, listKey: string, indexMap: Map<number, number>): PageContent["translations"] {
  const prefix = `sections.${sectionId}.${listKey}.`;
  const out: PageContent["translations"] = {};
  for (const [loc, map] of Object.entries(content.translations || {})) {
    out[loc] = {};
    for (const [path, v] of Object.entries(map)) {
      if (!path.startsWith(prefix)) {
        out[loc][path] = v;
        continue;
      }
      const rest = path.slice(prefix.length);
      const m = rest.match(/^(\d+)(\..*)?$/);
      if (!m) {
        out[loc][path] = v;
        continue;
      }
      const ni = indexMap.get(Number(m[1]));
      if (ni == null) continue; // item removed → drop its translations
      out[loc][`${prefix}${ni}${m[2] || ""}`] = v;
    }
  }
  return out;
}

/** Back to one-time: remove preset FAQ items / benefits row, restore button labels; keeps lines & plan ids for later. */
export function removeSubscriptionPresets(content: PageContent): PageContent {
  let translations = content.translations || {};
  const sections = content.sections
    .filter((s) => !(s.type === "purity" && s.data?.preset === "subscription"))
    .map((s) => {
      if (s.type === "faq") {
        const items: any[] = s.data.items || [];
        const keep: number[] = [];
        items.forEach((it, i) => {
          if (it?.preset !== "subscription") keep.push(i);
        });
        if (keep.length !== items.length) {
          const indexMap = new Map<number, number>();
          keep.forEach((oldI, newI) => indexMap.set(oldI, newI));
          translations = rekeyListTranslations({ ...content, translations }, s.id, "items", indexMap);
          return { ...s, data: { ...s.data, items: keep.map((i) => items[i]) } };
        }
        return s;
      }
      if (s.type === "pricing") return { ...s, data: { ...s.data, cards: (s.data.cards || []).map((c: any) => ({ ...c, buttonLabel: c.buttonLabel === SUB_BUTTON ? ONE_TIME_BUTTON : c.buttonLabel })) } };
      return s;
    });
  const sticky = content.stickyBar;
  return {
    ...content,
    sections,
    translations,
    commerce: { ...content.commerce, purchaseMode: "one-time" },
    stickyBar: sticky ? { ...sticky, buttonLabel: sticky.buttonLabel === SUB_BUTTON ? sticky.prevButtonLabel || "Order now and save up to 20%" : sticky.buttonLabel, prevButtonLabel: undefined } : sticky,
  };
}

/** The product changed: plans and card wiring belong to the old product → clear them (lines/terms are refreshed on the next preset run). */
export function resetPlansForNewProduct(content: PageContent): PageContent {
  const sub = content.commerce.subscription;
  if (!sub?.plans?.length && !content.sections.some((s) => s.type === "pricing" && (s.data.cards || []).some((c: any) => c.sellingPlanId))) return content;
  return {
    ...content,
    commerce: { ...content.commerce, subscription: { ...(sub || { offerType: "simple", unavailable: "one-time", plans: [] }), plans: [] } },
    sections: content.sections.map((s) => (s.type === "pricing" ? { ...s, data: { ...s.data, cards: (s.data.cards || []).map((c: any) => ({ ...c, sellingPlanId: "", sellingPlanName: "" })) } } : s)),
  };
}

/**
 * Derive manual (fallback/preview) subscription prices from the card's one-time manual price and the plan's
 * pricing, keeping the currency format ("€57.00" → "€54.15"; "57,00 €" → "54,15 €"). Null when not derivable.
 * `saveLine` uses {first}/{every} placeholders for the wording fields.
 */
export function manualSubscriptionPrices(priceManual: string | undefined, plan: SellingPlanInfo | undefined): { first: string; recurring: string; compare: string; saveLine: string; firstPct?: number; recurringPct?: number } | null {
  const src = String(priceManual || "").trim();
  if (!src || !plan) return null;
  const m = src.match(/^([^\d]*)(\d[\d.,]*)([^\d]*)$/);
  if (!m) return null;
  const [, prefix, num, suffix] = m;
  const comma = /,\d{1,2}$/.test(num) && !/\.\d{1,2}$/.test(num);
  const value = Number(comma ? num.replace(/\./g, "").replace(",", ".") : num.replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  const decimals = (num.match(/[.,](\d{1,2})$/) || [])[1]?.length ?? 2;
  const fmt = (v: number) => {
    let s = v.toFixed(decimals);
    if (comma) s = s.replace(".", ",");
    return `${prefix}${s}${suffix}`;
  };
  const apply = (pct?: number, money?: MoneyPolicy): number | null => {
    if (pct != null) return value * (1 - pct / 100);
    if (money?.kind === "amount_off") return Math.max(0, value - money.amount);
    if (money?.kind === "price") return money.amount;
    return null;
  };
  const rec = apply(plan.recurringPct, plan.recurringMoney);
  if (rec == null) return null;
  const firstV = plan.firstPct != null || plan.firstMoney ? apply(plan.firstPct, plan.firstMoney) : rec;
  if (firstV == null) return null;
  const intro = Math.abs(firstV - rec) > 0.004;
  const wordFirst = discountWord(plan.firstPct, plan.firstMoney);
  const wordRec = discountWord(plan.recurringPct, plan.recurringMoney);
  const saveLine = intro ? `${wordFirst || fmt(value - firstV)} {first}, ${wordRec || fmt(value - rec)} {every}` : wordRec ? `${wordRec} {every}` : value - rec > 0 ? `${fmt(value - rec)} {every}` : "";
  return { first: fmt(firstV), recurring: fmt(rec), compare: src, saveLine, firstPct: plan.firstPct, recurringPct: plan.recurringPct };
}

/** Human summary of the mode for briefs (AI copy / image prompts). */
export function subscriptionBrief(content: PageContent): string {
  const c = content.commerce;
  if (c.purchaseMode !== "subscription") return "";
  const type = c.subscription?.offerType || "simple";
  const plans = c.subscription?.plans || [];
  const freq = Array.from(new Set(plans.map((p) => p.frequency))).join(" / ") || "chosen frequency";
  const offer = type === "trial" ? "trial: big discount on the first delivery, then the recurring subscriber price" : type === "intro" ? "introductory discount on the first order, then a smaller recurring discount" : "a modest discount on every delivery";
  return `This page sells a SUBSCRIPTION only (recurring deliveries ${freq}; ${offer}; skip/pause/cancel anytime, no minimum term). Copy must be honest about the recurring payment, frame the routine as continuous care, and never imply a one-time purchase.`;
}
