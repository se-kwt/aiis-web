# AIIS homepage: handover

## Read this first: do not publish yet

This page is a private working build. Please read these five points before you share, upload or deploy anything.

1. **The `docs/reference/` folder is private working material.** It holds screenshots and side-by-side comparison sheets of another school's website (Shady Side Academy), including photographs of its students. Never publish, share or deploy that folder. The screenshots and sheets are kept on your computer only; they are no longer tracked in git and are listed in `.gitignore`.
2. **The page uses another school's photos and videos for now.** While the temporary media is in place, every visitor's browser contacts that school's servers directly, so their IP address and the address of this page are disclosed to that school's host. The media can change or vanish without notice, and using it publicly is not permitted. The page must stay private until every temporary photo and video has been replaced. (As a safeguard the page carries a tag that asks search engines not to list it; remove it only at launch, see section 3.)
3. **Google and a public code library are contacted by every visitor.** The fonts load from Google and the animation library (GSAP) from a public CDN, so every visitor's browser contacts those services. Hosting both on your own server before launch is **required**, not optional (it is in the must-do list in section 3). Privacy and consent rules where the school operates may also apply to this.
4. **The design closely follows another named school's website.** The layout, the line-art placement and the motion all follow Shady Side Academy's homepage. Whether publishing a site this close to it is acceptable is a legal and reputational question for you to take advice on before launch. This build does not answer it.
5. **The git history still contains the reference screenshots.** Earlier commits include them, even though they are untracked now. Do not push this repository to any public or shared host without cleaning its history first. Publish only the contents of `site/` (or the single file), never the whole repository.

## 1. What this is

This is the Aspire Indian International School (AIIS) homepage, built as a close copy of the Shady Side Academy homepage: same layout, same measured sizes and positions, same animations, with AIIS colours, crest and wording. It is a plain static site (HTML, CSS and a little JavaScript, no framework). Status: the build is finished and checked against the reference at 1440, 768 and 375 px wide, and the automated suite passes (199 tests). It is **not ready to go public**: it still shows another school's photos and video as stand-ins, and several details are placeholders (section 3).

## 2. Open it, run it

- **Preview on your computer:** run `tools/serve.sh` and open http://localhost:4173. It needs Python 3 and nothing else.
- **The single file for Claude Design:** `dist/AIIS Homepage.html`. It has all the styles, scripts and the AIIS crest image inside it, so it is one file. Fonts, the animation library (GSAP, with an integrity check) and the temporary photos and videos are still fetched from the internet when the page opens. The file is about 739 KB.
- **Regenerate that file** after any change in `site/`: `npm run build:single`. The file is generated, so do not edit it by hand; it is committed so you can drag it straight out of the `dist` folder. A test (`bundle_is_fresh`) fails if it is out of date.
- **Claude Design project:** https://claude.ai/design/p/d42fa33a-18d5-4ade-9ffb-73922849aed4. The upload step is done by hand: drag `dist/AIIS Homepage.html` into the project.
- **Run the checks:** `npm test` (about 8 minutes; it needs internet access for the fonts, the animation library and the temporary media). It does not contact the reference site's pages unless you set `REF_LIVE=1` (section 8).

## 3. Before this can go public

Keep the Claude Design project private until item 1 is done. Everything below is required unless it says otherwise.

1. **Replace every temporary photo and video.** The page hotlinks media that belongs to another school and tags each one with a small "Temp photo" label (the video pop-up shows the same tag). `docs/image-slots.md` ([image-slots.md](image-slots.md)) lists every slot, its size and crop, and what shot AIIS needs to supply. When a slot gets an AIIS file, also remove `data-temp-photo` (or `data-temp-video` on a play button) and the `tp` class from its `<figure>` so the tag goes away. The descriptions for screen readers (the `alt` text) of those photos describe the temporary pictures and must be rewritten for the real ones.
2. **Replace every sample or placeholder text** with the real thing. The exact list is the "Placeholder checklist" below; each of those strings is marked in the page with a `data-placeholder` attribute and a test keeps this list and the page identical. Search the page for `data-placeholder` to find them.
3. **Self-host the fonts and the animation library.** Copy Anton, Fraunces and Geologica (as `woff2`) and GSAP 3.12.5 with ScrollTrigger onto your own server and point the page at them. This stops every visitor's browser contacting Google and the CDN (see the warning at the top).
4. **Wire up or hide the "+" buttons on the values photos.** They look clickable (hover and focus effects) but do nothing yet, because the reference's pop-out panel has no AIIS wording to show.
5. **Remove the `noindex` tag** (`<meta name="robots" content="noindex, nofollow">` near the top of `site/index.html`) only at launch, and only after items 1 to 3 are done. Rebuild the single file afterwards.
6. **Test in Safari (iPhone and Mac) and Firefox.** All testing so far was in Chromium only.
7. **Basic search and sharing set-up:** a page description, a favicon and social sharing tags are not there yet. Decide about analytics and a cookie-consent notice too (and a privacy notice if you collect any data).
8. **Sitemap follow-ups and owner decisions.** The menus and links now follow the school's sitemap (August 2026), so these need the owner before launch: (a) **a privacy policy page is needed**: the sitemap has none and the footer no longer links to one; (b) complete the sitemap's own verification checklist (the facility pages, the gallery albums, the newsletter volumes and the middle/secondary page); (c) the **Middle and secondary** "Learn more" has no page yet (see section 5); (d) **homepage title:** the sitemap suggests an SEO title beginning "Best Indian School in Kuwait"; it is not used, because the brand guide advises against unbacked "best" claims. The page keeps its current `<title>`; decide; (e) **group name:** the sitemap mentions a newsletter from "DAS Schools" while the page says "Part of the Stellar group of schools."; confirm the correct group name; (f) **menu pages left out of the new navigation (November 2026):** the owner's navigation list has no *Why AIIS*, *News & Events*, *Calendar*, *Newsletter*, *Fee Payment* or *Space Club* entries, so they are no longer in the header or the menu (the footer still links to Calendar, and the news cards to `/news-events`); say where they should go, or whether they are retired. The footer still uses the older sitemap's labels and paths ("Fee Structure", "Weekly Test" at `/weekly-test`, "Careers" at `/career-opportunities-at-aiis-kuwait`) while the navigation uses the new list's ("Fees & Schedules", "Weekly Test" at `/weekly-test-curriculum`, "Career" at `/aiis-career-new`); decide which is right and align the footer.
9. **Logo:** the official crest is in use in every logo slot (no stand-ins remain). One small follow-up: the brand guide's minimum crest size is 60 px, and the header, mobile header and menu slots are smaller, so swap in a horizontal lockup or an emblem-only file there when one exists. Details and how to regenerate the web copy are in [SOURCE.md](../site/assets/logos/SOURCE.md).
10. **Links:** the menus, footer, closing buttons and logo links use the sitemap's root-relative paths (for example `/admission-process`), which work once the site is served from the school's domain (aiiskwt.com); they do not work when the single file is opened from disk or in the Claude Design preview. Still pointing to `#`: the four social icons and the four Social cards (the sitemap has no social links), the language item, and the Middle and secondary "Learn more" (no page). The news cards link to `/news-events`. **Online Registration** (under Quick Links) is the only link to another site (`https://aiis.schoolmanageronline.com`); it opens in a new tab. The `tel:` and `mailto:` links are sample values (see the placeholder checklist). Show the school's website address (www.aiiskwt.com) in the footer if wanted; it is not shown now.

### Placeholder checklist

Every string below is invented or provisional. Replace or confirm each one before launch.

- **News cards (sample headlines, not real AIIS news):** "Science fair celebrates young inventors"; "Grade 5 learning walk"; "Sports day highlights"; "Welcome back to a new term".
- **Social cards (channel names; the school's real channels are not confirmed):** "Instagram"; "Facebook"; "YouTube"; "LinkedIn".
- **Teacher names:** "MS. PRIYA & MS. ANITHA"; "MR. RAHUL"; "MS. FATIMA"; "MS. SARAH"; "MR. JOSEPH"; "MR. ARJUN"; "MS. MEERA".
- **Teacher roles:** "Kindergarten Team"; "Mathematics Teacher"; "Science Teacher"; "English Teacher"; "Visual Arts Teacher"; "Physical Education"; "Music Teacher".
- **Teacher play-button labels (read by screen readers; they carry the invented names):** "Play Full Video: MS. PRIYA & MS. ANITHA"; "Play Full Video: MR. RAHUL"; "Play Full Video: MS. FATIMA"; "Play Full Video: MS. SARAH"; "Play Full Video: MR. JOSEPH"; "Play Full Video: MR. ARJUN"; "Play Full Video: MS. MEERA".
- **Footer contact details:** "AIIS Abbasiya Campus" (derived, not given by the school); "info@aiis.example"; "+965 0000 0000".

Not marked, but also to confirm with the owner: the three value headings (CARING TEACHERS, GLOBAL OUTLOOK, VALUES-LED LEARNING) and the three grade bands (Pre-KG to KG, Grades 1 to 5, Grades 6 to 10), which come from the approved copy table but state things about the school; and a few screen-reader labels written for this build (for example School life at AIIS and Students learning by doing).

## 4. What matches the reference, and how we know

- **How many things are measured.** There are 147 measured keys (elements) across all the sections plus the intro. They are compared against the reference at 1440, 768 and 375 px wide: position and size within about 4 px, and the same fonts, sizes and mapped colours. Reference measurements are in `docs/reference/ssa-1440.json`, `ssa-768.json` and `ssa-375.json`; the element map is `tools/selector-map.json`.
- **How many are compared fully.** 90 of the 147 keys are compared on every axis. The other 57 carry a waiver, which means one or more checks is skipped or changed because the AIIS wording is different, not because the layout is allowed to drift: 26 keys skip some of the horizontal or vertical checks (`copyAxes`, each with a written reason, mostly word widths and where a highlighted word falls); 36 keys are compared on text only (`text: true`, the size and the position are checked but the block's height is not); 16 keys expect a different count of repeated items (`aiisCount`, for example one campus where the reference has four). (The groups overlap, so they do not add up to 57.) Since the final fix pass the top edge of the text keys is compared too; only one key needed a waiver for it, the learning column text below 1000 px, which sits under a title whose line count is AIIS wording (the gap below that title is checked instead). Of the 199 tests, one is skipped by default (the opt-in live-reference test).
- **Where the geometry was verified.** Only at 1440, 768 and 375 px wide, and only in Chromium. Widths in between follow the same rules and were checked by individual tests and screenshots, not against full reference data.
- Where a box could not match exactly (copy length differs), the test normalises that single axis and says so in the test.
- Interactions are tested too: menu and dropdowns, news panel, flip cards, carousel, video modal, hero and learning video controls, scroll effects, keyboard access, reduced motion, no horizontal scroll at 375, a slow or blocked Google Fonts or animation library, and a text guard (`tests/approved-strings.json`) that fails if any new visible text, `alt`, `aria-label` or `title` appears on the page without being approved by hand.
- Side-by-side sheets, Shady Side on the left and AIIS on the right, cropped section by section: `docs/reference/compare-1440.png`, `compare-768.png` and `compare-375.png` (full-page captures are in `docs/reference/screenshots/`). These images are local-only (see the warning at the top); regenerate them with `node tools/compare.mjs`.
- Run everything with `npm test`. At the time of writing this handover the suite is 199 tests, including the bundle, handover, school-name, crest-shape and approved-strings tests; the bundle tests also check that the single file behaves like the multi-file page.

## 5. Known differences from the reference

Honest list. Some are deliberate, some are shortcuts.

- **By design:** colours (the official AIIS palette), logo, crest, and all wording are AIIS's. The decorative mascot in the teachers heading is the AIIS crest.
- **Decorative line art is approximated.** The corner line art, wave lines and badge disc are redrawn in AIIS colours, not copied path for path.
- **The values spiral is a ring.** It is an empty ring on AIIS; the reference has a filled spirograph. Not redrawn.
- **Learning icon rings are baked into the temporary images.** They come with the hotlinked pictures, so they disappear with real icons and need redoing.
- **The word-colour change in the values section is not built.** The first design brief had the big words turn from grey to navy as you scroll. The reference does not do that (the words stay put and the closing band slides over them), so by ruling R8 it was deliberately left out.
- **Chromium only.** Everything was tested in Chromium. Safari (iPhone) and Firefox must be tested before launch.
- **English only.** There is no Arabic or right-to-left version.
- **The news strip scrolls on its own and has no visible pause button.** It pauses when the pointer is over it and while it has keyboard focus, and it stops completely when the visitor's device asks for reduced motion.
- **Colours are the official brand values** from the AIIS brand guidelines (Comprehensive Brand Guidelines + Digital Design System, version 2.0, August 2026, pages 11 to 14): Navy 500 #2C2B7A, Navy 800 #1A1947 (dark bands, closing band, photo overlays), Orange 500 #FF6600, Orange 700 #BD4B00, Sky 500 #5CB9EB, Neutral 50 #F8F9FC, 200 #E2E6EE, 300 #CDD3DF, 600 #596376, 800 #2A3242 and 900 #171D2A. They are listed with scale, step and page in `tools/brand-palette.json`. The one value not on those pages is the light orange #FF9751 (the brand's stripe colours) used for the badge ring text.
- **The "Learn more" link on the division cards does not exist yet.** The original design said the opened cards would carry a "Learn more" link, but the approved copy table has no such text, so the cards have no link. The sitemap has pages for Early years (`/kindergarten-school`) and Primary (`/primary-school`) but none for Middle and secondary. Add the link text and paths when the copy is approved.
- **The website address is not shown in the footer** (www.aiiskwt.com).
- **The "+" buttons on the values photos look clickable but do nothing yet.**
- **If the browser blocks storage,** the 6.5-second crest intro plays on every page load, not once per visit.
- **Heading type is scaled where the AIIS wording is longer:** the hero headline (between 1000 and about 1450 px, exact 160 px at 1440 and up) and the learning heading (about 114 px so it fits the fixed 490 px box). Box sizes match; the letters are a little smaller.
- **In-between widths are checked by rule or one-off, not against full reference data.** The reference was measured only at 1440, 768 and 375. Layouts at 800 to 999 and 1000 to 1439 px follow the same rules and were checked by individual tests and screenshots (the teacher cards and promises rows at 800 and 999 use numbers read from the live reference and labelled as such).
- **The footer is the reference's off-white**, not the dark navy the first spec described.
- **The header menu:** full-screen menu below 1000 px and hover dropdown at 1000 px and up, as in the reference.
- **Search and translate are not wired up** (the search button does nothing and the language list has English only).
- **The single-file bundle fills five of its six logo slots by a small script** at the end of the page, which runs as the page is parsed (it does not wait for the fonts or the animation library). Without JavaScript only the desktop header logo shows; `site/` loads every logo from the file itself.
- **Hotlinked media can disappear** if the other school changes its site; the page then shows a broken-image fallback.
- Several accessibility labels and card titles are AIIS-invented (see the placeholder checklist in section 3).

## 6. Decisions made during the build

48 rulings recorded in the progress ledger (`.superpowers/sdd/2026-10-08-aiis-homepage-exact/progress.md`). Rulings recorded: **48**. Later rulings go below this list and the count above is updated.

- **R1.** The git repository and `.gitignore` were set up before work began (cost if wrong: none; the first task appended instead of creating).
- **R2.** Tasks 4 to 10 were allowed to edit `site/js/main.js` and `site/index.html` to register their modules (cost if wrong: none).
- **R3.** All the build helpers (builders and reviewers) used the Sonnet model because that was requested (cost if wrong: stuck fixes less likely to resolve, and the final review is less deep).
- **R4.** The test command is `npm test` (Node 26 reads `node --test tests/` as a module) (cost if wrong: none).
- **R5.** The reference uses a hover dropdown menu at desktop widths and a full-screen menu below, so AIIS does the same instead of the full-screen menu everywhere (cost if wrong: header rework if a full-screen menu was wanted on desktop too).
- **R6.** Decorative art that the reference draws as background layers is built as real elements in AIIS so it can be measured and tested (cost if wrong: none for visitors).
- **R7.** The AIIS Design System could not be read, so colours came from its readme with missing shades derived and flagged, and the logo came from the AIIS website (cost if wrong: swap three logo files and a few colour values). Superseded: the owner's brand guidelines later replaced every derived shade with the official values (see section 5).
- **R8.** Where observed reference behaviour differs from the spec's description, the reference wins (for example the values words do not change colour and the closing band slides over them like a curtain) (cost if wrong: the values section needs rework).
- **R9.** The reference's bulldog mascot beside the teachers heading is replaced by the AIIS crest at the same size, with no invented mascot (cost if wrong: swap one image).
- **R10.** The reference's darkest navy maps to AIIS Navy, while large dark bands use a derived darker Navy 900, and tests accept that for band and footer backgrounds (since changed to the official Navy 800, #1A1947) (cost if wrong: noise in colour tests).
- **R11.** Section root keys are named like `hero-root` (as in the selector map) rather than `hero-section` as the plan said (cost if wrong: none).
- **R12.** The font-fallback test must prove fonts are really blocked and, later, use the real hero, divisions and closing headings (cost if wrong: weaker fallback coverage).
- **R13.** A module's `init()` may return a promise and the page waits for it before marking the section ready (cost if wrong: none).
- **R14.** The PORTALS menu group has a single link, Parent Portal (cost if wrong: add links later). Superseded: the group is now QUICK LINKS with five links (R47).
- **R15.** Comparison screenshots use the installed Google Chrome so the hotlinked video plays (cost if wrong: grey video frames in captures).
- **R16.** The hero headline shrinks between 1000 and about 1450 px so it stays on one line, and is exactly the reference size from 1440 up (cost if wrong: headline slightly smaller at in-between widths).
- **R17.** An extra blank line added on phones to keep a test's positions was removed and the test now measures relative to its own row (cost if wrong: one extra fix).
- **R18.** A measuring-tool fix (applying transforms to pseudo-element boxes) was done in the Task 7 round and the earlier art positions were corrected to the true geometry (cost if wrong: it touched earlier files outside that task).
- **R19.** The learning title keeps the reference's fixed 490 px box and the type is scaled to fit it (cost if wrong: the heading is about 5 percent smaller).
- **R20.** The intro is measured with a test-only hold that freezes it, instead of racing the clock (cost if wrong: one extra branch in `intro.js`). Originally this was a `?introhold` web address flag; ruling R35 replaced it with a flag the test harness injects.
- **R21.** The unreliable news-panel test was fixed at the root with state-based waits, and test-file concurrency is capped in `npm test` (cost if wrong: a slower suite).
- **R22.** The footer stays the reference's off-white rather than navy (cost if wrong: recolour the footer).
- **R23.** After a helper ran out of usage, the controller committed its finished edit unchanged and ran the verification suite (cost if wrong: that round's report was written from the diff).
- **R24.** Comparison sheets are made section by section, aligned, with the reference recaptured after its scroll reveals fire (cost if wrong: one more tooling change).
- **R25.** The final task was split: a single-file bundle plus this handover were built locally, and the Claude Design upload is done by dragging the one file in by hand (cost if wrong: one build script and an esbuild dev dependency).
- **R26.** Two uncommitted changes found in the working tree (the larger transparent crest file and the corrected page title) were treated as the site owner's own edits and kept (cost if wrong: git has the previous versions).
- **R27.** The owner's transparent crest is used in every logo slot, replacing the white-box stand-ins and the white chip on dark surfaces; the page loads a proportionally downscaled web copy because the original is 1.5 MB, and the original stays as the source file (cost if wrong: header slots show the stacked crest below the brand guide's 60 px minimum; swap in a horizontal lockup when available).
- **R28.** The web copy of the crest was raised to 540 px wide (at least twice the largest size it is shown at, the intro seal) and the size cap relaxed from 200 KB to 350 KB, because the first thing a visitor sees was soft on 2x screens (cost if wrong: the single file grows by about 100 to 150 KB).

Late rulings, made during the final fix pass:

- **R29.** A search-engine "do not list" tag (`noindex, nofollow`) is added to the page, because accidentally deploying a page that shows another school's media must not get it indexed (cost if wrong: one meta tag to remove at launch).
- **R30.** The default test run no longer contacts the reference site's pages; those checks only run when `REF_LIVE=1` is set, so `npm test` depends only on this repository, the fonts and the animation library (cost if wrong: a change on the reference site is noticed later).
- **R31.** Two small fixes were brought into the final pass: keyboard Tab can no longer reach the header or page behind the intro, and the learning video no longer downloads before it is needed (cost if wrong: none).
- **R32.** The hero badge ring text changes from Orange #FF6600 to the brand's light orange #FF9751, which reaches the 4.5:1 contrast needed on the Navy disc (cost if wrong: the ring text tint differs from the mapped Orange).
- **R33.** The sample news headlines and Social card names stay (the approved plan lists them) but every sample or placeholder string is marked in the page, and the checklist in section 3 is checked against those marks by a test; no visible "sample" label is added, to keep the design (cost if wrong: an owner who skips the checklist could publish invented headlines).
- **R34.** The top edge of text blocks is now compared with the reference too, through the same per-section adjustments; where the position truly follows the AIIS wording an explicit waiver with a reason is recorded (cost if wrong: either a few real vertical misplacements stay unfixed, listed in the fix report, or extra waivers). Outcome: the change was kept; only one key failed (`learning-col1-text` at 768 and 375 px, copy-driven), so it got an explicit waiver plus a title-gap check.
- **R35.** The `?introhold` flag is removed from the page; the test harness now injects the hold before load, and nothing in a web address can trigger it (cost if wrong: none).
- **R36.** The news strip also pauses while the pointer is over it, in addition to keyboard focus and reduced motion; no visible pause button is added, to keep the design, and the limit is stated in section 5 (cost if wrong: a strict reading of the accessibility rule wants a visible control).
- **R37.** The reference screenshots and comparison sheets are untracked and git-ignored but kept on disk as local working material; earlier commits still contain them, so the repository must not be pushed anywhere public without cleaning its history (cost if wrong: comparison sheets are no longer versioned).
- **R38.** The intro keeps the header and main inert for about 0.9 s after the overlay disappears; clicks are ignored for under a second once per session. Left as is; releasing it earlier is a one-line change the owner can request (cost if wrong: that one second).
- **R39.** The approved-strings guard covers markup strings only (not script-created or CSS-content strings) and does not check which group a string is in; it covers the place where the wrong-school-name defect lived (cost if wrong: a script-inserted invented string could slip through).
- **R40.** The logo-fill time bound in the bundle test is 5 s instead of 2 s; the test also checks the logos are filled before the page finishes loading (cost if wrong: none material).
- **R41.** The sitemap's suggested homepage title ("Best Indian School in Kuwait...") is not applied, because the brand guide advises against unbacked "best" claims; listed for the owner to decide (cost if wrong: one title change).
- **R42.** The line "Part of the Stellar group of schools." is kept although the sitemap mentions a "DAS Schools" newsletter; the group name is listed for the owner to confirm rather than changed on inference (cost if wrong: one footer line).
- **R43.** The menu groups keep the page's existing order (About, Admissions, Academics, logo, Student Life, News & Events) instead of the sitemap's order (Academics before Admissions), so the header layout does not change; the top-level items link to the first page of their group (cost if wrong: swap two list items). Superseded by R47.
- **R44.** The division cards have no "Learn more" link (the approved copy has no such text, and adding it would change the layout), so none was added; the sitemap's paths for Early years and Primary are recorded in `content/site.json` for when it is. The remaining `#` links are the social icons and cards (no sitemap URLs), the language item and the Middle and secondary link-to-be; the news cards go to `/news-events` (cost if wrong: add the links later).
- **R45.** The test that opens the single file with JavaScript off now waits for the page to be parsed (domcontentloaded) with a 90 s limit instead of waiting for every external resource, because it timed out when the machine was busy; every check it makes is unchanged (cost if wrong: none).
- **R46.** The last round of fixes (the narrower footer-link check and the more patient no-JavaScript checks) was left unsaved when a session ended; the edits were read in full, tested and saved unchanged rather than redone (cost if wrong: the report for that round was written from the changes, not by the agent that made them).
- **R47.** The header and menu follow the owner's navigation list (November 2026): five top-level groups, left to right ABOUT US, ACADEMICS, ADMISSIONS, the crest (Home), SCHOOL LIFE, AMENITIES, with QUICK LINKS (formerly PORTALS) in the utility slot. The list's eight groups did not fit five slots, so Community (Events, CSR Reports, Mandatory Public Disclosure) sits under ABOUT US as a labelled column, and Sports (Badminton, Cricket, Basketball, Soccer) is a nested submenu under AMENITIES: a hover or focus flyout on desktop, a second accordion in the full-screen menu. Every link is kept. Left out because the list does not have them: Why AIIS, News & Events, Calendar, Newsletter, Fee Payment, Space Club (listed for the owner in section 3, item 8). No separate Home text link was added: the crest links home on desktop and in the full-screen menu, and a text link would have moved the measured menu positions. A group's top label links to its first page (cost if wrong: regroup the menu data in `content/site.json` and the markup).
- **R48.** Two reference-comparison waivers were added because the QUICK LINKS label is wider than the reference's login label: the width of `header-login` (its right edge is still compared) and of `header-nav` (it fills what the label leaves). The dropdown panel keeps the full 1440 px width of the reference (cost if wrong: none for visitors).

## 7. Deferred small issues

Noted during review and deliberately left. None changes what a visitor sees at the checked widths unless stated.

**Tooling and tests**
- The colour comparison should catch a mapping failure and report all misses.
- Waiting for the reference to settle silently measures on timeout, and the reference intro wait swallows its first error.
- The widget-hiding rule hides anything with "cookie" in its class or id.
- `package.json` uses `^1.49.1` for Playwright instead of an exact pin.
- The selector test runs only at 1440 and cannot check pseudo-element keys.
- A missing `*-root` makes measurements fall back to the element's own box.
- The traversal test is weak and the `measureAiis` smoke coverage is thin.
- The image-slots test uses substring matching and ignores the size columns.
- The colour-map note is long and the intro discrepancy should be a numbered list.
- Tests that need the network (hotlinked photos, fonts, the animation library) cannot run offline.
- About 40 fixed-time waits remain in the suite (the new tests use state-based waits).
- An unused field in the highlight helper and a lead-in height assumption.
- Hard-coded values in the learning tests (a regex and column constants).
- Parallax-off tests check only the first element.
- Several waits use fixed 400 and 700 ms instead of readiness signals.
- The footer pitch test hard-codes 50 px and had one full-suite run in its fix round.
- Fix reports sometimes show a summary line, not raw test output.
- Page geometry is checked only at 1440, 768 and 375; in-between widths were not measured against the reference.
- The comparison tool needs Pillow (undocumented until now), has an unused import, and its PNGs are about 11 MB each.
- The 800, 999 and 799 px teacher numbers are hard-coded from the live reference, not from a data file.
- No test covers 1000 to 1199 px desktop layout, or 800 to 999 px for teachers' side-card values beyond the added regression tests.
- Pseudo-element measuring ignores non-centre rotation origins (no key uses one) and some reference numbers have inconsistent formatting.
- The mutation-style video-modal pause check is trivially true in headless mode.
- The hero single-line test checks height only, not overflow.

**Foundation and header**
- `body` uses `overflow-x: hidden`, which can hide overflow (prefer `clip`).
- A failed image keeps its broken marker if it later loads; the load check differs for SVG.
- No global reduced-motion base rule.
- Fallback font stacks have no size-adjust.
- Modules are awaited one after another, so a slow one delays later ones.
- The nav underline stays after a dropdown is dismissed with Escape; no `:focus-within` fallback where `:has()` is unsupported (the header then never hides, which is safe).
- Scroll lock pads the body only, so the fixed header shifts by the scrollbar width.
- Two global key listeners (translate and menu).
- Search is inert and the translate list is a stub.

**Intro, hero and news**
- Hard-coded colours (#2C2B7A in the intro art, #000 in the modal) bypass tokens.
- Some labels are not from the copy table (hero video label, icon alts, Pause video). The Social card names are in the placeholder checklist.
- The news panel's delayed 500 ms focus is not cancelled on a quick close.
- The video modal and the news panel both set page overflow, causing a scrollbar layout shift.
- The 12 second intro safety timer is never cleared.

**Promises**
- Text animation decides desktop or reduced-motion once at start and ignores later resize.
- Tests need the network for the hotlinked photos (see tooling above).

**Divisions (flip cards)**
- Escape only closes a card when focus is inside it.
- The reduced-motion flip test could also assert the 0.6 s in the normal run.
- `aria-controls` is asymmetric between front and back and some front ids are unused.
- Three cards share one `data-k` (cards 2 and 3 are not individually keyed).

**Learning**
- A redundant top/bottom pair on a relative element.
- Reveals replay after switching between desktop and mobile.
- Columns 2 and 3 reuse column 1's key and only column 1 is box-compared.

**Teachers**
- A resize during a carousel move is dropped.
- The whole slider is non-selectable, including captions.
- The heading icon reads reduced-motion once.
- Seven slides share one `data-k` (intentional).
- No test for the 800 to 999 px layout beyond the later regression tests.

**Values and footer**
- 1000 to 1199 px desktop layout is untested (the values heading may exceed its column).
- Footer link-row height is zeroed on both sides in the test.
- A redundant campus text-align rule below 800 px.
- Closing and footer links are placeholders.

## 7b. Defects found late

- **Wrong school name.** An earlier step had spelled AIIS out with an invented name in the footer copyright line, four logo-link labels, a crest description, this handover and the bundle. The school is Aspire Indian International School. It is fixed everywhere, and a test (`page_school_name_correct`, in `tests/identity.test.mjs`) now fails if the invented name appears anywhere in `site/`, the bundle or this file, or if any full spelling of the name on the page is not exactly the right one.
- **Logo stand-ins.** The white-background logo files are gone; see section 3 and [SOURCE.md](../site/assets/logos/SOURCE.md).

## 8. For developers

**Folder structure**
- `site/` the page: `index.html`, `css/` (one file per section plus `tokens.css`, `base.css`), `js/` (ES modules), `assets/logos/` (`crest.png` is the official source; the page loads `crest-web.png`, regenerated by `tools/make-crest-web.sh`) and `assets/art/`.
- `dist/` generated single file. `tools/` serve, measure, capture, compare, bundle. `tests/` the suite. `docs/` this file, `image-slots.md`, `reference/` (measurements and animation notes tracked; screenshots and comparison sheets are local-only and git-ignored), `superpowers/` the spec and plans.

**Module contract.** `site/js/main.js` imports each feature module and passes the list to `runModules`. A module exports `name`, `section` (the `data-section` value, or `null` for page-wide) and `init()` (sync or async). To add a section: write `js/<name>.js` with those exports, add one import and one list entry in `main.js`, and give the section element `data-section="<name>"`. When `init()` finishes, `data-ready="true"` goes on the section (page-wide modules put `data-ready-<name>` on `body`). A module that throws is logged and skipped; the rest still run.

**Tooling.** `tools/measure.mjs --target <ssa|aiis> --width <1440|768|375> --out <path>` measures every key in `tools/selector-map.json` (`<section>-root` keys plus the `data-k` elements). Test-only switches: the web address flag `?nointro` (no intro, settled page) and, for the intro, a window flag `window.__aiisTestHold` that the test harness sets before the page loads (`addInitScript`) to freeze the intro at its measured state; nothing in a web address can set it. `tools/capture.mjs` takes full-page captures. Regenerate comparison sheets with `node tools/compare.mjs [widths]`; it needs Python 3 with Pillow (`pip3 install pillow`) and uses the installed Google Chrome so videos decode.

**Single-file build.** `tools/bundle.mjs` (esbuild, unminified so it stays editable) inlines the stylesheets in order, bundles `js/main.js` into one inline script that waits for `DOMContentLoaded` (same timing as the module script), and turns local images and CSS art into data URIs (an image used in several places, like the crest, is embedded once and filled in by a tiny script, which keeps the file at about 739 KB). Google Fonts, GSAP and the temporary media stay as external URLs. **Limitation:** in the bundle only the desktop header logo carries the crest in its `src`; the other five logo slots (intro seal, mobile header, menu, teachers icon, footer) get it copied from that one by a small script at the end of `<body>` that runs while the page is parsed (it does not wait for the deferred animation scripts), so with JavaScript off they stay empty (their boxes, alt text and link names are kept, so nothing shifts). The multi-file `site/` version does not have this limitation.

**Dependencies.** Node 26 and npm; `playwright` 1.49.1 using its cached Chromium (some captures use Google Chrome); `esbuild` (dev only, for the bundle). Python 3 only for `tools/serve.sh` and comparison sheets.

**Runtime dependencies from the internet.** Google Fonts (Anton, Fraunces, Geologica; loaded without blocking the first paint, with a `<noscript>` fallback) and GSAP plus ScrollTrigger 3.12.5 from cdnjs (with `integrity` hashes, computed from the files cdnjs serves for exactly 3.12.5; recompute them if the version changes). Both must be self-hosted before launch (section 3). If the entry script has not started within 4 seconds (a slow or blocked third party), a safety net in the page head reveals the content and cancels the intro. Tests also need the network for the hotlinked temporary media.

**Opt-in live-reference test.** `tooling_ssa_selectors_resolve` loads the reference site's real pages to check that the stored selectors still resolve. It is skipped unless you run `REF_LIVE=1 npm test` (or `REF_LIVE=1 node --test tests/tooling.test.mjs`). Everything else in the default run reads the saved measurement files.

**Placeholders and approved text.** Anything in `site/index.html` that is a sample or placeholder carries `data-placeholder="what it is"`; `tests/final.test.mjs` checks those marks against the "Placeholder checklist" in section 3. `tests/approved-strings.json` lists every visible string on the page in three groups (`spec` copy table, `ui` assistive and interface strings, `placeholders`); `tests/approved-strings.test.mjs` fails on any string on the page that is not in the file and on any entry that is no longer on the page. When you change wording, edit the file by hand after reading the new text.
