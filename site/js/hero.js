// Hero behaviour: badge pinned for the first 420 px of scroll on desktop (the reference: ScrollTrigger pin, end "+=420"),
// background video pause/play control.
export const name = 'hero';
export const section = 'hero';

const DESKTOP = '(min-width: 1000px)';
const PIN_PX = 420;

export function init() {
  const hero = document.querySelector('[data-section="hero"]');
  const pin = hero.querySelector('.hero__badge-pin');
  const video = hero.querySelector('video');
  const btn = hero.querySelector('[data-hero-toggle]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = window.matchMedia(DESKTOP);

  // Badge pin: translate by the scroll offset for the first 420 px, then let it scroll away normally.
  if (pin) {
    let ticking = false;
    const apply = () => {
      ticking = false;
      const y = desktop.matches && !reduced.matches ? Math.min(Math.max(window.scrollY, 0), PIN_PX) : 0;
      pin.style.setProperty('--pin', `${y}px`);
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(apply); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    desktop.addEventListener('change', apply);
    apply();
  }

  // Video: autoplay/muted/loop are in the markup; reduced motion starts it paused.
  if (video && btn) {
    const sync = () => {
      const paused = video.paused;
      btn.setAttribute('aria-pressed', String(paused));
      // the label stays constant; aria-pressed carries the state (pressed = paused)
    };
    if (reduced.matches) { video.removeAttribute('autoplay'); video.pause(); }
    btn.addEventListener('click', () => { if (video.paused) video.play().catch(() => {}); else video.pause(); });
    video.addEventListener('play', sync);
    video.addEventListener('pause', sync);
    // Not playing yet (e.g. autoplay pending): the control must not claim the video is paused before it settles.
    btn.setAttribute('aria-pressed', 'false');
    if (reduced.matches) sync();
  }
}
