import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import type * as CreditHelpers from "./credit-evidence";
import type { CreditMovementEvidence } from "@workspace/api-client-react";

// Only a pure production module is evaluated. No app, server, network or DB imports.
// Set one E1_FRONTEND_MUTANT to demonstrate that its corresponding assertion fails.
const mutations: Record<string, [string, string]> = {
  "retry-key": ["signature !== next || key === null", "true"],
  "accepted-key": ["accepted() { signature = null; key = null; }", "accepted() {}"],
  "producer-key": ["JSON.stringify([producer, intent])", "JSON.stringify(intent)"],
  "draft-content": ["signature !== next || key === null", "key === null"],
  "cash-gate": ["CREDIT_CASH_CAPTURE_ENABLED = false", "CREDIT_CASH_CAPTURE_ENABLED = true"],
  "pending-gate": ["CREDIT_PENDING_RECEIPTS_ENABLED = false", "CREDIT_PENDING_RECEIPTS_ENABLED = true"],
  "attribution-gate": ["CREDIT_ATTRIBUTION_ENABLED = false", "CREDIT_ATTRIBUTION_ENABLED = true"],
  "nature-required": ['if (!input.naturaleza || !Object.hasOwn(creditNatureLabels, input.naturaleza))', "if (false)"],
  "site-required": ["if (!Number.isSafeInteger(input.sitioOrigenId) || Number(input.sitioOrigenId) <= 0)", "if (false)"],
  "correction-evidence": ['if (input.naturaleza === "CORRECCION_CONTABLE" && !input.origenJustificacion?.trim())', "if (false)"],
  "no-session": ['if ((!physical || medium !== "EFECTIVO") && input.sesionCajaId != null)', "if (false)"],
  "whitelist": ["sitioOrigenId: input.sitioOrigenId,", "...input, sitioOrigenId: input.sitioOrigenId,"],
  "exact-time": ["movimientoCreatedAt: movement.movimientoCreatedAt", "movimientoCreatedAt: new Date(movement.movimientoCreatedAt).toISOString()"],
  "snapshot": ["movimiento_origen_id: snapshot.movimiento_origen_id", "movimiento_origen_id: null"],
  "predecessor": ["anteriorId: movement.ultimaAtribucion?.id ?? null", "anteriorId: null"],
};
let source = readFileSync(new URL("./credit-evidence.ts", import.meta.url), "utf8");
if (process.env.E1_FRONTEND_MUTANT) {
  const mutation = mutations[process.env.E1_FRONTEND_MUTANT];
  assert.ok(mutation && source.includes(mutation[0]), "Unknown or stale frontend mutant");
  source = source.replace(mutation[0], mutation[1]);
}
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exportsObject: Record<string, unknown> = {};
runInNewContext(output, { exports: exportsObject, require: createRequire(import.meta.url), crypto: { randomUUID: () => "unused" } });
const helpers = exportsObject as typeof CreditHelpers;
const uuid = "706b124d-92aa-44b2-94ef-586a45ad412c";
const metadata = { sitioOrigenId: 3, naturaleza: "INGRESO_FISICO" as const, operacionClave: uuid };
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));

test("E1 retry keeps UUID until an accepted response", () => {
  let calls = 0;
  const draft = helpers.createCreditOperationDraft(() => `uuid-${++calls}`);
  const first = draft.keyFor("ABONO_ORDINARIO", { amount: 20 });
  assert.equal(draft.keyFor("ABONO_ORDINARIO", { amount: 20 }), first);
  assert.equal(calls, 1);
  draft.accepted();
  assert.notEqual(draft.keyFor("ABONO_ORDINARIO", { amount: 20 }), first);
});

test("E1 producer and changed logical draft cannot share an operation key", () => {
  let calls = 0;
  const draft = helpers.createCreditOperationDraft(() => `uuid-${++calls}`);
  const first = draft.keyFor("ABONO_ORDINARIO", metadata);
  assert.notEqual(draft.keyFor("ABONO_DIRIGIDO", metadata), first);
  const before = draft.keyFor("ABONO_ORDINARIO", metadata);
  assert.notEqual(draft.keyFor("ABONO_ORDINARIO", { ...metadata, naturaleza: "CORRECCION_CONTABLE" }), before);
});

test("E1 all three activation gates stay closed", () => {
  assert.equal(helpers.CREDIT_CASH_CAPTURE_ENABLED, false);
  assert.equal(helpers.CREDIT_PENDING_RECEIPTS_ENABLED, false);
  assert.equal(helpers.CREDIT_ATTRIBUTION_ENABLED, false);
  assert.match(helpers.creditEvidenceProblem(metadata, "EFECTIVO")!, /deshabilitada/);
});

test("E1 site and nature are explicit, without inherited defaults", () => {
  assert.ok(helpers.creditEvidenceProblem({ naturaleza: "INGRESO_FISICO" }, "TRANSFERENCIA"));
  assert.ok(helpers.creditEvidenceProblem({ sitioOrigenId: 3 }, "TRANSFERENCIA"));
  assert.equal(helpers.creditEvidenceProblem(metadata, "TRANSFERENCIA"), null);
});

test("E1 correction requires its own justification, never a cash session", () => {
  const correction = { ...metadata, naturaleza: "CORRECCION_CONTABLE" as const };
  assert.ok(helpers.creditEvidenceProblem(correction, "EFECTIVO"));
  assert.equal(helpers.creditEvidenceProblem({ ...correction, origenJustificacion: "Recaptura documentada, no entró efectivo" }, "EFECTIVO"), null);
  assert.ok(helpers.creditEvidenceProblem({ ...correction, origenJustificacion: "Recaptura documentada", sesionCajaId: 8 }, "EFECTIVO"));
  assert.ok(helpers.creditEvidenceProblem({ ...metadata, sesionCajaId: 8 }, "TRANSFERENCIA"));
});

test("E1 directed approval copies only original metadata and UUID, not credentials", () => {
  const input = { ...metadata, password: "never-persist", adminPassword: "never-persist", sessionToken: "never-persist", motivo: "not metadata" };
  assert.deepEqual(plain(helpers.pickCreditEvidence(input)), {
    ...metadata, sesionCajaId: null, notaOrigenId: null, origenJustificacion: null,
  });
  assert.throws(() => helpers.pickCreditEvidence({ sitioOrigenId: 3 }));
});

test("E1 attribution preparation preserves exact timestamp, full identity and predecessor", () => {
  const movement: CreditMovementEvidence = {
    movimientoId: 9, movimientoCreatedAt: "2026-09-15 12:13:14.123456+00",
    identidadSnapshot: { cliente_id: 2, tipo: "REVERSO", importe: 125, ticket_id: 6, movimiento_origen_id: 5 },
    naturalezaOriginal: null, sitioOrigenOriginalId: null, sitioDeterminadoId: null, sitioEtiqueta: "Sin sitio determinado",
    ultimaAtribucion: {
      id: uuid, movimientoId: 9, movimientoCreatedAt: "2026-09-15 12:13:14.123456+00",
      identidadSnapshot: { cliente_id: 2, tipo: "REVERSO", importe: 125, ticket_id: 6, movimiento_origen_id: 5 },
      anteriorId: null, sitioOrigenId: 3, evidencia: "Documento anterior", motivo: "Motivo anterior", usuarioId: 1, createdAt: "2026-09-16 00:00:00+00",
    },
  };
  const prepared = helpers.prepareCreditAttribution(movement, uuid, 4, " Documento nuevo ", " Rectificación ");
  assert.equal(prepared.movimientoCreatedAt, movement.movimientoCreatedAt);
  assert.deepEqual(plain(prepared.identidadSnapshot), movement.identidadSnapshot);
  assert.equal(prepared.anteriorId, uuid);
  assert.equal(prepared.evidencia, "Documento nuevo");
  assert.equal(prepared.motivo, "Rectificación");
  assert.equal(helpers.prepareCreditAttribution({ ...movement, ultimaAtribucion: null }, uuid, 3, "Documento", "Motivo").anteriorId, null);
  assert.equal(movement.sitioOrigenOriginalId, null);
});