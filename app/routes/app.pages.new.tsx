import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useNavigate, useSearchParams } from "react-router";
import { Page, Card, Button, InlineStack, BlockStack, Text, Banner, TextField, Select, Checkbox, Badge, Divider, ProgressBar } from "@shopify/polaris";
import type { PageContent, ImageValue, FieldDef } from "../lib/types";
import { requireAdmin } from "../lib/auth.server";
import { listPages, getPage, getSettings, createPage, clonePageContent } from "../lib/pages.server";
import { slugify } from "../lib/slug";
import { SECTION_DEFS } from "../lib/sections/registry";
import { normalizePage } from "../lib/brand";
import prisma from "../db.server";
import { SectionForm, ImageField, type AiHelpers } from "../components/editor/SectionForm";
import type { ClientSectionDef, LibraryImage } from "../components/editor/types";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop, admin, devMode } = await requireAdmin(request);
  const url = new URL(request.url);
  const pages = await listPages(shop);
  const from = url.searchParams.get("from") || pages.find((p) => p.isTemplate)?.id || pages[0]?.id || null;
  const source = from ? await getPage(shop, from) : null;
  const { brand, secrets, defaults } = await getSettings(shop);
  const library = await prisma.imageAsset.findMany({ where: { shop }, orderBy: { createdAt: "desc" }, take: 80 });
  const defs: ClientSectionDef[] = SECTION_DEFS.map((d) => ({ type: d.type, label: d.label, description: d.description, icon: d.icon, category: d.category, singleton: d.singleton, fields: d.fields, defaults: d.defaults() }));
  return {
    devMode,
    pages: pages.map((p) => ({ id: p.id, title: p.title, isTemplate: p.isTemplate, productTitle: p.productTitle })),
    source: source ? { id: source.id, title: source.title, content: clonePageContent(source.draft) } : null,
    defs,
    library: library.map((l) => ({ id: l.id, url: l.url, alt: l.alt, source: l.source })) as LibraryImage[],
    discountDefaults: brand.discountDefaults,
    proxyPrefix: defaults.proxyPrefix,
    storeUrl: (brand.storeUrl || `https://${shop}`).replace(/\/$/, ""),
    aiAvailable: !!secrets.anthropicApiKey,
    imageAiAvailable: !!(secrets.higgsfieldKeyId && secrets.higgsfieldKeySecret) || !!secrets.anthropicApiKey,
    hasAdmin: !!admin,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await requireAdmin(request);
  const form = await request.formData();
  try {
    const content = normalizePage(JSON.parse(String(form.get("content") || "{}")));
    const title = String(form.get("title") || "New page");
    const slug = String(form.get("slug") || slugify(title));
    const page = await createPage(shop, { title, slug, content, productHandle: content.commerce.productHandle, productTitle: content.commerce.productTitle, status: "draft" });
    return { ok: true, redirect: `/app/pages/${page.id}` };
  } catch (e: any) {
    return { ok: false, message: e?.message || String(e) };
  }
};

const STEPS = ["Source & name", "Product & bundles", "Product-specific copy", "Images", "Review & create"];

export default function NewPageWizard() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const fetcher = useFetcher<typeof action>();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [content, setContent] = useState<PageContent | null>(data.source?.content ? { ...data.source.content, funnelLabel: "", notes: "" } : null);
  const [aiBrief, setAiBrief] = useState("");
  const [aiProgress, setAiProgress] = useState<{ done: number; total: number; current?: string; error?: string } | null>(null);
  const defs = useMemo(() => Object.fromEntries(data.defs.map((d) => [d.type, d])), [data.defs]);

  useEffect(() => { setContent(data.source?.content ? { ...data.source.content, funnelLabel: "", notes: "" } : null); }, [data.source?.id]);
  useEffect(() => { if (!slugTouched) setSlug(title.trim() ? slugify(title) : ""); }, [title, slugTouched]);
  useEffect(() => { const d = fetcher.data as any; if (d?.redirect) navigate(d.redirect); }, [fetcher.data, navigate]);

  const api = async (path: string, body: any) => {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || `Request failed (${res.status})`);
    return json;
  };
  const ai: AiHelpers = {
    aiAvailable: data.aiAvailable,
    imageAiAvailable: data.imageAiAvailable,
    library: data.library,
    generateImage: async ({ prompt, aspect, provider, alt }) => (await api("/api/ai", { action: "image", prompt, aspect, provider, alt })).image as ImageValue,
    uploadImage: async (file) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) throw new Error(json.error || "Upload failed");
      return json.image as ImageValue;
    },
    generateSectionCopy: async () => {},
  };

  if (!content) {
    return (
      <Page title="New page" backAction={{ content: "Pages", onAction: () => navigate("/app") }}>
        <Banner tone="warning"><p>No source page found. Create or re-seed the baseline pages first.</p></Banner>
      </Page>
    );
  }

  const c = content;
  const pricing = c.sections.find((s) => s.type === "pricing");
  const cards: any[] = pricing?.data?.cards || [];
  const setCommerce = (patch: Partial<PageContent["commerce"]>) => setContent({ ...c, commerce: { ...c.commerce, ...patch } });
  const setSectionData = (id: string, d: any) => setContent({ ...c, sections: c.sections.map((s) => (s.id === id ? { ...s, data: d } : s)) });
  const setCard = (i: number, patch: any) => pricing && setSectionData(pricing.id, { ...pricing.data, cards: cards.map((cd, k) => (k === i ? { ...cd, ...patch } : cd)) });
  const productSections = c.sections.filter((s) => defs[s.type]?.fields.some((f) => f.productSpecific));
  const shopifyBridge: any = typeof window !== "undefined" ? (window as any).shopify : null;

  // All image slots (product-specific fields + list item images)
  const imageSlots: Array<{ sectionId: string; label: string; get: () => ImageValue | undefined; set: (v: ImageValue | undefined) => void; field: FieldDef }> = [];
  for (const s of c.sections) {
    const def = defs[s.type];
    if (!def) continue;
    for (const f of def.fields) {
      if (f.type === "image") imageSlots.push({ sectionId: s.id, label: `${def.label} — ${f.label}`, field: f, get: () => s.data[f.key], set: (v) => setSectionData(s.id, { ...s.data, [f.key]: v }) });
      if (f.type === "list") {
        (s.data[f.key] || []).forEach((item: any, i: number) => {
          for (const sub of f.item || []) {
            if (sub.type === "image" && (sub.key === "image" || item?.[sub.key]?.src)) {
              imageSlots.push({ sectionId: s.id, label: `${def.label} — ${f.label} ${i + 1}${item?.title || item?.name || item?.label ? ` (${item.title || item.name || item.label})` : ""} — ${sub.label}`, field: sub, get: () => (s.data[f.key] || [])[i]?.[sub.key], set: (v) => setSectionData(s.id, { ...s.data, [f.key]: (s.data[f.key] || []).map((it: any, k: number) => (k === i ? { ...it, [sub.key]: v } : it)) }) });
            }
          }
        });
      }
    }
  }

  const pickProduct = async () => {
    let p: any = null;
    if (shopifyBridge?.resourcePicker) {
      const sel = await shopifyBridge.resourcePicker({ type: "product", multiple: false, filter: { variants: true } });
      p = sel?.[0];
    } else {
      const handle = prompt("Product handle:");
      if (!handle) return;
      try {
        p = (await api("/api/products", { action: "byHandle", handle })).product;
      } catch {
        p = { handle, title: handle, id: "", variants: [] };
      }
    }
    if (!p) return;
    const variants: Array<{ id: string; title: string }> = (p.variants || []).map((v: any) => ({ id: String(v.id).replace(/\D/g, ""), title: v.title }));
    const nextCards = cards.map((cd) => {
      const n = Number(cd.unitCount) || 1;
      const v = variants.find((x) => new RegExp(`^${n}\\b`).test(x.title)) || (n === 1 ? variants[0] : undefined);
      return v ? { ...cd, variantId: v.id, variantTitle: v.title } : cd;
    });
    const nextSections = pricing ? c.sections.map((s) => (s.id === pricing.id ? { ...s, data: { ...s.data, cards: nextCards } } : s)) : c.sections;
    setContent({ ...c, commerce: { ...c.commerce, productHandle: p.handle, productTitle: p.title, productId: p.id }, sections: nextSections });
    if (!title) setTitle(p.title);
  };

  const runAiForAll = async () => {
    const targets = productSections.filter((s) => s.type !== "pricing");
    setAiProgress({ done: 0, total: targets.length });
    let current = c;
    for (let i = 0; i < targets.length; i++) {
      const s = targets[i];
      const def = defs[s.type];
      setAiProgress({ done: i, total: targets.length, current: def.label });
      try {
        const r = await api("/api/ai", { action: "section-copy", sectionType: s.type, sectionLabel: def.label, fields: def.fields, currentData: s.data, brief: aiBrief, productName: current.commerce.productTitle });
        current = { ...current, sections: current.sections.map((x) => (x.id === s.id ? { ...x, data: r.data } : x)) };
        setContent(current);
      } catch (e: any) {
        setAiProgress({ done: i, total: targets.length, error: `${def.label}: ${e.message}` });
        return;
      }
    }
    setAiProgress({ done: targets.length, total: targets.length });
  };

  const canNext = step === 0 ? !!title.trim() && !!slug.trim() : true;

  return (
    <Page title="New page from template" subtitle="Copies the whole page, then walks you through swapping only the product-specific fields — everything shared (guarantee, purity, pillars, disclaimer) carries over automatically." backAction={{ content: "Pages", onAction: () => navigate("/app") }}>
      <BlockStack gap="400">
        <Card>
          <InlineStack gap="300" wrap>
            {STEPS.map((s, i) => (
              <span key={s} style={{ fontSize: 13, fontWeight: i === step ? 700 : 400, color: i === step ? "#1d1d1b" : i < step ? "#1e8e3e" : "#6d7175", cursor: i < step ? "pointer" : "default" }} onClick={() => i < step && setStep(i)}>
                {i < step ? "✓" : `${i + 1}.`} {s}
              </span>
            ))}
          </InlineStack>
        </Card>
        {(fetcher.data as any)?.ok === false && <Banner tone="critical"><p>{(fetcher.data as any).message}</p></Banner>}

        {step === 0 && (
          <Card>
            <BlockStack gap="300">
              <Select label="Copy from" options={data.pages.map((p) => ({ label: `${p.title}${p.isTemplate ? " (template)" : ""}${p.productTitle ? ` · ${p.productTitle}` : ""}`, value: p.id }))} value={data.source?.id || ""} onChange={(v) => { sp.set("from", v); setSp(sp); }} helpText="The master template is offered first. Any page can be a source." />
              <TextField label="New page title" value={title} onChange={setTitle} autoComplete="off" placeholder="Neck Cream — Turkey Neck" />
              <TextField label="URL slug" value={slug} onChange={(v) => { setSlug(v); setSlugTouched(true); }} autoComplete="off" prefix={`${data.proxyPrefix}/`} helpText={`Live URL will be ${data.storeUrl}${data.proxyPrefix}/${slug || "…"} — one URL per funnel keeps tracking clean.`} />
              <TextField label="Funnel label (internal)" value={c.funnelLabel || ""} onChange={(v) => setContent({ ...c, funnelLabel: v })} autoComplete="off" placeholder="Angle 4 · Neck (turkey neck)" />
            </BlockStack>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Which product and bundles do the pricing cards sell?</Text>
              <InlineStack gap="200" blockAlign="end">
                <div style={{ flex: 1 }}><TextField label="Product handle" value={c.commerce.productHandle} onChange={(v) => setCommerce({ productHandle: v })} autoComplete="off" /></div>
                <Button onClick={pickProduct}>Choose product</Button>
              </InlineStack>
              {c.commerce.productTitle && <Text as="p" tone="subdued">Selected: {c.commerce.productTitle}. Variants were mapped to the cards by unit count (1 / 2 / 3) — check below.</Text>}
              {cards.map((cd, i) => (
                <div className="ib-list-item" key={i}>
                  <BlockStack gap="150">
                    <Text as="span" fontWeight="semibold">Card {i + 1}: {cd.title} {cd.highlight && <Badge tone="info">highlighted</Badge>}</Text>
                    <InlineStack gap="200" blockAlign="end">
                      <div style={{ flex: 1 }}><TextField label="Variant ID" value={cd.variantId || ""} onChange={(v) => setCard(i, { variantId: v.replace(/\D/g, "") })} autoComplete="off" helpText={cd.variantTitle || ""} /></div>
                      <div style={{ width: 90 }}><TextField label="Qty" type="number" value={String(cd.quantity ?? 1)} onChange={(v) => setCard(i, { quantity: Math.max(1, Number(v) || 1) })} autoComplete="off" /></div>
                      <div style={{ width: 120 }}><TextField label="Units" type="number" value={String(cd.unitCount ?? 1)} onChange={(v) => setCard(i, { unitCount: Number(v) || 1 })} autoComplete="off" /></div>
                      <div style={{ width: 120 }}><TextField label="Unit label" value={cd.unitLabel || ""} onChange={(v) => setCard(i, { unitLabel: v })} autoComplete="off" /></div>
                    </InlineStack>
                    <InlineStack gap="200">
                      <div style={{ flex: 1 }}><TextField label="Price (manual)" value={cd.priceManual || ""} onChange={(v) => setCard(i, { priceManual: v })} autoComplete="off" /></div>
                      <div style={{ flex: 1 }}><TextField label="Compare-at (manual)" value={cd.compareManual || ""} onChange={(v) => setCard(i, { compareManual: v })} autoComplete="off" /></div>
                      <div style={{ flex: 1 }}><TextField label="Per-unit line" value={cd.perUnitManual || ""} onChange={(v) => setCard(i, { perUnitManual: v })} autoComplete="off" /></div>
                      <div style={{ flex: 1 }}><TextField label="You-save line" value={cd.saveManual || ""} onChange={(v) => setCard(i, { saveManual: v })} autoComplete="off" /></div>
                    </InlineStack>
                    {(cd.addOns || []).length > 0 && (
                      <Text as="p" variant="bodySm" tone="subdued">Free gift / add-ons carried over: {(cd.addOns || []).map((a: any) => `${a.label || a.variantId} ×${a.quantity}`).join(", ")} — edit in the Commerce tab after creation if needed.</Text>
                    )}
                  </BlockStack>
                </div>
              ))}
              <Divider />
              <Text as="h2" variant="headingMd">Discount code</Text>
              <Checkbox label="Apply a funnel discount code automatically" checked={c.commerce.discountEnabled} onChange={(v) => setCommerce({ discountEnabled: v })} helpText="Leave off to rely on the built-in bundle prices (your default 2-unit / 3-unit discounts)." />
              <InlineStack gap="200" blockAlign="end">
                <div style={{ flex: 1 }}><TextField label="Discount code" value={c.commerce.discountCode} onChange={(v) => setCommerce({ discountCode: v.toUpperCase().trim() })} autoComplete="off" placeholder="e.g. NECK20" /></div>
                {data.discountDefaults.threePack && <Button onClick={() => setCommerce({ discountCode: data.discountDefaults.threePack })}>Use default “{data.discountDefaults.threePack}”</Button>}
              </InlineStack>
              <Select label="Add-to-cart behaviour" options={[{ label: "Straight to checkout (cart permalink)", value: "checkout" }, { label: "Add to cart, open cart page", value: "cart" }]} value={c.commerce.checkoutMode} onChange={(v) => setCommerce({ checkoutMode: v as any })} />
            </BlockStack>
          </Card>
        )}

        {step === 2 && (
          <BlockStack gap="400">
            {data.aiAvailable && (
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">Optional: draft all product-specific copy with Claude</Text>
                  <TextField label="Brief" value={aiBrief} onChange={setAiBrief} multiline={4} autoComplete="off" placeholder="Product: Neck Tightening Cream. Angle: 'turkey neck' / crepey neck for women 55+. Mechanism: … Real numbers: 14,200 reviews. Keep the same structure and tone; keep the 90-day protocol logic." />
                  <InlineStack gap="200">
                    <Button variant="primary" disabled={!aiBrief.trim() || (aiProgress != null && aiProgress.done < aiProgress.total && !aiProgress.error)} onClick={runAiForAll}>{`Generate copy for ${productSections.filter((s) => s.type !== "pricing").length} sections`}</Button>
                    {aiProgress && <Text as="span" tone="subdued">{aiProgress.error ? aiProgress.error : `${aiProgress.done}/${aiProgress.total}${aiProgress.current ? ` — ${aiProgress.current}` : ""}`}</Text>}
                  </InlineStack>
                  {aiProgress && !aiProgress.error && <ProgressBar progress={aiProgress.total ? Math.round((aiProgress.done / aiProgress.total) * 100) : 0} size="small" tone="primary" />}
                  <Text as="p" tone="subdued" variant="bodySm">Then review every field below. Images are never changed by the copy generator.</Text>
                </BlockStack>
              </Card>
            )}
            {productSections.map((s) => (
              <Card key={s.id}>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">{defs[s.type].icon} {defs[s.type].label}</Text>
                  <SectionForm def={defs[s.type]} data={s.data} onChange={(d) => setSectionData(s.id, d)} ai={ai} filter="product" />
                </BlockStack>
              </Card>
            ))}
          </BlockStack>
        )}

        {step === 3 && (
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Images ({imageSlots.length} slots)</Text>
              <Text as="p" tone="subdued" variant="bodySm">Keep, upload, pick from the library or generate with AI. Product shots usually come from Shopify; before/after and lifestyle shots from your ad sheet; portraits can be generated in the same unretouched style.</Text>
              {imageSlots.map((slot, i) => (
                <div key={i}>
                  <ImageField field={{ ...slot.field, label: slot.label }} value={slot.get()} onChange={slot.set} ai={ai} />
                </div>
              ))}
            </BlockStack>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Review</Text>
              <div className="ib-kv">
                <div><Text as="span" tone="subdued">Title</Text><br /><b>{title}</b></div>
                <div><Text as="span" tone="subdued">URL</Text><br /><span className="ib-mono">{data.storeUrl}{data.proxyPrefix}/{slug}</span></div>
                <div><Text as="span" tone="subdued">Product</Text><br />{c.commerce.productTitle || c.commerce.productHandle || "—"}</div>
                <div><Text as="span" tone="subdued">Discount</Text><br />{c.commerce.discountEnabled ? c.commerce.discountCode || "(no code!)" : "off (built-in bundle prices)"}</div>
                <div><Text as="span" tone="subdued">Cards</Text><br />{cards.map((cd) => `${cd.title} → ${cd.variantId || "⚠ no variant"}${(cd.addOns || []).length ? " + gift" : ""}`).join(" · ")}</div>
                <div><Text as="span" tone="subdued">Sections</Text><br />{c.sections.filter((s) => !s.hidden).length} (disclaimer + sticky bar included)</div>
              </div>
              {cards.some((cd) => !cd.variantId) && <Banner tone="warning"><p>Some pricing cards have no variant yet — their buttons will scroll to the offer instead of adding to cart until you set one.</p></Banner>}
              <Text as="p" tone="subdued" variant="bodySm">The page is created as a draft. You can keep editing every field, preview on the store, and publish when ready.</Text>
              <InlineStack gap="200">
                <Button variant="primary" loading={fetcher.state !== "idle"} onClick={() => fetcher.submit({ content: JSON.stringify(c), title, slug }, { method: "post" })}>Create draft page</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        )}

        <InlineStack align="space-between">
          <Button disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
          {step < STEPS.length - 1 && <Button variant="primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Next: {STEPS[step + 1]}</Button>}
        </InlineStack>
      </BlockStack>
    </Page>
  );
}
