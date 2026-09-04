import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./entradas.tsx", import.meta.url), "utf8");

test("la aplicación uniforme no está disponible cuando no quedan rollos en blanco", () => {
  const applyButton = source.slice(
    source.indexOf('data-testid="button-apply-uniform"') - 250,
    source.indexOf('data-testid="button-apply-uniform"') + 350,
  );

  assert.match(applyButton, /disabled=\{!uniformQty \|\| blankRollCount === 0\}/);
  assert.match(applyButton, /Aplicar a todos/);
  assert.match(applyButton, /Aplicar a los \$\{blankRollCount\} rollos restantes/);
  assert.match(source, /if \(blankCount === 0\) \{\s*toast\.info\("No hay rollos en blanco por completar\."\);\s*return;/);
});