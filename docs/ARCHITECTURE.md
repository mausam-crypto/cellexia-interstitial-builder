# Cellexia Interstitial Page Builder — Architecture

Developer-facing description of how the app is built. For the marketing-team manual see `docs/TEAM-GUIDE.md`.

The app is an embedded Shopify app (React Router 7 + `@shopify/shopify-app-react-router` + Polaris + Prisma) that lets the team build, duplicate, translate and publish native-ads "interstitial" pages (Glow25-style listicle → proof stack → offer) and serve them on the store's own domain at `https://cellexialabs.com/a/go/<slug>`.

---

## 1. Overview and the key design decision: App Proxy + `application/liquid`

**Pages are not stored in the theme.** They are rendered by the app and served through the Shopify **App Proxy** (`shopify.app.toml` → `[app_proxy] prefix = "a", subpath = "go", url = ".../proxy"`), handled by `app/routes/proxy.$.tsx`. The response uses the `liquid()` helper from `authenticate.public.appProxy(request)`, i.e. `Content-Type: application/liquid`. Shopify then:

1. wraps the body in the store's `theme.liquid` (real header/footer/fonts/cart drawer), even on a **legacy/vintage (non-OS 2.0) theme**;
2. evaluates the Liquid we emit, which is what makes prices, locale, market and routes correct without any JavaScript on our side.

The renderer emits exactly four kinds of Liquid (everything else is static HTML):

| Purpose | Liquid emitted (see `app/lib/render/render-page.ts`, `app/lib/sections/registry.ts`, `app/lib/commerce/cart-links.ts`) |
|---|---|
| Preamble | `{% assign _l = request.locale.iso_code %}{% assign _c = localization.country.iso_code %}` |
| Live prices | `{% assign _cxp = all_products['<handle>'] %}` + a variant lookup loop per card, then `{{ _cxv0.price \| money }}`, `divided_by`, `minus`, `times` for per-unit and "you save" math |
| Locale switch | `{% if _l == 'fr' %}…{% elsif _l == 'de' %}…{% else %}<source>{% endif %}` around every translated string |
| Market / routes | `{% if _c == 'DE' %}<url>{% else %}<url>{% endif %}` around cart links; `{{ routes.cart_url }}` (locale-prefixed automatically), `{{ routes.root_url }}` |

**Alternatives considered**

| Option | Why not |
|---|---|
| Theme app extension (app blocks / app-embed) | Requires an OS 2.0 theme for sections/blocks; the store runs a vintage theme. Extension Liquid files are also capped at 100 KB (comment in `render-page.ts`). |
| Writing Liquid templates/sections into the theme (Asset API) | Edits the live theme (risky, needs `write_themes`, breaks theme updates), each file is capped at 256 KB, and every publish becomes a theme deploy. |
| Standalone hosted page (plain HTML) | Loses the store header/footer, cookies, market/locale/currency context and first-party domain. |

The proxy path keeps the theme untouched, keeps one URL per funnel on the store domain, and lets Shopify do money formatting/localisation. The cost is that **the whole page must fit in one Liquid response**: `renderPage()` measures the compiled size and returns warnings at `LIQUID_SOFT_LIMIT` (200 KB) and `LIQUID_HARD_LIMIT` (256 KB); the editor header shows the KB count and `publishPage()` returns the warnings. The three seed pages compile to ~78–80 KB each.

### Request flows

```
Storefront visitor                       Shopify                          App (proxy.$.tsx)
GET cellexialabs.com/a/go/crepey-skin ─▶ signs + forwards to /proxy/… ─▶ authenticate.public.appProxy
                                                                          getPageBySlug → Page.compiled (Liquid)
                     ◀─ theme.liquid wraps body, evaluates Liquid ◀─────── liquid(html)  [application/liquid]
page-script.js  POST /a/go/_e {p,t,s,m,l,d,utm} ─────────────────────────▶ recordEvent → Event row

Admin (embedded)                          App
editor edits ──debounce 900 ms──▶ POST /app/pages/:id intent=save → saveDraft (Page.draft)
iframe GET /preview/:id?token=… ─────────▶ renderPage(mode:"preview", "Publish" ───────────────────────────────▶ publishPage → published snapshot + compiled Liquid
"Preview on store" GET /a/go/:slug?_preview=<token> ─▶ renderPage(draft, mode:"liquid", banner)
```

### Repository map

```
app/
  shopify.server.ts        shopifyApp() config, afterAuth → ensureSeeded
  db.server.ts             Prisma client singleton
  routes/                  file-based routes (see §8)
  components/editor/       SectionForm (generic field UI), Panels (list/page/commerce/translations), types
  lib/
    types.ts               PageContent / SectionInstance / FieldDef / BrandSettings / RenderContext
    brand.ts               DEFAULT_BRAND, mergeBrand, emptyPageContent, normalizePage
    pages.server.ts        settings + secrets (AES-GCM), page CRUD, publish/recompile/clone, analytics
    sections/registry.ts   the 20 SectionDefs, renderSection, collectTranslatableStrings
    sections/helpers.ts    esc/richText/localizedText/imgTag/ICONS/makeHelpers
    render/                render-page.ts (assembly, limits), page-css.ts, page-script.ts
    commerce/cart-links.ts buildCartUrl (permalink vs discount→add→cart), cardItems
    integrations/          shopify-files, deepl, claude, translate, higgsfield(+models), images
    seed/                  seed.server.ts (SEED_VERSION, seed: refs) + pages/*.ts
prisma/schema.prisma       Session, ShopSettings, Page, Event, ImageAsset
public/                    seed/*.jpg, builder/*.svg + admin.css, vendor/polaris.css
scripts/                   render-previews, size-check, verify-duplication, seed-cli
tests/                     render.test.ts, liquid.test.ts (liquidjs)
```

---

## 2. Data model

`prisma/schema.prisma` (SQLite in dev, switch `provider` to `postgresql` for prod). All JSON columns are strings, (de)serialised in `app/lib/pages.server.ts` (`safeJson`, `normalizePage`).

| Model | Purpose | Notable columns |
|---|---|---|
| `Session` | Shopify OAuth sessions (`PrismaSessionStorage`) | — |
| `ShopSettings` | one row per shop | `brand` (JSON `BrandSettings`), `secrets` (JSON of **encrypted** API keys), `defaults` (JSON `{proxyPrefix, storeDomain}`), `seedVersion`, `seededAt` |
| `Page` | one interstitial | `slug` (`@@unique([shop, slug])`), `draft` (JSON `PageContent`), `published` (frozen `PageContent` snapshot), `compiled` (+ `compiledAt`, cached Liquid), `previewToken` (cuid), `status` = `draft \| published \| archived`, `isTemplate`, `hasUnpublishedChanges`, `productHandle/Title` |
| `Event` | first-party analytics | `type`, `sessionId`, `cardIndex`, `market`, `locale`, `utmSource/Medium/Campaign`, `referrer`, `device` |
| `ImageAsset` | media library | `url`, `source` = `upload \| higgsfield \| claude-svg \| seed`, `prompt`, `alt`, `width/height` |

JSON shapes live in `app/lib/types.ts`:

```ts
interface PageContent {
  version: 1;
  sections: SectionInstance[];          // { id, type, hidden?, data: Record<string, any> }
  commerce: CommerceSettings;           // productHandle, discountCode, discountEnabled,
                                        // checkoutMode: "default"|"collection"|"checkout"|"cart", utmPassthrough,
                                        // livePrices, marketOverrides: { [ISO]: MarketOverride }
  stickyBar: { enabled, text, buttonLabel, showAfterSectionIndex };
  seo: { title, description, noindex };
  disclaimerOverride?: string;          // text only — the disclaimer itself can't be removed
  translations: Record<locale, Record<path, string>>;
  notes?: string; funnelLabel?: string;
}
```

`MarketOverride` = `{ discountCode?, discountEnabled?, cardVariantIds?: {cardIndex→variantId}, hideCards?: {cardIndex→bool}, crossSellUrl? }`. Pricing-card commerce (`variantId`, `quantity`, `addOns[]`) lives inside the pricing section's `cards[]` items (fields flagged `advanced: true`).

`BrandSettings` (`app/lib/brand.ts` → `DEFAULT_BRAND`, `mergeBrand`) holds colours/fonts/CTA style, global wording (`guaranteeShort`, `shippingLine`, `disclaimer`, `clinicsClaim`…), `paymentIcons`, `awardSealUrl`, `translations` (locale → key → string), `ai` (`claudeModel`, `imageProvider`, `higgsfieldModel`, `imageStyle`) and `discountDefaults`.

`normalizePage()` fills missing keys so old/partial JSON always has the full shape; `emptyPageContent()` is the base.

---

## 3. Section library

`app/lib/sections/registry.ts` defines the contract:

```ts
interface SectionDef {
  type: string; label: string; description: string; icon: string;
  category: "top"|"story"|"proof"|"offer"|"closing"|"generic";
  singleton?: boolean;                 // announcement_bar, hero, pricing
  fields: FieldDef[];                  // drives the editor UI + translation collection
  defaults: () => Record<string, any>;
  render: (h: SectionHelpers) => string;   // HTML (preview) or Liquid (storefront)
}
```

`SECTION_DEFS` (ordered), `SECTION_MAP`, `createSection(type)`, `renderSection(section, ctx)`, `collectTranslatableStrings(section)`.

### The 20 section types

| type | Glow25 section mirrored | Notes |
|---|---|---|
| `announcement_bar` | optional promo strip (NOT seeded — the theme already has an announcement bar/header/footer) | singleton; reads brand `shippingLine`/`guaranteeShort` by default |
| `hero` | listicle hero | singleton; eyebrow, H1, subhead, trust bar (` · `-split), CTA, badge strip, image |
| `reason` | "1. / 2. / 3." numbered reasons | image above, numeral, H2, rich body, optional CTA |
| `text_block` | "Here's why Cellexia works when everything else didn't" | tone/align, optional CTA |
| `purity` | purity & safety icon row | inline SVG icons (`ICONS`, `iconFor()` guesses from label) |
| `science` | "why it really works" numbered explainer | steps list + closing + CTA |
| `evidence` | "Is it really effective — or just marketing?" | study-citation slots |
| `pillars` | "why it's the best-selling…" 4-card grid | optional award seal (`brand.awardSealUrl`) |
| `expert_quote` | expert recommendation | portrait + quote |
| `pricing` | the offer | singleton; band `id="cx-offer"`; cards → cart links, live prices, add-ons, cross-sell |
| `guarantee` | "Not satisfied? You're covered" | seal uses `brand.guaranteeDays` |
| `comparison` | checkmark table | cells `✓ / ✗ / —` + text, ` \| `-separated |
| `timeline` | "The results you can expect" | phases with optional photos |
| `testimonials` | testimonial carousel | `data-cx-carousel`, arrows |
| `reviews` | "[12,000]+ five-star reviews" carousel | stars field |
| `faq` | Doctor FAQ accordion | `<details>` |
| `final_cta` | closing CTA | |
| `rich_text` | generic | |
| `image` | generic image (+caption) | const `image_section` |
| `cta_button` | standalone CTA band | |

Every non-cart CTA is `<a href="#cx-offer" data-cx-event="cta_click">` (`h.cta()`); `renderPage` warns if no visible pricing section exists.

### Field types drive the generic editor

`FieldType` = `text | textarea | richtext | image | url | boolean | select | number | color | list | stars`. `app/components/editor/SectionForm.tsx` → `FieldInput` switches on `field.type` (Polaris `TextField`/`Select`/`Checkbox`, `<input type=color>`, `ImageField`, recursive `ListField` for `list` with `item: FieldDef[]`, `minItems/maxItems`). Extra `FieldDef` hints: `help`, `placeholder`, `imagePrompt`/`imageAspect` (default AI prompt + ratio for the Generate dialog), `translatable` (default true for text/textarea/richtext), `advanced` (hidden from the generic form — commerce fields rendered by `CommercePanel`), `productSpecific` (see below). `SectionDef`s are serialised to the client as `ClientSectionDef` (`app/components/editor/types.ts`).

### Translatable strings and the path scheme

`collectTranslatableStrings(section)` walks `fields` against `data` and yields `{ path, value, fieldType }` with `path` =

- `sections.<sectionId>.<key>` (plain field)
- `sections.<sectionId>.<listKey>.<index>.<subKey>` (list item)
- split items: `…trust.<i>`, `…checks.<i>` (` · `-separated), `…bullets.<i>` (newline-separated), comparison `…rows.<i>.cells.<j>` (marker stripped)

`collectPageStrings(content)` in `app/lib/integrations/translate.server.ts` adds render-time derived strings (`…cards.<i>.perUnitSuffix`, `…cards.<i>.savePrefix`, `…sealText`) and page-level `stickyBar.text` / `stickyBar.buttonLabel`. Hidden sections are skipped. Brand strings are translated separately into `brand.translations[locale][key]` (`brandString()` in `helpers.ts`).

### `productSpecific` and the wizard

Fields flagged `productSpecific: true` (hero headline/subhead/trust/image, reason heading/body/image, science steps, evidence, pillars items, pricing cards, comparison columns/rows, timeline, testimonials, reviews, faq items, final CTA heading, variant ids…) are the ones the **New page from template** wizard (`app/routes/app.pages.new.tsx`) surfaces in step 3 (`SectionForm filter="product"`) and that `scripts/verify-duplication.ts` / `tests/render.test.ts` swap to prove a template + product swap yields a coherent page. Everything else (guarantee, purity, disclaimer, sticky bar…) carries over untouched.

---

## 4. Rendering pipeline

`renderPage(opts)` in `app/lib/render/render-page.ts`:

1. Builds a `RenderContext` (`mode: "liquid"|"preview"`, `brand`, `page`, `locales` = locales with ≥1 translation, `previewLocale/Market`, `storeRoot`, `proxyPath`, `eventsPath`).
2. Renders each non-hidden section through `renderSection()` → `makeHelpers(ctx, section)` (`app/lib/sections/helpers.ts`) → `def.render(h)`. A throwing section becomes an HTML comment + warning instead of failing the page.
3. Appends the **disclaimer** (always; `page.disclaimerOverride` or `brand.disclaimer`, translated), the **sticky mobile bar** (if enabled; trigger element = `cx-s-<id>` of the Nth visible non-announcement section) and inlines **CSS** (`pageCss(brand)` → `<style id="cx-css">`, everything namespaced under `#cx-page`/`.cx-*`, brand tokens as CSS variables `--cx-accent`, `--cx-ink`, `--cx-fh`…, full-bleed bands via `width:100vw;margin-left:calc(50% - 50vw)`) and **JS** (`pageScript(cfg)` → `<script id="cx-js">`, ~3 KB vanilla: carousels, sticky bar via IntersectionObserver, UTM capture into `sessionStorage.cx_utm`, analytics beacons, smooth-scroll for `#` CTAs).
4. Wraps in `<div id="cx-page" data-cx-page data-cx-slug data-cx-locale data-cx-market>` plus `<meta name="robots" content="noindex,nofollow">` unless `seo.noindex === false`, and a `document.title` script when `seo.title` is set. Optional `banner` (draft preview), `5. Returns `{ html, bytes, warnings, sectionCount }` and adds size warnings in liquid mode.

**Helpers** (`SectionHelpers`): `t(key, value)` translatable inline text, `rt()` translatable rich text (`richText()`: paragraphs, `**bold**`, `*italic*`, `- ` bullets), `e()` escape only, `img()` (`imgTag()`: srcset for `cdn.shopify.com` URLs via `?width=`, lazy/eager, visible placeholder box when empty), `cta()`, `cartHref()`, `band()`, `heading()`, `icons`.

**Escaping.** `esc(input, mode)` HTML-escapes `& < > " '`; in liquid mode it additionally turns `{`/`}` into `&#123;`/`&#125;` so user content can never open a Liquid tag (tested in `tests/render.test.ts` "neutralises Liquid tags typed into content").

**Preview vs liquid mode.** In preview the same renderer resolves everything statically: `localizedText()` picks `translations[previewLocale][path]`, `buildCartUrl()` uses `marketOverrides[previewMarket]`, cart URLs use `storeRoot` (`brand.storeUrl`), prices are the manual strings. In liquid mode it emits the switches described in §1.

**Live prices.** In `pricing.render` (liquid mode, `commerce.livePrices && productHandle`): `{% assign _cxp = all_products['handle'] %}` and per card `{% for _v in _cxp.variants %}{% if _v.id == <id> %}{% assign _cxvN = _v %}…`; the price block is `{% if _cxvN %}<live: compare_at | money, price | money, price | divided_by: qty | money, save + %>{% else %}<manual strings>{% endif %}` — so a wrong/removed variant silently falls back to the manual price (tested in `tests/liquid.test.ts`).

**Market overrides** wrap per-market cart URLs (`{% if _c == 'DE' %}…`) and per-market hidden cards (`{% unless _c == 'DE' or _c == 'AT' %}<li>…</li>{% endunless %}`).

**Sticky bar** is CSS-limited to ≤768 px (`.cx-sticky--armed{display:flex}` inside the media query), shows once the trigger section scrolled off and hides while the offer is in view.

---

## 5. Commerce wiring

`app/lib/commerce/cart-links.ts` — `buildCartUrl({ ctx, items, cardIndex })` → `buildSingleUrl()`:

| `checkoutMode` (page) → `effectiveCheckoutMode(commerce, brand)` | URL |
|---|---|
| `"default"` (page default) | resolves to `brand.afterAddToCart.mode` (Settings → After add to cart; store default `"collection"`) |
| `"collection"` (store default) | `{{ routes.cart_url }}/add?items[][id]=…&items[][quantity]=…&return_to={{ routes.collections_url }}/<afterAddToCart.collectionHandle>[?cx_cart=open]` — adds, then lands on Shop All; `cx_cart=open` makes the app embed (`extensions/cellexia-interstitial-helpers/blocks/cart-opener.liquid`) click the theme's cart trigger so the drawer opens; with a code: `/discount/CODE?redirect=<addUrl with & → %26>` |
| `"checkout"` | cart permalink `{{ routes.cart_url }}/<variantId>:<qty>,<variantId>:<qty>[?discount=CODE]` → straight to checkout |
| `"cart"` (Glow25 chain) | `{{ routes.cart_url }}/add?items[][id]=…&items[][quantity]=…&return_to={{ routes.cart_url }}`; with a code: `/discount/CODE?redirect=<addUrl with & → %26>` (`/discount/` is a root-level route, not locale-prefixed) |

- `cardItems(card)` = main variant + `addOns[]` (e.g. the free towel); `numericVariantId()` accepts GIDs or numbers. An add-on with `productHandle` becomes a guarded item: in Liquid mode the href is `{% if all_products['handle'].available %}<url with add-on>{% else %}<url without>{% endif %}` so an unpublished/out-of-stock gift never breaks the button (the towel product is currently not published to the Online Store — see HANDOVER-NOTES).
- The discount code is applied only if `discountEnabled` and the code is not a `[placeholder]`.
- Per-market: `discountCode`, `discountEnabled`, `cardVariantIds[cardIndex]` per ISO country → Liquid branches on `_c`; `hideCards` handled in the pricing renderer.
- If a card has no valid variant its button falls back to `#cx-offer`.
- **UTM → cart attributes** (`page-script.ts`): keys `utm_*`, `fbclid`, `gclid`, `ttclid`, `ref` are captured from the URL, persisted in `sessionStorage`, and on an add-to-cart click either appended as `attributes[k]=v` to the permalink (checkout mode) or POSTed to `/cart/update.js` before navigating (collection/cart modes; the button carries `data-cx-mode`); non-`utm_` keys are prefixed `cx_`.
- **Discount code check**: `app/routes/api.products.tsx` `checkDiscount` → `codeDiscountNodeByCode` (Admin GraphQL) surfaced as "Check in Shopify" in `CommercePanel`. Products/variants come from App Bridge `resourcePicker` when embedded, otherwise `byHandle`/`search` queries.

---

## 6. Publishing model

`app/lib/pages.server.ts`:

- **Draft** = `Page.draft`, autosaved by the editor (`intent=save`, `saveDraft()` → `hasUnpublishedChanges = true`).
- **Publish** = `publishPage()`: `published = draft` snapshot, `compiled = renderPage(mode:"liquid")`, `compiledAt`, `status = "published"`. Returns `warnings` + `bytes` shown in a banner. `unpublishPage()` sets `status = "draft"` (URL → 404); `archivePage()`; `deletePage()` cascades events.
- **`previewToken`** (unguessable cuid) protects two things: the in-admin iframe / shareable `GET /preview/<id>?token=…&locale=&market=&version=draft|published&chrome=0` (`app/routes/preview.$id.tsx`, preview mode + mock chrome, no Shopify session needed) and the on-store draft preview `GET /a/go/<slug>?_preview=<token>` (proxy route, liquid mode, `no-store`, yellow "DRAFT PREVIEW" banner, real theme + live prices).
- **`recompileAll(shop)`** re-renders every published page's snapshot after brand settings / defaults / brand translations change (`app/routes/app.settings.tsx`), so a policy change never means editing ten pages.
- **Proxy cache**: `proxy.$.tsx` keeps a module-level `Map<"shop:slug", {compiledAt, html}>`; a hit is only used when `compiledAt` matches the row, otherwise `Page.compiled` is served (and lazily generated if null). Response `Cache-Control: public, max-age=60, s-maxage=60`, `X-Robots-Tag` from `seo.noindex`.
- **Duplicate**: `clonePageContent()` deep-copies, regenerates section ids (`newSectionId`) and re-keys `translations` paths to the new ids; `duplicatePage()` creates a fresh draft with a unique slug (`uniqueSlug()`).

---

## 7. Analytics

`page-script.ts` sends `navigator.sendBeacon` (fallback `fetch keepalive`) to `<proxyPath>/_e` with `{ p: pageId, t: type, s: sessionId, m: market, l: locale, d: device, r: referrer, utm, c: cardIndex, sec: sectionId }`. `sessionId` lives in `sessionStorage.cx_sid`.

`proxy.$.tsx` `action` accepts only `POST /a/go/_e`, verifies the page belongs to the shop, and calls `recordEvent()` which whitelists `view | cta_click | card_click | add_to_cart | sticky_cta_click | cross_sell_click` and truncates fields. `getPageStats(shop, pageId, days)` aggregates in memory: views, unique visitors (sessions), CTA clicks, clicks per card index, add-to-carts, ATC rate, and breakdowns by day / `utm_source` / market. Used by `app._index.tsx` (30-day column) and `app.analytics.tsx` (7/30/90/365 days).

---

## 8. Admin UI

Routes are file-based (`app/routes.ts` → `flatRoutes()`):

| Route | Role |
|---|---|
| `app.tsx` | layout: App Bridge `AppProvider` + Polaris + `NavMenu`; `links()` load `/vendor/polaris.css` and `/builder/admin.css` |
| `app._index.tsx` | pages list (status, URL, 30-day stats, publish/unpublish/duplicate/delete); runs `ensureSeeded` if `seededAt` is null |
| `app.pages.$id.tsx` | the editor: 3 columns (`SectionList` \| `SectionForm` / `PageSettingsPanel` / `CommercePanel` / `TranslationsPanel` tabs \| preview iframe with mobile/desktop, locale, market) |
| `app.pages.new.tsx` | 5-step duplicate wizard (source & name → product & bundles → product-specific copy (+ Claude) → images → review) |
| `app.settings.tsx` | brand, global wording (+ translate), API keys, proxy prefix/store domain, re-seed |
| `app.analytics.tsx`, `app.help.tsx` | stats, in-app guide |
| `api.ai.tsx`, `api.upload.tsx`, `api.products.tsx` | JSON endpoints used by the editor (fetch from the client) |
| `preview.$id.tsx`, `proxy.$.tsx` | see §6 |
| `auth.*`, `webhooks.*`, `_index.tsx` | standard template plumbing |

**Autosave**: editor state is a `PageContent` in React; any change sets `dirty`, a 900 ms debounce submits `intent=save` via `useFetcher`; on success the preview iframe `key` bumps (reload) and the translatable-strings list refreshes. Publish flushes a pending save first. `beforeunload` warns when dirty.

**Dev mode**: `app/lib/auth.server.ts` `requireAdmin()` returns `{ shop: BUILDER_DEV_SHOP, admin: null, devMode: true }` when `BUILDER_DEV_SHOP` is set **and** `NODE_ENV !== "production"`. Then `app.tsx` skips App Bridge (Polaris + plain nav), the product/variant pickers fall back to `prompt()`, `api.products` returns 400, uploads become `data:` URLs, AI SVGs are returned as `data:` URLs, and locales/markets fall back to `en` / none (`shop-info.server.ts`). Run with `npm run dev:local`.

**Polaris CSS from `public/vendor/polaris.css`**: the usual `import polarisStyles from "@shopify/polaris/build/esm/styles.css?url"` broke under Node 23 with this Vite/React Router setup, so a static copy is served from `public/vendor` (comment in `app.tsx`: keep it in sync when upgrading Polaris). `public/builder/admin.css` holds the editor grid styles.

**Environment** (`.env.example`):

| Variable | Used by |
|---|---|
| `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SCOPES` | `shopify.server.ts` (injected by `shopify app dev`); `SHOPIFY_APP_URL` is also the fallback host for seed images |
| `DATABASE_URL` | Prisma (`file:./dev.sqlite` in dev) |
| `SESSION_SECRET` | key material for encrypting stored API keys |
| `ANTHROPIC_API_KEY`, `DEEPL_API_KEY`, `DEEPL_API_URL`, `HIGGSFIELD_API_KEY_ID`, `HIGGSFIELD_API_KEY_SECRET` | env fallbacks when no key is saved in Settings |
| `BUILDER_DEV_SHOP` | dev mode (see above); ignored when `NODE_ENV=production` |
| `SHOP_CUSTOM_DOMAIN` | optional `customShopDomains` for `shopifyApp()` |

Scopes (`shopify.app.toml`): `read_products` (pickers, product lookup), `read_files,write_files` (Shopify Files uploads), `read_locales,read_markets` (translation/market lists), `read_discounts,write_discounts` (code check), `read_themes`.

---

## 9. Integrations

All server-only, under `app/lib/integrations/`. Keys come from `getSettings(shop).secrets` (`ShopSecrets`): stored in `ShopSettings.secrets` encrypted with **AES-256-GCM** (`encrypt()/decrypt()` in `pages.server.ts`, key = `sha256(SESSION_SECRET || SHOPIFY_API_SECRET || "dev-secret")`, format `v1:<iv>:<tag>:<ciphertext>`), with env fallbacks `ANTHROPIC_API_KEY`, `DEEPL_API_KEY`, `DEEPL_API_URL`, `HIGGSFIELD_API_KEY_ID`, `HIGGSFIELD_API_KEY_SECRET`. The Settings screen only ever shows masked keys.

| File | What |
|---|---|
| `shopify-files.server.ts` | `uploadFileBuffer()` → `stagedUploadsCreate` (resource `IMAGE`, or `FILE` for SVG) → POST to the staged target → `fileCreate` → poll `node(id)` until `READY` (≤20 tries). `uploadFromUrl()` → `fileCreate` with `originalSource`. Returns CDN URL + dimensions. |
| `deepl.server.ts` | plain fetch; free keys (`:fx`) → `api-free.deepl.com`; Shopify → DeepL locale mapping (`pt-BR`, `no`→`NB`, `zh-Hant`…); batches of 50; `tag_handling: html`. |
| `claude.server.ts` | `@anthropic-ai/sdk`; `claudeTranslate()` (batches of 40, `output_config.format = json_schema`), `claudeGenerateSectionCopy()` (JSON schema built from the section's `FieldDef`s, excluding image/advanced/color fields; `mergeGenerated()` keeps images and commerce fields), `claudeGenerateSvg()` (+ `sanitizeSvg()` strips scripts, `foreignObject`, `on*`, external hrefs, `@import`, `url()`), `claudeImprovePrompt()`. Refusal/`max_tokens` are turned into readable errors. |
| `translate.server.ts` | orchestration: `collectPageStrings()`, dedupe identical strings, skip placeholder-only `[…]`, DeepL markdown↔HTML (`**bold**`→`<b>`, `translate="no"` around placeholders and product names), `translatePage()` (`onlyMissing`), `translateBrandStrings()`. |
| `higgsfield.server.ts` | `POST https://platform.higgsfield.ai/<model>` (`Authorization: Key <id>:<secret>`) → `{ request_id, status_url }` → poll every 3 s up to 4 min until `completed` (`images[0].url`) or `failed/nsfw/canceled`; `normalizeAspectRatio()` snaps to Soul ratios; models in `higgsfield-models.ts` (`higgsfield-ai/soul/standard` default, `nano-banana`, Flux, Reve). |
| `images.server.ts` | `generateImageAsset()` — Higgsfield (prompt + `brand.ai.imageStyle`, then **re-hosted on Shopify Files** via `uploadFromUrl`, provider URL kept if that fails) or `claude-svg` (uploaded as SVG file, palette from brand colours); records an `ImageAsset` row for the library. |

`app/routes/api.ai.tsx` exposes `{action: "image" | "section-copy" | "translate-page"}`; `api.upload.tsx` handles multipart uploads (≤20 MB).

---

## 10. Seeding

`app/lib/seed/seed.server.ts` + `seed/pages/{crepey-skin,jawline,dark-spots}.ts` — three baseline pages transcribed from the copy docs (18 sections each, `hero → reason×3 → text_block → purity → science → evidence → pillars → expert_quote → pricing → guarantee → comparison → timeline → testimonials → reviews → faq → final_cta`); Crepey Skin is `isTemplate: true`.

- Image references are `seed:<file>` strings; `collectSeedRefs()` finds them, `resolveSeedAssets()` uploads `public/seed/*.jpg` and `public/builder/*.svg` to Shopify Files (using the passed admin client or `unauthenticated.admin(shop)`), falling back to app-hosted URLs (`${SHOPIFY_APP_URL}/seed/…`), and `replaceSeedRefs()` rewrites the content. Assets are registered as `ImageAsset(source: "seed")`; `award-seal.svg` becomes `brand.awardSealUrl`.
- `ensureSeeded(shop, { admin?, force? })` is idempotent via `ShopSettings.seedVersion >= SEED_VERSION` (currently `1`). It runs from the `afterAuth` hook (`app/shopify.server.ts`), from `app._index` when `seededAt` is null, from Settings → "Re-seed baseline pages" (`force: true` overwrites the three drafts) and from `npm run seed -- <shop> [--force]`.

---

## 11. Testing and scripts

- `npm test` → vitest (`vitest.config.ts`, `tests/**/*.test.ts`, node env).
  - `tests/render.test.ts`: section library completeness, every type renders with defaults, seed pages have the 19 sections in order, placeholders preserved, every button resolves, variant wiring (+ free towel add-on), Liquid under the limit with preamble/live prices, disclaimer cannot be removed, cart-link modes, translation switch + fallback, `collectTranslatableStrings` splitting, Liquid-tag neutralisation, `clonePageContent` re-keying, template→product swap coherence.
  - `tests/liquid.test.ts`: runs the compiled Liquid through **liquidjs** with mocked `request.locale`, `localization.country`, `routes`, `all_products` and a `money` filter — proves the emitted tags evaluate, live prices/per-unit/you-save math is right, `fr` strings + `DE` override kick in, manual fallback when a variant is missing, and every seed page evaluates without errors.
- `npm run preview:static` (`scripts/render-previews.ts`) — writes `preview-out/<slug>.html` (preview mode + mock chrome) and `<slug>.liquid`, prints sizes vs limits.
- `npm run size:check` (`scripts/size-check.ts`) — compiled Liquid size of every page in the local DB.
- `npm run verify:duplicate` (`scripts/verify-duplication.ts`) — end-to-end: duplicate the template, swap product-specific fields for Jawline, render, assert, delete.
- `npm run seed` (`scripts/seed-cli.ts`).
- `npm run typecheck`, `npm run dev` (Shopify CLI), `npm run dev:local`, `npm run setup` (prisma generate + migrate deploy).

---

## 12. Extending

**Add a section type**: in `registry.ts` create a `SectionDef` (use the `text/textarea/rich/bool/select/list/img` helpers; give image fields an `imagePrompt`/`imageAspect`; flag product copy `productSpecific`; put commerce-ish fields behind `advanced`), implement `render(h)` using `h.t/h.rt/h.img/h.cta/h.heading/h.band` (never concatenate raw strings — go through `h.e`/`esc` so liquid-mode escaping applies), add CSS under `.cx-*` in `page-css.ts`, append to `SECTION_DEFS`. The editor, translation collection, wizard and Claude section-copy schema pick it up automatically. Add it to the list in `tests/render.test.ts` if it must always exist.

**Add a field type**: extend `FieldType` in `types.ts`, add a `case` in `FieldInput` (`SectionForm.tsx`), decide translatability in `collectTranslatableStrings` (only text/textarea/richtext are collected), and map it in `schemaFor()` in `claude.server.ts` if Claude may write it.

**Add an integration**: put a `*.server.ts` in `app/lib/integrations/` that takes its key explicitly, add the key to `ShopSecrets` + env fallback in `getSettings()`, expose it in `app.settings.tsx` (`intent=secrets`, masked), and add an `action` in `api.ai.tsx`.

**Conventions**: server-only modules end in `.server.ts`; all storefront markup is namespaced `cx-`; admin CSS `ib-`; translation paths are stable ids (never reorder-based); JSON columns are always run through `normalizePage`/`mergeBrand`; render errors are warnings, never 500s.

---

## 13. Known limitations and caveats

- **Proxy Liquid must stay < 256 KB** per page. Translations inflate the size roughly linearly (each translated string is emitted once per locale inside `{% if _l %}` branches; per-market overrides multiply cart-link URLs). Watch the KB counter; the renderer warns at 200 KB.
- Liquid mode branches at render time per locale/market, so anything dynamic must be expressible as `if/elsif` on `_l`/`_c` — no per-visitor logic beyond that.
- `all_products['handle']` is limited by Shopify (20 handles per template) — one product per page keeps us far below that.
- Shopify's CDN may cache proxied responses briefly (`max-age=60`); the in-memory cache in `proxy.$.tsx` is per process and keyed by `compiledAt`. Draft previews are `no-store`.
- The theme's CSS can still leak into the page (e.g. global `h1`, `a`, button rules); `page-css.ts` resets the basics under `#cx-page`, but a new theme may need small overrides there. Fonts (`argumentum`, `Gobold`) are expected to be loaded by the theme; the standalone preview loads Typekit itself.
- `fetchShopLocalesAndMarkets()` caches for 10 min in a single module-level slot (single-shop assumption). Session/market/locale lists come from `read_locales`/`read_markets`.
- Prisma uses **SQLite** in dev; production should switch the datasource to **PostgreSQL** (`DATABASE_URL`, `provider = "postgresql"`, re-run migrations). JSON is stored as strings so no schema change is needed.
- Polaris CSS is a **static copy** in `public/vendor/polaris.css` because the Vite `?url` CSS import broke on Node 23 in this setup — re-copy it when upgrading `@shopify/polaris`.
- Dev mode (`BUILDER_DEV_SHOP`) has no Admin API: pickers, uploads and re-hosting degrade to prompts / `data:` URLs; never enable it in production (it is guarded by `NODE_ENV`).
- Secrets are only as safe as `SESSION_SECRET`; rotating it invalidates stored keys (they decrypt to `""` and fall back to env).
- Section-copy generation and translations return **suggestions**; bracketed placeholders are deliberately preserved and must be filled by a human before publishing.

## Store header/footer, header hide, previews

- On the storefront the app-proxy response is wrapped by `theme.liquid`, so the theme's real announcement bar, header, footer and cart drawer are always present — the app never renders its own chrome.
- **Header hide** (`PageContent.header`: `default|show|hide`; `BrandSettings.showHeader` default `true`; `BrandSettings.headerSelectors`): `renderPage()` emits `<style id="cx-hide-header">{selectors}{display:none!important}</style>` inside `#cx-page` when hidden (per page, or globally unless the page forces "show"). Same output in liquid and preview modes.
- **Previews** (`app/routes/preview.$id.tsx`, `scripts/render-previews.ts`): the store cannot be iframed (`X-Frame-Options: DENY`), so `app/lib/render/theme-shell.server.ts` fetches the store homepage (15-min cache), keeps `<head>` stylesheets/inline styles/viewport meta, the `<body>` attributes and everything outside `<main>` (scripts, `on*` handlers, preload hints stripped; root-relative URLs re-pointed at the store), and `wrapInThemeShell()` places the rendered page inside `<main id="main">`. A tiny inline script re-creates the theme's `main{padding-top}` offset for its fixed header wrapper. `?shell=0` on the preview URL disables the wrapper; offline it falls back to a plain document.
- **Theme app extension** `extensions/cellexia-interstitial-helpers` (`type = "theme"`, app embed block, target `body`) — deployed with `shopify app deploy`, enabled in the theme editor → App embeds. Runs only when the URL has `?cx_cart=open`: clicks the first visible element matching the configured selector (default `button.icon--cart, [data-cart-toggle], a[href$="/cart"]`), retrying up to 12× every `delay_ms`, then removes the parameter from the URL. Works on vintage themes because app embeds are injected through `content_for_header`.
