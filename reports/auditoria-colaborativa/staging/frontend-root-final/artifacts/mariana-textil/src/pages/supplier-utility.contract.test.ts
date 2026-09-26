import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("supplier utility UI consumes the generated, gated paginated contract", async () => {
  const source = await readFile(new URL("./proveedor-detail.tsx", import.meta.url), "utf8");

  assert.match(source, /useGetProveedorUtilidad/);
  assert.match(source, /getGetProveedorUtilidadQueryKey/);
  assert.match(source, /enabled: !!provId && canViewFinanzas && utilityVisible/);
  assert.match(source, /const \[utilityVisible, setUtilityVisible\] = useState\(false\)/);
  assert.match(source, /aria-label=\{visible \? "Ocultar utilidad del proveedor" : "Mostrar utilidad del proveedor"\}/);
  assert.match(source, /metric-supplier-utility-excluded-no-cost/);
  assert.match(source, /summary\.rollosExcluidosSinCosto/);
  assert.match(source, /summary\.lineasIncluidas/);
  assert.match(source, /globales del sitio y periodo seleccionado/);
  assert.doesNotMatch(source, /Líneas metreada\(s\) sin evidencia de consumo/);
  assert.doesNotMatch(source, /Rollos\/líneas vendidos excluidos/);
  assert.match(source, /ENTRADA.*asociada al rollo/);
  assert.match(source, /formatNumber\(item\.cantidad, \{ kind: "quantity" \}\).*formatUnit\(item\.unidad\)/s);
  assert.match(source, /item\.ticketFolio/);
  assert.match(source, /href=\{`\/tickets\/\$\{item\.ticketId\}`\}/);
  assert.match(source, /href=\{`\/entradas\/\$\{item\.entradaId\}\/documento`\}/);
  assert.match(source, /md:hidden/);
  assert.match(source, /hidden overflow-x-auto.*md:block/s);
  assert.match(source, /key=\{`\$\{item\.lineaId\}-\$\{item\.rolloId\}`\}/);
  assert.match(source, /row-supplier-utility-\$\{item\.lineaId\}-\$\{item\.rolloId\}/);
  assert.match(source, /button-supplier-utility-previous/);
  assert.match(source, /button-supplier-utility-next/);
});

test("supplier utility does not expose monetary rows outside supplier finance gating", async () => {
  const source = await readFile(new URL("./proveedor-detail.tsx", import.meta.url), "utf8");

  assert.match(source, /const canViewFinanzas = hasPermission\(user, Modules\.PROVEEDORES_FINANZAS, 'ver'\) && user\?\.rol !== "SUPERVISOR";/);
  assert.match(source, /SupplierUtilityCard/);
  assert.match(source, /{canViewFinanzas && \(/);
  assert.match(source, /metric-supplier-utility/);
  assert.match(source, /utilityMoney\(item\.costo\)/);
  assert.match(source, /utilityMoney\(item\.utilidad\)/);
});

test("supplier utility browser fixture includes ancillary response arrays", async () => {
  const fixture = JSON.parse(
    await readFile(new URL("../../test-fixtures/supplier-utility-browser-fixture.json", import.meta.url), "utf8"),
  ) as {
    responses: {
      "GET /api/dashboard": { inventarioPorUbicacion: unknown[] };
      "GET /api/pos/buscar": {
        rollos: Array<{ productoId: number; ubicacionId: number; cantidadActual: string }>;
        productos: unknown[];
      };
      "GET /api/inventario/entradas/3": { id: number };
      "GET /api/notificaciones": {
        sistema: unknown[];
        notificaciones: unknown[];
        porVencer: unknown[];
        vencidas: unknown[];
        clientesConMultiplesVencidas: unknown[];
      };
      "GET /api/proveedores/12/utilidad": {
        items: Array<{ lineaId: number; rolloId: number }>;
      };
      "GET /api/tickets/55": { id: number };
    };
  };
  const notifications = fixture.responses["GET /api/notificaciones"];
  assert.ok(Array.isArray(fixture.responses["GET /api/dashboard"].inventarioPorUbicacion));
  assert.equal(fixture.responses["GET /api/pos/buscar"].rollos.length, 2);
  assert.ok(
    fixture.responses["GET /api/pos/buscar"].rollos.every(
      (rollo) => rollo.productoId === 2 && rollo.ubicacionId === 1,
    ),
  );
  assert.ok(Array.isArray(fixture.responses["GET /api/pos/buscar"].productos));
  assert.ok(Array.isArray(notifications.sistema));
  assert.ok(Array.isArray(notifications.notificaciones));
  assert.ok(Array.isArray(notifications.porVencer));
  assert.ok(Array.isArray(notifications.vencidas));
  assert.ok(Array.isArray(notifications.clientesConMultiplesVencidas));
  assert.equal(fixture.responses["GET /api/inventario/entradas/3"].id, 3);
  assert.equal(fixture.responses["GET /api/tickets/55"].id, 55);
  assert.equal(fixture.responses["GET /api/proveedores/12/utilidad"].items[0].lineaId, 9);
  assert.notEqual(
    fixture.responses["GET /api/proveedores/12/utilidad"].items[0].rolloId,
    fixture.responses["GET /api/proveedores/12/utilidad"].items[1].rolloId,
  );
});