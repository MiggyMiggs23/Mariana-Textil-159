import assert from "node:assert/strict";
import test from "node:test";
import {
  assertApiPauseEvidence,
  assertTriggersUnchanged,
  assertStaticOperatorPlan,
  buildPurgeSql,
  canonicalRowHashSql,
  deriveApprovedClasses,
} from "./prompt-h-authorized-purge.mts";

test("trigger verification preserves ENABLE ALWAYS as well as origin-enabled triggers", () => {
  const expected = Array.from({ length: 14 }, (_, i) => ({ name: `trigger_${i}`, enabled: i === 13 ? "A" : "O" }));
  assert.doesNotThrow(() => assertTriggersUnchanged(expected, expected, "test"));
  assert.throws(() => assertTriggersUnchanged(expected.map(r => ({ ...r, enabled: "O" })), expected, "test"));
  assert.throws(() => assertTriggersUnchanged(expected.map(r => ({ ...r, enabled: "D" })), expected, "test"));
});

test("pause evidence accepts Markdown line wraps without weakening the assertion", () => {
  const identity = "CONFIRMED_FROM_RUNNING_API_POOL_READ_ONLY current_database() heliumdb";
  const renewal = "**PASS — API detenida**\nNo se\nreinició la API.\nEscritores inesperados: **0**";
  assert.doesNotThrow(() => assertApiPauseEvidence(renewal, identity));
  assert.throws(() => assertApiPauseEvidence(renewal.replace("No se\nreinició", "Se reinició"), identity));
});

test("approved classes are derived and cover exactly A35/B7/C18", () => {
  const preflight = {
    classification: {
      listNames: {
        A: Array.from({ length: 35 }, (_, index) => `a_${index}`),
        B: [
          "auditoria_inventario_folio",
          "entrada_folio",
          "salida_folio",
          "viaje_folio",
          "ticket_folio",
          "series_consecutivo",
          "existencias",
        ],
        C: Array.from({ length: 18 }, (_, index) => `c_${index}`),
      },
    },
  };
  const classes = deriveApprovedClasses(preflight);
  assert(classes.B.includes("existencias"));
  assert.equal(new Set([...classes.A, ...classes.B, ...classes.C]).size, 60);
  assertStaticOperatorPlan(classes);
});

test("purge SQL is one A-only truncate, six counter updates, and no forbidden reset", () => {
  const classes = {
    A: Array.from({ length: 35 }, (_, index) => `a_${index}`),
    B: [
      "auditoria_inventario_folio",
      "entrada_folio",
      "salida_folio",
      "viaje_folio",
      "ticket_folio",
      "series_consecutivo",
      "existencias",
    ],
    C: Array.from({ length: 18 }, (_, index) => `c_${index}`),
  };
  const sql = buildPurgeSql(classes).join("\n");
  assert.equal((sql.match(/^TRUNCATE TABLE/gm) ?? []).length, 1);
  assert.equal((sql.match(/^UPDATE /gm) ?? []).length, 6);
  assert.doesNotMatch(sql, /\b(?:CASCADE|DELETE|RESTART IDENTITY|setval|ALTER SEQUENCE)\b/i);
  assert.match(sql, /LOCK TABLE[\s\S]*ACCESS EXCLUSIVE[\s\S]*SHARE MODE/);
});

test("row hash SQL is the approved full-column canonical method", () => {
  const sql = canonicalRowHashSql("productos");
  assert.match(sql, /to_jsonb\(t\)::text/);
  assert.match(sql, /string_agg\(md5\(canonical\), '' ORDER BY canonical, md5\(canonical\)\)/);
  assert.match(sql, /md5\(COALESCE/);
});