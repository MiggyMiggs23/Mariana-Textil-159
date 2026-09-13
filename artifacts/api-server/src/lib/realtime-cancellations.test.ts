import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { pool } from "@workspace/db";
import {
  getRealtimeStores,
  getSalesSummary,
  listRealtimeBreakdown,
} from "./admin-analytics";
import {
  buildRealtimeCancellationReadModel,
  calculateRealtimeCancellationRate,
  realtimeCancellationWindow,
} from "./realtime-cancellations";

test("canonical cancellation read model owns state, event date, location and amount", () => {
  assert.equal(
    buildRealtimeCancellationReadModel("c"),
    `SELECT c.id,c.ubicacion_id,c.cancelado_at,c.total importe
    FROM tickets c
    WHERE c.estado='CANCELADO'
      AND c.cancelado_at IS NOT NULL`,
  );
  assert.match(realtimeCancellationWindow("c"), /c\.cancelado_at >= \$1/);
  assert.match(realtimeCancellationWindow("c"), /c\.cancelado_at <= \$2/);
  assert.match(realtimeCancellationWindow("c"), /c\.ubicacion_id=\$3/);
  assert.equal(calculateRealtimeCancellationRate(0, 0), 0);
  assert.equal(calculateRealtimeCancellationRate(0, 1), 100);
  assert.equal(calculateRealtimeCancellationRate(9, 1), 10);
});

test("dashboard queries invoke the shared cancellation read model", async () => {
  const queries: string[] = [];
  const cancellationAt = new Date("2026-09-08T12:00:00.000Z");
  const queryMock = mock.method(pool, "query", async (text: string) => {
    queries.push(text);
    if (text.includes("SELECT u.id")) {
      return {
        rows: [{
          ubicacionId: 42,
          nombreUbicacion: "Centro",
          sesionCajaId: null,
          abiertaAt: null,
          cajero: null,
          usuarioTerminal: null,
          vendido: "100.00",
          cobrado: "100.00",
          pendiente: "0.00",
          tickets: 0,
          documentosPendientes: 0,
          ticketsCobrados: 0,
          margen: "50.00",
          subtotal: "100.00",
          efectivo: "100.00",
          transferencia: "0.00",
          credito: "0.00",
          creditoOperaciones: 0,
          pendientes30Min: 0,
          cancelaciones: 1,
        }],
      };
    }
    if (text.includes("SELECT t.id,t.folio")) {
      return {
        rows: [{
          id: 7,
          folio: 700,
          hora: cancellationAt,
          cliente: "Público general",
          importe: "90.00",
          documentoTipo: "TICKET",
          facturado: false,
          diasPlazo: null,
          fechaVencimiento: null,
          formas: null,
          nombreUsuarioCancelacion: "Admin",
          canceladoAt: cancellationAt,
          motivoCancelacion: "Prueba",
          minutosEspera: 0,
        }],
      };
    }
    if (text.includes("SELECT COUNT(*)::int total")) {
      return { rows: [{ total: 1, montoTotal: "90.00" }] };
    }
    return {
      rows: [{
        ventas: "100.00",
        cobrado: "100.00",
        pendiente: "0.00",
        subtotal: "100.00",
        iva: "0.00",
        costo: "50.00",
        margen: "50.00",
        tickets: 0,
        ticketsCobrados: 0,
        documentosPendientes: 0,
        cancelaciones: 1,
        importeCancelaciones: "90.00",
        lineasExcluidasMargen: 0,
      }],
    };
  });

  try {
    const filters = {
      desde: new Date("2026-09-08T00:00:00.000Z"),
      hasta: new Date("2026-09-08T23:59:59.999Z"),
      ubicacionId: 42,
    };
    const [summary, stores, breakdown] = await Promise.all([
      getSalesSummary(filters),
      getRealtimeStores(filters),
      listRealtimeBreakdown(filters, "CANCELADAS"),
    ]);

    assert.equal(summary.cancelaciones, 1);
    assert.equal(summary.importeCancelaciones, "90.00");
    assert.equal(stores[0]?.cancelaciones, 1);
    assert.equal(stores[0]?.tasaCancelacion, "100.00");
    assert.equal(breakdown.total, 1);
    assert.equal(breakdown.montoTotal, "90.00");

    const summarySql = queries.find((text) => text.includes('"importeCancelaciones"'));
    const storesSql = queries.find((text) => text.includes("SELECT u.id"));
    const detailSql = queries.find((text) => text.includes("SELECT t.id,t.folio"));
    assert.ok(summarySql?.includes(buildRealtimeCancellationReadModel("c")));
    assert.ok(storesSql?.includes(buildRealtimeCancellationReadModel("c")));
    assert.ok(detailSql?.includes(buildRealtimeCancellationReadModel("cancellation")));
    assert.ok(summarySql?.includes("c.cancelado_at >= $1"));
    assert.ok(storesSql?.includes("c.cancelado_at >= $1"));
    assert.ok(detailSql?.includes("cancellation.cancelado_at >= $1"));
    assert.ok(detailSql?.includes("cancellation.ubicacion_id=$3"));
    assert.ok(detailSql?.includes("cancellation.importe"));
  } finally {
    queryMock.mock.restore();
  }
});