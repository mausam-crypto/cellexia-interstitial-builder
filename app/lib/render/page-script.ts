/**
 * Small vanilla JS shipped inline with every page (~3KB minified-ish).
 *  - carousels (arrow navigation, scroll-snap)
 *  - sticky mobile CTA bar (appears once the hero has scrolled off, hides over the offer)
 *  - UTM / click-id passthrough into the cart (attributes) for attribution
 *  - first-party analytics beacons (view, cta_click, card_click, add_to_cart)
 *  - smooth scroll for in-page CTAs
 *
 * `cfg` is injected by the renderer: { pageId, eventsUrl, mode, utm }
 */
export function pageScript(cfg: { pageId: string; eventsUrl: string; utm: boolean; stickyAfter: string | null; hasCards: boolean }): string {
  const json = JSON.stringify(cfg);
  return `(function(){var CFG=${json};var root=document.getElementById('cx-page');if(!root)return;
var sid=(function(){try{var k='cx_sid',v=sessionStorage.getItem(k);if(!v){v=Math.random().toString(36).slice(2)+Date.now().toString(36);sessionStorage.setItem(k,v)}return v}catch(e){return 'na'}})();
var UTM_KEYS=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid','ttclid','ref'];
var utm=(function(){var o={};try{var stored=JSON.parse(sessionStorage.getItem('cx_utm')||'{}');for(var k in stored)o[k]=stored[k]}catch(e){}try{var p=new URLSearchParams(location.search);UTM_KEYS.forEach(function(k){var v=p.get(k);if(v)o[k]=v.slice(0,120)});sessionStorage.setItem('cx_utm',JSON.stringify(o))}catch(e){}return o})();
var market=(root.getAttribute('data-cx-market')||''),locale=(root.getAttribute('data-cx-locale')||document.documentElement.lang||'');
var device=window.matchMedia&&window.matchMedia('(max-width: 768px)').matches?'mobile':'desktop';
function send(type,extra){try{var body=JSON.stringify(Object.assign({p:CFG.pageId,t:type,s:sid,m:market,l:locale,d:device,r:document.referrer.slice(0,200),utm:utm},extra||{}));if(navigator.sendBeacon){navigator.sendBeacon(CFG.eventsUrl,new Blob([body],{type:'text/plain'}))}else{fetch(CFG.eventsUrl,{method:'POST',body:body,keepalive:true,headers:{'Content-Type':'text/plain'}}).catch(function(){})}}catch(e){}}
send('view');
/* smooth scroll + CTA clicks */
root.addEventListener('click',function(ev){var a=ev.target.closest&&ev.target.closest('a[data-cx-event]');if(!a)return;var type=a.getAttribute('data-cx-event');var card=a.getAttribute('data-cx-card');var href=a.getAttribute('href')||'';
if(type==='add_to_cart'){send('card_click',{c:card!=null?Number(card):null});send('add_to_cart',{c:card!=null?Number(card):null});
if(CFG.utm&&Object.keys(utm).length){var attrs={};for(var k in utm){attrs[k.indexOf('utm_')===0?k:'cx_'+k]=utm[k]}
if(a.getAttribute('data-cx-mode')!=='checkout'){ev.preventDefault();var done=false;var go=function(){if(done)return;done=true;location.href=href};try{fetch('/cart/update.js',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({attributes:attrs})}).then(go,go);setTimeout(go,900)}catch(e){go()}return}
else{try{var u=new URL(href,location.href);for(var k2 in attrs){u.searchParams.set('attributes['+k2+']',attrs[k2])}a.setAttribute('href',u.pathname+u.search)}catch(e){}}}
return}
send(type,{c:card!=null?Number(card):null,sec:a.getAttribute('data-cx-section')||null});
if(href.charAt(0)==='#'){var t=document.querySelector(href);if(t){ev.preventDefault();t.scrollIntoView({behavior:'smooth',block:'start'});try{history.replaceState(null,'',href)}catch(e){}}}
});
/* carousels */
Array.prototype.forEach.call(root.querySelectorAll('[data-cx-carousel]'),function(c){var track=c.querySelector('.cx-carousel__track'),prev=c.querySelector('[data-cx-prev]'),next=c.querySelector('[data-cx-next]');if(!track)return;function step(){var li=track.querySelector('li');return li?li.getBoundingClientRect().width+16:300}function upd(){if(prev)prev.disabled=track.scrollLeft<=2;if(next)next.disabled=track.scrollLeft+track.clientWidth>=track.scrollWidth-2}if(prev)prev.addEventListener('click',function(){track.scrollBy({left:-step(),behavior:'smooth'})});if(next)next.addEventListener('click',function(){track.scrollBy({left:step(),behavior:'smooth'})});track.addEventListener('scroll',upd,{passive:true});window.addEventListener('resize',upd);upd()});
/* sticky bar */
var bar=document.getElementById('cx-sticky');if(bar){bar.classList.add('cx-sticky--armed');var trigger=CFG.stickyAfter?document.getElementById(CFG.stickyAfter):null;var offer=document.getElementById('cx-offer');var pastTrigger=!trigger,overOffer=false;function apply(){bar.classList.toggle('is-visible',pastTrigger&&!overOffer)}
if('IntersectionObserver' in window){if(trigger){new IntersectionObserver(function(es){es.forEach(function(e){pastTrigger=!e.isIntersecting&&e.boundingClientRect.bottom<0;apply()})},{threshold:0}).observe(trigger)}if(offer){new IntersectionObserver(function(es){es.forEach(function(e){overOffer=e.isIntersecting;apply()})},{threshold:0.05}).observe(offer)}}else{pastTrigger=true}apply()}
})();`;
}
