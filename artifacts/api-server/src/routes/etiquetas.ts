import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import ExcelJS from "exceljs";
import { sql } from "drizzle-orm";
import { ZodError, z } from "zod/v4";
import { db } from "@workspace/db";
import { requireSession } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { normalizeUsername } from "../lib/auth-identifiers";

const router = Router();
const id = z.coerce.number().int().positive();
const optionalId = z.coerce.number().int().positive().optional();
const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

const searchQuery = z.object({
  q: z.string().trim().max(150).optional(),
  sitioId: optionalId,
  estado: z.enum(["PROGRAMADO", "DISPONIBLE", "EN_TRANSITO", "ABIERTO", "VENDIDO", "BAJA"]).optional(),
  productoId: optionalId,
  fechaDesde: dateText,
  fechaHasta: dateText,
  folio: z.coerce.number().int().positive().optional(),
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

type DbRow = Record<string, unknown>;

function scopedSite(auth: NonNullable<Express.Request["auth"]>, requested?: number) {
  if (auth.user.rol === "ADMIN" || auth.user.alcanceConsulta === "TODAS") return requested;
  if (auth.user.ubicacionId == null) throw new Error("SCOPE_WITHOUT_SITE");
  return auth.user.ubicacionId;
}

function dateConditions(q: { fechaDesde?: string; fechaHasta?: string }, column: ReturnType<typeof sql.raw>) {
  const conditions = [];
  if (q.fechaDesde) conditions.push(sql`${column} >= ${`${q.fechaDesde}T00:00:00-06:00`}::timestamptz`);
  if (q.fechaHasta) conditions.push(sql`${column} < (${`${q.fechaHasta}T00:00:00-06:00`}::timestamptz + interval '1 day')`);
  return conditions;
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
      if (q.q) {
        const term = q.q.trim();
        conditions.push(sql`(
          r.serie ILIKE ${`%${term}%`} OR p.sku ILIKE ${`%${term}%`} OR
          p.tela ILIKE ${`%${term}%`} OR p.color ILIKE ${`%${term}%`} OR
          (p.sku || '-' || r.serie) ILIKE ${term}
        )`);
      }
      const where = conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
      const result = await db.execute(sql`
        SELECT r.id, r.serie, r.producto_id, p.sku, p.tela, p.color, p.unidad, r.created_at,
          r.cantidad_actual, r.ubicacion_id AS sitio_id, u.nombre AS sitio,
          r.estado, r.created_at, e.id AS entrada_id, e.folio,
          COUNT(re.id)::int AS reimpresiones_count, MAX(re.created_at) AS ultima_reimpresion,
          COUNT(*) OVER()::int AS total
        FROM rollos r
        JOIN productos p ON p.id = r.producto_id
        JOIN ubicaciones u ON u.id = r.ubicacion_id
        LEFT JOIN entradas e ON e.id = r.recepcion_id
        LEFT JOIN reimpresiones_etiqueta re ON re.rollo_id = r.id
        ${where}
        GROUP BY r.id, p.id, u.id, e.id
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT 50
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
          ultimaReimpresion: row.ultima_reimpresion == null ? null : new Date(String(row.ultima_reimpresion)).toISOString(),
          alertaReimpresiones: Number(row.reimpresiones_count) >= 3,
        })),
        limit: 50,
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
          COUNT(re.id)::int AS reimpresiones_count, MAX(re.created_at) AS ultima_reimpresion
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
        ultimaReimpresion: row.ultima_reimpresion == null ? null : new Date(String(row.ultima_reimpresion)).toISOString(),
        alertaReimpresiones: Number(row.reimpresiones_count) >= 3,
      });
    } catch (error) { next(error); }
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
      if (!["ADMIN", "BODEGA", "INVENTARIOS"].includes(auth.user.rol)) {
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
        if (auth.user.rol !== "ADMIN" && auth.user.alcanceConsulta === "PROPIA" &&
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
      SELECT COUNT(*)::int AS count FROM (
        SELECT rollo_id FROM reimpresiones_etiqueta GROUP BY rollo_id HAVING COUNT(*) >= 3
      ) repeated
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