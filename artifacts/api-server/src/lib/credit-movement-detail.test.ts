import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  buildProjectedAllocationRows,
  buildHistoricalEvidenceRows,
  buildCreditMovementDetailFromReadFixture,
  buildCreditMovementDetailReadQueries,
  auditMatchesMovement,
  type CreditMovementDetailMovement,
} from "./credit-movement-detail";
import { buildCustomerCreditLedgerReadQuery } from "./credit-aging-read-model";
import {
  projectCreditLedger,
  type CreditLedgerMovement,
} from "./credit-allocation";

const sale: CreditLedgerMovement = {
  id: 101,
  ticketId: 9001,
  folio: 1005,
  tipo: "VENTA_CREDITO",
  importe: "100.00",
  createdAt: new Date("2026-09-14T15:00:00.000Z"),
};

test("detail allocation rows use the canonical projected before/after values", () => {
  const payment: CreditLedgerMovement = {
    id: 102,
    ticketId: null,
    tipo: "ABONO",
    importe: "-60.00",
    createdAt: new Date("2026-09-15T15:00:00.000Z"),
  };
  const projection = projectCreditLedger([sale, payment], {
    includeMovementProjections: true,
    includeAllocationTraces: true,
  });
  const prefix = projection.movementProjections.find(
    (movement) => movement.movementId === payment.id,
  );
  assert.ok(prefix?.allocations);
  assert.deepEqual(
    buildProjectedAllocationRows(
      prefix.allocations.filter((allocation) => allocation.sourceId === payment.id),
      projection.allCharges,
      true,
    ),
    [{
      ticketId: 9001,
      folio: 1005,
      movimientoVentaId: 101,
      importeAplicado: "60.00",
      saldoAntes: "100.00",
      saldoDespues: "40.00",
      vigente: true,
    }],
  );
});

test("reversed ABONO exposes immutable evidence, not a recomputed prefix balance", () => {
  const payment: CreditLedgerMovement = {
    id: 102,
    ticketId: null,
    tipo: "ABONO",
    importe: "-60.00",
    createdAt: new Date("2026-09-15T15:00:00.000Z"),
  };
  const reversal: CreditLedgerMovement = {
    id: 103,
    ticketId: null,
    movimientoOrigenId: payment.id,
    tipo: "REVERSO",
    importe: "60.00",
    createdAt: new Date("2026-09-16T15:00:00.000Z"),
  };
  const projection = projectCreditLedger([sale, payment, reversal], {
    includeMovementProjections: true,
    includeAllocationTraces: true,
  });
  assert.deepEqual(
    projection.allocations.filter((allocation) => allocation.sourceId === payment.id),
    [],
  );
  assert.deepEqual(
    buildHistoricalEvidenceRows([{
      abonoMovimientoId: payment.id,
      ticketId: sale.ticketId,
      folio: sale.folio ?? null,
      movimientoVentaId: sale.id,
      aplicado: "60.00",
      importeOriginal: sale.importe.toString(),
      fechaVencimiento: null,
    }]),
    [{
      ticketId: 9001,
      folio: 1005,
      movimientoVentaId: 101,
      importeAplicado: "60.00",
      saldoAntes: null,
      saldoDespues: null,
      vigente: false,
    }],
  );
});

test("reversed ABONO uses stored audit before/after only when it matches immutable evidence", () => {
  const movement: CreditMovementDetailMovement = {
    id: 20,
    clienteId: 7,
    clienteNombre: "Cliente 7",
    tipo: "ABONO",
    importe: "-60.00",
    fechaEfectiva: new Date("2026-09-15T15:00:00.000Z"),
    formaPago: null,
    cuentaDestino: null,
    referencia: null,
    notas: null,
    usuarioRegistrador: "Caja",
    ticketId: null,
    ticketFolio: null,
    movimientoOriginalId: null,
    movimientoOriginalTipo: null,
    reversoMovimientoId: 21,
    motivoReverso: "Corrección",
  };
  const projection = projectCreditLedger([sale], {
    includeMovementProjections: true,
    includeAllocationTraces: true,
  });
  const detail = buildCreditMovementDetailFromReadFixture({
    movement,
    projection,
    applications: [{
      abonoMovimientoId: 20,
      ticketId: sale.ticketId,
      folio: sale.folio ?? null,
      movimientoVentaId: sale.id,
      aplicado: "60.00",
      importeOriginal: sale.importe.toString(),
      fechaVencimiento: null,
    }],
    audits: [{
      id: 90,
      accion: "PAGO_CLIENTE",
      fecha: new Date("2026-09-15T15:01:00.000Z"),
      entidad: "clientes",
      entidadId: "7",
      usuario: "Caja",
      datosAntes: null,
      datosDespues: {
        movimientoCreditoId: 20,
        movimiento: {
          id: 20,
          clienteId: 7,
          tipo: "ABONO",
          createdAt: "2026-09-15T15:00:00.000Z",
          importe: "-60.00",
        },
        importe: "60.00",
        asignaciones: [{
          movimientoVentaId: sale.id,
          aplicado: "60.00",
          saldoAntes: "100.00",
          saldoDespues: "40.00",
        }],
      },
    }],
  });
  assert.deepEqual(detail?.reparto, [{
    ticketId: 9001,
    folio: 1005,
    movimientoVentaId: 101,
    importeAplicado: "60.00",
    saldoAntes: "100.00",
    saldoDespues: "40.00",
    vigente: false,
  }]);
});

test("REVERSO links original capture evidence only through the original snapshot", () => {
  const projection = projectCreditLedger([sale], {
    includeMovementProjections: true,
    includeAllocationTraces: true,
  });
  const detail = buildCreditMovementDetailFromReadFixture({
    movement: {
      id: 21,
      clienteId: 7,
      clienteNombre: "Cliente 7",
      tipo: "REVERSO",
      importe: "60.00",
      fechaEfectiva: new Date("2026-09-16T15:00:00.000Z"),
      formaPago: null,
      cuentaDestino: null,
      referencia: null,
      notas: "Corrección",
      usuarioRegistrador: "Caja",
      ticketId: null,
      ticketFolio: null,
      movimientoOriginalId: 20,
      movimientoOriginalTipo: "ABONO",
      movimientoOriginalImporte: "-60.00",
      movimientoOriginalFechaEfectiva: new Date("2026-09-15T15:00:00.000Z"),
      reversoMovimientoId: null,
      motivoReverso: "Corrección",
    },
    projection,
    applications: [{
      abonoMovimientoId: 20,
      ticketId: sale.ticketId,
      folio: sale.folio ?? null,
      movimientoVentaId: sale.id,
      aplicado: "60.00",
      importeOriginal: sale.importe.toString(),
      fechaVencimiento: null,
    }],
    audits: [{
      id: 91,
      accion: "PAGO_CLIENTE",
      fecha: new Date("2026-09-15T15:01:00.000Z"),
      entidad: "clientes",
      entidadId: "7",
      usuario: "Caja",
      datosAntes: null,
      datosDespues: {
        movimientoCreditoId: 20,
        importe: "60.00",
        movimiento: {
          id: 20,
          clienteId: 7,
          tipo: "ABONO",
          createdAt: "2026-09-15T15:00:00.000Z",
          importe: "-60.00",
        },
        asignaciones: [{
          movimientoVentaId: sale.id,
          aplicado: "60.00",
          saldoAntes: "100.00",
          saldoDespues: "40.00",
        }],
      },
    }],
  });
  assert.deepEqual(detail?.aplicacionesRevertidas, [{
    ticketId: 9001,
    folio: 1005,
    movimientoVentaId: 101,
    importeAplicado: "60.00",
    saldoAntes: "100.00",
    saldoDespues: "40.00",
    vigente: false,
  }]);
  assert.equal(detail?.fechaCaptura, null);
  assert.equal("auditoria" in (detail ?? {}), false);
});

test("the pure read-fixture builder keeps active canonical reparto and inactive evidence separate", () => {
  const payment: CreditLedgerMovement = {
    id: 102,
    ticketId: null,
    tipo: "ABONO",
    importe: "-60.00",
    createdAt: new Date("2026-09-15T15:00:00.000Z"),
  };
  const projection = projectCreditLedger([sale, payment], {
    includeMovementProjections: true,
    includeAllocationTraces: true,
  });
  const detail = buildCreditMovementDetailFromReadFixture({
    movement: {
      id: payment.id,
      clienteId: 7,
      clienteNombre: "Archive fixture",
      tipo: "ABONO",
      importe: payment.importe.toString(),
      fechaEfectiva: payment.createdAt,
      formaPago: null,
      cuentaDestino: null,
      referencia: null,
      notas: null,
      usuarioRegistrador: "fixture",
      ticketId: null,
      ticketFolio: null,
      movimientoOriginalId: null,
      movimientoOriginalTipo: null,
      reversoMovimientoId: null,
      motivoReverso: null,
    },
    projection,
    applications: [],
    audits: [],
  });
  assert.deepEqual((detail?.reparto as Array<Record<string, unknown>>)[0], {
    ticketId: 9001,
    folio: 1005,
    movimientoVentaId: 101,
    importeAplicado: "60.00",
    saldoAntes: "100.00",
    saldoDespues: "40.00",
    vigente: true,
  });
});

test("the real archived client-7 case keeps recapture 50 separate from reversal 48", () => {
  const archive = JSON.parse(readFileSync(
    new URL("../../../../reports/prompt-f/historical-credit-cases.json", import.meta.url),
    "utf8",
  )) as {
    canonicalInputLedger: {
      clientId: number;
      clientName: string;
      movements: Array<{
        id: number;
        clientId: number;
        clientName: string;
        type: CreditLedgerMovement["tipo"];
        amount: string;
        createdAt: string;
        reference: string | null;
        ticketId: number | null;
        dueDate: string | null;
        originMovementId: number | null;
      }>;
      applications: Array<{
        id: number;
        abonoMovementId: number;
        ventaMovementId: number;
        amount: string;
        createdAt: string;
      }>;
      linkedTickets: Array<{
        id: number;
        folio: number;
        total: string;
        dueDate: string;
      }>;
    };
    historicalCases: Array<{ movements?: Array<{ id: number }> }>;
  };
  const source = archive.canonicalInputLedger;
  const ticket = new Map(source.linkedTickets.map((row) => [row.id, row]));
  const ledger = source.movements.map((row): CreditLedgerMovement => ({
    id: row.id,
    ticketId: row.ticketId,
    tipo: row.type,
    importe: row.amount,
    createdAt: new Date(row.createdAt),
    fechaVencimiento: row.dueDate,
    folio: row.ticketId == null ? null : ticket.get(row.ticketId)?.folio ?? null,
    movimientoOrigenId: row.originMovementId,
  }));
  const projection = projectCreditLedger(ledger, {
    includeMovementProjections: true,
    includeAllocationTraces: true,
  });
  const recapture = source.movements.find((row) => row.id === 50)!;
  const recaptureDetail = buildCreditMovementDetailFromReadFixture({
    movement: {
      id: recapture.id,
      clienteId: source.clientId,
      clienteNombre: source.clientName,
      tipo: "ABONO",
      importe: recapture.amount,
      fechaEfectiva: recapture.createdAt,
      formaPago: null,
      cuentaDestino: null,
      referencia: recapture.reference,
      notas: null,
      usuarioRegistrador: "",
      ticketId: null,
      ticketFolio: null,
      movimientoOriginalId: null,
      movimientoOriginalTipo: null,
      reversoMovimientoId: null,
      motivoReverso: null,
    },
    projection,
    applications: source.applications
      .filter((row) => row.abonoMovementId === 50)
      .map((row) => ({
        abonoMovimientoId: row.abonoMovementId,
        ticketId: 105,
        folio: 1005,
        movimientoVentaId: row.ventaMovementId,
        aplicado: row.amount,
        importeOriginal: "22022.00",
        fechaVencimiento: "2026-10-15",
      })),
    audits: [],
  });
  assert.deepEqual(recaptureDetail?.reparto, [{
    ticketId: 105,
    folio: 1005,
    movimientoVentaId: 44,
    importeAplicado: "15000.00",
    saldoAntes: "22022.00",
    saldoDespues: "7022.00",
    vigente: true,
  }]);
  const reversal = source.movements.find((row) => row.id === 48)!;
  const reversalDetail = buildCreditMovementDetailFromReadFixture({
    movement: {
      id: reversal.id,
      clienteId: source.clientId,
      clienteNombre: source.clientName,
      tipo: "REVERSO",
      importe: reversal.amount,
      fechaEfectiva: reversal.createdAt,
      formaPago: null,
      cuentaDestino: null,
      referencia: reversal.reference,
      notas: "Archived reversal",
      usuarioRegistrador: "",
      ticketId: null,
      ticketFolio: null,
      movimientoOriginalId: reversal.originMovementId,
      movimientoOriginalTipo: "ABONO",
      reversoMovimientoId: null,
      motivoReverso: null,
    },
    projection,
    applications: source.applications.map((row) => ({
      abonoMovimientoId: row.abonoMovementId,
      ticketId: 105,
      folio: 1005,
      movimientoVentaId: row.ventaMovementId,
      aplicado: row.amount,
      importeOriginal: "22022.00",
      fechaVencimiento: "2026-10-15",
    })),
    audits: [],
  });
  assert.deepEqual(reversalDetail?.aplicacionesRevertidas, []);
  assert.equal("reparto" in (reversalDetail ?? {}), false);
  assert.equal(reversalDetail?.fechaCaptura, null);
  assert.equal("auditoria" in (reversalDetail ?? {}), false);
  assert.equal(
    projection.allocations.some((allocation) => allocation.sourceId === 45),
    false,
  );
  assert.deepEqual(
    projection.allCharges.map((charge) => charge.movimientoId),
    [44],
  );
  assert.equal(
    archive.historicalCases[1]?.movements?.some((row) => row.id === 40),
    true,
  );
  assert.equal(
    projection.allCharges.some((charge) => charge.movimientoId === 40),
    false,
  );
});

test("readonly SQL probe report matches the exact exported query builders", () => {
  const report = JSON.parse(readFileSync(
    new URL("../../../../reports/prompt-f/detail-query-probes.json", import.meta.url),
    "utf8",
  )) as {
    cases: Array<{
      clientId: number;
      movementId: number;
      sourceIdsAfterMovementRead: number[];
      queries: Array<{
        name: string;
        parameters: unknown[];
        sql: string;
      }>;
    }>;
  };
  for (const probeCase of report.cases) {
    const detailQueries = buildCreditMovementDetailReadQueries(
      probeCase.clientId,
      probeCase.movementId,
      probeCase.sourceIdsAfterMovementRead,
    );
    const expected = [
      ...detailQueries,
      {
        name: "ledger",
        ...buildCustomerCreditLedgerReadQuery(probeCase.clientId),
      },
    ];
    const actual = probeCase.queries
      .map((query) => ({
        name: query.name,
        text: query.sql,
        values: query.parameters,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
    expected.sort((left, right) => left.name.localeCompare(right.name));
    assert.deepEqual(actual, expected);
  }
});

test("positive and negative AJUSTE stay in the canonical ledger without a payment reparto", () => {
  const positiveAdjustment: CreditLedgerMovement = {
    id: 104,
    ticketId: null,
    tipo: "AJUSTE",
    importe: "25.00",
    createdAt: new Date("2026-09-17T15:00:00.000Z"),
  };
  const negativeAdjustment: CreditLedgerMovement = {
    id: 105,
    ticketId: null,
    tipo: "AJUSTE",
    importe: "-10.00",
    createdAt: new Date("2026-09-18T15:00:00.000Z"),
  };
  const projection = projectCreditLedger([
    positiveAdjustment,
    negativeAdjustment,
  ]);
  assert.equal(projection.allocations.length, 1);
  assert.equal(projection.allocations[0]?.sourceId, 105);
  assert.equal(projection.allCharges[0]?.movimientoId, 104);
  assert.equal(projection.allCharges[0]?.pendienteCents, 1500);
});

test("audit identity rejects an entity-id-only collision", () => {
  const movement = {
    id: 102,
    clienteId: 7,
    tipo: "ABONO" as const,
    importe: "-60.00",
    fechaEfectiva: new Date("2026-09-15T15:00:00.000Z"),
  };
  const valid = {
    id: "500",
    accion: "PAGO_CLIENTE",
    fecha: new Date("2026-09-15T16:00:00.000Z"),
    entidad: "clientes",
    entidadId: "7",
    usuario: "Caja",
    datosAntes: null,
    datosDespues: {
      movimientoCreditoId: 102,
      importe: "60.00",
      movimiento: {
        id: 102,
        clienteId: 7,
        tipo: "ABONO",
        createdAt: "2026-09-15T15:00:00.000Z",
        importe: "-60.00",
      },
    },
  };
  assert.equal(auditMatchesMovement(valid, movement), true);
  assert.equal(
    auditMatchesMovement(
      {
        ...valid,
        datosDespues: {
          movimientoCreditoId: 999,
          importe: "60.00",
          movimiento: {
            id: 102,
            clienteId: 7,
            tipo: "ABONO",
            createdAt: "2026-09-15T15:00:00.000Z",
            importe: "-60.00",
          },
        },
      },
      movement,
    ),
    false,
  );
  assert.equal(
    auditMatchesMovement(
      { ...valid, entidadId: "8" },
      movement,
    ),
    false,
  );
  assert.equal(
    auditMatchesMovement(
      {
        ...valid,
        datosDespues: {
          movimientoCreditoId: 102,
          importe: "61.00",
          movimiento: {
            id: 102,
            clienteId: 7,
            tipo: "ABONO",
            createdAt: "2026-09-15T15:00:00.000Z",
            importe: "-61.00",
          },
        },
      },
      movement,
    ),
    false,
  );
  assert.equal(
    auditMatchesMovement(
      {
        ...valid,
        datosDespues: { movimientoCreditoId: 102, importe: "60.00" },
      },
      movement,
    ),
    false,
  );
});

test("REVERSAR_PAGO_CLIENTE requires the new reverse snapshot, not referenced original metadata", () => {
  const reversal = {
    id: 200,
    clienteId: 7,
    tipo: "REVERSO" as const,
    importe: "60.00",
    fechaEfectiva: new Date("2026-01-01T10:00:00.000Z"),
  };
  const productionPayloadWithoutIdentity = {
    id: "900",
    accion: "REVERSAR_PAGO_CLIENTE",
    fecha: new Date("2026-02-01T10:00:00.000Z"),
    entidad: "movimientos_credito",
    entidadId: "200",
    usuario: "Caja",
    datosAntes: {
      pagoId: 45,
      importe: "-60.00",
      movimiento: {
        id: 45,
        clienteId: 7,
        tipo: "ABONO",
        createdAt: "2025-12-01T10:00:00.000Z",
        importe: "-60.00",
      },
    },
    datosDespues: {
      reversoId: 200,
      importe: "60.00",
      motivo: "Captura incorrecta",
    },
  };
  assert.equal(
    auditMatchesMovement(productionPayloadWithoutIdentity, reversal),
    false,
  );
  assert.equal(
    auditMatchesMovement(
      {
        ...productionPayloadWithoutIdentity,
        datosDespues: {
          ...productionPayloadWithoutIdentity.datosDespues,
          movimiento: {
            id: 200,
            clienteId: 7,
            tipo: "REVERSO",
            createdAt: "2026-01-01T10:00:00.000Z",
            importe: "60.00",
          },
        },
      },
      reversal,
    ),
    true,
  );
  assert.equal(
    auditMatchesMovement(
      {
        ...productionPayloadWithoutIdentity,
        datosDespues: {
          ...productionPayloadWithoutIdentity.datosDespues,
          movimiento: {
            id: 45,
            clienteId: 7,
            tipo: "ABONO",
            createdAt: "2025-12-01T10:00:00.000Z",
            importe: "-60.00",
          },
        },
      },
      reversal,
    ),
    false,
  );
});
