export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/assets");
  // src/assets contains plain-prose *.md documentation files (asset
  // provenance notes, not content pages) that would otherwise be picked up
  // and rendered as Nunjucks/Markdown templates since they live under the
  // Eleventy input directory. Keep them as passthrough-copied static files.
  eleventyConfig.ignores.add("src/assets/**/*.md");
  return {
    dir: { input: "src", includes: "_includes", layouts: "_layouts", data: "_data", output: "_site" },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
