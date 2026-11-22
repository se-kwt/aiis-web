// Teachers carousel (the reference measurements item 8, written fresh; the reference uses Slick).
// Infinite, centred, one card per step: the track holds the 7 real cards plus CLONES copies of the ends on both sides, slides on a CSS
// transform transition (500 ms ease) and, once a move that landed on a clone has finished, jumps back to the real card without a
// transition. Touch / mouse drag follows the pointer and commits past a fifth of a card pitch (Slick's touchThreshold 5).
// Like Slick (waitForAnimate) input is ignored while a move is running. Reduced motion: no transition, moves are instant.
// Root [data-carousel] carries data-state ("idle" | "moving" | "dragging") and data-index (current card, 0-based) so tests and
// scripts can wait on state rather than on time.
import { openVideoModal } from './video-modal.js';

export const name = 'carousel';
export const section = 'teachers';

const CLONES = 4;
const DURATION = 500;
const mod = (n, m) => ((n % m) + m) % m;

export function init() {
  const root = document.querySelector('[data-carousel]');
  const slider = root?.querySelector('.teachers__slider');
  const track = root?.querySelector('[data-track]');
  if (!root || !slider || !track) return;
  const prevBtn = root.querySelector('[data-prev]'), nextBtn = root.querySelector('[data-next]');
  const cur = root.querySelector('[data-k="teachers-paging-current"]');
  const reals = [...track.children];
  const total = reals.length;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');

  // clones: same markup minus the measurement keys, out of the reading and tab order, still clickable (they centre their real card)
  const clone = (el) => {
    const c = el.cloneNode(true);
    c.dataset.clone = '';
    c.setAttribute('aria-hidden', 'true');
    c.removeAttribute('role');
    c.removeAttribute('aria-roledescription');
    c.removeAttribute('aria-label');
    for (const e of [c, ...c.querySelectorAll('[data-k]')]) e.removeAttribute('data-k');
    for (const b of c.querySelectorAll('button')) b.tabIndex = -1;
    return c;
  };
  const before = [], after = [];
  for (let i = 0; i < CLONES; i++) {
    before.push(clone(reals[mod(i - CLONES, total)]));
    after.push(clone(reals[mod(i, total)]));
  }
  track.prepend(...before);
  track.append(...after);
  const all = [...track.children];

  let pos = 0;        // logical position, -CLONES .. total + CLONES - 1; a real card index when idle
  let moving = false, timer = 0, geom = { w: 0, pitch: 0, view: 0 };

  const measure = () => {
    const a = all[0].offsetLeft, b = all[1].offsetLeft;
    geom = { w: all[0].offsetWidth, pitch: b - a, view: slider.clientWidth };
  };
  const xFor = (p) => (geom.view - geom.w) / 2 - (p + CLONES) * geom.pitch;
  const place = (p, extra = 0) => { track.style.transform = `translate3d(${xFor(p) + extra}px,0,0)`; };
  const setState = (s) => { root.dataset.state = s; };
  const noTransition = (fn) => {
    track.style.transition = 'none';
    fn();
    void track.offsetWidth; // flush so the next change animates again
    track.style.transition = '';
  };

  // Which real cards can be seen (and so reached by keyboard / read out) at the current position.
  const sync = () => {
    const idx = mod(pos, total);
    root.dataset.index = String(idx);
    cur.textContent = String(idx + 1).padStart(2, '0');
    reals.forEach((s, i) => {
      s.classList.toggle('is-current', i === idx);
      const d = i - idx; // offset of the real card from the centre
      const x = (geom.view - geom.w) / 2 + d * geom.pitch;
      const visible = x < geom.view && x + geom.w > 0;
      s.setAttribute('aria-hidden', String(!visible));
      for (const b of s.querySelectorAll('button')) b.tabIndex = visible ? 0 : -1;
    });
  };

  const finish = () => {
    clearTimeout(timer);
    if (!moving) return;
    moving = false;
    const real = mod(pos, total);
    if (real !== pos) noTransition(() => { pos = real; place(pos); });
    sync();
    setState('idle');
  };

  const goTo = (target) => {
    if (moving || target === pos) return;
    pos = target;
    if (mq.matches) { moving = true; noTransition(() => place(pos)); finish(); return; }
    moving = true;
    setState('moving');
    place(pos);
    sync();
    timer = setTimeout(finish, DURATION + 1000); // transitionend is the normal path; this only guards against it never firing
  };
  const step = (n) => goTo(pos + n);
  // jump to the real card i by the shortest way round
  const centre = (i) => { const d = mod(i - mod(pos, total) + Math.floor(total / 2), total) - Math.floor(total / 2); if (d) goTo(pos + d); };

  track.addEventListener('transitionend', (e) => { if (e.target === track && e.propertyName === 'transform') finish(); });
  prevBtn?.addEventListener('click', () => step(-1));
  nextBtn?.addEventListener('click', () => step(1));
  root.addEventListener('keydown', (e) => {
    if (!slider.contains(e.target) || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    step(e.key === 'ArrowLeft' ? -1 : 1);
  });

  // Play Full Video: the current card opens the shared modal; any other card (or a clone) is brought to the centre first.
  track.addEventListener('click', (e) => {
    const btn = e.target.closest('.teachers__play');
    if (!btn || suppressClick) return;
    const slide = btn.closest('[data-slide-index]');
    const idx = Number(slide.dataset.slideIndex);
    if (!slide.classList.contains('is-current') || 'clone' in slide.dataset) { centre(idx); return; }
    openVideoModal({ src: btn.dataset.videoSrc, title: btn.dataset.videoTitle, trigger: btn });
  });
  // keyboard focus moving onto a visible side card centres it (a pointer click is handled by the click listener above)
  track.addEventListener('focusin', (e) => {
    const slide = e.target.closest('[data-slide-index]');
    if (slide && e.target.matches(':focus-visible') && !('clone' in slide.dataset) && !slide.classList.contains('is-current') && !moving) centre(Number(slide.dataset.slideIndex));
  });

  // drag / swipe
  let drag = null, suppressClick = false;
  slider.addEventListener('pointerdown', (e) => {
    if (moving || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { id: e.pointerId, x0: e.clientX, dx: 0, active: false };
  });
  slider.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dx = e.clientX - drag.x0;
    if (!drag.active) {
      if (Math.abs(drag.dx) < 6) return;
      drag.active = true;
      slider.setPointerCapture(e.pointerId);
      track.classList.add('is-dragging');
      slider.classList.add('is-dragging');
      setState('dragging');
    }
    place(pos, drag.dx);
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { active, dx } = drag;
    drag = null;
    if (!active) return;
    track.classList.remove('is-dragging');
    slider.classList.remove('is-dragging');
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    const n = Math.abs(dx) > geom.pitch / 5 ? (dx < 0 ? 1 : -1) : 0;
    if (n) { setState('idle'); goTo(pos + n); return; }
    // snap back (animated unless reduced motion)
    if (mq.matches) { noTransition(() => place(pos)); setState('idle'); return; }
    setState('moving');
    moving = true;
    place(pos);
    timer = setTimeout(finish, DURATION + 1000);
  };
  slider.addEventListener('pointerup', release);
  slider.addEventListener('pointercancel', release);
  // a dragged-over click must not fire the play button
  slider.addEventListener('click', (e) => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); } }, true);

  const relayout = () => { measure(); noTransition(() => place(pos)); sync(); };
  new ResizeObserver(() => { if (!moving && !drag) relayout(); }).observe(slider);

  measure();
  noTransition(() => place(pos));
  sync();
  setState('idle');

  // Heading icon drops in from above (opacity 0, translateY(-100%), 1 s) when the statement enters, desktop only.
  const icon = document.querySelector('[data-k="teachers-heading-icon"]');
  const gsap = window.gsap, ST = window.ScrollTrigger;
  if (icon && gsap && ST && window.matchMedia('(min-width: 1000px) and (prefers-reduced-motion: no-preference)').matches) {
    gsap.registerPlugin(ST);
    gsap.set(icon, { opacity: 0, yPercent: -100 });
    ST.create({ trigger: icon.closest('h2'), start: 'top 70%', once: true, onEnter: () => gsap.to(icon, { opacity: 1, yPercent: 0, duration: 1, ease: 'power1.out' }) });
  }
}
