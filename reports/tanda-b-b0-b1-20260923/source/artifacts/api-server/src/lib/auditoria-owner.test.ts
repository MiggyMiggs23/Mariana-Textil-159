import assert from "node:assert/strict";
import test from "node:test";
import {
  auditMatchesCreditMovementIdentity,
  resolveAuditedCreditMovementOwner,
} from "./auditoria-owner";
import { resolveKardexDocument } from "./kardex-document";

const movement = {
  id: 77,
  clienteId: 42,
  tipo: "REVERSO",
  importe: "60.00",
  createdAt: new Date("2026-09-15T15:00:00.000Z"),
};

const matchingAudit = {
  entidad: "movimientos_credito",
  entidadId: "77",
  fecha: "2026-09-15T16:00:00.000Z",
  datosAntes: null,
  datosDespues: {
    movimiento: {
      clienteId: 42,
      tipo: "REVERSO",
      createdAt: "2026-09-15T15:00:00.000Z",
      importe: "60.00",
    },
  },
};

test("credit movement audit owner requires complete stored identity", () => {
  assert.equal(
    resolveAuditedCreditMovementOwner(matchingAudit, movement),
    42,
  );
  assert.equal(
    resolveAuditedCreditMovementOwner(
      {
        ...matchingAudit,
        datosDespues: { importe: "60.00" },
      },
      movement,
    ),
    null,
  );
});

test("credit movement audit owner rejects a stale or reused movement ID", () => {
  assert.equal(
    resolveAuditedCreditMovementOwner(
      {
        ...matchingAudit,
        datosDespues: {
          movimiento: {
            clienteId: 99,
            tipo: "REVERSO",
            createdAt: "2026-09-15T15:00:00.000Z",
            importe: "60.00",
          },
        },
      },
      movement,
    ),
    null,
  );
  assert.equal(
    resolveAuditedCreditMovementOwner(
      {
        ...matchingAudit,
        fecha: "2026-09-15T14:00:00.000Z",
      },
      movement,
    ),
    null,
  );
  assert.equal(
    resolveAuditedCreditMovementOwner(matchingAudit, null),
    null,
  );
});

test("the historical REVERSAR_PAGO_CLIENTE payload stays unresolved", () => {
  const oldReversalAudit = {
    entidad: "movimientos_credito",
    entidadId: "77",
    fecha: "2026-09-15T16:00:00.000Z",
    datosAntes: {
      pagoId: 76,
      importe: "-60.00",
      asignaciones: [],
    },
    datosDespues: {
      reversoId: 77,
      importe: "60.00",
      motivo: "Captura duplicada",
    },
  };
  assert.equal(
    auditMatchesCreditMovementIdentity(oldReversalAudit, movement),
    false,
  );
  assert.equal(
    resolveAuditedCreditMovementOwner(oldReversalAudit, movement),
    null,
  );
});

test("complete future audit metadata resolves through the shared Kardex route", () => {
  const owner = resolveAuditedCreditMovementOwner(matchingAudit, movement);
  assert.equal(owner, 42);
  const auditDocument = resolveKardexDocument(
    { tipo: "MOVIMIENTO_CREDITO", id: "77" },
    new Map(),
    new Map(),
    new Map(),
    new Map([[77, { clienteId: owner! }]]),
  );
  const rollDocument = resolveKardexDocument(
    { tipo: "MOVIMIENTO_CREDITO", id: "77" },
    new Map(),
    new Map(),
    new Map(),
    new Map([[77, { clienteId: 42 }]]),
  );
  assert.deepEqual(auditDocument, rollDocument);
  assert.equal(auditDocument.route, "/clientes/42/movimientos/77");
});