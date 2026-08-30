import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Bloque 4 keeps daily cash and Mariana safeguards wired", async () => {
  const [schema, ensure, pos, routes, spec] = await Promise.all([
    readFile(new URL("../../../lib/db/src/schema/pos.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../lib/db/src/lib/cash-session-schema.ts", import.meta.url), "utf8"),
    readFile(new URL("./lib/pos.ts", import.meta.url), "utf8"),
    readFile(new URL("./routes/pos.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../lib/api-spec/openapi.yaml", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /fecha_operativa/);
  assert.match(ensure, /America\/Mexico_City/);
  assert.match(ensure, /sesiones_caja_dias/);
  assert.match(ensure, /DISTINCT ON \(ubicacion_id, fecha_operativa\)/);
  assert.match(pos, /ADVISORY_LOCK_NAMESPACES\.CASH_SESSION_SITE/);
  assert.match(pos, /PREVIOUS_SESSION_OPEN/);
  assert.match(pos, /SESSION_ALREADY_EXISTS_TODAY/);
  assert.match(pos, /MARIANA_LOCATION_ID = 1/);
  assert.match(pos, /\.for\("update"\)/);
  assert.match(pos, /cuentas\[salida\.cuentaOrigen\] -= cents/);
  assert.match(routes, /salidas-dinero/);
  assert.match(spec, /crearSalidaDineroCaja/);
  assert.match(spec, /listarProveedoresActivosCaja/);
});