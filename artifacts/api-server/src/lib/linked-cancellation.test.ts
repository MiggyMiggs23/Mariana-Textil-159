import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { cancelarSalidaODocumentoLigado } from "./salidas";
import { assertNoDeliveredLinkedSalida, PosError } from "./pos";
const here = dirname(fileURLToPath(import.meta.url));

test("linked salida cancellation delegates once to the whole document", async () => {
  const calls: string[] = [];
  const result = await cancelarSalidaODocumentoLigado(
    { salidaId: 7, modalidad: "VENTA_CLIENTE", ticketId: 44 },
    {
      cancelarDocumento: async (id, salidaId) => { calls.push(`ticket:${id}:salida:${salidaId}`); },
      cancelarSalida: async () => { calls.push("standalone"); return "wrong"; },
      buildSalida: async () => { calls.push("detail"); return "cancelled-detail"; },
    },
  );
  assert.equal(result, "cancelled-detail");
  assert.deepEqual(calls, ["ticket:44:salida:7", "detail"]);
});

test("linked cancellation lock order is ticket then ascending linked exits", () => {
  const route = readFileSync(join(here, "../routes/salidas.ts"), "utf8");
  const routeStart = route.indexOf('"/salidas/:id/cancelar"');
  const routeEnd = route.indexOf("\n);", routeStart);
  const cancellationRoute = route.slice(routeStart, routeEnd);
  assert.doesNotMatch(cancellationRoute.slice(0, cancellationRoute.indexOf("cancelarTicket(")), /\.for\("update"\)/);

  const pos = readFileSync(join(here, "pos.ts"), "utf8");
  const start = pos.indexOf("export async function cancelarTicket(");
  const end = pos.indexOf("\nexport ", start + 1);
  const body = pos.slice(start, end);
  const ticketLock = body.indexOf(".from(ticketsTable)");
  const linkedLock = body.indexOf(".from(salidasTable)");
  assert.ok(ticketLock >= 0 && linkedLock > ticketLock);
  assert.match(body.slice(linkedLock), /\.orderBy\(asc\(salidasTable\.id\)\)\s*\.for\("update"\)/);
  assert.ok(body.indexOf("requestedSalidaId", linkedLock) > linkedLock, "membership is revalidated after linked locks");
});

test("delivered linked salida blocks cancellation before mutation", () => {
  assert.throws(
    () => assertNoDeliveredLinkedSalida(44, [{ id: 7, estado: "ENTREGADA" }]),
    (error) => error instanceof PosError && error.status === 409 &&
      error.message.includes("/salidas/7") && error.message.includes("/tickets/44"),
  );
});