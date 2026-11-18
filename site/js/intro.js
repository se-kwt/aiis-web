// Crest intro (the reference measurements item 1). The decision (full / replay / none) is made by the inline
// script in <head> and stored in <html data-intro>; this module runs the timeline and releases the hero entrance.
// Timeline, ms after the window load event: 0 seal, 800 rings, 3000 circle, 4300 fade + reveal, 4500 video + badge,
// 5000 loader out + title + line art, 6000 header in. Repeat visit: hero entrance only (0 title+video, 500 badge, 1000 art+header).
export const name = 'intro';
export const section = 'intro';

const DONE_AFTER_FULL = 6500;   // 6000 header + 500 slide
const DONE_AFTER_REPLAY = 1500; // 1000 art/header + 500

// Test-only hold: when the test harness sets window.__aiisTestHold before load (Playwright addInitScript; a URL cannot set it),
// the full intro stops after the rings start and the intro element gets `is-held`, so tests measure the seal/rings state
// without racing the wall-clock timeline. Without the flag nothing changes.
const HOLD = window.__aiisTestHold === true;

export function init() {
  const html = document.documentElement;
  const intro = document.querySelector('[data-section="intro"]');
  const hero = document.querySelector('[data-section="hero"]');
  const mode = html.getAttribute('data-intro') || 'none';
  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));

  // While the full intro covers the page, nothing behind it may take focus (the overlay is aria-hidden and not interactive).
  const behind = () => document.querySelectorAll('.skip-link, header.hdr, #site-menu, main, footer');
  const setInert = (on) => behind().forEach((el) => { el.inert = on; });

  const finish = () => {
    timers.forEach(clearTimeout);
    setInert(false);
    html.classList.remove('intro-playing', 'intro-active', 'hero-pre');
    hero?.classList.add('is-title', 'is-frame', 'is-badge', 'is-art');
    html.classList.add('intro-done');
  };

  if (mode === 'none') { finish(); return; }

  try { sessionStorage.setItem('aiis-intro-seen', '1'); } catch { /* storage unavailable: play every time */ }
  if (mode === 'full') setInert(true);

  const heroStep = {
    title: () => hero?.classList.add('is-title'),
    frame: () => hero?.classList.add('is-frame'),
    badge: () => hero?.classList.add('is-badge'),
    art: () => hero?.classList.add('is-art'),
  };

  const start = () => {
    if (mode === 'replay') {
      heroStep.title(); heroStep.frame();
      at(500, heroStep.badge);
      at(1000, () => { heroStep.art(); html.classList.remove('intro-active'); }); // header slides back in (.5 s, css)
      at(DONE_AFTER_REPLAY, finish);
      return;
    }
    const step = (cls) => intro.classList.add(cls);
    step('is-seal');
    at(800, () => step('is-rings'));
    if (HOLD) { at(1900, () => intro.classList.add('is-held')); return; } // test-only freeze: seal in, rings running, nothing further scheduled
    at(3000, () => step('is-circle'));
    at(4300, () => step('is-fade'));
    at(4500, () => { heroStep.frame(); heroStep.badge(); });
    at(5000, () => { heroStep.title(); heroStep.art(); intro.classList.add('is-gone'); });
    at(5600, () => html.classList.remove('intro-playing'));
    at(6000, () => html.classList.remove('intro-active')); // header slide-in, .5 s
    at(DONE_AFTER_FULL, finish);
  };

  // t = 0 is the load event; do not wait forever if a slow third-party asset holds it up.
  if (document.readyState === 'complete') start();
  else {
    let started = false;
    const go = () => { if (!started) { started = true; start(); } };
    window.addEventListener('load', go, { once: true });
    at(3000, go);
  }
}
