/**
 * AI image generation for section image slots.
 *
 *  - provider "higgsfield": photoreal images via Higgsfield, re-hosted on the
 *    store's CDN (Shopify Files) when an admin client is available.
 *  - provider "claude-svg": editorial diagrams as inline SVG from Claude,
 *    uploaded as a GenericFile (or returned as a data: URL without admin).
 *
 * Every generated asset is recorded in the ImageAsset table (source + prompt)
 * so the media library can list and reuse it.
 */
import prisma from "../../db.server";
import type { ShopSecrets } from "../pages.server";
import type { BrandSettings, ImageValue } from "../types";
import { uploadFileBuffer, uploadFromUrl } from "./shopify-files.server";
import { higgsfieldGenerateImage, normalizeAspectRatio } from "./higgsfield.server";
import { claudeGenerateSvg } from "./claude.server";

export type ImageProvider = "higgsfield" | "claude-svg";

export interface GenerateImageAssetOpts {
  /** Shopify admin GraphQL client (from authenticate.admin). null = don't re-host. */
  admin: any | null;
  shop: string;
  provider: ImageProvider;
  prompt: string;
  /** e.g. "4:3", "16:9", "1:1" */
  aspectRatio?: string;
  /** Provider model override (Higgsfield model id or Claude model). */
  model?: string;
  secrets: ShopSecrets;
  brand: BrandSettings;
  alt?: string;
}

export interface GeneratedImageAsset extends ImageValue {
  src: string;
  alt: string;
  note: string;
  width?: number;
  height?: number;
}

const NOTE_MAX = 200;

/** Width/height for an SVG canvas from an aspect ratio string (default 1200×675). */
function svgDimensions(aspectRatio: string | undefined): { width: number; height: number } {
  const ar = normalizeAspectRatio(aspectRatio, "16:9");
  const [w, h] = ar.split(":").map(Number);
  const width = 1200;
  const height = Math.round((width * h) / w);
  return { width, height };
}

/**
 * Generate an image for a slot, host it, record it, and return an ImageValue.
 * Throws readable errors (provider misconfiguration, generation failure…).
 */
export async function generateImageAsset(opts: GenerateImageAssetOpts): Promise<GeneratedImageAsset> {
  const prompt = String(opts.prompt || "").trim();
  if (!prompt) throw new Error("Image prompt is empty.");
  const alt = (opts.alt || "").trim() || prompt.slice(0, 120);
  const note = `${opts.provider}: ${prompt}`.slice(0, NOTE_MAX);

  let src: string;
  let width: number | undefined;
  let height: number | undefined;

  if (opts.provider === "higgsfield") {
    const style = String(opts.brand?.ai?.imageStyle || "").trim();
    const fullPrompt = style ? `${prompt}, ${style}` : prompt;
    const generated = await higgsfieldGenerateImage({
      keyId: opts.secrets.higgsfieldKeyId || "",
      keySecret: opts.secrets.higgsfieldKeySecret || "",
      prompt: fullPrompt,
      aspectRatio: opts.aspectRatio,
      model: opts.model || opts.brand?.ai?.higgsfieldModel || undefined,
    });
    src = generated.url;
    if (opts.admin) {
      // Re-host on the store's CDN; fall back to the provider URL if Shopify rejects it.
      try {
        const hosted = await uploadFromUrl(opts.admin, generated.url, alt);
        src = hosted.url;
        width = hosted.width;
        height = hosted.height;
      } catch (err) {
        console.warn(`[images] Shopify re-host failed, keeping provider URL: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } else if (opts.provider === "claude-svg") {
    const dims = svgDimensions(opts.aspectRatio);
    const b = opts.brand;
    const palette = [b?.inkColor, b?.accentColor, b?.highlightBg, b?.softBg].filter((c): c is string => !!c);
    const svg = await claudeGenerateSvg({
      apiKey: opts.secrets.anthropicApiKey || "",
      prompts: opts.brand?.prompts,
      model: opts.model || opts.brand?.ai?.claudeModel || undefined,
      prompt,
      width: dims.width,
      height: dims.height,
      palette,
    });
    width = dims.width;
    height = dims.height;
    if (opts.admin) {
      const hosted = await uploadFileBuffer(opts.admin, Buffer.from(svg, "utf8"), `diagram-${Date.now()}.svg`, "image/svg+xml", alt);
      src = hosted.url;
    } else {
      src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }
  } else {
    throw new Error(`Unknown image provider "${String(opts.provider)}".`);
  }

  // Record for the media library. A DB hiccup must not lose the generated image.
  try {
    await prisma.imageAsset.create({
      data: {
        shop: opts.shop,
        url: src.startsWith("data:") ? src.slice(0, 2000) : src,
        source: opts.provider,
        prompt,
        alt,
        width: width ?? null,
        height: height ?? null,
      },
    });
  } catch (err) {
    console.warn(`[images] Could not record ImageAsset: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { src, alt, note, width, height };
}
