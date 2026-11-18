// Runs feature modules in order, isolating failures. A module is { name, section, init }.
// section = data-section value, or null for page-wide (flag goes on <body data-ready-<name>).
// init() may be sync or return a promise; a throw/rejection is logged and the module is skipped.
export async function runModules(list, doc = document) {
  for (const m of list) {
    try {
      let target = null;
      if (m.section) {
        target = doc.querySelector(`[data-section="${m.section}"]`);
        if (!target) { console.warn(`[${m.name}] section "${m.section}" not found`); continue; }
      }
      await m.init();
      if (target) target.setAttribute('data-ready', 'true');
      else doc.body.setAttribute(`data-ready-${m.name}`, 'true');
    } catch (err) {
      console.error(`[${m.name}] init failed`, err);
    }
  }
}
