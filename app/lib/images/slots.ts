/**
 * Image slots of a page — every `image` field of every section (including images inside
 * list items such as testimonial portraits or timeline phases), addressed by a stable id.
 *
 * Client-safe (no server imports). Used by:
 *  - the "Images" panel (editor) and the wizard's Images step: list, generate all
 *  - api.ai "image-prompts": Claude writes one optimised prompt per slot from the page copy
 */
import type { FieldDef, ImageValue, PageContent, SectionInstance } from "../types";

export interface SlotDefs {
  [type: string]: { label: string; fields: FieldDef[] };
}

export interface ImageSlot {
  /** Stable id: `<sectionId>.<fieldKey>` or `<sectionId>.<fieldKey>.<itemIndex>.<subKey>` */
  id: string;
  sectionId: string;
  sectionType: string;
  sectionLabel: string;
  fieldKey: string;
  itemIndex?: number;
  subKey?: string;
  /** Human label, e.g. "Testimonial carousel — Testimonials 2 (Margaret, 64) — Portrait" */
  label: string;
  /** e.g. "4:3" */
  aspect: string;
  /** The field's default prompt hint (from the section definition). */
  hint: string;
  /** How the one-click pipeline treats it. */
  kind: "photo" | "diagram" | "skip";
  /** Section-level product-specific flag (the wizard swaps these). */
  productSpecific: boolean;
  /** Copy that sits right next to the image (headline, quote, item text…) — context for the prompt writer. */
  context: string;
  /** Section is hidden on the page (slots are listed but not auto-generated). */
  hidden: boolean;
  /**
   * List items only: signature of the item's text fields at collection time. Results that land a minute
   * later are written to the item that still carries this signature (the list may have been reordered/edited).
   */
  itemKey?: string;
  value?: ImageValue;
}

const CONTEXT_MAX = 500;

function plain(v: unknown): string {
  return String(v ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nearby copy for a section-level image: the section's text fields (title/headline first). */
function sectionContext(section: SectionInstance, fields: FieldDef[]): string {
  const parts: string[] = [];
  const order = ["eyebrow", "headline", "title", "heading", "subheadline", "subhead", "quote", "text", "body", "description", "caption"];
  const textFields = fields.filter((f) => f.type === "text" || f.type === "textarea" || f.type === "richtext");
  textFields.sort((a, b) => (order.indexOf(a.key) === -1 ? 99 : order.indexOf(a.key)) - (order.indexOf(b.key) === -1 ? 99 : order.indexOf(b.key)));
  for (const f of textFields) {
    const v = plain(section.data?.[f.key]);
    if (v) parts.push(`${f.label}: ${v}`);
  }
  // Lists that carry the section's substance (science steps, timeline phases, pillars…): first items, briefly.
  for (const f of fields) {
    if (f.type !== "list" || !Array.isArray(section.data?.[f.key])) continue;
    const items: any[] = section.data[f.key];
    const texts = items.slice(0, 6).map((it) => (f.item || []).filter((sf) => sf.type === "text" || sf.type === "textarea" || sf.type === "richtext").map((sf) => plain(it?.[sf.key])).filter(Boolean).join(" — ").slice(0, 140)).filter(Boolean);
    if (texts.length) parts.push(`${f.label}: ${texts.join(" | ")}`);
  }
  return parts.join(" · ").slice(0, CONTEXT_MAX * 2);
}

/** Signature of a list item's text fields (identity that survives reordering). */
export function itemSignature(item: any, sub: FieldDef[]): string {
  return sub
    .filter((f) => f.type === "text" || f.type === "textarea" || f.type === "richtext" || f.type === "number")
    .map((f) => `${f.key}=${plain(item?.[f.key]).slice(0, 80)}`)
    .join("|");
}

/** Nearby copy for a list-item image: the item's own text fields. */
function itemContext(item: any, sub: FieldDef[]): string {
  const parts: string[] = [];
  for (const f of sub) {
    if (f.type !== "text" && f.type !== "textarea" && f.type !== "richtext") continue;
    const v = plain(item?.[f.key]);
    if (v) parts.push(`${f.label}: ${v}`);
  }
  return parts.join(" · ").slice(0, CONTEXT_MAX);
}

function itemTitle(item: any): string {
  return plain(item?.name || item?.title || item?.label || "");
}

/** All image slots of a page in section order. */
export function collectImageSlots(content: PageContent, defs: SlotDefs): ImageSlot[] {
  const slots: ImageSlot[] = [];
  for (const s of content.sections || []) {
    const def = defs[s.type];
    if (!def) continue;
    const productSpecific = def.fields.some((f) => f.productSpecific);
    for (const f of def.fields) {
      if (f.type === "image") {
        slots.push({
          id: `${s.id}.${f.key}`,
          sectionId: s.id,
          sectionType: s.type,
          sectionLabel: def.label,
          fieldKey: f.key,
          label: `${def.label} — ${f.label}`,
          aspect: f.imageAspect || "4:3",
          hint: f.imagePrompt || "",
          kind: f.aiImage || "photo",
          productSpecific,
          context: sectionContext(s, def.fields),
          hidden: !!s.hidden,
          value: s.data?.[f.key] || undefined,
        });
      } else if (f.type === "list" && Array.isArray(s.data?.[f.key])) {
        const items: any[] = s.data[f.key];
        items.forEach((item, i) => {
          for (const sub of f.item || []) {
            if (sub.type !== "image") continue;
            const t = itemTitle(item);
            slots.push({
              id: `${s.id}.${f.key}.${i}.${sub.key}`,
              sectionId: s.id,
              sectionType: s.type,
              sectionLabel: def.label,
              fieldKey: f.key,
              itemIndex: i,
              subKey: sub.key,
              label: `${def.label} — ${f.label} ${i + 1}${t ? ` (${t})` : ""} — ${sub.label}`,
              aspect: sub.imageAspect || "1:1",
              hint: sub.imagePrompt || "",
              kind: sub.aiImage || "photo",
              productSpecific,
              context: itemContext(item, f.item || []),
              hidden: !!s.hidden,
              itemKey: itemSignature(item, f.item || []),
              value: item?.[sub.key] || undefined,
            });
          }
        });
      }
    }
  }
  return slots;
}

/**
 * Where a list-item slot lives NOW: the item at the recorded index if it still has the same text
 * signature, else the item that carries the signature (list was reordered), else the recorded index
 * if it still exists (item was edited in place), else -1 (item removed → the write is dropped).
 */
export function resolveItemIndex(list: any[], slot: ImageSlot, defs?: SlotDefs): number {
  if (slot.itemIndex == null) return -1;
  if (!Array.isArray(list) || !list.length) return -1;
  const sub = defs?.[slot.sectionType]?.fields.find((f) => f.key === slot.fieldKey)?.item;
  if (slot.itemKey && sub) {
    if (list[slot.itemIndex] && itemSignature(list[slot.itemIndex], sub) === slot.itemKey) return slot.itemIndex;
    const j = list.findIndex((it) => itemSignature(it, sub) === slot.itemKey);
    if (j >= 0) return j;
  }
  return slot.itemIndex < list.length ? slot.itemIndex : -1;
}

/** Read the current value of a slot from (possibly newer) content. */
export function getSlotValue(content: PageContent, slot: ImageSlot, defs?: SlotDefs): ImageValue | undefined {
  const s = content.sections.find((x) => x.id === slot.sectionId);
  if (!s) return undefined;
  if (slot.itemIndex == null) return s.data?.[slot.fieldKey] || undefined;
  const list = s.data?.[slot.fieldKey] || [];
  const i = resolveItemIndex(list, slot, defs);
  return i >= 0 ? list[i]?.[slot.subKey!] || undefined : undefined;
}

/** Return new content with the slot's value replaced (immutable). A list item that no longer exists is left alone (no holes, no stray items). */
export function setSlotValue(content: PageContent, slot: ImageSlot, value: ImageValue | undefined, defs?: SlotDefs): PageContent {
  return {
    ...content,
    sections: content.sections.map((s) => {
      if (s.id !== slot.sectionId) return s;
      if (slot.itemIndex == null) return { ...s, data: { ...s.data, [slot.fieldKey]: value } };
      const list = [...(s.data?.[slot.fieldKey] || [])];
      const i = resolveItemIndex(list, slot, defs);
      if (i < 0) return s;
      list[i] = { ...(list[i] || {}), [slot.subKey!]: value };
      return { ...s, data: { ...s.data, [slot.fieldKey]: list } };
    }),
  };
}

/** The prompt to use for a slot: the pre-written one, else the field's default hint. */
export function slotPrompt(slot: ImageSlot, value: ImageValue | undefined = slot.value): string {
  return (value?.prompt || slot.hint || "").trim();
}

/** Provider for a slot: what the prompt was written for, else by kind. */
export function slotProvider(slot: ImageSlot, value: ImageValue | undefined = slot.value): "higgsfield" | "claude-svg" {
  if (value?.provider === "claude-svg" || value?.provider === "higgsfield") return value.provider;
  return slot.kind === "diagram" ? "claude-svg" : "higgsfield";
}

/** Return defs whose image fields carry the merchant's default prompts (Prompts page → slotHints). */
export function applySlotHintOverrides(defs: SlotDefs, hints?: Record<string, string>): SlotDefs {
  if (!hints || !Object.keys(hints).length) return defs;
  const out: SlotDefs = {};
  for (const [type, d] of Object.entries(defs)) {
    out[type] = {
      ...d,
      fields: d.fields.map((f) => {
        if (f.type === "image") {
          const h = (hints[`${type}.${f.key}`] || "").trim();
          return h ? { ...f, imagePrompt: h } : f;
        }
        if (f.type === "list" && f.item?.some((sf) => sf.type === "image")) {
          return { ...f, item: f.item.map((sf) => { const h = sf.type === "image" ? (hints[`${type}.${f.key}.${sf.key}`] || "").trim() : ""; return h ? { ...sf, imagePrompt: h } : sf; }) };
        }
        return f;
      }),
    };
  }
  return out;
}

/** Slots the one-click pipeline generates: everything but "skip" (real portraits, packshots, icons) and hidden sections. */
export function generatableSlots(slots: ImageSlot[]): ImageSlot[] {
  return slots.filter((s) => s.kind !== "skip" && !s.hidden);
}

/**
 * Plain-text digest of the whole page's copy (for the prompt writer). Every visible section gets its
 * own budget (`perSection`) so the sections that own most image slots (reasons, timeline, testimonials)
 * are never cut off by long early sections; the total is capped at `maxChars`.
 */
export function pageCopyDigest(content: PageContent, defs: SlotDefs, maxChars = 18000, perSection = 1100): string {
  const lines: string[] = [];
  for (const s of content.sections || []) {
    if (s.hidden) continue;
    const def = defs[s.type];
    if (!def) continue;
    const parts: string[] = [];
    for (const f of def.fields) {
      if (f.type === "text" || f.type === "textarea" || f.type === "richtext") {
        const v = plain(s.data?.[f.key]);
        if (v) parts.push(`${f.key}: ${v.slice(0, 320)}`);
      } else if (f.type === "list" && Array.isArray(s.data?.[f.key])) {
        const items: any[] = s.data[f.key];
        items.slice(0, 12).forEach((item, i) => {
          const t = (f.item || [])
            .filter((sf) => sf.type === "text" || sf.type === "textarea" || sf.type === "richtext" || sf.type === "number")
            .map((sf) => plain(item?.[sf.key]))
            .filter(Boolean)
            .join(" / ");
          if (t) parts.push(`${f.key}[${i + 1}]: ${t.slice(0, 200)}`);
        });
      }
    }
    if (!parts.length) continue;
    let block = parts.join("\n");
    if (block.length > perSection) block = block.slice(0, perSection) + " …";
    lines.push(`## ${def.label} (${s.type})\n${block}`);
  }
  let out = lines.join("\n\n");
  if (out.length > maxChars) out = out.slice(0, maxChars) + "\n…";
  return out;
}

/** Apply prompts written by Claude to the content (keeps existing images/alt; fills empty alt). */
export function applyImagePrompts(
  content: PageContent,
  slots: ImageSlot[],
  prompts: Array<{ id: string; prompt: string; alt?: string; provider?: "higgsfield" | "claude-svg" }>,
  defs?: SlotDefs,
): { content: PageContent; applied: number } {
  let next = content;
  let applied = 0;
  const byId = new Map(slots.map((s) => [s.id, s]));
  for (const p of prompts) {
    const slot = byId.get(p.id);
    const prompt = String(p.prompt || "").trim();
    if (!slot || !prompt) continue;
    const cur = getSlotValue(next, slot, defs);
    const promptAlt = (p.alt || "").trim();
    const value: ImageValue = {
      ...(cur || { src: "" }),
      src: cur?.src || "",
      prompt,
      provider: p.provider === "claude-svg" ? "claude-svg" : "higgsfield",
      // The existing alt describes the existing image; the new alt is applied when the image is (re)generated.
      promptAlt: promptAlt || cur?.promptAlt,
      alt: cur?.src && cur?.alt?.trim() ? cur.alt : promptAlt || cur?.alt,
    };
    next = setSlotValue(next, slot, value, defs);
    applied++;
  }
  return { content: next, applied };
}
