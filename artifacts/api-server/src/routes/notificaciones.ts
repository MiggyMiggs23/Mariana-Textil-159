import { Router, type IRouter, type Request, type Response } from "express";
import { createHash } from "node:crypto";
import { and, asc, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import {
  CountNotificacionesNoLeidasResponse,
  GetNotificationFeedResponse,
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
  solicitudesPagoDirigidoTable,
} from "@workspace/db";
import { requireSession } from "../middlewares/auth";
import { getAdminAlertas } from "../lib/admin-alertas";
import { centsToMoney } from "../lib/credit-allocation";
import { loadCustomerCreditProjections } from "../lib/credit-aging-read-model";

const router: IRouter = Router();
router.use("/notificaciones", requireSession);

/** Four days lets a Friday resolution remain visible through the weekend. */
export const RESOLVED_DIRECTED_PAYMENT_VISIBILITY_DAYS = 4;

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

type FeedEvent = {
  id: string;
  kind: "TICKET_READY" | "DIRECTED_PAYMENT" | "CREDIT_DUE" | "TRANSIT_OVERDUE" | "SYSTEM" | "CREDIT_NOTICE";
  family: "AVISO" | "SOLICITUD" | "ALERTA";
  title: string;
  message: string;
  href: string;
  updatedAt: string;
  siteId: number | null;
  action: {
    requestId: number; tipo: Kind; contraparte: string; documento: string;
    importe: string; motivo: string; solicitante: string;
  } | null;
};
type Kind = "CLIENTE" | "PROVEEDOR";

function directedPaymentEvent(row: Record<string, unknown>, adminQueue: boolean): FeedEvent {
  const id = Number(row.id);
  const estado = String(row.estado);
  const tipo = String(row.tipo);
  const importe = Number(row.importe ?? 0).toFixed(2);
  const contraparte = String(row.contraparteNombre);
  const documento = String(row.documentoFolio);
  const updatedAtValue = row.resueltaAt ?? row.createdAt;
  const updatedAt = new Date(
    updatedAtValue instanceof Date || typeof updatedAtValue === "string"
      ? updatedAtValue
      : Date.now(),
  ).toISOString();
  const statusLabel = estado === "APROBADA" ? "aprobado" : estado === "RECHAZADA" ? "rechazado" : "pendiente";
  return {
    id: `directed-payment:${id}`,
    kind: "DIRECTED_PAYMENT",
    family: "SOLICITUD",
    title: adminQueue ? "Solicitud de pago dirigido" : `Pago dirigido ${statusLabel}`,
    message: adminQueue
      ? `${String(row.solicitanteNombre)} solicita $${importe} para ${contraparte} · ${documento}.`
      : `$${importe} para ${contraparte} · ${documento}.`,
    href: "/pagos-dirigidos",
    updatedAt,
    siteId: row.ubicacionId == null ? null : Number(row.ubicacionId),
    action: adminQueue ? {
      requestId: id,
      tipo: tipo as Kind,
      contraparte,
      documento,
      importe,
      motivo: String(row.motivo),
      solicitante: String(row.solicitanteNombre),
    } : null,
  };
}

router.get("/notificaciones/feed", async (req, res, next): Promise<void> => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    const user = req.auth!.user;
    const events = new Map<string, FeedEvent>();

    const ownDirectedPromise = db
      .select()
      .from(solicitudesPagoDirigidoTable)
      .where(and(
        eq(solicitudesPagoDirigidoTable.solicitanteId, user.id),
        or(
          eq(solicitudesPagoDirigidoTable.estado, "PENDIENTE"),
          gt(
            solicitudesPagoDirigidoTable.resueltaAt,
            new Date(Date.now() - RESOLVED_DIRECTED_PAYMENT_VISIBILITY_DAYS * 86_400_000),
          ),
        ),
      ))
      .orderBy(desc(sql`COALESCE(${solicitudesPagoDirigidoTable.resueltaAt}, ${solicitudesPagoDirigidoTable.createdAt})`))
      .limit(25);

    const cajaTicketsPromise = user.rol === "CAJA" && user.ubicacionId != null
      ? pool.query(
          `SELECT t.id, t.folio, t.total::text AS importe, t.created_at AS "createdAt",
             c.nombre AS "clienteNombre"
           FROM tickets t
           JOIN clientes c ON c.id=t.cliente_id
           WHERE t.estado='VENDIDO' AND NOT t.cobrado AND t.ubicacion_id=$1
           ORDER BY t.created_at DESC,t.id DESC
           LIMIT 50`,
          [user.ubicacionId],
        )
      : Promise.resolve({ rows: [] });

    const [ownDirected, cajaTickets] = await Promise.all([ownDirectedPromise, cajaTicketsPromise]);

    for (const row of ownDirected) {
      const event = directedPaymentEvent(row as unknown as Record<string, unknown>, false);
      events.set(event.id, event);
    }
    for (const row of cajaTickets.rows) {
      const ticket = row as Record<string, unknown>;
      const ticketId = Number(ticket.id);
      const event: FeedEvent = {
        id: `ticket-ready:${ticketId}`,
        kind: "TICKET_READY",
        family: "AVISO",
        title: `Ticket ${Number(ticket.folio)} listo para cobrar`,
        message: `${String(ticket.clienteNombre)} · $${Number(ticket.importe).toFixed(2)}`,
        href: `/cobros?ticketId=${ticketId}`,
        updatedAt: new Date(ticket.createdAt as string | Date).toISOString(),
        siteId: user.ubicacionId,
        action: null,
      };
      events.set(event.id, event);
    }

    if (user.rol === "ADMIN") {
      const [alerts, pendingDirected, systemNotifications, creditNotifications] = await Promise.all([
        getAdminAlertas(),
        db
          .select()
          .from(solicitudesPagoDirigidoTable)
          .where(eq(solicitudesPagoDirigidoTable.estado, "PENDIENTE"))
          .orderBy(desc(solicitudesPagoDirigidoTable.createdAt))
          .limit(50),
        db
          .select()
          .from(notificacionesSistemaTable)
          .where(isNull(notificacionesSistemaTable.leidaAt))
          .orderBy(desc(notificacionesSistemaTable.createdAt))
          .limit(50),
        db
          .select()
          .from(notificacionesCreditoTable)
          .where(isNull(notificacionesCreditoTable.leidaAt))
          .orderBy(desc(notificacionesCreditoTable.createdAt))
          .limit(50),
      ]);

      for (const row of pendingDirected) {
        const event = directedPaymentEvent(row as unknown as Record<string, unknown>, true);
        events.set(event.id, event);
      }
      for (const row of systemNotifications) {
        events.set(`system:${row.id}`, {
          id: `system:${row.id}`,
          kind: "SYSTEM",
            family: row.tipo.startsWith("SOLICITUD_") ? "SOLICITUD" : row.tipo.includes("INCOMPLETA") ? "ALERTA" : "AVISO",
          title: row.titulo,
          message: row.mensaje,
          href: "/notificaciones",
          updatedAt: row.createdAt.toISOString(),
          siteId: null,
          action: null,
        });
      }
      for (const row of creditNotifications) {
        events.set(`credit-notice:${row.id}`, {
          id: `credit-notice:${row.id}`,
          kind: "CREDIT_NOTICE",
          family: row.urgente ? "ALERTA" : "AVISO",
          title: `Venta a crédito · Folio ${row.folio}`,
          message: `${row.clienteNombre} · $${Number(row.importe).toFixed(2)}`,
          href: `/clientes/${row.clienteId}?tab=estado`,
          updatedAt: row.createdAt.toISOString(),
          siteId: row.tiendaId,
          action: null,
        });
      }
      for (const row of alerts.ticketsPendientes) {
        events.set(`ticket-ready:${row.id}`, {
          id: `ticket-ready:${row.id}`,
          kind: "TICKET_READY",
          family: "ALERTA",
          title: `Ticket ${row.folio} pendiente de cobro`,
          message: `${row.nombreUbicacion} · ${row.nombreCliente} · $${row.importe}`,
          href: `/tickets/${row.id}`,
          updatedAt: row.createdAt,
          siteId: row.ubicacionId,
          action: null,
        });
      }
      for (const row of alerts.creditos) {
        events.set(`credit-due:${row.movimientoId}`, {
          id: `credit-due:${row.movimientoId}`,
          kind: "CREDIT_DUE",
          family: "ALERTA",
          title: row.diasRestantes < 0 ? "Pago de cliente vencido" : "Pago de cliente por vencer",
          message: `${row.nombreCliente} · $${row.importe}`,
          href: `/clientes/${row.clienteId}?tab=estado`,
          updatedAt: `${row.fechaVencimiento}T12:00:00.000Z`,
          siteId: null,
          action: null,
        });
      }
      for (const row of alerts.salidasEnTransito) {
        events.set(`transit-overdue:${row.id}`, {
          id: `transit-overdue:${row.id}`,
          kind: "TRANSIT_OVERDUE",
          family: "ALERTA",
          title: `Salida ${row.folio} sin recibir`,
          message: `${row.nombreOrigen} → ${row.nombreDestino} · ${row.horasEnTransito} h`,
          href: `/salidas/${row.id}`,
          updatedAt: row.enviadaAt,
          siteId: row.destinoId,
          action: null,
        });
      }
    }

    const parsed = GetNotificationFeedResponse.parse({
      events: [...events.values()]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id))
        .slice(0, 100),
      generatedAt: new Date(),
      sessionKey: createHash("sha256")
        .update(req.auth!.sessionId)
        .digest("hex")
        .slice(0, 24),
    });
    res.json({
      ...parsed,
      generatedAt: parsed.generatedAt.toISOString(),
      events: parsed.events.map((event) => ({
        ...event,
        updatedAt: event.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

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

    // Aging is intentionally projected from the immutable ledger's current
    // FIFO balance.  Notification records are merely a review queue and must
    // never determine an outstanding amount.
    const creditRows = await pool.query<{
      clienteId: number; clienteNombre: string; movimientoId: number;
      ticketId: number | null; folio: number | null;
    }>(`SELECT c.id AS "clienteId", c.nombre AS "clienteNombre",
          m.id AS "movimientoId", m.ticket_id AS "ticketId", t.folio
        FROM clientes c
        JOIN movimientos_credito m ON m.cliente_id=c.id
        LEFT JOIN tickets t ON t.id=m.ticket_id
        WHERE m.tipo IN ('VENTA_CREDITO','AJUSTE')`);
    const projections = await loadCustomerCreditProjections(
      [...new Set(creditRows.rows.map((row) => Number(row.clienteId)))],
    );
    const movementMetadata = new Map(
      creditRows.rows.map((row) => [Number(row.movimientoId), row]),
    );
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Mexico_City",
    });
    const threshold = new Date(
      Date.parse(`${today}T00:00:00Z`) + 3 * 86_400_000,
    ).toISOString().slice(0, 10);
    const all = [...projections].flatMap(([clienteId, projection]) =>
      projection.charges
        .filter((charge) => charge.dueAt != null && charge.dueAt <= threshold)
        .map((charge) => {
          const metadata = movementMetadata.get(charge.movimientoId);
          if (!metadata || charge.dueAt == null) {
            throw new Error(`Missing credit movement metadata: ${charge.movimientoId}`);
          }
          const diasVencido = Math.max(0, Math.floor(
            (Date.parse(`${today}T00:00:00Z`) -
              Date.parse(`${charge.dueAt}T00:00:00Z`)) / 86_400_000,
          ));
          return {
            movimientoId: charge.movimientoId,
            ticketId: charge.ticketId,
            clienteId,
            clienteNombre: metadata.clienteNombre,
            folio: metadata.folio == null ? null : Number(metadata.folio),
            pendiente: centsToMoney(charge.pendienteCents),
            fechaVencimiento: charge.dueAt,
            diasVencido,
            estado: diasVencido > 0 ? "VENCIDA" as const : "POR_VENCER" as const,
          };
        }),
    ).sort((a, b) =>
      a.fechaVencimiento.localeCompare(b.fechaVencimiento) ||
      a.movimientoId - b.movimientoId,
    );
    const overdue = all.filter((row) => row.estado === "VENCIDA");
    const multiples = [...projections].flatMap(([clienteId, projection]) => {
      const overdueCharges = projection.charges
        .filter((charge) => charge.dueAt != null && charge.dueAt < today);
      if (overdueCharges.length <= 1) return [];
      const metadata = movementMetadata.get(overdueCharges[0]!.movimientoId);
      if (!metadata) throw new Error(`Missing credit movement metadata: ${overdueCharges[0]!.movimientoId}`);
      return [{
        clienteId,
        clienteNombre: metadata.clienteNombre,
        notasVencidas: overdueCharges.length,
        saldoVencido: centsToMoney(overdueCharges.reduce(
          (sum, charge) => sum + charge.pendienteCents, 0,
        )),
        primerVencimiento: overdueCharges.map((charge) => charge.dueAt!).sort()[0]!,
      }];
    }).sort((a, b) =>
      a.primerVencimiento.localeCompare(b.primerVencimiento) ||
      a.clienteNombre.localeCompare(b.clienteNombre),
    );
    const parsed = ListNotificacionesResponse.parse({
        notificaciones: notifications.map(present),
        sistema: systemNotifications.map((row) => ({
          ...row,
          leidaAt: row.leidaAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
        })),
        porVencer: all.filter((row) => row.estado === "POR_VENCER"),
        vencidas: overdue,
        clientesConMultiplesVencidas: multiples.map(({ primerVencimiento: _first, ...row }) => row),
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