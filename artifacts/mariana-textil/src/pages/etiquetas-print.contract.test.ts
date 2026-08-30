import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [labelsPage, entryLabelsPage, label] = await Promise.all([
  readFile(new URL("./etiquetas.tsx", import.meta.url), "utf8"),
  readFile(new URL("./entrada-etiquetas.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/label-print.tsx", import.meta.url), "utf8"),
]);

test("la reimpresión espera a que los datos estén montados antes de imprimir", () => {
  assert.match(labelsPage, /setPrintData/);
  assert.match(labelsPage, /setPendingPrint\(true\)/);
  assert.match(labelsPage, /if \(!pendingPrint \|\| !printData\) return/);
  assert.match(labelsPage, /printWhenReady/);
  assert.match(labelsPage, /createPortal/);
  assert.match(labelsPage, /printing-label-sheet/);
  assert.doesNotMatch(labelsPage, /requestAnimationFrame\(\(\) => window\.print/);
  assert.doesNotMatch(entryLabelsPage, /classList\.add\('printing-labels'\)/);
  assert.match(entryLabelsPage, /createPortal/);
});

test("el QR completo cabe dentro de la tercera columna con margen blanco", () => {
  assert.match(label, /grid-cols-\[34mm_28mm_minmax\(0,1fr\)\]/);
  assert.match(label, /width="26mm"/);
  assert.match(label, /height="26mm"/);
  assert.match(label, /includeMargin=\{true\}/);
  assert.match(label, /bg-white p-\[1mm\]/);
});