import { useState } from "react";
import { TextField, Select, Button, InlineStack, BlockStack, Text, Banner, Collapsible, Badge } from "@shopify/polaris";
import type { PageContent, SellingPlanInfo } from "../../lib/types";
import { applySubscriptionPresets, removeSubscriptionPresets, detectOfferType, offerLineFor, deliveryLineFor, plansForVariant, autoWireCardPlans } from "../../lib/commerce/subscription";

export type LoadSellingPlans = (args: { handle: string; productId?: string }) => Promise<{ plans: SellingPlanInfo[]; variantPlans?: Record<string, string[]> }>;

const WORDING: Array<{ key: string; label: string; def: string }> = [
  { key: "labelPerDelivery", label: "“per delivery”", def: "per delivery" },
  { key: "labelFirstDelivery", label: "“First delivery”", def: "First delivery" },
  { key: "labelThen", label: "“then”", def: "then" },
  { key: "labelEveryDelivery", label: "“every delivery”", def: "every delivery" },
  { key: "labelOnFirst", label: "“on your first delivery”", def: "on your first delivery" },
  { key: "labelSubscribeButton", label: "Default subscription button", def: "Subscribe & save" },
  { key: "labelOneTimeButton", label: "One-time fallback button", def: "Add to cart" },
];

/**
 * Purchase mode + selling-plan wiring (native Shopify subscriptions) + every subscription text, in one place.
 * Shared by the Commerce tab and the wizard. Selling plan groups are attached per VARIANT, so each card only
 * offers the plans of its own variant and is auto-wired to them (never by position across variants).
 */
export function SubscriptionControls({ content, onContent, apply, loadSellingPlans, compact }: { content: PageContent; onContent: (c: PageContent) => void; /** Functional update against the latest content (used after async loads). Falls back to onContent(fn(content)). */ apply?: (fn: (c: PageContent) => PageContent) => void; loadSellingPlans: LoadSellingPlans; compact?: boolean }) {
  const c = content.commerce;
  const applyFn = apply || ((fn: (x: PageContent) => PageContent) => onContent(fn(content)));
  const sub = c.subscription || { offerType: "simple" as const, unavailable: "one-time" as const, plans: [] as SellingPlanInfo[] };
  const plans = sub.plans || [];
  const variantPlans = sub.variantPlans;
  const pricing = content.sections.find((s) => s.type === "pricing");
  const cards: any[] = pricing?.data?.cards || [];
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showWording, setShowWording] = useState(false);
  const isSub = c.purchaseMode === "subscription";
  const setSub = (patch: Partial<typeof sub>) => onContent({ ...content, commerce: { ...c, subscription: { ...sub, ...patch } } });
  const setPricing = (patch: Record<string, any>) => pricing && onContent({ ...content, sections: content.sections.map((s) => (s.id === pricing.id ? { ...s, data: { ...s.data, ...patch } } : s)) });
  const setCard = (i: number, patch: any) => {
    if (!pricing) return;
    onContent({ ...content, sections: content.sections.map((s) => (s.id === pricing.id ? { ...s, data: { ...s.data, cards: cards.map((cd, k) => (k === i ? { ...cd, ...patch } : cd)) } } : s)) });
  };
  const setSticky = (patch: Partial<PageContent["stickyBar"]>) => onContent({ ...content, stickyBar: { ...content.stickyBar, ...patch } });

  const load = async () => {
    setErr(null);
    setBusy(true);
    try {
      const r = await loadSellingPlans({ handle: c.productHandle, productId: c.productId });
      const loaded = r.plans || [];
      const vp = r.variantPlans || undefined;
      if (!loaded.length) {
        applyFn((latest) => ({ ...latest, commerce: { ...latest.commerce, subscription: { ...(latest.commerce.subscription || sub), plans: [], variantPlans: vp } } }));
        setErr("This product has no selling plans in Shopify. Create them in your subscription app first, then load again.");
        return;
      }
      const type = detectOfferType(loaded);
      applyFn((latest) => {
        const latestCards: any[] = latest.sections.find((s) => s.type === "pricing")?.data?.cards || [];
        const cardPlans = autoWireCardPlans(latestCards, loaded, vp);
        return applySubscriptionPresets({ ...latest, commerce: { ...latest.commerce, subscription: { ...(latest.commerce.subscription || sub), plans: loaded, variantPlans: vp, offerType: type } } }, { plans: loaded, offerType: type, cardPlans });
      });
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };
  const reapplyDefaults = () => {
    applyFn((latest) => {
      const stripped = removeSubscriptionPresets(latest);
      const cleared: PageContent = {
        ...stripped,
        sections: stripped.sections.map((s) => {
          if (s.type === "pricing") return { ...s, data: { ...s.data, subscriptionTerms: "", _presetTerms: undefined, cards: (s.data.cards || []).map((cd: any) => ({ ...cd, deliveryLine: "", offerLine: "", _presetDeliveryLine: undefined, _presetOfferLine: undefined, buttonLabel: "" })) } };
          return s;
        }),
      };
      return applySubscriptionPresets(cleared, { plans: latest.commerce.subscription?.plans || plans, offerType: latest.commerce.subscription?.offerType || sub.offerType });
    });
  };
  const planLabel = (p: SellingPlanInfo) => `${p.groupName && p.groupName !== p.name ? p.groupName + " · " : ""}${p.name} — ${p.summary}`;
  const missing = isSub ? cards.filter((cd) => !String(cd.sellingPlanId || "").trim()).length : 0;
  const mismatched = isSub && variantPlans ? cards.filter((cd) => cd.sellingPlanId && cd.variantId && !plansForVariant(plans, variantPlans, cd.variantId).some((p) => p.id === String(cd.sellingPlanId))).length : 0;
  const stickyDefaultBtn = pricing?.data?.labelSubscribeButton || "Subscribe & save";

  return (
    <BlockStack gap="200">
      <Text as="h4" variant="headingSm">Purchase mode</Text>
      <Select
        label="Purchase mode"
        labelHidden
        options={[
          { label: "One-time purchase (default)", value: "one-time" },
          { label: "Subscription only — native Shopify selling plans", value: "subscription" },
        ]}
        value={c.purchaseMode || "one-time"}
        onChange={(v) => {
          if (v === "subscription") onContent(applySubscriptionPresets(content, { plans, cardPlans: plans.length ? autoWireCardPlans(cards, plans, variantPlans) : undefined }));
          else onContent(removeSubscriptionPresets(content));
        }}
        helpText={isSub ? "Every card sells a subscription: its variant + a selling plan attached to that variant. Buttons add the line with its selling plan; live prices come from the plan. All wording below is yours to change." : "Switching to subscription applies editable copy presets (button labels, delivery/offer lines, terms, FAQ items, benefits row) and wires each card to the selling plans of its own variant."}
      />
      {isSub && (
        <BlockStack gap="300">
          {/* --- plans --- */}
          <InlineStack gap="200" blockAlign="center" wrap>
            <Button onClick={load} loading={busy} disabled={!c.productHandle && !c.productId}>{plans.length ? "Reload selling plans" : "Load selling plans for this product"}</Button>
            <Text as="span" tone="subdued" variant="bodySm">{plans.length ? `${plans.length} plan(s) in Shopify${variantPlans ? " · mapped per variant" : ""}` : "Loads the subscription plans attached to the product's variants (from your subscription app)."}</Text>
          </InlineStack>
          {err && <Banner tone="warning"><p>{err}</p></Banner>}
          {plans.length > 0 && (
            <div className="ib-list-item">
              <BlockStack gap="100">
                {plans.map((p) => {
                  const vids = variantPlans ? Object.entries(variantPlans).filter(([, ids]) => ids.includes(p.id)).map(([vid]) => vid) : [];
                  const names = vids.map((vid) => { const card = cards.find((cd) => String(cd.variantId) === vid); return card?.variantTitle || card?.title || vid; });
                  return (
                    <Text as="p" variant="bodySm" key={p.id}>• {planLabel(p)} <span style={{ color: "#8c9196" }}>(id {p.id}{variantPlans ? ` · variants: ${names.length ? names.join(", ") : "none"}` : ""})</span></Text>
                  );
                })}
              </BlockStack>
            </div>
          )}
          <InlineStack gap="200" wrap>
            <div style={{ flex: 1, minWidth: 220 }}>
              <Select
                label="Offer type (drives the default copy)"
                options={[
                  { label: "Simple — 5–10% off every delivery", value: "simple" },
                  { label: "Intro — 20% off first order, then 5–10% off", value: "intro" },
                  { label: "Trial — 50% off the first delivery", value: "trial" },
                ]}
                value={sub.offerType || "simple"}
                onChange={(v) => setSub({ offerType: v as any })}
                helpText="The real discounts live in the selling plans; this only shapes the default wording."
              />
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <Select
                label="If a market/variant doesn't offer the plan"
                options={[
                  { label: "Show a one-time button instead", value: "one-time" },
                  { label: "Hide the card there", value: "hide" },
                ]}
                value={sub.unavailable || "one-time"}
                onChange={(v) => setSub({ unavailable: v as any })}
              />
            </div>
          </InlineStack>
          <InlineStack gap="200" blockAlign="center">
            <Button size="slim" onClick={reapplyDefaults}>Re-apply subscription copy defaults</Button>
            <Text as="span" tone="subdued" variant="bodySm">Rewrites the delivery/offer lines, terms, FAQ items, benefits row and button labels for the current offer type — your hand-written edits elsewhere stay.</Text>
          </InlineStack>
          {missing > 0 && <Banner tone="critical"><p>{missing} card(s) have no selling plan — their button would sell a one-time purchase. Pick a plan for every card.</p></Banner>}
          {mismatched > 0 && <Banner tone="critical"><p>{mismatched} card(s) use a plan that is not attached to the card's variant in Shopify — the store would reject that line. Pick one of the variant's own plans.</p></Banner>}

          {/* --- per card --- */}
          {!compact && cards.length > 0 && (
            <BlockStack gap="150">
              <Text as="h4" variant="headingSm">Per card: plan & wording</Text>
              {cards.map((cd, i) => {
                const applicable = plans.length ? plansForVariant(plans, variantPlans, cd.variantId) : [];
                const options = [{ label: "— no plan (one-time!) —", value: "" }, ...applicable.map((p) => ({ label: planLabel(p), value: p.id }))];
                const cur = String(cd.sellingPlanId || "");
                const curKnown = applicable.some((p) => p.id === cur);
                if (cur && !curKnown && plans.length) options.push({ label: `⚠ current plan ${cur} is not attached to this variant`, value: cur });
                return (
                  <div className="ib-list-item" key={i}>
                    <BlockStack gap="100">
                      <InlineStack gap="150" blockAlign="center">
                        <Text as="span" fontWeight="semibold" variant="bodySm">Card {i + 1}: {cd.title || "(untitled)"}</Text>
                        {cd.variantTitle && <Badge>{String(cd.variantTitle)}</Badge>}
                        {plans.length > 0 && variantPlans && applicable.length === 0 && <Badge tone="critical">variant has no plan in Shopify</Badge>}
                      </InlineStack>
                      {plans.length > 0 ? (
                        <Select
                          label="Selling plan (only plans attached to this card's variant)"
                          options={options}
                          value={cur}
                          onChange={(v) => {
                            const p = plans.find((x) => x.id === v);
                            setCard(i, { sellingPlanId: v, sellingPlanName: p ? planLabel(p) : "", deliveryLine: p ? deliveryLineFor(p) : cd.deliveryLine, _presetDeliveryLine: p ? deliveryLineFor(p) : cd._presetDeliveryLine, offerLine: p ? offerLineFor(sub.offerType || "simple", p) : cd.offerLine, _presetOfferLine: p ? offerLineFor(sub.offerType || "simple", p) : cd._presetOfferLine });
                          }}
                        />
                      ) : (
                        <TextField label="Selling plan ID" value={cd.sellingPlanId || ""} onChange={(v) => setCard(i, { sellingPlanId: v.replace(/\D/g, "") })} autoComplete="off" helpText="Numeric selling plan id (or load the plans above)." />
                      )}
                      <TextField label="Delivery line (under the price)" value={cd.deliveryLine || ""} onChange={(v) => setCard(i, { deliveryLine: v })} autoComplete="off" />
                      <TextField label="Offer line (highlighted, under the delivery line)" value={cd.offerLine || ""} onChange={(v) => setCard(i, { offerLine: v })} autoComplete="off" />
                      <TextField label="Buy button text" value={cd.buttonLabel || ""} onChange={(v) => setCard(i, { buttonLabel: v })} autoComplete="off" placeholder={stickyDefaultBtn} helpText="Empty = the default subscription button wording (see Wording below)." />
                      <TextField label="Small print under the button" value={cd.belowButton || ""} onChange={(v) => setCard(i, { belowButton: v })} autoComplete="off" multiline={2} placeholder="e.g. Billed €54.15 every 2 months · cancel anytime" />
                      <TextField label="Checkmark lines" value={cd.checks || ""} onChange={(v) => setCard(i, { checks: v })} autoComplete="off" helpText="Separate with ' · '. Empty = shipping line + guarantee from Settings." />
                    </BlockStack>
                  </div>
                );
              })}
            </BlockStack>
          )}

          {/* --- section-level texts --- */}
          {pricing && (
            <BlockStack gap="150">
              <Text as="h4" variant="headingSm">Buy box texts</Text>
              <TextField label="Disclaimer under the buy box (subscription terms)" value={pricing.data.subscriptionTerms || ""} onChange={(v) => setPricing({ subscriptionTerms: v })} multiline={3} autoComplete="off" helpText="Recurring-payment disclosure shown under the cards: frequency, price per delivery, first-order price if different, how to cancel." />
              <TextField label="Line under the cards (footnote)" value={pricing.data.footnote || ""} onChange={(v) => setPricing({ footnote: v })} autoComplete="off" />
              <TextField label="Pricing heading" value={pricing.data.heading || ""} onChange={(v) => setPricing({ heading: v })} autoComplete="off" />
              <InlineStack gap="200" blockAlign="center">
                <Button size="slim" onClick={() => setShowWording((v) => !v)}>{showWording ? "Hide wording" : "Wording (per delivery, then, buttons…)"}</Button>
                <Text as="span" tone="subdued" variant="bodySm">The small words the price block uses — translatable like any text.</Text>
              </InlineStack>
              <Collapsible open={showWording} id="sub-wording">
                <BlockStack gap="100">
                  {WORDING.map((w) => (
                    <TextField key={w.key} label={w.label} value={pricing.data[w.key] || ""} onChange={(v) => setPricing({ [w.key]: v })} autoComplete="off" placeholder={w.def} />
                  ))}
                </BlockStack>
              </Collapsible>
            </BlockStack>
          )}

          {/* --- sticky bar --- */}
          <BlockStack gap="150">
            <Text as="h4" variant="headingSm">Sticky CTA bar (mobile)</Text>
            <TextField label="Bar text" value={content.stickyBar?.text || ""} onChange={(v) => setSticky({ text: v })} autoComplete="off" helpText="Stars are added automatically before the text." />
            <TextField label="Bar button text" value={content.stickyBar?.buttonLabel || ""} onChange={(v) => setSticky({ buttonLabel: v })} autoComplete="off" />
            <Text as="p" tone="subdued" variant="bodySm">Also in Page settings (with the visibility options). The FAQ items and the “Why subscribers…” row are normal sections — edit them in the section list.</Text>
          </BlockStack>
        </BlockStack>
      )}
    </BlockStack>
  );
}
