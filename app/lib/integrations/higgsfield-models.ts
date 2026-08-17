/** Higgsfield model catalogue (client-safe; no secrets). */
export const HIGGSFIELD_MODELS = [
  { id: "higgsfield-ai/soul/standard", label: "Soul (realistic people / UGC)" },
  { id: "nano-banana", label: "Nano Banana (diagrams, text, products)" },
  { id: "flux-pro/kontext/max/text-to-image", label: "Flux Pro Kontext" },
  { id: "reve/text-to-image", label: "Reve" },
] as const;

export const DEFAULT_HIGGSFIELD_MODEL = "higgsfield-ai/soul/standard";
