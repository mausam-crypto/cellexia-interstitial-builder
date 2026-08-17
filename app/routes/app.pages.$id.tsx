import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { Page, Button, Badge, InlineStack, Text, Banner, ButtonGroup, Modal, TextField, Select, Tooltip } from "@shopify/polaris";
import type { PageContent, SectionInstance, ImageValue } from "../lib/types";
import { requireAdmin } from "../lib/auth.server";
import { getPage, getSettings, saveDraft, publishPage, unpublishPage, deletePage, duplicatePage } from "../lib/pages.server";
import { SECTION_DEFS } from "../lib/sections/registry";
import { normalizePage } from "../lib/brand";
import { renderPage } from "../lib/render/render-page";
import { collectPageStrings } from "../lib/integrations/translate.server";
import prisma from "../db.server";
import { SectionForm, type AiHelpers } from "../components/editor/SectionForm";
import { SectionList, PageSettingsPanel, CommercePanel, TranslationsPanel } from "../components/editor/Panels";
import type { ClientSectionDef, LocaleInfo, MarketInfo, LibraryImage } from "../components/editor/types";
import { fetchShopLocalesAndMarkets } from "../lib/shop-info.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { shop, admin, devMode } = await requireAdmin(request);
  const page = await getPage(shop, params.id!);
  if (!page) throw new Response("Not found", { status: 404 });
  const { brand, defaults, secrets } = await getSettings(shop);
  const { locales, markets } = await fetchShopLocalesAndMarkets(admin);
  const library = await prisma.imageAsset.findMany({ where: { shop }, orderBy: { createdAt: "desc" }, take: 80 });
  const defs: ClientSectionDef[] = SECTION_DEFS.map((d) => ({ type: d.type, label: d.label, description: d.description, icon: d.icon, category: d.category, singleton: d.singleton, fields: d.fields, defaults: d.defaults() }));
  const storeUrl = (brand.storeUrl || `https://${defaults.storeDomain || shop}`).replace(/\/$/, "");
  const strings = collectPageStrings(page.draft).map(({ path, value }) => ({ path, value }));
  const liquid = renderPage({ page: page.draft, brand, pageId: page.id, slug: page.slug, mode: "liquid", proxyPath: defaults.proxyPrefix });
  return {
    shop,
    devMode,
    page: {
      id: page.id,
      title: page.title,
      slug: page.slug,
      status: page.status,
      isTemplate: page.isTemplate,
      previewToken: page.previewToken,
      hasUnpublishedChanges: page.hasUnpublishedChanges,
      publishedAt: page.publishedAt?.toISOString() || null,
      draft: page.draft,
    },
    defs,
    locales,
    markets,
    library: library.map((l) => ({ id: l.id, url: l.url, alt: l.alt, source: l.source })) as LibraryImage[],
    storeUrl,
    proxyPrefix: defaults.proxyPrefix,
    disclaimerDefault: brand.disclaimer,
    discountDefaults: brand.discountDefaults,
    strings,
    liquidBytes: liquid.bytes,
    liquidWarnings: liquid.warnings,
    aiAvailable: !!secrets.anthropicApiKey,
    deeplAvailable: !!secrets.deeplApiKey,
    imageAiAvailable: !!(secrets.higgsfieldKeyId && secrets.higgsfieldKeySecret) || !!secrets.anthropicApiKey,
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { shop } = await requireAdmin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  const id = params.id!;
  try {
    if (intent === "save") {
      const content = normalizePage(JSON.parse(String(form.get("content") || "{}")));
      const title = form.get("title") != null ? String(form.get("title")) : undefined;
      const slug = form.get("slug") != null ? String(form.get("slug")) : undefined;
      const isTemplate = form.get("isTemplate") != null ? String(form.get("isTemplate")) === "true" : undefined;
      const saved = await saveDraft(shop, id, { content, title, slug, isTemplate, productHandle: content.commerce.productHandle || null, productTitle: content.commerce.productTitle || null });
      const strings = collectPageStrings(saved.draft).map(({ path, value }) => ({ path, value }));
      return { ok: true, intent, savedAt: new Date().toISOString(), slug: saved.slug, strings };
    }
    if (intent === "publish") {
      const r = await publishPage(shop, id);
      return { ok: true, intent, message: `Published · ${(r.bytes / 1024).toFixed(0)} KB Liquid`, warnings: r.warnings, status: "published" };
    }
    if (intent === "unpublish") {
      await unpublishPage(shop, id);
      return { ok: true, intent, message: "Unpublished", status: "draft" };
    }
    if (intent === "delete") {
      await deletePage(shop, id);
      return { ok: true, intent, redirect: "/app" };
    }
    if (intent === "duplicate") {
      const p = await duplicatePage(shop, id, { title: String(form.get("title") || "Copy") });
      return { ok: true, intent, redirect: `/app/pages/${p.id}` };
    }
  } catch (e: any) {
    return { ok: false, intent, message: e?.message || String(e) };
  }
  return { ok: false, intent, message: "Unknown action" };
};

type Tab = "sections" | "page" | "commerce" | "translations";

export default function PageEditor() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const saver = useFetcher<typeof action>();
  const publisher = useFetcher<typeof action>();
  const [title, setTitle] = useState(data.page.title);
  const [slug, setSlug] = useState(data.page.slug);
  const [isTemplate, setIsTemplate] = useState(data.page.isTemplate);
  const [content, setContent] = useState<PageContent>(data.page.draft as PageContent);
  const [status, setStatus] = useState(data.page.status);
  const [selected, setSelected] = useState<string | null>(data.page.draft.sections[1]?.id || data.page.draft.sections[0]?.id || null);
  const [tab, setTab] = useState<Tab>("sections");
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [previewLocale, setPreviewLocale] = useState<string>("");
  const [previewMarket, setPreviewMarket] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [previewKey, setPreviewKey] = useState(0);
  const [strings, setStrings] = useState(data.strings);
  const [dupOpen, setDupOpen] = useState(false);
  const [dupTitle, setDupTitle] = useState(`${data.page.title} (copy)`);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "critical" | "warning"; text: string; list?: string[] } | null>(null);
  const defs = useMemo(() => Object.fromEntries(data.defs.map((d) => [d.type, d])), [data.defs]);
  const timer = useRef<any>(null);
  const contentRef = useRef(content);
  contentRef.current = content;

  // ---- autosave (debounced) ----
  const doSave = useCallback(() => {
    setSaveState("saving");
    saver.submit({ intent: "save", content: JSON.stringify(contentRef.current), title, slug, isTemplate: String(isTemplate) }, { method: "post" });
  }, [saver, title, slug, isTemplate]);

  useEffect(() => {
    if (!dirty) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(doSave, 900);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, title, slug, isTemplate, dirty]);

  useEffect(() => {
    const d = saver.data as any;
    if (!d) return;
    if (d.ok && d.intent === "save") {
      setSaveState("saved");
      setDirty(false);
      if (d.slug && d.slug !== slug) setSlug(d.slug);
      if (d.strings) setStrings(d.strings);
      setPreviewKey((k) => k + 1);
    } else if (d.ok === false) {
      setSaveState("error");
      setMsg({ tone: "critical", text: d.message });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saver.data]);

  useEffect(() => {
    const d = publisher.data as any;
    if (!d) return;
    if (d.redirect) navigate(d.redirect);
    if (d.status) setStatus(d.status);
    if (d.message) setMsg({ tone: d.ok ? (d.warnings?.length ? "warning" : "success") : "critical", text: d.message, list: d.warnings });
  }, [publisher.data, navigate]);

  const update = (next: PageContent) => {
    setContent(next);
    setDirty(true);
  };
  const updateSections = (sections: SectionInstance[]) => update({ ...content, sections });
  const selectedSection = content.sections.find((s) => s.id === selected) || null;

  // ---- warn on unload with unsaved changes ----
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty || saveState === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty, saveState]);

  // ---- API helpers used by fields ----
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
    generateImage: async ({ prompt, aspect, provider, alt }) => {
      const r = await api("/api/ai", { action: "image", prompt, aspect, provider, alt });
      return r.image as ImageValue;
    },
    uploadImage: async (file) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) throw new Error(json.error || "Upload failed");
      return json.image as ImageValue;
    },
    generateSectionCopy: async (brief) => {
      if (!selectedSection) return;
      const def = defs[selectedSection.type];
      const r = await api("/api/ai", { action: "section-copy", sectionType: selectedSection.type, sectionLabel: def.label, fields: def.fields, currentData: selectedSection.data, brief, productName: content.commerce.productTitle });
      updateSections(content.sections.map((s) => (s.id === selectedSection.id ? { ...s, data: r.data } : s)));
    },
  };
  const shopifyBridge: any = typeof window !== "undefined" ? (window as any).shopify : null;
  const pickProduct = async () => {
    if (shopifyBridge?.resourcePicker) {
      const sel = await shopifyBridge.resourcePicker({ type: "product", multiple: false, filter: { variants: true } });
      const p = sel?.[0];
      if (!p) return null;
      return { handle: p.handle, title: p.title, id: p.id, variants: (p.variants || []).map((v: any) => ({ id: v.id, title: v.title, price: v.price })) };
    }
    const handle = prompt("Product handle (e.g. body-wrinkle-cream):");
    if (!handle) return null;
    try {
      const r = await api("/api/products", { action: "byHandle", handle });
      return r.product;
    } catch {
      return { handle, title: handle, id: "", variants: [] };
    }
  };
  const pickVariant = async (cardIndex: number) => {
    if (shopifyBridge?.resourcePicker) {
      const sel = await shopifyBridge.resourcePicker({ type: "variant", multiple: false });
      const v = sel?.[0];
      if (!v) return null;
      return { id: v.id, title: `${v.product?.title ? v.product.title + " — " : ""}${v.title}`, productHandle: v.product?.handle };
    }
    const id = prompt(`Variant ID for card ${cardIndex + 1}:`);
    return id ? { id, title: "" } : null;
  };
  const checkDiscount = async (code: string) => {
    try {
      return await api("/api/products", { action: "checkDiscount", code });
    } catch (e: any) {
      return { exists: false, error: e.message };
    }
  };
  const translate = async (args: { provider: "deepl" | "claude"; targetLocales: string[]; onlyMissing: boolean }) => {
    try {
      const r = await api("/api/ai", { action: "translate-page", pageId: data.page.id, content, ...args });
      return { ok: true, message: r.message, content: r.content };
    } catch (e: any) {
      return { ok: false, message: `Translation failed: ${e.message}` };
    }
  };

  const previewUrl = `/preview/${data.page.id}?token=${data.page.previewToken}&device=${device}${previewLocale ? `&locale=${previewLocale}` : ""}${previewMarket ? `&market=${previewMarket}` : ""}&k=${previewKey}`;
  const liveUrl = `${data.storeUrl}${data.proxyPrefix}/${slug}`;
  const storePreviewUrl = `${liveUrl}?_preview=${data.page.previewToken}`;
  const kb = (data.liquidBytes / 1024).toFixed(0);

  return (
    <Page
      fullWidth
      backAction={{ content: "Pages", onAction: () => navigate("/app") }}
      title={title}
      titleMetadata={
        <InlineStack gap="150">
          {status === "published" ? <Badge tone="success">Live</Badge> : <Badge>Draft</Badge>}
          {isTemplate && <Badge tone="info">Template</Badge>}
          <span className="ib-status">{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : dirty ? "Unsaved" : ""}</span>
        </InlineStack>
      }
      primaryAction={{
        content: status === "published" ? "Publish changes" : "Publish",
        onAction: () => {
          clearTimeout(timer.current);
          if (dirty || saveState === "saving") doSave();
          setTimeout(() => publisher.submit({ intent: "publish" }, { method: "post" }), dirty ? 700 : 0);
        },
        loading: publisher.state !== "idle",
      }}
      secondaryActions={[
        { content: "Preview on store", url: storePreviewUrl, external: true },
        { content: "Open live URL", url: liveUrl, external: true, disabled: status !== "published" },
        { content: "Duplicate", onAction: () => setDupOpen(true) },
        ...(status === "published" ? [{ content: "Unpublish", destructive: true, onAction: () => publisher.submit({ intent: "unpublish" }, { method: "post" }) }] : []),
        { content: "Delete", destructive: true, onAction: () => setConfirmDelete(true) },
      ]}
    >
      {msg && (
        <div style={{ marginBottom: 12 }}>
          <Banner tone={msg.tone} onDismiss={() => setMsg(null)}>
            <p>{msg.text}</p>
            {msg.list?.length ? <ul>{msg.list.map((w) => <li key={w}>{w}</li>)}</ul> : null}
          </Banner>
        </div>
      )}
      {data.devMode && (
        <div style={{ marginBottom: 12 }}>
          <Banner tone="info"><p>Dev mode (BUILDER_DEV_SHOP): no Shopify session — product picker and uploads use fallbacks.</p></Banner>
        </div>
      )}
      <div className="ib-editor">
        {/* LEFT: section list */}
        <div className="ib-col">
          <div className="ib-col__head">
            <span>Sections ({content.sections.filter((s) => !s.hidden).length})</span>
            <Tooltip content="Compiled Liquid size of the whole page. Shopify's limit per Liquid file is 256 KB.">
              <span className="ib-status">{kb} KB</span>
            </Tooltip>
          </div>
          <SectionList sections={content.sections} defs={defs} selected={tab === "sections" ? selected : null} onSelect={(id) => { setSelected(id); setTab("sections"); }} onChange={updateSections} />
        </div>

        {/* MIDDLE: form */}
        <div className="ib-col ib-col--form">
          <div className="ib-tabs">
            {(["sections", "page", "commerce", "translations"] as Tab[]).map((t) => (
              <button key={t} className={`ib-tab${tab === t ? " is-active" : ""}`} onClick={() => setTab(t)}>
                {t === "sections" ? "Section" : t === "page" ? "Page settings" : t === "commerce" ? "Commerce" : "Translations"}
              </button>
            ))}
          </div>
          {tab === "sections" &&
            (selectedSection && defs[selectedSection.type] ? (
              <>
                <div className="ib-col__head">
                  <span>{defs[selectedSection.type].icon} {defs[selectedSection.type].label}</span>
                  {selectedSection.hidden && <Badge>Hidden</Badge>}
                </div>
                <SectionForm key={selectedSection.id} def={defs[selectedSection.type]} data={selectedSection.data} onChange={(d) => updateSections(content.sections.map((s) => (s.id === selectedSection.id ? { ...s, data: d } : s)))} ai={ai} />
              </>
            ) : (
              <div className="ib-form">
                <Text as="p" tone="subdued">Select a section on the left to edit it.</Text>
              </div>
            ))}
          {tab === "page" && <PageSettingsPanel title={title} slug={slug} content={content} isTemplate={isTemplate} onMeta={(m) => { if (m.title !== undefined) setTitle(m.title); if (m.slug !== undefined) setSlug(m.slug); if (m.isTemplate !== undefined) setIsTemplate(m.isTemplate); setDirty(true); }} onContent={update} storeUrl={data.storeUrl} proxyPrefix={data.proxyPrefix} disclaimerDefault={data.disclaimerDefault} />}
          {tab === "commerce" && <CommercePanel content={content} onContent={update} markets={data.markets as MarketInfo[]} pickProduct={pickProduct} pickVariant={pickVariant} checkDiscount={checkDiscount} discountDefaults={data.discountDefaults} />}
          {tab === "translations" && <TranslationsPanel content={content} onContent={update} locales={data.locales as LocaleInfo[]} strings={strings} translate={translate} aiAvailable={data.aiAvailable} deeplAvailable={data.deeplAvailable} />}
        </div>

        {/* RIGHT: preview */}
        <div className="ib-col ib-editor__preview">
          <div className="ib-preview__bar">
            <ButtonGroup variant="segmented">
              <Button pressed={device === "mobile"} onClick={() => setDevice("mobile")} size="slim">Mobile</Button>
              <Button pressed={device === "desktop"} onClick={() => setDevice("desktop")} size="slim">Desktop</Button>
            </ButtonGroup>
            <InlineStack gap="150" blockAlign="center">
              {data.locales.length > 1 && (
                <Select label="Locale" labelHidden options={[{ label: "Source language", value: "" }, ...data.locales.filter((l) => !l.primary).map((l) => ({ label: l.name || l.locale, value: l.locale }))]} value={previewLocale} onChange={setPreviewLocale} />
              )}
              {data.markets.length > 0 && (
                <Select label="Market" labelHidden options={[{ label: "Default market", value: "" }, ...data.markets.map((m) => ({ label: m.name, value: m.code }))]} value={previewMarket} onChange={setPreviewMarket} />
              )}
              <Button size="slim" onClick={() => setPreviewKey((k) => k + 1)}>Refresh</Button>
              <Button size="slim" url={previewUrl} target="_blank">Open</Button>
            </InlineStack>
          </div>
          <div className={`ib-preview${device === "mobile" ? " is-mobile" : ""}`}>
            <iframe key={previewKey} title="Preview" src={previewUrl} />
          </div>
          <div style={{ padding: "6px 10px", fontSize: 12, color: "#6d7175" }}>
            Preview uses a neutral stand-in header/footer and the manual prices. “Preview on store” shows the draft inside your real theme with live prices.
          </div>
        </div>
      </div>

      <Modal open={dupOpen} onClose={() => setDupOpen(false)} title="Duplicate this page" primaryAction={{ content: "Duplicate", onAction: () => { publisher.submit({ intent: "duplicate", title: dupTitle }, { method: "post" }); setDupOpen(false); } }} secondaryActions={[{ content: "Use the guided wizard", onAction: () => navigate(`/app/pages/new?from=${data.page.id}`) }]}>
        <Modal.Section>
          <TextField label="New page title" value={dupTitle} onChange={setDupTitle} autoComplete="off" />
        </Modal.Section>
      </Modal>
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this page?" primaryAction={{ content: "Delete", destructive: true, onAction: () => publisher.submit({ intent: "delete" }, { method: "post" }) }} secondaryActions={[{ content: "Cancel", onAction: () => setConfirmDelete(false) }]}>
        <Modal.Section>
          <Text as="p">The page, its analytics and its URL are removed. This cannot be undone.</Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
