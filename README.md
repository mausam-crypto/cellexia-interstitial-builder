# Cellexia Interstitial Page Builder — Shopify app

An in-house Shopify app for **cellexialabs.com** that lets the team build, duplicate, translate and publish
native-ads **interstitial "proof stack" pages** — modelled section-for-section on
`glow25.fr/pages/cp-listicle-sp-v4` and re-skinned with Cellexia's brand — without developers.

Pages render **on your own domain, inside your real store header and footer**, through the Shopify
**App Proxy** (`https://cellexialabs.com/a/go/<slug>`). This works on the store's legacy (non-OS 2.0)
theme, needs no theme edits, and lets Shopify localise prices, currency, language and cart routes per
market. Three baseline pages ship pre-loaded (drafts, ready to publish):

| Page | Slug | Product |
|---|---|---|
| Crepey Skin — Body Wrinkle Cream (**master template**) | `/a/go/crepey-skin` | body-wrinkle-cream |
| Jawline — 10-Second Ritual | `/a/go/jawline-ritual` | jawline-contour-tightening-cream |
| Dark Spots — Canceled the Laser | `/a/go/dark-spots` | dark-spot-precision-corrector |

Docs:
- **`docs/TEAM-GUIDE.md`** — plain-language guide for the marketing team (edit, images, duplicate, bundles/discounts, translate, publish).
- **`docs/ARCHITECTURE.md`** — how it works under the hood, for developers.
- **`docs/HANDOVER-NOTES.md`** — what was verified, what still needs a human (placeholders, keys, policy checks).

---

## 1. What's in the box

- **Section library** (20 types): announcement bar, listicle hero, numbered reason, differentiation text, purity icon row, numbered science explainer, clinical evidence with citation slots, four-pillar grid, expert quote, three-card pricing (center card enlarged + badged, strikethrough compare-at, per-unit math, free gift), guarantee, checkmark comparison table, results timeline, testimonial carousel, review carousel, doctor FAQ accordion, final CTA — plus generic rich text / image / CTA. Sticky mobile CTA bar and a locked disclaimer are page-level.
- **Editor** with live mobile/desktop preview, autosave drafts, publish/unpublish, "Preview on store" (draft inside your real theme), per-field image upload / library / AI generation, translations tab (DeepL or Claude one-click), commerce tab (product & variant picker, discount code with Shopify check, gift add-ons, checkout mode, UTM passthrough, live prices, per-market overrides).
- **"New page from template" wizard** — copies a page and walks through only the product-specific fields (product & bundles, discount, headline & reasons, mechanism, comparison column, timeline, testimonials, expert quote, FAQ, images, slug). Optional Claude drafting of all product-specific copy from a brief.
- **Global brand settings** (accent colour, guarantee wording, shipping line, disclaimer, payment icons, fonts, AI defaults) applied everywhere; saving recompiles every published page.
- **Analytics** per page: visits, unique visitors, CTA clicks, clicks per pricing card, add-to-carts, by day / traffic source / market.
- **Guards**: compiled Liquid size is measured against Shopify's 256 KB per-file limit; every page stays ~80 KB.

## 2. Requirements

- Node **≥ 20.10** (22 LTS recommended), npm.
- Shopify CLI ≥ 3.80 (`npm i -g @shopify/cli`).
- A Shopify Partner org / Dev Dashboard access for the Cellexia Labs store (Shopify Plus). The app is a **custom app for one store** — no App Store review needed.
- Hosting for the Node server (Fly.io / Render / Railway / Heroku / a VPS) with a public HTTPS URL, and Postgres for production (SQLite is fine for dev).
- Optional API keys: Anthropic (Claude), DeepL, Higgsfield.

## 3. Local development (10 minutes)

```bash
git clone <this repo> && cd cellexia-interstitial-builder
npm install
cp .env.example .env            # fill SESSION_SECRET; keys optional
npx prisma generate && npx prisma migrate deploy
```

**With Shopify (recommended, real store data):**

```bash
shopify app config link          # creates/links the app in the Dev Dashboard, fills client_id + URLs in shopify.app.toml
shopify app dev                  # tunnels, installs on the dev store / Cellexia store, opens the embedded app
```

The first time the app is opened it seeds brand settings and the three baseline pages and uploads the bundled seed images to **Shopify Files** (CDN).

**Without Shopify (UI work only):**

```bash
BUILDER_DEV_SHOP=cellexia-labs.myshopify.com npm run dev:local     # http://localhost:3000/app
```

Dev mode bypasses Shopify auth (never active when `NODE_ENV=production`), seeds pages with app-hosted images and uses fallbacks for the product picker/uploads.

Useful scripts:

```bash
npm test                     # vitest: renderer, links, disclaimer lock, duplication, Liquid evaluation (liquidjs)
npm run preview:static       # writes preview-out/<slug>.html + .liquid for the 3 seed pages
npm run verify:duplicate     # duplicates the template, swaps product fields, verifies, cleans up
npm run size:check           # compiled Liquid size of every page vs the 256 KB limit
npm run typecheck
```

## 4. Deploy to production

1. **Create the app** (once): `shopify app config link` → choose the Cellexia Labs org, create app "Cellexia Interstitial Builder". This writes `client_id` into `shopify.app.toml`. Set `application_url` and `redirect_urls` to your production URL (the CLI does this on `deploy` if `[build] automatically_update_urls_on_dev` is used in dev; for prod edit the TOML).
2. **Host the server**. Build & start:
   ```bash
   npm ci && npm run build
   npx prisma migrate deploy      # or: npm run setup
   npm run start                  # react-router-serve ./build/server/index.js  (PORT env)
   ```
   Environment variables (from `.env.example`): `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SCOPES`, `DATABASE_URL`, `SESSION_SECRET`, optional `ANTHROPIC_API_KEY`, `DEEPL_API_KEY`, `HIGGSFIELD_API_KEY_ID/SECRET`.
   For Postgres: set `provider = "postgresql"` in `prisma/schema.prisma`, `DATABASE_URL=postgres://…`, then `npx prisma migrate dev --name init` once locally to regenerate the migration for Postgres (SQLite migration ships in `prisma/migrations`).
   A `Dockerfile`-less deploy on Fly/Render works with `npm run docker-start` as the start command.
3. **Deploy the config**: `shopify app deploy` (pushes scopes, webhooks and the **App Proxy** `[app_proxy] prefix=a subpath=go url=https://<app>/proxy`). Verify in the Dev Dashboard → App → Configuration → App proxy.
4. **Install on the store**: open `https://<app>/auth/login?shop=cellexia-labs.myshopify.com` (or install from the Dev Dashboard). Approve scopes. The app seeds the three pages and uploads seed images to Shopify Files.
5. **Open the app** in Shopify admin → Apps → Cellexia Interstitial Builder → Settings: paste API keys (Anthropic / DeepL / Higgsfield), check brand tokens, upload the official award-seal artwork. Then Pages → open "Crepey Skin" → fill placeholders → **Preview on store** → **Publish**.
6. **Live URL**: `https://cellexialabs.com/a/go/crepey-skin`. Point the advertorial's CTA at it (UTM params are carried into the cart automatically).

### App proxy notes
- Proxy responses are `application/liquid`; Shopify wraps them in `theme.liquid`. The proxy path prefix `/a/go` is configurable in Settings → URLs and must match `shopify.app.toml`.
- Locale-prefixed markets work automatically (`/fr/a/go/crepey-skin`): translations switch on `request.locale`, prices on the market, cart links on `routes.cart_url`.
- Shopify may cache proxy responses for ~1 minute; publishing propagates within that window.

## 5. Project layout

```
app/
  routes/            proxy.$.tsx (storefront + analytics beacon) · preview.$id.tsx · app.* (admin) · api.* (upload/ai/products) · auth · webhooks
  lib/sections/      registry.ts (20 section definitions: fields + render) · helpers.ts
  lib/render/        render-page.ts · page-css.ts · page-script.ts
  lib/commerce/      cart-links.ts (permalink / discount chain / market overrides)
  lib/integrations/  shopify-files · deepl · claude · higgsfield · translate · images
  lib/seed/          seed.server.ts + pages/{crepey-skin,jawline,dark-spots}.ts (1:1 from the copy docs)
  lib/pages.server.ts  (CRUD, publish, duplicate, settings, analytics)  ·  lib/brand.ts (defaults)
  components/editor/ SectionForm (generic field UI) · Panels (section list, page settings, commerce, translations)
public/seed/         bundled seed images (re-hosted to Shopify Files on install) · public/builder/ (SVG diagrams, award seal, admin.css)
prisma/              schema + SQLite migration
scripts/             render-previews · verify-duplication · size-check · seed-cli
tests/               render.test.ts · liquid.test.ts
docs/                TEAM-GUIDE · ARCHITECTURE · HANDOVER-NOTES
```

## 6. Support / extending
See `docs/ARCHITECTURE.md` → "Extending" for adding a section type or integration. All copy lives in JSON (`Page.draft` / `Page.published`), so exports/imports and future migrations are straightforward.
