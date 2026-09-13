import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import ExcelJS from "exceljs";
import { sql } from "drizzle-orm";
import { ZodError, z } from "zod/v4";
import { db } from "@workspace/db";
import { interpretarCodigoEscaneado } from "@workspace/scanned-code";
import { requireSession } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { normalizeUsername } from "../lib/auth-identifiers";
import { getRequestIp } from "../lib/request";

const router = Router();
const id = z.coerce.number().int().positive();
const optionalId = z.coerce.number().int().positive().optional();
const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

const searchQuery = z.object({
  q: z.string().trim().max(150).optional(),
  sitioId: optionalId,
  estado: z.enum(["PROGRAMADO", "DISPONIBLE", "EN_TRANSITO", "MOSTRADOR", "VENDIDO", "BAJA"]).optional(),
  productoId: optionalId,
  fechaDesde: dateText,
  fechaHasta: dateText,
  folio: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(50),
  /**
   * The normal search remains backwards compatible.  The labels page opts
   * into this predicate for its default pending-control view.
   */
  pendientesRevision: z.enum(["true", "false"]).transform((value) => value === "true").default(false),
});

const historyQuery = z.object({
  fechaDesde: dateText,
  fechaHasta: dateText,
  sitioId: optionalId,
  usuarioId: optionalId,
  productoId: optionalId,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

const reprintBody = z.object({
  rolloIds: z.array(z.number().int().positive()).min(1).max(50)
    .refine((values) => new Set(values).size === values.length, "No se permiten rollos duplicados."),
  motivo: z.string().trim().min(10).max(1000),
  adminUsuario: z.string().trim().min(1).optional(),
  adminPassword: z.string().min(1).optional(),
}).strict();

const reviewBody = z.object({
  /** Exact immutable reprint row covered by this review. */
  ultimaReimpresionId: z.number().int().positive(),
}).strict();

type DbRow = Record<string, unknown>;

function scopedSite(auth: NonNullable<Express.Request["auth"]>, requested?: number) {
  if (
    auth.user.rol === "ADMIN" ||
    auth.user.rol === "SUPERVISOR" ||
    auth.user.alcanceConsulta === "TODAS"
  ) return requested;
  if (auth.user.ubicacionId == null) throw new Error("SCOPE_WITHOUT_SITE");
  return auth.user.ubicacionId;
}

function dateConditions(q: { fechaDesde?: string; fechaHasta?: string }, column: ReturnType<typeof sql.raw>) {
  const conditions = [];
  if (q.fechaDesde) conditions.push(sql`${column} >= ${`${q.fechaDesde}T00:00:00-06:00`}::timestamptz`);
  if (q.fechaHasta) conditions.push(sql`${column} < (${`${q.fechaHasta}T00:00:00-06:00`}::timestamptz + interval '1 day')`);
  return conditions;
}

/**
 * One predicate is shared by the page list and the navigation badge.  A rollo
 * stays pending once it has reached three reprints until an ADMIN review
 * covers the exact latest reprint row.  A later reprint gets a new watermark
 * and therefore makes the same rollo pending again.
 */
function pendingReviewPredicate() {
  const latestReprint = sql`
    (
      SELECT latest.id
      FROM reimpresiones_etiqueta latest
      WHERE latest.rollo_id = r.id
      ORDER BY latest.id DESC
      LIMIT 1
    )
  `;
  return sql`(
    (
      SELECT COUNT(*)
      FROM reimpresiones_etiqueta pending_count
      WHERE pending_count.rollo_id = r.id
    ) >= 3
    AND NOT EXISTS (
      SELECT 1
      FROM revisiones_etiqueta pending_review
      WHERE pending_review.rollo_id = r.id
        AND pending_review.reimpresion_id = ${latestReprint}
    )
  )`;
}

type ReviewHistoryItem = {
  id: number;
  rolloId: number;
  reimpresionId: number;
  revisadoPorId: number;
  revisadoPor: string;
  revisadoPorUsuario: string;
  revisadoEn: string;
};

function parseReviewHistory(value: unknown): ReviewHistoryItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      id: Number(row.id),
      rolloId: Number(row.rolloId ?? row.rollo_id),
      reimpresionId: Number(row.reimpresionId ?? row.reimpresion_id),
      revisadoPorId: Number(row.revisadoPorId ?? row.revisado_por_id),
      revisadoPor: String(row.revisadoPor ?? row.revisor_nombre_snapshot),
      revisadoPorUsuario: String(
        row.revisadoPorUsuario ?? row.revisor_usuario_snapshot,
      ),
      revisadoEn: new Date(
        String(row.revisadoEn ?? row.created_at),
      ).toISOString(),
    };
  });
}

function reviewHistoryJsonSql() {
  return sql`COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', revision.id,
          'rolloId', revision.rollo_id,
          'reimpresionId', revision.reimpresion_id,
          'revisadoPorId', revision.usuario_id,
          'revisadoPor', revision.revisor_nombre_snapshot,
          'revisadoPorUsuario', revision.revisor_usuario_snapshot,
          'revisadoEn', revision.created_at
        )
        ORDER BY revision.created_at DESC, revision.id DESC
      )
      FROM revisiones_etiqueta revision
      WHERE revision.rollo_id = r.id
    ),
    '[]'::json
  )`;
}

function label(row: DbRow, reprintDate: Date) {
  const tela = String(row.tela);
  const color = String(row.color);
  return {
    rolloId: Number(row.id),
    productoId: Number(row.producto_id),
    producto: `${tela} ${color}`,
    tela,
    color,
    sku: String(row.sku),
    serie: String(row.serie),
    cantidad: String(row.cantidad_actual),
    unidad: String(row.unidad),
    qr: `${String(row.sku)}-${String(row.serie)}`,
    marca: "REIMPRESA" as const,
    fechaReimpresion: reprintDate.toISOString(),
    formatoMm: { ancho: 100, alto: 60 },
  };
}

router.get(
  "/etiquetas/rollos",
  requireSession,
  requierePermiso("etiquetas", "ver"),
  async (req, res, next) => {
    try {
      const q = searchQuery.parse(req.query);
      const site = scopedSite(req.auth!, q.sitioId);
      const conditions = [];
      if (site) conditions.push(sql`r.ubicacion_id = ${site}`);
      if (q.estado) conditions.push(sql`r.estado = ${q.estado}::estado_rollo`);
      if (q.productoId) conditions.push(sql`r.producto_id = ${q.productoId}`);
      if (q.folio) conditions.push(sql`e.folio = ${q.folio}`);
      conditions.push(...dateConditions(q, sql.raw("r.created_at")));
      if (q.pendientesRevision) conditions.push(pendingReviewPredicate());
      if (q.q) {
        const term = q.q.trim();
        const codigo = interpretarCodigoEscaneado(term);
        conditions.push(
          codigo.serie
            ? sql`r.serie = ${codigo.serie}`
            : sql`(
                r.serie ILIKE ${`%${term}%`} OR p.sku ILIKE ${`%${term}%`} OR
                p.tela ILIKE ${`%${term}%`} OR p.color ILIKE ${`%${term}%`} OR
                (p.sku || '-' || r.serie) ILIKE ${term}
              )`,
        );
      }
      const where = conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
      const result = await db.execute(sql`
        SELECT r.id, r.serie, r.producto_id, p.sku, p.tela, p.color, p.unidad, r.created_at,
          r.cantidad_actual, r.ubicacion_id AS sitio_id, u.nombre AS sitio,
          r.estado, r.created_at, e.id AS entrada_id, e.folio,
           COUNT(re.id)::int AS reimpresiones_count,
           (ARRAY_AGG(re.id ORDER BY re.id DESC))[1] AS ultima_reimpresion_id,
           MAX(re.created_at) AS ultima_reimpresion,
           ${reviewHistoryJsonSql()} AS revisiones,
           ${pendingReviewPredicate()} AS revision_pendiente,
          COUNT(*) OVER()::int AS total
        FROM rollos r
        JOIN productos p ON p.id = r.producto_id
        JOIN ubicaciones u ON u.id = r.ubicacion_id
        LEFT JOIN entradas e ON e.id = r.recepcion_id
        LEFT JOIN reimpresiones_etiqueta re ON re.rollo_id = r.id
        ${where}
        GROUP BY r.id, p.id, u.id, e.id
        ORDER BY r.created_at DESC, r.id DESC
           -- LIMIT 50 is the backwards-compatible default; callers may page
           LIMIT ${q.pageSize}
           OFFSET ${(q.page - 1) * q.pageSize}
      `);
      res.json({
        items: (result.rows as DbRow[]).map((row) => ({
          id: Number(row.id), serie: row.serie, productoId: Number(row.producto_id),
          producto: `${row.tela} ${row.color}`, tela: row.tela, color: row.color,
          sku: row.sku, cantidad: row.cantidad_actual, unidad: row.unidad,
          sitioId: Number(row.sitio_id), sitio: row.sitio, estado: row.estado,
          entradaId: row.entrada_id == null ? null : Number(row.entrada_id),
          folioEntrada: row.folio == null ? null : Number(row.folio),
          createdAt: new Date(String(row.created_at)).toISOString(),
          reimpresionesCount: Number(row.reimpresiones_count),
           ultimaReimpresionId: row.ultima_reimpresion_id == null
             ? null
             : Number(row.ultima_reimpresion_id),
          ultimaReimpresion: row.ultima_reimpresion == null ? null : new Date(String(row.ultima_reimpresion)).toISOString(),
          alertaReimpresiones: Number(row.reimpresiones_count) >= 3,
           revisionPendiente: row.revision_pendiente === true ||
             row.revision_pendiente === "t" ||
             row.revision_pendiente === 1,
           revisiones: parseReviewHistory(row.revisiones),
        })),
        limit: q.pageSize,
        page: q.page,
        pageSize: q.pageSize,
        total: Number((result.rows[0] as DbRow | undefined)?.total ?? 0),
      });
    } catch (error) {
      if (error instanceof Error && error.message === "SCOPE_WITHOUT_SITE") {
        res.status(403).json({ error: "No tienes un sitio asignado." }); return;
      }
      next(error);
    }
  },
);

router.get(
  "/etiquetas/rollos/:id",
  requireSession,
  requierePermiso("etiquetas", "ver"),
  async (req, res, next) => {
    try {
      const rolloId = id.parse(req.params.id);
      const site = scopedSite(req.auth!);
      const result = await db.execute(sql`
        SELECT r.id, r.serie, r.producto_id, p.sku, p.tela, p.color, p.unidad,
          r.cantidad_actual, r.created_at, r.ubicacion_id AS sitio_id, u.nombre AS sitio, r.estado,
           COUNT(re.id)::int AS reimpresiones_count,
           (ARRAY_AGG(re.id ORDER BY re.id DESC))[1] AS ultima_reimpresion_id,
           MAX(re.created_at) AS ultima_reimpresion,
           ${reviewHistoryJsonSql()} AS revisiones,
           ${pendingReviewPredicate()} AS revision_pendiente
        FROM rollos r JOIN productos p ON p.id=r.producto_id
        JOIN ubicaciones u ON u.id=r.ubicacion_id
        LEFT JOIN reimpresiones_etiqueta re ON re.rollo_id=r.id
        WHERE r.id=${rolloId} ${site ? sql`AND r.ubicacion_id=${site}` : sql``}
        GROUP BY r.id,p.id,u.id
      `);
      const row = result.rows[0] as DbRow | undefined;
      if (!row) { res.status(404).json({ error: "Rollo no encontrado." }); return; }
      res.json({
        id: Number(row.id),
        serie: String(row.serie),
        productoId: Number(row.producto_id),
        producto: `${String(row.tela)} ${String(row.color)}`,
        tela: String(row.tela),
        color: String(row.color),
        sku: String(row.sku),
        cantidad: String(row.cantidad_actual),
        unidad: String(row.unidad),
        sitioId: Number(row.sitio_id), sitio: row.sitio, estado: row.estado,
        createdAt: new Date(String(row.created_at)).toISOString(),
        reimpresionesCount: Number(row.reimpresiones_count),
         ultimaReimpresionId: row.ultima_reimpresion_id == null
           ? null
           : Number(row.ultima_reimpresion_id),
        ultimaReimpresion: row.ultima_reimpresion == null ? null : new Date(String(row.ultima_reimpresion)).toISOString(),
        alertaReimpresiones: Number(row.reimpresiones_count) >= 3,
         revisionPendiente: row.revision_pendiente === true ||
           row.revision_pendiente === "t" ||
           row.revision_pendiente === 1,
         revisiones: parseReviewHistory(row.revisiones),
      });
    } catch (error) { next(error); }
  },
);

/**
 * Review one pending roll.  The row lock deliberately conflicts with the
 * reprint endpoint's FOR SHARE lock.  Whichever transaction wins establishes
 * a stable watermark; the losing request re-reads the latest reprint and
 * returns 409 instead of acknowledging a stale screen.
 */
router.post(
  "/etiquetas/rollos/:id/revisar",
  requireSession,
  requierePermiso("etiquetas", "editar"),
  async (req, res, next) => {
    try {
      const rolloId = id.parse(req.params.id);
      const body = reviewBody.parse(req.body);
      const auth = req.auth!;
      if (auth.user.rol !== "ADMIN") {
        res.status(403).json({ error: "Marcar etiquetas como revisadas requiere rol ADMIN." });
        return;
      }
      const site = scopedSite(auth);
      const result = await db.transaction(async (tx) => {
        const selected = await tx.execute(sql`
          SELECT r.id, r.serie, r.ubicacion_id
          FROM rollos r
          WHERE r.id=${rolloId}
            ${site ? sql`AND r.ubicacion_id=${site}` : sql``}
          FOR UPDATE OF r
        `);
        const row = selected.rows[0] as DbRow | undefined;
        if (!row) throw new Error("ROLLO_NOT_FOUND");

        // This is intentionally a second statement.  A SELECT ... FOR UPDATE
        // can wait for a concurrent reprint's FOR SHARE lock; its original
        // statement snapshot would otherwise be too old to see that insert.
        const watermark = await tx.execute(sql`
          SELECT
            (
              SELECT latest.id
              FROM reimpresiones_etiqueta latest
              WHERE latest.rollo_id=${rolloId}
              ORDER BY latest.id DESC
              LIMIT 1
            ) AS ultima_reimpresion_id,
            (
              SELECT COUNT(*)::int
              FROM reimpresiones_etiqueta count_reprints
              WHERE count_reprints.rollo_id=${rolloId}
            ) AS reimpresiones_count
        `);
        const watermarkRow = watermark.rows[0] as DbRow | undefined;
        const latestReprintId = watermarkRow?.ultima_reimpresion_id == null
          ? null
          : Number(watermarkRow.ultima_reimpresion_id);
        if (
          latestReprintId == null ||
          latestReprintId !== body.ultimaReimpresionId
        ) {
          throw new Error("REPRINT_WATERMARK_MISMATCH");
        }
        if (Number(watermarkRow?.reimpresiones_count ?? 0) < 3) {
          throw new Error("REVIEW_NOT_PENDING");
        }

        const existing = await tx.execute(sql`
          SELECT id, rollo_id, reimpresion_id, usuario_id,
            revisor_nombre_snapshot, revisor_usuario_snapshot, created_at
          FROM revisiones_etiqueta
          WHERE rollo_id=${rolloId}
            AND reimpresion_id=${body.ultimaReimpresionId}
          ORDER BY id DESC
          LIMIT 1
        `);
        const existingRow = existing.rows[0] as DbRow | undefined;
        if (existingRow) {
          return {
            status: 200 as const,
            review: {
              id: Number(existingRow.id),
              rolloId: Number(existingRow.rollo_id),
              reimpresionId: Number(existingRow.reimpresion_id),
              revisadoPorId: Number(existingRow.usuario_id),
              revisadoPor: String(existingRow.revisor_nombre_snapshot),
              revisadoPorUsuario: String(existingRow.revisor_usuario_snapshot),
              revisadoEn: new Date(String(existingRow.created_at)).toISOString(),
              idempotente: true,
            },
          };
        }

        const now = new Date();
        const inserted = await tx.execute(sql`
          INSERT INTO revisiones_etiqueta
            (rollo_id, reimpresion_id, usuario_id,
             revisor_nombre_snapshot, revisor_usuario_snapshot, created_at)
          VALUES (
            ${rolloId}, ${body.ultimaReimpresionId}, ${auth.user.id},
            ${auth.user.nombre}, ${auth.user.usuario}, ${now}
          )
          ON CONFLICT (rollo_id, reimpresion_id) DO NOTHING
          RETURNING id, rollo_id, reimpresion_id, usuario_id,
            revisor_nombre_snapshot, revisor_usuario_snapshot, created_at
        `);
        const insertedRow = inserted.rows[0] as DbRow | undefined;
        if (!insertedRow) {
          // This is only reachable if another transaction inserted the same
          // watermark between the read and insert.  Return its durable event,
          // never fabricate a new actor/date.
          const retry = await tx.execute(sql`
            SELECT id, rollo_id, reimpresion_id, usuario_id,
              revisor_nombre_snapshot, revisor_usuario_snapshot, created_at
            FROM revisiones_etiqueta
            WHERE rollo_id=${rolloId}
              AND reimpresion_id=${body.ultimaReimpresionId}
            ORDER BY id DESC
            LIMIT 1
          `);
          const retryRow = retry.rows[0] as DbRow | undefined;
          if (!retryRow) throw new Error("REVIEW_INSERT_FAILED");
          return {
            status: 200 as const,
            review: {
              id: Number(retryRow.id),
              rolloId: Number(retryRow.rollo_id),
              reimpresionId: Number(retryRow.reimpresion_id),
              revisadoPorId: Number(retryRow.usuario_id),
              revisadoPor: String(retryRow.revisor_nombre_snapshot),
              revisadoPorUsuario: String(retryRow.revisor_usuario_snapshot),
              revisadoEn: new Date(String(retryRow.created_at)).toISOString(),
              idempotente: true,
            },
          };
        }

        await tx.execute(sql`
          INSERT INTO auditoria
            (usuario_id, accion, entidad, entidad_id, sitio_id, datos_despues, ip)
          VALUES (
            ${auth.user.id}, 'REVISAR_ETIQUETA', 'revisiones_etiqueta',
            ${String(insertedRow.id)}, ${Number(row.ubicacion_id)},
            ${JSON.stringify({
              rolloId,
              reimpresionId: body.ultimaReimpresionId,
            })}::jsonb,
            ${getRequestIp(req)}
          )
        `);

        return {
          status: 201 as const,
          review: {
            id: Number(insertedRow.id),
            rolloId: Number(insertedRow.rollo_id),
            reimpresionId: Number(insertedRow.reimpresion_id),
            revisadoPorId: Number(insertedRow.usuario_id),
            revisadoPor: String(insertedRow.revisor_nombre_snapshot),
            revisadoPorUsuario: String(insertedRow.revisor_usuario_snapshot),
            revisadoEn: new Date(String(insertedRow.created_at)).toISOString(),
            idempotente: false,
          },
        };
      });
      res.status(result.status).json(result.review);
    } catch (error) {
      if (error instanceof Error && error.message === "ROLLO_NOT_FOUND") {
        res.status(404).json({ error: "Rollo no encontrado." });
        return;
      }
      if (error instanceof Error && error.message === "REPRINT_WATERMARK_MISMATCH") {
        res.status(409).json({
          error: "El rollo tiene una reimpresión nueva; actualiza la vista antes de marcarlo.",
          code: "REPRINT_WATERMARK_MISMATCH",
        });
        return;
      }
      if (error instanceof Error && error.message === "REVIEW_NOT_PENDING") {
        res.status(409).json({
          error: "El rollo todavía no tiene tres reimpresiones pendientes de revisión.",
          code: "REVIEW_NOT_PENDING",
        });
        return;
      }
      if (error instanceof Error && error.message === "SCOPE_WITHOUT_SITE") {
        res.status(403).json({ error: "No tienes un sitio asignado." });
        return;
      }
      next(error);
    }
  },
);

router.get(
  "/etiquetas/rollos/:id/revisiones",
  requireSession,
  requierePermiso("etiquetas", "ver"),
  async (req, res, next) => {
    try {
      const rolloId = id.parse(req.params.id);
      const site = scopedSite(req.auth!);
      const result = await db.execute(sql`
        SELECT revision.id, revision.rollo_id, revision.reimpresion_id,
          revision.usuario_id, revision.revisor_nombre_snapshot,
          revision.revisor_usuario_snapshot, revision.created_at
        FROM revisiones_etiqueta revision
        JOIN rollos r ON r.id=revision.rollo_id
        WHERE revision.rollo_id=${rolloId}
          ${site ? sql`AND r.ubicacion_id=${site}` : sql``}
        ORDER BY revision.created_at DESC, revision.id DESC
      `);
      if (result.rows.length === 0) {
        const rollo = await db.execute(sql`
          SELECT r.id
          FROM rollos r
          WHERE r.id=${rolloId}
            ${site ? sql`AND r.ubicacion_id=${site}` : sql``}
          LIMIT 1
        `);
        if (rollo.rows.length === 0) {
          res.status(404).json({ error: "Rollo no encontrado." });
          return;
        }
      }
      res.json({
        items: (result.rows as DbRow[]).map((row) => ({
          id: Number(row.id),
          rolloId: Number(row.rollo_id),
          reimpresionId: Number(row.reimpresion_id),
          revisadoPorId: Number(row.usuario_id),
          revisadoPor: String(row.revisor_nombre_snapshot),
          revisadoPorUsuario: String(row.revisor_usuario_snapshot),
          revisadoEn: new Date(String(row.created_at)).toISOString(),
        })),
      });
    } catch (error) {
      if (error instanceof Error && error.message === "SCOPE_WITHOUT_SITE") {
        res.status(403).json({ error: "No tienes un sitio asignado." });
        return;
      }
      next(error);
    }
  },
);

router.post(
  "/etiquetas/reimpresiones",
  requireSession,
  requierePermiso("etiquetas", "crear"),
  async (req, res, next) => {
    try {
      const body = reprintBody.parse(req.body);
      const auth = req.auth!;
      if (!["ADMIN", "BODEGA", "SUPERVISOR"].includes(auth.user.rol)) {
        res.status(403).json({ error: "Tu rol no puede reimprimir etiquetas." }); return;
      }
      let autorizador: { id: number; nombre: string; usuario: string } | null = null;
      if (auth.user.rol !== "ADMIN") {
        if (!body.adminUsuario || !body.adminPassword) {
          res.status(403).json({ error: "Se requieren credenciales de un ADMIN activo." }); return;
        }
        const admin = await db.execute(sql`
          SELECT id, nombre, usuario FROM usuarios
          WHERE usuario=${normalizeUsername(body.adminUsuario)} AND activo=true AND rol='ADMIN'
            AND password_hash=crypt(${body.adminPassword}, password_hash)
          LIMIT 1
        `);
        if (!admin.rows[0]) {
          res.status(403).json({ error: "Credenciales inválidas o el usuario no es un ADMIN activo." }); return;
        }
        const row = admin.rows[0] as DbRow;
        autorizador = {
          id: Number(row.id),
          nombre: String(row.nombre),
          usuario: String(row.usuario),
        };
      }
      const ids = body.rolloIds;
      const result = await db.transaction(async (tx) => {
        const selected = await tx.execute(sql`
          SELECT r.id,r.serie,r.producto_id,r.ubicacion_id,p.sku,p.tela,p.color,p.unidad,
            r.cantidad_actual,u.nombre AS sitio_nombre
          FROM rollos r JOIN productos p ON p.id=r.producto_id
          JOIN ubicaciones u ON u.id=r.ubicacion_id
          WHERE r.id IN (${sql.join(ids.map((value) => sql`${value}`), sql`,`)})
          ORDER BY r.id FOR SHARE OF r
        `);
        const rows = selected.rows as DbRow[];
        if (rows.length !== ids.length) throw new Error("ROLLO_NOT_FOUND");
        const ownSite = auth.user.ubicacionId;
        if (
            auth.user.rol !== "ADMIN" &&
            auth.user.rol !== "SUPERVISOR" &&
            auth.user.alcanceConsulta === "PROPIA" &&
            (ownSite == null || rows.some((row) => Number(row.ubicacion_id) !== ownSite))) {
          throw new Error("OUT_OF_SCOPE");
        }
        const now = new Date();
        for (const row of rows) {
          await tx.execute(sql`
            INSERT INTO reimpresiones_etiqueta
              (rollo_id,usuario_id,autorizado_por,motivo,sitio_id,
               serie_snapshot,sku_snapshot,producto_snapshot,tela_snapshot,color_snapshot,
               solicitante_nombre_snapshot,solicitante_usuario_snapshot,
               autorizador_nombre_snapshot,autorizador_usuario_snapshot,sitio_nombre_snapshot,created_at)
            VALUES (${Number(row.id)},${auth.user.id},${autorizador?.id ?? null},${body.motivo},
              ${Number(row.ubicacion_id)},${String(row.serie)},${String(row.sku)},
              ${`${String(row.tela)} ${String(row.color)}`},${String(row.tela)},${String(row.color)},
              ${auth.user.nombre},${auth.user.usuario},${autorizador?.nombre ?? null},
              ${autorizador?.usuario ?? null},${String(row.sitio_nombre)},${now})
          `);
          await tx.execute(sql`
            INSERT INTO auditoria
              (usuario_id, accion, entidad, entidad_id, sitio_id, datos_despues, ip)
            VALUES (
              ${auth.user.id}, 'REIMPRIMIR_ETIQUETA', 'reimpresiones_etiqueta',
              ${String(row.id)}, ${Number(row.ubicacion_id)},
              ${JSON.stringify({
                rolloId: Number(row.id),
                serie: String(row.serie),
                motivo: body.motivo,
                autorizadoPor: autorizador?.id ?? null,
              })}::jsonb,
              ${getRequestIp(req)}
            )
          `);
        }
        return { etiquetas: rows.map((row) => label(row, now)), registradoAt: now.toISOString() };
      });
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "ROLLO_NOT_FOUND") {
        res.status(404).json({ error: "Uno o más rollos no existen." }); return;
      }
      if (error instanceof Error && ["OUT_OF_SCOPE", "SCOPE_WITHOUT_SITE"].includes(error.message)) {
        res.status(403).json({ error: "No puedes reimprimir rollos fuera de tu sitio." }); return;
      }
      next(error);
    }
  },
);

async function historyRows(query: z.infer<typeof historyQuery>, paged: boolean) {
  const conditions = [...dateConditions(query, sql.raw("re.created_at"))];
  if (query.sitioId) conditions.push(sql`re.sitio_id=${query.sitioId}`);
  if (query.usuarioId) conditions.push(sql`re.usuario_id=${query.usuarioId}`);
  if (query.productoId) conditions.push(sql`r.producto_id=${query.productoId}`);
  const where = conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
  const paging = paged ? sql`LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}` : sql``;
  const result = await db.execute(sql`
    SELECT re.id, re.created_at, re.rollo_id, re.sitio_id, re.usuario_id,
      re.autorizado_por, r.producto_id, re.serie_snapshot, re.sku_snapshot,
      re.producto_snapshot, re.sitio_nombre_snapshot,
      re.solicitante_nombre_snapshot, re.solicitante_usuario_snapshot,
      re.autorizador_nombre_snapshot, re.autorizador_usuario_snapshot, re.motivo,
      COUNT(*) OVER()::int AS total
    FROM reimpresiones_etiqueta re JOIN rollos r ON r.id=re.rollo_id
    ${where} ORDER BY re.created_at DESC,re.id DESC ${paging}
  `);
  return result.rows as DbRow[];
}

router.get("/etiquetas/historial", requireSession, async (req, res, next) => {
  try {
    if (req.auth!.user.rol !== "ADMIN") { res.status(403).json({ error: "El historial requiere rol ADMIN." }); return; }
    const q = historyQuery.parse(req.query);
    const rows = await historyRows(q, true);
    res.json({
      items: rows.map((r) => ({
        id: Number(r.id),
        rolloId: Number(r.rollo_id),
        serie: String(r.serie_snapshot),
        productoId: Number(r.producto_id),
        producto: String(r.producto_snapshot),
        sku: String(r.sku_snapshot),
        sitioId: Number(r.sitio_id),
        sitio: String(r.sitio_nombre_snapshot),
        usuarioId: Number(r.usuario_id),
        solicito: String(r.solicitante_nombre_snapshot),
        autorizadoPor: r.autorizado_por == null ? null : Number(r.autorizado_por),
        autorizo: r.autorizador_nombre_snapshot == null ? null : String(r.autorizador_nombre_snapshot),
        motivo: String(r.motivo),
        createdAt: new Date(String(r.created_at)).toISOString(),
      })),
      total: Number(rows[0]?.total ?? 0),
      page: q.page,
      pageSize: q.pageSize,
    });
  } catch (error) { next(error); }
});

router.get("/etiquetas/historial/export.xlsx", requireSession, async (req, res, next) => {
  try {
    if (req.auth!.user.rol !== "ADMIN") { res.status(403).json({ error: "La exportación requiere rol ADMIN." }); return; }
    const q = historyQuery.parse(req.query);
    const rows = await historyRows(q, false);
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Reimpresiones");
    sheet.columns = [
      { header: "Fecha y hora", key: "fecha", width: 24 }, { header: "Serie", key: "serie", width: 18 },
      { header: "SKU", key: "sku", width: 18 }, { header: "Producto", key: "producto", width: 32 },
      { header: "Sitio", key: "sitio", width: 24 }, { header: "Solicitó", key: "solicito", width: 24 },
      { header: "Autorizó", key: "autorizo", width: 24 }, { header: "Motivo", key: "motivo", width: 50 },
    ];
    rows.forEach((r) => sheet.addRow({
      fecha: new Date(String(r.created_at)),
      serie: r.serie_snapshot,
      sku: r.sku_snapshot,
      producto: r.producto_snapshot,
      sitio: r.sitio_nombre_snapshot,
      solicito: r.solicitante_nombre_snapshot,
      autorizo: r.autorizador_nombre_snapshot ?? "ADMIN solicitante",
      motivo: r.motivo,
    }));
    const buffer = await book.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="historial-reimpresiones.xlsx"');
    res.send(Buffer.from(buffer));
  } catch (error) { next(error); }
});

router.get("/etiquetas/alertas/count", requireSession, async (req, res, next) => {
  try {
    if (req.auth!.user.rol !== "ADMIN") { res.status(403).json({ error: "Las alertas requieren rol ADMIN." }); return; }
    const result = await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT r.id
        FROM rollos r
        LEFT JOIN reimpresiones_etiqueta re ON re.rollo_id = r.id
        GROUP BY r.id
        HAVING COUNT(*) >= 3
          AND ${pendingReviewPredicate()}
      ) pending
    `);
    res.json({ count: Number((result.rows[0] as DbRow | undefined)?.count ?? 0), threshold: 3 });
  } catch (error) { next(error); }
});

// This router uses Zod v4 schemas while the legacy app error middleware imports
// Zod v3. Catch validation here so malformed query, path and body values always
// retain the documented 400 response instead of bubbling as a 500.
router.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: "Revisa los datos enviados e intenta de nuevo.",
        code: "VALIDATION_ERROR",
      });
      return;
    }
    next(error);
  },
);

export default router;