import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientesTable } from "./clientes";
import {
  estadoSesionCajaEnum,
  estadoTicketEnum,
  formaPagoTicketEnum,
  tipoMovimientoCreditoEnum,
  tipoTicketEnum,
} from "./enums";
import { ubicacionesTable } from "./locations";
import { productosTable } from "./productos";
import { rollosTable } from "./rollos";
import { usuariosTable } from "./users";

// A cash session belongs to a location. The partial unique index ensures that
// concurrent terminals cannot open two active sessions for the same location.
export const sesionesCajaTable = pgTable(
  "sesiones_caja",
  {
    id: serial("id").primaryKey(),
    ubicacionId: integer("ubicacion_id")
      .notNull()
      .references(() => ubicacionesTable.id),
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuariosTable.id),
    abiertaAt: timestamp("abierta_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    cerradaAt: timestamp("cerrada_at", { withTimezone: true }),
    fondoInicial: numeric("fondo_inicial", {
      precision: 12,
      scale: 2,
    }).notNull(),
    efectivoContado: numeric("efectivo_contado", { precision: 12, scale: 2 }),
    estado: estadoSesionCajaEnum("estado").notNull().default("ABIERTA"),
  },
  (table) => [
    index("sesiones_caja_ubicacion_estado_idx").on(
      table.ubicacionId,
      table.estado,
    ),
    index("sesiones_caja_cerrada_at_idx")
      .on(table.cerradaAt)
      .where(sql`${table.estado} = 'CERRADA'`),
    uniqueIndex("sesiones_caja_una_abierta_ubicacion_idx")
      .on(table.ubicacionId)
      .where(sql`${table.estado} = 'ABIERTA'`),
  ],
);

export const ticketsTable = pgTable(
  "tickets",
  {
    id: serial("id").primaryKey(),
    folio: integer("folio").notNull().unique(),
    ubicacionId: integer("ubicacion_id")
      .notNull()
      .references(() => ubicacionesTable.id),
    usuarioTerminalId: integer("usuario_terminal_id")
      .notNull()
      .references(() => usuariosTable.id),
    clienteId: integer("cliente_id")
      .notNull()
      .references(() => clientesTable.id),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    iva: numeric("iva", { precision: 12, scale: 2 }).notNull().default("0"),
    tasaIva: numeric("tasa_iva", { precision: 5, scale: 4 })
      .notNull()
      .default("0.1600"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    estado: estadoTicketEnum("estado").notNull().default("VENDIDO"),
    cobrado: boolean("cobrado").notNull().default(false),
    cobradoAt: timestamp("cobrado_at", { withTimezone: true }),
    usuarioCajaId: integer("usuario_caja_id").references(
      () => usuariosTable.id,
    ),
    facturado: boolean("facturado").notNull().default(false),
    sesionCajaId: integer("sesion_caja_id").references(
      () => sesionesCajaTable.id,
    ),
    uuidCliente: uuid("uuid_cliente").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    canceladoAt: timestamp("cancelado_at", { withTimezone: true }),
    canceladoPor: integer("cancelado_por").references(() => usuariosTable.id),
    motivoCancelacion: text("motivo_cancelacion"),
    autorizadoPor: integer("autorizado_por").references(() => usuariosTable.id),
  },
  (table) => [
    index("tickets_ubicacion_created_at_idx").on(
      table.ubicacionId,
      table.createdAt,
    ),
    index("tickets_cobrado_idx").on(table.cobrado),
    index("tickets_estado_idx").on(table.estado),
    index("tickets_folio_idx").on(table.folio),
    index("tickets_uuid_cliente_idx").on(table.uuidCliente),
    index("tickets_cliente_created_at_idx").on(
      table.clienteId,
      table.createdAt,
    ),
    index("tickets_created_at_idx").on(table.createdAt),
    index("tickets_sesion_estado_idx").on(table.sesionCajaId, table.estado),
    index("tickets_cobrado_created_at_idx")
      .on(table.createdAt, table.ubicacionId)
      .where(sql`${table.cobrado} = true`),
  ],
);

export const ticketLineasTable = pgTable(
  "ticket_lineas",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id")
      .notNull()
      .references(() => ticketsTable.id),
    rolloId: integer("rollo_id").references(() => rollosTable.id),
    productoId: integer("producto_id")
      .notNull()
      .references(() => productosTable.id),
    tipo: tipoTicketEnum("tipo").notNull(),
    cantidad: numeric("cantidad", { precision: 10, scale: 3 }).notNull(),
    precioUnitario: numeric("precio_unitario", {
      precision: 12,
      scale: 2,
    }).notNull(),
    precioSugerido: numeric("precio_sugerido", {
      precision: 12,
      scale: 2,
    }).notNull(),
    importe: numeric("importe", { precision: 12, scale: 2 }).notNull(),
    costoUnitarioCongelado: numeric("costo_unitario_congelado", {
      precision: 12,
      scale: 2,
    }),
    costoTotalCongelado: numeric("costo_total_congelado", {
      precision: 12,
      scale: 2,
    }),
    costoReferenciaEstado: text("costo_referencia_estado"),
  },
  (table) => [
    index("ticket_lineas_ticket_idx").on(table.ticketId),
    index("ticket_lineas_rollo_idx").on(table.rolloId),
    index("ticket_lineas_producto_idx").on(table.productoId),
    index("ticket_lineas_tipo_idx").on(table.tipo),
    check(
      "ticket_lineas_tipo_rollo_costos_check",
      sql`(${table.tipo} = 'NORMAL'
          AND ${table.rolloId} IS NOT NULL
          AND ${table.costoUnitarioCongelado} IS NOT NULL
          AND ${table.costoTotalCongelado} IS NOT NULL
          AND ${table.costoReferenciaEstado} IS NULL)
        OR (${table.tipo} = 'METREADO'
          AND ${table.rolloId} IS NULL
          AND (
            (${table.costoUnitarioCongelado} IS NULL
              AND ${table.costoTotalCongelado} IS NULL
              AND (${table.costoReferenciaEstado} IS NULL
                OR ${table.costoReferenciaEstado} = 'NO_COST'))
            OR
            (${table.costoUnitarioCongelado} IS NOT NULL
              AND ${table.costoTotalCongelado} IS NOT NULL
              AND (${table.costoReferenciaEstado} IS NULL
                OR ${table.costoReferenciaEstado} IN ('AVERAGE_12_MONTHS', 'STALE_LAST_KNOWN')))
          ))`,
    ),
  ],
);

export const ticketPagosTable = pgTable(
  "ticket_pagos",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id")
      .notNull()
      .references(() => ticketsTable.id),
    formaPago: formaPagoTicketEnum("forma_pago").notNull(),
    importe: numeric("importe", { precision: 12, scale: 2 }).notNull(),
    referencia: text("referencia"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuariosTable.id),
  },
  (table) => [index("ticket_pagos_ticket_idx").on(table.ticketId)],
);

/**
 * Immutable customer-credit ledger. VENTA_CREDITO creates a receivable;
 * ABONO and REVERSO are negative entries and must be inserted, never updated.
 */
export const movimientosCreditoTable = pgTable(
  "movimientos_credito",
  {
    id: serial("id").primaryKey(),
    clienteId: integer("cliente_id")
      .notNull()
      .references(() => clientesTable.id),
    ticketId: integer("ticket_id").references(() => ticketsTable.id),
    tipo: tipoMovimientoCreditoEnum("tipo").notNull(),
    importe: numeric("importe", { precision: 12, scale: 2 }).notNull(),
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuariosTable.id),
    notas: text("notas"),
    formaPago: formaPagoTicketEnum("forma_pago"),
    /** Destination declared when an external customer ABONO is recorded. */
    cuentaDestino: text("cuenta_destino"),
    referencia: text("referencia"),
    metadata: text("metadata"),
    diasPlazo: integer("dias_plazo"),
    fechaVencimiento: date("fecha_vencimiento"),
    esIncobrable: boolean("es_incobrable").notNull().default(false),
    motivoIncobrable: text("motivo_incobrable"),
    autorizadoPor: integer("autorizado_por").references(() => usuariosTable.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("movimientos_credito_cliente_created_at_idx").on(
      table.clienteId,
      table.createdAt,
    ),
    index("movimientos_credito_ticket_idx").on(table.ticketId),
    check(
      "movimientos_credito_importe_tipo_check",
      sql`(${table.tipo} = 'VENTA_CREDITO' AND ${table.importe} > 0)
        OR (${table.tipo} IN ('ABONO', 'REVERSO') AND ${table.importe} < 0)
        OR (${table.tipo} = 'AJUSTE' AND ${table.importe} <> 0)`,
    ),
    check(
      "movimientos_credito_plazo_check",
      sql`(${table.diasPlazo} IS NULL AND ${table.fechaVencimiento} IS NULL)
        OR (${table.diasPlazo} IN (7, 15, 30, 60) AND ${table.fechaVencimiento} IS NOT NULL)`,
    ),
    check(
      "movimientos_credito_cuenta_destino_check",
      sql`${table.cuentaDestino} IS NULL OR ${table.cuentaDestino} IN ('CAJA_FISICA', 'CUENTA_FISCAL', 'CUENTA_NO_FISCAL')`,
    ),
  ],
);

/** Persistent administrator review queue for issued customer credit. */
export const notificacionesCreditoTable = pgTable(
  "notificaciones_credito",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id")
      .notNull()
      .unique()
      .references(() => ticketsTable.id),
    clienteId: integer("cliente_id")
      .notNull()
      .references(() => clientesTable.id),
    clienteNombre: text("cliente_nombre").notNull(),
    folio: integer("folio").notNull(),
    importe: numeric("importe", { precision: 12, scale: 2 }).notNull(),
    diasPlazo: integer("dias_plazo").notNull(),
    fechaVencimiento: date("fecha_vencimiento", { mode: "string" }).notNull(),
    cajeroId: integer("cajero_id")
      .notNull()
      .references(() => usuariosTable.id),
    cajeroNombre: text("cajero_nombre").notNull(),
    tiendaId: integer("tienda_id")
      .notNull()
      .references(() => ubicacionesTable.id),
    tiendaNombre: text("tienda_nombre").notNull(),
    urgente: boolean("urgente").notNull().default(false),
    leidaAt: timestamp("leida_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notificaciones_credito_leida_created_idx").on(
      table.leidaAt,
      table.createdAt,
    ),
    index("notificaciones_credito_cliente_idx").on(table.clienteId),
  ],
);

// Single-row control table (id = 1). Allocate the next ticket folio under a
// row lock; the seed value of 999 makes the first allocated folio 1000.
export const ticketFolioTable = pgTable("ticket_folio", {
  id: integer("id").primaryKey().default(1),
  ultimoFolio: integer("ultimo_folio").notNull().default(999),
});

export const insertSesionCajaSchema = createInsertSchema(
  sesionesCajaTable,
).omit({ id: true, abiertaAt: true, cerradaAt: true });
export const insertTicketSchema = createInsertSchema(ticketsTable).omit({
  id: true,
  createdAt: true,
});
export const insertTicketLineaSchema = createInsertSchema(
  ticketLineasTable,
).omit({
  id: true,
});
export const insertTicketPagoSchema = createInsertSchema(ticketPagosTable).omit(
  {
    id: true,
    createdAt: true,
  },
);
export const insertMovimientoCreditoSchema = createInsertSchema(
  movimientosCreditoTable,
).omit({ id: true, createdAt: true });

export type InsertSesionCaja = z.infer<typeof insertSesionCajaSchema>;
export type SesionCaja = typeof sesionesCajaTable.$inferSelect;
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof ticketsTable.$inferSelect;
export type InsertTicketLinea = z.infer<typeof insertTicketLineaSchema>;
export type TicketLinea = typeof ticketLineasTable.$inferSelect;
export type InsertTicketPago = z.infer<typeof insertTicketPagoSchema>;
export type TicketPago = typeof ticketPagosTable.$inferSelect;
export type InsertMovimientoCredito = z.infer<
  typeof insertMovimientoCreditoSchema
>;
export type MovimientoCredito = typeof movimientosCreditoTable.$inferSelect;
export type NotificacionCredito = typeof notificacionesCreditoTable.$inferSelect;
export type TicketFolio = typeof ticketFolioTable.$inferSelect;
