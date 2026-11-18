import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { openPage, startServer, stopServer, mapColor } from './helpers.mjs';

const ORDER = ['intro', 'header', 'hero', 'news', 'promises', 'divisions', 'learning', 'teachers', 'values', 'closing', 'footer'];
const opened = [];
const open = async (w, o) => { const r = await openPage(w, o); opened.push(r.browser); return r; };
after(async () => { await Promise.all(opened.map((b) => b.close())); await stopServer(); });

test('foundation_sections_order', async () => {
  const { page } = await open(1440);
  const got = await page.$$eval('[data-section]', (els) => els.map((e) => [e.dataset.section, e.dataset.k]));
  assert.deepEqual(got.map((g) => g[0]), ORDER);
  assert.deepEqual(got.map((g) => g[1]), ORDER.map((s) => `${s}-root`)); // selector-map root keys
});

test('foundation_fonts_loaded', async () => {
  const { page } = await open(1440);
  const res = await page.evaluate(async () => {
    const out = {};
    for (const f of ['Anton', 'Fraunces', 'Geologica']) {
      await document.fonts.load(`16px ${f}`);
      const faces = [...document.fonts].filter((x) => x.family.replace(/["']/g, '') === f);
      out[f] = { check: document.fonts.check(`16px ${f}`), faces: faces.length, loaded: faces.some((x) => x.status === 'loaded') };
    }
    return out;
  });
  for (const [f, r] of Object.entries(res)) assert.ok(r.check && r.faces > 0 && r.loaded, `${f}: ${JSON.stringify(r)}`);
});

test('foundation_tokens_match_map', async () => {
  const { page } = await open(1440);
  const probe = (name) => page.evaluate((n) => {
    const d = document.createElement('div'); d.style.color = `var(${n})`; document.body.append(d);
    const c = getComputedStyle(d).color; d.remove(); return c;
  }, name);
  assert.equal(await probe('--c-navy'), mapColor('rgb(4, 30, 66)'));
  assert.equal(await probe('--c-navy-800'), mapColor('rgb(0, 20, 70)'));
  assert.equal(await probe('--c-text'), mapColor('rgb(55, 53, 53)'));
  assert.equal(await probe('--c-bg-alt'), mapColor('rgb(242, 243, 238)'));
  assert.equal(await probe('--c-accent'), 'rgb(255, 102, 0)');
  assert.equal(await probe('--c-highlight'), 'rgb(92, 185, 235)');
  const fonts = await page.evaluate(() => ['--f-display', '--f-serif', '--f-sans'].map((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim()));
  assert.match(fonts[0], /^"?Anton"?,.*Impact/); assert.match(fonts[1], /^"?Fraunces"?,.*Georgia/); assert.match(fonts[2], /^"?Geologica"?,.*system-ui/);
  const body = await page.evaluate(() => { const s = getComputedStyle(document.body); return [s.fontFamily, s.fontSize, s.lineHeight, s.color]; });
  assert.match(body[0], /^"?Geologica/); assert.equal(body[1], '18px'); assert.equal(body[2], '27px'); assert.equal(body[3], mapColor('rgb(55, 53, 53)'));
});

test('temp_photo_broken_src_keeps_box', async () => {
  const { page } = await open(1440);
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend',
      '<figure class="tp" data-temp-photo id="t1" style="width:300px;height:200px;margin:0"><img id="i1" src="/does-not-exist.jpg" alt=""></figure>');
  });
  await page.waitForFunction(() => document.getElementById('t1').classList.contains('tp--broken'));
  const r = await page.evaluate(() => {
    const f = document.getElementById('t1'), b = f.getBoundingClientRect(), a = getComputedStyle(f, '::after');
    return { w: b.width, h: b.height, bg: getComputedStyle(f).backgroundColor, content: a.content, display: a.display,
      size: a.fontSize, tt: a.textTransform, vis: a.visibility, op: a.opacity, pos: a.position, right: a.right, bottom: a.bottom };
  });
  assert.equal(r.w, 300); assert.equal(r.h, 200);
  assert.equal(r.bg, mapColor('rgb(195, 197, 204)')); // Neutral 200
  assert.match(r.content, /Temp photo/i);
  assert.equal(r.size, '10px'); assert.equal(r.tt, 'uppercase');
  assert.notEqual(r.display, 'none'); assert.equal(r.vis, 'visible'); assert.equal(r.op, '1');
});

// With Google Fonts blocked the display headings fall back to a wider face. The real hero, divisions and closing headings must not
// then run into any other control or text: every element that overlaps the heading's box in the fallback layout must already overlap it
// with the real fonts (by design, e.g. decoration laid under the title), and the heading text must stay inside the section.
test('fonts_blocked_no_overlap', async () => {
  const port = await startServer();
  const browser = await chromium.launch(); opened.push(browser);
  const url = `http://127.0.0.1:${port}/`;
  const HEADINGS = ['hero-heading', 'divisions-heading', 'closing-heading'];
  const probe = (page) => page.evaluate((keys) => {
    const OTHER = 'a, button, p, h1, h2, h3, li, figure, img, video, em, span.word, [data-k]';
    const out = {};
    for (const k of keys) {
      const h = document.querySelector(`[data-k="${k}"]`);
      const sec = h.closest('[data-section]');
      const hr = h.getBoundingClientRect();
      const range = document.createRange(); range.selectNodeContents(h);
      const text = [...range.getClientRects()].filter((r) => r.width > 0);
      const overlaps = [];
      [...sec.querySelectorAll(OTHER)].forEach((el, i) => {
        if (h.contains(el) || el.contains(h) || getComputedStyle(el).visibility === 'hidden' || el.closest('[aria-hidden="true"]') && !el.closest('[data-k]')) return;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        const w = Math.min(hr.right, r.right) - Math.max(hr.left, r.left), ht = Math.min(hr.bottom, r.bottom) - Math.max(hr.top, r.top);
        if (w > 1 && ht > 1) overlaps.push(`${el.tagName.toLowerCase()}[${el.dataset.k || el.className || i}]`);
      });
      const sr = sec.getBoundingClientRect();
      out[k] = { overlaps, textBottom: Math.max(...text.map((r) => r.bottom)), secBottom: sr.bottom, hBottom: hr.bottom, hH: hr.height };
    }
    return out;
  }, HEADINGS);
  const load = async (block) => {
    const p = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    if (block) await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await p.addInitScript(() => sessionStorage.setItem('aiis-intro-seen', '1'));
    await p.goto(url + '?nointro', { waitUntil: 'load' });
    if (!block) await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(400);
    return p;
  };
  const real = await load(false);
  assert.ok((await probe(real))['hero-heading'].hH >= 100, 'hero heading has its real height');
  const designed = await probe(real);
  const blockedPage = await load(true);
  const blocked = await probe(blockedPage);
  assert.deepEqual(await blockedPage.evaluate(() => ({ n: document.fonts.size, loaded: [...document.fonts].filter((f) => f.status === 'loaded').length })), { n: 0, loaded: 0 }, 'Google Fonts really blocked');
  for (const k of HEADINGS) {
    const fresh = blocked[k].overlaps.filter((o) => !designed[k].overlaps.includes(o));
    assert.deepEqual(fresh, [], `${k}: fallback heading runs into ${fresh.join(', ')}`);
    assert.ok(blocked[k].textBottom <= blocked[k].secBottom + 0.5, `${k}: fallback text stays inside its section`);
  }
  assert.equal(await blockedPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});

// ---- module runner (site/js/run-modules.js), exercised directly with inline stub modules ----
async function runnerPage() {
  const port = await startServer();
  const browser = await chromium.launch(); opened.push(browser);
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const logs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`); });
  await page.addInitScript(() => sessionStorage.setItem('aiis-intro-seen', '1'));
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.body.dataset.readyTempPhoto === 'true'); // main.js registers temp-photo
  // The real section modules also mark their sections ready; let them finish, then clear so the stubs start from a blank slate.
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelectorAll('[data-section]').forEach((e) => e.removeAttribute('data-ready')));
  return { page, logs };
}
const readyMap = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-section]')].map((e) => [e.dataset.section, e.dataset.ready || null])));

test('module_init_failure_isolated', async () => {
  const { page, logs } = await runnerPage();
  await page.evaluate(async () => {
    const { runModules } = await import('/js/run-modules.js');
    await runModules([
      { name: 'stub-throws', section: 'hero', init() { throw new Error('boom'); } },
      { name: 'stub-ok', section: 'news', init() {} },
    ]);
  });
  const st = await readyMap(page);
  assert.equal(st.hero, null); assert.equal(st.news, 'true');
  assert.ok(logs.some((l) => /error: .*stub-throws/.test(l)), logs.join('|'));
});

test('module_missing_section_warns_not_ready', async () => {
  const { page, logs } = await runnerPage();
  await page.evaluate(async () => {
    const { runModules } = await import('/js/run-modules.js');
    await runModules([
      { name: 'stub-missing', section: 'nope', init() { window.__ranMissing = true; } },
      { name: 'stub-after', section: 'learning', init() {} },
    ]);
  });
  assert.ok(logs.some((l) => /warning: \[stub-missing\] section "nope" not found/.test(l)), logs.join('|'));
  assert.equal(await page.evaluate(() => !!window.__ranMissing), false);
  assert.equal(await page.evaluate(() => document.querySelector('[data-ready-stub-missing]')), null);
  assert.equal((await readyMap(page)).learning, 'true');
});

test('module_async_init_awaited_and_rejection_isolated', async () => {
  const { page, logs } = await runnerPage();
  const mid = await page.evaluate(async () => {
    const { runModules } = await import('/js/run-modules.js');
    let resolveSlow; const slow = new Promise((r) => { resolveSlow = r; });
    const done = runModules([
      { name: 'async-ok', section: 'values', init: () => slow },
      { name: 'async-reject', section: 'closing', init: () => Promise.reject(new Error('async boom')) },
      { name: 'after', section: 'teachers', init() {} },
    ]);
    await new Promise((r) => setTimeout(r, 50));
    const during = document.querySelector('[data-section="values"]').dataset.ready || null; // not ready before resolve
    resolveSlow(); await done;
    return during;
  });
  assert.equal(mid, null, 'not ready until the promise resolves');
  const st = await readyMap(page);
  assert.equal(st.values, 'true'); assert.equal(st.closing, null); assert.equal(st.teachers, 'true');
  assert.ok(logs.some((l) => /error: .*async-reject/.test(l)), logs.join('|'));
});
