// Tests added by the final fix pass (items D3, D1, D2, B, C). Each test names the review item it covers.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { startServer, stopServer } from './helpers.mjs';

const browsers = [];
after(async () => { await Promise.all(browsers.map((b) => b.close())); await stopServer(); });

/** Fresh context on the static server; `init` runs before the first navigation. */
async function freshPage(opts = {}, init, arg) {
  const port = await startServer();
  const browser = await chromium.launch();
  browsers.push(browser);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await ctx.newPage();
  if (init) await page.addInitScript(init, arg);
  return { page, ctx, url: `http://127.0.0.1:${port}/` };
}
const htmlHas = (page, c) => page.evaluate((n) => document.documentElement.classList.contains(n), c);

// ---- D3: ?introhold is gone from production code ----------------------------------------------------------
test('intro_introhold_query_is_not_a_hook', { timeout: 30000 }, async () => {
  for (const f of ['site/index.html', 'site/js/intro.js']) assert.ok(!/introhold/i.test(fs.readFileSync(f, 'utf8')), `${f} must not mention introhold`);
  const { page, url } = await freshPage();
  await page.goto(`${url}?introhold`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.classList.contains('intro-done'), null, { timeout: 9000 });
  assert.equal(await page.locator('[data-k="intro-root"].is-held').count(), 0, 'no frozen intro');
  assert.ok(!(await page.locator('[data-k="intro-root"]').isVisible()));
});

test('intro_test_flag_holds_intro_when_injected', async () => {
  const { page, url } = await freshPage({}, () => { window.__aiisTestHold = true; });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('[data-k="intro-root"].is-held', { timeout: 5000 });
  assert.ok(!(await htmlHas(page, 'intro-done')));
});

// ---- B: page accessibility --------------------------------------------------------------------------------
async function readyPage(width = 1440, search = '?nointro') {
  const { page, url } = await freshPage({ viewport: { width, height: 900 } });
  await page.goto(url + search, { waitUntil: 'load' });
  await page.waitForSelector('[data-section="hero"][data-ready="true"]');
  return page;
}

test('page_single_h1_is_hero_title_and_levels_do_not_skip', async () => {
  const page = await readyPage();
  const heads = await page.evaluate(() => [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => ({ level: Number(h.tagName[1]), cls: h.className, text: h.textContent.trim().slice(0, 30) })));
  const h1s = heads.filter((h) => h.level === 1);
  assert.equal(h1s.length, 1, 'exactly one h1');
  assert.ok(h1s[0].cls.includes('hero__title'), 'the h1 is the hero title');
  assert.equal(heads[0].level, 1, 'the outline starts with the h1');
  heads.forEach((h, i) => { if (i) assert.ok(h.level <= heads[i - 1].level + 1, `heading "${h.text}" (h${h.level}) skips after h${heads[i - 1].level}`); });
});

test('page_skip_link_first_tab_visible_and_works', async () => {
  const page = await readyPage();
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => { const a = document.activeElement; const r = a.getBoundingClientRect();
    return { text: a.textContent.trim(), href: a.getAttribute('href'), top: r.top, left: r.left, w: r.width, h: r.height, vis: getComputedStyle(a).visibility }; });
  assert.equal(first.text, 'Skip to main content');
  assert.ok(first.top >= 0 && first.left >= 0 && first.w > 40 && first.h > 16 && first.vis === 'visible', `visible on focus ${JSON.stringify(first)}`);
  await page.keyboard.press('Enter');
  const after = await page.evaluate(() => ({ tag: document.activeElement.tagName, id: document.activeElement.id, main: document.querySelector('main').id }));
  assert.equal(after.tag, 'MAIN');
  assert.equal(after.id, after.main);
  assert.ok(after.main, 'main has an id');
});

test('page_skip_link_hidden_until_focused', async () => {
  const page = await readyPage();
  const r = await page.evaluate(() => document.querySelector('.skip-link').getBoundingClientRect().toJSON());
  assert.ok(r.bottom <= 0 || r.right <= 0 || r.width <= 1, `skip link is off-screen until focused ${JSON.stringify(r)}`);
});

test('hero_badge_ring_text_contrast_at_least_4_5', async () => {
  const page = await readyPage();
  const c = await page.evaluate(() => {
    const t = getComputedStyle(document.querySelector('.hero__ring text')).fill;
    const d = getComputedStyle(document.querySelector('.hero__disc')).backgroundColor;
    return { t, d };
  });
  const rgb = (s) => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const [a, b] = [lum(rgb(c.t)), lum(rgb(c.d))];
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  assert.ok(ratio >= 4.5, `ring text ${c.t} on disc ${c.d} is ${ratio.toFixed(2)}:1`);
});

test('video_controls_use_one_state_mechanism', async () => {
  const page = await readyPage();
  for (const sel of ['[data-hero-toggle]', '[data-learning-toggle]']) {
    const get = () => page.evaluate((s) => { const b = document.querySelector(s); return { pressed: b.getAttribute('aria-pressed'), label: b.querySelector('.sr').textContent }; }, sel);
    const before = await get();
    // flip the real state through the control, then compare: a label that changes must not coexist with aria-pressed
    await page.evaluate((s) => { const b = document.querySelector(s); const v = b.closest('[data-k$="frame"]').querySelector('video'); Object.defineProperty(v, 'paused', { configurable: true, value: !v.paused }); v.dispatchEvent(new Event(v.paused ? 'pause' : 'play')); }, sel);
    const after = await get();
    if (before.pressed !== null || after.pressed !== null) assert.equal(after.label, before.label, `${sel}: aria-pressed present, so the label must stay constant`);
  }
});

test('news_marquee_pauses_on_pointer_hover', async () => {
  const page = await readyPage();
  const state = () => page.evaluate(() => getComputedStyle(document.querySelector('[data-k="news-list"]')).animationPlayState);
  assert.equal(await state(), 'running');
  await page.locator('[data-section="news"]').scrollIntoViewIfNeeded();
  const box = await page.evaluate(() => { const r = document.querySelector('[data-section="news"]').getBoundingClientRect(); return { x: r.left + 4, y: r.top + r.height / 2 }; });
  await page.mouse.move(box.x, box.y); // the strip's blank edge: no click inside the moving region
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-k="news-list"]')).animationPlayState === 'paused', null, { timeout: 3000 });
  await page.mouse.move(5, 5);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-k="news-list"]')).animationPlayState === 'running', null, { timeout: 3000 });
});

test('intro_makes_page_inert_while_playing_and_releases', { timeout: 30000 }, async () => {
  const inertNow = (page) => page.evaluate(() => ['.skip-link', 'header.hdr', 'main', 'footer'].map((s) => document.querySelector(s).inert));
  const { page, url } = await freshPage({}, () => { window.__aiisTestHold = true; });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('[data-k="intro-root"].is-held', { timeout: 6000 });
  assert.deepEqual(await inertNow(page), [true, true, true, true]);
  for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement === document.body || !document.activeElement.closest('header,main,footer,.skip-link')), true, 'Tab reaches nothing behind the overlay');
  // a normal first visit releases it when the intro finishes
  const p2 = await freshPage();
  await p2.page.goto(p2.url, { waitUntil: 'load' });
  await p2.page.waitForFunction(() => document.documentElement.classList.contains('intro-done'), null, { timeout: 12000 });
  assert.deepEqual(await inertNow(p2.page), [false, false, false, false]);
  // skipped intro: never inert
  const p3 = await freshPage();
  await p3.page.addInitScript(() => { window.__sawInert = false; new MutationObserver(() => { if (document.querySelector('main')?.inert) window.__sawInert = true; }).observe(document, { subtree: true, attributes: true, attributeFilter: ['inert'] }); });
  await p3.page.goto(`${p3.url}?nointro`, { waitUntil: 'load' });
  await p3.page.waitForSelector('[data-section="hero"][data-ready="true"]');
  assert.equal(await p3.page.evaluate(() => window.__sawInert), false);
});

// ---- C: constraints and content ----------------------------------------------------------------------------
const indexHtml = () => fs.readFileSync('site/index.html', 'utf8');

test('page_noindex_meta_present_in_page_and_bundle', async () => {
  const re = /<meta name="robots" content="noindex, nofollow">/;
  assert.ok(re.test(indexHtml()), 'site/index.html');
  const { buildHtml } = await import('../tools/bundle.mjs');
  assert.ok(re.test(await buildHtml()), 'bundle');
  assert.ok(/remove[^>]*launch/i.test(indexHtml().match(/<!--[^>]*-->\s*<meta name="robots"/)?.[0] ?? ''), 'comment says to remove it at launch');
});

test('learning_video_does_not_preload_hero_video_unchanged', () => {
  const html = indexHtml();
  assert.match(html, /<video data-k="learning-video"[^>]*preload="none"/);
  assert.match(html, /<video data-k="hero-video"[^>]*preload="auto"/);
});

test('page_temp_videos_tagged_everywhere_and_modal_shows_tag', { timeout: 60000 }, async () => {
  const page = await readyPage();
  // static: any external URL in a media attribute is inside a Temp-photo wrapper or on an element marked data-temp-video;
  // an anchor href never points at it (so no navigation to the other host without JavaScript); the one allowed address is the
  // school's own online-registration link, declared in the sitemap data
  const SITEMAP = JSON.parse(fs.readFileSync('content/site.json', 'utf8'));
  const allowed = SITEMAP.quickLinks.links.filter((l) => l.external).map((l) => l.path);
  const bad = await page.evaluate((allowed) => {
    const ext = (u) => /^(https?:)?\/\//.test(u) && new URL(u, location.href).origin !== location.origin;
    const out = [];
    for (const el of document.querySelectorAll('*')) {
      for (const a of ['src', 'srcset', 'poster', 'data-src', 'data-video-src', 'href']) {
        const v = el.getAttribute(a);
        if (!v || !ext(v)) continue;
        if (a === 'href' && el.tagName === 'A' && allowed.includes(v)) continue;
        if (a === 'href' && el.tagName === 'A') { out.push(`href navigates away: ${v.slice(0, 60)}`); continue; }
        if (el.tagName === 'LINK' || el.tagName === 'SCRIPT') continue; // stylesheets and library scripts are not media
        if (!el.closest('[data-temp-photo]') && !el.hasAttribute('data-temp-video')) out.push(`${a} untagged on <${el.tagName.toLowerCase()} ${el.className}>`);
      }
    }
    return out;
  }, allowed);
  assert.deepEqual(bad, []);
  // runtime: the modal shows the tag for the hero badge and for a teacher video
  for (const sel of ['[data-k="hero-badge"]', '[data-k="teachers-slide1-play"]']) {
    await page.evaluate((s) => document.querySelector(s).click(), sel);
    await page.waitForSelector('dialog.video-modal[open]');
    const tag = await page.evaluate(() => {
      const stage = document.querySelector('.video-modal__stage');
      const v = stage.querySelector('video');
      return { wrapped: !!v.closest('[data-temp-photo]'), content: getComputedStyle(stage, '::after').content, display: getComputedStyle(stage, '::after').display };
    });
    assert.ok(tag.wrapped, `${sel}: modal video inside a Temp wrapper`);
    assert.match(tag.content, /Temp photo/);
    assert.notEqual(tag.display, 'none');
    await page.evaluate(() => window.AIIS.closeVideoModal());
  }
});

test('page_hero_badge_without_js_does_not_navigate_to_media', async () => {
  const { page, url } = await freshPage({ javaScriptEnabled: false });
  await page.goto(url + '?nointro', { waitUntil: 'domcontentloaded' });
  const href = await page.getAttribute('[data-k="hero-badge"]', 'href');
  assert.ok(href.startsWith('#'), `badge href is ${href}`);
});

// ---- C2: placeholders are marked and listed in the handover -------------------------------------------------------
const norm = (s) => s.replace(/\s+/g, ' ').trim();
async function placeholderStrings() {
  const { page, url } = await freshPage({ javaScriptEnabled: false });
  await page.route(/^(?!http:\/\/127\.0\.0\.1)/, (r) => r.abort());
  await page.goto(url + '?nointro', { waitUntil: 'domcontentloaded' });
  return page.evaluate(() => [...document.querySelectorAll('[data-placeholder]')].map((e) => ({ t: e.textContent.replace(/\s+/g, ' ').trim(), what: e.getAttribute('data-placeholder') })));
}
test('page_placeholders_match_handover_checklist', async () => {
  const items = await placeholderStrings();
  assert.ok(items.length > 20);
  for (const i of items) { assert.ok(i.t, 'placeholder has text'); assert.ok(i.what.trim().length > 3, `data-placeholder value says what it is (${i.t})`); }
  const set = new Set(items.map((i) => i.t));
  const doc = fs.readFileSync('docs/handover.md', 'utf8');
  const sec = /### Placeholder checklist\n([\s\S]*?)(?=\n#{2,3} |\n---|$)/.exec(doc)?.[1];
  assert.ok(sec, 'handover has a "Placeholder checklist" section');
  const listed = new Set([...sec.matchAll(/"([^"\n]+)"/g)].map((m) => norm(m[1])));
  assert.deepEqual([...set].filter((s) => !listed.has(s)), [], 'marked on the page but missing from the handover');
  assert.deepEqual([...listed].filter((s) => !set.has(s)), [], 'listed in the handover but not marked on the page');
  for (const must of ['Science fair celebrates young inventors', 'Grade 5 learning walk', 'Sports day highlights', 'Welcome back to a new term', 'Instagram', 'Facebook', 'YouTube', 'LinkedIn',
    'MR. RAHUL', 'MS. FATIMA', 'MS. SARAH', 'MR. JOSEPH', 'MR. ARJUN', 'MS. MEERA', 'MS. PRIYA & MS. ANITHA', '+965 0000 0000', 'info@aiis.example', 'AIIS Abbasiya Campus'])
    assert.ok(set.has(must), `${must} is marked as a placeholder`);
});

// ---- D1: robustness against slow or missing third parties -----------------------------------------------------------
test('page_cdn_scripts_have_integrity_and_page_initialises', { timeout: 60000 }, async () => {
  const tags = indexHtml().match(/<script defer[^>]*cdnjs[^>]*>/g);
  assert.equal(tags.length, 2);
  for (const t of tags) { assert.match(t, /integrity="sha384-[A-Za-z0-9+/]{64}"/); assert.match(t, /crossorigin="anonymous"/); }
  const page = await readyPage();
  await page.waitForFunction(() => document.querySelectorAll('[data-section][data-ready="true"]').length >= 8 && window.gsap && window.ScrollTrigger, null, { timeout: 30000 });
});

test('page_hero_revealed_when_cdn_hangs', { timeout: 30000 }, async () => {
  const { page, url } = await freshPage();
  await page.route('**/cdnjs.cloudflare.com/**', () => {}); // never answered
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForFunction(() => !document.documentElement.classList.contains('hero-pre') && !document.documentElement.classList.contains('intro-playing')
    && getComputedStyle(document.querySelector('.hero__frame')).opacity === '1', null, { timeout: 5000, polling: 100 });
  assert.ok(Date.now() - t0 <= 5200, `revealed after ${Date.now() - t0} ms`);
  assert.equal(await page.locator('[data-k="intro-root"]').isVisible(), false, 'intro overlay is not covering the page');
});

test('page_paints_when_google_fonts_stylesheet_hangs', { timeout: 30000 }, async () => {
  const { page, url } = await freshPage();
  await page.route('**/fonts.googleapis.com/**', () => {}); // held open, not aborted
  const t0 = Date.now();
  await page.goto(url + '?nointro', { waitUntil: 'commit' });
  await page.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length > 0, null, { timeout: 5000, polling: 100 });
  assert.ok(Date.now() - t0 <= 5200);
});

// ---- D2: single-file build fills the logo slots while parsing -----------------------------------------------------------
test('bundle_logos_filled_without_waiting_for_cdn', { timeout: 60000 }, async () => {
  const { buildHtml } = await import('../tools/bundle.mjs');
  const os = await import('node:os'); const path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiis-d2-'));
  fs.writeFileSync(path.join(dir, 'index.html'), await buildHtml());
  const port = await startServer(dir);
  const browser = await chromium.launch(); browsers.push(browser);
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.route('**/cdnjs.cloudflare.com/**', () => {});
  try {
    await page.goto(`http://127.0.0.1:${port}/?nointro`, { waitUntil: 'commit' });
    await page.waitForFunction(() => { const imgs = [...document.querySelectorAll('img[data-inline-src], img[data-inline-carrier]')];
      return imgs.length === 6 && imgs.every((i) => i.getAttribute('src')?.startsWith('data:image/png') && i.complete && i.naturalWidth > 0); }, null, { timeout: 10000, polling: 50 });
    // the point of the fix: they are filled while DOMContentLoaded has not fired (it is held back by the hung
    // deferred scripts), and promptly. 2 s when the machine is idle; the bound is wider so a loaded test run does not flake.
    const st = await page.evaluate(() => ({ dcl: performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd, now: performance.now() }));
    assert.equal(st.dcl, 0, 'filled while DOMContentLoaded is still held back');
    assert.ok(st.now < 5000, `filled after ${Math.round(st.now)} ms`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
