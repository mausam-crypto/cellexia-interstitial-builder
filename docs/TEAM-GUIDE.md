# Interstitial Page Builder — team guide

This is the plain-language manual for the marketing team. No code, no developers needed.

**Where:** Shopify admin → Apps → **Cellexia Interstitial Builder**.
**What it does:** builds the "proof stack" pages that sit between an advertorial and the cart, at
`https://cellexialabs.com/a/go/<page-slug>`, inside our normal store header and footer.

Three pages are already in the app: **Crepey Skin (the master template)**, **Jawline — 10-Second Ritual**,
**Dark Spots — Canceled the Laser**. They are exact transcriptions of the copy docs. They are drafts — fill the
bracketed placeholders, preview, publish.

---

## 1. The pages list

- **Pages** shows every page with its status (Draft / Live / "Unpublished changes"), URL, and last-30-day numbers.
- **Edit** opens the editor. **Preview** opens the draft in a new tab. **Duplicate** copies a page.
  **Publish** makes it live at its URL. **Unpublish** takes it down (URL returns 404). **Delete** removes it.
- **New page from template** starts the guided wizard (see §4).

## 2. Edit a section

1. Open a page. Left column = the sections in order. Middle = the fields of the selected section. Right = live preview (Mobile / Desktop).
2. Click a section on the left, change any field. **Everything autosaves as a draft** (you'll see "Saving… / Saved" next to the title). The preview refreshes by itself.
3. Reorder with ▲▼ or by dragging. **👁** hides a section (it stays in the page but doesn't render). **⧉** duplicates it. **✕** removes it. **+ Add section** shows the whole library (hero, reason, evidence, pillars, pricing, testimonials, FAQ …).
4. Text formatting in the bigger boxes: blank line = new paragraph, `**bold**`, `*italic*`, lines starting with `- ` become bullets.
5. Lists (badges, steps, citations, cards, testimonials, FAQ items…): open an item with **+**, reorder with ▲▼, add with the button under the list.
6. Anything in **[square brackets]** — `[12,000]+ reviews`, `[250,000]+ jars`, `Dr. [FULL NAME]`, the three `[Lead author]` study slots — is a placeholder we still have to fill. It shows on the page exactly like that until you replace it. **Never publish with placeholders left.**
7. **Page settings** tab: title, URL slug, funnel label, browser title/description, hide from search engines (keep on for paid traffic), sticky mobile bar text/button, team notes. The **disclaimer** is always shown at the bottom of every page and cannot be removed — you can only change the wording (per page, or for all pages in Settings).

## 3. Replace an image

In any image field:
- **Upload** a file — it is stored in Shopify Files (our CDN) and added to the library.
- **URL** — paste a link (e.g. a Shopify CDN product image).
- **Library** — everything uploaded or generated so far (all seed images, before/after diptychs, portraits, diagrams…).
- **Generate with AI** — the slot has a default prompt written for it (e.g. "candid unretouched portrait of a woman aged 55–70…"). Edit it, choose **Higgsfield** (photos) or **Claude** (SVG diagrams), click Generate (about a minute). Our brand style ("unretouched, natural light, no text…") is added automatically. The result is saved to the CDN and the library.
- Add **alt text**. **Remove** clears the slot (the page then shows a visible "image slot" box so you don't forget it).

Product shots: use the Shopify product images (jar 5M2A1560_1, jawline jar 5M2A1565_1, dark-spot tube, towel Towel1). The doctor portrait must be a **real** endorsing dermatologist's photo — never generate one.

## 4. Duplicate a page for a new product (minutes, not days)

Pages → **New page from template** (or Duplicate → "Use the guided wizard").

1. **Source & name** — which page to copy (the template is offered first), the new title, the URL slug (`/a/go/neck-cream` etc. — one URL per funnel keeps tracking clean), a funnel label.
2. **Product & bundles** — **Choose product** (Shopify picker). The 1 / 2 / 3-unit variants map to the three cards automatically — check the variant IDs, units and unit label ("jar"/"tube"), and the manual price lines (they're the fallback and what the preview shows). The free-gift add-on (Bamboo Beauty Towel on the 3-pack) carries over. Set the **discount code** — turn it **on** to append the code to every add-to-cart link, or leave it **off** to rely on the built-in 2-unit / 3-unit bundle prices we already have. Choose "straight to checkout" (default, like the copy doc) or "add to cart, open cart page".
3. **Product-specific copy** — only the fields that change per product: headline, subhead, trust bar, the three reasons (image + heading + body), differentiation, science steps, evidence, pillars, expert quote, pricing cards/footnote/cross-sell, comparison table columns/rows, timeline, testimonials, reviews, FAQ, final CTA. Optional: write a **brief** and let **Claude draft all of them** in the same structure/tone (images untouched, nothing invented beyond the brief) — then read every field.
4. **Images** — every image slot with keep / upload / library / generate.
5. **Review & create** — a draft page opens in the editor. Shared elements (announcement bar, guarantee, purity, pillars, disclaimer, sticky bar) came over automatically and follow the global Settings.

## 5. Bundles, discount code, links (Commerce tab)

- Each pricing card sells one Shopify **variant** (+ optional add-ons like the free towel). Buttons build the cart link for you:
  - **Straight to checkout**: `/cart/<variant>:1,<gift>:1?discount=CODE`
  - **Add to cart → cart page**: `/discount/CODE?redirect=/cart/add?…&return_to=/cart`
- **Discount code**: toggle on/off; "Check in Shopify" tells you whether the code exists (create it in Shopify → Discounts first). Off = the store's default 2/3-unit bundle prices apply.
- **Live prices** (on by default): the page shows Shopify's real, market-localised prices and does the per-unit / you-save math automatically when the variant has a compare-at price. The manual price lines are the fallback (and what the in-app preview shows). Tip: set compare-at prices on the 2- and 3-unit variants (e.g. €114 / €171) so the strikethrough math is automatic everywhere.
- **UTM passthrough**: utm_* / fbclid / gclid on the page URL are carried into the cart as attributes for attribution.
- **Per-market overrides**: pick a country and set a different code, a different variant for a card, or hide a card. Everything else stays shared.
- All other buttons on the page ("Order now and save up to 20%", sticky bar) scroll to the pricing section. Nothing on the page links away except cart, checkout, the optional cross-sell product, and the store's own header/footer.

## 6. Translate a page

Translations tab → tick the store languages → **DeepL** or **Claude** → **Translate missing**. Review/edit each string in the table (source left, translation right). Visitors browsing the store in that language see the translation automatically; untranslated strings fall back to English. Global wording (guarantee, shipping line, disclaimer) is translated once in **Settings**.

## 7. Preview & publish

- The editor preview uses a neutral stand-in header/footer and the manual prices. **Preview on store** opens the draft inside the real theme (real header/footer, live prices) via a private link you can share internally.
- **Publish** freezes the current draft as the live page. Keep editing afterwards — the live page only changes when you publish again ("Unpublished changes" badge reminds you). The app checks the page size against Shopify's limit before publishing.
- Placeholders, the doctor's name/portrait and the study citations should be filled before the first publish; the guarantee wording (60 days) should be confirmed against policy in Settings.

## 8. Analytics

**Analytics** shows, per page and time range: visits, unique visitors, CTA clicks (to the offer), clicks on card 1 / 2 / 3, add-to-carts and the add-to-cart rate; broken down by day, traffic source (utm_source) and market. Compare funnels and iterate on the sections that own the money.

## 9. Settings (do once, applies everywhere)

Brand colours/fonts/CTA style, guarantee days + wording, shipping line, support email, disclaimer, payment icons list, award-seal image, default discount codes, AI defaults (Claude model, Higgsfield model, image style), API keys (Anthropic, DeepL, Higgsfield — stored encrypted), proxy prefix, and **Re-seed baseline pages** (restores the three drafts to the original copy docs).
