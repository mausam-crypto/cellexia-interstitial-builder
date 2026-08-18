import type { BrandSettings } from "../types";

/**
 * The page stylesheet. Everything is namespaced under #cx-page / .cx-* so the
 * store theme's CSS and ours never fight. Brand tokens come from BrandSettings.
 * Kept compact (~20KB) so a cold click renders fast; it is inlined once per page.
 */
export function pageCss(brand: BrandSettings): string {
  const t = {
    accent: brand.accentColor || "#B1CDED",
    accentText: brand.accentText || "#1D1D1B",
    ink: brand.inkColor || "#1D1D1B",
    body: brand.bodyColor || "#2B2B29",
    soft: brand.softBg || "#F7F6F3",
    highlight: brand.highlightBg || "#EEF4FA",
    fontHeading: brand.fontHeading || "'argumentum','Inter',system-ui,sans-serif",
    fontBody: brand.fontBody || "'argumentum','Inter',system-ui,sans-serif",
    fontDisplay: brand.fontDisplay || "'Gobold','argumentum','Inter',system-ui,sans-serif",
    radius: brand.buttonRadius || "999px",
  };
  const bleed = brand.fullBleed !== false;
  return `
#cx-page{--cx-accent:${t.accent};--cx-accent-text:${t.accentText};--cx-ink:${t.ink};--cx-body:${t.body};--cx-soft:${t.soft};--cx-hl:${t.highlight};--cx-border:#E4E2DC;--cx-muted:#6D6C68;--cx-yes:#1E8E3E;--cx-no:#C0392B;--cx-fh:${t.fontHeading};--cx-fb:${t.fontBody};--cx-fd:${t.fontDisplay};--cx-r:${t.radius};--cx-max:1080px;--cx-max-n:760px;
font-family:var(--cx-fb);color:var(--cx-body);font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased;text-align:left;width:100%;position:relative;overflow-x:clip}
:where(#cx-page) *,:where(#cx-page) *::before,:where(#cx-page) *::after{box-sizing:border-box}
:where(#cx-page) img{max-width:100%;height:auto;display:block}
:where(#cx-page) :where(ul,ol){list-style:none;margin:0;padding:0}
:where(#cx-page) p{margin:0 0 1em}
:where(#cx-page) p:last-child{margin-bottom:0}
:where(#cx-page) a{color:inherit;text-decoration:none}
:where(#cx-page) :where(h1,h2,h3){font-family:var(--cx-fh);color:var(--cx-ink);margin:0;font-weight:700;letter-spacing:-.01em;text-transform:none;line-height:1.2}
.cx-band{padding:48px 0;position:relative;${bleed ? "width:100vw;margin-left:calc(50% - 50vw);" : ""}}
.cx-band--white{background:#fff}
.cx-band--soft{background:var(--cx-soft)}
.cx-band--highlight{background:var(--cx-hl)}
.cx-band--hero{padding-top:28px}
.cx-wrap{max-width:var(--cx-max);margin:0 auto;padding:0 20px}
.cx-wrap--narrow{max-width:var(--cx-max-n)}
.cx-h{font-size:28px;line-height:1.2;margin-bottom:18px}
.cx-h--center{text-align:center}
.cx-h1{font-size:31px;line-height:1.15;margin:8px 0 16px}
.cx-eyebrow{font-family:var(--cx-fd);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--cx-muted);margin:0 0 6px;font-weight:700}
.cx-lead{font-size:18px;color:var(--cx-body);margin:0 0 16px}
.cx-lead--center{text-align:center}
.cx-trust{font-size:14px;color:var(--cx-muted);margin:0 0 20px;line-height:1.5}
.cx-trust .cx-dot,.cx-announce__dot{margin:0 8px;opacity:.6}
.cx-prose p,.cx-prose li{font-size:17px;line-height:1.65}
.cx-prose ul{margin:0 0 1em;padding-left:1.2em;list-style:disc}
.cx-prose strong{color:var(--cx-ink)}
.cx-prose--sm p{font-size:15.5px}
.cx-prose--center{text-align:center}
.cx-prose__closing{font-weight:700;color:var(--cx-ink);margin-top:14px}
.cx-note{font-size:13px;color:var(--cx-muted);margin-top:10px;text-align:center}
/* buttons */
.cx-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;font-family:var(--cx-fb);font-weight:700;font-size:14px;letter-spacing:.06em;text-transform:uppercase;line-height:1.2;padding:16px 30px;border-radius:var(--cx-r);border:2px solid transparent;cursor:pointer;transition:transform .15s ease,filter .15s ease,background .15s ease;text-align:center;min-height:52px}
.cx-btn:hover{transform:translateY(-1px);filter:brightness(.96)}
.cx-btn--accent{background:var(--cx-accent);color:var(--cx-accent-text);border-color:var(--cx-accent)}
.cx-btn--ink{background:var(--cx-ink);color:#fff;border-color:var(--cx-ink)}
.cx-btn--secondary{background:transparent;color:var(--cx-ink);border-color:var(--cx-ink)}
.cx-btn--lg{padding:18px 40px;font-size:15px}
.cx-btn--block{width:100%}
.cx-cta-row{margin-top:24px}
.cx-cta-row--center{text-align:center}
.cx-cta-solo{margin:0}
/* announcement */
.cx-announce{font-size:13px;letter-spacing:.02em;text-align:center;padding:10px 0;font-weight:600;${bleed ? "width:100vw;margin-left:calc(50% - 50vw);" : ""}}
.cx-announce--ink{background:var(--cx-ink);color:#fff}
.cx-announce--accent{background:var(--cx-accent);color:var(--cx-accent-text)}
.cx-announce--soft{background:var(--cx-soft);color:var(--cx-ink)}
/* hero */
.cx-hero{display:grid;gap:26px;align-items:center}
.cx-hero__media img,.cx-hero__media .cx-img-placeholder{border-radius:14px;width:100%}
.cx-hero__cta{margin:6px 0 22px}
.cx-badges{display:flex;flex-wrap:wrap;gap:8px 10px}
.cx-badge{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:.03em;color:var(--cx-ink);background:var(--cx-soft);border:1px solid var(--cx-border);border-radius:999px;padding:7px 12px}
.cx-badge__img{width:26px;height:26px;object-fit:contain}
/* reason */
.cx-reason__media{margin:0 0 26px}
.cx-reason__media img,.cx-reason__media .cx-img-placeholder{width:100%;border-radius:14px}
.cx-reason__media--contained{max-width:900px;margin-left:auto;margin-right:auto}
.cx-reason__body{max-width:var(--cx-max-n);margin:0 auto}
.cx-reason__head{display:flex;gap:16px;align-items:flex-start;margin-bottom:14px}
.cx-numeral{font-family:var(--cx-fd);font-size:56px;line-height:.9;color:var(--cx-ink);font-weight:800;min-width:.9em;position:relative;top:-4px}
.cx-numeral::after{content:".";color:var(--cx-accent)}
.cx-reason__h{margin-bottom:0}
/* text */
.cx-text--center{text-align:center}
/* icon rows */
.cx-iconrow{display:grid;grid-template-columns:repeat(2,1fr);gap:16px 14px;margin-top:22px}
.cx-iconrow--center{justify-items:center;text-align:center;grid-template-columns:repeat(3,1fr)}
.cx-iconrow__item{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:600;color:var(--cx-ink);line-height:1.3}
.cx-iconrow--center .cx-iconrow__item{flex-direction:column;gap:8px}
.cx-iconrow__icon{width:44px;height:44px;flex:0 0 44px;border-radius:50%;background:var(--cx-hl);color:var(--cx-ink);display:inline-flex;align-items:center;justify-content:center}
.cx-purity,.cx-science{display:grid;gap:26px;align-items:center}
.cx-purity__media img,.cx-science__media img{border-radius:14px}
/* steps */
.cx-steps{margin:8px 0 18px;display:grid;gap:14px}
.cx-steps__item{display:flex;gap:14px;align-items:flex-start}
.cx-steps__num{flex:0 0 36px;width:36px;height:36px;border-radius:50%;background:var(--cx-ink);color:#fff;font-family:var(--cx-fd);font-weight:800;display:inline-flex;align-items:center;justify-content:center;font-size:16px}
/* evidence */
.cx-evidence__grid{display:grid;gap:26px;align-items:start}
.cx-evidence__media img{border-radius:14px}
.cx-cites{margin:18px 0;padding:18px 20px;border:1px solid var(--cx-border);border-radius:12px;background:var(--cx-soft);display:grid;gap:12px}
.cx-cite{font-size:15px;line-height:1.5;padding-left:16px;position:relative}
.cx-cite::before{content:"";position:absolute;left:0;top:.6em;width:6px;height:6px;border-radius:50%;background:var(--cx-accent)}
.cx-cite__author{font-weight:700;color:var(--cx-ink)}
.cx-cite__sample{color:var(--cx-muted)}
/* pillars */
.cx-pillars__head{text-align:center;margin-bottom:22px}
.cx-seal{margin:8px auto 0}
.cx-pillars__grid{display:grid;gap:14px}
.cx-pillar{background:#fff;border:1px solid var(--cx-border);border-radius:12px;padding:22px 20px}
.cx-pillar__img{width:44px;height:44px;object-fit:contain;margin-bottom:12px}
.cx-pillar__title{font-size:18px;margin-bottom:8px}
/* expert */
.cx-expert{display:grid;gap:22px;align-items:center;max-width:920px;margin:0 auto}
.cx-expert__img{width:160px;height:160px;border-radius:50%;object-fit:cover;margin:0 auto}
.cx-expert__img.cx-img-placeholder{width:160px;height:160px;min-height:0;padding:8px;flex:0 0 auto}
.cx-expert__quote{margin:0;font-size:19px;line-height:1.55;color:var(--cx-ink);font-style:italic}
.cx-expert__quote p{font-size:inherit}
.cx-expert__name{margin:14px 0 0;font-weight:700;color:var(--cx-ink)}
.cx-expert__cred{font-weight:400;color:var(--cx-muted)}
.cx-expert--center{text-align:center}
/* pricing */
.cx-band--offer{scroll-margin-top:90px}
.cx-cards{display:grid;gap:18px;margin:0 0 18px;padding:24px 0 6px}
.cx-card{position:relative;background:#fff;border:1.5px solid var(--cx-border);border-radius:16px;padding:6px}
.cx-card__inner{padding:22px 18px 20px;text-align:center}
.cx-card--highlight{border-color:var(--cx-ink);box-shadow:0 12px 34px rgba(0,0,0,.08);background:linear-gradient(180deg,var(--cx-hl),#fff 45%)}
.cx-card__badge{position:absolute;top:-14px;left:50%;transform:translateX(-50%);background:var(--cx-ink);color:#fff;font-family:var(--cx-fd);font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;padding:7px 14px;border-radius:999px;white-space:nowrap;max-width:92%;overflow:hidden;text-overflow:ellipsis}
.cx-card__sub{font-family:var(--cx-fd);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--cx-muted);margin:8px 0 2px;font-weight:700}
.cx-card__title{font-size:22px;margin:0 0 12px}
.cx-card__media{max-width:210px;margin:0 auto 14px}
.cx-card__img,.cx-card__media .cx-img-placeholder{border-radius:12px;width:100%}
.cx-price__main{display:flex;gap:10px;align-items:baseline;justify-content:center}
.cx-price__now{font-size:30px;font-weight:800;color:var(--cx-ink);letter-spacing:-.02em}
.cx-price__was{font-size:17px;color:var(--cx-muted)}
.cx-price__meta{display:flex;flex-direction:column;gap:2px;font-size:14px;color:var(--cx-muted);margin-top:4px}
.cx-price__save{color:var(--cx-yes);font-weight:700}
.cx-card__desc{font-size:14.5px;color:var(--cx-body);margin:12px 0 0;line-height:1.5}
.cx-card__gift{display:flex;gap:10px;align-items:center;text-align:left;background:var(--cx-hl);border-radius:10px;padding:10px 12px;margin:14px 0 0;font-size:13.5px;font-weight:600;color:var(--cx-ink)}
.cx-card__delivery{display:flex;gap:8px;align-items:center;justify-content:center;font-size:13.5px;color:var(--cx-body);margin:10px 0 0;line-height:1.4}
.cx-card__delivery svg{width:16px;height:16px;flex:0 0 16px;color:var(--cx-ink)}
.cx-card__offer{font-size:14px;font-weight:700;color:var(--cx-ink);background:var(--cx-hl);border-radius:10px;padding:8px 12px;margin:10px 0 0;line-height:1.35}
.cx-card__note{font-size:12.5px;line-height:1.45;color:var(--cx-muted);margin:8px 0 0;text-align:center}
.cx-pricing__terms{max-width:760px;margin:18px auto 0;text-align:center;font-size:12.5px;line-height:1.5;color:var(--cx-muted)}
.cx-card__gift-img{width:44px;height:44px;object-fit:cover;border-radius:8px;flex:0 0 44px}
.cx-card__gift-icon{flex:0 0 auto;display:inline-flex}
.cx-card__btn{margin:16px 0 14px}
.cx-card__checks{display:grid;gap:6px;text-align:left;font-size:13.5px;color:var(--cx-body)}
.cx-card__checks li{display:flex;gap:8px;align-items:flex-start;line-height:1.35}
.cx-card__checks svg{color:var(--cx-yes);flex:0 0 18px;margin-top:1px}
.cx-pricing__note{text-align:center;font-size:14px;color:var(--cx-muted);margin:10px 0 0}
.cx-cross{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin:26px auto 0;max-width:820px;border:1px solid var(--cx-border);border-radius:14px;padding:16px 18px;background:var(--cx-soft)}
.cx-cross__media{flex:0 0 84px}
.cx-cross__img,.cx-cross__media .cx-img-placeholder{width:84px;height:84px;object-fit:cover;border-radius:10px}
.cx-cross__copy{flex:1 1 200px}
.cx-cross__title{font-size:17px;margin-bottom:4px}
.cx-cross__copy p{font-size:14px;color:var(--cx-muted)}
/* guarantee */
.cx-guarantee{text-align:center}
.cx-gseal{width:112px;height:112px;border-radius:50%;background:#fff;border:3px double var(--cx-ink);margin:0 auto 18px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--cx-ink)}
.cx-gseal__num{font-family:var(--cx-fd);font-size:34px;font-weight:800;line-height:1}
.cx-gseal__txt{font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;font-weight:700;padding:0 10px;line-height:1.2;margin-top:3px}
/* comparison */
.cx-cmp__scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -20px;padding:0 20px}
.cx-cmp__table{width:100%;min-width:560px;border-collapse:separate;border-spacing:0;border:1px solid var(--cx-border);border-radius:14px;overflow:hidden;font-size:14.5px;background:#fff}
.cx-cmp__table th,.cx-cmp__table td{padding:13px 12px;border-bottom:1px solid var(--cx-border);vertical-align:middle;text-align:center}
.cx-cmp__table thead th{background:var(--cx-soft);font-weight:700;color:var(--cx-ink);font-size:13.5px;line-height:1.3}
.cx-cmp__table tbody th{text-align:left;font-weight:600;color:var(--cx-ink);width:40%;line-height:1.35}
.cx-cmp__table tr:last-child th,.cx-cmp__table tr:last-child td{border-bottom:0}
.cx-cmp__hi{background:var(--cx-hl)!important;font-weight:700}
.cx-cmp__table thead th.cx-cmp__hi{background:var(--cx-accent)!important;color:var(--cx-accent-text)}
.cx-cmp__yes{color:var(--cx-yes);display:inline-flex}
.cx-cmp__no{color:var(--cx-no);display:inline-flex}
.cx-cmp__dash{color:var(--cx-muted);display:inline-flex}
.cx-cmp__txt{display:block;font-size:12.5px;color:var(--cx-muted);font-weight:500;margin-top:2px}
.cx-cmp__hi .cx-cmp__txt{color:var(--cx-ink);font-weight:700;font-size:14px}
.cx-cmp__foot{font-size:13px;color:var(--cx-muted);margin-top:12px;text-align:center}
/* timeline */
.cx-tl{display:grid;gap:26px;align-items:start}
.cx-tl__list{margin:12px 0 18px;position:relative;display:grid;gap:22px}
.cx-tl__list::before{content:"";position:absolute;left:19px;top:10px;bottom:10px;width:2px;background:var(--cx-border)}
.cx-tl__item{display:flex;gap:16px;position:relative}
.cx-tl__marker{flex:0 0 40px;width:40px;height:40px;border-radius:50%;background:var(--cx-accent);color:var(--cx-accent-text);display:flex;align-items:center;justify-content:center;font-family:var(--cx-fd);font-weight:800;font-size:16px;position:relative;z-index:1}
.cx-tl__label{font-family:var(--cx-fd);font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--cx-muted);margin:0 0 4px;font-weight:700}
.cx-tl__title{font-size:19px;margin-bottom:6px}
.cx-tl__media{margin:0 0 12px}
.cx-tl__img,.cx-tl__side-img{border-radius:12px}
/* carousels */
.cx-carousel__head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:18px}
.cx-carousel__head .cx-h{margin-bottom:0}
.cx-carousel__nav{display:flex;gap:8px;flex:0 0 auto}
.cx-arrow{width:44px;height:44px;border-radius:50%;border:1.5px solid var(--cx-ink);background:#fff;color:var(--cx-ink);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;transition:background .15s}
.cx-arrow:hover{background:var(--cx-hl)}
.cx-arrow[disabled]{opacity:.35;cursor:default}
.cx-carousel__track{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;padding:4px 4px 12px;margin:0 -4px;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.cx-carousel__track::-webkit-scrollbar{display:none}
.cx-carousel__track>li{scroll-snap-align:start;flex:0 0 86%;max-width:360px}
.cx-tm,.cx-review{background:#fff;border:1px solid var(--cx-border);border-radius:14px;padding:20px}
.cx-tm__head{display:flex;gap:12px;align-items:center;margin-bottom:12px}
.cx-tm__img{width:56px;height:56px;border-radius:50%;object-fit:cover;flex:0 0 56px}
.cx-tm__img.cx-img-placeholder{min-height:0;padding:0;font-size:9px}
.cx-tm__name{font-weight:700;color:var(--cx-ink);margin:0;font-size:15px}
.cx-tm__age{font-weight:400;color:var(--cx-muted)}
.cx-tm__badge{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--cx-yes);margin:2px 0 0;font-weight:600}
.cx-tm__badge svg{color:var(--cx-yes)}
.cx-tm__headline{font-weight:700;color:var(--cx-ink);font-size:16px;line-height:1.35;margin:0 0 10px}
.cx-tm__bullets{display:grid;gap:6px;margin:0 0 12px}
.cx-tm__bullets li{display:flex;gap:8px;align-items:flex-start;font-size:14px;line-height:1.4}
.cx-tm__bullets svg{color:var(--cx-yes);flex:0 0 18px;margin-top:1px}
.cx-tm__quote{margin:0;font-size:14.5px;color:var(--cx-body);font-style:italic;border-left:3px solid var(--cx-accent);padding-left:12px}
.cx-review{background:#fff}
.cx-stars{display:inline-flex;gap:2px;color:#F5B301;margin-bottom:10px}
.cx-review__text{font-size:15.5px;line-height:1.5;color:var(--cx-ink);margin:0 0 10px}
.cx-review__name{font-size:14px;color:var(--cx-muted);font-weight:600;margin:0}
/* faq */
.cx-faq__list{border-top:1px solid var(--cx-border)}
.cx-faq__item{border-bottom:1px solid var(--cx-border)}
.cx-faq__q{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:18px 0;font-weight:700;color:var(--cx-ink);font-size:16.5px;line-height:1.35}
.cx-faq__q::-webkit-details-marker{display:none}
.cx-faq__chev{flex:0 0 auto;transition:transform .2s;color:var(--cx-ink)}
.cx-faq__item[open] .cx-faq__chev{transform:rotate(180deg)}
.cx-faq__a{padding:0 0 18px}
.cx-faq__a p{font-size:16px}
/* figure */
.cx-figure{margin:0}
.cx-figure__img{border-radius:14px;width:100%}
.cx-figure--full .cx-figure__img{border-radius:0}
.cx-figure figcaption{font-size:13px;color:var(--cx-muted);margin-top:8px;text-align:center}
/* placeholders */
.cx-img-placeholder{background:repeating-linear-gradient(135deg,#F1F0EC 0 12px,#E9E7E2 12px 24px);border:1px dashed #CFCDC6;border-radius:12px;display:flex;align-items:center;justify-content:center;min-height:120px;color:#7A7973;font-size:13px;font-weight:600;text-align:center;padding:16px;aspect-ratio:4/3;width:100%}
.cx-img-placeholder--round{border-radius:50%;aspect-ratio:1/1;min-height:0}
/* disclaimer */
.cx-disclaimer{padding:22px 0 30px;font-size:12.5px;color:var(--cx-muted);line-height:1.5;text-align:center;font-style:italic;background:#fff;${bleed ? "width:100vw;margin-left:calc(50% - 50vw);" : ""}}
/* sticky bar */
.cx-sticky{position:fixed;left:0;right:0;bottom:0;z-index:9990;background:#fff;box-shadow:0 -6px 24px rgba(0,0,0,.12);padding:10px 14px calc(10px + env(safe-area-inset-bottom));display:none;align-items:center;justify-content:space-between;gap:12px;transform:translateY(110%);transition:transform .25s ease}
.cx-sticky.is-visible{transform:translateY(0)}
.cx-sticky__txt{font-size:12.5px;line-height:1.3;color:var(--cx-ink);font-weight:600;display:flex;flex-direction:column;gap:2px;flex:1 1 auto;min-width:0}
.cx-sticky__txt .cx-stars svg{width:13px;height:13px}
.cx-sticky__txt .cx-stars{margin:0}
.cx-sticky .cx-btn{padding:12px 18px;font-size:12.5px;min-height:44px;flex:0 0 auto}
@media (max-width:768px){.cx-sticky.cx-sticky--armed{display:flex}}
/* desktop */
@media (min-width:640px){.cx-band{padding:56px 0}.cx-iconrow{grid-template-columns:repeat(4,1fr)}.cx-cards{grid-template-columns:repeat(2,1fr)}.cx-carousel__track>li{flex-basis:48%}}
@media (min-width:900px){
.cx-band{padding:72px 0}
.cx-h{font-size:36px}
.cx-h1{font-size:44px}
.cx-hero{grid-template-columns:1.05fr 1fr;gap:48px}
.cx-hero--img-left .cx-hero__copy{order:2}
.cx-purity--with-media,.cx-science--with-media,.cx-tl--with-media{grid-template-columns:1.2fr .8fr;gap:48px}
.cx-science--with-media{grid-template-columns:.8fr 1.2fr}
.cx-science--img-right .cx-science__media{order:2}
.cx-evidence__grid{grid-template-columns:1.1fr .9fr;gap:48px}
.cx-evidence__grid--no-media{grid-template-columns:1fr;max-width:var(--cx-max-n);margin:0 auto}
.cx-pillars__grid--4,.cx-pillars__grid--3,.cx-pillars__grid--2{grid-template-columns:repeat(2,1fr)}
.cx-expert{grid-template-columns:200px 1fr;gap:40px}
.cx-expert--center{grid-template-columns:1fr}
.cx-expert__img,.cx-expert__img.cx-img-placeholder{width:200px;height:200px}
.cx-cards{grid-template-columns:repeat(3,1fr);align-items:center;gap:20px;padding:44px 0 30px}
.cx-cards--1{grid-template-columns:minmax(0,420px);justify-content:center}
.cx-cards--2{grid-template-columns:repeat(2,minmax(0,420px));justify-content:center}
.cx-cards--4{grid-template-columns:repeat(4,1fr)}
.cx-card--highlight{transform:scale(1.045);z-index:1}
.cx-card__inner{padding:26px 22px 22px}
.cx-carousel__track>li{flex-basis:32%}
.cx-numeral{font-size:72px}
.cx-cmp__scroll{margin:0;padding:0}
}
@media (min-width:1100px){.cx-pillars__grid--4{grid-template-columns:repeat(4,1fr)}.cx-pillars__grid--3{grid-template-columns:repeat(3,1fr)}}
@media (max-width:899px){.cx-card--highlight{order:-1}}
@media (prefers-reduced-motion:reduce){#cx-page *{transition:none!important;scroll-behavior:auto!important}}
`.replace(/\n\s*/g, "");
}
