import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { pool } from "@workspace/db";
import {
  aggregateLedgerEvidence,
  buildEvidenceReconciliation,
  buildQueComprarReport,
  buildQueComprarRow,
  getQueComprarEvidence,
  HISTORY_MIN_MONTHS,
  monthKey,
  monthSeries,
  splitEpisodesByRequestedPeriod,
  type DomainReportContext,
  type QueComprarMovement,
} from "./reportes-que-comprar";

const product = {
  productoId: 10,
  ubicacionId: 20,
  sku: "A-ROJO",
  tela: "Lino",
  color: "Rojo",
  unidad: "METRO",
  sitio: "Norte",
  existenciaActual: 8,
  minimoCapturado: 10,
};

function movement(
  id: number,
  date: string,
  type: string,
  quantity: number,
  movementOriginId: number | null = null,
  documentType: string | null = "TICKET",
  documentId: string | null = String(id),
): QueComprarMovement {
  return {
    id,
    productoId: product.productoId,
    ubicacionId: product.ubicacionId,
    date,
    type,
    quantity,
    documentType,
    documentId,
    movementOriginId,
  };
}

test("history threshold uses elapsed observed months and leaves pre-observation buckets null", () => {
  assert.equal(HISTORY_MIN_MONTHS, 3);
  const months = monthSeries("2026-04-30");
  const row = buildQueComprarRow({
    productSite: product,
    movements: [
      movement(1, "2026-01-31T12:00:00.000Z", "VENTA", -2),
      movement(2, "2026-04-29T12:00:00.000Z", "VENTA", -2),
    ],
    months,
    end: new Date("2026-04-30T23:59:59.999Z"),
  });
  assert.equal(row.mesesHistoria, 2, "Jan 31 through Apr 30 is two full elapsed months");
  assert.equal(row.sugerencia, "Sin información suficiente; cuenta con 2 meses de historia.");
  assert.equal(row.consumoMes01, null);
  assert.equal(row.consumoMes12, 2);
  assert.notEqual(row.coberturaDiasExistencia, row.coberturaDiasMinimo);
  assert.equal(row.deficitMinimoObservado, 2);
});

test("consumption separates customer sales from physical and transfer exits without duplication", () => {
  const result = aggregateLedgerEvidence([
    movement(1, "2026-01-05T12:00:00.000Z", "VENTA", -2),
    movement(2, "2026-01-06T12:00:00.000Z", "SALIDA_MOSTRADOR", -3, null, "SALIDA", "22"),
    movement(3, "2026-01-07T12:00:00.000Z", "TRANSFERENCIA_SALIDA", -4, null, null, null),
  ]);
  assert.equal(result.consumptionQuantity, 9);
  assert.equal(result.saleMovements.length, 1);
  assert.equal(result.consumptionMovements.length, 3);
});

test("cancelled sale movement and its cancellation are excluded from both facts", () => {
  const result = aggregateLedgerEvidence([
    movement(1, "2026-01-05T12:00:00.000Z", "VENTA", -7),
    movement(2, "2026-01-06T12:00:00.000Z", "CANCELACION", 7, 1),
    movement(3, "2026-01-07T12:00:00.000Z", "VENTA", -2),
  ]);
  assert.equal(result.consumptionQuantity, 2);
  assert.deepEqual(result.consumptionMovements.map((item) => item.id), [3]);
});

test("evidence reconciliation is explicit for enabled pairs and empty for disabled pairs", () => {
  const movements = [
    movement(1, "2026-01-05T12:00:00.000Z", "VENTA", -2),
    movement(2, "2026-01-06T12:00:00.000Z", "TRANSFERENCIA_SALIDA", -4),
  ];
  const enabled = buildEvidenceReconciliation(true, movements);
  assert.deepEqual(enabled.movementIds, [1, 2]);
  assert.equal(enabled.consumptionQuantity, 6);
  assert.equal(enabled.matches, true);
  const disabled = buildEvidenceReconciliation(false, movements);
  assert.deepEqual(disabled.movementIds, []);
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.consumptionQuantity, 0);
});

test("incoming receipt establishes history and permits a valid no-movement observation", () => {
  const end = new Date("2026-04-30T23:59:59.999Z");
  const row = buildQueComprarRow({
    productSite: product,
    movements: [
      movement(1, "2025-01-15T12:00:00.000Z", "RECEPCION", 10, null, "ENTRADA", "receipt-1"),
    ],
    months: monthSeries(end),
    end,
  });
  assert.ok(Number(row.mesesHistoria) >= 15);
  assert.equal(row.consumoPromedioDiario, 0);
  assert.equal(row.noMovimiento, true);
  assert.match(String(row.sugerencia), /no se ha movido/);
  assert.equal(row.ventaRealCliente, 0);
});

test("elapsed history uses local month boundaries, not UTC buckets", () => {
  const movementDate = "2026-02-01T05:30:00.000Z";
  // The UTC timestamp belongs to February, but the inventory observation is
  // January 31 at 23:30 in Mexico City.
  assert.equal(monthKey(movementDate), "2026-01");
  const beforeLocalMonthBoundary = buildQueComprarRow({
    productSite: product,
    movements: [
      movement(1, movementDate, "RECEPCION", 10, null, "ENTRADA", "receipt-1"),
    ],
    months: monthSeries("2026-04-30T05:59:59.999Z"),
    // April 30 23:59:59 local: still before the May 1 local boundary.
    end: new Date("2026-05-01T05:59:59.999Z"),
  });
  assert.equal(beforeLocalMonthBoundary.mesesHistoria, 2);

  const atLocalMonthBoundary = buildQueComprarRow({
    productSite: product,
    movements: [
      movement(1, movementDate, "RECEPCION", 10, null, "ENTRADA", "receipt-1"),
    ],
    months: monthSeries("2026-05-01T06:00:00.000Z"),
    // May 1 00:00 local: the third calendar month boundary has elapsed.
    end: new Date("2026-05-01T06:00:00.000Z"),
  });
  assert.equal(atLocalMonthBoundary.mesesHistoria, 3);
});

test("customer sale requires the POS document evidence and cancellation removes it", () => {
  const result = aggregateLedgerEvidence([
    movement(1, "2026-01-05T12:00:00.000Z", "VENTA", -2, null, null, null),
    movement(2, "2026-01-06T12:00:00.000Z", "VENTA", -3, null, "NOTA", "ticket-2"),
    movement(3, "2026-01-07T12:00:00.000Z", "VENTA", -4, null, "TICKET_BOLSA_METREADO", "ticket-3"),
    movement(4, "2026-01-08T12:00:00.000Z", "CANCELACION", 3, 2, null, null),
    movement(5, "2026-01-09T12:00:00.000Z", "SALIDA_MOSTRADOR", -5, null, "SALIDA", "salida-5"),
  ]);
  assert.deepEqual(result.consumptionMovements.map((item) => item.id), [1, 3, 5]);
  assert.deepEqual(result.saleMovements.map((item) => item.id), [3]);
});

test("evidence reconciliation independently detects a tampered monthly row", () => {
  const end = new Date("2026-04-30T23:59:59.999Z");
  const months = monthSeries(end);
  const movements = [
    movement(1, "2025-12-01T12:00:00.000Z", "RECEPCION", 10, null, "ENTRADA", "receipt-1"),
    movement(2, "2026-01-05T12:00:00.000Z", "VENTA", -2),
    movement(3, "2026-02-05T12:00:00.000Z", "TRANSFERENCIA_SALIDA", -4, null, null, null),
  ];
  const episodes = [{
    id: 1,
    productoId: product.productoId,
    ubicacionId: product.ubicacionId,
    minimum: 10,
    existence: 8,
    difference: 2,
    openedAt: "2026-03-01T12:00:00.000Z",
    closedAt: null,
    movementId: null,
  }];
  const row = buildQueComprarRow({ productSite: product, movements, episodes, months, end });
  const good = buildEvidenceReconciliation(true, movements, { row, episodes, months, end });
  assert.equal(good.matches, true);
  const tampered = { ...row, consumoMes09: Number(row.consumoMes09 ?? 0) + 1 };
  const bad = buildEvidenceReconciliation(true, movements, { row: tampered, episodes, months, end });
  assert.equal(bad.matches, false);
  assert.equal(bad.monthlyQuantitiesMatch, false);
});

test("an episode opened before the period is carried context, not a current-period opening", () => {
  const desde = new Date("2026-02-01T06:00:00.000Z");
  const hasta = new Date("2026-02-28T05:59:59.999Z");
  const episodes = [
    {
      id: 1,
      productoId: product.productoId,
      ubicacionId: product.ubicacionId,
      minimum: 10,
      existence: 8,
      difference: 2,
      openedAt: "2026-01-15T12:00:00.000Z",
      closedAt: null,
    },
    {
      id: 2,
      productoId: product.productoId,
      ubicacionId: product.ubicacionId,
      minimum: 10,
      existence: 7,
      difference: 3,
      openedAt: "2026-02-10T12:00:00.000Z",
      closedAt: null,
    },
  ];
  const split = splitEpisodesByRequestedPeriod(episodes, desde, hasta);
  assert.deepEqual(split.period.map((episode) => episode.id), [2]);
  assert.deepEqual(split.carried.map((episode) => episode.id), [1]);
  assert.equal(split.carried[0]?.carriedIntoPeriod, true);
  const row = buildQueComprarRow({
    productSite: product,
    movements: [movement(10, "2026-01-10T12:00:00.000Z", "RECEPCION", 10, null, "ENTRADA", "receipt-10")],
    episodes: split.period,
    months: monthSeries(hasta),
    end: hasta,
  });
  assert.equal(row.episodiosBajoMinimo, 1);
});

test("report and evidence rebuild the same historical row before the selected episode period", async () => {
  const movements = [
    {
      id: 1,
      producto_id: 10,
      ubicacion_id: 20,
      created_at: "2026-01-10T12:00:00.000Z",
      tipo: "RECEPCION",
      cantidad: 10,
      documento_tipo: "ENTRADA",
      documento_id: "receipt-1",
      movimiento_origen_id: null,
      sku: "A-ROJO",
      tela: "Lino",
      color: "Rojo",
      unidad: "METRO",
      sitio: "Norte",
    },
    {
      id: 2,
      producto_id: 10,
      ubicacion_id: 20,
      created_at: "2026-01-20T12:00:00.000Z",
      tipo: "VENTA",
      cantidad: -2,
      documento_tipo: "TICKET",
      documento_id: "ticket-1",
      movimiento_origen_id: null,
      sku: "A-ROJO",
      tela: "Lino",
      color: "Rojo",
      unidad: "METRO",
      sitio: "Norte",
    },
    {
      id: 3,
      producto_id: 10,
      ubicacion_id: 20,
      created_at: "2026-03-20T12:00:00.000Z",
      tipo: "VENTA",
      cantidad: -3,
      documento_tipo: "TICKET",
      documento_id: "ticket-2",
      movimiento_origen_id: null,
      sku: "A-ROJO",
      tela: "Lino",
      color: "Rojo",
      unidad: "METRO",
      sitio: "Norte",
    },
  ];
  const desde = new Date("2026-02-01T06:00:00.000Z");
  const hasta = new Date("2026-04-30T05:59:59.999Z");
  const context: DomainReportContext = {
    input: {},
    locations: [20],
    range: {
      desde,
      hasta,
      previousDesde: desde,
      previousHasta: hasta,
      yearAgoDesde: desde,
      yearAgoHasta: hasta,
    },
  };
  const queryMock = mock.method(pool, "query", async (text: string, values: unknown[] = []) => {
    if (text.trimStart().startsWith("SELECT ss.ubicacion_id,u.nombre")) {
      return { rows: [{ ubicacion_id: 20, nombre: "Norte" }] };
    }
    if (text.includes("SELECT e.producto_id")) {
      return {
        rows: [{
          producto_id: 10,
          ubicacion_id: 20,
          sku: "A-ROJO",
          tela: "Lino",
          color: "Rojo",
          unidad: "METRO",
          sitio: "Norte",
          existencia: 8,
        }],
      };
    }
    if (text.includes("SELECT sm.producto_id")) {
      return {
        rows: [{
          producto_id: 10,
          ubicacion_id: 20,
          minimo: 10,
          sku: "A-ROJO",
          tela: "Lino",
          color: "Rojo",
          unidad: "METRO",
          sitio: "Norte",
        }],
      };
    }
    if (text.includes("SELECT m.id,m.producto_id")) return { rows: movements };
    if (text.includes("SELECT se.id,se.producto_id")) return { rows: [] };
    if (text.includes("SELECT p.id producto_id,p.sku")) {
      return {
        rows: [{
          producto_id: 10,
          sku: "A-ROJO",
          tela: "Lino",
          color: "Rojo",
          unidad: "METRO",
          ubicacion_id: 20,
          sitio: "Norte",
          activa: true,
          minimo: 10,
          existencia: 8,
        }],
      };
    }
    if (text.includes("SELECT id,producto_id,ubicacion_id,created_at")) return { rows: movements };
    if (text.includes("SELECT id,producto_id,ubicacion_id,minimo")) return { rows: [] };
    throw new Error(`Unexpected mocked report query: ${text}`);
  });

  try {
    const report = await buildQueComprarReport(context);
    const reportRow = report.tables[0]?.rows[0] as Record<string, unknown> | undefined;
    assert.ok(reportRow);
    const evidence = await getQueComprarEvidence({ productoId: 10, ubicacionId: 20, desde, hasta });
    assert.ok(evidence);
    const evidenceRow = evidence.row as Record<string, unknown>;
    for (const key of [
      "mesesHistoria",
      "periodoConsumoDias",
      "consumoPromedioDiario",
      "ventaRealCliente",
      "coberturaDiasMinimo",
      "coberturaDiasExistencia",
      "episodiosBajoMinimo",
      ...Array.from({ length: 12 }, (_, index) => `consumoMes${String(index + 1).padStart(2, "0")}`),
    ]) {
      assert.deepEqual(evidenceRow[key], reportRow[key], key);
    }
    assert.equal(reportRow.ventaRealCliente, 5, "the sale before desde remains in the shared history");
    assert.equal(evidence.reconciliation.matches, true);
  } finally {
    queryMock.mock.restore();
  }
});