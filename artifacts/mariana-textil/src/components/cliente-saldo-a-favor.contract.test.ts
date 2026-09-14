import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("customer payment receipt exposes excess and resulting favor", async () => {
  const source = await readFile(new URL("./cliente-pago-dialog.tsx", import.meta.url), "utf8");
  assert.match(source, /Excedente recibido/);
  assert.match(source, /Saldo a favor resultante/);
  assert.match(source, /saldoAFavorGenerado/);
  assert.match(source, /receipt-payment-excess/);
});

test("cash authorization offers favor without selecting it automatically", async () => {
  const source = await readFile(new URL("../pages/cobros.tsx", import.meta.url), "utf8");
  assert.match(source, /saldoAFavorDisponible/);
  assert.match(source, /aplicarSaldoAFavor/);
  assert.match(source, /setAplicarSaldoAFavor\(false\)/);
  assert.match(source, /checkbox-apply-saldo-a-favor/);
  assert.match(source, /aplicarSaldoAFavor: amountToApply/);
});