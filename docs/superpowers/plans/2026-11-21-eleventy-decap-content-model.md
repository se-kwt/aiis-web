# Eleventy build + Decap content model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the hand-built static `site/` into an Eleventy-built site whose homepage, Our Story page and 37 inner pages are driven by Decap-CMS-shaped content files, with no visible change to markup, CSS, JS or animation behavior.

**Architecture:** Eleventy (Nunjucks) reads content from `content/*.json` and `content/pages/*.md` and renders it through three layouts (home, our-story, page) built from includes that already match the baseline's `<!-- build:header/menu/footer/page -->` regions. `content/site.json` becomes the single source for nav/footer/breadcrumbs. A byte-for-byte compare script, checked against a `baseline-static-site` git tag, is the test oracle at every step: until content is intentionally changed, rendered output must equal the hand-built baseline exactly. Decap CMS (`admin/`) is wired to this same content and validated locally via `local_backend`, with no OAuth, GitHub Actions, Netlify project or DNS work (that is separate, later work).

**Tech Stack:** `@11ty/eleventy` (v3, ESM, matches the project's `"type": "module"`), Nunjucks templates, plain Node scripts for migration/verification, Decap CMS (CDN build) for the admin UI.

**Spec:** [docs/superpowers/specs/2026-11-21-decap-netlify-cms-design.md](../specs/2026-11-21-decap-netlify-cms-design.md) — this plan implements that spec's Approaches 1 and 7/8 (Eleventy, inner-page block model) and phases 0–4 and 9 of its "Rough phase shape". It deliberately does **not** implement that spec's hosting/backend phases (GitHub Actions deploy, Netlify OAuth function, forms wiring, DNS cutover — phases 6, 7, 8, 10, 11), which are separate, later work.

## Global Constraints

- Do not change the markup, class names, `data-k`/`data-section` hooks or animation behavior of the homepage, Our Story or the inner-page template as a side effect of introducing the build (spec anti-goal). The compare script enforces this: rendered output must equal the baseline byte-for-byte except where a task's own goal is to change *where* content lives, never *what* it renders.
- Each page type keeps its own stylesheet list (homepage ≠ Our Story ≠ inner page); never load every CSS file on every page.
- `content/site.json`'s `menu`/`footer`/`quickLinks`/`closing`/`divisions` are the single source of truth for nav, footer, breadcrumbs and `aria-current`. No hand-duplicated nav markup after Phase 2.
- Placeholder conventions must survive migration: text carries `data-placeholder="<reason>"` exactly where the baseline has it; missing photos stay `<figure class="tp" data-temp-photo>` with their screen-reader description until a real image is supplied.
- Highlighted words (`<span class="hl" data-hl>word</span>`) must be authorable by an editor typing plain text, not HTML.
- URLs are extensionless and match `content/site.json` paths (`/our-story`, not `/our-story.html`); Eleventy emits `/<slug>/index.html` for every page.
- No GitHub OAuth App, Netlify project, GitHub Actions workflow, DNS change or forms backend in this plan — Decap is validated with `local_backend: true` + `npx decap-server` only.
- The dead `esbuild`/`playwright` devDependencies and `test`/`build:single` scripts in `package.json` (pointing at `tools/bundle.mjs` and `tests/`, both already removed) are cleaned up once the real build lands, not before.

## Review Focus

- A nav/menu/footer region rendered from `content/site.json` data no longer matches the baseline byte-for-byte (wrong escaping of `&`/apostrophes, missing `aria-current="page"`, wrong `group`/`parent` grouping for Sports/Community). Pinned by the byte-compare step in every Phase 2+ task.
- An inner page's block list drops or reorders a `page-features` or `page-points` block, or collapses a `figure.tp[data-temp-photo]` into a real `<img>` (or vice versa) during migration. Pinned by Task 11's full-sitemap byte-compare loop.
- A placeholder-flagged field (`data-placeholder="..."`) loses its reason text, or a non-placeholder field gains one, once content moves into `content/homepage.json` / `content/our-story.json`. Pinned by Task 9/10's byte-compare against baseline.
- A `==highlighted==` phrase renders with broken escaping (an embedded `&`, apostrophe, or a second `==pair==` on the same line) or fails to close its `<span class="hl" data-hl>`. Pinned by Task 9/10 by including at least one such phrase with an apostrophe (Our Story's `We Nurture…Citizens`, which already contains none, plus the mission title's three `==phrase==` spans) in the extracted content and checking the diff.
- Eleventy emits an extra/duplicate route for a page (e.g. both `/our-story/index.html` and a stray `/our-story.html`), or a page's output path doesn't match its `content/site.json` path. Pinned by Task 3's passthrough-only build having zero HTML output, and by every later task's compare step naming the exact expected output path.

---

## File Structure

```
eleventy.config.js                  # Eleventy config (ESM): input/output dirs, passthrough copy, filters
content/
  site.json                         # existing — nav/footer/menu, now read as Eleventy global data (unchanged path & shape)
  settings.json                     # NEW — shared inner-page sidebar (about text, quick-link picks, address)
  homepage.json                     # NEW — homepage section content
  our-story.json                    # NEW — Our Story page content
  pages/
    chairmans-message.md            # NEW — one per inner page (37 total), front matter + ordered blocks
    ...
src/
  _data/
    site.js                         # exposes content/site.json as global `site`
    settings.js                     # exposes content/settings.json as global `settings`
  _includes/
    header.njk                      # <!-- build:header --> chrome, nav from `site.menu`
    menu.njk                        # <!-- build:menu --> full-screen menu, from `site.menu`/`site.quickLinks`
    footer.njk                      # <!-- build:footer --> chrome, from `site.footer`
    sidebar.njk                     # page-sidebar include, from `settings`
  _layouts/
    base.njk                        # <html>/<head>/<body> shell: intro script, header/menu/footer, {{ content | safe }}, `styles` param
    home.njk                        # extends base.njk; homepage sections from `homepage.json`
    our-story.njk                   # extends base.njk; Our Story sections from `our-story.json`
    page.njk                        # extends base.njk; page-hero + block renderer + sidebar.njk
  index.njk                         # layout: home.njk, permalink: /index.html
  our-story.njk                     # layout: our-story.njk, permalink: /our-story/index.html
  pages/
    pages.json                      # Eleventy directory data: layout: page.njk, reads content/pages/*.md
  css/, js/, assets/                 # moved verbatim from site/css, site/js, site/assets (git mv); passthrough-copied
admin/
  index.html                        # Decap CMS loader (CDN script + config.yml)
  config.yml                        # collections: homepage, our_story, settings, navigation, pages
tools/
  compare-output.mjs                # byte-compares _site/<path> against `git show <ref>:site/<path>` (ref defaults to baseline-static-site)
  migrate-pages.mjs                 # one-off: parses each baseline inner page's <!-- build:page --> region into content/pages/<slug>.md
package.json                       # add @11ty/eleventy; scripts: build, dev, migrate:pages; drop esbuild/playwright/test/build:single
```

The `content/pages/*.md` front matter shape (fixed by Task 6, reused by every later inner-page task):

```yaml
title: "Chairman's Message"        # also the page-hero__title and <title> prefix
crumbLabel: "Chairman's Message"   # optional; defaults to title if omitted
lead: null                         # optional page-hero__lead string (only ~4 of 37 pages have one)
blocks:
  - type: richtext                 # markdown: h2 / p / ul — rendered as-is (no card/point markup)
    body: "Dear Parents,\n\n..."
  - type: image
    description: "Kindergarten children exploring a hands-on classroom activity at AIIS"  # always required
    src: null                      # null -> <figure class="tp" data-temp-photo>; set -> real <img src=...>
  - type: features                 # <ul class="page-features">
    items:
      - heading: "Hands-on Approach"
        text: "Children learn by doing..."
  - type: points                   # <ul class="page-points">
    items: ["Coordination skill development", "Build confidence"]
```

## Task 1: Bring Our Story onto this branch

**Files:**
- Create: `site/our-story.html`, `site/css/our-story.css`, `site/js/our-story.js` (copied from the `our-story-page-7db305` worktree's working tree)
- Modify: `content/site.json`, `site/index.html`, `site/js/main.js` (copied from the `our-story-page-7db305` worktree's working tree, replacing this worktree's current versions)
- Create: `docs/superpowers/specs/2026-11-21-decap-netlify-cms-design.md` (already copied into this worktree; just needs committing)

**Interfaces:**
- Produces: a working tree where the homepage links to `/our-story` (extensionless) and `our-story` is registered in `js/main.js`'s `runModules([...])` list, matching the spec's described end state.
- Ruling: source every file from the `our-story-page-7db305` worktree, not the main checkout. Both have identical uncommitted edits to `content/site.json` and `site/js/main.js`, but the main checkout's `site/index.html` still carries the `.html`-suffixed links from its own local-preview workaround (confirmed by diffing the two working trees) — exactly what the spec's anti-goals rule out. `our-story-page-7db305` already has the correct extensionless links everywhere, so it is the only valid source for `site/index.html`.

- [ ] **Step 1: Copy the files**

```bash
SRC="/Users/amal/Documents/Stellar Edu/1 - Projects/aiis_web/.claude/worktrees/our-story-page-7db305"
cp "$SRC/site/our-story.html" site/our-story.html
cp "$SRC/site/css/our-story.css" site/css/our-story.css
cp "$SRC/site/js/our-story.js" site/js/our-story.js
cp "$SRC/content/site.json" content/site.json
cp "$SRC/site/index.html" site/index.html
cp "$SRC/site/js/main.js" site/js/main.js
```

- [ ] **Step 2: Verify extensionless links**

Run: `grep -o 'href="[^"]*our-story[^"]*"' site/index.html site/our-story.html`
Expected: every match is `href="/our-story"` — none end in `.html`.

- [ ] **Step 3: Commit**

```bash
git add site/our-story.html site/css/our-story.css site/js/our-story.js content/site.json site/index.html site/js/main.js docs/superpowers/specs/2026-11-21-decap-netlify-cms-design.md
git commit -m "chore: bring Our Story onto this branch"
```

## Task 2: Bring the 37 inner pages onto this branch, tag the baseline

**Files:**
- Create: 37 files `site/*.html` (every file under the `our-story-page-7db305` worktree's `site/` except `index.html` and `our-story.html`) + `site/css/page.css`

**Interfaces:**
- Produces: the git tag `baseline-static-site`, which every later compare step reads from. This is the last commit before any build step exists — the permanent parity fixture.

- [ ] **Step 1: Copy the files**

```bash
SRC2="/Users/amal/Documents/Stellar Edu/1 - Projects/aiis_web/.claude/worktrees/our-story-page-7db305"
cp "$SRC2/site/css/page.css" site/css/page.css
for f in "$SRC2"/site/*.html; do
  base=$(basename "$f")
  [ "$base" = "index.html" ] || [ "$base" = "our-story.html" ] || cp "$f" "site/$base"
done
ls site/*.html | wc -l   # expect 39 (index, our-story, 37 inner pages)
```

- [ ] **Step 2: Verify every `content/site.json` internal path has a file**

Run a one-off check (no need to keep the script):

```bash
node -e '
const site = JSON.parse(require("fs").readFileSync("content/site.json", "utf8"));
const paths = new Set();
for (const s of site.menu) for (const l of s.links) if (!l.external) paths.add(l.path);
paths.add(site.closingButton.path); // already covered above usually
for (const p of paths) {
  if (p.startsWith("/form/") || p.startsWith("/web/") || p === "#") continue;
  const slug = p.slice(1);
  const file = slug === "" ? "site/index.html" : `site/${slug}.html`;
  if (!require("fs").existsSync(file)) console.log("MISSING:", p, "->", file);
}
console.log("done");
'
```

Expected: no `MISSING:` lines besides the known not-yet-built sitemap paths (`/web/gallery`, `/calendar`, `/weekly-test`, `/aiis-career-new`, `/career-opportunities-at-aiis-kuwait`, `/form/*`, `/news-events`) — those 8 paths are explicitly out of scope for this plan (spec's phase 5).

- [ ] **Step 3: Commit and tag**

```bash
git add site/*.html site/css/page.css
git commit -m "chore: bring the 37 inner pages onto this branch"
git tag baseline-static-site
```

## Task 3: Scaffold Eleventy

**Files:**
- Create: `eleventy.config.js`, `tools/compare-output.mjs`
- Modify: `package.json` (add `@11ty/eleventy` devDependency; add `build`/`dev` scripts)
- Move (git mv): `site/css` → `src/css`, `site/js` → `src/js`, `site/assets` → `src/assets`
- Create: `.gitignore` entry for `_site/`

**Interfaces:**
- Produces: `node tools/compare-output.mjs <relative-path> [ref]` — a CLI script. `ref` defaults to `baseline-static-site`. It exits 0 and prints nothing when `_site/<relative-path>` is byte-identical to `git show <ref>:site/<relative-path>`; otherwise it prints a short diff summary and exits 1. Every later task's verify step calls this.
- Consumes: nothing from earlier tasks beyond the `baseline-static-site` tag.

- [ ] **Step 1: Confirm there is nothing to compare yet (red)**

Run: `npm run build 2>&1 | tail -5 || true` (expected to fail: no `build` script / no Eleventy config yet)

- [ ] **Step 2: Install Eleventy and move assets**

```bash
npm install --save-dev @11ty/eleventy
mkdir -p src
git mv site/css src/css
git mv site/js src/js
git mv site/assets src/assets
```

- [ ] **Step 3: Write `eleventy.config.js`**

```js
export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/assets");
  return {
    dir: { input: "src", includes: "_includes", layouts: "_layouts", data: "_data", output: "_site" },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
```

- [ ] **Step 4: Write `tools/compare-output.mjs`**

Signature: `node tools/compare-output.mjs <relativePath> [ref=baseline-static-site]`. Read `_site/<relativePath>` from disk (`node:fs`) and the baseline via `execSync(`git show ${ref}:site/${relativePath}`)`; compare as `Buffer`s; on mismatch print a short unified diff (first ~10 differing lines is enough — this is a dev tool, not product code) and `process.exit(1)`; on match exit 0 silently.

- [ ] **Step 5: Add npm scripts**

In `package.json`: `"build": "eleventy"`, `"dev": "eleventy --serve"`. Add `_site/` to `.gitignore`.

- [ ] **Step 6: Verify the passthrough copy works (no HTML yet)**

Run: `npm run build && diff src/css/tokens.css _site/css/tokens.css`
Expected: no output (files identical); `_site/` has `css/`, `js/`, `assets/` but no `index.html` yet.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "build: scaffold Eleventy, move static assets under src/"
```

## Task 4: Homepage layout

**Files:**
- Create: `src/_layouts/base.njk`, `src/_layouts/home.njk`, `src/_includes/header.njk`, `src/_includes/menu.njk`, `src/_includes/footer.njk`, `src/index.njk`

**Interfaces:**
- Consumes: Task 3's `eleventy.config.js` (input dir `src`, output `_site`).
- Produces: `base.njk` defines a Nunjucks block `content` and a `styles` front-matter-driven list of stylesheet hrefs that `home.njk`/`our-story.njk`/`page.njk` each set to their own list (per the "each page loads only its own CSS" constraint). `header.njk`/`menu.njk`/`footer.njk` are included by `base.njk` and, in this task, still contain the nav markup copied verbatim from the baseline (not yet data-driven — that's Task 7).

- [ ] **Step 1: Confirm the homepage isn't rendered yet (red)**

Run: `node tools/compare-output.mjs index.html`
Expected: fails (`_site/index.html` does not exist).

- [ ] **Step 2: Write `base.njk`, `header.njk`, `menu.njk`, `footer.njk`**

Port the `<!doctype html>`…`<head>` block (intro-decision script, font preconnects, per-page `styles` list, GSAP script tags, `<script type="module" src="js/main.js">`), the `<!-- build:header -->` region, the `<!-- build:menu -->` region and the `<!-- build:footer -->` region verbatim from `baseline-static-site`'s `site/index.html`, splitting at those exact HTML comments. `base.njk` wraps `<body>`…`{% block content %}{% endblock %}`…`</body>` around the three includes in their original positions (skip-link, intro div, header, menu, `<div class="hdr__blur">`, `<main id="main">{% block content %}{% endblock %}</main>`, footer).

- [ ] **Step 3: Write `home.njk` and `src/index.njk`**

`home.njk` extends `base.njk`, sets `styles` to the homepage's exact `<link>` list (`tokens, base, header, intro, hero, news, promises, divisions, learning, teachers, values, closing, footer, video-modal`), and fills `{% block content %}` with the hero/news/promises/divisions/learning/teachers/values/closing sections ported verbatim from the baseline. `src/index.njk` front matter: `layout: home.njk`, `permalink: /index.html`.

- [ ] **Step 4: Build and verify (green)**

Run: `npm run build && node tools/compare-output.mjs index.html`
Expected: exits 0, no diff output.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "build: add homepage Eleventy layout (byte-identical to baseline)"
```

## Task 5: Our Story layout

**Files:**
- Create: `src/_layouts/our-story.njk`, `src/our-story.njk`

**Interfaces:**
- Consumes: Task 4's `base.njk`/`header.njk`/`menu.njk`/`footer.njk`.
- Produces: nothing new consumed elsewhere; this is the second of the three layouts, proving `base.njk`'s per-page `styles` mechanism works for a second stylesheet list.

- [ ] **Step 1: Confirm red**

Run: `node tools/compare-output.mjs our-story.html`
Expected: fails.

- [ ] **Step 2: Write `our-story.njk` layout and `src/our-story.njk` page**

Extends `base.njk`; `styles` = Our Story's exact list (`tokens, base, header, intro, our-story, footer`); content block = the `<!-- build:our-story -->` region ported verbatim (hero/lead/quick-facts/mission/story-blocks/closing). Front matter: `layout: our-story.njk`, `permalink: /our-story/index.html`.

- [ ] **Step 3: Build and verify (green)**

Run: `npm run build && node tools/compare-output.mjs our-story.html`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "build: add Our Story Eleventy layout (byte-identical to baseline)"
```

## Task 6: Page layout, block renderer, and the first migrated inner page

**Files:**
- Create: `src/_layouts/page.njk`, `src/pages/pages.json`, `content/pages/chairmans-message.md`

**Interfaces:**
- Consumes: Task 4's `base.njk`/chrome includes.
- Produces: the `content/pages/*.md` front matter shape fixed in "File Structure" above (`title`, `crumbLabel`, `lead`, `blocks[]` with `type` ∈ `richtext|image|features|points`). Every later inner-page task (7, 8, 11) relies on this exact shape and on `page.njk` rendering it. The sidebar is still the hardcoded baseline markup here — Task 8 replaces it with `sidebar.njk`.

- [ ] **Step 1: Confirm red**

Run: `node tools/compare-output.mjs chairmans-message.html`
Expected: fails.

- [ ] **Step 2: Write `src/pages/pages.json`**

Eleventy directory data file: `{ "layout": "page.njk", "styles": ["tokens", "base", "header", "intro", "hero", "page", "footer"], "permalink": "/{{ page.fileSlug }}/index.html" }` (the `hero` stylesheet is on the baseline's inner pages too — confirm against the baseline file before fixing this list; copy its exact `<link>` order).

- [ ] **Step 3: Write `page.njk`**

Renders, inside `{% block content %}`: the `page-hero` section (`page-hero__crumb` from `"Home"` + `crumbLabel` (or `title` if `crumbLabel` is unset) with a leading `<a href="/">Home</a> / `, `page-hero__title` from `title`, and `page-hero__lead` only when `lead` is set), then `page-body` → `page-content` iterating `blocks` with a Nunjucks `{% if block.type == "richtext" %}...{% elif == "image" %}...{% elif == "features" %}...{% elif == "points" %}...{% endif %}` (richtext renders `block.body` through the `markdown` filter; image renders `<figure class="tp" data-temp-photo><span class="sr">{{ block.description }}</span></figure>` when `block.src` is null, else a real `<figure class="tp"><img src="{{ block.src }}" alt="{{ block.description }}" loading="lazy"></figure>`), then `page-sidebar` with the baseline's hardcoded About/Quick Links/Address markup (unchanged in this task).

- [ ] **Step 4: Write `content/pages/chairmans-message.md`**

Front matter `title: "Chairman's Message"`, one `blocks` entry per paragraph (`type: richtext`, each `body` one `<p>`'s worth of markdown — the baseline page has no image/features/points blocks, so this is the simplest of the 37 and the right one to prove the renderer first).

- [ ] **Step 5: Build and verify (green)**

Run: `npm run build && node tools/compare-output.mjs chairmans-message.html`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src content
git commit -m "build: add inner-page layout and block renderer, migrate chairmans-message"
```

## Task 7: Nav, menu, footer and breadcrumbs from `content/site.json`

**Files:**
- Create: `src/_data/site.js`
- Modify: `src/_includes/header.njk`, `src/_includes/menu.njk`, `src/_includes/footer.njk`

**Interfaces:**
- Produces: the Eleventy global data object `site` (same shape as `content/site.json`), available in every template as `site.menu`, `site.quickLinks`, `site.footer`, `site.closing`, `site.divisions`, `site.logo`, `site.labels`.
- Consumes: Tasks 4–6's includes (rewrites their nav/menu/footer bodies to loop over `site` instead of containing literal markup); `page.url` (Eleventy-provided) to compute `aria-current="page"`.

- [ ] **Step 1: Confirm green-before-refactor baseline still holds**

Run: `node tools/compare-output.mjs index.html && node tools/compare-output.mjs our-story.html && node tools/compare-output.mjs chairmans-message.html`
Expected: all three exit 0 (this is the refactor's starting point, not a failing test — record it so the next check is meaningful).

- [ ] **Step 2: Write `src/_data/site.js`**

```js
import fs from "node:fs";
export default () => JSON.parse(fs.readFileSync("content/site.json", "utf8"));
```

- [ ] **Step 3: Rewrite `header.njk`'s nav and `menu.njk`'s menu to loop over `site.menu`**

For each `section` in `site.menu`: emit the top-level `<li class="hdr__item">` link (current page's section gets `aria-current="page"` when `page.url` matches `section.path` or any of its `links[].path`), then the dropdown panel. Within a section's `links`, items with no `group`/`parent` go straight into `hdr__panel-main`; consecutive items sharing the same `group` value are wrapped exactly as the baseline wraps "Community" (into their own `hdr__panel-group`); items with `parent` (the `menu.njk` "Sports" nested case) follow the baseline's nested-toggle markup keyed by `parent`. Each individual `<a>` gets `aria-current="page"` when its own `path` equals `page.url` (stripped of trailing slash). Reuse the same grouping logic for `menu.njk`'s mobile list and its `quickLinks` nav from `site.quickLinks`.

- [ ] **Step 4: Rewrite `footer.njk`'s footer-links nav from `site.footer`**

Loop `site.footer` into the `<nav aria-label="Footer"><ul>` — the campus/social/legal markup around it stays hardcoded (not yet in `site.json`).

- [ ] **Step 5: Build and verify (green)**

Run: `npm run build && node tools/compare-output.mjs index.html && node tools/compare-output.mjs our-story.html && node tools/compare-output.mjs chairmans-message.html`
Expected: all three exit 0 — same baseline, now computed instead of hand-written.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "build: drive nav, menu, footer links and breadcrumbs from content/site.json"
```

## Task 8: Shared inner-page sidebar from `content/settings.json`

**Files:**
- Create: `content/settings.json`, `src/_data/settings.js`, `src/_includes/sidebar.njk`
- Modify: `src/_layouts/page.njk`

**Interfaces:**
- Produces: `settings` global data: `{ "about": "...", "quickLinks": [{"label","path"}], "address": { "lines": ["Aspire Indian International School", "Street 100, Block 1,", "Abbasiya School Complex, Kuwait"], "phones": ["+96555195455", "+96550927287"] } }` (exact text copied from the baseline's identical sidebar on every inner page).
- Consumes: Task 6's `page.njk` (removes its hardcoded sidebar markup and includes `sidebar.njk` instead).

- [ ] **Step 1: Confirm green-before-refactor**

Run: `node tools/compare-output.mjs chairmans-message.html`
Expected: exits 0.

- [ ] **Step 2: Write `content/settings.json` and `src/_data/settings.js`** (same pattern as Task 7's `site.js`, reading `content/settings.json`)

- [ ] **Step 3: Write `sidebar.njk` from `settings`, include it from `page.njk`**

`page-sidebar__contact` phone links use `tel:+<digits>` hrefs with the human-readable `+965 ...` text — match the baseline's exact formatting per phone number.

- [ ] **Step 4: Build and verify (green)**

Run: `npm run build && node tools/compare-output.mjs chairmans-message.html`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src content
git commit -m "build: move the shared inner-page sidebar into content/settings.json"
```

## Task 9: Homepage content into `content/homepage.json`

**Files:**
- Create: `content/homepage.json`
- Modify: `src/_layouts/home.njk`, `eleventy.config.js` (add the `hl`, `words` and `placeholderAttr` filters)

**Interfaces:**
- Produces: two Nunjucks filters, kept separate because the baseline uses them for two different things. `hl` — `eleventyConfig.addFilter("hl", (input) => /* string with HTML, mark safe at the call site with | safe */)` — marks a highlighted sub-phrase *within* a sentence, matching `<span class="hl" data-hl>`. It splits `input` on `==...==` pairs; HTML-escapes every literal segment (`&`, `<`, `>`, `"`, `'`) itself (callers apply `| safe` because the filter already escaped the plain text); each `==phrase==` segment becomes `<span class="hl" data-hl>` + escaped `phrase` + `</span>`. This is for prose like the promise headings (`…so your child can ==discover== who they want to ==become==.`), not for `<span class="word">` word-reveal wrapping. `words` — `eleventyConfig.addFilter("words", (input) => /* every space-separated word individually wrapped */)` — HTML-escapes and wraps *every* word of `input` in `<span class="word">word</span>` (joined by a literal space, matching the baseline's `<h1 class="hero__title"><span class="word">IGNITING</span> <span class="word">YOUNG</span> <span class="word">MINDS</span></h1>`), with no partial/highlighted selection — use this filter, not `hl`, for the hero heading and any other field the baseline wraps entirely in `.word` spans (the `divisions__heading`'s mix of `<em>` small text and `.word` big words is a one-off structural pattern; port it verbatim with its text pulled from `homepage.divisions.heading.small`/`.big` fields rather than inventing a third filter for it). Also produces `placeholderAttr` — `eleventyConfig.addFilter("placeholderAttr", (field) => field && field.placeholder ? ` data-placeholder="${field.placeholder}"` : "")`, used as `{{ field | placeholderAttr | safe }}` right after the tag name, with the field's text rendered as `{{ field.text or field }}` (plain string when there's no placeholder, `{text, placeholder}` object when there is — grep the baseline for every `data-placeholder` occurrence inside the homepage sections and give exactly those fields the object shape; every other field stays a plain string or array).
- Consumes: Task 4's `home.njk` (replaces its hardcoded section content with `homepage.*` lookups, keeping the exact surrounding markup/classes).

- [ ] **Step 1: Confirm green-before-refactor**

Run: `node tools/compare-output.mjs index.html`
Expected: exits 0.

- [ ] **Step 2: Write `content/homepage.json`**

One key per section (`hero`, `news`, `promises`, `divisions`, `learning`, `teachers`, `values`, `closing`), each holding exactly the text/image paths/placeholder flags the baseline hardcodes, with repeatable parts (news items, the 3 promise blocks, the 3 division flip-cards, teacher bios, value cards, closing CTAs) as arrays. The hero heading (`homepage.hero.heading`, plain string `"IGNITING YOUNG MINDS"`) is rendered through the `words` filter; the promise titles' `<span class="hl" data-hl>` words become `==...==`-marked plain strings rendered through the `hl` filter.

- [ ] **Step 3: Rewrite `home.njk` to read `homepage.*`**, applying `hl`/`placeholderAttr` exactly where the baseline has `data-hl`/`data-placeholder`.

- [ ] **Step 4: Build and verify (green)**

Run: `npm run build && node tools/compare-output.mjs index.html`
Expected: exits 0. If it fails on an `hl`-filtered line, check escaping first — that's the review-focus risk this task exists to pin.

- [ ] **Step 5: Commit**

```bash
git add content src eleventy.config.js
git commit -m "build: move homepage content into content/homepage.json"
```

## Task 10: Our Story content into `content/our-story.json`

**Files:**
- Create: `content/our-story.json`
- Modify: `src/_layouts/our-story.njk`

**Interfaces:**
- Consumes: Task 9's `hl`/`placeholderAttr` filters.
- Produces: `quickFacts` as an array (`[{figure, label}, ...]`, any length — the carousel JS already reads the DOM, not a fixed count) and `storyBlocks` as an array (`[{heading, copy, linkLabel, linkHref}, ...]`) that `our-story.njk` renders with alternating `story-block__grid`/media-first vs copy-first ordering **by array position** (odd/even), matching the spec's Approach 8 ("story blocks alternate photo/copy sides automatically by position").

- [ ] **Step 1: Confirm green-before-refactor**

Run: `node tools/compare-output.mjs our-story.html`
Expected: exits 0.

- [ ] **Step 2: Write `content/our-story.json`**

Keys: `hero` (eyebrow, title, photo placeholder description), `lead` (title with `==We Nurture==`/`==Citizens==` marked, copy, callout with its placeholder reason), `quickFacts` (8 entries, each figure flagged `placeholder: "illustrative figure"`), `mission` (eyebrow, title with its three `==...==` phrases, placeholder reason, two `cols` each with heading/text+placeholder), `storyBlocks` (3 entries, each placeholder-flagged copy + link + photo description), `closing` (array of `{label, path}` — may just reuse `site.closing` via Eleventy data instead of duplicating; prefer reusing `site.closing` since it's identical content already in `content/site.json`).

- [ ] **Step 3: Rewrite `our-story.njk`** to read `ourStory.*` (and `site.closing` for the closing bars), looping `quickFacts` and `storyBlocks` with a `{% for block in storyBlocks %}` whose media/copy column order flips on `loop.index % 2`.

- [ ] **Step 4: Build and verify (green)**

Run: `npm run build && node tools/compare-output.mjs our-story.html`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add content src
git commit -m "build: move Our Story content into content/our-story.json"
```

## Task 11: Migrate the remaining 36 inner pages

**Files:**
- Create: `tools/migrate-pages.mjs`, `content/pages/*.md` (36 new files)
- Modify: `package.json` (add `migrate:pages` script)

**Interfaces:**
- Consumes: Task 6's front matter shape; the `baseline-static-site` tag; `content/site.json`'s menu for the authoritative slug → title/breadcrumb list (every internal path except the 8 out-of-scope ones from Task 2 Step 2, and except `chairmans-message` which Task 6 already migrated by hand).
- Produces: nothing consumed by later tasks in this plan (Task 12 just cleans up after it).

- [ ] **Step 1: Confirm red for one representative page**

Run: `node tools/compare-output.mjs kindergarten-school.html`
Expected: fails (not migrated yet).

- [ ] **Step 2: Write `tools/migrate-pages.mjs`**

For each remaining slug: read `git show baseline-static-site:site/<slug>.html`, extract the region between `<!-- build:page -->` and `<!-- /build:page -->`, and walk its `page-content` children in order, converting each into a `blocks` entry: a run of `<p>`/`<h2>`/`<h3>`/`<ul>` (not `page-features`/`page-points`) becomes one `richtext` block (markdown reconstructed from the tags: `##` for `h2`, plain lines for `p`, `-` for a plain `<ul><li>`); a `<figure class="tp" data-temp-photo>` becomes an `image` block (`description` = the `.sr` text, `src: null`); a `<ul class="page-features">` becomes a `features` block (`items` = each `<li>`'s `<h3>`/`<p>` text); a `<ul class="page-points">` becomes a `points` block (`items` = each `<li>`'s text). Pull `title` from `page-hero__title`, `crumbLabel` from the text after "/ " in `page-hero__crumb` (set only when it differs from `title`), `lead` from `page-hero__lead` text when present. Write `content/pages/<slug>.md` with YAML front matter and no markdown body (everything lives in `blocks`).

- [ ] **Step 3: Add the npm script and run it**

`"migrate:pages": "node tools/migrate-pages.mjs"` in `package.json`.

Run: `npm run migrate:pages`
Expected: 36 new files under `content/pages/`.

- [ ] **Step 4: Verify every one of the 37 inner pages, not just the migrated 36**

Run:

```bash
npm run build
for f in site/*.html; do
  base=$(basename "$f")
  [ "$base" = "index.html" ] || [ "$base" = "our-story.html" ] && continue
  node tools/compare-output.mjs "$base" || echo "FAILED: $base"
done
```

Expected: no `FAILED:` lines. Fix `migrate-pages.mjs`'s block-splitting (not `page.njk`, which Task 6 already proved) for any page that fails, re-run, repeat until clean.

- [ ] **Step 5: Commit**

```bash
git add tools content package.json
git commit -m "build: migrate the remaining 36 inner pages into content/pages/"
```

## Task 12: Cleanup

**Files:**
- Delete: the 39 files under `site/*.html` (`css/`, `js/` and `assets/` already moved out of `site/` in Task 3) — now superseded by `_site/` output and the `baseline-static-site` tag — and the resulting empty `site/` directory
- Modify: `package.json` (remove `esbuild`, `playwright` devDependencies and the `test`/`build:single` scripts)

**Interfaces:**
- Produces: a working tree with no `site/` directory at all (everything moved into `src/` or superseded by `_site/`); `baseline-static-site` remains the only place the original hand-built HTML survives.

- [ ] **Step 1: Confirm full-site parity holds before deleting anything**

Run the Task 11 Step 4 loop again, plus `node tools/compare-output.mjs index.html && node tools/compare-output.mjs our-story.html`.
Expected: zero failures across all 39 pages.

- [ ] **Step 2: Remove the superseded baseline files and dead package.json entries**

```bash
git rm site/*.html
rmdir site 2>/dev/null || true
```

Edit `package.json`: remove `"test"` and `"build:single"` scripts, remove `esbuild`/`playwright` from `devDependencies`, run `npm install` to update `package-lock.json`.

- [ ] **Step 3: Verify a clean build still passes**

Run: `rm -rf _site node_modules/.cache && npm run build` then re-run the full 39-page compare loop from Step 1.
Expected: zero failures.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove superseded static HTML and dead build scripts"
```

## Task 13: Decap content model (`admin/`)

**Files:**
- Create: `src/admin/index.html`, `src/admin/config.yml`
- Modify: `eleventy.config.js` (passthrough-copy `src/admin`)

**Interfaces:**
- Produces: `_site/admin/index.html` and `_site/admin/config.yml`, loadable with Decap's `?local_backend` dev flow. No OAuth app, no production `backend` credentials are created or required by this task — `backend.name: github` is written as config (the eventual production shape) but never exercised without `local_backend: true`.

- [ ] **Step 1: Write `src/admin/config.yml`**

```yaml
backend:
  name: github
  repo: se-kwt/aiis-web      # update if the real repo slug differs; not used while local_backend is on
  branch: main
local_backend: true
media_folder: "src/assets/photos"
public_folder: "/assets/photos"
collections:
  - name: homepage
    label: Homepage
    files:
      - name: homepage
        label: Homepage
        file: content/homepage.json
        fields: [ ... one field per key in content/homepage.json, Task 9's exact keys ... ]
  - name: our_story
    label: Our Story
    files:
      - name: our-story
        label: Our Story
        file: content/our-story.json
        fields: [ ... Task 10's exact keys ... ]
  - name: settings
    label: Site Settings
    files:
      - name: settings
        label: Inner-page Sidebar
        file: content/settings.json
        fields: [ ... Task 8's exact keys ... ]
  - name: navigation
    label: Navigation
    files:
      - name: site
        label: Nav, Footer & Quick Links
        file: content/site.json
        fields: [ ... content/site.json's existing top-level keys ... ]
  - name: pages
    label: Inner Pages
    folder: content/pages
    create: true
    slug: "{{slug}}"
    fields:
      - { label: Title, name: title, widget: string }
      - { label: "Breadcrumb label", name: crumbLabel, widget: string, required: false }
      - { label: Lead, name: lead, widget: string, required: false }
      - label: Blocks
        name: blocks
        widget: list
        types:
          - label: "Rich text"
            name: richtext
            fields: [{ label: Body, name: body, widget: markdown }]
          - label: Image
            name: image
            fields:
              - { label: Description, name: description, widget: string }
              - { label: Photo, name: src, widget: image, required: false }
          - label: "Feature cards"
            name: features
            fields:
              - label: Items
                name: items
                widget: list
                fields: [{ label: Heading, name: heading, widget: string }, { label: Text, name: text, widget: text }]
          - label: "Point list"
            name: points
            fields: [{ label: Items, name: items, widget: list, field: { label: Point, name: point, widget: string } }]
```

Fill in the `[ ... ]` field lists by reading the exact keys each of those content files holds (don't guess — Tasks 8, 9 and 10 already fixed them); for any field Task 9/10 gave the `{text, placeholder}` shape, use a Decap `object` widget with a `text` string field and a `placeholder` string field (`required: false`).

- [ ] **Step 2: Write `src/admin/index.html`**

Standard Decap loader: `<!doctype html><html><head><meta charset="utf-8"><title>Content Manager</title></head><body><script src="https://unpkg.com/decap-cms@^3/dist/decap-cms.js"></script></body></html>` (config.yml is auto-discovered at the same path).

- [ ] **Step 3: Passthrough-copy `admin/`**

Add `eleventyConfig.addPassthroughCopy("src/admin");` to `eleventy.config.js`.

- [ ] **Step 4: Verify it builds and the YAML parses**

Run: `npm run build && node -e "require('yaml').parse(require('fs').readFileSync('_site/admin/config.yml','utf8'))"` (add the `yaml` package as a devDependency if it isn't already available, just for this one-off check) `&& echo OK`
Expected: `OK`, and `_site/admin/index.html` exists.

- [ ] **Step 5: Commit**

```bash
git add src eleventy.config.js package.json package-lock.json
git commit -m "feat: add Decap CMS admin and content-model config.yml"
```

## Task 14: Verify the CMS edits content correctly (manual, local backend)

**Files:** none (verification only; may produce incidental content edits to commit as a demonstration, or revert them)

**Interfaces:** none produced; this is the end-to-end proof that Tasks 1–13 actually hang together as an editable CMS, which no byte-compare script can check.

- [ ] **Step 1: Start the local backend and the Eleventy dev server**

Run (two terminals or backgrounded): `npx decap-server` and `npm run dev`.

- [ ] **Step 2: Open the admin UI**

Navigate to `http://localhost:8080/admin/#/` (adjust port to whatever `eleventy --serve` prints) — Decap should detect `local_backend: true` and skip login.

- [ ] **Step 3: Exercise each collection**

Confirm `Homepage`, `Our Story`, `Site Settings`, `Navigation` each show their one entry with every field from Tasks 8–10 editable, and `Inner Pages` lists 37 entries. Open `Chairman's Message`, add a second `richtext` block, save; confirm `content/pages/chairmans-message.md` changed on disk and `npm run build` renders the new paragraph at `/chairmans-message/`. Revert that test edit (`git checkout -- content/pages/chairmans-message.md`) once confirmed, unless the user wants to keep it as a worked example.

- [ ] **Step 4: Re-run the full compare loop to confirm the rest of the site is untouched**

Run the Task 12 Step 1 loop again.
Expected: zero failures (aside from the one page you intentionally edited and then reverted).

- [ ] **Step 5: Record the result**

No commit required if the test edit was reverted; if anything needed fixing in `config.yml`'s field lists, commit that fix with a message like `fix: correct Decap field schema for <collection>`.
