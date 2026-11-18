// tests/site-data.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSite, slugForPath, outFileForPath, groupFor, navPaths, isPlanned } from '../tools/lib/site-data.mjs';

const site = loadSite();
test('site_json_has_stage1_fields', () => {
  assert.equal(site.origin, 'https://www.aiiskwt.com');
  assert.equal(site.labels.inSection, 'In this section');
  assert.equal(site.labels.formNotice, 'This form is not connected yet');
  assert.ok(site.pending.includes('/web/category/*'));
  assert.equal(site.menu.length, 5);
});
test('slug_and_outfile_for_path', () => {
  assert.equal(slugForPath('/form/contact-the-best-indian-school-in-kuwait'), 'form--contact-the-best-indian-school-in-kuwait');
  assert.equal(outFileForPath('/web/single-galleries/87'), 'web/single-galleries/87.html');
  assert.equal(outFileForPath('/'), 'index.html');
});
test('group_for_path', () => {
  assert.equal(groupFor(site, '/principals-message').title, 'ABOUT US');
  assert.equal(groupFor(site, '/soccer').title, 'AMENITIES');
  assert.equal(groupFor(site, '/web/gallery').title, 'QUICK LINKS');
  assert.equal(groupFor(site, '/why-aiis'), null);
});
test('planned_paths', () => {
  assert.ok(navPaths(site).has('/celebrations'));
  assert.ok(isPlanned(site, '/web/category/83'));
  assert.ok(!isPlanned(site, '/celebration'));
});
