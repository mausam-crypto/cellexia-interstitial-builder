/**
 * Section library — each entry is modeled 1:1 on a section of the Glow25
 * listicle page (glow25.fr/pages/cp-listicle-sp-v4), re-skinned with Cellexia's
 * brand tokens. Every field in `fields` is editable from the admin; `render`
 * produces HTML (preview) or Liquid (storefront) from the section data.
 */
import type { FieldDef, ImageValue, RenderContext, SectionInstance } from "../types";
import {
  makeHelpers,
  splitDots,
  itemT,
  itemRT,
  iconFor,
  stripEmojiPrefix,
  stars,
  ICONS,
  esc,
  inline,
  brandString,
  type SectionHelpers,
} from "./helpers";
import { cardItems, numericVariantId, effectiveCheckoutMode } from "../commerce/cart-links";
import { manualSubscriptionPrices } from "../commerce/subscription";

export interface SectionDef {
  type: string;
  label: string;
  description: string;
  /** Emoji used in the editor list */
  icon: string;
  fields: FieldDef[];
  defaults: () => Record<string, any>;
  render: (h: SectionHelpers) => string;
  /** Only one instance per page */
  singleton?: boolean;
  /** Reasonable place in the default order (for "add section" suggestions) */
  category: "top" | "story" | "proof" | "offer" | "closing" | "generic";
}

const img = (key: string, label: string, imagePrompt: string, imageAspect = "4:3", extra: Partial<FieldDef> = {}): FieldDef => ({
  key,
  label,
  type: "image",
  imagePrompt,
  imageAspect,
  ...extra,
});
const text = (key: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({ key, label, type: "text", ...extra });
const textarea = (key: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({ key, label, type: "textarea", ...extra });
const rich = (key: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({ key, label, type: "richtext", ...extra });
const bool = (key: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({ key, label, type: "boolean", translatable: false, ...extra });
const select = (key: string, label: string, options: Array<{ label: string; value: string }>, extra: Partial<FieldDef> = {}): FieldDef => ({
  key,
  label,
  type: "select",
  options,
  translatable: false,
  ...extra,
});
const list = (key: string, label: string, item: FieldDef[], extra: Partial<FieldDef> = {}): FieldDef => ({ key, label, type: "list", item, ...extra });

const CTA_LABEL_HELP = "Every CTA on the page anchors to the pricing section.";
const IMAGE_STYLE_HINT =
  "unretouched, realistic skin texture, natural light, candid phone-photo feel, no text, no watermark";

/* ------------------------------------------------------------------ */
/* Section definitions                                                  */
/* ------------------------------------------------------------------ */

const announcement_bar: SectionDef = {
  type: "announcement_bar",
  label: "Promo strip (optional)",
  description: "Optional promo strip. NOTE: your theme already shows the store's own announcement bar and header around every page — only add this for a page-specific message.",
  icon: "📣",
  category: "top",
  singleton: true,
  fields: [
    bool("useBrandStrings", "Use global shipping + guarantee wording", { help: "When on, the bar shows the brand settings' shipping line and guarantee (managed once for every page)." }),
    text("text", "Custom text (when not using brand strings)", { help: "Separate items with ' · '" }),
    select("tone", "Colour", [
      { label: "Ink (dark)", value: "ink" },
      { label: "Accent", value: "accent" },
      { label: "Soft", value: "soft" },
    ]),
  ],
  defaults: () => ({ useBrandStrings: true, text: "Free express shipping on every order · 60-day money-back guarantee", tone: "ink" }),
  render(h) {
    const { d, brand } = h;
    let items: string[];
    if (d.useBrandStrings !== false) {
      const ship = brandString(brand, "shippingLine", h.ctx, (v) => inline(v, h.mode));
      const guar = brandString(brand, "guaranteeShort", h.ctx, (v) => inline(v, h.mode));
      items = [ship, guar];
    } else {
      items = splitDots(d.text).map((s, i) => h.t(`text.${i}`, s));
    }
    const tone = d.tone || "ink";
    return `<div class="cx-announce cx-announce--${h.e(tone)}" id="cx-s-${h.e(h.section.id)}" data-cx-type="announcement_bar"><div class="cx-wrap">${items
      .map((x) => `<span>${x}</span>`)
      .join('<span class="cx-announce__dot" aria-hidden="true">·</span>')}</div></div>`;
  },
};

const hero: SectionDef = {
  type: "hero",
  label: "Listicle hero",
  description: "Eyebrow, big headline, subhead, trust bar, CTA and badge strip next to the hero image (Glow25 hero).",
  icon: "🏁",
  category: "top",
  singleton: true,
  fields: [
    text("eyebrow", "Eyebrow", { productSpecific: false }),
    textarea("headline", "Headline (H1)", { productSpecific: true }),
    textarea("subhead", "Subhead", { productSpecific: true }),
    text("trust", "Trust bar", { help: "Items separated by ' · '. Bracketed numbers like [12,000] are placeholders to fill.", productSpecific: true }),
    text("ctaLabel", "CTA button label", { help: CTA_LABEL_HELP }),
    list(
      "badges",
      "Badge strip",
      [text("label", "Badge label"), img("image", "Badge image (optional)", "Minimal round badge / seal artwork on transparent background", "1:1", { aiImage: "skip" })],
      { maxItems: 6 },
    ),
    img("image", "Hero image", `Confident candid lifestyle photo of a woman around 60, ${IMAGE_STYLE_HINT}`, "4:3", { productSpecific: true }),
    select("imagePosition", "Image position (desktop)", [
      { label: "Right", value: "right" },
      { label: "Left", value: "left" },
    ]),
  ],
  defaults: () => ({
    eyebrow: "Recommended by dermatologists across Europe",
    headline: "3 reasons why …",
    subhead: "",
    trust: "",
    ctaLabel: "Order now and save up to 20%",
    badges: [],
    image: undefined,
    imagePosition: "right",
  }),
  render(h) {
    const { d } = h;
    const trust = splitDots(d.trust)
      .map((s, i) => `<span>${h.t(`trust.${i}`, s)}</span>`)
      .join('<span class="cx-dot" aria-hidden="true">·</span>');
    const badges = (d.badges || [])
      .map((b: any, i: number) => {
        const im = b.image?.src ? h.img(b.image, { cls: "cx-badge__img", widths: [120, 240] }) : "";
        return `<li class="cx-badge">${im}<span>${itemT(h, "badges", i, "label", b.label)}</span></li>`;
      })
      .join("");
    const inner = `
<div class="cx-hero${d.imagePosition === "left" ? " cx-hero--img-left" : ""}">
  <div class="cx-hero__copy">
    ${d.eyebrow ? `<p class="cx-eyebrow">${h.t("eyebrow", d.eyebrow)}</p>` : ""}
    <h1 class="cx-h1">${h.t("headline", d.headline)}</h1>
    ${d.subhead ? `<p class="cx-lead">${h.t("subhead", d.subhead)}</p>` : ""}
    ${trust ? `<p class="cx-trust">${trust}</p>` : ""}
    <div class="cx-hero__cta">${h.cta(d.ctaLabel || "Order now", { key: "ctaLabel", extraClass: "cx-btn--lg" })}</div>
    ${badges ? `<ul class="cx-badges">${badges}</ul>` : ""}
  </div>
  <div class="cx-hero__media">${h.img(d.image, { cls: "cx-hero__img", eager: true, aspect: "4/3", fallbackLabel: "Hero image" })}</div>
</div>`;
    return h.band(inner, { tone: "white", extraClass: "cx-band--hero" });
  },
};

const reason: SectionDef = {
  type: "reason",
  label: "Numbered reason",
  description: "Full-width image above a large numeral + headline + body (Glow25 '1. / 2. / 3.' sections). Optional CTA.",
  icon: "1️⃣",
  category: "story",
  fields: [
    text("number", "Number", { translatable: false, help: "Shown as the big numeral. Leave empty to hide." }),
    img("image", "Image above", `Photo illustrating this reason, ${IMAGE_STYLE_HINT}`, "16:9", { productSpecific: true }),
    textarea("heading", "Heading (H2)", { productSpecific: true }),
    rich("body", "Body", { productSpecific: true }),
    text("closing", "Closing line (bold, optional)"),
    bool("showCta", "Show CTA button after the text"),
    text("ctaLabel", "CTA label", { help: CTA_LABEL_HELP }),
    select("imageStyle", "Image style", [
      { label: "Full width", value: "full" },
      { label: "Contained", value: "contained" },
    ]),
  ],
  defaults: () => ({ number: "1", heading: "", body: "", closing: "", showCta: false, ctaLabel: "Order now and save up to 20%", imageStyle: "full" }),
  render(h) {
    const { d } = h;
    const image = d.image?.src
      ? `<div class="cx-reason__media${d.imageStyle === "contained" ? " cx-reason__media--contained" : ""}">${h.img(d.image, { cls: "cx-reason__img", sizes: "(min-width: 1100px) 1000px, 100vw", aspect: "16/9" })}</div>`
      : `<div class="cx-reason__media">${h.img(undefined, { aspect: "16/9", fallbackLabel: `Image for reason ${h.e(d.number)}` })}</div>`;
    const inner = `
<article class="cx-reason">
  ${image}
  <div class="cx-reason__body">
    <div class="cx-reason__head">
      ${d.number ? `<span class="cx-numeral" aria-hidden="true">${h.e(d.number)}</span>` : ""}
      ${h.heading("heading", d.heading, { cls: "cx-reason__h" })}
    </div>
    <div class="cx-prose">${h.rt("body", d.body)}${d.closing ? `<p class="cx-prose__closing">${h.t("closing", d.closing)}</p>` : ""}</div>
    ${d.showCta ? `<div class="cx-cta-row">${h.cta(d.ctaLabel || "Order now", { key: "ctaLabel" })}</div>` : ""}
  </div>
</article>`;
    return h.band(inner, { tone: "white" });
  },
};

const text_block: SectionDef = {
  type: "text_block",
  label: "Text section (differentiation)",
  description: "Heading + rich text on a soft band. Used for 'Here's why Cellexia works when everything else didn't'.",
  icon: "📝",
  category: "story",
  fields: [
    textarea("heading", "Heading (H2)", { productSpecific: true }),
    rich("body", "Body", { help: "Use **bold** for the 'Mistake 1:' style lead-ins. Blank line = new paragraph.", productSpecific: true }),
    select("tone", "Background", [
      { label: "Soft (cream)", value: "soft" },
      { label: "White", value: "white" },
      { label: "Highlight", value: "highlight" },
    ]),
    select("align", "Alignment", [
      { label: "Left", value: "left" },
      { label: "Center", value: "center" },
    ]),
    bool("showCta", "Show CTA button"),
    text("ctaLabel", "CTA label"),
  ],
  defaults: () => ({ heading: "", body: "", tone: "soft", align: "left", showCta: false, ctaLabel: "Order now and save up to 20%" }),
  render(h) {
    const { d } = h;
    const inner = `<div class="cx-text${d.align === "center" ? " cx-text--center" : ""}">${h.heading("heading", d.heading, { align: d.align })}<div class="cx-prose">${h.rt("body", d.body)}</div>${d.showCta ? `<div class="cx-cta-row">${h.cta(d.ctaLabel || "Order now", { key: "ctaLabel" })}</div>` : ""}</div>`;
    return h.band(inner, { tone: d.tone || "soft", narrow: true });
  },
};

const purity: SectionDef = {
  type: "purity",
  label: "Purity & safety (icon row)",
  description: "Heading + text + row of icon claims (hypoallergenic, non-comedogenic…). Glow25 'purity' section.",
  icon: "🌿",
  category: "story",
  fields: [
    textarea("heading", "Heading (H2)"),
    rich("body", "Body"),
    list(
      "icons",
      "Icon row",
      [
        text("label", "Label"),
        select("icon", "Icon", [
          { label: "Auto (from label)", value: "auto" },
          { label: "Shield", value: "shield" },
          { label: "Leaf", value: "leaf" },
          { label: "Drop", value: "drop" },
          { label: "No / banned", value: "ban" },
          { label: "Sparkle", value: "sparkle" },
          { label: "Clock", value: "clock" },
          { label: "Lock", value: "lock" },
          { label: "Truck", value: "truck" },
          { label: "EU / globe", value: "eu" },
        ]),
      ],
      { maxItems: 6 },
    ),
    img("image", "Image (optional, shown beside the text)", "Clean product texture macro shot, white cream swirl, soft daylight, no text", "1:1"),
  ],
  defaults: () => ({ heading: "", body: "", icons: [], image: undefined }),
  render(h) {
    const { d } = h;
    const icons = (d.icons || [])
      .map((it: any, i: number) => {
        const name = !it.icon || it.icon === "auto" ? iconFor(it.label || "") : it.icon;
        return `<li class="cx-iconrow__item"><span class="cx-iconrow__icon">${ICONS[name] || ICONS.leaf}</span><span>${itemT(h, "icons", i, "label", it.label)}</span></li>`;
      })
      .join("");
    const media = d.image?.src ? `<div class="cx-purity__media">${h.img(d.image, { cls: "cx-purity__img", aspect: "1/1" })}</div>` : "";
    const inner = `<div class="cx-purity${media ? " cx-purity--with-media" : ""}"><div class="cx-purity__copy">${h.heading("heading", d.heading)}<div class="cx-prose">${h.rt("body", d.body)}</div>${icons ? `<ul class="cx-iconrow">${icons}</ul>` : ""}</div>${media}</div>`;
    return h.band(inner, { tone: "white" });
  },
};

const science: SectionDef = {
  type: "science",
  label: "Numbered science explainer",
  description: "Heading + 1/2/3 numbered explanation + closing paragraph + CTA (Glow25 'why it really works').",
  icon: "🔬",
  category: "story",
  fields: [
    textarea("heading", "Heading (H2)", { productSpecific: true }),
    list("steps", "Numbered steps", [rich("text", "Step text")], { maxItems: 6, productSpecific: true }),
    rich("closing", "Closing paragraph", { productSpecific: true }),
    bool("showCta", "Show CTA button"),
    text("ctaLabel", "CTA label"),
    img("image", "Image (optional, shown beside the steps)", `Editorial diagram or photo supporting the mechanism, clean, minimal, ${IMAGE_STYLE_HINT}`, "1:1", { aiImage: "diagram" }),
    select("imagePosition", "Image position", [
      { label: "Left", value: "left" },
      { label: "Right", value: "right" },
    ]),
  ],
  defaults: () => ({ heading: "", steps: [], closing: "", showCta: true, ctaLabel: "Order now and save up to 20%", image: undefined, imagePosition: "left" }),
  render(h) {
    const { d } = h;
    const steps = (d.steps || [])
      .map(
        (s: any, i: number) =>
          `<li class="cx-steps__item"><span class="cx-steps__num" aria-hidden="true">${i + 1}</span><div class="cx-prose">${itemRT(h, "steps", i, "text", s.text)}</div></li>`,
      )
      .join("");
    const media = d.image?.src ? `<div class="cx-science__media">${h.img(d.image, { cls: "cx-science__img", aspect: "1/1" })}</div>` : "";
    const inner = `<div class="cx-science${media ? " cx-science--with-media" : ""}${d.imagePosition === "right" ? " cx-science--img-right" : ""}">${media}<div class="cx-science__copy">${h.heading("heading", d.heading)}<ol class="cx-steps">${steps}</ol>${d.closing ? `<div class="cx-prose cx-science__closing">${h.rt("closing", d.closing)}</div>` : ""}${d.showCta ? `<div class="cx-cta-row">${h.cta(d.ctaLabel || "Order now", { key: "ctaLabel" })}</div>` : ""}</div></div>`;
    return h.band(inner, { tone: "soft" });
  },
};

const evidence: SectionDef = {
  type: "evidence",
  label: "Clinical evidence (study citations)",
  description: "'Is it really effective — or just marketing?' with study-citation slots in Glow25's format.",
  icon: "📊",
  category: "proof",
  fields: [
    textarea("heading", "Heading (H2)", { productSpecific: true }),
    rich("body", "Body", { productSpecific: true }),
    list(
      "citations",
      "Study citations",
      [text("author", "Lead author"), text("sample", "Sample & duration", { placeholder: "[n] women, [x] weeks" }), textarea("finding", "Key finding")],
      { maxItems: 6, help: "Bracketed placeholders stay visible until you replace them with real citations from the clinical dossier." },
    ),
    text("closing", "Closing line (bold)", { productSpecific: true }),
    img("image", "Supporting image (optional)", `Credible clinical-feel still: close-up of real mature skin texture on a forearm in soft daylight, or a calm lab-adjacent still life (unbranded jar, dropper, glass dish) — no fabricated results, ${IMAGE_STYLE_HINT}`, "16:9"),
  ],
  defaults: () => ({ heading: "", body: "", citations: [], closing: "", image: undefined }),
  render(h) {
    const { d } = h;
    const cites = (d.citations || [])
      .map(
        (c: any, i: number) =>
          `<li class="cx-cite"><span class="cx-cite__author">${itemT(h, "citations", i, "author", c.author)}</span>${c.sample ? ` <span class="cx-cite__sample">(${itemT(h, "citations", i, "sample", c.sample)})</span>` : ""}${c.finding ? `<span class="cx-cite__sep">:</span> <span class="cx-cite__finding">${itemT(h, "citations", i, "finding", c.finding)}</span>` : ""}</li>`,
      )
      .join("");
    const media = d.image?.src ? `<div class="cx-evidence__media">${h.img(d.image, { cls: "cx-evidence__img", aspect: "16/9" })}</div>` : "";
    const inner = `<div class="cx-evidence">${h.heading("heading", d.heading)}<div class="cx-evidence__grid${media ? "" : " cx-evidence__grid--no-media"}"><div class="cx-prose">${h.rt("body", d.body)}${cites ? `<ul class="cx-cites">${cites}</ul>` : ""}${d.closing ? `<p class="cx-prose__closing">${h.t("closing", d.closing)}</p>` : ""}</div>${media}</div></div>`;
    return h.band(inner, { tone: "white" });
  },
};

const pillars: SectionDef = {
  type: "pillars",
  label: "Four pillars grid",
  description: "Heading + 4 cards (title + text) on a cream band (Glow25 'why it's the best-selling…').",
  icon: "🧱",
  category: "proof",
  fields: [
    textarea("heading", "Heading (H2)", { productSpecific: true }),
    list("items", "Pillars", [text("title", "Title"), rich("text", "Text"), img("image", "Image / icon (optional)", "Minimal line icon on transparent background", "1:1", { aiImage: "skip" })], { minItems: 2, maxItems: 6, productSpecific: true }),
    bool("showAward", "Show the award seal next to the heading"),
  ],
  defaults: () => ({ heading: "", items: [], showAward: true }),
  render(h) {
    const { d, brand } = h;
    const items = (d.items || [])
      .map(
        (p: any, i: number) =>
          `<li class="cx-pillar">${p.image?.src ? h.img(p.image, { cls: "cx-pillar__img", widths: [120, 240] }) : ""}<h3 class="cx-pillar__title">${itemT(h, "items", i, "title", p.title)}</h3><div class="cx-prose cx-prose--sm">${itemRT(h, "items", i, "text", p.text)}</div></li>`,
      )
      .join("");
    const seal = d.showAward && brand.awardSealUrl ? `<img class="cx-seal" src="${h.e(brand.awardSealUrl)}" alt="Award seal" loading="lazy" width="96" height="96">` : "";
    const inner = `<div class="cx-pillars"><div class="cx-pillars__head">${h.heading("heading", d.heading, { align: "center" })}${seal}</div><ul class="cx-pillars__grid cx-pillars__grid--${Math.min(4, Math.max(2, (d.items || []).length || 4))}">${items}</ul></div>`;
    return h.band(inner, { tone: "soft" });
  },
};

const expert_quote: SectionDef = {
  type: "expert_quote",
  label: "Expert quote (doctor portrait)",
  description: "Portrait left, quote right — the Glow25 'expert recommendation' block.",
  icon: "🩺",
  category: "proof",
  fields: [
    text("kicker", "Kicker (small line above the quote)"),
    rich("quote", "Quote", { productSpecific: true }),
    text("name", "Name", { help: "e.g. Dr. [FULL NAME] — bracketed placeholders stay visible until filled." }),
    text("credential", "Credential line"),
    img("image", "Portrait", "REAL endorser photo — do not generate. Upload the dermatologist's photo.", "1:1", { aiImage: "skip" }),
    select("layout", "Layout", [
      { label: "Portrait left, quote right", value: "left" },
      { label: "Centered", value: "center" },
    ]),
  ],
  defaults: () => ({ kicker: "The expert recommendation", quote: "", name: "Dr. [FULL NAME]", credential: "board-certified dermatologist", image: undefined, layout: "left" }),
  render(h) {
    const { d } = h;
    const portrait = d.image?.src
      ? h.img(d.image, { cls: "cx-expert__img", widths: [240, 480], aspect: "1/1" })
      : `<div class="cx-expert__img cx-img-placeholder cx-img-placeholder--round"><span>${h.e("Doctor portrait")}</span></div>`;
    const inner = `<div class="cx-expert${d.layout === "center" ? " cx-expert--center" : ""}"><div class="cx-expert__media">${portrait}</div><div class="cx-expert__copy">${d.kicker ? `<p class="cx-eyebrow">${h.t("kicker", d.kicker)}</p>` : ""}<blockquote class="cx-expert__quote">${h.rt("quote", d.quote)}</blockquote><p class="cx-expert__name">— ${h.t("name", d.name)}${d.credential ? `, <span class="cx-expert__cred">${h.t("credential", d.credential)}</span>` : ""}</p></div></div>`;
    return h.band(inner, { tone: "white" });
  },
};

const pricingCardFields: FieldDef[] = [
  text("title", "Card title", { placeholder: "1 Jar (Starter)" }),
  text("subtitle", "Subtitle (small, above title)", { placeholder: "THE FULL 90-DAY PROTOCOL" }),
  text("badge", "Badge (highlighted card)", { placeholder: "RECOMMENDED BY DERMATOLOGISTS" }),
  bool("highlight", "Highlight this card (enlarged + badged)"),
  img("image", "Product image", "Clean product packshot on white/neutral background, soft studio light", "1:1", { aiImage: "skip" }),
  text("priceManual", "Price (manual)", { translatable: false, placeholder: "€57.00", help: "Used in preview and as fallback when live prices are off/unavailable." }),
  text("compareManual", "Compare-at price (manual)", { translatable: false, placeholder: "€171.00" }),
  text("perUnitManual", "Per-unit line (manual)", { placeholder: "€45.60 per jar" }),
  text("saveManual", "You-save line (manual)", { placeholder: "You save €34.20 (20%)" }),
  { key: "unitCount", label: "Units in this pack", type: "number", translatable: false },
  text("unitLabel", "Unit label", { placeholder: "jar" }),
  textarea("description", "Description line"),
  text("giftLine", "Free gift line (optional)", { placeholder: "FREE gift: … (worth €29) — this pack only" }),
  img("giftImage", "Gift image (optional)", "Product photo of the gift", "1:1", { aiImage: "skip" }),
  text("checks", "Checkmark lines", { help: "Separate with ' · ' (e.g. Free express shipping · 60-day money-back guarantee)" }),
  text("buttonLabel", "Button label"),
  // subscription mode (Commerce → Purchase mode = subscription): shown under the price
  text("deliveryLine", "Delivery line (subscription)", { placeholder: "Delivered every 4 weeks · skip, pause or cancel anytime", help: "Subscription mode only." }),
  text("offerLine", "Offer line (subscription)", { placeholder: "20% off your first order, then 10% off every delivery", help: "Subscription mode only." }),
  textarea("belowButton", "Small print under the button", { placeholder: "Billed €54.15 every 2 months · cancel anytime", help: "Shown right under the button (any mode). In subscription mode it disappears with the card's subscription when a market falls back to one-time." }),
  // commerce (rendered by the dedicated commerce UI in the editor)
  text("variantId", "Shopify variant ID", { translatable: false, advanced: true, productSpecific: true }),
  text("variantTitle", "Variant title (info)", { translatable: false, advanced: true }),
  text("sellingPlanId", "Selling plan ID (subscription)", { translatable: false, advanced: true, productSpecific: true }),
  text("sellingPlanName", "Selling plan (info)", { translatable: false, advanced: true }),
  { key: "quantity", label: "Quantity", type: "number", translatable: false, advanced: true },
  list("addOns", "Also add to cart (gift / add-ons)", [text("variantId", "Variant ID", { translatable: false }), { key: "quantity", label: "Qty", type: "number", translatable: false }, text("label", "Label (info)", { translatable: false })], { advanced: true, translatable: false }),
];

const pricing: SectionDef = {
  type: "pricing",
  label: "Pricing cards (the offer)",
  description: "Three cards with the center card enlarged, badged and highlighted; strikethrough compare-at prices, per-unit math, free-gift line, add-to-cart buttons. Every CTA on the page anchors here.",
  icon: "💳",
  category: "offer",
  singleton: true,
  fields: [
    textarea("heading", "Heading (H2)"),
    list("cards", "Cards (left → right)", pricingCardFields, { minItems: 1, maxItems: 4, productSpecific: true }),
    text("footnote", "Line under the cards", { productSpecific: true }),
    textarea("subscriptionTerms", "Subscription terms (shown under the cards in subscription mode)", { help: "Recurring-payment disclosure: frequency, price per delivery, how to cancel. Required for clarity (and consumer law)." }),
    text("labelPerDelivery", "Wording: “per delivery”", { group: "Subscription wording", placeholder: "per delivery" }),
    text("labelFirstDelivery", "Wording: “First delivery”", { group: "Subscription wording", placeholder: "First delivery" }),
    text("labelThen", "Wording: “then”", { group: "Subscription wording", placeholder: "then" }),
    text("labelEveryDelivery", "Wording: “every delivery”", { group: "Subscription wording", placeholder: "every delivery" }),
    text("labelOnFirst", "Wording: “on your first delivery”", { group: "Subscription wording", placeholder: "on your first delivery" }),
    text("labelSubscribeButton", "Wording: subscription button", { group: "Subscription wording", placeholder: "Subscribe & save" }),
    text("labelOneTimeButton", "Wording: one-time fallback button", { group: "Subscription wording", placeholder: "Add to cart" }),
    bool("crossSellEnabled", "Show cross-sell card below"),
    text("crossSellTitle", "Cross-sell title", { productSpecific: true }),
    textarea("crossSellText", "Cross-sell text", { productSpecific: true }),
    { key: "crossSellUrl", label: "Cross-sell link", type: "url", translatable: false, productSpecific: true, help: "Should point to a product on the store." },
    text("crossSellButton", "Cross-sell button label"),
    img("crossSellImage", "Cross-sell image", "Product set packshot", "1:1", { aiImage: "skip" }),
  ],
  defaults: () => ({
    heading: "Choose your Cellexia pack",
    cards: [],
    footnote: "",
    subscriptionTerms: "",
    labelPerDelivery: "",
    labelFirstDelivery: "",
    labelThen: "",
    labelEveryDelivery: "",
    labelOnFirst: "",
    labelSubscribeButton: "",
    labelOneTimeButton: "",
    crossSellEnabled: false,
    crossSellTitle: "",
    crossSellText: "",
    crossSellUrl: "",
    crossSellButton: "See the set",
    crossSellImage: undefined,
  }),
  render(h) {
    const { d, ctx, brand } = h;
    const commerce = ctx.page.commerce;
    const subMode = commerce.purchaseMode === "subscription";
    const subUnavailable = commerce.subscription?.unavailable || "one-time";
    const handleOk = !!commerce.productHandle;
    const live = ctx.mode === "liquid" && commerce.livePrices && handleOk;
    // Subscription mode always looks the product up on the storefront (even with live prices off) so the
    // plan's availability per market/variant can be checked; only the *prices* depend on livePrices.
    const lookup = live || (ctx.mode === "liquid" && subMode && handleOk);
    const cards: any[] = d.cards || [];
    const planOf = (c: any) => String(c.sellingPlanId || "").replace(/\D/g, "");
    let liquidLookup = "";
    if (lookup) {
      liquidLookup += `{% assign _cxp = all_products['${esc(commerce.productHandle, "liquid").replace(/'/g, "")}'] %}`;
      cards.forEach((c, i) => {
        const vid = numericVariantId(c.variantId);
        if (vid) {
          liquidLookup += `{% assign _cxv${i} = nil %}{% for _v in _cxp.variants %}{% if _v.id == ${vid} %}{% assign _cxv${i} = _v %}{% endif %}{% endfor %}`;
          // Subscription: the allocation of this card's selling plan for the visitor's market (nil when the plan isn't offered there)
          if (subMode && planOf(c)) {
            liquidLookup += `{% assign _cxa${i} = nil %}{% if _cxv${i} %}{% for _a in _cxv${i}.selling_plan_allocations %}{% if _a.selling_plan.id == ${planOf(c)} %}{% assign _cxa${i} = _a %}{% endif %}{% endfor %}{% endif %}`;
          }
        }
      });
    }
    const guaranteeShort = brandString(brand, "guaranteeShort", ctx, (v) => inline(v, h.mode));
    const shippingLine = brandString(brand, "shippingLine", ctx, (v) => inline(v, h.mode));
    // Subscription wording (section-level fields so they are collected for translation)
    const wPerDelivery = h.t("labelPerDelivery", d.labelPerDelivery || "per delivery");
    const wFirst = h.t("labelFirstDelivery", d.labelFirstDelivery || "First delivery");
    const wThen = h.t("labelThen", d.labelThen || "then");
    const wEvery = h.t("labelEveryDelivery", d.labelEveryDelivery || "every delivery");
    const wOnFirst = h.t("labelOnFirst", d.labelOnFirst || "on your first delivery");
    const wSubBtn = h.t("labelSubscribeButton", d.labelSubscribeButton || "Subscribe & save");
    const wOneBtn = h.t("labelOneTimeButton", d.labelOneTimeButton || "Add to cart");

    const cardHtml = cards
      .map((c, i) => {
        const plan = subMode ? planOf(c) : "";
        const vid = numericVariantId(c.variantId);
        const items = cardItems({ ...c, variantId: vid, sellingPlanId: plan || undefined, addOns: (c.addOns || []).map((a: any) => ({ ...a, variantId: numericVariantId(a.variantId) })) });
        const oneTimeItems = items.map((it) => ({ ...it, sellingPlanId: undefined }));
        const subHref = h.cartHref(i, items);
        const oneTimeHref = plan ? h.cartHref(i, oneTimeItems) : subHref;
        // On the storefront we know per market/variant whether the plan is offered (_cxa{i}); then the WHOLE card
        // branches: subscription price/lines/button when offered, one-time price/button when not (or the card is hidden).
        const planKnown = subMode && !!plan && lookup && !!vid;
        const a = `_cxa${i}`;
        const v = `_cxv${i}`;
        const qty = Math.max(1, Number(c.unitCount) || Number(c.quantity) || 1);
        const unit = c.unitLabel ? itemT(h, "cards", i, "unitLabel", c.unitLabel) : "";
        const perUnitLabelKey = `cards.${i}.perUnitSuffix`;
        const perUnitSuffix = h.t(perUnitLabelKey, unit ? ` per ${c.unitLabel}` : "");
        const saveKeyPrefix = h.t(`cards.${i}.savePrefix`, "You save ");
        const manualPrice = c.priceManual ? `<span class="cx-price__now">${h.e(c.priceManual)}</span>` : "";
        const manualCompare = c.compareManual ? `<s class="cx-price__was">${h.e(c.compareManual)}</s>` : "";
        const manualPerUnit = c.perUnitManual ? `<span class="cx-price__unit">${itemT(h, "cards", i, "perUnitManual", c.perUnitManual)}</span>` : "";
        const manualSave = c.saveManual ? `<span class="cx-price__save">${itemT(h, "cards", i, "saveManual", c.saveManual)}</span>` : "";
        // one-time manual block (preview / fallback)
        const manualOneTime = `<div class="cx-price__main">${manualCompare}${manualPrice}</div>${manualPerUnit || manualSave ? `<div class="cx-price__meta">${manualPerUnit}${manualSave}</div>` : ""}`;
        // one-time live block (storefront)
        const liveOneTime =
          `<div class="cx-price__main">{% if ${v}.compare_at_price > ${v}.price %}<s class="cx-price__was">{{ ${v}.compare_at_price | money }}</s>{% elsif ${v}.compare_at_price == blank and ${v}.price %}${manualCompare}{% endif %}<span class="cx-price__now">{{ ${v}.price | money }}</span></div>` +
          `<div class="cx-price__meta"><span class="cx-price__unit">{{ ${v}.price | divided_by: ${qty} | money }}${perUnitSuffix}</span>` +
          `{% if ${v}.compare_at_price > ${v}.price %}{% assign _cxsave = ${v}.compare_at_price | minus: ${v}.price %}{% assign _cxpct = _cxsave | times: 100 | divided_by: ${v}.compare_at_price %}<span class="cx-price__save">${saveKeyPrefix}{{ _cxsave | money }} ({{ _cxpct }}%)</span>{% else %}${manualSave}{% endif %}</div>`;
        // subscription manual block (preview / fallback): derived from the manual one-time price + the plan's pricing
        let manualSub = manualOneTime;
        const planInfo = subMode ? (commerce.subscription?.plans || []).find((p) => p.id === plan) : undefined;
        const sm = subMode ? manualSubscriptionPrices(c.priceManual, planInfo) : null;
        if (sm) {
          const intro = sm.first !== sm.recurring;
          manualSub =
            `<div class="cx-price__main"><s class="cx-price__was">${h.e(sm.compare)}</s><span class="cx-price__now">${h.e(intro ? sm.first : sm.recurring)}</span></div>` +
            `<div class="cx-price__meta"><span class="cx-price__unit">${intro ? `${wFirst} · ${wThen} ${h.e(sm.recurring)} ${wPerDelivery}` : `${h.e(sm.recurring)} ${wPerDelivery}${unit ? ` · ${qty} ${unit}` : ""}`}</span>` +
            `${sm.saveLine ? `<span class="cx-price__save">${saveKeyPrefix}${h.e(sm.saveLine.replace(/\{first\}/g, wOnFirst).replace(/\{every\}/g, wEvery))}</span>` : ""}</div>`;
        }
        // subscription live block: allocation prices per market. price = charged for the first cycle (prepaid: whole
        // cycle), per_delivery_price = per delivery, price_adjustments (>1) → recurring price after the intro/trial.
        const liveSub =
          `{% assign _cxf = ${a}.price %}{% assign _cxpd = ${a}.per_delivery_price | default: _cxf %}{% assign _cxr = _cxpd %}` +
          `{% if ${a}.price_adjustments.size > 1 %}{% assign _cxla = ${a}.price_adjustments | last %}{% assign _cxr = _cxla.per_delivery_price | default: _cxla.price %}{% endif %}` +
          `{% if _cxpd != _cxr %}` +
          `<div class="cx-price__main">{% if ${a}.compare_at_price > _cxf %}<s class="cx-price__was">{{ ${a}.compare_at_price | money }}</s>{% endif %}<span class="cx-price__now">{{ _cxf | money }}</span></div>` +
          `<div class="cx-price__meta"><span class="cx-price__unit">${wFirst} · ${wThen} {{ _cxr | money }} ${wPerDelivery}</span>` +
          `{% if ${a}.compare_at_price > _cxf %}{% assign _cxsave = ${a}.compare_at_price | minus: _cxf %}{% assign _cxpct = _cxsave | times: 100 | divided_by: ${a}.compare_at_price %}<span class="cx-price__save">${saveKeyPrefix}{{ _cxsave | money }} ({{ _cxpct }}%) ${wOnFirst}</span>{% endif %}</div>` +
          `{% else %}` +
          `<div class="cx-price__main">{% if ${a}.compare_at_price > _cxpd %}<s class="cx-price__was">{{ ${a}.compare_at_price | money }}</s>{% endif %}<span class="cx-price__now">{{ _cxpd | money }}</span></div>` +
          `<div class="cx-price__meta"><span class="cx-price__unit">{{ _cxpd | divided_by: ${qty} | money }}${perUnitSuffix} · ${wPerDelivery}</span>` +
          `{% if ${a}.compare_at_price > _cxpd %}{% assign _cxsave = ${a}.compare_at_price | minus: _cxpd %}{% assign _cxpct = _cxsave | times: 100 | divided_by: ${a}.compare_at_price %}<span class="cx-price__save">${saveKeyPrefix}{{ _cxsave | money }} ({{ _cxpct }}%) ${wEvery}</span>{% endif %}</div>` +
          `{% endif %}`;

        // Assemble price block / lines / button per mode
        const subLinesHtml = subMode
          ? `${c.deliveryLine ? `<p class="cx-card__delivery">${ICONS.clock}<span>${itemT(h, "cards", i, "deliveryLine", c.deliveryLine)}</span></p>` : ""}${c.offerLine ? `<p class="cx-card__offer">${itemT(h, "cards", i, "offerLine", c.offerLine)}</p>` : ""}`
          : "";
        const noteHtml = c.belowButton ? `<p class="cx-card__note">${itemT(h, "cards", i, "belowButton", c.belowButton)}</p>` : "";
        const btnCls = `${brand.ctaStyle === "ink" ? "cx-btn cx-btn--ink" : "cx-btn cx-btn--accent"} cx-btn--block cx-card__btn`;
        const label = c.buttonLabel ? itemT(h, "cards", i, "buttonLabel", c.buttonLabel) : subMode ? wSubBtn : wOneBtn;
        const button = (href: string, sub: boolean) =>
          `<a class="${btnCls}" href="${href}" data-cx-event="add_to_cart" data-cx-card="${i}" data-cx-cart-link data-cx-mode="${h.e(sub ? "subscription" : effectiveCheckoutMode(commerce, brand))}"${sub ? ` data-cx-plan="${h.e(plan)}"` : ""}>${sub ? label : subMode ? wOneBtn : label}</a>`;

        let priceBlock: string;
        let lines: string;
        let btn: string;
        let note: string;
        if (planKnown && subUnavailable === "one-time") {
          // storefront, plan may be missing for this market/variant → full one-time fallback
          const oneTimePrice = live ? `{% if ${v} %}${liveOneTime}{% else %}${manualOneTime}{% endif %}` : manualOneTime;
          priceBlock = `{% if ${a} %}${live ? liveSub : manualSub}{% else %}${oneTimePrice}{% endif %}`;
          lines = `{% if ${a} %}${subLinesHtml}{% endif %}`;
          btn = `{% if ${a} %}${button(subHref, true)}{% else %}${button(oneTimeHref, false)}{% endif %}`;
          note = noteHtml ? `{% if ${a} %}${noteHtml}{% endif %}` : "";
        } else if (planKnown) {
          // "hide" policy: the whole card is wrapped below; inside, the plan is known to exist
          priceBlock = live ? liveSub : manualSub;
          lines = subLinesHtml;
          btn = button(subHref, true);
          note = noteHtml;
        } else if (subMode) {
          // preview, or storefront without product handle (no lookup possible)
          priceBlock = manualSub;
          lines = subLinesHtml;
          btn = button(subHref, !!plan);
          note = noteHtml;
        } else if (live && vid) {
          priceBlock = `{% if ${v} %}${liveOneTime}{% else %}${manualOneTime}{% endif %}`;
          lines = "";
          btn = button(subHref, false);
          note = noteHtml;
        } else {
          priceBlock = manualOneTime;
          lines = "";
          btn = button(subHref, false);
          note = noteHtml;
        }

        const checks = splitDots(c.checks || "")
          .map((x, k) => `<li>${ICONS.check}<span>${h.t(`cards.${i}.checks.${k}`, x)}</span></li>`)
          .join("");
        const defaultChecks = !c.checks
          ? `<li>${ICONS.check}<span>${shippingLine}</span></li><li>${ICONS.check}<span>${guaranteeShort}</span></li>`
          : "";
        const gift = c.giftLine
          ? `<div class="cx-card__gift">${c.giftImage?.src ? h.img(c.giftImage, { cls: "cx-card__gift-img", widths: [80, 160] }) : `<span class="cx-card__gift-icon">${ICONS.gift}</span>`}<span>${itemT(h, "cards", i, "giftLine", c.giftLine)}</span></div>`
          : "";
        const badge = c.highlight && c.badge ? `<div class="cx-card__badge">${itemT(h, "cards", i, "badge", c.badge)}</div>` : "";
        const hideWrap = (inner: string) => {
          // per-market hidden cards (liquid only)
          if (ctx.mode !== "liquid") return inner;
          let out = inner;
          const hiders = Object.entries(commerce.marketOverrides || {}).filter(([, o]) => o.hideCards?.[String(i)]).map(([cc]) => cc);
          if (hiders.length) out = `{% unless ${hiders.map((cc) => `_c == '${cc}'`).join(" or ")} %}${out}{% endunless %}`;
          // subscription: hide the whole card where the plan isn't offered
          if (planKnown && subUnavailable === "hide") out = `{% if ${a} %}${out}{% endif %}`;
          return out;
        };
        return hideWrap(`
<li class="cx-card${c.highlight ? " cx-card--highlight" : ""}" data-cx-card="${i}">
  ${badge}
  <div class="cx-card__inner">
    ${c.subtitle ? `<p class="cx-card__sub">${itemT(h, "cards", i, "subtitle", c.subtitle)}</p>` : ""}
    <h3 class="cx-card__title">${itemT(h, "cards", i, "title", c.title)}</h3>
    <div class="cx-card__media">${h.img(c.image, { cls: "cx-card__img", widths: [300, 600], aspect: "1/1", fallbackLabel: "Product image" })}</div>
    <div class="cx-price">${priceBlock}</div>
    ${lines}
    ${c.description ? `<p class="cx-card__desc">${itemT(h, "cards", i, "description", c.description)}</p>` : ""}
    ${gift}
    ${btn}
    ${note}
    <ul class="cx-card__checks">${checks}${defaultChecks}</ul>
  </div>
</li>`);
      })
      .join("");

    const crossSell = d.crossSellEnabled
      ? `<div class="cx-cross"><div class="cx-cross__media">${h.img(d.crossSellImage, { cls: "cx-cross__img", widths: [200, 400], aspect: "1/1", fallbackLabel: "Set image" })}</div><div class="cx-cross__copy"><h3 class="cx-cross__title">${h.t("crossSellTitle", d.crossSellTitle)}</h3><p>${h.t("crossSellText", d.crossSellText)}</p></div><a class="cx-btn cx-btn--secondary" href="${h.e(d.crossSellUrl || "#cx-offer")}" data-cx-event="cross_sell_click">${h.t("crossSellButton", d.crossSellButton || "See the set")}</a></div>`
      : "";
    const terms = subMode && d.subscriptionTerms ? `<p class="cx-pricing__terms">${h.t("subscriptionTerms", d.subscriptionTerms)}</p>` : "";
    const inner = `${liquidLookup}<div class="cx-pricing"${subMode ? ' data-cx-purchase="subscription"' : ""}>${h.heading("heading", d.heading, { align: "center" })}<ul class="cx-cards cx-cards--${Math.min(4, Math.max(1, cards.length))}">${cardHtml}</ul>${terms}${d.footnote ? `<p class="cx-pricing__note">${h.t("footnote", d.footnote)}</p>` : ""}${crossSell}</div>`;
    return h.band(inner, { tone: "white", id: "cx-offer", extraClass: "cx-band--offer" });
  },
};

const guarantee: SectionDef = {
  type: "guarantee",
  label: "Guarantee block",
  description: "'Not satisfied? You're covered' + reassurance icons (secure payment, EU shipping, made in Europe).",
  icon: "🛡️",
  category: "offer",
  fields: [
    textarea("heading", "Heading (H2)"),
    rich("body", "Body"),
    list("icons", "Reassurance icons", [text("label", "Label"), select("icon", "Icon", [
      { label: "Auto", value: "auto" }, { label: "Lock", value: "lock" }, { label: "Truck", value: "truck" }, { label: "EU", value: "eu" }, { label: "Shield", value: "shield" }, { label: "Leaf", value: "leaf" },
    ])], { maxItems: 5 }),
    bool("showSeal", "Show a guarantee seal (days from brand settings)"),
  ],
  defaults: () => ({ heading: "", body: "", icons: [], showSeal: true }),
  render(h) {
    const { d, brand } = h;
    const icons = (d.icons || [])
      .map((it: any, i: number) => {
        const label = stripEmojiPrefix(it.label || "");
        const name = !it.icon || it.icon === "auto" ? iconFor(label) : it.icon;
        return `<li class="cx-iconrow__item"><span class="cx-iconrow__icon">${ICONS[name] || ICONS.shield}</span><span>${itemT(h, "icons", i, "label", label)}</span></li>`;
      })
      .join("");
    const seal = d.showSeal
      ? `<div class="cx-gseal" aria-hidden="true"><span class="cx-gseal__num">${h.e(brand.guaranteeDays)}</span><span class="cx-gseal__txt">${h.t("sealText", "day money-back guarantee")}</span></div>`
      : "";
    const inner = `<div class="cx-guarantee">${seal}<div class="cx-guarantee__copy">${h.heading("heading", d.heading, { align: "center" })}<div class="cx-prose cx-prose--center">${h.rt("body", d.body)}</div></div>${icons ? `<ul class="cx-iconrow cx-iconrow--center">${icons}</ul>` : ""}</div>`;
    return h.band(inner, { tone: "highlight", narrow: true });
  },
};

const comparison: SectionDef = {
  type: "comparison",
  label: "Comparison table",
  description: "Checkmark table with our column highlighted (Glow25 treatment). Cells: ✓, ✗, — or free text; add a note in parentheses.",
  icon: "✅",
  category: "proof",
  fields: [
    textarea("heading", "Heading (H2)"),
    list("columns", "Columns", [text("label", "Column label"), bool("highlight", "This is us (highlighted)")], { minItems: 2, maxItems: 4, productSpecific: true }),
    list("rows", "Rows", [text("label", "Row label"), text("cells", "Cells", { help: "One per column, separated by ' | '. Use ✓ / ✗ / — plus optional text, e.g. '✗ (RF results fade in ~8 months)'" })], { productSpecific: true }),
    text("footnote", "Footnote (optional)"),
  ],
  defaults: () => ({ heading: "", columns: [], rows: [], footnote: "" }),
  render(h) {
    const { d } = h;
    const cols: any[] = d.columns || [];
    const hiIdx = cols.findIndex((c) => c.highlight);
    const head = cols
      .map((c, i) => `<th scope="col" class="${i === hiIdx ? "cx-cmp__hi" : ""}">${itemT(h, "columns", i, "label", c.label)}</th>`)
      .join("");
    const cell = (raw: string, rowIdx: number, colIdx: number) => {
      const s = String(raw || "").trim();
      const m = s.match(/^([✓✔✗✘×—–-])\s*(.*)$/u);
      let icon = "";
      let rest = s;
      if (m) {
        const mark = m[1];
        icon = /[✓✔]/.test(mark) ? `<span class="cx-cmp__yes">${ICONS.check}</span>` : /[✗✘×]/.test(mark) ? `<span class="cx-cmp__no">${ICONS.cross}</span>` : `<span class="cx-cmp__dash">${ICONS.dash}</span>`;
        rest = m[2] || "";
      }
      const txt = rest ? `<span class="cx-cmp__txt">${h.t(`rows.${rowIdx}.cells.${colIdx}`, rest)}</span>` : "";
      return `<td class="${colIdx === hiIdx ? "cx-cmp__hi" : ""}">${icon}${txt}</td>`;
    };
    const rows = (d.rows || [])
      .map((r: any, ri: number) => {
        const cells = String(r.cells || "").split(/\s*\|\s*/);
        return `<tr><th scope="row">${itemT(h, "rows", ri, "label", r.label)}</th>${cols.map((_, ci) => cell(cells[ci] ?? "", ri, ci)).join("")}</tr>`;
      })
      .join("");
    const inner = `<div class="cx-cmp">${h.heading("heading", d.heading, { align: "center" })}<div class="cx-cmp__scroll"><table class="cx-cmp__table"><thead><tr><th scope="col" class="cx-cmp__corner"></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>${d.footnote ? `<p class="cx-cmp__foot">${h.t("footnote", d.footnote)}</p>` : ""}</div>`;
    return h.band(inner, { tone: "white" });
  },
};

const timeline: SectionDef = {
  type: "timeline",
  label: "Results timeline",
  description: "'The results you can expect' — 3 phases (weeks 1–4, 4–8, 8–12) with optional photos and a closing line.",
  icon: "📅",
  category: "proof",
  fields: [
    textarea("heading", "Heading (H2)"),
    text("subhead", "Subhead", { productSpecific: true }),
    list("phases", "Phases", [text("label", "Label", { placeholder: "Weeks 1–4" }), text("title", "Title", { placeholder: "The skin wakes up." }), rich("text", "Text"), img("image", "Photo (optional)", `Candid photo matching this phase, ${IMAGE_STYLE_HINT}`, "4:3")], { minItems: 1, maxItems: 5, productSpecific: true }),
    text("closing", "Closing line", { productSpecific: true }),
    img("image", "Side image (optional)", `Candid lifestyle photo, ${IMAGE_STYLE_HINT}`, "3:4"),
  ],
  defaults: () => ({ heading: "The results you can expect", subhead: "", phases: [], closing: "", image: undefined }),
  render(h) {
    const { d } = h;
    const phases = (d.phases || [])
      .map(
        (p: any, i: number) =>
          `<li class="cx-tl__item"><div class="cx-tl__marker" aria-hidden="true"><span>${i + 1}</span></div><div class="cx-tl__body">${p.image?.src ? `<div class="cx-tl__media">${h.img(p.image, { cls: "cx-tl__img", widths: [400, 800], aspect: "4/3" })}</div>` : ""}<p class="cx-tl__label">${itemT(h, "phases", i, "label", p.label)}</p><h3 class="cx-tl__title">${itemT(h, "phases", i, "title", p.title)}</h3><div class="cx-prose cx-prose--sm">${itemRT(h, "phases", i, "text", p.text)}</div></div></li>`,
      )
      .join("");
    const media = d.image?.src ? `<div class="cx-tl__side">${h.img(d.image, { cls: "cx-tl__side-img", aspect: "3/4" })}</div>` : "";
    const inner = `<div class="cx-tl${media ? " cx-tl--with-media" : ""}"><div class="cx-tl__copy">${h.heading("heading", d.heading)}${d.subhead ? `<p class="cx-lead">${h.t("subhead", d.subhead)}</p>` : ""}<ol class="cx-tl__list">${phases}</ol>${d.closing ? `<p class="cx-prose__closing">${h.t("closing", d.closing)}</p>` : ""}</div>${media}</div>`;
    return h.band(inner, { tone: "soft" });
  },
};

const testimonials: SectionDef = {
  type: "testimonials",
  label: "Testimonial carousel",
  description: "Cards with photo, name/age, verified badge, bold outcome line, 3 bullets and a short quote — arrow navigation.",
  icon: "💬",
  category: "proof",
  fields: [
    textarea("heading", "Heading (H2)"),
    list(
      "items",
      "Testimonials",
      [
        text("name", "Name", { placeholder: "Barbara T." }),
        text("age", "Age", { translatable: false }),
        text("badge", "Badge", { placeholder: "Verified customer" }),
        text("headline", "Bold outcome line"),
        textarea("bullets", "Benefit bullets (one per line)"),
        textarea("quote", "Quote"),
        img("image", "Portrait", `Candid unretouched phone-photo portrait of a woman aged 55–70, ${IMAGE_STYLE_HINT}`, "1:1"),
      ],
      { productSpecific: true },
    ),
  ],
  defaults: () => ({ heading: "Real customers, real results", items: [] }),
  render(h) {
    const { d } = h;
    const items = (d.items || [])
      .map((tm: any, i: number) => {
        const bullets = String(tm.bullets || "")
          .split(/\n+/)
          .map((b) => b.trim())
          .filter(Boolean)
          .map((b, k) => `<li>${ICONS.check}<span>${h.t(`items.${i}.bullets.${k}`, b)}</span></li>`)
          .join("");
        const portrait = tm.image?.src
          ? h.img(tm.image, { cls: "cx-tm__img", widths: [160, 320], aspect: "1/1" })
          : `<div class="cx-tm__img cx-img-placeholder cx-img-placeholder--round"><span>${h.e("Photo")}</span></div>`;
        return `<li class="cx-tm" data-cx-slide="${i}"><div class="cx-tm__head">${portrait}<div><p class="cx-tm__name">${itemT(h, "items", i, "name", tm.name)}${tm.age ? `<span class="cx-tm__age">, ${h.e(tm.age)}</span>` : ""}</p>${tm.badge ? `<p class="cx-tm__badge">${ICONS.verified}<span>${itemT(h, "items", i, "badge", tm.badge)}</span></p>` : ""}</div></div>${tm.headline ? `<p class="cx-tm__headline">${itemT(h, "items", i, "headline", tm.headline)}</p>` : ""}${bullets ? `<ul class="cx-tm__bullets">${bullets}</ul>` : ""}${tm.quote ? `<blockquote class="cx-tm__quote">“${itemT(h, "items", i, "quote", tm.quote)}”</blockquote>` : ""}</li>`;
      })
      .join("");
    const inner = `<div class="cx-carousel" data-cx-carousel><div class="cx-carousel__head">${h.heading("heading", d.heading)}<div class="cx-carousel__nav"><button type="button" class="cx-arrow" data-cx-prev aria-label="Previous">${ICONS.arrowLeft}</button><button type="button" class="cx-arrow" data-cx-next aria-label="Next">${ICONS.arrowRight}</button></div></div><ul class="cx-carousel__track cx-tms">${items}</ul></div>`;
    return h.band(inner, { tone: "white" });
  },
};

const reviews: SectionDef = {
  type: "reviews",
  label: "Review aggregation carousel",
  description: "'[12,000]+ five-star reviews' with rotating short quotes and star ratings.",
  icon: "⭐",
  category: "proof",
  fields: [
    textarea("heading", "Heading (H2)", { help: "Bracketed numbers are placeholders — replace with the real count." }),
    list("items", "Reviews", [textarea("text", "Review text"), text("name", "Reviewer name"), { key: "stars", label: "Stars", type: "stars", translatable: false }], { productSpecific: true }),
  ],
  defaults: () => ({ heading: "[12,000]+ five-star reviews — and counting", items: [] }),
  render(h) {
    const { d } = h;
    const items = (d.items || [])
      .map(
        (r: any, i: number) =>
          `<li class="cx-review" data-cx-slide="${i}">${stars(Number(r.stars) || 5)}<p class="cx-review__text">“${itemT(h, "items", i, "text", r.text)}”</p><p class="cx-review__name">— ${itemT(h, "items", i, "name", r.name)}</p></li>`,
      )
      .join("");
    const inner = `<div class="cx-carousel" data-cx-carousel><div class="cx-carousel__head">${h.heading("heading", d.heading)}<div class="cx-carousel__nav"><button type="button" class="cx-arrow" data-cx-prev aria-label="Previous">${ICONS.arrowLeft}</button><button type="button" class="cx-arrow" data-cx-next aria-label="Next">${ICONS.arrowRight}</button></div></div><ul class="cx-carousel__track cx-reviews">${items}</ul></div>`;
    return h.band(inner, { tone: "soft" });
  },
};

const faq: SectionDef = {
  type: "faq",
  label: "Doctor FAQ (accordion)",
  description: "Chevron accordion, 'Dr. [NAME], dermatologist, answers your questions'.",
  icon: "❓",
  category: "closing",
  fields: [
    textarea("heading", "Heading (H2)"),
    list("items", "Questions", [text("q", "Question"), rich("a", "Answer")], { productSpecific: true }),
    bool("firstOpen", "First question open by default"),
  ],
  defaults: () => ({ heading: "", items: [], firstOpen: false }),
  render(h) {
    const { d } = h;
    const items = (d.items || [])
      .map(
        (q: any, i: number) =>
          `<details class="cx-faq__item"${d.firstOpen && i === 0 ? " open" : ""}><summary class="cx-faq__q"><span>${itemT(h, "items", i, "q", q.q)}</span><span class="cx-faq__chev" aria-hidden="true">${ICONS.chevron}</span></summary><div class="cx-faq__a cx-prose">${itemRT(h, "items", i, "a", q.a)}</div></details>`,
      )
      .join("");
    const inner = `<div class="cx-faq">${h.heading("heading", d.heading, { align: "center" })}<div class="cx-faq__list">${items}</div></div>`;
    return h.band(inner, { tone: "white", narrow: true });
  },
};

const final_cta: SectionDef = {
  type: "final_cta",
  label: "Final CTA",
  description: "Closing headline + CTA button anchoring to the offer.",
  icon: "🎯",
  category: "closing",
  fields: [textarea("heading", "Heading (H2)", { productSpecific: true }), text("subhead", "Subhead (optional)"), text("ctaLabel", "CTA label")],
  defaults: () => ({ heading: "", subhead: "", ctaLabel: "Order now and save up to 20%" }),
  render(h) {
    const { d } = h;
    const inner = `<div class="cx-final">${h.heading("heading", d.heading, { align: "center" })}${d.subhead ? `<p class="cx-lead cx-lead--center">${h.t("subhead", d.subhead)}</p>` : ""}<div class="cx-cta-row cx-cta-row--center">${h.cta(d.ctaLabel || "Order now", { key: "ctaLabel", extraClass: "cx-btn--lg" })}</div></div>`;
    return h.band(inner, { tone: "highlight" });
  },
};

const rich_text: SectionDef = {
  type: "rich_text",
  label: "Rich text (generic)",
  description: "Any heading + text block for extra angles.",
  icon: "✍️",
  category: "generic",
  fields: [textarea("heading", "Heading"), rich("body", "Body"), select("align", "Alignment", [{ label: "Left", value: "left" }, { label: "Center", value: "center" }]), select("tone", "Background", [{ label: "White", value: "white" }, { label: "Soft", value: "soft" }, { label: "Highlight", value: "highlight" }])],
  defaults: () => ({ heading: "", body: "", align: "left", tone: "white" }),
  render(h) {
    const { d } = h;
    return h.band(`<div class="cx-text${d.align === "center" ? " cx-text--center" : ""}">${d.heading ? h.heading("heading", d.heading, { align: d.align }) : ""}<div class="cx-prose">${h.rt("body", d.body)}</div></div>`, { tone: d.tone || "white", narrow: true });
  },
};

const image_section: SectionDef = {
  type: "image",
  label: "Image (generic)",
  description: "A single full-width or contained image with an optional caption.",
  icon: "🖼️",
  category: "generic",
  fields: [img("image", "Image", `Editorial photo, ${IMAGE_STYLE_HINT}`, "16:9"), text("caption", "Caption"), select("style", "Style", [{ label: "Full width", value: "full" }, { label: "Contained", value: "contained" }])],
  defaults: () => ({ image: undefined, caption: "", style: "contained" }),
  render(h) {
    const { d } = h;
    return h.band(`<figure class="cx-figure${d.style === "full" ? " cx-figure--full" : ""}">${h.img(d.image, { cls: "cx-figure__img", aspect: "16/9" })}${d.caption ? `<figcaption>${h.t("caption", d.caption)}</figcaption>` : ""}</figure>`, { tone: "white" });
  },
};

const cta_button: SectionDef = {
  type: "cta_button",
  label: "CTA button (standalone)",
  description: "A repeating CTA band to drop between sections.",
  icon: "🔘",
  category: "generic",
  fields: [text("ctaLabel", "CTA label"), text("note", "Small note under the button (optional)")],
  defaults: () => ({ ctaLabel: "Order now and save up to 20%", note: "" }),
  render(h) {
    const { d } = h;
    return h.band(`<div class="cx-cta-row cx-cta-row--center cx-cta-solo">${h.cta(d.ctaLabel || "Order now", { key: "ctaLabel", extraClass: "cx-btn--lg" })}${d.note ? `<p class="cx-note">${h.t("note", d.note)}</p>` : ""}</div>`, { tone: "white" });
  },
};

export const SECTION_DEFS: SectionDef[] = [
  announcement_bar,
  hero,
  reason,
  text_block,
  purity,
  science,
  evidence,
  pillars,
  expert_quote,
  pricing,
  guarantee,
  comparison,
  timeline,
  testimonials,
  reviews,
  faq,
  final_cta,
  rich_text,
  image_section,
  cta_button,
];

export const SECTION_MAP: Record<string, SectionDef> = Object.fromEntries(SECTION_DEFS.map((s) => [s.type, s]));

export function getSectionDef(type: string): SectionDef | undefined {
  return SECTION_MAP[type];
}

let counter = 0;
export function newSectionId(type: string): string {
  counter += 1;
  return `${type}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function createSection(type: string, data: Record<string, any> = {}): SectionInstance {
  const def = SECTION_MAP[type];
  if (!def) throw new Error(`Unknown section type: ${type}`);
  return { id: newSectionId(type), type, data: { ...def.defaults(), ...data } };
}

/** Render one section (returns "" for unknown/hidden sections). */
export function renderSection(section: SectionInstance, ctx: RenderContext): string {
  if (section.hidden) return "";
  const def = SECTION_MAP[section.type];
  if (!def) return `<!-- unknown section type ${esc(section.type)} -->`;
  const h = makeHelpers(ctx, section);
  return def.render(h);
}

/** Walk a section's fields and collect translatable strings as path → value. */
export function collectTranslatableStrings(section: SectionInstance): Array<{ path: string; value: string; fieldType: string }> {
  const def = SECTION_MAP[section.type];
  if (!def) return [];
  const out: Array<{ path: string; value: string; fieldType: string }> = [];
  const base = `sections.${section.id}`;
  const walk = (fields: FieldDef[], data: Record<string, any>, prefix: string) => {
    for (const f of fields) {
      const v = data?.[f.key];
      if (f.type === "list") {
        (v || []).forEach((item: any, i: number) => walk(f.item || [], item || {}, `${prefix}.${f.key}.${i}`));
        continue;
      }
      const translatable = f.translatable !== false && ["text", "textarea", "richtext"].includes(f.type);
      if (!translatable || !v || typeof v !== "string") continue;
      // Special cases: dotted lists (trust, checks, bullets) are split into indexed items at render time.
      if (["trust", "checks", "text"].includes(f.key) && section.type !== "rich_text" && section.type !== "text_block" && f.type === "text" && /\s[·•|]\s/.test(v)) {
        splitDots(v).forEach((part, i) => out.push({ path: `${prefix}.${f.key}.${i}`, value: part, fieldType: f.type }));
        continue;
      }
      if (f.key === "bullets" && f.type === "textarea") {
        v.split(/\n+/).map((b) => b.trim()).filter(Boolean).forEach((b, i) => out.push({ path: `${prefix}.${f.key}.${i}`, value: b, fieldType: "text" }));
        continue;
      }
      if (f.key === "cells" && section.type === "comparison") {
        v.split(/\s*\|\s*/).forEach((cell, i) => {
          const rest = cell.trim().replace(/^([✓✔✗✘×—–-])\s*/u, "");
          if (rest) out.push({ path: `${prefix}.${f.key}.${i}`, value: rest, fieldType: "text" });
        });
        continue;
      }
      out.push({ path: `${prefix}.${f.key}`, value: v, fieldType: f.type });
    }
  };
  walk(def.fields, section.data || {}, base);
  return out;
}

export type { ImageValue };
