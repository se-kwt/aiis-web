// Keeps "Temp photo" figures intact when the hotlinked image fails to load.
export const name = 'temp-photo';
export const section = null; // page-wide; readiness flag goes on <body data-ready-temp-photo>

const mark = (img) => img.closest('[data-temp-photo]')?.classList.add('tp--broken');

export function init() {
  // `error` does not bubble, but it can be captured; this also covers figures added later.
  document.addEventListener('error', (e) => { if (e.target instanceof HTMLImageElement) mark(e.target); }, true);
  // Images that already failed before this module ran.
  document.querySelectorAll('[data-temp-photo] img').forEach((img) => {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) mark(img);
  });
}
