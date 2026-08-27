import assert from "node:assert/strict";
import test from "node:test";
import type { TicketLinea } from "@workspace/api-client-react";
import { groupTicketLinesByModality } from "./ticket-lines";

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