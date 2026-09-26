#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."
# No database, HTTP, process start, source generation or writes. Output can be
# redirected by the owner to an evidence file after coordinating other workers.
node --input-type=module <<'JS'
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
const root = "reports/priority-20260926/clientlist-overlay";
const map = JSON.parse(fs.readFileSync("artifacts/api-server/dist-auditoria-colaborativa-final-20260925/index.mjs.map"));
const index = map.sources.findIndex(path => path.endsWith("/src/lib/clientes-listado.ts"));
assert.ok(index >= 0);
const overlay = fs.readFileSync(`${root}/clientes-listado.ts`, "utf8");
const actual = fs.readFileSync("artifacts/api-server/src/lib/clientes-listado.ts", "utf8");
assert.equal(actual.trimEnd(), overlay.trimEnd());
const hash = text => crypto.createHash("sha256").update(text).digest("hex");
console.log(JSON.stringify({
  source: map.sources[index],
  frozenSourceSha256: hash(map.sourcesContent[index]),
  replacementSourceSha256: hash(overlay),
  actualSourceSha256: hash(actual),
  integration: "Replace only src/lib/clientes-listado.ts in frozen build staging; no e11 files touched",
  databaseWrites: false,
}, null, 2));
JS
node --test reports/priority-20260926/clientlist-overlay/clientes-listado.test.mjs
CLIENTLIST_OFFLINE_BENCHMARK=1 node --test --test-name-pattern='offline projection benchmark' \
  reports/priority-20260926/clientlist-overlay/clientes-listado.test.mjs