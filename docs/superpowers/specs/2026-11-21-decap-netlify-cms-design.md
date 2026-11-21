# AIIS website: Decap CMS, GitHub Pages + custom domain, Netlify as backend-only

## Intent and why

The AIIS website is a set of hand-built, animation-heavy static HTML pages under `site/`
with no build step. It now has three kinds of page:

- **Homepage** (`site/index.html`): bespoke design, committed on `main`. Most of its
  copy is still explicit placeholder text ("not confirmed by the school").
- **Our Story** (`site/our-story.html` + `css/our-story.css` + `js/our-story.js`): a
  second bespoke page (title band + full-bleed photo, lead headline, a scroll-snapped
  "Quick Facts" strip with prev/next buttons, mission statement, alternating story
  blocks, closing destination bars). It was added to the sitemap as the first link
  under ABOUT US. Much of its copy is flagged as illustrative.
- **Inner pages**: 37 sitemap pages (Chairman's Message, Kindergarten, Classrooms,
  Swimming Pool, Fees & Schedules, etc.) hand-built from the current live
  aiiskwt.com content. They all share **one** inner-page template (`css/page.css`):
  title band with breadcrumb, a two-column content + sidebar layout, prose
  typography, an optional feature-card grid (`page-features`), an optional short
  point list (`page-points`), and a sidebar of About / Quick Links / Address cards
  that is the same on every page.

Our Story and the inner pages are still **uncommitted work in progress** (see
Constraints). Every page repeats the header, menu, intro and footer markup by hand.
The repeated blocks are delimited with `<!-- build:header -->`, `<!-- build:menu -->`,
`<!-- build:footer -->` and `<!-- build:page -->` / `<!-- build:our-story -->` comments.
The nav markup also repeats the owner-supplied sitemap in `content/site.json` by
hand, including the `aria-current="page"` marker for each page.

The goal of this project is to turn the site into a real git-based CMS. Non-technical
school staff log into a `/admin` screen (Decap CMS) and edit text and images. Saving
commits to GitHub. The CMS covers the whole sitemap: every linked page gets a
template and a CMS entry. The two bespoke pages (homepage, Our Story) keep their
designs. Every other page uses the one shared inner-page template that already
exists. Inner-page content that has already been hand-built is **migrated** into
content files, not regenerated from scratch. Pages with no content yet start as
minimal inner pages and are filled in as the school supplies content. This plan
builds the system, not the words.

**Hosting split, decided in conversation:** the live site is served by **GitHub
Pages** under AIIS's own custom domain (DNS pointed at GitHub Pages). **Netlify is
not used to serve visitor traffic at all.** It hosts only the small backend pieces
Decap and the two forms need: an OAuth login endpoint, a form-submission endpoint,
and branch preview builds for in-review edits. This is a deliberate split, not the
original single-platform Netlify plan.

`aiiskwt.com` is **not** a blank slate. It currently serves the school's real,
existing live site (confirmed live, 200 OK, real title, as of this doc). It is also
the source the inner pages' copy was adapted from. The DNS cutover to GitHub Pages
is a real production change with rollback stakes, not a same-day flip.

## Goals

- A non-developer can log into `/admin` and edit every content block of the two
  bespoke pages, then publish with no code changes:
  - Homepage: hero copy, promise text, news items, division cards, teacher bios,
    values, closing CTAs.
  - Our Story: hero eyebrow/title/photo, lead headline and copy, founding-story
    callout, Quick Facts (figure + label, any number of cards), mission statement
    and its two columns, the alternating story blocks (heading, copy, link, photo),
    and the closing destination links.
  - Site-wide: nav, footer links, and the shared inner-page sidebar (About text,
    Quick Links, address/phones), each edited once and applied everywhere.
- An editor can edit any inner page's title, breadcrumb label, optional lead line
  and body. The body is built from the template's existing blocks: rich text with
  headings, image, feature cards, and point list. Editors can add new inner pages
  the same way.
- Every path in `content/site.json`'s menu exists as a real, routable page on the
  live site, backed by a CMS collection entry, even where the content starts
  minimal. That is **47 internal paths**, including the homepage and Our Story. The
  external "Online Registration" link (`aiis.schoolmanageronline.com`) and the `#`
  placeholder for "Middle and secondary" are not pages. The two `pending` wildcard
  entries (`/web/category/*`, `/web/single-galleries/*`) aren't linked from any nav
  and are out of scope until they are.
- URLs are extensionless and match `content/site.json` exactly (`/our-story`, not
  `/our-story.html`).
- Editors can add and update news & events posts without touching code.
- The live site is served by GitHub Pages at AIIS's custom domain. A GitHub Actions
  workflow builds and deploys it automatically on every push to `main`. CMS edits
  are git commits, not a separate database.
- The visual design, animations and behavior of the homepage, Our Story and the
  inner-page template are unchanged.
- The two forms currently stubbed as "not connected yet" (admission enquiry, contact
  us) submit successfully once their pages exist. They go through a Netlify-hosted
  submission endpoint. Native Netlify Forms auto-detection doesn't apply directly,
  because Netlify doesn't build the production HTML (see Approach 6).
- Content that is still illustrative stays visibly flagged as illustrative in the CMS
  until someone replaces it (see "Placeholder conventions" under Constraints).

## Non-goals

- Writing, rewriting or fact-checking page copy. Inner pages carry copy adapted from
  the live site and migrate as they are. Illustrative copy on the homepage and Our
  Story stays until the school supplies real copy. The school supplies content and
  photos over time; that is not part of this build.
- Bespoke art direction or animation for more pages. Only the homepage and Our Story
  are bespoke. Everything else uses the shared inner-page template.
- Multi-language support, on-site search, and payments/SIS integration. None of these
  exist today beyond UI placeholders, and none are in scope.
- Scheduled publishing, or per-role permissions beyond what Decap's editorial
  workflow gives out of the box.
- Migrating DNS/email records unrelated to the website itself.

## Anti-goals

- Changing the markup, class names, `data-k`/`data-section` hooks or animation
  behavior of any existing page as a side effect of introducing a build step.
- A setup where a developer has to touch YAML or code to change a sentence, swap a
  photo, add a Quick Fact or reorder an inner page's blocks.
- Nav links that point at pages which 404, or a build that breaks when a sitemap
  entry has no real content yet. Every sitemap path must resolve to *something*.
- Shipping the `.html`-suffixed links that exist in the `main` checkout's local edits
  as a preview workaround (see Constraints).
- A DNS cutover with no rollback path, or one that drops `aiiskwt.com` while the new
  site isn't ready.

## Constraints

- Must use Decap CMS (git-based, no hosted database). Production hosting is GitHub
  Pages with a custom domain. Netlify's role is narrowed to CMS auth, form submission
  and preview builds (decided in conversation, overriding the original "Netlify
  hosts everything" framing).
- The repo already lives on GitHub (`se-kwt/aiis-web`). No Netlify project is linked
  yet.
- `aiiskwt.com` currently resolves to the school's real, live existing site. This is
  a cutover with real downtime/rollback stakes, not a fresh launch.
- **The current design isn't on one branch yet.** As of this doc, `main` has only
  the homepage committed (`50f27cb`). The newer work is uncommitted, in two places:
  - The main checkout has Our Story, the `site.json` "Our Story" entry, the
    `our-story` module registered in `js/main.js`, and the ABOUT US nav links on
    the homepage and Our Story rewritten to `/….html` so they work under a plain
    static file server.
  - The `our-story-page` worktree has the same Our Story files, all 37 inner pages,
    and `css/page.css`. It keeps extensionless links and serves them through a
    local preview server (`.claude/static-server.cjs`) that falls back to `.html`.

  These have to be consolidated onto one committed branch, with extensionless links,
  before migration starts. That branch is the parity baseline.
- The site has no build step today. `package.json` still lists `esbuild` and
  `playwright` as devDependencies, and scripts that point at `tools/bundle.mjs` and
  `tests/`. Those were deleted in a prior cleanup ("chore: strip down to the site
  itself") when the project moved from benchmarking another school's site to an
  original design.
- Page JS is a small module registry. `js/main.js` imports feature modules, and each
  module exports `{ name, section, init }`. A module runs against its `data-section`
  element: `hero`, `carousel`, `values`, and `our-story` for the Quick Facts
  prev/next buttons. Page-wide modules such as `temp-photo` use `section: null`.
  Modules select elements by specific classes and `data-k` / `data-section` /
  `data-facts-*` / `data-hl` attributes for GSAP/ScrollTrigger animations. The new
  build must reproduce that markup on every page, not just visually similar
  markup.
- Each page links only the stylesheets it needs. For example, Our Story loads
  `our-story.css` and the inner pages load `page.css`. Layouts should keep that
  per-page-type CSS list rather than loading everything everywhere.
- Headings use inline highlight spans, such as
  `<span class="hl" data-hl>We Nurture</span>` in Our Story's lead and mission
  titles. The animation code depends on them, so editors need a simple way to mark
  highlighted words without writing HTML.
- **Placeholder conventions already in the markup.** Illustrative copy carries
  `data-placeholder="<why>"` (for example "illustrative figure" or "illustrative
  mission statement, not confirmed AIIS wording"). Photos that haven't been
  supplied yet are `<figure class="tp" data-temp-photo>` frames with a
  screen-reader description of the intended photo. `temp-photo.js` keeps the frame
  intact if a hotlinked image fails to load. The CMS fields and templates must keep
  both conventions, so placeholder status survives migration and is cleared only
  by an editor supplying the real thing.
- `content/site.json`'s menu is the owner-supplied, authoritative sitemap (August/
  November 2026 document, plus the Our Story addition). Routes, nav labels,
  breadcrumbs and `aria-current` should derive from it, not be hand-duplicated
  again.
- Decap needs a real authenticated git-write flow, not just an `admin/config.yml`.
  A backend and login mechanism must actually be implemented, and GitHub Pages
  cannot run that mechanism itself because it runs no server-side code.
- Netlify's native Forms feature only auto-registers forms that Netlify builds
  itself. Production HTML is built by GitHub Actions, not Netlify, so forms need a
  cross-origin submission path instead of relying on that auto-detection.
- Account-level setup (Netlify project, GitHub OAuth App, DNS records) is driven via
  CLI (`netlify`, `gh`) in this project. The user confirms each account-level
  action individually; there is no separate manual dashboard checklist.

## Approaches considered

1. **Build system / SSG — picked: Eleventy (11ty).** Eleventy reads markdown/YAML
   content (what Decap writes) through plain templates and emits static
   HTML/CSS/JS, the same kind of output the site already has. The existing markup
   carries into layouts nearly verbatim, and the `<!-- build:* -->` comments
   already mark where the includes go (header, menu, footer, page body), so
   `site/js/*.js` doesn't need to change. Permalinks are set per page to produce
   `/<slug>/index.html`, matching `site.json`'s extensionless paths. Rejected:
   reviving the previous bespoke Node template/bundler system
   (`templates/partials/*.mjs` + `tools/bundle.mjs`, removed last week). It would
   mean re-implementing collections, pagination and content loading that Eleventy
   already does, for no benefit. Rejected: a component framework (Astro, Next,
   etc.). It would force rewriting working vanilla-JS animation code, and this site
   is deliberately not component-based.

2. **Production hosting — picked: GitHub Pages with a custom domain, built by a
   GitHub Actions workflow** (decided in conversation). The workflow runs the
   Eleventy build on every push to `main` and publishes the output to GitHub Pages.
   DNS for `aiiskwt.com` points at GitHub Pages instead of Netlify.

3. **Decap auth backend — picked: GitHub backend with a GitHub OAuth App, fronted
   by a small Netlify Function that acts only as the OAuth provider**, not as the
   site host. The repo is already on GitHub. Editors just need push access as
   collaborators and never touch git directly, because Decap's UI handles that.
   Rejected: Git Gateway + Netlify Identity. Netlify has told the Decap maintainers
   there will be no further maintenance of Identity/Git Gateway. One contested
   Netlify post claims a partial reversal, but building new on a feature in that
   state is a bad bet. Rejected: Decap Turbo, a hosted auth/proxy SaaS. It adds a
   recurring paid dependency for something a small, free, self-owned function
   covers.

4. **Draft previews for the editorial workflow — picked: keep a minimal Netlify
   project that builds branch-deploy previews of the Eleventy output, purely for
   Decap's "show preview link" feature on draft edits. Production traffic never
   touches it.** Decap's built-in deploy-preview links are a Netlify integration
   that needs *something* building each draft branch. The same small Netlify
   project, already needed for the OAuth function, also builds per-branch previews,
   so editors keep that convenience. Production still only ever deploys via the
   GitHub Actions → GitHub Pages path. Rejected: dropping deploy previews entirely.
   That would make the review step in `editorial_workflow` a blind approve/reject
   with no way to see the change first.

5. **Editorial workflow — picked: Decap's `editorial_workflow` on.** An edit opens a
   draft, with the preview link from Approach 4, before anything goes live, instead
   of Decap's default of publishing instantly on save. It costs one extra click but
   is safer for non-technical editors.

6. **Forms — picked: plain AJAX submission from the GitHub-Pages-served form HTML
   to a Netlify Forms endpoint on the same small Netlify project.** A hidden
   "shadow" form in that Netlify project lets Netlify's build register the field
   names. The real visitor-facing form, on the production domain, posts to it
   cross-origin. The two form pages use the inner-page template with a form block
   in the body. Rejected: a fully custom form backend, which is more to build and
   maintain than reusing Netlify Forms' existing submission handling and
   notifications.

7. **Inner pages — picked: one shared inner-page layout (`page`) and one Decap
   `pages` folder collection, with the body as an ordered list of typed blocks.**
   The blocks are rich text (markdown with h2 / paragraphs / lists), image
   (`figure.tp`, with a placeholder description until a photo is supplied), feature
   cards (`page-features`: heading + text) and point list (`page-points`). This is
   Decap's `list` widget with `types`. Front matter holds the title, breadcrumb
   label, optional lead (`page-hero__lead`) and permalink. The sidebar is one
   site-wide settings file, because it is identical on every inner page. This
   template is already designed and applied to 37 pages; the build reproduces it,
   it doesn't redesign it. It replaces the earlier plan of four layouts
   (`simple-page`, `facility`, `sport`, `news-post`). Facility, sport, program and
   message pages all turned out to fit the one template. Rejected: one markdown
   body per page with raw HTML for cards and point lists. Editors would have to
   touch markup, which fails the anti-goal. Rejected: separate collections per page
   family. They would duplicate an identical schema for no editor benefit, and
   folders or filters in the one collection can group pages in the CMS sidebar if
   needed.

8. **Our Story — picked: its own layout plus a single-file Decap collection**, the
   same pattern as the homepage. Our Story is a one-off bespoke design, not a
   reusable type. Its repeating parts (Quick Facts cards, story blocks, closing
   links) are `list` fields. Story blocks alternate photo/copy sides automatically
   by position, so editors don't manage layout. Rejected: forcing Our Story into
   the inner-page block system. It would lose the bespoke sections and the Quick
   Facts behavior.

9. **The 8 sitemap paths with no page yet — picked: build them as part of this
   plan, but only as far as their type needs.** News & Events (`/news-events`)
   becomes a listing page plus a `news` folder collection (one entry per post), and
   the homepage news items read from the same collection. The two form pages are
   inner pages with a form block (Approach 6). The gallery (`/web/gallery`),
   calendar, weekly test and the two careers pages start as minimal inner pages
   with placeholder content, until the school supplies something that needs more.
   Note: the sitemap has no standalone staff-directory page, so there is no
   staff-bio layout. Teacher/staff content stays in the homepage's existing
   carousel.

## Decided scope (from conversation and current design)

- Build the CMS and page-template system to cover the whole sitemap now. Two bespoke
  pages (homepage and Our Story) keep their current designs and animation
  untouched. Every other page uses the existing shared inner-page template.
- Migrate the 37 already hand-built inner pages' content into CMS content files as
  it stands. New or empty pages start minimal and are filled in as the school
  supplies content.
- Production hosting is GitHub Pages under AIIS's own custom domain. Netlify is
  backend-only (CMS login, form submission, draft previews) and never serves visitor
  traffic.
- Account-level setup (Netlify project, GitHub OAuth App, DNS changes) happens via
  CLI in this project, with the user confirming each account-level action.

## What's left to the builder

- Exact field schemas per Decap collection: field names, widget types, validation,
  and the block types' fields.
- How editors mark highlighted words in headings (`span.hl[data-hl]`). For example,
  a lightweight `==word==` syntax converted by an Eleventy filter, or a dedicated
  "highlighted phrases" field. It must not require HTML.
- How placeholder status shows in the CMS. For example, an "illustrative / needs
  real content" flag per field or block that renders `data-placeholder`, and image
  fields that render the `data-temp-photo` frame when empty.
- Exact Eleventy directory/data layout (`_data`, `_includes`, content folder shape),
  and how each layout declares its own stylesheet list.
- Whether the HTML → content-file migration of the 37 inner pages is scripted (parse
  the `<!-- build:page -->` region into front matter + blocks) or done by hand. A
  script is preferred, verified against the baseline.
- The Netlify Function OAuth provider implementation. Adapt a known-good reference
  implementation rather than inventing one.
- The exact GitHub Actions workflow (build + deploy to Pages), and the Netlify
  project's own minimal build config (functions + branch previews only).
- The shadow-form mechanics for cross-origin Netlify Forms submission.
- The News & Events listing page design, kept within the inner-page template's
  visual language. No new art direction.
- Whether to remove or keep `esbuild`/`playwright` and the dead `test` /
  `build:single` scripts in `package.json`. Flagged as cleanup, not blocking.
  `playwright` may be worth keeping for parity screenshots.
- Removing the `<meta name="robots" content="noindex, nofollow">` tag, which is on
  every page. That's a launch decision, out of scope here; flagged as a reminder.

## Rough phase shape (for the implementation plan)

0. Consolidate the current design onto one committed branch. Take Our Story, the 37
   inner pages and `page.css` from the `our-story-page` worktree, and the
   `site.json`/`main.js` changes, which are identical in both places. Keep
   extensionless links and drop the `.html` link workaround. This is the parity
   baseline for every later phase.
1. Introduce the Eleventy build: turn the shared chrome (intro, header, menu,
   footer) into includes, and create three layouts: homepage, Our Story, inner
   page. Pass `css/`/`js/`/`assets/` through unchanged. Verify that the rendered
   output for all three page types keeps the baseline's markup and behavior, and
   that every page is served at its extensionless path.
2. Convert the homepage's and Our Story's hardcoded text and images into
   Decap-managed content files wired into their layouts. Keep placeholder flags.
3. Drive header/menu/footer nav, breadcrumbs and `aria-current` from
   `content/site.json` via Eleventy data, and remove the hand-duplicated nav
   markup, so the sitemap is the single source of truth.
4. Migrate the 37 inner pages into the `pages` collection (front matter + blocks)
   and move the shared sidebar into one settings file. Verify each page against the
   baseline.
5. Build the remaining 8 paths: News & Events listing + `news` collection (and point
   the homepage news items at it), the two form pages, and minimal inner pages for
   gallery, calendar, weekly test and the two careers pages.
6. Add the GitHub Actions workflow that builds the Eleventy site and deploys it to
   GitHub Pages on every push to `main`.
7. Create the minimal Netlify project (functions + branch-deploy previews only, no
   production traffic) for the OAuth function, the shadow form and draft previews.
8. Implement and register the GitHub OAuth App + Netlify Function provider, and wire
   Decap's auth endpoint to it.
9. Install Decap: `admin/index.html` + `admin/config.yml`. Collections: homepage,
   Our Story, site settings (nav/footer/sidebar), `pages`, and `news`. Use
   `backend: github` with `editorial_workflow: true`, and point the preview-links
   setting at the Netlify branch-deploy URLs.
10. Wire the admission-enquiry and contact-us forms to the Netlify Forms shadow
    endpoint via AJAX.
11. DNS cutover: point `aiiskwt.com` at GitHub Pages. Record the previous DNS records
    first so the change can be reverted quickly if something's wrong.
12. QA: parity with the baseline for all three page types after migration; the full
    login → edit → preview → publish flow, including adding a Quick Fact and
    reordering an inner page's blocks; nav/sitemap/breadcrumb consistency, with all
    47 paths resolving and no `.html` links; forms actually deliver submissions;
    the domain cutover works and is reversible.
13. A short internal "how to edit the site" note for school staff, pointed at
    `/admin`. It should explain the placeholder flags.

## Risks / notes

- Consolidation (phase 0): two working copies of the in-progress pages currently
  disagree on link style, and the inner pages exist only in an uncommitted
  worktree. Losing or half-merging them would mean rebuilding 37 pages, so commit
  them before anything else.
- The inner pages' copy was adapted from the live aiiskwt.com site. Migrating it is
  mechanical, but some of it may be outdated. That's for the school to review, not
  this build.
- Sequencing: prove out the GitHub Actions → Pages pipeline and the custom domain on
  GitHub Pages' own default subdomain before the real DNS cutover (phase 11).
- The DNS cutover touches a live, real site with real visitors. Treat it as its own
  reviewed step with an explicit rollback (keep the current DNS records on hand),
  not something bundled silently into a routine deploy.
- Decap's typed-list (`list` + `types`) editing for inner-page blocks is the main
  editor-facing complexity. Validate early that non-technical editors can add,
  reorder and remove blocks comfortably, and that the CMS preview pane renders
  them close to the real template.
- Netlify Identity's exact 2026 status is contested across Netlify's own docs and
  forum posts. That doesn't change the backend pick, since GitHub is the better
  choice regardless. Identity just isn't necessarily dead if this is ever
  revisited.
- The Decap "preview link" feature's exact config for a setup where Netlify builds
  only previews, not production, is less common than the standard all-Netlify
  setup. Run a quick validation spike early rather than assuming it works
  identically.
