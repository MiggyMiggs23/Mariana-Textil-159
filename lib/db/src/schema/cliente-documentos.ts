import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { clientesTable } from "./clientes";
import { usuariosTable } from "./users";

export const clienteDocumentosTable = pgTable(
  "cliente_documentos",
  {
    id: serial("id").primaryKey(),
    publicId: uuid("public_id").notNull().defaultRandom().unique(),
    clienteId: integer("cliente_id")
      .notNull()
      .references(() => clientesTable.id),
    tipo: text("tipo").notNull().default("INE"),
    lado: text("lado").notNull(),
    nombreArchivo: text("nombre_archivo").notNull(),
    rutaArchivo: text("ruta_archivo").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    tamanoBytes: integer("tamano_bytes").notNull(),
    subidoPor: integer("subido_por")
      .notNull()
      .references(() => usuariosTable.id),
    subidoAt: timestamp("subido_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    vigente: boolean("vigente").notNull().default(true),
    reemplazaId: integer("reemplaza_id"),
  },
  (table) => [
    index("cliente_documentos_cliente_idx").on(table.clienteId),
    uniqueIndex("cliente_documentos_slot_vigente_uidx")
      .on(table.clienteId, table.lado)
      .where(sql`${table.vigente} = true`),
    check("cliente_documentos_tipo_check", sql`${table.tipo} = 'INE'`),
    check(
      "cliente_documentos_lado_check",
      sql`${table.lado} IN ('FRENTE', 'REVERSO')`,
    ),
    check(
      "cliente_documentos_tamano_check",
      sql`${table.tamanoBytes} > 0 AND ${table.tamanoBytes} <= 5242880`,
    ),
  ],
);

export type ClienteDocumento = typeof clienteDocumentosTable.$inferSelect;