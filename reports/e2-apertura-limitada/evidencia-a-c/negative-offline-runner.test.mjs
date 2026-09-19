import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const own = "reports/e2-apertura-limitada/evidencia-a-c";
const suite = resolve(repo, own, "negative-offline.test.mjs");
const guard = resolve(repo, own, "negative-offline-guard.test.cjs");
const files = [
  "artifacts/api-server/src/routes/clientes.ts",
  "artifacts/api-server/src/routes/pagos-dirigidos.ts",
  "artifacts/api-server/src/routes/e1-customer-mutations.offline.test.ts",
  ...["credit-abono-evidence", "credit-refund", "credit-refund.mock.test", "credit-evidence-contract",
    "credit-refund-contract", "credit-allocation", "date-only", "startup-mode", "limited-startup-preflight",
    "limited-startup-preflight.test"].map((name) => `artifacts/api-server/src/lib/${name}.ts`),
  `${own}/01-install-evidence-prepared.sql`,
];
assert.ok(files.length && existsSync(suite) && existsSync(guard), "explicit test selection must exist");
for (const file of files) assert.ok(existsSync(resolve(repo, file)), `missing allowlisted input: ${file}`);
const root = mkdtempSync(join(tmpdir(), "e2-negative-offline-"));
const hashes = {};
for (const file of files) {
  mkdirSync(dirname(resolve(root, file)), { recursive: true });
  copyFileSync(resolve(repo, file), resolve(root, file));
  hashes[file] = createHash("sha256").update(readFileSync(resolve(root, file))).digest("hex");
}
writeFileSync(join(root, "inputs-sha256.json"), JSON.stringify(hashes, null, 2));
const logs = [];
function run(label, expected, semantic) {
  const result = spawnSync(process.execPath, ["--require", guard, suite, `--fixture-root=${root}`], {
    cwd: repo, encoding: "utf8", timeout: 120000,
  });
  const output = (result.stdout ?? "") + (result.stderr ?? "");
  writeFileSync(join(root, `${label}.log`), output);
  logs.push({ label, status: result.status, log: join(root, `${label}.log`) });
  console.log(JSON.stringify(logs.at(-1)));
  assert.equal(result.error, undefined, "test process must start and finish normally");
  assert.equal(result.status, expected, `${label}: unexpected exit; inspect ${logs.at(-1).log}`);
  if (expected) {
    assert.match(output, /AssertionError/);
    assert.match(output, semantic);
    assert.doesNotMatch(output, /E2_OFFLINE_FORBIDDEN_IO|Unallowlisted import|Unmocked dependency|SyntaxError/);
  }
}
run("baseline", 0);
const ordinary = "artifacts/api-server/src/routes/clientes.ts";
const directed = "artifacts/api-server/src/routes/pagos-dirigidos.ts";
const mutants = [
  ["ordinary-producer-omitted", ordinary, (s) => s.replace(
    "await finalizePhysicalAbonoEvidence(tx, {", "await (async () => {})(tx, {"),
    /ordinary producer must finalize exactly once/],
  ["directed-producer-omitted", directed, (s) => s.replace(
    "await finalizePhysicalAbonoEvidence(tx, {", "await (async () => {})(tx, {"),
    /directed producer must finalize exactly once/],
  ["classification-altered", "artifacts/api-server/src/lib/credit-abono-evidence.ts",
    (s) => s.replace('appliedCents === 0 ? "UNUSED"', 'appliedCents === 0 ? "FULL"'),
    /classification must match canonical allocations/],
  ["directed-classification-altered", "artifacts/api-server/src/lib/credit-abono-evidence.ts",
    (s) => s.replace('appliedCents === receiptCents ? "FULL"', 'appliedCents === receiptCents ? "UNUSED"'),
    /directed valid canonical FULL must not hit classification guard/],
  ["directed-provenance-false-fifo", "artifacts/api-server/src/lib/credit-abono-evidence.ts",
    (s) => s.replace('? "directedApplication" : "projectCreditLedger"', '? "projectCreditLedger" : "projectCreditLedger"'),
    /directed provenance must not claim canonical FIFO/],
  ["ordinary-provenance-false-directed", "artifacts/api-server/src/lib/credit-abono-evidence.ts",
    (s) => s.replace('? "directedApplication" : "projectCreditLedger"', '? "directedApplication" : "directedApplication"'),
    /ordinary provenance must identify canonical FIFO/],
  ["directed-core-guard-omitted", "artifacts/api-server/src/lib/credit-abono-evidence.ts",
    (s) => s.replace('if (input.productor === "ABONO_DIRIGIDO"', 'if (false && input.productor === "ABONO_DIRIGIDO"'),
    /directed UNUSED\/0: mismatch must reject before persistence/],
  ["directed-core-amount-check-omitted", "artifacts/api-server/src/lib/credit-abono-evidence.ts",
    (s) => s.replace('|| input.evaluation.appliedCents !== input.evaluation.receiptCents', "|| false"),
    /directed FULL\/2500: mismatch must reject before persistence/],
  ["directed-core-result-check-omitted", "artifacts/api-server/src/lib/credit-abono-evidence.ts",
    (s) => s.replace('input.evaluation.result !== "FULL"', "false"),
    /directed PARTIAL\/10000: mismatch must reject before persistence/],
  ["partial-classification-altered", "artifacts/api-server/src/lib/credit-abono-evidence.ts",
    (s) => s.replace('? "FULL" : "PARTIAL"', '? "FULL" : "UNUSED"'),
    /classification must match canonical allocations/],
  ["directed-before-application", directed, (s) => {
    const application = "    await tx.insert(aplicacionesCreditoTable).values({ abonoMovimientoId: movement.id, ventaMovimientoId: doc.id, importe: amount });";
    const start = s.indexOf("    await finalizePhysicalAbonoEvidence(tx, {");
    const end = s.indexOf("\n    });", start) + "\n    });".length;
    assert.ok(start >= 0 && end > start && s.includes(application));
    return s.slice(0, start).replace(application, "") + s.slice(start, end)
      + `\n${application}` + s.slice(end);
  }, /directed finalization must follow persisted application/],
  ["before-fifo", ordinary, (s) => {
    const start = s.indexOf("        await finalizePhysicalAbonoEvidence(tx, {");
    const end = s.indexOf("\n        });", start) + "\n        });".length;
    assert.ok(start >= 0 && end > start);
    const call = s.slice(start, end).replace(
      /allocations\.map\(\(\{ targetId, appliedCents: allocated \}\) => \(\{[\s\S]*?\}\)\)/, "[]");
    return s.slice(0, start).replace(
      "        const projection = await loadCustomerCreditProjectionInTransaction(",
      `${call}\n        const projection = await loadCustomerCreditProjectionInTransaction(`) + s.slice(end);
  }, /finalization must follow FIFO/],
  ["missing-positive-proof", "artifacts/api-server/src/lib/credit-refund.ts",
    (s) => s.replace('if (!proof.rows[0]) throw new CreditEvidenceError("E2: falta prueba positiva de recepción íntegra nunca aplicada.", 409);',
      '/* mutant: positive proof rejection omitted */'),
    /missing proof must reject refund/],
  ["retained-unconditional-abono-join", "artifacts/api-server/src/lib/credit-refund.ts",
    (source) => source.replace('const proof = input.origen === "ABONO"', "const proof = true"),
    /COBRO_RETENIDO: valid own proof must be accepted/],
  ["abono-finalization-join-omitted", "artifacts/api-server/src/lib/credit-refund.ts",
    (source) => source.replace(
      "JOIN finalizaciones_abono_e2 f ON f.abono_id=p.abono_id AND f.resultado='UNUSED'", "")
      .replace("FOR UPDATE OF p,f", "FOR UPDATE OF p"),
    /MISSING: ABONO must require UNUSED finalization/],
  ["r4-application-guard-omitted-LEXICAL-ONLY", `${own}/01-install-evidence-prepared.sql`,
    (source) => source.replace("RAISE EXCEPTION 'E2: capture applications must precede finalization';", "NULL;"),
    /R4 lexical: finalized capture application must raise/],
  ...["e2_finalization_immutable", "e2_validate_abono_finalization", "e2_proof_immutable",
    "e2_validate_unused_proof", "e2_abono_finalization_complete", "e2_capture_application_order"].map((trigger) => [
    `preflight-bypass-${trigger}`, "artifacts/api-server/src/lib/limited-startup-preflight.ts",
    (source) => source.replace(
      'throw new Error(`Limited startup A+C evidence trigger ${trigger} mismatch.`);',
      `if (trigger !== ${JSON.stringify(trigger)}) throw new Error(\`Limited startup A+C evidence trigger \${trigger} mismatch.\`);`),
    new RegExp(`${trigger}\\.prosrc: drift must fail closed`),
  ]),
  ...["e2_finalize_new_abono", "e2_attest_new_retained"].map((name) => [
    `preflight-bypass-${name}`, "artifacts/api-server/src/lib/limited-startup-preflight.ts",
    (source) => source.replace('throw new Error("Limited startup A+C evidence finalizer mismatch.");',
      `if (functionName !== ${JSON.stringify(name)}) throw new Error("Limited startup A+C evidence finalizer mismatch.");`),
    new RegExp(`${name}\\.prosrc: drift must fail closed`),
  ]),
];
for (const [name, file, change, semantic] of mutants) {
  const path = resolve(root, file);
  const original = readFileSync(path, "utf8");
  const mutated = change(original);
  assert.notEqual(mutated, original, `${name}: mutation must hit real production source`);
  writeFileSync(path, mutated);
  try { run(name, 1, semantic); }
  finally { writeFileSync(path, original); }
  run(`${name}-restored`, 0);
}
for (const file of files) assert.equal(
  createHash("sha256").update(readFileSync(resolve(root, file))).digest("hex"), hashes[file],
  `isolated source not restored: ${file}`);
writeFileSync(join(root, "results.json"), JSON.stringify(logs, null, 2));
const retainedLogs = resolve(repo, own, "negativos-offline-logs-20260919");
mkdirSync(retainedLogs, { recursive: true });
for (const file of [...logs.map(({ label }) => `${label}.log`), "results.json", "inputs-sha256.json"])
  copyFileSync(join(root, file), join(retainedLogs, file));
console.log(`Evidence retained in ${root}`);
console.log(`Complete logs copied to ${retainedLogs}`);