// Site builder. This task: stampHomepage only (page builder arrives later).
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadSite } from './lib/site-data.mjs';
import { renderHeader, renderMenu } from '../templates/partials/header.mjs';
import { renderFooter } from '../templates/partials/footer.mjs';

// Replaces the text between each <!-- build:NAME --> ... <!-- /build:NAME --> pair with the
// partial output (homepage: assetBase ''). Returns true if the file changed.
export function stampHomepage(file = 'site/index.html') {
  const site = loadSite();
  const opts = { assetBase: '' };
  const parts = {
    header: renderHeader(site, opts),
    menu: renderMenu(site, opts),
    footer: renderFooter(site, opts),
  };
  const before = fs.readFileSync(file, 'utf8');
  let after = before;
  for (const [name, markup] of Object.entries(parts)) {
    const open = `<!-- build:${name} -->`;
    const close = `<!-- /build:${name} -->`;
    const a = after.indexOf(open);
    const b = after.indexOf(close);
    if (a === -1 || b === -1 || b < a) throw new Error(`stampHomepage: markers for "${name}" not found in ${file}`);
    after = after.slice(0, a + open.length) + markup + after.slice(b);
  }
  if (after === before) return false;
  fs.writeFileSync(file, after);
  return true;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  if (process.argv.includes('--stamp')) {
    console.log(stampHomepage() ? 'site/index.html updated' : 'site/index.html already up to date');
  }
}
