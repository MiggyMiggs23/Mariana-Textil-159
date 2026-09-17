import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);

test("cada superficie Prompt G obtiene el nombre visible desde el helper compartido", async () => {
  const sources = await Promise.all(
    [
      "ticket-detail.tsx",
      "cobros.tsx",
      "producto-detail.tsx",
      "ajustes.tsx",
    ].map((page) =>
      readFile(
        new URL(`artifacts/mariana-textil/src/pages/${page}`, root),
        "utf8",
      ),
    ),
  );

  for (const source of sources) {
    assert.match(source, /documentoTipoLabel/);
  }
  assert.match(sources[0], /documentoStatusPresentation/);
  assert.match(sources[0], /documentoTipoLabel\(ticket\?\.documentoTipo\)/);
  assert.match(sources[1], /documentoTipoLabel\(t\.documentoTipo\)/);
  assert.match(sources[2], /documentoTipoLabel\(mov\.documentoTipo\)/);
  assert.match(sources[3], /documentoTipoLabel\(movementDetail\.data\.documentoTipo\)/);
  assert.match(
    sources[0],
    /Se revertirán los movimientos de inventario correspondientes a \$\{documentoNombre\} #\$\{ticket\.folio\}/,
  );
  assert.match(
    sources[0],
    /Se cancelará \$\{documentoNombre\} #\$\{ticket\.folio\} y se revertirán/,
  );
  assert.doesNotMatch(sources[0], /de este\s+ticket/);
  assert.doesNotMatch(sources[0], /cancelar el \$\{documentoNombre/);
  assert.doesNotMatch(sources[0], /\$\{documentoNombre\} cancelado correctamente/);
  for (const text of [
    "${documentoNombre}: ingresa un motivo de cancelación",
    "${documentoNombre}: se requieren credenciales de administrador para cancelar",
    "${documentoNombre}: cancelación completada correctamente",
    "${documentoNombre}: no se pudo completar la cancelación.",
  ]) {
    assert.ok(sources[0].includes(text), `Mensaje compartido ausente: ${text}`);
  }
});

test("entradas usa la unidad compartida también para la captura de piezas", async () => {
  const source = await readFile(
    new URL("artifacts/mariana-textil/src/pages/entradas.tsx", root),
    "utf8",
  );

  assert.match(source, /const captureUnitLabel = formatUnit\(selectedProduct\?\.unidad\)/);
  assert.doesNotMatch(source, /formatCaptureUnit|["']Piezas["']/);
});