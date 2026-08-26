import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, root), "utf8");
}

test("POS interpreta etiquetas y usa coincidencia exacta para series", async () => {
  const pos = await source("artifacts/api-server/src/lib/pos.ts");
  assert.match(pos, /interpretarCodigoEscaneado\(q\)/);
  assert.match(pos, /codigo\.serie[\s\S]*eq\(rollosTable\.serie, codigo\.serie\)/);
  assert.match(pos, /rollosTable\.serie\} ILIKE/);
  assert.match(pos, /const productos = codigo\.serie[\s\S]*\? \[\]/);
});

test("Salidas, Etiquetas y Ajustes interpretan los códigos en servidor", async () => {
  const [salidas, etiquetas, inventario] = await Promise.all([
    source("artifacts/api-server/src/routes/salidas.ts"),
    source("artifacts/api-server/src/routes/etiquetas.ts"),
    source("artifacts/api-server/src/routes/inventario.ts"),
  ]);

  assert.match(salidas, /interpretarCodigoEscaneado\(codigoRecibido\)/);
  assert.match(salidas, /eq\(rollosTable\.serie, serie\)/);
  assert.match(etiquetas, /interpretarCodigoEscaneado\(term\)/);
  assert.match(etiquetas, /codigo\.serie[\s\S]*sql`r\.serie = \$\{codigo\.serie\}`/);
  assert.match(etiquetas, /r\.serie ILIKE/);
  assert.match(inventario, /interpretarCodigoEscaneado\(q\.serie\)/);
  assert.match(inventario, /eq\(rollosTable\.serie, codigo\.serie\)/);
  assert.match(inventario, /ilike\(rollosTable\.serie, `%\$\{q\.serie\}%`\)/);
});

test("Entradas y recepción conservan sus códigos no relacionados con rollos", async () => {
  const [entradas, recepcion] = await Promise.all([
    source("artifacts/mariana-textil/src/pages/entradas.tsx"),
    source("artifacts/mariana-textil/src/components/recepcion-salidas.tsx"),
  ]);

  assert.match(entradas, /interpretRollCode=\{false\}/);
  assert.match(recepcion, /interpretRollCode=\{false\}/);
});