import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(path.resolve("artifacts/api-server/package.json"));
const { build } = require("esbuild");
const config = JSON.parse(fs.readFileSync(".local/tanda-h/worker-databases.json", "utf8")).inventory;
const url = new URL(config.url);
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.port, "55444");
assert.equal(url.pathname, "/tanda_h_inventory");
assert.equal(process.env.MAIN_READY, "yes");
const phase = process.argv[2];
assert.ok(["red", "green"].includes(phase));
const outfile = path.resolve(`.local/tanda-h/entradas-${phase}.mjs`);
await build({
  entryPoints: ["artifacts/api-server/src/lib/entradas-physical-quantity.integration.test.ts"],
  outfile, bundle: true, platform: "node", format: "esm", external: ["pg-native"],
  banner: { js: "import {createRequire} from 'node:module';const require=createRequire(import.meta.url);" },
});
process.env.DATABASE_URL = "postgresql://postgres@127.0.0.1:55444/tanda_h_witness";
process.env.APPLICATION_DATABASE_URL = process.env.DATABASE_URL;
process.env.TEST_DATABASE_URL = config.url;
process.env.REQUIRE_ISOLATED_TEST_DATABASE = "1";
process.env.NODE_ENV = "test";
process.env.ENTRADAS_RESULT = `reports/tanda-h/tarea-1/producer-${phase}.json`;
await import(outfile);