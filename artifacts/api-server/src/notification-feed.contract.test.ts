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
  assert.match(
    route,
    /family: row\.tipo\.startsWith\("SOLICITUD_"\) \? "SOLICITUD" : row\.tipo\.includes\("INCOMPLETA"\) \? "ALERTA" : "AVISO"/,
    "Los tipos SOLICITUD_* deben activar la familia de sonido SOLICITUD.",
  );
  assert.match(
    route,
    /row\.tipo\.includes\("INCOMPLETA"\) \? "ALERTA" : "AVISO"/,
    "Las notificaciones INCOMPLETA siguen siendo ALERTA y los demás tipos AVISO.",
  );
  assert.match(spec, /enum: \[AVISO, SOLICITUD, ALERTA\]/);
  assert.match(spec, /\/notificaciones\/feed:/);
});

test("resolved directed payments expire after the four-day notice window", () => {
  assert.match(route, /RESOLVED_DIRECTED_PAYMENT_VISIBILITY_DAYS = 4/);
  assert.match(route, /solicitudesPagoDirigidoTable\.resueltaAt/);
  assert.match(route, /RESOLVED_DIRECTED_PAYMENT_VISIBILITY_DAYS \* 86_400_000/);
});

test("badge count includes the same active stored and derived sources", () => {
  assert.match(route, /async function countAdminActiveEvents/);
  assert.match(route, /alerts\.total/);
  assert.match(route, /directedIds\.size/);
  assert.match(route, /\(credit\?\.count \?\? 0\)/);
  assert.match(route, /\(system\?\.count \?\? 0\)/);
  assert.match(route, /Math\.min\(\s*100,/);
  assert.match(route, /count: await countAdminActiveEvents/);
});

test("read endpoints return real counts and disambiguate both storage tables", () => {
  assert.doesNotMatch(route, /count: 0/);
  assert.match(route, /credit\.length \+ system\.length/);
  assert.match(route, /\/notificaciones\/:tipo\/:id\/leer/);
  assert.match(route, /params\.tipo === "credito"/);
  assert.match(spec, /\/notificaciones\/\{tipo\}\/\{id\}\/leer:/);
  assert.match(spec, /enum: \[credito, sistema\]/);
});