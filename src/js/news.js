// News / Social strip: underline grows once the strip reaches half the viewport; the strip buttons open a full-screen
// panel (slides up .5 s, focus moves in, trapped, Esc / close button return focus to the opener). See the reference measurements item 4.
export const name = 'news';
export const section = 'news';

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function init() {
  const root = document.querySelector('[data-section="news"]');
  const panel = root.querySelector('.news-panel');
  const closeBtn = panel.querySelector('[data-news-close]');
  let opener = null;

  // underline (Waypoint at 50%)
  const check = () => { if (root.getBoundingClientRect().top <= window.innerHeight * 0.5) { root.classList.add('is-in'); window.removeEventListener('scroll', check); } };
  window.addEventListener('scroll', check, { passive: true });
  check();

  const open = (from) => {
    opener = from;
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    setTimeout(() => closeBtn.focus({ preventScroll: true }), 500);
  };
  const close = () => {
    if (!panel.classList.contains('is-open')) return;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    const t = opener && opener.isConnected && !opener.closest('[aria-hidden="true"]') ? opener : root.querySelector('[data-news-trigger]:not([tabindex="-1"])');
    t?.focus({ preventScroll: true });
    opener = null;
  };

  // Keyboard focus: the strip is paused while focus is inside (news.css), and restarted from its first position so the
  // focused trigger is on screen instead of wherever the marquee had drifted it.
  const list = root.querySelector('.news__list');
  root.addEventListener('focusin', (e) => {
    if (!list || !(e.target instanceof Element) || !e.target.matches('[data-news-trigger]') || !e.target.matches(':focus-visible')) return;
    list.style.animation = 'none';
    void list.offsetWidth;
    list.style.animation = '';
  });

  root.querySelectorAll('[data-news-trigger]').forEach((b) => b.addEventListener('click', () => open(b)));
  closeBtn.addEventListener('click', close);
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (!panel.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // tabs
  const tabs = [...panel.querySelectorAll('[role="tab"]')];
  const select = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t, false));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { e.preventDefault(); select(tabs[(i + d + tabs.length) % tabs.length], true); }
    });
  });
}
