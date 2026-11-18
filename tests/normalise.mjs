// Per-section copy-drift normalisers, shared by the section tests and tests/page.test.mjs so the whole-page test applies EXACTLY
// the same rules (no looser global rule). Each normaliser takes a Measurement, returns a clone, and touches only its own section's keys.

// ---- promises ---------------------------------------------------------------------------------
// Row-1 copy length changes the statement's line count (and so every later y) below 1000 px, where the statement is in the flow.
// Inner keys are compared relative to their own row container, and below 1000 px the statement's own height is taken out of the
// container / photo / figure / lines / root heights and of later rows' offsets.
export function normalisePromises(m, width) {
  const c = structuredClone(m);
  const k = c.keys;
  const flow = width < 1000;
  let above = 0; // statement heights of the rows above
  for (const n of [1, 2, 3]) {
    const cont = k[`promise${n}-container`], head = k[`promise${n}-heading`];
    if (!cont || !head) continue;
    const base = cont.rel.y, hh = flow ? head.box.h : 0;
    for (const key of Object.keys(k)) {
      if (!key.startsWith(`promise${n}-`) || key === `promise${n}-container` || !k[key]) continue;
      k[key].rel.y -= base;
      if (/-(photo|figure|lines)$/.test(key)) k[key].rel.y -= hh;
    }
    cont.rel.y -= above; cont.box.h -= hh;
    above += hh;
  }
  if (k['promises-root']) k['promises-root'].box.h -= above;
  return c;
}

// ---- learning ---------------------------------------------------------------------------------
// The statement and the three column texts are AIIS copy, so their line counts differ from Shady Side's. Each side takes its own
// copy-driven heights out: the statement height from every later y and the root; a column's title + text block from the column
// height; the columns box and the root lose the max (row layout, >= 1000 px) or the sum (stacked) of those blocks.
// Shady Side's per-column title/text heights are measured on the live page (the ref JSON holds only column 1).
export const LEARNING_SSA_COLS = {
  1440: [[76.8125, 216], [76.8125, 216], [76.8125, 216]],
  768: [[24, 147], [24, 126], [24, 126]],
  375: [[24, 147], [24, 126], [24, 126]],
};
const AFTER_STATEMENT = /^learning-(panel|title|title-text|video|video-frame|video-control|columns|col1|col1-icon|col1-title|col1-text|lines-bottom)$/;
export function normaliseLearning(m, width, blocks) {
  const c = structuredClone(m);
  const k = c.keys;
  const row = width >= 1000;
  const head = k['learning-heading'].box.h;
  const copy = row ? Math.max(...blocks) : blocks.reduce((a, b) => a + b, 0);
  for (const key of Object.keys(k)) if (k[key] && AFTER_STATEMENT.test(key)) k[key].rel.y -= head;
  k['learning-col1'].box.h -= blocks[0];
  k['learning-columns'].box.h -= copy;
  k['learning-lines-bottom'].rel.y -= copy;
  k['learning-root'].box.h -= head + copy;
  return c;
}
export const ssaLearningBlocks = (width) => LEARNING_SSA_COLS[width].map(([t, p]) => t + p);
/** AIIS column title + text heights, measured in the page. */
export const aiisLearningBlocks = (page) => page.evaluate(() => [...document.querySelectorAll('.learning__col')].map((c) =>
  c.querySelector('h2').getBoundingClientRect().height + c.querySelector('p').getBoundingClientRect().height));

// ---- teachers ---------------------------------------------------------------------------------
// The statement is AIIS copy: each side's statement-block height comes out of everything below it; the statement, its marker and
// the icon stay compared on their own axes.
const NOT_AFTER = /^teachers-(root|heading|heading-mark|heading-icon)$/;
export function normaliseTeachers(m) {
  const c = structuredClone(m);
  const k = c.keys, head = k['teachers-heading'].box.h;
  for (const key of Object.keys(k)) if (k[key] && key.startsWith('teachers-') && !NOT_AFTER.test(key)) k[key].rel.y -= head;
  k['teachers-root'].box.h -= head;
  return c;
}

// ---- footer -----------------------------------------------------------------------------------
// AIIS has ONE campus block where Shady Side has four, and a one-line legal notice where Shady Side has a three-line one.
//  - campuses: the row stack (2 rows at 768, 4 at 375) is reduced to one row; the difference comes out of every later y and the root;
//  - links: 6 AIIS labels instead of 7 can wrap into fewer lines: its own height comes out of every later y and the root;
//  - legal: its own height comes out of the root height (the notice is the last block);
//  - social: SSA has 5 icons, AIIS 4 -> SSA geometry reduced by exactly one pitch (anything else fails on x or w).
const AFTER_CAMPUSES = /^footer-(links|link1|social|social1|legal)$/;
const AFTER_LINKS = /^footer-(social|social1|legal)$/;
export function normaliseFooter(m, width) {
  const c = structuredClone(m), k = c.keys;
  const oneRow = k['footer-campus1'].box.h + (width < 800 ? 40 : 0);
  const delta = k['footer-campuses'].box.h - oneRow;
  k['footer-campuses'].box.h = oneRow;
  for (const key of Object.keys(k)) if (AFTER_CAMPUSES.test(key)) k[key].rel.y -= delta;
  const soc = k['footer-social'], pitch = (soc.box.w + 10) / 5, shift = width >= 1000 ? pitch : pitch / 2;
  if (soc.box.w === 240) {
    soc.box.w -= pitch; soc.rel.x += shift;
    k['footer-social1'].rel.x += shift;
  }
  const linksH = k['footer-links'].box.h;
  for (const key of Object.keys(k)) if (AFTER_LINKS.test(key)) k[key].rel.y -= linksH;
  k['footer-links'].box.h = 0;
  k['footer-root'].box.h -= delta + linksH + k['footer-legal'].box.h;
  return c;
}

/** Apply every section's normaliser. `learningBlocks` = that side's column block heights. */
export function normaliseAll(m, width, learningBlocks) {
  return normaliseFooter(normaliseTeachers(normaliseLearning(normalisePromises(m, width), width, learningBlocks)), width);
}

/** In-flow section roots in document order. */
export const SECTION_ORDER = ['hero', 'news', 'promises', 'divisions', 'learning', 'teachers', 'values', 'closing', 'footer'];
