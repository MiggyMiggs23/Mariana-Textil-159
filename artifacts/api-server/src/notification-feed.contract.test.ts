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
const directedPayments = readFileSync(
  new URL("./routes/pagos-dirigidos.ts", import.meta.url),
  "utf8",
);
const notificationMigration = readFileSync(
  new URL("../../../lib/db/src/lib/notificaciones-schema.ts", import.meta.url),
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

test("resolved directed payments leave the derived feed immediately and use a persisted notice", () => {
  assert.doesNotMatch(route, /RESOLVED_DIRECTED_PAYMENT_VISIBILITY_DAYS/);
  assert.match(route, /eq\(solicitudesPagoDirigidoTable\.estado, "PENDIENTE"\)/);
  assert.match(route, /visibleSystemNotifications\(user\)/);
  assert.match(route, /row\.entidad === "solicitudes_pago_dirigido" \? "\/pagos-dirigidos"/);
  assert.match(directedPayments, /notifyRequesterResolved\(tx,/);
  assert.match(directedPayments, /destinatarioUsuarioId: request\.solicitanteId/);
  assert.match(directedPayments, /\.onConflictDoNothing\(\)/);
  assert.match(notificationMigration, /destinatario_usuario_id integer\s+REFERENCES usuarios\(id\)/);
  assert.match(notificationMigration, /PAGO_DIRIGIDO_RESUELTO/);
});

test("badge count includes the same active stored and derived sources", () => {
  assert.match(route, /async function countActiveEvents/);
  assert.match(route, /alerts\.total/);
  assert.match(route, /directedIds\.size/);
  assert.match(route, /\(credit\?\.count \?\? 0\)/);
  assert.match(route, /\(system\?\.count \?\? 0\)/);
  assert.match(route, /Math\.min\(\s*100,/);
  assert.match(route, /count: await countActiveEvents/);
});

test("read endpoints return real counts and disambiguate both storage tables", () => {
  assert.doesNotMatch(route, /count: 0/);
  assert.match(route, /credit\.length \+ system\.length/);
  assert.match(route, /\/notificaciones\/:tipo\/:id\/leer/);
  assert.match(route, /params\.tipo === "credito"/);
  assert.match(spec, /\/notificaciones\/\{tipo\}\/\{id\}\/leer:/);
  assert.match(spec, /enum: \[credito, sistema\]/);
  assert.match(route, /visibleSystemNotifications\(user\)/);
});