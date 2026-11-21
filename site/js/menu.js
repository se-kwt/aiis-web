// Header behaviour: hide/show on scroll, full-screen menu (open/close, focus trap, scroll lock, accordion),
// translate list toggle. Values: the reference measurements item 2. Written fresh for AIIS.
export const name = 'menu';
export const section = 'header';

const DESKTOP = '(min-width: 1000px)';
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function init() {
  const header = document.querySelector('[data-section="header"]');
  const menu = document.getElementById('site-menu');
  const toggle = document.querySelector('[data-menu-open]');
  const closeBtn = document.querySelector('[data-menu-close]');
  if (!header || !menu || !toggle || !closeBtn) throw new Error('header markup incomplete');

  initScrollBehaviour(header);
  initMenu(menu, toggle, closeBtn);
  initAccordion(menu);
  initTranslate();
  initDesktopNav();
}

// ---- hide on scroll down, return on any scroll up (all widths) -----------------------------------
function initScrollBehaviour(header) {
  const body = document.body;
  let last = window.scrollY, ticking = false;
  const update = () => {
    ticking = false;
    const y = Math.max(0, window.scrollY);
    const past = y > header.offsetHeight; // the reference: not hidden at 50px, hidden at 100px (bar is 98px)
    body.classList.toggle('sticky-header-active', past);
    if (!past) body.classList.remove('scrolled-up');
    else if (y < last) body.classList.add('scrolled-up');
    else if (y > last) body.classList.remove('scrolled-up');
    last = y;
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

// ---- full-screen menu ----------------------------------------------------------------------------
function initMenu(menu, toggle, closeBtn) {
  const body = document.body;
  let opener = toggle;

  const isOpen = () => menu.classList.contains('is-open');
  const focusables = () => [...menu.querySelectorAll(FOCUSABLE)].filter((el) =>
    el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');

  function open() {
    if (isOpen()) return;
    opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : toggle;
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;
    body.classList.add('menu-open');
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    closeBtn.focus({ preventScroll: true });
  }

  function close({ restoreFocus = true } = {}) {
    if (!isOpen()) return;
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    body.classList.remove('menu-open');
    body.style.paddingRight = '';
    if (restoreFocus) (opener && opener.isConnected ? opener : toggle).focus({ preventScroll: true });
  }

  toggle.addEventListener('click', open);
  closeBtn.addEventListener('click', () => close());
  // following a link inside the menu leaves the menu
  menu.addEventListener('click', (e) => { if (e.target instanceof Element && e.target.closest('a[href]')) close({ restoreFocus: false }); });

  document.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const items = focusables();
    if (!items.length) { e.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1];
    const active = document.activeElement;
    if (!menu.contains(active)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  });
  // focus that lands outside while open (e.g. by script or pointer) is pulled back in
  document.addEventListener('focusin', (e) => { if (isOpen() && !menu.contains(e.target)) closeBtn.focus({ preventScroll: true }); });

  // the full-screen menu is for < 1000px only
  const mq = window.matchMedia(DESKTOP);
  const onMq = () => { if (mq.matches) close({ restoreFocus: false }); };
  mq.addEventListener ? mq.addEventListener('change', onMq) : mq.addListener(onMq);
}

// ---- accordion (mobile menu): expander toggles the group's sub-list ------------------------------
function initAccordion(menu) {
  menu.querySelectorAll('.hdr-menu__expander').forEach((btn) => {
    btn.addEventListener('click', () => {
      const group = btn.closest('.hdr-menu__group');
      const expanded = group.classList.toggle('is-expanded');
      btn.setAttribute('aria-expanded', String(expanded));
    });
  });
  // nested submenu (Amenities > Sports): the button itself opens and closes its own list
  menu.querySelectorAll('.hdr-menu__nested-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const expanded = btn.closest('.hdr-menu__nested').classList.toggle('is-expanded');
      btn.setAttribute('aria-expanded', String(expanded));
    });
  });
}

// ---- translate list (desktop and mobile): click toggles, outside click / Esc closes --------------
function initTranslate() {
  const wrap = document.querySelector('.hdr__lang');
  const btn = document.querySelector('[data-translate-toggle]');
  if (!wrap || !btn) return;
  const set = (on) => { wrap.classList.toggle('is-open', on); btn.setAttribute('aria-expanded', String(on)); };
  btn.addEventListener('click', () => set(!wrap.classList.contains('is-open')));
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && wrap.classList.contains('is-open')) { set(false); btn.focus(); } });
}

// ---- desktop dropdown nav: aria-expanded follows hover / focus, Esc dismisses the open panel -------
function initDesktopNav() {
  const items = [...document.querySelectorAll('.hdr__item')].filter((i) => i.querySelector('.hdr__panel') && i.querySelector('.hdr__link'));
  for (const item of items) {
    const link = item.querySelector('.hdr__link');
    const sync = () => {
      const open = !item.classList.contains('is-dismissed') && (item.matches(':hover') || item.matches(':focus-within'));
      link.setAttribute('aria-expanded', String(open));
    };
    item.addEventListener('pointerenter', sync);
    item.addEventListener('pointerleave', () => { item.classList.remove('is-dismissed'); sync(); });
    item.addEventListener('focusin', sync);
    item.addEventListener('focusout', (e) => {
      if (!item.contains(e.relatedTarget)) item.classList.remove('is-dismissed');
      requestAnimationFrame(sync);
    });
    item.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || link.getAttribute('aria-expanded') !== 'true') return;
      e.preventDefault();
      item.classList.add('is-dismissed');
      if (item.contains(document.activeElement) && document.activeElement !== link) link.focus();
      sync();
    });
  }
}

