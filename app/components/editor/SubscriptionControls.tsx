import { useState } from "react";
import { TextField, Select, Button, InlineStack, BlockStack, Text, Banner } from "@shopify/polaris";
import type { PageContent, SellingPlanInfo } from "../../lib/types";
import { applySubscriptionPresets, removeSubscriptionPresets, detectOfferType, offerLineFor, deliveryLineFor } from "../../lib/commerce/subscription";

export type LoadSellingPlans = (args: { handle: string; productId?: string }) => Promise<{ plans: SellingPlanInfo[] }>;

/**
 * Purchase mode + selling-plan wiring (native Shopify subscriptions). Shared by the Commerce tab and the wizard.
 * Switching to subscription applies the copy presets (button labels, delivery/offer lines, terms, FAQ items,
 * benefits row) and wires cards to plans; switching back removes what the presets added.
 */
export function SubscriptionControls({ content, onContent, apply, loadSellingPlans, compact }: { content: PageContent; onContent: (c: PageContent) => void; /** Functional update against the latest content (used after async loads). Falls back to onContent(fn(content)). */ apply?: (fn: (c: PageContent) => PageContent) => void; loadSellingPlans: LoadSellingPlans; compact?: boolean }) {
  const c = content.commerce;
  const applyFn = apply || ((fn: (x: PageContent) => PageContent) => onContent(fn(content)));
  const sub = c.subscription || { offerType: "simple" as const, unavailable: "one-time" as const, plans: [] as SellingPlanInfo[] };
  const plans = sub.plans || [];
  const pricing = content.sections.find((s) => s.type === "pricing");
  const cards: any[] = pricing?.data?.cards || [];
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isSub = c.purchaseMode === "subscription";
  const setSub = (patch: Partial<typeof sub>) => onContent({ ...content, commerce: { ...c, subscription: { ...sub, ...patch } } });
  const setCard = (i: number, patch: any) => {
    if (!pricing) return;
    onContent({ ...content, sections: content.sections.map((s) => (s.id === pricing.id ? { ...s, data: { ...s.data, cards: cards.map((cd, k) => (k === i ? { ...cd, ...patch } : cd)) } } : s)) });
  };
  const load = async () => {
    setErr(null);
    setBusy(true);
    try {
      const r = await loadSellingPlans({ handle: c.productHandle, productId: c.productId });
      const loaded = r.plans || [];
      if (!loaded.length) {
        // keep whatever was wired before; just record that Shopify has no plans for this product
        applyFn((latest) => ({ ...latest, commerce: { ...latest.commerce, subscription: { ...(latest.commerce.subscription || sub), plans: [] } } }));
        setErr("This product has no selling plans in Shopify. Create them in your subscription app first, then load again.");
        return;
      }
      const type = detectOfferType(loaded);
      // Functional: the page may have changed while the request was in flight (autosave, Images tab pool…).
      applyFn((latest) => {
        const latestCards: any[] = latest.sections.find((s) => s.type === "pricing")?.data?.cards || [];
        // Wire cards by position (card 1 → plan 1 …) unless already wired to one of the loaded plans.
        const cardPlans: Record<string, string> = {};
        latestCards.forEach((cd, i) => {
          const cur = String(cd.sellingPlanId || "").replace(/\D/g, "");
          cardPlans[String(i)] = loaded.some((p) => p.id === cur) ? cur : loaded[Math.min(i, loaded.length - 1)]?.id || "";
        });
        return applySubscriptionPresets({ ...latest, commerce: { ...latest.commerce, subscription: { ...(latest.commerce.subscription || sub), plans: loaded, offerType: type } } }, { plans: loaded, offerType: type, cardPlans });
      });
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };
  const reapplyDefaults = () => {
    // Clear preset-managed copy, then re-apply for the current offer type / plans.
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
          if (v === "subscription") onContent(applySubscriptionPresets(content, { plans }));
          else onContent(removeSubscriptionPresets(content));
        }}
        helpText={isSub ? "Every card sells a subscription: variant + selling plan (cards = delivery frequencies). Buttons add the line with its selling plan; live prices come from the plan; the copy presets were applied — edit anything in the sections." : "Switching to subscription applies the subscription copy presets (button labels, delivery/offer lines, terms, FAQ items, benefits row) and wires the cards to your product's selling plans."}
      />
      {isSub && (
        <BlockStack gap="200">
          <InlineStack gap="200" blockAlign="center" wrap>
            <Button onClick={load} loading={busy} disabled={!c.productHandle && !c.productId}>{plans.length ? "Reload selling plans" : "Load selling plans for this product"}</Button>
            <Text as="span" tone="subdued" variant="bodySm">{plans.length ? `${plans.length} plan(s) found in Shopify` : "Loads the subscription plans attached to the product (from your subscription app)."}</Text>
          </InlineStack>
          {err && <Banner tone="warning"><p>{err}</p></Banner>}
          {plans.length > 0 && (
            <div className="ib-list-item">
              <BlockStack gap="100">
                {plans.map((p) => (
                  <Text as="p" variant="bodySm" key={p.id}>• {planLabel(p)} <span style={{ color: "#8c9196" }}>(id {p.id})</span></Text>
                ))}
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
                helpText="The real discounts live in the selling plans; this only shapes the wording (offer lines, terms, FAQ)."
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
            <Text as="span" tone="subdued" variant="bodySm">Rewrites delivery/offer lines, terms, FAQ items, benefits row and button labels for the current offer type — use after changing the offer type or plans.</Text>
          </InlineStack>
          {missing > 0 && <Banner tone="critical"><p>{missing} card(s) have no selling plan — their button would sell a one-time purchase. Assign a plan to every card.</p></Banner>}
          {!compact && cards.length > 0 && (
            <BlockStack gap="150">
              <Text as="h4" variant="headingSm">Selling plan per card</Text>
              {cards.map((cd, i) => (
                <div className="ib-list-item" key={i}>
                  <BlockStack gap="100">
                    <Text as="span" fontWeight="semibold" variant="bodySm">Card {i + 1}: {cd.title || "(untitled)"}</Text>
                    {plans.length > 0 ? (
                      <Select
                        label="Selling plan"
                        labelHidden
                        options={[{ label: "— no plan (one-time!) —", value: "" }, ...plans.map((p) => ({ label: planLabel(p), value: p.id }))]}
                        value={plans.some((p) => p.id === String(cd.sellingPlanId || "")) ? String(cd.sellingPlanId) : ""}
                        onChange={(v) => {
                          const p = plans.find((x) => x.id === v);
                          setCard(i, { sellingPlanId: v, sellingPlanName: p ? planLabel(p) : "", deliveryLine: p ? deliveryLineFor(p) : cd.deliveryLine, offerLine: p ? offerLineFor(sub.offerType || "simple", p) : cd.offerLine });
                        }}
                      />
                    ) : (
                      <TextField label="Selling plan ID" value={cd.sellingPlanId || ""} onChange={(v) => setCard(i, { sellingPlanId: v.replace(/\D/g, "") })} autoComplete="off" helpText="Numeric selling plan id (or load the plans above)." />
                    )}
                    <TextField label="Delivery line" value={cd.deliveryLine || ""} onChange={(v) => setCard(i, { deliveryLine: v })} autoComplete="off" />
                    <TextField label="Offer line" value={cd.offerLine || ""} onChange={(v) => setCard(i, { offerLine: v })} autoComplete="off" />
                  </BlockStack>
                </div>
              ))}
              {pricing && (
                <TextField
                  label="Subscription terms (under the cards)"
                  value={pricing.data.subscriptionTerms || ""}
                  onChange={(v) => onContent({ ...content, sections: content.sections.map((s) => (s.id === pricing.id ? { ...s, data: { ...s.data, subscriptionTerms: v } } : s)) })}
                  multiline={3}
                  autoComplete="off"
                  helpText="Recurring-payment disclosure. Keep it honest and complete: frequency, price per delivery, first-order price if different, how to cancel."
                />
              )}
            </BlockStack>
          )}
        </BlockStack>
      )}
    </BlockStack>
  );
}
