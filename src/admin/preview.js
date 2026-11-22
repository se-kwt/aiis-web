/* Live previews for the Decap editor.
 *
 * Inner pages render with the real site stylesheets (hero band, prose, feature
 * cards, point list), so editors see roughly what visitors will see.
 * Every other file (homepage, Our Story, settings, navigation) renders as a clean
 * outline of its content: the layouts are animation-driven and cannot be
 * reproduced in an iframe, so the outline shows the words and pictures in order.
 *
 * Loaded after decap-cms.js, so `CMS` and `h` (React.createElement) are globals. */
(function () {
  var md = window.markdownit ? window.markdownit({ html: true, typographer: true }) : null;

  // ---- helpers -------------------------------------------------------------

  // Stored strings carry HTML entities ("&mdash;", "&rsquo;"). Decode them to real
  // characters; a <textarea> decodes entities without ever parsing markup.
  var decoder = document.createElement("textarea");
  function decode(s) {
    decoder.innerHTML = String(s);
    return decoder.value;
  }

  function html(markup, tag, props) {
    return h(tag || "div", Object.assign({}, props, { dangerouslySetInnerHTML: { __html: markup } }));
  }

  function inlineMd(s) {
    return md ? md.renderInline(String(s || "")) : decode(s);
  }

  function blockMd(s) {
    return md ? md.render(String(s || "")) : "<p>" + decode(s) + "</p>";
  }

  // Content stores some paths without the leading slash ("assets/photos/x.jpg"); the admin
  // lives under /admin/, so make every local path root-relative.
  function assetUrl(src) {
    return /^(\/|https?:|data:)/.test(src) ? src : "/" + src;
  }

  var IMAGE_RE = /\.(png|jpe?g|gif|svg|webp|avif)$/i;
  var VIDEO_RE = /\.(mp4|webm|mov)$/i;

  // ---- inner pages ---------------------------------------------------------

  function Block(block, i) {
    var items = block.items || [];
    switch (block.type) {
      case "richtext":
        // `raw` blocks hold hand-written HTML; everything else is markdown.
        return html(block.raw ? block.body || "" : blockMd(block.body), "div", { key: i });
      case "image":
        return block.src
          ? h("figure", { className: "tp", key: i }, h("img", { src: assetUrl(block.src), alt: block.description || "" }))
          : h("figure", { className: "tp", key: i, "data-temp-photo": "" }, h("span", { className: "sr" }, block.description || ""));
      case "features":
        return h("ul", { className: "page-features", key: i }, items.map(function (item, n) {
          return h("li", { className: "page-features__item", key: n }, h("h3", null, decode(item.heading || "")), h("p", null, decode(item.text || "")));
        }));
      case "points":
        return h("ul", { className: "page-points", key: i }, items.map(function (item, n) {
          return html(inlineMd(typeof item === "string" ? item : item && item.point), "li", { className: "page-points__item", key: n });
        }));
      default:
        return null;
    }
  }

  function PagePreview(props) {
    var data = props.entry.get("data").toJS();
    var closing = data.closing || [];
    var blocks = data.blocks || [];
    var hero = data.heroImage && data.heroImage.src ? data.heroImage : null;
    var heroAt = -1;
    if (!hero) {
      blocks.forEach(function (b, i) { if (heroAt < 0 && b.type === "image" && b.src) heroAt = i; });
      if (heroAt >= 0) hero = { src: blocks[heroAt].src, alt: blocks[heroAt].description };
    }
    return h("div", { className: "page" },
      h("section", { className: "page-hero" },
        data.eyebrow ? html(inlineMd(data.eyebrow), "p", { className: "page-hero__eyebrow" }) : null,
        html(inlineMd(data.title), "h1", { className: "page-hero__title" }),
        h("div", { className: "page-hero__frame" },
          h("span", { className: "page-hero__notch", "aria-hidden": "true" }),
          hero
            ? h("figure", { className: "tp" }, h("img", { src: assetUrl(hero.src), alt: hero.alt || "" }))
            : h("figure", { className: "tp", "data-temp-photo": "" }))),
      h("section", { className: "page-section page-section--intro" },
        h("div", { className: "page__wrap page-section__grid" },
          h("div", { className: "page-section__copy page-content" },
            data.lead ? html(inlineMd(data.lead), "p", { className: "page-section__statement" }) : null,
            blocks.map(function (b, i) { return i === heroAt ? null : Block(b, i); })))),
      closing.length ? h("section", { className: "page-closing" },
        h("div", { className: "page__wrap" },
          h("ul", { className: "page-closing__list" }, closing.map(function (link, i) {
            return h("li", { key: i }, html(inlineMd(link.label || ""), "a", { className: "page-closing__link", href: "#" }));
          })))) : null);
  }

  // ---- outline preview for the structured files ----------------------------

  // Keys that are plumbing rather than content.
  function isHidden(key) {
    return key.charAt(0) === "_" || key === "placeholder" || /DataK$/.test(key);
  }

  function label(key) {
    var spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ");
    return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
  }

  function visibleKeys(obj) {
    return Object.keys(obj).filter(function (k) { return !isHidden(k); });
  }

  // Renders ==highlight== markers the way the site does.
  function text(s) {
    var parts = decode(s).split("==");
    return parts.map(function (part, i) {
      return i % 2 ? h("mark", { key: i }, part) : part;
    });
  }

  function Value(value, key) {
    if (value === null || value === undefined || value === "") return h("span", { className: "ol-empty" }, "empty");
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") return String(value);

    if (typeof value === "string") {
      if (IMAGE_RE.test(value) && /^(\/|https?:|assets\/)/.test(value)) {
        return h("img", { className: "ol-img", src: assetUrl(value), alt: "" });
      }
      if (VIDEO_RE.test(value)) return h("span", { className: "ol-chip" }, "Video file: " + value.split("/").pop());
      if (/^https?:\/\//.test(value) || /^\/[\w\-\/#?=&.]*$/.test(value)) return h("span", { className: "ol-link" }, value);
      return h("span", null, text(value));
    }

    if (Array.isArray(value)) {
      if (value.every(function (v) { return typeof v === "string"; })) {
        return h("ul", { className: "ol-lines" }, value.map(function (v, i) { return h("li", { key: i }, text(v)); }));
      }
      return h("div", { className: "ol-cards" }, value.map(function (item, i) {
        return h("div", { className: "ol-card", key: i }, Value(item, key));
      }));
    }

    // Objects: { text, placeholder } collapses to just the text; { src, alt } is a picture.
    var keys = visibleKeys(value);
    if (keys.length === 1 && keys[0] === "text") return Value(value.text, key);
    if (value.src !== undefined && keys.every(function (k) { return k === "src" || k === "alt"; })) {
      return h("figure", { className: "ol-photo" },
        value.src ? h("img", { className: "ol-img", src: assetUrl(value.src), alt: value.alt || "" }) : h("div", { className: "ol-nophoto" }, "No image yet"),
        value.alt ? h("figcaption", null, value.alt) : null);
    }
    return h("dl", { className: "ol-fields" }, keys.map(function (k) {
      return [h("dt", { key: k + "t" }, label(k)), h("dd", { key: k + "d" }, Value(value[k], k))];
    }));
  }

  function Outline(props) {
    var data = props.entry.get("data").toJS();
    return h("div", { className: "ol" }, visibleKeys(data).map(function (key) {
      return h("section", { className: "ol-section", key: key },
        h("h2", null, label(key)),
        Value(data[key], key));
    }));
  }

  // ---- registration --------------------------------------------------------

  CMS.registerPreviewStyle("https://fonts.googleapis.com/css2?family=Anton&family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&family=Geologica:wght@100..900&display=swap");
  ["tokens", "base", "page"].forEach(function (name) { CMS.registerPreviewStyle("/css/" + name + ".css"); });
  CMS.registerPreviewStyle("/admin/preview.css");

  // Decap looks up a preview by file name inside a files collection, so every inner page
  // needs its own registration. Keep this list in step with the `file: content/pages/*.md`
  // entries under the "pages" collection in config.yml.
  var INNER_PAGES = [
    "chairmans-message", "principals-message", "vision-mission", "vice-principal-message",
    "kindergarten-school", "primary-school", "middle-school", "student-leadership-program",
    "curriculum-choices", "weekly-test-curriculum", "subject-enrichment-activities",
    "best-igcse-cambridge-school-in-kuwait", "fees-schedules", "admission-process", "clubs",
    "student-article-magazine", "health-wellness", "after-school-activities", "achievements",
    "celebrations", "assembly", "aspire-indian-international-school-timings",
    "special-assemblies", "school-anthem", "classrooms", "auditorium", "open-ground",
    "swimming-pool", "gymnasium", "play-area", "badminton", "cricket", "basket-ball", "soccer",
    "das-trailblazer", "csr-reports", "mandatory-public-disclosure"
  ];
  INNER_PAGES.forEach(function (file) {
    CMS.registerPreviewTemplate(file, PagePreview);
  });
  ["homepage", "our-story", "settings", "site"].forEach(function (file) {
    CMS.registerPreviewTemplate(file, Outline);
  });
})();
