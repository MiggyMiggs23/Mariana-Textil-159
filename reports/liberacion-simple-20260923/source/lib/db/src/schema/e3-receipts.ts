import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { clientesTable } from "./clientes";
import { movimientosCreditoTable, sesionesCajaTable } from "./pos";
import { usuariosTable } from "./users";
import { ubicacionesTable } from "./locations";

/** Prepared schema only. Installation and immutable triggers require reviewed SQL, never startup DDL. */
export const vistasAbonoE3Table = pgTable("vistas_abono_e3", {
  operacionClave: uuid("operacion_clave").primaryKey(),
  token: text("token").notNull(),
  intentHash: text("intent_hash").notNull(),
  actorId: integer("actor_id").notNull().references(() => usuariosTable.id),
  emitidaAt: timestamp("emitida_at", { withTimezone: true }).notNull(),
}, table => [check("vistas_abono_e3_token_check", sql`${table.token} ~ '^[a-f0-9]{64}$'`)]);

export const reciboFolioE3Table = pgTable("recibo_folio_e3", {
  sitioId: integer("sitio_id").primaryKey().references(() => ubicacionesTable.id),
  ultimoFolio: integer("ultimo_folio").notNull().default(0),
});

export const recibosAbonoE3Table = pgTable("recibos_abono_e3", {
  operacionClave: uuid("operacion_clave").primaryKey(),
  intentHash: text("intent_hash").notNull(),
  folio: text("folio").notNull().unique(),
  movimientoId: integer("movimiento_id").notNull().unique().references(() => movimientosCreditoTable.id),
  clienteId: integer("cliente_id").notNull().references(() => clientesTable.id),
  sesionOperativaId: integer("sesion_operativa_id").references(() => sesionesCajaTable.id),
  origen: text("origen").notNull(),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
}, table => [
  check("recibos_abono_e3_intent_hash_check", sql`${table.intentHash} ~ '^[a-f0-9]{64}$'`),
  check("recibos_abono_e3_origen_check", sql`${table.origen} IN ('CAJA','RECAPTURA')`),
  check("recibos_abono_e3_check", sql`(${table.origen}='CAJA' AND ${table.sesionOperativaId} IS NOT NULL)
    OR (${table.origen}='RECAPTURA' AND ${table.sesionOperativaId} IS NULL)`),
  index("recibos_abono_e3_cliente_idx").on(table.clienteId, table.movimientoId),
  index("recibos_abono_e3_sesion_idx").on(table.sesionOperativaId, table.movimientoId),
]);