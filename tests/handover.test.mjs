import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const handover = fs.readFileSync(path.join(root, 'docs/handover.md'), 'utf8');
const ledger = path.join(root, '.superpowers/sdd/2026-10-08-aiis-homepage-exact/progress.md');

test('handover_lists_all_rulings_and_links', () => {
  assert.ok(handover.includes('https://claude.ai/design/p/d42fa33a-18d5-4ade-9ffb-73922849aed4'));
  const links = [...handover.matchAll(/\]\(([^)#]+)\)/g)].map((m) => m[1]).filter((l) => !/^https?:/.test(l));
  assert.ok(links.some((l) => l.endsWith('image-slots.md')) && links.some((l) => l.endsWith('SOURCE.md')));
  for (const l of links) assert.ok(fs.existsSync(path.resolve(root, 'docs', l)), `broken link ${l}`);
  const stated = Number(/Rulings recorded: \*\*(\d+)\*\*/.exec(handover)?.[1]);
  const entries = [...handover.matchAll(/^- \*\*R\d+\.\*\*/gm)].length;
  assert.ok(stated > 0);
  assert.equal(entries, stated, 'one entry per stated ruling');
  // The ledger is local-only (.superpowers is gitignored): check it when present. Append new rulings here and bump the count.
  if (fs.existsSync(ledger)) {
    const n = fs.readFileSync(ledger, 'utf8').split('\n').filter((l) => l.includes('Ruling:')).length;
    assert.equal(n, stated, `ledger has ${n} Ruling: lines; handover states ${stated}`);
  }
  assert.ok(!/shady side's? (own )?text/i.test(handover));
});
