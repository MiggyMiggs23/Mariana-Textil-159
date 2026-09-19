#!/usr/bin/env node
// Lexical/structural proof only: no PostgreSQL client, network, or dependencies.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  AUDIT_CONTRACT,
  FUNCTION_METADATA,
  PLAN_VERSION,
  REPORT_DIGESTS,
  SQL_MANIFEST,
  TRIGGER_CONTRACTS,
  EVIDENCE_ARTIFACTS,
} from "./contracts.mjs";

const applyPath = new URL("./01-apply-limited-cash-abono.sql", import.meta.url);
const revertPath = new URL("./02-revert-closed.sql", import.meta.url);
const apply = readFileSync(applyPath, "utf8");
const revert = readFileSync(revertPath, "utf8");
const sqlAuditSource = AUDIT_CONTRACT.function.prosrc
  .replaceAll("\\", "\\\\")
  .replaceAll("\n", "\\n")
  .replaceAll("'", "''");

function executableSql(text) {
  return text
    .replace(/^\s*\\.*$/gm, "")
    .replace(/--.*$/gm, "")
    .replace(/\$function\$[\s\S]*?\$function\$/g, "$BODY$")
    .replace(/E?'(?:''|[^'])*'/gi, "$STRING$")
    .trim();
}

function inventory(text) {
  const sql = executableSql(text);
  return {
    begin: (sql.match(/\bBEGIN\s*;/gi) ?? []).length,
    commit: (sql.match(/\bCOMMIT\s*;/gi) ?? []).length,
    lock: (sql.match(/\bLOCK TABLE\b/gi) ?? []).length,
    select: (sql.match(/(?:^|;)\s*(?:WITH\b[\s\S]*?\bSELECT\b|SELECT\b)/gim) ?? []).length,
    replaceTarget: (
      sql.match(/\bCREATE OR REPLACE FUNCTION public\.e1_guard_cash_capture_closed\s*\(\s*\)/gi) ?? []
    ).length,
    forbiddenDml: (sql.match(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|MERGE)\b/gi) ?? []).length,
    forbiddenObjectDdl: (
      sql.match(/\b(?:DROP|ALTER|GRANT|REVOKE|CREATE\s+(?!OR\s+REPLACE\s+FUNCTION))\b/gi) ?? []
    ).length,
  };
}

for (const [name, text] of [["apply", apply], ["revert", revert]]) {
  const got = inventory(text);
  assert.equal(got.begin, 1, `${name}: one transaction`);
  assert.equal(got.commit, 1, `${name}: one commit`);
  assert.equal(got.lock, 1, `${name}: one lock statement`);
  assert.equal(got.replaceTarget, 1, `${name}: only target function replacement`);
  assert.equal(got.forbiddenDml, 0, `${name}: no DML`);
  assert.equal(got.forbiddenObjectDdl, 0, `${name}: no other object DDL/privilege changes`);
  assert.match(text, /expected_identity_sha256 is mandatory/);
  assert.match(text, /expected_plan_sha256 is mandatory/);
  assert.match(text, /prosecdef/);
  assert.match(text, /proacl IS NULL/);
  assert.match(text, /aclexplode/);
  assert.match(text, /acl\.grantee = 0/);
  assert.match(text, /fr\.rolname::text AS function_owner/);
  assert.match(text, /fl\.lanname::text AS function_language/);
  assert.match(text, /p\.prosecdef AS function_security_definer/);
  assert.match(text, /search_path=pg_catalog, public/);
  assert.match(text, new RegExp(PLAN_VERSION));
  assert.doesNotMatch(text, /pg_catalog\.coalesce/i);
  assert.match(text, /t\.tgdeferrable AND t\.tginitdeferred/);
  assert.match(text, /AND \(SELECT ok FROM evidence_function_check\)/);
  for (const { sha256 } of EVIDENCE_ARTIFACTS) assert.ok(text.includes(sha256));
  assert.match(text, new RegExp(REPORT_DIGESTS.closedFunctionsSha256));
  assert.match(text, new RegExp(REPORT_DIGESTS.triggersSha256));
  assert.match(text, new RegExp(REPORT_DIGESTS.auditAppendOnlyProsrcSha256));
  assert.ok(text.includes(sqlAuditSource), `${name}: exact audit prosrc`);
  assert.match(text, /public\.auditoria/);
  assert.doesNotMatch(text, /pg_get_triggerdef|has_function_privilege/i);
  assert.doesNotMatch(text, /\b(?:PASSWORD|DATABASE_URL|PGPASSWORD)\b/i);
  for (const contract of TRIGGER_CONTRACTS) {
    const tuple = [
      contract.table,
      contract.name,
      contract.enabled,
      `${contract.type}::smallint`,
      contract.functionSchema,
      contract.function,
      contract.functionOwner,
      contract.functionLanguage,
      String(contract.functionSecurityDefiner),
      String(contract.argsLength),
    ].map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[^\\n]+");
    assert.match(text, new RegExp(tuple), `${name}: shared trigger contract ${contract.name}`);
  }
}
assert.equal(FUNCTION_METADATA.owner, "postgres");
assert.equal(FUNCTION_METADATA.acl, null);
assert.deepEqual(SQL_MANIFEST.requiredPsqlVariables, ["expected_identity_sha256", "expected_plan_sha256"]);

assert.match(apply, /NEW\.tipo::text IS DISTINCT FROM 'ABONO'/);
assert.match(apply, /NEW\.naturaleza::text = 'DEVOLUCION_FISICA'/);
assert.match(apply, /E1P01/);
assert.match(apply, /E1A01/);
assert.doesNotMatch(apply, /\bopen(?:ed)?\b\s*[:=]/i);
assert.doesNotMatch(apply, /\b(?:worker|app)[_.-]?(?:open|enabled)\b/i);
assert.doesNotMatch(revert, /DROP\s+(?:TRIGGER|FUNCTION)/i);

const mutants = [
  apply.replace("IS DISTINCT FROM 'ABONO'", "IS DISTINCT FROM 'VENTA'"),
  apply.replace("NEW.naturaleza::text = 'DEVOLUCION_FISICA'", "false"),
  apply.replaceAll("AND NOT p.prosecdef", "AND p.prosecdef"),
  apply.replaceAll("AND proacl IS NULL", "AND true"),
  apply.replace("expected_identity_sha256 is mandatory", "identity optional"),
  apply.replace("t.tgenabled::text AS enabled", "'O'::text AS enabled"),
  apply.replace("t.tgqual IS NOT NULL AS has_qual", "false AS has_qual"),
  apply.replace("fn.nspname::text AS function_schema", "'public'::text AS function_schema"),
  apply.replaceAll("acl.grantee = 0", "acl.grantee <> 0"),
  apply.replaceAll(REPORT_DIGESTS.auditAppendOnlyProsrcSha256, "0".repeat(64)),
];
const negativeChecks = [
  (s) => /IS DISTINCT FROM 'ABONO'/.test(s),
  (s) => /NEW\.naturaleza::text = 'DEVOLUCION_FISICA'/.test(s),
  (s) => /AND NOT p\.prosecdef/.test(s),
  (s) => /AND proacl IS NULL/.test(s),
  (s) => /expected_identity_sha256 is mandatory/.test(s),
  (s) => /t\.tgenabled::text AS enabled/.test(s),
  (s) => /t\.tgqual IS NOT NULL AS has_qual/.test(s),
  (s) => /fn\.nspname::text AS function_schema/.test(s),
  (s) => /acl\.grantee = 0/.test(s),
  (s) => s.includes(REPORT_DIGESTS.auditAppendOnlyProsrcSha256),
];
mutants.forEach((mutant, index) => {
  assert.equal(negativeChecks[index](mutant), false, `negative copy ${index + 1} must be detected`);
});

for (const [name, text] of [["apply", apply], ["revert", revert]]) {
  process.stdout.write(
    `${name} sha256=${createHash("sha256").update(text).digest("hex")} inventory=${JSON.stringify(inventory(text))}\n`,
  );
}
process.stdout.write(`PASS: ${mutants.length} isolated negative copies detected; PostgreSQL not executed\n`);