import { Router, type IRouter, type Request, type Response } from "express";
import { asc, desc, eq, isNull, sql } from "drizzle-orm";
import {
  CountNotificacionesNoLeidasResponse,
  ListNotificacionesResponse,
  MarkAllNotificacionesReadResponse,
  MarkNotificacionReadParams,
  MarkNotificacionReadResponse,
} from "@workspace/api-zod";
import {
  db,
  notificacionesCreditoTable,
  notificacionesSistemaTable,
  pool,
} from "@workspace/db";
import { requireSession } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireSession);

function requireLiteralAdmin(req: Request, res: Response): boolean {
  if (req.auth!.user.rol === "ADMIN") return true;
  res.status(403).json({ error: "Solo ADMIN puede consultar notificaciones." });
  return false;
}

function present(row: typeof notificacionesCreditoTable.$inferSelect) {
  return {
    ...row,
    fechaVencimiento: calendarDate(row.fechaVencimiento),
    leidaAt: row.leidaAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Convert pg/drizzle date values without timezone-shifting their calendar day. */
function calendarDate(value: string | Date): string {
  return typeof value === "string" ? value : value.toISOString().slice(0, 10);
}

function serializeNotificationDates<T extends {
  fechaVencimiento: string | Date;
}>(value: T): Omit<T, "fechaVencimiento"> & { fechaVencimiento: string } {
  return {
    ...value,
    fechaVencimiento: calendarDate(value.fechaVencimiento),
  };
}

router.get("/notificaciones", async (req, res, next): Promise<void> => {
  try {
    if (!requireLiteralAdmin(req, res)) return;
    const [notifications, systemNotifications] = await Promise.all([
      db
        .select()
        .from(notificacionesCreditoTable)
        .orderBy(asc(notificacionesCreditoTable.leidaAt), desc(notificacionesCreditoTable.createdAt)),
      db
        .select()
        .from(notificacionesSistemaTable)
        .orderBy(asc(notificacionesSistemaTable.leidaAt), desc(notificacionesSistemaTable.createdAt)),
    ]);

    // Aging is intentionally computed from the ledger's current FIFO balance.
    // These are not notification records and therefore change as payments and
    // calendar dates change.
    const alerts = await pool.query(`
      WITH notas AS (
        SELECT a.movimiento_id AS "movimientoId", a.ticket_id AS "ticketId",
          c.id AS "clienteId", c.nombre AS "clienteNombre", t.folio,
          a.pendiente::text, a.due_at AS "fechaVencimiento",
          GREATEST(0, (now() AT TIME ZONE 'America/Mexico_City')::date - a.due_at)::int AS "diasVencido"
        FROM clientes c
        JOIN LATERAL credit_fifo_aging(c.id) a ON true
        LEFT JOIN tickets t ON t.id = a.ticket_id
        WHERE a.due_at IS NOT NULL
      )
      SELECT * FROM notas
      WHERE "fechaVencimiento" <= (now() AT TIME ZONE 'America/Mexico_City')::date + 3
      ORDER BY "fechaVencimiento" ASC, "movimientoId" ASC
    `);
    const all = alerts.rows.map((row) => ({
      ...row,
      fechaVencimiento: calendarDate(row.fechaVencimiento as string | Date),
      diasVencido: Number(row.diasVencido),
      estado: Number(row.diasVencido) > 0 ? "VENCIDA" : "POR_VENCER",
    }));
    const overdue = all.filter((row) => row.estado === "VENCIDA");
    const multiples = await pool.query(`
      SELECT c.id AS "clienteId", c.nombre AS "clienteNombre",
        COUNT(*)::int AS "notasVencidas", SUM(a.pendiente)::text AS "saldoVencido"
      FROM clientes c JOIN LATERAL credit_fifo_aging(c.id) a ON true
      WHERE a.due_at < (now() AT TIME ZONE 'America/Mexico_City')::date
      GROUP BY c.id, c.nombre HAVING COUNT(*) > 1
      ORDER BY MIN(a.due_at) ASC, c.nombre ASC
    `);
    const parsed = ListNotificacionesResponse.parse({
        notificaciones: notifications.map(present),
        sistema: systemNotifications.map((row) => ({
          ...row,
          leidaAt: row.leidaAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
        })),
        porVencer: all.filter((row) => row.estado === "POR_VENCER"),
        vencidas: overdue,
        clientesConMultiplesVencidas: multiples.rows.map((row) => ({
          ...row,
          notasVencidas: Number(row.notasVencidas),
        })),
      });
    res.json({
      ...parsed,
      notificaciones: parsed.notificaciones.map(serializeNotificationDates),
      porVencer: parsed.porVencer.map(serializeNotificationDates),
      vencidas: parsed.vencidas.map(serializeNotificationDates),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/notificaciones/no-leidas/count", async (req, res, next): Promise<void> => {
  try {
    if (!requireLiteralAdmin(req, res)) return;
    const [[credit], [system]] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(notificacionesCreditoTable)
        .where(isNull(notificacionesCreditoTable.leidaAt)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(notificacionesSistemaTable)
        .where(isNull(notificacionesSistemaTable.leidaAt)),
    ]);
    res.json(CountNotificacionesNoLeidasResponse.parse({
      count: (credit?.count ?? 0) + (system?.count ?? 0),
    }));
  } catch (error) {
    next(error);
  }
});

router.post("/notificaciones/leer-todas", async (req, res, next): Promise<void> => {
  try {
    if (!requireLiteralAdmin(req, res)) return;
    await db.transaction(async (tx) => {
      await tx
        .update(notificacionesCreditoTable)
        .set({ leidaAt: new Date() })
        .where(isNull(notificacionesCreditoTable.leidaAt));
      await tx
        .update(notificacionesSistemaTable)
        .set({ leidaAt: new Date() })
        .where(isNull(notificacionesSistemaTable.leidaAt));
    });
    res.json(MarkAllNotificacionesReadResponse.parse({ count: 0 }));
  } catch (error) {
    next(error);
  }
});

router.post("/notificaciones/:id/leer", async (req, res, next): Promise<void> => {
  try {
    if (!requireLiteralAdmin(req, res)) return;
    const params = MarkNotificacionReadParams.parse(req.params);
    const [notification] = await db
      .update(notificacionesCreditoTable)
      .set({ leidaAt: new Date() })
      .where(eq(notificacionesCreditoTable.id, params.id))
      .returning();
    if (!notification) {
      res.status(404).json({ error: "Notificación no encontrada." });
      return;
    }
    const parsed = MarkNotificacionReadResponse.parse(present(notification));
    res.json(serializeNotificationDates(parsed));
  } catch (error) {
    next(error);
  }
});

export default router;