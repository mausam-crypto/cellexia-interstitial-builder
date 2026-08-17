/**
 * Seed: Interstitial #3 — Dark Spot Precision Corrector / Dark Spots funnel.
 * Transcribed 1:1 from cellexia-interstitial-3-dark-spots-copy.md. Nothing invented;
 * bracketed placeholders ([12,000], Dr. [FULL NAME], study slots) are left visible.
 *
 * Image sources follow the doc's manifest:
 *   REUSE  → Angle 3 sheet (already generated) → bundled in /public/seed
 *   GENERATE → pigment-switch diagram + testimonial portraits generated in the same style
 *   CDN    → Shopify CDN product shots
 *   `seed:` URLs are resolved by the seeder (uploaded to Shopify Files → CDN URL).
 */
import type { PageContent } from "../../types";
import { emptyPageContent } from "../../brand";

const CDN = "https://cdn.shopify.com/s/files/1/0611/7877/3640/files";
const CTA = "Order now and save up to 20%";

export const DARK_SPOTS_SEED: { slug: string; title: string; productHandle: string; productTitle: string; content: PageContent } = {
  slug: "dark-spots",
  title: "Dark Spots — Canceled the Laser",
  productHandle: "dark-spot-precision-corrector",
  productTitle: "Dark Spot Precision Corrector",
  content: {
    ...emptyPageContent(),
    funnelLabel: "Angle 3 · Dark spots (canceled the laser)",
    notes:
      "Sibling of the crepey-skin template. Fed by the Angle 3 advertorial (\"canceled her laser\"). Fill: [250,000]+ tubes, [12,000]+ reviews, Dr. [FULL NAME] + portrait, 3 study citations. Confirm 60-day guarantee policy (Sections 0/11/12/14). Discount code SPOTS20 is a suggestion — enable it once the code exists in Shopify Discounts. Keep the term \"Melanin Overdrive\" identical across ad → advertorial → this page. In Shopify the 2- and 3-tube variants have no compare-at price set, so live pricing shows the manual compare/save lines as fallback — set compare-at prices on the variants (€114 / €171) to get automatic strikethrough math. Sachet: Cellular Renewal Cream sample (existing sample SKU) — no dark-spot sachet exists in the store.",
    seo: { title: "3 reasons thousands of women put this on their dark spots every morning | Cellexia", description: "Dermatologist-endorsed dark spot precision corrector — works at the source of pigmentation so stubborn spots fade and stop coming back. Face, hands, neck, chest.", noindex: true },
    commerce: {
      productHandle: "dark-spot-precision-corrector",
      productTitle: "Dark Spot Precision Corrector",
      productId: "gid://shopify/Product/15422184718711",
      discountCode: "SPOTS20",
      discountEnabled: false,
      checkoutMode: "default",
      utmPassthrough: true,
      livePrices: true,
      marketOverrides: {},
    },
    stickyBar: { enabled: true, text: "★★★★★ [12,000]+ reviews", buttonLabel: CTA, showAfterSectionIndex: 0 },
    sections: [
      {
        id: "s01_hero",
        type: "hero",
        data: {
          eyebrow: "Recommended by dermatologists across Europe",
          headline: "3 reasons why thousands of women put this on their dark spots every morning — and never booked the laser",
          subhead: "Dermatologist-endorsed. Built on Nobel Prize-winning research into cellular aging. Winner of the 2026 European Cosmetic Prize.",
          trust: "Used in over 138 leading aesthetic clinics · [250,000]+ tubes shipped across Europe · [12,000]+ ★★★★★ reviews",
          ctaLabel: CTA,
          badges: [
            { label: "2026 European Cosmetic Prize", image: { src: "seed:award-seal.svg", alt: "2026 European Cosmetic Prize seal" } },
            { label: "Dermatologically approved" },
            { label: "Used in 138 aesthetic clinics" },
            { label: "Based on Nobel Prize-winning research" },
          ],
          image: { src: "seed:p3-hero.jpg", alt: "Woman at her bathroom mirror holding an unused concealer, smiling at clear skin", note: "REUSE — the concealer moment (manifest)" },
          imagePosition: "right",
        },
      },
      {
        id: "s02_reason1",
        type: "reason",
        data: {
          number: "1",
          image: { src: "seed:p3-reason1-cheek-diptych.jpg", alt: "Before/after: dark spots on a cheek", note: "REUSE — Angle 3 sheet, cheek before/after diptych" },
          heading: "Stubborn spots fade — and stop coming back",
          body:
            "You've probably already discovered the cruelest thing about dark spots: almost anything can fade them a little, and almost nothing keeps them gone. The serum works for a while; the spot returns. Even a €3,000 laser course removes the pigment that's already there — and then, so often, the same patches darken again.\n\nThat's because fading the *spot* was never the real job. The real job is stopping the patch of skin that keeps producing it.\n\nCellexia's Dark Spot Precision Corrector works at the **source of pigmentation — not just on the surface**. Old spots fade, new ones are discouraged from forming, and the brightness you gain actually holds. Face, hands, neck, chest: anywhere discoloration shows up.",
          closing: "",
          showCta: true,
          ctaLabel: CTA,
          imageStyle: "full",
        },
      },
      {
        id: "s03_reason2",
        type: "reason",
        data: {
          number: "2",
          image: { src: "seed:diagram-pigment-switch.svg", alt: "\"Pigment switch stuck ON\" diagram: tyrosinase in overdrive", note: "GENERATE (manifest) — clean editorial diagram (SVG)" },
          heading: "It switches off Melanin Overdrive — on four pathways at once",
          body:
            "Here's the root cause almost nobody explains. Your skin's pigment is controlled by an enzyme called tyrosinase — a switch that turns melanin production on and off as needed. Sun, hormones and age can leave that switch **stuck in overdrive**: certain patches keep cranking out pigment faster than your skin can ever clear it. That's Melanin Overdrive — and it's why your spots always come back.\n\nOne ingredient rarely beats a stuck switch. So Cellexia's formula attacks it with **four complementary actives working simultaneously**:\n\n**Pathway 1 — Block** melanin overproduction at its source, calming the overactive tyrosinase. **Pathway 2 — Neutralize** the oxidative damage from sun and age that keeps flipping the switch back on. **Pathway 3 — Calm** the inflammatory triggers that tell patches to keep overproducing. **Pathway 4 — Brighten** at the deepest levels of the skin — where the pigment is actually made.",
          closing: "Four pathways, one job: a pigment system running normally again.",
          showCta: false,
          ctaLabel: CTA,
          imageStyle: "contained",
        },
      },
      {
        id: "s04_reason3",
        type: "reason",
        data: {
          number: "3",
          image: { src: "seed:p3-reason3-swab.jpg", alt: "Cotton-swab application close-up on a cheek spot", note: "REUSE — Angle 3 sheet, cotton-swab application close-up" },
          heading: "Three minutes each morning — face, hands, neck and chest",
          body:
            "After cleansing, while the skin is still slightly damp: a thin layer over the areas you want to clear. Spot-treat just the patches, or sweep it across the whole face, the backs of the hands, the neck and chest — anywhere discoloration shows up. Let it absorb. Done.\n\nThree minutes. No appointments, no peeling, no downtime, no hiding indoors afterward the way lasers demand.\n\nOne tip from the dermatologists who recommend it: take a \"before\" photo on day one. Around week two, start checking the mirror — that's when most women first see it.",
          closing: "",
          showCta: false,
          ctaLabel: CTA,
          imageStyle: "full",
        },
      },
      {
        id: "s05_diff",
        type: "text_block",
        data: {
          heading: "Here's why Cellexia works when everything in your drawer didn't",
          body:
            "The brightening products you've already tried made one of the same two mistakes — usually both:\n\n**Mistake 1: too weak.** Concentrations too low to influence pigment production at all — enough to put the ingredient on the label, not enough to matter.\n\n**Mistake 2: too shallow.** Actives that never penetrate past the surface, while the pigment is being manufactured in the deeper layers. It doesn't matter how good the ingredient is — if it can't reach the problem, nothing happens.\n\nCellexia's corrector is built to avoid exactly that: **clinical-strength actives** paired with a delivery system designed to reach the layer where pigment is made. And it's free of the fragrances, harsh chemicals and irritants hiding in so many drugstore products — ingredients that can actually make discoloration *worse*.",
          tone: "soft",
          align: "left",
          showCta: false,
          ctaLabel: CTA,
        },
      },
      {
        id: "s06_purity",
        type: "purity",
        data: {
          heading: "Gentle enough for the skin that's been through enough",
          body:
            "Discolored skin is often skin that's already irritated — which is why the formula is **hypoallergenic, non-comedogenic, and dermatologically approved**, free of fragrance and harsh preservatives, and formulated for **all skin types, including mature and sensitive skin**. Brightening that calms, instead of brightening that burns.",
          icons: [
            { label: "Hypoallergenic", icon: "shield" },
            { label: "Non-comedogenic", icon: "drop" },
            { label: "Dermatologically approved", icon: "sparkle" },
            { label: "All skin types, incl. sensitive", icon: "drop" },
            { label: "No fragrance or irritants", icon: "ban" },
          ],
          image: { src: `${CDN}/DarkSpotCorrector-RenderTest1.jpg?v=1773996277`, alt: "Cellexia Dark Spot Precision Corrector tube", note: "Shopify CDN — tube (DarkSpotCorrector-RenderTest1)" },
        },
      },
      {
        id: "s07_science",
        type: "science",
        data: {
          heading: "Why calming the pigment switch really works",
          steps: [
            { text: "In healthy skin, tyrosinase — the pigment switch — turns on when you need protection and off when you don't. Pigment stays even; marks fade and clear." },
            { text: "Decades of sun, hormonal shifts and aging leave the switch stuck in overdrive in certain patches. From your early 40s, those patches overproduce pigment faster than your skin can clear it — and a spot that \"always comes back\" is born." },
            { text: "Bleach the surface and the factory underneath keeps running. Calm the factory itself — on every pathway that feeds it — and the skin finally clears the backlog. Old spots fade; new ones lose their engine." },
          ],
          closing:
            "Cellexia's four-pathway approach comes out of the modern science of cellular aging — the line of research that won a Nobel Prize — applied to the one skin problem defined by its stubbornness.",
          showCta: true,
          ctaLabel: CTA,
          image: { src: "seed:p3-before-portrait.jpg", alt: "Raw \"before\" portrait showing dark spots and uneven tone", note: "REUSE — raw \"before\" portrait (manifest section 7)" },
          imagePosition: "left",
        },
      },
      {
        id: "s08_evidence",
        type: "evidence",
        data: {
          heading: "Is a cream really an alternative to a €3,000 laser course?",
          body:
            "Lasers are legitimate tools — and for pigment that's already surfaced, they're fast. But they share one weakness with every cheap serum: they don't switch off the overproduction. That's why so many women pay for a course, watch the spots return, and pay again.\n\nCellexia's corrector contains a **clinically proven blend of four complementary actives**, is **used in over 138 leading aesthetic clinics** — including clinics that offer the laser — and comes from the lab whose anti-aging work won the **2026 European Cosmetic Prize**, awarded by a panel of 27 international experts.",
          citations: [
            { author: "[Lead author]", sample: "[n] patients, [x] weeks", finding: "[key finding — e.g., measurable increase in skin brightness / reduction in discoloration]" },
            { author: "[Lead author]", sample: "[n] participants, [x] days", finding: "[key finding — e.g., visible lightening of hyperpigmented patches]" },
            { author: "[Lead author]", sample: "[n] women aged [range], [x] weeks", finding: "[key finding — e.g., improved evenness of skin tone, reduced recurrence]" },
          ],
          closing: "The clinics that sell €3,000 courses keep this €57 tube on their shelves. Draw your own conclusion.",
          image: undefined,
        },
      },
      {
        id: "s09_pillars",
        type: "pillars",
        data: {
          heading: "Why Cellexia is the corrector the clinics keep on their shelves",
          items: [
            { title: "Four pathways, simultaneously.", text: "Block, neutralize, calm, brighten — because a stuck pigment switch is never a one-ingredient problem." },
            { title: "Source, not surface.", text: "A delivery system that reaches the layer where pigment is actually made — so results hold instead of rebounding." },
            { title: "Prize-winning science.", text: "Built on Nobel Prize-winning cellular-aging research; winner of the 2026 European Cosmetic Prize; used in 138 leading aesthetic clinics." },
            { title: "Precision without punishment.", text: "Clean, fragrance-free, and gentle enough for daily use on mature, sensitive, sun-stressed skin." },
          ],
          showAward: true,
        },
      },
      {
        id: "s10_expert",
        type: "expert_quote",
        data: {
          kicker: "The protocol setup — an expert's recommendation",
          quote:
            "With pigmentation, I give my patients one instruction and one warning. The instruction: a thin layer every morning for 60 days — take a photo on day one, and start checking the mirror around week two. The warning: don't stop when the spots fade. The overproduction that created them calms down over your skin's 28-day renewal cycles, and it takes three of them — the full 90-day protocol — before the result is protected. One tube fades the spots you have. Three tubes is how you stop meeting them again.",
          name: "Dr. [FULL NAME]",
          credential: "board-certified dermatologist",
          image: undefined,
          layout: "left",
        },
      },
      {
        id: "s11_pricing",
        type: "pricing",
        data: {
          heading: "Choose your Cellexia pack",
          cards: [
            {
              title: "1 Tube",
              subtitle: "Starter",
              badge: "",
              highlight: false,
              image: { src: `${CDN}/DarkSpotCorrector-RenderTest1.jpg?v=1773996277`, alt: "Cellexia Dark Spot Precision Corrector — 1 tube" },
              priceManual: "€57.00",
              compareManual: "",
              perUnitManual: "€57.00 per tube",
              saveManual: "",
              unitCount: 1,
              unitLabel: "tube",
              description: "Spot-treats the face for 4–6 weeks",
              giftLine: "",
              checks: "Free express shipping · 60-day money-back guarantee",
              buttonLabel: "Add to cart",
              variantId: "56912236052855",
              variantTitle: "1 Tube",
              quantity: 1,
              addOns: [],
            },
            {
              title: "3 Tubes",
              subtitle: "The full 90-day protocol",
              badge: "Recommended by dermatologists",
              highlight: true,
              image: { src: `${CDN}/DarkSpotCorrector-RenderTest2.jpg?v=1773996277`, alt: "Cellexia Dark Spot Precision Corrector — 3-tube protocol", note: "Shopify CDN render (DarkSpotCorrector-RenderTest2)" },
              priceManual: "€136.80",
              compareManual: "€171.00",
              perUnitManual: "€45.60 per tube",
              saveManual: "You save €34.20 (20%)",
              unitCount: 3,
              unitLabel: "tube",
              description: "Fade the spots AND retire the overproduction — face, hands, neck, chest",
              giftLine: "FREE gift: Bamboo Beauty Towel (worth €29) — this pack only",
              giftImage: { src: `${CDN}/Towel1.jpg?v=1736753333`, alt: "Bamboo Beauty Towel" },
              checks: "Free express shipping · 60-day money-back guarantee",
              buttonLabel: "Add to cart",
              variantId: "56912236118391",
              variantTitle: "3 Tubes - 20% Off",
              quantity: 1,
              addOns: [{ variantId: "55089188438391", quantity: 1, label: "Bamboo Beauty Towel — FreeGift (SKU 600007)", productHandle: "bamboo-beauty-towel" }],
            },
            {
              title: "2 Tubes",
              subtitle: "",
              badge: "",
              highlight: false,
              image: { src: `${CDN}/DarkSpotCorrector-RenderTest1.jpg?v=1773996277`, alt: "Cellexia Dark Spot Precision Corrector — 2 tubes", note: "Shopify CDN render (DarkSpotCorrector-RenderTest1)" },
              priceManual: "€96.90",
              compareManual: "€114.00",
              perUnitManual: "€48.45 per tube",
              saveManual: "You save €17.10 (15%)",
              unitCount: 2,
              unitLabel: "tube",
              description: "Takes you through the 60-day mirror moment",
              giftLine: "",
              checks: "Free express shipping · 60-day money-back guarantee",
              buttonLabel: "Add to cart",
              variantId: "56912236085623",
              variantTitle: "2 Tubes - 15% Off",
              quantity: 1,
              addOns: [],
            },
          ],
          footnote: "Every order ships with a free sample sachet of Cellexia's Cellular Renewal Cream.",
          crossSellEnabled: true,
          crossSellTitle: "Complete the even-tone routine: + Advanced Glow Reset Serum",
          crossSellText: "radiance on top of clarity.",
          crossSellUrl: "https://cellexialabs.com/products/advanced-glow-reset-serum",
          crossSellButton: "See the serum",
          crossSellImage: undefined,
        },
      },
      {
        id: "s12_guarantee",
        type: "guarantee",
        data: {
          heading: "Not satisfied? You're covered by our 60-day money-back guarantee",
          body:
            "Use it every morning for the full 60 days. If you don't have that moment of looking in the mirror and seeing a clearer, more even, younger-looking face — email **support@cellexialabs.com** with the subject \"Guarantee\" and we'll refund every cent within 1–2 business days. Even if the tubes are empty. No questions asked.",
          icons: [
            { label: "Secure 256-bit encrypted payment", icon: "lock" },
            { label: "Free express shipping from our EU warehouse", icon: "truck" },
            { label: "Formulated and made in Europe", icon: "eu" },
          ],
          showSeal: true,
        },
      },
      {
        id: "s13_compare",
        type: "comparison",
        data: {
          heading: "Cellexia is the smart choice for even skin — you deserve it",
          columns: [
            { label: "Cellexia Dark Spot Corrector", highlight: true },
            { label: "Brightening serums & creams", highlight: false },
            { label: "Laser & cryotherapy", highlight: false },
          ],
          rows: [
            { label: "Works at the source of pigmentation", cells: "✓ | ✗ | ✗ (removes surfaced pigment only)" },
            { label: "Discourages new spots from forming", cells: "✓ | ✗ | ✗" },
            { label: "Four actives on four pathways", cells: "✓ | ✗ | —" },
            { label: "Works on face, hands, neck AND chest", cells: "✓ | ✓ | ✗ (priced per area)" },
            { label: "Gentle on mature, sensitive skin", cells: "✓ | ✗ (often irritating) | ✗ (downtime, redness)" },
            { label: "Dermatologically approved, fragrance-free", cells: "✓ | ✗ | —" },
            { label: "No appointments, no downtime", cells: "✓ | ✓ | ✗" },
            { label: "Results that hold instead of rebounding", cells: "✓ | ✗ | ✗" },
            { label: "Cost", cells: "from €45.60/tube | €30–300, wasted | €3,000+ per course, repeated" },
          ],
          footnote: "",
        },
      },
      {
        id: "s14_timeline",
        type: "timeline",
        data: {
          heading: "The results you can expect with Cellexia",
          subhead: "Pigment clears in stages — here's the honest sequence.",
          phases: [
            { label: "Weeks 1–2", title: "The brightness arrives first.", text: "The overall tone lifts before individual spots move — this is when husbands say you look \"rested\" and can't explain why. Take your day-one photo; you'll want it." },
            { label: "Weeks 3–6", title: "The spots themselves give way.", text: "The biggest patches visibly lighten, the scatter along the jaw softens, the marks on your hands start fading. Somewhere around day 30 comes the moment this page is named for: you reach for the concealer — and there's nothing left to cover." },
            { label: "Weeks 8–12", title: "Even, uniform, protected.", text: "With the overproduction calmed across three full renewal cycles, the clarity holds. New spots have lost their engine. Your face in photos is just… your face again." },
          ],
          closing: "And every week of it is covered by the 60-day guarantee — you either see clearer skin in the mirror, or you don't pay.",
          image: { src: "seed:p3-hands-diptych.jpg", alt: "Before/after: the backs of the same hands, spotted vs clearer", note: "REUSE — hands before/after (timeline / FAQ Q8)" },
        },
      },
      {
        id: "s15_testimonials",
        type: "testimonials",
        data: {
          heading: "Real customers, real results",
          items: [
            { name: "Dana K.", age: "63", badge: "Verified customer", headline: "Lighter color — starting the first week.", bullets: "Noticed lightening within days of starting\nUses it on face and hands\n\"Thrilled\" — her word", quote: "I'm thrilled with the results. I started using it the same day it arrived. I'm noticing a lighter color already!", image: { src: "seed:p3-t1.jpg", alt: "Dana K.", note: "GENERATE (manifest) — candid portrait" } },
            { name: "Terri W.", age: "58", badge: "Verified customer", headline: "100% satisfied — because it finally just worked.", bullets: "Years of failed serums first\nVisible fading on both cheeks\nThree minutes with her morning routine", quote: "I am 100% satisfied. I like the Dark Spot Precision Corrector because it really does work!", image: { src: "seed:p3-t2.jpg", alt: "Terri W." } },
            { name: "Alma R.", age: "72", badge: "Verified customer", headline: "\"Excellent for my very aging skin.\"", bullets: "Spots disappearing at 72\nGentle enough for her sensitive skin\nNo irritation, no downtime", quote: "This is excellent for my very aging skin. Dark spots are disappearing.", image: { src: "seed:p3-t3.jpg", alt: "Alma R." } },
            { name: "Celia R.", age: "61", badge: "Verified customer", headline: "The only thing she tried that works.", bullets: "Owns \"100 useless products\" that promised the same\nShocked by how quickly it moved\nSpots faded — and stayed faded", quote: "Out of all the products I own that promise to reduce dark spots, this is the only one that works! I was in shock. And it worked quickly!!!", image: { src: "seed:p3-t4.jpg", alt: "Celia R." } },
          ],
        },
      },
      {
        id: "s16_reviews",
        type: "reviews",
        data: {
          heading: "[12,000]+ five-star reviews — and counting",
          items: [
            { text: "People notice a brightness to my face already — and I've only been at it for a week or so!", name: "Joanne N.", stars: 5 },
            { text: "Works exactly as advertised. For anyone looking to fade dark spots and even out their tone — this is it.", name: "Carmen C.", stars: 5 },
            { text: "Those pesky brown spots that always come back? Visibly reduced.", name: "Lesley L.", stars: 5 },
          ],
        },
      },
      {
        id: "s17_faq",
        type: "faq",
        data: {
          heading: "Dr. [NAME], dermatologist, answers your questions about dark spots",
          items: [
            { q: "My spots have been there for 15+ years. Can they still fade?", a: "Age of the spot matters less than you'd think — what matters is whether the patch is still overproducing. Calm the overproduction and give the skin its three renewal cycles, and even long-established spots typically soften significantly. The oldest, deepest pigment is the slowest to clear; it's also why the protocol is 90 days and not 30." },
            { q: "Is this safe for my skin tone?", a: "The formula regulates pigment production toward normal — it doesn't strip or bleach. It's designed for all skin types and tones, including mature, sensitive skin. As with any pigment product, consistency plus daily SPF gives the best result." },
            { q: "Why do my spots always come back after other treatments?", a: "Because those treatments removed pigment without touching the enzyme producing it. If tyrosinase stays stuck in overdrive, the patch refills — after serums *and* after lasers. Switching production back toward normal is the difference between fading a spot and retiring it." },
            { q: "How exactly do I use it?", a: "Every morning after cleansing, on slightly damp skin: a thin layer over the patches — or the whole face, hands, neck and chest. Let it absorb; makeup and SPF layer over it normally. Three minutes." },
            { q: "Do I need to wear sunscreen with it?", a: "Yes — and you should be anyway. Sun is the loudest signal telling your pigment switch to stay stuck. The corrector calms production; SPF stops the re-triggering. Together they're why results hold." },
            { q: "When will I see the first results?", a: "Overall brightness typically lifts within two weeks. Individual spots visibly lighten from weeks three to six — day 30 is when most women describe the \"nothing left to cover\" moment." },
            { q: "Are there side effects?", a: "No peeling, no burning, no downtime — the formula is fragrance-free, hypoallergenic and dermatologically approved. If you've had reactions to harsh brighteners before, this was formulated for exactly you." },
            { q: "What about the spots on my hands? They age me more than my face.", a: "They respond to the same protocol — and honestly, hands are where the transformation surprises women most. Thin layer over the backs of the hands every morning, same 60-to-90-day arc. Hands don't lie; after the protocol, they flatter." },
          ],
          firstOpen: false,
        },
      },
      { id: "s18_final", type: "final_cta", data: { heading: "Three minutes tomorrow morning. A different mirror by week two.", subhead: "", ctaLabel: CTA } },
    ],
  },
};
