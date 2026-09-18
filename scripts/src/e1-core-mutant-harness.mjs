#!/usr/bin/env node
// Offline-only. Production/test workspace files remain read-only; mutations
// happen exclusively in a temporary directory after a confirmed green baseline.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, writeFile, mkdtemp, symlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const lib = join(root, "artifacts/api-server/src/lib");
const guard = join(root, "scripts/src/offline-test-guard.cjs");
const reporter = join(root, "scripts/src/e1-evidence-mutant-reporter.mjs");
const files = ["credit-evidence-contract.ts", "credit-evidence.ts", "credit-evidence-contract.test.ts", "credit-evidence.mock.test.ts"];
const hash = value => createHash("sha256").update(value).digest("hex");
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const P = [
  "E1 required metadata rejects legacy, malformed ids, UUIDs and unknown nature",
  "E1 evidence parser whitelists and normalizes without credentials",
  "E1 four exact natures and seven-producer compatibility cannot default to correction",
  "E1 exact money normalization rejects rounding and overflow",
  "E1 canonical JSON recursively sorts keys and preserves intent order and exact instants",
  "E1 canonical JSON rejects secrets, undefined, cycles and nonfinite values",
  "E1 correction never invents cash session; physical bank transfer never accepts drawer",
  "E1 new physical cash receipt and refund remain closed, correction is not physical cash",
  "E1 current actor/site access rejects role, inactive actor and moved site even on replay",
  "E1 same content replays original result before repeated domain validation/side effects",
  "E1 equal UUID across producers is isolated, not deduplicated by nature or UUID alone",
  "E1 reused key with changed amount, actor, metadata or nature conflicts",
  "E1 ON CONFLICT loser reloads immutable winner instead of repeating writes",
  "E1 committed operation without movement fails explicitly, never stub success",
  "E1 retained receipt gate rejects before any storage call and never becomes an ABONO",
];
const M = [
  "actual claim adapter atomically inserts once and replays immutable movement without another write",
  "actual credit request adapter reports legacy update-app error before required generated-schema validation",
  "actual claim adapter conflicts on changed actor, nature or whitelisted intent",
  "actual claim adapter isolates equal UUID across producers in both claim and movement lookup",
  "actual claim adapter loses composite uniqueness race and reloads the completed winner",
  "actual claim adapter rejects missing movement and incomplete operation reservation",
  "actual access/scope adapters check current site and role before replay without requiring open session",
  ...["VENTA_CREDITO", "CANCELACION_VENTA_CREDITO", "ABONO_ORDINARIO", "ABONO_DIRIGIDO", "REVERSO_ABONO", "AJUSTE_MANUAL", "BAJA_INCOBRABLE"]
    .map(p => `actual E1 insertion adapter stores explicit scope/nature/key for ${p}`),
  "actual insertion adapters reject new physical cash and pending receipt before any query/write",
  "actual movement helper validates explicit note identity rather than inferring its site",
];
const inventory = [...P, ...M];
const mutations = [
  { id: "legacy-message", tests: [P[0], M[1]], defect: "Legacy rejection loses its required update-app instruction", edits: [
    ["credit-evidence-contract.ts", "Actualiza la aplicación y vuelve a intentar.", "Reintenta.", 2],
  ] },
  { id: "credential-whitelist", tests: [P[1]], defect: "Parser leaks raw request properties into evidence", edits: [
    ["credit-evidence-contract.ts", '  return {\n    sitioOrigenId: positiveId(value.sitioOrigenId, "sitioOrigenId"),', '  return {\n    ...value,\n    sitioOrigenId: positiveId(value.sitioOrigenId, "sitioOrigenId"),'],
  ] },
  { id: "producer-nature", tests: [P[2]], defect: "Credit sale wrongly admits accounting correction", edits: [
    ["credit-evidence-contract.ts", '    VENTA_CREDITO: ["OPERACION_CREDITO_SIN_DINERO"],', '    VENTA_CREDITO: ["OPERACION_CREDITO_SIN_DINERO", "CORRECCION_CONTABLE"],'],
  ] },
  { id: "money-sign", tests: [P[3]], defect: "Canonical amount incorrectly retains a negative zero sign", edits: [
    ["credit-evidence-contract.ts", 'match[1] && cents !== 0n ? "-" : ""', 'match[1] ? "-" : ""'],
  ] },
  { id: "key-order", tests: [P[4]], defect: "Canonical JSON becomes sensitive to object insertion order", edits: [
    ["credit-evidence-contract.ts", "Object.keys(item).sort()", "Object.keys(item)"],
  ] },
  { id: "canonical-secrets", tests: [P[5]], defect: "Canonical JSON admits password/session credential properties", edits: [
    ["credit-evidence-contract.ts", "if (/password|credential|credencial|sessiontoken|session_token|authorization|cookie|secret|token/i.test(key))", "if (false)"],
  ] },
  { id: "false-cash-session", tests: [P[6]], defect: "Nonphysical correction is allowed to charge a cash session", edits: [
    ["credit-evidence-contract.ts", '    if (input.sesionCajaId != null) throw new CreditEvidenceError("E1: una operación sin dinero real no puede imputar sesión de caja.");', "    // MUTANT: permit a cash session on nonphysical operations."],
  ] },
  { id: "cash-open", tests: [P[7], M[14]], defect: "New physical credit cash capture is activated", edits: [
    ["credit-evidence-contract.ts", "export const CREDIT_CASH_CAPTURE_ENABLED = false;", "export const CREDIT_CASH_CAPTURE_ENABLED = true;"],
  ] },
  { id: "cross-site-access", tests: [P[8], M[6]], defect: "An operational actor can write/replay outside its current site", edits: [
    ["credit-evidence-contract.ts", '  if (actor.rol !== "ADMIN" && actor.ubicacionId !== sitioOrigenId) {', "  if (false) {"],
  ] },
  { id: "replay-falls-through", tests: [P[9], P[12], M[0]], defect: "Committed operation is mislabeled non-replay, repeating domain work", edits: [
    ["credit-evidence-contract.ts", "  return { replay: true, movement };", "  return { replay: false, movement: null };"],
  ] },
  { id: "new-claim-is-replay", tests: [P[10]], defect: "A newly claimed producer operation is incorrectly treated as existing", edits: [
    ["credit-evidence-contract.ts", "  if (inserted) return { replay: false, movement: null };", "  if (inserted) return { replay: true, movement: null };"],
  ] },
  { id: "immutable-content-bypass", tests: [P[11], M[2]], defect: "Replay ignores changed canonical actor/nature/intent", edits: [
    ["credit-evidence-contract.ts", "  if (canonicalCreditContent(stored) !== canonicalCreditContent(incoming)) {", "  if (false) {"],
    ["credit-evidence-contract.ts", "  if (stored.usuarioId !== input.actorId || stored.naturaleza !== input.naturaleza) {", "  if (false) {"],
  ] },
  { id: "missing-movement-success", tests: [P[13], M[5]], defect: "An incomplete committed reservation becomes a stub replay success", edits: [
    ["credit-evidence-contract.ts", '  if (!movement) throw new CreditEvidenceError("E1: operación existente sin movimiento recuperable; requiere revisión.", 409);', "  // MUTANT: incomplete reservation accepted as success."],
  ] },
  { id: "retained-gate-bypass", tests: [P[14]], defect: "Disabled pending-receipt claim reaches storage", edits: [
    ["credit-evidence-contract.ts", '  if (input.productor === "COBRO_PENDIENTE" && !CREDIT_PENDING_RECEIPTS_ENABLED) {', "  if (false) {"],
  ] },
  { id: "movement-producer-isolation", tests: [M[3]], defect: "Directed replay fetches an ordinary producer's movement by the same UUID", edits: [
    ["credit-evidence.ts", "eq(movimientosCreditoTable.operacionProductor, productor), eq(movimientosCreditoTable.operacionClave, clave)", 'eq(movimientosCreditoTable.operacionProductor, "ABONO_ORDINARIO"), eq(movimientosCreditoTable.operacionClave, clave)'],
  ] },
  { id: "atomic-loser-success", tests: [M[4]], defect: "Actual adapter ignores ON CONFLICT result and calls the loser newly inserted", edits: [
    ["credit-evidence.ts", "      return inserted.length > 0;", "      return true;"],
  ] },
  { id: "origin-inferred-from-ticket", tests: M.slice(7, 14), defect: "All seven producers lose explicit origin and infer it from an unrelated ticket ID", edits: [
    ["credit-evidence.ts", "    ...movement, importe, ...evidence, operacionProductor: productor,", "    ...movement, importe, ...evidence, sitioOrigenId: movement.ticketId ?? null, operacionProductor: productor,"],
  ] },
  { id: "note-site-bypass", tests: [M[15]], defect: "Explicit note evidence can refer to a different customer's/site's note", edits: [
    ["credit-evidence.ts", '    if (!note || note.documentoTipo !== "NOTA" || note.clienteId !== movement.clienteId || note.ubicacionId !== evidence.sitioOrigenId) {', "    if (false) {"],
  ] },
];
function apply(source, edits) {
  const result = { ...source };
  for (const [file, before, after, count = 1] of edits) {
    assert.equal(result[file].split(before).length - 1, count, `Ambiguous/missing source anchor: ${file} ${before}`);
    result[file] = result[file].split(before).join(after);
  }
  return result;
}
function errors(error) {
  return !error ? [] : [error, ...errors(error.cause), ...(error.errors ?? []).flatMap(errors)];
}
let dir, report;
async function main() {
  assert.ok(globalThis[Symbol.for("e1.offline.guard.installed")], "Offline guard must be preloaded");
  assert.equal(process.argv[2], "--execute-after-baseline");
  const baselineLog = await readFile("/tmp/e1-backend-baseline-loader.log", "utf8");
  assert.match(baselineLog, /ℹ fail 0/);
  assert.match(baselineLog, /ℹ duration_ms/);
  for (const name of inventory) assert.ok(baselineLog.includes(`✔ ${name} (`), `Main baseline has not confirmed ${name}`);
  assert.deepEqual([...new Set(mutations.flatMap(m => m.tests))].sort(), [...inventory].sort());
  const source = Object.fromEntries(await Promise.all(files.map(async name => [name, await readFile(join(lib, name), "utf8")])));
  assert.equal([...source["credit-evidence-contract.test.ts"].matchAll(/^test\("/gm)].length, 15,
    "Earlier claimed pure count was 16; actual authored count is 15. Do not invent a 32nd result.");
  for (const mutation of mutations) apply(source, mutation.edits);
  const require = createRequire(join(root, "artifacts/api-server/package.json"));
  const tsx = require.resolve("tsx");
  dir = await mkdtemp("/tmp/e1-core-mutants-");
  await symlink(join(root, "artifacts/api-server/node_modules"), join(dir, "node_modules"), "dir");
  await writeFile(join(dir, "package.json"), '{"type":"module"}\n');
  await writeFile(join(dir, "reporter.mjs"), await readFile(reporter, "utf8"));
  const writeSources = async values => {
    for (const name of files) await writeFile(join(dir, name), values[name]);
  };
  await writeSources(source);
  report = {
    status: "RUNNING", tempRoot: dir, guard, mainBaselineLog: "/tmp/e1-backend-baseline-loader.log",
    actualInventory: { pure: P.length, actualAdapter: M.length, total: inventory.length, priorCountCorrection: "15+16=31, not 16+16=32" },
    sourceHashes: Object.fromEntries(files.map(name => [name, hash(source[name])])),
    mutations: [], cases: [], uncovered: [...inventory], workspaceUntouched: null,
  };
  const save = async () => writeFile(join(dir, "report.json"), JSON.stringify(report, null, 2));
  await save();
  async function run(label, names) {
    const testFiles = [
      ...(names.some(name => P.includes(name)) ? [join(dir, "credit-evidence-contract.test.ts")] : []),
      ...(names.some(name => M.includes(name)) ? [join(dir, "credit-evidence.mock.test.ts")] : []),
    ];
    const args = ["--require", guard, "--import", tsx, "--test", "--test-concurrency=1",
      `--test-name-pattern=^(?:${names.map(escape).join("|")})$`,
      "--test-reporter", join(dir, "reporter.mjs"),
      ...testFiles];
    const child = spawnSync(process.execPath, args, {
      cwd: dir, env: { PATH: process.env.PATH ?? "", NODE_ENV: "test" },
      encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024,
    });
    const stdout = child.stdout ?? "", stderr = child.stderr ?? "";
    await writeFile(join(dir, `${label}.jsonl`), stdout);
    await writeFile(join(dir, `${label}.stderr.txt`), stderr);
    const events = stdout.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
    const results = events.filter(e => ["test:pass", "test:fail"].includes(e.type) && !e.skip);
    const flattened = results.flatMap(e => errors(e.details?.error));
    const infrastructure = Boolean(child.error || child.signal) ||
      /ERR_MODULE_NOT_FOUND|SyntaxError|TransformError|E1_OFFLINE_NETWORK_DISABLED|ERR_UNKNOWN_FILE_EXTENSION/.test(
        stderr + flattened.map(e => `${e.code}: ${e.message}`).join("\n"));
    assert.equal(infrastructure, false, `${label}: infrastructure failure is not a killed mutant`);
    assert.deepEqual(results.map(e => e.name).sort(), [...names].sort(), `${label}: exact named testcase inventory required`);
    return { exitCode: child.status, stdoutPath: join(dir, `${label}.jsonl`), stderrPath: join(dir, `${label}.stderr.txt`), results };
  }
  report.before = await run("before", inventory);
  assert.equal(report.before.exitCode, 0);
  assert.ok(report.before.results.every(e => e.type === "test:pass"));
  await save();
  for (const mutation of mutations) {
    const changed = apply(source, mutation.edits);
    await writeSources(changed);
    for (const name of new Set(mutation.edits.map(e => e[0]))) {
      await writeFile(join(dir, `${mutation.id}.${name}`), changed[name]);
    }
    let result;
    try { result = await run(mutation.id, mutation.tests); }
    finally { await writeSources(source); }
    const assertions = result.results.map(event => {
      const assertion = errors(event.details?.error).find(e => e.code === "ERR_ASSERTION" && /AssertionError/.test(e.name));
      return { name: event.name, failed: event.type === "test:fail", assertion: assertion ?? null };
    });
    const proven = result.exitCode === 1 && assertions.every(item => item.failed && item.assertion);
    report.mutations.push({ id: mutation.id, defect: mutation.defect, targets: mutation.tests, result, assertions, proven });
    await save();
  }
  report.restored = await run("restored", inventory);
  assert.equal(report.restored.exitCode, 0);
  assert.ok(report.restored.results.every(e => e.type === "test:pass"));
  report.cases = inventory.map(name => {
    const mutant = report.mutations.find(m => m.proven && m.targets.includes(name));
    return {
      name, before: "PASS", beforeLog: report.before.stdoutPath,
      defect: mutant?.defect ?? null, mutationId: mutant?.id ?? null,
      mutant: mutant ? "FAIL_ASSERTION" : "UNOBSERVED", mutantLog: mutant?.result.stdoutPath ?? null,
      assertion: mutant?.assertions.find(a => a.name === name)?.assertion ?? null,
      restored: "PASS", restoredLog: report.restored.stdoutPath,
    };
  });
  report.uncovered = report.cases.filter(c => c.mutant !== "FAIL_ASSERTION").map(c => c.name);
  report.workspaceUntouched = (await Promise.all(files.map(async name => hash(await readFile(join(lib, name), "utf8")) === report.sourceHashes[name]))).every(Boolean);
  report.stagedRestored = (await Promise.all(files.map(async name => hash(await readFile(join(dir, name), "utf8")) === report.sourceHashes[name]))).every(Boolean);
  report.status = !report.uncovered.length && report.workspaceUntouched && report.stagedRestored ? "PASS" : "FAIL";
  await save();
  console.log(JSON.stringify({ reportPath: join(dir, "report.json"), status: report.status, inventory: report.actualInventory, proven: report.cases.length - report.uncovered.length, uncovered: report.uncovered, workspaceUntouched: report.workspaceUntouched }));
  process.exitCode = report.status === "PASS" ? 0 : 1;
}
main().catch(async error => {
  if (dir && report) {
    report.status = "INFRASTRUCTURE_OR_BASELINE_ERROR";
    report.error = String(error.stack ?? error);
    await writeFile(join(dir, "report.json"), JSON.stringify(report, null, 2));
  }
  console.error(JSON.stringify({ reportPath: dir && join(dir, "report.json"), error: String(error.stack ?? error) }));
  process.exitCode = 2;
});