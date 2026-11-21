#!/usr/bin/env node
// Migrates the 36 remaining inner pages (every page/section in content/site.json's
// menu except `our-story` and `chairmans-message`, which earlier tasks already
// handle) from the hand-built baseline HTML (git tag `baseline-static-site`) into
// `content/pages/<slug>.md` files that `src/_layouts/page.njk` (built in Task 6)
// can render.
//
// For each slug this script:
//   1. Reads `git show baseline-static-site:site/<slug>.html`.
//   2. Extracts the `<article class="page-content">...</article>` region and the
//      `page-hero` title/crumb/lead.
//   3. Walks the content region's top-level children in document order and
//      converts each into one `blocks` entry (richtext / image / features / points).
//   4. Writes `content/pages/<slug>.md` with YAML front matter and no markdown
//      body (all content lives in `blocks`, matching Task 6's chairmans-message.md).
//
// Block-splitting approach
// -------------------------
// Every `richtext` block's `body` is the *exact* substring of the baseline HTML
// for that element (its own tag(s), attributes and inner markup), copied
// byte-for-byte, for two reasons discovered while surveying all 36 pages by hand:
//
//  - markdown-it (configured with `html: true`) recognises the common inner-page
//    tags (p, h2, h3, ul, ol, li, div, figure) as CommonMark "HTML blocks" and
//    copies them through completely unprocessed -- including their exact
//    whitespace/indentation -- when the block's opening tag appears on its own
//    line. That is the *only* way to reproduce some baseline shapes byte-for-byte:
//      - a handful of pages (vision-mission, fees-schedules, admission-process,
//        csr-reports, mandatory-public-disclosure) have a plain `<ul>`/`<ol>` (not
//        page-features/page-points) or a `<div style="overflow-x:auto"><table>...`
//        fee-schedule table, hand-indented in a way markdown's own dash-list
//        renderer cannot reproduce (markdown-it emits flat, unindented `<li>`
//        lines; the baseline's are hand-indented).
//      - two pages (aspire-indian-international-school-timings,
//        weekly-test-curriculum, subject-enrichment-activities) have a `<p
//        data-placeholder="...">` -- the richtext block type has no dedicated
//        way to emit that attribute, so the paragraph's exact tag is carried
//        through verbatim instead.
//      - a `<figure class="tp" data-temp-photo>` placeholder photo appears in
//        the baseline in three different hand-authored indentation shapes (see
//        `processFigure` below); only one of the three matches page.njk's
//        dedicated `image` block type's hardcoded indentation, so the other two
//        are carried through as richtext blocks instead.
//      - a `<ul class="page-points">` list appears in two different
//        hand-authored indentation shapes (8/10/8-space, matching page.njk's
//        hardcoded `points` block template; and 10/12/10-space, which doesn't).
//        Every `page-points` occurrence on the ACADEMICS-section pages
//        (kindergarten-school, student-leadership-program, curriculum-choices,
//        best-igcse-cambridge-school-in-kuwait) uses the first shape; every
//        occurrence on the SCHOOL LIFE-section pages (clubs,
//        student-article-magazine, health-wellness, achievements,
//        celebrations, aspire-indian-international-school-timings,
//        special-assemblies) plus `classrooms` uses the second. As with
//        figures, this script verifies -- per list, by rendering what the
//        dedicated `points` block type would actually produce and comparing it
//        to the baseline's exact bytes -- rather than assuming either shape,
//        and falls back to a richtext block carrying the baseline's exact `<ul
//        class="page-points">...</ul>` markup through unchanged when the
//        hardcoded template's shape doesn't match. `page-features` lists were
//        checked the same way across all occurrences and always match
//        page.njk's hardcoded shape, so no fallback was needed there in
//        practice, but the same verification is applied defensively.
//      Both of the above are pre-existing page.njk hardcoded-indentation
//      limitations uncovered by actually exercising those two block types
//      against real baseline pages for the first time in this task (the one
//      page Task 6 built page.njk against, chairmans-message, uses neither the
//      `image` nor the `points`/`features` block types) -- not something this
//      script's block-splitting can or should work around by changing
//      page.njk; see task-11-report.md.
//  - Even for a plain, attribute-free `<p>`/`<h2>`/`<h3>` with no special
//    whitespace needs, copying the literal baseline text (inside the tag) as the
//    block's `body` -- letting markdown-it's normal (non-HTML-block) paragraph/
//    heading rendering regenerate the wrapping tag -- reproduces the baseline
//    exactly, *including* any named HTML entity the baseline already uses
//    (&mdash;, &rsquo;, &ldquo;, &rdquo;, &ndash;, &amp;, &rarr;): markdown-it
//    decodes the entity, and eleventy.config.js's `markdown`/`markdownInline`
//    filters re-encode the handful of typographic characters they cover back to
//    the same named entity on the way out, so passing the baseline's entity text
//    through unchanged round-trips byte-for-byte. This script therefore never
//    converts entities to plain ASCII (or vice versa) -- every extracted text
//    fragment is used exactly as it appears in the baseline.
//
// One known, out-of-scope limitation: 6 pages (curriculum-choices, middle-school,
// primary-school, student-leadership-program, subject-enrichment-activities,
// weekly-test-curriculum) have a literal (non-entity) Unicode em dash character
// typed directly into a `<p>`. eleventy.config.js's `reencodeTypographicEntities`
// helper runs a blind find/replace over the *entire* rendered HTML string for a
// handful of typographic characters (including em dash), so *any* occurrence of
// those characters in rendered output -- however it got there, including a raw
// HTML block passthrough -- is unconditionally rewritten to the named entity.
// There is therefore no way to make a `richtext` block (or any other block type)
// reproduce a literal em dash character byte-for-byte; the output will always
// have `&mdash;` where the baseline has the raw character. This is a shared
// eleventy.config.js/page.njk infrastructure limitation, not something
// migrate-pages.mjs's block-splitting can work around -- see task-11-report.md.
//
// Run: node tools/migrate-pages.mjs (also wired up as `npm run migrate:pages`).

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import MarkdownIt from "markdown-it";

const BASELINE_REF = "baseline-static-site";
const SITE_JSON_PATH = "content/site.json";
const PAGES_DIR = "content/pages";
const ALREADY_MIGRATED = new Set(["our-story", "chairmans-message"]);

// Mirrors eleventy.config.js's `markdownInline` filter exactly (same MarkdownIt
// options, same typographic re-encode map), so this script can check -- for a
// `points` list item -- whether the dedicated `points` block type (which pipes
// each item through that same filter) would actually reproduce the baseline's
// bytes before committing to that block type. Kept in sync with
// eleventy.config.js by hand; if that file's markdown-it options or
// TYPOGRAPHIC_ENTITIES map ever change, update this copy too.
const verifyMarkdownIt = new MarkdownIt({ html: true, typographer: true });
const TYPOGRAPHIC_ENTITIES = {
  "‘": "&lsquo;",
  "’": "&rsquo;",
  "“": "&ldquo;",
  "”": "&rdquo;",
  "–": "&ndash;",
  "—": "&mdash;",
  " ": "&nbsp;",
  "©": "&copy;",
  "→": "&rarr;",
  "·": "&middot;",
};
const TYPOGRAPHIC_ENTITIES_RE = new RegExp(`[${Object.keys(TYPOGRAPHIC_ENTITIES).join("")}]`, "g");
function reencodeTypographicEntities(html) {
  return html.replace(TYPOGRAPHIC_ENTITIES_RE, (ch) => TYPOGRAPHIC_ENTITIES[ch]);
}
function markdownInline(str) {
  return reencodeTypographicEntities(verifyMarkdownIt.renderInline(String(str)));
}
// Mirrors eleventy.config.js's block-level `markdown` filter the same way,
// for verifying a plain-text richtext body (see `processParagraph`/
// `processHeading` below).
function markdownBlock(str) {
  return reencodeTypographicEntities(verifyMarkdownIt.render(String(str)));
}

// A richtext block whose `body` starts with a tag (carrying baseline markup
// through verbatim via CommonMark's HTML-block passthrough -- see file
// header) needs an explicit trailing "\n": markdown-it's normal
// paragraph/heading rendering always appends one after the block it generates
// (so plain-text bodies get it "for free"), but HTML-block passthrough does
// not add one on its own -- it reproduces exactly the bytes given it, no
// more, no less. Without this, the next block in page.njk's loop runs on
// directly from the raw block's last line with no line break.
function rawHtmlBlockBody(raw) {
  return `${raw}\n`;
}

function getSlugs() {
  const site = JSON.parse(fs.readFileSync(SITE_JSON_PATH, "utf8"));
  const slugs = new Set();
  for (const group of site.menu) {
    for (const link of group.links) {
      if (link.external) continue;
      const slug = link.path.replace(/^\//, "");
      if (!ALREADY_MIGRATED.has(slug)) slugs.add(slug);
    }
  }
  return [...slugs].sort();
}

function readBaseline(slug) {
  return execFileSync("git", ["show", `${BASELINE_REF}:site/${slug}.html`], {
    maxBuffer: 1024 * 1024 * 10,
  }).toString("utf8");
}

// --- hero (title / crumb / lead) -------------------------------------------

// Unlike `crumbLabel`/`lead` (rendered only via `| markdownInline`), the
// front-matter `title` field feeds *two* different consumers that must each
// land on the baseline's exact bytes:
//   - page.njk's `<h1 class="page-hero__title">`, via `| markdownInline`
//     (typographer on, named entities decoded then re-encoded -- see file
//     header).
//   - base.njk's `<title>` tag, via `(title + " | ...") | safe` -- a plain
//     string concatenation with NO markdown filter at all.
// A few pages' baseline bytes turn out to use the *plain* character in the
// `<title>` tag (an ASCII apostrophe, a bare "&") where the `<h1>` uses the
// named-entity form (`&rsquo;`, `&amp;`) for what is otherwise the same
// text -- apparently hand-typed once into each spot. Using the h1's literal
// entity text as the single `title` field (as this script does for every
// other extracted string) would make the `<title>` tag wrong: it has no
// markdown filter to decode that entity back down. Decoding the h1 text's
// named entities back to their plain character for the `title` field alone
// satisfies both consumers at once: the plain-concat `<title>` tag gets the
// plain character verbatim, and `markdownInline`'s typographer re-smartens
// it back into the same named entity for the `<h1>`. This is verified, not
// assumed -- see the two checks in `resolveTitle` below.
function decodeTitleEntities(str) {
  // Plain ASCII forms, not the curly Unicode characters, so that
  // `markdownInline`'s typographer has the same plain input it would get
  // from someone actually typing this title by hand -- it's typographer
  // that re-smartens a plain apostrophe/quote back into the curly form (and
  // `reencodeTypographicEntities` that turns *that* into the named entity);
  // feeding it an already-curly character would skip the step being
  // verified.
  return str
    .replace(/&rsquo;/g, "'").replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"').replace(/&ldquo;/g, '"')
    .replace(/&amp;/g, "&");
}

function resolveTitle(html, h1Title, slug) {
  const titleTagMatch = html.match(/<title>([\s\S]*?) \| Aspire Indian International School<\/title>/);
  if (!titleTagMatch) throw new Error(`${slug}: could not find <title> tag`);
  const titleTagText = titleTagMatch[1];

  // Try the h1's own literal text first (most pages' <title> tag already
  // uses the exact same named-entity text as the <h1>, so this is usually
  // already correct -- and is what every other extracted field uses
  // verbatim), then the decoded/plain form (for the pages where the
  // baseline's <title> tag and <h1> use different escaping of the same
  // text; see the comment above `decodeTitleEntities`). Whichever candidate
  // satisfies *both* consumers byte-for-byte wins.
  for (const candidate of [h1Title, decodeTitleEntities(h1Title)]) {
    if (markdownInline(candidate) === h1Title && candidate === titleTagText) {
      return candidate;
    }
  }

  // Genuinely can't satisfy both consumers from one field value (e.g.
  // `soccer`, whose `<title>` tag says "Soccer" but whose `<h1>` says
  // "Football" -- two different strings, not just different escaping of the
  // same one). page.njk has no second field to hold a distinct `<title>`
  // override, so this is flagged rather than guessed around; see
  // task-11-report.md. Falling back to the h1's own literal text keeps the
  // `<h1>`/breadcrumb correct, at the cost of the `<title>` tag for this page.
  console.error(
    `WARNING: ${slug}: could not resolve a single \`title\` value that matches both the <title> tag ` +
      `(${JSON.stringify(titleTagText)}) and the <h1> (${JSON.stringify(h1Title)}) byte-for-byte. ` +
      `Using the <h1> text; the <title> tag will not match the baseline for this page.`,
  );
  return h1Title;
}

function extractHero(html, slug) {
  const titleMatch = html.match(/<h1 class="page-hero__title">([\s\S]*?)<\/h1>/);
  if (!titleMatch) throw new Error(`${slug}: could not find page-hero__title`);
  const title = resolveTitle(html, titleMatch[1], slug);

  const crumbMatch = html.match(/<p class="page-hero__crumb">([\s\S]*?)<\/p>/);
  if (!crumbMatch) throw new Error(`${slug}: could not find page-hero__crumb`);
  const crumbPrefix = '<a href="/">Home</a> / ';
  if (!crumbMatch[1].startsWith(crumbPrefix)) {
    throw new Error(`${slug}: unexpected crumb shape: ${crumbMatch[1]}`);
  }
  const crumbText = crumbMatch[1].slice(crumbPrefix.length);
  const crumbLabel = crumbText === titleMatch[1] ? null : crumbText;

  const leadMatch = html.match(/<p class="page-hero__lead">([\s\S]*?)<\/p>/);
  const lead = leadMatch ? leadMatch[1] : null;

  return { title, crumbLabel, lead };
}

// --- page-content: split into top-level elements ---------------------------

// Each entry: { kind, raw } where `raw` is the exact source substring for that
// top-level child (tag(s) included), in document order.
function splitTopLevelElements(content, slug) {
  const elements = [];
  let pos = 0;
  const len = content.length;
  while (pos < len) {
    while (pos < len && /\s/.test(content[pos])) pos++;
    if (pos >= len) break;
    const rest = content.slice(pos);
    let kind, closeTag;
    if (rest.startsWith('<figure class="tp" data-temp-photo>')) {
      kind = "figure";
      closeTag = "</figure>";
    } else if (rest.startsWith('<ul class="page-features">')) {
      kind = "ul.page-features";
      closeTag = "</ul>";
    } else if (rest.startsWith('<ul class="page-points">')) {
      kind = "ul.page-points";
      closeTag = "</ul>";
    } else if (rest.startsWith("<ul>")) {
      kind = "ul.plain";
      closeTag = "</ul>";
    } else if (rest.startsWith("<ol>")) {
      kind = "ol.plain";
      closeTag = "</ol>";
    } else if (/^<div(\s[^>]*)?>/.test(rest)) {
      kind = "div";
      closeTag = "</div>";
    } else if (rest.startsWith("<h2>")) {
      kind = "h2";
      closeTag = "</h2>";
    } else if (rest.startsWith("<h3>")) {
      kind = "h3";
      closeTag = "</h3>";
    } else if (/^<p(\s[^>]*)?>/.test(rest)) {
      kind = "p";
      closeTag = "</p>";
    } else {
      throw new Error(`${slug}: unrecognized top-level element at offset ${pos}: ${JSON.stringify(rest.slice(0, 80))}`);
    }
    const closeIdx = rest.indexOf(closeTag);
    if (closeIdx === -1) throw new Error(`${slug}: unterminated ${kind} element: ${JSON.stringify(rest.slice(0, 80))}`);
    const end = closeIdx + closeTag.length;
    elements.push({ kind, raw: rest.slice(0, end) });
    pos += end;
  }
  return elements;
}

// --- figure classification --------------------------------------------------

// page.njk's dedicated `image` block type renders a src-less placeholder photo
// with this exact hardcoded indentation (8 / 10 / 8 spaces). Surveying all 26
// `<figure class="tp" data-temp-photo>` occurrences across the 36 pages found
// two other hand-authored indentation shapes in the baseline (a single-line
// inline form, and a 10/12/10-indented standalone form) that this fixed
// template cannot reproduce. Rather than guess, this computes the exact string
// page.njk would emit for a given description and compares it to the baseline's
// actual bytes -- only an exact match uses the `image` block type; anything
// else (verified not to occur any other way across these 36 pages) falls back
// to a richtext block carrying the baseline's exact figure markup through
// unchanged (CommonMark HTML-block passthrough -- see file header).
function imageBlockTemplateOutput(description) {
  return `<figure class="tp" data-temp-photo>\n          <span class="sr">${description}</span>\n        </figure>`;
}

function processFigure(raw, slug) {
  const descMatch = raw.match(/<span class="sr">([\s\S]*?)<\/span>/);
  if (!descMatch) throw new Error(`${slug}: figure without a .sr description: ${raw}`);
  const description = descMatch[1];
  if (raw === imageBlockTemplateOutput(description)) {
    return { type: "image", description, src: null };
  }
  // Doesn't match the image block type's hardcoded indentation -- carry the
  // exact baseline markup through as a richtext block instead.
  return { type: "richtext", body: rawHtmlBlockBody(raw) };
}

// --- features / points ------------------------------------------------------

// page.njk's dedicated `features` block type renders with this exact hardcoded
// indentation (8 / 10 / 8 spaces) and passes each item's heading/text through
// with no filter at all (`| safe` only) -- so they must be used completely
// verbatim, whatever they contain.
function featuresBlockTemplateOutput(items) {
  const li = items
    .map((item) => `          <li class="page-features__item"><h3>${item.heading}</h3><p>${item.text}</p></li>\n`)
    .join("");
  return `<ul class="page-features">\n${li}        </ul>`;
}

function processFeatures(raw, slug) {
  const items = [];
  const liRe = /<li class="page-features__item"><h3>([\s\S]*?)<\/h3><p>([\s\S]*?)<\/p><\/li>/g;
  let m;
  while ((m = liRe.exec(raw))) items.push({ heading: m[1], text: m[2] });
  if (items.length === 0) throw new Error(`${slug}: page-features list with no recognizable items: ${raw}`);
  if (featuresBlockTemplateOutput(items) === raw) {
    return { type: "features", items };
  }
  // Doesn't match the features block type's hardcoded indentation (not
  // observed across any of the 36 pages, but checked defensively) -- carry
  // the exact baseline markup through as a richtext block instead.
  return { type: "richtext", body: rawHtmlBlockBody(raw) };
}

// page.njk's dedicated `points` block type renders with this exact hardcoded
// indentation (8 / 10 / 8 spaces) and passes each item through
// `markdownInline`.
function pointsBlockTemplateOutput(items) {
  const li = items.map((item) => `          <li class="page-points__item">${markdownInline(item)}</li>\n`).join("");
  return `<ul class="page-points">\n${li}        </ul>`;
}

function processPoints(raw, slug) {
  const items = [];
  const liRe = /<li class="page-points__item">([\s\S]*?)<\/li>/g;
  let m;
  while ((m = liRe.exec(raw))) items.push(m[1]);
  if (items.length === 0) throw new Error(`${slug}: page-points list with no recognizable items: ${raw}`);
  if (pointsBlockTemplateOutput(items) === raw) {
    return { type: "points", items };
  }
  // Doesn't match the points block type's hardcoded 8/10/8 indentation (the
  // SCHOOL LIFE-section pages and `classrooms` hand-authored this at
  // 10/12/10 instead) -- carry the exact baseline markup through as a
  // richtext block instead.
  return { type: "richtext", body: rawHtmlBlockBody(raw) };
}

// --- p / h2 / h3 -------------------------------------------------------------

// A plain, attribute-free p/h2/h3 becomes a richtext block whose `body` is just
// the inner text (markdown-it regenerates the wrapping tag; `##`/`###` for
// h2/h3) -- *if* rendering that plain-text body actually reproduces the
// baseline's exact bytes. It usually does (see file header), but a second,
// separate hand-authoring inconsistency surfaced while verifying every page's
// build output against its baseline: several pages (the AMENITIES/sports
// pages -- auditorium, badminton, cricket, basket-ball, soccer, open-ground,
// swimming-pool -- and a few others) type a plain ASCII apostrophe (e.g.
// "AIIS's", "student's") instead of the `&rsquo;`/curly-quote form used
// elsewhere. markdown-it's typographer (`typographer: true`) unconditionally
// "smartens" a plain ASCII apostrophe into a curly one, which
// `reencodeTypographicEntities` then re-encodes to `&rsquo;` -- so the
// plain-text reconstruction would *introduce* an entity the baseline doesn't
// have. (A raw Unicode dash character has the opposite, unfixable problem --
// see file header -- but a plain ASCII apostrophe isn't one of the
// characters `reencodeTypographicEntities` touches, so simply *not* running
// it through typographer-sensitive inline tokenization, i.e. carrying the
// original tag through as a raw HTML block instead, reproduces it exactly.)
// Each heading/paragraph is therefore verified individually -- by actually
// rendering the candidate plain-text body through the same markdown-it
// pipeline eleventy.config.js's filter uses and comparing it to the
// baseline's exact bytes -- rather than assumed to round-trip.
function processHeading(raw, level) {
  const openLen = 4; // "<h2>" / "<h3>" are both 4 chars
  const closeLen = 5; // "</h2>" / "</h3>"
  const inner = raw.slice(openLen, raw.length - closeLen);
  const prefix = level === 2 ? "## " : "### ";
  const candidate = `${prefix}${inner}`;
  if (markdownBlock(candidate) === `${raw}\n`) {
    return { type: "richtext", body: candidate };
  }
  return { type: "richtext", body: rawHtmlBlockBody(raw) };
}

function processParagraph(raw) {
  const m = raw.match(/^<p(\s[^>]*)?>([\s\S]*)<\/p>$/);
  const attrs = m[1] || "";
  const inner = m[2];
  if (attrs.trim() === "" && markdownBlock(inner) === `${raw}\n`) {
    return { type: "richtext", body: inner };
  }
  // Either has attributes (e.g. data-placeholder) or the plain-text
  // reconstruction doesn't round-trip byte-for-byte -- carry the exact tag
  // through instead.
  return { type: "richtext", body: rawHtmlBlockBody(raw) };
}

// --- per-page conversion -----------------------------------------------------

function convertPage(slug) {
  const html = readBaseline(slug);
  const { title, crumbLabel, lead } = extractHero(html, slug);

  const articleMatch = html.match(/<article class="page-content">([\s\S]*?)<\/article>/);
  if (!articleMatch) throw new Error(`${slug}: could not find <article class="page-content">`);

  const elements = splitTopLevelElements(articleMatch[1], slug);
  const blocks = elements.map((el) => {
    switch (el.kind) {
      case "figure":
        return processFigure(el.raw, slug);
      case "ul.page-features":
        return processFeatures(el.raw, slug);
      case "ul.page-points":
        return processPoints(el.raw, slug);
      case "h2":
        return processHeading(el.raw, 2);
      case "h3":
        return processHeading(el.raw, 3);
      case "p":
        return processParagraph(el.raw);
      case "ul.plain":
      case "ol.plain":
      case "div":
        // Plain (unclassed) lists and the fee-schedule table wrapper don't fit
        // any of the documented block types; carry the exact baseline markup
        // through as a richtext block (CommonMark HTML-block passthrough).
        return { type: "richtext", body: rawHtmlBlockBody(el.raw) };
      default:
        throw new Error(`${slug}: unhandled element kind ${el.kind}`);
    }
  });

  return { title, crumbLabel, lead, blocks };
}

// --- YAML front matter emission ---------------------------------------------

function yamlString(value) {
  // A handful of richtext bodies carry multi-line raw HTML through verbatim
  // (see file header) and so contain real embedded newlines. A literal
  // newline byte inside a YAML double-quoted scalar is *folded* (collapsed to
  // a single space) by the YAML spec, which would silently destroy the exact
  // whitespace those bodies depend on -- so embedded newlines/tabs/carriage
  // returns must be written as their `\n`/`\t`/`\r` escape sequences, not as
  // literal bytes.
  const escaped = String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");
  return `"${escaped}"`;
}

function buildFrontMatter({ title, crumbLabel, lead, blocks }) {
  const lines = ["---"];
  lines.push(`title: ${yamlString(title)}`);
  if (crumbLabel) lines.push(`crumbLabel: ${yamlString(crumbLabel)}`);
  if (lead) lines.push(`lead: ${yamlString(lead)}`);
  lines.push("blocks:");
  for (const block of blocks) {
    if (block.type === "richtext") {
      lines.push("  - type: richtext");
      lines.push(`    body: ${yamlString(block.body)}`);
    } else if (block.type === "image") {
      lines.push("  - type: image");
      lines.push(`    description: ${yamlString(block.description)}`);
      lines.push("    src: null");
    } else if (block.type === "features") {
      lines.push("  - type: features");
      lines.push("    items:");
      for (const item of block.items) {
        lines.push(`      - heading: ${yamlString(item.heading)}`);
        lines.push(`        text: ${yamlString(item.text)}`);
      }
    } else if (block.type === "points") {
      lines.push("  - type: points");
      lines.push("    items:");
      for (const item of block.items) {
        lines.push(`      - ${yamlString(item)}`);
      }
    } else {
      throw new Error(`Unknown block type: ${block.type}`);
    }
  }
  lines.push("---");
  return lines.join("\n") + "\n";
}

// --- main ---------------------------------------------------------------

function main() {
  const slugs = getSlugs();
  fs.mkdirSync(PAGES_DIR, { recursive: true });
  let count = 0;
  for (const slug of slugs) {
    const page = convertPage(slug);
    const frontMatter = buildFrontMatter(page);
    const outPath = path.join(PAGES_DIR, `${slug}.md`);
    fs.writeFileSync(outPath, frontMatter);
    count++;
  }
  console.log(`Wrote ${count} page(s) to ${PAGES_DIR}/`);
}

main();
