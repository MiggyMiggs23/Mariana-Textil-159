import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// Report-only supplemental verification: production/test files are never written.
const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "../../..");
const app = join(root, "artifacts/mariana-textil");
const pageDir = join(app, "src/pages/caja");
const testFile = join(pageDir, "cuentas-destino-labels.observable.test.ts");
const guard = join(root, "scripts/src/offline-test-guard.cjs");
const require = createRequire(join(root, "scripts/package.json"));
const tsx = require.resolve("tsx");
const outputDir = join(directory, "process-red");
mkdirSync(outputDir, { recursive: true });
const frozen = {
  "cuentas-destino.tsx": "a35e90a2f30ec85bc80c608549b6912a1611f1e5a2b84bf2407516b4c6995c24",
  "tiempo-real.tsx": "095c87997021ee4c566c843f6209a3bd950a093ad70cdb96e624c2f1c6c5144d",
  "cuentas-destino-labels.observable.test.ts": "d02db74dd0057d84bad03d93ce7c31490bbf928cde3e21395de198f08e9422b8",
};
function verifyFrozen() {
  for (const [name, digest] of Object.entries(frozen)) {
    assert.equal(createHash("sha256").update(readFileSync(join(pageDir, name))).digest("hex"), digest, name);
  }
}
verifyFrozen();
const cases = [
  ["destino-label", "cuentas-destino.tsx", "Contado cobrado", "Cobros directos", true, "E6 mounted labels", "both the sales card and collection component"],
  ["destino-title", "cuentas-destino.tsx", "Cobranza del periodo", "Cobrado", true, "E6 mounted labels", "missing exact Cobranza del periodo label"],
  ["destino-component-cent", "cuentas-destino.tsx", "amount: header.cobrado.abonos", 'amount: "25.18"', false, "E6 mounted labels", "$25.18"],
  ["destino-total-cent", "cuentas-destino.tsx", "amount: header.cobrado.total", 'amount: "875.10"', false, "E6 mounted labels", "$875.10"],
  ["realtime-title", "tiempo-real.tsx", 'title: "Cobranza del periodo"', 'title: "Cobrado en el periodo"', false, "E6 Tiempo real mounted", "missing collection title"],
  ["realtime-label", "tiempo-real.tsx", 'label: "Contado cobrado"', 'label: "Cobros directos"', false, "E6 Tiempo real mounted", "both the dashboard card and collection component"],
  ["realtime-aria", "tiempo-real.tsx", 'aria-label="Cobranza del periodo"', 'aria-label="Cobrado en el periodo"', false, "E6 Tiempo real mounted", "missing accessible collection label"],
  ["realtime-component-cent", "tiempo-real.tsx", "amount: header.cobrado.abonos", 'amount: "25.18"', false, "E6 Tiempo real mounted", "$25.18"],
  ["realtime-total-cent", "tiempo-real.tsx", "amount: header.cobrado.total", 'amount: "875.10"', false, "E6 Tiempo real mounted", "$875.10"],
];
function run(preload, pattern, logName) {
  const result = spawnSync(process.execPath, [
    "--require", guard,
    ...(preload ? ["--require", preload] : []),
    "--import", tsx,
    "--test", "--test-isolation=none",
    ...(pattern ? [`--test-name-pattern=${pattern}`] : []),
    testFile,
  ], {
    cwd: app,
    // Same offline child environment used by the canonical frontend test runner.
    // No persistent environment/configuration changes; no credentials forwarded.
    env: {
      PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "",
      NODE_ENV: "test", E1_OFFLINE_STATIC_FIXTURE: "1",
      TSX_TSCONFIG_PATH: join(app, "tsconfig.render-tests.json"),
    },
    encoding: "utf8", maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  const text = `${result.stdout}\n${result.stderr}`;
  writeFileSync(join(outputDir, logName), `process exit=${result.status}\n${text}`);
  return { exit: result.status, text };
}
const summary = [];
for (const [name, filename, from, to, all, pattern, intended] of cases) {
  const path = join(pageDir, filename);
  const original = readFileSync(path, "utf8");
  assert.ok(original.includes(from), `missing mutation target ${name}`);
  const preload = join(outputDir, `${name}.cjs`);
  // Intercept only the test's explicit UTF-8 read of its real component source.
  // Baseline snapshot reads and the committed test's assertions remain intact.
  writeFileSync(preload, `
"use strict";
const fs = require("node:fs");
const { fileURLToPath } = require("node:url");
const { syncBuiltinESMExports } = require("node:module");
const original = fs.readFileSync;
fs.readFileSync = function(path, options) {
  const result = original.apply(this, arguments);
  const actual = path instanceof URL ? fileURLToPath(path) : String(path);
  if (actual === ${JSON.stringify(path)} && options === "utf8") {
    if (typeof result !== "string" || !result.includes(${JSON.stringify(from)}))
      throw new Error("Mutation target unavailable: ${name}");
    console.error("SOURCE-IN-MEMORY MUTATION ${name}");
    return result.${all ? "replaceAll" : "replace"}(${JSON.stringify(from)}, ${JSON.stringify(to)});
  }
  return result;
};
syncBuiltinESMExports();
`);
  const result = run(preload, pattern, `${name}.red.log`);
  assert.equal(result.exit, 1, `${name}: test process must exit 1`);
  assert.ok(result.text.includes("AssertionError"), `${name}: must fail an assertion`);
  assert.ok(result.text.includes(intended), `${name}: expected assertion evidence missing`);
  assert.ok(result.text.includes(pattern), `${name}: wrong selected test case`);
  assert.ok(!/E1_OFFLINE_NETWORK_DISABLED|SyntaxError|TypeError:|ReferenceError|Mutation target unavailable/.test(result.text),
    `${name}: infrastructure failure is not an accepted mutant`);
  verifyFrozen();
  summary.push({ mutant: name, processExit: result.exit, intendedAssertion: intended, frozenFilesIntact: true });
  console.log(`${name}: actual child RED exit=1, intended assertion confirmed`);
}
const restored = run(null, null, "restored.green.log");
assert.equal(restored.exit, 0, "normal restored process must pass");
assert.match(restored.text, /(?:pass 2|# pass 2)/);
assert.match(restored.text, /(?:fail 0|# fail 0)/);
verifyFrozen();
writeFileSync(join(outputDir, "summary.json"), JSON.stringify({
  frozen, results: summary, restored: { processExit: restored.exit, pass: 2, fail: 0 },
}, null, 2) + "\n");
console.log("RESTORED actual child GREEN exit=0, 2/2; all committed files remain hash-identical");