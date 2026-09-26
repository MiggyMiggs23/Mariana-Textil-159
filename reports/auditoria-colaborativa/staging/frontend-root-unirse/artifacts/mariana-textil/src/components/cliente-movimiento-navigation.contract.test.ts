import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, root), "utf8");
}

const linkClass =
  "text-primary underline underline-offset-4 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

test("ResponsiveTable keeps the ticket destination while accepting explicit row destinations", async () => {
  const table = await source("artifacts/mariana-textil/src/components/client-responsive-table.tsx");

  assert.match(table, /href\?: string \| null/);
  assert.match(table, /linkLabel\?: ReactNode/);
  assert.match(table, /row\.href \?\? `\/tickets\/\$\{row\.ticketId\}`/);
  assert.match(table, /row\.linkLabel \?\? cell/);
});

test("credit statement rows link ABONO, REVERSO, and AJUSTE without changing VENTA links", async () => {
  const page = await source("artifacts/mariana-textil/src/pages/cliente-detail.tsx");

  assert.match(page, /new Set\(\["ABONO", "REVERSO", "AJUSTE"\]\)/);
  assert.match(page, /`\/clientes\/\$\{clienteId\}\/movimientos\/\$\{movement\.movimientoId\}`/);
  assert.match(page, /getMovementDetailLabel\(item\)/);
  assert.match(page, /ticketId: item\.ticketId/);
  assert.match(page, /<StatementMovementLink clienteId=\{clienteId\} movement=\{item\} \/>/);
  assert.match(page, /<SelectItem value="REVERSO">Reversos<\/SelectItem>/);
  assert.match(page, new RegExp(linkClass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("the existing account return highlight is preserved for desktop and mobile", async () => {
  const page = await source("artifacts/mariana-textil/src/pages/cliente-detail.tsx");

  assert.match(page, /new URLSearchParams\(search\)\.get\("movimientoId"\)/);
  assert.match(page, /data-highlighted=\{highlighted \? "true" : undefined\}/);
  assert.match(page, /statement-mobile-row-\$\{item\.movimientoId\}/);
});

test("note payment rows expose a real movement-detail anchor and keep the reparto flow", async () => {
  const note = await source("artifacts/mariana-textil/src/components/cliente-nota-credito.tsx");

  assert.match(note, /href=\{`\/clientes\/\$\{clienteId\}\/movimientos\/\$\{abono\.movimientoPagoId\}`\}/);
  assert.match(note, /ABONO · Movimiento #\{abono\.movimientoPagoId\}/);
  assert.match(note, /Ver Reparto/);
  assert.match(note, /setSelectedPagoId\(abono\.movimientoPagoId\)/);
  assert.match(note, /setReversoPagoId\(abono\.movimientoPagoId\)/);
});

test("movement detail route is finance-guarded and audit links never invent a client", async () => {
  const [app, audit] = await Promise.all([
    source("artifacts/mariana-textil/src/App.tsx"),
    source("artifacts/mariana-textil/src/pages/auditoria/index.tsx"),
  ]);

  assert.match(app, /path="\/clientes\/:id\/movimientos\/:movimientoId"/);
  assert.match(app, /component=\{ClienteMovimientoDetail\}/);
  assert.match(app, /allowedModule=\{Modules\.CLIENTES_FINANZAS\}/);
  assert.match(audit, /reference\.entidad\?\.toLowerCase\(\) !== "movimientos_credito"/);
  assert.match(audit, /return reference\.documentoRuta \?\? null/);
  // The shared server resolver owns this destination. Never reconstruct it
  // from an audit's ID or a guessed client in the browser.
  assert.doesNotMatch(audit, /`\/clientes\/\$\{[^}]+\}\/movimientos\//);
  assert.doesNotMatch(audit, /clienteId\s*=\s*1/);
});

test("roll history consumes the shared resolved movement-document component", async () => {
  const roll = await source("artifacts/mariana-textil/src/pages/rollo-detail.tsx");

  assert.match(roll, /import \{ MovimientoDocumento, type MovimientoDocumentoReference \}/);
  assert.match(roll, /<MovimientoDocumento[\s\S]*?movimiento=\{movementDocument\}/);
  assert.match(roll, /data-testid=\{`link-rollo-documento-\$\{mov\.id\}`\}/);
});