import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { Page, Layout, Card, TextField, Button, BlockStack, InlineStack, Text, Banner, Divider, Badge, Collapsible } from "@shopify/polaris";
import { requireAdmin } from "../lib/auth.server";
import { getSettings, saveBrand } from "../lib/pages.server";
import { SECTION_DEFS } from "../lib/sections/registry";
import { DEFAULT_PROMPTS, PROMPT_PLACEHOLDERS, slotHintKey, type PromptSettings } from "../lib/ai/prompt-defaults";

/**
 * Prompts — every prompt behind the one-click image pipeline, editable:
 *   1. the image-prompt writer's system prompt (trust / credibility / conversion rules)
 *   2. its user-message template (what Claude sees: product, direction, page copy, slots…)
 *   3. the SVG diagram system prompt (Claude draws diagram slots)
 *   4. the brand image style suffix (appended to every generated photo)
 *   5. per-slot default prompts (fallback prompt for a slot + shown to the writer as "hint")
 * Empty = built-in default. Stored in BrandSettings.prompts (+ ai.imageStyle).
 */

interface SlotHintRow {
  key: string;
  section: string;
  field: string;
  kind: "photo" | "diagram" | "skip";
  aspect: string;
  defaultHint: string;
}

function slotHintRows(): SlotHintRow[] {
  const rows: SlotHintRow[] = [];
  for (const d of SECTION_DEFS) {
    for (const f of d.fields) {
      if (f.type === "image") rows.push({ key: slotHintKey(d.type, f.key), section: d.label, field: f.label, kind: f.aiImage || "photo", aspect: f.imageAspect || "4:3", defaultHint: f.imagePrompt || "" });
      if (f.type === "list") for (const sf of f.item || []) if (sf.type === "image") rows.push({ key: slotHintKey(d.type, f.key, sf.key), section: d.label, field: `${f.label} → ${sf.label}`, kind: sf.aiImage || "photo", aspect: sf.imageAspect || "1:1", defaultHint: sf.imagePrompt || "" });
    }
  }
  return rows;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop } = await requireAdmin(request);
  const { brand } = await getSettings(shop);
  return { prompts: brand.prompts || {}, imageStyle: brand.ai.imageStyle, rows: slotHintRows(), defaults: DEFAULT_PROMPTS, placeholders: PROMPT_PLACEHOLDERS };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await requireAdmin(request);
  const form = await request.formData();
  try {
    const prompts = JSON.parse(String(form.get("prompts") || "{}")) as PromptSettings;
    const imageStyle = String(form.get("imageStyle") ?? "");
    const clean: PromptSettings = {
      imagePromptsSystem: String(prompts.imagePromptsSystem || "").trim() || undefined,
      imagePromptsUser: String(prompts.imagePromptsUser || "").trim() || undefined,
      svgSystem: String(prompts.svgSystem || "").trim() || undefined,
      slotHints: Object.fromEntries(Object.entries(prompts.slotHints || {}).map(([k, v]) => [k, String(v || "").trim()]).filter(([, v]) => v)),
    };
    const current = await getSettings(shop);
    await saveBrand(shop, { prompts: clean, ai: { ...current.brand.ai, imageStyle } });
    return { ok: true, message: "Prompts saved. They apply to the next “Write prompts” / generation run." };
  } catch (e: any) {
    return { ok: false, message: e?.message || String(e) };
  }
};

export default function PromptsPage() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [prompts, setPrompts] = useState<PromptSettings>({ ...data.prompts, slotHints: { ...(data.prompts.slotHints || {}) } });
  const [imageStyle, setImageStyle] = useState(data.imageStyle);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showHints, setShowHints] = useState(false);
  const busy = fetcher.state !== "idle";
  useEffect(() => {
    if (fetcher.data) setMsg({ ok: !!fetcher.data.ok, text: fetcher.data.message });
  }, [fetcher.data]);

  const set = (patch: Partial<PromptSettings>) => setPrompts((p) => ({ ...p, ...patch }));
  const setHint = (key: string, v: string) => setPrompts((p) => ({ ...p, slotHints: { ...(p.slotHints || {}), [key]: v } }));
  const customised = useMemo(() => Object.entries(prompts.slotHints || {}).filter(([, v]) => (v || "").trim()).length, [prompts.slotHints]);
  const rows = data.rows.filter((r) => r.kind !== "skip");
  const skipRows = data.rows.filter((r) => r.kind === "skip");

  const save = () => fetcher.submit({ prompts: JSON.stringify(prompts), imageStyle }, { method: "post" });

  const promptCard = (title: string, help: string, key: "imagePromptsSystem" | "imagePromptsUser" | "svgSystem", placeholders?: Array<{ name: string; help: string }>) => {
    const value = prompts[key] ?? "";
    const isCustom = !!(value || "").trim();
    return (
      <Card>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="200" blockAlign="center">
              <Text as="h2" variant="headingMd">{title}</Text>
              {isCustom ? <Badge tone="attention">Customised</Badge> : <Badge>Default</Badge>}
            </InlineStack>
            <InlineStack gap="200">
              {!isCustom && <Button size="slim" onClick={() => set({ [key]: data.defaults[key] })}>Edit (start from the default)</Button>}
              {isCustom && <Button size="slim" tone="critical" variant="plain" onClick={() => set({ [key]: "" })}>Reset to default</Button>}
            </InlineStack>
          </InlineStack>
          <Text as="p" tone="subdued" variant="bodySm">{help}</Text>
          {placeholders && (
            <Text as="p" tone="subdued" variant="bodySm">
              Placeholders: {placeholders.map((p) => `{{${p.name}}}`).join(", ")} — {placeholders.map((p) => `${p.name} = ${p.help}`).join("; ")}.
            </Text>
          )}
          <TextField label={title} labelHidden value={isCustom ? value : data.defaults[key]} onChange={(v) => set({ [key]: v })} multiline={isCustom ? 14 : 8} autoComplete="off" readOnly={!isCustom} helpText={isCustom ? "Empty the field (or Reset) to go back to the built-in default." : "Read-only until you click Edit."} />
        </BlockStack>
      </Card>
    );
  };

  return (
    <Page title="Prompts" subtitle="Everything Claude is told when it writes the image prompts for a page (Images tab → “Write prompts from the copy”) and when it draws diagram slots. Edit here; empty = built-in default.">
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {msg && <Banner tone={msg.ok ? "success" : "critical"} onDismiss={() => setMsg(null)}><p>{msg.text}</p></Banner>}
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">How the pieces fit</Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  1 · <b>Prompt-writer system prompt</b> = the rules (trust, credibility, cast, no fake before/after, composition, length). 2 · <b>Prompt-writer message template</b> = what Claude receives for a page: product, your direction, the page copy digest and the list of image slots (each with its default prompt as “hint” and the copy next to it). Claude answers with one prompt + alt per slot; those land on the slots and are what Higgsfield generates from — with 4 · the <b>brand image style</b> appended automatically. 3 · <b>Diagram system prompt</b> is used when a diagram slot is drawn as SVG. 5 · <b>Slot default prompts</b> are the per-slot fallback (used when no prompt was written) and are shown to the writer as the slot's hint.
                </Text>
              </BlockStack>
            </Card>

            {promptCard("1 · Prompt-writer system prompt", "The rules Claude follows for every image prompt of every page. Edit wording, add market/casting rules, tighten or loosen the trust rules.", "imagePromptsSystem")}
            {promptCard("2 · Prompt-writer message template", "The user message Claude receives for one page. Keep the placeholders you need — {{pageCopy}} and {{slots}} are essential; the schema (id/prompt/alt/provider) is enforced separately.", "imagePromptsUser", data.placeholders.imagePromptsUser)}
            {promptCard("3 · Diagram (SVG) system prompt", "Used when a diagram slot (e.g. the science section image) is drawn by Claude as SVG.", "svgSystem", data.placeholders.svgSystem)}

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">4 · Brand image style (appended to every generated photo)</Text>
                <Text as="p" tone="subdued" variant="bodySm">Same field as Settings → AI defaults → image style suffix. Every Higgsfield prompt becomes “&lt;prompt&gt;, &lt;this text&gt;”. The prompt writer is told not to repeat it.</Text>
                <TextField label="Image style suffix" labelHidden value={imageStyle} onChange={setImageStyle} multiline={2} autoComplete="off" />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="h2" variant="headingMd">5 · Slot default prompts</Text>
                    {customised ? <Badge tone="attention">{`${customised} customised`}</Badge> : <Badge>All default</Badge>}
                  </InlineStack>
                  <Button size="slim" onClick={() => setShowHints((v) => !v)}>{showHints ? "Hide" : `Show ${rows.length} slots`}</Button>
                </InlineStack>
                <Text as="p" tone="subdued" variant="bodySm">One per image slot type of the section library. Used as the slot's prompt when none was written yet, and passed to the prompt writer as “hint”. Leave empty to keep the built-in default (shown greyed).</Text>
                <Collapsible open={showHints} id="slot-hints">
                  <BlockStack gap="300">
                    {rows.map((r) => {
                      const v = prompts.slotHints?.[r.key] || "";
                      return (
                        <div key={r.key} className="ib-list-item">
                          <BlockStack gap="150">
                            <InlineStack gap="150" blockAlign="center" wrap>
                              <Text as="span" fontWeight="semibold" variant="bodySm">{r.section} — {r.field}</Text>
                              <Text as="span" tone="subdued" variant="bodySm">{r.aspect}</Text>
                              {r.kind === "diagram" ? <Badge tone="info">Diagram</Badge> : <Badge tone="success">Photo</Badge>}
                              {v.trim() ? <Badge tone="attention">Customised</Badge> : null}
                              {v.trim() && <Button size="slim" variant="plain" tone="critical" onClick={() => setHint(r.key, "")}>Reset</Button>}
                            </InlineStack>
                            <TextField label={r.key} labelHidden value={v} onChange={(x) => setHint(r.key, x)} multiline={2} autoComplete="off" placeholder={r.defaultHint ? `Default: ${r.defaultHint}` : "No default"} />
                          </BlockStack>
                        </div>
                      );
                    })}
                    {skipRows.length > 0 && (
                      <Text as="p" tone="subdued" variant="bodySm">Never auto-generated (no prompt needed): {skipRows.map((r) => `${r.section} — ${r.field}`).join(" · ")}</Text>
                    )}
                  </BlockStack>
                </Collapsible>
              </BlockStack>
            </Card>

            <Divider />
            <InlineStack gap="200" blockAlign="center">
              <Button variant="primary" loading={busy} onClick={save}>Save prompts</Button>
              <Text as="span" tone="subdued" variant="bodySm">Applies to the next “Write prompts” / generation run on any page. Prompts already written on a page's slots stay as they are until you write them again.</Text>
            </InlineStack>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
