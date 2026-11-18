import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { openPage, measureAiis, measureAiisIntro, compareKey, loadRef, startServer, stopServer } from './helpers.mjs';
import { loadMap } from '../tools/measure.mjs';

// Inventory item 1 (docs/reference/ssa-animations.md): the intro runs ~6.6 s after the load event.
const INTRO_MS = 6600;

const browsers = [];
const open = async (w, o) => { const r = await openPage(w, o); browsers.push(r.browser); return r; };
after(async () => { await Promise.all(browsers.map((b) => b.close())); await stopServer(); });

const map = loadMap();
const keysOf = (...prefixes) => Object.keys(map).filter((k) => prefixes.some((p) => k.startsWith(p)));
const heroNews = keysOf('hero-', 'news-');
const introKeys = keysOf('intro-');

for (const width of [1440, 768, 375]) {
  test(`hero_news_boxes_match_ref @${width}`, async () => {
    const { page } = await open(width);
    const aiis = await measureAiis(page, width);
    const ref = loadRef(width);
    const bad = heroNews.flatMap((k) => compareKey(k, aiis, ref));
    assert.deepEqual(bad, []);
    const missing = heroNews.filter((k) => !(map[k].hiddenAt || []).includes(width) && !aiis.keys[k]);
    assert.deepEqual(missing, []);
  });

  test(`intro_boxes_match_ref @${width}`, async () => {
    const { page } = await open(width, { skipIntro: false, hold: true });
    const aiis = await measureAiisIntro(page, width);
    const ref = loadRef(width);
    const bad = introKeys.flatMap((k) => compareKey(k, aiis, ref));
    assert.deepEqual(bad, []);
    assert.deepEqual(introKeys.filter((k) => !aiis.keys[k]), []);
  });
}

// A fresh browser context on the static server, for tests that need init scripts before the first navigation.
async function freshPage(opts = {}, init) {
  const port = await startServer();
  const browser = await chromium.launch();
  browsers.push(browser);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await ctx.newPage();
  if (init) await page.addInitScript(init);
  return { page, url: `http://127.0.0.1:${port}/` };
}
const hasClass = (page, c) => page.evaluate((n) => document.documentElement.classList.contains(n), c);

test('intro_plays_once_per_session', async () => {
  const { page, url } = await freshPage();
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  assert.ok(await page.locator('[data-k="intro-root"]').isVisible(), 'intro visible on first load');
  assert.ok(await hasClass(page, 'intro-active'), 'header hook set while intro runs');
  assert.ok(!(await hasClass(page, 'intro-done')));
  await page.waitForFunction(() => document.documentElement.classList.contains('intro-done'), null, { timeout: INTRO_MS + 1000 });
  assert.ok(!(await page.locator('[data-k="intro-root"]').isVisible()), 'intro hidden once done');
  assert.ok(!(await hasClass(page, 'intro-active')));
  assert.equal(await page.evaluate(() => sessionStorage.getItem('aiis-intro-seen')), '1');

  await page.reload({ waitUntil: 'load' });
  assert.ok(!(await page.locator('[data-k="intro-root"]').isVisible()), 'no intro on reload');
  assert.ok(!(await hasClass(page, 'intro-playing')));
  // repeat visit replays only the hero entrance (done 1.5 s after load, ssa-animations.md item 1)
  await page.waitForFunction(() => document.documentElement.classList.contains('intro-done'), null, { timeout: 2500 });
});

test('intro_nointro_query_skips', async () => {
  const { page, url } = await freshPage();
  await page.goto(`${url}?nointro`, { waitUntil: 'load' });
  assert.ok(!(await page.locator('[data-k="intro-root"]').isVisible()));
  await page.waitForFunction(() => document.documentElement.classList.contains('intro-done'), null, { timeout: 1000 });
});

test('intro_storage_throws_still_completes', async () => {
  const { page, url } = await freshPage({}, () => {
    Object.defineProperty(window, 'sessionStorage', { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } });
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.classList.contains('intro-done'), null, { timeout: INTRO_MS + 1000 });
  assert.ok(!(await page.locator('[data-k="intro-root"]').isVisible()));
});

test('intro_reduced_motion_skipped', async () => {
  const { page, url } = await freshPage({ reducedMotion: 'reduce' }, () => {
    window.__sawIntro = false;
    const check = () => { if (document.documentElement.classList.contains('intro-playing')) window.__sawIntro = true; };
    new MutationObserver(check).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    check();
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  assert.ok(!(await page.locator('[data-k="intro-root"]').isVisible()), 'intro never visible');
  await page.waitForFunction(() => document.documentElement.classList.contains('intro-done'), null, { timeout: 1500 });
  assert.equal(await page.evaluate(() => window.__sawIntro), false);
  // all hero motion off: no running animations on the badge ring or marquee
  const anim = await page.evaluate(() => [
    getComputedStyle(document.querySelector('[data-k="hero-badge-ring"] > *')).animationName,
    getComputedStyle(document.querySelector('[data-k="news-list"]')).animationName,
  ]);
  assert.deepEqual(anim, ['none', 'none']);
});

test('badge_rotates', async () => {
  const { page } = await open(1440);
  const a = await page.evaluate(() => {
    const s = getComputedStyle(document.querySelector('[data-k="hero-badge-ring"] > *'));
    const m = getComputedStyle(document.querySelector('[data-k="news-list"]'));
    return { name: s.animationName, dur: s.animationDuration, ease: s.animationTimingFunction, iter: s.animationIterationCount,
      marquee: [m.animationName, m.animationDuration, m.animationTimingFunction, m.animationIterationCount] };
  });
  // inventory quick reference: infinite-spinning, 360deg, 30 s, linear, infinite; marquee 20 s linear infinite
  assert.deepEqual([a.name, a.dur, a.ease, a.iter], ['infinite-spinning', '30s', 'linear', 'infinite']);
  assert.deepEqual(a.marquee, ['marquee', '20s', 'linear', 'infinite']);
});

test('video_modal_esc_restores_focus_and_scroll', async () => {
  const { page } = await open(1440);
  await page.evaluate(() => window.scrollTo(0, 200));
  await page.waitForTimeout(200);
  const badge = page.locator('[data-k="hero-badge"]');
  await badge.click();
  const dlg = page.locator('dialog.video-modal');
  assert.ok(await dlg.isVisible(), 'modal visible');
  assert.equal(await dlg.getAttribute('role'), 'dialog');
  assert.equal(await dlg.getAttribute('aria-modal'), 'true');
  const labelId = await dlg.getAttribute('aria-labelledby');
  assert.ok(labelId && (await page.locator(`#${labelId}`).innerText()).trim().length > 0, 'labelled');
  assert.ok(await page.evaluate(() => !!document.activeElement?.closest('dialog.video-modal')), 'focus moved into the modal');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  assert.ok(!(await dlg.isVisible()), 'modal hidden');
  assert.equal(await page.evaluate(() => document.querySelector('dialog.video-modal video').paused), true);
  assert.ok(await page.evaluate(() => document.activeElement === document.querySelector('[data-k="hero-badge"]')), 'focus back on the badge');
  assert.equal(await page.evaluate(() => Math.round(window.scrollY)), 200);
});

test('video_modal_backdrop_and_close_button', async () => {
  const { page } = await open(1440);
  const dlg = page.locator('dialog.video-modal');
  await page.locator('[data-k="hero-badge"]').click();
  assert.ok(await dlg.isVisible());
  await page.locator('dialog.video-modal .video-modal__close').click();
  assert.ok(!(await dlg.isVisible()));
  await page.locator('[data-k="hero-badge"]').click();
  assert.ok(await dlg.isVisible());
  await page.mouse.click(5, 5); // backdrop
  assert.ok(!(await dlg.isVisible()));
  // public API for Task 9
  assert.equal(await page.evaluate(() => typeof window.AIIS?.openVideoModal), 'function');
});

test('news_panel_opens_with_card_titles_and_esc_closes', async () => {
  const { page } = await open(1440);
  // The triggers live in a 20 s marquee: depending on how long the page has been running (load!) the first trigger can be scrolled
  // out of the viewport. Freeze the marquee at its start, then wait until the trigger's box is inside the viewport.
  await page.addStyleTag({ content: '.news__list { animation: none !important; transform: none !important; }' });
  const trigger = page.locator('[data-k="news-trigger1"]').first();
  await trigger.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const r = document.querySelector('[data-k="news-trigger1"]').getBoundingClientRect();
    return r.width > 0 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight;
  });
  await trigger.click();
  const panel = page.locator('.news-panel');
  await panel.waitFor({ state: 'visible' }); // wait on state, not on a fixed sleep (the suite can run under heavy load)
  await page.waitForFunction(() => document.querySelector('.news-panel').contains(document.activeElement)); // focus moves in after 500 ms
  assert.ok(await panel.isVisible());
  const text = await panel.innerText();
  for (const t of ['Science fair celebrates young inventors', 'Grade 5 learning walk', 'Sports day highlights', 'Welcome back to a new term'])
    assert.ok(text.includes(t), t);
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'hidden' });
  assert.ok(!(await panel.isVisible()));
  await page.waitForFunction(() => document.activeElement?.matches('[data-news-trigger]'));
});

for (const [w, font] of [[1000, null], [1280, null], [1366, null], [1440, '160px']]) {
  test(`hero_title_single_line @${w}`, async () => {
    const { page } = await open(w);
    const r = await page.evaluate(() => { const e = document.querySelector('[data-k="hero-heading"]'); const s = getComputedStyle(e);
      return { h: e.getBoundingClientRect().height, lh: parseFloat(s.lineHeight), fs: s.fontSize }; });
    assert.ok(Math.abs(r.h - r.lh) <= 1, `title wraps: h ${r.h} vs line-height ${r.lh}`);
    if (font) assert.equal(r.fs, font);
  });
}

test('news_strip_triggers_reachable_once_and_keys_unique', async () => {
  const { page } = await open(1440);
  assert.equal(await page.locator('[data-k="news-item1"]').count(), 1);
  const names = await page.evaluate(() => {
    const trig = [...document.querySelectorAll('.news [data-news-trigger]')];
    return { total: trig.length, reachable: trig.filter((b) => b.tabIndex >= 0 && !b.closest('[aria-hidden="true"]')).length };
  });
  assert.equal(names.reachable, 1);
  // keyboard: Tab from the video control lands on exactly one strip trigger, then leaves the strip
  await page.locator('[data-k="hero-video-control"]').focus();
  let hits = 0;
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => !!document.activeElement?.closest('.news .news__list'))) hits++;
  }
  assert.equal(hits, 1);
});
