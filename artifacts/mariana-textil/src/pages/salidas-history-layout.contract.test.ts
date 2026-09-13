import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("history row layout has quantity branches, date without hour, and cancelled styles", async () => {
  const list = await readFile(new URL("./salidas.tsx", import.meta.url), "utf8");

  // Quantity branches
  assert.match(list, /qtySolicitada === qtyEnviada/);
  assert.match(list, /<span[^>]*>SOLICITADA<\/span>/);
  assert.match(list, /<span[^>]*>ENVIADA<\/span>/);

  // Date without hour
  assert.match(list, /format\(new Date\(salida\.createdAt\), "dd MMM yyyy", \{ locale: es \}\)/);

  // Cancelled no strikethrough, just muted
  assert.match(list, /isCancelled \? 'bg-slate-100\/70/);
  assert.match(list, /grid-cols-\[minmax\(0,1fr\)_64px_92px\]/);
  assert.match(list, /items-start/);
  assert.doesNotMatch(list, /nombreArmadoPor|line-through/);
  assert.doesNotMatch(list, /line-through/);

  // Action predicate same behavior
  assert.match(list, /canCancelSalidaHistory\(salida, user\)/);

  // VENTA_CLIENTE client name fallback
  assert.match(list, /salida\.nombreCliente \|\| \(salida\.clienteId \? `Cliente #\$\{salida\.clienteId\}` : "Cliente de venta"\)/);
});

test("history hides only closed delivery triggers without changing detail or verification gates", async () => {
  const delivery = await readFile(
    new URL("../components/salida-venta-entrega.tsx", import.meta.url),
    "utf8",
  );
  const list = await readFile(new URL("./salidas.tsx", import.meta.url), "utf8");
  assert.match(delivery, /if \(historyOnly && isTerminalSalida\(estado\)\) \{\s*return null;/);
  assert.match(delivery, /disabled=\{isTerminalSalida\(estado\)\}/);
  assert.match(delivery, /disabled=\{!canDeliver\}/);
  assert.match(delivery, /variant=\{historyOnly \? "ghost" : "outline"\}/);
  assert.match(list, /canCancel && !isCaja/);
  assert.match(list, /<SalidaVentaEntrega[\s\S]*?historyOnly/);
});
