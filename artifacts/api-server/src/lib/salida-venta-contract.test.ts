import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = dirname(fileURLToPath(import.meta.url));
test("customer sale contracts keep origin links and deferred accounting", () => {
  const salidas = readFileSync(join(root, "salidas.ts"), "utf8");
  const pos = readFileSync(join(root, "pos.ts"), "utf8");
  const reservation = readFileSync(join(root, "salida-venta-reservation.ts"), "utf8");
  assert.match(salidas, /documentoId: String\(ticketId\), salidaId: r\.salidaId/);
  assert.match(reservation, /salidaHref: `\/salidas\/\$\{r\.salidaId\}`/);
  assert.match(pos, /deferInventory\?: boolean/);
  assert.match(pos, /assertNoActiveVentaClienteReservation\(\s*tx,\s*rolloIds,/);
});

test("delivery resolves foreign series to their real active owner", () => {
  const salidas = readFileSync(join(root, "salidas.ts"), "utf8");
  assert.match(salidas, /foreignRows[\s\S]*eq\(salidasTable\.modalidad, "VENTA_CLIENTE"\)/);
  assert.match(salidas, /inArray\(salidasTable\.estado, \["EN_TRANSITO", "RECIBIDA", "ENTREGADA"\]\)/);
  assert.match(salidas, /razon: owner \? "PERTENECE_A_OTRA_SALIDA"[\s\S]*"NO_RESERVADA"/);
  assert.match(salidas, /href: `\/salidas\/\$\{row\.salidaId\}`/);
  assert.match(salidas, /href: `\/tickets\/\$\{row\.ticketId\}`/);
});
