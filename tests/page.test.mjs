// Whole-page verification (Task 11): every key against the reference at three widths (using the section tests' own normalisers),
// the order / gaps between sections, page height, text hygiene, Temp-photo tagging, reduced motion and the keyboard path.
import { test, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage, measureAiis, compareKey, loadRef, stopServer } from './helpers.mjs';
import { loadMap } from '../tools/measure.mjs';
import { normaliseAll, aiisLearningBlocks, ssaLearningBlocks, SECTION_ORDER } from './normalise.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browsers = [];
const open = async (w, o) => { const r = await openPage(w, o); browsers.push(r.browser); return r; };
afterEach(async () => { await Promise.all(browsers.splice(0).map((b) => b.close())); });
after(async () => { await stopServer(); });

const map = loadMap();

// ---- every key + the vertical structure between sections ------------------------------------------------------
// Section-by-section drift from different copy is taken out with the same normalisers the section tests use. On top of that:
//  - order: the section roots start in the reference's order;
//  - gap: the space between one root's bottom and the next root's top equals the reference's (raw values: copy only changes a
//    root's own height, never the gap);
//  - page height: bottom of the footer minus the copy-driven drift of every section equals the reference's.
const rootOf = (m, s) => m.keys[`${s}-root`];
const copyDrift = (raw, norm) => SECTION_ORDER.reduce((a, s) => a + (rootOf(raw, s).box.h - rootOf(norm, s).box.h), 0);

for (const width of [1440, 768, 375]) {
  test(`page_all_keys_match_ref @${width}`, async () => {
    const { page } = await open(width);
    const aiisRaw = await measureAiis(page, width);
    const refRaw = loadRef(width);
    const aiis = normaliseAll(aiisRaw, width, await aiisLearningBlocks(page));
    const ref = normaliseAll(refRaw, width, ssaLearningBlocks(width));

    const bad = Object.keys(map).flatMap((k) => compareKey(k, aiis, ref));
    assert.deepEqual(bad, []);
    const missing = Object.keys(map).filter((k) => map[k].state !== 'intro' && !(map[k].hiddenAt || []).includes(width) && !aiis.keys[k]);
    assert.deepEqual(missing, []);

    const order = (m) => [...SECTION_ORDER].sort((a, b) => rootOf(m, a).box.y - rootOf(m, b).box.y);
    assert.deepEqual(order(aiisRaw), SECTION_ORDER, 'AIIS sections in document order');
    assert.deepEqual(order(refRaw), SECTION_ORDER);
    const gaps = (m) => SECTION_ORDER.slice(1).map((s, i) => {
      const prev = rootOf(m, SECTION_ORDER[i]);
      return +(rootOf(m, s).box.y - (prev.box.y + prev.box.h)).toFixed(2);
    });
    const ga = gaps(aiisRaw), gr = gaps(refRaw);
    const badGaps = ga.map((g, i) => Math.abs(g - gr[i]) > 4 ? `${SECTION_ORDER[i]} -> ${SECTION_ORDER[i + 1]}: gap ${g} vs ${gr[i]}` : null).filter(Boolean);
    assert.deepEqual(badGaps, []);

    const bottom = (m) => rootOf(m, 'footer').box.y + rootOf(m, 'footer').box.h;
    const hA = bottom(aiisRaw) - copyDrift(aiisRaw, aiis), hR = bottom(refRaw) - copyDrift(refRaw, ref);
    assert.ok(Math.abs(hA - hR) <= 4, `normalised page height ${hA.toFixed(1)} vs ${hR.toFixed(1)}`);
  });
}

test('page_no_horizontal_scroll_375', async () => {
  const { page } = await open(375);
  assert.deepEqual(await page.evaluate(() => ({ ok: document.documentElement.scrollWidth <= innerWidth, bodyOk: document.body.scrollWidth <= innerWidth })), { ok: true, bodyOk: true });
});

// ---- no reference-site identity in site/ ------------------------------------------------------------------------
const TEXT_EXT = new Set(['.html', '.css', '.js', '.svg', '.md', '.json', '.webmanifest', '.txt']);
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const BANNED = [[/Shady\s*Side/i, 'Shady Side'], [/\bSSA\b/i, 'SSA (any case, whole word)'], [/Pittsburgh/i, 'Pittsburgh'], [/Make your move/i, 'Make your move'],
  [/Learning that moves/i, 'Learning that moves'], [/Forever SSA/i, 'Forever SSA']];
test('page_no_ssa_text', async () => {
  const hits = [];
  for (const f of walk(path.join(root, 'site')).filter((f) => TEXT_EXT.has(path.extname(f).toLowerCase()))) {
    // URLs are excluded (hotlinked photo/video addresses, url(...) values); everything else is scanned: text, attribute values,
    // and HTML / CSS / JS comments.
    const text = fs.readFileSync(f, 'utf8').replace(/(?:https?:)?\/\/[^\s"'<>)\\]+/g, ' ').replace(/url\([^)]*\)/g, ' ');
    for (const [re, label] of BANNED) if (re.test(text)) hits.push(`${path.relative(root, f)}: ${label}`);
  }
  assert.deepEqual(hits, []);
});

// ---- every reference-site photo / video / background is inside a Temp-photo figure ----------------------------------
test('page_all_temp_photos_tagged', async () => {
  const { page } = await open(1440);
  const untagged = await page.evaluate(() => {
    const ref = /shadysideacademy\.org|finalsite\.net|shadyside/i;
    const out = [];
    const note = (el, what, url) => { if (ref.test(url) && !el.closest('[data-temp-photo]') && !el.hasAttribute('data-temp-video')) out.push(`${what} ${url.slice(0, 90)} in <${el.tagName.toLowerCase()} ${el.className || el.dataset.k || ''}>`); };
    for (const el of document.querySelectorAll('img, video, source, picture, [poster]')) {
      for (const a of ['src', 'srcset', 'poster', 'data-src']) if (el.getAttribute(a)) note(el, a, el.getAttribute(a));
    }
    // video sources that are not media elements: data-video-src, and any anchor href that would navigate to the reference host
    // (such an element must be marked data-temp-video, which makes the video modal show the Temp tag; an href may not point there at all)
    for (const el of document.querySelectorAll('[data-video-src], a[href]')) {
      if (el.hasAttribute('data-video-src')) note(el, 'data-video-src', el.getAttribute('data-video-src'));
      const h = el.getAttribute('href');
      if (el.tagName === 'A' && h && ref.test(h)) out.push(`href ${h.slice(0, 90)} navigates to the reference host`);
    }
    for (const el of document.querySelectorAll('*')) {
      for (const ps of [null, '::before', '::after']) {
        const bg = getComputedStyle(el, ps).backgroundImage;
        if (bg && bg !== 'none') note(el, `background${ps || ''}`, bg);
      }
    }
    return out;
  });
  assert.deepEqual(untagged, []);
  // static CSS: no url(...) to the reference site in any stylesheet
  const css = walk(path.join(root, 'site/css')).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  assert.ok(!/url\([^)]*(shadyside|finalsite)/i.test(css), 'stylesheets carry no reference-site url()');
});

// ---- reduced motion: nothing runs after load --------------------------------------------------------------------
test('page_reduced_motion_static', async () => {
  const { page } = await open(1440, { reducedMotion: true });
  await page.waitForFunction(() => document.body.dataset.readyTempPhoto === 'true');
  const st = await page.evaluate(() => {
    const g = window.gsap;
    const tweens = g ? g.globalTimeline.getChildren(true, true, true).filter((t) => t.isActive && t.isActive() && t.duration() > 0) : [];
    const css = document.getAnimations().filter((a) => a instanceof CSSAnimation && a.playState === 'running'
      && a.animationName !== 'none').map((a) => a.animationName);
    return { gsap: !!g, tweens: tweens.length, css };
  });
  assert.equal(st.gsap, true, 'gsap is loaded (otherwise the check is vacuous)');
  assert.equal(st.tweens, 0, 'no running GSAP tweens');
  assert.deepEqual(st.css, []);
});

// ---- keyboard path ------------------------------------------------------------------------------------------------
/** Tab through the whole page; returns one record per stop. */
async function tabWalk(page) {
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  const stops = [];
  for (let i = 0; i < 220; i++) {
    await page.keyboard.press('Tab');
    const s = await page.evaluate(async () => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      // let transitions finish (a ring fades in over .3 s; the carousel centres a focused card over .5 s) before judging ring and position
      await Promise.all(document.getAnimations().filter((a) => a instanceof CSSTransition).map((a) => a.finished.catch(() => {})));
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      const col = /rgba?\(([^)]*)\)/.exec(cs.outlineColor);
      const alpha = col ? (col[1].split(',')[3] === undefined ? 1 : parseFloat(col[1].split(',')[3])) : 0;
      const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 && alpha > 0;
      const shadow = cs.boxShadow !== 'none';
      if (!window.__order) window.__order = [...document.querySelectorAll('*')];
      return { k: el.dataset.k || el.className || el.tagName, tag: el.tagName, label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
        idx: window.__order.indexOf(el), focusVisible: el.matches(':focus-visible'), visibleFocus: outline || shadow,
        inView: r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth, // at least partly on screen (side cards are trimmed by the viewport)
        el: el.closest('[data-section]')?.dataset.section || '' };
    });
    if (!s) { if (stops.length) break; else continue; }
    stops.push(s);
  }
  return stops;
}

for (const width of [1440, 375]) {
  test(`page_keyboard_path @${width}`, async () => {
    const { page } = await open(width);
    const stops = await tabWalk(page);
    assert.ok(stops.length > 20, `walked ${stops.length} stops`);
    // document order, no repeats
    const idx = stops.map((s) => s.idx);
    assert.deepEqual(idx, [...idx].sort((a, b) => a - b), 'tab order follows the DOM');
    assert.equal(new Set(idx).size, idx.length);
    // every stop has a visible focus indication and is on screen
    const noRing = stops.filter((s) => !s.visibleFocus).map((s) => `${s.k} "${s.label}"`);
    assert.deepEqual(noRing, [], 'visible focus indication');
    const off = stops.filter((s) => !s.inView).map((s) => `${s.k} "${s.label}"`);
    assert.deepEqual(off, [], 'focused control is on screen');
    // the required controls are reached
    const has = (f) => stops.some(f);
    if (width < 1000) assert.ok(has((s) => s.k === 'header-menu-toggle'), 'menu toggle');
    else assert.ok(stops.filter((s) => s.el === 'header' && /nav-item/.test(s.k)).length >= 5, 'desktop nav links');
    assert.ok(has((s) => s.k === 'hero-badge'), 'hero badge');
    assert.equal(stops.filter((s) => s.el === 'divisions').length, 3, 'three flip toggles (the hidden faces are inert)');
    assert.ok(has((s) => s.k === 'teachers-prev') && has((s) => s.k === 'teachers-next'), 'carousel arrows');
    assert.equal(stops.filter((s) => s.k === 'closing-link').length, 3, 'closing links');
    assert.ok(has((s) => s.k === 'closing-button'));
    const at = (f) => stops.findIndex(f);
    assert.ok(at((s) => s.k === 'hero-badge') < at((s) => s.el === 'divisions') && at((s) => s.el === 'divisions') < at((s) => s.k === 'teachers-prev')
      && at((s) => s.k === 'teachers-next') < at((s) => s.k === 'closing-button'), 'badge < flip toggles < arrows < closing');
  });
}

test('page_keyboard_header_visible_when_scrolled_away', async () => {
  const { page } = await open(1440);
  await page.evaluate(() => window.scrollTo(0, 3000));
  await page.waitForFunction(() => document.body.classList.contains('sticky-header-active') && !document.body.classList.contains('scrolled-up'));
  await page.waitForFunction(() => document.querySelector('[data-k="header-search"]').getBoundingClientRect().bottom < 0); // slid fully out
  await page.focus('[data-k="header-translate"]');
  await page.keyboard.press('Tab'); // keyboard focus moves within the header, to the search button (the page does not scroll)
  assert.equal(await page.evaluate(() => document.activeElement.dataset.k), 'header-search');
  assert.equal(await page.evaluate(() => scrollY), 3000);
  assert.equal(await page.evaluate(() => document.body.classList.contains('scrolled-up')), false, 'the bar is still in its hidden state');
  await page.waitForFunction(() => document.querySelector('[data-k="header-search"]').getBoundingClientRect().top >= 0, null, { timeout: 5000 });
  const r = await page.evaluate(() => { const b = document.querySelector('[data-k="header-search"]').getBoundingClientRect(); return { top: b.top, bottom: b.bottom }; });
  assert.ok(r.top >= 0 && r.bottom <= 100, `focused header control is on screen (${JSON.stringify(r)})`);
});

test('page_keyboard_nav_dropdown_esc_and_aria', async () => {
  const { page } = await open(1440);
  const links = await page.$$eval('.hdr__item > .hdr__link', (a) => a.map((l) => ({ popup: l.getAttribute('aria-haspopup'), exp: l.getAttribute('aria-expanded') })));
  assert.equal(links.length, 5);
  for (const l of links) assert.deepEqual(l, { popup: 'true', exp: 'false' });
  const link = page.locator('.hdr__item > .hdr__link').first();
  const panel = page.locator('.hdr__item').first().locator('.hdr__panel');
  const shown = () => panel.evaluate((p) => getComputedStyle(p).visibility === 'visible' && getComputedStyle(p).opacity === '1');
  await link.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
  await page.waitForFunction(() => document.querySelector('.hdr__item > .hdr__link').getAttribute('aria-expanded') === 'true');
  await page.waitForFunction((s) => { const p = document.querySelector('.hdr__panel'); return getComputedStyle(p).opacity === '1'; });
  assert.equal(await shown(), true);
  await page.keyboard.press('Tab'); // into the panel
  assert.equal(await page.evaluate(() => !!document.activeElement.closest('.hdr__panel')), true);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => { const p = document.querySelector('.hdr__panel'); return getComputedStyle(p).visibility === 'hidden'; });
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('.hdr__item > .hdr__link')), true, 'focus returns to the top-level link');
  assert.equal(await link.getAttribute('aria-expanded'), 'false');
});

test('page_teacher_play_buttons_have_unique_names', async () => {
  const { page } = await open(1440);
  const names = await page.$$eval('.teachers__play', (bs) => bs.map((b) => ({ name: (b.getAttribute('aria-label') || b.textContent).replace(/\s+/g, ' ').trim(),
    card: b.closest('[data-slide-index]').querySelector('h3').textContent.trim(), clone: b.closest('[data-clone]') !== null })));
  const real = names.filter((n) => !n.clone);
  assert.equal(real.length, 7);
  for (const n of real) {
    assert.match(n.name, /^Play Full Video/);
    assert.ok(n.name.includes(n.card), `"${n.name}" includes ${n.card}`);
  }
  assert.equal(new Set(real.map((n) => n.name)).size, 7, 'seven distinct names');
});

// ---- Fix round 1: regression tests for the geometry fixed in Task 11 ----------------------------------------------
// Numbers measured live on the reference site (slick slide boxes / section roots); docs/reference/ssa-*.json holds only 1440, 768
// and 375 and only the first slide, so there is no ref JSON for the side cards, nor for 800 / 999 / 799.
//   >= 800 px: card 410 x 560, side cards 410 x 380 (90 px trimmed top and bottom), card pitch 440 (gap 30)
//   <  800 px: card 313 x 420, side cards 313 x 330 (45 px trimmed top and bottom), card pitch 323 (gap 10)
const CARD = { big: { w: 410, h: 560, side: 380, trim: 90, pitch: 440 }, small: { w: 313, h: 420, side: 330, trim: 45, pitch: 323 } };
for (const [width, kind] of [[1440, 'big'], [768, 'small'], [375, 'small'], [800, 'big'], [999, 'big'], [799, 'small']]) {
  test(`teachers_side_cards_geometry @${width}`, async () => {
    const { page } = await open(width);
    const g = await page.evaluate(() => [...document.querySelectorAll('.teachers__slide:not([data-clone])')].slice(0, 3).map((s) => {
      const f = s.querySelector('figure').getBoundingClientRect(), i = s.querySelector('figure img').getBoundingClientRect();
      return { cur: s.classList.contains('is-current'), x: f.x, y: f.y, w: f.width, h: f.height, imgY: i.y, imgH: i.height };
    }));
    const c = CARD[kind], [cur, s1, s2] = g;
    assert.equal(cur.cur, true);
    assert.deepEqual([cur.w, cur.h], [c.w, c.h], 'centre card box');
    for (const s of [s1, s2]) {
      assert.deepEqual([s.w, s.h], [c.w, c.side], 'side card box');
      assert.ok(Math.abs((s.y - cur.y) - c.trim) <= 0.5, `side card starts ${c.trim}px lower (equal trim top and bottom): ${s.y - cur.y}`);
      assert.ok(Math.abs((cur.y + cur.h) - (s.y + s.h) - c.trim) <= 0.5, 'equal trim at the bottom');
      assert.ok(Math.abs(s.imgH - c.side) <= 0.5 && Math.abs(s.imgY - s.y) <= 0.5, 'photo is re-fitted to the shorter box, not clipped');
    }
    assert.ok(Math.abs((s1.x - cur.x) - c.pitch) <= 0.5 && Math.abs((s2.x - s1.x) - c.pitch) <= 0.5, `card pitch ${c.pitch}`);
  });
}

// ---- promises: first-line indent and the gap under the news strip ----------------------------------------------------
// Reference: below 1000 px the statement starts with a 50 px spacer (first word at heading x + 50: 70 vs 20 at 375 and 768);
// gap news -> promises 40 px below 800, 68 px 800-999, 80 px from 1000 (measured live at 600, 790, 800, 810, 900, 990, 1000, 1100...).
for (const width of [768, 375]) {
  test(`promises_first_line_indent_50px @${width}`, async () => {
    const { page } = await open(width);
    const r = await page.evaluate(() => [...document.querySelectorAll('.promise__title')].map((h) => {
      const sp = h.querySelector('.promise__spacer').getBoundingClientRect(), hr = h.getBoundingClientRect();
      const w = document.createTreeWalker(h, NodeFilter.SHOW_TEXT); let n, x = null;
      while ((n = w.nextNode())) { if (n.textContent.trim()) { const r = document.createRange(); r.setStart(n, n.textContent.search(/\S/)); r.setEnd(n, n.textContent.search(/\S/) + 1); x = r.getBoundingClientRect().x - hr.x; break; } }
      return { spacer: sp.width, left: sp.x - hr.x, firstWord: x };
    }));
    assert.equal(r.length, 3);
    for (const x of r) { assert.equal(x.spacer, 50); assert.equal(x.left, 0); assert.ok(x.firstWord >= 50 - 0.5, `first word at ${x.firstWord}`); }
  });
}
test('promises_no_indent_at_desktop', async () => {
  const { page } = await open(1440);
  assert.deepEqual(await page.$$eval('.promise__spacer', (s) => s.map((e) => getComputedStyle(e).display)), ['none', 'none', 'none']);
});
for (const [width, gap] of [[375, 40], [799, 40], [800, 68], [900, 68], [999, 68], [1000, 80]]) {
  test(`promises_gap_under_news @${width}`, async () => {
    const { page } = await open(width);
    const g = await page.evaluate(() => document.querySelector('[data-k="promises-root"]').getBoundingClientRect().top - document.querySelector('[data-k="news-root"]').getBoundingClientRect().bottom);
    assert.ok(Math.abs(g - gap) <= 1, `gap ${g} vs ${gap}`);
  });
}
