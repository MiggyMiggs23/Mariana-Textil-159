import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { existingLocations, floorLabel, InventoryLocationRows, locationSummary, type InventoryLocation } from "./inventory-locations";

const location: InventoryLocation = {
  ubicacionId: 1,
  nombreUbicacion: "Centro",
  pisoId: 10,
  nombrePiso: "Planta baja",
  rollosCount: 2,
  cantidadTotal: "12.5",
  unidad: "METRO",
};

test("single floor uses its label locally and site + floor globally", () => {
  assert.equal(locationSummary([location], 2, false, true), "Planta baja");
  assert.equal(locationSummary([location], 2, true, true), "Centro · Planta baja");
});

test("same floor name across sites counts separately; product summary deduplicates IDs", () => {
  const other = { ...location, ubicacionId: 2, nombreUbicacion: "Norte" };
  assert.equal(locationSummary([location, other], 4, true, true), "Varias");
  assert.equal(locationSummary([location, location, other], 6, true), "Varias");
  assert.equal(locationSummary([location, { ...location, pisoId: 11 }], 4, false, true), "Varias");
  assert.equal(locationSummary([location, location], 4, true), "Centro · Planta baja");
});

test("missing floor is explicit, zero stock never creates an apparent floor", () => {
  const noFloor = { ...location, pisoId: null, nombrePiso: null };
  assert.equal(floorLabel(null), "Sin piso");
  assert.equal(floorLabel(" "), "Sin piso");
  assert.equal(locationSummary([noFloor], 2, true), "Centro · Sin piso");
  assert.equal(locationSummary([location], 0, true), "Sin existencias");
  assert.equal(locationSummary([], 0, false), "Sin existencias");
  assert.equal(locationSummary([], 2, false), "Ubicación no disponible");
  assert.deepEqual(existingLocations([{ ...location, rollosCount: 0 }]), []);
});

test("nested rows put quantities only in their own unit columns, retaining roll count/site/floor", () => {
  const locations: InventoryLocation[] = (["METRO", "KILO", "BOLSA", "PIEZA"] as const).map((unidad, index) => ({
    ...location, pisoId: index, unidad, cantidadTotal: String(11 + index),
  }));
  const html = renderToStaticMarkup(<table><tbody><InventoryLocationRows locations={locations} showSitio consolidado showBolsas showPiezas /></tbody></table>);
  const rows = [...html.matchAll(/<tr\b[^>]*>(.*?)<\/tr>/g)];
  assert.equal(rows.length, 4);
  rows.forEach((row, index) => {
    const cells = [...row[1].matchAll(/<td\b[^>]*>(.*?)<\/td>/g)].map((match) => match[1]);
    assert.equal(cells.length, 9);
    assert.equal(cells[2], "Centro");
    assert.equal(cells[3], "Centro · Planta baja");
    assert.equal(cells[4], "2");
    cells.slice(5).forEach((cell, unitIndex) => {
      if (unitIndex === index) assert.match(cell, new RegExp(`^${11 + index}(\\.0+)?$`));
      else assert.equal(cell, "-");
    });
  });
});

test("local nested rows preserve column alignment without optional columns", () => {
  const html = renderToStaticMarkup(<table><tbody><InventoryLocationRows locations={[{ ...location, pisoId: null, nombrePiso: null }]} showSitio={false} consolidado={false} showBolsas={false} showPiezas={false} /></tbody></table>);
  assert.equal([...html.matchAll(/<td\b/g)].length, 6);
  assert.match(html, /Sin piso/);
  assert.doesNotMatch(html, /Centro/);
});