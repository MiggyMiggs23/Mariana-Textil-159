import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../../", import.meta.url);

test("CajaTiempoReal has exactly one Ver ventas link per store", async () => {
  const tiempoReal = await readFile(new URL("artifacts/mariana-textil/src/pages/caja/tiempo-real.tsx", root), "utf8");

  // It should map over mergedStores and include a link to /caja/tiendas/:id/ventas
  assert.match(tiempoReal, /mergedStores\.map\(/);
  assert.match(tiempoReal, /href=\{`\/caja\/tiendas\/\$\{store\.ubicacionId\}\/ventas`\}/);
  assert.match(tiempoReal, /Ver ventas/i);

  // Make sure we didn't add duplicate buttons, only one Ver ventas link is allowed
  const links = tiempoReal.match(/Ver ventas/gi);
  assert.equal(links?.length, 1, "There should be exactly one Ver ventas text inside the map loop template");
});

test("TiendaVentas route is correctly defined and protected", async () => {
  const app = await readFile(new URL("artifacts/mariana-textil/src/App.tsx", root), "utf8");

  assert.match(app, /import TiendaVentas from "@\/pages\/caja\/tienda-ventas";/);
  assert.match(app, /path="\/caja\/tiendas\/:ubicacionId\/ventas"/);
  assert.match(app, /component=\{TiendaVentas\}/);
  assert.match(app, /allowedModule=\{Modules\.RESUMEN_CAJA\}/);
});

test("TiendaVentas page implements URL filters and responsive table", async () => {
  const tiendaVentas = await readFile(new URL("artifacts/mariana-textil/src/pages/caja/tienda-ventas.tsx", root), "utf8");

  // Check generated hook and schema are used
  assert.match(tiendaVentas, /useListCajaTiendaVentas/);
  assert.match(tiendaVentas, /ListCajaTiendaVentasFormaPago/);

  // Check URL-backed filters
  assert.match(tiendaVentas, /searchParams\.get\("desde"\)/);
  assert.match(tiendaVentas, /searchParams\.get\("hasta"\)/);
  assert.match(tiendaVentas, /searchParams\.get\("formaPago"\)/);
  assert.match(tiendaVentas, /searchParams\.get\("page"\)/);

  // Check updateFilters correctly modifies history
  assert.match(tiendaVentas, /newParams\.set\(key/);
  assert.match(tiendaVentas, /newParams\.delete\(key\)/);
  assert.match(tiendaVentas, /setLocationStr\(`\$\{window\.location\.pathname\}\?\$\{newParams\.toString\(\)\}`\)/);
  assert.match(tiendaVentas, /newParams\.delete\("page"\)/, "Should reset to page 1 when changing other filters");

  // Check default dates are today (Mexico City)
  assert.match(tiendaVentas, /timeZone: "America\/Mexico_City"/);
  assert.match(tiendaVentas, /const todayStr = mexicoCityToday\(\)/);
  assert.match(tiendaVentas, /desde = searchParams\.get\("desde"\) \|\| todayStr/);

  // Check default page is 1
  assert.match(tiendaVentas, /const requestedPage = Number\(searchParams\.get\("page"\)\)/);
  assert.match(tiendaVentas, /Number\.isInteger\(requestedPage\).*requestedPage > 0/);

  // Check desktop/tablet responsive styling (overflow-x-auto on table wrapper)
  assert.match(tiendaVentas, /overflow-x-auto w-full/);
  assert.match(tiendaVentas, /whitespace-nowrap/);

  // Check fields in table
  assert.match(tiendaVentas, /Folio/);
  assert.match(tiendaVentas, /Cliente/);
  assert.match(tiendaVentas, /F\. Pago/);
  assert.match(tiendaVentas, /Importe/);
  assert.match(tiendaVentas, /Estado/);

  // Conditionally checking utilidad if server provides it
  assert.match(tiendaVentas, /data\?\.items\.some\(\(item\) => "utilidad" in item\)/);
  assert.match(tiendaVentas, /row\.utilidad === undefined \|\| row\.utilidad === null/);
  assert.match(tiendaVentas, /formatNumber\(row\.utilidad, \{ kind: "money" \}\)/);

  // Invalid ids never issue a request, and timestamps are rendered in Mexico City.
  assert.match(tiendaVentas, /enabled: isValidLocationId/);
  assert.match(tiendaVentas, /function mexicoCityDateTime/);

  // Return link preserving state not strictly needed, but let's check it links back
  assert.match(tiendaVentas, /href="\/caja\/tiempo-real"/);
});
