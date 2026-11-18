// Statement word reveal + highlight marker wipe (the reference measurements quick reference and item 5).
// Desktop (>= 1000 px) only, and never under reduced motion: otherwise the text is simply shown with its marker filled.
// Each word drops in from opacity 0, y -80 px (1 s, circ.out, stagger 0.2 s, origin 0% 100%) when the heading's top reaches 70% of the
// viewport (once); a highlighted word's marker wipes in 0.5 s after that word's own tween has ended.
export const name = 'animate-text';
export const section = null; // page-wide

const QUERY = '(min-width: 1000px) and (prefers-reduced-motion: no-preference)';

function splitWords(h) {
  const words = [];
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const part of child.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.append(part); continue; }
          const w = document.createElement('span');
          w.className = 'word';
          w.textContent = part;
          frag.append(w);
          words.push(w);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === 1) {
        if (child.classList.contains('word')) words.push(child); // pre-split in the markup (carries its own data-k)
        else walk(child);
      }
    }
  };
  walk(h);
  return words;
}

export function init() {
  const gsap = window.gsap, ST = window.ScrollTrigger;
  const mq = window.matchMedia(QUERY);
  const heads = [...document.querySelectorAll('.animate-text')];
  if (!heads.length || !gsap || !ST || !mq.matches) return; // static: words visible, marker filled
  gsap.registerPlugin(ST);
  for (const h of heads) {
    const words = splitWords(h);
    h.classList.add('at-ready');
    gsap.set(words, { opacity: 0, y: -80 });
    ST.create({
      trigger: h, start: 'top 70%', once: true,
      onEnter: () => {
        gsap.to(words, { opacity: 1, y: 0, duration: 1, ease: 'circ.out', stagger: 0.2 });
        words.forEach((w, i) => {
          const hl = w.closest('.hl');
          if (hl) gsap.delayedCall(1 + i * 0.2, () => hl.classList.add('is-marked'));
        });
      },
    });
  }
}
