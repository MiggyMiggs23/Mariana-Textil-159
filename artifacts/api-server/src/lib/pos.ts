import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import {
  auditoriaTable,
  clientesTable,
  db,
  movimientosCreditoTable,
  movimientosTable,
  productosTable,
  rollosTable,
  sesionesCajaTable,
  ticketFolioTable,
  ticketLineasTable,
  ticketPagosTable,
  ticketsTable,
  ubicacionesTable,
  usuariosTable,
  type FormaPagoTicket,
  type TipoTicket,
} from "@workspace/db";
import {
  InventarioError,
  revertirMovimiento,
  venderRollo,
  type Tx,
} from "./inventario";

const FOLIO_ROW_ID = 1;

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
  cantidad: string;
  precioUnitario: string;
};

export type CrearTicketInput = {
  ubicacionId: number;
  usuarioTerminalId: number;
  clienteId?: number | null;
  tipo: TipoTicket;
  facturado: boolean;
  uuidCliente: string;
  lineas: CrearTicketLineaInput[];
  ip: string;
};

export type PagoTicketInput = {
  formaPago: FormaPagoTicket;
  importe: string;
  referencia?: string | null;
};

type Reader = Pick<typeof db, "select">;

function money(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new PosError("Importe inválido.", "INVALID_AMOUNT");
  }
  return Math.round((parsed + Number.EPSILON) * 100);
}

function decimalMoney(cents: number): string {
  return (cents / 100).toFixed(2);
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
      tipo: ticketsTable.tipo,
      subtotal: ticketsTable.subtotal,
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

  const lineas = await database
    .select({
      id: ticketLineasTable.id,
      ticketId: ticketLineasTable.ticketId,
      rolloId: ticketLineasTable.rolloId,
      serie: rollosTable.serie,
      productoId: ticketLineasTable.productoId,
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
    .innerJoin(
      usuariosTable,
      eq(ticketPagosTable.usuarioId, usuariosTable.id),
    )
    .where(eq(ticketPagosTable.ticketId, ticketId))
    .orderBy(asc(ticketPagosTable.id));

  return {
    ...ticket,
    nombreUsuarioCaja: null,
    nombreUsuarioCancelacion: null,
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
      const costo = money(linea.costoTotalCongelado);
      const importe = money(linea.importe);
      return {
        ...base,
        costoUnitarioCongelado: linea.costoUnitarioCongelado,
        costoTotalCongelado: linea.costoTotalCongelado,
        margen: decimalMoney(importe - costo),
      };
    }),
    pagos: pagos.map((pago) => ({
      ...pago,
      createdAt: pago.createdAt.toISOString(),
    })),
  };
}

export async function crearTicket(
  tx: Tx,
  input: CrearTicketInput,
  includeCosts: boolean,
) {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${input.uuidCliente}))`,
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
  if (input.tipo === "METREADO" && input.facturado) {
    throw new PosError(
      "Las ventas metreadas no pueden marcarse como facturadas.",
      "METREADO_FACTURADO",
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
  if (input.clienteId != null) {
    const [cliente] = await tx
      .select({ id: clientesTable.id, activo: clientesTable.activo })
      .from(clientesTable)
      .where(eq(clientesTable.id, input.clienteId))
      .limit(1);
    if (!cliente?.activo) {
      throw new PosError("Cliente inválido o inactivo.", "INVALID_CLIENT");
    }
  }

  const rolloIds = input.lineas.flatMap((linea) =>
    linea.rolloId == null ? [] : [linea.rolloId],
  );
  if (new Set(rolloIds).size !== rolloIds.length) {
    throw new PosError(
      "No se puede agregar el mismo rollo dos veces.",
      "DUPLICATE_ROLLO",
    );
  }
  if (input.tipo === "NORMAL" && rolloIds.length !== input.lineas.length) {
    throw new PosError(
      "Cada línea de una venta normal requiere un rollo.",
      "ROLLO_REQUIRED",
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
          .where(inArray(rollosTable.id, rolloIds));
  const rolloMap = new Map(rollos.map((rollo) => [rollo.id, rollo]));

  const productoIds = [...new Set(input.lineas.map((linea) => linea.productoId))];
  const productos = await tx
    .select()
    .from(productosTable)
    .where(inArray(productosTable.id, productoIds));
  const productoMap = new Map(
    productos.map((producto) => [producto.id, producto]),
  );

  const lineasPreparadas = input.lineas.map((linea) => {
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
    const rollo =
      linea.rolloId == null ? null : (rolloMap.get(linea.rolloId) ?? null);
    if (linea.rolloId != null && !rollo) {
      throw new PosError("Rollo no encontrado.", "ROLLO_NOT_FOUND", 404);
    }
    if (rollo) {
      if (
        rollo.productoId !== linea.productoId ||
        rollo.ubicacionId !== input.ubicacionId
      ) {
        throw new PosError(
          `El rollo serie ${rollo.serie} no pertenece al producto o ubicación seleccionados.`,
          "ROLLO_SCOPE",
        );
      }
      const estadoEsperado =
        input.tipo === "NORMAL" ? "DISPONIBLE" : "ABIERTO";
      if (rollo.estado !== estadoEsperado) {
        throw new PosError(
          `El rollo serie ${rollo.serie} no está ${estadoEsperado}.`,
          "ROLLO_NOT_AVAILABLE",
          409,
        );
      }
      if (
        input.tipo === "NORMAL" &&
        Number(cantidad) !== Number(rollo.cantidadActual)
      ) {
        throw new PosError(
          `La venta normal debe incluir la cantidad completa del rollo serie ${rollo.serie}.`,
          "FULL_ROLLO_REQUIRED",
        );
      }
      if (input.tipo === "NORMAL" && precioCents < money(rollo.costoUnitario)) {
        throw new PosError(
          `El precio de ${producto.tela} serie ${rollo.serie} está por debajo del mínimo permitido.`,
          "PRICE_BELOW_COST",
        );
      }
    }
    if (input.tipo === "METREADO" && linea.rolloId != null && !rollo) {
      throw new PosError(
        "El rollo abierto seleccionado no existe.",
        "ROLLO_NOT_FOUND",
      );
    }
    const cantidadMilesimas = Math.round(Number(cantidad) * 1000);
    const importeCents = Math.round((cantidadMilesimas * precioCents) / 1000);
    const costoUnitario = rollo?.costoUnitario ?? "0.00";
    const costoCents = Math.round(
      (cantidadMilesimas * money(costoUnitario)) / 1000,
    );
    return {
      rolloId: rollo?.id ?? null,
      productoId: linea.productoId,
      cantidad,
      precioUnitario: decimalMoney(precioCents),
      precioSugerido: producto.precioSugerido,
      importe: decimalMoney(importeCents),
      costoUnitarioCongelado: costoUnitario,
      costoTotalCongelado: decimalMoney(costoCents),
      importeCents,
    };
  });

  const totalCents = lineasPreparadas.reduce(
    (total, linea) => total + linea.importeCents,
    0,
  );
  const folio = await reserveTicketFolio(tx);
  const [ticket] = await tx
    .insert(ticketsTable)
    .values({
      folio,
      ubicacionId: input.ubicacionId,
      usuarioTerminalId: input.usuarioTerminalId,
      clienteId: input.clienteId ?? null,
      tipo: input.tipo,
      subtotal: decimalMoney(totalCents),
      total: decimalMoney(totalCents),
      estado: "VENDIDO",
      cobrado: false,
      facturado: input.facturado,
      uuidCliente: input.uuidCliente,
    })
    .returning();

  for (const linea of lineasPreparadas) {
    if (input.tipo === "NORMAL" && linea.rolloId != null) {
      await venderRollo(tx, {
        rolloId: linea.rolloId,
        usuarioId: input.usuarioTerminalId,
        justificacion: `Venta ticket ${folio}`,
        documentoTipo: "TICKET",
        documentoId: String(ticket!.id),
      });
    }
    await tx.insert(ticketLineasTable).values({
      ticketId: ticket!.id,
      rolloId: linea.rolloId,
      productoId: linea.productoId,
      cantidad: linea.cantidad,
      precioUnitario: linea.precioUnitario,
      precioSugerido: linea.precioSugerido,
      importe: linea.importe,
      costoUnitarioCongelado: linea.costoUnitarioCongelado,
      costoTotalCongelado: linea.costoTotalCongelado,
    });
  }

  await tx.insert(auditoriaTable).values({
    usuarioId: input.usuarioTerminalId,
    accion: "VENDER",
    entidad: "tickets",
    entidadId: String(ticket!.id),
    datosDespues: {
      folio,
      tipo: input.tipo,
      total: decimalMoney(totalCents),
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

  if (ticket.tipo === "NORMAL") {
    const ventas = await tx
      .select()
      .from(movimientosTable)
      .where(
        and(
          eq(movimientosTable.tipo, "VENTA"),
          eq(movimientosTable.documentoTipo, "TICKET"),
          eq(movimientosTable.documentoId, String(ticket.id)),
        ),
      )
      .orderBy(asc(movimientosTable.id));
    for (const venta of ventas) {
      await revertirMovimiento(tx, {
        movimientoOrigenId: Number(venta.id),
        usuarioId: input.usuarioId,
        justificacion: motivo,
      });
    }
  }

  const [creditRow] = await tx
    .select({
      total: sql<string>`COALESCE(SUM(${ticketPagosTable.importe}), 0)::text`,
    })
    .from(ticketPagosTable)
    .where(
      and(
        eq(ticketPagosTable.ticketId, ticket.id),
        eq(ticketPagosTable.formaPago, "CREDITO"),
      ),
    );
  const creditCents = money(creditRow?.total ?? "0");
  if (ticket.clienteId != null && creditCents > 0) {
    const [existingReverse] = await tx
      .select({ id: movimientosCreditoTable.id })
      .from(movimientosCreditoTable)
      .where(
        and(
          eq(movimientosCreditoTable.ticketId, ticket.id),
          eq(movimientosCreditoTable.tipo, "REVERSO"),
        ),
      )
      .limit(1);
    if (!existingReverse) {
      await tx.insert(movimientosCreditoTable).values({
        clienteId: ticket.clienteId,
        ticketId: ticket.id,
        tipo: "REVERSO",
        importe: decimalMoney(-creditCents),
        usuarioId: input.usuarioId,
        notas: `Cancelación ticket ${ticket.folio}`,
      });
      await tx
        .update(clientesTable)
        .set({
          saldoCredito: sql`GREATEST(0, ${clientesTable.saldoCredito} - ${decimalMoney(creditCents)}::numeric)`,
        })
        .where(eq(clientesTable.id, ticket.clienteId));
    }
  }

  const now = new Date();
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
      "Ya existe una sesión de caja abierta en esta ubicación.",
      "SESSION_ALREADY_OPEN",
      409,
    );
  }
  const [created] = await tx
    .insert(sesionesCajaTable)
    .values({
      ubicacionId: input.ubicacionId,
      usuarioId: input.usuarioId,
      fondoInicial: decimalMoney(fondo),
      estado: "ABIERTA",
    })
    .returning();
  await tx.insert(auditoriaTable).values({
    usuarioId: input.usuarioId,
    accion: "ABRIR_CAJA",
    entidad: "sesiones_caja",
    entidadId: String(created!.id),
    datosDespues: { fondoInicial: decimalMoney(fondo) },
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

export async function cobrarTicket(
  tx: Tx,
  input: {
    ticketId: number;
    sesionCajaId: number;
    usuarioId: number;
    clienteId?: number | null;
    pagos: PagoTicketInput[];
    autorizadoPor?: number | null;
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
    throw new PosError(
      "El ticket ya fue cobrado.",
      "ALREADY_CHARGED",
      409,
    );
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
    const cents = money(pago.importe);
    if (cents <= 0) {
      throw new PosError(
        "Cada importe de pago debe ser mayor a cero.",
        "INVALID_PAYMENT",
      );
    }
    return { ...pago, cents };
  });
  if (
    ticket.tipo === "METREADO" &&
    pagos.some((pago) => pago.formaPago !== "EFECTIVO")
  ) {
    throw new PosError(
      "Los tickets metreados solo pueden cobrarse en efectivo.",
      "METREADO_CASH_ONLY",
    );
  }
  const paymentTotal = pagos.reduce((sum, pago) => sum + pago.cents, 0);
  if (paymentTotal !== money(ticket.total)) {
    throw new PosError(
      "La suma de los pagos debe ser exactamente igual al total del ticket.",
      "PAYMENT_TOTAL_MISMATCH",
    );
  }

  const creditCents = pagos
    .filter((pago) => pago.formaPago === "CREDITO")
    .reduce((sum, pago) => sum + pago.cents, 0);
  const clienteId = input.clienteId ?? ticket.clienteId;
  if (creditCents > 0 && clienteId == null) {
    throw new PosError(
      "Para cobrar a crédito debes seleccionar un cliente.",
      "CLIENT_REQUIRED",
    );
  }
  if (clienteId != null) {
    const [cliente] = await tx
      .select()
      .from(clientesTable)
      .where(eq(clientesTable.id, clienteId))
      .for("update")
      .limit(1);
    if (!cliente?.activo) {
      throw new PosError("Cliente inválido o inactivo.", "INVALID_CLIENT");
    }
    if (
      creditCents > 0 &&
      money(cliente.saldoCredito) + creditCents > money(cliente.limiteCredito) &&
      input.autorizadoPor == null
    ) {
      throw new PosError(
        "El crédito excede el límite del cliente y requiere autorización de ADMIN.",
        "CREDIT_AUTH_REQUIRED",
        403,
      );
    }
    if (creditCents > 0) {
      await tx.insert(movimientosCreditoTable).values({
        clienteId,
        ticketId: ticket.id,
        tipo: "VENTA_CREDITO",
        importe: decimalMoney(creditCents),
        usuarioId: input.usuarioId,
        notas:
          input.autorizadoPor == null
            ? `Ticket ${ticket.folio}`
            : `Ticket ${ticket.folio}, autorizado por ${input.autorizadoPor}`,
      });
      await tx
        .update(clientesTable)
        .set({
          saldoCredito: sql`${clientesTable.saldoCredito} + ${decimalMoney(creditCents)}::numeric`,
        })
        .where(eq(clientesTable.id, clienteId));
    }
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
      clienteId: clienteId ?? null,
      cobrado: true,
      cobradoAt: now,
      usuarioCajaId: input.usuarioId,
      sesionCajaId: sesion.id,
    })
    .where(eq(ticketsTable.id, ticket.id));
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
      autorizadoPor: input.autorizadoPor ?? null,
    },
    ip: input.ip,
  });
  return buildTicketDetail(tx, ticket.id, includeCosts);
}

export async function buildCorteCaja(
  database: Reader,
  sesionId: number,
) {
  const [sesion] = await database
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

  const pagos = await database
    .select({
      ticketId: ticketPagosTable.ticketId,
      folio: ticketsTable.folio,
      formaPago: ticketPagosTable.formaPago,
      importe: ticketPagosTable.importe,
      facturado: ticketsTable.facturado,
      tipo: ticketsTable.tipo,
      estado: ticketsTable.estado,
    })
    .from(ticketPagosTable)
    .innerJoin(ticketsTable, eq(ticketPagosTable.ticketId, ticketsTable.id))
    .where(eq(ticketsTable.sesionCajaId, sesion.id));

  const corteAt = sesion.cerradaAt ?? new Date();
  const pendientes = await database
    .select({
      ticketId: ticketsTable.id,
      folio: ticketsTable.folio,
      total: ticketsTable.total,
      nombreCliente: clientesTable.nombre,
      createdAt: ticketsTable.createdAt,
    })
    .from(ticketsTable)
    .leftJoin(clientesTable, eq(ticketsTable.clienteId, clientesTable.id))
    .where(
      and(
        eq(ticketsTable.ubicacionId, sesion.ubicacionId),
        eq(ticketsTable.estado, "VENDIDO"),
        eq(ticketsTable.cobrado, false),
        lte(ticketsTable.createdAt, corteAt),
      ),
    )
    .orderBy(asc(ticketsTable.createdAt));

  const productos = await database
    .select({
      productoId: ticketLineasTable.productoId,
      sku: productosTable.sku,
      tela: productosTable.tela,
      color: productosTable.color,
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
      productosTable.sku,
      productosTable.tela,
      productosTable.color,
      productosTable.unidad,
    )
    .orderBy(productosTable.tela, productosTable.color);

  const tipos = await database
    .select({
      tipo: ticketsTable.tipo,
      ticketsCount: sql<number>`COUNT(DISTINCT ${ticketsTable.id})::int`,
      cantidad: sql<string>`COALESCE(SUM(${ticketLineasTable.cantidad}), 0)::text`,
      importe: sql<string>`COALESCE(SUM(${ticketLineasTable.importe}), 0)::text`,
    })
    .from(ticketsTable)
    .innerJoin(
      ticketLineasTable,
      eq(ticketLineasTable.ticketId, ticketsTable.id),
    )
    .where(
      and(
        eq(ticketsTable.sesionCajaId, sesion.id),
        eq(ticketsTable.estado, "VENDIDO"),
      ),
    )
    .groupBy(ticketsTable.tipo);

  const formas = { EFECTIVO: 0, TRANSFERENCIA: 0, CREDITO: 0 };
  const cuentas = {
    CAJA_FISICA: 0,
    CUENTA_FISCAL: 0,
    CUENTA_NO_FISCAL: 0,
    CUENTAS_POR_COBRAR: 0,
  };
  let facturado = 0;
  let noFacturado = 0;
  const ticketIds = new Set<number>();
  const formaPagoCounts: Record<FormaPagoTicket, number> = {
    EFECTIVO: 0,
    TRANSFERENCIA: 0,
    CREDITO: 0,
  };
  const formaPagoTickets: Record<FormaPagoTicket, Set<number>> = {
    EFECTIVO: new Set<number>(),
    TRANSFERENCIA: new Set<number>(),
    CREDITO: new Set<number>(),
  };
  const facturadoTickets = new Set<number>();
  const noFacturadoTickets = new Set<number>();
  for (const pago of pagos) {
    if (pago.estado === "CANCELADO") continue;
    const cents = money(pago.importe);
    formas[pago.formaPago] += cents;
    ticketIds.add(pago.ticketId);
    formaPagoCounts[pago.formaPago] += 1;
    formaPagoTickets[pago.formaPago].add(pago.ticketId);
    if (pago.facturado) {
      facturado += cents;
      facturadoTickets.add(pago.ticketId);
    } else {
      noFacturado += cents;
      noFacturadoTickets.add(pago.ticketId);
    }
    if (pago.formaPago === "EFECTIVO") cuentas.CAJA_FISICA += cents;
    if (pago.formaPago === "CREDITO") cuentas.CUENTAS_POR_COBRAR += cents;
    if (pago.formaPago === "TRANSFERENCIA") {
      if (pago.facturado) cuentas.CUENTA_FISCAL += cents;
      else cuentas.CUENTA_NO_FISCAL += cents;
    }
  }
  const totalCobrado = Object.values(formas).reduce(
    (total, value) => total + value,
    0,
  );
  const esperado = money(sesion.fondoInicial) + formas.EFECTIVO;
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
    formasPago: (["EFECTIVO", "TRANSFERENCIA", "CREDITO"] as const).map(
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
        cuentaDestino: "Caja física",
        importe: decimalMoney(cuentas.CAJA_FISICA),
      },
      {
        formaPago: "TRANSFERENCIA" as const,
        cuentaDestino: "Cuenta fiscal",
        importe: decimalMoney(cuentas.CUENTA_FISCAL),
      },
      {
        formaPago: "TRANSFERENCIA" as const,
        cuentaDestino: "Cuenta no fiscal",
        importe: decimalMoney(cuentas.CUENTA_NO_FISCAL),
      },
      {
        formaPago: "CREDITO" as const,
        cuentaDestino: "Cuentas por cobrar",
        importe: decimalMoney(cuentas.CUENTAS_POR_COBRAR),
      },
    ],
    facturacion: [
      {
        facturado: true,
        ticketsCount: facturadoTickets.size,
        importe: decimalMoney(facturado),
      },
      {
        facturado: false,
        ticketsCount: noFacturadoTickets.size,
        importe: decimalMoney(noFacturado),
      },
    ],
    metreado: (["NORMAL", "METREADO"] as const).map((tipo) => {
      const row = tipos.find((item) => item.tipo === tipo);
      return {
        tipo,
        ticketsCount: row?.ticketsCount ?? 0,
        cantidad: row?.cantidad ?? "0.000",
        importe: row?.importe ?? "0.00",
      };
    }),
    productos,
    pendientes: pendientes.map((ticket) => ({
      ...ticket,
      createdAt: ticket.createdAt.toISOString(),
    })),
    efectivoEsperado: decimalMoney(esperado),
    efectivoContado: contado == null ? null : decimalMoney(contado),
    diferencia:
      contado == null ? null : decimalMoney(contado - esperado),
    fondoInicial: sesion.fondoInicial,
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
  const term = `%${q.trim()}%`;
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
        sql`(${rollosTable.serie} ILIKE ${term}
          OR ${productosTable.sku} ILIKE ${term}
          OR ${productosTable.tela} ILIKE ${term}
          OR ${productosTable.color} ILIKE ${term})`,
      ),
    )
    .orderBy(desc(rollosTable.id))
    .limit(50);
  const productos = await database
    .select({
      id: productosTable.id,
      sku: productosTable.sku,
      tela: productosTable.tela,
      color: productosTable.color,
      unidad: productosTable.unidad,
      precioSugerido: productosTable.precioSugerido,
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
  return { rollos, productos };
}

export function isInventoryError(error: unknown): error is InventarioError {
  return error instanceof InventarioError;
}