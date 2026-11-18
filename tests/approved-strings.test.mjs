// Guard against the wrong-school-name class of defect: every user-visible string in site/index.html (text nodes, alt, aria-label,
// title, placeholder, <title>) must be in tests/approved-strings.json, which is edited by hand. A new or changed string fails here
// until someone reads it and adds it, in the right group. Entries that left the page must be removed too.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stopServer } from './helpers.mjs';
import { extractStrings } from './strings.mjs';

after(stopServer);
const approved = JSON.parse(fs.readFileSync('tests/approved-strings.json', 'utf8'));
const KNOWN_GROUPS = ['spec', 'ui', 'placeholders'];

test('strings_every_page_string_is_approved_and_no_entry_is_stale', async () => {
  assert.deepEqual(Object.keys(approved).sort(), [...KNOWN_GROUPS].sort());
  const { strings, placeholders } = await extractStrings();
  const all = new Set(KNOWN_GROUPS.flatMap((g) => approved[g]));
  assert.deepEqual([...strings].filter((s) => !all.has(s)), [], 'strings on the page that nobody approved (add them to tests/approved-strings.json after reading them)');
  assert.deepEqual([...all].filter((s) => !strings.has(s)), [], 'approved strings that are no longer on the page (remove them)');
  assert.deepEqual([...placeholders].sort(), [...approved.placeholders].sort(), 'the placeholders group must equal the data-placeholder set');
  for (const g of KNOWN_GROUPS) assert.equal(new Set(approved[g]).size, approved[g].length, `${g}: duplicate entries`);
});

test('strings_the_school_name_is_only_ever_spelled_correctly', async () => {
  const { strings } = await extractStrings();
  for (const s of strings) if (/international school/i.test(s)) assert.ok(s.includes('Aspire Indian International School'), `"${s}"`);
});
