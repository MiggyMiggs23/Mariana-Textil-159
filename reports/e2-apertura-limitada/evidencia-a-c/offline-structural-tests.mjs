import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { EVIDENCE_ARTIFACTS, PLAN_VERSION } from "../sql/contracts.mjs";

const apply = readFileSync(new URL("./01-install-evidence-prepared.sql", import.meta.url), "utf8");
const revert = readFileSync(new URL("./02-revert-before-capture-only.sql", import.meta.url), "utf8");
const refund = readFileSync(new URL("../../e2/sql/credit-refunds-prepared.sql", import.meta.url), "utf8");
const preflight = readFileSync(new URL("../../../artifacts/api-server/src/lib/limited-startup-preflight.ts", import.meta.url), "utf8");
const startup = readFileSync(new URL("../../../artifacts/api-server/src/lib/startup-mode.ts", import.meta.url), "utf8");
assert.equal(PLAN_VERSION, "E2_APERTURA_LIMITADA_PLAN_V3");
for (const { file, sha256 } of EVIDENCE_ARTIFACTS) {
  const content = readFileSync(new URL(`../sql/${file}`, import.meta.url));
  assert.equal(createHash("sha256").update(content).digest("hex"), sha256, file);
  assert.ok(startup.includes(sha256), `startup fingerprint: ${file}`);
}
// The canonical A+C function bodies must match both activation and preflight.
for (const match of apply.matchAll(/CREATE FUNCTION public\.(\w+)\([\s\S]*?AS \$function\$([\s\S]*?)\$function\$;/g)) {
  const hash = createHash("sha256").update(match[2]).digest("hex");
  assert.ok(preflight.includes(`${match[1]}: "${hash}"`), match[1]);
  for (const file of ["01-apply-limited-cash-abono.sql", "02-revert-closed.sql"]) {
    assert.ok(readFileSync(new URL(`../sql/${file}`, import.meta.url), "utf8").includes(hash), `${file}: ${match[1]}`);
  }
}
assert.doesNotMatch(refund, /CREATE TABLE public\.evidencia_no_aplicada_e2/);
assert.doesNotMatch(refund, /e2_attest_new_|e2_validate_new_source_proof|INSERT INTO public\.evidencia_no_aplicada_e2/);
assert.match(refund, /fuente LIKE 'COBRO_RETENIDO:%' AND reverso_id IS NULL/);
assert.match(refund, /fuente LIKE 'ABONO:%' AND reverso_id IS NOT NULL/);
assert.match(apply, /CREATE FUNCTION public\.e2_attest_new_retained\(p_clave uuid\)/);
assert.match(apply, /retained_xid::bigint <> \(txid_current\(\) % 4294967296\)/);
assert.match(apply, /FOREIGN KEY \(cobro_productor, cobro_clave\)/);
assert.match(apply, /abono_id IS NULL AND cobro_productor IS NOT NULL AND cobro_clave IS NOT NULL/);
assert.match(refund, /REFERENCES public\.evidencia_no_aplicada_e2\(fuente\)/);
assert.match(refund, /ERRCODE='E2R01'/);
assert.equal((refund.match(/CREATE TRIGGER zz_e2_refund_capture_closed/g) ?? []).length, 2);
assert.match(revert, /IN ACCESS EXCLUSIVE MODE/);
assert.ok(revert.indexOf("LOCK TABLE") < revert.indexOf("IF EXISTS"));
assert.match(revert, /close cash capture before removing empty evidence/);
assert.equal((apply.match(/FROM public\.aplicaciones_credito WHERE abono_movimiento_id/g) ?? []).length, 2);
assert.equal((apply.match(/SELECT \* FROM persisted EXCEPT SELECT \* FROM declared/g) ?? []).length, 2);
assert.equal((apply.match(/SELECT \* FROM declared EXCEPT SELECT \* FROM persisted/g) ?? []).length, 2);
assert.match(apply, /committed finalization does not match persisted applications/);
const provenanceContract = (source) => {
  assert.match(source, /m\.operacion_productor, m\.operacion_clave[\s\S]*INTO source_xid, source_client, source_amount, source_producer, source_key/);
  assert.match(source, /CASE source_producer WHEN 'ABONO_DIRIGIDO' THEN 'directedApplication'\s+ELSE 'projectCreditLedger' END/);
  assert.match(source, /source_producer = 'ABONO_DIRIGIDO'\s+AND \(NEW\.resultado IS DISTINCT FROM 'FULL'\s+OR NEW\.aplicado IS DISTINCT FROM source_amount\)/);
};
provenanceContract(apply);
for (const mutant of [
  apply.replace("CASE source_producer", "CASE NEW.operacion_productor"),
  apply.replace("THEN 'directedApplication'", "THEN 'projectCreditLedger'"),
  apply.replace("ELSE 'projectCreditLedger'", "ELSE 'directedApplication'"),
  apply.replace("NEW.resultado IS DISTINCT FROM 'FULL'", "false"),
  apply.replace("NEW.aplicado IS DISTINCT FROM source_amount", "false"),
]) assert.throws(() => provenanceContract(mutant), { name: "AssertionError" });
const applicationGuard = apply.split("CREATE FUNCTION public.e2_guard_finalized_capture_application()")[1];
assert.match(applicationGuard, /source_xid::bigint = \(txid_current\(\) % 4294967296\)/);
assert.match(applicationGuard, /EXISTS \(SELECT 1 FROM public\.finalizaciones_abono_e2/);
assert.match(applicationGuard, /capture applications must precede finalization/);
assert.match(applicationGuard, /BEFORE INSERT ON public\.aplicaciones_credito/);
// Negative copies: transaction scoping and BEFORE trigger must both remain.
assert.doesNotMatch(applicationGuard.replace("source_xid::bigint = (txid_current() % 4294967296)", "true"),
  /source_xid::bigint = \(txid_current\(\) % 4294967296\)/);
assert.doesNotMatch(applicationGuard.replace("BEFORE INSERT ON", "AFTER INSERT ON"),
  /BEFORE INSERT ON public\.aplicaciones_credito/);
const schema = readFileSync(new URL("./03-preflight-schema-prepared.sql", import.meta.url), "utf8");
const constraintsBlock = preflight.split("export const ABONO_EVIDENCE_CONSTRAINTS = [")[1].split("] as const;")[0];
for (const match of constraintsBlock.matchAll(/\["([^"]+)", "([^"]+)", "([^"]+)"\]/g)) {
  assert.ok(schema.includes(`('${match[1]}','${match[2]}','${match[3].replaceAll("'", "''")}')`), `SQL/TS constraint parity: ${match[2]}`);
}
for (const file of ["01-apply-limited-cash-abono.sql", "02-revert-closed.sql"]) {
  const plan = readFileSync(new URL(`../sql/${file}`, import.meta.url), "utf8");
  assert.ok(plan.indexOf("\\ir ../evidencia-a-c/03-preflight-schema-prepared.sql") < plan.indexOf("CREATE OR REPLACE FUNCTION"));
}

assert.match(apply, /CREATE TABLE public\.finalizaciones_abono_e2/);
assert.match(apply, /CREATE TABLE public\.evidencia_no_aplicada_e2/);
assert.match(apply, /DEFERRABLE INITIALLY DEFERRED/);
assert.match(apply, /physical ABONO cannot commit without finalization/);
assert.match(apply, /UNUSED proof completeness mismatch/);
assert.match(apply, /source_xid::bigint <> \(txid_current\(\) % 4294967296\)/);
assert.match(apply, /NEW\.forma_pago = 'EFECTIVO'/);
assert.match(apply, /NEW\.cuenta_destino = 'CAJA_FISICA'/);
assert.doesNotMatch(apply, /\b(?:UPDATE|DELETE|TRUNCATE)\s+(?:public\.)?(?:movimientos_credito|aplicaciones_credito)\b/i);
assert.doesNotMatch(apply, /\b(?:GRANT|REVOKE)\b/i);
assert.doesNotMatch(apply, /INSERT INTO public\.movimientos_credito/i);
assert.doesNotMatch(apply, /INSERT INTO public\.aplicaciones_credito/i);
assert.match(revert, /IF EXISTS \(SELECT 1 FROM public\.finalizaciones_abono_e2\)/);
assert.match(revert, /REFUSED: evidence exists; close capture but preserve evidence/);
assert.doesNotMatch(revert, /\b(?:DELETE|TRUNCATE)\b/i);

console.log("A+C offline SQL structural checks: PASS");