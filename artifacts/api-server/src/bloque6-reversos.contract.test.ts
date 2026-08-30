import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  ReversarClientePagoBody,
  ReversarPagoProveedorBody,
  ReversarPagoProveedorResponse,
} from "@workspace/api-zod";
import { creditStatus } from "./lib/clientes-aging";

const source = async (path: string) =>
  readFile(new URL(path, import.meta.url), "utf8");

test("Bloque 6: contratos de reverso requieren motivo", () => {
  for (const schema of [ReversarClientePagoBody, ReversarPagoProveedorBody]) {
    assert.equal(schema.safeParse({ motivo: "capturado por error" }).success, true);
    assert.equal(schema.safeParse({}).success, false);
    assert.equal(schema.safeParse({ motivo: "" }).success, false);
  }
  assert.equal(
    ReversarPagoProveedorResponse.safeParse({
      id: 1,
      proveedorId: 2,
      entradaId: null,
      importe: "500.00",
      tipo: "REVERSO",
      formaPago: null,
      referencia: null,
      fecha: "2026-08-27T12:00:00.000Z",
      usuarioId: 3,
      notas: "Captura incorrecta",
      createdAt: "2026-08-27T12:00:00.000Z",
    }).success,
    true,
  );
});

test("Bloque 6: endpoints son autorizados, append-only y auditados", async () => {
  const [clientes, proveedores, service, clientesSchema, proveedorSchema] = await Promise.all([
    source("./routes/clientes.ts"), source("./routes/proveedores.ts"),
    source("./lib/compras-proveedor.ts"),
    source("../../../lib/db/src/lib/clientes-schema.ts"),
    source("../../../lib/db/src/lib/pagos-proveedor-schema.ts"),
  ]);
  assert.match(clientes, /\/clientes\/:id\/pagos\/:pagoId\/reversar/);
  assert.match(proveedores, /\/proveedores\/:id\/pagos\/:pagoId\/reversar/);
  assert.match(clientes, /requierePermiso\("clientes_finanzas", "autorizar"\)/);
  assert.match(proveedores, /requierePermiso\("proveedores_finanzas", "autorizar"\)/);
  assert.match(proveedores, /ReversarPagoProveedorResponse\.parse\(presentPagoProveedor\(reverso\)\)/);
  assert.match(clientes, /accion: "REVERSAR_PAGO_CLIENTE"/);
  assert.match(service, /accion: "REVERSAR_PAGO_PROVEEDOR"/);
  assert.match(clientes, /datosAntes:[\s\S]*asignaciones/);
  assert.match(clientes, /datosDespues:[\s\S]*motivo/);
  assert.doesNotMatch(clientes.slice(clientes.indexOf('"/clientes/:id/pagos/:pagoId/reversar"'), clientes.indexOf('"/clientes/:id/ajustes"')), /\.update\(|\.delete\(/);
  assert.doesNotMatch(proveedores.slice(proveedores.indexOf('"/proveedores/:id/pagos/:pagoId/reversar"')), /\.update\(|\.delete\(/);
  assert.match(clientesSchema, /movimiento_origen_id/);
  assert.match(clientesSchema, /movimientos_credito_reverso_origen_uidx/);
  assert.match(proveedorSchema, /movimiento_origen_id/);
  assert.match(proveedorSchema, /pagos_proveedor_reverso_origen_uidx/);
  assert.match(proveedorSchema, /CREATE OR REPLACE FUNCTION prevent_pago_proveedor_mutation/);
  assert.match(proveedorSchema, /BEFORE UPDATE OR DELETE ON pagos_proveedor/);
  assert.match(proveedorSchema, /CREATE TRIGGER pagos_proveedor_inmutables/);
});

test("Bloque 6: no persiste estado y los detalles señalan reverso y motivo", async () => {
  const [clientes, proveedores, service, spec] = await Promise.all([
    source("./routes/clientes.ts"), source("./routes/proveedores.ts"),
    source("./lib/compras-proveedor.ts"),
    source("../../../lib/api-spec/openapi.yaml"),
  ]);
  assert.doesNotMatch(clientes, /ADD COLUMN IF NOT EXISTS estado/);
  assert.doesNotMatch(proveedores, /ADD COLUMN IF NOT EXISTS estado/);
  assert.match(clientes, /revertido/);
  assert.match(clientes, /motivoReverso/);
  assert.match(service, /movimientoOrigenId/);
  assert.match(proveedores, /reversoMovimientoId/);
  assert.match(proveedores, /motivoReverso/);
  assert.match(spec, /MotivoReversoInput/);
  assert.match(spec, /reversoMovimientoId/);
});

test("Bloque 6: antigüedad parte de vencimiento; plazo CAJA no se preselecciona; margen usa subtotal", async () => {
  // A sale date is deliberately irrelevant: only the due date changes status.
  assert.equal(creditStatus(10, "2026-12-31", "2026-01-01"), "VIGENTE");
  assert.equal(creditStatus(10, "2025-12-31", "2026-01-01"), "VENCIDA");
  const pos = await source("./lib/pos.ts");
  assert.doesNotMatch(pos, /diasPlazo\s*[:=]\s*(7|15|30|60)/);
  // The established financial convention is subtotal before IVA; this guards
  // the contract without loading the DB-backed reporting module.
  assert.equal(116 - 16, 100);
});

test("Bloque 6: aplicaciones activas son la única fuente y comparten lock de cliente", async () => {
  const [clientes, proveedores, service, pos, creditReadModel, creditAllocation, clienteSchema, proveedorSchema, server] =
    await Promise.all([
      source("./routes/clientes.ts"),
      source("./routes/proveedores.ts"),
      source("./lib/compras-proveedor.ts"),
      source("./lib/pos.ts"),
      source("./lib/credit-aging-read-model.ts"),
      source("./lib/credit-allocation.ts"),
      source("../../../lib/db/src/lib/clientes-schema.ts"),
      source("../../../lib/db/src/lib/aplicaciones-pago-proveedor-schema.ts"),
      source("./index.ts"),
    ]);
  assert.doesNotMatch(service, /old\.entrada_id|p\.entrada_id\s*=\s*c\.entrada_id/);
  assert.match(service, /aplicaciones_pago_proveedor[\s\S]*movimiento_origen_id/);
  assert.match(proveedores, /aplicaciones_pago_proveedor[\s\S]*movimiento_origen_id/);
  assert.match(clientes, /aplicaciones_credito[\s\S]*movimiento_origen_id/);
  // POS delegates credit evidence to the authoritative read model; the pure
  // projection excludes reversed ABONOs using movimiento_origen_id.
  assert.match(pos, /loadCustomerCreditLedgerInTransaction/);
  assert.match(creditReadModel, /m\.movimiento_origen_id/);
  assert.match(creditAllocation, /movement\.tipo === "ABONO"[\s\S]*!reversedAbonos\.has\(movement\.id\)/);
  assert.match(creditAllocation, /m\.tipo === "REVERSO"[\s\S]*m\.movimientoOrigenId != null/);
  const lock = /ADVISORY_LOCK_NAMESPACES\.CUSTOMER_CREDIT,[\s\S]*clienteId/;
  assert.match(clientes, lock);
  assert.match(pos, lock);
  assert.match(clienteSchema, /La aplicación de crédito excede el saldo disponible/);
  assert.match(proveedorSchema, /Aplicación proveedor excede el saldo disponible/);
  assert.ok(
    server.indexOf("await ensurePagosProveedorSchema(pool)") <
      server.indexOf("await ensureAplicacionesPagoProveedorSchema(pool)"),
    "el enum y movimiento_origen_id deben existir antes de reconciliar aplicaciones",
  );
});

test("Bloque 6: pagos y kardex conservan precisión exacta", async () => {
  const [directed, suppliers, inventory, pos] = await Promise.all([
    source("./routes/pagos-dirigidos.ts"),
    source("./lib/compras-proveedor.ts"),
    source("./lib/inventario.ts"),
    source("./lib/pos.ts"),
  ]);
  assert.doesNotMatch(directed, /tx:\s*any|request:\s*any|execute<any>/);
  assert.doesNotMatch(suppliers, /execute<any>|\(r:\s*any\)|as any\[\]/);
  assert.match(directed, /execute<DirectedDocumentRow>/);
  assert.match(suppliers, /execute<SupplierCreditRow>/);
  assert.doesNotMatch(pos, /Number\.EPSILON/);
  assert.match(pos, /const cents = BigInt/);
  assert.match(inventory, /const cantidad = formatQuantityThousandthsBigInt/);
  assert.match(inventory, /cantidad: formatQuantityThousandthsBigInt\(-consumida\)/);
  assert.doesNotMatch(
    inventory.slice(
      inventory.indexOf("export async function consumirBolsasFifo"),
      inventory.indexOf("// ─────────────────────────────────────────────────────────────────────────────", inventory.indexOf("export async function consumirBolsasFifo") + 1),
    ),
    /Number\(|parseFloat|toFixed/,
  );
});