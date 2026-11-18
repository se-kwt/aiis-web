// The official crest (1437 x 1094) must never be stretched: every <img> showing it paints at that aspect ratio.
import { test, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage, stopServer } from './helpers.mjs';

const RATIO = 1437 / 1094;
const browsers = [];
afterEach(async () => { await Promise.all(browsers.splice(0).map((b) => b.close())); });
after(stopServer);

/** For each visible crest <img>: the aspect ratio of what is actually painted (object-fit contain letterboxes inside the box). */
const crestImages = (page) => page.evaluate(async () => {
  const imgs = [...document.querySelectorAll('img')].filter((i) => /crest/.test(i.currentSrc || i.src) && i.getClientRects().length);
  await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
  return imgs.map((i) => {
    const r = i.getBoundingClientRect(), cs = getComputedStyle(i);
    const nw = i.naturalWidth, nh = i.naturalHeight;
    let pw = r.width, ph = r.height;
    if (cs.objectFit === 'contain') { const k = Math.min(r.width / nw, r.height / nh); pw = nw * k; ph = nh * k; }
    else if (cs.objectFit !== 'fill') { pw = NaN; }
    return { cls: i.className || i.parentElement.className, box: [r.width, r.height], fit: cs.objectFit, ratio: pw / ph, w: pw, loaded: nw > 0 };
  });
});

for (const width of [1440, 375]) {
  test(`crest_not_distorted @${width}`, async () => {
    const { browser, page } = await openPage(width); browsers.push(browser);
    const settled = await crestImages(page);
    const intro = await openPage(width, { skipIntro: false, hold: true }); browsers.push(intro.browser);
    await intro.page.waitForSelector('[data-section="intro"].is-held', { timeout: 60000 });
    const held = await crestImages(intro.page);
    const all = [...settled, ...held.filter((h) => /seal/.test(h.cls))];
    // header (desktop or mobile), menu logo is hidden until opened, teachers icon, footer, intro seal
    assert.ok(settled.length >= 3, `expected header, teachers and footer crests, got ${settled.length}`);
    assert.ok(held.some((h) => /seal/.test(h.cls)), 'intro seal crest');
    for (const c of all) {
      assert.ok(c.loaded, `${c.cls} did not load`);
      assert.equal(c.fit, 'contain', `${c.cls}: object-fit`);
      assert.ok(Math.abs(c.ratio / RATIO - 1) <= 0.01, `${c.cls}: painted ratio ${c.ratio.toFixed(4)} vs ${RATIO.toFixed(4)}`);
      assert.ok(c.w > 0);
    }
  });
}

test('crest_web_copy_is_sharp_enough', async () => {
  const web = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../site/assets/logos/crest-web.png'));
  const pxWidth = web.readUInt32BE(16);
  const { browser, page } = await openPage(1440); browsers.push(browser);
  const settled = await crestImages(page);
  const intro = await openPage(1440, { skipIntro: false, hold: true }); browsers.push(intro.browser);
  await intro.page.waitForSelector('[data-section="intro"].is-held', { timeout: 60000 });
  // the held intro seal is at scale 1, so its box is its CSS size
  const widest = Math.max(...[...settled, ...(await crestImages(intro.page))].map((c) => c.box[0]));
  assert.ok(widest >= 100, `widest crest slot ${widest}`);
  assert.ok(pxWidth >= 2 * widest, `crest-web.png is ${pxWidth} px wide; largest slot renders at ${widest} CSS px (needs >= ${2 * widest})`);
});
