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

test("reserva espacios separados para cantidad, unidad y cámara en la captura", () => {
  assert.match(source, /const formatCaptureUnit = \(unit: string \| null \| undefined\): string =>/);
  assert.match(source, /unit\?\.trim\(\)\.toUpperCase\(\) === "PIEZA" \? "Piezas" : formatUnit\(unit\)/);

  const uniformField = source.slice(
    source.indexOf('data-testid="input-uniform-qty"') - 800,
    source.indexOf('data-testid="input-uniform-qty"') + 550,
  );
  assert.match(uniformField, /flex min-w-0 flex-1 items-center/);
  assert.match(uniformField, /data-testid="uniform-qty-unit"/);
  assert.doesNotMatch(uniformField, /absolute/);

  const perRollField = source.slice(
    source.indexOf('data-testid="input-capture-qty"') - 900,
    source.indexOf('data-testid="input-capture-qty"') + 900,
  );
  assert.match(perRollField, /className="h-20 min-w-0 flex-1 px-3 text-center text-2xl font-black sm:text-4xl"/);
  assert.match(perRollField, /containerClassName="h-20 min-w-0 flex-1"/);
  assert.match(perRollField, /trailingContent=\{\(/);
  assert.match(perRollField, /data-testid="capture-qty-unit"/);
  assert.doesNotMatch(perRollField, /absolute/);
});
