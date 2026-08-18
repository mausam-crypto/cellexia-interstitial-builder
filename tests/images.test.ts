import { describe, it, expect } from "vitest";
import { SECTION_MAP } from "../app/lib/sections/registry";
import { SEEDS } from "../app/lib/seed/seed.server";
import { normalizePage } from "../app/lib/brand";
import { applyImagePrompts, collectImageSlots, generatableSlots, getSlotValue, pageCopyDigest, setSlotValue, slotPrompt, slotProvider } from "../app/lib/images/slots";
import { imagePromptsSystemPrompt, imagePromptsUserPrompt } from "../app/lib/integrations/claude.server";

const defs = Object.fromEntries(Object.entries(SECTION_MAP).map(([t, d]) => [t, { label: d.label, fields: d.fields }]));
const seed = (slug: string) => normalizePage(JSON.parse(JSON.stringify(SEEDS.find((s) => s.slug === slug)!.content)));

describe("one-click image pipeline — slots", () => {
  it("collects every image slot of a page (section images + list-item images) with stable ids", () => {
    const page = seed("crepey-skin");
    const slots = collectImageSlots(page, defs);
    expect(slots.length).toBeGreaterThan(10);
    const ids = slots.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const hero = slots.find((s) => s.sectionType === "hero" && s.fieldKey === "image" && s.subKey == null)!;
    expect(hero.id).toBe(`${hero.sectionId}.image`);
    expect(slots.find((s) => s.sectionType === "hero" && s.subKey === "image")!.kind).toBe("skip"); // badge artwork
    expect(hero.aspect).toBe("4:3");
    expect(hero.kind).toBe("photo");
    expect(hero.context).toContain("3 reasons why thousands of women over 50");
    const tm = slots.filter((s) => s.sectionType === "testimonials");
    expect(tm.length).toBeGreaterThanOrEqual(3);
    expect(tm[0].id).toMatch(/\.items\.0\.image$/);
    expect(tm[0].label).toMatch(/Portrait/);
    expect(tm[0].context.length).toBeGreaterThan(10); // the testimonial text/name travels with the slot
  });
  it("never auto-generates real portraits, product packshots, gift/cross-sell images or icons; science image is a diagram", () => {
    const page = seed("crepey-skin");
    const slots = collectImageSlots(page, defs);
    const kinds = Object.fromEntries(slots.map((s) => [`${s.sectionType}.${s.fieldKey}${s.subKey ? "." + s.subKey : ""}`, s.kind]));
    expect(kinds["expert_quote.image"]).toBe("skip");
    expect(kinds["pricing.cards.image"]).toBe("skip");
    expect(kinds["pricing.crossSellImage"]).toBe("skip");
    expect(kinds["science.image"]).toBe("diagram");
    expect(kinds["hero.image"]).toBe("photo");
    expect(kinds["reason.image"]).toBe("photo");
    const gen = generatableSlots(slots);
    expect(gen.every((s) => s.kind !== "skip")).toBe(true);
    expect(gen.length).toBeGreaterThan(8);
  });
  it("applies Claude's prompts onto the content (keeps existing images and alt), and the pipeline reads them back", () => {
    const page = seed("crepey-skin");
    const slots = generatableSlots(collectImageSlots(page, defs));
    const hero = slots.find((s) => s.sectionType === "hero" && s.fieldKey === "image")!;
    const sci = slots.find((s) => s.sectionType === "science")!;
    const before = getSlotValue(page, hero)!;
    const { content, applied } = applyImagePrompts(page, slots, [
      { id: hero.id, prompt: "Woman around 62, silver bob, morning light on a balcony…", alt: "Woman applying cream on her arm", provider: "higgsfield" },
      { id: sci.id, prompt: "Three-step diagram: dormant fibroblast → activation → new collagen", alt: "Fibroblast diagram", provider: "claude-svg" },
      { id: "nope.image", prompt: "ignored", alt: "", provider: "higgsfield" },
    ]);
    expect(applied).toBe(2);
    const h = getSlotValue(content, hero)!;
    expect(h.src).toBe(before.src); // image kept
    expect(h.alt).toBe(before.alt); // existing alt kept
    expect(h.prompt).toContain("silver bob");
    expect(slotPrompt(hero, h)).toContain("silver bob");
    expect(slotProvider(hero, h)).toBe("higgsfield");
    const s = getSlotValue(content, sci)!;
    expect(s.provider).toBe("claude-svg");
    expect(slotProvider(sci, s)).toBe("claude-svg");
    // untouched page keeps its default hint as prompt
    expect(slotPrompt(hero, before)).toBe(hero.hint);
    // setSlotValue is immutable
    const next = setSlotValue(content, hero, { ...h, src: "https://x/y.jpg" });
    expect(getSlotValue(content, hero)!.src).toBe(before.src);
    expect(getSlotValue(next, hero)!.src).toBe("https://x/y.jpg");
  });
  it("digests the page copy for the prompt writer and the prompts brief encodes the trust rules", () => {
    const page = seed("jawline-ritual");
    const digest = pageCopyDigest(page, defs);
    expect(digest).toContain("## Listicle hero");
    expect(digest).toContain("jawline");
    expect(digest.length).toBeLessThanOrEqual(18010);
    // every visible section with copy makes it into the digest (per-section budget, no early cut-off)
    for (const must of ["## Listicle hero", "## Results timeline", "## Testimonial", "## Doctor FAQ"]) expect(digest).toContain(must);
    const sys = imagePromptsSystemPrompt();
    for (const must of ["unretouched", "before/after", "labels", "aspect ratio", "protagonist", "Testimonial"]) expect(sys).toContain(must);
    const slots = generatableSlots(collectImageSlots(page, defs)).slice(0, 3);
    const user = imagePromptsUserPrompt({ apiKey: "x", pageCopy: digest, brandStyle: "unretouched, natural light", productName: "Jawline Contour", brief: "Nordic market", slots: slots.map((s) => ({ id: s.id, label: s.label, aspect: s.aspect, kind: s.kind === "diagram" ? "diagram" : "photo", hint: s.hint, context: s.context, hasImage: !!s.value?.src })) });
    expect(user).toContain(`id="${slots[0].id}"`);
    expect(user).toContain("Nordic market");
    expect(user).toContain("PAGE COPY");
  });
});

describe("one-click image pipeline — robustness", () => {
  it("resolves list-item slots by item identity: reordered → follows the item; removed → write dropped, no holes", () => {
    const page = seed("crepey-skin");
    const slots = collectImageSlots(page, defs);
    const tm = slots.filter((s) => s.sectionType === "testimonials" && s.subKey === "image");
    expect(tm.length).toBeGreaterThanOrEqual(3);
    const slot1 = tm[1]; // second testimonial, captured before edits
    const sec = page.sections.find((s) => s.type === "testimonials")!;
    const items = sec.data.items;
    const name1 = items[1].name;
    // reorder: move item 1 to the end
    const reordered = { ...page, sections: page.sections.map((s) => (s.id === sec.id ? { ...s, data: { ...s.data, items: [items[0], ...items.slice(2), items[1]] } } : s)) };
    const img = { src: "https://cdn/portrait.jpg", alt: "portrait" };
    const after = setSlotValue(reordered, slot1, img, defs);
    const list = after.sections.find((s) => s.id === sec.id)!.data.items;
    expect(list[list.length - 1].name).toBe(name1);
    expect(list[list.length - 1].image.src).toBe("https://cdn/portrait.jpg");
    expect(list.every((it: any) => it && typeof it === "object")).toBe(true);
    expect(getSlotValue(after, slot1, defs)!.src).toBe("https://cdn/portrait.jpg");
    // removed: shrink the list to one item; a late result for item 3 must not create holes/stray items
    const shrunk = { ...page, sections: page.sections.map((s) => (s.id === sec.id ? { ...s, data: { ...s.data, items: [items[0]] } } : s)) };
    const late = setSlotValue(shrunk, tm[3] || tm[2], img, defs);
    const l2 = late.sections.find((s) => s.id === sec.id)!.data.items;
    expect(l2).toHaveLength(1);
    expect(l2[0].image?.src).not.toBe("https://cdn/portrait.jpg");
    expect(JSON.stringify(l2)).not.toContain("null");
  });
  it("hidden sections are listed but never auto-generated; prompt alt is kept separately from the existing image's alt", () => {
    const page = seed("crepey-skin");
    const hero = page.sections.find((s) => s.type === "hero")!;
    hero.hidden = true;
    const slots = collectImageSlots(page, defs);
    const heroSlot = slots.find((s) => s.sectionId === hero.id && s.fieldKey === "image")!;
    expect(heroSlot.hidden).toBe(true);
    expect(generatableSlots(slots).some((s) => s.sectionId === hero.id)).toBe(false);
    hero.hidden = false;
    const slots2 = generatableSlots(collectImageSlots(page, defs));
    const h2 = slots2.find((s) => s.sectionId === hero.id && s.fieldKey === "image")!;
    const before = getSlotValue(page, h2, defs)!;
    const { content } = applyImagePrompts(page, slots2, [{ id: h2.id, prompt: "New prompt", alt: "New alt for the generated image", provider: "higgsfield" }], defs);
    const v = getSlotValue(content, h2, defs)!;
    expect(v.alt).toBe(before.alt); // existing real image keeps its alt
    expect(v.promptAlt).toBe("New alt for the generated image"); // used when the image is regenerated
    // an empty slot takes the new alt straight away
    const emptied = setSlotValue(page, h2, { src: "", alt: "" }, defs);
    const r2 = applyImagePrompts(emptied, slots2, [{ id: h2.id, prompt: "P", alt: "Alt X", provider: "higgsfield" }], defs);
    expect(getSlotValue(r2.content, h2, defs)!.alt).toBe("Alt X");
  });
  it("section context carries list-item copy (science steps) and the schema pins prompt ids to the requested slots", async () => {
    const page = seed("crepey-skin");
    const sci = collectImageSlots(page, defs).find((s) => s.sectionType === "science")!;
    expect(sci.context.length).toBeGreaterThan(80);
    expect(sci.context).toMatch(/Steps|steps/i);
    const { imagePromptsSchema } = await import("../app/lib/integrations/claude.server");
    const schema: any = imagePromptsSchema(["a.image", "b.image"]);
    expect(schema.properties.prompts.items.properties.id.enum).toEqual(["a.image", "b.image"]);
  });
});
