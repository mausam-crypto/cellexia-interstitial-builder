import { useMemo, useState } from "react";
import { TextField, Select, Checkbox, Button, InlineStack, BlockStack, Text, Banner, Popover, ActionList, Badge, Spinner } from "@shopify/polaris";
import type { PageContent, SectionInstance, MarketOverride } from "../../lib/types";
import type { ClientSectionDef, LocaleInfo, MarketInfo } from "./types";
import { SubscriptionControls, type LoadSellingPlans } from "./SubscriptionControls";
import { resetPlansForNewProduct } from "../../lib/commerce/subscription";

/* ------------------------------------------------------------------ */
/* Section list (left column)                                           */
/* ------------------------------------------------------------------ */

export function SectionList({
  sections,
  defs,
  selected,
  onSelect,
  onChange,
}: {
  sections: SectionInstance[];
  defs: Record<string, ClientSectionDef>;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onChange: (next: SectionInstance[]) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= sections.length) return;
    const next = sections.slice();
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };
  const singletonsUsed = new Set(sections.map((s) => s.type));
  const addable = Object.values(defs).filter((d) => !(d.singleton && singletonsUsed.has(d.type)));
  const label = (s: SectionInstance) => {
    const d = s.data || {};
    return d.heading || d.headline || d.text || d.ctaLabel || "";
  };
  return (
    <div>
      <ul className="ib-sections">
        {sections.map((s, i) => {
          const def = defs[s.type];
          return (
            <li
              key={s.id}
              className={`ib-section${selected === s.id ? " is-active" : ""}${s.hidden ? " is-hidden" : ""}${overIdx === i ? " is-dragover" : ""}`}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => {
                e.preventDefault();
                setOverIdx(i);
              }}
              onDragLeave={() => setOverIdx(null)}
              onDrop={() => {
                if (dragIdx != null) move(dragIdx, i);
                setDragIdx(null);
                setOverIdx(null);
              }}
              onClick={() => onSelect(s.id)}
              title={def?.description}
            >
              <span className="ib-section__icon">{def?.icon || "▪"}</span>
              <span className="ib-section__label">
                {def?.label || s.type}
                <span className="ib-section__sub">{label(s) || (s.hidden ? "hidden" : "")}</span>
              </span>
              <span className="ib-section__actions" onClick={(e) => e.stopPropagation()}>
                <button className="ib-icon-btn" title="Move up" onClick={() => move(i, i - 1)}>▲</button>
                <button className="ib-icon-btn" title="Move down" onClick={() => move(i, i + 1)}>▼</button>
                <button className="ib-icon-btn" title={s.hidden ? "Show" : "Hide"} onClick={() => onChange(sections.map((x) => (x.id === s.id ? { ...x, hidden: !x.hidden } : x)))}>{s.hidden ? "👁‍🗨" : "👁"}</button>
                {!def?.singleton && (
                  <button
                    className="ib-icon-btn"
                    title="Duplicate"
                    onClick={() => {
                      const copy = { ...JSON.parse(JSON.stringify(s)), id: `${s.type}_${Math.random().toString(36).slice(2, 10)}` };
                      const next = sections.slice();
                      next.splice(i + 1, 0, copy);
                      onChange(next);
                      onSelect(copy.id);
                    }}
                  >
                    ⧉
                  </button>
                )}
                <button
                  className="ib-icon-btn"
                  title="Remove"
                  onClick={() => {
                    if (s.type === "pricing" && !confirm("Remove the pricing section? Every CTA on the page anchors to it.")) return;
                    onChange(sections.filter((x) => x.id !== s.id));
                    if (selected === s.id) onSelect(null);
                  }}
                >
                  ✕
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <div style={{ padding: 8 }}>
        <Popover
          active={addOpen}
          onClose={() => setAddOpen(false)}
          activator={
            <Button fullWidth onClick={() => setAddOpen(!addOpen)}>
              + Add section
            </Button>
          }
          fullWidth
        >
          <div className="ib-add-grid" style={{ width: 360 }}>
            {addable.map((d) => (
              <button
                key={d.type}
                className="ib-add-item"
                onClick={() => {
                  const inst: SectionInstance = { id: `${d.type}_${Math.random().toString(36).slice(2, 10)}`, type: d.type, data: JSON.parse(JSON.stringify(d.defaults)) };
                  // insert after the selected section (or before final CTA)
                  const idx = selected ? sections.findIndex((s) => s.id === selected) : -1;
                  const next = sections.slice();
                  next.splice(idx >= 0 ? idx + 1 : Math.max(0, next.length - 1), 0, inst);
                  onChange(next);
                  onSelect(inst.id);
                  setAddOpen(false);
                }}
              >
                {d.icon} <strong>{d.label}</strong>
                <small>{d.description}</small>
              </button>
            ))}
          </div>
        </Popover>
      </div>
      <div style={{ padding: "4px 12px 12px", fontSize: 12, color: "#6d7175" }}>
        Drag to reorder. Hidden sections stay in the page but don't render. The disclaimer is always shown after the last section and cannot be removed.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page settings                                                        */
/* ------------------------------------------------------------------ */

export function PageSettingsPanel({
  title,
  slug,
  content,
  onMeta,
  onContent,
  storeUrl,
  proxyPrefix,
  disclaimerDefault,
  isTemplate,
}: {
  title: string;
  slug: string;
  content: PageContent;
  onMeta: (m: { title?: string; slug?: string; isTemplate?: boolean }) => void;
  onContent: (c: PageContent) => void;
  storeUrl: string;
  proxyPrefix: string;
  disclaimerDefault: string;
  isTemplate: boolean;
}) {
  const visible = content.sections.filter((s) => !s.hidden && s.type !== "announcement_bar");
  return (
    <div className="ib-form">
      <BlockStack gap="300">
        <TextField label="Page title (internal)" value={title} onChange={(v) => onMeta({ title: v })} autoComplete="off" />
        <TextField label="URL slug" value={slug} onChange={(v) => onMeta({ slug: v })} autoComplete="off" prefix={`${proxyPrefix}/`} helpText={`Live URL: ${storeUrl}${proxyPrefix}/${slug}`} />
        <TextField label="Funnel label (internal)" value={content.funnelLabel || ""} onChange={(v) => onContent({ ...content, funnelLabel: v })} autoComplete="off" placeholder="Angle 1 · Crepey skin" />
        <Checkbox label="Use as the master template (offered first when creating new pages)" checked={isTemplate} onChange={(v) => onMeta({ isTemplate: v })} />
        <Text as="h4" variant="headingSm">SEO / browser</Text>
        <TextField label="Browser title" value={content.seo.title} onChange={(v) => onContent({ ...content, seo: { ...content.seo, title: v } })} autoComplete="off" />
        <TextField label="Meta description" value={content.seo.description} onChange={(v) => onContent({ ...content, seo: { ...content.seo, description: v } })} autoComplete="off" multiline={2} />
        <Checkbox label="Hide from search engines (noindex) — recommended for paid-traffic pages" checked={content.seo.noindex !== false} onChange={(v) => onContent({ ...content, seo: { ...content.seo, noindex: v } })} />
        <Select
          label="Store header on this page"
          options={[
            { label: "Store default (Settings → Store header; shown by default)", value: "default" },
            { label: "Show the store header", value: "show" },
            { label: "Hide the store header (footer stays)", value: "hide" },
          ]}
          value={content.header || "default"}
          onChange={(v) => onContent({ ...content, header: v as any })}
          helpText="The theme's real announcement bar, header and footer wrap every interstitial page. Hiding the header keeps visitors focused on the offer."
        />
        <Text as="h4" variant="headingSm">Sticky mobile CTA bar</Text>
        <Checkbox label="Show sticky bar on mobile" checked={content.stickyBar.enabled} onChange={(v) => onContent({ ...content, stickyBar: { ...content.stickyBar, enabled: v } })} />
        <TextField label="Bar text" value={content.stickyBar.text} onChange={(v) => onContent({ ...content, stickyBar: { ...content.stickyBar, text: v } })} autoComplete="off" helpText="Stars are added automatically before the text." />
        <TextField label="Bar button label" value={content.stickyBar.buttonLabel} onChange={(v) => onContent({ ...content, stickyBar: { ...content.stickyBar, buttonLabel: v } })} autoComplete="off" />
        <Select
          label="Appears after this section scrolls off"
          options={visible.map((s, i) => ({ label: `${i + 1}. ${s.type}`, value: String(i) }))}
          value={String(Math.min(content.stickyBar.showAfterSectionIndex ?? 0, Math.max(0, visible.length - 1)))}
          onChange={(v) => onContent({ ...content, stickyBar: { ...content.stickyBar, showAfterSectionIndex: Number(v) } })}
        />
        <Text as="h4" variant="headingSm">
          Disclaimer <span className="ib-badge-locked">always shown · cannot be removed</span>
        </Text>
        <TextField
          label="Page-specific disclaimer (leave empty to use the global text from Settings)"
          value={content.disclaimerOverride || ""}
          onChange={(v) => onContent({ ...content, disclaimerOverride: v })}
          autoComplete="off"
          multiline={3}
          placeholder={disclaimerDefault}
        />
        <TextField label="Team notes (internal)" value={content.notes || ""} onChange={(v) => onContent({ ...content, notes: v })} autoComplete="off" multiline={4} />
      </BlockStack>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Commerce                                                             */
/* ------------------------------------------------------------------ */

export function CommercePanel({
  content,
  onContent,
  markets,
  pickProduct,
  pickVariant,
  checkDiscount,
  discountDefaults,
  afterAddToCart,
  loadSellingPlans,
  applyContent,
}: {
  content: PageContent;
  onContent: (c: PageContent) => void;
  /** Functional update (latest content) for async flows. */
  applyContent?: (fn: (c: PageContent) => PageContent) => void;
  markets: MarketInfo[];
  loadSellingPlans?: LoadSellingPlans;
  pickProduct: () => Promise<{ handle: string; title: string; id: string; variants: Array<{ id: string; title: string; price?: string }> } | null>;
  pickVariant: (cardIndex: number) => Promise<{ id: string; title: string; productHandle?: string } | null>;
  checkDiscount: (code: string) => Promise<{ exists: boolean; summary?: string; error?: string }>;
  discountDefaults: { twoPack: string; threePack: string };
  afterAddToCart?: { mode: "collection" | "checkout" | "cart"; collectionHandle: string; openCart: boolean };
}) {
  const c = content.commerce;
  const storeDefaultLabel = !afterAddToCart || afterAddToCart.mode === "collection"
    ? `add to cart → /collections/${afterAddToCart?.collectionHandle || "shop-all"}${afterAddToCart?.openCart === false ? "" : " with the cart drawer open"}`
    : afterAddToCart.mode === "checkout" ? "straight to checkout" : "add to cart → cart page";
  const pricing = content.sections.find((s) => s.type === "pricing");
  const cards: any[] = pricing?.data?.cards || [];
  const [check, setCheck] = useState<{ exists: boolean; summary?: string; error?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [newMarket, setNewMarket] = useState("");
  const setCommerce = (patch: Partial<PageContent["commerce"]>) => onContent({ ...content, commerce: { ...c, ...patch } });
  const setCard = (i: number, patch: any) => {
    if (!pricing) return;
    const nextCards = cards.map((cd, k) => (k === i ? { ...cd, ...patch } : cd));
    onContent({ ...content, sections: content.sections.map((s) => (s.id === pricing.id ? { ...s, data: { ...s.data, cards: nextCards } } : s)) });
  };
  const overrides = c.marketOverrides || {};
  const setOverride = (cc: string, patch: Partial<MarketOverride> | null) => {
    const next = { ...overrides };
    if (patch === null) delete next[cc];
    else next[cc] = { ...(next[cc] || {}), ...patch };
    setCommerce({ marketOverrides: next });
  };
  return (
    <div className="ib-form">
      <BlockStack gap="300">
        <Text as="h4" variant="headingSm">Product</Text>
        <InlineStack gap="200" blockAlign="end">
          <div style={{ flex: 1 }}>
            <TextField label="Product handle" value={c.productHandle} onChange={(v) => { const changed = v.trim() !== (c.productHandle || "").trim(); const next = changed ? resetPlansForNewProduct(content) : content; onContent({ ...next, commerce: { ...next.commerce, productHandle: v, productId: changed ? "" : c.productId } }); }} autoComplete="off" helpText="Used for live, market-localised prices ({{ all_products[handle] }}). Changing it clears the selling-plan wiring (subscription mode) — reload the plans afterwards." />
          </div>
          <Button
            onClick={async () => {
              const p = await pickProduct();
              if (!p) return;
              // A different product → its selling plans / card plan ids no longer apply
              const base = p.handle !== c.productHandle ? resetPlansForNewProduct(content) : content;
              const baseCards: any[] = base.sections.find((s) => s.id === pricing?.id)?.data?.cards || cards;
              let next: PageContent = { ...base, commerce: { ...base.commerce, productHandle: p.handle, productTitle: p.title, productId: p.id } };
              // Auto-map cards by unit count when the product has "1 / 2 / 3" style variants.
              if (pricing && p.variants?.length) {
                const nextCards = baseCards.map((cd) => {
                  const n = Number(cd.unitCount) || 1;
                  const v = p.variants.find((x) => new RegExp(`^${n}\\b`).test(x.title)) || (n === 1 ? p.variants[0] : undefined);
                  return v ? { ...cd, variantId: v.id.replace(/\D/g, ""), variantTitle: v.title } : cd;
                });
                next = { ...next, sections: next.sections.map((s) => (s.id === pricing.id ? { ...s, data: { ...s.data, cards: nextCards } } : s)) };
              }
              onContent(next);
            }}
          >
            Choose product
          </Button>
        </InlineStack>
        {c.productTitle && <Text as="p" tone="subdued">{c.productTitle}</Text>}

        {loadSellingPlans && <SubscriptionControls content={content} onContent={onContent} apply={applyContent} loadSellingPlans={loadSellingPlans} />}

        <Text as="h4" variant="headingSm">Pricing cards → cart</Text>
        {!pricing && <Banner tone="warning"><p>This page has no pricing section. Add one from the section list.</p></Banner>}
        {cards.map((cd, i) => (
          <div className="ib-list-item" key={i}>
            <BlockStack gap="150">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="span" fontWeight="semibold">Card {i + 1}: {cd.title || "(untitled)"} {cd.highlight ? <Badge tone="info">highlighted</Badge> : null}</Text>
              </InlineStack>
              <InlineStack gap="200" blockAlign="end">
                <div style={{ flex: 1 }}>
                  <TextField label="Variant ID" value={cd.variantId || ""} onChange={(v) => setCard(i, { variantId: v.replace(/\D/g, "") })} autoComplete="off" helpText={cd.variantTitle ? `Variant: ${cd.variantTitle}` : "Numeric Shopify variant id"} />
                </div>
                <div style={{ width: 90 }}>
                  <TextField label="Qty" type="number" value={String(cd.quantity ?? 1)} onChange={(v) => setCard(i, { quantity: Math.max(1, Number(v) || 1) })} autoComplete="off" />
                </div>
                <Button
                  onClick={async () => {
                    const v = await pickVariant(i);
                    if (v) setCard(i, { variantId: v.id.replace(/\D/g, ""), variantTitle: v.title });
                  }}
                >
                  Pick
                </Button>
              </InlineStack>
              <div>
                <Text as="span" variant="bodySm" fontWeight="semibold">Also add to cart (free gift / add-ons)</Text>
                {(cd.addOns || []).map((a: any, k: number) => (
                  <InlineStack key={k} gap="150" blockAlign="end">
                    <div style={{ flex: 1 }}>
                      <TextField label="Variant ID" labelHidden value={a.variantId || ""} onChange={(v) => setCard(i, { addOns: cd.addOns.map((x: any, j: number) => (j === k ? { ...x, variantId: v.replace(/\D/g, "") } : x)) })} autoComplete="off" placeholder="Variant id" />
                    </div>
                    <div style={{ width: 70 }}>
                      <TextField label="Qty" labelHidden type="number" value={String(a.quantity ?? 1)} onChange={(v) => setCard(i, { addOns: cd.addOns.map((x: any, j: number) => (j === k ? { ...x, quantity: Number(v) || 1 } : x)) })} autoComplete="off" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField label="Label" labelHidden value={a.label || ""} onChange={(v) => setCard(i, { addOns: cd.addOns.map((x: any, j: number) => (j === k ? { ...x, label: v } : x)) })} autoComplete="off" placeholder="Label (info)" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField label="Product handle" labelHidden value={a.productHandle || ""} onChange={(v) => setCard(i, { addOns: cd.addOns.map((x: any, j: number) => (j === k ? { ...x, productHandle: v.trim() } : x)) })} autoComplete="off" placeholder="Product handle (safety)" helpText={k === 0 ? "With a handle, the gift is only added when it's published to the Online Store & in stock — the button never breaks." : undefined} />
                    </div>
                    <Button size="slim" tone="critical" variant="plain" onClick={() => setCard(i, { addOns: cd.addOns.filter((_: any, j: number) => j !== k) })}>✕</Button>
                  </InlineStack>
                ))}
                <div style={{ marginTop: 6 }}>
                  <Button size="slim" onClick={() => setCard(i, { addOns: [...(cd.addOns || []), { variantId: "", quantity: 1, label: "", productHandle: "" }] })}>+ Add gift / add-on</Button>
                </div>
              </div>
            </BlockStack>
          </div>
        ))}

        <Text as="h4" variant="headingSm">Discount code</Text>
        <Checkbox label="Apply a funnel discount code automatically" checked={c.discountEnabled} onChange={(v) => setCommerce({ discountEnabled: v })} helpText="Off = the bundle variants' built-in prices apply (e.g. your default 2-pack / 3-pack discounts). On = the code below is appended to every cart link." />
        <InlineStack gap="200" blockAlign="end">
          <div style={{ flex: 1 }}>
            <TextField label="Discount code" value={c.discountCode} onChange={(v) => setCommerce({ discountCode: v.toUpperCase().trim() })} autoComplete="off" placeholder="CREPE20" />
          </div>
          <Button
            disabled={!c.discountCode || checking}
            onClick={async () => {
              setChecking(true);
              try {
                setCheck(await checkDiscount(c.discountCode));
              } finally {
                setChecking(false);
              }
            }}
          >
            {checking ? "Checking…" : "Check in Shopify"}
          </Button>
        </InlineStack>
        {check && (
          <Banner tone={check.error ? "warning" : check.exists ? "success" : "critical"}>
            <p>{check.error ? check.error : check.exists ? `Found: ${check.summary}` : `“${c.discountCode}” does not exist in Shopify Discounts — create it there first or turn the toggle off.`}</p>
          </Banner>
        )}
        {(discountDefaults.twoPack || discountDefaults.threePack) && (
          <Text as="p" tone="subdued" variant="bodySm">Store defaults from Settings: 2-pack “{discountDefaults.twoPack || "—"}”, 3-pack “{discountDefaults.threePack || "—"}”.</Text>
        )}

        <Text as="h4" variant="headingSm">Behaviour</Text>
        <Select
          label="Add-to-cart button behaviour"
          options={[
            { label: "Store default (Settings → After add to cart)", value: "default" },
            { label: "Add to cart → collection (Shop All) with the cart drawer open", value: "collection" },
            { label: "Straight to checkout (cart permalink /cart/VARIANT:QTY?discount=CODE)", value: "checkout" },
            { label: "Add to cart and open the cart page (/discount → /cart/add → /cart)", value: "cart" },
          ]}
          value={c.checkoutMode || "default"}
          onChange={(v) => setCommerce({ checkoutMode: v as any })}
          helpText={`Store default right now: ${storeDefaultLabel} (change it in Settings → After add to cart).${c.checkoutMode === "checkout" ? " This page overrides it and sends visitors straight to checkout — pick “Store default” to add to cart and land on the collection instead." : ""}`}
        />
        <Checkbox label="Carry UTM / click-id parameters into the cart as attributes (attribution)" checked={c.utmPassthrough} onChange={(v) => setCommerce({ utmPassthrough: v })} />
        <Checkbox label="Show live Shopify prices (auto-localised per market/currency) — manual prices are the fallback" checked={c.livePrices} onChange={(v) => setCommerce({ livePrices: v })} />

        <Text as="h4" variant="headingSm">Per-market overrides</Text>
        <Text as="p" tone="subdued" variant="bodySm">Change the discount code, swap a card's variant, or hide a card for visitors from a specific market (detected on the storefront via the selected country).</Text>
        {Object.entries(overrides).map(([cc, o]) => (
          <div className="ib-list-item" key={cc}>
            <BlockStack gap="150">
              <InlineStack align="space-between">
                <Text as="span" fontWeight="semibold">{markets.find((m) => m.code === cc)?.name || cc} ({cc})</Text>
                <Button size="slim" tone="critical" variant="plain" onClick={() => setOverride(cc, null)}>Remove</Button>
              </InlineStack>
              <InlineStack gap="200" blockAlign="end">
                <div style={{ flex: 1 }}>
                  <TextField label="Discount code (leave empty = same as page)" value={o.discountCode ?? ""} onChange={(v) => setOverride(cc, { discountCode: v || undefined })} autoComplete="off" />
                </div>
                <Select label="Discount" options={[{ label: "Same as page", value: "" }, { label: "On", value: "1" }, { label: "Off", value: "0" }]} value={o.discountEnabled === undefined ? "" : o.discountEnabled ? "1" : "0"} onChange={(v) => setOverride(cc, { discountEnabled: v === "" ? undefined : v === "1" })} />
              </InlineStack>
              {cards.map((cd, i) => (
                <InlineStack key={i} gap="200" blockAlign="end">
                  <div style={{ flex: 1 }}>
                    <TextField label={`Card ${i + 1} variant id override`} value={o.cardVariantIds?.[String(i)] || ""} onChange={(v) => setOverride(cc, { cardVariantIds: { ...(o.cardVariantIds || {}), [String(i)]: v.replace(/\D/g, "") } })} autoComplete="off" placeholder="(same)" />
                  </div>
                  <Checkbox label="Hide card" checked={!!o.hideCards?.[String(i)]} onChange={(v) => setOverride(cc, { hideCards: { ...(o.hideCards || {}), [String(i)]: v } })} />
                </InlineStack>
              ))}
            </BlockStack>
          </div>
        ))}
        <InlineStack gap="200" blockAlign="end">
          <div style={{ flex: 1 }}>
            <Select label="Add market override" options={[{ label: "Choose a market…", value: "" }, ...markets.filter((m) => !overrides[m.code]).map((m) => ({ label: `${m.name} (${m.code})`, value: m.code }))]} value={newMarket} onChange={setNewMarket} />
          </div>
          <Button disabled={!newMarket} onClick={() => { setOverride(newMarket, {}); setNewMarket(""); }}>Add</Button>
        </InlineStack>
      </BlockStack>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Translations                                                         */
/* ------------------------------------------------------------------ */

export function TranslationsPanel({
  content,
  onContent,
  locales,
  strings,
  translate,
  aiAvailable,
  deeplAvailable,
}: {
  content: PageContent;
  onContent: (c: PageContent) => void;
  locales: LocaleInfo[];
  strings: Array<{ path: string; value: string }>;
  translate: (args: { provider: "deepl" | "claude"; targetLocales: string[]; onlyMissing: boolean }) => Promise<{ ok: boolean; message: string; content?: PageContent }>;
  aiAvailable: boolean;
  deeplAvailable: boolean;
}) {
  const primary = locales.find((l) => l.primary)?.locale || "en";
  const others = locales.filter((l) => !l.primary);
  const [selected, setSelected] = useState<string[]>([]);
  const [provider, setProvider] = useState<"deepl" | "claude">(deeplAvailable ? "deepl" : "claude");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [viewLocale, setViewLocale] = useState<string>(others[0]?.locale || "");
  const [filter, setFilter] = useState("");
  const done = useMemo(() => {
    const out: Record<string, number> = {};
    for (const l of others) out[l.locale] = strings.filter((s) => content.translations?.[l.locale]?.[s.path]).length;
    return out;
  }, [content.translations, others, strings]);
  const rows = strings.filter((s) => !filter || s.value.toLowerCase().includes(filter.toLowerCase()) || s.path.includes(filter));
  return (
    <div className="ib-form">
      <BlockStack gap="300">
        <Text as="p" tone="subdued" variant="bodySm">
          Source language: <b>{primary}</b>. Translations render automatically for visitors browsing the store in that language (request.locale). Untranslated strings fall back to the source. {strings.length} translatable strings on this page.
        </Text>
        <div>
          <Text as="span" fontWeight="semibold" variant="bodySm">Languages to translate into</Text>
          <div className="ib-inline" style={{ marginTop: 6 }}>
            {others.map((l) => (
              <Checkbox key={l.locale} label={`${l.name || l.locale} (${done[l.locale] || 0}/${strings.length})`} checked={selected.includes(l.locale)} onChange={(v) => setSelected(v ? [...selected, l.locale] : selected.filter((x) => x !== l.locale))} />
            ))}
            {!others.length && <Text as="span" tone="subdued">Only one language is published on the store.</Text>}
          </div>
        </div>
        <InlineStack gap="200" blockAlign="end">
          <Select label="Provider" options={[{ label: `DeepL${deeplAvailable ? "" : " (add API key in Settings)"}`, value: "deepl", disabled: !deeplAvailable }, { label: `Claude${aiAvailable ? "" : " (add API key in Settings)"}`, value: "claude", disabled: !aiAvailable }]} value={provider} onChange={(v) => setProvider(v as any)} />
          <Button
            variant="primary"
            disabled={!selected.length || busy || (provider === "deepl" ? !deeplAvailable : !aiAvailable)}
            onClick={async () => {
              setBusy(true);
              setMsg(null);
              try {
                const r = await translate({ provider, targetLocales: selected, onlyMissing: true });
                setMsg(r.message);
                if (r.ok && r.content) onContent(r.content);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Translating…" : "Translate missing"}
          </Button>
          <Button
            disabled={!selected.length || busy}
            onClick={async () => {
              if (!confirm("Re-translate everything for the selected languages (overwrites edits)?")) return;
              setBusy(true);
              try {
                const r = await translate({ provider, targetLocales: selected, onlyMissing: false });
                setMsg(r.message);
                if (r.ok && r.content) onContent(r.content);
              } finally {
                setBusy(false);
              }
            }}
          >
            Re-translate all
          </Button>
          {busy && <Spinner size="small" />}
        </InlineStack>
        {msg && <Banner tone={/fail|error/i.test(msg) ? "critical" : "success"}><p>{msg}</p></Banner>}
        {others.length > 0 && (
          <>
            <InlineStack gap="200" blockAlign="end">
              <Select label="Review / edit language" options={others.map((l) => ({ label: `${l.name || l.locale}`, value: l.locale }))} value={viewLocale} onChange={setViewLocale} />
              <div style={{ flex: 1 }}>
                <TextField label="Filter" labelHidden placeholder="Filter strings…" value={filter} onChange={setFilter} autoComplete="off" />
              </div>
              <Button size="slim" tone="critical" variant="plain" onClick={() => { if (!confirm(`Delete all ${viewLocale} translations for this page?`)) return; const t = { ...content.translations }; delete t[viewLocale]; onContent({ ...content, translations: t }); }}>Clear {viewLocale}</Button>
            </InlineStack>
            <div>
              {rows.slice(0, 400).map((s) => (
                <div className="ib-translation-row" key={s.path}>
                  <div className="ib-src" title={s.path}>{s.value}</div>
                  <TextField
                    label={s.path}
                    labelHidden
                    value={content.translations?.[viewLocale]?.[s.path] || ""}
                    onChange={(v) => onContent({ ...content, translations: { ...content.translations, [viewLocale]: { ...(content.translations?.[viewLocale] || {}), [s.path]: v } } })}
                    autoComplete="off"
                    multiline={s.value.length > 80 ? 3 : 1}
                    placeholder="(not translated — falls back to source)"
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </BlockStack>
    </div>
  );
}
