// Rebind the reviewed historical harness, retaining its exact-guard and
// all-table no-business-write assertions. Never execute the retired harness.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out = 'reports/postrelease-review-20260926/tarea-3';
let text = fs.readFileSync('reports/noche-20260926/tarea-1/runtime.mjs', 'utf8');
const replace = (before, after) => {
  assert(text.includes(before), `Historical harness changed: ${before}`);
  text = text.replace(before, after);
};
replace("const out = 'reports/noche-20260926/tarea-1';", `const out = '${out}';`);
replace("const ready = load('reports/noche-20260926/tarea-2/private-ready.json');",
  "const ready = { database: 'postreview_permissions_20260926', apiUrl: 'http://127.0.0.1:18337', pid: load('/tmp/postrelease-review-20260926/postreview_permissions_20260926/pids.json').api };");
text = text.replaceAll("'noche_20260926'", "'postreview_permissions_20260926'")
  .replaceAll("'http://127.0.0.1:18227'", "'http://127.0.0.1:18337'")
  .replaceAll('/tmp/noche-20260926/', '/tmp/postrelease-review-20260926/postreview_permissions_20260926/')
  .replaceAll("'N26", "'PR26").replaceAll("'n26perm_", "'pr26perm_")
  .replaceAll('`N26', '`PR26');
// Native catalog API reads replace historical SQL fixture lookup. SQL remains
// strictly read-only for identity, exact snapshots, and existing-row metadata.
replace("save('auth-me', auth);", "save('auth-me', auth);");
replace("load(`${out}/inventory.json`).rows.filter(r=>r.plan",
  "load('reports/noche-20260926/tarea-1/inventory.json').rows.filter(r=>r.plan");
replace("const db = new pg.Client({ connectionString: url });",
  "const db = new pg.Client({ connectionString: url, options: '-c default_transaction_read_only=on' });");
// Salt each fixture label and UUID through native endpoints; never import old IDs.
assert(!text.includes('18227'));
assert(!text.includes("out = 'reports/noche"));
fs.writeFileSync(`${out}/runtime.mjs`, text);
console.log('Prepared fresh disposable-only runner; not executed.');