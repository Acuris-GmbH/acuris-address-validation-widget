// Bundle budget: widget JS (everything in src/ except the shared acuris-core.js and
// uk-extras.js) <= 15 KB and CSS <= 4 KB, unminified. Run: `node scripts/size.mjs`.
import { readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const JS_MAX = 15 * 1024, CSS_MAX = 4 * 1024;
let js = 0, css = 0, core = 0;
for (const f of readdirSync(SRC)) {
  const n = statSync(join(SRC, f)).size;
  if (f === 'acuris-core.js' || f === 'uk-extras.js') core += n;
  else if (f.endsWith('.js')) js += n;
  else if (f.endsWith('.css')) css += n;
  console.log(String(n).padStart(7) + '  src/' + f);
}
console.log('widget JS ' + js + ' B (budget ' + JS_MAX + '), shared core ' + core + ' B, total JS ' + (js + core) + ' B, CSS ' + css + ' B (budget ' + CSS_MAX + ')');
if (js > JS_MAX || css > CSS_MAX) { console.error('over budget'); process.exit(1); }
