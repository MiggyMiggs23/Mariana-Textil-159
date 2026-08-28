import assert from "node:assert/strict";
import test from "node:test";
import { aggregateHojaVentasDia } from "./lib/pos";

test("agrupa hoja diaria sin series y conserva físicos e IVA facturado", () => {
  const hoja = aggregateHojaVentasDia([
    { productoId: 1, sku: "TELA", tela: "Lino", color: "Azul", tipo: "NORMAL", unidad: "METRO", cantidadFisica: "25", cantidadRollos: 1, importe: "100.00" },
    { productoId: 1, sku: "TELA", tela: "Lino", color: "Azul", tipo: "NORMAL", unidad: "METRO", cantidadFisica: "18", cantidadRollos: 1, importe: "100.00" },
    { productoId: 1, sku: "TELA", tela: "Lino", color: "Rojo", tipo: "NORMAL", unidad: "METRO", cantidadFisica: "12", cantidadRollos: 1, importe: "90.00" },
    { productoId: 2, sku: "KILO", tela: "Relleno", color: "Blanco", tipo: "METREADO", unidad: "KILO", cantidadFisica: "2.5", importe: "50.00" },
  ], [
    { subtotal: "340.00", iva: "16.00", total: "356.00", facturado: true },
    { subtotal: "0.00", iva: "99.00", total: "0.00", facturado: false },
  ]);
  assert.equal(hoja.secciones[0].lineas.length, 2);
  assert.equal(hoja.secciones[1].lineas.length, 1);
  assert.equal(hoja.totalRollos, "3");
  assert.equal(hoja.secciones[0].lineas[0].cantidad, "2");
  assert.equal(hoja.secciones[0].lineas[0].unidad, "ROLLOS");
  assert.equal(hoja.totalMetros, "55");
  assert.equal(hoja.totalKilos, "2.5");
  assert.equal(hoja.secciones[0].subtotal, "290.00");
  assert.equal(hoja.secciones[1].subtotal, "50.00");
  assert.equal(hoja.subtotal, "340.00");
  assert.equal(hoja.ivaFacturado, "16.00");
  assert.equal(hoja.totalGeneral, "356.00");
  assert.equal("serie" in hoja.secciones[0].lineas[0], false);
});

test("conserva conteo cuando recibe el grupo SQL preagrupado", () => {
  const hoja = aggregateHojaVentasDia(
    [{ productoId: 1, sku: "TELA", tela: "Lino", color: "Azul", tipo: "NORMAL", unidad: "METRO", cantidadFisica: "43", cantidadRollos: 2, importe: "200.00" }],
    [{ subtotal: "200.00", iva: "0.00", total: "200.00", facturado: false }],
  );
  assert.equal(hoja.totalRollos, "2");
  assert.equal(hoja.totalMetros, "43");
  assert.equal(hoja.secciones[0].lineas[0].cantidad, "2");
});