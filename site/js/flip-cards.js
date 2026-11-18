// Division flip cards (the reference measurements item 6): click / Enter / Space flips a card (CSS does the 3D turn);
// opening one closes the others and dims them (cols-active). The hidden face is inert so assistive tech and Tab only reach the visible one.
export const name = 'flip-cards';
export const section = 'divisions';

export function init() {
  const grid = document.querySelector('.divisions__grid');
  const cards = [...document.querySelectorAll('[data-flip]')];
  if (!grid || !cards.length) return;

  const faces = (card) => ({
    front: card.querySelector('.flipcard__front'),
    back: card.querySelector('.flipcard__back'),
    toggles: [...card.querySelectorAll('[data-flip-toggle]')],
  });

  function set(card, open, { focus = false } = {}) {
    const { front, back, toggles } = faces(card);
    card.classList.toggle('active', open);
    toggles.forEach((b) => b.setAttribute('aria-expanded', String(open)));
    front.inert = open;
    back.inert = !open;
    if (focus) toggles.find((b) => !b.closest('[inert]'))?.focus();
  }

  function toggle(card) {
    const open = !card.classList.contains('active');
    if (open) cards.forEach((c) => c !== card && c.classList.contains('active') && set(c, false));
    set(card, open, { focus: true });
    grid.classList.toggle('cols-active', cards.some((c) => c.classList.contains('active')));
  }

  for (const card of cards) {
    card.addEventListener('click', (e) => { if (e.target.closest('[data-flip-toggle]')) toggle(card); });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && card.classList.contains('active')) toggle(card);
    });
    set(card, false);
  }
}
