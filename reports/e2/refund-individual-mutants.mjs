// Offline audit only. Copies frozen source/tests; never imports DB/app modules.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
const root = process.cwd();
const base = fs.mkdtempSync(path.join(os.tmpdir(), "e2-refund-negative-"));
const lib = "artifacts/api-server/src/lib/";
const routes = "artifacts/api-server/src/routes/";
const service = lib + "credit-refund.ts";
const contract = lib + "credit-refund-contract.ts";
const e1 = lib + "credit-evidence-contract.ts";
const route = routes + "credit-refunds.ts";
const ddl = "reports/e2/sql/credit-refunds-prepared.sql";
const tests = [lib + "credit-refund.mock.test.ts", lib + "credit-refund.safe.test.ts", routes + "credit-refunds.options.safe.test.ts"];
const files = [service, contract, e1, route, ddl, lib + "credit-allocation.ts", lib + "date-only.ts", ...tests];
const originals = Object.fromEntries(files.map(f => [f, fs.readFileSync(path.join(root, f), "utf8")]));
const sha = text => crypto.createHash("sha256").update(text).digest("hex");
const before = Object.fromEntries(files.map(f => [f, sha(originals[f])]));
for (const [f, text] of Object.entries(originals)) {
  fs.mkdirSync(path.dirname(path.join(base, f)), { recursive: true });
  fs.writeFileSync(path.join(base, f), text);
}
fs.symlinkSync(path.join(root, "node_modules"), path.join(base, "node_modules"));
fs.writeFileSync(path.join(base, "package.json"), '{"type":"module"}');
const guard = path.join(base, "network-denied.mjs");
fs.writeFileSync(guard, `import net from "node:net";import dgram from "node:dgram";import http from "node:http";import https from "node:https";
const denied=()=>{throw new Error("OFFLINE AUDIT: network forbidden");};
net.Socket.prototype.connect=denied;net.connect=denied;net.createConnection=denied;dgram.createSocket=denied;http.request=denied;https.request=denied;globalThis.fetch=denied;`);
const loader = fs.realpathSync(path.join(root, "artifacts/api-server/node_modules/tsx/dist/loader.mjs"));
const outputDir = path.join(root, "reports/e2/refund-mutant-results");
fs.mkdirSync(outputDir, { recursive: true });
function execute(testPaths, name) {
  return spawnSync(process.execPath, ["--import", guard, "--import", loader, "--test", "--test-reporter=tap",
    ...(name ? ["--test-name-pattern", "^" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"] : []),
    ...testPaths.map(f => path.join(base, f))], {
    cwd: base, encoding: "utf8", timeout: 30000,
    env: { ...process.env, DATABASE_URL: "", TEST_DATABASE_URL: "", APPLICATION_DATABASE_URL: "", NODE_ENV: "test" },
  });
}
const baseline = execute(tests);
fs.writeFileSync(path.join(outputDir, "baseline.tap"), baseline.stdout + baseline.stderr);
if (baseline.status !== 0) throw new Error("Isolated baseline failed; inspect baseline.tap");
const names = tests.map(f => [...originals[f].matchAll(/^test\("([^"]+)"/gm)].map(m => m[1]));
const customerRead = '.where(eq(clientesTable.id, input.clienteId)).for("update").limit(1);';
const mutations = [
  [0,0,service,"outflow posted to wrong session", "values({ sesionCajaId: input.sesionCajaId,", "values({ sesionCajaId: 1,"],
  [0,1,service,"return session/site scope omitted", "await assertCreditEvidenceScope(req, evidence, tx);", ""],
  [0,2,service,"source incompatibility misclassified in error contract", "E2: abono físico original incompatible.", "E2: error no clasificado."],
  [0,3,service,"customer UPDATE weakened to SHARE", customerRead, customerRead.replace('"update"', '"share"')],
  [0,4,service,"redundant row lock masks removed-lock mutant",
    'if (!customer) throw new CreditEvidenceError("E2: cliente no encontrado.", 404);',
    'if (!customer) throw new CreditEvidenceError("E2: cliente no encontrado.", 404); await tx.select().from(clientesTable).where(eq(clientesTable.id, input.clienteId)).for("update").limit(1);'],
  [0,5,contract,"refund gate enabled", "CREDIT_REFUNDS_ENABLED = false", "CREDIT_REFUNDS_ENABLED = true"],
  [0,6,service,"E1 cash assertion removed", 'assertCreditCaptureEnabled(evidence, "EFECTIVO");', ""],
  [0,7,service,"stored replay response altered", "return prior.rows[0].respuesta as CreditRefundReply;", "return { ...prior.rows[0].respuesta, salidaId: 999 } as CreditRefundReply;"],
  [0,8,service,"current ADMIN requirement removed", ' || actor.rol !== "ADMIN"', ""],
  [0,9,service,"authorization error contract lost", "E2: sólo ADMIN activo puede devolver.", "E2: operación denegada."],
  [0,10,service,"partial receipt error misclassified", "E2: abono físico original incompatible.", "E2: error no clasificado."],
  [0,11,service,"second E1 assertion masks missing-first-guard mutant",
    'assertCreditCaptureEnabled(evidence, "EFECTIVO");',
    'assertCreditCaptureEnabled(evidence, "EFECTIVO"); assertCreditCaptureEnabled({ ...evidence }, "EFECTIVO");'],
  [0,12,e1,"original E1 disabled error contract lost",
    "E1: la captura nueva de efectivo de crédito permanece deshabilitada.", "E1: operación denegada."],
  [1,0,contract,"refund gate enabled", "CREDIT_REFUNDS_ENABLED = false", "CREDIT_REFUNDS_ENABLED = true"],
  [1,1,contract,"blank reason accepted", "if (!motivo || motivo.length > 500)", "if (motivo.length > 500)"],
  [1,2,contract,"changed replay fields accepted",
    "Object.entries(input).some(([k, v]) => (stored as Record<string, unknown>)[k] !== v)",
    "Object.entries(input).some(() => false)"],
  [1,3,e1,"original E1 cash gate enabled", "CREDIT_CASH_CAPTURE_ENABLED = false", "CREDIT_CASH_CAPTURE_ENABLED = true"],
  [1,4,service,"required cash gate source architecture removed", 'assertCreditCaptureEnabled(evidence, "EFECTIVO");', ""],
  [1,5,ddl,"one E1 SQL trigger no longer uses original guard", "EXECUTE FUNCTION public.e1_guard_cash_capture_closed()", "EXECUTE FUNCTION public.e2_immutable()"],
  [2,0,route,"GET falsely advertises active refund", "enabled: false", "enabled: true"],
  [2,1,route,"GET trusts stale role", ' || actor.rows[0].rol !== "ADMIN"', ""],
  [2,2,route,"GET hides real sessions when no candidates", "sesiones: sessions.rows", "sesiones: sources.rows.length ? sessions.rows : []"],
  [2,3,route,"GET masks query safety rejection", "next(error);", 'next(new Error("masked read failure"));'],
  [2,4,route,"GET wrong success status", "res.status(200).json(response)", "res.status(201).json(response)"],
  [2,5,route,"GET masks session-filter rejection", "next(error);", 'next(new Error("masked read failure"));'],
];
const matrix = [];
for (const [suite, index, file, defect, from, to] of mutations) {
  for (const [f, text] of Object.entries(originals)) fs.writeFileSync(path.join(base, f), text);
  if (!originals[file].includes(from)) throw new Error("Mutation target missing: " + defect);
  fs.writeFileSync(path.join(base, file), originals[file].replace(from, to));
  const name = names[suite][index];
  if (!name) throw new Error("Missing test name");
  const result = execute([tests[suite]], name);
  const output = result.stdout + result.stderr;
  const log = String(matrix.length + 1).padStart(2, "0") + ".tap";
  fs.writeFileSync(path.join(outputDir, log), output);
  const assertionFailure = result.status !== 0 && /name: 'AssertionError'|code: 'ERR_ASSERTION'/.test(output)
    && !/SyntaxError|ERR_MODULE_NOT_FOUND|Cannot find module|OFFLINE AUDIT: network forbidden/.test(output);
  matrix.push({ id: matrix.length + 1, test: name, testFile: tests[suite], mutatedSource: file,
    defect, mutation: { from, to }, status: result.status, assertionFailure, log,
    evidence: output.match(/error: ([^\n]*)/)?.[1] ?? "see TAP",
    limitation: suite === 1 && index >= 4 ? "static architecture assertion, not PostgreSQL execution" :
      [4,11].includes(index) && suite === 0 ? "meta-test of mutant sensitivity; redundant lock/guard is not a production business defect" :
      /error|misclassified|masks/.test(defect) ? "error-reporting semantic defect; does not independently prove every business branch" : null });
  console.log(matrix.length, assertionFailure ? "ASSERTION_KILLED" : "GAP", name);
}
const after = Object.fromEntries(files.map(f => [f, sha(fs.readFileSync(path.join(root, f), "utf8"))]));
const unchanged = JSON.stringify(before) === JSON.stringify(after);
const report = { executedAt: new Date().toISOString(), tempRoot: base, baselinePass: baseline.status === 0,
  offlineGuard: "net/tcp/dgram/http/https/fetch denied; VM dependency allowlists in frozen tests; DB URLs blank",
  productionAndFrozenTestsUnchanged: unchanged, before, after, tests: matrix,
  gaps: matrix.filter(row => !row.assertionFailure).map(row => row.id),
  strictBusinessDefectGaps: [5, 12],
  staticOnly: [18, 19],
  interpretation: "25 observed target AssertionError failures, not 25 independent business-defect proofs. Rows 5/12 mutate redundancy to audit existing negative meta-tests; rows 18/19 are static architecture/DDL checks. Error-contract mutations are labelled per row; grouped cases are not exhaustive branch mutation coverage." };
fs.writeFileSync(path.join(outputDir, "matrix.json"), JSON.stringify(report, null, 2));
if (!unchanged || report.gaps.length) process.exitCode = 1;