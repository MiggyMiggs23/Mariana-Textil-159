import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [labelsPage, entryLabelsPage, label, reprintDialog, inventoryPage, rolloDetail, rolloEtiqueta] = await Promise.all([
  readFile(new URL("./etiquetas.tsx", import.meta.url), "utf8"),
  readFile(new URL("./entrada-etiquetas.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/label-print.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/reprint-labels-dialog.tsx", import.meta.url), "utf8"),
  readFile(new URL("./inventario.tsx", import.meta.url), "utf8"),
  readFile(new URL("./rollo-detail.tsx", import.meta.url), "utf8"),
  readFile(new URL("./rollo-etiqueta.tsx", import.meta.url), "utf8"),
]);

test("la reimpresión espera a que los datos estén montados antes de imprimir", () => {
  assert.match(reprintDialog, /setPrintData/);
  assert.match(reprintDialog, /setPendingPrint\(true\)/);
  assert.match(reprintDialog, /if \(!pendingPrint \|\| !printData\) return/);
  assert.match(reprintDialog, /printWhenReady/);
  assert.match(reprintDialog, /createPortal/);
  assert.match(reprintDialog, /printing-label-sheet/);
  assert.match(reprintDialog, /setPrinting\(true\)/);
  assert.match(reprintDialog, /setPrinting\(false\)[\s\S]*onOpenChange\(false\)[\s\S]*onSuccess\?\.\(\)/);
  assert.match(reprintDialog, /\{printData &&\s*createPortal/);
  assert.doesNotMatch(reprintDialog, /requestAnimationFrame\(\(\) => window\.print/);
  assert.doesNotMatch(entryLabelsPage, /classList\.add\('printing-labels'\)/);
  assert.match(entryLabelsPage, /createPortal/);
});

test("la acción superior imprime toda la selección y la acción por renglón se conserva", () => {
  assert.match(labelsPage, /Reimprimir seleccionadas \(\{selected\.size\}\)/);
  assert.match(labelsPage, /disabled=\{!canPrint \|\| selected\.size === 0\}/);
  assert.match(labelsPage, /rolloIds=\{selectedRollos\.map\(\(rollo\) => rollo\.id\)\}/);
  assert.match(reprintDialog, /printData\.rollos\.map/);
  assert.match(labelsPage, /onClick=\{\(\) => openPrintDialog\(rollo\)\}/);
  assert.match(labelsPage, /useState<Map<number, EtiquetaRollo>>\(new Map\(\)\)/);
  assert.match(labelsPage, /return \[\.\.\.selected\.values\(\)\]/);
  assert.doesNotMatch(labelsPage, /new Map\(\(rollosQuery\.data\?\.items/);
});

test("la autorización bloquea motivos de nueve caracteres y repeticiones de alto riesgo", () => {
  assert.match(reprintDialog, /motivoOption === "Otro" \? otroMotivo\.trim\(\) : motivoOption\.trim\(\)/);
  assert.match(reprintDialog, /effectiveReason\.length >= 10/);
  assert.match(reprintDialog, /disabled=\{!canSubmit\}/);
  assert.match(reprintDialog, /rollo\.reimpresiones >= 3/);
  assert.match(reprintDialog, /confirmedWarnings\.has\(rollo\.id\)/);
  assert.match(reprintDialog, /const warningSignature = rollos/);
  assert.match(reprintDialog, /setConfirmedWarnings\(new Set\(\)\)/);
  assert.match(reprintDialog, /!detailsQuery\.isError/);
  assert.match(reprintDialog, /!loadingDetails/);
  assert.match(reprintDialog, /etiquetasApi\.obtenerRollo\(id\)/);
});

test("todos los accesos de reimpresión usan el diálogo compartido y su invalidación central", () => {
  assert.match(labelsPage, /<ReprintLabelsDialog/);
  assert.match(inventoryPage, /<ReprintLabelsDialog/);
  assert.match(rolloDetail, /<ReprintLabelsDialog/);
  assert.match(rolloEtiqueta, /<ReprintLabelsDialog/);
  assert.match(inventoryPage, /rolloIds=\{selectedVisibleRollos\.map\(\(rollo\) => rollo\.id\)\}/);
  assert.match(rolloDetail, /rolloIds=\{\[rollo\.id\]\}/);
  assert.match(reprintDialog, /queryClient\.invalidateQueries\(\{ queryKey: \["etiquetas"\] \}\)/);
  assert.match(reprintDialog, /\["etiquetas", "rollo", rolloId, "resumen"\]/);
  assert.match(reprintDialog, /Array\.isArray\(returnedRollos\)/);
  assert.match(reprintDialog, /typeof result\.createdAt !== "string"/);
  assert.match(reprintDialog, /La respuesta de reimpresión está incompleta/);
  assert.doesNotMatch(reprintDialog, /const printable = result\.rollos\?\.length \? result\.rollos : rollos/);
});

test("el reporte renderizado recorre todo el catálogo y denuncia cualquier desbordamiento", () => {
  assert.match(labelsPage, /get\("fitReport"\) === "1"/);
  assert.match(labelsPage, /products\.map\(\(product\) => \(/);
  assert.match(labelsPage, /data-testid="catalog-label-fit-report"/);
  assert.match(labelsPage, /querySelectorAll<HTMLElement>\('\[data-testid="label-product-name"\]'\)/);
  assert.match(labelsPage, /querySelectorAll<HTMLElement>\("\[data-fit-state\]"\)/);
  assert.match(labelsPage, /Sin caber al mínimo: \{summary\.overflows\.length\}/);
  assert.match(labelsPage, /document\.fonts\?\.ready/);
  assert.match(labelsPage, /new Event\("beforeprint"\)/);
});

test("el QR completo cabe dentro de la tercera columna con margen blanco", () => {
  assert.match(label, /grid-cols-\[31mm_30mm_minmax\(0,1fr\)\]/);
  assert.match(label, /width="29mm"/);
  assert.match(label, /height="29mm"/);
  assert.match(label, /includeMargin=\{true\}/);
  assert.match(label, /bg-white p-\[1mm\]/);
});