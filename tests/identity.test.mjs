// Identity guard: the school is "Aspire Indian International School" (AIIS). An earlier step invented a different expansion.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAME = 'Aspire Indian International School';
const TEXT_EXT = /\.(html|css|js|mjs|json|md|txt|svg|webmanifest)$/i;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

test('page_school_name_correct', () => {
  const files = [...walk(path.join(root, 'site')).filter((f) => TEXT_EXT.test(f)), path.join(root, 'dist/AIIS Homepage.html'), path.join(root, 'docs/handover.md')];
  for (const f of files) assert.ok(!/ittihad/i.test(fs.readFileSync(f, 'utf8')), `${path.relative(root, f)} contains the invented name`);
  // Binary assets must not carry it either (file names).
  for (const f of walk(path.join(root, 'site'))) assert.ok(!/ittihad/i.test(f), `file name: ${f}`);

  for (const f of ['site/index.html', 'dist/AIIS Homepage.html']) {
    const html = fs.readFileSync(path.join(root, f), 'utf8');
    // Every full spelling of the name is exactly the real name.
    assert.ok((html.match(/International School/g) || []).length >= 7, `${f}: expected the name in title, aria-labels, alt and copyright`);
    assert.equal((html.match(/International School/g) || []).length, (html.match(/Aspire Indian International School/g) || []).length, `${f}: every "International School" is preceded by "Aspire Indian"`);
    assert.match(html, /<title>\s*Aspire Indian International School\s*<\/title>/);
    const labels = [...html.matchAll(/aria-label="([^"]*International School[^"]*)"/g)].map((m) => m[1]);
    assert.ok(labels.length >= 4, `${f}: logo link labels`);
    for (const l of labels) assert.equal(l, `${NAME} home`);
    const alts = [...html.matchAll(/\balt="([^"]*International School[^"]*)"/g)].map((m) => m[1]);
    assert.ok(alts.length >= 2, `${f}: alt texts`);
    for (const a of alts) assert.ok(a === NAME || a === `${NAME} crest`, `alt "${a}"`);
    // The motto, read back from the hero heading (three .word spans), exactly "Igniting Young Minds".
    const h = /<h1 class="hero__title"[^>]*>([\s\S]*?)<\/h1>/.exec(html);
    assert.ok(h, `${f}: hero heading`);
    const motto = h[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    assert.equal(motto.toLowerCase(), 'Igniting Young Minds'.toLowerCase(), `${f}: motto`);
    assert.equal(motto, 'IGNITING YOUNG MINDS');
    assert.match(html, /&copy; 2026 Aspire Indian International School\. All rights reserved\./);
  }
});
