// Learning section: the panel video plays while the section is on screen (ScrollTrigger start "top 80%": enter / enter-back play,
// leave / leave-back pause — the reference measurements item 7) and has a pause/play control. Reduced motion: the video stays paused on its poster.
export const name = 'learning';
export const section = 'learning';

export function init() {
  const frame = document.querySelector('[data-k="learning-video-frame"]');
  const video = frame?.querySelector('video');
  const btn = frame?.querySelector('[data-learning-toggle]');
  if (!video) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let userPaused = reduced;
  const play = () => { if (!userPaused) video.play().catch(() => {}); };
  const pause = () => video.pause();

  const sync = () => {
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(video.paused));
    // the label stays constant; aria-pressed carries the state (pressed = paused)
  };
  video.addEventListener('play', sync);
  video.addEventListener('pause', sync);
  btn?.addEventListener('click', () => {
    if (video.paused) { userPaused = false; video.play().catch(() => {}); } else { userPaused = true; video.pause(); }
  });

  const ST = window.ScrollTrigger;
  if (ST && !reduced) {
    window.gsap.registerPlugin(ST);
    ST.create({ trigger: frame, start: 'top 80%', onEnter: play, onEnterBack: play, onLeave: pause, onLeaveBack: pause });
  }
  sync();
}
