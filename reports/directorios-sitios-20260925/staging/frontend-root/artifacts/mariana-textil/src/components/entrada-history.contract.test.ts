import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [history, page] = await Promise.all([
  readFile(new URL("./entrada-history.tsx", import.meta.url), "utf8"),
  readFile(new URL("../pages/entradas.tsx", import.meta.url), "utf8"),
]);

test("Entradas opens history first and keeps the capture engine mounted", () => {
  assert.match(page, /useHistoryEntryState<"historial" \| "captura">\(\s*"entradas\.tab",\s*"historial"/);
  assert.match(page, /hasPermission\(user, Modules\.ENTRADAS, "crear"\)/);
  assert.match(page, /data-testid="btn-create-entrada"/);
  assert.match(page, /className=\{showCapture \? "block" : "hidden"\} data-testid="entrada-capture-surface"/);
  assert.match(page, /className=\{showCapture \? "hidden" : "block"\} data-testid="entrada-history-surface"/);
  assert.match(page, /<EntradaHistory catalogos=\{catalogos\} ubicaciones=\{ubicaciones\} \/>/);
  assert.match(page, /useCrearEntrada/);
  assert.match(page, /crearEntrada\.mutate/);
});

test("Entradas history preserves server filters, folio ordering, and document links", () => {
  assert.match(history, /useHistoryEntryState\("entradas\.page", 1\)/);
  assert.match(history, /useHistoryEntryState\("entradas\.folio", ""\)/);
  assert.match(history, /useHistoryEntryState\("entradas\.proveedor", "all"\)/);
  assert.match(history, /useHistoryEntryState\("entradas\.ubicacion", "all"\)/);
  assert.match(history, /"entradas\.fecha-desde"/);
  assert.match(history, /"entradas\.fecha-hasta"/);
  assert.match(history, /folio: debouncedFolio\.trim\(\) \|\| undefined/);
  assert.match(history, /proveedorId: proveedorId !== "all" \? Number\(proveedorId\) : undefined/);
  assert.match(history, /ubicacionId: ubicacionId !== "all" \? Number\(ubicacionId\) : undefined/);
  assert.match(history, /fechaDesde: fechaDesde \? format\(fechaDesde, "yyyy-MM-dd"\) : undefined/);
  assert.match(history, /fechaHasta: fechaHasta \? format\(fechaHasta, "yyyy-MM-dd"\) : undefined/);
  assert.match(history, /pageSize: PAGE_SIZE/);
  assert.match(history, /href=\{`\/entradas\/\$\{entrada\.id\}\/documento`\}/);
  assert.match(history, /data-testid=\{`entrada-document-link-\$\{entrada\.id\}`\}/);
  assert.match(history, /setFolio\(event\.target\.value\);\s*setPage\(1\)/);
  assert.doesNotMatch(history, /setDebouncedFolio\(folio\);\s*setPage\(1\)/);
});