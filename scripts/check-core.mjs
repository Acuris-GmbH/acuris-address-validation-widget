// Fails when a synced file in src/ was edited by hand or is older than its source.
// Synced files start with `/* core <sha> from <source> */`. Edit the source, then
// run the sync script in the workspace that holds all widget repos.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE = join(REPO, '..');
const STAMP = /^\/\* core ([0-9a-f]{12}) from (\S+) \*\/\n/;
const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 12);

let bad = 0, seen = 0;
for (const f of readdirSync(join(REPO, 'src'))) {
  const text = readFileSync(join(REPO, 'src', f), 'utf8');
  const m = STAMP.exec(text);
  if (!m) continue;
  seen++;
  const body = text.slice(m[0].length);
  if (sha(body) !== m[1]) { console.error('EDITED: src/' + f + ' no longer matches its stamp'); bad++; continue; }
  const upstream = join(WORKSPACE, m[2]);
  if (existsSync(upstream) && sha(readFileSync(upstream, 'utf8')) !== m[1]) {
    console.error('STALE: src/' + f + ' is older than ' + m[2]); bad++; continue;
  }
  console.log('ok   src/' + f + ' (' + m[1] + ')');
}
if (!existsSync(join(REPO, 'src', 'acuris-core.js'))) { console.error('MISSING: src/acuris-core.js'); bad++; }
if (bad) process.exit(1);
console.log(seen + ' synced file(s) verified');
