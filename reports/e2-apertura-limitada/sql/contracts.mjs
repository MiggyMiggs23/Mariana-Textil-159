#!/usr/bin/env node
// Shared offline contract for the SQL, coordinator, boot worker, and structural proof.
import { pathToFileURL } from "node:url";

export const PLAN_VERSION = "E2_APERTURA_LIMITADA_PLAN_V3";
// File bytes, not permission to execute. Order is part of the approval digest.
export const EVIDENCE_ARTIFACTS = Object.freeze([
  Object.freeze({ file: "../evidencia-a-c/01-install-evidence-prepared.sql", sha256: "dd99574f022b4d325a73238bf0d1e348e015003d2dad3ebc9de00ede8b094cbd" }),
  Object.freeze({ file: "../evidencia-a-c/02-revert-before-capture-only.sql", sha256: "522f8bac6d8b78e2eee158e47249aac8e8fac264cabd64546b00b6f3bf7ae4bc" }),
  Object.freeze({ file: "../../e2/sql/credit-refunds-prepared.sql", sha256: "1bb36ac4eddd07d54e28686b83a3ded3d98b115e4190fbce6e97a11c7576587d" }),
  Object.freeze({ file: "../evidencia-a-c/03-preflight-schema-prepared.sql", sha256: "f5870c20276001bd2c8269e534b2ef696217e13087a27cd350127ce8dfa9b5d2" }),
]);
export const REPORT_DIGESTS = Object.freeze({
  sourceReport: "reports/e1-guardas-operativa-2026-09-18/operational-run-1789747937364-3434.json",
  closedFunctionsSha256: "59dd73520c3d11cc65b3f2fac25f46a4560ca45700c5c981c21e17dfe80988fd",
  triggersSha256: "982aa15dcce33633ccf42ae5a79f03858bd2ff0eee26724da8858f1216accb05",
  auditAppendOnlyProsrcSha256: "9e7e5b8de15d7079105c3d29416142e6f2825c8cd1828f85f8b67a1e4e842099",
});
export const FUNCTION_METADATA = Object.freeze({
  schema: "public",
  owner: "postgres",
  language: "plpgsql",
  result: "trigger",
  securityDefiner: false,
  acl: null,
  publicExecute: true,
  publicGrantable: false,
  config: Object.freeze(["search_path=pg_catalog, public"]),
});
const trigger = (table, name, type, fn, hasConstraint = false) => Object.freeze({
  tableSchema: "public",
  table,
  name,
  enabled: "O",
  type,
  functionSchema: "public",
  function: fn,
  functionOwner: "postgres",
  functionLanguage: "plpgsql",
  functionSecurityDefiner: false,
  argsLength: 0,
  attr: "",
  hasConstraint,
  hasParent: false,
  hasQual: false,
});
export const TRIGGER_CONTRACTS = Object.freeze([
  trigger("movimientos_credito", "movimientos_credito_inmutables", 27, "prevent_financial_record_mutation"),
  trigger("movimientos_credito", "movimientos_credito_reversos_validos", 7, "validate_credit_reversal"),
  trigger("movimientos_credito", "movimientos_validos_e1", 5, "validar_movimiento_credito_e1"),
  trigger("movimientos_credito", "zz_e1_cash_capture_closed", 5, "e1_guard_cash_capture_closed"),
  trigger("cobros_credito_pendientes_e1", "cobros_inmutables_e1", 58, "impedir_mutacion_credito_e1"),
  trigger("cobros_credito_pendientes_e1", "cobros_validos_e1", 5, "validar_cobro_pendiente_e1"),
  trigger("cobros_credito_pendientes_e1", "zz_e1_pending_receipts_closed", 4, "e1_guard_pending_receipts_closed"),
  trigger("atribuciones_credito_e1", "atribuciones_inmutables_e1", 58, "impedir_mutacion_credito_e1"),
  trigger("atribuciones_credito_e1", "atribuciones_validas_e1", 7, "validar_atribucion_credito_e1"),
  trigger("atribuciones_credito_e1", "zz_e1_historical_attribution_closed", 4, "e1_guard_historical_attribution_closed"),
  trigger("finalizaciones_abono_e2", "e2_finalization_immutable", 58, "e2_reject_evidence_mutation"),
  trigger("finalizaciones_abono_e2", "e2_validate_abono_finalization", 7, "e2_validate_abono_finalization"),
  trigger("evidencia_no_aplicada_e2", "e2_proof_immutable", 58, "e2_reject_evidence_mutation"),
  trigger("evidencia_no_aplicada_e2", "e2_validate_unused_proof", 7, "e2_validate_unused_proof"),
  trigger("movimientos_credito", "e2_abono_finalization_complete", 5, "e2_require_abono_finalization", true),
  trigger("aplicaciones_credito", "e2_capture_application_order", 7, "e2_guard_finalized_capture_application"),
  trigger("auditoria", "auditoria_append_only", 27, "proteger_auditoria_append_only"),
]);
export const AUDIT_CONTRACT = Object.freeze({
  trigger: TRIGGER_CONTRACTS.at(-1),
  function: Object.freeze({
    ...FUNCTION_METADATA,
    name: "proteger_auditoria_append_only",
    config: null,
    prosrcSha256: REPORT_DIGESTS.auditAppendOnlyProsrcSha256,
    prosrc: "\n       BEGIN\n         RAISE EXCEPTION 'auditoria es append-only';\n       END;\n       ",
  }),
});
export const SQL_MANIFEST = Object.freeze({
  apply: Object.freeze({ file: "01-apply-limited-cash-abono.sql", inputMode: "CLOSED" }),
  revert: Object.freeze({ file: "02-revert-closed.sql", inputMode: "LIMITED" }),
  requiredPsqlVariables: Object.freeze(["expected_identity_sha256", "expected_plan_sha256"]),
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(`${JSON.stringify({
    planVersion: PLAN_VERSION,
    reportDigests: REPORT_DIGESTS,
    functionMetadata: FUNCTION_METADATA,
    triggers: TRIGGER_CONTRACTS,
    audit: AUDIT_CONTRACT,
    sqlManifest: SQL_MANIFEST,
    evidenceArtifacts: EVIDENCE_ARTIFACTS,
  }, null, 2)}\n`);
}