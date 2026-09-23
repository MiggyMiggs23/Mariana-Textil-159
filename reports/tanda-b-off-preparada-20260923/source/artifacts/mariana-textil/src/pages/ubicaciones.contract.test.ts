import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const locationsPage = await readFile(
  new URL("./ubicaciones.tsx", import.meta.url),
  "utf8",
);

test("the administrative catalog requests inactive locations only for ADMIN", () => {
  assert.match(locationsPage, /const includeInactive = user\?\.rol === Role\.ADMIN/);
  assert.match(locationsPage, /useListLocations\(\s*\{\s*includeInactive\s*\}/);
  assert.match(locationsPage, /enabled: user !== undefined/);
  assert.match(locationsPage, /getListLocationsQueryKey\(\{ includeInactive \}\)/);
});

test("inactive locations are clearly marked and can be reactivated", () => {
  assert.match(locationsPage, /No disponible para operaciones/);
  assert.match(locationsPage, />\s*Reactivar\s*<\/Button>/);
  assert.match(locationsPage, /data: \{ activa: true \}/);
  assert.match(locationsPage, /Sitio reactivado correctamente/);
});

test("the page explains that sites are deactivated rather than deleted", () => {
  assert.match(locationsPage, /se desactivan, no se borran/);
  assert.doesNotMatch(locationsPage, /useDeleteLocation|deleteLocation|<[^>]*>Eliminar</);
});