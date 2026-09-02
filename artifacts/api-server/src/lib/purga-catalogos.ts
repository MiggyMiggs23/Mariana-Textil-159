import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

export const ENTIDADES_PURGABLES = [
  "usuarios",
  "camionetas",
  "choferes",
  "clientes",
  "proveedores",
  "productos",
] as const;

export type EntidadPurgable = (typeof ENTIDADES_PURGABLES)[number];

type Descriptor = {
  table: EntidadPurgable;
  /** Exact discriminator already used by persisted audit/notification events. */
  entityName: EntidadPurgable;
  paymentPartyType?: "CLIENTE" | "PROVEEDOR";
  /** FK-backed append-only ledger(s) whose mere existence permanently blocks purge. */
  financialReferenceKeys?: readonly string[];
  activeColumn: string;
  visibleSql: string;
};

const DESCRIPTORS: Record<EntidadPurgable, Descriptor> = {
  usuarios: { table: "usuarios", entityName: "usuarios", activeColumn: "activo", visibleSql: "nombre" },
  camionetas: { table: "camionetas", entityName: "camionetas", activeColumn: "activa", visibleSql: "nombre" },
  choferes: { table: "choferes", entityName: "choferes", activeColumn: "activo", visibleSql: "nombre_completo" },
  clientes: {
    table: "clientes",
    entityName: "clientes",
    paymentPartyType: "CLIENTE",
    financialReferenceKeys: [
      "movimientos_credito.cliente_id",
      // Kept for installations that still have the legacy payment table.
      "pagos_cliente.cliente_id",
    ],
    activeColumn: "activo",
    visibleSql: "nombre",
  },
  proveedores: {
    table: "proveedores",
    entityName: "proveedores",
    paymentPartyType: "PROVEEDOR",
    financialReferenceKeys: ["pagos_proveedor.proveedor_id"],
    activeColumn: "activo",
    visibleSql: "nombre",
  },
  productos: {
    table: "productos",
    entityName: "productos",
    activeColumn: "activo",
    visibleSql: "tela || ' / ' || color || ' (' || sku || ')'",
  },
};

/** Explicit human labels for every currently-known FK. Unknown future FKs are
 * still discovered and counted, fail-closed, with a safe generated label. */
const REFERENCE_LABELS: Record<string, string> = {
  "auditoria.usuario_id": "Bitácora (como actor)",
  "auditorias_inventario.creada_por_id": "Auditorías de inventario creadas",
  "auditorias_inventario.cerrada_por_id": "Auditorías de inventario cerradas",
  "auditorias_inventario.confirmada_por_id": "Auditorías de inventario confirmadas",
  "auditorias_inventario.cancelada_por_id": "Auditorías de inventario canceladas",
  "auditoria_inventario_escaneos.usuario_id": "Escaneos de auditoría de inventario",
  "auditoria_inventario_resultados.resuelto_por_id": "Resoluciones de auditoría de inventario",
  "auditoria_inventario_resultados.producto_id": "Resultados de auditoría de inventario",
  "sesiones.usuario_id": "Sesiones",
  "permisos_usuario.usuario_id": "Permisos del usuario",
  "permisos_usuario.updated_por": "Permisos actualizados",
  "permisos_rol.updated_por": "Permisos de rol actualizados",
  "viajes.camioneta_id": "Viajes de la camioneta",
  "viajes.chofer_id": "Viajes del chofer",
  "viajes.creado_por_id": "Viajes creados",
  "tickets.usuario_id": "Tickets creados",
  "tickets.cliente_id": "Tickets del cliente",
  "ticket_lineas.producto_id": "Líneas de venta",
  "movimientos_credito.cliente_id": "Movimientos de crédito",
  "movimientos_credito.usuario_id": "Movimientos de crédito creados",
  "pagos_cliente.cliente_id": "Pagos del cliente",
  "pagos_cliente.usuario_id": "Pagos de cliente capturados",
  "cliente_documentos.cliente_id": "Documentos del cliente",
  "cliente_documentos.usuario_id": "Documentos de cliente capturados",
  "rollos.producto_id": "Rollos",
  "rollos.proveedor_id": "Rollos del proveedor",
  "rollos.creado_por": "Rollos capturados",
  "rollos.revisado_por": "Rollos revisados",
  "rollo_eventos.usuario_id": "Movimientos de kardex",
  "rollo_eventos.producto_id": "Movimientos de producto",
  "contenedor_lineas.producto_id": "Líneas de contenedor",
  "contenedores.proveedor_id": "Contenedores del proveedor",
  "contenedores.creado_por_id": "Contenedores creados",
  "entradas.proveedor_id": "Entradas del proveedor",
  "entradas.usuario_id": "Entradas capturadas",
  "pagos_proveedor.proveedor_id": "Pagos del proveedor",
  "pagos_proveedor.usuario_id": "Pagos de proveedor capturados",
  "precio_historial.producto_id": "Historial de precios",
  "precio_historial.usuario_id": "Cambios de precio",
  "salida_lineas.producto_id": "Líneas de salida",
  "etiquetas_impresiones.usuario_id": "Impresiones de etiquetas",
  "etiquetas_impresiones.autorizado_por": "Autorizaciones de etiquetas",
  "solicitudes_pago_dirigido.solicitante_id": "Solicitudes de pago dirigido",
  "solicitudes_pago_dirigido.autorizador_id": "Autorizaciones de pago dirigido",
};

type Executor = Pick<typeof db, "execute">;
export type PurgaReferencia = { tipo: string; cantidad: number };
type CountedPurgaReferencia = PurgaReferencia & { financialMovement?: boolean };
export type PurgaPreflight = {
  entidad: EntidadPurgable;
  id: number;
  nombreVisible: string;
  inactivo: boolean;
  referencias: PurgaReferencia[];
  totalReferencias: number;
  puedeEliminar: boolean;
  motivoBloqueo: string | null;
};

export class PurgaNotFoundError extends Error {}
export class PurgaConflictError extends Error {
  constructor(
    message: string,
    readonly referencias: PurgaReferencia[] = [],
  ) {
    super(message);
  }
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

async function loadTarget(
  executor: Executor,
  descriptor: Descriptor,
  id: number,
  lock: boolean,
): Promise<Record<string, unknown>> {
  const result = await executor.execute(
    sql.raw(
      `SELECT *, (${descriptor.visibleSql})::text AS "__nombre_visible" FROM ${quoteIdentifier(descriptor.table)} WHERE id = ${Number(id)}${lock ? " FOR UPDATE" : ""}`,
    ),
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new PurgaNotFoundError("Registro no encontrado.");
  return row;
}

async function countReferences(
  executor: Executor,
  descriptor: Descriptor,
  id: number,
): Promise<CountedPurgaReferencia[]> {
  const fkResult = await executor.execute(sql`
    SELECT child.relname AS table_name, child_col.attname AS column_name
    FROM pg_constraint fk
    JOIN pg_class parent ON parent.oid = fk.confrelid
    JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
    JOIN pg_class child ON child.oid = fk.conrelid
    JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
    JOIN LATERAL unnest(fk.conkey) WITH ORDINALITY AS keys(attnum, ord) ON true
    JOIN LATERAL unnest(fk.confkey) WITH ORDINALITY AS parent_keys(attnum, ord)
      ON parent_keys.ord = keys.ord
    JOIN pg_attribute child_col ON child_col.attrelid = child.oid AND child_col.attnum = keys.attnum
    JOIN pg_attribute parent_col ON parent_col.attrelid = parent.oid AND parent_col.attnum = parent_keys.attnum
    WHERE fk.contype = 'f'
      AND parent_ns.nspname = current_schema()
      AND child_ns.nspname = current_schema()
      AND parent.relname = ${descriptor.table}
      AND parent_col.attname = 'id'
  `);
  const references: CountedPurgaReferencia[] = [];
  const auditResult = await executor.execute(sql`
    SELECT count(*)::int AS count
    FROM auditoria
    WHERE entidad = ${descriptor.entityName}
      AND entidad_id = ${String(id)}
  `);
  const auditCount = Number((auditResult.rows[0] as { count: number }).count);
  if (auditCount > 0) {
    references.push({ tipo: "Bitácora", cantidad: auditCount });
  }

  // This is the only other persisted generic type/id relation in the current
  // schema. It is counted even though catalog notifications are not emitted
  // today, so future writers cannot silently bypass purga.
  const notificationsResult = await executor.execute(sql`
    SELECT count(*)::int AS count
    FROM notificaciones_sistema
    WHERE entidad = ${descriptor.entityName}
      AND entidad_id = ${String(id)}
  `);
  const notificationsCount = Number(
    (notificationsResult.rows[0] as { count: number }).count,
  );
  if (notificationsCount > 0) {
    references.push({
      tipo: "Notificaciones del sistema",
      cantidad: notificationsCount,
    });
  }
  if (descriptor.paymentPartyType) {
    const requestsResult = await executor.execute(sql`
      SELECT count(*)::int AS count
      FROM solicitudes_pago_dirigido
      WHERE tipo = ${descriptor.paymentPartyType}
        AND entidad_id = ${id}
    `);
    const requestsCount = Number(
      (requestsResult.rows[0] as { count: number }).count,
    );
    if (requestsCount > 0) {
      references.push({
        tipo: "Solicitudes de pago dirigido",
        cantidad: requestsCount,
      });
    }
  }
  for (const fk of fkResult.rows as Array<{ table_name: string; column_name: string }>) {
    const countResult = await executor.execute(
      sql.raw(
        `SELECT count(*)::int AS count FROM ${quoteIdentifier(fk.table_name)} WHERE ${quoteIdentifier(fk.column_name)} = ${Number(id)}`,
      ),
    );
    const cantidad = Number((countResult.rows[0] as { count: number }).count);
    if (cantidad > 0) {
      const key = `${fk.table_name}.${fk.column_name}`;
      references.push({
        tipo: REFERENCE_LABELS[key] ?? `Referencia en ${fk.table_name}.${fk.column_name}`,
        cantidad,
        financialMovement: descriptor.financialReferenceKeys?.includes(key),
      });
    }
  }
  return references.sort((a, b) => a.tipo.localeCompare(b.tipo, "es"));
}

const SECRET_KEY_PATTERN =
  /password|contrase(?:n|ñ)a|credential|secret|token|cookie|session|api[_-]?key|hash/i;

/** Recursively removes credentials while preserving every non-secret field. */
export function sanitizeAuditSnapshot(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAuditSnapshot);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        ([key]) =>
          key !== "__nombre_visible" && !SECRET_KEY_PATTERN.test(key),
      )
      .map(([key, item]) => [key, sanitizeAuditSnapshot(item)]),
  );
}

export function buildPreflight(
  entidad: EntidadPurgable,
  id: number,
  row: Record<string, unknown>,
  referencias: CountedPurgaReferencia[],
): PurgaPreflight {
  const descriptor = DESCRIPTORS[entidad];
  const inactivo = row[descriptor.activeColumn] === false;
  const systemClient = entidad === "clientes" && row.es_sistema === true;
  const totalReferencias = referencias.reduce((sum, item) => sum + item.cantidad, 0);
  const hasFinancialMovements =
    (entidad === "clientes" || entidad === "proveedores") &&
    referencias.some((item) => item.financialMovement && item.cantidad > 0);
  const motivoBloqueo = systemClient
    ? "Los clientes del sistema jamás se pueden purgar."
    : hasFinancialMovements
      ? `Este ${entidad === "clientes" ? "cliente" : "proveedor"} tiene movimientos en su estado de cuenta y su histórico financiero no se puede borrar. Desactívalo en vez de purgarlo para conservar la historia consultable.`
      : !inactivo
        ? "Solo se pueden purgar registros inactivos."
        : totalReferencias > 0
          ? "El registro conserva referencias y no se puede purgar."
          : null;
  return {
    entidad,
    id,
    nombreVisible: String(row.__nombre_visible),
    inactivo,
    referencias: referencias.map(({ tipo, cantidad }) => ({ tipo, cantidad })),
    totalReferencias,
    puedeEliminar: motivoBloqueo === null,
    motivoBloqueo,
  };
}

export async function getPurgaPreflight(
  entidad: EntidadPurgable,
  id: number,
): Promise<PurgaPreflight> {
  const descriptor = DESCRIPTORS[entidad];
  const row = await loadTarget(db, descriptor, id, false);
  return buildPreflight(entidad, id, row, await countReferences(db, descriptor, id));
}

export async function purgeInactiveRecord(input: {
  entidad: EntidadPurgable;
  id: number;
  confirmacion: string;
  actorId: number;
  ip: string;
}): Promise<void> {
  const descriptor = DESCRIPTORS[input.entidad];
  await db.transaction(async (tx) => {
    // Logical type/id relations have no FK and therefore cannot acquire a key
    // lock on the target. This fixed-order lock intentionally serializes their
    // writers with purges for a short transaction: fail-closed is preferable
    // to allowing a concurrent append-only reference to race the count. A
    // transaction never conflicts with its own later Bitácora INSERT.
    await tx.execute(sql.raw(
      "LOCK TABLE auditoria, notificaciones_sistema, solicitudes_pago_dirigido IN SHARE ROW EXCLUSIVE MODE",
    ));
    const row = await loadTarget(tx, descriptor, input.id, true);
    if (input.entidad === "usuarios") {
      const admins = await tx.execute(sql`
        SELECT id FROM usuarios
        WHERE rol = 'ADMIN' AND activo = true AND alcance_consulta = 'TODAS'
        FOR UPDATE
      `);
      if (admins.rows.length < 1) {
        throw new PurgaConflictError("Debe conservarse al menos una cuenta ADMIN de recuperación.");
      }
    }
    const references = await countReferences(tx, descriptor, input.id);
    const preflight = buildPreflight(input.entidad, input.id, row, references);
    if (!preflight.puedeEliminar) {
      throw new PurgaConflictError(
        preflight.motivoBloqueo!,
        references.map(({ tipo, cantidad }) => ({ tipo, cantidad })),
      );
    }
    if (input.confirmacion !== preflight.nombreVisible) {
      throw new PurgaConflictError("El texto de confirmación no coincide exactamente.");
    }
    const snapshot = sanitizeAuditSnapshot(row);
    await tx.execute(sql`
      INSERT INTO auditoria
        (usuario_id, accion, entidad, entidad_id, datos_antes, datos_despues, ip)
      VALUES
        (${input.actorId}, 'PURGAR', ${input.entidad}, ${String(input.id)},
         ${JSON.stringify(snapshot)}::jsonb,
         ${JSON.stringify({ preflight: { referencias: references, totalReferencias: 0 } })}::jsonb,
         ${input.ip})
    `);
    await tx.execute(
      sql.raw(
        `DELETE FROM ${quoteIdentifier(descriptor.table)} WHERE id = ${Number(input.id)}`,
      ),
    );
  });
}