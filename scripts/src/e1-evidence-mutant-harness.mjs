#!/usr/bin/env node
// PREPARED ONLY. Owner/main agent must authorize execution after its baseline.
// Usage:
// node --require ./scripts/src/offline-test-guard.cjs \
//   ./scripts/src/e1-evidence-mutant-harness.mjs --execute-after-baseline
//
// Workspace sources/tests are read-only. All copied sources, mutations, bundles,
// structured node:test results, and final JSON remain inside one /tmp tree.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, writeFile, mkdtemp, mkdir, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourcePath = join(root, "artifacts/api-server/src/lib/credit-evidence-read.ts");
const testPath = join(root, "artifacts/api-server/src/lib/credit-evidence-read.test.ts");
const contractPath = join(root, ".local/e1-evidence-contract.md");
const guardPath = join(root, "scripts/src/offline-test-guard.cjs");
const reporterPath = join(root, "scripts/src/e1-evidence-mutant-reporter.mjs");

// Exact source replacements are genuine production-function defects, never
// changes to the copied test or unconditional test failures. Each case is the
// numbered anchor in .local/e1-evidence-contract.md.
const mutations = [
  {
    anchor: 1,
    test: "attribution remains closed for ADMIN and SUPERVISOR; roles fail first",
    defect: "Activate the historical-attribution gate without owner activation",
    before: "export const CREDIT_HISTORICAL_ATTRIBUTION_ENABLED = false;",
    after: "export const CREDIT_HISTORICAL_ATTRIBUTION_ENABLED = true;",
    semantic: /true !== false/,
  },
  {
    anchor: 2,
    test: "unknown historical preparation requires privileged role AND existing credit access",
    defect: "Drop the existing credit-read permission requirement",
    before: '  if (!hasCreditReadAccess) fail(403, "Se requiere acceso de lectura a clientes_finanzas.");',
    after: "  // MUTANT: privileged roles bypass credit-read permission.",
    semantic: /Missing expected exception/,
  },
  {
    anchor: 3,
    test: "supervisor attribution is limited to assigned site even with global read scope",
    defect: "Permit SUPERVISOR to attribute outside its assigned site",
    before: '  if (actor.rol !== "ADMIN" && actor.ubicacionId !== sitioId) {',
    after: '  if (actor.rol !== "ADMIN" && actor.rol !== "SUPERVISOR" && actor.ubicacionId !== sitioId) {',
    semantic: /Missing expected exception/,
  },
  {
    anchor: 4,
    test: "whitelisted required evidence rejects credentials, missing predecessor and truncated identity",
    defect: "Accept unwhitelisted payload fields, including credentials/nature",
    before: "  if (Object.keys(input).some((key) => !allowed.has(key))) {",
    after: "  if (false) { // MUTANT: no unsupported-field rejection.",
    semantic: /Missing expected exception/,
  },
  {
    anchor: 5,
    test: "exact timestamp and all five snapshot fields prevent movement ID reuse",
    defect: "Accept a reused movement identity with a different microsecond timestamp",
    before: "    row.movimientoCreatedAt !== input.movimientoCreatedAt ||",
    after: "    // MUTANT: ignore the original microsecond timestamp.",
    semantic: /Missing expected exception/,
  },
  {
    anchor: 6,
    test: "read evidence never infers original site/nature and excludes unknown from ordinary scope",
    defect: "Expose unknown historical rows without explicit privileged preparation",
    before: "  if (site === null ? !scope.incluirHistoricosSinSitio :",
    after: "  if (site === null ? false :",
    semantic: /Expected values to be strictly equal:[\s\S]*Sin sitio determinado/,
  },
  {
    anchor: 7,
    test: "latest attribution is separate and cross-site latest attribution is not leaked",
    defect: "Remove effective-site membership from the evidence read filter",
    before: "    scope.sitioIds !== null && !scope.sitioIds.includes(site)) return null;",
    after: "    false) return null; // MUTANT: known-site evidence ignores scope.",
    semantic: /Expected values to be strictly equal:[\s\S]*sitioDeterminadoId/,
  },
  {
    anchor: 8,
    test: "read loader applies defensive scope to returned rows and exposes disabled activation",
    defect: "Use unrestricted presentation instead of the caller's authorized scope",
    before: "movimientos: rows.map((row) => presentCreditEvidence(row, scope)).filter((row) => row !== null),",
    after: "movimientos: rows.map((row) => presentCreditEvidence(row, { sitioIds: null, incluirHistoricosSinSitio: true })).filter((row) => row !== null),",
    semantic: /Expected values to be strictly deep-equal:[\s\S]*movimientos/,
  },
  {
    anchor: 9,
    test: "identical UUID replay precedes original/site/chain checks and has no INSERT",
    defect: "Continue into mutable business-state queries after an identical replay",
    before: "    return { replay: true, atribucion: saved };",
    after: "    // MUTANT: revalidate committed state instead of returning replay.",
    semantic: /Unexpected query: SELECT pg_advisory_xact_lock/,
  },
  {
    anchor: 10,
    test: "UUID replay conflicts on changed content or actor, without business writes",
    defect: "Replay a UUID even when its immutable request content/actor changed",
    before: "    if (!sameAttributionContent(saved, input, actor.id)) {",
    after: "    if (false) { // MUTANT: discard replay content comparison.",
    semantic: /Missing expected rejection/,
  },
  {
    anchor: 11,
    test: "new attribution validates snapshot before insertion and rejects nonhistorical original",
    defect: "Skip full original identity validation before new attribution",
    before: "  assertMovementIdentity(original, input, clienteId);",
    after: "  // MUTANT: original ID alone authorizes continuation.",
    semantic: /Unexpected query: SELECT id FROM ubicaciones/,
  },
  {
    anchor: 12,
    test: "root append inserts only attribution with exact identity and no monetary/session row",
    defect: "Round the persisted movement identity timestamp to milliseconds",
    before: "[input.id, input.movimientoId, input.movimientoCreatedAt, JSON.stringify(input.identidadSnapshot),",
    after: "[input.id, input.movimientoId, input.movimientoCreatedAt.replace(/(\\.\\d{3})\\d+/, '$1'), JSON.stringify(input.identidadSnapshot),",
    semantic: /Expected values to be strictly deep-equal:[\s\S]*123456/,
  },
  {
    anchor: 13,
    test: "rectification requires current head, keeps predecessor intact and replays old root",
    defect: "Allow appending to a stale predecessor instead of the current chain head",
    before: "      heads.length !== 1 || heads[0].id !== input.anteriorId)) {",
    after: "      heads.length !== 1)) { // MUTANT: accept any predecessor.",
    semantic: /Unexpected query: INSERT INTO atribuciones_credito_e1/,
  },
  {
    anchor: 14,
    test: "missing/invalid site and cross-site actor cannot cause an attribution insert",
    defect: "Continue after the requested active TIENDA site was not found",
    before: '  if (!site) fail(400, "Se requiere un sitio TIENDA activo.");',
    after: "  // MUTANT: missing/inactive sites do not stop attribution.",
    semantic: /Unexpected query: SELECT[\s\S]*FROM atribuciones_credito_e1/,
  },
];

const hash = (text) => createHash("sha256").update(text).digest("hex");
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const errorMessage = (error) => error instanceof Error ? error.message : String(error);
let reportPath;
let report;

function replaceExactlyOnce(source, mutation) {
  const first = source.indexOf(mutation.before);
  if (first < 0 || source.indexOf(mutation.before, first + mutation.before.length) >= 0) {
    throw new Error(`Source anchor ${mutation.anchor} is absent or ambiguous; no mutation was executed.`);
  }
  const changed = source.slice(0, first) + mutation.after + source.slice(first + mutation.before.length);
  assert.notEqual(hash(changed), hash(source), `Anchor ${mutation.anchor} must change actual source.`);
  return changed;
}

function flattenErrors(error) {
  if (!error) return [];
  return [error, ...flattenErrors(error.cause), ...(error.errors ?? []).flatMap(flattenErrors)];
}

function inspectRun(run, mutation, expectedPhase) {
  const events = run.events;
  const results = events.filter((event) =>
    ["test:pass", "test:fail"].includes(event.type) && !event.skip);
  const selected = results.filter((event) => event.name === mutation.test);
  const failures = results.filter((event) => event.type === "test:fail");
  const errors = failures.flatMap((event) => flattenErrors(event.details?.error));
  const messages = errors.map((error) => error.message).join("\n");
  const infrastructureFailure = Boolean(run.spawnError || run.signal || run.parseError) ||
    /ERR_MODULE_NOT_FOUND|ERR_UNKNOWN_FILE_EXTENSION|ERR_PACKAGE_PATH_NOT_EXPORTED|E1_OFFLINE_NETWORK_DISABLED|SyntaxError|TransformError/.test(
      `${run.stderr}\n${errors.map((error) => `${error.code}: ${error.message}`).join("\n")}`,
    );
  if (expectedPhase !== "mutant") {
    const verified = run.exitCode === 0 && !infrastructureFailure && results.length === 1 &&
      selected.length === 1 && selected[0].type === "test:pass" && failures.length === 0;
    return { verified, infrastructureFailure, activeTestCount: results.length, selectedCount: selected.length, failureCount: failures.length };
  }
  const assertion = errors.find((error) =>
    error.code === "ERR_ASSERTION" && /AssertionError/.test(error.name));
  const semanticMatch = mutation.semantic.test(messages);
  const verified = run.exitCode === 1 && !infrastructureFailure && results.length === 1 &&
    selected.length === 1 && selected[0].type === "test:fail" && failures.length === 1 &&
    Boolean(assertion) && semanticMatch;
  return {
    verified,
    infrastructureFailure,
    activeTestCount: results.length,
    selectedCount: selected.length,
    failureCount: failures.length,
    assertionClass: assertion?.name ?? null,
    assertionCode: assertion?.code ?? null,
    semanticMatch,
    expectedSemantic: mutation.semantic.source,
    assertionMessages: messages,
  };
}

async function main() {
  if (!globalThis[Symbol.for("e1.offline.guard.installed")]) {
    throw new Error("Offline guard must be preloaded; no staging or tests were executed.");
  }
  if (process.argv.length !== 3 || process.argv[2] !== "--execute-after-baseline") {
    throw new Error("Prepared harness only: explicit --execute-after-baseline is required after main-agent authorization.");
  }
  const [source, testSource, contract, reporterSource] = await Promise.all([
    readFile(sourcePath, "utf8"), readFile(testPath, "utf8"),
    readFile(contractPath, "utf8"), readFile(reporterPath, "utf8"),
  ]);
  const declaredTests = [...testSource.matchAll(/^test\("([^"]+)"/gm)].map((match) => match[1]);
  const declaredMutants = mutations.map((mutation) => mutation.test);
  const inventoryUncovered = declaredTests.filter((name) => !declaredMutants.includes(name));
  assert.equal(new Set(declaredTests).size, declaredTests.length, "Test names must be unique.");
  assert.equal(new Set(declaredMutants).size, declaredMutants.length, "Every test must have its own mutant.");
  assert.equal(declaredTests.length, 14, "The 14-test inventory changed; reconcile the evidence contract.");
  assert.deepEqual(inventoryUncovered, [], "Every authored test requires a behavioral mutant.");
  assert.deepEqual(declaredMutants.filter((name) => !declaredTests.includes(name)), []);
  for (const mutation of mutations) {
    assert.ok(contract.includes(`\n${mutation.anchor}. `), `Missing contract anchor ${mutation.anchor}.`);
    replaceExactlyOnce(source, mutation); // Structural preflight only.
  }
  // Locate the existing native esbuild executable exactly as the guard does.
  const require = createRequire(join(root, "artifacts/api-server/package.json"));
  const esbuildPackage = require.resolve("esbuild/package.json");
  const platform = { "linux x64": "@esbuild/linux-x64", "linux arm64": "@esbuild/linux-arm64" }[
    `${process.platform} ${process.arch}`
  ];
  if (!platform) throw new Error("Unsupported harness platform; no fallback executable is allowed.");
  const esbuild = await realpath(require.resolve(`${platform}/bin/esbuild`, {
    paths: [dirname(esbuildPackage)],
  }));
  const verifiedGuard = await realpath(guardPath);
  const tempRoot = await mkdtemp("/tmp/e1-evidence-mutants-");
  reportPath = join(tempRoot, "report.json");
  report = {
    status: "RUNNING",
    workspaceUntouched: null,
    offlineGuard: verifiedGuard,
    tempRoot,
    sourceHash: hash(source),
    testHash: hash(testSource),
    inventory: { authored: declaredTests.length, planned: mutations.length, uncovered: inventoryUncovered },
    cases: [],
    proven: 0,
    uncovered: [...declaredTests],
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  const env = { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", NODE_ENV: "test" };
  const isolatedReporter = join(tempRoot, "reporter.mjs");
  await writeFile(isolatedReporter, reporterSource);

  async function runPhase(dir, mutation, phase) {
    const bundle = join(dir, `${phase}.test.mjs`);
    const metaPath = join(dir, `${phase}.meta.json`);
    const compiler = spawnSync(esbuild, [
      join(dir, "credit-evidence-read.test.ts"), "--bundle", "--platform=node",
      "--format=esm", "--sourcemap", "--log-level=error",
      `--outfile=${bundle}`, `--metafile=${metaPath}`,
    ], { cwd: dir, env, encoding: "utf8", timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
    await writeFile(join(dir, `${phase}.compile.json`), JSON.stringify({
      exitCode: compiler.status, signal: compiler.signal,
      error: compiler.error ? errorMessage(compiler.error) : null,
      stdout: compiler.stdout, stderr: compiler.stderr,
    }, null, 2));
    if (compiler.status !== 0 || compiler.error || compiler.signal) {
      throw new Error(`${phase}: source compilation failed (infrastructure error, not a killed mutant).`);
    }
    // Prove the tests import the actual production-function COPY, with no
    // workspace/app/database implementation leaking into a bundled graph.
    const metadata = JSON.parse(await readFile(metaPath, "utf8"));
    assert.deepEqual(Object.keys(metadata.inputs).map((file) => resolve(dir, file)).sort(), [
      join(dir, "credit-evidence-read.test.ts"), join(dir, "credit-evidence-read.ts"),
    ].sort(), `${phase}: unexpected bundle dependency or missing copied real implementation.`);
    const childArgs = [
      "--require", verifiedGuard, "--enable-source-maps", "--test",
      "--test-concurrency=1", `--test-name-pattern=^${escapeRegex(mutation.test)}$`,
      "--test-reporter", isolatedReporter, bundle,
    ];
    const child = spawnSync(process.execPath, childArgs, {
      cwd: dir, env, encoding: "utf8", timeout: 30000, maxBuffer: 4 * 1024 * 1024,
    });
    const stdout = child.stdout ?? "";
    const stderr = child.stderr ?? "";
    await writeFile(join(dir, `${phase}.stdout.jsonl`), stdout);
    await writeFile(join(dir, `${phase}.stderr.txt`), stderr);
    let events = [];
    let parseError = null;
    try {
      events = stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    } catch (error) {
      parseError = errorMessage(error);
    }
    const result = {
      command: [process.execPath, ...childArgs],
      exitCode: child.status,
      signal: child.signal,
      spawnError: child.error ? errorMessage(child.error) : null,
      parseError, stdout, stderr, events,
    };
    return { ...result, validation: inspectRun(result, mutation, phase) };
  }

  for (const mutation of mutations) {
    const dir = join(tempRoot, String(mutation.anchor).padStart(2, "0"));
    await mkdir(dir);
    const stagedSource = join(dir, "credit-evidence-read.ts");
    const stagedTest = join(dir, "credit-evidence-read.test.ts");
    await writeFile(stagedSource, source);
    await writeFile(stagedTest, testSource);
    const caseResult = {
      contractAnchor: mutation.anchor,
      testcase: mutation.test,
      defect: mutation.defect,
      sourceCopy: stagedSource,
      testCopy: stagedTest,
      result: "UNPROVEN",
    };
    report.cases.push(caseResult);
    try {
      caseResult.baseline = await runPhase(dir, mutation, "baseline");
      if (!caseResult.baseline.validation.verified) {
        throw new Error("Isolated unmodified testcase did not pass; mutant not credited.");
      }
      const mutated = replaceExactlyOnce(source, mutation);
      await writeFile(join(dir, "mutant-source.snapshot.ts"), mutated);
      await writeFile(stagedSource, mutated);
      try {
        caseResult.mutant = await runPhase(dir, mutation, "mutant");
      } finally {
        // Restore the SAME staged implementation imported by the SAME unchanged
        // test. A separate green workspace run is not a restoration proof.
        await writeFile(stagedSource, source);
      }
      caseResult.restored = await runPhase(dir, mutation, "restored");
      const stagedTestUnchanged = hash(await readFile(stagedTest, "utf8")) === hash(testSource);
      const stagedSourceRestored = hash(await readFile(stagedSource, "utf8")) === hash(source);
      caseResult.stagedTestUnchanged = stagedTestUnchanged;
      caseResult.stagedSourceRestored = stagedSourceRestored;
      if (caseResult.mutant.validation.verified && caseResult.restored.validation.verified &&
        stagedTestUnchanged && stagedSourceRestored) {
        caseResult.result = "KILLED_ASSERTION_AND_RESTORED";
      } else {
        caseResult.error = "Expected semantic AssertionError and restored green were not both established.";
      }
    } catch (error) {
      caseResult.error = errorMessage(error);
    } finally {
      await writeFile(stagedSource, source);
    }
    report.proven = report.cases.filter((item) => item.result === "KILLED_ASSERTION_AND_RESTORED").length;
    report.uncovered = declaredTests.filter((name) => !report.cases.some((item) =>
      item.testcase === name && item.result === "KILLED_ASSERTION_AND_RESTORED"));
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  report.workspaceUntouched = hash(await readFile(sourcePath, "utf8")) === report.sourceHash &&
    hash(await readFile(testPath, "utf8")) === report.testHash;
  report.status = report.uncovered.length === 0 && report.workspaceUntouched ? "PASS" : "FAIL";
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    reportPath, status: report.status, proven: report.proven,
    uncovered: report.uncovered, workspaceUntouched: report.workspaceUntouched,
  }));
  process.exitCode = report.status === "PASS" ? 0 : 1;
}

main().catch(async (error) => {
  if (report && reportPath) {
    report.status = "INFRASTRUCTURE_ERROR";
    report.error = errorMessage(error);
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.error(JSON.stringify({ status: "INFRASTRUCTURE_ERROR", reportPath, error: errorMessage(error) }));
  process.exitCode = 2;
});