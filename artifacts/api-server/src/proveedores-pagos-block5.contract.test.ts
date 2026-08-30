import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { RegistrarPagoProveedorBody, PreviewPagoProveedorBody } from "@workspace/api-zod";
import { allocateCreditFifo } from "./lib/credit-allocation";

test("Bloque 5: contrato de preview y confirmación no acepta entradaId", () => {
  const payment = { importe: 100, formaPago: "TRANSFERENCIA" };
  assert.equal(PreviewPagoProveedorBody.safeParse(payment).success, true);
  assert.equal(RegistrarPagoProveedorBody.safeParse(payment).success, true);
  // Zod object parsing strips unknown keys; the HTTP route rejects it explicitly.
  assert.equal(RegistrarPagoProveedorBody.safeParse({ ...payment, entradaId: 7 }).success, true);
});

test("Bloque 5: el mismo asignador genérico deriva FIFO, saldo y estados", () => {
  const allocation = allocateCreditFifo(
    [{ id: 90, availableCents: 10_000 }],
    [
      { id: 11, balanceCents: 4_200, createdAt: new Date("2026-01-01T00:00:00Z") },
      { id: 12, balanceCents: 3_500, createdAt: new Date("2026-01-02T00:00:00Z") },
    ],
  );
  assert.deepEqual(allocation.allocations.map((a) => [a.targetId, a.appliedCents]), [[11, 4200], [12, 3500]]);
  assert.equal(allocation.remainingCents, 2300);
  assert.equal(allocation.allocations[0]?.balanceAfterCents, 0, "SALDADA");
  assert.equal(allocation.allocations[1]?.balanceAfterCents, 0, "SALDADA");
});

test("Bloque 5: rutas delgadas usan el import del único asignador y exponen detalles bidireccionales", async () => {
  const service = await readFile(new URL("./lib/compras-proveedor.ts", import.meta.url), "utf8");
  const routes = await readFile(new URL("./routes/proveedores.ts", import.meta.url), "utf8");
  assert.match(service, /from "\.\/credit-allocation"/);
  assert.doesNotMatch(service, /function\s+allocate(?:Pago|Proveedor|Fifo)/);
  assert.match(service, /ADVISORY_LOCK_NAMESPACES\.SUPPLIER_LEDGER/);
  assert.match(service, /"PAGADA" \| "PARCIAL" \| "PENDIENTE"/);
  assert.match(routes, /\/proveedores\/:id\/pagos\/preview/);
  assert.match(routes, /\/proveedores\/:id\/compras\/:compraId/);
  assert.match(routes, /WHERE entrada_id=\$\{params\.data\.compraId\}/);
  assert.match(routes, /a\.compra_proveedor_id=\$\{compraMovimientoId\}/);
  assert.match(routes, /compra: presentPagoProveedor\(compra\.rows\[0\]\)/);
  assert.match(routes, /pago: presentPagoProveedor\(pago\.rows\[0\]\)/);
  assert.match(routes, /movimiento_origen_id=a\.pago_proveedor_id\) AS revertido/);
  assert.match(routes, /\/proveedores\/:id\/pagos\/:pagoId/);
  assert.match(routes, /entradaId no se admite/);
});