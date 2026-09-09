import { and, asc, count, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  auditoriaTable,
  autorizacionesNotaTable,
  aplicacionesCreditoTable,
  clientesTable,
  db,
  movimientosCreditoTable,
  notificacionesCreditoTable,
  movimientosTable,
  productosTable,
  rollosTable,
  sesionesCajaTable,
  sesionesCajaDiasTable,
  salidasTable,
  salidasDineroCajaTable,
  proveedoresTable,
  ticketFolioTable,
  ticketLineasTable,
  ticketPagosTable,
  ticketsTable,
  ubicacionesTable,
  usuariosTable,
  viajeTicketsTable,
  viajesTable,
  type FormaPagoTicket,
} from "@workspace/db";
import {
  centsToMoney,
  moneyToCents,
  projectCreditLedger,
} from "./credit-allocation";
import {
  loadCustomerCreditLedgerInTransaction,
} from "./credit-aging-read-model";
import {
  consumirBolsasFifo,
  DOCUMENTO_TICKET_BOLSA_METREADO,
  DOCUMENTO_TICKET_BOLSA_NORMAL,
  DOCUMENTO_TICKET_PIEZA_NORMAL,
  InventarioError,
  lockInventoryPairs,
  revertirMovimiento,
  venderRollo,
  type Tx,
} from "./inventario";
import {
  isValidUnitCost,
  rollWithoutValidUnitCostMessage,
} from "./unit-cost";
import {
  deriveTicketCreditData,
  creditDueDate,
  isCreditTerm,
  type CreditTerm,
} from "./clientes-aging";
import { interpretarCodigoEscaneado } from "@workspace/scanned-code";
import {
  meteredPriceTier,
  suggestedMeteredPrice,
} from "@workspace/metered-pricing";
import { ACCOUNT_DESTINATION_ORDER } from "@workspace/number-format";
import {
  ADVISORY_LOCK_NAMESPACES,
  transactionAdvisoryLock,
} from "@workspace/db/advisory-locks";
import { meteredReferenceCost } from "./metered-reference-cost";
import { IVA_RATE_BASIS_POINTS } from "./iva";
import { consumirRollosSalidaVenta } from "./salidas";
import { assertNoActiveVentaClienteReservation } from "./salida-venta-reservation";

const FOLIO_ROW_ID = 1;

/** Tienda Mariana (MA) is presently the only location allowed to pay providers from cash. */
export const MARIANA_LOCATION_ID = 1;

export class PosError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "PosError";
  }
}

export type CrearTicketLineaInput = {
  rolloId?: number | null;
  productoId: number;
  tipo?: "NORMAL" | "METREADO";
  cantidad: string;
  precioUnitario: string;
  ubicacionId?: number;
};

export type CrearTicketInput = {
  ubicacionId: number;
  usuarioTerminalId: number;
  clienteId: number;
  documentoTipo?: "TICKET" | "NOTA";
  notaSinPrecios?: boolean;
  nombreDestinatario?: string | null;
  direccionEntregaSnapshot?: string | null;
  /** Legacy request default; new callers should send tipo on every line. */
  tipo?: "NORMAL" | "METREADO";
  facturado: boolean;
  credito?: boolean;
  diasPlazo?: number | null;
  uuidCliente: string;
  lineas: CrearTicketLineaInput[];
  ip: string;
  /** Used by customer-sale exits: inventory is consumed when the document is paid/authorized. */
  deferInventory?: boolean;
  owningSalidaIds?: number[];
};

export type PagoTicketInput = {
  formaPago: FormaPagoTicket;
  importe: string;
  referencia?: string | null;
};

type Reader = Pick<typeof db, "select" | "execute">;

function productName(tela: string, color: string): string {
  return `${tela} ${color}`.trim();
}

function priceBelowCostMessage(
  tela: string,
  color: string,
  serie: string,
): string {
  return `El precio de ${productName(tela, color)} serie ${serie} está por debajo del mínimo permitido.`;
}

function money(value: string | number): number {
  const text = String(value).trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) {
    throw new PosError("Importe inválido.", "INVALID_AMOUNT");
  }
  const fraction = (match[3] ?? "").padEnd(3, "0");
  const cents = BigInt(match[2]!) * 100n + BigInt(fraction.slice(0, 2));
  const rounded = cents + (fraction[2]! >= "5" ? 1n : 0n);
  const signed = match[1] === "-" ? -rounded : rounded;
  if (
    signed > BigInt(Number.MAX_SAFE_INTEGER) ||
    signed < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new PosError("Importe inválido.", "INVALID_AMOUNT");
  }
  return Number(signed);
}

function decimalMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Pure aggregation behind the daily sheet; inputs must already be scoped to one valid paid session. */
export function aggregateHojaVentasDia(
  lineas: Array<{ productoId: number; sku: string; tela: string; color: string; tipo: "NORMAL" | "METREADO"; unidad: "METRO" | "KILO" | "BOLSA" | "PIEZA"; cantidad?: string; cantidadFisica?: string; cantidadRollos?: number; importe: string }>,
  tickets: Array<{ subtotal: string; iva: string; total: string; facturado: boolean }>,
) {
  const grouped = new Map<string, { linea: typeof lineas[number]; fisica: number; rollos: number; importe: number }>();
  for (const linea of lineas) {
    const key = `${linea.productoId}:${linea.tipo}:${linea.color}:${linea.unidad}`;
    const previous = grouped.get(key);
    const fisica = Number(linea.cantidadFisica ?? linea.cantidad ?? "0");
    const rollos = linea.tipo === "NORMAL" ? (linea.cantidadRollos ?? 1) : 0;
    if (previous) {
      previous.fisica += fisica; previous.rollos += rollos; previous.importe += money(linea.importe);
    } else {
      grouped.set(key, { linea, fisica, rollos, importe: money(linea.importe) });
    }
  }
  const all = [...grouped.values()];
  const section = (tipo: "NORMAL" | "METREADO") => {
    const items = all.filter((item) => item.linea.tipo === tipo);
    return { lineas: items.map((item) => ({ productoId: item.linea.productoId, sku: item.linea.sku, tela: item.linea.tela, color: item.linea.color, tipo, unidad: tipo === "NORMAL" ? "ROLLOS" as const : item.linea.unidad, cantidad: String(tipo === "NORMAL" ? item.rollos : item.fisica), importe: decimalMoney(item.importe) })), subtotal: decimalMoney(items.reduce((total, item) => total + item.importe, 0)) };
  };
  const rollos = section("NORMAL");
  const metraje = section("METREADO");
  return {
    secciones: [
      { modalidad: "ROLLOS" as const, ...rollos },
      { modalidad: "METRAJE" as const, ...metraje },
    ],
    totalRollos: String(all.reduce((total, item) => total + item.rollos, 0)),
    totalMetros: String(all.filter((item) => item.linea.unidad === "METRO").reduce((total, item) => total + item.fisica, 0)),
    totalKilos: String(all.filter((item) => item.linea.unidad === "KILO").reduce((total, item) => total + item.fisica, 0)),
    totalBolsas: String(all.filter((item) => item.linea.unidad === "BOLSA").reduce((total, item) => total + item.fisica, 0)),
    totalPiezas: String(all.filter((item) => item.linea.unidad === "PIEZA").reduce((total, item) => total + item.fisica, 0)),
    subtotal: decimalMoney(tickets.reduce((total, ticket) => total + money(ticket.subtotal), 0)),
    ivaFacturado: decimalMoney(tickets.filter((ticket) => ticket.facturado).reduce((total, ticket) => total + money(ticket.iva), 0)),
    totalGeneral: decimalMoney(tickets.reduce((total, ticket) => total + money(ticket.total), 0)),
  };
}

function decimalQuantity(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new PosError(
      "Las cantidades deben ser mayores a cero.",
      "INVALID_QUANTITY",
    );
  }
  return parsed.toFixed(3);
}

/**
 * Multiplies a canonical three-decimal quantity by integer cents and rounds
 * the resulting fractional cent half-up. BigInt keeps frozen line totals
 * independent of IEEE-754 binary floating point.
 */
export function quantityTimesMoneyCents(quantity: string, cents: number): number {
  const match = /^(\d+)\.(\d{3})$/.exec(quantity);
  if (!match || !Number.isSafeInteger(cents) || cents < 0) {
    throw new PosError("Importe inválido.", "INVALID_AMOUNT");
  }
  const thousandths = BigInt(match[1]!) * 1000n + BigInt(match[2]!);
  const product = thousandths * BigInt(cents);
  const rounded = product / 1000n + (product % 1000n * 2n >= 1000n ? 1n : 0n);
  if (
    rounded > BigInt(Number.MAX_SAFE_INTEGER) ||
    rounded < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new PosError("Importe inválido.", "INVALID_AMOUNT");
  }
  return Number(rounded);
}

async function reserveTicketFolio(tx: Tx): Promise<number> {
  const [row] = await tx
    .select()
    .from(ticketFolioTable)
    .where(eq(ticketFolioTable.id, FOLIO_ROW_ID))
    .for("update");
  const next = (row?.ultimoFolio ?? 999) + 1;
  if (row) {
    await tx
      .update(ticketFolioTable)
      .set({ ultimoFolio: next })
      .where(eq(ticketFolioTable.id, FOLIO_ROW_ID));
  } else {
    await tx
      .insert(ticketFolioTable)
      .values({ id: FOLIO_ROW_ID, ultimoFolio: next });
  }
  return next;
}

export async function buildTicketDetail(
  database: Reader,
  ticketId: number,
  includeCosts: boolean,
  convertidoANotaPorCobro = false,
) {
  const [ticket] = await database
    .select({
      id: ticketsTable.id,
      folio: ticketsTable.folio,
      ubicacionId: ticketsTable.ubicacionId,
      nombreUbicacion: ubicacionesTable.nombre,
      usuarioTerminalId: ticketsTable.usuarioTerminalId,
      nombreUsuarioTerminal: usuariosTable.nombre,
      clienteId: ticketsTable.clienteId,
      nombreCliente: clientesTable.nombre,
      documentoTipo: ticketsTable.documentoTipo,
      notaSinPrecios: ticketsTable.notaSinPrecios,
      nombreDestinatario: ticketsTable.nombreDestinatario,
      direccionEntregaSnapshot: ticketsTable.direccionEntregaSnapshot,
      diasCreditoCliente:
        sql<number | null>`NULLIF(${clientesTable.diasCredito}, 0)`,
      telefonoCliente: clientesTable.telefono,
      correoCliente: clientesTable.correo,
      direccionFiscalEfectiva: clientesTable.direccionParticular,
      direccionCliente: sql<string | null>`COALESCE(
        NULLIF(btrim(${clientesTable.direccionEntrega}), ''),
        NULLIF(btrim(${clientesTable.direccionParticular}), '')
      )`,
      direccionEntregaEfectiva: sql<string | null>`COALESCE(
        NULLIF(btrim(${ticketsTable.direccionEntregaSnapshot}), ''),
        NULLIF(btrim(${clientesTable.direccionEntrega}), ''),
        NULLIF(btrim(${clientesTable.direccionParticular}), '')
      )`,
      subtotal: ticketsTable.subtotal,
      iva: ticketsTable.iva,
      tasaIva: ticketsTable.tasaIva,
      total: ticketsTable.total,
      estado: ticketsTable.estado,
      cobrado: ticketsTable.cobrado,
      cobradoAt: ticketsTable.cobradoAt,
      autorizacionEstado: ticketsTable.autorizacionEstado,
      autorizadoAt: ticketsTable.autorizadoAt,
      usuarioCajaId: ticketsTable.usuarioCajaId,
      facturado: ticketsTable.facturado,
      credito: ticketsTable.credito,
      diasPlazoTicket: ticketsTable.diasPlazo,
      fechaVencimientoTicket: ticketsTable.fechaVencimiento,
      sesionCajaId: ticketsTable.sesionCajaId,
      uuidCliente: ticketsTable.uuidCliente,
      createdAt: ticketsTable.createdAt,
      canceladoAt: ticketsTable.canceladoAt,
      canceladoPor: ticketsTable.canceladoPor,
      motivoCancelacion: ticketsTable.motivoCancelacion,
      autorizadoPor: ticketsTable.autorizadoPor,
    })
    .from(ticketsTable)
    .innerJoin(
      ubicacionesTable,
      eq(ticketsTable.ubicacionId, ubicacionesTable.id),
    )
    .innerJoin(
      usuariosTable,
      eq(ticketsTable.usuarioTerminalId, usuariosTable.id),
    )
    .leftJoin(clientesTable, eq(ticketsTable.clienteId, clientesTable.id))
    .where(eq(ticketsTable.id, ticketId))
    .limit(1);

  if (!ticket) return null;

  const [cancellationUser] = ticket.canceladoPor == null
    ? []
    : await database
        .select({ nombre: usuariosTable.nombre })
        .from(usuariosTable)
        .where(eq(usuariosTable.id, ticket.canceladoPor))
        .limit(1);

  const lineas = await database
    .select({
      id: ticketLineasTable.id,
      ticketId: ticketLineasTable.ticketId,
      rolloId: ticketLineasTable.rolloId,
      serie: rollosTable.serie,
      productoId: ticketLineasTable.productoId,
      tipo: ticketLineasTable.tipo,
      sku: productosTable.sku,
      tela: productosTable.tela,
      color: productosTable.color,
      unidad: productosTable.unidad,
      cantidad: ticketLineasTable.cantidad,
      precioUnitario: ticketLineasTable.precioUnitario,
      precioSugerido: ticketLineasTable.precioSugerido,
      importe: ticketLineasTable.importe,
      costoUnitarioCongelado: ticketLineasTable.costoUnitarioCongelado,
      costoTotalCongelado: ticketLineasTable.costoTotalCongelado,
      costoReferenciaEstado: ticketLineasTable.costoReferenciaEstado,
    })
    .from(ticketLineasTable)
    .innerJoin(
      productosTable,
      eq(ticketLineasTable.productoId, productosTable.id),
    )
    .leftJoin(rollosTable, eq(ticketLineasTable.rolloId, rollosTable.id))
    .where(eq(ticketLineasTable.ticketId, ticketId))
    .orderBy(asc(ticketLineasTable.id));

  const pagos = await database
    .select({
      id: ticketPagosTable.id,
      ticketId: ticketPagosTable.ticketId,
      formaPago: ticketPagosTable.formaPago,
      importe: ticketPagosTable.importe,
      referencia: ticketPagosTable.referencia,
      createdAt: ticketPagosTable.createdAt,
      usuarioId: ticketPagosTable.usuarioId,
      nombreUsuario: usuariosTable.nombre,
    })
    .from(ticketPagosTable)
    .innerJoin(usuariosTable, eq(ticketPagosTable.usuarioId, usuariosTable.id))
    .where(eq(ticketPagosTable.ticketId, ticketId))
    .orderBy(asc(ticketPagosTable.id));

  // The immutable credit ledger is authoritative.  A ticket payment is only
  // the POS collection record and may be absent from historical/imported
  // tickets, so it must not decide whether this ticket has a credit charge.
  const [creditSale] = ticket.clienteId == null
    ? []
    : await database
        .select({ id: movimientosCreditoTable.id })
        .from(movimientosCreditoTable)
        .where(
          and(
            eq(movimientosCreditoTable.ticketId, ticketId),
            eq(movimientosCreditoTable.tipo, "VENTA_CREDITO"),
          ),
        )
        .limit(1);
  const creditMovements = creditSale
    ? await loadCustomerCreditLedgerInTransaction(
        Number(ticket.clienteId),
        database,
      )
    : [];
  const derivedCredit = deriveTicketCreditData(ticketId, pagos, creditMovements);
  const credit =
    ticket.credito && !derivedCredit.esCredito
      ? {
          ...derivedCredit,
          esCredito: true,
          diasPlazo: ticket.diasPlazoTicket,
          fechaVencimiento: ticket.fechaVencimientoTicket,
        }
      : derivedCredit;
  const [viaje] = await database.select({ id: viajesTable.id, folio: viajesTable.folio })
    .from(viajeTicketsTable).innerJoin(viajesTable, eq(viajeTicketsTable.viajeId, viajesTable.id))
    .where(eq(viajeTicketsTable.ticketId, ticketId)).limit(1);
  const salidas = await database.select({ id: salidasTable.id, folio: salidasTable.folio, origenId: salidasTable.origenId, nombreOrigen: ubicacionesTable.nombre, iniciales: ubicacionesTable.iniciales, href: sql<string>`('/salidas/' || ${salidasTable.id})` })
    .from(salidasTable).innerJoin(ubicacionesTable, eq(salidasTable.origenId, ubicacionesTable.id)).where(eq(salidasTable.ticketId, ticketId));

  return {
    ...ticket,
    ...credit,
    viaje: viaje ?? null,
    salidas: salidas.map((s) => ({ id: s.id, folioFormateado: `${s.iniciales}-${String(s.folio).padStart(6, "0")}`, origenId: s.origenId, nombreOrigen: s.nombreOrigen, href: s.href })),
    convertidoANotaPorCobro,
    nombreUsuarioCaja: null,
    nombreUsuarioCancelacion: cancellationUser?.nombre ?? null,
    nombreUsuarioAutorizacion: null,
    cobradoAt: ticket.cobradoAt?.toISOString() ?? null,
    createdAt: ticket.createdAt.toISOString(),
    canceladoAt: ticket.canceladoAt?.toISOString() ?? null,
    lineas: lineas.map((linea) => {
      const base = {
        id: linea.id,
        ticketId: linea.ticketId,
        rolloId: linea.rolloId,
        serieRollo: linea.serie ?? null,
        productoId: linea.productoId,
        tipo: linea.tipo,
        skuProducto: linea.sku,
        telaProducto: linea.tela,
        colorProducto: linea.color,
        unidadProducto: linea.unidad,
        nombreUbicacion: ticket.nombreUbicacion,
        cantidad: linea.cantidad,
        precioUnitario: linea.precioUnitario,
        precioSugerido: linea.precioSugerido,
        importe: linea.importe,
      };
      if (!includeCosts) return base;
      if (linea.costoTotalCongelado == null) {
        return {
          ...base,
          costoUnitarioCongelado: null,
          costoTotalCongelado: null,
          costoFuente:
            linea.tipo === "NORMAL"
              ? "EXACT_ROLL"
              : linea.costoReferenciaEstado,
          margen: null,
        };
      }
      const costo = money(linea.costoTotalCongelado);
      const importe = money(linea.importe);
      return {
        ...base,
        costoUnitarioCongelado: linea.costoUnitarioCongelado,
        costoTotalCongelado: linea.costoTotalCongelado,
        costoFuente:
          linea.tipo === "NORMAL"
            ? "EXACT_ROLL"
            : linea.costoReferenciaEstado,
        margen: decimalMoney(importe - costo),
      };
    }),
    pagos: pagos.map((pago) => ({
      ...pago,
      createdAt: pago.createdAt.toISOString(),
    })),
  };
}

export type TicketPrintCopy = "INTERNA" | "CLIENTE";

/**
 * Deliberate, allow-list print projection.  This is separate from the in-app
 * detail because issued customer copies must never inherit roll serials or,
 * for a price-less note, any economic field.
 */
export function projectTicketPrintDocument(
  ticket: Awaited<ReturnType<typeof buildTicketDetail>>,
  copia: TicketPrintCopy,
) {
  if (!ticket) return null;
  const identidad = {
    ticketId: ticket.id,
    folio: ticket.folio,
    copia,
    documentoTipo: ticket.documentoTipo,
    notaSinPrecios: ticket.notaSinPrecios,
    ubicacionId: ticket.ubicacionId,
    nombreUbicacion: ticket.nombreUbicacion,
    createdAt: ticket.createdAt,
    estado: ticket.estado,
    clienteId: ticket.clienteId,
    nombreCliente: ticket.nombreCliente,
    nombreDestinatario: ticket.nombreDestinatario,
    direccionEntregaSnapshot: ticket.direccionEntregaSnapshot,
    direccionEntregaEfectiva: ticket.direccionEntregaEfectiva,
    telefonoCliente: ticket.telefonoCliente,
    correoCliente: ticket.correoCliente,
    direccionFiscalEfectiva: ticket.direccionFiscalEfectiva,
    facturado: ticket.facturado,
    esCredito: ticket.esCredito,
    diasPlazo: ticket.diasPlazo,
    fechaVencimiento: ticket.fechaVencimiento,
  };
  const sinPrecios =
    copia === "CLIENTE" &&
    ticket.documentoTipo === "NOTA" &&
    ticket.notaSinPrecios;
  if (sinPrecios) {
    return {
      ...identidad,
      lineas: ticket.lineas.map((linea) => ({
        productoId: linea.productoId,
        tipo: linea.tipo,
        skuProducto: linea.skuProducto,
        telaProducto: linea.telaProducto,
        colorProducto: linea.colorProducto,
        unidadProducto: linea.unidadProducto,
        cantidad: linea.cantidad,
      })),
    };
  }
  const pricedLines = ticket.lineas.map((linea) => ({
    productoId: linea.productoId,
    tipo: linea.tipo,
    skuProducto: linea.skuProducto,
    telaProducto: linea.telaProducto,
    colorProducto: linea.colorProducto,
    unidadProducto: linea.unidadProducto,
    cantidad: linea.cantidad,
    precioUnitario: linea.precioUnitario,
    precioSugerido: linea.precioSugerido,
    importe: linea.importe,
  }));
  return {
    ...identidad,
    lineas: pricedLines,
    subtotal: ticket.subtotal,
    iva: ticket.iva,
    tasaIva: ticket.tasaIva,
    total: ticket.total,
    diasCreditoCliente: ticket.diasCreditoCliente,
    saldoPendiente: ticket.saldoPendiente,
  };
}

export async function validarPrecioPos(
  database: Reader,
  input: {
    ubicacionId: number;
    productoId: number;
    rolloId: number;
    precioUnitario: string;
  },
) {
  const precioCents = money(input.precioUnitario);
  if (precioCents <= 0) {
    throw new PosError(
      "El precio unitario debe ser mayor a cero.",
      "INVALID_PRICE",
    );
  }

  const [rollo] = await database
    .select({
      id: rollosTable.id,
      serie: rollosTable.serie,
      productoId: rollosTable.productoId,
      ubicacionId: rollosTable.ubicacionId,
      estado: rollosTable.estado,
      costoUnitario: rollosTable.costoUnitario,
      activoProducto: productosTable.activo,
      tela: productosTable.tela,
      color: productosTable.color,
    })
    .from(rollosTable)
    .innerJoin(productosTable, eq(rollosTable.productoId, productosTable.id))
    .where(
      and(
        eq(rollosTable.id, input.rolloId),
        eq(rollosTable.productoId, input.productoId),
        eq(rollosTable.ubicacionId, input.ubicacionId),
      ),
    )
    .limit(1);

  if (!rollo) {
    throw new PosError(
      "Rollo no encontrado o no disponible para esta operación.",
      "ROLLO_NOT_FOUND",
      404,
    );
  }
  if (!rollo.activoProducto) {
    throw new PosError(
      `Producto ${input.productoId} inválido o inactivo.`,
      "INVALID_PRODUCT",
    );
  }
  if (rollo.estado !== "DISPONIBLE") {
    throw new PosError(
      `El rollo serie ${rollo.serie} no está DISPONIBLE.`,
      "ROLLO_NOT_AVAILABLE",
      409,
    );
  }
  if (!isValidUnitCost(rollo.costoUnitario)) {
    return {
      valido: false,
      code: "ROLLO_SIN_COSTO",
      mensaje: rollWithoutValidUnitCostMessage(rollo.serie),
    };
  }
  if (precioCents < money(rollo.costoUnitario!)) {
    return {
      valido: false,
      mensaje: priceBelowCostMessage(rollo.tela, rollo.color, rollo.serie),
      code: "PRICE_BELOW_COST",
    };
  }
  return { valido: true };
}

export async function crearTicket(
  tx: Tx,
  input: CrearTicketInput,
  includeCosts: boolean,
) {
  await transactionAdvisoryLock(
    tx,
    ADVISORY_LOCK_NAMESPACES.POS_TICKET_IDEMPOTENCY,
    input.uuidCliente,
  );
  const [duplicate] = await tx
    .select({ id: ticketsTable.id })
    .from(ticketsTable)
    .where(eq(ticketsTable.uuidCliente, input.uuidCliente))
    .limit(1);
  if (duplicate) {
    return buildTicketDetail(tx, duplicate.id, includeCosts);
  }

  if (input.lineas.length === 0) {
    throw new PosError(
      "El ticket debe incluir al menos una línea.",
      "EMPTY_TICKET",
    );
  }
  if (!Number.isInteger(input.clienteId) || input.clienteId <= 0) {
    throw new PosError(
      "Debes seleccionar un cliente para crear el ticket.",
      "CLIENT_REQUIRED",
    );
  }
  const [ubicacion] = await tx
    .select()
    .from(ubicacionesTable)
    .where(eq(ubicacionesTable.id, input.ubicacionId))
    .limit(1);
  if (!ubicacion || !ubicacion.activa || ubicacion.tipo !== "TIENDA") {
    throw new PosError(
      "La venta requiere una tienda activa.",
      "INVALID_LOCATION",
    );
  }
  const documentoTipo = input.documentoTipo ?? "TICKET";
  if (documentoTipo === "NOTA") {
    await transactionAdvisoryLock(
      tx,
      ADVISORY_LOCK_NAMESPACES.CUSTOMER_CREDIT,
      input.clienteId,
    );
  }
  const [clienteTicket] = await tx
    .select({
      id: clientesTable.id,
      activo: clientesTable.activo,
      esSistema: clientesTable.esSistema,
      limiteCredito: clientesTable.limiteCredito,
    })
    .from(clientesTable)
    .where(eq(clientesTable.id, input.clienteId))
    .for("update")
    .limit(1);
  if (!clienteTicket?.activo) {
    throw new PosError("Cliente inválido o inactivo.", "INVALID_CLIENT");
  }
  const credito = documentoTipo === "NOTA";
  if (documentoTipo === "TICKET" && input.credito === true) {
    throw new PosError(
      "El crédito es exclusivo de las notas.",
      "TICKET_CREDIT_FORBIDDEN",
    );
  }
  if (documentoTipo === "NOTA" && clienteTicket.esSistema) {
    throw new PosError(
      "Venta a Público no admite compras a crédito.",
      "SYSTEM_CLIENT_CREDIT_FORBIDDEN",
    );
  }
  if (documentoTipo === "NOTA" && !isCreditTerm(input.diasPlazo)) {
    throw new PosError(
      "Debes elegir un plazo de crédito de 7, 15, 30 o 60 días.",
      "CREDIT_TERM_REQUIRED",
    );
  }
  if (documentoTipo === "TICKET" && input.diasPlazo != null) {
    throw new PosError(
      "El plazo solo se admite en una venta a crédito.",
      "CREDIT_TERM_NOT_ALLOWED",
    );
  }
  const notaSinPrecios =
    documentoTipo === "NOTA" && input.notaSinPrecios === true;
  const nombreDestinatario = input.nombreDestinatario?.trim() || null;
  const direccionEntregaSnapshot =
    input.direccionEntregaSnapshot?.trim() || null;
  const lineLocation = (linea: CrearTicketLineaInput) =>
    input.deferInventory
      ? (linea.ubicacionId ?? input.ubicacionId)
      : input.ubicacionId;

  // Acquire the complete, globally ordered inventory lock set before creating
  // any ticket row or locking individual rolls. Internal engine calls are
  // transaction-reentrant and therefore will not wait again.
  await lockInventoryPairs(
    tx,
    input.lineas.map((linea) => ({
      productoId: linea.productoId,
      ubicacionId: lineLocation(linea),
    })),
  );

  // NORMAL lines identify one physical roll/box/piece record. METREADO BOLSA inventory is
  // allocated FIFO later and deliberately remains absent from ticket_linea.
  const rolloIds = input.lineas.flatMap((linea) =>
    (linea.tipo ?? input.tipo) === "NORMAL" && linea.rolloId != null
      ? [linea.rolloId]
      : [],
  );
  if (new Set(rolloIds).size !== rolloIds.length) {
    throw new PosError(
      "No se puede agregar el mismo rollo dos veces.",
      "DUPLICATE_ROLLO",
    );
  }
  const rollos =
    rolloIds.length === 0
      ? []
      : await tx
          .select({
            id: rollosTable.id,
            serie: rollosTable.serie,
            productoId: rollosTable.productoId,
            ubicacionId: rollosTable.ubicacionId,
            estado: rollosTable.estado,
            cantidadActual: rollosTable.cantidadActual,
            costoUnitario: rollosTable.costoUnitario,
            precioSugerido: productosTable.precioSugerido,
            activoProducto: productosTable.activo,
            tela: productosTable.tela,
          })
          .from(rollosTable)
          .innerJoin(
            productosTable,
            eq(rollosTable.productoId, productosTable.id),
          )
          .where(
            and(
              inArray(rollosTable.id, rolloIds),
            ),
          )
          .orderBy(asc(rollosTable.createdAt), asc(rollosTable.id))
          .for("update");
  const rolloMap = new Map(rollos.map((rollo) => [rollo.id, rollo]));
  for (const linea of input.lineas) {
    if (
      (linea.tipo ?? input.tipo) !== "NORMAL" ||
      linea.rolloId == null
    ) {
      continue;
    }
    const rollo = rolloMap.get(linea.rolloId);
    if (!rollo || rollo.ubicacionId !== lineLocation(linea)) {
      throw new PosError("Rollo no encontrado.", "ROLLO_NOT_FOUND", 404);
    }
  }
  await assertNoActiveVentaClienteReservation(
    tx,
    rolloIds,
    input.deferInventory ? (input.owningSalidaIds ?? []) : [],
  );

  const productoIds = [
    ...new Set(input.lineas.map((linea) => linea.productoId)),
  ];
  const productos = await tx
    .select()
    .from(productosTable)
    .where(inArray(productosTable.id, productoIds));
  const productoMap = new Map(
    productos.map((producto) => [producto.id, producto]),
  );
  // This instant is the authoritative creation time for both the ticket and
  // every metered cost snapshot.  It is intentionally not recalculated while
  // processing individual lines.
  const ticketCreatedAt = new Date();
  const meteredProductIds = [
    ...new Set(
      input.lineas
        .filter((linea) => (linea.tipo ?? input.tipo) === "METREADO")
        .map((linea) => linea.productoId),
    ),
  ];
  const meteredCosts = new Map(
    await Promise.all(
      meteredProductIds.map(async (productId) => [
        productId,
        await meteredReferenceCost(tx, productId, ticketCreatedAt),
      ] as const),
    ),
  );

  const lineasPreparadas = input.lineas.map((linea) => {
    const tipo = linea.tipo ?? input.tipo;
    if (tipo == null) {
      throw new PosError(
        "Cada línea debe indicar si es NORMAL o METREADO.",
        "LINE_TYPE_REQUIRED",
      );
    }
    const cantidad = decimalQuantity(linea.cantidad);
    const precioCents = money(linea.precioUnitario);
    if (precioCents <= 0) {
      throw new PosError(
        "El precio unitario debe ser mayor a cero.",
        "INVALID_PRICE",
      );
    }
    const producto = productoMap.get(linea.productoId);
    if (!producto?.activo) {
      throw new PosError(
        `Producto ${linea.productoId} inválido o inactivo.`,
        "INVALID_PRODUCT",
      );
    }
    if (producto.precioSugerido == null) {
      throw new PosError(
        `El producto ${productName(producto.tela, producto.color)} no tiene precio sugerido capturado. Captúralo en el módulo de Precios antes de venderlo.`,
        "SUGGESTED_PRICE_NOT_CONFIGURED",
      );
    }
    if (
      (producto.unidad === "BOLSA" || producto.unidad === "PIEZA") &&
      !Number.isInteger(Number(cantidad))
    ) {
      throw new PosError(
        `La cantidad de ${producto.unidad === "PIEZA" ? "piezas" : "bolsas"} debe ser un número entero.`,
        `${producto.unidad}_INTEGER_QUANTITY_REQUIRED`,
      );
    }
    if (tipo === "NORMAL" && linea.rolloId == null) {
      throw new PosError(
        "Cada línea NORMAL requiere un rollo.",
        "ROLLO_REQUIRED",
      );
    }
    if (
      tipo === "METREADO" &&
      producto.unidad !== "METRO" &&
      producto.unidad !== "BOLSA"
    ) {
      throw new PosError(
        "Las líneas METREADO solo admiten productos por METRO o BOLSA.",
        "METREADO_UNIT_REQUIRED",
      );
    }
    if (tipo === "METREADO" && !producto.seVendePorMetro) {
      throw new PosError(
        `La venta por metro no está habilitada para ${productName(producto.tela, producto.color)}.`,
        "METREADO_NO_HABILITADO",
      );
    }
    const suggestedPrice =
      tipo === "METREADO"
        ? suggestedMeteredPrice(Number(cantidad), producto, producto.unidad).price
        : producto.precioSugerido;
    if (suggestedPrice == null) {
      throw new PosError(
        `No hay precio ${meteredPriceTier(Number(cantidad), producto.unidad).toLowerCase()} configurado para ${productName(producto.tela, producto.color)}.`,
        "METREADO_PRICE_NOT_CONFIGURED",
      );
    }
    const rollo =
      linea.rolloId == null ? null : (rolloMap.get(linea.rolloId) ?? null);
    if (tipo === "METREADO" && linea.rolloId != null) {
      throw new PosError(
        "Las líneas METREADO no pueden incluir un rollo.",
        "METREADO_ROLLO_NOT_ALLOWED",
        409,
      );
    }
    if (linea.rolloId != null && !rollo) {
      throw new PosError("Rollo no encontrado.", "ROLLO_NOT_FOUND", 404);
    }
    if (rollo) {
      if (rollo.productoId !== linea.productoId) {
        throw new PosError(
          `El rollo serie ${rollo.serie} no pertenece al producto seleccionado.`,
          "ROLLO_SCOPE",
        );
      }
      const estadoEsperado = "DISPONIBLE";
      if (rollo.estado !== estadoEsperado) {
        throw new PosError(
          `El rollo serie ${rollo.serie} no está ${estadoEsperado}.`,
          "ROLLO_NOT_AVAILABLE",
          409,
        );
      }
      if (
        tipo === "NORMAL" &&
        Number(cantidad) !== Number(rollo.cantidadActual)
      ) {
        throw new PosError(
          `La venta normal debe incluir la cantidad completa del rollo serie ${rollo.serie}.`,
          "FULL_ROLLO_REQUIRED",
        );
      }
      if (!isValidUnitCost(rollo.costoUnitario)) {
        throw new PosError(
          rollWithoutValidUnitCostMessage(rollo.serie),
          "ROLLO_SIN_COSTO",
        );
      }
      if (tipo === "NORMAL" && precioCents < money(rollo.costoUnitario!)) {
        throw new PosError(
          priceBelowCostMessage(producto.tela, producto.color, rollo.serie),
          "PRICE_BELOW_COST",
        );
      }
    }
    const importeCents = quantityTimesMoneyCents(cantidad, precioCents);
    const costoUnitario =
      tipo === "NORMAL"
        ? rollo!.costoUnitario!
        : (meteredCosts.get(linea.productoId)?.cost ?? null);
    const costoReferenciaEstado =
      tipo === "METREADO"
        ? meteredCosts.get(linea.productoId)!.status
        : null;
    const costoCents =
      costoUnitario == null
        ? null
        : quantityTimesMoneyCents(cantidad, money(costoUnitario));
    return {
      rolloId: rollo?.id ?? null,
      productoId: linea.productoId,
      tipo,
      cantidad,
      precioUnitario: decimalMoney(precioCents),
      // METREADO suggestions are selected independently per submitted line,
      // never by accumulating matching products elsewhere on the ticket.
      precioSugerido:
        suggestedPrice,
      importe: decimalMoney(importeCents),
      costoUnitarioCongelado: costoUnitario,
      costoTotalCongelado:
        costoCents == null ? null : decimalMoney(costoCents),
      costoReferenciaEstado,
      importeCents,
    };
  });
  if (
    input.facturado &&
    lineasPreparadas.some((linea) => linea.tipo === "METREADO")
  ) {
    throw new PosError(
      "Las ventas con líneas metreadas no pueden marcarse como facturadas.",
      "METREADO_FACTURADO",
    );
  }

  const subtotalCents = lineasPreparadas.reduce(
    (total, linea) => total + linea.importeCents,
    0,
  );
  const ivaCents = input.facturado
    ? Math.round((subtotalCents * IVA_RATE_BASIS_POINTS) / 10_000)
    : 0;
  const totalCents = subtotalCents + ivaCents;
  const folio = await reserveTicketFolio(tx);
  const [ticket] = await tx
    .insert(ticketsTable)
    .values({
      folio,
      ubicacionId: input.ubicacionId,
      usuarioTerminalId: input.usuarioTerminalId,
      clienteId: input.clienteId,
      documentoTipo,
      notaSinPrecios,
      nombreDestinatario,
      direccionEntregaSnapshot,
      subtotal: decimalMoney(subtotalCents),
      iva: decimalMoney(ivaCents),
      tasaIva: "0.1600",
      total: decimalMoney(totalCents),
      estado: "VENDIDO",
      cobrado: false,
      facturado: input.facturado,
      credito,
      autorizacionEstado: credito ? "PENDIENTE" : "NO_APLICA",
      diasPlazo: credito ? input.diasPlazo as CreditTerm : null,
      fechaVencimiento: credito
        ? creditDueDate(ticketCreatedAt, input.diasPlazo as CreditTerm)
        : null,
      uuidCliente: input.uuidCliente,
      createdAt: ticketCreatedAt,
    })
    .returning();

  // Sell every explicitly selected roll/box first. This prevents a FIFO BOLSA
  // line in the same ticket from consuming a box also selected as NORMAL.
  for (const linea of input.deferInventory ? [] : lineasPreparadas) {
    const producto = productoMap.get(linea.productoId)!;
    if (linea.tipo === "NORMAL" && linea.rolloId != null) {
      await venderRollo(tx, {
        rolloId: linea.rolloId,
        usuarioId: input.usuarioTerminalId,
        justificacion: `Venta ticket ${folio}`,
        documentoTipo:
          producto.unidad === "BOLSA"
            ? DOCUMENTO_TICKET_BOLSA_NORMAL
            : producto.unidad === "PIEZA"
              ? DOCUMENTO_TICKET_PIEZA_NORMAL
            : "TICKET",
        documentoId: String(ticket!.id),
        vaciarCantidadActual:
          producto.unidad === "BOLSA" || producto.unidad === "PIEZA",
      });
    }
  }
  for (const linea of input.deferInventory ? [] : lineasPreparadas) {
    const producto = productoMap.get(linea.productoId)!;
    if (linea.tipo === "METREADO" && producto.unidad === "BOLSA") {
      try {
        await consumirBolsasFifo(tx, {
          productoId: linea.productoId,
          ubicacionId: input.ubicacionId,
          cantidad: linea.cantidad,
          usuarioId: input.usuarioTerminalId,
          documentoId: String(ticket!.id),
          justificacion: `Venta metreada de bolsas ticket ${folio}`,
        });
      } catch (error) {
        if (error instanceof InventarioError) {
          throw new PosError(error.message, error.code, 409);
        }
        throw error;
      }
    }
  }
  for (const linea of lineasPreparadas) {
    await tx.insert(ticketLineasTable).values({
      ticketId: ticket!.id,
      rolloId: linea.rolloId,
      productoId: linea.productoId,
      tipo: linea.tipo as "NORMAL" | "METREADO",
      cantidad: linea.cantidad,
      precioUnitario: linea.precioUnitario,
      precioSugerido: linea.precioSugerido,
      importe: linea.importe,
      costoUnitarioCongelado: linea.costoUnitarioCongelado,
      costoTotalCongelado: linea.costoTotalCongelado,
      costoReferenciaEstado: linea.costoReferenciaEstado,
    });
  }

  await tx.insert(auditoriaTable).values({
    usuarioId: input.usuarioTerminalId,
    accion: "VENDER",
    entidad: "tickets",
    entidadId: String(ticket!.id),
    datosDespues: {
      folio,
      tiposLinea: [...new Set(lineasPreparadas.map((linea) => linea.tipo))],
      subtotal: decimalMoney(subtotalCents),
      iva: decimalMoney(ivaCents),
      total: decimalMoney(totalCents),
      documentoTipo,
      credito,
      diasPlazo: credito ? input.diasPlazo : null,
       notaSinPrecios,
      nombreDestinatario,
      direccionEntregaSnapshot,
      lineas: input.lineas.length,
    },
    ip: input.ip,
  });
  return buildTicketDetail(tx, ticket!.id, includeCosts);
}

export async function cancelarTicket(
  tx: Tx,
  input: {
    ticketId: number;
    requestedSalidaId?: number;
    usuarioId: number;
    autorizadoPor: number;
    motivo: string;
    ip: string;
  },
  includeCosts: boolean,
) {
  const motivo = input.motivo.trim();
  if (motivo.length < 10) {
    throw new PosError(
      "El motivo de cancelación debe tener al menos 10 caracteres.",
      "MOTIVO_REQUIRED",
    );
  }
  const [ticket] = await tx
    .select()
    .from(ticketsTable)
    .where(eq(ticketsTable.id, input.ticketId))
    .for("update")
    .limit(1);
  if (!ticket) {
    throw new PosError("Ticket no encontrado.", "TICKET_NOT_FOUND", 404);
  }
  if (ticket.estado === "CANCELADO") {
    throw new PosError(
      "El ticket ya está cancelado.",
      "ALREADY_CANCELLED",
      409,
    );
  }
  const linkedSalidas = await tx.select({ id: salidasTable.id, estado: salidasTable.estado })
    .from(salidasTable)
    .where(and(eq(salidasTable.ticketId, ticket.id), eq(salidasTable.modalidad, "VENTA_CLIENTE")))
    .orderBy(asc(salidasTable.id))
    .for("update");
  if (input.requestedSalidaId != null && !linkedSalidas.some(salida => salida.id === input.requestedSalidaId)) {
    throw new PosError(
      `La salida /salidas/${input.requestedSalidaId} ya no pertenece al documento /tickets/${ticket.id}.`,
      "LINKED_SALIDA_CHANGED",
      409,
    );
  }
  assertNoDeliveredLinkedSalida(ticket.id, linkedSalidas);
  // Serialize customer-credit cancellation with authorization before any
  // inventory or ledger work is performed.
  if (ticket.credito) {
    await transactionAdvisoryLock(
      tx,
      ADVISORY_LOCK_NAMESPACES.CUSTOMER_CREDIT,
      ticket.clienteId,
    );
  }

  const ventas = await tx
    .select()
    .from(movimientosTable)
    .where(
      and(
        eq(movimientosTable.tipo, "VENTA"),
        or(
          eq(movimientosTable.documentoTipo, "TICKET"),
          eq(movimientosTable.documentoTipo, "NOTA"),
          eq(
            movimientosTable.documentoTipo,
            DOCUMENTO_TICKET_BOLSA_NORMAL,
          ),
          eq(
            movimientosTable.documentoTipo,
            DOCUMENTO_TICKET_BOLSA_METREADO,
          ),
          eq(
            movimientosTable.documentoTipo,
            DOCUMENTO_TICKET_PIEZA_NORMAL,
          ),
        ),
        eq(movimientosTable.documentoId, String(ticket.id)),
      ),
    )
    .orderBy(asc(movimientosTable.id));
  await lockInventoryPairs(
    tx,
    ventas.map((venta) => ({
      productoId: venta.productoId,
      ubicacionId: venta.ubicacionId,
    })),
  );
  for (const venta of ventas) {
    await revertirMovimiento(tx, {
      movimientoOrigenId: Number(venta.id),
      usuarioId: input.usuarioId,
      justificacion: motivo,
    });
  }

  const creditCharges =
    ticket.documentoTipo === "NOTA" &&
    ticket.autorizacionEstado === "AUTORIZADA"
      ? await tx
          .select({
            id: movimientosCreditoTable.id,
            importe: movimientosCreditoTable.importe,
          })
          .from(movimientosCreditoTable)
          .where(
            and(
              eq(movimientosCreditoTable.ticketId, ticket.id),
              eq(movimientosCreditoTable.tipo, "VENTA_CREDITO"),
            ),
          )
          .for("update")
      : [];
  if (ticket.clienteId != null && creditCharges.length > 0) {
    const [clienteCredito] = await tx
      .select({ id: clientesTable.id, activo: clientesTable.activo })
      .from(clientesTable)
      .where(eq(clientesTable.id, ticket.clienteId))
      .for("update")
      .limit(1);
    if (!clienteCredito?.activo) {
      throw new PosError(
        "El cliente está inactivo; no se puede modificar su cuenta.",
        "INVALID_CLIENT",
        409,
      );
    }
    for (const charge of creditCharges) {
      const creditCents = money(charge.importe);
      if (creditCents <= 0) continue;
      const [existingReverse] = await tx
        .select({ id: movimientosCreditoTable.id })
        .from(movimientosCreditoTable)
        .where(
          and(
            eq(movimientosCreditoTable.movimientoOrigenId, charge.id),
            eq(movimientosCreditoTable.tipo, "REVERSO"),
          ),
        )
        .limit(1);
      if (existingReverse) continue;
      await tx.insert(movimientosCreditoTable).values({
        clienteId: ticket.clienteId,
        ticketId: ticket.id,
        tipo: "REVERSO",
        importe: decimalMoney(-creditCents),
        usuarioId: input.usuarioId,
        movimientoOrigenId: charge.id,
        notas: `Cancelación ticket ${ticket.folio}`,
        formaPago: "CREDITO",
        metadata: JSON.stringify({
          origen: "CANCELACION_TICKET",
          ticketFolio: ticket.folio,
        }),
      });
    }
  }

  const now = new Date();
  // Preserve the immutable notification row as evidence, but atomically
  // suppress any unread alert for the obligation that was just reversed.
  await tx
    .update(notificacionesCreditoTable)
    .set({ leidaAt: now })
    .where(
      and(
        eq(notificacionesCreditoTable.ticketId, ticket.id),
        isNull(notificacionesCreditoTable.leidaAt),
      ),
    );
  await tx
    .update(ticketsTable)
    .set({
      estado: "CANCELADO",
      canceladoAt: now,
      canceladoPor: input.usuarioId,
      motivoCancelacion: motivo,
      autorizadoPor: input.autorizadoPor,
    })
    .where(eq(ticketsTable.id, ticket.id));
  if (linkedSalidas.length) {
    await tx.update(salidasTable).set({
      estado: "CANCELADA",
      canceladaAt: now,
      usuarioCancelaId: input.usuarioId,
      motivoCancelacion: motivo,
      actividadAt: now,
    }).where(and(eq(salidasTable.ticketId, ticket.id), eq(salidasTable.modalidad, "VENTA_CLIENTE")));
  }
  await tx.insert(auditoriaTable).values({
    usuarioId: input.usuarioId,
    accion: "CANCELAR",
    entidad: "tickets",
    entidadId: String(ticket.id),
    datosAntes: {
      estado: ticket.estado,
      cobrado: ticket.cobrado,
    },
    datosDespues: {
      estado: "CANCELADO",
      motivo,
      autorizadoPor: input.autorizadoPor,
      requiereDevolucion: ticket.cobrado,
    },
    ip: input.ip,
  });
  return buildTicketDetail(tx, ticket.id, includeCosts);
}

export function assertNoDeliveredLinkedSalida(ticketId: number, linkedSalidas: ReadonlyArray<{ id: number; estado: string }>): void {
  const delivered = linkedSalidas.find((salida) => salida.estado === "ENTREGADA");
  if (!delivered) return;
  throw new PosError(
    `No se puede cancelar: la salida entregada /salidas/${delivered.id} pertenece a /tickets/${ticketId}.`,
    "LINKED_SALIDA_ALREADY_DELIVERED",
    409,
  );
}

export async function abrirSesionCaja(
  tx: Tx,
  input: {
    ubicacionId: number;
    usuarioId: number;
    fondoInicial: string;
    ip: string;
  },
) {
  const fondo = money(input.fondoInicial);
  if (fondo < 0) {
    throw new PosError(
      "El fondo inicial no puede ser negativo.",
      "INVALID_FUND",
    );
  }
  // Serialize openings for a location even when there are no session rows yet.
  // The operating day comes from PostgreSQL so API hosts cannot disagree on timezone.
  await transactionAdvisoryLock(
    tx,
    ADVISORY_LOCK_NAMESPACES.CASH_SESSION_SITE,
    input.ubicacionId,
  );
  const dayResult = await tx.execute(
    sql<{ fecha_operativa: string }>`SELECT (now() AT TIME ZONE 'America/Mexico_City')::date::text AS fecha_operativa`,
  );
  const fechaOperativa = String(dayResult.rows[0]!.fecha_operativa);
  const [existing] = await tx
    .select()
    .from(sesionesCajaTable)
    .where(
      and(
        eq(sesionesCajaTable.ubicacionId, input.ubicacionId),
        eq(sesionesCajaTable.estado, "ABIERTA"),
      ),
    )
    .for("update")
    .limit(1);
  if (existing) {
    throw new PosError(
      `Hay una sesión abierta del ${existing.fechaOperativa}; debe cerrarse antes de abrir una nueva.`,
      "PREVIOUS_SESSION_OPEN",
      409,
    );
  }
  const [today] = await tx
    .select({ id: sesionesCajaTable.id })
    .from(sesionesCajaTable)
    .where(and(eq(sesionesCajaTable.ubicacionId, input.ubicacionId), eq(sesionesCajaTable.fechaOperativa, fechaOperativa)))
    .limit(1);
  if (today) {
    throw new PosError(
      "Ya existe una sesión de caja para la fecha operativa de hoy, abierta o cerrada.",
      "SESSION_ALREADY_EXISTS_TODAY",
      409,
    );
  }
  try {
    // Claim the operational day before creating its session. The guardian makes
    // the rule safe without imposing a destructive unique constraint on history.
    await tx.insert(sesionesCajaDiasTable).values({
      ubicacionId: input.ubicacionId,
      fechaOperativa,
    });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "23505") {
      throw new PosError("Ya existe una sesión de caja para la fecha operativa de hoy.", "SESSION_ALREADY_EXISTS_TODAY", 409);
    }
    throw error;
  }
  const [created] = await tx
    .insert(sesionesCajaTable)
    .values({
      ubicacionId: input.ubicacionId,
      usuarioId: input.usuarioId,
      fondoInicial: decimalMoney(fondo),
      fechaOperativa,
      estado: "ABIERTA",
    })
    .returning();
  await tx.update(sesionesCajaDiasTable)
    .set({ sesionCajaId: created!.id })
    .where(and(eq(sesionesCajaDiasTable.ubicacionId, input.ubicacionId), eq(sesionesCajaDiasTable.fechaOperativa, fechaOperativa)));
  await tx.insert(auditoriaTable).values({
    usuarioId: input.usuarioId,
    accion: "ABRIR_CAJA",
    entidad: "sesiones_caja",
    entidadId: String(created!.id),
    datosDespues: { fondoInicial: decimalMoney(fondo), fechaOperativa, ubicacionId: input.ubicacionId },
    ip: input.ip,
  });
  return {
    ...created!,
    nombreUbicacion: "",
    nombreUsuario: "",
    abiertaAt: created!.abiertaAt.toISOString(),
    cerradaAt: null,
  };
}

export async function crearSalidaDineroCaja(
  tx: Tx,
  input: { sesionCajaId: number; monto: string; motivo: string; proveedorId?: number | null; cuentaOrigen: "CAJA_FISICA" | "CUENTA_NO_FISCAL" | "CUENTA_FISCAL"; creadoPorId: number; ip: string },
) {
  const monto = money(input.monto);
  if (monto <= 0) throw new PosError("El monto de la salida debe ser mayor a cero.", "INVALID_AMOUNT");
  const motivo = input.motivo.trim();
  if (!motivo || motivo.length > 500) throw new PosError("El motivo es obligatorio y debe tener máximo 500 caracteres.", "INVALID_REASON");
  const [sesion] = await tx.select().from(sesionesCajaTable)
    .where(eq(sesionesCajaTable.id, input.sesionCajaId)).for("update").limit(1);
  if (!sesion) throw new PosError("Sesión no encontrada.", "SESSION_NOT_FOUND", 404);
  if (sesion.ubicacionId !== MARIANA_LOCATION_ID) throw new PosError("Las salidas de dinero solo están autorizadas en Tienda Mariana.", "CASH_OUT_LOCATION_FORBIDDEN", 403);
  if (sesion.estado !== "ABIERTA") throw new PosError("No se pueden registrar salidas en una sesión cerrada.", "SESSION_CLOSED", 409);
  if (input.proveedorId != null) {
    const [proveedor] = await tx.select({ id: proveedoresTable.id, activo: proveedoresTable.activo }).from(proveedoresTable)
      .where(eq(proveedoresTable.id, input.proveedorId)).limit(1);
    if (!proveedor || !proveedor.activo) throw new PosError("El proveedor seleccionado no existe o está inactivo.", "PROVIDER_NOT_FOUND", 400);
  }
  const [created] = await tx.insert(salidasDineroCajaTable).values({
    sesionCajaId: sesion.id, monto: decimalMoney(monto), motivo, proveedorId: input.proveedorId ?? null,
    cuentaOrigen: input.cuentaOrigen, creadoPorId: input.creadoPorId,
  }).returning();
  await tx.insert(auditoriaTable).values({
    usuarioId: input.creadoPorId, accion: "SALIDA_DINERO_CAJA", entidad: "salidas_dinero_caja",
    entidadId: String(created!.id), datosDespues: { ubicacionId: sesion.ubicacionId, sesionCajaId: sesion.id, cuentaOrigen: input.cuentaOrigen, monto: decimalMoney(monto), motivo, proveedorId: input.proveedorId ?? null }, ip: input.ip,
  });
  return created!;
}

export async function cobrarTicket(
  tx: Tx,
  input: {
    ticketId: number;
    sesionCajaId: number;
    usuarioId: number;
    clienteId?: number | null;
    pagos: PagoTicketInput[];
    facturado?: boolean;
    ip: string;
  },
  includeCosts: boolean,
) {
  const [ticket] = await tx
    .select()
    .from(ticketsTable)
    .where(eq(ticketsTable.id, input.ticketId))
    .for("update")
    .limit(1);
  if (!ticket) {
    throw new PosError("Ticket no encontrado.", "TICKET_NOT_FOUND", 404);
  }
  if (ticket.estado !== "VENDIDO") {
    throw new PosError(
      "No se puede cobrar un ticket cancelado.",
      "TICKET_CANCELLED",
      409,
    );
  }
  if (ticket.cobrado) {
    throw new PosError("El ticket ya fue cobrado.", "ALREADY_CHARGED", 409);
  }
  if (ticket.documentoTipo !== "TICKET") {
    throw new PosError("Las notas se autorizan; no se cobran.", "NOTE_CHARGE_FORBIDDEN", 409);
  }
  const [sesion] = await tx
    .select()
    .from(sesionesCajaTable)
    .where(eq(sesionesCajaTable.id, input.sesionCajaId))
    .for("update")
    .limit(1);
  if (
    !sesion ||
    sesion.estado !== "ABIERTA" ||
    sesion.ubicacionId !== ticket.ubicacionId
  ) {
    throw new PosError(
      "Se requiere una sesión de caja abierta en la ubicación del ticket.",
      "OPEN_SESSION_REQUIRED",
      409,
    );
  }
  if (input.pagos.length === 0) {
    throw new PosError(
      "Debes capturar al menos una forma de pago.",
      "PAYMENT_REQUIRED",
    );
  }
  const pagos = input.pagos.map((pago) => {
    if (pago.formaPago === "CREDITO") {
      throw new PosError(
        "Crédito no es una forma de cobro de tickets.",
        "TICKET_CREDIT_PAYMENT_FORBIDDEN",
      );
    }
    const cents = money(pago.importe);
    if (cents <= 0) {
      throw new PosError(
        "Cada importe de pago debe ser mayor a cero.",
        "INVALID_PAYMENT",
      );
    }
    return { ...pago, cents };
  });
  const [metreado] = await tx
    .select({ id: ticketLineasTable.id })
    .from(ticketLineasTable)
    .where(
      and(
        eq(ticketLineasTable.ticketId, ticket.id),
        eq(ticketLineasTable.tipo, "METREADO"),
      ),
    )
    .limit(1);
  if (metreado && pagos.some((pago) => pago.formaPago !== "EFECTIVO")) {
    throw new PosError(
      "Los tickets metreados solo pueden cobrarse en efectivo.",
      "METREADO_CASH_ONLY",
    );
  }
  const activarFacturado =
    ticket.facturado || input.facturado === true ||
    pagos.some((pago) => pago.formaPago === "FACTURADO");
  if (metreado && activarFacturado) {
    throw new PosError("Las ventas con líneas metreadas no pueden marcarse como facturadas.", "METREADO_FACTURADO");
  }
  const totalCobroCents = activarFacturado
    ? money(ticket.subtotal) + Math.round((money(ticket.subtotal) * IVA_RATE_BASIS_POINTS) / 10_000)
    : money(ticket.total);
  const paymentTotal = pagos.reduce((sum, pago) => sum + pago.cents, 0);
  if (paymentTotal !== totalCobroCents) {
    throw new PosError(
      "La suma de los pagos debe ser exactamente igual al total del ticket.",
      "PAYMENT_TOTAL_MISMATCH",
    );
  }

  const clienteId = input.clienteId ?? ticket.clienteId;
  if (clienteId !== ticket.clienteId) {
    throw new PosError(
      "El cliente del ticket no puede cambiarse durante el cobro.",
      "CLIENT_MISMATCH",
    );
  }

  for (const pago of pagos) {
    await tx.insert(ticketPagosTable).values({
      ticketId: ticket.id,
      formaPago: pago.formaPago,
      importe: decimalMoney(pago.cents),
      referencia: pago.referencia?.trim() || null,
      usuarioId: input.usuarioId,
    });
  }
  const now = new Date();
  await tx
    .update(ticketsTable)
    .set({
      clienteId,
      facturado: activarFacturado,
      iva: decimalMoney(
        activarFacturado
          ? totalCobroCents - money(ticket.subtotal)
          : money(ticket.iva),
      ),
      tasaIva: activarFacturado
        ? (IVA_RATE_BASIS_POINTS / 10_000).toFixed(4)
        : ticket.tasaIva,
      total: decimalMoney(totalCobroCents),
      cobrado: true,
      cobradoAt: now,
      usuarioCajaId: input.usuarioId,
      sesionCajaId: sesion.id,
    })
    .where(eq(ticketsTable.id, ticket.id));
  await consumirRollosSalidaVenta(tx, ticket.id, input.usuarioId);
  await tx.insert(auditoriaTable).values({
    usuarioId: input.usuarioId,
    accion: "COBRAR",
    entidad: "tickets",
    entidadId: String(ticket.id),
    datosDespues: {
      sesionCajaId: sesion.id,
      pagos: pagos.map((pago) => ({
        formaPago: pago.formaPago,
        importe: decimalMoney(pago.cents),
      })),
    },
    ip: input.ip,
  });
  return buildTicketDetail(
    tx,
    ticket.id,
    includeCosts,
    false,
  );
}

export async function autorizarNota(
  tx: Tx,
  input: { ticketId: number; sesionCajaId: number; usuarioId: number; ip: string },
  includeCosts: boolean,
) {
  const [ticket] = await tx.select().from(ticketsTable)
    .where(eq(ticketsTable.id, input.ticketId)).for("update").limit(1);
  if (!ticket) throw new PosError("Nota no encontrada.", "NOTE_NOT_FOUND", 404);
  if (ticket.documentoTipo !== "NOTA" || !ticket.credito || !isCreditTerm(ticket.diasPlazo)) {
    throw new PosError("El documento no es una nota de crédito válida.", "NOT_A_CREDIT_NOTE", 409);
  }
  if (ticket.estado !== "VENDIDO") throw new PosError("La nota está cancelada.", "NOTE_CANCELLED", 409);
  if (ticket.autorizacionEstado === "AUTORIZADA") throw new PosError("La nota ya fue autorizada.", "ALREADY_AUTHORIZED", 409);
  const [sesion] = await tx.select().from(sesionesCajaTable)
    .where(eq(sesionesCajaTable.id, input.sesionCajaId)).for("update").limit(1);
  if (!sesion || sesion.estado !== "ABIERTA" || sesion.ubicacionId !== ticket.ubicacionId) {
    throw new PosError("Se requiere una sesión de caja abierta en la ubicación de la nota.", "OPEN_SESSION_REQUIRED", 409);
  }
  await transactionAdvisoryLock(tx, ADVISORY_LOCK_NAMESPACES.CUSTOMER_CREDIT, ticket.clienteId);
  const [cliente] = await tx.select().from(clientesTable)
    .where(eq(clientesTable.id, ticket.clienteId)).for("update").limit(1);
  if (!cliente?.activo || cliente.esSistema) throw new PosError("Cliente de crédito inválido.", "INVALID_CLIENT", 409);
  const ledger = await loadCustomerCreditLedgerInTransaction(ticket.clienteId, tx);
  const projection = projectCreditLedger(ledger);
  const saldo = projection.balanceCents - projection.overpaymentCents;
  const limite = money(cliente.limiteCredito);
  const importe = money(ticket.total);
  if (saldo + importe > limite) {
    const exceso = saldo + importe - limite;
    throw new PosError(`El límite se rebasa por $${decimalMoney(exceso)}. Un ADMIN debe subir el límite del cliente.`, "CREDIT_LIMIT_EXCEEDED", 409);
  }
  const [movement] = await tx.insert(movimientosCreditoTable).values({
    clienteId: ticket.clienteId, ticketId: ticket.id, tipo: "VENTA_CREDITO",
    importe: decimalMoney(importe), usuarioId: input.usuarioId, formaPago: "CREDITO",
    notas: `Nota ${ticket.folio}`, metadata: JSON.stringify({ origen: "AUTORIZACION_NOTA" }),
    diasPlazo: ticket.diasPlazo, fechaVencimiento: ticket.fechaVencimiento!,
  }).returning();
  const now = new Date();
  await consumirRollosSalidaVenta(tx, ticket.id, input.usuarioId);
  await tx.insert(autorizacionesNotaTable).values({
    ticketId: ticket.id, sesionCajaId: sesion.id, usuarioId: input.usuarioId,
    movimientoCreditoId: movement!.id, createdAt: now,
  });
  await tx.update(ticketsTable).set({
    autorizacionEstado: "AUTORIZADA", autorizadoAt: now, autorizadoPor: input.usuarioId,
    sesionCajaId: sesion.id,
  }).where(eq(ticketsTable.id, ticket.id));
  const [[cajero], [tienda]] = await Promise.all([
    tx.select({ nombre: usuariosTable.nombre }).from(usuariosTable)
      .where(eq(usuariosTable.id, input.usuarioId)).limit(1),
    tx.select({ nombre: ubicacionesTable.nombre }).from(ubicacionesTable)
      .where(eq(ubicacionesTable.id, ticket.ubicacionId)).limit(1),
  ]);
  await tx.insert(notificacionesCreditoTable).values({
    ticketId: ticket.id, clienteId: ticket.clienteId, clienteNombre: cliente.nombre,
    folio: ticket.folio, importe: decimalMoney(importe), diasPlazo: ticket.diasPlazo!,
    fechaVencimiento: ticket.fechaVencimiento!, cajeroId: input.usuarioId,
    cajeroNombre: cajero!.nombre, tiendaId: ticket.ubicacionId, tiendaNombre: tienda!.nombre,
  });
  await tx.insert(auditoriaTable).values({
    usuarioId: input.usuarioId, accion: "AUTORIZAR_NOTA", entidad: "tickets",
    entidadId: String(ticket.id), datosDespues: { sesionCajaId: sesion.id, movimientoCreditoId: movement!.id }, ip: input.ip,
  });
  return buildTicketDetail(tx, ticket.id, includeCosts);
}

export async function listarTicketsPendientesCaja(
  database: Reader,
  ubicacionId: number,
) {
  return database
    .select({
      id: ticketsTable.id,
      folio: ticketsTable.folio,
      ubicacionId: ticketsTable.ubicacionId,
      nombreUbicacion: ubicacionesTable.nombre,
      usuarioTerminalId: ticketsTable.usuarioTerminalId,
      nombreUsuarioTerminal: usuariosTable.nombre,
      clienteId: ticketsTable.clienteId,
      nombreCliente: clientesTable.nombre,
      notaSinPrecios: ticketsTable.notaSinPrecios,
      subtotal: ticketsTable.subtotal,
      iva: ticketsTable.iva,
      tasaIva: ticketsTable.tasaIva,
      total: ticketsTable.total,
      estado: ticketsTable.estado,
      cobrado: ticketsTable.cobrado,
      cobradoAt: ticketsTable.cobradoAt,
      usuarioCajaId: ticketsTable.usuarioCajaId,
      facturado: ticketsTable.facturado,
      sesionCajaId: ticketsTable.sesionCajaId,
      uuidCliente: ticketsTable.uuidCliente,
      createdAt: ticketsTable.createdAt,
      canceladoAt: ticketsTable.canceladoAt,
      canceladoPor: ticketsTable.canceladoPor,
      motivoCancelacion: ticketsTable.motivoCancelacion,
      autorizadoPor: ticketsTable.autorizadoPor,
      lineasCount: count(ticketLineasTable.id),
    })
    .from(ticketsTable)
    .innerJoin(
      ubicacionesTable,
      eq(ticketsTable.ubicacionId, ubicacionesTable.id),
    )
    .innerJoin(
      usuariosTable,
      eq(ticketsTable.usuarioTerminalId, usuariosTable.id),
    )
    .leftJoin(clientesTable, eq(ticketsTable.clienteId, clientesTable.id))
    .leftJoin(
      ticketLineasTable,
      eq(ticketLineasTable.ticketId, ticketsTable.id),
    )
    .where(
      and(
        eq(ticketsTable.ubicacionId, ubicacionId),
        eq(ticketsTable.estado, "VENDIDO"),
        or(
          and(eq(ticketsTable.documentoTipo, "TICKET"), eq(ticketsTable.cobrado, false)),
          and(eq(ticketsTable.documentoTipo, "NOTA"), eq(ticketsTable.autorizacionEstado, "PENDIENTE")),
        ),
      ),
    )
    .groupBy(
      ticketsTable.id,
      ubicacionesTable.nombre,
      usuariosTable.nombre,
      clientesTable.nombre,
    )
    .orderBy(asc(ticketsTable.createdAt));
}

export async function listarTicketsCajaOperativa(
  database: Reader,
  input: { ubicacionId: number; sesionCajaId: number },
) {
  const tickets = await database
    .select({
      id: ticketsTable.id,
      folio: ticketsTable.folio,
      subtotal: ticketsTable.subtotal,
      iva: ticketsTable.iva,
      tasaIva: ticketsTable.tasaIva,
      total: ticketsTable.total,
      facturado: ticketsTable.facturado,
      createdAt: ticketsTable.createdAt,
      cobrado: ticketsTable.cobrado,
      cobradoAt: ticketsTable.cobradoAt,
      documentoTipo: ticketsTable.documentoTipo,
      autorizacionEstado: ticketsTable.autorizacionEstado,
      autorizadoAt: ticketsTable.autorizadoAt,
    })
    .from(ticketsTable)
    .where(
      and(
        eq(ticketsTable.ubicacionId, input.ubicacionId),
        eq(ticketsTable.estado, "VENDIDO"),
        or(
          and(eq(ticketsTable.documentoTipo, "TICKET"), or(
            eq(ticketsTable.cobrado, false),
            and(eq(ticketsTable.cobrado, true), eq(ticketsTable.sesionCajaId, input.sesionCajaId)),
          )),
          and(eq(ticketsTable.documentoTipo, "NOTA"), or(
            eq(ticketsTable.autorizacionEstado, "PENDIENTE"),
            and(eq(ticketsTable.autorizacionEstado, "AUTORIZADA"), eq(ticketsTable.sesionCajaId, input.sesionCajaId)),
          )),
        ),
      ),
    )
    .orderBy(asc(ticketsTable.cobrado), asc(ticketsTable.createdAt));

  const pagos =
    tickets.length === 0
      ? []
      : await database
          .select({
            ticketId: ticketPagosTable.ticketId,
            formaPago: ticketPagosTable.formaPago,
          })
          .from(ticketPagosTable)
          .where(
            inArray(
              ticketPagosTable.ticketId,
              tickets.map((ticket) => ticket.id),
            ),
          )
          .orderBy(asc(ticketPagosTable.id));
  const formasPagoPorTicket = new Map<number, FormaPagoTicket[]>();
  for (const pago of pagos) {
    const formasPago = formasPagoPorTicket.get(pago.ticketId) ?? [];
    if (!formasPago.includes(pago.formaPago)) {
      formasPagoPorTicket.set(pago.ticketId, [...formasPago, pago.formaPago]);
    }
  }

  return tickets.map((ticket) => ({
    ...ticket,
    createdAt: ticket.createdAt.toISOString(),
    cobradoAt: ticket.cobradoAt?.toISOString() ?? null,
    autorizadoAt: ticket.autorizadoAt?.toISOString() ?? null,
    formasPago: formasPagoPorTicket.get(ticket.id) ?? [],
  }));
}

export async function listarSesionesCajaHistorial(database: Reader) {
  const rows = await database
    .select({
      id: sesionesCajaTable.id,
      ubicacionId: sesionesCajaTable.ubicacionId,
      nombreUbicacion: ubicacionesTable.nombre,
      usuarioId: sesionesCajaTable.usuarioId,
      nombreUsuario: usuariosTable.nombre,
      abiertaAt: sesionesCajaTable.abiertaAt,
      cerradaAt: sesionesCajaTable.cerradaAt,
      fondoInicial: sesionesCajaTable.fondoInicial,
      efectivoContado: sesionesCajaTable.efectivoContado,
      estado: sesionesCajaTable.estado,
      ticketsCobrados:
        sql<number>`COUNT(DISTINCT CASE WHEN ${ticketsTable.estado} = 'VENDIDO' THEN ${ticketsTable.id} END)::int`,
      ticketsCancelados:
        sql<number>`COUNT(DISTINCT CASE WHEN ${ticketsTable.estado} = 'CANCELADO' THEN ${ticketsTable.id} END)::int`,
      totalCobrado:
        sql<string>`COALESCE(SUM(CASE WHEN ${ticketsTable.estado} = 'VENDIDO' THEN ${ticketPagosTable.importe} ELSE 0 END), 0)::text`,
      efectivoCobrado:
        sql<string>`COALESCE(SUM(CASE WHEN ${ticketsTable.estado} = 'VENDIDO' AND ${ticketPagosTable.formaPago} = 'EFECTIVO' THEN ${ticketPagosTable.importe} ELSE 0 END), 0)::text`,
      salidasEfectivo:
        sql<string>`COALESCE((SELECT SUM(sdc.monto) FROM salidas_dinero_caja sdc WHERE sdc.sesion_caja_id = ${sesionesCajaTable.id} AND sdc.cuenta_origen = 'CAJA_FISICA'), 0)::text`,
    })
    .from(sesionesCajaTable)
    .innerJoin(
      ubicacionesTable,
      eq(sesionesCajaTable.ubicacionId, ubicacionesTable.id),
    )
    .innerJoin(usuariosTable, eq(sesionesCajaTable.usuarioId, usuariosTable.id))
    .leftJoin(
      ticketsTable,
      eq(ticketsTable.sesionCajaId, sesionesCajaTable.id),
    )
    .leftJoin(ticketPagosTable, eq(ticketPagosTable.ticketId, ticketsTable.id))
    .groupBy(
      sesionesCajaTable.id,
      ubicacionesTable.nombre,
      usuariosTable.nombre,
    )
    .orderBy(desc(sesionesCajaTable.abiertaAt));

  return rows.map((row) => {
    const efectivoEsperadoCents =
      money(row.fondoInicial) + money(row.efectivoCobrado) - money(row.salidasEfectivo);
    const efectivoContadoCents =
      row.efectivoContado == null ? null : money(row.efectivoContado);
    return {
      ...row,
      abiertaAt: row.abiertaAt.toISOString(),
      cerradaAt: row.cerradaAt?.toISOString() ?? null,
      efectivoEsperado: decimalMoney(efectivoEsperadoCents),
      diferencia:
        efectivoContadoCents == null
          ? null
          : decimalMoney(efectivoContadoCents - efectivoEsperadoCents),
    };
  });
}

export async function buildCorteCaja(database: Reader, sesionId: number) {
  const [sesion] = await database
    .select({
      id: sesionesCajaTable.id,
      ubicacionId: sesionesCajaTable.ubicacionId,
      nombreUbicacion: ubicacionesTable.nombre,
      usuarioId: sesionesCajaTable.usuarioId,
      nombreUsuario: usuariosTable.nombre,
      abiertaAt: sesionesCajaTable.abiertaAt,
      cerradaAt: sesionesCajaTable.cerradaAt,
      fechaOperativa: sesionesCajaTable.fechaOperativa,
      cerradaPorId: sesionesCajaTable.cerradaPorId,
      fondoInicial: sesionesCajaTable.fondoInicial,
      efectivoContado: sesionesCajaTable.efectivoContado,
      estado: sesionesCajaTable.estado,
    })
    .from(sesionesCajaTable)
    .innerJoin(
      ubicacionesTable,
      eq(sesionesCajaTable.ubicacionId, ubicacionesTable.id),
    )
    .innerJoin(usuariosTable, eq(sesionesCajaTable.usuarioId, usuariosTable.id))
    .where(eq(sesionesCajaTable.id, sesionId))
    .limit(1);
  if (!sesion) return null;

  const [cerrador] = sesion.cerradaPorId == null
    ? []
    : await database
        .select({ nombre: usuariosTable.nombre })
        .from(usuariosTable)
        .where(eq(usuariosTable.id, sesion.cerradaPorId))
        .limit(1);

  const pagos = await database
    .select({
      ticketId: ticketPagosTable.ticketId,
      folio: ticketsTable.folio,
      formaPago: ticketPagosTable.formaPago,
      importe: ticketPagosTable.importe,
      facturado: ticketsTable.facturado,
      subtotal: ticketsTable.subtotal,
      iva: ticketsTable.iva,
      total: ticketsTable.total,
      estado: ticketsTable.estado,
    })
    .from(ticketPagosTable)
    .innerJoin(ticketsTable, eq(ticketPagosTable.ticketId, ticketsTable.id))
    .where(eq(ticketsTable.sesionCajaId, sesion.id));
  const salidas = await database.select({
    id: salidasDineroCajaTable.id, sesionCajaId: salidasDineroCajaTable.sesionCajaId, creadoPorId: salidasDineroCajaTable.creadoPorId, monto: salidasDineroCajaTable.monto, motivo: salidasDineroCajaTable.motivo,
    proveedorId: salidasDineroCajaTable.proveedorId, cuentaOrigen: salidasDineroCajaTable.cuentaOrigen,
    createdAt: salidasDineroCajaTable.createdAt, proveedor: proveedoresTable.nombre,
  }).from(salidasDineroCajaTable)
    .leftJoin(proveedoresTable, eq(salidasDineroCajaTable.proveedorId, proveedoresTable.id))
    .where(eq(salidasDineroCajaTable.sesionCajaId, sesion.id)).orderBy(salidasDineroCajaTable.createdAt);

  const pendientes = (
    await listarTicketsPendientesCaja(database, sesion.ubicacionId)
  ).map((ticket) => ({
    ticketId: ticket.id,
    folio: ticket.folio,
    total: ticket.total,
    nombreCliente: ticket.nombreCliente,
    createdAt: ticket.createdAt,
  }));

  const productos = await database
    .select({
      productoId: ticketLineasTable.productoId,
      sku: productosTable.sku,
      tela: productosTable.tela,
      color: productosTable.color,
      tipo: ticketLineasTable.tipo,
      unidad: productosTable.unidad,
      cantidad: sql<string>`SUM(${ticketLineasTable.cantidad})::text`,
      importe: sql<string>`SUM(${ticketLineasTable.importe})::text`,
    })
    .from(ticketLineasTable)
    .innerJoin(ticketsTable, eq(ticketLineasTable.ticketId, ticketsTable.id))
    .innerJoin(
      productosTable,
      eq(ticketLineasTable.productoId, productosTable.id),
    )
    .where(
      and(
        eq(ticketsTable.sesionCajaId, sesion.id),
        eq(ticketsTable.estado, "VENDIDO"),
      ),
    )
    .groupBy(
      ticketLineasTable.productoId,
      ticketLineasTable.tipo,
      productosTable.sku,
      productosTable.tela,
      productosTable.color,
      productosTable.unidad,
    )
    .orderBy(productosTable.tela, productosTable.color);

  // This is intentionally session-scoped, not a rolling date report. It uses
  // the same frozen ticket_lineas values as the printed ticket and never joins
  // rollos, so serial numbers cannot leak into the daily sales sheet.
  const hojaLineas = await database
    .select({
      productoId: ticketLineasTable.productoId,
      sku: productosTable.sku,
      tela: productosTable.tela,
      color: productosTable.color,
      tipo: ticketLineasTable.tipo,
      unidad: productosTable.unidad,
      cantidadFisica: sql<string>`COALESCE(SUM(${ticketLineasTable.cantidad}), 0)::text`,
      cantidadRollos: sql<number>`COUNT(CASE WHEN ${ticketLineasTable.tipo} = 'NORMAL' THEN ${ticketLineasTable.id} END)::int`,
      importe: sql<string>`COALESCE(SUM(${ticketLineasTable.importe}), 0)::text`,
    })
    .from(ticketLineasTable)
    .innerJoin(ticketsTable, eq(ticketLineasTable.ticketId, ticketsTable.id))
    .innerJoin(productosTable, eq(ticketLineasTable.productoId, productosTable.id))
    .where(and(
      eq(ticketsTable.sesionCajaId, sesion.id),
      eq(ticketsTable.estado, "VENDIDO"),
      eq(ticketsTable.cobrado, true),
    ))
    .groupBy(
      ticketLineasTable.productoId,
      ticketLineasTable.tipo,
      productosTable.sku,
      productosTable.tela,
      productosTable.color,
      productosTable.unidad,
    )
    .orderBy(ticketLineasTable.tipo, productosTable.tela, productosTable.color);

  const hojaTickets = await database
    .select({
      subtotal: ticketsTable.subtotal,
      iva: ticketsTable.iva,
      total: ticketsTable.total,
      facturado: ticketsTable.facturado,
    })
    .from(ticketsTable)
    .where(and(
      eq(ticketsTable.sesionCajaId, sesion.id),
      eq(ticketsTable.estado, "VENDIDO"),
      eq(ticketsTable.cobrado, true),
    ));

  const hojaAgrupada = aggregateHojaVentasDia(hojaLineas, hojaTickets);

  const ticketsCobradosDetalle = await database
    .select({
      ticketId: ticketsTable.id,
      folio: ticketsTable.folio,
      importe: ticketsTable.total,
      cobradoAt: ticketsTable.cobradoAt,
    })
    .from(ticketsTable)
    .where(and(
      eq(ticketsTable.sesionCajaId, sesion.id),
      eq(ticketsTable.estado, "VENDIDO"),
      eq(ticketsTable.cobrado, true),
    ))
    .orderBy(ticketsTable.cobradoAt);
  const cancelacionesDetalle = await database
    .select({
      ticketId: ticketsTable.id,
      folio: ticketsTable.folio,
      importe: ticketsTable.total,
      motivo: ticketsTable.motivoCancelacion,
      canceladoAt: ticketsTable.canceladoAt,
      autor: usuariosTable.nombre,
    })
    .from(ticketsTable)
    .leftJoin(usuariosTable, eq(ticketsTable.canceladoPor, usuariosTable.id))
    .where(and(
      eq(ticketsTable.sesionCajaId, sesion.id),
      eq(ticketsTable.estado, "CANCELADO"),
    ))
    .orderBy(ticketsTable.canceladoAt);

  const tipos = await database
    .select({
      tipo: ticketLineasTable.tipo,
      unidad: productosTable.unidad,
      ticketsCount: sql<number>`COUNT(DISTINCT ${ticketsTable.id})::int`,
      cantidad: sql<string>`COALESCE(SUM(${ticketLineasTable.cantidad}), 0)::text`,
      importe: sql<string>`COALESCE(SUM(${ticketLineasTable.importe}), 0)::text`,
    })
    .from(ticketsTable)
    .innerJoin(
      ticketLineasTable,
      eq(ticketLineasTable.ticketId, ticketsTable.id),
    )
    .innerJoin(
      productosTable,
      eq(ticketLineasTable.productoId, productosTable.id),
    )
    .where(
      and(
        eq(ticketsTable.sesionCajaId, sesion.id),
        eq(ticketsTable.estado, "VENDIDO"),
      ),
    )
    .groupBy(ticketLineasTable.tipo, productosTable.unidad)
    .orderBy(ticketLineasTable.tipo, productosTable.unidad);

  const formas = { EFECTIVO: 0, TRANSFERENCIA: 0, CREDITO: 0, FACTURADO: 0 };
  const cuentas = {
    CAJA_FISICA: 0,
    CUENTA_FISCAL: 0,
    CUENTA_NO_FISCAL: 0,
    CUENTAS_POR_COBRAR: 0,
  };
  let facturado = 0;
  let noFacturado = 0;
  let ivaCobrado = 0;
  const facturacionPagos = {
    facturado: { EFECTIVO: 0, TRANSFERENCIA: 0, CREDITO: 0, FACTURADO: 0 },
    noFacturado: { EFECTIVO: 0, TRANSFERENCIA: 0, CREDITO: 0, FACTURADO: 0 },
  };
  const ticketIds = new Set<number>();
  const formaPagoCounts: Record<FormaPagoTicket, number> = {
    EFECTIVO: 0,
    TRANSFERENCIA: 0,
    CREDITO: 0,
    FACTURADO: 0,
  };
  const formaPagoTickets: Record<FormaPagoTicket, Set<number>> = {
    EFECTIVO: new Set<number>(),
    TRANSFERENCIA: new Set<number>(),
    CREDITO: new Set<number>(),
    FACTURADO: new Set<number>(),
  };
  const facturadoTickets = new Set<number>();
  const noFacturadoTickets = new Set<number>();
  const fiscalesPorTicket = new Map<
    number,
    { facturado: boolean; subtotal: number; iva: number; total: number }
  >();
  for (const pago of pagos) {
    if (pago.estado === "CANCELADO") continue;
    const cents = money(pago.importe);
    formas[pago.formaPago] += cents;
    ticketIds.add(pago.ticketId);
    formaPagoCounts[pago.formaPago] += 1;
    formaPagoTickets[pago.formaPago].add(pago.ticketId);
    if (pago.facturado) {
      facturadoTickets.add(pago.ticketId);
      facturacionPagos.facturado[pago.formaPago] += cents;
    } else {
      noFacturadoTickets.add(pago.ticketId);
      facturacionPagos.noFacturado[pago.formaPago] += cents;
    }
    fiscalesPorTicket.set(pago.ticketId, {
      facturado: pago.facturado,
      subtotal: money(pago.subtotal),
      iva: money(pago.iva),
      total: money(pago.total),
    });
    if (pago.formaPago === "EFECTIVO") cuentas.CAJA_FISICA += cents;
    if (pago.formaPago === "CREDITO") cuentas.CUENTAS_POR_COBRAR += cents;
    if (pago.formaPago === "FACTURADO") cuentas.CUENTA_FISCAL += cents;
    if (pago.formaPago === "TRANSFERENCIA") {
      if (pago.facturado) cuentas.CUENTA_FISCAL += cents;
      else cuentas.CUENTA_NO_FISCAL += cents;
    }
  }
  const salidasPorCuenta = { CAJA_FISICA: 0, CUENTA_NO_FISCAL: 0, CUENTA_FISCAL: 0 };
  for (const salida of salidas) {
    const cents = money(salida.monto);
    salidasPorCuenta[salida.cuentaOrigen] += cents;
    cuentas[salida.cuentaOrigen] -= cents;
  }
  let subtotalFacturado = 0;
  let ivaFacturado = 0;
  let subtotalNoFacturado = 0;
  let ivaNoFacturado = 0;
  for (const fiscal of fiscalesPorTicket.values()) {
    ivaCobrado += fiscal.iva;
    if (fiscal.facturado) {
      subtotalFacturado += fiscal.subtotal;
      ivaFacturado += fiscal.iva;
      facturado += fiscal.total;
    } else {
      subtotalNoFacturado += fiscal.subtotal;
      ivaNoFacturado += fiscal.iva;
      noFacturado += fiscal.total;
    }
  }
  const totalCobrado = Object.values(formas).reduce(
    (total, value) => total + value,
    0,
  );
  const esperado = money(sesion.fondoInicial) + formas.EFECTIVO - salidasPorCuenta.CAJA_FISICA;
  const contado =
    sesion.efectivoContado == null ? null : money(sesion.efectivoContado);
  return {
    sesion: {
      ...sesion,
      abiertaAt: sesion.abiertaAt.toISOString(),
      cerradaAt: sesion.cerradaAt?.toISOString() ?? null,
    },
    ticketsCobrados: ticketIds.size,
    ticketsCancelados: new Set(
      pagos
        .filter((pago) => pago.estado === "CANCELADO")
        .map((pago) => pago.ticketId),
    ).size,
    ticketsPendientes: pendientes.length,
    totalCobrado: decimalMoney(totalCobrado),
    ivaCobrado: decimalMoney(ivaCobrado),
    formasPago: (["EFECTIVO", "TRANSFERENCIA", "FACTURADO", "CREDITO"] as const).map(
      (formaPago) => ({
        formaPago,
        importe: decimalMoney(formas[formaPago]),
        pagosCount: formaPagoCounts[formaPago],
        ticketsCount: formaPagoTickets[formaPago].size,
      }),
    ),
    cuentasDestino: [
      {
        formaPago: "EFECTIVO" as const,
        cuentaDestino: ACCOUNT_DESTINATION_ORDER[0],
        importe: decimalMoney(cuentas.CAJA_FISICA),
      },
      {
        formaPago: "TRANSFERENCIA" as const,
        cuentaDestino: ACCOUNT_DESTINATION_ORDER[1],
        importe: decimalMoney(cuentas.CUENTA_NO_FISCAL),
      },
      {
        formaPago: "TRANSFERENCIA" as const,
        cuentaDestino: ACCOUNT_DESTINATION_ORDER[2],
        importe: decimalMoney(cuentas.CUENTA_FISCAL),
      },
      {
        formaPago: "CREDITO" as const,
        cuentaDestino: ACCOUNT_DESTINATION_ORDER[3],
        importe: decimalMoney(cuentas.CUENTAS_POR_COBRAR),
      },
    ],
    salidas: salidas.map((salida) => ({ ...salida, createdAt: salida.createdAt.toISOString() })),
    salidasPorCuenta: Object.fromEntries(Object.entries(salidasPorCuenta).map(([cuentaOrigen, cents]) => [cuentaOrigen, decimalMoney(cents)])),
    facturacion: [
      {
        facturado: true,
        ticketsCount: facturadoTickets.size,
        subtotal: decimalMoney(subtotalFacturado),
        iva: decimalMoney(ivaFacturado),
        importe: decimalMoney(facturado),
        efectivo: decimalMoney(facturacionPagos.facturado.EFECTIVO),
        transferencia: decimalMoney(facturacionPagos.facturado.TRANSFERENCIA),
        credito: decimalMoney(facturacionPagos.facturado.CREDITO),
      },
      {
        facturado: false,
        ticketsCount: noFacturadoTickets.size,
        subtotal: decimalMoney(subtotalNoFacturado),
        iva: decimalMoney(ivaNoFacturado),
        importe: decimalMoney(noFacturado),
        efectivo: decimalMoney(facturacionPagos.noFacturado.EFECTIVO),
        transferencia: decimalMoney(facturacionPagos.noFacturado.TRANSFERENCIA),
        credito: decimalMoney(facturacionPagos.noFacturado.CREDITO),
      },
    ],
    metreado: tipos.map((row) => ({
      tipo: row.tipo,
      unidad: row.unidad,
      ticketsCount: row.ticketsCount,
      cantidad: row.cantidad,
      importe: row.importe,
    })),
    productos,
    pendientes: pendientes.map((ticket) => ({
      ...ticket,
      createdAt: ticket.createdAt.toISOString(),
    })),
    ticketsCobradosDetalle: ticketsCobradosDetalle.map((ticket) => ({
      ...ticket,
      cobradoAt: ticket.cobradoAt!.toISOString(),
    })),
    cancelaciones: cancelacionesDetalle.map((ticket) => ({
      ...ticket,
      motivo: ticket.motivo ?? "",
      canceladoAt: ticket.canceladoAt!.toISOString(),
      autor: ticket.autor ?? "Usuario desconocido",
    })),
    efectivoEsperado: decimalMoney(esperado),
    efectivoContado: contado == null ? null : decimalMoney(contado),
    diferencia: contado == null ? null : decimalMoney(contado - esperado),
    fondoInicial: sesion.fondoInicial,
    hojaVentasDia: {
      sitio: sesion.nombreUbicacion,
      fechaOperativa: sesion.fechaOperativa,
      cerrada: sesion.estado === "CERRADA",
      quienCerro: cerrador?.nombre ?? null,
      ...hojaAgrupada,
    },
  };
}

export async function cerrarSesionCaja(
  tx: Tx,
  input: {
    sesionId: number;
    usuarioId: number;
    efectivoContado: string;
    ip: string;
  },
) {
  const contado = money(input.efectivoContado);
  if (contado < 0) {
    throw new PosError(
      "El efectivo contado no puede ser negativo.",
      "INVALID_CASH_COUNT",
    );
  }
  const [sesion] = await tx
    .select()
    .from(sesionesCajaTable)
    .where(eq(sesionesCajaTable.id, input.sesionId))
    .for("update")
    .limit(1);
  if (!sesion) {
    throw new PosError("Sesión no encontrada.", "SESSION_NOT_FOUND", 404);
  }
  if (sesion.estado !== "ABIERTA") {
    throw new PosError(
      "Una sesión cerrada no se puede reabrir ni volver a cerrar.",
      "SESSION_CLOSED",
      409,
    );
  }
  await tx
    .update(sesionesCajaTable)
    .set({
      estado: "CERRADA",
      cerradaAt: new Date(),
      cerradaPorId: input.usuarioId,
      efectivoContado: decimalMoney(contado),
    })
    .where(eq(sesionesCajaTable.id, sesion.id));
  const corte = await buildCorteCaja(tx, sesion.id);
  await tx.insert(auditoriaTable).values({
    usuarioId: input.usuarioId,
    accion: "CERRAR_CAJA",
    entidad: "sesiones_caja",
    entidadId: String(sesion.id),
    datosDespues: {
      efectivoContado: decimalMoney(contado),
      diferencia: corte?.diferencia ?? null,
    },
    ip: input.ip,
  });
  return corte;
}

export async function buscarPos(
  database: Reader,
  q: string,
  ubicacionId: number,
) {
  const codigo = interpretarCodigoEscaneado(q);
  const term = `%${q.trim()}%`;
  const rolloSearch = codigo.serie
    ? eq(rollosTable.serie, codigo.serie)
    : sql`(${rollosTable.serie} ILIKE ${term}
        OR ${productosTable.sku} ILIKE ${term}
        OR ${productosTable.tela} ILIKE ${term}
        OR ${productosTable.color} ILIKE ${term})`;
  const rollos = await database
    .select({
      id: rollosTable.id,
      serie: rollosTable.serie,
      productoId: rollosTable.productoId,
      sku: productosTable.sku,
      tela: productosTable.tela,
      color: productosTable.color,
      unidad: productosTable.unidad,
      cantidad: rollosTable.cantidadActual,
      cantidadActual: rollosTable.cantidadActual,
      precioSugerido: productosTable.precioSugerido,
      ubicacionId: rollosTable.ubicacionId,
      nombreUbicacion: ubicacionesTable.nombre,
    })
    .from(rollosTable)
    .innerJoin(productosTable, eq(rollosTable.productoId, productosTable.id))
    .innerJoin(
      ubicacionesTable,
      eq(rollosTable.ubicacionId, ubicacionesTable.id),
    )
    .where(
      and(
        eq(rollosTable.ubicacionId, ubicacionId),
        eq(rollosTable.estado, "DISPONIBLE"),
        eq(productosTable.activo, true),
        rolloSearch,
      ),
    )
    .orderBy(desc(rollosTable.id))
    .limit(50);
   const productos = codigo.serie
    ? []
    : await database
        .select({
          id: productosTable.id,
          sku: productosTable.sku,
          tela: productosTable.tela,
          color: productosTable.color,
          unidad: productosTable.unidad,
          precioSugerido: productosTable.precioSugerido,
           precioMayoreo: productosTable.precioMayoreo,
           precioMenudeo: productosTable.precioMenudeo,
          seVendePorMetro: productosTable.seVendePorMetro,
          activo: productosTable.activo,
        })
        .from(productosTable)
        .where(
          and(
            eq(productosTable.activo, true),
            sql`(${productosTable.sku} ILIKE ${term}
              OR ${productosTable.tela} ILIKE ${term}
              OR ${productosTable.color} ILIKE ${term})`,
          ),
        )
        .orderBy(productosTable.tela, productosTable.color)
        .limit(25);
   const productosConCosto = await Promise.all(
     productos.map(async (producto) => {
       const reference = await meteredReferenceCost(
         database,
         producto.id,
         new Date(),
       );
       return {
         ...producto,
         costoReferenciaMetreado: {
           costoUnitario: reference.cost,
           estado: reference.status,
           esMayorA12Meses: reference.isOlderThan12Months,
           rollosIncluidos: reference.rollsIncluded,
           fechaUltimaRecepcion:
             reference.latestReceptionDate?.toISOString() ?? null,
         },
       };
     }),
   );
   return { rollos, productos: productosConCosto };
}

export function isInventoryError(error: unknown): error is InventarioError {
  return error instanceof InventarioError;
}
