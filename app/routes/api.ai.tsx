import type { ActionFunctionArgs } from "react-router";
import { requireAdmin } from "../lib/auth.server";
import { getSettings } from "../lib/pages.server";
import { normalizePage } from "../lib/brand";
import { generateImageAsset } from "../lib/integrations/images.server";
import { claudeGenerateSectionCopy } from "../lib/integrations/claude.server";
import { translatePage } from "../lib/integrations/translate.server";
import { fetchShopLocalesAndMarkets } from "../lib/shop-info.server";

/**
 * JSON API for AI features (all keys come from Settings / env):
 *   { action: "image", prompt, aspect?, provider?, alt? }              → { image }
 *   { action: "section-copy", sectionType, sectionLabel, fields, currentData, brief, productName? } → { data }
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
