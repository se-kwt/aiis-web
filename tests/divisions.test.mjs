import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openPage, measureAiis, compareKey, loadRef, stopServer } from './helpers.mjs';
import { loadMap } from '../tools/measure.mjs';

const browsers = [];
const open = async (w, o) => { const r = await openPage(w, o); browsers.push(r.browser); return r; };
after(async () => { await Promise.all(browsers.map((b) => b.close())); await stopServer(); });

const map = loadMap();
const divisionKeys = Object.keys(map).filter((k) => k.startsWith('divisions-'));

for (const width of [1440, 768, 375]) {
  test(`divisions_boxes_match_ref @${width}`, async () => {
    const { page } = await open(width);
    const aiis = await measureAiis(page, width);
    const ref = loadRef(width);
    const bad = divisionKeys.flatMap((k) => compareKey(k, aiis, ref));
    assert.deepEqual(bad, []);
    const missing = divisionKeys.filter((k) => !(map[k].hiddenAt || []).includes(width) && !aiis.keys[k]);
    assert.deepEqual(missing, []);
  });
}

// Copy table rows "Divisions heading" and "Division 1/2/3" from the spec.
const spec = fs.readFileSync(new URL('../docs/superpowers/specs/2026-10-08-aiis-homepage-exact-design.md', import.meta.url), 'utf8');
const cell = (label) => spec.split('\n').find((l) => l.startsWith(`| ${label} |`)).split('|')[3].trim();
const heading = cell('Divisions heading').split(' / ').join(' ');
const divisions = [1, 2, 3].map((n) => {
  const [verb, grades, school, back] = cell(`Division ${n}`).split(' · ');
  return { verb, grades, school, back: back.replace(/^"|"$/g, '') };
});

test('divisions_copy_exact', async () => {
  const { page } = await open(1440);
  const got = await page.evaluate(() => {
    const norm = (s) => s.replace(/\s+/g, ' ').trim();
    return {
      heading: norm(document.querySelector('[data-k="divisions-heading"]').textContent),
      cards: [...document.querySelectorAll('[data-flip]')].map((c) => ({
        verb: norm(c.querySelector('.flipcard__front .flipcard__verb').textContent),
        grades: norm(c.querySelector('.flipcard__front .flipcard__grades').textContent),
        school: norm(c.querySelector('.flipcard__front .flipcard__school').textContent),
        backVerb: norm(c.querySelector('.flipcard__back .flipcard__verb').textContent),
        backGrades: norm(c.querySelector('.flipcard__back .flipcard__grades').textContent),
        backSchool: norm(c.querySelector('.flipcard__back .flipcard__school').textContent),
        back: norm(c.querySelector('.flipcard__back .flipcard__text').textContent),
      })),
    };
  });
  assert.equal(got.heading, heading);
  assert.equal(got.cards.length, 3);
  divisions.forEach((d, i) => {
    const c = got.cards[i];
    assert.deepEqual([c.verb, c.grades, c.school], [d.verb, d.grades, d.school], `front ${i + 1}`);
    assert.deepEqual([c.backVerb, c.backGrades, c.backSchool], [d.verb, d.grades, d.school], `back ${i + 1}`);
    assert.equal(c.back, d.back, `back text ${i + 1}`);
  });
});

test('flip_toggle_click_and_keyboard', async () => {
  const { page } = await open(1440);
  const card = page.locator('[data-flip]').first();
  const front = card.locator('[data-flip-toggle]').first();
  const state = () => card.evaluate((c) => {
    const btns = [...c.querySelectorAll('[data-flip-toggle]')];
    const back = c.querySelector('.flipcard__back'), fr = c.querySelector('.flipcard__front');
    return {
      expanded: btns.map((b) => b.getAttribute('aria-expanded')),
      controls: btns.map((b) => b.getAttribute('aria-controls') === back.id && !!back.id),
      backInert: back.inert, frontInert: fr.inert,
      active: c.classList.contains('active'),
      container: document.querySelector('.divisions__grid').classList.contains('cols-active'),
      focusInBack: back.contains(document.activeElement),
      focusInFront: fr.contains(document.activeElement),
    };
  });

  let s = await state();
  assert.deepEqual(s.expanded, ['false', 'false']);
  assert.ok(s.controls.every(Boolean));
  assert.equal(s.backInert, true); assert.equal(s.frontInert, false);

  // click opens: back face reachable, front hidden from AT, others dim
  await front.click();
  s = await state();
  assert.deepEqual(s.expanded, ['true', 'true']);
  assert.equal(s.backInert, false); assert.equal(s.frontInert, true);
  assert.ok(s.active && s.container && s.focusInBack);
  await page.waitForTimeout(700);
  assert.equal(await card.locator('.flipcard__text').isVisible(), true);
  const t = await card.locator('.flipcard__flipper').evaluate((e) => getComputedStyle(e).transform);
  assert.match(t, /^matrix3d/); // rotateY(180deg)
  assert.equal(await card.locator('.flipcard__back .flipcard__text').innerText().then((x) => x.replace(/\s+/g, ' ').trim().toUpperCase()), divisions[0].back.toUpperCase());

  // Space on the (focused) close button flips back
  await page.keyboard.press(' ');
  s = await state();
  assert.deepEqual(s.expanded, ['false', 'false']);
  assert.equal(s.backInert, true); assert.equal(s.frontInert, false);
  assert.ok(!s.active && !s.container && s.focusInFront);

  // Space and Enter on the front toggle open it; Escape closes it
  await page.keyboard.press(' ');
  assert.deepEqual((await state()).expanded, ['true', 'true']);
  await page.keyboard.press('Escape');
  assert.deepEqual((await state()).expanded, ['false', 'false']);
  await page.keyboard.press('Enter');
  assert.deepEqual((await state()).expanded, ['true', 'true']);
});

test('flip_only_one_card_open', async () => {
  const { page } = await open(1440);
  const cards = page.locator('[data-flip]');
  await cards.nth(0).locator('[data-flip-toggle]').first().click();
  await cards.nth(1).locator('[data-flip-toggle]').first().click();
  const active = await cards.evaluateAll((cs) => cs.map((c) => c.classList.contains('active')));
  assert.deepEqual(active, [false, true, false]);
  const exp = await cards.evaluateAll((cs) => cs.map((c) => c.querySelector('[data-flip-toggle]').getAttribute('aria-expanded')));
  assert.deepEqual(exp, ['false', 'true', 'false']);
});

test('flip_reduced_motion_is_instant', async () => {
  const { page } = await open(1440, { reducedMotion: true });
  const card = page.locator('[data-flip]').first();
  const dur = await card.locator('.flipcard__flipper').evaluate((e) => getComputedStyle(e).transitionDuration);
  assert.match(dur, /^0s(, 0s)*$/);
  await card.locator('[data-flip-toggle]').first().click();
  const t = await card.locator('.flipcard__flipper').evaluate((e) => getComputedStyle(e).transform);
  assert.match(t, /^matrix3d/);
});
