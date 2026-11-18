import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boxClose, compareKey, mapColor, setColorMap, openPage, measureAiis, stopServer } from './helpers.mjs';

const BASE = { '#041E42': '#041E42' };
setColorMap(BASE);
after(() => { setColorMap(null); return stopServer(); });

const style = (o = {}) => ({ fontFamily: 'Anton, sans-serif', fontSize: '20px', fontWeight: '400', lineHeight: '24px',
  letterSpacing: 'normal', textTransform: 'none', color: 'rgb(4, 30, 66)', backgroundColor: 'rgba(0, 0, 0, 0)',
  borderRadius: '0px', opacity: '1', ...o });
const rec = (o = {}) => ({ section: 's', box: { x: 10, y: 20, w: 100, h: 50 }, rel: { x: 10, y: 20 }, style: style(), src: null, count: 1, ...o });
const meas = (keys, extra = {}) => ({ target: 'x', width: 1440, keys, ...extra });
const MAP = {
  box: { section: 's', ssa: '.a', aiis: '[data-k="box"]' },
  txt: { section: 's', ssa: '.b', aiis: '[data-k="txt"]', text: true },
  cards: { section: 's', ssa: '.c', aiis: '[data-k="cards"]', count: 3 },
  mob: { section: 's', ssa: '.d', aiis: '[data-k="mob"]', hiddenAt: [1440] },
  txtY: { section: 's', ssa: '.g', aiis: '[data-k="txtY"]', text: true, copyAxes: ['y'] },
  right: { section: 's', ssa: '.h', aiis: '[data-k="right"]', copyAxes: ['xr', 'w'] },
  centre: { section: 's', ssa: '.i', aiis: '[data-k="centre"]', copyAxes: ['xc', 'w'] },
  byWidth: { section: 's', ssa: '.j', aiis: '[data-k="byWidth"]', copyAxes: ['x', 'w'], copyAxesByWidth: { 768: ['x', 'w'], 1440: ['w'] } },
  tick: { section: 's', ssa: '.e', aiis: '[data-k="tick"]', marquee: true },
  intro: { section: 'i', ssa: '.f', aiis: '[data-k="intro"]', state: 'intro' },
};
const cmp = (key, a, r) => compareKey(key, meas({ [key]: a }), meas({ [key]: r }), MAP);

test('boxClose tolerance', () => {
  assert.ok(boxClose(10, 14));
  assert.ok(!boxClose(10, 14.5));
  assert.ok(boxClose(10, 15, 5));
});

test('compareKey: text key ignores h but compares rel.y', () => {
  assert.deepEqual(cmp('txt', rec({ box: { x: 10, y: 20, w: 100, h: 200 } }), rec()), []);
  assert.match(cmp('txt', rec({ rel: { x: 10, y: 90 } }), rec())[0], /rel\.y 90 vs 20/);
  assert.deepEqual(cmp('txtY', rec({ rel: { x: 10, y: 90 } }), rec()), [], "copyAxes 'y' waives it");
});

test('compareKey: right-aligned and centred copy keys compare the edge / centre, not x or width', () => {
  assert.deepEqual(cmp('right', rec({ box: { x: 0, y: 20, w: 140, h: 50 }, rel: { x: -30, y: 20 } }), rec()), []); // right edge 110 both
  assert.match(cmp('right', rec({ box: { x: 0, y: 20, w: 140, h: 50 }, rel: { x: -20, y: 20 } }), rec())[0], /right edge 120 vs 110/);
  assert.deepEqual(cmp('centre', rec({ box: { x: 0, y: 20, w: 140, h: 50 }, rel: { x: -10, y: 20 } }), rec()), []); // centre 60 both
  assert.match(cmp('centre', rec({ box: { x: 0, y: 20, w: 140, h: 50 }, rel: { x: 0, y: 20 } }), rec())[0], /centre x 70 vs 60/);
});

test('compareKey: copyAxesByWidth overrides copyAxes at that width only', () => {
  const a = rec({ box: { x: 0, y: 20, w: 140, h: 50 }, rel: { x: 40, y: 20 } });
  assert.match(cmp('byWidth', a, rec())[0], /rel\.x 40 vs 10/, 'at 1440 x is compared');
  assert.deepEqual(compareKey('byWidth', meas({ byWidth: a }, { width: 768 }), meas({ byWidth: rec() }, { width: 768 }), MAP), [], 'at 768 x is waived');
});

test('compareKey: non-text h off by 5 fails, off by 4 passes', () => {
  assert.equal(cmp('box', rec({ box: { x: 10, y: 20, w: 100, h: 55 } }), rec()).length, 1);
  assert.deepEqual(cmp('box', rec({ box: { x: 10, y: 20, w: 100, h: 54 } }), rec()), []);
});

test('compareKey: count mismatch fails, equal passes', () => {
  assert.deepEqual(cmp('cards', rec({ count: 3 }), rec({ count: 3 })), []);
  assert.match(cmp('cards', rec({ count: 2 }), rec({ count: 3 }))[0], /count 2 vs 3/);
});

test('compareKey: hiddenAt width is skipped', () => {
  const r = meas({}, { width: 1440 });
  assert.deepEqual(compareKey('mob', meas({}), r, MAP), []);
  assert.deepEqual(compareKey('mob', meas({}), { ...r, width: 768 }, MAP), ['ref missing: mob']);
});

test('compareKey: key absent from ref is reported', () => {
  assert.deepEqual(compareKey('box', meas({ box: rec() }), meas({}), MAP), ['ref missing: box']);
});

test('compareKey: missing on AIIS is reported', () => {
  assert.match(compareKey('box', meas({}), meas({ box: rec() }), MAP)[0], /missing on AIIS/);
});

test('compareKey: colours go through mapColor', () => {
  setColorMap({ '#041E42': '#2C2B7A' });
  try {
    assert.deepEqual(cmp('box', rec({ style: style({ color: 'rgb(44, 43, 122)' }) }), rec()), []);
    const bad = cmp('box', rec({ style: style({ color: 'rgb(0, 0, 0)' }) }), rec());
    assert.match(bad[0], /color rgb\(0, 0, 0\) vs mapped rgb\(44, 43, 122\)/);
    assert.throws(() => cmp('box', rec(), rec({ style: style({ color: 'rgb(9, 9, 9)' }) })), /unmapped color: rgb\(9, 9, 9\)/);
  } finally { setColorMap(BASE); }
});

test('compareKey: only first font family is compared', () => {
  setColorMap({ '#041E42': '#041E42' });
  try {
    assert.deepEqual(cmp('box', rec({ style: style({ fontFamily: '"Anton", Impact, sans-serif' }) }), rec()), []);
    assert.match(cmp('box', rec({ style: style({ fontFamily: 'Fraunces, serif' }) }), rec())[0], /fontFamily/);
  } finally { setColorMap(BASE); }
});

test('compareKey: marquee ignores rel.x but still checks rel.y', () => {
  assert.deepEqual(cmp('tick', rec({ rel: { x: 900, y: 20 } }), rec()), []);
  assert.equal(cmp('tick', rec({ rel: { x: 900, y: 40 } }), rec()).length, 1);
});

test('compareKey: intro keys are skipped unless the AIIS measurement is an intro measurement', () => {
  const r = meas({ intro: rec() });
  assert.deepEqual(compareKey('intro', meas({}), r, MAP), []);
  assert.match(compareKey('intro', meas({}, { intro: true }), r, MAP)[0], /missing on AIIS/);
});

test('mapColor: hex and rgb keys, transparent passthrough, unmapped throws', () => {
  setColorMap({ '#041E42': '#2C2B7A' });
  try {
    assert.equal(mapColor('rgb(4, 30, 66)'), 'rgb(44, 43, 122)');
    assert.equal(mapColor('rgba(0, 0, 0, 0)'), 'rgba(0, 0, 0, 0)');
    assert.throws(() => mapColor('rgb(1, 2, 3)'), { message: 'unmapped color: rgb(1, 2, 3)' });
  } finally { setColorMap(BASE); }
});

test('openPage serves a fixture site and measureAiis measures it', { timeout: 60000 }, async () => {
  const siteDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/smoke');
  const { browser, page } = await openPage(1440, { siteDir });
  try {
    assert.equal(await page.title(), 'fixture');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('aiis-intro-seen')), '1');
    const res = await page.request.get(new URL(page.url()).origin + '/../etc/passwd');
    assert.equal(res.status(), 404);
    const m = await measureAiis(page, 1440);
    assert.equal(m.keys['fixture-heading'], undefined); // not in selector-map: only mapped keys are measured
    assert.ok(await page.locator('[data-k="fixture-heading"]').isVisible());
  } finally { await browser.close(); }
});

test('compareKey skips copy-driven axes only', () => {
  const map = { ...MAP, lbl: { section: 's', ssa: '.g', aiis: '[data-k="lbl"]', text: true, copyAxes: ['w', 'x'] } };
  const wide = rec({ box: { x: 10, y: 20, w: 140, h: 50 }, rel: { x: 90, y: 20 } });
  assert.deepEqual(compareKey('lbl', meas({ lbl: wide }), meas({ lbl: rec() }), map), []);
  const big = rec({ style: style({ fontSize: '30px' }) });
  assert.equal(compareKey('lbl', meas({ lbl: big }), meas({ lbl: rec() }), map).length, 1);
});

test('compareKey copyAxes "y" skips rel.y of non-text keys only', () => {
  const map = { ...MAP, hl: { section: 's', ssa: '.h', aiis: '[data-k="hl"]', copyAxes: ['y'] } };
  const lower = rec({ rel: { x: 10, y: 120 } });
  assert.deepEqual(compareKey('hl', meas({ hl: lower }), meas({ hl: rec() }), map), []);
  const taller = rec({ box: { x: 10, y: 20, w: 100, h: 90 } });
  assert.equal(compareKey('hl', meas({ hl: taller }), meas({ hl: rec() }), map).length, 1);
});
