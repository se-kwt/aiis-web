import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer, stopServer } from './helpers.mjs';
import { prepareAiis, heightFor } from '../tools/measure.mjs';
import { buildHtml } from '../tools/bundle.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist', 'AIIS Homepage.html');
const EXTERNAL = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com', 'resources.finalsite.net'];

after(stopServer);

function aloneDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiis-bundle-'));
  fs.copyFileSync(dist, path.join(dir, 'index.html'));
  return dir;
}

/** Open a page at `width` (settled, ?nointro), recording console errors and every request URL. */
async function open(siteDir, width) {
  const port = await startServer(siteDir);
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width, height: heightFor(width) } })).newPage();
  const errors = [], requests = [], failed = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => requests.push(r.url()));
  page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(`http://127.0.0.1:${port}`)) failed.push(`${r.status()} ${r.url()}`); });
  await prepareAiis(page, { skipIntro: true, url: `http://127.0.0.1:${port}/` });
  await page.waitForFunction(() => document.body.hasAttribute('data-ready-values') || document.querySelectorAll('[data-ready="true"]').length > 5);
  return { browser, page, errors, requests, failed, port };
}

const readyState = (page) => page.evaluate(() => ({
  sections: [...document.querySelectorAll('[data-ready="true"]')].map((e) => e.getAttribute('data-section')).sort(),
  body: [...document.body.attributes].map((a) => a.name).filter((n) => n.startsWith('data-ready-')).sort(),
}));
const roots = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-k$="-root"]')].map((e) => {
  const r = e.getBoundingClientRect(); return [e.getAttribute('data-k'), [r.x, r.y + scrollY, r.width, r.height]];
})));

// Two kinds of URL. RESOURCE URLs (src, poster, <link href>, CSS url()) must never be local in the single file: the file has to
// work alone. NAVIGATION hrefs on <a> are root-relative sitemap paths on purpose (the site is expected to live at aiiskwt.com).
const SITEMAP = JSON.parse(fs.readFileSync(path.join(root, 'content/site.json'), 'utf8'));
const SITEMAP_PATHS = new Set(['/', ...SITEMAP.menu.flatMap((m) => [m.path, ...m.links.map((l) => l.path)]), SITEMAP.quickLinks.path, ...SITEMAP.quickLinks.links.map((l) => l.path), SITEMAP.newsCards.path,
  ...SITEMAP.footer.map((l) => l.path), SITEMAP.closingButton.path, ...SITEMAP.closing.map((l) => l.path)]);
const ABSOLUTE_OK = /^(https?:\/\/|data:|#|mailto:|tel:)/;

/** Problems with local resource URLs in a built page; `<a href>` navigation is judged separately by `navigationProblems`. */
function resourceProblems(html) {
  const out = [];
  for (const tag of html.matchAll(/<([a-z][a-z0-9-]*)\b[^>]*>/gi)) {
    const name = tag[1].toLowerCase();
    for (const m of tag[0].matchAll(/(?<![\w-])(href|src|poster)="([^"]*)"/g)) {
      if (name === 'a' && m[1] === 'href') continue; // navigation, see navigationProblems
      if (!ABSOLUTE_OK.test(m[2])) out.push(`local resource URL in <${name} ${m[1]}>: ${m[2].slice(0, 80)}`);
    }
  }
  for (const m of html.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/g)) if (!/^(https?:\/\/|data:|#)/.test(m[2])) out.push(`local url() in CSS: ${m[2].slice(0, 80)}`);
  if (/<link[^>]+rel="stylesheet"[^>]+href="(?!https?:)/.test(html)) out.push('local stylesheet link remains');
  if (/type="module"/.test(html)) out.push('module script remains');
  if (/(\.\.\/)?assets\/(logos|art)\//.test(html)) out.push('asset path remains');
  return out;
}
/** `<a href>` values that are neither absolute, #, mailto/tel nor a sitemap path. */
function navigationProblems(html) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*?(?<![\w-])href="([^"]*)"/g)) {
    if (!ABSOLUTE_OK.test(m[1]) && !SITEMAP_PATHS.has(m[1])) out.push(`navigation href is not a sitemap path: ${m[1]}`);
  }
  return out;
}

test('bundle_has_no_local_urls', () => {
  const html = fs.readFileSync(dist, 'utf8');
  assert.ok([...html.matchAll(/(?<![\w-])(href|src|poster)="([^"]*)"/g)].length > 20);
  assert.deepEqual(resourceProblems(html), []);
  assert.deepEqual(navigationProblems(html), []);
  const navCount = [...html.matchAll(/<a\b[^>]*?(?<![\w-])href="\/[^"]*"/g)].length;
  assert.ok(navCount > 30, `root-relative sitemap links in the bundle: ${navCount}`);
  for (const m of html.matchAll(/<img\b[^>]*>/g)) assert.ok(/(?<![\w-])src="|data-inline-src="/.test(m[0]), `img without a source: ${m[0].slice(0, 80)}`);
});

test('bundle_url_check_separates_resources_from_navigation', () => {
  // navigation to a sitemap path is fine; the same path as a resource is not
  assert.deepEqual(resourceProblems('<a href="/admission-process">x</a>'), []);
  assert.deepEqual(navigationProblems('<a class="x" href="/admission-process">x</a>'), []);
  assert.equal(navigationProblems('<a href="/not-in-the-sitemap">x</a>').length, 1);
  assert.equal(navigationProblems('<a href="css/main.css">x</a>').length, 1);
  // local images, scripts and stylesheets are caught
  assert.equal(resourceProblems('<img src="/assets/logos/crest.png">').length >= 1, true);
  assert.equal(resourceProblems('<img src="/admission-process">').length, 1);
  assert.equal(resourceProblems('<script src="js/main.js"></script>').length, 1);
  assert.ok(resourceProblems('<link rel="stylesheet" href="css/tokens.css">').length >= 1);
  assert.equal(resourceProblems('<video poster="/p.jpg"></video>').length, 1);
  assert.equal(resourceProblems('<style>a{background:url(/img/x.png)}</style>').length, 1);
  assert.deepEqual(resourceProblems('<img src="https://x.test/a.png"><img src="data:image/png;base64,AAAA"><link rel="stylesheet" href="https://fonts.googleapis.com/x">'), []);
});

test('bundle_makes_no_local_requests', async () => {
  const dir = aloneDir();
  const { browser, requests, failed, port } = await open(dir, 1440);
  try {
    assert.deepEqual(failed, []);
    const doc = `http://127.0.0.1:${port}/`;
    for (const u of requests) {
      if (u.startsWith('data:') || u.startsWith('blob:')) continue;
      if (u === doc || u === doc + '?nointro') continue;
      assert.ok(EXTERNAL.includes(new URL(u).hostname), `unexpected request: ${u.slice(0, 120)}`);
    }
  } finally { await browser.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('bundle_modules_all_ready', async () => {
  const dir = aloneDir();
  const b = await open(dir, 1440);
  const s = await open(path.join(root, 'site'), 1440);
  try {
    const [rb, rs] = [await readyState(b.page), await readyState(s.page)];
    assert.ok(rs.sections.length >= 5);
    assert.deepEqual(rb, rs);
    assert.deepEqual(b.errors.filter((e) => !/Failed to load resource/.test(e)), []);
  } finally { await b.browser.close(); await s.browser.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('bundle_layout_matches_site', async () => {
  const dir = aloneDir();
  try {
    for (const width of [1440, 375]) {
      const b = await open(dir, width);
      const s = await open(path.join(root, 'site'), width);
      try {
        const [lb, ls] = [await roots(b.page), await roots(s.page)];
        assert.ok(Object.keys(ls).length >= 8, `few roots at ${width}`);
        assert.deepEqual(Object.keys(lb), Object.keys(ls));
        for (const k of Object.keys(ls)) ls[k].forEach((v, i) => assert.ok(Math.abs(v - lb[k][i]) <= 1, `${k}[${i}] at ${width}: site ${v} vs bundle ${lb[k][i]}`));
      } finally { await b.browser.close(); await s.browser.close(); }
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('bundle_embeds_each_image_once_and_crests_load', async () => {
  const html = fs.readFileSync(dist, 'utf8');
  const pngs = [...html.matchAll(/data:image\/png;base64,[A-Za-z0-9+/=]+/g)].map((m) => m[0]);
  assert.equal(pngs.length, new Set(pngs).size, 'a PNG data URI is repeated');
  assert.equal(pngs.length, 1, 'only the web crest is a PNG');
  assert.ok(Buffer.byteLength(html) < 800 * 1024, `bundle is ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
  const dir = aloneDir();
  const b = await open(dir, 1440);
  try {
    const m = await b.page.evaluate(() => [...document.querySelectorAll('img[data-inline-src], img[data-inline-carrier]')].map((i) => ({
      src: i.src.startsWith('data:image/png'), ok: i.complete && i.naturalWidth > 0, alt: i.getAttribute('alt'),
      name: i.closest('a')?.getAttribute('aria-label') || null, w: i.getAttribute('width'), h: i.getAttribute('height'),
    })));
    assert.equal(m.length, 6, 'six crest slots share the single embedded image');
    for (const i of m) assert.ok(i.src && i.ok, 'shared crest did not load');
    // alt text and link names survive: same as the multi-file page
    const s = await open(path.join(root, 'site'), 1440);
    try {
      const ref = await s.page.evaluate(() => [...document.querySelectorAll('img[src*="crest"]')].map((i) => ({ alt: i.getAttribute('alt'), name: i.closest('a')?.getAttribute('aria-label') || null, w: i.getAttribute('width'), h: i.getAttribute('height') })));
      assert.deepEqual(m.map(({ alt, name, w, h }) => ({ alt, name, w, h })), ref);
    } finally { await s.browser.close(); }
  } finally { await b.browser.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

const RATIO = 1437 / 1094;
const crestImages = (page) => page.evaluate(async () => {
  const imgs = [...document.querySelectorAll('img')].filter((i) => i.getClientRects().length && (i.hasAttribute('data-inline-src') || i.hasAttribute('data-inline-carrier')));
  await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
  return imgs.map((i) => {
    const r = i.getBoundingClientRect(), cs = getComputedStyle(i), nw = i.naturalWidth, nh = i.naturalHeight;
    const k = Math.min(r.width / nw, r.height / nh);
    return { cls: i.className || i.parentElement.className, fit: cs.objectFit, ratio: nw ? (nw * k) / (nh * k) : NaN };
  });
});

for (const width of [1440, 375]) {
  test(`bundle_crests_not_distorted_incl_intro_seal @${width}`, async () => {
    const dir = aloneDir();
    const browser = await chromium.launch();
    try {
      const port = await startServer(dir);
      const page = await (await browser.newContext({ viewport: { width, height: heightFor(width) } })).newPage();
      await prepareAiis(page, { skipIntro: true, url: `http://127.0.0.1:${port}/` });
      await page.waitForFunction(() => document.querySelectorAll('[data-ready="true"]').length > 5);
      const settled = await crestImages(page);
      const ip = await (await browser.newContext({ viewport: { width, height: heightFor(width) } })).newPage();
      await prepareAiis(ip, { skipIntro: false, hold: true, url: `http://127.0.0.1:${port}/` });
      await ip.waitForSelector('[data-section="intro"].is-held', { timeout: 60000 });
      const held = (await crestImages(ip)).filter((c) => /seal/.test(c.cls));
      assert.ok(settled.length >= 3, `settled crest slots: ${settled.length}`);
      assert.equal(held.length, 1, 'intro seal crest in the bundle');
      for (const c of [...settled, ...held]) {
        assert.equal(c.fit, 'contain', `${c.cls}: object-fit`);
        assert.ok(Math.abs(c.ratio / RATIO - 1) <= 0.01, `${c.cls}: painted ratio ${c.ratio}`);
      }
    } finally { await browser.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  });
}

test('bundle_without_javascript_keeps_logo_boxes_names_and_header_logo', async () => {
  const dir = aloneDir();
  const browser = await chromium.launch();
  try {
    const port = await startServer(dir);
    const url = `http://127.0.0.1:${port}/?nointro`;
    const off = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false })).newPage();
    await off.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    const on = await open(dir, 1440);
    try {
      const facts = (page) => page.evaluate(() => ({
        imgs: [...document.querySelectorAll('img[data-inline-src], img[data-inline-carrier]')].map((i) => ({ alt: i.getAttribute('alt'), w: i.getAttribute('width'), h: i.getAttribute('height'), name: i.closest('a')?.getAttribute('aria-label') || null })),
        header: (() => { const i = document.querySelector('[data-k="header-logo-img"]'); return { ok: i.complete && i.naturalWidth > 0, box: (({ width, height }) => [width, height])(i.getBoundingClientRect()) }; })(),
        footerLogoBox: (({ width, height }) => [width, height])(document.querySelector('[data-k="footer-logo"]').getBoundingClientRect()),
      }));
      const [a, b] = [await facts(off), await facts(on.page)];
      assert.equal(a.imgs.length, 6);
      assert.deepEqual(a.imgs, b.imgs, 'alt text, link names and size attributes unchanged without JS');
      assert.ok(a.header.ok, 'desktop header logo paints without JS');
      assert.deepEqual(a.header.box.map(Math.round), b.header.box.map(Math.round));
      for (let i = 0; i < 2; i++) assert.ok(Math.abs(a.footerLogoBox[i] - b.footerLogoBox[i]) <= 1, `footer logo box ${a.footerLogoBox} vs ${b.footerLogoBox}`);
    } finally { await on.browser.close(); }
  } finally { await browser.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('bundle_is_fresh', async () => {
  assert.ok(fs.existsSync(dist), 'dist/AIIS Homepage.html is missing; run npm run build:single');
  assert.equal(await buildHtml(), fs.readFileSync(dist, 'utf8'), 'stale bundle; run npm run build:single');
});
