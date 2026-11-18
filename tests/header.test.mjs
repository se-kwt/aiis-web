import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openPage, measureAiis, compareKey, loadRef, stopServer } from './helpers.mjs';
import { loadMap } from '../tools/measure.mjs';

// Labels come from the school's sitemap (content/site.json); the order is the page's order (the logo sits after the third group).
const SITEMAP = JSON.parse(fs.readFileSync('content/site.json', 'utf8'));
const GROUPS = ['ABOUT US', 'ACADEMICS', 'ADMISSIONS', 'SCHOOL LIFE', 'AMENITIES'].map((t) => {
  const g = SITEMAP.menu.find((m) => m.title === t);
  return [t, g.links.map((l) => l.label)];
});
const opened = [];
const open = async (w, o) => { const r = await openPage(w, o); opened.push(r.browser); return r; };
after(async () => { await Promise.all(opened.map((b) => b.close())); await stopServer(); });

const headerKeys = Object.keys(loadMap()).filter((k) => k.startsWith('header-'));

for (const width of [1440, 768, 375]) {
  test(`header_boxes_match_ref @${width}`, async () => {
    const { page } = await open(width);
    const aiis = await measureAiis(page, width);
    const ref = loadRef(width);
    const bad = headerKeys.flatMap((k) => compareKey(k, aiis, ref));
    assert.deepEqual(bad, []);
    // every header key that exists at this width must have been measured on AIIS
    const map = loadMap();
    const missing = headerKeys.filter((k) => !(map[k].hiddenAt || []).includes(width) && !aiis.keys[k]);
    assert.deepEqual(missing, []);
  });
}

test('menu_opens_and_traps_focus', async () => {
  const { page } = await open(375);
  const toggle = page.locator('[data-menu-open]');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('#site-menu').getAttribute('aria-hidden'), 'true');
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('#site-menu').getAttribute('aria-hidden'), 'false');
  await page.waitForTimeout(500);
  assert.ok(await page.locator('#site-menu').isVisible());
  const inside = () => page.evaluate(() => !!document.activeElement?.closest('#site-menu'));
  assert.ok(await inside(), 'focus moves into the menu on open');
  for (let i = 0; i < 16; i++) { await page.keyboard.press('Tab'); assert.ok(await inside(), `Tab #${i + 1} stays inside`); }
  for (let i = 0; i < 16; i++) { await page.keyboard.press('Shift+Tab'); assert.ok(await inside(), `Shift+Tab #${i + 1} stays inside`); }
  // body scroll is locked
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflowY), 'hidden');
});

test('menu_esc_closes_restores_focus', async () => {
  const { page } = await open(375);
  await page.locator('[data-menu-open]').click();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  assert.ok(!(await page.locator('#site-menu').isVisible()), 'menu hidden');
  assert.equal(await page.locator('[data-menu-open]').getAttribute('aria-expanded'), 'false');
  assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-menu-open')), true, 'focus on toggle');
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflowY), 'hidden', 'scroll unlocked');
  // close button path also works
  await page.locator('[data-menu-open]').click();
  await page.waitForTimeout(500);
  await page.locator('[data-menu-close]').click();
  await page.waitForTimeout(500);
  assert.ok(!(await page.locator('#site-menu').isVisible()));
});

test('menu_copy_exact', async () => {
  const { page } = await open(375);
  const read = (sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent.trim()));
  const titles = await read('#site-menu [data-menu-group] > a .inner > span:first-child');
  assert.deepEqual(titles, [...GROUPS.map((g) => g[0]), SITEMAP.quickLinks.title]);
  assert.deepEqual(await read('#site-menu .hdr-menu__utility .hdr-menu__sub a'), SITEMAP.quickLinks.links.map((l) => l.label));
  for (const [i, [, links]] of GROUPS.entries())
    assert.deepEqual(await read(`#site-menu .hdr-menu__main [data-menu-group]:nth-child(${i + 1}) .hdr-menu__sub a`), links);
  // desktop dropdown carries the same groups and links
  const dTitles = await read('[data-k="header-nav-label1"] > span:first-child');
  assert.deepEqual(dTitles, GROUPS.map((g) => g[0]));
  const dLinks = await page.$$eval('.hdr__nav li.hdr__item', (lis) => lis.map((li) => [...li.querySelectorAll('.hdr__panel a')].map((a) => a.textContent.trim())));
  assert.deepEqual(dLinks, GROUPS.map((g) => g[1]));
});

test('menu_accordion_expands', async () => {
  const { page } = await open(375);
  await page.locator('[data-menu-open]').click();
  await page.waitForTimeout(500);
  const ex = page.locator('[data-k="header-menu-expander1"]');
  assert.equal(await ex.getAttribute('aria-expanded'), 'false');
  assert.ok(!(await page.locator('#site-menu .hdr-menu__main [data-menu-group]:nth-child(1) .hdr-menu__sub a').first().isVisible()));
  await ex.click();
  await page.waitForTimeout(600);
  assert.equal(await ex.getAttribute('aria-expanded'), 'true');
  assert.ok(await page.locator('#site-menu .hdr-menu__main [data-menu-group]:nth-child(1) .hdr-menu__sub a').first().isVisible());
});

test('header_hides_on_scroll_down_and_returns_on_scroll_up', async () => {
  const { page } = await open(1440);
  const y = () => page.evaluate(() => document.querySelector('[data-k="header-root"]').getBoundingClientRect().y);
  await page.evaluate(() => { document.body.style.minHeight = '4000px'; });
  await page.waitForTimeout(700); // let the scroll-through's hide/show transition finish (the page is short while sections are missing)
  assert.equal(Math.round(await y()) + 0, 0);
  await page.mouse.wheel(0, 50); await page.waitForTimeout(700);
  assert.equal(Math.round(await y()) + 0, 0, 'not hidden at 50px');
  await page.mouse.wheel(0, 300); await page.waitForTimeout(800);
  assert.ok((await y()) < -90, 'hidden after scrolling down');
  await page.mouse.wheel(0, -40); await page.waitForTimeout(800);
  assert.equal(Math.round(await y()) + 0, 0, 'back on scroll up');
});

test('header_reduced_motion_has_no_transitions', async () => {
  const { page } = await open(375, { reducedMotion: true });
  const d = await page.evaluate(() => [getComputedStyle(document.querySelector('#site-menu')).transitionDuration,
    getComputedStyle(document.querySelector('[data-k="header-root"]')).transitionDuration]);
  assert.deepEqual(d.map((s) => s.split(',').every((v) => parseFloat(v) === 0)), [true, true]);
});

// ---- copy-independent layout checks (replace the copy-driven x/w skips; values come from ssa-1440.json) ----
const bx = (page, k, i = 0) => page.$$eval(`[data-k="${k}"]`, (els, i) => { const r = els[i].getBoundingClientRect(); return { x: r.x + scrollX, w: r.width }; }, i);
const within = (a, b, tol = 4) => Math.abs(a - b) <= tol;

test('header_logo_gaps_match_ssa', async () => {
  const ref = loadRef(1440).keys;
  const refLeft = ref['header-logo'].box.x - (ref['header-nav-item-before-logo'].box.x + ref['header-nav-item-before-logo'].box.w);
  const refRight = ref['header-nav-item-after-logo'].box.x - (ref['header-logo'].box.x + ref['header-logo'].box.w);
  const { page } = await open(1440);
  const logo = await bx(page, 'header-logo'), before = await bx(page, 'header-nav-item-before-logo'), after = await bx(page, 'header-nav-item-after-logo');
  assert.ok(within(logo.x - (before.x + before.w), refLeft), `left gap ${logo.x - (before.x + before.w)} vs ${refLeft}`);
  assert.ok(within(after.x - (logo.x + logo.w), refRight), `right gap ${after.x - (logo.x + logo.w)} vs ${refRight}`);
});

test('header_nav_spacing_matches_ssa', async () => {
  const ref = loadRef(1440).keys;
  const refMargin = ref['header-nav-item1'].box.x - ref['header-nav'].box.x; // SSA: first item sits one item margin inside the nav (content fills nav)
  const { page } = await open(1440);
  const nav = await bx(page, 'header-nav');
  const items = [];
  for (let i = 0; i < 5; i++) items.push(await bx(page, 'header-nav-item1', i));
  // item-to-item gaps on the same side of the logo equal two item margins
  for (const [a, b] of [[0, 1], [1, 2], [3, 4]])
    assert.ok(within(items[b].x - (items[a].x + items[a].w), 2 * refMargin), `gap ${a}-${b}`);
  // centring: the group (items plus their margins and the logo) is centred in the nav, as SSA's content exactly fills it
  const logo = await bx(page, 'header-logo');
  const leftSlack = items[0].x - refMargin - nav.x;
  const rightSlack = nav.x + nav.w - (items[4].x + items[4].w + refMargin);
  assert.ok(leftSlack >= -1 && within(leftSlack, rightSlack), `centred: left ${leftSlack} right ${rightSlack}`);
  assert.ok(logo.x > items[2].x + items[2].w && logo.x + logo.w < items[3].x, 'logo sits between the two groups');
});
