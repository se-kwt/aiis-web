import { test, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openPage, measureAiis, compareKey, loadRef, mapColor, stopServer } from './helpers.mjs';
import { loadMap } from '../tools/measure.mjs';
import { normaliseFooter } from './normalise.mjs';

const browsers = [];
const open = async (w, o) => { const r = await openPage(w, o); browsers.push(r.browser); return r; };
// close each test's browser as soon as it ends: idle pages keep animating (spirals) and would load the machine for the whole file
afterEach(async () => { await Promise.all(browsers.splice(0).map((b) => b.close())); });
after(async () => { await stopServer(); });

const map = loadMap();
const KEYS = Object.keys(map).filter((k) => /^(values|closing|footer)-/.test(k));

for (const width of [1440, 768, 375]) {
  test(`values_closing_footer_boxes_match_ref @${width}`, async () => {
    const { page } = await open(width);
    const aiis = normaliseFooter(await measureAiis(page, width), width);
    const ref = normaliseFooter(loadRef(width), width);
    const bad = KEYS.flatMap((k) => compareKey(k, aiis, ref));
    assert.deepEqual(bad, []);
    const missing = KEYS.filter((k) => !(map[k].hiddenAt || []).includes(width) && !aiis.keys[k]);
    assert.deepEqual(missing, []);
  });
}

// ---- copy (spec copy table) ----
const spec = fs.readFileSync(new URL('../docs/superpowers/specs/2026-10-08-aiis-homepage-exact-design.md', import.meta.url), 'utf8');
const cell = (label) => spec.split('\n').find((l) => l.startsWith(`| ${label} |`)).split('|')[3].trim();
const norm = (s) => s.replace(/\s+/g, ' ').trim();

test('values_copy_exact', async () => {
  const { page } = await open(1440);
  const got = await page.evaluate(() => {
    const n = (s) => s.replace(/\s+/g, ' ').trim();
    return {
      labels: [...document.querySelectorAll('[data-k="values-button1"] figcaption')].map((e) => n(e.textContent)),
      words: n(document.querySelector('[data-k="values-heading"]').textContent),
      small: [...document.querySelectorAll('[data-k="values-heading-small1"]')].map((e) => n(e.textContent)),
      photos: [...document.querySelectorAll('[data-k="values-button1-photo"]')].map((f) => ({ tp: f.matches('figure.tp[data-temp-photo]'), src: f.querySelector('img').getAttribute('src') })),
      plus: document.querySelectorAll('[data-k="values-button1-toggle"].plus').length,
    };
  });
  assert.deepEqual(got.labels, cell('Values list').split(' · '));
  assert.equal(got.words, cell('Values big words (Anton)').replace(/ \/ /g, ' '));
  assert.deepEqual(got.small, ['YOUNG', 'SO']);
  assert.equal(got.photos.length, 3);
  for (const p of got.photos) { assert.ok(p.tp); assert.match(p.src, /^https:\/\/resources\.finalsite\.net\/images\//); }
  assert.equal(new Set(got.photos.map((p) => p.src)).size, 3);
  assert.equal(got.plus, 3, 'the values "+" markers reuse the .plus class');
});

test('closing_copy_exact', async () => {
  const { page } = await open(1440);
  const got = await page.evaluate(() => {
    const n = (s) => s.replace(/\s+/g, ' ').trim();
    return {
      small: n(document.querySelector('[data-k="closing-heading-small"]').textContent),
      big: [...document.querySelectorAll('[data-k="closing-heading-big1"]')].map((e) => n(e.textContent)),
      label: n(document.querySelector('[data-k="closing-button-label"] span').textContent),
      links: [...document.querySelectorAll('[data-k="closing-link"]')].map((a) => n(a.textContent)),
    };
  });
  const [small, big] = cell('Closing band (Anton)').split(' / ');
  assert.equal(got.small, small);
  assert.deepEqual(got.big, big.split(' '));
  assert.equal(got.label, 'Take the Next Step');
  assert.deepEqual(got.links, ['Enquire', 'Book a School Visit', 'Apply']);
  assert.ok(cell('Closing link').includes('Enquire · Book a School Visit · Apply'));
});

test('footer_copy_exact', async () => {
  const { page } = await open(1440);
  const got = await page.evaluate(() => {
    const n = (s) => s.replace(/\s+/g, ' ').trim();
    const f = document.querySelector('[data-k="footer-root"]');
    return {
      links: [...f.querySelectorAll('[data-k="footer-link1"]')].map((a) => n(a.textContent)),
      socials: [...f.querySelectorAll('[data-k="footer-social1"]')].map((a) => n(a.textContent)),
      socialIcons: [...f.querySelectorAll('[data-k="footer-social1"] svg')].map((s) => ({ fill: s.getAttribute('fill'), stroke: !!(s.getAttribute('stroke') || getComputedStyle(s).stroke !== 'none') })),
      legal: n(f.querySelector('[data-k="footer-legal"]').textContent),
      campuses: f.querySelectorAll('[data-k="footer-campus1"]').length,
      campusName: n(f.querySelector('[data-k="footer-campus1-name"]').textContent),
      address: n(f.querySelector('[data-k="footer-campus1-address"]').textContent),
      contact: n(f.querySelector('[data-k="footer-campus1"]').textContent),
      logo: f.querySelector('[data-k="footer-logo-img"]').getAttribute('src'),
    };
  });
  const row = cell('Footer');
  for (const t of got.socials) assert.ok(row.includes(t), `${t} is in the spec footer row`);
  // the footer link row now follows the school's sitemap (owner-approved change), not the spec's original row
  assert.deepEqual(got.links, JSON.parse(fs.readFileSync('content/site.json', 'utf8')).footer.map((l) => l.label));
  assert.deepEqual(got.socials, ['Instagram', 'Facebook', 'YouTube', 'LinkedIn']);
  for (const i of got.socialIcons) { assert.equal(i.fill, 'none', 'outline icons'); assert.ok(i.stroke); }
  assert.match(got.legal, /Part of the Stellar group of schools\./);
  assert.equal(got.campuses, 1, 'one AIIS campus block');
  assert.match(got.address, /Abbasiya, Kuwait/);
  assert.match(got.contact, /\+965/);
  assert.match(got.contact, /@/);
  assert.match(got.logo, /logos\/crest-web\.png$/);
});

test('closing_and_footer_colours', async () => {
  const { page } = await open(1440);
  const got = await page.evaluate(() => ({
    band: getComputedStyle(document.querySelector('[data-k="closing-root"]'), '::before').backgroundColor,
    footer: getComputedStyle(document.querySelector('[data-k="footer-root"]')).backgroundColor,
    line: getComputedStyle(document.querySelector('[data-k="closing-button"]')).borderBottomColor,
  }));
  assert.equal(got.band, 'rgb(26, 25, 71)', 'closing band is Navy 800');
  assert.equal(got.footer, mapColor('rgb(242, 243, 238)'), "Shady Side's footer is the off-white (measured), mapped to Neutral 50");
  assert.equal(got.line, 'rgb(255, 255, 255)');
});

// ---- behaviour: sticky column + curtain (docs/reference/ssa-animations.md items 9 and 10) ----
const geom = (page) => page.evaluate(() => {
  const v = document.querySelector('[data-k="values-root"]'), c = document.querySelector('[data-k="closing-root"]');
  const top = (e) => e.getBoundingClientRect().top + scrollY;
  return { vTop: top(v), vH: v.offsetHeight, cTop: top(c), cH: c.offsetHeight, vh: innerHeight };
});
const scrollAt = async (page, y) => { await page.evaluate((v) => window.scrollTo(0, v), y); };
const isFixed = (page) => page.evaluate(() => getComputedStyle(document.querySelector('[data-k="values-root"]')).position === 'fixed');
const rects = (page) => page.evaluate(() => {
  const r = (k) => document.querySelector(`[data-k="${k}"]`).getBoundingClientRect();
  return { v: r('values-root'), c: r('closing-root'), h: r('values-heading'), b: r('values-button1') };
});

test('values_pinned_under_closing_curtain @1440', async () => {
  const { page } = await open(1440);
  const g = await geom(page);
  // inventory item 10: panel 2000 px, closing panel 1244 px, pin start "bottom bottom", end "+=" closing height
  assert.equal(g.vH, 2000);
  assert.equal(g.cH, 1244);
  const start = g.vTop + g.vH - g.vh, end = start + g.cH;
  // (Shady Side: pin from scrollY 8445.6 to 9689.6, i.e. valuesBottom - 900 .. +1244; AIIS's page offset differs by the earlier sections' height)
  assert.equal(end - start, 1244);

  await scrollAt(page, start - 300);
  assert.equal(await isFixed(page), false, 'not pinned before the start');
  const before = await rects(page);
  assert.ok(Math.abs(before.v.bottom - (g.vh + 300)) <= 1);

  for (const y of [start + 20, start + g.cH / 2, end - 20]) {
    await scrollAt(page, y);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-k="values-root"]')).position === 'fixed');
    const r = await rects(page);
    // pinned: values bottom stays on the viewport bottom ...
    assert.ok(Math.abs(r.v.bottom - g.vh) <= 1, `values bottom ${r.v.bottom} at scroll ${y}`);
    // ... while the closing band scrolls up over it (its top follows the page)
    assert.ok(Math.abs(r.c.top - (g.cTop - y)) <= 1, `closing top ${r.c.top} vs ${g.cTop - y}`);
  }
  // stacking: where the closing band is on screen it is what you see, not the pinned values panel
  await scrollAt(page, start + g.cH / 2);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-k="values-root"]')).position === 'fixed');
  const hit = await page.evaluate(() => {
    const c = document.querySelector('[data-k="closing-root"]').getBoundingClientRect();
    const y = Math.max(c.top + 20, 5), el = document.elementFromPoint(700, y);
    return { inClosing: !!el.closest('[data-k="closing-root"]'), inValues: !!el.closest('[data-k="values-root"]'), cTop: c.top };
  });
  assert.ok(hit.cTop < 400, 'closing band has risen into view');
  assert.equal(hit.inClosing, true);
  assert.equal(hit.inValues, false);
  // covers progressively: the closing band is higher on screen the further we scroll
  await scrollAt(page, end - 20);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-k="values-root"]')).position === 'fixed');
  assert.ok((await rects(page)).c.top < hit.cTop);
  // released again after the end
  await scrollAt(page, end + 80);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-k="values-root"]')).position !== 'fixed');
});

test('values_big_words_stay_in_place_and_colour_while_the_buttons_scroll @1440', async () => {
  const { page } = await open(1440);
  const g = await geom(page);
  const colours = () => page.evaluate(() => [...document.querySelectorAll('[data-k="values-heading"] .word, [data-k="values-heading"]')].map((e) => getComputedStyle(e).color));
  await scrollAt(page, g.vTop + 300);
  const a = await rects(page), ca = await colours();
  await scrollAt(page, g.vTop + 900);
  const b = await rects(page), cb = await colours();
  assert.ok(Math.abs(a.h.top - b.h.top) <= 1, 'sticky column: the words hold their place');
  assert.ok(Math.abs((a.b.top - b.b.top) - 600) <= 1, 'the photo buttons scroll past');
  assert.deepEqual(ca, cb, 'the words do not change colour on scroll');
  assert.ok(ca.every((c) => c === mapColor('rgb(4, 30, 66)')));
});

test('values_resize_1440_to_768_not_stuck', async () => {
  const { page } = await open(1440);
  const g = await geom(page);
  const mid = g.vTop + g.vH - g.vh + g.cH / 2;
  await scrollAt(page, mid);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-k="values-root"]')).position === 'fixed');
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-k="values-root"]')).position !== 'fixed');
  await page.waitForTimeout(300);
  const stuck = await page.evaluate(() => {
    const out = [];
    for (const e of document.querySelectorAll('[data-section="values"], [data-section="values"] *, [data-section="closing"], [data-section="closing"] *')) {
      const cs = getComputedStyle(e);
      if (cs.position === 'fixed' || cs.position === 'sticky') out.push(`${e.dataset.k || e.className}: ${cs.position}`);
    }
    const spacers = document.querySelectorAll('.pin-spacer').length;
    const v = document.querySelector('[data-k="values-root"]');
    return { out, spacers, style: v.getAttribute('style') || '', top: v.getBoundingClientRect().top + scrollY, parentTop: v.parentElement.getBoundingClientRect().top + scrollY };
  });
  assert.deepEqual(stuck.out, [], 'no fixed/sticky leftovers at 768');
  assert.equal(stuck.spacers, 0, 'no pin spacers left');
  assert.doesNotMatch(stuck.style, /fixed|transform|translate/);
  // the section sits in the normal flow: nothing is stuck to an old offset (heading is above the buttons when stacked)
  const r = await rects(page);
  assert.ok(r.h.bottom <= r.b.top + 1, 'stacked layout at 768: words above the photo buttons');
});

test('values_resize_768_to_1440_pins_correctly_and_nothing_is_stuck', async () => {
  const { page } = await open(768);
  // inside the values section at 768 (stacked, nothing pinned)
  await page.evaluate(() => { const v = document.querySelector('[data-k="values-root"]'); window.scrollTo(0, v.getBoundingClientRect().top + scrollY + 200); });
  assert.equal(await isFixed(page), false, 'not pinned at 768');
  await page.setViewportSize({ width: 1440, height: 900 });
  // the matchMedia context rebuilds the pin: wait for its state (a pin spacer-less fixed/relative layout with the trigger set up), not for time
  await page.waitForFunction(() => document.querySelector('[data-section="values"]').hasAttribute('data-fx'));
  // wait for the layout to settle after the breakpoint change (lazy photos re-fit): page height unchanged over four samples, then re-measure the pin
  await page.evaluate(async () => { let last = -1, same = 0; while (same < 4) { await new Promise((r) => setTimeout(r, 100)); const h = document.documentElement.scrollHeight; same = h === last ? same + 1 : 0; last = h; } window.ScrollTrigger.refresh(); });
  const g = await geom(page);
  assert.equal(g.vh, 900);
  const start = g.vTop + g.vH - g.vh, end = start + g.cH;
  await scrollAt(page, start - 300);
  assert.equal(await isFixed(page), false, 'not pinned before the start');
  for (const y of [start + 20, start + g.cH / 2, end - 20]) {
    await scrollAt(page, y);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-k="values-root"]')).position === 'fixed');
    const r = await rects(page);
    assert.ok(Math.abs(r.v.bottom - g.vh) <= 1, `values bottom ${r.v.bottom} at scroll ${y}`);
    assert.ok(Math.abs(r.c.top - (g.cTop - y)) <= 1, `closing top ${r.c.top} vs ${g.cTop - y}`);
  }
  await scrollAt(page, end + 80);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-k="values-root"]')).position !== 'fixed');
  // nothing stuck once released: no fixed/sticky leftovers outside the pinned range, and the pin is released
  await scrollAt(page, 0);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-k="values-root"]')).position !== 'fixed');
  const left = await page.evaluate(() => [...document.querySelectorAll('[data-section="closing"], [data-section="closing"] *')]
    .filter((e) => ['fixed', 'sticky'].includes(getComputedStyle(e).position)).map((e) => e.dataset.k || e.className));
  assert.deepEqual(left, [], 'nothing stuck in the closing band');
});

test('values_reduced_motion_is_static_and_stacked @1440', async () => {
  const { page } = await open(1440, { reducedMotion: true });
  const g = await geom(page);
  const mid = g.vTop + g.vH - g.vh + g.cH / 2;
  await scrollAt(page, mid);
  await page.waitForTimeout(300);
  const got = await page.evaluate(() => ({
    fixed: getComputedStyle(document.querySelector('[data-k="values-root"]')).position,
    spacers: document.querySelectorAll('.pin-spacer').length,
    col: getComputedStyle(document.querySelector('.values__col--words')).position,
    spiral: getComputedStyle(document.querySelector('.values-spiral__in')).transform,
  }));
  assert.notEqual(got.fixed, 'fixed');
  assert.equal(got.spacers, 0);
  assert.equal(got.col, 'static', 'no sticky column without motion');
  assert.ok(got.spiral === 'none' || got.spiral === 'matrix(1, 0, 0, 1, 0, 0)', 'spiral shown at full size');
  const r = await rects(page);
  assert.ok(r.h.bottom <= r.b.top + 1, 'stacked: words above the photo buttons');
});

test('footer_social_icon_pitch_matches_ssa @1440', async () => {
  const { page } = await open(1440);
  const xs = await page.evaluate(() => [...document.querySelectorAll('[data-k="footer-social1"]')].map((a) => a.getBoundingClientRect()).map((r) => [r.x, r.width]));
  assert.equal(xs.length, 4);
  for (let i = 1; i < 4; i++) assert.equal(xs[i][0] - xs[i - 1][0], 50, 'pitch = 40 px icon + 10 px gap, as on Shady Side');
});
