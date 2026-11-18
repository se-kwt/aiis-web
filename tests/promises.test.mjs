import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openPage, measureAiis, compareKey, loadRef, mapColor, stopServer, hlInfo as hlInfoAt, rgbs } from './helpers.mjs';
import { loadMap } from '../tools/measure.mjs';
import { normalisePromises as normalise } from './normalise.mjs';

const browsers = [];
const open = async (w, o) => { const r = await openPage(w, o); browsers.push(r.browser); return r; };
after(async () => { await Promise.all(browsers.map((b) => b.close())); await stopServer(); });

const map = loadMap();
const promiseKeys = Object.keys(map).filter((k) => /^promise\d-/.test(k) || k === 'promises-root');

for (const width of [1440, 768, 375]) {
  test(`promises_boxes_match_ref @${width}`, async () => {
    const { page } = await open(width);
    const aiis = normalise(await measureAiis(page, width), width);
    const ref = normalise(loadRef(width), width);
    const bad = promiseKeys.flatMap((k) => compareKey(k, aiis, ref));
    assert.deepEqual(bad, []);
    const missing = promiseKeys.filter((k) => !(map[k].hiddenAt || []).includes(width) && !aiis.keys[k]);
    assert.deepEqual(missing, []);
  });
}

// Copy table rows "Promise 1/2/3" from the spec: "<lead-in> / <statement>", bold words are the highlights.
const spec = fs.readFileSync(new URL('../docs/superpowers/specs/2026-10-08-aiis-homepage-exact-design.md', import.meta.url), 'utf8');
const rows = [1, 2, 3].map((n) => {
  const line = spec.split('\n').find((l) => l.startsWith(`| Promise ${n} |`));
  const cell = line.split('|')[3].trim();
  const [lead, statement] = cell.split(' / ');
  return { n, lead, text: statement.replace(/\*\*/g, ''), marks: [...statement.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1]) };
});

test('promises_copy_exact', async () => {
  const { page } = await open(1440);
  const got = await page.evaluate((count) => {
    const norm = (s) => s.replace(/\s+/g, ' ').trim();
    return Array.from({ length: count }, (_, i) => {
      const n = i + 1;
      const q = (k) => document.querySelector(`[data-k="promise${n}-${k}"]`);
      return {
        lead: norm(q('lead').textContent),
        text: norm(q('heading').textContent),
        marks: [...document.querySelectorAll(`[data-k="promise${n}-highlight1"]`)].map((e) => norm(e.textContent)),
      };
    });
  }, rows.length);
  rows.forEach((r, i) => {
    assert.equal(got[i].lead, r.lead, `lead ${r.n}`);
    assert.equal(got[i].text, r.text, `statement ${r.n}`);
    assert.deepEqual(got[i].marks, r.marks, `highlights ${r.n}`);
  });
  assert.deepEqual(got.flatMap((g) => g.marks), ['discover', 'become', 'belong', 'character', 'confidence']);
});

// Inventory item 5: cut-out article yPercent +20 -> -20 over the trigger's "top bottom" .. "bottom top" (default ease power1.out),
// measured with the article at its progress-0 position (natural top + 20% of its height).
const power1Out = (p) => 1 - (1 - p) * (1 - p);
const ty = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s).closest('[data-parallax]');
  return new DOMMatrix(getComputedStyle(el).transform).f;
}, sel);

test('parallax_moves_on_scroll', async () => {
  const { page } = await open(1440);
  const sel = '[data-k="promise1-figure"]';
  const g = await page.evaluate((s) => {
    const el = document.querySelector(s).closest('[data-parallax]');
    const r = el.getBoundingClientRect();
    return { top: r.top + scrollY, h: r.height, vh: innerHeight };
  }, sel);
  assert.ok(Math.abs((await ty(page, sel)) - 0.2 * g.h) <= 2, 'starts at +20% (progress 0)');
  const start = g.top - g.vh; // trigger "top bottom" with the article displaced by +20%
  const checks = [400, 900, g.h + g.vh + 200]; // scrolled 400 px / 900 px into the trigger, and past its end
  for (const d of checks) {
    await page.evaluate((y) => window.scrollTo(0, y), start + d);
    await page.waitForTimeout(150);
    const p = Math.min(Math.max(d / (g.h + g.vh), 0), 1);
    const want = g.h * (0.2 - 0.4 * power1Out(p));
    const got = await ty(page, sel);
    assert.ok(Math.abs(got - want) <= 2, `scrolled ${d}px into the trigger: translateY ${got} vs ${want.toFixed(1)}`);
  }
  assert.ok(Math.abs((await ty(page, sel)) + 0.2 * g.h) <= 2, 'ends at -20%');
});

test('parallax_inset_photo_scales_and_shifts', async () => {
  const { page } = await open(1440);
  const sel = '[data-k="promise1-photo"] img';
  const m = (async () => page.evaluate((s) => new DOMMatrix(getComputedStyle(document.querySelector(s)).transform), sel));
  const w = await page.evaluate(() => {
    const r = document.querySelector('[data-k="promise1-photo"]').closest('.promise__inset').getBoundingClientRect();
    return { top: r.top + scrollY, h: r.height, vh: innerHeight };
  });
  assert.equal((await m()).a, 1.3, 'scale 1.3');
  await page.evaluate((y) => window.scrollTo(0, y), w.top - w.vh + 0.5 * (w.h + w.vh));
  await page.waitForTimeout(1300); // 1 s transition
  assert.ok(Math.abs((await m()).f) <= 3, 'centred when the row is mid-viewport');
  await page.evaluate((y) => window.scrollTo(0, y), w.top - w.vh + 0.9 * (w.h + w.vh));
  await page.waitForTimeout(1300);
  const f = (await m()).f;
  assert.ok(Math.abs(f - (48 - 96 * 0.9)) <= 3, `shift ${f} vs ${(48 - 96 * 0.9).toFixed(1)}`);
});

test('parallax_off_reduced_motion', async () => {
  const { page } = await open(1440, { reducedMotion: true });
  const sel = '[data-k="promise1-figure"]';
  const top = await page.evaluate((s) => document.querySelector(s).getBoundingClientRect().top + scrollY, sel);
  for (const y of [0, top - 300, top + 200]) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(1300);
    const t = await page.evaluate(() => ({
      art: getComputedStyle(document.querySelector('[data-parallax]')).transform,
      img: getComputedStyle(document.querySelector('[data-parallax-image]')).transform,
    }));
    assert.deepEqual(t, { art: 'none', img: 'none' });
  }
});

test('parallax_off_below_1000', async () => {
  const { page } = await open(768);
  const t = await page.evaluate(() => ({
    art: getComputedStyle(document.querySelector('[data-parallax]')).transform,
    img: getComputedStyle(document.querySelector('[data-parallax-image]')).transform,
  }));
  assert.deepEqual(t, { art: 'none', img: 'none' });
});

// Highlight marker: SSA's rule is a gradient (transparent 50% / #11FEEE 50%), size 200% 40%, repeat-x, anchored at the bottom;
// position 0 100% (transparent half showing) -> -100% 100% (coloured half, "marked"). #11FEEE maps to Sky via the colour map.
const SKY = mapColor('rgb(17, 254, 238)');
const hlInfo = (page) => hlInfoAt(page, '.promises');
test('highlight_marker_matches_ref_static', async () => {
  // static state: reduced motion at desktop, and the phone layout (marker static there on SSA)
  for (const [w, o] of [[1440, { reducedMotion: true }], [375, {}]]) {
    const { page } = await open(w, o);
    for (const m of await hlInfo(page)) {
      assert.equal(m.size, '200% 40%');
      assert.equal(m.pos, '-100% 100%');
      assert.equal(m.rep, 'repeat-x');
      assert.ok(rgbs(m.img).includes(SKY), `gradient colour ${m.img}`);
      assert.match(m.img, /linear-gradient\(to right/);
      assert.equal(m.color, mapColor('rgb(4, 30, 66)'), 'text stays Navy');
    }
  }
});

test('highlight_marker_animates_to_ref_state', async () => {
  const { page } = await open(1440);
  // the page is settled (all revealed and marked); take one word back to its pre-wipe state, then play the wipe
  const before = await page.evaluate(() => {
    const h = document.querySelector('.promises .hl');
    h.style.transition = 'none';
    h.classList.remove('is-marked');
    const v = getComputedStyle(h).backgroundPosition;
    h.offsetWidth; h.style.transition = '';
    return v;
  });
  assert.match(before, /^0(px|%) 100%$/, 'pre-wipe: transparent half showing');
  await page.evaluate(() => document.querySelector('.promises .hl').classList.add('is-marked'));
  await page.waitForTimeout(700); // 0.5 s wipe
  const infos = await hlInfo(page);
  assert.ok(infos.length === 5);
  for (const m of infos) {
    assert.equal(m.size, '200% 40%');
    assert.equal(m.pos, '-100% 100%');
    assert.ok(rgbs(m.img).includes(SKY));
  }
});

test('highlight_marker_bottom_matches_ref_offset', async () => {
  // SSA: the highlighted box's bottom edge sits at (line bottom + offset); derive the offset from the ref, apply to the AIIS words.
  for (const width of [1440, 375]) {
    const ref = loadRef(width).keys;
    const hd = ref['promise1-heading'], hl = ref['promise1-highlight1'];
    const lh = parseFloat(hd.style.lineHeight);
    const refBottom = hl.box.y + hl.box.h - hd.box.y;
    const line = Math.round(refBottom / lh);
    const offset = refBottom - line * lh; // small positive/negative offset of the box bottom from the line bottom
    const { page } = await open(width, { reducedMotion: true });
    for (const m of await hlInfo(page)) {
      const l = Math.round(m.bottom / m.lh);
      assert.ok(Math.abs(m.bottom - (l * m.lh + offset)) <= 2, `marker bottom ${m.bottom} vs line ${l} + ${offset.toFixed(1)}`);
      assert.ok(Math.abs(m.h - hl.box.h) <= 4, `marker box height ${m.h} vs ${hl.box.h}`);
    }
  }
});
