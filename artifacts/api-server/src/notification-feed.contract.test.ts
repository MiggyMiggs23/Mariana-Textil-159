import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("./routes/notificaciones.ts", import.meta.url),
  "utf8",
);
const spec = readFileSync(
  new URL("../../../lib/api-spec/openapi.yaml", import.meta.url),
  "utf8",
);

test("notification feed is session scoped and publishes three sound families", () => {
  assert.match(route, /router\.use\("\/notificaciones", requireSession\)/);
  assert.match(route, /router\.get\("\/notificaciones\/feed"/);
  assert.match(route, /user\.rol === "CAJA" && user\.ubicacionId != null/);
  assert.match(route, /t\.ubicacion_id=\$1/);
  assert.match(route, /t\.estado='VENDIDO' AND NOT t\.cobrado/);
  assert.match(route, /where\(eq\(solicitudesPagoDirigidoTable\.estado, "PENDIENTE"\)\)/);
  assert.match(route, /id: `ticket-ready:\$\{ticketId\}`/);
  assert.match(route, /id: `directed-payment:\$\{id\}`/);
  assert.match(route, /family: "SOLICITUD"/);
  assert.match(route, /family: "ALERTA"/);
  assert.match(route, /family: row\.tipo\.includes\("INCOMPLETA"\) \? "ALERTA" : "AVISO"/);
  assert.match(spec, /enum: \[AVISO, SOLICITUD, ALERTA\]/);
  assert.match(spec, /\/notificaciones\/feed:/);
});