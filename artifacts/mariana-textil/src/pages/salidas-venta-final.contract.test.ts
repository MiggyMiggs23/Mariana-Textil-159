import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("pending-sale client context is nullable and opens the POS mode", async () => {
  const pending = await readFile(
    new URL("../components/salidas-pendientes-cobro.tsx", import.meta.url),
    "utf8",
  );
  const pos = await readFile(new URL("./pos.tsx", import.meta.url), "utf8");
  const client = await readFile(new URL("./cliente-detail.tsx", import.meta.url), "utf8");

  assert.match(pending, /clientContextParam !== null/);
  assert.match(pending, /clientContext === null \|\| group\.clienteId === clientContext/);
  assert.doesNotMatch(pending, /Number\(new URLSearchParams[^)]*\.get\("salidaClienteId"\)\)/);
  assert.match(client, /\/pos\?salidaClienteId=\$\{id\}/);
  assert.match(pos, /new URLSearchParams\(window\.location\.search\)\.has\("salidaClienteId"\)/);
  assert.match(pos, /showSalidasVenta && hasPermission\(currentUser, Modules\.SALIDAS_VENTA, "ver"\)/);
});

test("pending-sale generation requires an active issuing store in the request", async () => {
  const pending = await readFile(
    new URL("../components/salidas-pendientes-cobro.tsx", import.meta.url),
    "utf8",
  );

  assert.match(pending, /currentUser\?\.ubicacion\?\.activa === true/);
  assert.match(pending, /currentUser\.ubicacion\.tipo === "TIENDA"/);
  assert.match(pending, /location\.activa && location\.tipo === "TIENDA"/);
  assert.match(pending, /Selecciona una tienda activa/);
  assert.match(pending, /ubicacionId: saleLocationId/g);
  assert.match(pending, /disabled=\{generate\.isPending \|\| totalSelected === 0 \|\| saleLocationId === null\}/);
});

test("linked-sale printing waits for authoritative authorization and cancellation wins", async () => {
  const detail = await readFile(new URL("./ticket-detail.tsx", import.meta.url), "utf8");

  assert.match(detail, /const isSaleLinked = \(ticket\.salidas\?\.length \?\? 0\) > 0/);
  assert.match(detail, /ticket\.estado !== EstadoTicket\.CANCELADO/);
  assert.match(detail, /ticket\.documentoTipo === "TICKET"[\s\S]*ticket\.cobrado === true[\s\S]*ticket\.autorizadoPor != null/);
  assert.match(detail, /disabled=\{isSaleLinked && !ventaAutorizada\}/);
  assert.match(detail, /disabled=\{!isPrintReady[\s\S]*\(isSaleLinked && !ventaAutorizada\)\}/);
  assert.match(detail, /Impresión pendiente de autorización/);
  assert.equal((detail.match(/\{ventaAutorizada &&/g) ?? []).length, 2);
  assert.doesNotMatch(detail, /autorizacionEstado\?: string/);
});

test("authorized-undelivered alerts use the generated typed collection", async () => {
  const alerts = await readFile(new URL("./alertas.tsx", import.meta.url), "utf8");

  assert.match(alerts, /alertas\?\.ventasAutorizadasSinEntregar \?\? \[\]/);
  assert.match(alerts, /alert\.ticketId/);
  assert.match(alerts, /alert\.salidaId/);
  assert.doesNotMatch(alerts, /ventasAutorizadasSinEntregar[^;\n]*\bas\b/);
});