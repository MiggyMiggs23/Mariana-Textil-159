import type {
  TicketLinea,
  TicketLineaImpresionBase,
  TicketLineaImpresionConPrecios,
} from "@workspace/api-client-react";

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
  serieRollo: string | null;
  lineas: TicketLinea[];
};

export type ModalitySection = {
  lines: GroupedTicketLine[];
  subtotal: number;
};

export type ModalityGroups = {
  rollos: ModalitySection;
  metraje: ModalitySection;
};

export function groupTicketLinesByModality(lineas: TicketLinea[], showIndividual = false): ModalityGroups {
  const result: ModalityGroups = {
    rollos: { lines: [], subtotal: 0 },
    metraje: { lines: [], subtotal: 0 }
  };

  const rollosGroups = new Map<string, GroupedTicketLine>();
  const metrajeGroups = new Map<string, GroupedTicketLine>();

  for (const linea of lineas) {
    const isRollo = linea.tipo === "NORMAL";
    const amount = Number(linea.importe);

    if (isRollo) {
      result.rollos.subtotal += amount;
      if (showIndividual) {
        result.rollos.lines.push({
          key: `line-${linea.id}`,
          productoId: linea.productoId,
          skuProducto: linea.skuProducto,
          telaProducto: linea.telaProducto,
          colorProducto: linea.colorProducto,
          unidadProducto: linea.unidadProducto,
          precioUnitario: linea.precioUnitario,
          rollos: 1,
          cantidad: Number(linea.cantidad),
          importe: amount,
          costoTotalCongelado: linea.costoTotalCongelado == null ? null : Number(linea.costoTotalCongelado),
          margen: linea.margen == null ? null : Number(linea.margen),
          serieRollo: linea.serieRollo ?? null,
          lineas: [linea]
        });
      } else {
        const key = `${linea.productoId}|${linea.unidadProducto}|${linea.precioUnitario}`;
        const existing = rollosGroups.get(key);
        const costo = linea.costoTotalCongelado == null ? null : Number(linea.costoTotalCongelado);
        const margen = linea.margen == null ? null : Number(linea.margen);

        if (existing) {
          existing.rollos += 1;
          existing.cantidad += Number(linea.cantidad);
          existing.importe += amount;
          existing.costoTotalCongelado =
            existing.costoTotalCongelado == null || costo == null
              ? null
              : existing.costoTotalCongelado + costo;
          existing.margen =
            existing.margen == null || margen == null
              ? null
              : existing.margen + margen;
          existing.lineas.push(linea);
        } else {
          rollosGroups.set(key, {
            key,
            productoId: linea.productoId,
            skuProducto: linea.skuProducto,
            telaProducto: linea.telaProducto,
            colorProducto: linea.colorProducto,
            unidadProducto: linea.unidadProducto,
            precioUnitario: linea.precioUnitario,
            rollos: 1,
            cantidad: Number(linea.cantidad),
            importe: amount,
            costoTotalCongelado: costo,
            margen,
            serieRollo: null,
            lineas: [linea],
          });
        }
      }
    } else {
      result.metraje.subtotal += amount;
      if (showIndividual) {
        result.metraje.lines.push({
          key: `line-${linea.id}`,
          productoId: linea.productoId,
          skuProducto: linea.skuProducto,
          telaProducto: linea.telaProducto,
          colorProducto: linea.colorProducto,
          unidadProducto: linea.unidadProducto,
          precioUnitario: linea.precioUnitario,
          rollos: 0,
          cantidad: Number(linea.cantidad),
          importe: amount,
          costoTotalCongelado: linea.costoTotalCongelado == null ? null : Number(linea.costoTotalCongelado),
          margen: linea.margen == null ? null : Number(linea.margen),
          serieRollo: null,
          lineas: [linea]
        });
      } else {
        const key = `${linea.productoId}|${linea.unidadProducto}|${linea.precioUnitario}`;
        const existing = metrajeGroups.get(key);
        const costo = linea.costoTotalCongelado == null ? null : Number(linea.costoTotalCongelado);
        const margen = linea.margen == null ? null : Number(linea.margen);

        if (existing) {
          existing.cantidad += Number(linea.cantidad);
          existing.importe += amount;
          existing.costoTotalCongelado =
            existing.costoTotalCongelado == null || costo == null
              ? null
              : existing.costoTotalCongelado + costo;
          existing.margen =
            existing.margen == null || margen == null
              ? null
              : existing.margen + margen;
          existing.lineas.push(linea);
        } else {
          metrajeGroups.set(key, {
            key,
            productoId: linea.productoId,
            skuProducto: linea.skuProducto,
            telaProducto: linea.telaProducto,
            colorProducto: linea.colorProducto,
            unidadProducto: linea.unidadProducto,
            precioUnitario: linea.precioUnitario,
            rollos: 0,
            cantidad: Number(linea.cantidad),
            importe: amount,
            costoTotalCongelado: costo,
            margen,
            serieRollo: null,
            lineas: [linea],
          });
        }
      }
    }
  }

  if (!showIndividual) {
    result.rollos.lines = [...rollosGroups.values()];
    result.metraje.lines = [...metrajeGroups.values()];
  }

  return result;
}

export type TabularRoll = {
  id: number;
  serie: string;
  cantidad: string;
  unidad: TicketLinea["unidadProducto"];
};

export type TabularColorGroup = {
  color: string;
  rollos: TabularRoll[];
  totales: Partial<Record<TicketLinea["unidadProducto"], string>>;
};

function addStoredQuantities(left: string | undefined, right: string): string {
  const toThousandths = (value: string) => {
    const match = /^([+-]?)(\d+)(?:\.(\d{1,3}))?$/.exec(value.trim());
    if (!match) throw new TypeError(`Cantidad guardada inválida: ${value}`);
    const fraction = (match[3] ?? "").padEnd(3, "0");
    const coefficient = BigInt(`${match[2]}${fraction}`);
    return match[1] === "-" ? -coefficient : coefficient;
  };
  const total = toThousandths(left ?? "0") + toThousandths(right);
  const sign = total < 0n ? "-" : "";
  const digits = (total < 0n ? -total : total).toString().padStart(4, "0");
  return `${sign}${digits.slice(0, -3)}.${digits.slice(-3)}`;
}

/**
 * Builds the optional tabular-print strips exclusively from persisted,
 * identified NORMAL ticket lines. METREADO lines deliberately have no source
 * roll and therefore cannot produce a physical-roll strip.
 */
export function groupIdentifiedNormalRollsByColor(
  lineas: TicketLinea[],
): TabularColorGroup[] {
  const byColor = new Map<string, TabularColorGroup>();

  for (const linea of lineas) {
    if (
      linea.tipo !== "NORMAL" ||
      linea.rolloId == null ||
      !linea.serieRollo?.trim()
    ) {
      continue;
    }

    const color = linea.colorProducto;
    const group = byColor.get(color);
    const rollo = {
      id: linea.id,
      serie: linea.serieRollo,
      cantidad: linea.cantidad,
      unidad: linea.unidadProducto,
    };

    if (group) {
      group.rollos.push(rollo);
      group.totales[linea.unidadProducto] = addStoredQuantities(
        group.totales[linea.unidadProducto],
        linea.cantidad,
      );
    } else {
      byColor.set(color, {
        color,
        rollos: [rollo],
        totales: { [linea.unidadProducto]: addStoredQuantities(undefined, linea.cantidad) },
      });
    }
  }

  return [...byColor.values()]
    .sort((left, right) => left.color.localeCompare(right.color, "es-MX"))
    .map((group) => ({
      ...group,
      rollos: [...group.rollos].sort(
        (left, right) =>
          left.serie.localeCompare(right.serie, "es-MX") || left.id - right.id,
      ),
    }));
}

type TicketPrintLine =
  | TicketLineaImpresionBase
  | TicketLineaImpresionConPrecios;

export type GroupedTicketPrintLine = {
  key: string;
  productoId: number;
  skuProducto: string;
  telaProducto: string;
  colorProducto: string;
  unidadProducto: TicketLinea["unidadProducto"];
  precioUnitario?: string;
  rollos: number;
  cantidad: number;
  importe?: number;
};

export type PrintModalityGroups = {
  rollos: { lines: GroupedTicketPrintLine[]; subtotal: number | null };
  metraje: { lines: GroupedTicketPrintLine[]; subtotal: number | null };
};

function isPricedPrintLine(
  linea: TicketPrintLine,
): linea is TicketLineaImpresionConPrecios {
  return "precioUnitario" in linea && "importe" in linea;
}

export function groupPrintLinesByModality(
  lineas: TicketPrintLine[],
): PrintModalityGroups {
  const result: PrintModalityGroups = {
    rollos: { lines: [], subtotal: null },
    metraje: { lines: [], subtotal: null },
  };
  const rollosGroups = new Map<string, GroupedTicketPrintLine>();
  const metrajeGroups = new Map<string, GroupedTicketPrintLine>();

  for (const linea of lineas) {
    const priced = isPricedPrintLine(linea);
    const amount = priced ? Number(linea.importe) : undefined;
    const priceKey = priced ? linea.precioUnitario : "SIN_PRECIOS";
    const key = `${linea.productoId}|${linea.unidadProducto}|${priceKey}`;
    const section = linea.tipo === "NORMAL" ? result.rollos : result.metraje;
    const groups = linea.tipo === "NORMAL" ? rollosGroups : metrajeGroups;
    const existing = groups.get(key);

    if (priced && amount !== undefined) {
      section.subtotal = (section.subtotal ?? 0) + amount;
    }

    if (existing) {
      existing.rollos += linea.tipo === "NORMAL" ? 1 : 0;
      existing.cantidad += Number(linea.cantidad);
      if (priced && amount !== undefined) {
        existing.importe = (existing.importe ?? 0) + amount;
      }
      continue;
    }

    groups.set(key, {
      key,
      productoId: linea.productoId,
      skuProducto: linea.skuProducto,
      telaProducto: linea.telaProducto,
      colorProducto: linea.colorProducto,
      unidadProducto: linea.unidadProducto,
      ...(priced
        ? {
            precioUnitario: linea.precioUnitario,
            importe: amount,
          }
        : {}),
      rollos: linea.tipo === "NORMAL" ? 1 : 0,
      cantidad: Number(linea.cantidad),
    });
  }

  result.rollos.lines = [...rollosGroups.values()];
  result.metraje.lines = [...metrajeGroups.values()];
  return result;
}

export function groupTicketLines(lineas: TicketLinea[]) {
  const groups = new Map<string, any>();

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
