// Reads content/site.json (the single navigation source) and answers path questions about it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadSite(file = 'content/site.json') {
  const abs = path.isAbsolute(file) ? file : path.resolve(ROOT, file);
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

// '/form/contact-x' -> 'form--contact-x', '/' -> 'index'
export function slugForPath(p) {
  const s = p.replace(/^\/+|\/+$/g, '');
  return s === '' ? 'index' : s.replace(/\//g, '--');
}

// '/form/contact-x' -> 'form/contact-x.html', '/' -> 'index.html'
export function outFileForPath(p) {
  const s = p.replace(/^\/+|\/+$/g, '');
  return s === '' ? 'index.html' : `${s}.html`;
}

// The first menu group, then the quick-links group, whose links contain the path.
export function groupFor(site, p) {
  const groups = [...(site.menu || []), ...(site.quickLinks ? [site.quickLinks] : [])];
  return groups.find((g) => (g.links || []).some((l) => l.path === p)) || null;
}

// Every internal path the navigation mentions ('#' and external links excluded).
export function navPaths(site) {
  const out = new Set();
  const add = (item) => {
    const p = item && item.path;
    if (typeof p === 'string' && p.startsWith('/')) out.add(p);
  };
  for (const g of site.menu || []) {
    add(g);
    (g.links || []).forEach(add);
  }
  if (site.quickLinks) {
    add(site.quickLinks);
    (site.quickLinks.links || []).forEach(add);
  }
  add(site.newsCards);
  (site.footer || []).forEach(add);
  add(site.closingButton);
  (site.closing || []).forEach(add);
  (site.divisions || []).forEach(add);
  add(site.logo);
  return out;
}

// A path is planned if the navigation links it or `pending` names it ('prefix*' entries match by prefix).
export function isPlanned(site, p) {
  if (navPaths(site).has(p)) return true;
  return (site.pending || []).some((e) => (e.endsWith('*') ? p.startsWith(e.slice(0, -1)) : p === e));
}
