import type { BrandSettings, PageContent, CommerceSettings, SubscriptionSettings } from "./types";

/** Cellexia brand defaults — pulled from cellexialabs.com's live theme tokens (Aug 2026). */
export const DEFAULT_BRAND: BrandSettings = {
  accentColor: "#B1CDED", // Cellexia light-blue accent (theme secondary button)
  accentText: "#1D1D1B",
  inkColor: "#1D1D1B", // Cellexia primary near-black
  bodyColor: "#2B2B29",
  softBg: "#F7F6F3",
  highlightBg: "#EEF4FA",
  fontHeading: "'argumentum','Inter',system-ui,sans-serif",
  fontBody: "'argumentum','Inter',system-ui,sans-serif",
  fontDisplay: "'Gobold','argumentum','Inter',system-ui,sans-serif",
  ctaStyle: "accent",
  buttonRadius: "999px",
  fullBleed: true,
  guaranteeDays: 60,
  guaranteeShort: "60-day money-back guarantee",
  shippingLine: "Free express shipping on every order",
  supportEmail: "support@cellexialabs.com",
  disclaimer:
    "The information presented on this page is not intended as medical advice. These statements have not been evaluated by the relevant health authorities. This product is not intended to diagnose, treat, cure, or prevent any disease. Results vary from person to person.",
  paymentIcons: ["visa", "mastercard", "paypal", "klarna", "amex", "applepay", "googlepay"],
  storeName: "Cellexia",
  storeUrl: "https://cellexialabs.com",
  awardSealUrl: "/builder/award-seal.svg",
  clinicsClaim: "Used in 100+ leading aesthetic clinics",
  translations: {},
  ai: {
    claudeModel: "claude-opus-5",
    imageProvider: "higgsfield",
    higgsfieldModel: "higgsfield-ai/soul/standard",
    imageStyle:
      "unretouched, realistic skin texture appropriate for age, natural light, candid phone-photo feel, no text, no logos, no watermark",
  },
  showHeader: true,
  headerSelectors: "#shopify-section-header, #shopify-section-alert-bar, #shopify-section-ticker, #shopify-section-announcement-bar, .site-header, .header-wrapper",
  afterAddToCart: { mode: "collection", collectionHandle: "shop-all", openCart: true },
  discountDefaults: { twoPack: "", threePack: "" },
};

export function mergeBrand(partial?: Partial<BrandSettings> | null): BrandSettings {
  const p = partial || {};
  return {
    ...DEFAULT_BRAND,
    ...p,
    ai: { ...DEFAULT_BRAND.ai, ...(p.ai || {}) },
    discountDefaults: { ...DEFAULT_BRAND.discountDefaults, ...(p.discountDefaults || {}) },
    afterAddToCart: { ...DEFAULT_BRAND.afterAddToCart, ...(p.afterAddToCart || {}) },
    prompts: { ...(p.prompts || {}), slotHints: { ...(p.prompts?.slotHints || {}) } },
    translations: p.translations || {},
    paymentIcons: p.paymentIcons || DEFAULT_BRAND.paymentIcons,
  };
}

export const DEFAULT_SUBSCRIPTION: SubscriptionSettings = { offerType: "simple", unavailable: "one-time", plans: [] };

export const DEFAULT_COMMERCE: CommerceSettings = {
  productHandle: "",
  purchaseMode: "one-time",
  subscription: { ...DEFAULT_SUBSCRIPTION },
  productTitle: "",
  productId: "",
  discountCode: "",
  discountEnabled: false,
  checkoutMode: "default",
  utmPassthrough: true,
  livePrices: true,
  marketOverrides: {},
};

export function emptyPageContent(): PageContent {
  return {
    version: 1,
    sections: [],
    commerce: { ...DEFAULT_COMMERCE, marketOverrides: {} },
    stickyBar: { enabled: true, text: "★★★★★ [12,000]+ reviews", buttonLabel: "Order now and save up to 20%", showAfterSectionIndex: 0 },
    seo: { title: "", description: "", noindex: true },
    translations: {},
    notes: "",
    funnelLabel: "",
  };
}

/** Fill in any missing keys so old/partial JSON always has the full shape. */
export function normalizePage(input: any): PageContent {
  const base = emptyPageContent();
  const p = input && typeof input === "object" ? input : {};
  return {
    ...base,
    ...p,
    version: 1,
    sections: Array.isArray(p.sections) ? p.sections.filter((s: any) => s && s.type && s.id).map((s: any) => ({ ...s, data: s.data || {} })) : [],
    commerce: {
      ...base.commerce,
      ...(p.commerce || {}),
      purchaseMode: p.commerce?.purchaseMode === "subscription" ? "subscription" : "one-time",
      subscription: { ...DEFAULT_SUBSCRIPTION, ...(p.commerce?.subscription || {}), plans: Array.isArray(p.commerce?.subscription?.plans) ? p.commerce.subscription.plans : [] },
      marketOverrides: (p.commerce && p.commerce.marketOverrides) || {},
    },
    stickyBar: { ...base.stickyBar, ...(p.stickyBar || {}) },
    seo: { ...base.seo, ...(p.seo || {}) },
    translations: p.translations && typeof p.translations === "object" ? p.translations : {},
  };
}
