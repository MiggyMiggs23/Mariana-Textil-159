// Offline source-only mutation proof. Never imports app, DB, schema or drivers.
// Production/test workspace files are read-only; all mutations use private copies.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir, mkdtemp, symlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const lib = join(root, "artifacts/api-server/src/lib");
const output = join(root, "reports/e2-cash-negative-proofs");
const guard = join(root, "scripts/src/offline-test-guard.cjs");
const reporter = join(root, "scripts/src/e1-evidence-mutant-reporter.mjs");
const loader = join(root, "artifacts/api-server/node_modules/tsx/dist/loader.mjs");
const tests = ["caja-cash-ledger.test.ts", "caja-corte-reader.mock.test.ts", "caja-admin-cash.mock.test.ts", "caja-close.mock.test.ts"];
const files = [...tests, "caja-cash-ledger.ts", "caja-corte-reader.ts", "admin-analytics.ts", "pos.ts"];
const original = Object.fromEntries(await Promise.all(files.map(async file => [file, await readFile(join(lib, file), "utf8")])));
const sha = text => createHash("sha256").update(text).digest("hex");
const hashes = Object.fromEntries(files.map(file => [file, sha(original[file])]));
const temp = await mkdtemp("/tmp/e2-cash-mutants-");
await symlink(join(root, "node_modules"), join(temp, "node_modules"), "dir");
await writeFile(join(temp, "package.json"), '{"type":"module"}\n');
await mkdir(output, { recursive: true });
const ledger = "caja-cash-ledger.ts", reader = "caja-corte-reader.ts";
const P = [...original[tests[0]].matchAll(/test\("([^"]+)"/g)].map(m => m[1]);
const R = [...original[tests[1]].matchAll(/test\("([^"]+)"/g)].map(m => m[1]);
const A = [...original[tests[2]].matchAll(/test\("([^"]+)"/g)].map(m => m[1]);
const C = [...original[tests[3]].matchAll(/test\("([^"]+)"/g)].map(m => m[1]);
const mutations = [
  { id: "01-applied-receipt-multiplied", test: P[3], file: tests[0], defect: "Supported E1 ABONO counted once per attached application instead of receipt.",
    edit: [ledger, "importe: cashMoney(-cashCents(movement.importe))", "importe: cashMoney(-cashCents(movement.importe) * BigInt((movement as CreditCashMovement & { applications?: unknown[] }).applications?.length ?? 1))"] },
  { id: "02-retained-omitted", test: P[0], file: tests[0], defect: "Retained bucket omitted from physical expected cash.",
    edit: [ledger, "sums.FONDO_INICIAL + sums.TICKET + sums.ABONO + sums.COBRO_RETENIDO - sums.SALIDA", "sums.FONDO_INICIAL + sums.TICKET + sums.ABONO - sums.SALIDA"] },
  { id: "03-shared-receipt-namespace-lost", test: P[1], file: tests[0], defect: "Same receipt can be counted as both retained and abono.",
    edit: [ledger, '["ABONO", "COBRO_RETENIDO"].includes(document.origen) ? "RECEIPT" : document.origen', "document.origen"] },
  { id: "04-accounting-enters-cash", test: P[2], file: tests[0], defect: "Accounting ABONO is wrongly admitted into physical cash.",
    edit: [ledger, 'movement.sesionCajaId !== sessionId || movement.naturaleza !== "INGRESO_FISICO" ||', 'movement.sesionCajaId !== sessionId || !["INGRESO_FISICO", "CORRECCION_CONTABLE"].includes(movement.naturaleza ?? "") ||'] },
  { id: "05-conversion-without-origin-admitted", test: P[4], file: tests[0], defect: "Unsupported pending conversion is admitted without immutable origin link.",
    edit: [ledger, '["ABONO_ORDINARIO", "ABONO_DIRIGIDO"].includes', '["ABONO_ORDINARIO", "ABONO_DIRIGIDO", "COBRO_PENDIENTE", "CONVERSION_PENDIENTE"].includes'] },
  { id: "06-fractional-cent-accepted", test: P[5], file: tests[0], defect: "Money parser admits fractional cents.",
    edit: [ledger, String.raw`/^-?\d+(?:\.\d{1,2})?$/`, String.raw`/^-?\d+(?:\.\d+)?$/`] },
  { id: "07-old-closed-recomputed", test: P[6], file: tests[0], defect: "Legacy closed surfaces recalculate with current receipts.",
    edit: [ledger, "if (snapshots.length === 0) return legacy;", 'if (snapshots.length === 0) { const current = await liveReader(); return { efectivoEsperado: current.efectivoEsperado, diferencia: null }; }'] },
  { id: "08-frozen-values-overridden", test: P[7], file: tests[0], defect: "Closed E2 snapshot is replaced by mutable legacy values.",
    edit: [ledger, "efectivoEsperado: snapshot.efectivoDesglose.efectivoEsperado, diferencia: snapshot.diferencia", "efectivoEsperado: legacy.efectivoEsperado, diferencia: legacy.diferencia"] },
  { id: "09-cross-session-snapshot", test: P[8], file: tests[0], defect: "Snapshot for another session is silently accepted.",
    edit: [ledger, "snapshot.sesionId !== sessionId || ", ""] },
  { id: "10-open-still-legacy", test: P[9], file: tests[0], defect: "Open session bypasses canonical calculation.",
    edit: [ledger, "efectivoDesglose = await liveReader();", "return legacy;"] },
  { id: "11-legacy-audit-not-scoped", test: R[0], file: tests[1], defect: "Closed-session audit lookup omits session identity.",
    edit: [reader, 'eq(auditoriaTable.entidadId, String(session.id))', 'eq(auditoriaTable.entidadId, "wrong-session")'] },
  { id: "12-frozen-snapshot-not-discovered", test: R[1], file: tests[1], defect: "Reader ignores persisted E2 cashSnapshot.",
    edit: [reader, 'Object.prototype.hasOwnProperty.call(row.datos, "cashSnapshot")', 'Object.prototype.hasOwnProperty.call(row.datos, "missingSnapshot")'] },
  { id: "13-outflow-added-as-ticket", test: R[2], file: tests[1], defect: "Cash outflow is added as ticket instead of subtracted.",
    edit: [reader, 'documents.push({ origen: "SALIDA"', 'documents.push({ origen: "TICKET"'] },
  { id: "14-admin-pages-before-filter", test: A[0], file: tests[2], defect: "Admin pages before resolving difference filter/totals.",
    edit: ["admin-analytics.ts", "const filtered = resolved.filter(", "const filtered = resolved.slice((page - 1) * pageSize, page * pageSize).filter("] },
  { id: "15-close-lock-not-exclusive", test: C[0], file: tests[3], defect: "Close uses FOR SHARE rather than conflicting exclusive FOR UPDATE.",
    edit: ["pos.ts", '.where(eq(sesionesCajaTable.id, input.sesionId))\n    .for("update")', '.where(eq(sesionesCajaTable.id, input.sesionId))\n    .for("share")'] },
  { id: "16-audit-failure-swallowed", test: C[1], file: tests[3], defect: "Close swallows audit failure and resolves successfully.",
    transform(text) {
      const start = text.indexOf("export async function cerrarSesionCaja(");
      const end = text.indexOf("export async function buscarPos(");
      const close = text.slice(start, end).replace("await tx.insert(auditoriaTable).values({", "try { await tx.insert(auditoriaTable).values({")
        .replace("  return buildCorteCaja(tx, sesion.id);", "  } catch { return null; }\n  return buildCorteCaja(tx, sesion.id);");
      return text.slice(0, start) + close + text.slice(end);
    }, target: "pos.ts" },
  { id: "17-real-names-dropped", test: R[2], file: tests[1], defect: "Real provider name is discarded, leaving numeric identity without printable name.",
    edit: [reader, "providerNames.get(document.evidencia.proveedorId) ?? null", "null"] },
];
const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/DATABASE|POSTGRES|^PG|^DIRECT_URL$|^NODE_OPTIONS$/.test(key)));
env.TSX_DISABLE_CACHE = "1";
function run(id, testFiles, name) {
  const args = ["--require", guard, "--import", loader, "--test", `--test-reporter=${reporter}`];
  if (name) args.push(`--test-name-pattern=^${escaped(name)}$`);
  args.push(...testFiles.map(file => join(temp, file)));
  const result = spawnSync(process.execPath, args, { cwd: temp, env, encoding: "utf8", timeout: 120000, maxBuffer: 10_000_000 });
  return { result, args, log: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}
async function reset() {
  for (const file of files) await writeFile(join(temp, file), original[file]);
}
await reset();
const baseline = run("baseline", tests);
await writeFile(join(output, "baseline.jsonl"), baseline.log);
assert.equal(baseline.result.status, 0, baseline.log);
const records = [];
for (const mutation of mutations) {
  await reset();
  const target = mutation.edit?.[0] ?? mutation.target;
  let changed;
  if (mutation.edit) {
    const [, before, after] = mutation.edit;
    assert.equal(original[target].split(before).length - 1, 1, `${mutation.id}: edit must match exactly once`);
    changed = original[target].replace(before, after);
  } else changed = mutation.transform(original[target]);
  assert.notEqual(changed, original[target]);
  await writeFile(join(temp, target), changed);
  const execution = run(mutation.id, [mutation.file], mutation.test);
  await writeFile(join(output, `${mutation.id}.jsonl`), execution.log);
  const events = (execution.result.stdout ?? "").split("\n").filter(line => line.startsWith("{")).map(line => JSON.parse(line));
  const failed = events.find(event => event.type === "test:fail" && event.name === mutation.test && !event.skip);
  const errorText = JSON.stringify(failed?.details.error ?? {});
  const witnessed = execution.result.status !== 0 && !!failed && /ERR_ASSERTION|AssertionError/.test(errorText);
  records.push({ id: mutation.id, test: mutation.test, defect: mutation.defect, target, mutationSha256: sha(changed),
    exit: execution.result.status, witnessed, error: failed?.details.error ?? null });
  await writeFile(join(output, "matrix.json"), JSON.stringify({ baselineExit: baseline.result.status, temp,
    sourceSha256: hashes, tests: [...P, ...R, ...A, ...C], records,
    conversionLimitation: "Positive retained-to-abono conversion is NOT implemented or verified: E1 has no immutable origin FK. Test 05 proves fail-closed for unsupported producer, not positive conversion. Test 01 proves supported E1 ABONO is not multiplied by attached applications; test 03 proves duplicate identity across receipt buckets is rejected.",
  }, null, 2) + "\n");
  assert.ok(witnessed, `${mutation.id}: missing meaningful target assertion failure:\n${execution.log}`);
  console.log(`${mutation.id}: witnessed ${mutation.test}`);
}
for (const file of files) assert.equal(sha(await readFile(join(lib, file), "utf8")), hashes[file], `Workspace source changed during run: ${file}`);
assert.equal(new Set(records.map(record => record.test)).size, 16);
await writeFile(join(output, "source-integrity.json"), JSON.stringify({ unchanged: true, sourceSha256: hashes }, null, 2) + "\n");
console.log("16/16 tests independently witnessed; 17/17 semantic mutants rejected. No production source changed.");