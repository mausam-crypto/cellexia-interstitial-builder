import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { Page, Layout, Card, TextField, Select, Checkbox, Button, BlockStack, InlineStack, Text, Banner, Divider } from "@shopify/polaris";
import { requireAdmin } from "../lib/auth.server";
import { getSettings, saveBrand, saveSecrets, saveDefaults, recompileAll } from "../lib/pages.server";
import type { BrandSettings } from "../lib/types";
import { HIGGSFIELD_MODELS } from "../lib/integrations/higgsfield-models";
import { translateBrandStrings } from "../lib/integrations/translate.server";
import { fetchShopLocalesAndMarkets } from "../lib/shop-info.server";
import { ensureSeeded } from "../lib/seed/seed.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop, admin } = await requireAdmin(request);
  const s = await getSettings(shop);
  const { locales } = await fetchShopLocalesAndMarkets(admin);
  const mask = (v?: string) => (v ? `${v.slice(0, 4)}…${v.slice(-3)}` : "");
  return {
    shop,
    brand: s.brand,
    defaults: s.defaults,
    locales,
    keys: { anthropic: mask(s.secrets.anthropicApiKey), deepl: mask(s.secrets.deeplApiKey), deeplUrl: s.secrets.deeplApiUrl || "", higgsfieldId: mask(s.secrets.higgsfieldKeyId), higgsfieldSecret: mask(s.secrets.higgsfieldKeySecret) },
    seededAt: s.seededAt?.toISOString() || null,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, admin } = await requireAdmin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  try {
    if (intent === "brand") {
      const brand = JSON.parse(String(form.get("brand") || "{}")) as Partial<BrandSettings>;
      await saveBrand(shop, brand);
      const n = await recompileAll(shop);
      return { ok: true, message: `Brand settings saved · ${n} published page(s) recompiled` };
    }
    if (intent === "secrets") {
      const patch: any = {};
      for (const k of ["anthropicApiKey", "deeplApiKey", "deeplApiUrl", "higgsfieldKeyId", "higgsfieldKeySecret"]) {
        const v = form.get(k);
        if (v != null && String(v) !== "") patch[k] = String(v).trim();
        if (form.get(`clear_${k}`) === "1") patch[k] = "";
      }
      await saveSecrets(shop, patch);
      return { ok: true, message: "API keys saved (encrypted)" };
    }
    if (intent === "defaults") {
      await saveDefaults(shop, { proxyPrefix: String(form.get("proxyPrefix") || "/a/go"), storeDomain: String(form.get("storeDomain") || "") });
      const n = await recompileAll(shop);
      return { ok: true, message: `Defaults saved · ${n} page(s) recompiled` };
    }
    if (intent === "translate-brand") {
      const s = await getSettings(shop);
      const { locales } = await fetchShopLocalesAndMarkets(admin);
      const provider = String(form.get("provider") || "deepl") as "deepl" | "claude";
      const targets = locales.filter((l) => !l.primary).map((l) => l.locale);
      const t = await translateBrandStrings({ brand: s.brand, provider, secrets: s.secrets, model: s.brand.ai.claudeModel, sourceLocale: locales.find((l) => l.primary)?.locale || "en", targetLocales: targets });
      const merged = { ...s.brand.translations };
      for (const [loc, m] of Object.entries(t)) merged[loc] = { ...(merged[loc] || {}), ...m };
      await saveBrand(shop, { translations: merged });
      await recompileAll(shop);
      return { ok: true, message: `Brand strings translated into ${Object.keys(t).length} language(s)` };
    }
    if (intent === "reseed") {
      const r = await ensureSeeded(shop, { admin, force: true });
      return { ok: true, message: `Baseline pages re-seeded: ${r.pages.join(", ")} (drafts overwritten with the original copy)` };
    }
  } catch (e: any) {
    return { ok: false, message: e?.message || String(e) };
  }
  return { ok: false, message: "Unknown action" };
};

export default function Settings() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [brand, setBrand] = useState<BrandSettings>(data.brand);
  const [keys, setKeys] = useState({ anthropicApiKey: "", deeplApiKey: "", deeplApiUrl: data.keys.deeplUrl, higgsfieldKeyId: "", higgsfieldKeySecret: "" });
  const [defaults, setDefaults] = useState({ proxyPrefix: data.defaults.proxyPrefix, storeDomain: data.defaults.storeDomain || "" });
  const [msg, setMsg] = useState<any>(null);
  useEffect(() => { if (fetcher.data) setMsg(fetcher.data); }, [fetcher.data]);
  const set = (patch: Partial<BrandSettings>) => setBrand({ ...brand, ...patch });
  const busy = fetcher.state !== "idle";
  return (
    <Page title="Settings" subtitle="Global brand settings apply to every page — a policy change never means editing ten pages.">
      <Layout>
        {msg && (
          <Layout.Section>
            <Banner tone={msg.ok ? "success" : "critical"} onDismiss={() => setMsg(null)}><p>{msg.message}</p></Banner>
          </Layout.Section>
        )}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Brand & design</Text>
              <div className="ib-kv">
                <TextField label="Accent colour (CTA buttons)" value={brand.accentColor} onChange={(v) => set({ accentColor: v })} autoComplete="off" prefix={<span style={{ display: "inline-block", width: 14, height: 14, background: brand.accentColor, borderRadius: 3, border: "1px solid #ccc" }} />} />
                <TextField label="CTA text colour" value={brand.accentText} onChange={(v) => set({ accentText: v })} autoComplete="off" />
                <TextField label="Ink (headings / dark buttons)" value={brand.inkColor} onChange={(v) => set({ inkColor: v })} autoComplete="off" />
                <TextField label="Body text colour" value={brand.bodyColor} onChange={(v) => set({ bodyColor: v })} autoComplete="off" />
                <TextField label="Soft band background" value={brand.softBg} onChange={(v) => set({ softBg: v })} autoComplete="off" />
                <TextField label="Highlight background (offer/guarantee)" value={brand.highlightBg} onChange={(v) => set({ highlightBg: v })} autoComplete="off" />
                <Select label="CTA style" options={[{ label: "Accent pill with dark text (Glow25-style)", value: "accent" }, { label: "Dark pill with white text", value: "ink" }]} value={brand.ctaStyle} onChange={(v) => set({ ctaStyle: v as any })} />
                <TextField label="Button radius" value={brand.buttonRadius} onChange={(v) => set({ buttonRadius: v })} autoComplete="off" helpText="999px = pill, 6px = soft corners" />
                <TextField label="Heading font-family" value={brand.fontHeading} onChange={(v) => set({ fontHeading: v })} autoComplete="off" helpText="Fonts must be loaded by your theme (argumentum/Gobold are)." />
                <TextField label="Body font-family" value={brand.fontBody} onChange={(v) => set({ fontBody: v })} autoComplete="off" />
                <TextField label="Display font (numerals, eyebrows)" value={brand.fontDisplay} onChange={(v) => set({ fontDisplay: v })} autoComplete="off" />
                <Checkbox label="Full-bleed section bands (recommended)" checked={brand.fullBleed} onChange={(v) => set({ fullBleed: v })} />
              </div>
              <Divider />
              <Text as="h2" variant="headingMd">Global wording (used by every page)</Text>
              <div className="ib-kv">
                <TextField label="Guarantee days" type="number" value={String(brand.guaranteeDays)} onChange={(v) => set({ guaranteeDays: Number(v) || 0 })} autoComplete="off" />
                <TextField label="Guarantee (short)" value={brand.guaranteeShort} onChange={(v) => set({ guaranteeShort: v })} autoComplete="off" helpText="Announcement bar, pricing card checks." />
                <TextField label="Shipping line" value={brand.shippingLine} onChange={(v) => set({ shippingLine: v })} autoComplete="off" />
                <TextField label="Support email" value={brand.supportEmail} onChange={(v) => set({ supportEmail: v })} autoComplete="off" />
                <TextField label="Clinics claim" value={brand.clinicsClaim} onChange={(v) => set({ clinicsClaim: v })} autoComplete="off" />
                <TextField label="Store name" value={brand.storeName} onChange={(v) => set({ storeName: v })} autoComplete="off" />
                <TextField label="Store URL" value={brand.storeUrl} onChange={(v) => set({ storeUrl: v })} autoComplete="off" />
                <TextField label="Award seal image URL" value={brand.awardSealUrl || ""} onChange={(v) => set({ awardSealUrl: v })} autoComplete="off" helpText="Replace the placeholder seal with the official 2026 European Cosmetic Prize artwork." />
              </div>
              <TextField label="Disclaimer (always shown on every page — cannot be removed per page)" value={brand.disclaimer} onChange={(v) => set({ disclaimer: v })} autoComplete="off" multiline={3} />
              <TextField label="Payment icons (comma separated; shown by your theme footer)" value={brand.paymentIcons.join(", ")} onChange={(v) => set({ paymentIcons: v.split(",").map((s) => s.trim()).filter(Boolean) })} autoComplete="off" />
              <div className="ib-kv">
                <TextField label="Default 2-pack discount code" value={brand.discountDefaults.twoPack} onChange={(v) => set({ discountDefaults: { ...brand.discountDefaults, twoPack: v } })} autoComplete="off" helpText="Optional — offered in the wizard." />
                <TextField label="Default 3-pack discount code" value={brand.discountDefaults.threePack} onChange={(v) => set({ discountDefaults: { ...brand.discountDefaults, threePack: v } })} autoComplete="off" />
              </div>
              <Divider />
              <Text as="h2" variant="headingMd">AI defaults</Text>
              <div className="ib-kv">
                <Select label="Claude model" options={[{ label: "Claude Opus 5 (best quality)", value: "claude-opus-5" }, { label: "Claude Sonnet 5 (faster)", value: "claude-sonnet-5" }, { label: "Claude Haiku 4.5 (cheapest)", value: "claude-haiku-4-5" }]} value={brand.ai.claudeModel} onChange={(v) => set({ ai: { ...brand.ai, claudeModel: v } })} />
                <Select label="Higgsfield image model" options={HIGGSFIELD_MODELS.map((m) => ({ label: m.label, value: m.id }))} value={brand.ai.higgsfieldModel} onChange={(v) => set({ ai: { ...brand.ai, higgsfieldModel: v } })} />
              </div>
              <TextField label="Image style suffix (appended to every image prompt)" value={brand.ai.imageStyle} onChange={(v) => set({ ai: { ...brand.ai, imageStyle: v } })} autoComplete="off" multiline={2} />
              <InlineStack gap="200">
                <Button variant="primary" loading={busy} onClick={() => fetcher.submit({ intent: "brand", brand: JSON.stringify(brand) }, { method: "post" })}>Save brand settings</Button>
                <Text as="span" tone="subdued" variant="bodySm">Saving recompiles every published page.</Text>
              </InlineStack>
              <InlineStack gap="200">
                <Button onClick={() => fetcher.submit({ intent: "translate-brand", provider: "deepl" }, { method: "post" })} disabled={busy}>Translate global wording with DeepL</Button>
                <Button onClick={() => fetcher.submit({ intent: "translate-brand", provider: "claude" }, { method: "post" })} disabled={busy}>…with Claude</Button>
                <Text as="span" tone="subdued" variant="bodySm">Into: {data.locales.filter((l) => !l.primary).map((l) => l.locale).join(", ") || "—"}</Text>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">API keys</Text>
                <Text as="p" tone="subdued" variant="bodySm">Stored encrypted. Leave a field empty to keep the current key. Environment variables (ANTHROPIC_API_KEY, DEEPL_API_KEY, HIGGSFIELD_API_KEY_ID/SECRET) are used as fallbacks.</Text>
                <TextField label={`Anthropic (Claude) API key ${data.keys.anthropic ? `· current ${data.keys.anthropic}` : "· not set"}`} value={keys.anthropicApiKey} onChange={(v) => setKeys({ ...keys, anthropicApiKey: v })} autoComplete="off" type="password" />
                <TextField label={`DeepL API key ${data.keys.deepl ? `· current ${data.keys.deepl}` : "· not set"}`} value={keys.deeplApiKey} onChange={(v) => setKeys({ ...keys, deeplApiKey: v })} autoComplete="off" type="password" helpText="Free keys end with :fx and use api-free.deepl.com automatically." />
                <TextField label="DeepL API URL (optional)" value={keys.deeplApiUrl} onChange={(v) => setKeys({ ...keys, deeplApiUrl: v })} autoComplete="off" placeholder="https://api.deepl.com" />
                <TextField label={`Higgsfield API key id ${data.keys.higgsfieldId ? `· current ${data.keys.higgsfieldId}` : "· not set"}`} value={keys.higgsfieldKeyId} onChange={(v) => setKeys({ ...keys, higgsfieldKeyId: v })} autoComplete="off" type="password" />
                <TextField label={`Higgsfield API key secret ${data.keys.higgsfieldSecret ? `· current ${data.keys.higgsfieldSecret}` : "· not set"}`} value={keys.higgsfieldKeySecret} onChange={(v) => setKeys({ ...keys, higgsfieldKeySecret: v })} autoComplete="off" type="password" helpText="From cloud.higgsfield.ai → API keys." />
                <Button loading={busy} onClick={() => fetcher.submit({ intent: "secrets", ...keys }, { method: "post" })}>Save API keys</Button>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">URLs</Text>
                <TextField label="App proxy prefix" value={defaults.proxyPrefix} onChange={(v) => setDefaults({ ...defaults, proxyPrefix: v })} autoComplete="off" helpText="Must match shopify.app.toml ([app_proxy] prefix + subpath). Default /a/go." />
                <TextField label="Store domain (optional)" value={defaults.storeDomain} onChange={(v) => setDefaults({ ...defaults, storeDomain: v })} autoComplete="off" placeholder="cellexialabs.com" />
                <Button loading={busy} onClick={() => fetcher.submit({ intent: "defaults", ...defaults }, { method: "post" })}>Save</Button>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Baseline pages</Text>
                <Text as="p" tone="subdued" variant="bodySm">Seeded {data.seededAt ? new Date(data.seededAt).toLocaleString() : "—"}. Re-seeding overwrites the drafts of the three baseline pages (crepey-skin, jawline-ritual, dark-spots) with the original copy docs. Published versions are untouched until you publish again.</Text>
                <Button tone="critical" onClick={() => { if (confirm("Overwrite the three baseline drafts with the original copy?")) fetcher.submit({ intent: "reseed" }, { method: "post" }); }} disabled={busy}>Re-seed baseline pages</Button>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
