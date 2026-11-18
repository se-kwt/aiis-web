// Measures every key in tools/selector-map.json on Shady Side (ssa) or the AIIS build (aiis).
// Usage: node tools/measure.mjs --target <ssa|aiis> --width <1440|768|375> --out <path>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SSA_URL = 'https://www.shadysideacademy.org/';
/** AIIS base URL: AIIS_URL env (also set by --url), default the tools/serve.sh server. */
export const aiisUrl = () => process.env.AIIS_URL || 'http://localhost:4173/';
export const loadMap = () => JSON.parse(fs.readFileSync(path.join(here, 'selector-map.json'), 'utf8'));
export const heightFor = (w) => (w >= 1440 ? 900 : w >= 768 ? 1024 : 812);

const STYLE_PROPS = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
  'textTransform', 'color', 'backgroundColor', 'borderRadius', 'opacity'];

// Third-party overlays that cover content but are not part of the page design.
const HIDE_WIDGETS_CSS = `#weglot-switcher-1, .weglot-container, [id*="cookie" i], [class*="cookie" i],
  [id^="onetrust"], [class*="chat-widget" i], #fsPoweredByFinalsite { display: none !important; }`;

export function launch() { return chromium.launch(); }

/** Scroll in steps to fire lazy loads and scroll triggers, then settle at the top. */
export async function scrollThrough(page) {
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < total + 400; y += 400) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
}

async function waitForSsaIntroGone(page) {
  await page.waitForFunction(() => document.querySelector('.preloader'), null, { timeout: 45000 }).catch(() => {});
  await page.waitForFunction(() => {
    const e = document.querySelector('.preloader');
    return !e || getComputedStyle(e).display === 'none' || e.getBoundingClientRect().width === 0;
  }, null, { timeout: 60000 });
  await page.waitForTimeout(800);
}

/** Load SSA with the seal intro finished, widgets hidden and lazy content revealed. */
export async function prepareSsa(page) {
  await page.goto(SSA_URL, { waitUntil: 'load', timeout: 60000 });
  await waitForSsaIntroGone(page);
  await page.addStyleTag({ content: HIDE_WIDGETS_CSS });
  await scrollThrough(page);
}

/** Load the AIIS build with the crest intro marked as already seen (or not). */
export async function prepareAiis(page, { skipIntro = true, hold = false, url = aiisUrl() } = {}) {
  if (skipIntro) await page.addInitScript(() => { try { sessionStorage.setItem('aiis-intro-seen', '1'); } catch {} });
  // ?nointro: no intro and no hero entrance replay, so measurements are of the settled page.
  // hold (test-only): an init script sets window.__aiisTestHold so intro.js freezes the intro at the state the intro keys are
  // measured in (class is-held). It is injected before load; no URL can trigger it.
  if (!skipIntro && hold) await page.addInitScript(() => { window.__aiisTestHold = true; });
  const flag = skipIntro ? 'nointro' : '';
  const target = flag ? url + (url.includes('?') ? '&' : '?') + flag : url;
  await page.goto(target, { waitUntil: 'load', timeout: 30000 });
  if (skipIntro) {
    await page.waitForTimeout(500);
    await scrollThrough(page);
  }
}

/**
 * Runs in the page: measure each entry. Returns { key: record|null }.
 * Pseudo-elements (entry.pseudo) have no client rect, so their box is rebuilt from computed
 * width/height and top/left/right/bottom, assuming the host element is the containing block, then the pseudo's own
 * computed transform is applied: translation (Chrome already resolves translate(-50%,-50%) to px in the matrix) and
 * scale about transform-origin. Rotation is deliberately ignored (the box stays axis-aligned and does not change while an
 * infinite-spin animation runs). Transforms on ancestors are not applied beyond what the host's own rect already holds.
 */
export function measureInPage({ entries, styleProps }) {
  const out = {};
  const url = (v) => { const m = /url\(["']?(.*?)["']?\)/.exec(v || ''); return m ? m[1] : null; };
  for (const [key, sel, pseudo, alt] of entries) {
    let el = document.querySelector(sel);
    // ssaAlt: selector for the same element where the primary one is not rendered (e.g. mobile layout).
    if (alt && (!el || !el.getClientRects().length)) el = document.querySelector(alt) || el;
    if (!el) { out[key] = null; continue; }
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el, pseudo || null);
    const style = {};
    for (const p of styleProps) style[p] = cs[p];
    let box = { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height };
    let src = null;
    if (pseudo) {
      const px = (v) => (/^-?[\d.]+px$/.test(v) ? parseFloat(v) : null);
      const w = px(cs.width), h = px(cs.height);
      const left = px(cs.left), right = px(cs.right), top = px(cs.top), bottom = px(cs.bottom);
      if (w === null || h === null || cs.content === 'none') { out[key] = null; continue; }
      const hx = r.x + scrollX, hy = r.y + scrollY;
      box = {
        x: left !== null ? hx + left : right !== null ? hx + r.width - right - w : hx,
        y: top !== null ? hy + top : bottom !== null ? hy + r.height - bottom - h : hy,
        w, h,
      };
      if (cs.transform && cs.transform !== 'none') {
        const m = /^matrix\(([^)]+)\)$/.exec(cs.transform);
        const v = m ? m[1].split(',').map(Number) : (/^matrix3d\(([^)]+)\)$/.exec(cs.transform) || [])[1]?.split(',').map(Number);
        if (v) {
          const [a, b, c, d, tx, ty] = v.length === 6 ? v : [v[0], v[1], v[4], v[5], v[12], v[13]];
          const sx = Math.hypot(a, b), sy = Math.hypot(c, d);
          const [ox, oy] = (cs.transformOrigin || '').split(' ').map(parseFloat);
          const cx = box.x + (Number.isFinite(ox) ? ox : w / 2), cy = box.y + (Number.isFinite(oy) ? oy : h / 2);
          box = { x: cx + (box.x - cx) * sx + tx, y: cy + (box.y - cy) * sy + ty, w: w * sx, h: h * sy };
        }
      }
      src = url(cs.backgroundImage);
    } else {
      if (el.currentSrc) src = el.currentSrc;
      else if (el.getAttribute('src')) src = el.src || el.getAttribute('src');
      else if (el.getAttribute('data-default-url')) src = el.getAttribute('data-default-url');
      else {
        const inner = el.querySelector('img, video, source, lottie-player');
        if (inner) src = inner.currentSrc || inner.src || inner.getAttribute('src') || inner.getAttribute('data-default-url');
      }
      if (!src) src = url(cs.backgroundImage);
      if (!src) {
        for (const c of el.querySelectorAll('*')) { src = url(getComputedStyle(c).backgroundImage); if (src) break; }
      }
    }
    out[key] = { box, style, src: src || null, count: document.querySelectorAll(alt && el.matches(alt) ? alt : sel).length };
  }
  return out;
}

async function measureEntries(page, map, pick, target) {
  const entries = Object.entries(map).filter(([, e]) => pick(e)).map(([k, e]) => [k, e[target], target === 'ssa' ? e.pseudo || null : null, target === 'ssa' ? e.ssaAlt || null : null]);
  return page.evaluate(measureInPage, { entries, styleProps: STYLE_PROPS });
}

const round = (n) => Math.round(n * 100) / 100;

function finalize(raw, map) {
  const keys = {};
  for (const [key, e] of Object.entries(map)) {
    const m = raw[key];
    if (!m) continue;
    const root = raw[e.relTo || `${e.section}-root`] || m;
    keys[key] = {
      section: e.section,
      box: { x: round(m.box.x), y: round(m.box.y), w: round(m.box.w), h: round(m.box.h) },
      rel: { x: round(m.box.x - root.box.x), y: round(m.box.y - root.box.y) },
      style: m.style, src: m.src, count: m.count,
    };
  }
  return keys;
}

/**
 * Measure the keys of `target` on an already-prepared page: stateless keys, then (if the
 * menu opener is visible at this width) the full-screen menu keys, then (if the desktop nav is visible)
 * the dropdown-open keys. Intro keys are measured
 * separately by measureAll because they need a fresh load.
 */
export async function measurePage(page, target) {
  const map = loadMap();
  const raw = await measureEntries(page, map, (e) => !e.state, target);
  if (Object.values(map).some((e) => e.state === 'menu-open')) {
    const opener = page.locator(target === 'ssa' ? '.mobile-toggle' : '[data-menu-open]').first();
    if (await opener.isVisible().catch(() => false)) {
      await opener.click();
      await page.waitForTimeout(1500);
      Object.assign(raw, await measureEntries(page, map, (e) => e.state === 'menu-open', target));
    }
  }
  // Desktop dropdown: hover the first top-level nav item (only where the horizontal nav is rendered).
  if (Object.values(map).some((e) => e.state === 'dropdown-open')) {
    const first = page.locator(target === 'ssa' ? map['header-nav-item1'].ssa : '[data-k="header-nav-item1"]').first();
    if (await first.isVisible().catch(() => false)) {
      await first.hover();
      await page.waitForTimeout(1200);
      Object.assign(raw, await measureEntries(page, map, (e) => e.state === 'dropdown-open', target));
      await page.mouse.move(2, 600);
      await page.waitForTimeout(700);
    }
  }
  return finalize(raw, map);
}

/** Measure all keys of `target` at `width`, including the intro phase. */
export async function measureAll(browser, target, width) {
  const map = loadMap();
  const newPage = async () => {
    const ctx = await browser.newContext({ viewport: { width, height: heightFor(width) } });
    return { ctx, page: await ctx.newPage() };
  };
  let main;
  {
    const { ctx, page } = await newPage();
    await (target === 'ssa' ? prepareSsa(page) : prepareAiis(page));
    main = await measurePage(page, target);
    await ctx.close();
  }
  if (!Object.values(map).some((e) => e.state === 'intro')) return main;
  // Intro keys: fresh load, measured while the crest/seal is held on screen.
  const { ctx, page } = await newPage();
  if (target === 'ssa') {
    await page.goto(SSA_URL, { waitUntil: 'commit', timeout: 60000 });
    await page.addStyleTag({ content: HIDE_WIDGETS_CSS }).catch(() => {});
  } else await prepareAiis(page, { skipIntro: false, hold: true });
  const intro = await measureIntro(page, target);
  await ctx.close();
  return { ...main, ...intro };
}

/** Measure state:"intro" keys on a page freshly loaded with the intro running (waits for the seal/crest to settle). */
export async function measureIntro(page, target) {
  const map = loadMap();
  if (target === 'aiis') await page.waitForSelector('[data-section="intro"].is-held', { timeout: 60000 }); // held state, not a clock
  else await waitStable(page, map['intro-seal-img'][target]);
  return finalize(await measureEntries(page, map, (e) => e.state === 'intro', target), map);
}

/** Wait until the element exists and its width stops changing (intro animation held). */
async function waitStable(page, sel, timeoutMs = 60000) {
  const read = () => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().width : 0; }, sel);
  const end = Date.now() + timeoutMs;
  let prev = -1;
  while (Date.now() < end) {
    const w = await read();
    if (w > 50 && w === prev) { await page.waitForTimeout(600); return; }
    prev = w;
    await page.waitForTimeout(500);
  }
}

export async function measure(target, width) {
  const browser = await launch();
  try {
    return { target, width, measuredAt: new Date().toISOString(), keys: await measureAll(browser, target, width) };
  } finally { await browser.close(); }
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (arg('url')) process.env.AIIS_URL = arg('url');
  const target = arg('target'), width = Number(arg('width')), out = arg('out');
  if (!['ssa', 'aiis'].includes(target) || !width || !out) {
    console.error('usage: node tools/measure.mjs --target <ssa|aiis> --width <w> --out <path> [--url <aiis base url>]');
    process.exit(2);
  }
  const m = await measure(target, width);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(m, null, 2));
  console.log(`${target}@${width}: ${Object.keys(m.keys).length} keys -> ${out}`);
}
