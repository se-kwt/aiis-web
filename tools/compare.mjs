// Section-by-section comparison sheets: Shady Side (left) vs AIIS (right), each side cropped to its own section root and top-aligned.
// Both sides get the same treatment: one slow downward pass through the page, and for each section a scroll through the section
// (so its scroll reveals fire and settle) before that section is captured. Google Chrome (channel 'chrome') so the hotlinked H.264
// video decodes; falls back to bundled Chromium.
// Usage: node tools/compare.mjs [widths...]   (default 1440 768 375)   -> docs/reference/compare-W.png (+ screenshots/aiis-W.png)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { startServer, stopServer, loadRef } from '../tests/helpers.mjs';
import { prepareAiis, prepareSsa, heightFor, loadMap } from './measure.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECTIONS = ['header', 'hero', 'news', 'promises', 'divisions', 'learning', 'teachers', 'values', 'closing', 'footer'];
// the intro (crest / seal splash) is a one-off overlay, not part of the page flow: it is covered by the intro_* tests, not captured here

async function launch() {
  try { return { browser: await chromium.launch({ channel: 'chrome' }), channel: 'chrome' }; }
  catch (e) { console.warn('channel chrome unavailable, using bundled Chromium'); return { browser: await chromium.launch(), channel: 'chromium' }; }
}
const HIDE_HEADER = '#fsEl_28048, .hdr { visibility: hidden !important; }';
const settle = (page, ms = 350) => page.evaluate((ms) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, ms)))), ms);

/** One downward pass; at each section: step through it, settle, capture its box. boxes: {section: {y, h}} in document coordinates. */
async function capturePass(page, width, boxes, outDir, who) {
  const vh = heightFor(width);
  let hidden = false;
  fs.mkdirSync(outDir, { recursive: true });
  for (const s of SECTIONS) {
    if (s !== 'header' && !hidden) { hidden = true; await page.addStyleTag({ content: HIDE_HEADER }); } // the fixed bar would cover the top of every crop
    const { y, h } = boxes[s];
    const end = Math.max(y, y + h - vh);
    for (let t = Math.max(0, y - vh * 0.5); t <= end + 1; t += 250) { await page.evaluate((v) => window.scrollTo(0, v), t); await page.waitForTimeout(120); }
    // viewport-sized slices (no fullPage: a full-page capture resizes the viewport and re-lays out vh-sized and pinned parts),
    // stitched by tools/compose-sheet.py at the offsets recorded here
    const slices = [];
    for (let t = y, k = 0; ; k++) {
      await page.evaluate((v) => window.scrollTo(0, v), Math.min(t, Math.max(y, y + h - vh)));
      await settle(page, 900);
      const sy = await page.evaluate(() => scrollY);
      const f = `${who}-${s}-${k}.png`;
      await page.screenshot({ path: path.join(outDir, f) });
      slices.push({ file: f, offset: Math.round(sy - y) });
      if (t + vh >= y + h) break;
      t += vh;
    }
    fs.writeFileSync(path.join(outDir, `${who}-${s}.json`), JSON.stringify({ width, height: Math.ceil(h), slices }));
  }
}

export async function compareWidth(width) {
  const outDir = path.join(root, '.compare-tmp', String(width));
  const map = loadMap();
  const boxesOf = (page, sel) => page.evaluate((e) => Object.fromEntries(e.map(([s, q]) => { const r = document.querySelector(q).getBoundingClientRect(); return [s, { y: r.top + scrollY, h: r.height }]; })), sel);
  const { browser, channel } = await launch();
  try {
    // SSA
    const sp = await (await browser.newContext({ viewport: { width, height: heightFor(width) } })).newPage();
    await prepareSsa(sp);
    const refBoxes = await boxesOf(sp, SECTIONS.map((s) => [s, map[`${s}-root`].ssa])); // measured live, in this session
    await capturePass(sp, width, refBoxes, outDir, 'ssa');
    // AIIS (boxes measured at the top of the settled page)
    const port = await startServer();
    const ap = await (await browser.newContext({ viewport: { width, height: heightFor(width) } })).newPage();
    await prepareAiis(ap, { url: `http://127.0.0.1:${port}/` });
    const aBoxes = await ap.evaluate((secs) => Object.fromEntries(secs.map((s) => { const r = document.querySelector(`[data-k="${s}-root"]`).getBoundingClientRect(); return [s, { y: r.top + scrollY, h: r.height }]; })), SECTIONS);
    await capturePass(ap, width, aBoxes, outDir, 'aiis');
    await ap.evaluate(() => window.scrollTo(0, 0)); await settle(ap, 800);
    await ap.screenshot({ path: path.join(root, 'docs/reference/screenshots', `aiis-${width}.png`), fullPage: true });
    fs.writeFileSync(path.join(outDir, 'boxes.json'), JSON.stringify({ ssa: refBoxes, aiis: aBoxes, sections: SECTIONS }));
  } finally { await browser.close(); }
  execFileSync('python3', [path.join(root, 'tools/compose-sheet.py'), outDir, String(width), path.join(root, 'docs/reference', `compare-${width}.png`)], { stdio: 'inherit' });
  return channel;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const widths = process.argv.slice(2).map(Number).filter(Boolean);
  for (const w of widths.length ? widths : [1440, 768, 375]) console.log(`${w}: captured with ${await compareWidth(w)}`);
  await stopServer();
}
