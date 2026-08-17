/**
 * Seed: Interstitial #1 — Body Wrinkle Cream / Crepey Skin funnel.
 * Transcribed 1:1 from cellexia-interstitial-1-crepey-skin-copy.md. Nothing invented;
 * bracketed placeholders ([12,000], Dr. [FULL NAME], study slots) are left visible.
 *
 * Image sources follow the doc's manifest:
 *   REUSE  → Angle 1 sheet (already generated) → bundled in /public/seed
 *   GENERATE → hero lifestyle + testimonial portraits generated in the same style
 *   CDN    → Shopify CDN product shots
 *   `seed:` URLs are resolved by the seeder (uploaded to Shopify Files → CDN URL).
 */
import type { PageContent } from "../../types";
import { emptyPageContent } from "../../brand";

const CDN = "https://cdn.shopify.com/s/files/1/0611/7877/3640/files";
const CTA = "Order now and save up to 20%";

export const CREPEY_SKIN_SEED: { slug: string; title: string; productHandle: string; productTitle: string; content: PageContent } = {
  slug: "crepey-skin",
  title: "Crepey Skin — Body Wrinkle Cream",
  productHandle: "body-wrinkle-cream",
  productTitle: "Body Wrinkle Cream",
  content: {
    ...emptyPageContent(),
    funnelLabel: "Angle 1 · Crepey skin (arms/neck)",
    notes:
      "Base template. Fed by the Angle 1 advertorial. Fill: [250,000]+ jars, [12,000]+ reviews, Dr. [FULL NAME] + portrait, 3 study citations. Confirm 60-day guarantee policy (Sections 0/11/12/14). Discount code CREPE20 is a suggestion — enable it once the code exists in Shopify Discounts.",
    seo: { title: "3 reasons thousands of women apply this to their arms every morning | Cellexia", description: "Dermatologist-endorsed body wrinkle cream for crepey skin — firmer, smoother arms, neck and décolletage in 90 days.", noindex: true },
    commerce: {
      productHandle: "body-wrinkle-cream",
      productTitle: "Body Wrinkle Cream",
      productId: "gid://shopify/Product/8255912575112",
      discountCode: "CREPE20",
      discountEnabled: false,
      checkoutMode: "checkout",
      utmPassthrough: true,
      livePrices: true,
      marketOverrides: {},
    },
    stickyBar: { enabled: true, text: "★★★★★ [12,000]+ reviews", buttonLabel: CTA, showAfterSectionIndex: 0 },
    sections: [
      { id: "s00_announce", type: "announcement_bar", data: { useBrandStrings: true, text: "Free express shipping on every order · 60-day money-back guarantee", tone: "ink" } },
      {
        id: "s01_hero",
        type: "hero",
        data: {
          eyebrow: "Recommended by dermatologists across Europe",
          headline: "3 reasons why thousands of women over 50 apply this to their arms every morning — and their crepey skin is disappearing",
          subhead: "Dermatologist-endorsed. Built on Nobel Prize-winning research into cellular aging. Winner of the 2026 European Cosmetic Prize.",
          trust: "Used in 100+ leading aesthetic clinics · [250,000]+ jars shipped across Europe · [12,000]+ ★★★★★ reviews",
          ctaLabel: CTA,
          badges: [
            { label: "2026 European Cosmetic Prize", image: { src: "seed:award-seal.svg", alt: "2026 European Cosmetic Prize seal" } },
            { label: "Dermatologically approved" },
            { label: "Used in 100+ aesthetic clinics" },
            { label: "Based on Nobel Prize-winning research" },
          ],
          image: { src: "seed:p1-hero.jpg", alt: "Woman around 60 in a sleeveless summer dress at golden hour, arms relaxed", note: "GENERATE (manifest) — hero lifestyle, UGC-real style" },
          imagePosition: "right",
        },
      },
      {
        id: "s02_reason1",
        type: "reason",
        data: {
          number: "1",
          image: { src: "seed:p1-reason1-arms-diptych.jpg", alt: "Before/after: crepey forearms and hands crossed at the chest", note: "REUSE — Angle 1 sheet IMG-B" },
          heading: "Visibly firmer, smoother arms, neck and décolletage — in 90 days",
          body:
            "Crepey, tissue-paper skin isn't something you have to \"just live with.\" Cellexia's Body Wrinkle Cream was designed for exactly the zones women hide: the inner arms that crease when you reach for something, the loose skin on the chest and neck, the crinkled texture on hands, elbows and knees.\n\nUsed every morning, most women feel the difference in days — skin that's denser and more hydrated under the fingertips — and see it in weeks: the tissue-paper texture smooths, the skin looks more substantial, and by the end of the full 90-day protocol, the transformation is the kind other people comment on.",
          closing: "Firm enough for sleeveless. Smooth enough to stop thinking about it.",
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
          image: { src: "seed:diagram-skin-layers.svg", alt: "Skin-layer diagram: where lotions stop vs where fibroblasts live", note: "GENERATE (manifest) — clean editorial diagram (SVG)" },
          heading: "It wakes up the cells your body lotion can never reach",
          body:
            "Here's what most women are never told: crepey skin isn't a moisture problem — it's a *production* problem. Deep in the skin live fibroblasts, the cells that manufacture your collagen. After 50, and especially after menopause, they go dormant one by one. The factory slows down — while the collagen you already have tangles and unravels.\n\nOrdinary lotions sit on the top 0.02 millimeters of skin. They can't reach the problem, so they can't fix it — no matter how expensive the jar.\n\nCellexia is different. Its Granactive AGE complex — palmitoyl hexapeptide-14 with plant-derived glycoconjugates from goji berry extract — penetrates into the skin's thickest layers and **re-activates dormant fibroblasts**, boosting collagen production where firmness is actually made. The result is skin rebuilt from the inside out: an immediate firming effect you can feel, and a structural change that compounds week after week.",
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
          image: { src: "seed:p1-reason3-application.jpg", alt: "Cream being massaged into the inner forearm", note: "REUSE — Angle 1 sheet IMG-E" },
          heading: "Thirty seconds a day — for every crepey zone on your body",
          body:
            "No ten-step routine. No gadgets. No appointments.\n\nAfter your morning shower, one pump anywhere crepey skin appears — arms, neck, chest, hands, elbows, knees — massaged in for about 30 seconds. The rich, velvety texture melts in completely: no residue, no greasy film, nothing to wait for before you get dressed.",
          closing: "One cream. Every zone. Thirty seconds. That's the entire ritual — and it's precisely why women stick with it long enough to get the 90-day result.",
          showCta: false,
          ctaLabel: CTA,
          imageStyle: "full",
        },
      },
      {
        id: "s05_diff",
        type: "text_block",
        data: {
          heading: "Here's why Cellexia works when everything else you tried didn't",
          body:
            "If you've bought firming creams before and been disappointed, it wasn't your fault — and it wasn't bad luck. Almost every product on the shelf makes the same two mistakes:\n\n**Mistake 1: too little.** Trace amounts of good ingredients, at concentrations chosen for the label, not for results.\n\n**Mistake 2: too shallow.** Actives that never penetrate past the surface layer of the skin. It doesn't matter how good an ingredient is — if it can't reach the problem, nothing happens.\n\nCellexia's Body Wrinkle Cream was engineered to avoid exactly that: **clinical-strength Granactive AGE**, carried by a delivery system designed for the *body's thickest skin* — because your arms and knees aren't your face, and a face cream was never going to work there.",
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
          heading: "A 100% clean formula — made for mature, sensitive skin",
          body:
            "No fragrance to irritate. No harmful preservatives. No harsh actives that leave mature skin red and raw.\n\nCellexia Body Wrinkle Cream is **hypoallergenic, non-comedogenic, and dermatologically approved** — a 100% clean formula gentle enough for daily use on sensitive, post-menopausal skin, on every zone from the neck to the knees.",
          icons: [
            { label: "Hypoallergenic", icon: "shield" },
            { label: "Non-comedogenic", icon: "drop" },
            { label: "Dermatologically approved", icon: "sparkle" },
            { label: "Free of harmful preservatives", icon: "ban" },
          ],
          image: { src: `${CDN}/5M2A1560_1.jpg?v=1760693170`, alt: "Cellexia Body Wrinkle Cream jar", note: "Shopify CDN — jar" },
        },
      },
      {
        id: "s07_science",
        type: "science",
        data: {
          heading: "Why fibroblast re-activation really works",
          steps: [
            { text: "Fibroblasts are the cells deep in your skin that build and maintain collagen and elastin — the scaffolding that keeps skin thick, firm and elastic. Until your mid-40s, they work around the clock." },
            { text: "After 50 — and especially after menopause — fibroblasts begin going dormant. Not dead, not damaged: asleep. Collagen production falls, while the collagen you already have fragments and unravels faster than it's replaced." },
            { text: "The result is the double failure behind crepey skin: the factory has shut down, and what it built is falling apart. That's why skin on the arms, neck and hands suddenly looks \"deflated\" — and why no surface moisturizer can reverse it." },
          ],
          closing:
            "Cellexia's approach comes from the modern science of cellular aging — the line of research that won a Nobel Prize. Instead of coating the surface, it targets the cells that do the building: wake the fibroblasts, and the skin starts rebuilding itself.",
          showCta: true,
          ctaLabel: CTA,
          image: undefined,
          imagePosition: "left",
        },
      },
      {
        id: "s08_evidence",
        type: "evidence",
        data: {
          heading: "Is Cellexia really effective — or just marketing hype?",
          body:
            "Fair question. It's the one we'd ask too — and it's why every claim on this page traces back to research, not adjectives.\n\nThe formula's core complex, Granactive AGE, is a **clinically proven blend** — and Cellexia's work in cellular aging was recognized in 2026 with the **European Cosmetic Prize, Europe's highest honor for breakthrough anti-aging technology, awarded by a panel of 27 international experts**. It's also the reason the cream is stocked and recommended in over 100 leading aesthetic clinics — professionals who see skin all day don't recommend products that embarrass them.",
          citations: [
            { author: "[Lead author]", sample: "[n] women, [x] weeks", finding: "[key finding — e.g., measurable increase in skin density/firmness]" },
            { author: "[Lead author]", sample: "[n] participants, [x] days", finding: "[key finding — e.g., reduction in wrinkle depth / improved elasticity]" },
            { author: "[Lead author]", sample: "[n] women aged [range], [x] weeks", finding: "[key finding — e.g., visible improvement in crepey texture]" },
          ],
          closing: "The verdict from the data: fibroblast re-activation is measurable — not marketing.",
          image: { src: "seed:p1-evidence-hands-diptych.jpg", alt: "Before/after: the same hands, crepey vs smoother", note: "REUSE — Angle 1 sheet IMG-A (evidence support)" },
        },
      },
      {
        id: "s09_pillars",
        type: "pillars",
        data: {
          heading: "Why Cellexia is the body-firming cream Europe is talking about",
          items: [
            { title: "Clinical strength.", text: "The actives are dosed at the concentrations used in the research — not the trace amounts behind most pretty labels." },
            { title: "Deep delivery.", text: "A delivery system built for the body's thickest skin carries Granactive AGE down to the layers where fibroblasts live — where firmness is actually made." },
            { title: "Prize-winning science.", text: "Built on Nobel Prize-winning cellular-aging research; winner of the 2026 European Cosmetic Prize; used in 100+ leading aesthetic clinics." },
            { title: "A texture you'll actually love.", text: "Rich and velvety, absorbs completely in 30 seconds, leaves nothing behind but smooth skin. The best formula is the one you'll use every single day — so we made daily use the easiest part." },
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
            "When a patient shows me crepey skin on her arms or neck, I tell her the same thing every time: commit to the full 90-day protocol. Your skin renews itself in roughly 28-day cycles — you need three complete cycles for the rebuild to show its full effect. One jar starts the process. Three jars finish it. The women who are stopped in the street and asked 'what are you using?' are the ones who went the full 90 days.",
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
              image: { src: `${CDN}/5M2A1560_1.jpg?v=1760693170`, alt: "Cellexia Body Wrinkle Cream — 1 jar" },
              priceManual: "€57.00",
              compareManual: "",
              perUnitManual: "€57.00 per jar",
              saveManual: "",
              unitCount: 1,
              unitLabel: "jar",
              description: "Covers one zone for 4–6 weeks",
              giftLine: "",
              checks: "Free express shipping · 60-day money-back guarantee",
              buttonLabel: "Add to cart",
              variantId: "42686740791432",
              variantTitle: "1 Jar",
              quantity: 1,
              addOns: [],
            },
            {
              title: "3 Jars",
              subtitle: "The full 90-day protocol",
              badge: "Recommended by dermatologists",
              highlight: true,
              image: { src: `${CDN}/IMG_3618.jpg?v=1760693170`, alt: "Cellexia Body Wrinkle Cream — 3-jar protocol", note: "Shopify CDN lifestyle/bundle shot (IMG_3618)" },
              priceManual: "€136.80",
              compareManual: "€171.00",
              perUnitManual: "€45.60 per jar",
              saveManual: "You save €34.20 (20%)",
              unitCount: 3,
              unitLabel: "jar",
              description: "Enough for the complete 90-day transformation — arms, neck, chest, hands and knees",
              giftLine: "FREE gift: Bamboo Beauty Towel (worth €29) — this pack only",
              giftImage: { src: `${CDN}/Towel1.jpg?v=1736753333`, alt: "Bamboo Beauty Towel" },
              checks: "Free express shipping · 60-day money-back guarantee",
              buttonLabel: "Add to cart",
              variantId: "42739679559816",
              variantTitle: "3 Jars - 20% Off",
              quantity: 1,
              addOns: [{ variantId: "55089188438391", quantity: 1, label: "Bamboo Beauty Towel — FreeGift (SKU 600007)" }],
            },
            {
              title: "2 Jars",
              subtitle: "",
              badge: "",
              highlight: false,
              image: { src: `${CDN}/5M2A1514_5.jpg?v=1760693170`, alt: "Cellexia Body Wrinkle Cream — 2 jars", note: "Shopify CDN (5M2A1514_5)" },
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
              variantId: "42686740824200",
              variantTitle: "2 Jars - 15% Off",
              quantity: 1,
              addOns: [],
            },
          ],
          footnote: "Every order ships with a free sample sachet of Cellexia's Neck Tightening Cream.",
          crossSellEnabled: false,
          crossSellTitle: "",
          crossSellText: "",
          crossSellUrl: "",
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
            "Use Cellexia every morning. If you're not amazed by what you see — if your arms don't look and feel visibly firmer — email **support@cellexialabs.com** with the subject \"Guarantee\" and we'll refund you in full within 1–2 business days. Even if the jar is empty. No forms, no phone calls, no questions asked.",
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
          heading: "Cellexia is the smart choice for your skin — you deserve it",
          columns: [
            { label: "Cellexia Body Wrinkle Cream", highlight: true },
            { label: "Ordinary body lotions", highlight: false },
            { label: "Skin-tightening procedures", highlight: false },
          ],
          rows: [
            { label: "Works at the root cause (dormant fibroblasts)", cells: "✓ | ✗ | ✗" },
            { label: "Reaches the deep layers where firmness is made", cells: "✓ | ✗ | ✓" },
            { label: "Clinically proven actives at clinical strength", cells: "✓ | ✗ | ✓" },
            { label: "Designed for mature 50+ skin", cells: "✓ | ✗ | ✗" },
            { label: "Dermatologically approved, hypoallergenic", cells: "✓ | ✗ | ✗" },
            { label: "No needles, no pain, no downtime", cells: "✓ | ✓ | ✗" },
            { label: "One product for arms, neck, chest, hands & knees", cells: "✓ | ✓ | ✗" },
            { label: "Results that keep building over 90 days", cells: "✓ | ✗ | ✗ (RF results fade in ~8 months)" },
            { label: "Cost", cells: "from €45.60/jar | €10–89, wasted | €3,000+ per session" },
          ],
          footnote: "",
        },
      },
      {
        id: "s14_timeline",
        type: "timeline",
        data: {
          heading: "The results you can expect with Cellexia",
          subhead: "Real change is built in cycles — here's the honest timeline.",
          phases: [
            { label: "Weeks 1–4", title: "The skin wakes up.", text: "Within 24–48 hours skin feels denser and more hydrated under your fingertips. By week two, the tissue-paper texture starts smoothing visibly — this is when husbands say \"your skin looks good today\" without knowing why." },
            { label: "Weeks 4–8", title: "Firm becomes visible.", text: "Arms, neck and décolletage look firmer and more substantial. The crepey texture fades zone by zone. This is when the sleeveless top stays on — and the questions start at book club." },
            { label: "Weeks 8–12", title: "The full transformation.", text: "The complete 90-day rebuild: smooth, firm, \"did-you-get-something-done?\" skin on every zone you've treated. You're back in photos. You're back in the pool." },
          ],
          closing: "And every week of it is covered by the 60-day guarantee — you either see the change, or you don't pay.",
          image: undefined,
        },
      },
      {
        id: "s15_testimonials",
        type: "testimonials",
        data: {
          heading: "Real customers, real results",
          items: [
            { name: "Barbara T.", age: "61", badge: "Verified customer", headline: "From \"consultation booked\" to canceling the procedure.", bullets: "Firmer, smoother arms in 8 weeks\nCanceled her €3,000 skin-tightening consultation\nHusband noticed before she did", quote: "I had a consultation booked. Canceled it at week eight when my husband said my arms looked ten years younger.", image: { src: "seed:p1-t1.jpg", alt: "Barbara T.", note: "GENERATE (manifest) — candid portrait" } },
            { name: "Donna R.", age: "63", badge: "Verified customer", headline: "From pulling her neckline up — to buying a v-neck.", bullets: "Neck and décolletage visibly smoother\nStopped adjusting her clothes in every mirror\nWears v-necks again after three years", quote: "Week six, I stopped pulling my neckline up before every mirror check. I bought a v-neck last month.", image: { src: "seed:p1-t2.jpg", alt: "Donna R." } },
            { name: "Linda S.", age: "59", badge: "Verified customer", headline: "She stopped looking at her legs at 57. Started again at 59.", bullets: "Crepey texture on thighs and knees smoothed out\nBought shorts for the first summer in four years\nUses one pump per zone, 30 seconds", quote: "I'd stopped looking at my legs somewhere around 57. Started again at 59. Bought shorts in June.", image: { src: "seed:p1-t3.jpg", alt: "Linda S." } },
            { name: "Carol W.", age: "67", badge: "Verified customer", headline: "Three dermatologists told her nothing topical would work.", bullets: "Visible change on arms and neck within a month\nNow the one recommending it to friends\n\"They just hadn't seen this yet.\"", quote: "Three dermatologists told me there was nothing topical for crepey skin. I believed them for two years. Turns out they just hadn't seen this yet.", image: { src: "seed:p1-t4.jpg", alt: "Carol W." } },
          ],
        },
      },
      {
        id: "s16_reviews",
        type: "reviews",
        data: {
          heading: "[12,000]+ five-star reviews — and counting",
          items: [
            { text: "My skin feels so much firmer and looks vibrant. And I love that the formula is clean.", name: "Michelle S.", stars: 5 },
            { text: "I'm almost 69 and I'm told my arms look a lot younger. Here's my secret.", name: "Lorraine T.", stars: 5 },
            { text: "My new dermatologist was amazed. I've recommended it to my daughter — she uses the whole line now.", name: "Cathy B.", stars: 5 },
          ],
        },
      },
      {
        id: "s17_faq",
        type: "faq",
        data: {
          heading: "Dr. [NAME], dermatologist, answers your questions about crepey skin",
          items: [
            { q: "I'm in my 60s (or 70s). Is it too late for this to work?", a: "Not at all — in fact, the most dramatic results I see are often in women over 60. The more dormant fibroblasts your skin has, the more there is to re-activate. Age changes the starting point, not the mechanism." },
            { q: "I have sensitive skin. Will it irritate?", a: "The formula was built for mature, sensitive skin: hypoallergenic, non-comedogenic, free of fragrance and harsh preservatives, and dermatologically approved. Intolerances are extremely rare." },
            { q: "Why exactly 90 days?", a: "Your skin renews itself in roughly 28-day cycles. One cycle wakes the fibroblasts, the second rebuilds visibly, the third consolidates the result. Three cycles — about 90 days — is when the full transformation is on display. That's why I recommend the 3-jar protocol." },
            { q: "How do I apply it correctly?", a: "Every morning after your shower: one pump per zone — arms, neck, chest, hands, elbows, knees — massaged in circular motions for about 30 seconds. Slightly damp skin helps the actives penetrate." },
            { q: "Can I use it alongside my other skincare and SPF?", a: "Yes. It absorbs completely, so apply Cellexia first, let it settle for a minute, then layer sunscreen or anything else as usual." },
            { q: "When will I see the first results?", a: "You'll *feel* the difference — denser, more hydrated skin — within 24–48 hours. Visible smoothing typically starts between days 7 and 14, with the dramatic change in weeks 3–4." },
            { q: "Are there side effects?", a: "None expected — the formula is 100% clean. The only \"side effects\" my patients report are the zones they didn't plan to treat: smoother hands and knees, because the pump was already in their hand." },
            { q: "My crepey skin is genetic — and I had decades of sun. Will it still work?", a: "You can't change your genes or undo the past, and I won't pretend otherwise. But the mechanism — re-activating collagen production — works regardless of how the crepe got there. It can't rewrite your history; it can rebuild your skin's output from today forward." },
          ],
          firstOpen: false,
        },
      },
      { id: "s18_final", type: "final_cta", data: { heading: "Your arms have waited long enough", subhead: "", ctaLabel: CTA } },
    ],
  },
};
