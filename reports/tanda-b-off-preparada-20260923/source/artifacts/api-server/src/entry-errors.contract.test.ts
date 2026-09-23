import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [route, app, client] = await Promise.all([
  readFile(new URL("./routes/inventario.ts", import.meta.url), "utf8"),
  readFile(new URL("./app.ts", import.meta.url), "utf8"),
  readFile(
    new URL("../../mariana-textil/src/pages/entradas.tsx", import.meta.url),
    "utf8",
  ),
]);

test("crear entrada traduce conflicto de folio y fallas internas en acciones útiles", () => {
  assert.match(route, /ENTRY_FOLIO_CONFLICT/);
  assert.match(route, /No se pudo asignar el folio de la entrada/);
  assert.match(route, /ENTRY_CREATE_FAILED/);
  assert.match(route, /No se guardó ningún cambio/);
});

test("la aplicación ya no expone el mensaje genérico de error inesperado", () => {
  assert.doesNotMatch(app, /error inesperado/i);
  assert.match(app, /reporta la pantalla y la hora del intento/);
  assert.doesNotMatch(client, /toast\.error\("Error"/);
  assert.match(client, /No se registró la entrada/);
});