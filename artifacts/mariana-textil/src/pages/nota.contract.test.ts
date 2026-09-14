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
  assert.match(notaCredito, /estadoNota === "PAGADA"/);
  assert.match(notaCredito, /estadoNota === "CON_RETRASO"/);
  assert.match(notaCredito, /estadoNota === "PENDIENTE"/);
  assert.match(notaCredito, /saldoPendiente/);
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
  assert.match(ticketDetail, /onSuccess:\s*\(\)\s*=>\s*\{\s*void printWhenReady\("print-credito"\);/);
});

test("Block 4 functionality in cobros", async () => {
  const cobros = await readFile(new URL("artifacts/mariana-textil/src/pages/cobros.tsx", root), "utf8");

  // El listado solo recibe el folio visible, no el ID interno que exige /tickets/:id.
  // Debe conservar texto en vez de fabricar un enlace muerto con el folio.
  assert.doesNotMatch(cobros, /<Link href=\{`\/tickets\/\$\{nota\.ticketFolio\}`\}/);
  assert.match(cobros, /\{nota\.ticketFolio\}/);
});

test("Nota keeps the 5.25mm root safe area and uses an inner ink frame", async () => {
  const ticketDetail = await readFile(new URL("artifacts/mariana-textil/src/pages/ticket-detail.tsx", root), "utf8");
  const notaPrint = ticketDetail.slice(
    ticketDetail.indexOf("{/* Nota Print Pages */}"),
    ticketDetail.indexOf("<Dialog open={cancelOpen}"),
  );

  assert.match(
    notaPrint,
    /credito-page-print w-\[148mm\] h-\[210mm\] p-\[5\.25mm\][\s\S]*overflow-visible/,
  );
  assert.match(
    notaPrint,
    /nota-page-frame relative[\s\S]*border border-gray-200 bg-white/,
  );
  assert.doesNotMatch(notaPrint, /credito-page-print bg-white/);
  assert.match(notaPrint, /Laser PDF validation: eight complete product rows/);
  assert.match(notaPrint, /ninth row starts the next sheet/);
  assert.match(notaPrint, /document-product-grid/);
  assert.match(notaPrint, /data-testid="note-legal-block"/);
  assert.match(notaPrint, /data-testid="note-signature-block"/);
});
