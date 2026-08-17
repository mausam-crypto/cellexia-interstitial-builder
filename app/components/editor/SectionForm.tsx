import { useState } from "react";
import { TextField, Select, Checkbox, Button, InlineStack, BlockStack, Text, Collapsible, Banner, Spinner } from "@shopify/polaris";
import type { FieldDef, ImageValue } from "../../lib/types";
import type { ClientSectionDef, LibraryImage } from "./types";

export interface AiHelpers {
  /** Generate/replace an image for a field. Returns the new ImageValue or null. */
  generateImage: (args: { prompt: string; aspect?: string; provider?: string; alt?: string }) => Promise<ImageValue | null>;
  uploadImage: (file: File) => Promise<ImageValue | null>;
  library: LibraryImage[];
  /** Regenerate the whole section's copy from a brief. */
  generateSectionCopy: (brief: string) => Promise<void>;
  aiAvailable: boolean;
  imageAiAvailable: boolean;
}

interface Props {
  def: ClientSectionDef;
  data: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
  ai: AiHelpers;
  /** which fields to show: "all" | "product" (product-specific only) */
  filter?: "all" | "product";
}

export function SectionForm({ def, data, onChange, ai, filter = "all" }: Props) {
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const fields = def.fields.filter((f) => !f.advanced && (filter === "all" || f.productSpecific));
  return (
    <div className="ib-form">
      <BlockStack gap="300">
        <Text as="p" tone="subdued" variant="bodySm">
          {def.description}
        </Text>
        {fields.map((f) => (
          <FieldInput key={f.key} field={f} value={data[f.key]} onChange={(v) => onChange({ ...data, [f.key]: v })} ai={ai} />
        ))}
        {ai.aiAvailable && filter === "all" && (
          <div style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>
            <BlockStack gap="200">
              <Text as="h4" variant="headingSm">
                Rewrite this section with Claude
              </Text>
              <TextField
                label="Brief"
                labelHidden
                value={brief}
                onChange={setBrief}
                multiline={2}
                autoComplete="off"
                placeholder="e.g. Same structure, but for the Neck Tightening Cream: sagging neck / turkey neck angle, women 55+, keep tone and length. Real numbers: 14,200 reviews."
              />
              <InlineStack gap="200">
                <Button
                  disabled={!brief.trim() || busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await ai.generateSectionCopy(brief);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "Generating…" : "Generate copy for this section"}
                </Button>
                {busy && <Spinner size="small" />}
              </InlineStack>
              <Text as="p" tone="subdued" variant="bodySm">
                Images are kept; only text fields are rewritten. Review before publishing — nothing is invented beyond your brief.
              </Text>
            </BlockStack>
          </div>
        )}
      </BlockStack>
    </div>
  );
}

export function FieldInput({ field, value, onChange, ai }: { field: FieldDef; value: any; onChange: (v: any) => void; ai: AiHelpers }) {
  const help = field.help;
  switch (field.type) {
    case "text":
    case "url":
      return <TextField label={field.label} value={value ?? ""} onChange={onChange} autoComplete="off" helpText={help} placeholder={field.placeholder} />;
    case "textarea":
      return <TextField label={field.label} value={value ?? ""} onChange={onChange} autoComplete="off" helpText={help} multiline={2} placeholder={field.placeholder} />;
    case "richtext":
      return (
        <TextField
          label={field.label}
          value={value ?? ""}
          onChange={onChange}
          autoComplete="off"
          multiline={5}
          helpText={help || "Blank line = new paragraph · **bold** · *italic* · lines starting with '- ' become bullets"}
          placeholder={field.placeholder}
        />
      );
    case "number":
      return <TextField label={field.label} type="number" value={value == null ? "" : String(value)} onChange={(v) => onChange(v === "" ? undefined : Number(v))} autoComplete="off" helpText={help} />;
    case "stars":
      return <Select label={field.label} options={[5, 4, 3, 2, 1].map((n) => ({ label: `${"★".repeat(n)}${"☆".repeat(5 - n)}`, value: String(n) }))} value={String(value ?? 5)} onChange={(v) => onChange(Number(v))} />;
    case "boolean":
      return <Checkbox label={field.label} checked={!!value} onChange={onChange} helpText={help} />;
    case "select":
      return <Select label={field.label} options={(field.options || []).map((o) => ({ label: o.label, value: o.value }))} value={value ?? field.options?.[0]?.value ?? ""} onChange={onChange} helpText={help} />;
    case "color":
      return (
        <InlineStack gap="200" blockAlign="end">
          <input type="color" value={value || "#000000"} onChange={(e) => onChange(e.target.value)} style={{ width: 40, height: 36, border: "1px solid #ddd", borderRadius: 6, padding: 0 }} />
          <div style={{ flex: 1 }}>
            <TextField label={field.label} value={value ?? ""} onChange={onChange} autoComplete="off" helpText={help} />
          </div>
        </InlineStack>
      );
    case "image":
      return <ImageField field={field} value={value} onChange={onChange} ai={ai} />;
    case "list":
      return <ListField field={field} value={Array.isArray(value) ? value : []} onChange={onChange} ai={ai} />;
    default:
      return null;
  }
}

function itemSummary(item: any, fields: FieldDef[]): string {
  const f = fields.find((x) => ["text", "textarea", "richtext"].includes(x.type) && item?.[x.key]);
  const s = f ? String(item[f.key]) : "";
  return s.length > 60 ? s.slice(0, 60) + "…" : s || "(empty)";
}

export function ListField({ field, value, onChange, ai }: { field: FieldDef; value: any[]; onChange: (v: any[]) => void; ai: AiHelpers }) {
  const [open, setOpen] = useState<number | null>(null);
  const item = field.item || [];
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = value.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    setOpen(j);
  };
  const emptyItem = () => Object.fromEntries(item.map((f) => [f.key, f.type === "boolean" ? false : f.type === "list" ? [] : f.type === "number" ? undefined : ""]));
  return (
    <div className="ib-field">
      <label className="ib-label">
        {field.label} <span style={{ color: "#6d7175", fontWeight: 400 }}>({value.length})</span>
      </label>
      {field.help && <div className="ib-help" style={{ marginBottom: 6 }}>{field.help}</div>}
      {value.map((it, i) => (
        <div className="ib-list-item" key={i}>
          <div className="ib-list-item__head" onClick={() => setOpen(open === i ? null : i)}>
            <span>
              {i + 1}. {itemSummary(it, item)}
            </span>
            <span className="ib-inline" onClick={(e) => e.stopPropagation()}>
              <button className="ib-icon-btn" title="Move up" onClick={() => move(i, -1)}>▲</button>
              <button className="ib-icon-btn" title="Move down" onClick={() => move(i, 1)}>▼</button>
              <button className="ib-icon-btn" title="Duplicate" onClick={() => { const next = value.slice(); next.splice(i + 1, 0, JSON.parse(JSON.stringify(it))); onChange(next); }}>⧉</button>
              <button className="ib-icon-btn" title="Remove" onClick={() => { if (field.minItems && value.length <= field.minItems) return; onChange(value.filter((_, k) => k !== i)); }}>✕</button>
              <button className="ib-icon-btn">{open === i ? "−" : "+"}</button>
            </span>
          </div>
          <Collapsible open={open === i} id={`li-${field.key}-${i}`}>
            <div className="ib-list-item__body">
              <BlockStack gap="200">
                {item.filter((f) => !f.advanced).map((f) => (
                  <FieldInput key={f.key} field={f} value={it?.[f.key]} onChange={(v) => { const next = value.slice(); next[i] = { ...it, [f.key]: v }; onChange(next); }} ai={ai} />
                ))}
              </BlockStack>
            </div>
          </Collapsible>
        </div>
      ))}
      {(!field.maxItems || value.length < field.maxItems) && (
        <Button size="slim" onClick={() => { onChange([...value, emptyItem()]); setOpen(value.length); }}>
          + Add {field.label.toLowerCase().replace(/s$/, "")}
        </Button>
      )}
    </div>
  );
}

export function ImageField({ field, value, onChange, ai }: { field: FieldDef; value: ImageValue | undefined; onChange: (v: ImageValue | undefined) => void; ai: AiHelpers }) {
  const [mode, setMode] = useState<"none" | "url" | "ai" | "library">("none");
  const [prompt, setPrompt] = useState(field.imagePrompt || "");
  const [provider, setProvider] = useState<string>("higgsfield");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const src = value?.src || "";
  return (
    <div className="ib-field">
      <label className="ib-label">{field.label}</label>
      <div className="ib-image">
        {src ? <img className="ib-image__thumb" src={src} alt="" /> : <div className="ib-image__thumb ib-image__thumb--empty">No image</div>}
        <div style={{ flex: 1 }}>
          <BlockStack gap="150">
            <InlineStack gap="150" wrap>
              <label className="Polaris-Button Polaris-Button--sizeSlim" style={{ cursor: "pointer" }}>
                <span className="Polaris-Button__Content">Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setBusy(true);
                    setErr(null);
                    try {
                      const r = await ai.uploadImage(f);
                      if (r) onChange({ ...(value || {}), ...r, alt: value?.alt || r.alt });
                    } catch (ex: any) {
                      setErr(ex?.message || String(ex));
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </label>
              <Button size="slim" onClick={() => setMode(mode === "url" ? "none" : "url")}>URL</Button>
              <Button size="slim" onClick={() => setMode(mode === "library" ? "none" : "library")}>Library</Button>
              {ai.imageAiAvailable && <Button size="slim" onClick={() => setMode(mode === "ai" ? "none" : "ai")}>Generate with AI</Button>}
              {src && <Button size="slim" tone="critical" variant="plain" onClick={() => onChange(undefined)}>Remove</Button>}
              {busy && <Spinner size="small" />}
            </InlineStack>
            {mode === "url" && <TextField label="Image URL" labelHidden value={src} onChange={(v) => onChange({ ...(value || {}), src: v })} autoComplete="off" placeholder="https://cdn.shopify.com/…" />}
            {mode === "library" && (
              <div className="ib-library">
                {ai.library.length === 0 && <Text as="span" tone="subdued">No images yet</Text>}
                {ai.library.map((im) => (
                  <img key={im.id} src={im.url} alt={im.alt || ""} title={im.alt || im.source} onClick={() => { onChange({ ...(value || {}), src: im.url, alt: value?.alt || im.alt || "" }); setMode("none"); }} />
                ))}
              </div>
            )}
            {mode === "ai" && (
              <BlockStack gap="150">
                <TextField label="Prompt" labelHidden value={prompt} onChange={setPrompt} multiline={3} autoComplete="off" helpText="Default prompt for this slot — edit freely. Brand style (unretouched, natural light…) is appended automatically." />
                <InlineStack gap="200" blockAlign="end">
                  <Select label="Provider" labelHidden options={[{ label: "Higgsfield (photo)", value: "higgsfield" }, { label: "Claude (SVG diagram)", value: "claude-svg" }]} value={provider} onChange={setProvider} />
                  <Button
                    variant="primary"
                    size="slim"
                    disabled={busy || !prompt.trim()}
                    onClick={async () => {
                      setBusy(true);
                      setErr(null);
                      try {
                        const r = await ai.generateImage({ prompt, aspect: field.imageAspect, provider, alt: value?.alt });
                        if (r) onChange({ ...(value || {}), ...r });
                      } catch (ex: any) {
                        setErr(ex?.message || String(ex));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {busy ? "Generating… (can take ~1 min)" : "Generate"}
                  </Button>
                </InlineStack>
              </BlockStack>
            )}
            <TextField label="Alt text" labelHidden placeholder="Alt text (accessibility / SEO)" value={value?.alt || ""} onChange={(v) => onChange({ ...(value || { src: "" }), alt: v })} autoComplete="off" />
            {value?.note && <div className="ib-help">{value.note}</div>}
            {err && <Banner tone="critical"><p>{err}</p></Banner>}
          </BlockStack>
        </div>
      </div>
    </div>
  );
}
