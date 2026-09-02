import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);

test("Block 5 functionality in proveedor UI", async () => {
  const provDetail = await readFile(new URL("artifacts/mariana-textil/src/pages/proveedor-detail.tsx", root), "utf8");
  const pagoDialog = await readFile(new URL("artifacts/mariana-textil/src/components/proveedor-pago-dialog.tsx", root), "utf8");
  const compraDialog = await readFile(new URL("artifacts/mariana-textil/src/components/proveedor-compra-detalle.tsx", root), "utf8");

  // - Flujo obligatorio formulario -> vista previa FIFO -> confirmar -> resumen real.
  assert.match(pagoDialog, /step === "form"/);
  assert.match(pagoDialog, /step === "preview"/);
  assert.match(pagoDialog, /step === "success"/);

  // - No selector de entrada/compra y no enviar entradaId
  assert.doesNotMatch(pagoDialog, /entradaId:/);

  // - Preview muestra compra/folio/fecha/saldoAntes/aplicado/saldoDespues/SALDADA|PARCIAL y saldo a favor.
  assert.match(pagoDialog, /usePreviewPagoProveedor/);
  assert.match(pagoDialog, /asig.saldoAntes/);
  assert.match(pagoDialog, /asig.saldoDespues/);
  assert.match(pagoDialog, /saldoAFavor/);

  // - Captura nueva: solo EFECTIVO/TRANSFERENCIA/FACTURADO; CHEQUE/OTRO históricos no se seleccionan.
  assert.match(pagoDialog, /FormaPagoProveedor\.EFECTIVO/);
  assert.match(pagoDialog, /FormaPagoProveedor\.FACTURADO/);
  assert.doesNotMatch(pagoDialog, /FormaPagoProveedor\.(CHEQUE|OTRO)/);

  // - Si se edita cualquier dato tras preview, obliga a recalcular.
  assert.match(pagoDialog, /handleInputChange/);
  assert.match(pagoDialog, /setPreviewData\(null\)/);

  // - Lista de compras muestra estado derivado y saldo pendiente
  assert.match(provDetail, /compra\.saldoPendiente/);
  assert.match(provDetail, /compra\.estado === CompraConEstadoEstado\.PAGADA/);

  // - Abrir compra muestra todos los pagos que la tocaron
  assert.match(compraDialog, /useGetProveedorCompraDetalle/);
  assert.match(compraDialog, /compraDetalle\.aplicaciones\.map/);

  // - Abrir pago muestra todas las compras que tocó
  assert.match(compraDialog, /useGetProveedorPagoDetalle/);
  assert.match(compraDialog, /pagoDetalle\.aplicaciones\.map/);

  // - Corrige gating: proveedores_finanzas.ver/crear, no isAdmin
  assert.match(provDetail, /Modules\.PROVEEDORES_FINANZAS, "ver"/);
  assert.match(provDetail, /Modules\.PROVEEDORES_FINANZAS, "crear"/);
  // Just confirm we removed the old isAdmin usages from the gating
  assert.doesNotMatch(provDetail, /const isAdmin = user\?\.rol === Role\.ADMIN;/);
});
