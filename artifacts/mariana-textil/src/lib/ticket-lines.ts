import type { TicketLinea } from "@workspace/api-client-react";

export type GroupedTicketLine = {
  key: string;
  productoId: number;
  skuProducto: string;
  telaProducto: string;
  colorProducto: string;
  unidadProducto: TicketLinea["unidadProducto"];
  precioUnitario: string;
  rollos: number;
  cantidad: number;
  importe: number;
  costoTotalCongelado: number | null;
  margen: number | null;
  lineas: TicketLinea[];
};

export function groupTicketLines(lineas: TicketLinea[]): GroupedTicketLine[] {
  const groups = new Map<string, GroupedTicketLine>();

  for (const linea of lineas) {
    const key = `${linea.productoId}|${linea.unidadProducto}|${linea.precioUnitario}`;
    const existing = groups.get(key);
    const costo =
      linea.costoTotalCongelado == null
        ? null
        : Number(linea.costoTotalCongelado);
    const margen = linea.margen == null ? null : Number(linea.margen);

    if (existing) {
      existing.rollos += 1;
      existing.cantidad += Number(linea.cantidad);
      existing.importe += Number(linea.importe);
      existing.costoTotalCongelado =
        existing.costoTotalCongelado == null || costo == null
          ? null
          : existing.costoTotalCongelado + costo;
      existing.margen =
        existing.margen == null || margen == null
          ? null
          : existing.margen + margen;
      existing.lineas.push(linea);
      continue;
    }

    groups.set(key, {
      key,
      productoId: linea.productoId,
      skuProducto: linea.skuProducto,
      telaProducto: linea.telaProducto,
      colorProducto: linea.colorProducto,
      unidadProducto: linea.unidadProducto,
      precioUnitario: linea.precioUnitario,
      rollos: 1,
      cantidad: Number(linea.cantidad),
      importe: Number(linea.importe),
      costoTotalCongelado: costo,
      margen,
      lineas: [linea],
    });
  }

  return [...groups.values()];
}