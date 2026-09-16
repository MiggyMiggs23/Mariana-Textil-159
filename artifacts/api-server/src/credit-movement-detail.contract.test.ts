import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { GetClientePagoDetalleResponse } from "@workspace/api-zod";

const legacy = {
  id: 20,
  clienteId: 7,
  fecha: "2026-09-15T15:00:00.000Z",
  montoTotalAbono: "60.00",
  formaPago: null,
  cuentaDestino: null,
  referencia: null,
  usuarioRegistrador: "Caja",
  revertido: false,
  reversoMovimientoId: null,
  motivoReverso: null,
  aplicaciones: [],
};

test("the additive response contract covers ABONO, REVERSO, and AJUSTE", () => {
  const reparto = [{
    ticketId: 9001,
    folio: 1005,
    movimientoVentaId: 101,
    importeAplicado: "60.00",
    saldoAntes: "100.00",
    saldoDespues: "40.00",
    vigente: true,
  }];
  const abono = GetClientePagoDetalleResponse.parse({
    ...legacy,
    tipo: "ABONO",
    importe: "-60.00",
    clienteNombre: "Cliente 7",
    fechaEfectiva: legacy.fecha,
    fechaCaptura: null,
    usuarioCaptura: "Caja",
    notas: null,
    ticketId: null,
    ticketFolio: null,
    movimientoOriginalId: null,
    reparto,
    saldoAFavor: "0.00",
    auditoria: [],
  });
  assert.equal(abono.tipo, "ABONO");
  assert.equal(abono.reparto?.[0]?.saldoDespues, "40.00");

  const reverso = GetClientePagoDetalleResponse.parse({
    ...legacy,
    tipo: "REVERSO",
    importe: "60.00",
    fechaEfectiva: legacy.fecha,
    fechaCaptura: null,
    usuarioCaptura: null,
    notas: "Corrección",
    ticketId: null,
    ticketFolio: null,
    movimientoOriginalId: 20,
    aplicacionesRevertidas: [{
      ...reparto[0],
      saldoAntes: null,
      saldoDespues: null,
      vigente: false,
    }],
  });
  assert.equal(reverso.aplicacionesRevertidas?.[0]?.vigente, false);
  assert.equal("reparto" in reverso, false);
  assert.equal("saldoAFavor" in reverso, false);

  const ajuste = GetClientePagoDetalleResponse.parse({
    ...legacy,
    tipo: "AJUSTE",
    importe: "-10.00",
    fechaEfectiva: legacy.fecha,
    fechaCaptura: null,
    usuarioCaptura: null,
    notas: "Corrección de saldo",
    ticketId: null,
    ticketFolio: null,
    movimientoOriginalId: null,
  });
  assert.equal("reparto" in ajuste, false);
  assert.equal("saldoAFavor" in ajuste, false);
  assert.equal("aplicacionesRevertidas" in ajuste, false);
});

test("the readonly route keeps the finance permission and client/type ownership predicates", async () => {
  const routes = await readFile(
    new URL("./routes/clientes.ts", import.meta.url),
    "utf8",
  );
  const detail = await readFile(
    new URL("./lib/credit-movement-detail.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    routes,
    /router\.get\(\s*["']\/clientes\/:id\/pagos\/:pagoId["'][\s\S]*?requierePermiso\("clientes_finanzas", "ver"\)/,
  );
  assert.match(detail, /WHERE m\.id=\$1 AND m\.cliente_id=\$2/);
  assert.match(detail, /m\.tipo IN \('ABONO','REVERSO','AJUSTE'\)/);
  assert.match(detail, /sale\.cliente_id=\$2/);
  assert.match(
    routes,
    /BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/,
  );
  assert.match(routes, /snapshot\.query\("COMMIT"\)/);
  assert.match(routes, /snapshot\.query\("ROLLBACK"\)/);
});
