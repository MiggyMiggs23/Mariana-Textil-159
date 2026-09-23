import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { clientRoutes } from "./tarea3-behavior-harness.mjs";

const root = new URL("../../../", import.meta.url);

async function sources() {
  const [spec, route, ledgerSchema] = await Promise.all([
    readFile(new URL("lib/api-spec/openapi.yaml", root), "utf8"),
    readFile(new URL("artifacts/api-server/src/routes/clientes.ts", root), "utf8"),
    readFile(new URL("lib/db/src/schema/pos.ts", root), "utf8"),
  ]);
  return { spec, route, ledgerSchema };
}

test("contrato de notas de crédito deriva los tres estados sin persistirlos", async () => {
  for (const [cents, legacy, canonical, money] of [
    [10000, "PENDIENTE", "PENDIENTE", "100.00"],
    [7500, "PARCIAL", "ABONO_PARCIAL", "75.00"],
    [0, "PAGADA", "PAGADA", "0.00"],
  ] as const) {
    const route = clientRoutes(cents);
    const response = await route.get("/clientes/:id/notas/:ticketId", { id: "41", ticketId: "52" });
    assert.equal(response.estado, legacy);
    assert.equal(response.estadoNota, canonical);
    assert.equal(response.saldoActual, money);
    assert.equal(response.importeOriginal, "100.00");
    assert.equal(response.movimientoVentaId, 72);
  }
});

test("consultas de detalle usan aplicaciones_credito en ambas direcciones", async () => {
  const route = clientRoutes(7500);
  const note = await route.get("/clientes/:id/notas/:ticketId", { id: "41", ticketId: "52" });
  assert.deepEqual(route.calls, [[41, 52], [72]]);
  assert.equal(note.abonos[0].movimientoPagoId, 81);
  assert.equal(note.abonos[0].montoAplicado, "25.00");
  assert.equal(note.abonos[0].montoTotalAbono, "40.00");
  assert.equal(note.abonos[0].fecha, "2026-01-02T12:00:00.000Z");
  const payment = await route.get("/clientes/:id/pagos/:pagoId", { id: "41", pagoId: "81" });
  assert.deepEqual(payment, route.detail);
  assert.deepEqual(route.calls.slice(2), [{ clienteId: 41, pagoId: 81 }, "release"]);
});

test("antigüedad toma fecha_vencimiento en calendario America/Mexico_City", async () => {
  const { route } = await sources();

  assert.match(
    route,
    /function creditDueDays[\s\S]*?timeZone: "America\/Mexico_City"[\s\S]*?Math\.max\(0, Math\.floor\(difference \/ 86_400_000\)\)/,
  );
  assert.match(route, /m\.fecha_vencimiento AS "fechaVencimiento"/);
});

test("reimpresión audita antes de responder y no actualiza el ledger", async () => {
  const { route } = await sources();
  const start = route.indexOf('"/clientes/:id/notas/:ticketId/reimprimir"');
  const end = route.indexOf('// ── POST /clientes/:id/pagos', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const handler = route.slice(start, end);

  assert.match(handler, /accion: "REIMPRIMIR_NOTA_CREDITO"/);
  assert.match(handler, /entidad: "tickets"/);
  assert.match(handler, /sitioId: Number\(ticket\.sitioId\)/);
  assert.ok(
    handler.indexOf("await db.insert(auditoriaTable)") <
      handler.indexOf("res.status(201).json"),
    "la auditoría debe persistirse antes de contestar",
  );
  assert.doesNotMatch(handler, /\.update\(|UPDATE\s+movimientos_credito/i);
});