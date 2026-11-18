import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('hygiene_no_reference_images_tracked', () => {
  const tracked = execFileSync('git', ['ls-files', 'docs/reference'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  const images = tracked.filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f));
  assert.deepEqual(images, [], 'reference screenshots and comparison sheets must stay untracked');
  const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.ok(ignore.includes('docs/reference/screenshots/') && ignore.includes('docs/reference/compare-'), 'gitignored');
});

test('hygiene_live_reference_tests_are_opt_in', () => {
  // Any test file that reaches the reference site's pages must gate that on REF_LIVE.
  const offenders = fs.readdirSync(path.join(root, 'tests')).filter((f) => f.endsWith('.test.mjs') && f !== 'hygiene.test.mjs')
    .filter((f) => { const s = fs.readFileSync(path.join(root, 'tests', f), 'utf8'); return /prepareSsa|shadysideacademy\.org\//.test(s) && !s.includes('REF_LIVE'); });
  assert.deepEqual(offenders, []);
});
