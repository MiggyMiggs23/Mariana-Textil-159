#!/usr/bin/env node
// Explicit offline-only verification of the ten E1 frontend/schema tests.
// Production files remain read-only; copied tests mutate copied source in memory.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(globalThis[Symbol.for("e1.offline.guard.installed")], true, "Offline guard must be preloaded");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const stage = await mkdtemp("/tmp/e1-frontend-schema-mutants-");
const reporter = "scripts/src/e1-evidence-mutant-reporter.mjs";
const inputs = [
  "artifacts/mariana-textil/src/lib/credit-evidence.ts",
  "artifacts/mariana-textil/src/lib/credit-evidence.contract.test.ts",
  "lib/api-spec/e1-contract.test.ts",
  "lib/api-spec/openapi.yaml",
  "lib/api-zod/src/generated/api.ts",
  "lib/api-zod/package.json",
  "reports/e1-ensayo-2026-09-17/operativo-propuesto/01.sql",
  reporter,
];
const sha = value => createHash("sha256").update(value).digest("hex");
const hashes = {};
for (const path of inputs) {
  hashes[path] = sha(await readFile(join(root, path)));
  await mkdir(dirname(join(stage, path)), { recursive: true });
  await copyFile(join(root, path), join(stage, path));
}
await writeFile(join(stage, "package.json"), JSON.stringify({ type: "module" }));
await writeFile(join(stage, "tsconfig.json"), JSON.stringify({ compilerOptions: {
  target: "ES2022", module: "ESNext", moduleResolution: "Bundler", esModuleInterop: true,
} }));
await symlink(join(root, "node_modules"), join(stage, "node_modules"), "dir");
await symlink(join(root, "lib/api-zod/node_modules"), join(stage, "lib/api-zod/node_modules"), "dir");
const requireScripts = createRequire(join(root, "scripts/package.json"));
const loader = requireScripts.resolve("tsx");
const guard = join(root, "scripts/src/offline-test-guard.cjs");
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const frontendCases = [
  ["E1 retry keeps UUID until an accepted response", ["retry-key", "accepted-key"]],
  ["E1 producer and changed logical draft cannot share an operation key", ["producer-key", "draft-content"]],
  ["E1 all three activation gates stay closed", ["cash-gate", "pending-gate", "attribution-gate"]],
  ["E1 site and nature are explicit, without inherited defaults", ["nature-required", "site-required"]],
  ["E1 correction requires its own justification, never a cash session", ["correction-evidence", "no-session"]],
  ["E1 directed approval copies only original metadata and UUID, not credentials", ["whitelist"]],
  ["E1 attribution preparation preserves exact timestamp, full identity and predecessor", ["exact-time", "snapshot", "predecessor"]],
];
const schemaCases = [
  ["E1 generated payment schema rejects omitted origin/key and malformed UUID", ["required-site", "integer-site", "required-key", "uuid-format"]],
  ["E1 generated POS contract has exactly the four SQL nature values", ["fourth-nature"]],
  ["E1 generated attribution schema retains exact microseconds and full snapshot", ["attribution-date", "snapshot-origin"]],
];
const suites = [
  { name: "frontend", file: inputs[1], env: "E1_FRONTEND_MUTANT", cases: frontendCases },
  { name: "schema", file: inputs[2], env: "E1_SCHEMA_MUTANT", cases: schemaCases },
];
const report = {
  stage, guard, loader, originalHashes: hashes, runs: [], testcaseCoverage: [],
  originalUnchanged: false, totals: {}, status: "RUNNING",
};
const reportPath = join(stage, "result.json");
const flatten = error => error ? [error, ...flatten(error.cause), ...(error.errors ?? []).flatMap(flatten)] : [];
async function originalsUnchanged() {
  for (const path of inputs) assert.equal(sha(await readFile(join(root, path))), hashes[path], `Workspace source changed: ${path}`);
  return true;
}
async function run(suite, phase, testName, mutant) {
  const name = `${suite.name}-${phase}${mutant ? `-${mutant}` : ""}`;
  const output = join(stage, `${name}.jsonl`);
  const stderr = join(stage, `${name}.stderr.txt`);
  const args = ["--require", guard, "--import", loader, "--test",
    `--test-reporter=${join(stage, reporter)}`,
    ...(testName ? [`--test-name-pattern=^${escape(testName)}$`] : []), join(stage, suite.file)];
  const env = { ...process.env, TSX_TSCONFIG_PATH: join(stage, "tsconfig.json"), TSX_DISABLE_CACHE: "1" };
  delete env.E1_FRONTEND_MUTANT;
  delete env.E1_SCHEMA_MUTANT;
  if (mutant) env[suite.env] = mutant;
  const result = spawnSync(process.execPath, args, {
    cwd: stage, env, encoding: "utf8", timeout: 120_000, maxBuffer: 8 * 1024 * 1024,
  });
  await writeFile(output, result.stdout ?? "");
  await writeFile(stderr, result.stderr ?? "");
  let events = [];
  let parseError = null;
  try { events = (result.stdout ?? "").split("\n").filter(Boolean).map(line => JSON.parse(line)); }
  catch (error) { parseError = String(error); }
  const results = events.filter(event => ["test:pass", "test:fail"].includes(event.type) && !event.skip);
  const failures = results.filter(event => event.type === "test:fail");
  const errors = failures.flatMap(event => flatten(event.details?.error));
  const infrastructureFailure = Boolean(result.error || result.signal || parseError) ||
    /ERR_MODULE_NOT_FOUND|ERR_UNKNOWN_FILE_EXTENSION|ERR_PACKAGE_PATH_NOT_EXPORTED|E1_OFFLINE_NETWORK_DISABLED|SyntaxError|TransformError|Unknown or stale/.test(
      `${result.stderr}\n${errors.map(error => `${error.code}: ${error.message}`).join("\n")}`);
  const assertionErrors = errors.filter(error => error.code === "ERR_ASSERTION" || error.code === "ERR_ASSERTION_ERROR" || error.name === "AssertionError");
  const expectedNames = suite.cases.map(([name]) => name);
  const meaningful = phase === "mutant"
    ? result.status !== 0 && failures.some(event => event.name === testName) &&
      assertionErrors.length > 0 && !infrastructureFailure &&
      !failures.some(event => event.name !== testName)
    : result.status === 0 && failures.length === 0 && !infrastructureFailure &&
      expectedNames.every(name => results.some(event => event.type === "test:pass" && event.name === name));
  const run = {
    suite: suite.name, phase, testName: testName ?? null, mutant: mutant ?? null,
    command: [process.execPath, ...args], exitCode: result.status, signal: result.signal,
    output, stderr, outputSha256: sha(result.stdout ?? ""), stderrSha256: sha(result.stderr ?? ""),
    events, assertionErrors, infrastructureFailure, parseError, meaningful,
    originalUnchanged: await originalsUnchanged(),
  };
  report.runs.push(run);
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ suite: suite.name, phase, mutant, meaningful, exitCode: result.status, output }));
  assert.equal(meaningful, true, `${name}: expected ${phase === "mutant" ? "meaningful AssertionError" : "green suite"}; inspect ${output}`);
  return run;
}
try {
  for (const suite of suites) {
    await run(suite, "before");
    for (const [testName, mutants] of suite.cases) {
      const observed = [];
      for (const mutant of mutants) {
        const result = await run(suite, "mutant", testName, mutant);
        observed.push({ mutant, output: result.output, outputSha256: result.outputSha256, observedAssertionFailure: result.meaningful });
      }
      report.testcaseCoverage.push({ suite: suite.name, testName, observed });
    }
    await run(suite, "after");
  }
  report.originalUnchanged = await originalsUnchanged();
  report.totals = {
    cases: report.testcaseCoverage.length,
    unobservedCases: suites.flatMap(suite => suite.cases).length - report.testcaseCoverage.length,
    mutantRuns: report.runs.filter(run => run.phase === "mutant").length,
    meaningfulFailures: report.runs.filter(run => run.phase === "mutant" && run.meaningful).length,
    greenSuiteRuns: report.runs.filter(run => run.phase !== "mutant" && run.meaningful).length,
  };
  report.status = "PASS";
} catch (error) {
  report.status = "FAIL";
  report.error = String(error);
  process.exitCode = 1;
} finally {
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ reportPath, status: report.status, totals: report.totals }));
}