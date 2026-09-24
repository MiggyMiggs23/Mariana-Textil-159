import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const handoff = process.env.INVENTORY_HANDOFF;
assert.ok(handoff, "Private MAIN handoff path required");
const c = JSON.parse(fs.readFileSync(handoff, "utf8"));
assert.equal(c.sourceIdentity, "currentsource61d-strict");
assert.match(c.databaseName, /^tanda_ga_inventory(?:_[a-z0-9]+)*$/);
assert.ok(path.resolve(c.sourceRoot).includes("/.local/"), "Frozen isolated source required");
const require = createRequire(path.resolve(c.sourceRoot, "artifacts/api-server/package.json"));
const { build } = require("esbuild");
await build({
  entryPoints: ["reports/tanda-g-ampliada/tarea-2/matrix.ts"],
  outfile: "reports/tanda-g-ampliada/tarea-2/matrix.bundle.mjs",
  bundle: true, platform: "node", format: "esm", external: ["pg-native"],
  alias: {
    "@inventory-db": path.resolve(c.sourceRoot, "lib/db/src/index.ts"),
    "@inventory-engine": path.resolve(c.sourceRoot, "artifacts/api-server/src/lib/inventario.ts"),
  },
  banner: { js: "import {createRequire} from 'node:module';const require=createRequire(import.meta.url);" },
});
// Do NOT auto-run. MAIN supplies readiness explicitly to run.mjs.