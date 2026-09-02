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