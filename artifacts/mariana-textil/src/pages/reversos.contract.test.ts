import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);

test("Block 6 reversos functionality in clientes UI", async () => {
  const clienteNotaCredito = await readFile(new URL("artifacts/mariana-textil/src/components/cliente-nota-credito.tsx", root), "utf8");

  // - Permiso clientes_finanzas.autorizar
  assert.match(clienteNotaCredito, /hasPermission\(user, Modules\.CLIENTES_FINANZAS, 'autorizar'\)/);

  // - Exige motivo y confirmación textual exacta REVERSAR antes de llamar API.
  assert.match(clienteNotaCredito, /setReversoMotivo/);
  assert.match(clienteNotaCredito, /reversoConfirm !== "REVERSAR"/);
  assert.match(clienteNotaCredito, /reversoMotivo\.trim\(\)\.length < 5/);

  // - Llama API correcta
  assert.match(clienteNotaCredito, /useReversarClientePago/);
  
  // - Invalida/refresca consultas para que estado vuelva automaticamente
  assert.match(clienteNotaCredito, /queryClient\.invalidateQueries/);
  assert.match(clienteNotaCredito, /getGetClienteNotaCreditoQueryKey/);
  assert.match(clienteNotaCredito, /abono\.revertido \?/);
  assert.match(clienteNotaCredito, />\s*REVERTIDO\s*</);

  // - No DELETE / No estado manual
  assert.doesNotMatch(clienteNotaCredito, /DELETE/i);
  assert.doesNotMatch(clienteNotaCredito, /marcarPagada/i);
});

test("Block 6 reversos functionality in proveedores UI", async () => {
  const proveedorCompra = await readFile(new URL("artifacts/mariana-textil/src/components/proveedor-compra-detalle.tsx", root), "utf8");

  // - Permiso proveedores_finanzas.autorizar
  assert.match(proveedorCompra, /hasPermission\(user, Modules\.PROVEEDORES_FINANZAS, 'autorizar'\)/);

  // - Exige motivo y confirmación textual exacta REVERSAR antes de llamar API.
  assert.match(proveedorCompra, /setReversoMotivo/);
  assert.match(proveedorCompra, /reversoConfirm !== "REVERSAR"/);
  assert.match(proveedorCompra, /reversoMotivo\.trim\(\)\.length < 5/);

  // - Llama API correcta
  assert.match(proveedorCompra, /useReversarPagoProveedor/);
  
  // - Invalida/refresca consultas para que estado vuelva automaticamente
  assert.match(proveedorCompra, /queryClient\.invalidateQueries/);
  assert.match(proveedorCompra, /getGetProveedorCompraDetalleQueryKey/);
  assert.match(proveedorCompra, /listComprasProveedor/);
  assert.match(proveedorCompra, /asig\.revertido \? "REVERTIDO"/);
  assert.match(proveedorCompra, /!asig\.revertido && hasPermission/);

  // - No DELETE / No estado manual
  assert.doesNotMatch(proveedorCompra, /DELETE/i);
  assert.doesNotMatch(proveedorCompra, /marcarPagada/i);
});
