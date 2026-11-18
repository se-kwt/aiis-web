// Builds dist/AIIS Homepage.html: site/index.html with CSS, JS and local images inlined (single self-contained file).
// Usage: node tools/bundle.mjs   (or: npm run build:single)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteDir = path.join(root, 'site');
export const outFile = path.join(root, 'dist', 'AIIS Homepage.html');
const MIME = { '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

const dataUri = (file) => {
  const ext = path.extname(file).toLowerCase();
  if (!MIME[ext]) throw new Error(`bundle: unsupported asset type ${file}`);
  return `data:${MIME[ext]};base64,${fs.readFileSync(file).toString('base64')}`;
};

/** Replace url(...) targets in CSS (relative to the css file) with data URIs; external and data: URLs stay. */
function inlineCssUrls(css, cssFile) {
  return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (m, q, u) => {
    if (/^(https?:|data:|#|\/\/)/.test(u)) return m;
    return `url("${dataUri(path.resolve(path.dirname(cssFile), u))}")`;
  });
}

export async function buildHtml() {
  let html = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');

  // 1. Local stylesheets -> one <style>, at the position of the first one, in document order.
  const cssTags = [...html.matchAll(/[ \t]*<link rel="stylesheet" href="(css\/[^"]+)">\n?/g)];
  const css = cssTags.map((t) => {
    const f = path.join(siteDir, t[1]);
    return `/* ${t[1]} */\n` + inlineCssUrls(fs.readFileSync(f, 'utf8').trim(), f);
  }).join('\n\n');
  let first = true;
  html = html.replace(/[ \t]*<link rel="stylesheet" href="css\/[^"]+">\n?/g, () => {
    if (!first) return '';
    first = false;
    return `  <style>\n${css.replace(/<\/style/gi, '<\\/style')}\n  </style>\n`;
  });

  // 2. JS: bundle main.js + imports. A module script runs deferred (after the deferred GSAP scripts, before DOMContentLoaded
  //    listeners that are added later), so the inline script defers itself to DOMContentLoaded.
  const result = await build({
    entryPoints: [path.join(siteDir, 'js/main.js')], bundle: true, format: 'iife', minify: false, write: false,
    target: 'es2022', legalComments: 'none', charset: 'utf8', logLevel: 'silent',
  });
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const inline = `  <script>\n(function () {\n"use strict";\nfunction boot() {\n${js}}\nif (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();\n})();\n  </script>`;
  html = html.replace('<script type="module" src="js/main.js"></script>', () => inline);

  // 3. Local images in HTML attributes -> data URIs. An <img src> used more than once (the crest appears in six slots) would
  //    repeat the same base64 each time, so its data URI is written once, on one <img>, and a small script at the end of <body> copies it to the others
  //    while the page is parsed. Width/height attributes, alt text and link names are untouched.
  const uses = {};
  for (const m of html.matchAll(/<img\b[^>]*?\bsrc="(assets\/[^"]+)"/g)) uses[m[1]] = (uses[m[1]] || 0) + 1;
  const shared = Object.keys(uses).filter((u) => uses[u] > 1);
  // The carrier of each shared image (the desktop header logo when it is one, else the first use) keeps a real src, so it paints
  // without script; the other uses get theirs copied from it by a script at the end of <body>.
  const carrierOf = {};
  html = html.replace(/<img\b[^>]*>/g, (tag) => {
    const m = /\bsrc="(assets\/[^"]+)"/.exec(tag);
    if (!m || !shared.includes(m[1])) return tag;
    const id = shared.indexOf(m[1]);
    if (carrierOf[id] === undefined && (/data-k="header-logo-img"/.test(tag) || !html.includes('data-k="header-logo-img"'))) carrierOf[id] = true;
    else return tag.replace(m[0], `data-inline-src="${id}"`);
    return tag.replace(m[0], `src="${dataUri(path.join(siteDir, m[1]))}" data-inline-carrier="${id}"`);
  });
  html = html.replace(/\b(src|poster|href)="((?:assets)\/[^"]+)"/g, (m, attr, u) => `${attr}="${dataUri(path.join(siteDir, u))}"`);
  if (shared.length) {
    // One tiny script at the very end of <body>: it runs while the page is still being parsed (all the <img> tags above it exist),
    // so the logos are filled as soon as they are parsed and never wait for DOMContentLoaded, which waits for the deferred CDN scripts.
    const fill = `  <script>\n(function () {\n  var els = document.querySelectorAll("img[data-inline-src]");\n  for (var i = 0; i < els.length; i++) {\n    var c = document.querySelector('img[data-inline-carrier="' + els[i].getAttribute("data-inline-src") + '"]');\n    if (c) els[i].src = c.getAttribute("src");\n  }\n})();\n  </script>\n`;
    html = html.replace('</body>', () => fill + '</body>');
  }
  return html;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const html = await buildHtml();
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html);
  console.log(`wrote ${path.relative(root, outFile)} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
}
