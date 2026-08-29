import assert from "node:assert/strict";
import test from "node:test";
import { aggregateHojaVentasDia } from "./lib/pos";

test("agrupa hoja diaria sin series y conserva físicos e IVA facturado", () => {
  const hoja = aggregateHojaVentasDia([
    { productoId: 1, sku: "TELA", tela: "Lino", color: "Azul", tipo: "NORMAL", unidad: "METRO", cantidadFisica: "25", cantidadRollos: 1, importe: "100.00" },
    { productoId: 1, sku: "TELA", tela: "Lino", color: "Azul", tipo: "NORMAL", unidad: "METRO", cantidadFisica: "18", cantidadRollos: 1, importe: "100.00" },
    { productoId: 1, sku: "TELA", tela: "Lino", color: "Rojo", tipo: "NORMAL", unidad: "METRO", cantidadFisica: "12", cantidadRollos: 1, importe: "90.00" },
    { productoId: 2, sku: "KILO", tela: "Relleno", color: "Blanco", tipo: "METREADO", unidad: "KILO", cantidadFisica: "2.5", importe: "50.00" },
    { productoId: 3, sku: "BOLSA", tela: "Empaque", color: "Claro", tipo: "METREADO", unidad: "BOLSA", cantidadFisica: "10", importe: "30.00" },
  ], [
    { subtotal: "370.00", iva: "16.00", total: "386.00", facturado: true },
    { subtotal: "0.00", iva: "99.00", total: "0.00", facturado: false },
  ]);
  assert.equal(hoja.secciones[0].lineas.length, 2);
  assert.equal(hoja.secciones[1].lineas.length, 2);
  assert.equal(hoja.totalRollos, "3");
  assert.equal(hoja.secciones[0].lineas[0].cantidad, "2");
  assert.equal(hoja.secciones[0].lineas[0].unidad, "ROLLOS");
  assert.equal(hoja.totalMetros, "55");
  assert.equal(hoja.totalKilos, "2.5");
  assert.equal(hoja.totalBolsas, "10");
  assert.equal(hoja.secciones[0].subtotal, "290.00");
  assert.equal(hoja.secciones[1].subtotal, "80.00");
  assert.equal(hoja.subtotal, "370.00");
  assert.equal(hoja.ivaFacturado, "16.00");
  assert.equal(hoja.totalGeneral, "386.00");
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

test("separa los acumulados de METRO, KILO y BOLSA", () => {
  const hoja = aggregateHojaVentasDia(
    [
      { productoId: 10, sku: "M", tela: "Producto", color: "Natural", tipo: "METREADO", unidad: "METRO", cantidadFisica: "2.5", importe: "25.00" },
      { productoId: 11, sku: "K", tela: "Producto", color: "Natural", tipo: "METREADO", unidad: "KILO", cantidadFisica: "3", importe: "30.00" },
      { productoId: 12, sku: "B", tela: "Producto", color: "Natural", tipo: "METREADO", unidad: "BOLSA", cantidadFisica: "4", importe: "40.00" },
    ],
    [{ subtotal: "95.00", iva: "0.00", total: "95.00", facturado: false }],
  );
  const metraje = hoja.secciones.find((section) => section.modalidad === "METRAJE")!;
  assert.equal(metraje.lineas.length, 3);
  assert.deepEqual(
    metraje.lineas.map((linea) => [linea.unidad, linea.cantidad, linea.importe]).sort(),
    [
      ["BOLSA", "4", "40.00"],
      ["KILO", "3", "30.00"],
      ["METRO", "2.5", "25.00"],
    ],
  );
  assert.equal(hoja.totalMetros, "2.5");
  assert.equal(hoja.totalKilos, "3");
  assert.equal(hoja.totalBolsas, "4");
});