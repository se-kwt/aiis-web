// tests/partials.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadSite } from '../tools/lib/site-data.mjs';
import { renderHeader, renderMenu } from '../templates/partials/header.mjs';
import { renderFooter } from '../templates/partials/footer.mjs';
import { esc, arabicAttrs } from '../templates/lib/html.mjs';

const html = fs.readFileSync('site/index.html', 'utf8');
const between = (name) => html.split(`<!-- build:${name} -->`)[1].split(`<!-- /build:${name} -->`)[0];
const site = loadSite();

test('header_partial_matches_homepage_exactly', () => assert.equal(renderHeader(site, { assetBase: '' }), between('header')));
test('menu_partial_matches_homepage_exactly', () => assert.equal(renderMenu(site, { assetBase: '' }), between('menu')));
test('footer_partial_matches_homepage_exactly', () => assert.equal(renderFooter(site, { assetBase: '' }), between('footer')));
test('inner_asset_base', () => {
  assert.match(renderHeader(site, { assetBase: '/' }), /src="\/assets\/logos\/crest-web\.png"/);
  assert.doesNotMatch(renderHeader(site, { assetBase: '/' }), /src="assets\//);
});
test('html_helpers', () => {
  assert.equal(esc(`a & <b> "c" 'd'`), `a &amp; &lt;b&gt; &quot;c&quot; 'd'`);
  assert.equal(arabicAttrs('الرسوم'), ' lang="ar" dir="rtl"');
  assert.equal(arabicAttrs('Fees'), '');
});
test('stamp_is_a_no_op_on_current_homepage', async () => {
  const { stampHomepage } = await import('../tools/build-site.mjs');
  const tmp = 'tests/.tmp-index.html'; fs.writeFileSync(tmp, html);
  try { assert.equal(stampHomepage(tmp), false); } finally { fs.rmSync(tmp); }
});

// ---- stamp: rewrite and throw paths ----
const mangled = (name) =>
  html.replace(`<!-- build:${name} -->`, `<!-- build:${name} -->STALE `);
const stampOf = { header: renderHeader, menu: renderMenu, footer: renderFooter };

for (const name of ['header', 'menu', 'footer']) {
  test(`stamp_rewrites_stale_${name}`, async () => {
    const { stampHomepage } = await import('../tools/build-site.mjs');
    const tmp = `tests/.tmp-stale-${name}.html`;
    fs.writeFileSync(tmp, mangled(name));
    try {
      assert.equal(stampHomepage(tmp), true);
      const out = fs.readFileSync(tmp, 'utf8');
      const region = out.split(`<!-- build:${name} -->`)[1].split(`<!-- /build:${name} -->`)[0];
      assert.equal(region, stampOf[name](site, { assetBase: '' }));
      assert.equal(out, html, 'the rest of the file is untouched and the original is restored');
      assert.equal(stampHomepage(tmp), false);
    } finally { fs.rmSync(tmp, { force: true }); }
  });
}

test('stamp_throws_when_a_marker_is_missing', async () => {
  const { stampHomepage } = await import('../tools/build-site.mjs');
  const tmp = 'tests/.tmp-missing-marker.html';
  fs.writeFileSync(tmp, html.replace('<!-- /build:menu -->', ''));
  try { assert.throws(() => stampHomepage(tmp), /menu/); } finally { fs.rmSync(tmp, { force: true }); }
});

// ---- data-driven behaviour ----
const clone = () => JSON.parse(JSON.stringify(site));

test('a_link_added_to_a_group_appears_in_header_and_menu', () => {
  const s = clone();
  s.menu[1].links.push({ label: 'Brand New Page', path: '/brand-new-page' });
  for (const out of [renderHeader(s, { assetBase: '' }), renderMenu(s, { assetBase: '' })]) {
    assert.match(out, /<li><a href="\/brand-new-page">Brand New Page<\/a><\/li>/);
  }
});

test('labels_and_titles_are_escaped', () => {
  const s = clone();
  s.menu[0].links.push({ label: 'A & <B>', path: '/a-b?x=1&y=2' });
  s.menu[0].title = 'R&D "LAB"';
  s.footer.push({ label: 'F & <G>', path: '/f' });
  const h = renderHeader(s, { assetBase: '' }) + renderMenu(s, { assetBase: '' });
  assert.match(h, /<a href="\/a-b\?x=1&amp;y=2">A &amp; &lt;B&gt;<\/a>/);
  assert.doesNotMatch(h, /<B>/);
  assert.match(h, /<span>R&amp;D &quot;LAB&quot;<\/span>/);
  assert.match(renderFooter(s, { assetBase: '' }), /<a href="\/f" data-k="footer-link1">F &amp; &lt;G&gt;<\/a>/);
});

test('group_renders_one_subheading_before_its_first_link', () => {
  const s = clone();
  s.menu[1].links.push({ label: 'X1', path: '/x1', group: 'Extras' }, { label: 'X2', path: '/x2', group: 'Extras' });
  const h = renderHeader(s, { assetBase: '' });
  const m = renderMenu(s, { assetBase: '' });
  assert.equal(h.split('<li class="hdr__panel-label">Extras</li>').length, 2);
  assert.match(h, /<li class="hdr__panel-label">Extras<\/li><li><a href="\/x1">X1<\/a><\/li><li><a href="\/x2">X2<\/a><\/li>/);
  assert.equal(m.split('<li class="hdr-menu__label">Extras</li>').length, 2);
});

test('parent_collects_links_into_one_nested_submenu', () => {
  const s = clone();
  s.menu[0].links.push({ label: 'P1', path: '/p1', parent: 'More' }, { label: 'P2', path: '/p2', parent: 'More' });
  const h = renderHeader(s, { assetBase: '' });
  const m = renderMenu(s, { assetBase: '' });
  assert.match(h, /<li class="hdr__sub"><button[^>]*>More<svg[\s\S]*?<\/button><ul class="hdr__sub-panel"><li><a href="\/p1">P1<\/a><\/li><li><a href="\/p2">P2<\/a><\/li><\/ul><\/li>/);
  assert.equal(h.split('hdr__sub-toggle').length, 3, 'Sports plus More');
  assert.match(m, /aria-controls="menu-nested-1">More/);
  assert.match(m, /id="menu-nested-1"><div><ul><li><a href="\/p1">P1<\/a><\/li><li><a href="\/p2">P2<\/a><\/li>/);
});

test('external_links_open_in_a_new_tab_with_a_label', () => {
  const s = clone();
  s.quickLinks.links.push({ label: 'Ext & Co', path: 'https://example.org/?a=1&b=2', external: true });
  s.menu[2].links.push({ label: 'Plain', path: '/plain' });
  const h = renderHeader(s, { assetBase: '' });
  const m = renderMenu(s, { assetBase: '' });
  const ext = '<a href="https://example.org/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer" aria-label="Ext &amp; Co (opens in a new tab)">Ext &amp; Co</a>';
  assert.ok(h.includes(ext));
  assert.ok(m.includes(ext));
  assert.match(h, /<a href="\/plain">Plain<\/a>/);
  assert.doesNotMatch(h.split('Plain')[0].split('<li>').pop(), /target=/);
});

test('nested_menu_ids_are_unique_across_groups', () => {
  const s = clone();
  s.menu[0].links.push({ label: 'P1', path: '/p1', parent: 'More' });
  const ids = [...renderMenu(s, { assetBase: '' }).matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids}`);
  assert.ok(ids.includes('menu-nested-1') && ids.includes('menu-nested-2'));
});
