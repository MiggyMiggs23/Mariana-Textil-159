import {
  boolean,
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
import { sql } from "drizzle-orm";
import { estadoSalidaEnum } from "./enums";
import { clientesTable } from "./clientes";
import { ubicacionesTable } from "./locations";
import { ticketsTable } from "./pos";
import { productosTable } from "./productos";
import { rollosTable } from "./rollos";
import { usuariosTable } from "./users";

export type ModalidadSalida = "TRASLADO" | "MOSTRADOR" | "VENTA_CLIENTE";

/**
 * Inventory exit document. Transfers have a physical destination; counter
 * exits deliberately do not invent one.
 */
export const salidasTable = pgTable(
  "salidas",
  {
    id: serial("id").primaryKey(),
    folio: integer("folio").notNull(),
    origenId: integer("origen_id")
      .notNull()
      .references(() => ubicacionesTable.id),
    destinoId: integer("destino_id").references(() => ubicacionesTable.id),
    clienteId: integer("cliente_id").references(() => clientesTable.id),
    ticketId: integer("ticket_id").references(() => ticketsTable.id),
    modalidad: text("modalidad")
      .$type<ModalidadSalida>()
      .notNull()
      .default("TRASLADO"),
    estado: estadoSalidaEnum("estado").notNull().default("ARMANDO"),
    usuarioSolicitaId: integer("usuario_solicita_id").references(
      () => usuariosTable.id,
    ),
    usuarioAceptaId: integer("usuario_acepta_id").references(
      () => usuariosTable.id,
    ),
    usuarioPreparaId: integer("usuario_prepara_id").references(
      () => usuariosTable.id,
    ),
    usuarioEnviaId: integer("usuario_envia_id").references(
      () => usuariosTable.id,
    ),
    usuarioRecibeId: integer("usuario_recibe_id").references(
      () => usuariosTable.id,
    ),
    usuarioCierraId: integer("usuario_cierra_id").references(
      () => usuariosTable.id,
    ),
    usuarioCancelaId: integer("usuario_cancela_id").references(
      () => usuariosTable.id,
    ),
    usuarioEntregaId: integer("usuario_entrega_id").references(
      () => usuariosTable.id,
    ),
    autorizadoPorId: integer("autorizado_por_id").references(
      () => usuariosTable.id,
    ),
    solicitadaAt: timestamp("solicitada_at", { withTimezone: true }),
    aceptadaAt: timestamp("aceptada_at", { withTimezone: true }),
    preparadaAt: timestamp("preparada_at", { withTimezone: true }),
    enviadaAt: timestamp("enviada_at", { withTimezone: true }),
    recibidaAt: timestamp("recibida_at", { withTimezone: true }),
    cerradaAt: timestamp("cerrada_at", { withTimezone: true }),
    canceladaAt: timestamp("cancelada_at", { withTimezone: true }),
    entregadaAt: timestamp("entregada_at", { withTimezone: true }),
    motivoRechazo: text("motivo_rechazo"),
    motivoCancelacion: text("motivo_cancelacion"),
    notaSolicitud: text("nota_solicitud"),
    notaEnvio: text("nota_envio"),
    notaRecepcion: text("nota_recepcion"),
    transportista: text("transportista"),
    uuidCliente: uuid("uuid_cliente").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    actividadAt: timestamp("actividad_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("salidas_origen_estado_idx").on(table.origenId, table.estado),
    uniqueIndex("salidas_origen_folio_uidx").on(table.origenId, table.folio),
    index("salidas_destino_estado_idx").on(table.destinoId, table.estado),
    index("salidas_cliente_estado_idx").on(table.clienteId, table.estado),
    index("salidas_ticket_idx").on(table.ticketId),
    index("salidas_estado_idx").on(table.estado),
    index("salidas_folio_idx").on(table.folio),
    index("salidas_created_at_idx").on(table.createdAt),
    index("salidas_estado_actividad_idx").on(table.estado, table.actividadAt),
    uniqueIndex("salidas_borrador_usuario_origen_uidx")
      .on(table.usuarioSolicitaId, table.origenId)
      .where(
        sql`${table.estado} = 'ARMANDO' AND ${table.modalidad} = 'TRASLADO' AND ${table.usuarioSolicitaId} IS NOT NULL`,
      ),
  ],
);

export const salidaLineasTable = pgTable(
  "salida_lineas",
  {
    id: serial("id").primaryKey(),
    salidaId: integer("salida_id")
      .notNull()
      .references(() => salidasTable.id),
    productoId: integer("producto_id")
      .notNull()
      .references(() => productosTable.id),
    cantidadSolicitada: numeric("cantidad_solicitada", {
      precision: 10,
      scale: 3,
    }).notNull(),
    cantidadEnviada: numeric("cantidad_enviada", {
      precision: 10,
      scale: 3,
    })
      .notNull()
      .default("0"),
    cantidadRecibida: numeric("cantidad_recibida", {
      precision: 10,
      scale: 3,
    })
      .notNull()
      .default("0"),
    rollosSolicitados: integer("rollos_solicitados"),
    nota: text("nota"),
  },
  (table) => [
    index("salida_lineas_salida_idx").on(table.salidaId),
    index("salida_lineas_producto_idx").on(table.productoId),
  ],
);

export const salidaRollosTable = pgTable(
  "salida_rollos",
  {
    id: serial("id").primaryKey(),
    salidaId: integer("salida_id")
      .notNull()
      .references(() => salidasTable.id),
    lineaId: integer("linea_id")
      .notNull()
      .references(() => salidaLineasTable.id),
    rolloId: integer("rollo_id")
      .notNull()
      .references(() => rollosTable.id),
    cantidadEnviada: numeric("cantidad_enviada", {
      precision: 10,
      scale: 3,
    }).notNull(),
    cantidadRecibida: numeric("cantidad_recibida", {
      precision: 10,
      scale: 3,
    }),
    recibido: boolean("recibido").notNull().default(false),
    notaDiferencia: text("nota_diferencia"),
  },
  (table) => [
    index("salida_rollos_salida_idx").on(table.salidaId),
    index("salida_rollos_linea_idx").on(table.lineaId),
    index("salida_rollos_rollo_idx").on(table.rolloId),
  ],
);

/** One counter per origin site; a new site starts with folio 1. */
export const salidaFolioTable = pgTable("salida_folio", {
  ubicacionId: integer("ubicacion_id")
    .primaryKey()
    .references(() => ubicacionesTable.id),
  ultimoFolio: integer("ultimo_folio").notNull().default(0),
});

export type Salida = typeof salidasTable.$inferSelect;
export type SalidaLinea = typeof salidaLineasTable.$inferSelect;
export type SalidaRollo = typeof salidaRollosTable.$inferSelect;
export type SalidaFolio = typeof salidaFolioTable.$inferSelect;