import type { ActionFunctionArgs } from "react-router";
import { requireAdmin } from "../lib/auth.server";
import { getSettings } from "../lib/pages.server";
import { normalizePage } from "../lib/brand";
import { generateImageAsset } from "../lib/integrations/images.server";
import { claudeGenerateSectionCopy, claudeGenerateImagePrompts } from "../lib/integrations/claude.server";
import { SECTION_MAP } from "../lib/sections/registry";
import { collectImageSlots, generatableSlots, pageCopyDigest, applySlotHintOverrides } from "../lib/images/slots";
import { translatePage } from "../lib/integrations/translate.server";
import { fetchShopLocalesAndMarkets } from "../lib/shop-info.server";

/**
 * JSON API for AI features (all keys come from Settings / env):
 *   { action: "image", prompt, aspect?, provider?, alt? }              → { image }
 *   { action: "section-copy", sectionType, sectionLabel, fields, currentData, brief, productName? } → { data }
 *   { action: "image-prompts", content, brief?, slotIds? }             → { cast, prompts: [{id, prompt, alt, provider}] }
 *   { action: "translate-page", content, provider, targetLocales, onlyMissing } → { content, message }
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, admin } = await requireAdmin(request);
  const body = await request.json().catch(() => ({}));
  const { brand, secrets } = await getSettings(shop);
  try {
    switch (String(body.action || "")) {
      case "image": {
        const provider = body.provider === "claude-svg" ? "claude-svg" : "higgsfield";
        if (provider === "higgsfield" && !(secrets.higgsfieldKeyId && secrets.higgsfieldKeySecret)) throw new Error("Add your Higgsfield API key id + secret in Settings first (or choose the Claude SVG provider).");
        if (provider === "claude-svg" && !secrets.anthropicApiKey) throw new Error("Add your Anthropic API key in Settings first.");
        const image = await generateImageAsset({ admin, shop, provider, prompt: String(body.prompt || ""), aspectRatio: body.aspect, model: provider === "higgsfield" ? brand.ai.higgsfieldModel : brand.ai.claudeModel, secrets, brand, alt: body.alt });
        return Response.json({ image });
      }
      case "section-copy": {
        if (!secrets.anthropicApiKey) throw new Error("Add your Anthropic API key in Settings first.");
        const data = await claudeGenerateSectionCopy({ apiKey: secrets.anthropicApiKey, model: brand.ai.claudeModel, sectionType: body.sectionType, sectionLabel: body.sectionLabel, fields: body.fields || [], currentData: body.currentData || {}, brief: String(body.brief || ""), productName: body.productName, brandVoice: "Premium, editorial, dermatologist-backed, warm and direct. Native-ads listicle style (Glow25). Never invent clinical numbers." });
        return Response.json({ data });
      }
      case "image-prompts": {
        if (!secrets.anthropicApiKey) throw new Error("Add your Anthropic API key in Settings first.");
        const content = normalizePage(body.content);
        const defs = applySlotHintOverrides(Object.fromEntries(Object.entries(SECTION_MAP).map(([t, d]) => [t, { label: d.label, fields: d.fields }])), brand.prompts?.slotHints);
        const only: string[] | null = Array.isArray(body.slotIds) && body.slotIds.length ? body.slotIds.map(String) : null;
        const slots = generatableSlots(collectImageSlots(content, defs)).filter((s) => !only || only.includes(s.id));
        if (!slots.length) return Response.json({ cast: "", prompts: [] });
        const result = await claudeGenerateImagePrompts({
          apiKey: secrets.anthropicApiKey,
          model: brand.ai.claudeModel,
          productName: `${content.commerce.productTitle || content.commerce.productHandle || ""}${content.commerce.purchaseMode === "subscription" ? " — sold as a subscription (recurring deliveries; show the routine as ongoing care, never a one-off)" : ""}` || undefined,
          pageCopy: pageCopyDigest(content, defs),
          brandStyle: brand.ai.imageStyle || "",
          brief: String(body.brief || "") || undefined,
          existingCast: content.imagePlan?.cast || undefined,
          prompts: brand.prompts,
          slots: slots.map((s) => ({ id: s.id, label: s.label, aspect: s.aspect, kind: s.kind === "diagram" ? "diagram" : "photo", hint: s.hint, context: s.context, currentAlt: s.value?.alt, hasImage: !!s.value?.src })),
        });
        return Response.json(result);
      }
      case "translate-page": {
        const provider = body.provider === "claude" ? "claude" : "deepl";
        if (provider === "deepl" && !secrets.deeplApiKey) throw new Error("Add your DeepL API key in Settings first.");
        if (provider === "claude" && !secrets.anthropicApiKey) throw new Error("Add your Anthropic API key in Settings first.");
        const { locales } = await fetchShopLocalesAndMarkets(admin);
        const sourceLocale = locales.find((l) => l.primary)?.locale || "en";
        const content = normalizePage(body.content);
        const targets: string[] = Array.isArray(body.targetLocales) ? body.targetLocales : [];
        const updated = await translatePage({ content, provider, secrets, model: brand.ai.claudeModel, sourceLocale, targetLocales: targets, onlyMissing: body.onlyMissing !== false, context: `Product: ${content.commerce.productTitle || ""}. Page: native-ads interstitial for Cellexia.` });
        const counts = targets.map((l) => `${l}: ${Object.keys(updated.translations[l] || {}).length}`).join(", ");
        return Response.json({ content: updated, message: `Translated with ${provider === "deepl" ? "DeepL" : "Claude"} — ${counts}. Review in the table below, then save/publish.` });
      }
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
};
