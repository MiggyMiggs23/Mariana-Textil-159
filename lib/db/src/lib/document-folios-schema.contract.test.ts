import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("./document-folios-schema.ts", import.meta.url),
  "utf8",
);

test("las expresiones SQL conservan paréntesis literales al salir del template de JavaScript", () => {
  assert.equal(
    source.match(/\\\\\(folio\\\\\)/g)?.length,
    8,
    "entradas y salidas deben detectar tanto constraints como índices globales",
  );
  assert.doesNotMatch(
    source,
    /(?<!\\)\\\(folio(?<!\\)\\\)/,
    "un solo backslash se pierde al evaluar el template literal",
  );
});