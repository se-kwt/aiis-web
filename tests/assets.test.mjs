import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRef, mapColor } from './helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIDTHS = [1440, 768, 375];

function refColors() {
  const set = new Set();
  for (const w of WIDTHS) {
    for (const rec of Object.values(loadRef(w).keys)) {
      for (const p of ['color', 'backgroundColor']) set.add(rec.style[p]);
    }
  }
  return set;
}

const toRgb = (c) => {
  const s = String(c).trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(s);
  if (hex) { const n = parseInt(hex[1], 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; }
  return s.replace(/\s+/g, ' ').replace(/,(?! )/g, ', ');
};

test('colormap_covers_reference', () => {
  const missing = [];
  for (const c of refColors()) {
    try { mapColor(c); } catch { missing.push(c); }
  }
  assert.deepEqual(missing, []);
});

const BRAND = JSON.parse(fs.readFileSync(path.join(root, 'tools/brand-palette.json'), 'utf8'));
const officialSet = () => new Set([...BRAND.colors.map((c) => c.hex), ...BRAND.extras.map((c) => c.hex)].map(toRgb));

/** Mismatches: palette entries that are not official brand values (or the listed extras), and mapped values outside the palette. */
function paletteProblems(m, official) {
  const out = [];
  for (const v of m._palette) if (!official.has(toRgb(v))) out.push(`_palette ${v} is not an official brand value, white or the brand stripe orange`);
  const allowed = new Set(m._palette.map(toRgb));
  for (const [k, v] of Object.entries(m)) {
    if (k.startsWith('_')) continue;
    if (!allowed.has(toRgb(v))) out.push(`${k} -> ${v} not in _palette`);
  }
  return out;
}

test('brand_palette_file_is_complete', () => {
  assert.match(BRAND.source.name, /Brand Guidelines/);
  assert.equal(BRAND.source.version, '2.0');
  for (const c of BRAND.colors) {
    assert.match(c.hex, /^#[0-9A-F]{6}$/, `hex ${c.hex}`);
    assert.ok(c.scale && Number.isInteger(c.step) && Number.isInteger(c.page), `scale, step and page for ${c.hex}`);
    assert.ok(c.page >= 11 && c.page <= 14, `${c.hex} page ${c.page}`);
  }
  const want = { '#1A1947': 'Navy 800', '#2A3242': 'Neutral 800', '#596376': 'Neutral 600', '#171D2A': 'Neutral 900', '#E2E6EE': 'Neutral 200', '#CDD3DF': 'Neutral 300', '#BD4B00': 'Orange 700', '#2C2B7A': 'Navy 500', '#FF6600': 'Orange 500', '#5CB9EB': 'Sky 500', '#F8F9FC': 'Neutral 50' };
  for (const [hex, name] of Object.entries(want)) {
    const c = BRAND.colors.find((x) => x.hex === hex);
    assert.ok(c, `${hex} listed`);
    assert.equal(`${c.scale} ${c.step}`, name);
  }
});

test('colormap_targets_are_aiis', () => {
  const m = JSON.parse(fs.readFileSync(path.join(root, 'tools/color-map.json'), 'utf8'));
  assert.equal(m._source, 'tools/brand-palette.json');
  assert.ok(!('_derived' in m), '_derived is gone');
  assert.ok(!JSON.stringify(m).includes('readme'), 'no readme source note remains');
  assert.ok(Array.isArray(m._palette) && m._palette.length > 0, '_palette listed');
  assert.deepEqual(paletteProblems(m, officialSet()), []);
});

test('colormap_palette_check_rejects_unofficial_shade', () => {
  const m = JSON.parse(fs.readFileSync(path.join(root, 'tools/color-map.json'), 'utf8'));
  const bad = { ...m, _palette: [...m._palette, '#123456'] };
  const problems = paletteProblems(bad, officialSet());
  assert.equal(problems.length, 1);
  assert.match(problems[0], /#123456/);
});

test('palette_tests_read_nothing_under_the_local_ledger_folder', () => {
  const me = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
  assert.ok(!me.includes(['.super', 'powers'].join('')), 'assets tests must not read the local-only folder');
});

test('old_derived_colours_are_gone_everywhere', () => {
  // old derived values, written in pieces so this file does not contain them
  const old = [['191', '742'], ['DFE', '1E7'], ['CCC', 'ED7'], ['5D6', '06F'], ['2D2', 'F39'], ['181', '921'], ['C24', 'E00']].map((p) => p.join(''));
  const rgb = ['25, 23, 66', '223, 225, 231', '204, 206, 215', '93, 96, 111', '45, 47, 57', '24, 25, 33', '194, 78, 0'];
  const needles = [...old, ...rgb.flatMap((r) => [r, r.replace(/, /g, ',')]), 'navy-900'];
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/\.(html|css|js|mjs|json|svg)$/.test(e.name)) files.push(f); } };
  for (const d of ['site', 'tools']) walk(path.join(root, d));
  files.push(path.join(root, 'dist', 'AIIS Homepage.html'));
  const hits = [];
  for (const f of files) { const t = fs.readFileSync(f, 'utf8'); for (const n of needles) if (t.toLowerCase().includes(n.toLowerCase())) hits.push(`${path.relative(root, f)}: ${n}`); }
  assert.deepEqual(hits, []);
});

/** PNG header facts: width, height and whether the colour type carries alpha (RGBA 6, grey+alpha 4, or a tRNS chunk). */
function pngInfo(file) {
  const b = fs.readFileSync(file);
  assert.deepEqual([...b.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], `${file} PNG magic`);
  const colour = b[25];
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), alpha: colour === 4 || colour === 6 || b.includes('tRNS'), bytes: b.length };
}

test('logos_present_and_png', () => {
  const dir = path.join(root, 'site/assets/logos');
  assert.deepEqual(fs.readdirSync(dir).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort(), ['crest-web.png', 'crest.png'], 'stand-in logos removed');
  const src = pngInfo(path.join(dir, 'crest.png'));
  assert.ok(src.w >= 1000 && src.alpha, 'crest.png: official, >= 1000 px wide, with alpha');
  const web = pngInfo(path.join(dir, 'crest-web.png'));
  assert.ok(web.alpha, 'crest-web.png keeps alpha');
  assert.ok(Math.abs((web.w / web.h) / (src.w / src.h) - 1) <= 0.005, 'crest-web.png keeps the aspect ratio');
  assert.ok(web.bytes < 350 * 1024, `crest-web.png is ${web.bytes} bytes (cap 350 KB)`);
  assert.ok(web.w < src.w, 'crest-web.png is a downscale');
});

test('image_slots_complete', () => {
  const md = fs.readFileSync(path.join(root, 'docs/image-slots.md'), 'utf8');
  const keys = new Set();
  for (const w of WIDTHS) for (const [k, rec] of Object.entries(loadRef(w).keys)) if (rec.src) keys.add(k);
  const missing = [...keys].filter((k) => !md.includes('`' + k + '`'));
  assert.deepEqual(missing, []);
});
