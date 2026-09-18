import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const apply = readFileSync(new URL("./01-install-evidence-prepared.sql", import.meta.url), "utf8");
const revert = readFileSync(new URL("./02-revert-before-capture-only.sql", import.meta.url), "utf8");

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