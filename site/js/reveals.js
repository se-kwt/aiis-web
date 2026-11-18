// Generic scroll reveals (the reference measurements items 7 and 11): AOS "fade-up" — from opacity 0 / translateY(100px) to rest,
// 1000 ms, easing ease, per-element delay (data-reveal-delay, default 50 ms), offset 200 px (reveals once the element's top is 200 px above
// the viewport bottom), once. Desktop (>= 1000 px), pointer-hover devices and no reduced motion only; otherwise elements simply stay shown.
// Progressive enhancement: elements are visible in the markup and only hidden after this script marks them data-reveal-pending.
export const name = 'reveals';
export const section = null; // page-wide

const QUERY = '(min-width: 1000px) and (hover: hover) and (prefers-reduced-motion: no-preference)';
const OFFSET = 200;
const DISTANCE = 100; // px the pending state is shifted down; undone when measuring the element's own position

export function init() {
  const els = [...document.querySelectorAll('[data-reveal]')];
  if (!els.length) return;
  const mq = window.matchMedia(QUERY);
  for (const el of els) {
    const d = el.dataset.revealDelay;
    el.style.setProperty('--reveal-delay', `${d === undefined ? 50 : Number(d)}ms`);
  }

  let ticking = false;
  const check = () => {
    ticking = false;
    for (const el of els) {
      if (!el.hasAttribute('data-reveal-pending')) continue;
      if (el.getBoundingClientRect().top - DISTANCE <= window.innerHeight - OFFSET) {
        el.removeAttribute('data-reveal-pending');
        el.setAttribute('data-revealed', '');
      }
    }
    if (els.every((e) => !e.hasAttribute('data-reveal-pending'))) off();
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(check); } };
  const on = () => { window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll); };
  const off = () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };

  const setup = () => {
    off();
    if (!mq.matches) { // static: everything shown
      for (const el of els) el.removeAttribute('data-reveal-pending');
      return;
    }
    for (const el of els) {
      if (el.hasAttribute('data-revealed')) continue;
      el.style.transition = 'none'; // no fade-out flash when hiding
      el.setAttribute('data-reveal-pending', '');
    }
    void document.body.offsetWidth;
    for (const el of els) el.style.transition = '';
    on();
    check();
  };
  mq.addEventListener('change', setup);
  setup();
}
