import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const inventorySource = readFileSync(
  new URL("./lib/inventario.ts", import.meta.url),
  "utf8",
);
const retirementDoc = readFileSync(
  new URL("../../../docs/abierto-retirement.md", import.meta.url),
  "utf8",
);

test("Block 4 documents the exact temporary ABIERTO asymmetry", () => {
  assert.match(retirementDoc, /cantidad_actual = Q/);
  assert.match(retirementDoc, /cantidad = -Q/);
  assert.match(retirementDoc, /suma firmada del kardex/);
  assert.match(retirementDoc, /únicamente `DISPONIBLE`/);

  const salidaStart = inventorySource.indexOf(
    "export async function salidaMostrador",
  );
  const salidaEnd = inventorySource.indexOf(
    "export type VenderRolloInput",
    salidaStart,
  );
  const salidaSource = inventorySource.slice(salidaStart, salidaEnd);

  assert.match(salidaSource, /\.set\(\{ estado: "ABIERTO" \}\)/);
  assert.match(salidaSource, /cantidad: `-\$\{rollo\.cantidadActual\}`/);
  assert.doesNotMatch(
    salidaSource,
    /\.set\(\{[^}]*cantidadActual/s,
    "Block 4 must not silently change legacy behavior",
  );
});

test("Block 4 leaves a complete Parte 2 removal checklist", () => {
  for (const dependency of [
    "POS metrado",
    "salidaMostrador",
    "OpenAPI",
    "filtros de inventario/etiquetas",
    "diagnóstico de rollos abiertos",
    "Reconstruir `existencias`",
  ]) {
    assert.ok(
      retirementDoc.includes(dependency),
      `Missing documented dependency: ${dependency}`,
    );
  }
});