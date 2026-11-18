// Shared test helpers: reference loading, AIIS measurement, comparison, colour mapping, page opening.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { measurePage, measureIntro, prepareAiis, heightFor, loadMap } from '../tools/measure.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

// One static server per site directory, on an OS-assigned port, so parallel test files never collide.
const servers = new Map(); // siteDir -> { server, port }
const defaultSite = path.join(root, 'site');

/** Start (idempotently) a static server for `siteDir` (default site/). Resolves to its port. */
export function startServer(siteDir = defaultSite) {
  const dir = path.resolve(siteDir);
  if (servers.has(dir)) return Promise.resolve(servers.get(dir).port);
  const server = http.createServer((req, res) => {
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
    catch { res.writeHead(400); res.end('bad request'); return; }
    let file = path.resolve(dir, '.' + (rel.endsWith('/') ? rel + 'index.html' : rel));
    const inside = file === dir || file.startsWith(dir + path.sep);
    if (!inside || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      servers.set(dir, { server, port });
      resolve(port);
    });
  });
}

/** Stop every server started by this process. Call from `after`. */
export async function stopServer() {
  const all = [...servers.values()];
  servers.clear();
  await Promise.all(all.map(({ server }) => new Promise((r) => server.close(r))));
}

export function loadRef(width) {
  return JSON.parse(fs.readFileSync(path.join(root, 'docs/reference', `ssa-${width}.json`), 'utf8'));
}

/**
 * Measure the AIIS page opened by openPage (same scroll-through/settle as `measure.mjs --target aiis`):
 * stateless keys plus menu keys when the opener is visible. Intro keys are NOT included (see measureAiisIntro).
 */
export async function measureAiis(page, width) {
  return { target: 'aiis', width, measuredAt: new Date().toISOString(), keys: await measurePage(page, 'aiis') };
}

/**
 * Measure state:"intro" keys on a page opened with openPage(width, { skipIntro: false }).
 * Returns a Measurement with `intro: true`; pass it to compareKey as the `aiis` argument for intro keys.
 */
export async function measureAiisIntro(page, width) {
  return { target: 'aiis', width, intro: true, measuredAt: new Date().toISOString(), keys: await measureIntro(page, 'aiis') };
}

export function boxClose(a, b, tol = 4) {
  return Math.abs(a - b) <= tol;
}

// ---- colour mapping -------------------------------------------------------------------------
const toRgb = (c) => {
  const s = String(c).trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    let h = hex[1]; if (h.length === 3) h = [...h].map((x) => x + x).join('');
    const n = parseInt(h, 16);
    return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
  }
  return s.replace(/\s+/g, ' ').replace(/,(?! )/g, ', ');
};

let colorMapCache = null;
/** Test hook: replace the colour map ({ssaColor: aiisColor}); pass null to reload tools/color-map.json. */
export function setColorMap(obj) {
  colorMapCache = obj ? new Map(Object.entries(obj).map(([k, v]) => [toRgb(k), toRgb(v)])) : null;
}
function colorMap() {
  if (colorMapCache) return colorMapCache;
  const file = path.join(root, 'tools/color-map.json'); // created in Task 2
  const raw = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  colorMapCache = new Map(Object.entries(raw).map(([k, v]) => [toRgb(k), toRgb(v)]));
  return colorMapCache;
}

/** Shady Side computed colour -> AIIS computed colour. Fully transparent passes through; anything else must be mapped. */
export function mapColor(ssaRgb) {
  const key = toRgb(ssaRgb);
  if (/^rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)$/.test(key)) return key;
  const hit = colorMap().get(key);
  if (!hit) throw new Error(`unmapped color: ${ssaRgb}`);
  return hit;
}

// ---- comparison -----------------------------------------------------------------------------
const firstFamily = (f) => String(f).split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();

/**
 * Mismatch messages for one key (empty array = match). `aiis` and `ref` are Measurement objects.
 * Skips keys hidden at the ref width and (unless aiis.intro) state:"intro" keys. `map` defaults to selector-map.json.
 */
export function compareKey(key, aiis, ref, map = loadMap()) {
  const def = map[key];
  if (!def) return [`${key}: not in selector-map`];
  if ((def.hiddenAt || []).includes(ref.width)) return [];
  if (def.state === 'intro' && !aiis.intro) return [];
  const r = ref.keys[key], a = aiis.keys[key];
  if (!r) return [`ref missing: ${key}`];
  if (!a) return [`${key}: missing on AIIS (${def.aiis})`];
  const out = [];
  const num = (label, av, rv) => { if (!boxClose(av, rv)) out.push(`${key}: ${label} ${av} vs ${rv}`); };
  if (def.count !== undefined && a.count !== (def.aiisCount ?? r.count)) out.push(`${key}: count ${a.count} vs ${def.aiisCount ?? r.count}`);
  // axes whose size/position is driven by the (different) AIIS copy; copyAxesByWidth overrides copyAxes at one reference width
  const copy = def.copyAxesByWidth?.[ref.width] ?? def.copyAxes ?? [];
  // x: skipped ('x'), or compared on the right edge ('xr', right-aligned text) or on the centre ('xc', centred text) instead,
  // which do not depend on the copy's width
  if (!def.marquee && !copy.includes('x')) {
    if (copy.includes('xr')) { if (!boxClose(a.rel.x + a.box.w, r.rel.x + r.box.w)) out.push(`${key}: right edge ${a.rel.x + a.box.w} vs ${r.rel.x + r.box.w}`); }
    else if (copy.includes('xc')) { if (!boxClose(a.rel.x + a.box.w / 2, r.rel.x + r.box.w / 2)) out.push(`${key}: centre x ${a.rel.x + a.box.w / 2} vs ${r.rel.x + r.box.w / 2}`); }
    else num('rel.x', a.rel.x, r.rel.x); // marquee items drift in x
  }
  if (!copy.includes('w')) num('w', a.box.w, r.box.w);
  // top edge: every key (text keys too, which skip only the height: their line count follows the copy). 'y': which line a word falls on comes from the AIIS copy
  if (!copy.includes('y')) num('rel.y', a.rel.y, r.rel.y);
  if (!def.text) num('h', a.box.h, r.box.h);
  for (const p of ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textTransform', 'borderRadius', 'opacity']) {
    if (a.style[p] !== r.style[p]) out.push(`${key}: ${p} ${a.style[p]} vs ${r.style[p]}`);
  }
  if (firstFamily(a.style.fontFamily) !== firstFamily(r.style.fontFamily))
    out.push(`${key}: fontFamily ${a.style.fontFamily} vs ${r.style.fontFamily}`);
  for (const p of ['color', 'backgroundColor']) {
    const want = mapColor(r.style[p]);
    if (toRgb(a.style[p]) !== want) out.push(`${key}: ${p} ${a.style[p]} vs mapped ${want} (SSA ${r.style[p]})`);
  }
  return out;
}

// ---- page opening ---------------------------------------------------------------------------
/**
 * Launch Chromium on the AIIS build (served from site/, or opts.siteDir) and prepare it exactly like
 * `measure.mjs --target aiis`: intro marked seen, scroll through, settle. skipIntro:false loads the page untouched.
 * Returns { browser, page }; caller closes the browser (and calls stopServer in `after`).
 */
export async function openPage(width, { reducedMotion = false, skipIntro = true, hold = false, siteDir } = {}) {
  const port = await startServer(siteDir);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width, height: heightFor(width) },
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  await prepareAiis(page, { skipIntro, hold, url: `http://127.0.0.1:${port}/` });
  return { browser, page };
}

// ---- highlight marker (shared by promises and learning) ---------------------------------------
/** Marker facts for every `.hl` under `scope` (a CSS selector prefix): background shape plus the box bottom relative to its h2. */
export const hlInfo = (page, scope = '') => page.evaluate((sel) => [...document.querySelectorAll(`${sel} .hl`.trim())].map((h) => {
  const cs = getComputedStyle(h), r = h.getBoundingClientRect(), hd = h.closest('h2').getBoundingClientRect();
  return { size: cs.backgroundSize, pos: cs.backgroundPosition, img: cs.backgroundImage, rep: cs.backgroundRepeat, color: cs.color,
    h: r.height, bottom: r.bottom - hd.top, lh: parseFloat(getComputedStyle(h.closest('h2')).lineHeight) };
}), scope);
/** The rgb() colours inside a background-image value. */
export const rgbs = (img) => [...img.matchAll(/rgb\(\d+, \d+, \d+\)/g)].map((m) => m[0]);
