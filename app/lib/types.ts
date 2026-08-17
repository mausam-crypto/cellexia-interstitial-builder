/**
 * Shared data types for the Interstitial Page Builder.
 *
 * Everything the editor edits is plain JSON so it can be stored in one column,
 * duplicated, translated and diffed. Sections are instances of definitions from
 * the section registry (app/lib/sections).
 */

export type FieldType =
  | "text"
  | "textarea"
  | "richtext"
  | "image"
  | "url"
  | "boolean"
  | "select"
  | "number"
  | "color"
  | "list"
  | "stars";

export interface FieldOption {
  label: string;
  value: string;
}

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  help?: string;
  /** Text fields that should be offered for translation. Defaults to true for text/textarea/richtext. */
  translatable?: boolean;
  options?: FieldOption[];
  /** For type "list": the schema of each item. */
  item?: FieldDef[];
  /** For type "list": limits. */
  minItems?: number;
  maxItems?: number;
  /** For type "image": default AI prompt offered in the "Generate" dialog. */
  imagePrompt?: string;
  /** For type "image": suggested aspect ratio (e.g. "4:3", "1:1"). */
  imageAspect?: string;
  placeholder?: string;
  /** Group label used to visually cluster fields in the editor. */
  group?: string;
  /** Marks a field as product-specific: surfaced in the duplicate wizard. */
  productSpecific?: boolean;
  /** Hidden from the generic form (rendered by a dedicated UI, e.g. commerce). */
  advanced?: boolean;
}

export interface ImageValue {
  src: string;
  alt?: string;
  /** Free-form note: where the image came from (manifest slot, prompt, etc.) */
  note?: string;
  width?: number;
  height?: number;
}

export interface SectionInstance {
  id: string;
  type: string;
  hidden?: boolean;
  /** Field values keyed by FieldDef.key */
  data: Record<string, any>;
}

export interface CartAddOn {
  variantId: string;
  quantity: number;
  label?: string;
}

/** Commerce mapping of one pricing card (lives inside the pricing section's card item). */
export interface CardCommerce {
  variantId: string;
  variantTitle?: string;
  quantity: number;
  /** Extra items added to the cart with this card (e.g. the free gift towel). */
  addOns: CartAddOn[];
}

export interface MarketOverride {
  discountCode?: string;
  discountEnabled?: boolean;
  /** cardIndex → variantId */
  cardVariantIds?: Record<string, string>;
  /** cardIndex → hide */
  hideCards?: Record<string, boolean>;
  crossSellUrl?: string;
}

export interface CommerceSettings {
  productHandle: string;
  productTitle?: string;
  productId?: string;
  discountCode: string;
  discountEnabled: boolean;
  /** "checkout": cart permalink straight to checkout. "cart": /discount → /cart/add → cart page. */
  checkoutMode: "checkout" | "cart";
  utmPassthrough: boolean;
  /** Show live Shopify prices (auto-localised per market) instead of the manual strings. */
  livePrices: boolean;
  /** ISO country code → overrides */
  marketOverrides: Record<string, MarketOverride>;
}

export interface StickyBarSettings {
  enabled: boolean;
  text: string; // e.g. "★★★★★ [12,000]+ reviews"
  buttonLabel: string;
  showAfterSectionIndex: number; // appears once this section has scrolled off (0 = hero)
}

export interface SeoSettings {
  title: string;
  description: string;
  noindex: boolean;
}

export interface PageContent {
  version: 1;
  sections: SectionInstance[];
  commerce: CommerceSettings;
  stickyBar: StickyBarSettings;
  seo: SeoSettings;
  /** Optional per-page override of the global disclaimer text. Disclaimer can never be removed. */
  disclaimerOverride?: string;
  /** locale → (path → translated string). Paths look like "sections.<id>.<key>" or "sections.<id>.<key>.<index>.<subkey>". */
  translations: Record<string, Record<string, string>>;
  /** Internal note for the team (angle, advertorial link, etc.) */
  notes?: string;
  /** Angle / funnel label shown in the admin list */
  funnelLabel?: string;
}

export interface BrandSettings {
  accentColor: string; // CTA background
  accentText: string; // CTA text colour
  inkColor: string; // headings / dark buttons
  bodyColor: string;
  softBg: string; // cream/off-white bands
  highlightBg: string; // highlighted card / column background tint
  fontHeading: string;
  fontBody: string;
  fontDisplay: string; // big numerals / eyebrows
  ctaStyle: "accent" | "ink"; // accent pill with dark text (Glow25-style) or dark pill with white text
  buttonRadius: string; // e.g. "999px"
  fullBleed: boolean;
  guaranteeDays: number;
  guaranteeShort: string; // "60-day money-back guarantee"
  shippingLine: string; // "Free express shipping on every order"
  supportEmail: string;
  disclaimer: string;
  paymentIcons: string[]; // ["visa","mastercard","paypal","klarna","amex","applepay","googlepay"]
  storeName: string;
  storeUrl: string; // https://cellexialabs.com
  awardSealUrl?: string;
  clinicsClaim: string; // "Used in 100+ leading aesthetic clinics"
  /** Optional per-locale translations of brand strings (guaranteeShort, shippingLine, disclaimer...) */
  translations: Record<string, Record<string, string>>;
  /** Default AI settings */
  ai: {
    claudeModel: string;
    imageProvider: "higgsfield" | "claude-svg";
    higgsfieldModel: string; // e.g. "higgsfield-ai/soul/standard" | "nano-banana"
    imageStyle: string; // appended to every image prompt
  };
  /** Discount defaults offered in the wizard */
  discountDefaults: {
    twoPack: string;
    threePack: string;
  };
}

export type RenderMode = "liquid" | "preview";

export interface RenderContext {
  mode: RenderMode;
  brand: BrandSettings;
  page: PageContent;
  pageId: string;
  slug: string;
  /** Locales that have translations for this page (used in liquid mode). */
  locales: string[];
  /** For preview mode: which locale to render */
  previewLocale?: string;
  /** For preview mode: which market (country code) to simulate */
  previewMarket?: string;
  /** Root path for the storefront ("" in liquid mode - uses routes.*; "https://cellexialabs.com" in preview) */
  storeRoot: string;
  /** Path used by the analytics beacon (proxy path). */
  eventsPath: string;
  proxyPath: string; // e.g. /a/go
}

export interface RenderedPage {
  html: string; // full body (Liquid or plain HTML)
  bytes: number;
  warnings: string[];
  sectionCount: number;
}
