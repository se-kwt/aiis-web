import fs from "node:fs";
import path from "node:path";
import MarkdownIt from "markdown-it";

// Inner-page content lives in `content/pages/*.md` — a plain directory Decap
// CMS (wired up in a later task) can edit directly, not nested under `src/`.
// Eleventy only scans its configured `input` directory ("src") for templates,
// so each content file is registered as a *virtual* template (added in
// Eleventy 3.0, `addTemplate(virtualInputPath, content, data)`) rather than
// relying on a symlink into `src/`. `content/pages/pages.json` still plays
// the same role a real Eleventy directory-data file would — it's read once
// here and its `layout`/`styles`/`permalink` fields are applied to every
// `.md` file in the directory, exactly like Eleventy's own directory-data
// cascade would, just computed by hand instead of discovered on disk.
const PAGES_DIR = "content/pages";
const PAGES_CONFIG_FILE = "pages.json";

function registerContentPages(eleventyConfig) {
  const configPath = path.join(PAGES_DIR, PAGES_CONFIG_FILE);
  const pagesConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

  const files = fs.readdirSync(PAGES_DIR).filter((filename) => filename.endsWith(".md"));
  for (const filename of files) {
    const raw = fs.readFileSync(path.join(PAGES_DIR, filename), "utf8");
    // The virtual path is relative to the `input` dir ("src"), so this
    // resolves to the same "src/pages/<slug>.md" identity the old symlink
    // produced — `page.fileSlug` (used by `pagesConfig.permalink`'s
    // "{{ page.fileSlug }}" template) is computed from this path the same
    // way it would be for a real on-disk file.
    eleventyConfig.addTemplate(`pages/${filename}`, raw, { ...pagesConfig });
  }

  // KNOWN LIMITATION (`--serve`/`--watch` mode only): `addTemplate`'s content
  // is read once, above, at config-evaluation time. The watch targets below
  // do make Eleventy notice a `content/pages/*.md` edit and run a rebuild,
  // but that rebuild re-renders the SAME string captured above, not the
  // edited file — so the edit is NOT reflected in the output. (Confirmed:
  // `UserConfig.addTemplate` throws "Virtual template conflict" if this
  // function is re-invoked from a rebuild hook such as
  // `eleventy.beforeWatch` to re-read the files, since it refuses to
  // register the same virtual path twice — there is no public API to
  // update an already-registered virtual template's content in Eleventy
  // 3.1.8.) A real fix needs a different content model for these pages
  // (e.g. global data read fresh per build and paginated, rather than
  // baked virtual templates) — out of scope for a config tweak. Until then,
  // editing a file under content/pages/ requires restarting `npm run dev`
  // to see the change; content/*.json changes do NOT have this problem
  // (see the `addWatchTarget("content/*.json")` call below — those are read
  // fresh by src/_data/*.js on every build).
  eleventyConfig.addWatchTarget(`${PAGES_DIR}/**/*.md`);
  eleventyConfig.addWatchTarget(configPath);
}

// `html: true` lets inner-page content author raw HTML (e.g. the literal
// `<br>` the Chairman's Message sign-off needs); `typographer: true` turns
// plain straight quotes/dashes typed by a content editor into their
// typographic Unicode equivalents (smart quotes, em/en dashes) so markdown
// source can stay plain ASCII.
const markdownIt = new MarkdownIt({ html: true, typographer: true });

// markdown-it decodes named HTML entities (and its own typographer output)
// to literal Unicode characters, per the CommonMark spec. The hand-built
// baseline site instead uses the literal named-entity text everywhere
// (`&rsquo;`, `&mdash;`, etc.) — re-encode the common typographic
// characters back to that form so migrated content stays byte-identical to
// the baseline. Extend this map if a later inner page needs an entity not
// yet covered here.
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

// Minimal HTML-escaping shared by the `hl`/`words` filters below. They must
// do their own escaping (rather than relying on Nunjucks autoescape) because
// every call site applies `| safe` to the filter's return value, trusting it
// already escaped any plain text it emits.
const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const HTML_ESCAPE_RE = /[&<>"']/g;
function escapeHtml(str) {
  return String(str).replace(HTML_ESCAPE_RE, (ch) => HTML_ESCAPES[ch]);
}

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/admin");
  // src/assets contains plain-prose *.md documentation files (asset
  // provenance notes, not content pages) that would otherwise be picked up
  // and rendered as Nunjucks/Markdown templates since they live under the
  // Eleventy input directory. Keep them as passthrough-copied static files.
  eleventyConfig.ignores.add("src/assets/**/*.md");

  // Block-level markdown -> HTML, for a `richtext` content block's `body`.
  eleventyConfig.addFilter("markdown", (str) => {
    if (str === null || str === undefined) return "";
    return reencodeTypographicEntities(markdownIt.render(String(str)));
  });

  // Inline-only markdown -> HTML (no wrapping <p>), for short strings such
  // as a page's `title`/`crumbLabel`/`lead` that need the same smart-quote
  // and ampersand handling as richtext but must never gain a block wrapper.
  eleventyConfig.addFilter("markdownInline", (str) => {
    if (str === null || str === undefined) return "";
    return reencodeTypographicEntities(markdownIt.renderInline(String(str)));
  });

  // Highlights a sub-phrase within a sentence, for prose like the homepage
  // promise headings ("...so your child can ==discover== who they want to
  // ==become==."). `input` is a plain string an editor can type with no
  // HTML knowledge: text is split on `==...==` pairs, every literal segment
  // is HTML-escaped, and each marked phrase becomes a
  // `<span class="hl" data-hl>` (matching the baseline markup exactly). The
  // optional `dataK` is applied, uniformly, as a `data-k` attribute on every
  // `<span>` this call produces — the baseline repeats the same `data-k` on
  // each highlighted word within one heading (e.g. both "discover" and
  // "become" carry `data-k="promise1-highlight1"`). Caller applies `| safe`,
  // since this filter has already escaped everything it returns.
  eleventyConfig.addFilter("hl", (input, dataK) => {
    if (input === null || input === undefined) return "";
    const dataKAttr = dataK ? ` data-k="${escapeHtml(dataK)}"` : "";
    // Splitting on a regex with one capture group yields
    // [plain, marked, plain, marked, ..., plain] — even indices are literal
    // text, odd indices are the `==...==` phrases themselves (markers already
    // stripped by the capture group).
    return String(input)
      .split(/==(.+?)==/g)
      .map((part, i) => (i % 2 === 1 ? `<span class="hl"${dataKAttr} data-hl>${escapeHtml(part)}</span>` : escapeHtml(part)))
      .join("");
  });

  // Wraps every space-separated word of `input` in its own
  // `<span class="word">`, for headings the baseline reveals word-by-word
  // (e.g. the hero's `<span class="word">IGNITING</span> <span
  // class="word">YOUNG</span> <span class="word">MINDS</span>`). Unlike
  // `hl`, there is no partial selection: every word is wrapped, none is
  // "plain". The optional `firstWordDataK` attaches a `data-k` to the FIRST
  // word's span only, matching the one baseline heading (the hero title)
  // that tags just its first `.word` span this way. Caller applies `| safe`.
  eleventyConfig.addFilter("words", (input, firstWordDataK) => {
    if (input === null || input === undefined) return "";
    return String(input)
      .split(" ")
      .filter((word) => word.length > 0)
      .map((word, i) => {
        const attr = i === 0 && firstWordDataK ? ` data-k="${escapeHtml(firstWordDataK)}"` : "";
        return `<span class="word"${attr}>${escapeHtml(word)}</span>`;
      })
      .join(" ");
  });

  // Renders a content field's `data-placeholder="<reason>"` hook exactly
  // where the baseline has one, for a field authored as `{text, placeholder}`
  // rather than a plain string. Used as `{{ field | placeholderAttr | safe }}`
  // immediately after the tag name; a plain string (no `.placeholder`) is a
  // no-op, so this is safe to apply uniformly across every field.
  eleventyConfig.addFilter("placeholderAttr", (field) => (field && field.placeholder ? ` data-placeholder="${field.placeholder}"` : ""));

  registerContentPages(eleventyConfig);

  return {
    dir: { input: "src", includes: "_includes", layouts: "_layouts", data: "_data", output: "_site" },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
