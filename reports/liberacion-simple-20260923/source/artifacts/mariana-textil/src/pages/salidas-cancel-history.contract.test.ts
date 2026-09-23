import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("history uses the shared cancellation dialog for its responsive rows", async () => {
  const list = await readFile(new URL("./salidas.tsx", import.meta.url), "utf8");
  const dialog = await readFile(
    new URL("../components/salida-cancel-dialog.tsx", import.meta.url),
    "utf8",
  );
  const detail = await readFile(new URL("./salida-detail.tsx", import.meta.url), "utf8");

  assert.match(list, /canCancelSalidaHistory\(salida, user\)/);
  assert.match(list, /data-testid=\{`btn-history-cancel-\$\{salida\.id\}`\}/);
  assert.match(list, /<SalidaCancelDialog[\s\S]*isHistory/);
  assert.match(list, /<SalidaEstadoBadge estado=\{salida\.estado\}/);
  assert.match(dialog, /useGetSalida/);
  assert.match(dialog, /await freshQuery\.refetch\(\)/);
  assert.match(
    dialog,
    /isHistory[\s\S]*canCancelSalidaHistory\(freshSalida, user\)[\s\S]*canCancelSalidaDetail\(freshSalida, user\)/,
  );
  assert.doesNotMatch(dialog, /useListPisosLocation|locations\/.*pisos/);
  assert.match(dialog, /freshSalida\?\.pisosRetorno/);
  assert.match(dialog, /Array\.isArray\(returnFloorsPayload\)/);
  assert.match(dialog, /Piso de retorno al origen/);
  assert.match(dialog, /pisoRetornoId/);
  assert.match(dialog, /Recargar salida/);
  assert.match(dialog, /no se asumirá que no\s+hay pisos/);
  assert.match(dialog, /max-h-\[90vh\] overflow-y-auto/);
  assert.match(dialog, /cancel-refresh-loading/);
  assert.match(dialog, /cancel-refresh-error/);
  assert.match(dialog, /motivo\.trim\(\)\.length < 10/);
  assert.match(dialog, /freshSalida\.estado === "EN_TRANSITO"/);
  assert.match(dialog, /Todos los rollos regresarán al origen original/);
  assert.match(dialog, /movimientos compensatorios trazables/);
  assert.match(dialog, /operación es atómica/);
  assert.match(dialog, /Cancelar documento y todas sus salidas/);
  assert.match(detail, /<SalidaCancelDialog/);
  assert.match(detail, /canCancelSalidaDetail\(salida, user\)/);
  assert.doesNotMatch(detail, /const canAuthorize =/);
  assert.doesNotMatch(list, /setLocation\(`\/salidas\/\$\{salida\.id\}`\)/);
});

test("shared cancellation invalidates salida, stock, and linked ticket caches", async () => {
  const dialog = await readFile(
    new URL("../components/salida-cancel-dialog.tsx", import.meta.url),
    "utf8",
  );

  assert.match(dialog, /getGetSalidaQueryKey\(cancelled\.id\)/);
  assert.match(dialog, /isSalidaDetailQueryKey/);
  assert.match(dialog, /getListSalidasQueryKey\(\)/);
  assert.match(dialog, /getListRollosQueryKey\(\)/);
  assert.match(dialog, /getGetExistenciasQueryKey\(\)/);
  assert.match(dialog, /getGetExistenciasAgrupadasQueryKey\(\)/);
  assert.match(dialog, /getObtenerTicketQueryKey\(linkedDocumentId\)/);
  assert.match(dialog, /getListarTicketsQueryKey\(\)/);
});