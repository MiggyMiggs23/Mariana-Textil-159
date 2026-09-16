import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);

test("adjustment series links use the roll primary id", async () => {
  const source = await readFile(
    new URL("artifacts/mariana-textil/src/pages/ajustes.tsx", root),
    "utf8",
  );

  assert.match(source, /href=\{`\/inventario\/rollos\/\$\{mov\.rolloId\}`\}/);
  assert.doesNotMatch(source, /href=\{`\/inventario\/rollos\/\$\{mov\.serie\}`\}/);
});

test("conciliation product links use the product primary id", async () => {
  const source = await readFile(
    new URL("artifacts/mariana-textil/src/pages/conciliacion.tsx", root),
    "utf8",
  );

  assert.match(source, /href=\{`\/productos\/\$\{row\.productoId\}`\}/);
  assert.doesNotMatch(source, /href=\{`\/productos\/\$\{row\.skuProducto\}`\}/);
});

test("kardex document cells keep desktop and mobile resolved-route branches", async () => {
  const source = await readFile(
    new URL("artifacts/mariana-textil/src/pages/movimientos.tsx", root),
    "utf8",
  );

  assert.equal(
    (source.match(/row\.documentoRuta \?/g) ?? []).length,
    2,
  );
  assert.equal((source.match(/href=\{row\.documentoRuta\}/g) ?? []).length, 2);
  assert.match(source, /Referencia no resuelta/);
  assert.doesNotMatch(
    source,
    /href=\{`\/(?:tickets|entradas|salidas)\/\$\{row\.documentoId\}/,
  );
});