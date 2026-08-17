/**
 * DeepL translation client (plain fetch, no SDK).
 *
 * - Free keys end with ":fx" and must hit api-free.deepl.com; paid keys hit api.deepl.com.
 * - Shopify locale codes ("en", "pt-BR", "no"…) are mapped to DeepL codes.
 * - Requests are batched at 50 texts (DeepL's per-request limit).
 */

const MAX_TEXTS_PER_REQUEST = 50;

/** Languages DeepL can translate INTO (Shopify-style lowercase codes). */
const SUPPORTED_TARGETS = new Set([
  "ar", "bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "hu", "id", "it", "ja", "ko", "lt", "lv",
  "nb", "nl", "pl", "pt", "ro", "ru", "sk", "sl", "sv", "tr", "uk", "zh",
  // aliases that we map onto the list above
  "no", "pt-br", "pt-pt", "en-gb", "en-us", "zh-hans", "zh-hant",
]);

/** True when DeepL can produce this locale (case-insensitive; region suffixes are tolerated). */
export function deeplSupportedTarget(locale: string): boolean {
  const l = String(locale || "").trim().toLowerCase();
  if (!l) return false;
  if (SUPPORTED_TARGETS.has(l)) return true;
  const base = l.split(/[-_]/)[0];
  return SUPPORTED_TARGETS.has(base);
}

/** Map a Shopify locale to the DeepL code for a target_lang / source_lang param. */
export function toDeeplLang(locale: string, role: "source" | "target"): string {
  const l = String(locale || "").trim().toLowerCase();
  const base = l.split(/[-_]/)[0];
  const region = l.split(/[-_]/)[1];
  if (base === "en") {
    if (role === "source") return "EN";
    if (region === "us") return "EN-US";
    return "EN-GB";
  }
  if (base === "pt") {
    if (role === "source") return "PT";
    return region === "br" ? "PT-BR" : "PT-PT";
  }
  if (base === "no" || base === "nb") return "NB";
  if (base === "zh") {
    if (role === "source") return "ZH";
    return region === "hant" ? "ZH-HANT" : "ZH-HANS";
  }
  return base.toUpperCase();
}

export interface DeeplTranslateOpts {
  apiKey: string;
  /** Override the API base (e.g. a proxy). Defaults to the free/paid host inferred from the key. */
  apiUrl?: string;
  texts: string[];
  /** Shopify locale, e.g. "de", "pt-BR" */
  targetLang: string;
  sourceLang?: string;
  tagHandling?: "html" | "xml";
}

/**
 * Translate a list of strings. The result array is index-aligned with `texts`.
 * Throws with a readable message on any non-2xx response.
 */
export async function deeplTranslate(opts: DeeplTranslateOpts): Promise<string[]> {
  const apiKey = String(opts.apiKey || "").trim();
  if (!apiKey) throw new Error("DeepL API key is missing. Add it in Settings → Integrations.");
  const texts = opts.texts || [];
  if (!texts.length) return [];

  const base = (opts.apiUrl || (apiKey.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com")).replace(/\/+$/, "");
  const endpoint = base.endsWith("/v2/translate") ? base : `${base}/v2/translate`;
  const target_lang = toDeeplLang(opts.targetLang, "target");
  const source_lang = opts.sourceLang ? toDeeplLang(opts.sourceLang, "source") : undefined;

  const out: string[] = new Array(texts.length);
  for (let start = 0; start < texts.length; start += MAX_TEXTS_PER_REQUEST) {
    const chunk = texts.slice(start, start + MAX_TEXTS_PER_REQUEST);
    const body: Record<string, unknown> = { text: chunk, target_lang, preserve_formatting: true };
    if (source_lang) body.source_lang = source_lang;
    if (opts.tagHandling) body.tag_handling = opts.tagHandling;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(describeDeeplError(res.status, detail));
    }
    const json = (await res.json().catch(() => null)) as { translations?: Array<{ text: string }> } | null;
    const translations = json?.translations || [];
    if (translations.length !== chunk.length) {
      throw new Error(`DeepL returned ${translations.length} translations for ${chunk.length} texts.`);
    }
    translations.forEach((t, i) => (out[start + i] = String(t.text ?? "")));
  }
  return out;
}

function describeDeeplError(status: number, detail: string): string {
  let message = "";
  try {
    message = JSON.parse(detail)?.message || "";
  } catch {
    message = detail.slice(0, 200);
  }
  const hint =
    status === 403
      ? "Invalid DeepL API key (403). Check the key — free keys end with ':fx'."
      : status === 456
        ? "DeepL quota exceeded (456) for this billing period."
        : status === 429
          ? "DeepL rate limit hit (429). Try again in a moment."
          : status === 400
            ? "DeepL rejected the request (400) — likely an unsupported language."
            : `DeepL request failed (${status}).`;
  return message ? `${hint} ${message}` : hint;
}
