/**
 * Seed: Interstitial #2 — Jawline Contour Tightening Cream / Lift & Firm funnel.
 * Transcribed 1:1 from cellexia-interstitial-2-jawline-copy.md. Nothing invented;
 * bracketed placeholders ([12,000], Dr. [FULL NAME], study slots) are left visible.
 *
 * Image sources follow the doc's manifest:
 *   REUSE  → Angle 2 sheet (already generated) → bundled in /public/seed
 *   GENERATE → skin-scaffold diagram + testimonial portraits generated in the same style
 *   CDN    → Shopify CDN product shots
 *   `seed:` URLs are resolved by the seeder (uploaded to Shopify Files → CDN URL).
 */
import type { PageContent } from "../../types";
import { emptyPageContent } from "../../brand";

const CDN = "https://cdn.shopify.com/s/files/1/0611/7877/3640/files";
const CTA = "Order now and save up to 20%";

export const JAWLINE_SEED: { slug: string; title: string; productHandle: string; productTitle: string; content: PageContent } = {
  slug: "jawline-ritual",
  title: "Jawline — 10-Second Ritual",
  productHandle: "jawline-contour-tightening-cream",
  productTitle: "Jawline Contour Tightening Cream",
  content: {
    ...emptyPageContent(),
    funnelLabel: "Angle 2 · Jawline (10-second ritual)",
    notes:
      "Sibling of the crepey-skin template. Fed by the Angle 2 advertorial (\"10-second ritual\"). Fill: [250,000]+ jars, [12,000]+ reviews, Dr. [FULL NAME] + portrait, 3 study citations. Confirm 60-day guarantee policy (Sections 0/11/12/14). Discount code JAWLINE20 is a suggestion — enable it once the code exists in Shopify Discounts. Cross-sell: the \"Sculpt & Define\" set is a DRAFT product in the store (Neck + Jawline + Eye serum, €153.90) — activate it before publishing this page. Image library also holds seed:p2-pearl-dab.jpg (pearl-dab macro — Reason 3 support / FAQ) if you want to add it to a section.",
    seo: { title: "3 reasons thousands of women do this 10-second ritual every morning | Cellexia", description: "Dermatologist-endorsed jawline contour tightening cream — a visibly more defined jawline from the first application, and firmness rebuilt underneath over 90 days.", noindex: true },
    commerce: {
      productHandle: "jawline-contour-tightening-cream",
      productTitle: "Jawline Contour Tightening Cream",
      productId: "gid://shopify/Product/8233084944520",
      discountCode: "JAWLINE20",
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
          headline: "3 reasons why thousands of women do this 10-second ritual every morning — and their jawlines look years younger",
          subhead: "Dermatologist-endorsed. Built on Nobel Prize-winning research into cellular aging. Winner of the 2026 European Cosmetic Prize.",
          trust: "Used by over 100 leading aesthetic clinics worldwide · [250,000]+ jars shipped across Europe · [12,000]+ ★★★★★ reviews",
          ctaLabel: CTA,
          badges: [
            { label: "2026 European Cosmetic Prize", image: { src: "seed:award-seal.svg", alt: "2026 European Cosmetic Prize seal" } },
            { label: "Dermatologically approved" },
            { label: "Used by 100+ aesthetic clinics" },
            { label: "Based on Nobel Prize-winning research" },
          ],
          image: { src: "seed:p2-hero.jpg", alt: "Woman around 65 in three-quarter view, firm defined jawline, warm light, quiet confidence", note: "REUSE — baby-shower candid" },
          imagePosition: "right",
        },
      },
      {
        id: "s02_reason1",
        type: "reason",
        data: {
          number: "1",
          image: { src: "seed:p2-reason1-jowls-diptych.jpg", alt: "Before/after: jowls along the jawline", note: "REUSE — Angle 2 sheet, jowls before/after diptych" },
          heading: "A visibly more defined jawline — starting from the very first application",
          body:
            "Most firming products ask you to wait months to see anything. Cellexia's Jawline Contour Tightening Cream doesn't.\n\nThe moment it sets, it forms a **\"lifting film\" of micro-peptides** on the skin — instantly tightening and lifting the areas that sag: the jowls that blur your jawline, the loose skin under the chin, the folds that pull the corners of the mouth downward. You see the difference in the mirror the same morning you apply it.\n\nAnd that instant effect is only the opening act. Underneath the film, firming compounds go to work on the structure itself — so what starts as a daily lift becomes, week by week, a jawline that holds its line on its own.",
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
          image: { src: "seed:diagram-scaffold.svg", alt: "House-frame / skin-scaffold diagram: repaint the walls vs reinforce the frame underneath", note: "GENERATE (manifest) — clean editorial diagram (SVG)" },
          heading: "It works on the real reason your jawline is sagging",
          body:
            "Sagging isn't \"wrinkles, but worse.\" Wrinkles are surface creases. Sagging is *structural*.\n\nDeep in your skin there's a scaffold of collagen and elastin holding your face where it belongs. From your 40s onward, that scaffold weakens faster than your body rebuilds it — and gravity does the rest. That's why your anti-wrinkle cream did nothing for your jowls: you can repaint the walls all you want, but until you reinforce the frame underneath, the cracks keep coming back.\n\nCellexia works on both sides of that problem at once. Its clinically proven active, **DC Instalift Goji GF** — a glycopeptide derived from the goji fruit, known for its exceptional firming properties — restores tension at the surface *and* rebuilds firmness underneath. Contours return. Jowls lift. The jawline redraws itself.",
          closing: "",
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
          image: { src: "seed:p2-reason3-application.jpg", alt: "Ring-finger application tapping upward along the jawline", note: "REUSE — Angle 2 sheet, ring-finger jawline application" },
          heading: "Ten seconds each morning. That's the entire ritual.",
          body:
            "A pearl-sized amount on slightly damp skin. Your ring finger — the one that applies the gentlest pressure. Tap upward along the jawline from chin to ear, then under the chin and down the neck. Give it a minute to set into its lifting film, then makeup or SPF as usual.\n\nTen seconds. Every step has a reason: damp skin helps the glycopeptide penetrate, the tapping stimulates microcirculation, the upward motion works *with* your skin's structure instead of dragging against it — and the ring finger never tugs at skin that's already loosening.",
          closing: "The lightweight, velvety texture absorbs completely and disappears under makeup. Which is exactly why women do it every single morning — and why the results keep compounding.",
          showCta: false,
          ctaLabel: CTA,
          imageStyle: "full",
        },
      },
      {
        id: "s05_diff",
        type: "text_block",
        data: {
          heading: "Here's why Cellexia works when your firming creams didn't",
          body:
            "If you've tried \"lifting\" creams before and seen nothing, the product made one of the same two mistakes almost everything on the shelf makes:\n\n**Mistake 1: too little.** Trace amounts of a good ingredient — enough for the label, not for your jawline.\n\n**Mistake 2: no lift you can verify.** Vague \"firming\" promises with nothing you can see in the mirror — so you quit before the structural work ever shows.\n\nCellexia avoids both by design: **clinical-strength DC Instalift Goji GF**, and an instant lifting film that shows you it's working from day one — so you keep going long enough for the deeper firming to become permanent-feeling structure.",
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
          heading: "Clinically proven — and gentle enough for every morning",
          body:
            "Cellexia Jawline Contour Tightening Cream is **clinically proven and dermatologically approved**: hypoallergenic, non-comedogenic, and free from harmful preservatives and irritants. The texture is lightweight and highly absorbable, with a velvety-soft finish — made to be worn daily under makeup or sunscreen on mature, sensitive skin.",
          icons: [
            { label: "Clinically proven", icon: "sparkle" },
            { label: "Dermatologically approved", icon: "shield" },
            { label: "Hypoallergenic", icon: "shield" },
            { label: "Non-comedogenic", icon: "drop" },
            { label: "No harmful preservatives", icon: "ban" },
          ],
          image: { src: `${CDN}/5M2A1565_1.jpg?v=1760691676`, alt: "Cellexia Jawline Contour Tightening Cream jar", note: "Shopify CDN — jar (5M2A1565_1)" },
        },
      },
      {
        id: "s07_science",
        type: "science",
        data: {
          heading: "Why the \"lift + rebuild\" approach really works",
          steps: [
            { text: "Your facial contours are held up by a dense scaffold of collagen and elastin in the deeper layers of the skin. Through your 30s, it rebuilds itself as fast as it wears." },
            { text: "From your 40s — and faster after menopause — rebuilding falls behind. The scaffold thins and loosens, and gravity turns that slack into jowls, a softening jawline, and loose skin under the chin." },
            { text: "Fixing it needs two things at once: *tension now* (so the face sits where it should while the rebuild happens) and *structure over time* (so it stays there without the film). One without the other is why everything you've tried has disappointed." },
          ],
          closing:
            "Cellexia's dual-action approach comes out of the modern science of cellular aging — the line of research that won a Nobel Prize — engineered into a cream your ring finger applies in ten seconds.",
          showCta: true,
          ctaLabel: CTA,
          image: { src: "seed:p2-before-profile.jpg", alt: "Raw \"before\" profile showing jowls and a softening jawline", note: "REUSE — raw \"before\" jowl profile (manifest section 7)" },
          imagePosition: "left",
        },
      },
      {
        id: "s08_evidence",
        type: "evidence",
        data: {
          heading: "Is a cream really an alternative to a €15,000 procedure?",
          body:
            "Here's the honest answer: a cream is not a scalpel — and it doesn't need to be. Most women considering a lower facelift, thread lift, or filler course don't need surgical intervention. They need tension restored at the surface and firmness rebuilt underneath — which is precisely what this formula was clinically developed to do.\n\n**DC Instalift Goji GF is clinically proven**, and the cream is **used by over 100 leading aesthetic clinics around the world** — the same clinics that sell the procedures. Cellexia's work earned the **2026 European Cosmetic Prize**, Europe's highest honor for breakthrough anti-aging technology, awarded by a panel of 27 international experts.",
          citations: [
            { author: "[Lead author]", sample: "[n] women, [x] weeks", finding: "[key finding — e.g., measurable lift/firmness increase along the jawline]" },
            { author: "[Lead author]", sample: "[n] participants, [x] days", finding: "[key finding — e.g., immediate tightening effect measured after application]" },
            { author: "[Lead author]", sample: "[n] women aged [range], [x] weeks", finding: "[key finding — e.g., improvement in contour definition and skin elasticity]" },
          ],
          closing: "The clinics that offer €15,000 lifts stock this jar. That should tell you something.",
          image: undefined,
        },
      },
      {
        id: "s09_pillars",
        type: "pillars",
        data: {
          heading: "Why Cellexia is the jawline cream the clinics kept",
          items: [
            { title: "Instant, visible lift.", text: "The micro-peptide lifting film tightens sagging areas on contact — you verify it in the mirror on day one, not on day ninety." },
            { title: "Structural firming.", text: "A potent blend of skin-firming natural compounds rebuilds lasting firmness underneath, so the definition increasingly holds on its own." },
            { title: "Prize-winning science.", text: "Built on Nobel Prize-winning cellular-aging research; winner of the 2026 European Cosmetic Prize; used by 100+ leading aesthetic clinics worldwide." },
            { title: "Made for every morning.", text: "Lightweight, velvety, disappears under makeup — a ten-second ritual you'll actually keep, which is the only kind that works." },
          ],
          showAward: true,
        },
      },
      {
        id: "s10_expert",
        type: "expert_quote",
        data: {
          kicker: "The 90-day setup — an expert's recommendation",
          quote:
            "With sagging, I tell my patients two timelines. The lifting film works today — you'll see a more defined jawline in the mirror this week. But the *rebuild* underneath follows your skin's 28-day renewal cycles, and you need three of them for the firmness to consolidate and hold. That's the full 90-day protocol: one jar starts it, three jars finish it. Do the ten seconds every morning, and by day ninety the question you'll be answering is 'did you get work done?'",
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
              title: "1 Jar",
              subtitle: "Starter",
              badge: "",
              highlight: false,
              image: { src: `${CDN}/5M2A1565_1.jpg?v=1760691676`, alt: "Cellexia Jawline Contour Tightening Cream — 1 jar" },
              priceManual: "€57.00",
              compareManual: "",
              perUnitManual: "€57.00 per jar",
              saveManual: "",
              unitCount: 1,
              unitLabel: "jar",
              description: "Covers the jawline and neck for 4–6 weeks",
              giftLine: "",
              checks: "Free express shipping · 60-day money-back guarantee",
              buttonLabel: "Add to cart",
              variantId: "42650025492616",
              variantTitle: "1 Jar",
              quantity: 1,
              addOns: [],
            },
            {
              title: "3 Jars",
              subtitle: "The full 90-day protocol",
              badge: "Recommended by dermatologists",
              highlight: true,
              image: { src: `${CDN}/IMG_3613.jpg?v=1760691676`, alt: "Cellexia Jawline Contour Tightening Cream — 3-jar protocol", note: "Shopify CDN lifestyle/bundle shot (IMG_3613)" },
              priceManual: "€136.80",
              compareManual: "€171.00",
              perUnitManual: "€45.60 per jar",
              saveManual: "You save €34.20 (20%)",
              unitCount: 3,
              unitLabel: "jar",
              description: "The complete lift-and-rebuild protocol — jawline, jowls, under-chin and neck",
              giftLine: "",
              checks: "Free express shipping · 60-day money-back guarantee",
              buttonLabel: "Add to cart",
              variantId: "42739675037832",
              variantTitle: "3 Jars - 20% Off",
              quantity: 1,
              addOns: [],
            },
            {
              title: "2 Jars",
              subtitle: "",
              badge: "",
              highlight: false,
              image: { src: `${CDN}/5M2A1565_1.jpg?v=1760691676`, alt: "Cellexia Jawline Contour Tightening Cream — 2 jars", note: "Shopify CDN (5M2A1565_1)" },
              priceManual: "€96.90",
              compareManual: "€114.00",
              perUnitManual: "€48.45 per jar",
              saveManual: "You save €17.10 (15%)",
              unitCount: 2,
              unitLabel: "jar",
              description: "Takes you through the first visible-transformation phase",
              giftLine: "",
              checks: "Free express shipping · 60-day money-back guarantee",
              buttonLabel: "Add to cart",
              variantId: "42650025525384",
              variantTitle: "2 Jars - 15% Off",
              quantity: 1,
              addOns: [],
            },
          ],
          footnote: "Every order ships with a free sample sachet of Cellexia's Neck Tightening Cream — the jawline's natural partner.",
          crossSellEnabled: true,
          crossSellTitle: "Complete the lift: The Sculpt & Define set",
          crossSellText: "Jawline Contour + Neck Tightening Cream + Eye Lifting Serum",
          crossSellUrl: "https://cellexialabs.com/products/the-sculpt-define-lift",
          crossSellButton: "See the set",
          crossSellImage: undefined,
        },
      },
      {
        id: "s12_guarantee",
        type: "guarantee",
        data: {
          heading: "Not satisfied? You're covered by our 60-day money-back guarantee",
          body:
            "Do the ten seconds every morning. If you're not amazed by the definition you see — email **support@cellexialabs.com** with the subject \"Guarantee\" and we'll refund you in full within 1–2 business days. Even if the jar is empty. No forms, no phone calls, no questions asked.",
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
          heading: "Cellexia is the smart choice for your jawline — you deserve it",
          columns: [
            { label: "Cellexia Jawline Contour Cream", highlight: true },
            { label: "Ordinary face creams", highlight: false },
            { label: "Fillers, thread lifts & facelifts", highlight: false },
          ],
          rows: [
            { label: "Visible lift from the first application", cells: "✓ | ✗ | ✓" },
            { label: "Rebuilds firmness underneath over time", cells: "✓ | ✗ | ✗" },
            { label: "Works on jowls, under-chin AND neck", cells: "✓ | ✗ | ✗ (priced per area)" },
            { label: "Clinically proven active at clinical strength", cells: "✓ | ✗ | ✓" },
            { label: "Dermatologically approved, hypoallergenic", cells: "✓ | ✗ | ✗" },
            { label: "No needles, no pain, no downtime", cells: "✓ | ✓ | ✗" },
            { label: "No repeat appointments every 6–12 months", cells: "✓ | ✓ | ✗" },
            { label: "Wearable under makeup, every day", cells: "✓ | ✓ | —" },
            { label: "Cost", cells: "from €45.60/jar | €10–89, wasted | €800–€15,000, repeated" },
          ],
          footnote: "",
        },
      },
      {
        id: "s14_timeline",
        type: "timeline",
        data: {
          heading: "The results you can expect with Cellexia",
          subhead: "Two clocks run at once — the lift you see today, and the rebuild that makes it permanent-feeling.",
          phases: [
            { label: "Weeks 1–4", title: "The daily lift becomes your baseline.", text: "From the first application, the lifting film tightens and defines while you wear it. By week three, the skin along the jaw feels tighter on its own — the jawline starts showing its line again." },
            { label: "Weeks 4–8", title: "The rebuild shows.", text: "Jowls visibly lifted, marionette folds softened, the under-chin smoother and firmer. This is when husbands stare and friends ask what changed — and don't believe \"a cream and ten seconds.\"" },
            { label: "Weeks 8–12", title: "The contour consolidates.", text: "Three full renewal cycles in, the firmness increasingly holds without the film. You look in the mirror and see yourself again — the version with the jawline." },
          ],
          closing: "And every week of it is covered by the 60-day guarantee — you either see the definition, or you don't pay.",
          image: undefined,
        },
      },
      {
        id: "s15_testimonials",
        type: "testimonials",
        data: {
          heading: "Real customers, real results",
          items: [
            { name: "Karen", age: "58", badge: "Verified customer", headline: "Considering surgery for her jowls — until week three.", bullets: "Sister-in-law asked if she'd had a facelift\nVisible lift along the jawline in 3 weeks\nCanceled her surgical consultation", quote: "Three weeks in, my sister-in-law asked if I'd gotten a facelift. I'd been *saving* for one.", image: { src: "seed:p2-t1.jpg", alt: "Karen", note: "GENERATE (manifest) — candid portrait" } },
            { name: "Pamela", age: "61", badge: "Verified customer", headline: "\"All this loose skin under my chin made me look so much older.\"", bullets: "Under-chin visibly tighter in six weeks\nSends selfies now — on purpose\nTen seconds with her morning coffee", quote: "I can't stop looking at my jawline in the mirror. I look so much slimmer and healthier!", image: { src: "seed:p2-t2.jpg", alt: "Pamela" } },
            { name: "Dorothy", age: "69", badge: "Verified customer", headline: "She'd given up on the folds around her mouth.", bullets: "Marionette folds softened after two months\nJowls lifted \"as a side effect\"\nFeels like herself again", quote: "The folds have softened — and my jowls have actually lifted too. I feel like myself again.", image: { src: "seed:p2-t3.jpg", alt: "Dorothy" } },
            { name: "Eleanor R.", age: "64", badge: "Verified customer", headline: "A surgical nurse's verdict: \"facelift in a jar.\"", bullets: "Knows exactly what facelifts do — chose the jar\nFirmer jawline year over year\nAsked her age at a party, twice", quote: "I know what a facelift does to people — I'm a surgical nurse. For you pondering: it really works. No, it Really, REALLY works!!", image: { src: "seed:p2-t4.jpg", alt: "Eleanor R." } },
          ],
        },
      },
      {
        id: "s16_reviews",
        type: "reviews",
        data: {
          heading: "[12,000]+ five-star reviews — and counting",
          items: [
            { text: "By the end of 6 weeks I saw improvements — but it was my daughter commenting on my jawline that sealed it.", name: "Gail H.", stars: 5 },
            { text: "Sagging in my jowl area is reduced and my neck is better too. Second jar, still improving.", name: "Marlene B.", stars: 5 },
            { text: "I use it to maintain the results of a procedure — it keeps my chin and neck exactly where I want them.", name: "Teresa S.", stars: 5 },
          ],
        },
      },
      {
        id: "s17_faq",
        type: "faq",
        data: {
          heading: "Dr. [NAME], dermatologist, answers your questions about sagging skin",
          items: [
            { q: "I'm in my 60s or 70s and my jowls are pronounced. Is it too late?", a: "No. The lifting film works on contact at any age, and the deeper firming responds even on very mature skin — often *more* visibly, because there's more slack to recover. Age changes your starting point, not the mechanism." },
            { q: "I have sensitive skin. Will it irritate?", a: "It was formulated for daily use on mature, sensitive skin: hypoallergenic, non-comedogenic, dermatologically approved, and free from harmful preservatives and irritants." },
            { q: "The article I read said six weeks — why do you recommend 90 days?", a: "Six weeks is when the transformation becomes undeniable to other people. Ninety days — three full 28-day skin renewal cycles — is when the rebuilt firmness consolidates and holds. Stop at six weeks and you keep a good result; finish the protocol and you keep the *jawline*." },
            { q: "How exactly do I do the 10-second ritual?", a: "Pearl-sized amount on slightly damp skin after cleansing. Ring finger. Tap upward along the jawline from chin to ear, then under the chin and down the neck. Let it set for a minute before makeup or SPF." },
            { q: "Can I wear it under makeup and sunscreen?", a: "Yes — that's by design. The velvety texture absorbs completely and disappears under anything you layer over it." },
            { q: "When will I see the first results?", a: "The film's tightening effect is visible from the first applications. The structural change typically shows from week three, and becomes obvious to others around week six." },
            { q: "Are there side effects?", a: "None expected — the formula is clean and dermatologist-approved. The most common \"side effect\" my patients report is running out faster than planned, because they started using it on their neck too." },
            { q: "My mother had the same jowls. If it's hereditary, can a cream really help?", a: "You can't change your genetics — and I'd distrust anyone who claims otherwise. But heredity sets the *tendency*, not the ceiling. Tension at the surface plus rebuilt firmness underneath improves the contour you have, whatever wrote it." },
          ],
          firstOpen: false,
        },
      },
      { id: "s18_final", type: "final_cta", data: { heading: "Your jawline is ten seconds a day away", subhead: "", ctaLabel: CTA } },
    ],
  },
};
