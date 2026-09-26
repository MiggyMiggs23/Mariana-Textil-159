import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const inventarioPage = await readFile(new URL("./inventario.tsx", import.meta.url), "utf8");

test("Detalle de Rollos ofrece selección visible con estado mixto y límite explícito", () => {
  assert.match(inventarioPage, /updateVisibleLabelSelection/);
  assert.match(inventarioPage, /updateVisibleLabelSelection\(current, visibleRollos, true, 50\)/);
  assert.match(inventarioPage, /rollosRes\?\.items/);
  assert.match(inventarioPage, /"indeterminate"/);
  assert.match(inventarioPage, /máximo por operación es 50/);
  assert.match(inventarioPage, /page: 1,\s*pageSize: 100/);
});

test("las tarjetas detienen la navegación al seleccionar y solo reimprimen la selección visible", () => {
  assert.match(inventarioPage, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(inventarioPage, /onClick=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(inventarioPage, /rolloIds=\{selectedVisibleRollos\.map\(\(rollo\) => rollo\.id\)\}/);
  assert.match(inventarioPage, /onSuccess=\{\(\) => setSelectedRollos\(new Map\(\)\)\}/);
  assert.match(inventarioPage, /hasPermission\(user, Modules\.ETIQUETAS, "crear"\)/);
});

test("las selecciones se limpian al cambiar contexto y se podan al cambiar resultados", () => {
  assert.match(inventarioPage, /useEffect\(\(\) => \{[\s\S]*setSelectedRollos\(\(current\) => current\.size > 0 \? new Map\(\) : current\)/);
  assert.match(inventarioPage, /\[search, estadoFilter, pisoFilter, activeTab, effectiveUbicacionId\]/);
  assert.match(inventarioPage, /const visibleIds = new Set\(visibleRollos\.map\(\(rollo\) => rollo\.id\)\)/);
  assert.match(inventarioPage, /\[visibleRolloIds, selectedRollos\.size\]/);
});

test("el diálogo de impresión permanece montado fuera de TabsContent mientras imprime", () => {
  const tabsEnd = inventarioPage.lastIndexOf("</Tabs>");
  const dialog = inventarioPage.lastIndexOf("<ReprintLabelsDialog");
  assert.ok(tabsEnd >= 0 && dialog > tabsEnd, "el portal compartido no debe desmontarse al cambiar de pestaña");
});