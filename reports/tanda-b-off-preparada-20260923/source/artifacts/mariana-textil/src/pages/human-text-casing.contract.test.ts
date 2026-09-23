import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sample = "  Óptima México e Íñigo  ";

function assertDirectControlledSetter(source: string, field: string): void {
  const setter = new RegExp(`${field}:\\s*e\\.target\\.value(?:\\s*[},])`);
  assert.match(source, setter, `${field} debe conservar el valor controlado exacto`);
  assert.doesNotMatch(
    source,
    new RegExp(`${field}:\\s*e\\.target\\.value\\.toUpperCase`),
    `${field} no debe convertir a mayúsculas por tecla`,
  );
}

test("alta y edición de proveedor conservan casing y acentos en nombre y país", async () => {
  const [create, edit] = await Promise.all([
    readFile(new URL("./proveedores.tsx", import.meta.url), "utf8"),
    readFile(new URL("./proveedor-detail.tsx", import.meta.url), "utf8"),
  ]);

  for (const [source, field] of [
    [create, "nombre"],
    [create, "pais"],
    [edit, "nombre"],
    [edit, "pais"],
  ] as const) {
    assertDirectControlledSetter(source, field);
    assert.match(source, new RegExp(`${field}:\\s*formData\\.${field}\\.trim\\(\\)`));
  }
  assert.equal(sample.trim(), "Óptima México e Íñigo");
});

test("alta y edición de camioneta conservan nombre, marca y modelo; placas siguen en mayúsculas", async () => {
  const source = await readFile(
    new URL("./configuracion/camionetas.tsx", import.meta.url),
    "utf8",
  );

  for (const field of ["nombre", "marca", "modelo"]) {
    assertDirectControlledSetter(source, field);
    assert.match(source, new RegExp(`${field}:\\s*formData\\.${field}\\??\\.trim\\(\\)`));
  }
  assert.match(source, /placas: e\.target\.value\.toUpperCase\(\)/);
  assert.match(source, /placas: formData\.placas\.trim\(\)\.toUpperCase\(\)/);
  assert.equal(sample.trim(), "Óptima México e Íñigo");
});

test("alta y edición de producto conservan tela y color; SKU sigue en mayúsculas", async () => {
  const [create, edit] = await Promise.all([
    readFile(new URL("./productos.tsx", import.meta.url), "utf8"),
    readFile(new URL("./producto-detail.tsx", import.meta.url), "utf8"),
  ]);

  for (const [source, field] of [
    [create, "tela"],
    [create, "color"],
    [edit, "tela"],
    [edit, "color"],
  ] as const) {
    assertDirectControlledSetter(source, field);
    assert.match(source, new RegExp(`${field}:\\s*formData\\.${field}(?:\\.trim\\(\\))?[,}]`));
  }
  assert.match(create, /sku: e\.target\.value\.toUpperCase\(\)/);
  assert.match(edit, /sku: e\.target\.value\.toUpperCase\(\)/);
  assert.equal(sample.trim(), "Óptima México e Íñigo");
});

test("importación de productos conserva casing y acentos con clave canónica solo para comparar", async () => {
  const source = await readFile(
    new URL("../../../api-server/src/lib/catalog-import.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /const telaRaw = \(row\[telaIdx\] \?\? ""\)\.trim\(\)/);
  assert.match(source, /const colorRaw = \(row\[colorIdx\] \?\? ""\)\.trim\(\)/);
  assert.match(source, /const telaNorm = telaRaw/);
  assert.match(source, /const colorNorm = colorRaw/);
  assert.match(source, /`\$\{telaNorm\.toUpperCase\(\)\}\|\$\{colorNorm\.toUpperCase\(\)\}`/);
  assert.doesNotMatch(source, /normalizeCatalogTitleCase/);
});