import { describe, it, expect, vi } from "vitest";

// Fake Anthropic SDK: returns a structured-output style JSON text for the image-prompt writer.
vi.mock("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    static AuthenticationError = class extends Error {};
    static PermissionDeniedError = class extends Error {};
    static NotFoundError = class extends Error {};
    static RateLimitError = class extends Error {};
    static BadRequestError = class extends Error {};
    static APIConnectionError = class extends Error {};
    static APIError = class extends Error {};
    messages = {
      create: async (params: any) => {
        (globalThis as any).__lastParams = params;
        const body = {
          cast: "Woman of 62, silver-blonde bob, light olive skin, warm smile",
          prompts: [
            { id: "s1.image", prompt: "Woman of 62, silver-blonde bob …\nmorning balcony light", alt: "Woman on a balcony", provider: "higgsfield" },
            { id: "s2.image", prompt: "Diagram of three steps", alt: "Diagram", provider: "higgsfield" }, // model picked wrong provider → forced by slot kind
            { id: "ghost.image", prompt: "should be dropped", alt: "", provider: "higgsfield" },
            { id: "s3.image", prompt: "   ", alt: "", provider: "higgsfield" }, // empty prompt dropped
          ],
        };
        return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(body) }] };
      },
    };
    constructor(_: any) {}
  }
  return { default: FakeAnthropic };
});

describe("claudeGenerateImagePrompts", () => {
  it("returns cleaned prompts for known slots only, forces the provider by slot kind, and sends the schema", async () => {
    const { claudeGenerateImagePrompts } = await import("../app/lib/integrations/claude.server");
    const r = await claudeGenerateImagePrompts({
      apiKey: "sk-test",
      pageCopy: "## Hero\nheadline: 3 reasons…",
      brandStyle: "unretouched",
      slots: [
        { id: "s1.image", label: "Hero — Hero image", aspect: "4:3", kind: "photo", hint: "", context: "", hasImage: true },
        { id: "s2.image", label: "Science — Image", aspect: "1:1", kind: "diagram", hint: "", context: "", hasImage: false },
        { id: "s3.image", label: "Reason — Image", aspect: "16:9", kind: "photo", hint: "", context: "", hasImage: false },
      ],
    });
    expect(r.cast).toContain("silver-blonde");
    expect(r.prompts.map((p) => p.id)).toEqual(["s1.image", "s2.image"]);
    expect(r.prompts[0].prompt).toBe("Woman of 62, silver-blonde bob … morning balcony light"); // newlines collapsed
    expect(r.prompts[0].provider).toBe("higgsfield");
    expect(r.prompts[1].provider).toBe("claude-svg");
    const params = (globalThis as any).__lastParams;
    expect(params.output_config.format.type).toBe("json_schema");
    expect(params.output_config.format.schema.required).toEqual(["cast", "prompts"]);
    expect(params.system).toContain("TRUST");
    expect(params.messages[0].content).toContain('id="s2.image"');
    expect(params.messages[0].content).toContain("kind diagram");
  });
});

describe("editable prompts (Prompts page)", () => {
  it("fills templates, falls back to defaults when empty, and passes custom prompts through to Claude", async () => {
    const { fillTemplate, effectivePrompt, DEFAULT_PROMPTS } = await import("../app/lib/ai/prompt-defaults");
    expect(fillTemplate("A {{x}} and {{ y }} and {{unknown}}", { x: "1", y: 2 })).toBe("A 1 and 2 and {{unknown}}");
    expect(effectivePrompt(undefined, "imagePromptsSystem")).toBe(DEFAULT_PROMPTS.imagePromptsSystem);
    expect(effectivePrompt({ imagePromptsSystem: "   " }, "imagePromptsSystem")).toBe(DEFAULT_PROMPTS.imagePromptsSystem);
    expect(effectivePrompt({ imagePromptsSystem: "Custom rules" }, "imagePromptsSystem")).toBe("Custom rules");
    const { claudeGenerateImagePrompts, imagePromptsUserPrompt } = await import("../app/lib/integrations/claude.server");
    const slots = [{ id: "s1.image", label: "Hero — Hero image", aspect: "4:3", kind: "photo" as const, hint: "h", context: "ctx", hasImage: false }];
    const custom = { imagePromptsSystem: "MY RULES", imagePromptsUser: "Product={{product}} Cast={{existingCast}} N={{slotCount}}\n{{slots}}\nCOPY:{{pageCopy}}" };
    const user = imagePromptsUserPrompt({ apiKey: "x", pageCopy: "the copy", brandStyle: "s", productName: "Neck Cream", prompts: custom, slots });
    expect(user).toContain("Product=Neck Cream");
    expect(user).toContain("N=1");
    expect(user).toContain('id="s1.image"');
    expect(user).toContain("COPY:the copy");
    expect(user).toContain("Cast=— (first run: define her)");
    await claudeGenerateImagePrompts({ apiKey: "sk-test", pageCopy: "the copy", brandStyle: "s", prompts: custom, slots });
    const params = (globalThis as any).__lastParams;
    expect(params.system).toBe("MY RULES");
    expect(params.messages[0].content).toContain("Product=—");
    // default template still contains the essentials
    const dflt = imagePromptsUserPrompt({ apiKey: "x", pageCopy: "the copy", brandStyle: "s", slots });
    expect(dflt).toContain("PAGE COPY");
    expect(dflt).toContain("IMAGE SLOTS (1");
  });
  it("slot default prompts from the Prompts page override the section library hints", async () => {
    const { applySlotHintOverrides, collectImageSlots } = await import("../app/lib/images/slots");
    const { SECTION_MAP } = await import("../app/lib/sections/registry");
    const { SEEDS } = await import("../app/lib/seed/seed.server");
    const { normalizePage } = await import("../app/lib/brand");
    const defs = Object.fromEntries(Object.entries(SECTION_MAP).map(([t, d]) => [t, { label: d.label, fields: d.fields }]));
    const over = applySlotHintOverrides(defs, { "hero.image": "Custom hero hint", "testimonials.items.image": "Custom portrait hint", "nope.image": "x" });
    const page = normalizePage(JSON.parse(JSON.stringify(SEEDS[0].content)));
    const slots = collectImageSlots(page, over);
    expect(slots.find((s) => s.sectionType === "hero" && s.fieldKey === "image")!.hint).toBe("Custom hero hint");
    expect(slots.filter((s) => s.sectionType === "testimonials" && s.subKey === "image").every((s) => s.hint === "Custom portrait hint")).toBe(true);
    expect(slots.find((s) => s.sectionType === "reason")!.hint).toContain("Photo illustrating this reason"); // untouched
    expect(defs.hero.fields.find((f) => f.key === "image")!.imagePrompt).not.toBe("Custom hero hint"); // original defs immutable
  });
});
