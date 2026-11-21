import MarkdownIt from "markdown-it";

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

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/assets");
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

  return {
    dir: { input: "src", includes: "_includes", layouts: "_layouts", data: "_data", output: "_site" },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
