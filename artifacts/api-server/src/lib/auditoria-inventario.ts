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
  rollosTable,
  ubicacionesTable,
  usuariosTable,
} from "@workspace/db";
import {
  ajustarRollo,
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
  await tx.execute(sql`SELECT pg_advisory_xact_lock(570000 + ${input.ubicacionId})`);
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
      estadoSnapshot: rollosTable.estado,
    })
    .from(rollosTable)
    .innerJoin(productosTable, eq(productosTable.id, rollosTable.productoId))
    .innerJoin(ubicacionesTable, eq(ubicacionesTable.id, rollosTable.ubicacionId))
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
  input: { auditoriaId: number; serie: string; usuarioId: number; ip: string },
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
      datos: { serie, clasificacion: snapshot ? "CUADRO" : "SOBRANTE" },
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
  const missingResult = await tx.execute(sql`
    SELECT s.rollo_id, r.estado::text, r.ubicacion_id
    FROM auditoria_inventario_snapshot s
    LEFT JOIN auditoria_inventario_escaneos e
      ON e.auditoria_id=s.auditoria_id AND e.serie=s.serie
    JOIN rollos r ON r.id=s.rollo_id
    WHERE s.auditoria_id=${header.id} AND e.serie IS NULL
    FOR UPDATE OF r
  `);
  const missing = missingResult.rows as Array<{
    rollo_id: number;
    estado: string;
    ubicacion_id: number;
  }>;
  let missingAdjusted = 0;
  let missingManual = 0;
  for (const item of missing) {
    const rolloId = Number(item.rollo_id);
    const safeToAdjust =
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
  const surplus = await tx
    .select({ rollo: rollosTable, serie: auditoriaInventarioEscaneosTable.serie })
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
    )
    .for("update", { of: rollosTable });
  let relocated = 0;
  let manual = 0;
  for (const { rollo, serie } of surplus) {
    let resolucion = "RESOLUCION_MANUAL";
    if (rollo.ubicacionId === header.ubicacionId) {
      if (rollo.estado === "DISPONIBLE") resolucion = "APLICADA";
      else manual++;
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
      CASE WHEN s.serie IS NOT NULL AND e.serie IS NOT NULL THEN 'CUADRO'
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
       s.resolucion resolucion_snapshot
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
  const totalSnapshot = count("CUADRO") + count("FALTANTE");
  const totalEscaneados = count("CUADRO") + count("SOBRANTE");
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
    abiertaAt: header.abiertaAt.toISOString(),
    creadaPor: header.creadaPor,
    motivoCancelacion: header.motivoCancelacion,
    cerradaAt: header.cerradaAt?.toISOString() ?? null,
    confirmadaAt: header.confirmadaAt?.toISOString() ?? null,
    resultados,
    participantes,
  };
}