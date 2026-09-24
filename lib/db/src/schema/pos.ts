import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientesTable } from "./clientes";
import {
  estadoSesionCajaEnum,
  estadoTicketEnum,
  formaPagoCuentaEnum,
  formaPagoTicketEnum,
  naturalezaCreditoE1Enum,
  tipoMovimientoCreditoEnum,
  tipoTicketEnum,
} from "./enums";

import { ubicacionesTable } from "./locations";
import { productosTable } from "./productos";
import { rollosTable } from "./rollos";
import { usuariosTable } from "./users";
import { proveedoresTable } from "./proveedores";

/** Application-level values stored in tickets.documento_tipo (TEXT). */
export type DocumentoTipoTicket = "TICKET" | "NOTA";

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
    /** Calendar day in the Mexico City operating timezone, not UTC. */
    fechaOperativa: date("fecha_operativa", { mode: "string" }).notNull(),
    cerradaAt: timestamp("cerrada_at", { withTimezone: true }),
    /** Actor that performed the close; it may differ from the opening cashier. */
    cerradaPorId: integer("cerrada_por_id").references(() => usuariosTable.id),
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

/** Non-destructive guardian for days opened after the daily-session rule was introduced. */
export const sesionesCajaDiasTable = pgTable(
  "sesiones_caja_dias",
  {
    ubicacionId: integer("ubicacion_id").notNull().references(() => ubicacionesTable.id),
    fechaOperativa: date("fecha_operativa", { mode: "string" }).notNull(),
    sesionCajaId: integer("sesion_caja_id").references(() => sesionesCajaTable.id),
  },
  (table) => [uniqueIndex("sesiones_caja_dias_ubicacion_fecha_uidx").on(table.ubicacionId, table.fechaOperativa)],
);

/** Money disbursed from a cash session; provider payments are Mariana-only in service code. */
export const salidasDineroCajaTable = pgTable(
  "salidas_dinero_caja",
  {
    id: serial("id").primaryKey(),
    sesionCajaId: integer("sesion_caja_id").notNull().references(() => sesionesCajaTable.id),
    monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
    motivo: text("motivo").notNull(),
    proveedorId: integer("proveedor_id").references(() => proveedoresTable.id),
    cuentaOrigen: text("cuenta_origen").notNull().$type<"CAJA_FISICA" | "CUENTA_NO_FISCAL" | "CUENTA_FISCAL">(),
    creadoPorId: integer("creado_por_id").notNull().references(() => usuariosTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("salidas_dinero_caja_sesion_created_idx").on(table.sesionCajaId, table.createdAt),
    index("salidas_dinero_caja_proveedor_idx").on(table.proveedorId),
    check("salidas_dinero_caja_monto_check", sql`${table.monto} > 0`),
    check("salidas_dinero_caja_motivo_check", sql`char_length(trim(${table.motivo})) BETWEEN 1 AND 500`),
    check("salidas_dinero_caja_cuenta_check", sql`${table.cuentaOrigen} IN ('CAJA_FISICA', 'CUENTA_NO_FISCAL', 'CUENTA_FISCAL')`),
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
    // Deliberately text-backed: document types are application-level values,
    // not a PostgreSQL enum that would complicate upgrades.
    documentoTipo: text("documento_tipo")
      .$type<DocumentoTipoTicket>()
      .notNull()
      .default("TICKET"),
    notaSinPrecios: boolean("nota_sin_precios").notNull().default(false),
    nombreDestinatario: text("nombre_destinatario"),
    direccionEntregaSnapshot: text("direccion_entrega_snapshot"),
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
    credito: boolean("credito").notNull().default(false),
    diasPlazo: integer("dias_plazo"),
    fechaVencimiento: date("fecha_vencimiento", { mode: "string" }),
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
    autorizadoAt: timestamp("autorizado_at", { withTimezone: true }),
    autorizacionEstado: text("autorizacion_estado")
      .$type<"NO_APLICA" | "PENDIENTE" | "AUTORIZADA">()
      .notNull()
      .default("NO_APLICA"),
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
    // Explicit operator DDL only; never use a broad schema push to install these.
    index("tickets_pendientes_corte_ga_candidate")
      .on(table.ubicacionId, table.createdAt, table.id)
      .where(sql`${table.estado} = 'VENDIDO' AND ((${table.documentoTipo} = 'TICKET' AND ${table.cobrado} = false) OR (${table.documentoTipo} = 'NOTA' AND ${table.autorizacionEstado} = 'PENDIENTE'))`),
    index("tickets_contabilizados_sitio_fecha_ga_candidate")
      .on(table.ubicacionId, sql`(CASE WHEN ${table.documentoTipo} = 'TICKET' THEN ${table.cobradoAt} ELSE ${table.autorizadoAt} END)`)
      .where(sql`${table.estado} = 'VENDIDO' AND ((${table.documentoTipo} = 'TICKET' AND ${table.cobrado} = true) OR (${table.documentoTipo} = 'NOTA' AND ${table.autorizacionEstado} = 'AUTORIZADA'))`),
    check(
      "tickets_autorizacion_documento_check",
      sql`(${table.documentoTipo} = 'TICKET' AND ${table.autorizacionEstado} = 'NO_APLICA')
        OR (${table.documentoTipo} = 'NOTA' AND ${table.autorizacionEstado} IN ('PENDIENTE', 'AUTORIZADA'))`,
    ),
    check(
      "tickets_credito_plazo_check",
      sql`(${table.credito} = false AND ${table.diasPlazo} IS NULL AND ${table.fechaVencimiento} IS NULL)
        OR (${table.credito} = true AND ${table.diasPlazo} IN (7, 15, 30, 60) AND ${table.fechaVencimiento} IS NOT NULL)`,
    ),
    index("tickets_cobrado_created_at_idx")
      .on(table.createdAt, table.ubicacionId)
      .where(sql`${table.cobrado} = true`),
  ],
);

/** Durable, append-only evidence that Caja authorized a credit note. */
export const autorizacionesNotaTable = pgTable(
  "autorizaciones_nota",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id").notNull().unique().references(() => ticketsTable.id),
    sesionCajaId: integer("sesion_caja_id").notNull().references(() => sesionesCajaTable.id),
    usuarioId: integer("usuario_id").notNull().references(() => usuariosTable.id),
    movimientoCreditoId: integer("movimiento_credito_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("autorizaciones_nota_sesion_idx").on(table.sesionCajaId, table.createdAt)],
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

/** E1 metadata only: runtime never creates these objects. Approved SQL owns
 * MATCH FULL / NOT VALID foreign keys and immutable/context triggers, which
 * Drizzle's table DSL cannot express. Do not regenerate operational DDL here. */
export const operacionesCreditoE1Table = pgTable("operaciones_credito_e1", {
  productor: text("productor").notNull(),
  clave: uuid("clave").notNull(),
  naturaleza: naturalezaCreditoE1Enum("naturaleza").notNull(),
  usuarioId: integer("usuario_id").notNull(),
  solicitudCanonica: jsonb("solicitud_canonica").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`transaction_timestamp()`),
}, (table) => [
  primaryKey({ name: "operaciones_pk_e1", columns: [table.productor, table.clave] }),
  foreignKey({ name: "operaciones_actor_fk_e1", columns: [table.usuarioId], foreignColumns: [usuariosTable.id] }),
  check("operaciones_json_ck_e1", sql`jsonb_typeof(${table.solicitudCanonica}) = 'object' AND ${table.solicitudCanonica} <> '{}'::jsonb`),
  check("operaciones_fecha_ck_e1", sql`isfinite(${table.createdAt})`),
  check("operaciones_productor_naturaleza_ck_e1", sql`
    (${table.productor} IN ('VENTA_CREDITO', 'CANCELACION_VENTA_CREDITO', 'E5_APLICACION_RETENIDA') AND ${table.naturaleza} = 'OPERACION_CREDITO_SIN_DINERO')
    OR (${table.productor} IN ('AJUSTE_MANUAL', 'BAJA_INCOBRABLE') AND ${table.naturaleza} = 'CORRECCION_CONTABLE')
    OR (${table.productor} IN ('ABONO_ORDINARIO', 'ABONO_DIRIGIDO') AND ${table.naturaleza} IN ('INGRESO_FISICO', 'CORRECCION_CONTABLE'))
    OR (${table.productor} = 'REVERSO_ABONO' AND ${table.naturaleza} IN ('DEVOLUCION_FISICA', 'CORRECCION_CONTABLE'))
    OR (${table.productor} = 'COBRO_PENDIENTE' AND ${table.naturaleza} = 'INGRESO_FISICO')`),
]);

export const cobrosCreditoPendientesE1Table = pgTable("cobros_credito_pendientes_e1", {
  operacionProductor: text("operacion_productor").notNull(),
  operacionClave: uuid("operacion_clave").notNull(),
  naturaleza: naturalezaCreditoE1Enum("naturaleza").notNull(),
  clienteId: integer("cliente_id").notNull(),
  importe: numeric("importe", { precision: 12, scale: 2 }).notNull(),
  fechaReal: timestamp("fecha_real", { withTimezone: true }).notNull(),
  sitioOrigenId: integer("sitio_origen_id").notNull(),
  medio: formaPagoCuentaEnum("medio").notNull(),
  cuentaDestino: text("cuenta_destino").notNull(),
  sesionCajaId: integer("sesion_caja_id"),
  motivo: text("motivo"),
  referencia: text("referencia"),
  usuarioId: integer("usuario_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`transaction_timestamp()`),
}, (table) => [
  primaryKey({ name: "cobros_pk_e1", columns: [table.operacionProductor, table.operacionClave] }),
  foreignKey({ name: "cobros_operacion_fk_e1", columns: [table.operacionProductor, table.operacionClave], foreignColumns: [operacionesCreditoE1Table.productor, operacionesCreditoE1Table.clave] }),
  foreignKey({ name: "cobros_cliente_fk_e1", columns: [table.clienteId], foreignColumns: [clientesTable.id] }),
  foreignKey({ name: "cobros_sitio_fk_e1", columns: [table.sitioOrigenId], foreignColumns: [ubicacionesTable.id] }),
  foreignKey({ name: "cobros_sesion_fk_e1", columns: [table.sesionCajaId], foreignColumns: [sesionesCajaTable.id] }),
  foreignKey({ name: "cobros_actor_fk_e1", columns: [table.usuarioId], foreignColumns: [usuariosTable.id] }),
  check("cobros_productor_ck_e1", sql`${table.operacionProductor} = 'COBRO_PENDIENTE' AND ${table.naturaleza} = 'INGRESO_FISICO'`),
  check("cobros_importe_ck_e1", sql`${table.importe} > 0 AND ${table.importe} NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)`),
  check("cobros_fecha_ck_e1", sql`isfinite(${table.fechaReal}) AND isfinite(${table.createdAt})`),
  check("cobros_evidencia_ck_e1", sql`NULLIF(btrim(${table.motivo}), '') IS NOT NULL OR NULLIF(btrim(${table.referencia}), '') IS NOT NULL`),
  check("cobros_medio_cuenta_ck_e1", sql`(${table.medio} = 'EFECTIVO' AND ${table.cuentaDestino} = 'CAJA_FISICA' AND ${table.sesionCajaId} IS NOT NULL)
    OR (${table.medio} IN ('TRANSFERENCIA', 'FACTURADO') AND ${table.cuentaDestino} IN ('CUENTA_FISCAL', 'CUENTA_NO_FISCAL') AND ${table.sesionCajaId} IS NULL)`),
]);

/**
 * Immutable customer-credit ledger. VENTA_CREDITO creates a receivable;
 * ABONO is negative. REVERSO is negative only when cancelling a credit sale,
 * or positive when it reverses an ABONO; rows are always inserted, never updated.
 */
export const movimientosCreditoTable = pgTable(
  "movimientos_credito",
  {
    id: serial("id").primaryKey(),
    clienteId: integer("cliente_id")
      .notNull()
      .references(() => clientesTable.id),
    ticketId: integer("ticket_id").references(() => ticketsTable.id),
    /** Immutable link to the movement this reversal undoes. */
    movimientoOrigenId: integer("movimiento_origen_id").references(
      (): AnyPgColumn => movimientosCreditoTable.id,
    ),
    tipo: tipoMovimientoCreditoEnum("tipo").notNull(),
    importe: numeric("importe", { precision: 12, scale: 2 }).notNull(),
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuariosTable.id),
    notas: text("notas"),
    formaPago: formaPagoCuentaEnum("forma_pago"),
    /** Destination declared when an external customer ABONO is recorded. */
    cuentaDestino: text("cuenta_destino"),
    referencia: text("referencia"),
    metadata: text("metadata"),
    diasPlazo: integer("dias_plazo"),
    fechaVencimiento: date("fecha_vencimiento"),
    esIncobrable: boolean("es_incobrable").notNull().default(false),
    motivoIncobrable: text("motivo_incobrable"),
    // Nullable, without defaults: historical rows remain unclassified.
    sitioOrigenId: integer("sitio_origen_id"),
    sesionCajaId: integer("sesion_caja_id"),
    naturaleza: naturalezaCreditoE1Enum("naturaleza"),
    operacionProductor: text("operacion_productor"),
    operacionClave: uuid("operacion_clave"),
    notaOrigenId: integer("nota_origen_id"),
    origenJustificacion: text("origen_justificacion"),
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
    foreignKey({ name: "movimientos_operacion_fk_e1", columns: [table.operacionProductor, table.operacionClave], foreignColumns: [operacionesCreditoE1Table.productor, operacionesCreditoE1Table.clave] }),
    foreignKey({ name: "movimientos_sitio_fk_e1", columns: [table.sitioOrigenId], foreignColumns: [ubicacionesTable.id] }),
    foreignKey({ name: "movimientos_sesion_fk_e1", columns: [table.sesionCajaId], foreignColumns: [sesionesCajaTable.id] }),
    foreignKey({ name: "movimientos_nota_fk_e1", columns: [table.notaOrigenId], foreignColumns: [ticketsTable.id] }),
    uniqueIndex("movimientos_operacion_uq_e1").on(table.operacionProductor, table.operacionClave).where(sql`${table.operacionProductor} IS NOT NULL`),
    uniqueIndex("movimientos_credito_reverso_origen_uidx")
      .on(table.movimientoOrigenId)
      .where(sql`${table.tipo} = 'REVERSO' AND ${table.movimientoOrigenId} IS NOT NULL`),
    check(
      "movimientos_credito_importe_tipo_check",
      sql`(${table.tipo} = 'VENTA_CREDITO' AND ${table.importe} > 0)
        OR (${table.tipo} = 'ABONO' AND ${table.importe} < 0)
        OR (${table.tipo} = 'REVERSO' AND ${table.importe} <> 0)
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

export const atribucionesCreditoE1Table = pgTable("atribuciones_credito_e1", {
  id: uuid("id").notNull(),
  movimientoId: integer("movimiento_id").notNull(),
  // String mode preserves PostgreSQL microseconds for historical identity.
  movimientoCreatedAt: timestamp("movimiento_created_at", { withTimezone: true, mode: "string" }).notNull(),
  identidadSnapshot: jsonb("identidad_snapshot").$type<Record<string, unknown>>().notNull(),
  sitioOrigenId: integer("sitio_origen_id").notNull(),
  evidencia: text("evidencia").notNull(),
  motivo: text("motivo").notNull(),
  usuarioId: integer("usuario_id").notNull(),
  anteriorId: uuid("anterior_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`transaction_timestamp()`),
}, (table) => [
  primaryKey({ name: "atribuciones_pk_e1", columns: [table.id] }),
  foreignKey({ name: "atribuciones_movimiento_fk_e1", columns: [table.movimientoId], foreignColumns: [movimientosCreditoTable.id] }),
  foreignKey({ name: "atribuciones_sitio_fk_e1", columns: [table.sitioOrigenId], foreignColumns: [ubicacionesTable.id] }),
  foreignKey({ name: "atribuciones_actor_fk_e1", columns: [table.usuarioId], foreignColumns: [usuariosTable.id] }),
  foreignKey({ name: "atribuciones_anterior_fk_e1", columns: [table.anteriorId], foreignColumns: [table.id] }),
  unique("atribuciones_cadena_uq_e1").on(table.movimientoId, table.anteriorId).nullsNotDistinct(),
  check("atribuciones_anterior_ck_e1", sql`${table.anteriorId} IS NULL OR ${table.anteriorId} <> ${table.id}`),
  check("atribuciones_evidencia_ck_e1", sql`btrim(${table.evidencia}) <> '' AND btrim(${table.motivo}) <> ''`),
  check("atribuciones_json_ck_e1", sql`jsonb_typeof(${table.identidadSnapshot}) = 'object'`),
  check("atribuciones_fecha_ck_e1", sql`isfinite(${table.movimientoCreatedAt}) AND isfinite(${table.createdAt})`),
]);

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
