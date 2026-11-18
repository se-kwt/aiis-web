import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { mapColor } from './helpers.mjs';

const map = JSON.parse(fs.readFileSync('tools/selector-map.json', 'utf8'));
const keys = Object.keys(map);

test('tooling_selector_map_valid', () => {
  assert.ok(keys.length >= 60, `need >= 60 keys, got ${keys.length}`);
  assert.equal(new Set(keys).size, keys.length);
  for (const [k, e] of Object.entries(map)) {
    assert.ok(e.section, `${k} section`);
    assert.ok(e.ssa, `${k} ssa`);
    assert.equal(e.aiis, `[data-k="${k}"]`, `${k} aiis`);
  }
  const sections = new Set(Object.values(map).map(e => e.section));
  for (const s of ['intro', 'header', 'hero', 'news', 'promises', 'divisions', 'learning', 'teachers', 'values', 'closing', 'footer'])
    assert.ok(sections.has(s), `section ${s} has keys`);
});

// Opt-in: contacts the live reference site. Run with REF_LIVE=1 npm test (see docs/handover.md).
test('tooling_ssa_selectors_resolve', { timeout: 180000, skip: process.env.REF_LIVE === '1' ? false : 'set REF_LIVE=1 to contact the reference site' }, async () => {
  const { prepareSsa } = await import('../tools/measure.mjs');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await prepareSsa(page);
    const bad = [];
    for (const [k, e] of Object.entries(map)) {
      for (const sel of [e.ssa, e.ssaAlt].filter(Boolean)) {
        const n = await page.locator(sel).count();
        if (n !== (e.count ?? 1)) bad.push(`${k}: ${n} matches (want ${e.count ?? 1}) ${sel}`);
      }
    }
    assert.deepEqual(bad, []);
  } finally { await browser.close(); }
});

test('tooling_ref_files_complete', () => {
  for (const w of [1440, 768, 375]) {
    const ref = JSON.parse(fs.readFileSync(`docs/reference/ssa-${w}.json`, 'utf8'));
    const missing = [];
    for (const [k, e] of Object.entries(map)) {
      if ((e.hiddenAt || []).includes(w)) continue;
      const r = ref.keys[k];
      if (!r || !(r.box.w > 0) || !(r.box.h > 0)) missing.push(k);
      else if (r.count !== (e.count ?? 1)) missing.push(`${k} (count ${r.count}, want ${e.count ?? 1})`);
    }
    assert.deepEqual(missing, [], `width ${w}`);
  }
});

test('tooling_mapcolor_throws_unmapped', () => {
  assert.throws(() => mapColor('rgb(1, 2, 3)'), { message: 'unmapped color: rgb(1, 2, 3)' });
});
