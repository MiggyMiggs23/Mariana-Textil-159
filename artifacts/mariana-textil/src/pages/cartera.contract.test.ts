import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);

test("Cartera functionality respects block 2 constraints", async () => {
  const cobros = await readFile(new URL("artifacts/mariana-textil/src/pages/cobros.tsx", root), "utf8");
  const pagoDialog = await readFile(new URL("artifacts/mariana-textil/src/components/cliente-pago-dialog.tsx", root), "utf8");
  const ticketDetail = await readFile(new URL("artifacts/mariana-textil/src/pages/ticket-detail.tsx", root), "utf8");

  // 1. QR points to /cobros?tab=cartera&ticketId=<id>
  assert.match(ticketDetail, /\/cobros\?tab=cartera&ticketId=\$\{ticket.id\}/);

  // 2. Scan parsing handles URL and folio
  assert.match(cobros, /url\.pathname\.startsWith\("\/tickets\/"\)/);
  assert.match(cobros, /url\.searchParams\.get\("ticketId"\)/);
  assert.match(cobros, /test\(value\)/);
  assert.match(cobros, /setSearchFolio\(parseInt/);

  // 3. Order is oldest to newest
  assert.match(cobros, /sort\(\(a, b\) => new Date\(a\.fecha!\)\.getTime\(\) - new Date\(b\.fecha!\)\.getTime\(\)\)/);

  // 4. Highlight without isolating
  assert.match(cobros, /const isHighlighted = nota\.ticketFolio === ticket\.folio;/);
  assert.match(cobros, /bg-primary\/10 border-primary\/20/);
  assert.doesNotMatch(cobros, /filter.*nota\.ticketFolio === ticket\.folio/);

  // 5. Absence of 'marcar pagada'
  assert.doesNotMatch(cobros, /marcar pagada/i);
  assert.doesNotMatch(cobros, /mark as paid/i);

  // 6. Payment is not directed to a note
  // Since dialog doesnt have ticketId field, it implicitly doesnt send it (it uses { importe, formaPago, cuentaDestino, referencia, notas, fechaEfectiva })
  assert.doesNotMatch(pagoDialog, /ticketId:/);

  // 7. Filtering for VENTA_CREDITO with pending balance
  assert.match(cobros, /m\.tipo === "VENTA_CREDITO" && m\.estado !== "PAGADA"/);

  // 8. Checking for specific implementation details added
  // Parse date properly to avoid YYYY-MM-DD UTC shift
  assert.match(cobros, /T12:00:00/);

  // Checking for stable key without Math.random()
  assert.doesNotMatch(cobros, /Math\.random\(\)/);

  // Checking for the label ESCANEADA
  assert.match(cobros, /ESCANEADA/);
  assert.doesNotMatch(cobros, />\s*ESCANEA\s*</);

  // Checking that explicit type is used instead of any
  assert.match(cobros, /const defaultTab: "operativa" | "historial" | "cartera" =/);
  assert.doesNotMatch(cobros, /defaultTab as any/);

  // Checking that saldoPendiente is rendered
  assert.match(cobros, /nota\.saldoPendiente/);
});

test("Block 3 functionality in payment dialog", async () => {
  const pagoDialog = await readFile(new URL("artifacts/mariana-textil/src/components/cliente-pago-dialog.tsx", root), "utf8");

  // - En el diálogo de abono de Cartera, flujo obligatorio de dos pasos: capturar monto -> Vista previa -> Confirmar abono.
  assert.match(pagoDialog, /step === "form"/);
  assert.match(pagoDialog, /step === "preview"/);
  assert.match(pagoDialog, /step === "success"/);
  assert.match(pagoDialog, /usePreviewClientePago/);
  assert.match(pagoDialog, /useCreateClientePago/);

  // - EFECTIVO fija/solo permite CAJA_FISICA.
  assert.match(pagoDialog, /setDestinationAccount\("CAJA_FISICA"\)/);
  assert.match(pagoDialog, /paymentMethod === "EFECTIVO"/);
  assert.match(pagoDialog, /formatAccountDestination\("CAJA_FISICA"\)/); // fixed display

  // - TRANSFERENCIA exige escoger CUENTA_FISCAL o CUENTA_NO_FISCAL sin preselección conservadora.
  assert.match(pagoDialog, /setDestinationAccount\(""\)/); // forces user to choose

  // - Si monto/forma/destino/referencia/notas cambia tras preview, invalida preview y obliga a recalcular.
  assert.match(pagoDialog, /handleInputChange/);
  assert.match(pagoDialog, /setPreviewData\(null\)/);

  // - Mostrar texto y tabla clara como ejemplo del usuario
  assert.match(pagoDialog, /Reparto de abono \(FIFO\)/);
  assert.match(pagoDialog, /asig.resultado/);

  // - Mostrar saldo a favor si sobra.
  assert.match(pagoDialog, /saldoAFavor/);
  assert.match(pagoDialog, /Saldo a Favor Generado/);

  // - Al confirmar, usar reparto real devuelto por create; refrescar cuenta y conservar una confirmación visible del resultado real
  assert.match(pagoDialog, /setRealResult\(data\)/);
  assert.match(pagoDialog, /Resumen de aplicación/);
});
