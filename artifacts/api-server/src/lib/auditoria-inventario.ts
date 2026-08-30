import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  auditoriaInventarioEscaneosTable,
  auditoriaInventarioFolioTable,
  auditoriaInventarioParticipantesTable,
  auditoriaInventarioSnapshotTable,
  auditoriasInventarioTable,
  auditoriaTable,
  productosTable,
  pisosTable,
  rollosTable,
  ubicacionesTable,
  usuariosTable,
} from "@workspace/db";
import {
  ADVISORY_LOCK_NAMESPACES,
  transactionAdvisoryLock,
} from "@workspace/db/advisory-locks";
import {
  ajustarRollo,
  lockInventoryPairs,
  recibirTransferencia,
  transferirRolloInmediato,
  type Tx,
} from "./inventario";

export class AuditoriaInventarioError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

function stableUuid(value: string): string {
  const bytes = Buffer.from(createHash("sha256").update(value).digest().subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function audit(
  tx: Tx,
  input: {
    usuarioId: number;
    accion: string;
    auditoriaId: number;
    sitioId: number;
    ip: string;
    datos?: Record<string, unknown>;
  },
) {
  await tx.insert(auditoriaTable).values({
    usuarioId: input.usuarioId,
    modulo: "auditoria_inventario",
    accion: input.accion,
    entidad: "auditorias_inventario",
    entidadId: String(input.auditoriaId),
    sitioId: input.sitioId,
    datosDespues: input.datos ?? null,
    ip: input.ip,
  });
}

export async function createAuditoria(
  tx: Tx,
  input: { ubicacionId: number; usuarioId: number; ip: string },
) {
  await transactionAdvisoryLock(
    tx,
    ADVISORY_LOCK_NAMESPACES.INVENTORY_AUDIT_SITE,
    input.ubicacionId,
  );
  const [open] = await tx
    .select({ id: auditoriasInventarioTable.id })
    .from(auditoriasInventarioTable)
    .where(
      and(
        eq(auditoriasInventarioTable.ubicacionId, input.ubicacionId),
        eq(auditoriasInventarioTable.estado, "ABIERTA"),
      ),
    )
    .limit(1);
  if (open) {
    throw new AuditoriaInventarioError(
      "Ya existe una auditoría ABIERTA para este sitio.",
      "OPEN_AUDIT_EXISTS",
    );
  }
  const [site] = await tx
    .select({ id: ubicacionesTable.id })
    .from(ubicacionesTable)
    .where(
      and(
        eq(ubicacionesTable.id, input.ubicacionId),
        eq(ubicacionesTable.activa, true),
        inArray(ubicacionesTable.tipo, ["TIENDA", "BODEGA"]),
      ),
    )
    .limit(1);
  if (!site) throw new AuditoriaInventarioError("Sitio inválido o inactivo.", "SITE_NOT_FOUND");

  await tx
    .insert(auditoriaInventarioFolioTable)
    .values({ ubicacionId: input.ubicacionId, ultimoFolio: 0 })
    .onConflictDoNothing();
  const [counter] = await tx
    .select()
    .from(auditoriaInventarioFolioTable)
    .where(eq(auditoriaInventarioFolioTable.ubicacionId, input.ubicacionId))
    .for("update");
  const folio = counter!.ultimoFolio + 1;
  await tx
    .update(auditoriaInventarioFolioTable)
    .set({ ultimoFolio: folio })
    .where(eq(auditoriaInventarioFolioTable.ubicacionId, input.ubicacionId));
  const [created] = await tx
    .insert(auditoriasInventarioTable)
    .values({
      folio,
      ubicacionId: input.ubicacionId,
      creadaPorId: input.usuarioId,
    })
    .returning();
  const rolls = await tx
    .select({
      rolloId: rollosTable.id,
      serie: rollosTable.serie,
      cantidadSnapshot: rollosTable.cantidadActual,
      skuSnapshot: productosTable.sku,
      telaSnapshot: productosTable.tela,
      colorSnapshot: productosTable.color,
      unidadSnapshot: productosTable.unidad,
      ubicacionSnapshotId: ubicacionesTable.id,
      ubicacionSnapshot: ubicacionesTable.nombre,
       pisoSnapshotId: rollosTable.pisoId,
       pisoSnapshot: pisosTable.nombre,
      estadoSnapshot: rollosTable.estado,
    })
    .from(rollosTable)
    .innerJoin(productosTable, eq(productosTable.id, rollosTable.productoId))
    .innerJoin(ubicacionesTable, eq(ubicacionesTable.id, rollosTable.ubicacionId))
    .leftJoin(pisosTable, eq(pisosTable.id, rollosTable.pisoId))
    .where(
      and(
        eq(rollosTable.ubicacionId, input.ubicacionId),
        eq(rollosTable.estado, "DISPONIBLE"),
      ),
    );
  if (rolls.length) {
    await tx.insert(auditoriaInventarioSnapshotTable).values(
      rolls.map((roll) => ({ auditoriaId: created!.id, ...roll })),
    );
  }
  await audit(tx, {
    usuarioId: input.usuarioId,
    accion: "ABRIR",
    auditoriaId: created!.id,
    sitioId: input.ubicacionId,
    ip: input.ip,
    datos: { folio, totalSnapshot: rolls.length },
  });
  return created!;
}

export async function scanAuditoria(
  tx: Tx,
    input: { auditoriaId: number; serie: string; usuarioId: number; ip: string; pisoId?: number | null },
) {
  const serie = input.serie.trim();
  const [header] = await tx
    .select()
    .from(auditoriasInventarioTable)
    .where(eq(auditoriasInventarioTable.id, input.auditoriaId))
    .for("share")
    .limit(1);
  if (!header) throw new AuditoriaInventarioError("Auditoría no encontrada.", "NOT_FOUND");
  if (header.estado !== "ABIERTA") {
    throw new AuditoriaInventarioError("El conteo está cerrado y no admite escaneos.", "NOT_OPEN");
  }
  const activeFloors = await tx.select({ id: pisosTable.id, nombre: pisosTable.nombre }).from(pisosTable)
    .where(and(eq(pisosTable.ubicacionId, header.ubicacionId), eq(pisosTable.activo, true)));
  const realFloor = input.pisoId == null ? null : activeFloors.find((floor) => floor.id === input.pisoId);
  if ((activeFloors.length && !realFloor) || (!activeFloors.length && input.pisoId != null)) {
    throw new AuditoriaInventarioError("El piso real debe ser activo y pertenecer al sitio auditado.", "INVALID_FLOOR");
  }
  const [roll] = await tx
    .select({ id: rollosTable.id, estado: rollosTable.estado })
    .from(rollosTable)
    .where(eq(rollosTable.serie, serie))
    .limit(1);
  const inserted = await tx
    .insert(auditoriaInventarioEscaneosTable)
    .values({
      auditoriaId: input.auditoriaId,
      serie,
      rolloId: roll?.id ?? null,
      usuarioId: input.usuarioId,
      pisoRealId: input.pisoId ?? null,
      pisoReal: realFloor?.nombre ?? null,
    })
    .onConflictDoNothing()
    .returning({ serie: auditoriaInventarioEscaneosTable.serie });
  const [snapshot] = await tx
    .select({ serie: auditoriaInventarioSnapshotTable.serie })
    .from(auditoriaInventarioSnapshotTable)
    .where(
      and(
        eq(auditoriaInventarioSnapshotTable.auditoriaId, input.auditoriaId),
        eq(auditoriaInventarioSnapshotTable.serie, serie),
      ),
    )
    .limit(1);
  await tx
    .insert(auditoriaInventarioParticipantesTable)
    .values({
      auditoriaId: input.auditoriaId,
      usuarioId: input.usuarioId,
      escaneos: inserted.length,
      ultimoAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        auditoriaInventarioParticipantesTable.auditoriaId,
        auditoriaInventarioParticipantesTable.usuarioId,
      ],
      set: {
        ultimoAt: new Date(),
        escaneos: sql`${auditoriaInventarioParticipantesTable.escaneos} + ${inserted.length}`,
      },
    });
  if (inserted.length) {
    await audit(tx, {
      usuarioId: input.usuarioId,
      accion: "ESCANEAR",
      auditoriaId: header.id,
      sitioId: header.ubicacionId,
      ip: input.ip,
      datos: { serie, pisoRealId: input.pisoId ?? null, clasificacion: snapshot ? "CUADRO" : "SOBRANTE" },
    });
  }
  return {
    serie,
    duplicado: inserted.length === 0,
    clasificacion: snapshot ? ("CUADRO" as const) : ("SOBRANTE" as const),
    estadoActual: roll?.estado ?? "SIN_REGISTRO",
  };
}

export async function transitionAuditoria(
  tx: Tx,
  input: {
    auditoriaId: number;
    usuarioId: number;
    ip: string;
    action: "CERRAR" | "CANCELAR";
    motivo?: string;
  },
) {
  const [header] = await tx
    .select()
    .from(auditoriasInventarioTable)
    .where(eq(auditoriasInventarioTable.id, input.auditoriaId))
    .for("update")
    .limit(1);
  if (!header) throw new AuditoriaInventarioError("Auditoría no encontrada.", "NOT_FOUND");
  if (header.estado !== "ABIERTA") {
    throw new AuditoriaInventarioError("La auditoría ya no está ABIERTA.", "NOT_OPEN");
  }
  if (input.action === "CERRAR") {
    const extras = await tx.execute(sql`
      SELECT e.serie, r.cantidad_actual, r.sku, r.tela, r.color, r.unidad,
        r.estado, r.ubicacion_id, r.ubicacion
      FROM auditoria_inventario_escaneos e
      LEFT JOIN auditoria_inventario_snapshot s
        ON s.auditoria_id=e.auditoria_id AND s.serie=e.serie
      LEFT JOIN LATERAL (
        SELECT r.cantidad_actual, p.sku, p.tela, p.color, p.unidad::text unidad,
          r.estado::text estado, u.id ubicacion_id, u.nombre ubicacion
        FROM rollos r
        JOIN productos p ON p.id=r.producto_id
        JOIN ubicaciones u ON u.id=r.ubicacion_id
        WHERE r.id=e.rollo_id
        FOR UPDATE OF r
      ) r ON true
      WHERE e.auditoria_id=${header.id} AND s.serie IS NULL
    `);
    for (const extra of extras.rows as Array<Record<string, unknown>>) {
      await tx
        .update(auditoriaInventarioEscaneosTable)
        .set({
          cantidadCierre: extra.cantidad_actual == null ? null : String(extra.cantidad_actual),
          skuCierre: extra.sku == null ? null : String(extra.sku),
          telaCierre: extra.tela == null ? null : String(extra.tela),
          colorCierre: extra.color == null ? null : String(extra.color),
          unidadCierre: extra.unidad == null ? null : String(extra.unidad),
          estadoCierre: extra.estado == null ? "SIN_REGISTRO" : String(extra.estado),
          ubicacionCierreId: extra.ubicacion_id == null ? null : Number(extra.ubicacion_id),
          ubicacionCierre: extra.ubicacion == null ? null : String(extra.ubicacion),
        })
        .where(
          and(
            eq(auditoriaInventarioEscaneosTable.auditoriaId, header.id),
            eq(auditoriaInventarioEscaneosTable.serie, String(extra.serie)),
          ),
        );
    }
  }
  const now = new Date();
  await tx
    .update(auditoriasInventarioTable)
    .set(
      input.action === "CERRAR"
        ? { estado: "CERRADA", cerradaPorId: input.usuarioId, cerradaAt: now }
        : {
            estado: "CANCELADA",
            canceladaPorId: input.usuarioId,
            canceladaAt: now,
            motivoCancelacion: input.motivo!.trim(),
          },
    )
    .where(eq(auditoriasInventarioTable.id, header.id));
  await audit(tx, {
    usuarioId: input.usuarioId,
    accion: input.action,
    auditoriaId: header.id,
    sitioId: header.ubicacionId,
    ip: input.ip,
    datos: input.motivo ? { motivo: input.motivo.trim() } : undefined,
  });
}

export async function confirmAuditoria(
  tx: Tx,
  input: { auditoriaId: number; usuarioId: number; ip: string },
) {
  const [header] = await tx
    .select()
    .from(auditoriasInventarioTable)
    .where(eq(auditoriasInventarioTable.id, input.auditoriaId))
    .for("update")
    .limit(1);
  if (!header) throw new AuditoriaInventarioError("Auditoría no encontrada.", "NOT_FOUND");
  if (header.estado === "CONFIRMADA") return;
  if (header.estado !== "CERRADA") {
    throw new AuditoriaInventarioError("Solo se confirma una auditoría CERRADA.", "NOT_CLOSED");
  }
  const missingCandidatesResult = await tx.execute(sql`
    SELECT s.rollo_id, r.producto_id, r.estado::text, r.ubicacion_id
    FROM auditoria_inventario_snapshot s
    LEFT JOIN auditoria_inventario_escaneos e
      ON e.auditoria_id=s.auditoria_id AND e.serie=s.serie
    JOIN rollos r ON r.id=s.rollo_id
    WHERE s.auditoria_id=${header.id} AND e.serie IS NULL
  `);
  const missingCandidates = missingCandidatesResult.rows as Array<{
    rollo_id: number;
    producto_id: number;
    estado: string;
    ubicacion_id: number;
  }>;
  const misplacedCandidatesResult = await tx.execute(sql`
    SELECT s.rollo_id, e.piso_real_id, r.producto_id,
           r.estado::text estado, r.ubicacion_id
    FROM auditoria_inventario_snapshot s
    JOIN auditoria_inventario_escaneos e
      ON e.auditoria_id=s.auditoria_id AND e.serie=s.serie
    JOIN rollos r ON r.id=s.rollo_id
    WHERE s.auditoria_id=${header.id}
      AND s.piso_snapshot_id IS DISTINCT FROM e.piso_real_id
  `);
  const misplacedCandidates = misplacedCandidatesResult.rows as Array<{
    rollo_id: number;
    piso_real_id: number | null;
    producto_id: number;
    estado: string;
    ubicacion_id: number;
  }>;
  const surplusCandidates = await tx
    .select({
      rollo: rollosTable,
      serie: auditoriaInventarioEscaneosTable.serie,
      pisoRealId: auditoriaInventarioEscaneosTable.pisoRealId,
    })
    .from(auditoriaInventarioEscaneosTable)
    .leftJoin(
      auditoriaInventarioSnapshotTable,
      and(
        eq(auditoriaInventarioSnapshotTable.auditoriaId, header.id),
        eq(auditoriaInventarioSnapshotTable.serie, auditoriaInventarioEscaneosTable.serie),
      ),
    )
    .innerJoin(rollosTable, eq(rollosTable.id, auditoriaInventarioEscaneosTable.rolloId))
    .where(
      and(
        eq(auditoriaInventarioEscaneosTable.auditoriaId, header.id),
        sql`${auditoriaInventarioSnapshotTable.serie} IS NULL`,
      ),
    );
  await lockInventoryPairs(
    tx,
    [
      ...missingCandidates.map((item) => ({
        productoId: Number(item.producto_id),
        ubicacionId: Number(item.ubicacion_id),
      })),
      ...misplacedCandidates.map((item) => ({
        productoId: Number(item.producto_id),
        ubicacionId: Number(item.ubicacion_id),
      })),
      ...surplusCandidates.flatMap(({ rollo }) => [
        {
          productoId: rollo.productoId,
          ubicacionId: rollo.ubicacionId,
        },
        {
          productoId: rollo.productoId,
          ubicacionId: header.ubicacionId,
        },
      ]),
    ],
  );
  const expectedMissing = new Map(
    missingCandidates.map((item) => [Number(item.rollo_id), item]),
  );
  const refreshedMissingResult = await tx.execute(sql`
    SELECT s.rollo_id, r.producto_id, r.estado::text, r.ubicacion_id
    FROM auditoria_inventario_snapshot s
    LEFT JOIN auditoria_inventario_escaneos e
      ON e.auditoria_id=s.auditoria_id AND e.serie=s.serie
    JOIN rollos r ON r.id=s.rollo_id
    WHERE s.auditoria_id=${header.id} AND e.serie IS NULL
  `);
  const refreshedMissing = refreshedMissingResult.rows as Array<{
    rollo_id: number;
    producto_id: number;
    estado: string;
    ubicacion_id: number;
  }>;
  const stableMissingIds = refreshedMissing
    .filter((item) => {
      const expected = expectedMissing.get(Number(item.rollo_id));
      return expected != null &&
        Number(expected.producto_id) === Number(item.producto_id) &&
        expected.estado === item.estado &&
        Number(expected.ubicacion_id) === Number(item.ubicacion_id);
    })
    .map((item) => Number(item.rollo_id));
  const stableMissingIdSet = new Set(stableMissingIds);
  const staleMissingIds = new Set([
    ...missingCandidates
      .map((item) => Number(item.rollo_id))
      .filter((id) => !stableMissingIdSet.has(id)),
    ...refreshedMissing
      .map((item) => Number(item.rollo_id))
      .filter((id) => !stableMissingIdSet.has(id)),
  ]);
  const missingResult = stableMissingIds.length
    ? await tx.execute(sql`
        SELECT s.rollo_id, r.producto_id, r.estado::text, r.ubicacion_id
        FROM auditoria_inventario_snapshot s
        LEFT JOIN auditoria_inventario_escaneos e
          ON e.auditoria_id=s.auditoria_id AND e.serie=s.serie
        JOIN rollos r ON r.id=s.rollo_id
        WHERE s.auditoria_id=${header.id} AND e.serie IS NULL
          AND r.id IN (${sql.join(stableMissingIds.map((id) => sql`${id}`), sql`, `)})
        FOR UPDATE OF r
      `)
    : { rows: [] };
  const missing = missingResult.rows as typeof refreshedMissing;
  let missingAdjusted = 0;
  let missingManual = staleMissingIds.size;
  for (const rolloId of staleMissingIds) {
    await tx
      .update(auditoriaInventarioSnapshotTable)
      .set({ resolucion: "RESOLUCION_MANUAL" })
      .where(
        and(
          eq(auditoriaInventarioSnapshotTable.auditoriaId, header.id),
          eq(auditoriaInventarioSnapshotTable.rolloId, rolloId),
        ),
      );
  }
  for (const item of missing) {
    const rolloId = Number(item.rollo_id);
    const expected = expectedMissing.get(rolloId);
    const safeToAdjust =
      expected != null &&
      Number(expected.producto_id) === Number(item.producto_id) &&
      expected.estado === item.estado &&
      Number(expected.ubicacion_id) === Number(item.ubicacion_id) &&
      item.estado === "DISPONIBLE" &&
      Number(item.ubicacion_id) === header.ubicacionId;
    if (!safeToAdjust) {
      missingManual++;
      await tx
        .update(auditoriaInventarioSnapshotTable)
        .set({ resolucion: "RESOLUCION_MANUAL" })
        .where(
          and(
            eq(auditoriaInventarioSnapshotTable.auditoriaId, header.id),
            eq(auditoriaInventarioSnapshotTable.rolloId, rolloId),
          ),
        );
      continue;
    }
    await ajustarRollo(tx, {
      rolloId,
      cantidadNueva: null,
      justificacion: `Faltante confirmado en auditoría ${header.id}`,
      usuarioId: input.usuarioId,
      revisado: true,
      documentoTipo: "AUDITORIA_INVENTARIO",
      documentoId: String(header.id),
      uuidCliente: stableUuid(`auditoria:${header.id}:faltante:${rolloId}`),
    });
    missingAdjusted++;
    await tx
      .update(auditoriaInventarioSnapshotTable)
      .set({ resolucion: "APLICADA" })
      .where(
        and(
          eq(auditoriaInventarioSnapshotTable.auditoriaId, header.id),
          eq(auditoriaInventarioSnapshotTable.rolloId, rolloId),
        ),
      );
    await audit(tx, {
      usuarioId: input.usuarioId,
      accion: "AJUSTE_FALTANTE",
      auditoriaId: header.id,
      sitioId: header.ubicacionId,
      ip: input.ip,
      datos: { rolloId, resolucion: "BAJA" },
    });
  }
  // A misplaced roll was physically found: correcting its floor is deliberately
  // not a stock adjustment and must never create kardex/existence rows.
  const expectedMisplaced = new Map(
    misplacedCandidates.map((item) => [Number(item.rollo_id), item]),
  );
  const refreshedMisplacedResult = await tx.execute(sql`
    SELECT s.rollo_id, e.piso_real_id, r.producto_id,
           r.estado::text estado, r.ubicacion_id
    FROM auditoria_inventario_snapshot s
    JOIN auditoria_inventario_escaneos e ON e.auditoria_id=s.auditoria_id AND e.serie=s.serie
    JOIN rollos r ON r.id=s.rollo_id
    WHERE s.auditoria_id=${header.id}
      AND s.piso_snapshot_id IS DISTINCT FROM e.piso_real_id
  `);
  const refreshedMisplaced = refreshedMisplacedResult.rows as typeof misplacedCandidates;
  const stableMisplacedIds = refreshedMisplaced
    .filter((item) => {
      const expected = expectedMisplaced.get(Number(item.rollo_id));
      return expected != null &&
        Number(expected.producto_id) === Number(item.producto_id) &&
        expected.estado === item.estado &&
        Number(expected.ubicacion_id) === Number(item.ubicacion_id);
    })
    .map((item) => Number(item.rollo_id));
  const stableMisplacedIdSet = new Set(stableMisplacedIds);
  const staleMisplacedIds = new Set([
    ...misplacedCandidates
      .map((item) => Number(item.rollo_id))
      .filter((id) => !stableMisplacedIdSet.has(id)),
    ...refreshedMisplaced
      .map((item) => Number(item.rollo_id))
      .filter((id) => !stableMisplacedIdSet.has(id)),
  ]);
  const misplacedResult = stableMisplacedIds.length
    ? await tx.execute(sql`
        SELECT s.rollo_id, e.piso_real_id, r.producto_id,
               r.estado::text estado, r.ubicacion_id
        FROM auditoria_inventario_snapshot s
        JOIN auditoria_inventario_escaneos e
          ON e.auditoria_id=s.auditoria_id AND e.serie=s.serie
        JOIN rollos r ON r.id=s.rollo_id
        WHERE s.auditoria_id=${header.id}
          AND s.piso_snapshot_id IS DISTINCT FROM e.piso_real_id
          AND r.id IN (${sql.join(stableMisplacedIds.map((id) => sql`${id}`), sql`, `)})
        FOR UPDATE OF r
      `)
    : { rows: [] };
  let misplacedApplied = 0;
  let misplacedManual = staleMisplacedIds.size;
  for (const rolloId of staleMisplacedIds) {
    await tx.update(auditoriaInventarioSnapshotTable)
      .set({ resolucion: "RESOLUCION_MANUAL" })
      .where(and(
        eq(auditoriaInventarioSnapshotTable.auditoriaId, header.id),
        eq(auditoriaInventarioSnapshotTable.rolloId, rolloId),
      ));
  }
  for (const item of misplacedResult.rows as typeof misplacedCandidates) {
    const rolloId = Number(item.rollo_id);
    const safe = item.estado === "DISPONIBLE" && Number(item.ubicacion_id) === header.ubicacionId;
    const resolution = safe ? "APLICADA" : "RESOLUCION_MANUAL";
    if (safe) {
      await tx.update(rollosTable).set({ pisoId: item.piso_real_id ?? null }).where(eq(rollosTable.id, rolloId));
      misplacedApplied++;
      await audit(tx, { usuarioId: input.usuarioId, accion: "CAMBIAR_PISO", auditoriaId: header.id, sitioId: header.ubicacionId, ip: input.ip, datos: { rolloId, pisoId: item.piso_real_id, origen: "AUDITORIA" } });
    } else misplacedManual++;
    await tx.update(auditoriaInventarioSnapshotTable).set({ resolucion: resolution })
      .where(and(eq(auditoriaInventarioSnapshotTable.auditoriaId, header.id), eq(auditoriaInventarioSnapshotTable.rolloId, rolloId)));
  }
  const expectedSurplus = new Map(
    surplusCandidates.map(({ rollo }) => [rollo.id, rollo]),
  );
  const refreshedSurplus = await tx
    .select({
      rollo: rollosTable,
      serie: auditoriaInventarioEscaneosTable.serie,
      pisoRealId: auditoriaInventarioEscaneosTable.pisoRealId,
    })
    .from(auditoriaInventarioEscaneosTable)
    .leftJoin(
      auditoriaInventarioSnapshotTable,
      and(
        eq(auditoriaInventarioSnapshotTable.auditoriaId, header.id),
        eq(auditoriaInventarioSnapshotTable.serie, auditoriaInventarioEscaneosTable.serie),
      ),
    )
    .innerJoin(rollosTable, eq(rollosTable.id, auditoriaInventarioEscaneosTable.rolloId))
    .where(
      and(
        eq(auditoriaInventarioEscaneosTable.auditoriaId, header.id),
        sql`${auditoriaInventarioSnapshotTable.serie} IS NULL`,
      ),
    );
  const stableSurplusIds = refreshedSurplus
    .filter(({ rollo }) => {
      const expected = expectedSurplus.get(rollo.id);
      return expected != null &&
        expected.productoId === rollo.productoId &&
        expected.ubicacionId === rollo.ubicacionId &&
        expected.estado === rollo.estado;
    })
    .map(({ rollo }) => rollo.id);
  const stableSurplusIdSet = new Set(stableSurplusIds);
  const staleSurplusIds = new Set([
    ...surplusCandidates
      .map(({ rollo }) => rollo.id)
      .filter((id) => !stableSurplusIdSet.has(id)),
    ...refreshedSurplus
      .map(({ rollo }) => rollo.id)
      .filter((id) => !stableSurplusIdSet.has(id)),
  ]);
  const surplus = stableSurplusIds.length
    ? await tx
    .select({
      rollo: rollosTable,
      serie: auditoriaInventarioEscaneosTable.serie,
      pisoRealId: auditoriaInventarioEscaneosTable.pisoRealId,
    })
    .from(auditoriaInventarioEscaneosTable)
    .leftJoin(
      auditoriaInventarioSnapshotTable,
      and(
        eq(auditoriaInventarioSnapshotTable.auditoriaId, header.id),
        eq(auditoriaInventarioSnapshotTable.serie, auditoriaInventarioEscaneosTable.serie),
      ),
    )
    .innerJoin(rollosTable, eq(rollosTable.id, auditoriaInventarioEscaneosTable.rolloId))
    .where(
      and(
        eq(auditoriaInventarioEscaneosTable.auditoriaId, header.id),
        sql`${auditoriaInventarioSnapshotTable.serie} IS NULL`,
        inArray(rollosTable.id, stableSurplusIds),
      ),
    )
    .orderBy(rollosTable.id)
    .for("update", { of: rollosTable })
    : [];
  let relocated = 0;
  let manual = staleSurplusIds.size;
  for (const rolloId of staleSurplusIds) {
    await tx
      .update(auditoriaInventarioEscaneosTable)
      .set({ resolucion: "RESOLUCION_MANUAL" })
      .where(
        and(
          eq(auditoriaInventarioEscaneosTable.auditoriaId, header.id),
          eq(auditoriaInventarioEscaneosTable.rolloId, rolloId),
        ),
      );
  }
  for (const { rollo, serie, pisoRealId } of surplus) {
    let resolucion = "RESOLUCION_MANUAL";
    const expected = expectedSurplus.get(rollo.id);
    const unchanged =
      expected != null &&
      expected.productoId === rollo.productoId &&
      expected.ubicacionId === rollo.ubicacionId &&
      expected.estado === rollo.estado;
    if (!unchanged || rollo.ubicacionId === header.ubicacionId) {
      manual++;
    } else if (rollo.estado === "DISPONIBLE") {
      await transferirRolloInmediato(tx, {
        rolloId: rollo.id,
        ubicacionOrigenId: rollo.ubicacionId,
        ubicacionDestinoId: header.ubicacionId,
        usuarioId: input.usuarioId,
        justificacion: `Sobrante confirmado en auditoría ${header.id}`,
        documentoTipo: "AUDITORIA_INVENTARIO",
        documentoId: String(header.id),
        uuidCliente: stableUuid(`auditoria:${header.id}:sobrante:${rollo.id}`),
        pisoDestinoId: pisoRealId,
      });
      relocated++;
      resolucion = "APLICADA";
      await audit(tx, {
        usuarioId: input.usuarioId,
        accion: "AJUSTE_SOBRANTE",
        auditoriaId: header.id,
        sitioId: header.ubicacionId,
        ip: input.ip,
        datos: { rolloId: rollo.id, origenId: rollo.ubicacionId, resolucion: "REUBICADO" },
      });
    } else if (rollo.estado === "EN_TRANSITO") {
      await recibirTransferencia(tx, {
        rolloId: rollo.id,
        ubicacionDestinoId: header.ubicacionId,
        usuarioId: input.usuarioId,
        justificacion: `Sobrante confirmado en auditoría ${header.id}`,
        documentoTipo: "AUDITORIA_INVENTARIO",
        documentoId: String(header.id),
        uuidCliente: null,
        pisoDestinoId: pisoRealId,
      });
      relocated++;
      resolucion = "APLICADA";
      await audit(tx, {
        usuarioId: input.usuarioId,
        accion: "AJUSTE_SOBRANTE",
        auditoriaId: header.id,
        sitioId: header.ubicacionId,
        ip: input.ip,
        datos: { rolloId: rollo.id, origenId: rollo.ubicacionId, resolucion: "REUBICADO_DESDE_TRANSITO" },
      });
    } else {
      manual++;
    }
    await tx
      .update(auditoriaInventarioEscaneosTable)
      .set({ resolucion })
      .where(
        and(
          eq(auditoriaInventarioEscaneosTable.auditoriaId, header.id),
          eq(auditoriaInventarioEscaneosTable.serie, serie),
        ),
      );
  }
  const [unregistered] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(auditoriaInventarioEscaneosTable)
    .where(
      and(
        eq(auditoriaInventarioEscaneosTable.auditoriaId, header.id),
        sql`${auditoriaInventarioEscaneosTable.rolloId} IS NULL`,
      ),
    );
  manual += unregistered?.count ?? 0;
  await tx
    .update(auditoriaInventarioEscaneosTable)
    .set({ resolucion: "RESOLUCION_MANUAL" })
    .where(
      and(
        eq(auditoriaInventarioEscaneosTable.auditoriaId, header.id),
        sql`${auditoriaInventarioEscaneosTable.rolloId} IS NULL`,
      ),
    );
  await tx
    .update(auditoriasInventarioTable)
    .set({ estado: "CONFIRMADA", confirmadaPorId: input.usuarioId, confirmadaAt: new Date() })
    .where(eq(auditoriasInventarioTable.id, header.id));
  await audit(tx, {
    usuarioId: input.usuarioId,
    accion: "CONFIRMAR",
    auditoriaId: header.id,
    sitioId: header.ubicacionId,
    ip: input.ip,
    datos: {
      faltantesBaja: missingAdjusted,
      sobrantesReubicados: relocated,
      resolucionManual: manual + missingManual,
      malAcomodadosAplicados: misplacedApplied,
      malAcomodadosManual: misplacedManual,
    },
  });
}

export async function buildAuditoriaDetail(tx: Tx, id: number) {
  const [header] = await tx
    .select({
      id: auditoriasInventarioTable.id,
      folio: auditoriasInventarioTable.folio,
      ubicacionId: auditoriasInventarioTable.ubicacionId,
      nombreUbicacion: ubicacionesTable.nombre,
      iniciales: ubicacionesTable.iniciales,
      estado: auditoriasInventarioTable.estado,
      abiertaAt: auditoriasInventarioTable.abiertaAt,
      cerradaAt: auditoriasInventarioTable.cerradaAt,
      confirmadaAt: auditoriasInventarioTable.confirmadaAt,
      motivoCancelacion: auditoriasInventarioTable.motivoCancelacion,
      creadaPor: usuariosTable.nombre,
    })
    .from(auditoriasInventarioTable)
    .innerJoin(ubicacionesTable, eq(ubicacionesTable.id, auditoriasInventarioTable.ubicacionId))
    .innerJoin(usuariosTable, eq(usuariosTable.id, auditoriasInventarioTable.creadaPorId))
    .where(eq(auditoriasInventarioTable.id, id))
    .limit(1);
  if (!header) throw new AuditoriaInventarioError("Auditoría no encontrada.", "NOT_FOUND");

  const usarVivoParaSobrantes = header.estado === "ABIERTA";
  const result = await tx.execute(sql`
    SELECT COALESCE(s.serie, e.serie) serie,
      CASE WHEN s.serie IS NOT NULL AND e.serie IS NOT NULL
                  AND s.piso_snapshot_id IS DISTINCT FROM e.piso_real_id THEN 'MAL_ACOMODADO'
           WHEN s.serie IS NOT NULL AND e.serie IS NOT NULL THEN 'CUADRO'
           WHEN s.serie IS NOT NULL THEN 'FALTANTE' ELSE 'SOBRANTE' END clasificacion,
       COALESCE(s.rollo_id, e.rollo_id) rollo_id,
       CASE WHEN s.serie IS NOT NULL THEN s.sku_snapshot
            WHEN ${usarVivoParaSobrantes} THEN p.sku ELSE e.sku_cierre END sku,
       CASE WHEN s.serie IS NOT NULL THEN s.tela_snapshot
            WHEN ${usarVivoParaSobrantes} THEN p.tela ELSE e.tela_cierre END tela,
       CASE WHEN s.serie IS NOT NULL THEN s.color_snapshot
            WHEN ${usarVivoParaSobrantes} THEN p.color ELSE e.color_cierre END color,
      CASE WHEN s.serie IS NOT NULL THEN s.cantidad_snapshot
            WHEN ${usarVivoParaSobrantes} THEN r.cantidad_actual ELSE e.cantidad_cierre END cantidad,
       CASE WHEN s.serie IS NOT NULL THEN s.unidad_snapshot
            WHEN ${usarVivoParaSobrantes} THEN p.unidad::text ELSE e.unidad_cierre END unidad,
       CASE WHEN s.serie IS NOT NULL THEN s.ubicacion_snapshot_id
            WHEN ${usarVivoParaSobrantes} THEN r.ubicacion_id ELSE e.ubicacion_cierre_id END ubicacion_actual_id,
       CASE WHEN s.serie IS NOT NULL THEN s.ubicacion_snapshot
            WHEN ${usarVivoParaSobrantes} THEN u.nombre ELSE e.ubicacion_cierre END ubicacion_actual,
       CASE WHEN s.serie IS NOT NULL THEN s.estado_snapshot
            WHEN ${usarVivoParaSobrantes} THEN COALESCE(r.estado::text, 'SIN_REGISTRO')
            ELSE e.estado_cierre END estado_actual,
       e.escaneado_at, e.resolucion resolucion_escaneo,
        s.resolucion resolucion_snapshot,
        s.piso_snapshot_id, s.piso_snapshot, e.piso_real_id, e.piso_real
    FROM auditoria_inventario_snapshot s
    FULL OUTER JOIN auditoria_inventario_escaneos e
      ON e.auditoria_id = s.auditoria_id AND e.serie = s.serie
    LEFT JOIN rollos r ON r.id = COALESCE(s.rollo_id, e.rollo_id)
    LEFT JOIN productos p ON p.id = r.producto_id
    LEFT JOIN ubicaciones u ON u.id = r.ubicacion_id
    WHERE COALESCE(s.auditoria_id, e.auditoria_id) = ${id}
    ORDER BY clasificacion, serie
  `);
  const resultados = (result.rows as Array<Record<string, unknown>>).map((row) => {
    const clasificacion = String(row.clasificacion);
    const resolucion =
      clasificacion === "FALTANTE"
        ? String(row.resolucion_snapshot ?? "PENDIENTE")
        : clasificacion === "SOBRANTE"
          ? String(row.resolucion_escaneo ?? "PENDIENTE")
          : "PENDIENTE";
    return {
      serie: String(row.serie),
      clasificacion,
      rolloId: row.rollo_id == null ? null : Number(row.rollo_id),
      producto: row.sku == null ? null : `${row.sku} · ${row.tela} · ${row.color}`,
      cantidad: row.cantidad == null ? null : String(row.cantidad),
      unidad: row.unidad == null ? null : String(row.unidad),
      ubicacionActualId: row.ubicacion_actual_id == null ? null : Number(row.ubicacion_actual_id),
      ubicacionActual: row.ubicacion_actual == null ? null : String(row.ubicacion_actual),
       pisoEsperadoId: row.piso_snapshot_id == null ? null : Number(row.piso_snapshot_id),
       pisoEsperado: row.piso_snapshot == null ? null : String(row.piso_snapshot),
       pisoRealId: row.piso_real_id == null ? null : Number(row.piso_real_id),
       pisoReal: row.piso_real == null ? null : String(row.piso_real),
      estadoActual: String(row.estado_actual),
      resolucion,
      escaneadoAt: row.escaneado_at == null ? null : new Date(String(row.escaneado_at)).toISOString(),
    };
  });
  const participantsResult = await tx.execute(sql`
    SELECT ap.usuario_id, u.nombre, ap.escaneos,
      ap.primero_at, ap.ultimo_at
    FROM auditoria_inventario_participantes ap
    JOIN usuarios u ON u.id=ap.usuario_id
    WHERE ap.auditoria_id=${id} ORDER BY u.nombre
  `);
  const participantes = (participantsResult.rows as Array<Record<string, unknown>>).map((row) => ({
    usuarioId: Number(row.usuario_id),
    nombre: String(row.nombre),
    escaneos: Number(row.escaneos),
    primeroAt: new Date(String(row.primero_at)).toISOString(),
    ultimoAt: new Date(String(row.ultimo_at)).toISOString(),
  }));
  const count = (kind: string) => resultados.filter((r) => r.clasificacion === kind).length;
  const totalSnapshot = count("CUADRO") + count("FALTANTE") + count("MAL_ACOMODADO");
  const totalEscaneados = count("CUADRO") + count("SOBRANTE") + count("MAL_ACOMODADO");
  return {
    id: header.id,
    folio: header.folio,
    folioFormateado: `${header.iniciales}-AI-${String(header.folio).padStart(6, "0")}`,
    ubicacionId: header.ubicacionId,
    nombreUbicacion: header.nombreUbicacion,
    estado: header.estado,
    totalSnapshot,
    totalEscaneados,
    cuadros: count("CUADRO"),
    faltantes: count("FALTANTE"),
    sobrantes: count("SOBRANTE"),
    malAcomodados: count("MAL_ACOMODADO"),
    abiertaAt: header.abiertaAt.toISOString(),
    creadaPor: header.creadaPor,
    motivoCancelacion: header.motivoCancelacion,
    cerradaAt: header.cerradaAt?.toISOString() ?? null,
    confirmadaAt: header.confirmadaAt?.toISOString() ?? null,
    resultados,
    participantes,
  };
}