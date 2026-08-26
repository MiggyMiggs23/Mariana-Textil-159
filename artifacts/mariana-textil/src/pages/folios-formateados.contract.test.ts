import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const pages = [
  "entradas.tsx",
  "entrada-documento.tsx",
  "entrada-etiquetas.tsx",
  "entradas-pendientes-costo.tsx",
  "salidas.tsx",
  "salida-detail.tsx",
  "salida-documento.tsx",
];

test("entry and exit folio views consume the formatted API folio", async () => {
  const sources = await Promise.all(
    pages.map((page) => readFile(new URL(`./${page}`, import.meta.url), "utf8")),
  );

  for (const source of sources) {
    assert.match(source, /folioFormateado/);
  }

  assert.doesNotMatch(
    sources.join("\n"),
    /(?:resultado|entrada|item|salida)\.folio\.toString\(\)\.padStart|String\((?:salida|detalle\.data)\.folio\)\.padStart/,
  );
});

test("exit reception accepts formatted or numeric folios", async () => {
  const source = await readFile(
    new URL("../components/recepcion-salidas.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /\^\(\?:\[A-Za-z\]\+\[-\\s\]\?\)\?\(\\d\+\)\$/);
  assert.match(source, /folioFormateado/);
});