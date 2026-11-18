// Full-page screenshot after auto-scrolling (lazy loads), intro skipped, animations settled.
// Usage: node tools/capture.mjs --target <ssa|aiis> --width <1440|768|375> --out <png>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, prepareSsa, prepareAiis, heightFor } from './measure.mjs';

export async function capture(target, width, out) {
  const browser = await launch();
  try {
    const ctx = await browser.newContext({ viewport: { width, height: heightFor(width) } });
    const page = await ctx.newPage();
    await (target === 'ssa' ? prepareSsa(page) : prepareAiis(page)); // scrolls to bottom (1500 ms), back to top (500 ms)
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out, fullPage: true });
  } finally { await browser.close(); }
}

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = arg('target'), width = Number(arg('width')), out = arg('out');
  if (!['ssa', 'aiis'].includes(target) || !width || !out) {
    console.error('usage: node tools/capture.mjs --target <ssa|aiis> --width <w> --out <png>');
    process.exit(2);
  }
  await capture(target, width, out);
  console.log(`${target}@${width} -> ${out}`);
}
