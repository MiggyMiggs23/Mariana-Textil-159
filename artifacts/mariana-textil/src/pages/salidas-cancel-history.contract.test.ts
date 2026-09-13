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
  assert.match(dialog, /cancel-refresh-loading/);
  assert.match(dialog, /cancel-refresh-error/);
  assert.match(dialog, /motivo\.trim\(\)\.length < 10/);
  assert.match(dialog, /operación es atómica/);
  assert.match(dialog, /Cancelar documento y todas sus salidas/);
  assert.match(detail, /<SalidaCancelDialog/);
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