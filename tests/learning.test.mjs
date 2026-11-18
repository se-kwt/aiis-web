import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { openPage, measureAiis, compareKey, loadRef, mapColor, hlInfo, rgbs, startServer, stopServer } from './helpers.mjs';
import { loadMap } from '../tools/measure.mjs';
import { normaliseLearning as normalise, ssaLearningBlocks, aiisLearningBlocks as aiisBlocks } from './normalise.mjs';

const browsers = [];
const open = async (w, o) => { const r = await openPage(w, o); browsers.push(r.browser); return r; };
after(async () => { await Promise.all(browsers.map((b) => b.close())); await stopServer(); });

const map = loadMap();
const learningKeys = Object.keys(map).filter((k) => k.startsWith('learning-'));

for (const width of [1440, 768, 375]) {
  test(`learning_boxes_match_ref @${width}`, async () => {
    const { page } = await open(width);
    const blocks = await aiisBlocks(page);
    assert.equal(blocks.length, 3);
    const aiis = normalise(await measureAiis(page, width), width, blocks);
    const refRaw = loadRef(width);
    const ref = normalise(refRaw, width, ssaLearningBlocks(width));
    const bad = learningKeys.flatMap((k) => compareKey(k, aiis, ref));
    // copy-independent replacement for the waived y of the column text: the gap between the title's bottom and the text's top
    const gap = (m) => m.keys['learning-col1-text'].rel.y - m.keys['learning-col1-title'].rel.y - m.keys['learning-col1-title'].box.h;
    if (!bad.length && Math.abs(gap(aiis) - gap(ref)) > 4) bad.push(`learning-col1-text: gap below its title ${gap(aiis)} vs ${gap(ref)}`);
    assert.deepEqual(bad, []);
    const missing = learningKeys.filter((k) => !(map[k].hiddenAt || []).includes(width) && !aiis.keys[k]);
    assert.deepEqual(missing, []);
  });
}

// Copy table rows "Learning statement", "Learning heading", "Column 1/2/3" from the spec (bold = Sky highlight).
const spec = fs.readFileSync(new URL('../docs/superpowers/specs/2026-10-08-aiis-homepage-exact-design.md', import.meta.url), 'utf8');
const cell = (label) => spec.split('\n').find((l) => l.startsWith(`| ${label} |`)).split('|')[3].trim();
const statement = cell('Learning statement (Fraunces)');
const heading = cell('Learning heading (Anton)').split(' / ').join(' ');
const columns = [1, 2, 3].map((n) => {
  const [title, text] = cell(`Column ${n}`).split(' — ');
  return { title, text: text.replace(/^"|"$/g, '') };
});

test('learning_copy_exact', async () => {
  const { page } = await open(1440);
  const got = await page.evaluate(() => {
    const norm = (s) => s.replace(/\s+/g, ' ').trim();
    return {
      statement: norm(document.querySelector('[data-k="learning-heading"]').textContent),
      marks: [...document.querySelectorAll('[data-k="learning-highlight1"]')].map((e) => norm(e.textContent)),
      heading: norm(document.querySelector('[data-k="learning-title-text"]').textContent),
      cols: [...document.querySelectorAll('.learning__col')].map((c) => ({
        title: norm(c.querySelector('h2').textContent),
        text: norm(c.querySelector('p').textContent),
        lead: norm(c.querySelector('p .lead-in')?.textContent ?? ''),
      })),
    };
  });
  assert.equal(got.statement, statement.replace(/\*\*/g, ''));
  assert.deepEqual(got.marks, [...statement.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1]));
  assert.equal(got.heading, heading);
  assert.equal(got.cols.length, 3);
  columns.forEach((c, i) => {
    assert.equal(got.cols[i].title, c.title, `title ${i + 1}`);
    assert.equal(got.cols[i].text, c.text, `text ${i + 1}`);
    // the caps lead-in is the part of the copy up to the em dash
    assert.equal(got.cols[i].lead, c.text.match(/^[A-Z][A-Z ,]*[A-Z]/)[0], `lead-in ${i + 1}`);
  });
});

test('learning_icons_are_the_three_ssa_images_in_temp_photo_figures', async () => {
  const { page } = await open(1440);
  const got = await page.evaluate(() => [...document.querySelectorAll('[data-k="learning-col1-icon"]')].map((f) => ({
    tp: f.matches('figure.tp[data-temp-photo]'), src: f.querySelector('img').getAttribute('src'),
  })));
  assert.deepEqual(got, [
    { tp: true, src: 'https://resources.finalsite.net/images/f_auto,q_auto/v1732055756/shadyside/ecgnpdae8tiklcvdf8lf/Image_4.jpg' },
    { tp: true, src: 'https://resources.finalsite.net/images/f_auto,q_auto/v1732055628/shadyside/p1o0imjhuvbwuk0snki9/Image_3.jpg' },
    { tp: true, src: 'https://resources.finalsite.net/images/f_auto,q_auto/v1741966321/shadyside/ibsyi2zyz6spff5l7kv3/Notebook1.png' },
  ]);
});

// The "lesson" marker reuses the promise implementation (.hl + animate-text): same shape as SSA's rule (see promises.test.mjs).
const SKY = mapColor('rgb(17, 254, 238)');
test('learning_highlight_marker_matches_ref', async () => {
  for (const [w, o] of [[1440, { reducedMotion: true }], [375, {}], [1440, {}]]) {
    const { page } = await open(w, o);
    const infos = await hlInfo(page, '.learning');
    assert.equal(infos.length, 1);
    for (const m of infos) {
      assert.equal(m.size, '200% 40%');
      assert.equal(m.pos, '-100% 100%');
      assert.equal(m.rep, 'repeat-x');
      assert.ok(rgbs(m.img).includes(SKY), `gradient colour ${m.img}`);
      assert.match(m.img, /linear-gradient\(to right/);
      assert.equal(m.color, mapColor('rgb(4, 30, 66)'), 'text stays Navy');
    }
  }
});

test('learning_highlight_marker_bottom_matches_ref_offset', async () => {
  for (const width of [1440, 375]) {
    const ref = loadRef(width).keys;
    const hd = ref['learning-heading'], hl = ref['learning-highlight1'];
    const lh = parseFloat(hd.style.lineHeight);
    const refBottom = hl.box.y + hl.box.h - hd.box.y;
    const offset = refBottom - Math.round(refBottom / lh) * lh;
    const { page } = await open(width, { reducedMotion: true });
    for (const m of await hlInfo(page, '.learning')) {
      const l = Math.round(m.bottom / m.lh);
      assert.ok(Math.abs(m.bottom - (l * m.lh + offset)) <= 2, `marker bottom ${m.bottom} vs line ${l} + ${offset.toFixed(1)}`);
      assert.ok(Math.abs(m.h - hl.box.h) <= 4, `marker box height ${m.h} vs ${hl.box.h}`);
    }
  }
});

test('learning_title_words_fit_the_ssa_box', async () => {
  const { page } = await open(1440);
  const g = await page.evaluate(() => {
    const h = document.querySelector('[data-k="learning-title-text"]'), hb = h.getBoundingClientRect(), cs = getComputedStyle(h);
    return { w: hb.width, fs: cs.fontSize, lh: cs.lineHeight, pad: [cs.paddingLeft, cs.paddingRight],
      words: [...h.querySelectorAll(':scope > .word')].map((e) => { const b = e.getBoundingClientRect(); return [b.left - hb.left, hb.right - b.right]; }) };
  });
  assert.equal(g.w, 490);
  assert.deepEqual([g.fs, g.lh], ['120px', '144px']);
  for (const [l, r] of g.words) assert.ok(l >= 20 - 0.5 && r >= 20 - 0.5, `word inside 20px padding: ${l}, ${r}`);
});

test('learning_title_is_white_panel_with_inverse_corners', async () => {
  const { page } = await open(1440);
  const got = await page.evaluate(() => {
    const h = document.querySelector('[data-k="learning-title-text"]');
    const b = getComputedStyle(h, '::before'), a = getComputedStyle(h, '::after');
    return { bg: getComputedStyle(h).backgroundColor, ba: [b.content, a.content], bImg: b.backgroundImage !== 'none', aImg: a.backgroundImage !== 'none' };
  });
  assert.equal(got.bg, 'rgb(255, 255, 255)');
  assert.deepEqual(got.ba, ['""', '""']);
  assert.ok(got.bImg && got.aImg, 'inverse-corner fillers present');
});

// ---- generic reveals (inventory item 11: AOS fade-up, offset 200, duration 1000, delay per element, easing ease, once) ----
async function freshPage(width, { reducedMotion = false } = {}) {
  const port = await startServer();
  const browser = await chromium.launch();
  browsers.push(browser);
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { sessionStorage.setItem('aiis-intro-seen', '1'); } catch {} });
  await page.goto(`http://127.0.0.1:${port}/?nointro`, { waitUntil: 'load' });
  await page.waitForSelector('body[data-ready-reveals]');
  return page;
}
const state = (page, sel) => page.evaluate((s) => {
  const e = document.querySelector(s), cs = getComputedStyle(e);
  return { opacity: parseFloat(cs.opacity), ty: new DOMMatrix(cs.transform).f, pending: e.hasAttribute('data-reveal-pending'), done: e.hasAttribute('data-revealed') };
}, sel);
// scroll so the element's layout top sits `fromBottom` px above the viewport bottom
const scrollTopTo = (page, sel, fromBottom) => page.evaluate(([s, fb]) => {
  const e = document.querySelector(s);
  const t = e.getBoundingClientRect().top + scrollY - (e.hasAttribute('data-reveal-pending') ? 100 : 0);
  window.scrollTo(0, t - (innerHeight - fb));
}, [sel, fromBottom]);

test('reveal_once', async () => {
  const page = await freshPage(1440);
  const sel = '.learning__colwrap:nth-child(1)';
  const s0 = await state(page, sel);
  assert.ok(s0.pending && s0.opacity === 0 && Math.abs(s0.ty - 100) < 0.5, `hidden below the fold: ${JSON.stringify(s0)}`);
  // 150 px short of the AOS offset (element top is 50 px above the 200 px line): still pending
  await scrollTopTo(page, sel, 150);
  await page.waitForTimeout(300);
  assert.ok((await state(page, sel)).pending, 'not revealed before its top reaches 200 px from the viewport bottom');
  // past the offset: reveals (delay 50 ms + 1 s)
  await scrollTopTo(page, sel, 260);
  await page.waitForTimeout(1500);
  const s1 = await state(page, sel);
  assert.ok(s1.done && !s1.pending && s1.opacity === 1 && Math.abs(s1.ty) < 0.5, `revealed: ${JSON.stringify(s1)}`);
  // scrolling away and back does not hide it again
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  const s2 = await state(page, sel);
  assert.ok(s2.done && s2.opacity === 1 && Math.abs(s2.ty) < 0.5, `stays revealed: ${JSON.stringify(s2)}`);
});

test('reveal_matches_aos_timing', async () => {
  const page = await freshPage(1440);
  const cols = '.learning__colwrap';
  const delays = await page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => {
    const cs = getComputedStyle(e);
    return { d: cs.transitionDuration, delay: cs.transitionDelay, prop: cs.transitionProperty, fn: cs.transitionTimingFunction, attr: e.dataset.revealDelay };
  }), cols);
  assert.deepEqual(delays.map((d) => d.attr), ['50', '400', '750']);
  for (const d of delays) { assert.equal(d.d, '1s, 1s'); assert.equal(d.fn, 'ease, ease'); assert.match(d.prop, /opacity.*transform|transform.*opacity/); }
  assert.deepEqual(delays.map((d) => d.delay), ['0.05s, 0.05s', '0.4s, 0.4s', '0.75s, 0.75s']);
});

test('reveal_off_below_1000_and_under_reduced_motion', async () => {
  for (const [w, o] of [[768, {}], [1440, { reducedMotion: true }]]) {
    const page = await freshPage(w, o);
    const s = await state(page, '.learning__colwrap:nth-child(1)');
    assert.ok(!s.pending && s.opacity === 1 && Math.abs(s.ty) < 0.5, `${w} ${JSON.stringify(o)}: ${JSON.stringify(s)}`);
  }
});

test('reveal_visible_without_js', async () => {
  const port = await startServer();
  const browser = await chromium.launch();
  browsers.push(browser);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/?nointro`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const s = await state(page, '.learning__colwrap:nth-child(1)');
  assert.ok(s.opacity === 1 && Math.abs(s.ty) < 0.5, JSON.stringify(s));
});

// ---- learning.js: video control and scroll play/pause (headless Chromium cannot decode the hotlinked video, so play/pause are stubbed) ----
async function videoPage(width, { reducedMotion = false } = {}) {
  const port = await startServer();
  const browser = await chromium.launch();
  browsers.push(browser);
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { sessionStorage.setItem('aiis-intro-seen', '1'); } catch {}
    window.__calls = [];
    const P = HTMLMediaElement.prototype;
    Object.defineProperty(P, 'paused', { configurable: true, get() { return !this.__playing; } });
    P.play = function () { window.__calls.push('play'); this.__playing = true; this.dispatchEvent(new Event('play')); return Promise.resolve(); };
    P.pause = function () { window.__calls.push('pause'); this.__playing = false; this.dispatchEvent(new Event('pause')); };
  });
  await page.goto(`http://127.0.0.1:${port}/?nointro`, { waitUntil: 'load' });
  await page.waitForSelector('[data-section="learning"][data-ready="true"]');
  await page.waitForFunction(() => window.ScrollTrigger);
  return page;
}
const calls = (page) => page.evaluate(() => window.__calls.slice());
const ctl = (page) => page.evaluate(() => {
  const b = document.querySelector('[data-learning-toggle]');
  return { pressed: b.getAttribute('aria-pressed'), label: b.querySelector('.sr').textContent };
});
// scroll so the video frame's top sits `y` px below the viewport top
const frameTopAt = (page, y) => page.evaluate((t) => {
  const f = document.querySelector('[data-k="learning-video-frame"]');
  window.scrollTo(0, f.getBoundingClientRect().top + scrollY - t);
}, y);

test('learning_video_toggle_pauses_and_plays', async () => {
  const page = await videoPage(1440);
  await frameTopAt(page, 300); // inside the section, frame top above 80% of the viewport: playing
  await page.waitForTimeout(300);
  assert.deepEqual(await ctl(page), { pressed: 'false', label: 'Pause video' });
  await page.click('[data-learning-toggle]');
  assert.deepEqual(await ctl(page), { pressed: 'true', label: 'Pause video' });
  assert.equal((await calls(page)).at(-1), 'pause');
  // a user pause survives scrolling away and back (the scroll trigger must not restart it)
  await page.evaluate(() => window.scrollTo(0, 0));
  await frameTopAt(page, 300);
  await page.waitForTimeout(300);
  assert.equal((await calls(page)).at(-1), 'pause');
  await page.click('[data-learning-toggle]');
  assert.deepEqual(await ctl(page), { pressed: 'false', label: 'Pause video' });
  assert.equal((await calls(page)).at(-1), 'play');
});

test('learning_video_plays_when_top_reaches_80_percent_and_pauses_on_leave', async () => {
  const page = await videoPage(1440);
  const vh = 900;
  // the later sections are still empty, so give the page room to scroll the frame fully out of view
  await page.evaluate(() => { document.body.style.paddingBottom = '3000px'; window.ScrollTrigger.refresh(); });
  await frameTopAt(page, vh * 0.8 + 60); // frame top still below the 80% line
  await page.waitForTimeout(300);
  assert.ok(!(await calls(page)).includes('play'), 'not playing before top reaches 80%');
  await frameTopAt(page, vh * 0.8 - 60); // crossed it
  await page.waitForTimeout(300);
  assert.equal((await calls(page)).at(-1), 'play', 'onEnter plays');
  await frameTopAt(page, -525 - 100); // frame fully above the viewport: leave
  await page.waitForTimeout(300);
  assert.equal((await calls(page)).at(-1), 'pause', 'onLeave pauses');
  await frameTopAt(page, 200); // back in view: enter back
  await page.waitForTimeout(300);
  assert.equal((await calls(page)).at(-1), 'play', 'onEnterBack plays');
  await page.evaluate(() => window.scrollTo(0, 0)); // above the start: leave back
  await page.waitForTimeout(300);
  assert.equal((await calls(page)).at(-1), 'pause', 'onLeaveBack pauses');
});

test('learning_video_stays_paused_under_reduced_motion', async () => {
  const page = await videoPage(1440, { reducedMotion: true });
  await frameTopAt(page, 300);
  await page.waitForTimeout(500);
  assert.ok(!(await calls(page)).includes('play'), 'scroll does not start the video');
  assert.deepEqual(await ctl(page), { pressed: 'true', label: 'Pause video' });
  await page.click('[data-learning-toggle]'); // an explicit user action may still play it
  assert.equal((await calls(page)).at(-1), 'play');
});
