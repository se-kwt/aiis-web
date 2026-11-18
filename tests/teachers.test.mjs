import { test, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openPage, measureAiis, compareKey, loadRef, mapColor, hlInfo, rgbs, stopServer } from './helpers.mjs';
import { loadMap } from '../tools/measure.mjs';
import { normaliseTeachers as normalise } from './normalise.mjs';

const browsers = [];
const open = async (w, o) => { const r = await openPage(w, o); browsers.push(r.browser); return r; };
// close each test's browser as soon as it ends: idle pages keep animating (marquee, spirals) and would load the machine for the whole file
afterEach(async () => { await Promise.all(browsers.splice(0).map((b) => b.close())); });
after(async () => { await stopServer(); });

const map = loadMap();
const teacherKeys = Object.keys(map).filter((k) => k.startsWith('teachers-'));

for (const width of [1440, 768, 375]) {
  test(`teachers_boxes_match_ref @${width}`, async () => {
    const { page } = await open(width);
    const aiis = normalise(await measureAiis(page, width));
    const ref = normalise(loadRef(width));
    const bad = teacherKeys.flatMap((k) => compareKey(k, aiis, ref));
    assert.deepEqual(bad, []);
    const missing = teacherKeys.filter((k) => !(map[k].hiddenAt || []).includes(width) && !aiis.keys[k]);
    assert.deepEqual(missing, []);
  });
}

// Copy table rows "Teachers statement" and "Teacher cards (7)" (bold = Sky highlight).
const spec = fs.readFileSync(new URL('../docs/superpowers/specs/2026-10-08-aiis-homepage-exact-design.md', import.meta.url), 'utf8');
const cell = (label) => spec.split('\n').find((l) => l.startsWith(`| ${label} |`)).split('|')[3].trim();
const statement = cell('Teachers statement (Fraunces)');
const cards = cell('Teacher cards (7)').replace(/\s*\(placeholder names\)\s*$/, '').split(' · ').map((s) => s.split(' / '));

test('teachers_copy_exact', async () => {
  const { page } = await open(1440);
  const got = await page.evaluate(() => {
    const norm = (s) => s.replace(/\s+/g, ' ').trim();
    return {
      statement: norm(document.querySelector('[data-k="teachers-heading"]').textContent),
      marks: [...document.querySelectorAll('[data-k="teachers-heading-mark"]')].map((e) => norm(e.textContent)),
      cards: [...document.querySelectorAll('[data-k="teachers-slide1"]')].map((s) => [
        norm(s.querySelector('[data-k="teachers-slide1-role"]').textContent),
        norm(s.querySelector('[data-k="teachers-slide1-name"]').textContent),
        norm(s.querySelector('[data-k="teachers-slide1-play"]').textContent),
      ]),
    };
  });
  assert.equal(cards.length, 7);
  assert.equal(got.statement, statement.replace(/\*\*/g, ''));
  assert.deepEqual(got.marks, [...statement.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1]));
  assert.deepEqual(got.cards.map((c) => c.slice(0, 2)), cards.map((c) => c.slice(0, 2)));
  for (const c of got.cards) assert.match(c[2], /^Play Full Video/);
});

test('teachers_photos_are_hotlinked_in_temp_photo_figures_and_icon_is_the_crest', async () => {
  const { page } = await open(1440);
  const got = await page.evaluate(() => ({
    photos: [...document.querySelectorAll('[data-k="teachers-slide1-photo"]')].map((f) => ({ tp: f.matches('figure.tp[data-temp-photo]'), src: f.querySelector('img').getAttribute('src') })),
    icon: document.querySelector('[data-k="teachers-heading-icon"]').getAttribute('src'),
  }));
  assert.equal(got.photos.length, 7);
  for (const p of got.photos) { assert.ok(p.tp); assert.match(p.src, /^https:\/\/resources\.finalsite\.net\/images\//); }
  assert.equal(new Set(got.photos.map((p) => p.src)).size, 7);
  assert.match(got.icon, /logos\/crest-web\.png$/);
});

const SKY = mapColor('rgb(17, 254, 238)');
test('teachers_highlight_marker_matches_ref', async () => {
  for (const [w, o] of [[1440, { reducedMotion: true }], [375, {}], [1440, {}]]) {
    const { page } = await open(w, o);
    const infos = await hlInfo(page, '.teachers');
    assert.equal(infos.length, 1);
    for (const m of infos) {
      assert.equal(m.size, '200% 40%');
      assert.equal(m.pos, '-100% 100%');
      assert.equal(m.rep, 'repeat-x');
      assert.ok(rgbs(m.img).includes(SKY), `gradient colour ${m.img}`);
      assert.equal(m.color, mapColor('rgb(4, 30, 66)'), 'text stays Navy');
    }
  }
});

// ---- carousel ----
const idle = (page) => page.waitForFunction(() => document.querySelector('[data-carousel]').dataset.state === 'idle');
const trackX = (page) => page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('[data-track]')).transform).e);
const paging = (page) => page.evaluate(() => document.querySelector('[data-k="teachers-paging-current"]').textContent.trim());
const slideGeom = (page) => page.evaluate(() => {
  const s = document.querySelectorAll('[data-k="teachers-slide1"]');
  return { w: s[0].getBoundingClientRect().width, pitch: s[1].offsetLeft - s[0].offsetLeft };
});
const carouselPage = async (width, o) => {
  const { page } = await open(width, o);
  await page.evaluate(() => document.querySelector('[data-carousel]').scrollIntoView({ block: 'center' }));
  await idle(page);
  return page;
};

for (const [width, slide, gap] of [[1440, 410, 30], [768, 313, 10], [375, 313, 10]]) {
  test(`carousel_next_prev @${width}`, async () => {
    const page = await carouselPage(width);
    const g = await slideGeom(page);
    assert.equal(g.w, slide);
    assert.equal(g.pitch, slide + gap);
    const x0 = await trackX(page);
    assert.equal(await paging(page), '01');
    await page.click('[data-next]');
    await idle(page);
    assert.equal(await trackX(page), x0 - g.pitch);
    assert.equal(await paging(page), '02');
    await page.click('[data-prev]');
    await idle(page);
    assert.equal(await trackX(page), x0);
    assert.equal(await paging(page), '01');
    // end behaviour (Slick infinite): prev from the first card shows the last, next from the last shows the first
    await page.click('[data-prev]');
    await idle(page);
    assert.equal(await paging(page), '07');
    assert.equal(await trackX(page), x0 - 6 * g.pitch, 'no jump back: the last real card is centred');
    await page.click('[data-next]');
    await idle(page);
    assert.equal(await paging(page), '01');
    assert.equal(await trackX(page), x0);
    // a full lap lands on the same card at the same offset
    for (let i = 0; i < 7; i++) { await page.click('[data-next]'); await idle(page); }
    assert.equal(await paging(page), '01');
    assert.equal(await trackX(page), x0);
  });
}

test('carousel_transition_is_500ms_ease_and_centres_the_current_card', async () => {
  const page = await carouselPage(1440);
  const got = await page.evaluate(() => {
    const t = document.querySelector('[data-track]'), cs = getComputedStyle(t);
    const s = document.querySelectorAll('[data-k="teachers-slide1"]')[0].getBoundingClientRect();
    return { d: cs.transitionDuration, f: cs.transitionTimingFunction, p: cs.transitionProperty, mid: s.left + s.width / 2 };
  });
  assert.equal(got.d, '0.5s');
  assert.equal(got.f, 'ease');
  assert.equal(got.p, 'transform');
  assert.equal(got.mid, 720);
});

test('carousel_reduced_motion_has_no_transition', async () => {
  const page = await carouselPage(1440, { reducedMotion: true });
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('[data-track]')).transitionDuration), '0s');
  const g = await slideGeom(page), x0 = await trackX(page);
  await page.click('[data-next]');
  await idle(page);
  assert.equal(await trackX(page), x0 - g.pitch);
});

test('carousel_keyboard', async () => {
  const page = await carouselPage(1440);
  const g = await slideGeom(page), x0 = await trackX(page);
  const info = await page.evaluate(() => ['[data-prev]', '[data-next]'].map((s) => { const b = document.querySelector(s); return { tag: b.tagName, tab: b.tabIndex, label: b.getAttribute('aria-label') }; }));
  for (const b of info) { assert.equal(b.tag, 'BUTTON'); assert.equal(b.tab, 0); assert.ok(b.label); }
  await page.focus('[data-next]');
  await page.keyboard.press('Enter');
  await idle(page);
  assert.equal(await trackX(page), x0 - g.pitch);
  await page.keyboard.press('Space');
  await idle(page);
  assert.equal(await trackX(page), x0 - 2 * g.pitch);
  assert.equal(await paging(page), '03');
  await page.focus('[data-prev]');
  await page.keyboard.press('Enter');
  await idle(page);
  assert.equal(await paging(page), '02');
  // the position is announced politely
  assert.equal(await page.evaluate(() => document.querySelector('[data-k="teachers-paging"]').closest('[aria-live]')?.getAttribute('aria-live')), 'polite');
});

test('carousel_only_visible_slides_are_tabbable', async () => {
  const page = await carouselPage(1440);
  const state = () => page.evaluate(() => {
    const s = [...document.querySelectorAll('[data-k="teachers-slide1"]')], root = document.querySelector('[data-k="teachers-slider"]').getBoundingClientRect();
    return s.map((e) => { const r = e.getBoundingClientRect(), b = e.querySelector('button'); return { vis: r.right > root.left && r.left < root.right, tab: b.tabIndex, hidden: e.getAttribute('aria-hidden') }; });
  });
  for (const s of await state()) {
    if (s.vis) { assert.equal(s.tab, 0); assert.notEqual(s.hidden, 'true'); } else { assert.equal(s.tab, -1); assert.equal(s.hidden, 'true'); }
  }
  await page.click('[data-next]'); await idle(page);
  await page.click('[data-next]'); await idle(page);
  for (const s of await state()) assert.equal(s.tab === 0, s.vis, JSON.stringify(s));
  // every focusable inside a clone is out of the tab order
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('[data-clone] button')].every((b) => b.tabIndex === -1)), true);
});

test('carousel_drag_and_swipe', async () => {
  const page = await carouselPage(1440);
  const g = await slideGeom(page), x0 = await trackX(page);
  const box = await page.evaluate(() => { const r = document.querySelector('[data-k="teachers-slider"]').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const y = box.y + 200;
  // a short drag (under a fifth of a slide) snaps back
  await page.mouse.move(700, y); await page.mouse.down(); await page.mouse.move(670, y, { steps: 4 }); await page.mouse.up();
  await idle(page);
  assert.equal(await trackX(page), x0);
  assert.equal(await paging(page), '01');
  // drag left past the threshold: next card
  await page.mouse.move(800, y); await page.mouse.down(); await page.mouse.move(600, y, { steps: 6 }); await page.mouse.up();
  await idle(page);
  assert.equal(await paging(page), '02');
  assert.equal(await trackX(page), x0 - g.pitch);
  // drag right: back
  await page.mouse.move(600, y); await page.mouse.down(); await page.mouse.move(800, y, { steps: 6 }); await page.mouse.up();
  await idle(page);
  assert.equal(await paging(page), '01');
  // a drag does not trigger the play button under the pointer
  assert.equal(await page.evaluate(() => !!document.querySelector('dialog.video-modal[open]')), false);
});

test('carousel_touch_swipe', async () => {
  const { page } = await open(375);
  await page.evaluate(() => document.querySelector('[data-carousel]').scrollIntoView({ block: 'center' }));
  await idle(page);
  const cdp = await page.context().newCDPSession(page);
  const y = await page.evaluate(() => document.querySelector('[data-k="teachers-slider"]').getBoundingClientRect().top + 150);
  const touch = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', 300);
  for (let x = 300; x >= 120; x -= 30) await touch('touchMove', x);
  await touch('touchEnd', 120);
  await idle(page);
  assert.equal(await paging(page), '02');
});

test('carousel_clicking_a_side_card_centres_it', async () => {
  const page = await carouselPage(1440);
  const side = await page.evaluate(() => { const r = document.querySelectorAll('[data-k="teachers-slide1"]')[1].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 100 }; });
  await page.mouse.click(side.x, side.y);
  await idle(page);
  assert.equal(await paging(page), '02');
  assert.equal(await page.evaluate(() => !!document.querySelector('dialog.video-modal[open]')), false);
});

test('teachers_play_opens_the_modal_with_that_cards_video', async () => {
  const page = await carouselPage(1440);
  const srcs = await page.evaluate(() => [...document.querySelectorAll('[data-k="teachers-slide1-play"]')].map((b) => b.dataset.videoSrc));
  assert.equal(srcs.length, 7);
  for (const s of srcs) assert.match(s, /^https:\/\/resources\.finalsite\.net\/videos\/.+\.mp4$/);
  assert.equal(new Set(srcs).size, 7);
  await page.click('[data-k="teachers-slide1-play"]');
  await page.waitForSelector('dialog.video-modal[open]');
  assert.equal(await page.evaluate(() => document.querySelector('dialog.video-modal video').getAttribute('src') || document.querySelector('dialog.video-modal video').currentSrc), srcs[0]);
  // the second card
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog.video-modal[open]'));
  await page.click('[data-next]'); await idle(page);
  await page.click('[data-carousel] [data-slide-index="1"]:not([data-clone]) [data-k="teachers-slide1-play"]');
  await page.waitForSelector('dialog.video-modal[open]');
  assert.equal(await page.evaluate(() => document.querySelector('dialog.video-modal video').getAttribute('src')), srcs[1]);
});

test('teachers_no_horizontal_scroll_at_375', async () => {
  const { page } = await open(375);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});
