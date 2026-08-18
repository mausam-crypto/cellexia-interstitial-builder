/**
 * Higgsfield image generation (platform.higgsfield.ai) — plain fetch.
 *
 * Flow: POST /{model} → { status, request_id, status_url } → poll status_url
 * every 3 s until "completed" (return images[0].url) or a terminal failure.
 * Auth header: `Authorization: Key ${keyId}:${keySecret}` (never logged).
 */

const BASE_URL = "https://platform.higgsfield.ai";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 4 * 60 * 1000;

export { HIGGSFIELD_MODELS, DEFAULT_HIGGSFIELD_MODEL } from "./higgsfield-models";
import { DEFAULT_HIGGSFIELD_MODEL } from "./higgsfield-models";

/** Aspect ratios accepted by the Soul models. Other inputs are snapped to the closest. */
const SOUL_ASPECT_RATIOS = ["1:1", "4:3", "3:4", "3:2", "2:3", "5:4", "4:5", "16:9", "9:16", "21:9"] as const;

export interface HiggsfieldOpts {
  keyId: string;
  keySecret: string;
  prompt: string;
  /** e.g. "4:3", "16:9", "16/9", "1200x675" — normalised to the closest supported ratio. */
  aspectRatio?: string;
  /** Defaults to "higgsfield-ai/soul/standard". */
  model?: string;
  /** Soul only: "720p" | "1080p" (legacy "1K"/"2K" are mapped). Default "1080p". */
  resolution?: string;
}

/** Parse "4:3", "4/3", "1200x675" or "1.333" into a numeric ratio (w/h). */
function parseRatio(input: string | undefined): number | null {
  const s = String(input || "").trim().toLowerCase();
  if (!s) return null;
  const m = s.match(/^(\d+(?:\.\d+)?)\s*[:/x×]\s*(\d+(?:\.\d+)?)$/);
  if (m) {
    const w = Number(m[1]);
    const h = Number(m[2]);
    return w > 0 && h > 0 ? w / h : null;
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Snap any aspect-ratio input to the closest value Higgsfield accepts. */
export function normalizeAspectRatio(input: string | undefined, fallback = "4:3"): string {
  const s = String(input || "").trim();
  if ((SOUL_ASPECT_RATIOS as readonly string[]).includes(s)) return s;
  const target = parseRatio(s);
  if (!target) return fallback;
  let best: string = fallback;
  let bestDiff = Infinity;
  for (const ar of SOUL_ASPECT_RATIOS) {
    const r = parseRatio(ar)!;
    const diff = Math.abs(Math.log(r) - Math.log(target));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = ar;
    }
  }
  return best;
}

interface SubmitResponse {
  status?: string;
  request_id?: string;
  status_url?: string;
  error?: unknown;
  detail?: unknown;
}

interface StatusResponse {
  status?: string;
  request_id?: string;
  images?: Array<{ url?: string; width?: number; height?: number }>;
  error?: unknown;
  detail?: unknown;
}

function errText(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v).slice(0, 300);
  } catch {
    return String(v);
  }
}

/** Soul resolutions accepted by the API (Aug 2026: "720p" | "1080p"; earlier "1K" | "2K"). */
const SOUL_RESOLUTIONS = ["720p", "1080p"] as const;
const DEFAULT_SOUL_RESOLUTION = "1080p";
export function normalizeResolution(input: string | undefined): string {
  const s = String(input || "").trim().toLowerCase();
  if (!s) return DEFAULT_SOUL_RESOLUTION;
  if ((SOUL_RESOLUTIONS as readonly string[]).includes(s)) return s;
  if (s === "1k" || s === "720" || s === "hd") return "720p";
  if (s === "2k" || s === "1080" || s === "fhd" || s === "4k") return "1080p";
  return DEFAULT_SOUL_RESOLUTION;
}

/** Build the request body for the chosen model family. */
function buildBody(model: string, opts: HiggsfieldOpts, override: Record<string, unknown> = {}): Record<string, unknown> {
  const aspect_ratio = normalizeAspectRatio(opts.aspectRatio, "4:3");
  if (model === "nano-banana") {
    return { prompt: opts.prompt, aspect_ratio, num_images: 1, output_format: "jpeg", ...override };
  }
  if (model === "higgsfield-ai/soul/standard") {
    return { prompt: opts.prompt, aspect_ratio, resolution: normalizeResolution(opts.resolution), num_images: 1, ...override };
  }
  // soul/reference, flux, reve and anything else: minimal common body
  return { prompt: opts.prompt, aspect_ratio, ...override };
}

/**
 * Higgsfield validation errors (422) look like
 *   [{"type":"literal_error","loc":["body","resolution"],"msg":"Input should be '720p' or '1080p'","ctx":{"expected":"'720p' or '1080p'"}}]
 * When one names a body field and lists the accepted literals, return {field: firstAccepted}
 * so the request can be retried once with a value the API accepts (self-heals API changes).
 */
export function literalFixFrom422(body: unknown): Record<string, unknown> | null {
  const list = Array.isArray(body) ? body : Array.isArray((body as any)?.detail) ? (body as any).detail : null;
  if (!list) return null;
  const fix: Record<string, unknown> = {};
  for (const e of list) {
    if (!e || e.type !== "literal_error" || !Array.isArray(e.loc) || e.loc[0] !== "body") continue;
    const field = String(e.loc[1] || "");
    const expected = String(e.ctx?.expected || e.msg || "");
    const first = expected.match(/'([^']+)'/);
    if (field && first) fix[field] = first[1];
  }
  return Object.keys(fix).length ? fix : null;
}

/**
 * Generate one image and wait for it. Resolves with the hosted image URL and
 * the Higgsfield request id (useful for support / audit).
 */
export async function higgsfieldGenerateImage(opts: HiggsfieldOpts): Promise<{ url: string; requestId: string }> {
  const keyId = String(opts.keyId || "").trim();
  const keySecret = String(opts.keySecret || "").trim();
  if (!keyId || !keySecret) throw new Error("Higgsfield API key id/secret are missing. Add them in Settings → Integrations.");
  const prompt = String(opts.prompt || "").trim();
  if (!prompt) throw new Error("Image prompt is empty.");

  const model = (opts.model || DEFAULT_HIGGSFIELD_MODEL).replace(/^\/+|\/+$/g, "");
  const headers = { Authorization: `Key ${keyId}:${keySecret}`, "Content-Type": "application/json", Accept: "application/json" };

  // 1) Submit (one automatic retry if the API rejects a literal we sent, e.g. a renamed resolution)
  let submitRes = await fetch(`${BASE_URL}/${model}`, { method: "POST", headers, body: JSON.stringify(buildBody(model, opts)) });
  let submitText = await submitRes.text().catch(() => "");
  let submit: SubmitResponse = {};
  const parse = (t: string) => {
    try {
      return t ? (JSON.parse(t) as SubmitResponse) : {};
    } catch {
      return {} as SubmitResponse; /* non-JSON body handled below */
    }
  };
  submit = parse(submitText);
  if (submitRes.status === 422) {
    const fix = literalFixFrom422(submit.detail ?? submit);
    if (fix) {
      submitRes = await fetch(`${BASE_URL}/${model}`, { method: "POST", headers, body: JSON.stringify(buildBody(model, opts, fix)) });
      submitText = await submitRes.text().catch(() => "");
      submit = parse(submitText);
    }
  }
  if (!submitRes.ok) {
    const detail = errText(submit.error) || errText(submit.detail) || submitText.slice(0, 300);
    const hint = submitRes.status === 401 || submitRes.status === 403 ? "Higgsfield rejected the API key." : `Higgsfield request failed (${submitRes.status}).`;
    throw new Error(detail ? `${hint} ${detail}` : hint);
  }
  const requestId = String(submit.request_id || "");
  const statusUrl = submit.status_url || (requestId ? `${BASE_URL}/requests/${requestId}/status` : "");
  if (!statusUrl) throw new Error("Higgsfield did not return a status URL for the generation request.");

  // 2) Poll
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let lastStatus = String(submit.status || "queued");
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const res = await fetch(statusUrl, { method: "GET", headers: { Authorization: headers.Authorization, Accept: "application/json" } });
    const text = await res.text().catch(() => "");
    let json: StatusResponse = {};
    try {
      json = text ? (JSON.parse(text) as StatusResponse) : {};
    } catch {
      /* transient non-JSON; keep polling */
    }
    if (!res.ok) {
      // 5xx / 429 are usually transient — keep polling until the deadline.
      if (res.status >= 500 || res.status === 429) continue;
      throw new Error(`Higgsfield status check failed (${res.status}). ${errText(json.error) || errText(json.detail) || text.slice(0, 200)}`.trim());
    }
    lastStatus = String(json.status || lastStatus).toLowerCase();
    if (lastStatus === "completed") {
      const url = json.images?.[0]?.url;
      if (!url) throw new Error("Higgsfield reported completion but returned no image URL.");
      return { url, requestId: requestId || String(json.request_id || "") };
    }
    if (lastStatus === "failed" || lastStatus === "nsfw" || lastStatus === "canceled" || lastStatus === "cancelled") {
      const reason = errText(json.error) || errText(json.detail);
      const label = lastStatus === "nsfw" ? "Higgsfield flagged the prompt as NSFW" : lastStatus === "failed" ? "Higgsfield generation failed" : "Higgsfield generation was canceled";
      throw new Error(reason ? `${label}: ${reason}` : `${label}.`);
    }
    // queued / in_progress → keep polling
  }
  throw new Error(`Higgsfield generation timed out after ${Math.round(POLL_TIMEOUT_MS / 1000)}s (last status: ${lastStatus}).`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
