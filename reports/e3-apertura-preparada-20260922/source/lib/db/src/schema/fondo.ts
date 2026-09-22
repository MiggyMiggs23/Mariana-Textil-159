import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ubicacionesTable } from "./locations";
import { usuariosTable } from "./users";

export const fondoMarianaTable = pgTable(
  "fondo_mariana",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ubicacionId: integer("ubicacion_id").notNull().references(() => ubicacionesTable.id),
    nombre: text("nombre").notNull().default("Fondo de Mariana"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("fondo_mariana_nombre_check", sql`${table.nombre} = 'Fondo de Mariana'`),
    uniqueIndex("fondo_mariana_singleton_uidx").on(sql`(true)`),
    uniqueIndex("fondo_mariana_ubicacion_uidx").on(table.ubicacionId),
  ],
);

export const fondoMovimientosTable = pgTable(
  "fondo_movimientos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ordinal: bigint("ordinal", { mode: "bigint" }).notNull(),
    fondoId: uuid("fondo_id").notNull().references(() => fondoMarianaTable.id),
    naturaleza: text("naturaleza").notNull(),
    categoria: text("categoria").notNull(),
    importeCentavos: bigint("importe_centavos", { mode: "bigint" }).notNull(),
    motivo: text("motivo").notNull(),
    autorId: integer("autor_id").notNull().references(() => usuariosTable.id),
    originalId: uuid("original_id"),
    idempotencyKey: uuid("idempotency_key").notNull(),
    idempotencyProducer: text("idempotency_producer").notNull(),
    payloadHash: text("payload_hash").notNull(),
    conciliacionInicial: jsonb("conciliacion_inicial").$type<{
      efectivoFisicoContado: string;
      declaracionSinDuplicacion: true;
      evidencia: string;
    } | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("fondo_movimientos_naturaleza_check", sql`${table.naturaleza} IN ('INGRESO','RETIRO')`),
    check("fondo_movimientos_categoria_check", sql`${table.categoria} IN ('SALDO_INICIAL','CAPITAL','OTRO_INGRESO','RETIRO')`),
    check("fondo_movimientos_importe_check", sql`${table.importeCentavos} >= 0 AND (${table.importeCentavos} > 0 OR ${table.categoria} = 'SALDO_INICIAL')`),
    check("fondo_movimientos_motivo_check", sql`char_length(btrim(${table.motivo})) BETWEEN 1 AND 500`),
    check("fondo_movimientos_productor_check", sql`${table.idempotencyProducer} IN ('FONDO_API_MOVIMIENTO_V1','FONDO_API_INVERSO_V1')`),
    check("fondo_movimientos_hash_check", sql`${table.payloadHash} ~ '^[0-9a-f]{64}$'`),
    uniqueIndex("fondo_movimientos_productor_idempotencia_uidx").on(table.idempotencyProducer, table.idempotencyKey),
    uniqueIndex("fondo_movimientos_original_uidx").on(table.originalId).where(sql`${table.originalId} IS NOT NULL`),
    uniqueIndex("fondo_movimientos_ordinal_uidx").on(table.ordinal),
    index("fondo_movimientos_fondo_ordinal_idx").on(table.fondoId, table.ordinal),
  ],
);

export const fondoArqueosTable = pgTable(
  "fondo_arqueos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fondoId: uuid("fondo_id").notNull().references(() => fondoMarianaTable.id),
    saldoSistemaCentavos: bigint("saldo_sistema_centavos", { mode: "bigint" }).notNull(),
    efectivoContadoCentavos: bigint("efectivo_contado_centavos", { mode: "bigint" }).notNull(),
    diferenciaCentavos: bigint("diferencia_centavos", { mode: "bigint" }).notNull(),
    versionSaldo: uuid("version_saldo").references(() => fondoMovimientosTable.id),
    motivo: text("motivo").notNull(),
    autorId: integer("autor_id").notNull().references(() => usuariosTable.id),
    idempotencyKey: uuid("idempotency_key").notNull(),
    idempotencyProducer: text("idempotency_producer").notNull(),
    payloadHash: text("payload_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("fondo_arqueos_efectivo_check", sql`${table.efectivoContadoCentavos} >= 0`),
    check("fondo_arqueos_diferencia_check", sql`${table.diferenciaCentavos} = ${table.efectivoContadoCentavos} - ${table.saldoSistemaCentavos}`),
    check("fondo_arqueos_motivo_check", sql`char_length(btrim(${table.motivo})) BETWEEN 1 AND 500`),
    check("fondo_arqueos_productor_check", sql`${table.idempotencyProducer} = 'FONDO_API_ARQUEO_V1'`),
    check("fondo_arqueos_hash_check", sql`${table.payloadHash} ~ '^[0-9a-f]{64}$'`),
    uniqueIndex("fondo_arqueos_productor_idempotencia_uidx").on(table.idempotencyProducer, table.idempotencyKey),
    index("fondo_arqueos_fondo_fecha_idx").on(table.fondoId, table.createdAt, table.id),
  ],
);

export const insertFondoMovimientoSchema = createInsertSchema(fondoMovimientosTable).omit({ id: true, ordinal: true, createdAt: true });
export const insertFondoArqueoSchema = createInsertSchema(fondoArqueosTable).omit({ id: true, createdAt: true });
export type FondoMovimiento = typeof fondoMovimientosTable.$inferSelect;
export type FondoArqueo = typeof fondoArqueosTable.$inferSelect;