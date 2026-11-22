// Values / closing band / footer scroll behaviour (the reference measurements items 9, 10 and the footer reveal).
// Desktop (>= 1000 px) with motion only (gsap.matchMedia, as the reference site does): the values panel is pinned with pinSpacing off from the moment
// its bottom meets the viewport bottom ("bottom bottom") for the closing band's height, so the closing band scrolls up over it like a curtain.
// The matchMedia context reverts everything (pin, spacer, classes) when the query stops matching, so a resize to a narrow window leaves nothing stuck.
// Also here: the values spiral scale-in (Waypoint at 80%), the closing line draw (70%) and the footer rules (50%). The big words themselves are
// revealed by animate-text.js; they do not change colour on scroll.
export const name = 'values';
export const section = 'values';

const QUERY = '(min-width: 1000px) and (prefers-reduced-motion: no-preference)';

export function init() {
  const gsap = window.gsap, ST = window.ScrollTrigger;
  if (!gsap || !ST) return; // static layout: everything shown
  gsap.registerPlugin(ST);
  const values = document.querySelector('[data-section="values"]');
  const closing = document.querySelector('[data-section="closing"]');
  const footer = document.querySelector('[data-section="footer"]');
  const spiral = values.querySelector('.values-spiral');
  const foot = closing?.querySelector('.closing__foot');

  const mm = gsap.matchMedia();
  mm.add(QUERY, () => {
    const marked = [values, closing, footer].filter(Boolean);
    marked.forEach((el) => el.setAttribute('data-fx', ''));
    if (closing) {
      ST.create({
        trigger: values, pin: true, pinSpacing: false, start: 'bottom bottom',
        end: () => '+=' + closing.offsetHeight, invalidateOnRefresh: true,
      });
    }
    if (spiral) {
      ST.create({
        trigger: spiral, start: 'top 80%',
        onEnter: () => values.classList.add('animate'),
        onLeaveBack: () => values.classList.remove('animate'),
      });
    }
    if (foot) ST.create({ trigger: foot, start: 'top 70%', once: true, onEnter: () => closing.classList.add('animate') });
    if (footer) ST.create({ trigger: footer, start: 'top 50%', once: true, onEnter: () => footer.classList.add('animate') });
    return () => {
      marked.forEach((el) => el.removeAttribute('data-fx'));
      [values, closing, footer].forEach((el) => el?.classList.remove('animate'));
    };
  });
}
