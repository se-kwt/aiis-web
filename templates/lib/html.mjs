// Small HTML helpers shared by the templates. Templates are plain functions returning strings.

// Escapes & < > ". Not ': every attribute is double-quoted and the pages keep literal apostrophes.
export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ` name="escaped"`, or '' when the value is null/undefined.
export function attr(name, value) {
  return value == null ? '' : ` ${name}="${esc(value)}"`;
}

// ` lang="ar" dir="rtl"` for text containing Arabic characters, else ''.
export function arabicAttrs(s) {
  return /[\u0600-\u06FF]/.test(String(s)) ? ' lang="ar" dir="rtl"' : '';
}
