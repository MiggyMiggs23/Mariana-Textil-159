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
});