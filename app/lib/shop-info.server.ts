import type { LocaleInfo, MarketInfo } from "../components/editor/types";

const LOCALE_NAMES: Record<string, string> = {
  en: "English", fr: "French", de: "German", es: "Spanish", it: "Italian", nl: "Dutch", da: "Danish", sv: "Swedish", no: "Norwegian", fi: "Finnish", pl: "Polish", pt: "Portuguese",
  "pt-BR": "Portuguese (Brazil)", "pt-PT": "Portuguese (Portugal)", ro: "Romanian", hu: "Hungarian", el: "Greek", ar: "Arabic", ja: "Japanese", cs: "Czech", sk: "Slovak", tr: "Turkish", zh: "Chinese",
};

let cache: { at: number; shop: string; value: { locales: LocaleInfo[]; markets: MarketInfo[] } } | null = null;

/** Published shop locales + enabled markets' countries (cached 10 min). Falls back to sensible defaults without an admin session. */
export async function fetchShopLocalesAndMarkets(admin: any | null): Promise<{ locales: LocaleInfo[]; markets: MarketInfo[] }> {
  const fallback = { locales: [{ locale: "en", name: "English", primary: true }], markets: [] as MarketInfo[] };
  if (!admin) return fallback;
  try {
    if (cache && Date.now() - cache.at < 10 * 60 * 1000) return cache.value;
    const res = await admin.graphql(`{ shopLocales { locale primary published } markets(first: 50) { nodes { name enabled regions(first: 50) { nodes { ... on MarketRegionCountry { code name } } } } } }`);
    const json: any = await res.json();
    const locales: LocaleInfo[] = (json.data?.shopLocales || []).filter((l: any) => l.published).map((l: any) => ({ locale: l.locale, name: LOCALE_NAMES[l.locale] || l.locale, primary: !!l.primary }));
    const markets: MarketInfo[] = [];
    const seen = new Set<string>();
    for (const m of json.data?.markets?.nodes || []) {
      if (!m.enabled) continue;
      for (const r of m.regions?.nodes || []) {
        if (r?.code && !seen.has(r.code)) {
          seen.add(r.code);
          markets.push({ code: r.code, name: `${r.name}${m.name && m.name.toLowerCase() !== r.name.toLowerCase() ? ` · ${m.name}` : ""}` });
        }
      }
    }
    markets.sort((a, b) => a.name.localeCompare(b.name));
    const value = { locales: locales.length ? locales : fallback.locales, markets };
    cache = { at: Date.now(), shop: "", value };
    return value;
  } catch (e) {
    console.warn("[shop-info] falling back", (e as any)?.message);
    return fallback;
  }
}
