import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ListHistorialComprasProveedoresQueryParams } from "@workspace/api-zod";

test("historial acepta las seis columnas y solo dos direcciones", () => {
  for (const sort of ["fecha", "producto", "proveedor", "color", "sitio", "cantidad"]) {
    assert.equal(
      ListHistorialComprasProveedoresQueryParams.parse({ sort, direction: "asc" }).sort,
      sort,
    );
    assert.equal(
      ListHistorialComprasProveedoresQueryParams.parse({ sort, direction: "desc" }).direction,
      "desc",
    );
  }
  assert.equal(
    ListHistorialComprasProveedoresQueryParams.safeParse({ direction: "none" }).success,
    false,
  );
});

test("historial usa fecha descendente por omisión y orden estable", async () => {
  const query = ListHistorialComprasProveedoresQueryParams.parse({});
  assert.equal(query.sort, "fecha");
  assert.equal(query.direction, "desc");

  const source = await readFile(
    new URL("./lib/historial-compras-proveedores.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /entrada_id DESC, producto_id ASC/);
  assert.doesNotMatch(source, /direction.*none|direction.*default/);
});

test("agrupa una línea por entrada y producto, no por rollo", async () => {
  const source = await readFile(
    new URL("./lib/historial-compras-proveedores.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /SUM\(ro\.cantidad_inicial\) AS cantidad/);
  assert.match(source, /GROUP BY e\.id, e\.fecha, pr\.id/);
  assert.doesNotMatch(source, /GROUP BY[^;]*ro\.id/);
});

test("combina listas con OR interno, AND externo y catálogos derivados", async () => {
  const query = ListHistorialComprasProveedoresQueryParams.parse({
    telas: ["Tafetán", "Loneta"],
    colores: ["Blanco", "Crudo"],
    proveedorIds: ["1", "2"],
    ubicacionIds: ["3", "4"],
  });
  assert.deepEqual(query.proveedorIds, [1, 2]);
  assert.deepEqual(query.ubicacionIds, [3, 4]);

  const source = await readFile(
    new URL("./lib/historial-compras-proveedores.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /e\.ubicacion_id = ANY/);
  assert.match(source, /e\.proveedor_id = ANY/);
  assert.match(source, /pr\.tela = ANY/);
  assert.match(source, /pr\.color = ANY/);
  assert.match(source, /SELECT DISTINCT tela, color\s+FROM productos/);
});