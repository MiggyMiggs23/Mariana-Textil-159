import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("la estación de auditoría integra contrato, escáner, polling e impresión", async () => {
  const source = await readFile(
    new URL("./auditorias-inventario.tsx", import.meta.url),
    "utf8",
  );
  for (const hook of [
    "useListSitiosAuditoriaInventario",
    "useListAuditoriasInventario",
    "useCreateAuditoriaInventario",
    "useGetAuditoriaInventario",
    "useScanAuditoriaInventario",
    "useCloseAuditoriaInventario",
    "useCancelAuditoriaInventario",
    "useConfirmAuditoriaInventario",
  ]) {
    assert.match(source, new RegExp(hook));
  }
  assert.match(source, /<CampoEscaneo/);
  assert.match(source, /refetchInterval/);
  assert.match(source, /print-auditoria-inventario/);
  assert.match(source, /text-audit-duration/);
  assert.match(source, /row\.cantidad/);
  assert.match(source, /data-testid="input-audit-scan"/);
  assert.match(source, /hasPermission\(user, Modules\.PRODUCTOS, "crear"\)/);
  assert.match(source, /useCreateProducto/);
  assert.match(source, /button-audit-add-product-color/);
  assert.match(source, /No registra ni asocia ninguna serie/);
  assert.match(source, /scanRef\.current\?\.focus/);
});