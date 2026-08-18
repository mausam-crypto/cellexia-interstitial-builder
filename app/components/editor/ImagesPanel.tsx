import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Banner, BlockStack, Button, Checkbox, InlineStack, ProgressBar, Select, Text, TextField } from "@shopify/polaris";
import type { ImageValue, PageContent } from "../../lib/types";
import { applyImagePrompts, collectImageSlots, generatableSlots, getSlotValue, setSlotValue, slotPrompt, slotProvider, type ImageSlot, type SlotDefs } from "../../lib/images/slots";
import type { AiHelpers } from "./SectionForm";

/**
 * "Images" panel — the one-click image pipeline for a whole page:
 *   1. Claude writes one optimised prompt per image slot from the page's copy (trust / credibility / conversion rules)
 *   2. Higgsfield (photos) / Claude (diagrams) generate every slot, 3 at a time, results land in the page as they arrive
 * Prompts are stored on the image value (editable here and in each section's "Generate with AI" box).
 */

type SlotState = { state: "idle" | "queued" | "generating" | "done" | "error"; error?: string };
const CONCURRENCY = 3;

export function ImagesPanel({
  content,
  apply,
  defs,
  ai,
  productName,
  initialBrief,
  compact,
}: {
  content: PageContent;
  /** Functional update against the latest content (safe while several generations finish concurrently). */
  apply: (fn: (c: PageContent) => PageContent) => void;
  defs: SlotDefs;
  ai: AiHelpers;
  productName?: string;
  initialBrief?: string;
  /** Wizard: tighter layout. */
  compact?: boolean;
}) {
  const contentRef = useRef(content);
  contentRef.current = content;
  const photoOk = ai.photoAiAvailable ?? ai.imageAiAvailable;
  const slots = useMemo(() => collectImageSlots(content, defs), [content, defs]);
  const gen = useMemo(() => generatableSlots(slots), [slots]);
  const skipped = useMemo(() => slots.filter((s) => s.kind === "skip"), [slots]);
  const [brief, setBrief] = useState(initialBrief || "");
  const [scope, setScope] = useState<"empty" | "all">("empty");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Record<string, SlotState>>({});
  const [running, setRunning] = useState<"prompts" | "images" | null>(null);
  const [cast, setCast] = useState<string>("");
  const [msg, setMsg] = useState<{ tone: "success" | "critical" | "warning" | "info"; text: string } | null>(null);
  const cancelRef = useRef(false);
  // Real unmount (navigating away): stop the pool — anything already generated has been applied.
  useEffect(() => () => { cancelRef.current = true; }, []);

  const withPrompt = gen.filter((s) => (s.value?.prompt || "").trim());
  const empty = gen.filter((s) => !s.value?.src);
  const targets = (scope === "empty" ? empty : gen).filter((s) => !excluded.has(s.id));
  const done = Object.values(status).filter((s) => s.state === "done").length;
  const errors = Object.values(status).filter((s) => s.state === "error").length;
  const total = Object.keys(status).length;

  const setSlotState = (id: string, st: SlotState) => setStatus((prev) => ({ ...prev, [id]: st }));
  const setPrompt = (slot: ImageSlot, prompt: string) =>
    apply((c) => {
      const cur = getSlotValue(c, slot, defs);
      return setSlotValue(c, slot, { ...(cur || { src: "" }), src: cur?.src || "", prompt }, defs);
    });

  // ---- 1. prompts ----
  const writePrompts = async (): Promise<boolean> => {
    setMsg(null);
    setRunning("prompts");
    try {
      const r = await ai.writeImagePrompts(contentRef.current, brief);
      apply((c) => ({
        ...applyImagePrompts(c, collectImageSlots(c, defs), r.prompts, defs).content,
        imagePlan: { cast: r.cast || c.imagePlan?.cast || "", brief: brief || undefined, writtenAt: new Date().toISOString() },
      }));
      setCast(r.cast || "");
      setMsg({ tone: "success", text: `${r.prompts.length} prompt(s) written from the page copy. Review or edit them below, then generate.` });
      return true;
    } catch (e: any) {
      setMsg({ tone: "critical", text: e?.message || String(e) });
      return false;
    } finally {
      setRunning(null);
    }
  };

  // ---- 2. images (pool of CONCURRENCY) ----
  const generate = async (list: ImageSlot[]) => {
    if (running) return;
    const queue = list.filter((s) => slotPrompt(s, getSlotValue(contentRef.current, s, defs))).filter((s) => (slotProvider(s, getSlotValue(contentRef.current, s, defs)) === "higgsfield" ? photoOk : ai.aiAvailable));
    if (!queue.length) {
      setMsg({ tone: "warning", text: "Nothing to generate — write the prompts first (button 1) or select slots that have a prompt." });
      return;
    }
    setMsg(null);
    cancelRef.current = false;
    setRunning("images");
    setStatus(Object.fromEntries(queue.map((s) => [s.id, { state: "queued" as const }])));
    let active = 0;
    await new Promise<void>((resolve) => {
      const pump = () => {
        if ((cancelRef.current || !queue.length) && active === 0) return resolve();
        while (!cancelRef.current && active < CONCURRENCY && queue.length) {
          const slot = queue.shift()!;
          active++;
          setSlotState(slot.id, { state: "generating" });
          const cur = getSlotValue(contentRef.current, slot, defs);
          const prompt = slotPrompt(slot, cur);
          const provider = slotProvider(slot, cur);
          const alt = (cur?.promptAlt || "").trim() || undefined; // the alt written for THIS prompt (else provider derives one)
          ai.generateImage({ prompt, aspect: slot.aspect, provider, alt })
            .then((r) => {
              if (r) {
                apply((c) => {
                  const now = getSlotValue(c, slot, defs);
                  const v: ImageValue = { ...(now || { src: "" }), ...r, prompt, provider, alt: alt || r.alt };
                  return setSlotValue(c, slot, v, defs);
                });
              }
              setSlotState(slot.id, { state: "done" });
            })
            .catch((e: any) => setSlotState(slot.id, { state: "error", error: e?.message || String(e) }))
            .finally(() => {
              active--;
              pump();
            });
        }
      };
      pump();
    });
    setRunning(null);
    setMsg(cancelRef.current ? { tone: "warning", text: "Stopped. Images already generated were kept." } : { tone: "success", text: "Done — check the images below and in the preview. Failed slots can be retried individually." });
  };

  const writeAndGenerate = async () => {
    if (running) return;
    const ok = await writePrompts();
    if (!ok) return;
    // wait one tick so the applied prompts are in the latest content, then read fresh slots
    await new Promise((r) => setTimeout(r, 50));
    const fresh = generatableSlots(collectImageSlots(contentRef.current, defs)).filter((s) => !excluded.has(s.id) && (scope === "all" || !s.value?.src));
    await generate(fresh);
  };

  const kindBadge = (k: ImageSlot["kind"]) => (k === "diagram" ? <Badge tone="info">Diagram (Claude SVG)</Badge> : k === "skip" ? <Badge>Not auto-generated</Badge> : <Badge tone="success">Photo (Higgsfield)</Badge>);
  const stateBadge = (id: string) => {
    const st = status[id];
    if (!st) return null;
    if (st.state === "generating") return <Badge tone="attention">Generating…</Badge>;
    if (st.state === "queued") return <Badge>Queued</Badge>;
    if (st.state === "done") return <Badge tone="success">Done</Badge>;
    if (st.state === "error") return <Badge tone="critical">Failed</Badge>;
    return null;
  };

  return (
    <BlockStack gap="400">
      <BlockStack gap="200">
        {!compact && <Text as="h3" variant="headingMd">Images — one click for the whole page</Text>}
        <Text as="p" tone="subdued" variant="bodySm">
          Step 1 writes one prompt per image slot from the page's copy (Claude): a consistent protagonist across the story, real-looking testimonial portraits, authentic application/lifestyle moments — no fake before/afters, no readable packaging, no stock look. Step 2 generates them ({CONCURRENCY} at a time) and drops each image straight into its slot. Product packshots, the doctor's real portrait and icons are never auto-generated. The rules and message template Claude uses (and each slot's default prompt) are editable under <a href="/app/prompts" target="_blank" rel="noreferrer">Prompts</a>.
        </Text>
        <TextField label="Direction for the images (optional)" value={brief} onChange={setBrief} autoComplete="off" multiline={2} placeholder="e.g. Nordic market — light-skinned woman in her early 60s, silver bob, seaside light; testimonials from Oslo/Bergen…" />
        <InlineStack gap="200" blockAlign="center" wrap>
          <Button onClick={writePrompts} loading={running === "prompts"} disabled={!!running || !ai.aiAvailable}>1 · Write prompts from the copy</Button>
          <Select label="Scope" labelHidden options={[{ label: `Empty slots only (${empty.filter((s) => !excluded.has(s.id)).length})`, value: "empty" }, { label: `All generatable slots — replace existing (${gen.filter((s) => !excluded.has(s.id)).length})`, value: "all" }]} value={scope} onChange={(v) => setScope(v as any)} />
          <Button onClick={() => generate(targets)} loading={running === "images"} disabled={!!running || !(photoOk || ai.aiAvailable) || !targets.length}>{`2 · Generate ${targets.length} image${targets.length === 1 ? "" : "s"}`}</Button>
          <Button variant="primary" onClick={writeAndGenerate} disabled={!!running || !ai.aiAvailable || !photoOk}>Write prompts & generate all</Button>
          {running === "images" && <Button tone="critical" onClick={() => (cancelRef.current = true)}>Stop</Button>}
        </InlineStack>
        {!ai.aiAvailable && <Text as="p" tone="critical" variant="bodySm">Add your Anthropic API key in Settings to write prompts.</Text>}
        {!photoOk && <Text as="p" tone="critical" variant="bodySm">Add your Higgsfield API key id + secret in Settings to generate photos{ai.aiAvailable ? " (diagram slots can still be drawn by Claude)" : ""}.</Text>}
        {running === "images" && (
          <BlockStack gap="100">
            <ProgressBar progress={total ? Math.round(((done + errors) / total) * 100) : 0} size="small" />
            <Text as="p" tone="subdued" variant="bodySm">{done + errors}/{total} finished{errors ? ` · ${errors} failed` : ""} — keep this tab open (about a minute per image, {CONCURRENCY} in parallel).</Text>
          </BlockStack>
        )}
        {msg && <Banner tone={msg.tone}><p>{msg.text}</p></Banner>}
        {(cast || content.imagePlan?.cast) && <Text as="p" tone="subdued" variant="bodySm">Protagonist used across the story: {cast || content.imagePlan?.cast}{content.imagePlan?.writtenAt ? ` · prompts written ${new Date(content.imagePlan.writtenAt).toLocaleString()}` : ""}</Text>}
        <Text as="p" tone="subdued" variant="bodySm">{gen.length} generatable slot(s) · {withPrompt.length} with a written prompt (others use the slot's default) · {empty.length} still empty · {skipped.length} not auto-generated.</Text>
      </BlockStack>

      <BlockStack gap="300">
        {gen.map((slot) => {
          const cur = getSlotValue(content, slot, defs);
          const prompt = slotPrompt(slot, cur);
          const provOk = slotProvider(slot, cur) === "higgsfield" ? photoOk : ai.aiAvailable;
          const st = status[slot.id];
          const inc = !excluded.has(slot.id);
          return (
            <div className="ib-list-item" key={slot.id}>
              <InlineStack gap="300" blockAlign="start" wrap={false}>
                {cur?.src ? <img className="ib-image__thumb" src={cur.src} alt="" /> : <div className="ib-image__thumb ib-image__thumb--empty">No image</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <BlockStack gap="150">
                    <InlineStack gap="150" blockAlign="center" wrap>
                      <Checkbox label="Include" labelHidden checked={inc} onChange={(v) => setExcluded((prev) => { const n = new Set(prev); if (v) n.delete(slot.id); else n.add(slot.id); return n; })} />
                      <Text as="span" fontWeight="semibold" variant="bodySm">{slot.label}</Text>
                      <Text as="span" tone="subdued" variant="bodySm">{slot.aspect}</Text>
                      {kindBadge(slot.kind)}
                      {stateBadge(slot.id)}
                    </InlineStack>
                    <TextField label="Prompt" labelHidden value={cur?.prompt || ""} onChange={(v) => setPrompt(slot, v)} multiline={2} autoComplete="off" placeholder={slot.hint ? `Default: ${slot.hint}` : "No prompt yet — use “Write prompts from the copy”"} maxHeight={120} />
                    <InlineStack gap="150" blockAlign="center">
                      <Button size="slim" disabled={!!running || !prompt || !provOk} onClick={() => generate([slot])}>{cur?.src ? "Regenerate" : "Generate"}</Button>
                      {cur?.src && <Button size="slim" tone="critical" variant="plain" onClick={() => apply((c) => setSlotValue(c, slot, { ...(getSlotValue(c, slot, defs) || { src: "" }), src: "" }, defs))}>Remove image</Button>}
                      {st?.state === "error" && <Text as="span" tone="critical" variant="bodySm">{st.error}</Text>}
                    </InlineStack>
                  </BlockStack>
                </div>
              </InlineStack>
            </div>
          );
        })}
        {skipped.length > 0 && (
          <Text as="p" tone="subdued" variant="bodySm">
            Not auto-generated (upload or pick from the library in the section): {skipped.map((s) => s.label).join(" · ")}
          </Text>
        )}
      </BlockStack>
    </BlockStack>
  );
}
