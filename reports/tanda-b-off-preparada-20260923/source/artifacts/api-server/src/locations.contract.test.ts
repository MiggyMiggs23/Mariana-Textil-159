import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const locationsRoute = await readFile(
  new URL("./routes/locations.ts", import.meta.url),
  "utf8",
);

test("the locations list keeps the existing read permission and active-only predicate", () => {
  assert.match(locationsRoute, /requierePermiso\("ubicaciones", "ver"\)/);
  assert.match(locationsRoute, /ListLocationsQueryParams\.safeParse\(req\.query\)/);
  assert.match(locationsRoute, /resolveLocationsListDecision\(/);
  assert.match(locationsRoute, /eq\(ubicacionesTable\.activa, true\)/);
});

test("reactivation uses the existing edit permission and before/after audit context", () => {
  assert.match(
    locationsRoute,
    /router\.patch\("\/locations\/:id", requierePermiso\("ubicaciones", "editar"\)/,
  );
  assert.match(locationsRoute, /datosAntes: presentLocation\(before\)/);
  assert.match(locationsRoute, /datosDespues: presentLocation\(after\)/);
});

test("no location delete route is introduced", () => {
  assert.doesNotMatch(locationsRoute, /router\.delete\("\/locations/);
});