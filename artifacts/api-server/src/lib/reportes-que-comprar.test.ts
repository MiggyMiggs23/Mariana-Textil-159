import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateLedgerEvidence,
  buildEvidenceReconciliation,
  buildQueComprarRow,
  HISTORY_MIN_MONTHS,
  monthSeries,
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
): QueComprarMovement {
  return {
    id,
    productoId: product.productoId,
    ubicacionId: product.ubicacionId,
    date,
    type,
    quantity,
    documentType: "TICKET",
    documentId: String(id),
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

test("consumption separates customer channels from transfer-origin exits without ticket duplication", () => {
  const result = aggregateLedgerEvidence([
    movement(1, "2026-01-05T12:00:00.000Z", "VENTA", -2),
    movement(2, "2026-01-06T12:00:00.000Z", "SALIDA_MOSTRADOR", -3),
    movement(3, "2026-01-07T12:00:00.000Z", "TRANSFERENCIA_SALIDA", -4),
  ]);
  assert.equal(result.consumptionQuantity, 9);
  assert.equal(result.saleMovements.length, 2);
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