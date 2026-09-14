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
  assert.doesNotMatch(source, /Rollos\/líneas vendidos excluidos/);
  assert.match(source, /ENTRADA.*asociada al rollo/);
  assert.match(source, /formatNumber\(item\.cantidad, \{ kind: "quantity" \}\).*formatUnit\(item\.unidad\)/s);
  assert.match(source, /item\.ticketFolio/);
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