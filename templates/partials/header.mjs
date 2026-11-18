// Header and full-screen menu, rendered from content/site.json (menu, quickLinks).
// With assetBase '' the output is byte-identical to the markup in site/index.html.
import { esc, attr } from '../lib/html.mjs';

const CREST = 'assets/logos/crest-web.png';
const GLYPH = '<svg class="hdr-menu__glyph" aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9.5 6.5L15 12l-5.5 5.5" stroke="currentColor"/></svg>';

// ` target="_blank" rel=… aria-label=…` for external links, '' otherwise.
function externalAttrs(link) {
  return link.external
    ? ` target="_blank" rel="noopener noreferrer"${attr('aria-label', `${link.label} (opens in a new tab)`)}`
    : '';
}

function linkItem(link, dataK) {
  return `<li><a${attr('href', link.path)}${dataK ? ` data-k="${dataK}"` : ''}${externalAttrs(link)}>${esc(link.label)}</a></li>`;
}

// Walks a link list in order: `group` links get a sub-heading before the first of each group,
// `parent` links collect into one nested submenu placed where the first of them appears.
function renderLinks(links, { label, nested, firstDataK }) {
  let out = '';
  let lastGroup = null;
  let nestedDone = new Set();
  links.forEach((link, i) => {
    if (link.parent) {
      if (nestedDone.has(link.parent)) return;
      nestedDone.add(link.parent);
      out += nested(link.parent, links.filter((l) => l.parent === link.parent));
      lastGroup = null;
      return;
    }
    if (link.group && link.group !== lastGroup) out += label(link.group);
    lastGroup = link.group || null;
    out += linkItem(link, i === 0 ? firstDataK : null);
  });
  return out;
}

const headerNested = (name, children) =>
  `<li class="hdr__sub"><button class="hdr__sub-toggle" type="button" aria-expanded="false" aria-haspopup="true">${esc(name)}<svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5l3 3 3-3" stroke="currentColor" stroke-width="1.2"/></svg></button><ul class="hdr__sub-panel">${children.map((c) => linkItem(c)).join('')}</ul></li>`;

function headerItem(group, i, split) {
  const itemData = i === split - 1 ? ' data-k="header-nav-item-before-logo"' : i === split ? ' data-k="header-nav-item-after-logo"' : '';
  const panelData = i === 0 ? ' data-k="header-dropdown-panel"' : '';
  const listData = i === 0 ? ' data-k="header-dropdown-list"' : '';
  const links = renderLinks(group.links, {
    label: (g) => `<li class="hdr__panel-label">${esc(g)}</li>`,
    nested: headerNested,
    firstDataK: i === 0 ? 'header-dropdown-link1' : null,
  });
  return `          <li class="hdr__item"${itemData}>
            <a class="hdr__link"${attr('href', group.path)} data-k="header-nav-item1" aria-haspopup="true" aria-expanded="false"><span class="inner" data-k="header-nav-label1"><span>${esc(group.title)}</span><span aria-hidden="true">${esc(group.title)}</span></span></a>
            <div class="hdr__panel"${panelData}><ul${listData}>${links}</ul></div>
          </li>`;
}

export function renderHeader(site, { assetBase = '' } = {}) {
  const crest = `${assetBase}${CREST}`;
  const split = Math.ceil(site.menu.length / 2);
  const items = site.menu.map((g, i) => headerItem(g, i, split));
  const nav = [
    ...items.slice(0, split),
    `          <li class="hdr__logo">
            <div class="hdr__logo-box" data-k="header-logo"><a href="/" aria-label="Aspire Indian International School home"><img data-k="header-logo-img" src="${crest}" alt="Aspire Indian International School" width="51" height="39"></a></div>
          </li>`,
    ...items.slice(split),
  ].join('\n');
  const quick = site.quickLinks;
  const portals = quick.links.map((l) => linkItem(l)).join('');
  return `<header class="hdr" data-section="header" data-k="header-root">
    <div class="hdr__inner">
      <a class="hdr__logo-m" href="/" aria-label="Aspire Indian International School home"><img src="${crest}" alt="" width="31" height="24"></a>
      <div class="hdr__wrap">
        <nav class="hdr__nav" data-k="header-nav" aria-label="Main">
          <ul>
${nav}
          </ul>
        </nav>
        <div class="hdr__util">
          <div class="hdr__portals">
            <a class="hdr__login"${attr('href', quick.path)} data-k="header-login" aria-haspopup="true"><span class="inner">${esc(quick.title)}</span><svg aria-hidden="true" width="10" height="20" viewBox="0 0 10 20" fill="none"><path d="M3 6l4 4-4 4" stroke="currentColor" stroke-width="1.2"/></svg></a>
            <ul class="hdr__portals-panel">${portals}</ul>
          </div>
          <div class="hdr__lang">
            <button class="hdr__icon hdr__icon--translate" type="button" data-k="header-translate" data-translate-toggle aria-expanded="false" aria-controls="hdr-lang-list"><span class="sr">Translate this page</span><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><circle cx="8" cy="8" r="7"/><ellipse cx="8" cy="8" rx="3" ry="7"/><path d="M1 8h14M2 4.5h12M2 11.5h12"/></svg></button>
            <ul class="hdr__lang-list" id="hdr-lang-list"><li><a href="#" aria-current="true">English</a></li></ul>
          </div>
          <button class="hdr__icon hdr__icon--search" type="button" data-k="header-search"><span class="sr">Search</span><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><circle cx="7" cy="7" r="5.5"/><path d="M11 11l4 4"/></svg></button>
          <button class="hdr__icon hdr__icon--toggle" type="button" data-menu-open data-k="header-menu-toggle" aria-expanded="false" aria-controls="site-menu"><span class="sr">Open Menu</span><svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none"><path class="a" d="M1.2 12.2c0-.33.27-.6.6-.6H13c.33 0 .6.27.6.6s-.27.6-.6.6H1.8c-.33 0-.6-.27-.6-.6z" fill="currentColor"/><path class="b" d="M6.4 7.8c0-.33.27-.6.6-.6h11.2c.33 0 .6.27.6.6s-.27.6-.6.6H7c-.33 0-.6-.27-.6-.6z" fill="currentColor"/></svg></button>
        </div>
      </div>
    </div>
  </header>`;
}

// Nested submenu ids are numbered across the whole menu so they stay unique page-wide.
const menuNested = (counter) => (name, children) => {
  const n = ++counter.n;
  return `<li class="hdr-menu__nested"><button class="hdr-menu__nested-toggle" type="button" aria-expanded="false" aria-controls="menu-nested-${n}">${esc(name)}${GLYPH}</button><div class="hdr-menu__sub" id="menu-nested-${n}"><div><ul>${children.map((c) => linkItem(c)).join('')}</ul></div></div></li>`;
};

function menuGroup(title, path, subId, links, { first = false, indent = '        ', linkDataK = null, counter } = {}) {
  const sub = renderLinks(links, {
    label: (g) => `<li class="hdr-menu__label">${esc(g)}</li>`,
    nested: menuNested(counter),
  });
  const aData = first ? ' data-k="header-menu-group1"' : linkDataK ? ` data-k="${linkDataK}"` : '';
  const titleData = first ? ' data-k="header-menu-group1-title"' : '';
  const expData = first ? ' data-k="header-menu-expander1"' : '';
  const inner = linkDataK === 'header-menu-utility-link'
    ? `<span class="inner"><span>${esc(title)}</span></span>`
    : `<span class="inner"${titleData}><span>${esc(title)}</span><span aria-hidden="true">${esc(title)}</span></span>`;
  return `${indent}<li class="hdr-menu__group" data-menu-group>
${indent}  <a${attr('href', path)}${aData}>${inner}</a>
${indent}  <button class="hdr-menu__expander" type="button" aria-expanded="false" aria-controls="${subId}"${expData}><span class="sr">Expand ${esc(title)} section</span>${GLYPH}</button>
${indent}  <div class="hdr-menu__sub" id="${subId}"><div><ul>${sub}</ul></div></div>
${indent}</li>`;
}

export function renderMenu(site, { assetBase = '' } = {}) {
  const crest = `${assetBase}${CREST}`;
  const counter = { n: 0 };
  const groups = site.menu.map((g, i) => menuGroup(g.title, g.path, `menu-sub-${i + 1}`, g.links, { first: i === 0, counter })).join('\n');
  const q = site.quickLinks;
  const quick = menuGroup(q.title, q.path, 'menu-sub-quick-links', q.links, { indent: '          ', linkDataK: 'header-menu-utility-link', counter });
  return `<div class="hdr-menu" id="site-menu" data-k="header-menu-panel" role="dialog" aria-modal="true" aria-label="Menu" aria-hidden="true">
      <div class="hdr-menu__top">
        <a class="hdr-menu__logo" href="/" data-k="header-menu-logo" aria-label="Aspire Indian International School home"><img src="${crest}" alt="" width="31" height="24"></a>
        <button class="hdr-menu__close" type="button" data-menu-close data-k="header-menu-close"><span class="sr">Close Menu</span><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 15L15 1M1 1l14 14" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg></button>
      </div>
      <nav class="hdr-menu__main" aria-label="Main menu">
        <ul>
${groups}
        </ul>
      </nav>
      <nav class="hdr-menu__utility" aria-label="Quick Links">
        <ul>
${quick}
        </ul>
      </nav>
  </div>`;
}
