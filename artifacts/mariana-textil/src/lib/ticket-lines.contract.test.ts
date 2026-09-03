import assert from "node:assert/strict";
import test from "node:test";
import type {
  TicketLinea,
  TicketLineaImpresionBase,
  TicketLineaImpresionConPrecios,
} from "@workspace/api-client-react";
import {
  groupIdentifiedNormalRollsByColor,
  groupPrintLinesByModality,
  groupTicketLinesByModality,
} from "./ticket-lines";

function line(
  id: number,
  tipo: "NORMAL" | "METREADO",
  importe: string,
): TicketLinea {
  return {
    id,
    ticketId: 1,
    rolloId: tipo === "NORMAL" ? id : null,
    productoId: id,
    tipo,
    cantidad: "1.000",
    precioUnitario: importe,
    precioSugerido: importe,
    importe,
    costoUnitarioCongelado: tipo === "NORMAL" ? "1.00" : null,
    costoTotalCongelado: tipo === "NORMAL" ? "1.00" : null,
    margen: tipo === "NORMAL" ? "1.00" : null,
    serieRollo: tipo === "NORMAL" ? `R-${id}` : null,
    skuProducto: `SKU-${id}`,
    telaProducto: "Tela",
    colorProducto: "Color",
    unidadProducto: "METRO",
  };
}

test("ticket sections use the persisted line modality and independent subtotals", () => {
  const groups = groupTicketLinesByModality([
    line(1, "NORMAL", "120.00"),
    line(2, "METREADO", "45.00"),
  ]);

  assert.equal(groups.rollos.lines.length, 1);
  assert.equal(groups.rollos.subtotal, 120);
  assert.equal(groups.metraje.lines.length, 1);
  assert.equal(groups.metraje.subtotal, 45);
});

test("empty ticket modalities remain empty so their headings can be omitted", () => {
  const groups = groupTicketLinesByModality([line(1, "METREADO", "45.00")]);

  assert.equal(groups.rollos.lines.length, 0);
  assert.equal(groups.metraje.lines.length, 1);
});

function printLine(
  cantidad: string,
  priced = false,
): TicketLineaImpresionBase | TicketLineaImpresionConPrecios {
  const base: TicketLineaImpresionBase = {
    productoId: 7,
    tipo: "NORMAL",
    skuProducto: "SKU-7",
    telaProducto: "Lino",
    colorProducto: "Azul",
    unidadProducto: "METRO",
    cantidad,
  };
  return priced
    ? {
        ...base,
        precioUnitario: "25.00",
        precioSugerido: "25.00",
        importe: String(Number(cantidad) * 25),
      }
    : base;
}

test("price-less print lines group without inventing economic values", () => {
  const groups = groupPrintLinesByModality([
    printLine("2.000"),
    printLine("3.000"),
  ]);

  assert.equal(groups.rollos.lines.length, 1);
  assert.equal(groups.rollos.lines[0]?.rollos, 2);
  assert.equal(groups.rollos.lines[0]?.cantidad, 5);
  assert.equal(groups.rollos.subtotal, null);
  assert.equal("precioUnitario" in groups.rollos.lines[0]!, false);
  assert.equal("importe" in groups.rollos.lines[0]!, false);
});

test("priced print lines preserve grouped sale totals", () => {
  const groups = groupPrintLinesByModality([
    printLine("2.000", true),
    printLine("3.000", true),
  ]);

  assert.equal(groups.rollos.lines.length, 1);
  assert.equal(groups.rollos.lines[0]?.importe, 125);
  assert.equal(groups.rollos.subtotal, 125);
});

test("tabular strips group only identified NORMAL rolls by color deterministically", () => {
  const azul = { ...line(3, "NORMAL", "10.00"), colorProducto: "Azul", serieRollo: "B-02", cantidad: "4.125" };
  const rojo = { ...line(2, "NORMAL", "10.00"), colorProducto: "Rojo", serieRollo: "A-01", cantidad: "2.500" };
  const azulFirst = { ...line(1, "NORMAL", "10.00"), colorProducto: "Azul", serieRollo: "B-01", cantidad: "3.000" };
  const metrado = { ...line(4, "METREADO", "10.00"), colorProducto: "Azul", cantidad: "99.000" };

  const groups = groupIdentifiedNormalRollsByColor([rojo, metrado, azul, azulFirst]);

  assert.deepEqual(groups, [
    {
      color: "Azul",
      totales: { METRO: "7.125" },
      rollos: [
        { id: 1, serie: "B-01", cantidad: "3.000", unidad: "METRO" },
        { id: 3, serie: "B-02", cantidad: "4.125", unidad: "METRO" },
      ],
    },
    {
      color: "Rojo",
      totales: { METRO: "2.500" },
      rollos: [{ id: 2, serie: "A-01", cantidad: "2.500", unidad: "METRO" }],
    },
  ]);
});

test("tabular strips never mix metres, kilos, and bags in one false total", () => {
  const metro = { ...line(1, "NORMAL", "10.00"), colorProducto: "Negro", serieRollo: "M-1", cantidad: "1.004", unidadProducto: "METRO" as const };
  const otroMetro = { ...line(2, "NORMAL", "10.00"), colorProducto: "Negro", serieRollo: "M-2", cantidad: "1.004", unidadProducto: "METRO" as const };
  const kilo = { ...line(3, "NORMAL", "10.00"), colorProducto: "Negro", serieRollo: "K-1", cantidad: "2.500", unidadProducto: "KILO" as const };

  const [group] = groupIdentifiedNormalRollsByColor([kilo, otroMetro, metro]);

  assert.deepEqual(group?.totales, { METRO: "2.008", KILO: "2.500" });
});