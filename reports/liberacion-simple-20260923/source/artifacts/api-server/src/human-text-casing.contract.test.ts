import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("proveedores recorta texto humano sin cambiar casing ni acentos", async () => {
  const source = await readFile(new URL("./routes/proveedores.ts", import.meta.url), "utf8");

  assert.match(source, /nombre: parsed\.data\.nombre\.trim\(\)/);
  assert.match(source, /pais: parsed\.data\.pais\?\.trim\(\) \?\? null/);
  assert.match(source, /updates\.nombre = body\.data\.nombre\.trim\(\)/);
  assert.match(source, /updates\.pais = body\.data\.pais\?\.trim\(\) \?\? null/);
  assert.doesNotMatch(source, /(?:nombre|pais).*toUpperCase/);
  assert.equal("  Compañía Óptima  ".trim(), "Compañía Óptima");
});

test("camionetas preserva texto humano y mantiene placas normalizadas", async () => {
  const source = await readFile(new URL("./routes/camionetas.ts", import.meta.url), "utf8");

  assert.match(source, /nombre: parsed\.data\.nombre\.trim\(\)/);
  assert.match(source, /marca: parsed\.data\.marca\?\.trim\(\) \?\? null/);
  assert.match(source, /modelo: parsed\.data\.modelo\?\.trim\(\) \?\? null/);
  assert.doesNotMatch(source, /(?:nombre|marca|modelo).*toUpperCase/);
  assert.match(source, /return placas\.trim\(\)\.toUpperCase\(\)/);
  assert.equal("  ábc-123  ".trim().toUpperCase(), "ÁBC-123");
});