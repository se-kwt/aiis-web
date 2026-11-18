// The page's menus and links follow the school's sitemap (content/site.json: label -> path, copied from the owner's
// sitemap document, August 2026). Static markup only (JavaScript off, no network).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { startServer, stopServer } from './helpers.mjs';

after(stopServer);
const MAP = JSON.parse(fs.readFileSync('content/site.json', 'utf8'));

async function anchors() {
  const port = await startServer();
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ javaScriptEnabled: false })).newPage();
    await page.route(/^(?!http:\/\/127\.0\.0\.1)/, (r) => r.abort());
    await page.goto(`http://127.0.0.1:${port}/?nointro`, { waitUntil: 'domcontentloaded' });
    return await page.evaluate(() => {
      const collapse = (s) => s.replace(/\s+/g, ' ').trim();
      // visible label: the first visible span of a two-span rolling label, else the link text
      const label = (a) => { const inner = a.querySelector(':scope > .inner > span:first-child'); return collapse((inner || a).textContent); };
      const row = (a) => ({ href: a.getAttribute('href'), label: label(a), aria: a.getAttribute('aria-label'), placeholder: a.hasAttribute('data-placeholder') });
      const list = (sel) => [...document.querySelectorAll(sel)].map(row);
      const groups = (itemSel, linkSel, panelSel) => [...document.querySelectorAll(itemSel)].map((it) => ({ top: row(it.querySelector(linkSel)), subs: [...it.querySelectorAll(`${panelSel} a`)].map(row) }));
      return {
        desktop: groups('.hdr__item', '.hdr__link', '.hdr__panel'),
        quickDesktop: { top: row(document.querySelector('.hdr__login')), subs: list('.hdr__portals-panel a') },
        mobile: groups('.hdr-menu__main .hdr-menu__group', ':scope > a', '.hdr-menu__sub'),
        quickMobile: { top: row(document.querySelector('.hdr-menu__utility .hdr-menu__group > a')), subs: list('.hdr-menu__utility .hdr-menu__sub a') },
        footer: list('.footer__links a'),
        closingButton: row(document.querySelector('.closing .large-button')),
        closing: list('.closing__links a'),
        divisions: list('.flipcard a'),
        logos: list('a[aria-label="Aspire Indian International School home"]'),
        all: list('a[href]').concat(list('area[href]')),
        hashOnly: [...document.querySelectorAll('a[href="#"]')].map((a) => ({ label: collapse(a.textContent), inNews: !!a.closest('.news-panel__cards'), inSocial: !!a.closest('.footer__social'), inLang: !!a.closest('.hdr__lang-list'), social: a.closest('#news-tabpanel-social') !== null })),
      };
    });
  } finally { await browser.close(); }
}

const pairs = (rows) => rows.map((r) => [r.label, r.href]);
const want = (links) => links.map((l) => [l.label, l.path]);

test('site_links_match_sitemap', async () => {
  const a = await anchors();
  // desktop dropdown and full-screen menu: same groups, same labels, same paths
  const titled = (groups) => Object.fromEntries(groups.map((g) => [g.top.label, g]));
  for (const [name, groups] of [['desktop', a.desktop], ['mobile', a.mobile]]) {
    const by = titled(groups);
    assert.deepEqual(Object.keys(by).sort(), MAP.menu.map((m) => m.title).sort(), `${name} menu groups`);
    for (const m of MAP.menu) {
      assert.equal(by[m.title].top.href, m.path, `${name} ${m.title} top link`);
      assert.deepEqual(pairs(by[m.title].subs), want(m.links), `${name} ${m.title} links`);
    }
  }
  for (const [name, p] of [['desktop', a.quickDesktop], ['mobile', a.quickMobile]]) {
    assert.equal(p.top.href, MAP.quickLinks.path, `${name} QUICK LINKS top link`);
    assert.deepEqual(pairs(p.subs), want(MAP.quickLinks.links), `${name} QUICK LINKS links`);
  }
  assert.deepEqual(pairs(a.footer), want(MAP.footer), 'footer links');
  assert.deepEqual([a.closingButton.label, a.closingButton.href], [MAP.closingButton.label, MAP.closingButton.path], 'closing button');
  assert.deepEqual(pairs(a.closing), want(MAP.closing), 'closing links');
  // division cards: any link inside a card must be one of the sitemap's division entries (the cards carry no link text on this build)
  for (const d of a.divisions) assert.ok(MAP.divisions.some((x) => x.label === d.label && x.path === d.href), `division link ${d.label} ${d.href}`);
  // logos
  assert.ok(a.logos.length >= 4, `logo links: ${a.logos.length}`);
  for (const l of a.logos) assert.equal(l.href, MAP.logo.path, 'logo link');

  // every href is a sitemap path, tel:/mailto:, or one of the documented in-page / no-destination exceptions
  const paths = new Set([...MAP.menu.flatMap((m) => [m.path, ...m.links.map((l) => l.path)]), MAP.quickLinks.path, ...MAP.quickLinks.links.map((l) => l.path), MAP.newsCards.path,
    ...MAP.footer.map((l) => l.path), MAP.closingButton.path, ...MAP.closing.map((l) => l.path), MAP.logo.path, ...MAP.divisions.map((d) => d.path).filter((p) => p !== '#')]);
  const externals = new Set(MAP.quickLinks.links.filter((l) => l.external).map((l) => l.path)); // the only addresses outside the school's site
  for (const l of a.all) {
    if (/^(tel:|mailto:)/.test(l.href)) continue;
    if (l.href === '#main') continue; // skip link target and the hero video badge (in-page, existing behaviour)
    if (l.href === '#') continue; // checked below
    if (/^https:\/\//.test(l.href)) { assert.ok(externals.has(l.href), `external href ${l.href} (${l.label}) is not in the sitemap data`); continue; }
    assert.ok(paths.has(l.href), `href ${l.href} (${l.label}) is not a sitemap path`);
  }
  // the only `#` links left: the language list's current item, the four social icons and the four social cards (the sitemap has no social URLs)
  for (const h of a.hashOnly) assert.ok(h.inLang || h.inSocial || h.social, `unexpected # link: ${h.label}`);
  assert.equal(a.hashOnly.filter((h) => h.inNews && !h.social).length, 0, 'news cards link to the news page');
});

test('site_links_sitemap_data_is_consistent', () => {
  const labelsPerPath = new Map();
  for (const l of [...MAP.menu.flatMap((m) => m.links), ...MAP.quickLinks.links, ...MAP.footer, ...MAP.closing]) {
    assert.ok((l.external ? /^https:\/\/[\w.-]+$/ : /^\/\S*$/).test(l.path), `root-relative path (or an external https address): ${l.path}`);
    labelsPerPath.set(l.path, (labelsPerPath.get(l.path) || 0) + 1);
  }
  assert.equal(MAP.menu.length, 5);
  assert.equal(MAP.menu.reduce((n, m) => n + m.links.length, 0), 7 + 8 + 2 + 10 + 10);
  assert.equal(MAP.quickLinks.links.length, 5);
  assert.equal(MAP.footer.length, 6);
});
