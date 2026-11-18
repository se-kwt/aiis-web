import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { measureInPage } from '../tools/measure.mjs';

// A pseudo-element centred with translate(-50%,-50%) must be measured where it is rendered, equal to a real element with the same CSS.
test('pseudo_box_applies_transform', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<style>
      body{margin:0} .host{position:absolute;left:100px;top:200px;width:400px;height:300px}
      .host::after{content:"";position:absolute;left:50%;top:50%;width:100%;height:100%;transform:translate(-50%,-50%)}
      .host::before{content:"";position:absolute;left:0;top:0;width:100px;height:60px;transform:scale(2);transform-origin:0 0}
      .host::first-line{} .real{position:absolute;left:150px;top:200px;width:400px;height:300px}
      .spin::after{content:"";position:absolute;left:10px;top:10px;width:80px;height:80px;transform:translate(-5px,7px) rotate(33deg)}
      .spin{position:absolute;left:0;top:600px;width:100px;height:100px}
    </style><div class="host" id="h"></div><div class="spin" id="s"></div>`);
    const out = await page.evaluate(measureInPage, { entries: [['a', '#h', '::after', null], ['b', '#h', '::before', null], ['c', '#s', '::after', null]], styleProps: [] });
    assert.deepEqual([out.a.box.x, out.a.box.y, out.a.box.w, out.a.box.h], [100, 200, 400, 300]); // centred on the host = the host's own box
    assert.deepEqual([out.b.box.x, out.b.box.y, out.b.box.w, out.b.box.h], [100, 200, 200, 120]); // scale(2) about the top-left
    assert.deepEqual([out.c.box.x, out.c.box.y, out.c.box.w, out.c.box.h].map((n) => Math.round(n * 100) / 100), [5, 617, 80, 80]); // rotation ignored, translation applied
  } finally { await browser.close(); }
});
