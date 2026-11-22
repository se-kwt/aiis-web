// Shared full-video modal: native <dialog>, opened from the hero badge and (later) the teacher carousel.
// Public API: openVideoModal({ src, title, trigger }), closeVideoModal(), window.AIIS.openVideoModal.
// Any element with data-video-modal and data-video-src (optional data-video-title) opens it on click.
export const name = 'video-modal';
export const section = null;

let dialog = null, stage = null, video = null, playBtn = null, closeBtn = null, titleEl = null, lastTrigger = null, uid = 0;

function build() {
  const id = `video-modal-title-${++uid}`;
  dialog = document.createElement('dialog');
  dialog.className = 'video-modal';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', id);
  dialog.innerHTML = `
    <div class="video-modal__inner">
      <h2 class="video-modal__title" id="${id}"></h2>
      <button class="video-modal__close" type="button" aria-label="Close video"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 15L15 1M1 1l14 14" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg></button>
      <div class="video-modal__stage">
        <video playsinline preload="metadata"></video>
        <button class="video-modal__play" type="button">Play Full Video</button>
      </div>
    </div>`;
  document.body.append(dialog);
  stage = dialog.querySelector('.video-modal__stage');
  video = dialog.querySelector('video');
  playBtn = dialog.querySelector('.video-modal__play');
  closeBtn = dialog.querySelector('.video-modal__close');
  titleEl = dialog.querySelector('.video-modal__title');
  closeBtn.addEventListener('click', () => closeVideoModal());
  playBtn.addEventListener('click', () => {
    video.controls = true;
    video.play().catch(() => {});
    playBtn.classList.add('is-hidden'); // fades out over 600 ms as on the reference
    video.focus({ preventScroll: true });
  });
  // Esc: the native cancel event; route it through our close so focus is restored.
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); closeVideoModal(); });
  // Backdrop: clicks on the dialog itself or its padding area, not on the stage/close button.
  dialog.addEventListener('click', (e) => { if (e.target === dialog || e.target.classList.contains('video-modal__inner')) closeVideoModal(); });
}

export function openVideoModal({ src, title = '', trigger } = {}) {
  if (!src) return;
  if (!dialog) build();
  lastTrigger = trigger || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  titleEl.textContent = title || 'Video';
  if (video.getAttribute('src') !== src) video.src = src;
  // Media from another origin is temporary stand-in media: the stage carries the same "Temp photo" tag as the page's photos.
  const temp = new URL(src, location.href).origin !== location.origin;
  stage.classList.toggle('tp', temp);
  if (temp) stage.setAttribute('data-temp-photo', ''); else stage.removeAttribute('data-temp-photo');
  video.controls = false;
  video.currentTime = 0;
  playBtn.classList.remove('is-hidden');
  document.documentElement.classList.add('video-modal-open'); // overflow hidden: scroll position is kept
  if (!dialog.open) dialog.showModal();
  playBtn.focus({ preventScroll: true });
}

export function closeVideoModal() {
  if (!dialog || !dialog.open) return;
  video.pause();
  dialog.close();
  document.documentElement.classList.remove('video-modal-open');
  const t = lastTrigger;
  lastTrigger = null;
  if (t && t.isConnected) t.focus({ preventScroll: true });
}

export function init() {
  window.AIIS = Object.assign(window.AIIS || {}, { openVideoModal, closeVideoModal });
  document.addEventListener('click', (e) => {
    const t = e.target instanceof Element ? e.target.closest('[data-video-modal]') : null;
    if (!t || e.defaultPrevented) return;
    e.preventDefault();
    openVideoModal({ src: t.getAttribute('data-video-src') || t.getAttribute('href'), title: t.getAttribute('data-video-title') || '', trigger: t });
  });
}
