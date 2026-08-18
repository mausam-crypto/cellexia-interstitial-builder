# Handover notes — what was verified, what still needs a human

Built 16 Aug 2026 against the live Cellexia Labs store data (product handles, variant IDs, CDN images, locales, markets were read from the store via the Shopify Admin API).

## Verified end-to-end (automated + in-browser)

| Check | How | Result |
|---|---|---|
| All 20 section types render (preview + Liquid) | `npm test` → tests/render.test.ts | ✓ |
| The 3 baseline pages have all 18 page sections in the copy-doc order (the theme supplies announcement bar/header/footer); placeholders `[12,000]`, `Dr. [FULL NAME]`, `[Lead author]` stay visible | tests | ✓ |
| Every `<a>` on each page resolves to `#cx-offer`, the cart/checkout, `/discount/…`, or the cross-sell product — nothing else | tests | ✓ |
| Pricing cards wire the doc's variant IDs; **no free gift** on any card (towel removed 2026-08-17); optional add-ons with a product handle stay guarded by `all_products[handle].available` | tests | ✓ |
| v2 data migration (`SEED_VERSION` 1 → 2): on the next app load every existing page (draft + published + compiled Liquid) has the towel add-on, gift line, gift image and their translations removed; idempotent | tests + simulated v1 store | ✓ |
| v3 data migration (`SEED_VERSION` → 3): pages still carrying v1's explicit `checkoutMode: "checkout"` (which kept sending visitors straight to checkout even after v2) are reset to "Store default" and recompiled → buttons add to cart and land on `/collections/shop-all?cx_cart=open` | tests + simulated v1 store (published page's compiled Liquid flips from permalink to `/cart/add?…&return_to=…/shop-all?cx_cart=open`) | ✓ |
| Store default add-to-cart: `/cart/add?items[][id]=…&return_to=/collections/shop-all?cx_cart=open` (with code: `/discount/CODE?redirect=…`); page overrides "checkout" / "cart"; Settings change the default, the collection and the drawer flag | tests | ✓ |
| Live store: GET `/cart/add?items[][id]=42686740791432&items[][quantity]=1&return_to=/collections/shop-all?cx_cart=open` → 302 to Shop All, item in `/cart.js`; the app-embed logic (click `button.icon--cart` when `?cx_cart=open`) opens the theme's mini-cart (`.mini-cart.is-open`) on the real Shop All page | curl + in-browser on cellexialabs.com | ✓ |
| One-click images: slot collection (ids, kinds, context incl. list copy), skip policy (real portrait/packshots/icons/hidden sections), prompt application (keeps images/alt, `promptAlt`), per-section digest budget, prompt-writer system/user prompts, Claude call with a mocked SDK (provider forced by kind, unknown ids dropped, id enum in schema), list-item identity (reorder follows the item, removal drops the write), autosave race, stale-closure writers; Images tab + wizard step render in the browser | tests/images.test.ts, tests/image-prompts.test.ts, 3-lens adversarial review workflow (28 agents) + fixes, in-browser | ✓ (live Claude/Higgsfield calls need the store's API keys — same code path as the existing single-slot generation) |
| Prompts page: edit/save/reset of the writer system prompt, message template, SVG prompt, style suffix and per-slot defaults; overrides reach the Claude call (mocked SDK test), the editor's slot defaults and the API | tests/image-prompts.test.ts, in-browser round trip | ✓ |
| Per-variant selling plans: real store mapping (1 jar → 718190313847 every 2 months; 2/3 jars → 718190281079 every 3 months) auto-wired per variant, wrong wiring corrected, variant without plan → ""; below-button note + custom button label render and follow the fallback | tests/subscription.test.ts | ✓ |
| Subscription mode hardening (review): whole-card one-time fallback (price/lines/label/href/mode) when the plan isn't offered, availability check with live prices off, prepaid per-delivery price, no fabricated defaults + preset refresh keeping team edits, sticky label restore, FAQ translation re-keying, product change reset, fixed-amount/price policies | tests/subscription.test.ts (hardening block) | ✓ |
| Subscription mode: selling-plan flattening from real store nodes (Body Wrinkle Cream: "Every 2/3 Months · 5% off", ids 718190313847 / 718190281079) + synthetic intro/trial; cart links with `selling_plan` (Shop All / cart / checkout via `/cart/add … return_to=/checkout`); presets apply/remove round-trip; preview lines/terms/hrefs; Liquid with mocked `selling_plan_allocations` (5% simple, intro first/then, market without plan → one-time fallback or hidden card); manual price derivation | tests/subscription.test.ts, in-browser (mode switch, plan ids, autosave, preview) | ✓ |
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
11. **Free gift removed** (2026-08-17): the interstitials no longer offer the Bamboo Beauty Towel — no add-on, no gift line/image on the 3-pack. Existing stores are cleaned automatically on the next app load (migration v2, see above); nothing to do. (Background: the towel product was never published to the Online Store channel, so it could not be added from the storefront anyway.) If a gift is ever wanted again: Commerce tab → 3-pack card → "Also add to cart" + gift line, and publish the gift product to Online Store first.
12. **"Add to cart still goes straight to checkout" after upgrading from v1** — that was the pages themselves: v1 stored `checkoutMode: "checkout"` on every page (the only mode back then) and a page-level value overrides Settings → After add to cart. Fixed by migration v3 (runs automatically when the app is next opened after deploying this build); afterwards the Commerce tab of each page shows "Store default" and the store default is spelled out under the select. If a single page should still go straight to checkout, pick it explicitly there.
13. **Enable the app embed** "Open cart after add" (Online Store → Themes → Customize → App embeds) after `shopify app deploy`, so the cart drawer opens on Shop All after an add-to-cart. Not required for the add/redirect itself. **Symptom when it's off:** the visitor lands on `/collections/shop-all?cx_cart=open` with the items in the cart but the drawer stays closed — that was the case on 2026-08-17 (the storefront HTML of Shop All had no `data-cx-cart-opener` script among the app blocks). **How to check:** view-source of any store page → search `data-cx-cart-opener` (present = enabled). The script itself was verified on the live Shop All page: with the parameter it opens `.mini-cart.is-open` and cleans the URL. If the theme is ever changed, adjust the two selectors in the embed's settings (trigger + "drawer is open when this matches").
14. **Higgsfield image generation 422 "Input should be '720p' or '1080p'"** (seen 2026-08-17): the Soul API renamed its `resolution` values (was `1K`/`2K`). Fixed: the app now sends `1080p` by default (legacy values are mapped) and, if Higgsfield ever rejects a literal again, it retries once with the value the API says it expects — so a future rename won't block image generation.

## Image manifest — what was reused vs generated

- REUSE (Angle sheets, already generated): all before/after diptychs, application close-ups, "before" profiles, jawline hero, dark-spot hero — bundled in `public/seed/`, re-hosted to Shopify Files on install.
- GENERATED (Higgsfield Soul, same unretouched UGC style): crepey-skin hero lifestyle shot (+ an alternate in the library), 12 testimonial portraits (4 per page).
- GENERATED as crisp editorial SVG (translatable, tiny): skin-layer diagram, scaffold/house-frame diagram, pigment-switch diagram, award seal placeholder.
- Shopify CDN: jars/tubes/box product shots.
- Library extras (not placed): legs + upper-arm problem shots (Angle 1 IMG-C/D), pearl-dab macro, alternate hero.

## Known caveats

- Translations increase the Liquid size (each translated string adds a locale branch). 18 store locales × full page would exceed 256 KB — translate the languages you actually run ads in (the app warns near the limit).
- The in-admin preview wraps the page in the store's real announcement bar/header/footer (fetched from the live storefront, scripts stripped, cached 15 min) with the manual prices; "Preview on store" shows the real thing with live prices and a working cart. If the store can't be reached the preview falls back to the page content only.
- Header show/hide is CSS on the theme's header group (`Settings → Store header → selectors`, default `#shopify-section-header, #shopify-section-alert-bar, #shopify-section-ticker, …`). If the theme is changed, update the selectors.
- Cart-drawer auto-open after add-to-cart relies on the app embed `extensions/cellexia-interstitial-helpers` being enabled in the theme editor (App embeds). It clicks the theme's cart trigger (`button.icon--cart` on the current Cellexia theme — configurable in the embed's settings) when the URL carries `?cx_cart=open`.
- The `notes` field of each page lists the doc's production notes.
