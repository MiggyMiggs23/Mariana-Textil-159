import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [helper, styles] = await Promise.all([
  readFile(new URL("./print.ts", import.meta.url), "utf8"),
  readFile(new URL("../index.css", import.meta.url), "utf8"),
]);

test("la impresión espera fuentes, imágenes y dos frames antes de abrir el diálogo", () => {
  assert.match(helper, /document\.fonts\?\.ready/);
  assert.match(helper, /querySelectorAll\("img"\)/);
  assert.match(helper, /image\.decode/);
  assert.match(helper, /requestAnimationFrame\(\(\) => requestAnimationFrame/);
  assert.ok(
    helper.indexOf("await waitForPrintableAssets") < helper.indexOf("window.print()"),
  );
});

test("los colores y logos se conservan en todos los medios impresos", () => {
  assert.match(styles, /-webkit-print-color-adjust:\s*exact !important/);
  assert.match(styles, /print-color-adjust:\s*exact !important/);
  assert.match(styles, /img\[data-logo-variant\]/);
  assert.match(styles, /img\[data-logo-source\]/);
});