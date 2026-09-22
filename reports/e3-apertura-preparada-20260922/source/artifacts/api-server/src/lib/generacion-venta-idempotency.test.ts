import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { generacionVentaCoincide } from "./salidas";

const ticket = { clienteId: 3, documentoTipo: "NOTA", diasPlazo: 30 };
const persisted = [
  { salidaId: 8, salidaRolloId: 81, rolloId: 801, lineaRolloId: 801, precioUnitario: "19.50" },
  { salidaId: 9, salidaRolloId: 91, rolloId: 901, lineaRolloId: 901, precioUnitario: "21.00" },
];
const request = {
  salidaIds: [9, 8], clienteId: 3, documentoTipo: "NOTA" as const, diasPlazo: 30,
  precios: [{ salidaRolloId: 91, precioUnitario: "21" }, { salidaRolloId: 81, precioUnitario: "19.50" }],
};

test("exact generation retry matches complete persisted operation", () => {
  assert.equal(generacionVentaCoincide(ticket, persisted, request), true);
});

test("UUID conflicts on linked set, price, or ordinary/paid unrelated ticket", () => {
  assert.equal(generacionVentaCoincide(ticket, persisted, { ...request, salidaIds: [8] }), false);
  assert.equal(generacionVentaCoincide(ticket, persisted, { ...request, precios: [{ salidaRolloId: 91, precioUnitario: "99" }, request.precios[1]!] }), false);
  assert.equal(generacionVentaCoincide(ticket, [], request), false, "ordinary or unrelated paid UUID has no exact linked operation");
});

test("idempotency lock precedes generation state reads and conflicts precede attachment", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const salidas = readFileSync(join(here, "salidas.ts"), "utf8");
  const start = salidas.indexOf("export async function validarORecuperarGeneracionVenta(");
  const end = salidas.indexOf("\nexport ", start + 1);
  const helper = salidas.slice(start, end);
  assert.ok(helper.indexOf("POS_TICKET_IDEMPOTENCY") < helper.indexOf(".from(ticketsTable)"));

  const route = readFileSync(join(here, "../routes/salidas.ts"), "utf8");
  const routeStart = route.indexOf('"/salidas/venta-cliente/generar-venta"');
  const routeBody = route.slice(routeStart, route.indexOf("\n});", routeStart));
  assert.ok(routeBody.indexOf("validarORecuperarGeneracionVenta") < routeBody.indexOf("prepararVentaDesdeSalidas"));
  assert.ok(routeBody.indexOf("validarORecuperarGeneracionVenta") < routeBody.indexOf("tx.update(salidasTable)"));
});