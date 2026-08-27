import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);

test("Block 4 functionality in ticket detail", async () => {
  const ticketDetail = await readFile(new URL("artifacts/mariana-textil/src/pages/ticket-detail.tsx", root), "utf8");
  const notaCredito = await readFile(new URL("artifacts/mariana-textil/src/components/cliente-nota-credito.tsx", root), "utf8");

  // - En /tickets/:id, cuando ticket.esCredito y clienteId existe, carga detalle de nota
  assert.match(ticketDetail, /<ClienteNotaCredito/);
  
  // - Show derived state, balance, vencimiento, días vencidos
  assert.match(notaCredito, /nota\.estado === "PAGADA"/);
  assert.match(notaCredito, /nota\.estado === "PARCIAL"/);
  assert.match(notaCredito, /nota\.estado === "PENDIENTE"/);
  assert.match(notaCredito, /nota\.saldoActual/);
  assert.match(notaCredito, /nota\.diasVencidos/);
  assert.match(notaCredito, /nota\.fechaVencimiento/);

  // - List all abonos that touched it: fecha, aplicado, total abono, forma, cuenta, ref, usuario.
  assert.match(notaCredito, /abono\.fecha/);
  assert.match(notaCredito, /abono\.montoAplicado/);
  assert.match(notaCredito, /abono\.formaPago/);
  assert.match(notaCredito, /abono\.referencia/);
  assert.match(notaCredito, /abono\.usuarioRegistrador/);
  assert.match(notaCredito, /abono\.montoTotalAbono/);

  // - Cada abono abre un diálogo con detalle inverso
  assert.match(notaCredito, /setSelectedPagoId\(abono\.movimientoPagoId\)/);
  assert.match(notaCredito, /useGetClientePagoDetalle/);
  assert.match(notaCredito, /pagoDetalle\.aplicaciones\.map/);

  // - El botón imprimir/reimprimir de nota de crédito debe llamar primero useReimprimirClienteNota; solo en onSuccess ejecuta impresión
  assert.match(ticketDetail, /useReimprimirClienteNota\(\)/);
  assert.match(ticketDetail, /reimprimirNota\.mutate/);
  assert.match(ticketDetail, /onSuccess:\s*\(\)\s*=>\s*\{\s*document\.body\.classList\.add\("print-credito"\);\s*window\.print\(\);/);
});

test("Block 4 functionality in cobros", async () => {
  const cobros = await readFile(new URL("artifacts/mariana-textil/src/pages/cobros.tsx", root), "utf8");
  
  // - Desde Cartera, cada fila de nota debe permitir abrir /tickets/:ticketId para ver este detalle
  assert.match(cobros, /<Link href=\{`\/tickets\/\$\{nota\.ticketFolio\}`\}/);
});
