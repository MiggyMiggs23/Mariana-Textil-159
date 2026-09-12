import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("las rutas exigen módulo separado y confirmación ADMIN", async () => {
  const source = await readFile(
    new URL("./routes/auditorias-inventario.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /requierePermiso\("auditoria_inventario", "autorizar"\)/);
  assert.match(source, /req\.auth!\.user\.rol !== "ADMIN"/);
  assert.match(source, /interpretarCodigoEscaneado/);
  assert.match(source, /inArray\(ubicacionesTable\.tipo, \["TIENDA", "BODEGA"\]\)/);
});

test("la aplicación de inventario referencia la auditoría", async () => {
  const source = await readFile(
    new URL("./lib/auditoria-inventario.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /documentoTipo: "AUDITORIA_INVENTARIO"/);
  assert.match(source, /estado: "CONFIRMADA"/);
  assert.match(source, /RESOLUCION_MANUAL/);
});

test("el esquema garantiza folio y una sola ABIERTA por sitio", async () => {
  const source = await readFile(
    new URL("../../../lib/db/src/lib/auditoria-inventario-schema.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /UNIQUE \(ubicacion_id, folio\)/);
  assert.match(source, /WHERE estado = 'ABIERTA'/);
  assert.match(source, /PRIMARY KEY \(auditoria_id, serie\)/);
  assert.match(source, /cantidad_snapshot numeric\(10,3\)/);
  assert.match(source, /ADD COLUMN IF NOT EXISTS cantidad_cierre/);
  assert.match(source, /ADD COLUMN IF NOT EXISTS sku_snapshot/);
  assert.match(source, /ADD COLUMN IF NOT EXISTS sku_cierre/);
  assert.match(source, /UPDATE auditoria_inventario_snapshot s/);
  assert.match(source, /ADD COLUMN IF NOT EXISTS resolucion/);
});

test("el cierre congela sobrantes y la confirmación persiste resolución", async () => {
  const source = await readFile(
    new URL("./lib/auditoria-inventario.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /cantidadCierre/);
  assert.match(source, /skuCierre/);
  assert.match(source, /skuSnapshot/);
  assert.match(source, /estadoCierre/);
  assert.match(source, /ubicacionCierre/);
  assert.match(source, /\.set\(\{ resolucion \}\)/);
  assert.match(source, /s\.cantidad_snapshot/);
  assert.match(source, /FOR UPDATE OF r/);
  assert.match(source, /\.for\("update", \{ of: rollosTable \}\)/);
  assert.match(source, /safeToAdjust/);
  assert.match(source, /resolucion_snapshot/);
  assert.match(source, /usarVivoParaSobrantes/);
  assert.match(source, /inArray\(ubicacionesTable\.tipo, \["TIENDA", "BODEGA"\]\)/);
});