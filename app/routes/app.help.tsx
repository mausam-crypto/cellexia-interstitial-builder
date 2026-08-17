import { Page, Card, BlockStack, Text, List } from "@shopify/polaris";

/** In-app copy of the team guide (docs/TEAM-GUIDE.md has the full version). */
export default function Help() {
  return (
    <Page title="How to use the builder" subtitle="Plain-language guide for the team. The full guide ships in docs/TEAM-GUIDE.md.">
      <BlockStack gap="400">
        <Card><BlockStack gap="200"><Text as="h2" variant="headingMd">Edit a section</Text><List type="number">
          <List.Item>Open <b>Pages</b> → click a page → the editor opens with the section list on the left, the form in the middle and the live preview on the right.</List.Item>
          <List.Item>Click a section in the list. Every headline, paragraph, badge, price line, button label, FAQ item, testimonial… is a field. Changes autosave as a draft (see “Saved” next to the title) and the preview refreshes.</List.Item>
          <List.Item>Use ▲▼ or drag to reorder, 👁 to hide, ⧉ to duplicate, ✕ to remove. <b>+ Add section</b> offers the whole library.</List.Item>
          <List.Item>Bracketed placeholders like <b>[12,000]</b> or <b>Dr. [FULL NAME]</b> stay visible until you replace them — do that before publishing.</List.Item>
        </List></BlockStack></Card>
        <Card><BlockStack gap="200"><Text as="h2" variant="headingMd">Replace an image</Text><List type="number">
          <List.Item>In any image field click <b>Upload</b> (goes to Shopify Files / CDN), <b>URL</b>, <b>Library</b> (everything uploaded or generated so far) or <b>Generate with AI</b>.</List.Item>
          <List.Item>Generate: the slot comes with a default prompt — edit it, pick Higgsfield (photos) or Claude (SVG diagrams), click Generate (about a minute). The result is re-hosted on your CDN and saved to the library.</List.Item>
          <List.Item>Add alt text for accessibility.</List.Item>
        </List></BlockStack></Card>
        <Card><BlockStack gap="200"><Text as="h2" variant="headingMd">Duplicate a page for a new product</Text><List type="number">
          <List.Item>Pages → <b>New page from template</b> (or Duplicate → “Use the guided wizard”).</List.Item>
          <List.Item>Step 1: name + URL slug. Step 2: choose the product — variants map to the 1/2/3-unit cards automatically; check the gift add-on and set the discount code (or leave the code off to use your default bundle prices). Step 3: swap only the product-specific copy (headline, three reasons, mechanism, comparison column, timeline, testimonials, expert quote, FAQ…) — optionally draft it with Claude from a brief. Step 4: images. Step 5: create.</List.Item>
          <List.Item>Shared elements (guarantee, purity, pillars, disclaimer, sticky bar) carry over automatically and follow the global Settings.</List.Item>
        </List></BlockStack></Card>
        <Card><BlockStack gap="200"><Text as="h2" variant="headingMd">Bundles, discount code & links</Text><List>
          <List.Item><b>Commerce</b> tab: each pricing card sells one Shopify variant (+ optional add-ons like the free towel). Buttons build the cart link automatically: straight to checkout with the code applied, or add-to-cart → cart page.</List.Item>
          <List.Item>Discount code: turn on to append <span className="ib-mono">?discount=CODE</span>; “Check in Shopify” verifies the code exists. Off = built-in 2/3-unit bundle prices.</List.Item>
          <List.Item>Every other button on the page scrolls to the pricing section. No link leaves the page except the cart, checkout and normal store navigation.</List.Item>
          <List.Item>Per-market overrides: different code / variant / hidden card for a specific country. Live prices localise automatically per market & currency.</List.Item>
        </List></BlockStack></Card>
        <Card><BlockStack gap="200"><Text as="h2" variant="headingMd">Translate</Text><List>
          <List.Item><b>Translations</b> tab: tick the store languages, choose DeepL or Claude, “Translate missing”. Review/edit each string in the table. Visitors browsing the store in that language see the translation automatically.</List.Item>
          <List.Item>Global wording (guarantee, shipping, disclaimer) is translated once in Settings.</List.Item>
        </List></BlockStack></Card>
        <Card><BlockStack gap="200"><Text as="h2" variant="headingMd">Preview & publish</Text><List>
          <List.Item>The right-hand preview switches between mobile and desktop. <b>Preview on store</b> opens the draft inside your real theme (header, footer, live prices) via a private link.</List.Item>
          <List.Item><b>Publish</b> freezes the draft as the live page at <span className="ib-mono">/a/go/&lt;slug&gt;</span>. Keep editing afterwards — the live page only changes when you publish again. <b>Unpublish</b> returns 404.</List.Item>
          <List.Item><b>Analytics</b>: visits, CTA clicks, clicks per pricing card and add-to-carts per page and per traffic source.</List.Item>
        </List></BlockStack></Card>
      </BlockStack>
    </Page>
  );
}
