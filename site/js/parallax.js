// Scroll parallax for the promise rows (the reference measurements item 5). Desktop (>= 1000 px) only; off under reduced motion.
//  - [data-parallax="<n>"]      GSAP: yPercent +n -> -n, ScrollTrigger scrub, trigger = the element, default start/end
//                               ("top bottom" .. "bottom top", measured with the element at its progress-0 offset) and GSAP's default ease.
//  - [data-parallax-image="<s>"] inset photo (simple-parallax-js behaviour): image scaled s, translateY from +15% to -15% of the box
//                               height as the row crosses the viewport; 1 s cubic-bezier(0, 0, 0, 1) transition; updates only while visible.
export const name = 'parallax';
export const section = null; // page-wide

const QUERY = '(min-width: 1000px) and (prefers-reduced-motion: no-preference)';

export function init() {
  const gsap = window.gsap, ST = window.ScrollTrigger;
  const mq = window.matchMedia(QUERY);
  const figures = [...document.querySelectorAll('[data-parallax]')];
  const photos = [...document.querySelectorAll('[data-parallax-image]')];
  if (!figures.length && !photos.length) return;

  // ---- cut-out figures (GSAP ScrollTrigger) ----
  let gsapCtx = null;
  const buildFigures = () => {
    if (gsapCtx) { gsapCtx.revert(); gsapCtx = null; }
    if (!mq.matches || !gsap || !ST) return;
    gsap.registerPlugin(ST);
    gsapCtx = gsap.context(() => {
      for (const el of figures) {
        const amount = parseFloat(el.dataset.parallax) || 20;
        gsap.set(el, { yPercent: amount });
        gsap.to(el, { yPercent: -amount, scrollTrigger: { trigger: el, scrub: true } });
      }
    });
  };

  // ---- inset photos ----
  const state = new Map(); // img -> { box, wrap, scale }
  for (const img of photos) {
    const box = img.closest('[data-temp-photo]') || img.parentElement;
    const wrap = box.parentElement; // the row's photo column: its height is the parallax range (as simple-parallax's wrapper)
    state.set(img, { box, wrap, scale: parseFloat(img.dataset.parallaxImage) || 1.3 });
  }
  const setPhotos = () => {
    for (const [img, s] of state) {
      if (!mq.matches) { img.style.transform = ''; img.style.transition = ''; continue; }
      const r = s.wrap.getBoundingClientRect();
      const vh = window.innerHeight;
      if (r.bottom <= 0 || r.top >= vh) continue; // off screen: keep the last value
      const p = Math.min(Math.max((vh - r.top) / (r.height + vh), 0), 1);
      const range = s.box.getBoundingClientRect().height * (s.scale - 1) / 2; // 48 px for a 320 px box at 1.3
      img.style.transition = 'transform 1s cubic-bezier(0, 0, 0, 1)';
      img.style.transform = `matrix(${s.scale}, 0, 0, ${s.scale}, 0, ${Math.round(range - 2 * range * p)})`;
    }
  };
  let queued = false;
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; setPhotos(); }); } };
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);

  const apply = () => { buildFigures(); setPhotos(); if (ST) ST.refresh(); };
  mq.addEventListener('change', apply);
  // GSAP loads deferred from the CDN; the module runs after it, but wait for load so layout (images) is settled before measuring.
  apply();
  if (document.readyState !== 'complete') window.addEventListener('load', () => { if (ST) ST.refresh(); setPhotos(); }, { once: true });
}
