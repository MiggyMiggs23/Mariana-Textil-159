import assert from "node:assert/strict";
import test from "node:test";
import { ensureSalidasVentaPermissions } from "./salidas-venta-permissions-schema";

test("SALIDAS_VENTA is inherited only from site data and preserves custom rows", async () => {
  const calls: string[] = [];
  const pool = {
    query: async (text: string) => {
      calls.push(text);
      return { rows: [], rowCount: 0 };
    },
  };

  await ensureSalidasVentaPermissions(pool as never);
  const ddl = calls.join("\n");

  assert.match(ddl, /'salidas_venta'/);
  assert.match(ddl, /lower\(btrim\(nombre\)\) = 'mariana'/);
  assert.match(ddl, /rol = 'TERMINAL'/);
  assert.match(ddl, /WHERE permisos_ubicacion\.updated_por IS NULL/);
  assert.match(ddl, /WHERE permisos_rol\.updated_por IS NULL/);
  assert.match(ddl, /ADD COLUMN IF NOT EXISTS rol rol_usuario/);
  assert.match(ddl, /DROP CONSTRAINT IF EXISTS permisos_ubicacion_ubicacion_modulo_unique/);
  assert.match(ddl, /permisos_ubicacion_ubicacion_rol_modulo_unique/);
  assert.doesNotMatch(ddl, /permisos_usuario/);
});