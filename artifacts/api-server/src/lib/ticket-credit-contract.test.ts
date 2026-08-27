import assert from "node:assert/strict";
import test from "node:test";
import { ObtenerTicketResponse } from "@workspace/api-zod";

const ticket = {
  id: 1,
  folio: 1001,
  ubicacionId: 1,
  nombreUbicacion: "Centro",
  usuarioTerminalId: 1,
  nombreUsuarioTerminal: "Caja",
  clienteId: 2,
  nombreCliente: "Cliente",
  subtotal: "200.00",
  iva: "0.00",
  tasaIva: "0.1600",
  total: "200.00",
  estado: "VENDIDO",
  facturado: false,
  uuidCliente: "c73e8cb1-e95d-4ff0-92f9-d75c87b79be6",
  createdAt: "2026-08-30T12:00:00.000Z",
  canceladoAt: null,
  canceladoPor: null,
  nombreUsuarioCancelacion: null,
  motivoCancelacion: null,
  autorizadoPor: null,
  nombreUsuarioAutorizacion: null,
  lineas: [],
  esCredito: true,
  importeCredito: "125.00",
  diasPlazo: 15,
  fechaVencimiento: "2026-09-14",
  saldoPendiente: "50.00",
  telefonoCliente: "5551234567",
  correoCliente: "cliente@example.com",
  direccionCliente: "Calle Uno 20",
};

test("ticket detail contract exposes printable persisted credit data", () => {
  const parsed = ObtenerTicketResponse.parse(ticket);
  assert.equal(parsed.esCredito, true);
  assert.equal(parsed.importeCredito, "125.00");
  assert.equal(parsed.diasPlazo, 15);
  assert.ok(parsed.fechaVencimiento);
  assert.equal(parsed.fechaVencimiento.toISOString().slice(0, 10), "2026-09-14");
  assert.equal(parsed.saldoPendiente, "50.00");
  assert.equal(parsed.telefonoCliente, "5551234567");
  assert.equal(parsed.correoCliente, "cliente@example.com");
  assert.equal(parsed.direccionCliente, "Calle Uno 20");
});

test("ticket detail contract requires every credit-note field", () => {
  const { saldoPendiente: _missing, ...withoutBalance } = ticket;
  assert.equal(ObtenerTicketResponse.safeParse(withoutBalance).success, false);
});