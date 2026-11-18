// Extracts every user-visible string from site/index.html (static markup, JavaScript off): text nodes, alt, aria-label, title,
// placeholder, plus the <title>. Used by the approved-strings guard (tests/approved-strings.test.mjs).
import { chromium } from 'playwright';
import { startServer } from './helpers.mjs';

const collapse = (s) => s.replace(/\s+/g, ' ').trim();

export async function extractStrings() {
  const port = await startServer();
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ javaScriptEnabled: false })).newPage();
    await page.route(/^(?!http:\/\/127\.0\.0\.1)/, (r) => r.abort()); // no network needed: this is markup only
    await page.goto(`http://127.0.0.1:${port}/?nointro`, { waitUntil: 'domcontentloaded' });
    const raw = await page.evaluate(() => {
      const out = { text: [], attr: [], placeholder: [] };
      const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
        out.text.push(n.nodeValue);
      }
      for (const el of document.querySelectorAll('[alt],[aria-label],[title],[placeholder]'))
        for (const a of ['alt', 'aria-label', 'title', 'placeholder']) if (el.hasAttribute(a)) out.attr.push(el.getAttribute(a));
      out.placeholder = [...document.querySelectorAll('[data-placeholder]')].map((e) => e.textContent);
      return out;
    });
    const strings = new Set([...raw.text, ...raw.attr].map(collapse).filter(Boolean));
    const placeholders = new Set(raw.placeholder.map(collapse).filter(Boolean));
    return { strings, placeholders };
  } finally { await browser.close(); }
}
