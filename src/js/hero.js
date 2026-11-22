// Hero behaviour: splits the title into letters for the CSS spell-in reveal, background video pause/play control,
// and (desktop, motion allowed) the video reel growing from its resting frame to fill the screen as the visitor
// scrolls past it, via a GSAP ScrollTrigger scrub of the mask's clip-path (css/hero.css carries the resting shape
// and the entrance states; this just supplies the scroll-driven grow and the letter split).
export const name = 'hero';
export const section = 'hero';

const GROW_QUERY = '(min-width: 1000px) and (prefers-reduced-motion: no-preference)';

function splitLetters(heading) {
  let i = 0;
  for (const word of heading.querySelectorAll('.word')) {
    const text = word.textContent;
    word.textContent = '';
    for (const ch of text) {
      const span = document.createElement('span');
      span.className = 'letter';
      span.style.setProperty('--i', i++);
      span.textContent = ch;
      word.append(span);
    }
  }
}

// Reads the resting clip-path's inset(...) and expands it to explicit top/right/bottom/left numbers, following
// CSS's own shorthand rule (1-4 values -> TRBL), e.g. "inset(90px 60px round 24px)" -> {top:90,right:60,bottom:90,left:60}.
// Needed because GSAP's generic string tween would otherwise interpolate this string's numeric tokens by position
// against the "fully open" value -- and the resting value serializes in CSS's collapsed 2-value shorthand while the
// open value is written with 4 explicit numbers, so the token counts don't match and the sides grow unevenly
// (left reaching 0 well before right). Tweening these numbers ourselves keeps every side locked in sync.
function parseInset(clipPath) {
  const m = /^inset\(([^)]*)\)$/.exec(clipPath);
  if (!m) return null;
  const [insetPart, roundPart] = m[1].split('round').map((s) => s.trim());
  const [a, b, c, d] = insetPart.split(/\s+/).map(parseFloat);
  const top = a, right = b ?? a, bottom = c ?? a, left = d ?? right;
  const radius = roundPart ? parseFloat(roundPart) : 0;
  return { top, right, bottom, left, radius };
}

function initReelGrow(hero) {
  const gsap = window.gsap, ST = window.ScrollTrigger;
  const track = hero.querySelector('.hero__reel-track');
  const mask = hero.querySelector('.hero__reel-mask');
  if (!track || !mask) return;

  // --video-top: the video's measured resting top edge (track's offset from hero + the mask's own top inset, if
  // any), relative to .hero -- read by css/hero.css to anchor the badge on that edge at every width. Below
  // 1000px the mask carries no clip-path (it just fills the track at its own margin), so the inset is 0 there;
  // parseInset returns null for "none" and any other non-inset value, which this reads as that zero case.
  // Kept separate from the grow tween below: it's a static layout measurement, not an animation, so it must still
  // run for reduced-motion visitors even though the scroll-scrub grow itself is skipped for them.
  const positionBadge = () => {
    const rest = parseInset(getComputedStyle(mask).clipPath);
    hero.style.setProperty('--video-top', `${track.offsetTop + (rest ? rest.top : 0)}px`);
  };

  // index.html loads the display font async (media="print" trick); it swaps in well after this first measurement,
  // growing the title and shifting everything below it (including the video) down a little. Re-measuring once
  // document.fonts settles catches that shift -- without it, --video-top (and the desktop grow's resting state)
  // stay pinned to the pre-font-swap layout.
  const onFontsSettled = (cb) => { if (document.fonts && document.fonts.ready) document.fonts.ready.then(cb); };

  if (!gsap || !ST) {
    positionBadge();
    window.addEventListener('resize', positionBadge);
    onFontsSettled(positionBadge);
    return;
  }
  gsap.registerPlugin(ST);
  const growMQ = window.matchMedia(GROW_QUERY);
  let ctx = null;
  const build = () => {
    if (ctx) { ctx.revert(); ctx = null; }
    positionBadge();
    // mask.style.clipPath is set directly inside onUpdate below, on a plain object GSAP is tweening -- not on
    // mask itself -- so ctx.revert() never sees it as something to undo. Left alone, a resize out of the grow
    // (e.g. narrowing past 1000px mid-scroll) leaves that inline value stuck over the CSS rule for the new width,
    // visibly corrupting the resting frame's margins until a full reload starts the inline style fresh.
    mask.style.clipPath = '';
    if (!growMQ.matches) return;
    const rest = parseInset(getComputedStyle(mask).clipPath);
    if (!rest) return;
    ctx = gsap.context(() => {
      const state = { ...rest };
      gsap.to(state, {
        top: 0, right: 0, bottom: 0, left: 0, radius: 0, ease: 'none',
        onUpdate: () => {
          mask.style.clipPath = `inset(${state.top}px ${state.right}px ${state.bottom}px ${state.left}px round ${state.radius}px)`;
        },
        scrollTrigger: { trigger: track, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
      });
    });
  };
  build();
  window.addEventListener('resize', positionBadge);
  growMQ.addEventListener('change', build);
  if (document.readyState !== 'complete') window.addEventListener('load', () => { ST.refresh(); positionBadge(); }, { once: true });
  onFontsSettled(() => { ST.refresh(); positionBadge(); });
}

export function init() {
  const hero = document.querySelector('[data-section="hero"]');
  const title = hero.querySelector('.hero__title');
  const video = hero.querySelector('video');
  const btn = hero.querySelector('[data-hero-toggle]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (title) splitLetters(title);
  initReelGrow(hero);

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
