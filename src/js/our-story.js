// Our Story page: Quick Facts strip. The track is a native horizontally-scrolling, scroll-snapped list (swipeable for free on
// touch); the prev/next buttons just scroll it by one viewport's width, clamped by the browser at either end.
export const name = 'our-story';
export const section = 'our-story';

export function init() {
  const track = document.querySelector('[data-facts-track]');
  const prev = document.querySelector('[data-facts-prev]');
  const next = document.querySelector('[data-facts-next]');
  if (!track || !prev || !next) return;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const go = (dir) => track.scrollBy({ left: dir * track.clientWidth, behavior: mq.matches ? 'auto' : 'smooth' });
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
}
