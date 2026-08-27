import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { GetProductoResponse, ListProductosResponse } from "@workspace/api-zod";

const root = new URL("./", import.meta.url);

test("productos contract declares cache-backed availability fields and filters", async () => {
  const spec = await readFile(new URL("../../../lib/api-spec/openapi.yaml", root), "utf8");
  assert.match(spec, /name: existencia/);
  assert.match(spec, /enum: \[TODOS, CON_EXISTENCIA, AGOTADOS\]/);
  assert.match(spec, /sitiosConExistencia/);
  assert.match(spec, /rollosDisponibles/);
});

test("productos route scopes cache totals and available-roll links server-side", async () => {
  const route = await readFile(new URL("./routes/productos.ts", root), "utf8");
  assert.match(route, /import \{ resolveReadScope \} from "\.\/inventario"/);
  assert.match(route, /from\(existenciasTable\)/);
  assert.match(route, /eq\(rollosTable\.estado, "DISPONIBLE"\)/);
  assert.match(route, /query\.data\.existencia === "AGOTADOS"/);
  assert.match(route, /sitiosConExistencia > 0/);
  assert.match(route, /inventarioPorUbicacion: locations\.map/);
  assert.match(route, /omitTerminalSensitiveFields/);
  assert.doesNotMatch(route, /emptyInventario/);
});

test("producto contracts retain zero catalog rows and expose scoped detail links", () => {
  const now = new Date();
  const list = ListProductosResponse.parse([{
    id: 1, sku: "CERO", tela: "Tela", color: "Sin stock", unidad: "METRO",
    colorHex: null, seVendePorMetro: false, precioSugerido: "10.00",
    notas: null, activo: true, rollos: 0,
    cantidad: "0.000", sitiosConExistencia: 0, createdAt: now, updatedAt: now,
  }]);
  assert.equal(list[0]?.sitiosConExistencia, 0);

  const detail = GetProductoResponse.parse({
    ...list[0],
    skuBloqueado: false,
    unidadBloqueada: false,
    inventarioPorUbicacion: [{
      ubicacionId: 7, nombre: "Tienda propia", rollos: 0, cantidad: "0.000",
    }],
    rollosDisponibles: [{
      id: 9, serie: "1000009", ubicacionId: 7, ubicacionNombre: "Tienda propia",
      cantidad: "4.250", estado: "DISPONIBLE",
    }],
  });
  assert.equal(detail.inventarioPorUbicacion[0]?.ubicacionId, 7);
  assert.equal(detail.rollosDisponibles[0]?.estado, "DISPONIBLE");
});