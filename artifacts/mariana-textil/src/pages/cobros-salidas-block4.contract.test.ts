import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Bloque 4 only renders cash outs in Mariana and warns old sessions", async () => {
  const source = await readFile(new URL("./cobros.tsx", import.meta.url), "utf8");
  assert.match(source, /const MARIANA_LOCATION_ID = 1/);
  assert.match(source, /sesion\.ubicacionId === MARIANA_LOCATION_ID/);
  assert.match(source, /Sesión de fecha anterior/);
  assert.match(source, /useCrearSalidaDineroCaja/);
  assert.match(source, /useListarProveedoresActivosCaja/);
  assert.match(source, /min="0\.01"/);
  assert.match(source, /!fondo\.trim\(\)/);
  assert.match(source, /required/);
});