import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import dns from "node:dns";
import http from "node:http";
import { loadConfigFromFile, resolveConfig, transformWithEsbuild } from "vite";
const [configFile, ...tests] = process.argv.slice(2);
assert.ok(tests.length);
assert.equal(globalThis.__E4_OFFLINE_GUARD__, true);
const address = await dns.promises.lookup("localhost");
assert.equal(address.address, "127.0.0.1");
assert.equal(http.createServer().listening, false); // construct only, NEVER listen
const loaded = await loadConfigFromFile({ command: "serve", mode: "test" }, configFile);
assert.ok(loaded?.config);
const resolved = await resolveConfig({ ...loaded.config, configFile: false }, "serve", "test");
assert.ok(resolved.cacheDir.startsWith(process.env.E4_SANDBOX + path.sep));
assert.equal(fs.lstatSync(path.resolve("node_modules")).isSymbolicLink(), false);
for (const test of tests) {
  const result = await transformWithEsbuild(fs.readFileSync(test, "utf8"), path.resolve(test), { loader: "tsx", jsx: "automatic" });
  assert.ok(result.code.length);
  console.log(`TRANSFORM_ONLY ${test}`);
}
console.log("CONFIG_TRANSFORM_PREFLIGHT_OK: no server/listen/application/test execution");