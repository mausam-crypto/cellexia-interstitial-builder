# Handover notes — what was verified, what still needs a human

Built 16 Aug 2026 against the live Cellexia Labs store data (product handles, variant IDs, CDN images, locales, markets were read from the store via the Shopify Admin API).

## Verified end-to-end (automated + in-browser)

| Check | How | Result |
|---|---|---|
| All 20 section types render (preview + Liquid) | `npm test` → tests/render.test.ts | ✓ |
| The 3 baseline pages have all 18 page sections in the copy-doc order (the theme supplies announcement bar/header/footer); placeholders `[12,000]`, `Dr. [FULL NAME]`, `[Lead author]` stay visible | tests | ✓ |
| Every `<a>` on each page resolves to `#cx-offer`, the cart/checkout, `/discount/…`, or the cross-sell product — nothing else | tests | ✓ |
| Pricing cards wire the doc's variant IDs; 3-pack adds the free Bamboo Beauty Towel (55089188438391), guarded by `all_products['bamboo-beauty-towel'].available` on the storefront | tests | ✓ |
| Store default add-to-cart: `/cart/add?items[][id]=…&return_to=/collections/shop-all?cx_cart=open` (with code: `/discount/CODE?redirect=…`); page overrides "checkout" / "cart"; Settings change the default, the collection and the drawer flag | tests | ✓ |
| Live store: GET `/cart/add?items[][id]=42686740791432&items[][quantity]=1&return_to=/collections/shop-all?cx_cart=open` → 302 to Shop All, item in `/cart.js`; the app-embed logic (click `button.icon--cart` when `?cx_cart=open`) opens the theme's mini-cart (`.mini-cart.is-open`) on the real Shop All page | curl + in-browser on cellexialabs.com | ✓ |
| Store header shows by default; hidden per page (`header: "hide"`) or globally (Settings) via `<style id="cx-hide-header">`; forced "show" wins over the global hide | tests | ✓ |
| Previews wrapped in the real theme header/footer (fetched from cellexialabs.com; scripts stripped; root-relative URLs re-pointed; page assets stay app-relative); header offset re-created; hidden-header variant collapses the offset | tests + in-browser (desktop/mobile) | ✓ |
| Compiled Liquid ≈ 77–78 KB per page (Shopify limit 256 KB per Liquid file) | tests, `npm run size:check` | ✓ |
| Liquid evaluates in a real Liquid engine (liquidjs) with mocked Shopify globals: live prices, per-unit + you-save math, locale switch (`request.locale`), market override (`localization.country`), locale-aware `routes.cart_url` | tests/liquid.test.ts | ✓ |
| Disclaimer always renders even when a page tries to remove it | tests | ✓ |
| Duplication: template → new draft (fresh section ids, translations re-keyed) → product-specific fields swapped for Jawline → coherent, publishable page; shared guarantee/purity/pillars/disclaimer carried over; test page removed | `npm run verify:duplicate` | ✓ (38 fields swapped) |
| App proxy route with a Shopify-style HMAC-signed request: 404 when unpublished, draft preview via token (200 + banner), publish via admin action, live page (`application/liquid`, `X-Robots-Tag: noindex`), analytics beacon (204, event stored) | curl against local server | ✓ |
| Admin UI: pages list, editor (autosave, preview refresh, commerce tab), wizard, settings, analytics render | in-browser (dev mode) | ✓ |
| Visual: hero, reasons, pricing (center card enlarged/badged), comparison table, timeline, testimonials on desktop; hero, pricing, sticky bar on mobile | in-browser screenshots | ✓ |

Not verifiable from here (needs the app installed on the store): the real theme's CSS around the proxied content, Shopify's own proxy caching, and the resource picker inside the embedded admin. All three are standard and documented in ARCHITECTURE.md; if the theme's `.container` constrains width, keep "Full-bleed section bands" on (default) or adjust `--cx-max` in Settings → fonts/brand.

## Before the first publish (team)

1. **Placeholders** on every page: `[250,000]+`, `[12,000]+` (hero trust bar, review heading, sticky bar), `Dr. [FULL NAME]` (expert quote + FAQ heading) — never invent numbers.
2. **Doctor**: real endorsing dermatologist (with consent) — name, credential line, portrait (Expert quote section).
3. **Study citations** (Clinical evidence section): 3 slots from the clinical dossier.
4. **Award seal**: `public/builder/award-seal.svg` is a placeholder — upload the official 2026 European Cosmetic Prize artwork in Settings → "Award seal image URL" and in the hero badge.
5. **Guarantee**: written as 60-day. Confirm policy; if 90-day, change once in Settings (guarantee days + short wording) and re-check the guarantee/timeline copy on each page.
6. **Discount codes**: `CREPE20` / `JAWLINE20` / `SPOTS20` are prefilled but **turned off** (the bundle variants already carry the 15 %/20 % prices). Create the codes in Shopify → Discounts, then flip the toggle in Commerce (use "Check in Shopify").
7. **Compare-at prices**: the Dark Spot 2- and 3-tube variants have no compare-at price in Shopify → the live strikethrough/you-save math falls back to the manual lines. Setting compare-at €114 / €171 on those variants makes it automatic in every market.
8. **Cross-sell**: the Jawline page links "The Sculpt & Define Lift" which is a DRAFT product — activate it before publishing (or turn the cross-sell card off).
9. **API keys** in Settings for AI copy/translation/images (Anthropic, DeepL, Higgsfield). Higgsfield keys come from cloud.higgsfield.ai.
10. **Product images**: the 3-jar cards use lifestyle shots (IMG_3618 / IMG_3613) — replace with real bundle packshots when available.
11. **Free gift towel is not purchasable on the storefront yet**: the "Bamboo Beauty Towels" product (variant 55089188438391, SKU 600007) is ACTIVE but **not published to the Online Store channel** (`publishedAt: null`; `/variants/55089188438391.js` → 404; adding it via `/cart/add` → "Cannot find variant"). Publish it to Online Store (Products → Bamboo Beauty Towels → Sales channels → Online Store) so the 3-pack really adds the gift. Until then the compiled pages **automatically leave the gift out** of the button (Liquid `all_products['bamboo-beauty-towel'].available` guard) so add-to-cart never breaks; the "free towel" copy on the cards would then over-promise — check before publishing.
12. **Enable the app embed** "Interstitial: open cart after add" (Online Store → Themes → Customize → App embeds) after `shopify app deploy`, so the cart drawer opens on Shop All after an add-to-cart. Not required for the add/redirect itself.

## Image manifest — what was reused vs generated

- REUSE (Angle sheets, already generated): all before/after diptychs, application close-ups, "before" profiles, jawline hero, dark-spot hero — bundled in `public/seed/`, re-hosted to Shopify Files on install.
- GENERATED (Higgsfield Soul, same unretouched UGC style): crepey-skin hero lifestyle shot (+ an alternate in the library), 12 testimonial portraits (4 per page).
- GENERATED as crisp editorial SVG (translatable, tiny): skin-layer diagram, scaffold/house-frame diagram, pigment-switch diagram, award seal placeholder.
- Shopify CDN: jars/tubes/box/towel product shots.
- Library extras (not placed): legs + upper-arm problem shots (Angle 1 IMG-C/D), pearl-dab macro, alternate hero.

## Known caveats

- Translations increase the Liquid size (each translated string adds a locale branch). 18 store locales × full page would exceed 256 KB — translate the languages you actually run ads in (the app warns near the limit).
- The in-admin preview wraps the page in the store's real announcement bar/header/footer (fetched from the live storefront, scripts stripped, cached 15 min) with the manual prices; "Preview on store" shows the real thing with live prices and a working cart. If the store can't be reached the preview falls back to the page content only.
- Header show/hide is CSS on the theme's header group (`Settings → Store header → selectors`, default `#shopify-section-header, #shopify-section-alert-bar, #shopify-section-ticker, …`). If the theme is changed, update the selectors.
- Cart-drawer auto-open after add-to-cart relies on the app embed `extensions/cellexia-interstitial-helpers` being enabled in the theme editor (App embeds). It clicks the theme's cart trigger (`button.icon--cart` on the current Cellexia theme — configurable in the embed's settings) when the URL carries `?cx_cart=open`.
- The `notes` field of each page lists the doc's production notes.
