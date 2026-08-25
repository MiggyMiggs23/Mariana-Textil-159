import { Router, type IRouter } from "express";
import ExcelJS from "exceljs";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  CreateClientePagoBody,
  CreateClientePagoResponse,
} from "@workspace/api-zod";
import {
  auditoriaTable,
  clientesTable,
  db,
  movimientosCreditoTable,
  pool,
  productosTable,
  ticketLineasTable,
  ticketsTable,
} from "@workspace/db";
import { requireSession } from "../middlewares/auth";
import { requierePermiso, resolvePermiso } from "../lib/permisos";
import { getRequestIp } from "../lib/request";
import { createTextPdf } from "../lib/pdf";
import { canLinkAdjustmentToTicket } from "../lib/clientes-aging";

const router: IRouter = Router();

router.use("/clientes", requireSession);

// ── helpers ───────────────────────────────────────────────────────────────────

/** Operational fields only — no financial data */
function presentClienteOperativo(row: typeof clientesTable.$inferSelect) {
  return {
    id: row.id,
    nombre: row.nombre,
    telefono: row.telefono,
    correo: row.correo,
    direccion: row.direccion,
    rfc: row.rfc,
    notas: row.notas,
    activo: row.activo,
    esSistema: row.esSistema,
    contactoNombre: row.contactoNombre,
    diasCredito: row.diasCredito,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function parseId(value: string | string[]): number | null {
  const id = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function period(req: { query: Record<string, unknown> }) {
  const desde = typeof req.query.desde === "string" ? req.query.desde : null;
  const hasta = typeof req.query.hasta === "string" ? req.query.hasta : null;
  const valid = /^\d{4}-\d{2}-\d{2}$/;
  if ((desde && !valid.test(desde)) || (hasta && !valid.test(hasta))) {
    throw new Error("INVALID_PERIOD");
  }
  return { desde, hasta };
}

// ── GET /clientes/resumen ─────────────────────────────────────────────────────
// Must come BEFORE /:id to avoid Express matching "resumen" as an id.
// clientes_finanzas module (cartera, vencidos)

router.get(
  "/clientes/resumen",
  requierePermiso("clientes_finanzas", "ver"),
  async (_req, res, next): Promise<void> => {
    try {
       const result = await pool.query(`
         WITH saldo AS (
           SELECT c.id, COALESCE(SUM(m.importe),0) AS total
           FROM clientes c LEFT JOIN movimientos_credito m ON m.cliente_id=c.id
           WHERE c.activo GROUP BY c.id
         ), vencido AS (
           SELECT c.id, COALESCE(SUM(a.pendiente) FILTER (WHERE a.due_at < now()),0) AS total
           FROM clientes c LEFT JOIN LATERAL credit_fifo_aging(c.id) a ON true
           WHERE c.activo GROUP BY c.id
         )
         SELECT COUNT(*)::int AS "totalClientes",
           COUNT(*) FILTER (WHERE s.total > 0)::int AS "clientesConSaldo",
           COALESCE(SUM(GREATEST(s.total,0)),0)::text AS "totalCartera",
           COALESCE(SUM(v.total),0)::text AS "totalVencido"
         FROM saldo s JOIN vencido v ON v.id=s.id`);
       const row = result.rows[0];
      res.json({
        totalClientes: row?.totalClientes ?? 0,
        clientesConSaldo: row?.clientesConSaldo ?? 0,
        totalCartera: row?.totalCartera ?? "0.00",
        totalVencido: row?.totalVencido ?? "0.00",
      });
    } catch (e) {
      if (e instanceof Error && e.message === "INVALID_PERIOD") {
        res.status(400).json({ error: "Periodo inválido; usa YYYY-MM-DD." });
        return;
      }
      next(e);
    }
  },
);

// ── GET /clientes ─────────────────────────────────────────────────────────────

router.get(
  "/clientes",
  requierePermiso("clientes", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const rows = await db
        .select()
        .from(clientesTable)
        .orderBy(clientesTable.nombre);

      const permiso = await resolvePermiso(
        req.auth!.user.id,
        req.auth!.user.rol,
        "clientes_finanzas",
      );
      if (req.auth!.user.rol !== "ADMIN" && !permiso?.puedeVer) {
        res.json(rows.map(presentClienteOperativo));
        return;
      }
      const balances = await db
        .select({
          clienteId: movimientosCreditoTable.clienteId,
          saldo: sql<string>`COALESCE(SUM(${movimientosCreditoTable.importe}), 0)::text`,
        })
        .from(movimientosCreditoTable)
        .groupBy(movimientosCreditoTable.clienteId);
      const byId = new Map(balances.map((item) => [item.clienteId, item.saldo]));
      res.json(
        rows.map((row) => ({
          ...presentClienteOperativo(row),
          limiteCredito: row.limiteCredito,
          saldoActual: byId.get(row.id) ?? "0.00",
        })),
      );
    } catch (e) {
      if (e instanceof Error && e.message === "INVALID_PERIOD") {
        res.status(400).json({ error: "Periodo inválido; usa YYYY-MM-DD." });
        return;
      }
      next(e);
    }
  },
);

// ── POST /clientes ────────────────────────────────────────────────────────────

router.post(
  "/clientes",
  requierePermiso("clientes", "crear"),
  async (req, res, next): Promise<void> => {
    try {
      const { nombre, telefono, correo, direccion, rfc, notas, contactoNombre, diasCredito, limiteCredito } =
        req.body as Record<string, unknown>;
      if (diasCredito !== undefined || limiteCredito !== undefined) {
        res.status(403).json({
          error: "Los términos de crédito solo se modifican en /clientes/:id/credito.",
        });
        return;
      }

      if (typeof nombre !== "string" || nombre.trim().length < 1) {
        res.status(400).json({ error: "El nombre es obligatorio." });
        return;
      }

      const [created] = await db
        .insert(clientesTable)
        .values({
          nombre: (nombre as string).trim(),
          telefono: typeof telefono === "string" ? telefono : null,
          correo: typeof correo === "string" ? correo : null,
          direccion: typeof direccion === "string" ? direccion : null,
          rfc: typeof rfc === "string" ? rfc : null,
          notas: typeof notas === "string" ? notas : null,
          contactoNombre:
            typeof contactoNombre === "string" ? contactoNombre.trim() : null,
        })
        .returning();

      await db.insert(auditoriaTable).values({
        usuarioId: req.auth!.user.id,
        accion: "CREAR",
        entidad: "clientes",
        entidadId: String(created.id),
        datosDespues: presentClienteOperativo(created) as Record<string, unknown>,
        ip: getRequestIp(req),
      });

      res.status(201).json(presentClienteOperativo(created));
    } catch (e) {
      next(e);
    }
  },
);

// ── GET /clientes/:id ─────────────────────────────────────────────────────────

router.get(
  "/clientes/cartera",
  requierePermiso("clientes_finanzas", "ver"),
  async (_req, res, next): Promise<void> => {
    try {
      const result = await pool.query(`
        WITH cartera AS (
          SELECT c.id, c.nombre, a.due_at, a.pendiente
          FROM clientes c JOIN LATERAL credit_fifo_aging(c.id) a ON true
          WHERE c.activo AND NOT c.es_sistema
        )
        SELECT id, nombre, SUM(pendiente)::text AS "saldoActual",
          COALESCE(SUM(pendiente) FILTER (WHERE due_at >= now()),0)::text AS "porVencer",
          COALESCE(SUM(pendiente) FILTER (WHERE due_at < now() AND due_at >= now()-interval '30 day'),0)::text AS "1_30",
          COALESCE(SUM(pendiente) FILTER (WHERE due_at < now()-interval '30 day' AND due_at >= now()-interval '60 day'),0)::text AS "31_60",
          COALESCE(SUM(pendiente) FILTER (WHERE due_at < now()-interval '60 day' AND due_at >= now()-interval '90 day'),0)::text AS "61_90",
          COALESCE(SUM(pendiente) FILTER (WHERE due_at < now()-interval '90 day'),0)::text AS "mas90",
          CASE WHEN MIN(due_at) FILTER (WHERE due_at < now()) IS NULL THEN 'POR_VENCER'
            WHEN MIN(due_at) >= now()-interval '30 day' THEN '1_30'
            WHEN MIN(due_at) >= now()-interval '60 day' THEN '31_60'
            WHEN MIN(due_at) >= now()-interval '90 day' THEN '61_90'
            ELSE 'MAS_90' END AS antiguedad,
          GREATEST(0, EXTRACT(day FROM now()-MIN(due_at) FILTER (WHERE due_at < now())) )::int AS "diasVencido"
        FROM cartera GROUP BY id,nombre ORDER BY SUM(pendiente) DESC`);
      res.json({ clientes: result.rows });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/clientes/analitica",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const { desde, hasta } = period(req);
      const result = await pool.query(
        `SELECT
          COALESCE(SUM(l.importe), 0)::text AS ventas,
          COUNT(DISTINCT t.id)::int AS tickets,
          COALESCE(SUM(l.costo_total_congelado)
            FILTER (WHERE l.rollo_id IS NOT NULL AND l.costo_total_congelado > 0), 0)::text AS costo,
          COALESCE(SUM(l.importe - l.costo_total_congelado)
            FILTER (WHERE l.rollo_id IS NOT NULL AND l.costo_total_congelado > 0), 0)::text AS margen,
          COUNT(*) FILTER (WHERE l.rollo_id IS NULL OR l.costo_total_congelado <= 0)::int AS "lineasSinCosto",
          COALESCE(SUM(l.cantidad) FILTER (WHERE p.unidad = 'METRO'), 0)::text AS metros,
          COALESCE(SUM(l.cantidad) FILTER (WHERE p.unidad = 'KILO'), 0)::text AS kilos
        FROM tickets t
        JOIN ticket_lineas l ON l.ticket_id = t.id
        JOIN productos p ON p.id = l.producto_id
        WHERE t.estado = 'VENDIDO'
          AND ($1::date IS NULL OR t.created_at >= $1::date)
          AND ($2::date IS NULL OR t.created_at < $2::date + interval '1 day')`,
        [desde, hasta],
      );
      const [tops, pareto, segmentos, mensual, productosGlobal, coloresGlobal, riesgo] = await Promise.all([
        pool.query(
          `SELECT c.id,c.nombre,SUM(l.importe)::text AS ventas,
            COALESCE(SUM(l.importe-l.costo_total_congelado) FILTER
              (WHERE l.rollo_id IS NOT NULL AND l.costo_total_congelado>0),0)::text AS margen
           FROM tickets t JOIN clientes c ON c.id=t.cliente_id JOIN ticket_lineas l ON l.ticket_id=t.id
           WHERE t.estado='VENDIDO' AND ($1::date IS NULL OR t.created_at >= $1::date)
             AND ($2::date IS NULL OR t.created_at < $2::date+interval '1 day')
           GROUP BY c.id,c.nombre ORDER BY ventas DESC LIMIT 20`, [desde, hasta]),
        pool.query(
          `WITH x AS (SELECT c.id,c.nombre,SUM(l.importe) ventas FROM tickets t JOIN clientes c ON c.id=t.cliente_id JOIN ticket_lineas l ON l.ticket_id=t.id WHERE t.estado='VENDIDO' AND ($1::date IS NULL OR t.created_at >= $1::date) AND ($2::date IS NULL OR t.created_at < $2::date+interval '1 day') GROUP BY c.id,c.nombre)
           SELECT id,nombre,ventas::text, (SUM(ventas) OVER (ORDER BY ventas DESC)/NULLIF(SUM(ventas) OVER (),0))::text AS acumulado FROM x ORDER BY ventas DESC`, [desde, hasta]),
        pool.query(
          `SELECT CASE WHEN c.es_sistema THEN 'PUBLICO' ELSE 'REGISTRADO' END AS segmento,
             SUM(t.subtotal)::text AS ventas,COUNT(*)::int AS tickets
           FROM tickets t JOIN clientes c ON c.id=t.cliente_id WHERE t.estado='VENDIDO'
            AND ($1::date IS NULL OR t.created_at >= $1::date) AND ($2::date IS NULL OR t.created_at < $2::date+interval '1 day')
           GROUP BY c.es_sistema`, [desde, hasta]),
        pool.query(
          `SELECT to_char(t.created_at,'YYYY-MM') mes,SUM(l.importe)::text ventas,
             COALESCE(SUM(l.importe-l.costo_total_congelado) FILTER (WHERE l.rollo_id IS NOT NULL AND l.costo_total_congelado>0),0)::text margen
           FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id WHERE t.estado='VENDIDO'
            AND ($1::date IS NULL OR t.created_at >= $1::date) AND ($2::date IS NULL OR t.created_at < $2::date+interval '1 day')
           GROUP BY mes ORDER BY mes`, [desde, hasta]),
        pool.query(
          `SELECT p.id,p.sku,p.tela,p.color,p.unidad,SUM(l.cantidad)::text cantidad,SUM(l.importe)::text ventas
           FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id JOIN productos p ON p.id=l.producto_id
           WHERE t.estado='VENDIDO' AND ($1::date IS NULL OR t.created_at >= $1::date) AND ($2::date IS NULL OR t.created_at < $2::date+interval '1 day')
           GROUP BY p.id ORDER BY ventas DESC LIMIT 30`, [desde,hasta]),
        pool.query(
          `SELECT p.color,SUM(l.importe)::text ventas,SUM(l.cantidad)::text cantidad
           FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id JOIN productos p ON p.id=l.producto_id
           WHERE t.estado='VENDIDO' AND ($1::date IS NULL OR t.created_at >= $1::date) AND ($2::date IS NULL OR t.created_at < $2::date+interval '1 day')
           GROUP BY p.color ORDER BY ventas DESC LIMIT 30`, [desde,hasta]),
        pool.query(
          `SELECT c.id,c.nombre,MIN(t.created_at) AS "primeraCompra",MAX(t.created_at) AS "ultimaCompra",
            COALESCE((SELECT SUM(a.pendiente) FROM credit_fifo_aging(c.id) a WHERE a.due_at<now()),0)::text vencido
           FROM clientes c LEFT JOIN tickets t ON t.cliente_id=c.id AND t.estado='VENDIDO'
           WHERE NOT c.es_sistema GROUP BY c.id,c.nombre`, []),
      ]);
      res.json({
        periodo: { desde, hasta }, ...result.rows[0],
        topVentas: tops.rows,
        topMargen: [...tops.rows].sort((a, b) => Number(b.margen) - Number(a.margen)),
        pareto: pareto.rows,
        publicoVsRegistrado: segmentos.rows,
        mensual: mensual.rows,
        productos: productosGlobal.rows,
        colores: coloresGlobal.rows,
        clientesNuevos: riesgo.rows.filter((item) => item.primeraCompra && (!desde || new Date(item.primeraCompra) >= new Date(desde))),
        clientesRiesgo: riesgo.rows.filter((item) => Number(item.vencido) > 0),
        clientesInactivos: riesgo.rows.filter((item) => item.ultimaCompra && Date.now()-new Date(item.ultimaCompra).getTime() > 90*86400000),
        distribucionMargen: tops.rows.map((item) => ({ clienteId: item.id, margen: item.margen })),
      });
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_PERIOD") {
        res.status(400).json({ error: "Periodo inválido; usa YYYY-MM-DD." });
        return;
      }
      next(error);
    }
  },
);

router.get(
  "/clientes/analitica.xlsx",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const { desde, hasta } = period(req);
      const result = await pool.query(
        `SELECT c.nombre AS cliente, t.folio, t.created_at AS fecha,
          t.subtotal::text, p.unidad, l.cantidad::text,
          CASE WHEN l.rollo_id IS NOT NULL AND l.costo_total_congelado > 0
            THEN (l.importe - l.costo_total_congelado)::text END AS margen
         FROM tickets t JOIN clientes c ON c.id=t.cliente_id
         JOIN ticket_lineas l ON l.ticket_id=t.id
         JOIN productos p ON p.id=l.producto_id
         WHERE t.estado='VENDIDO'
           AND ($1::date IS NULL OR t.created_at >= $1::date)
           AND ($2::date IS NULL OR t.created_at < $2::date + interval '1 day')
         ORDER BY t.created_at DESC`,
        [desde, hasta],
      );
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Analítica");
      sheet.columns = [
        { header: "Cliente", key: "cliente", width: 28 },
        { header: "Folio", key: "folio", width: 12 },
        { header: "Fecha", key: "fecha", width: 22 },
        { header: "Subtotal", key: "subtotal", width: 14 },
        { header: "Unidad", key: "unidad", width: 12 },
        { header: "Cantidad", key: "cantidad", width: 14 },
        { header: "Margen", key: "margen", width: 14 },
      ];
      sheet.addRows(result.rows);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="analitica-clientes.xlsx"');
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/clientes/:id",
  requierePermiso("clientes", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10,
      );
      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const [row] = await db
        .select()
        .from(clientesTable)
        .where(eq(clientesTable.id, id))
        .limit(1);

      if (!row) {
        res.status(404).json({ error: "Cliente no encontrado." });
        return;
      }

      const permiso = await resolvePermiso(
        req.auth!.user.id,
        req.auth!.user.rol,
        "clientes_finanzas",
      );
      if (req.auth!.user.rol !== "ADMIN" && !permiso?.puedeVer) {
        res.json(presentClienteOperativo(row));
        return;
      }
      const [balance] = await db
        .select({
          saldo: sql<string>`COALESCE(SUM(${movimientosCreditoTable.importe}), 0)::text`,
        })
        .from(movimientosCreditoTable)
        .where(eq(movimientosCreditoTable.clienteId, id));
      res.json({
        ...presentClienteOperativo(row),
        limiteCredito: row.limiteCredito,
        saldoActual: balance?.saldo ?? "0.00",
      });
    } catch (e) {
      next(e);
    }
  },
);

// ── PATCH /clientes/:id ───────────────────────────────────────────────────────

router.patch(
  "/clientes/:id",
  requierePermiso("clientes", "editar"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10,
      );
      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const [before] = await db
        .select()
        .from(clientesTable)
        .where(eq(clientesTable.id, id))
        .limit(1);

      if (!before) {
        res.status(404).json({ error: "Cliente no encontrado." });
        return;
      }

      const { nombre, telefono, correo, direccion, rfc, notas, activo, contactoNombre, diasCredito, limiteCredito } =
        req.body as Record<string, unknown>;
      if (diasCredito !== undefined || limiteCredito !== undefined) {
        res.status(403).json({
          error: "Los términos de crédito solo se modifican en /clientes/:id/credito.",
        });
        return;
      }

      if (
        before.esSistema &&
        ((nombre !== undefined && nombre !== "Venta a Público") ||
          activo === false)
      ) {
        res.status(409).json({
          error: "Venta a Público es un cliente protegido y no puede renombrarse, desactivarse ni recibir crédito.",
          code: "SYSTEM_CLIENT_PROTECTED",
        });
        return;
      }

      const updates: Partial<typeof clientesTable.$inferInsert> = {};
      if (typeof nombre === "string") updates.nombre = nombre.trim();
      if (typeof telefono === "string" || telefono === null)
        updates.telefono = telefono as string | null;
      if (typeof correo === "string" || correo === null)
        updates.correo = correo as string | null;
      if (typeof direccion === "string" || direccion === null)
        updates.direccion = direccion as string | null;
      if (typeof rfc === "string" || rfc === null)
        updates.rfc = rfc as string | null;
      if (typeof notas === "string" || notas === null)
        updates.notas = notas as string | null;
      if (typeof activo === "boolean") updates.activo = activo;
      if (typeof contactoNombre === "string" || contactoNombre === null)
        updates.contactoNombre = contactoNombre as string | null;

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ error: "No se enviaron cambios." });
        return;
      }

      const [updated] = await db
        .update(clientesTable)
        .set(updates)
        .where(eq(clientesTable.id, id))
        .returning();

      await db.insert(auditoriaTable).values({
        usuarioId: req.auth!.user.id,
        accion: "ACTUALIZAR",
        entidad: "clientes",
        entidadId: String(id),
        datosAntes: presentClienteOperativo(before) as Record<string, unknown>,
        datosDespues: presentClienteOperativo(updated) as Record<string, unknown>,
        ip: getRequestIp(req),
      });

      res.json(presentClienteOperativo(updated));
    } catch (e) {
      next(e);
    }
  },
);

// ── GET /clientes/:id/credito ─────────────────────────────────────────────────
// clientes_credito module: limit, balance, available, canBuyCredit

router.get(
  "/clientes/:id/credito",
  requierePermiso("clientes_credito", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10,
      );
      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const [row] = await db
        .select()
        .from(clientesTable)
        .where(eq(clientesTable.id, id))
        .limit(1);

      if (!row) {
        res.status(404).json({ error: "Cliente no encontrado." });
        return;
      }

      const [balance] = await db
        .select({
          saldo: sql<string>`COALESCE(SUM(${movimientosCreditoTable.importe}), 0)::text`,
        })
        .from(movimientosCreditoTable)
        .where(eq(movimientosCreditoTable.clienteId, id));
      const limite = parseFloat(row.limiteCredito ?? "0");
      const saldo = parseFloat(balance?.saldo ?? "0");
      const disponible = Math.max(0, limite - saldo);
      const puedeComprarCredito = disponible > 0;
      const aging = await pool.query(
        `SELECT due_at AS "fechaVencimiento",pendiente::text,
          GREATEST(0,EXTRACT(day FROM now()-due_at))::int AS "diasVencido"
         FROM credit_fifo_aging($1) ORDER BY due_at`,
        [id],
      );
      const activity = await pool.query(
        `SELECT MIN(created_at) FILTER (WHERE estado='VENDIDO') AS "primeraCompra",
          GREATEST(MAX(created_at), (SELECT MAX(created_at) FROM movimientos_credito WHERE cliente_id=$1)) AS "ultimaActividad"
         FROM tickets WHERE cliente_id=$1`,
        [id],
      );
      const totalVencido = aging.rows
        .filter((item) => item.diasVencido > 0)
        .reduce((sum, item) => sum + Number(item.pendiente), 0);

      res.json({
        clienteId: row.id,
        limiteCredito: row.limiteCredito,
        saldoActual: saldo.toFixed(2),
        creditoDisponible: disponible.toFixed(2),
        puedeComprarCredito,
        diasCredito: row.diasCredito,
        utilizacion: limite > 0 ? ((saldo / limite) * 100).toFixed(2) : "0.00",
        totalVencido: totalVencido.toFixed(2),
        primerVencimiento: aging.rows[0]?.fechaVencimiento ?? null,
        primeraCompra: activity.rows[0]?.primeraCompra ?? null,
        ultimaActividad: activity.rows[0]?.ultimaActividad ?? null,
        antiguedad: aging.rows,
      });
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/clientes/:id/credito",
  requierePermiso("clientes_credito", "editar"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseId(req.params.id);
      const limiteCredito = Number(req.body?.limiteCredito);
      const diasCredito = Number(req.body?.diasCredito);
      if (
        !id ||
        !Number.isFinite(limiteCredito) ||
        limiteCredito < 0 ||
        !Number.isInteger(diasCredito) ||
        diasCredito < 0
      ) {
        res.status(400).json({ error: "Límite y días de crédito válidos son obligatorios." });
        return;
      }
      const [client] = await db
        .select({ id: clientesTable.id, esSistema: clientesTable.esSistema })
        .from(clientesTable)
        .where(eq(clientesTable.id, id))
        .limit(1);
      if (!client) {
        res.status(404).json({ error: "Cliente no encontrado." });
        return;
      }
      if (client.esSistema) {
        res.status(409).json({ error: "Venta a Público no admite términos de crédito." });
        return;
      }
      const [updated] = await db
        .update(clientesTable)
        .set({ limiteCredito: limiteCredito.toFixed(2), diasCredito })
        .where(eq(clientesTable.id, id))
        .returning();
      await db.insert(auditoriaTable).values({
        usuarioId: req.auth!.user.id,
        accion: "ACTUALIZAR_CREDITO",
        entidad: "clientes",
        entidadId: String(id),
        datosDespues: { limiteCredito: updated!.limiteCredito, diasCredito },
        ip: getRequestIp(req),
      });
      res.json({
        clienteId: id,
        limiteCredito: updated!.limiteCredito,
        diasCredito: updated!.diasCredito,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ── GET /clientes/:id/precios ─────────────────────────────────────────────────
// clientes_precios module: only unit prices + date + avg-3. No amounts, no quantities.

router.get(
  "/clientes/:id/precios",
  requierePermiso("clientes_precios", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10,
      );
      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const [row] = await db
        .select({ id: clientesTable.id })
        .from(clientesTable)
        .where(eq(clientesTable.id, id))
        .limit(1);

      if (!row) {
        res.status(404).json({ error: "Cliente no encontrado." });
        return;
      }

      const rows = await db
        .select({
          productoId: ticketLineasTable.productoId,
          sku: productosTable.sku,
          precioUnitario: ticketLineasTable.precioUnitario,
          fecha: ticketsTable.createdAt,
        })
        .from(ticketLineasTable)
        .innerJoin(
          ticketsTable,
          eq(ticketLineasTable.ticketId, ticketsTable.id),
        )
        .innerJoin(
          productosTable,
          eq(ticketLineasTable.productoId, productosTable.id),
        )
        .where(
          and(
            eq(ticketsTable.clienteId, id),
            eq(ticketsTable.estado, "VENDIDO"),
          ),
        )
        .orderBy(desc(ticketsTable.createdAt))
        .limit(200);
      const latestByProduct = new Map<number, string[]>();
      for (const item of rows) {
        const list = latestByProduct.get(item.productoId) ?? [];
        if (list.length < 3) list.push(item.precioUnitario);
        latestByProduct.set(item.productoId, list);
      }
      res.json({
        clienteId: id,
        precios: rows.map((item) => {
          const recent = latestByProduct.get(item.productoId) ?? [];
          const promedio =
            recent.reduce((sum, value) => sum + Number(value), 0) /
            Math.max(recent.length, 1);
          return {
            productoId: item.productoId,
            sku: item.sku,
            precioUnitario: item.precioUnitario,
            fecha: item.fecha.toISOString().slice(0, 10),
            promedio3: promedio.toFixed(2),
          };
        }),
        nota: null,
      });
    } catch (e) {
      next(e);
    }
  },
);

// ── GET /clientes/:id/estado-cuenta ──────────────────────────────────────────
// clientes_finanzas module

router.get(
  "/clientes/:id/estado-cuenta",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10,
      );
      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const [row] = await db
        .select({
          id: clientesTable.id,
        })
        .from(clientesTable)
        .where(eq(clientesTable.id, id))
        .limit(1);

      if (!row) {
        res.status(404).json({ error: "Cliente no encontrado." });
        return;
      }

      const { desde, hasta } = period(req);
      const tipo = typeof req.query.tipo === "string" ? req.query.tipo : null;
      if (
        tipo &&
        !["VENTA_CREDITO", "ABONO", "REVERSO", "AJUSTE"].includes(tipo)
      ) {
        res.status(400).json({ error: "Tipo de movimiento inválido." });
        return;
      }
      const [movements, balance] = await Promise.all([
        pool.query(
          `WITH ledger AS (
             SELECT m.id, m.tipo, m.importe, m.created_at, m.notas,
               m.forma_pago, m.referencia, t.folio AS ticket_folio,
               u.nombre AS nombre_usuario,
               SUM(m.importe) OVER (ORDER BY m.created_at,m.id) AS saldo_corrido
             FROM movimientos_credito m
             LEFT JOIN tickets t ON t.id=m.ticket_id
             JOIN usuarios u ON u.id=m.usuario_id
             WHERE m.cliente_id=$1
           )
           SELECT id, tipo, importe::text, created_at AS fecha,
             created_at AS "fechaEfectiva", notas, forma_pago AS "formaPago",
             referencia, ticket_folio AS "ticketFolio",
             nombre_usuario AS "nombreUsuario", saldo_corrido::text AS "saldoCorrido"
           FROM ledger
           WHERE ($2::date IS NULL OR created_at >= $2::date)
             AND ($3::date IS NULL OR created_at < $3::date+interval '1 day')
             AND ($4::text IS NULL OR tipo::text=$4)
           ORDER BY created_at,id`,
          [id, desde, hasta, tipo],
        ),
        pool.query<{ saldo: string }>(
          `SELECT COALESCE(SUM(importe),0)::text AS saldo
           FROM movimientos_credito WHERE cliente_id=$1`,
          [id],
        ),
      ]);
      const withBalance = movements.rows;
      res.json({
        clienteId: id,
        movimientos: [...withBalance].reverse(),
        saldoActual: balance.rows[0]?.saldo ?? "0.00",
      });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/clientes/:id/estado-cuenta/imprimir",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }
      const client = await pool.query(
        "SELECT nombre FROM clientes WHERE id=$1",
        [id],
      );
      if (!client.rows[0]) {
        res.status(404).json({ error: "Cliente no encontrado." });
        return;
      }
      const movements = await pool.query(
        `SELECT created_at, tipo, importe::text, notas,
           SUM(importe) OVER (ORDER BY created_at, id)::text AS saldo
         FROM movimientos_credito WHERE cliente_id=$1
         ORDER BY created_at, id`,
        [id],
      );
      const escape = (value: unknown) =>
        String(value ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;");
      const rows = movements.rows
        .map(
          (item) =>
            `<tr><td>${escape(new Date(item.created_at).toLocaleDateString("es-MX"))}</td><td>${escape(item.tipo)}</td><td>${escape(item.importe)}</td><td>${escape(item.saldo)}</td><td>${escape(item.notas)}</td></tr>`,
        )
        .join("");
      res.type("html").send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Estado de cuenta</title><style>@page{size:A4;margin:15mm}body{font:12px Arial}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:6px;text-align:left}@media print{button{display:none}}</style></head><body><button onclick="print()">Imprimir / guardar PDF</button><h1>Estado de cuenta</h1><h2>${escape(client.rows[0].nombre)}</h2><table><thead><tr><th>Fecha</th><th>Movimiento</th><th>Importe</th><th>Saldo</th><th>Notas</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/clientes/:id/estado-cuenta.xlsx",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }
      const result = await pool.query(
        `SELECT m.created_at AS fecha,m.tipo,m.importe::text AS importe,
          m.forma_pago AS "formaPago",m.referencia,t.folio AS folio,
          u.nombre AS usuario,SUM(m.importe) OVER (ORDER BY m.created_at,m.id)::text AS saldo
         FROM movimientos_credito m LEFT JOIN tickets t ON t.id=m.ticket_id
         JOIN usuarios u ON u.id=m.usuario_id WHERE m.cliente_id=$1 ORDER BY m.created_at,m.id`,
        [id],
      );
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Estado de cuenta");
      sheet.columns = [
        { header: "Fecha", key: "fecha", width: 22 }, { header: "Tipo", key: "tipo", width: 18 },
        { header: "Importe", key: "importe", width: 14 }, { header: "Saldo", key: "saldo", width: 14 },
        { header: "Folio", key: "folio", width: 12 }, { header: "Forma de pago", key: "formaPago", width: 18 },
        { header: "Referencia", key: "referencia", width: 24 }, { header: "Usuario", key: "usuario", width: 24 },
      ];
      sheet.addRows(result.rows);
      res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.attachment(`estado-cuenta-${id}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/clientes/:id/estado-cuenta.pdf",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }
      const result = await pool.query(
        `SELECT m.created_at,m.tipo,m.importe::text,t.folio,
          SUM(m.importe) OVER (ORDER BY m.created_at,m.id)::text saldo
         FROM movimientos_credito m LEFT JOIN tickets t ON t.id=m.ticket_id
         WHERE m.cliente_id=$1 ORDER BY m.created_at,m.id`,
        [id],
      );
      const pdf = createTextPdf(
        `Estado de cuenta - cliente ${id}`,
        result.rows.map((row) =>
          `${new Date(row.created_at).toISOString().slice(0, 10)} | ${row.tipo} | ${row.importe} | saldo ${row.saldo} | folio ${row.folio ?? "-"}`,
        ),
      );
      res.type("application/pdf");
      res.attachment(`estado-cuenta-${id}.pdf`);
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/clientes/cartera.xlsx",
  requierePermiso("clientes_finanzas", "ver"),
  async (_req, res, next): Promise<void> => {
    try {
      const result = await pool.query(`
        SELECT c.nombre, SUM(a.pendiente)::text AS saldo,
          COALESCE(SUM(a.pendiente) FILTER (WHERE a.due_at < now()),0)::text AS vencido,
          MIN(a.due_at) AS "primerVencimiento"
        FROM clientes c JOIN LATERAL credit_fifo_aging(c.id) a ON true
        WHERE c.activo AND NOT c.es_sistema GROUP BY c.id,c.nombre ORDER BY SUM(a.pendiente) DESC`);
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Cartera");
      sheet.columns = [
        { header: "Cliente", key: "nombre", width: 30 }, { header: "Saldo", key: "saldo", width: 15 },
        { header: "Vencido", key: "vencido", width: 15 }, { header: "Primer vencimiento", key: "primerVencimiento", width: 22 },
      ];
      sheet.addRows(result.rows);
      res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.attachment("cartera-clientes.xlsx");
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/clientes/cartera.pdf",
  requierePermiso("clientes_finanzas", "ver"),
  async (_req, res, next): Promise<void> => {
    try {
      const result = await pool.query(`
        SELECT c.nombre,SUM(a.pendiente)::text saldo,
          COALESCE(SUM(a.pendiente) FILTER (WHERE a.due_at<now()),0)::text vencido
        FROM clientes c JOIN LATERAL credit_fifo_aging(c.id) a ON true
        WHERE c.activo AND NOT c.es_sistema GROUP BY c.id,c.nombre ORDER BY SUM(a.pendiente) DESC`);
      const pdf = createTextPdf(
        "Cartera de clientes",
        result.rows.map((row) => `${row.nombre} | saldo ${row.saldo} | vencido ${row.vencido}`),
      );
      res.type("application/pdf");
      res.attachment("cartera-clientes.pdf");
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  },
);

// ── GET /clientes/:id/compras ─────────────────────────────────────────────────
// clientes_finanzas module

router.get(
  "/clientes/:id/compras",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10,
      );
      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const { desde, hasta } = period(req);
      const result = await pool.query(
        `SELECT t.id, t.folio, t.created_at AS fecha, t.subtotal::text,
          t.iva::text, t.total::text,
          COALESCE(SUM(l.cantidad) FILTER (WHERE p.unidad='METRO'), 0)::text AS metros,
          COALESCE(SUM(l.cantidad) FILTER (WHERE p.unidad='KILO'), 0)::text AS kilos,
          CASE WHEN COUNT(*) FILTER
            (WHERE l.rollo_id IS NULL OR l.costo_total_congelado <= 0) = 0
            THEN SUM(l.importe-l.costo_total_congelado)::text END AS margen,
          COUNT(*) FILTER
            (WHERE l.rollo_id IS NULL OR l.costo_total_congelado <= 0)::int AS "lineasSinCosto"
         FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id
         JOIN productos p ON p.id=l.producto_id
         WHERE t.cliente_id=$1 AND t.estado='VENDIDO'
           AND ($2::date IS NULL OR t.created_at >= $2::date)
           AND ($3::date IS NULL OR t.created_at < $3::date + interval '1 day')
         GROUP BY t.id ORDER BY t.created_at DESC`,
        [id, desde, hasta],
      );
      res.json({
        clienteId: id,
        periodo: { desde, hasta },
        compras: result.rows,
        total: result.rowCount ?? 0,
      });
    } catch (e) {
      if (e instanceof Error && e.message === "INVALID_PERIOD") {
        res.status(400).json({ error: "Periodo inválido; usa YYYY-MM-DD." });
        return;
      }
      next(e);
    }
  },
);

router.get(
  "/clientes/:id/analitica",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }
      const { desde, hasta } = period(req);
      const args = [id, desde, hasta];
      const [productos, telas, tendencia, pagos, actividad, facturacion, financiero, semana] = await Promise.all([
        pool.query(`SELECT p.id,p.sku,p.tela,p.color,p.unidad,SUM(l.cantidad)::text cantidad,SUM(l.importe)::text ventas,
          MAX(t.created_at) AS "ultimaCompra",
          SUM((l.precio_sugerido*l.cantidad)-l.importe)::text AS descuento,
          COALESCE(SUM(l.importe-l.costo_total_congelado) FILTER (WHERE l.rollo_id IS NOT NULL AND l.costo_total_congelado>0),0)::text margen
          FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id JOIN productos p ON p.id=l.producto_id
          WHERE t.cliente_id=$1 AND t.estado='VENDIDO' AND ($2::date IS NULL OR t.created_at >= $2::date) AND ($3::date IS NULL OR t.created_at < $3::date+interval '1 day')
          GROUP BY p.id ORDER BY ventas DESC`, args),
        pool.query(`SELECT p.tela,p.color,SUM(l.importe)::text ventas,COUNT(DISTINCT t.id)::int tickets
          FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id JOIN productos p ON p.id=l.producto_id
          WHERE t.cliente_id=$1 AND t.estado='VENDIDO' AND ($2::date IS NULL OR t.created_at >= $2::date) AND ($3::date IS NULL OR t.created_at < $3::date+interval '1 day')
          GROUP BY p.tela,p.color ORDER BY ventas DESC`, args),
        pool.query(`SELECT to_char(created_at,'YYYY-MM') mes,COUNT(*)::int tickets,SUM(subtotal)::text ventas
          FROM tickets WHERE cliente_id=$1 AND estado='VENDIDO' AND ($2::date IS NULL OR created_at >= $2::date) AND ($3::date IS NULL OR created_at < $3::date+interval '1 day') GROUP BY mes ORDER BY mes`, args),
        pool.query(`SELECT forma_pago AS forma,COALESCE(SUM(-importe),0)::text importe,COUNT(*)::int movimientos
          FROM movimientos_credito WHERE cliente_id=$1 AND tipo='ABONO' AND ($2::date IS NULL OR created_at >= $2::date) AND ($3::date IS NULL OR created_at < $3::date+interval '1 day') GROUP BY forma_pago`, args),
        pool.query(`SELECT MAX(created_at) AS "ultimaCompra",COUNT(*)::int tickets,AVG(total)::text AS "ticketPromedio",
          MAX(total)::text AS "ticketMaximo" FROM tickets WHERE cliente_id=$1 AND estado='VENDIDO' AND ($2::date IS NULL OR created_at >= $2::date) AND ($3::date IS NULL OR created_at < $3::date+interval '1 day')`, args),
        pool.query(`SELECT facturado,COUNT(*)::int tickets,SUM(subtotal)::text subtotal,SUM(iva)::text iva FROM tickets
          WHERE cliente_id=$1 AND estado='VENDIDO' AND ($2::date IS NULL OR created_at >= $2::date) AND ($3::date IS NULL OR created_at < $3::date+interval '1 day') GROUP BY facturado`, args),
        pool.query(`WITH s AS (SELECT created_at,SUM(importe) OVER (ORDER BY created_at,id) saldo FROM movimientos_credito WHERE cliente_id=$1)
          SELECT COALESCE(MAX(saldo),0)::text AS "saldoMaximo",
            (SELECT AVG(EXTRACT(day FROM m.created_at-t.created_at))::text FROM movimientos_credito m JOIN tickets t ON t.id=m.ticket_id WHERE m.cliente_id=$1 AND m.tipo='ABONO') AS "diasPromedioPago"
          FROM s`, [id]),
        pool.query(`SELECT EXTRACT(isodow FROM created_at)::int dia,COUNT(*)::int tickets,SUM(subtotal)::text ventas
          FROM tickets WHERE cliente_id=$1 AND estado='VENDIDO' AND ($2::date IS NULL OR created_at >= $2::date) AND ($3::date IS NULL OR created_at < $3::date+interval '1 day') GROUP BY dia ORDER BY dia`, args),
      ]);
      const totalVentas = productos.rows.reduce((sum, item) => sum + Number(item.ventas), 0);
      res.json({
        clienteId: id,
        periodo: { desde, hasta },
        productos: productos.rows.map((item) => ({
          ...item,
          participacion: totalVentas > 0 ? (Number(item.ventas) / totalVentas).toFixed(4) : "0",
          detenido: item.ultimaCompra
            ? Date.now() - new Date(item.ultimaCompra).getTime() > 90 * 86400000
            : true,
        })),
        telasColores: telas.rows,
        tendencia: tendencia.rows,
        estacionalidadMensual: tendencia.rows,
        mezclaPagos: pagos.rows,
        actividad: actividad.rows[0],
        frecuencia: { tickets: actividad.rows[0]?.tickets ?? 0, porMes: tendencia.rows },
        facturacion: facturacion.rows,
        financiero: financiero.rows[0],
        diaSemana: semana.rows,
        concentracion: productos.rows[0]
          ? { productoPrincipal: productos.rows[0].sku, porcentaje: (Number(productos.rows[0].ventas) / Math.max(totalVentas, 1) * 100).toFixed(2) }
          : null,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_PERIOD") {
        res.status(400).json({ error: "Periodo inválido; usa YYYY-MM-DD." });
        return;
      }
      next(error);
    }
  },
);

// ── GET /clientes/:id/estadisticas ────────────────────────────────────────────
// clientes_finanzas module

router.get(
  "/clientes/:id/estadisticas",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10,
      );
      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const { desde, hasta } = period(req);
      const result = await pool.query(
        `SELECT COALESCE(SUM(l.importe),0)::text AS "totalCompras",
          COUNT(DISTINCT t.id)::int AS "comprasCount",
          COALESCE(SUM(l.cantidad) FILTER (WHERE p.unidad='METRO'),0)::text AS metros,
          COALESCE(SUM(l.cantidad) FILTER (WHERE p.unidad='KILO'),0)::text AS kilos,
          COALESCE(SUM(l.costo_total_congelado) FILTER
            (WHERE l.rollo_id IS NOT NULL AND l.costo_total_congelado > 0),0)::text AS costo,
          COALESCE(SUM(l.importe-l.costo_total_congelado) FILTER
            (WHERE l.rollo_id IS NOT NULL AND l.costo_total_congelado > 0),0)::text AS margen,
          COUNT(*) FILTER
            (WHERE l.rollo_id IS NULL OR l.costo_total_congelado <= 0)::int AS "lineasSinCosto"
         FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id
         JOIN productos p ON p.id=l.producto_id
         WHERE t.cliente_id=$1 AND t.estado='VENDIDO'
           AND ($2::date IS NULL OR t.created_at >= $2::date)
           AND ($3::date IS NULL OR t.created_at < $3::date + interval '1 day')`,
        [id, desde, hasta],
      );
      const summary = result.rows[0];
      res.json({
        clienteId: id,
        periodo: { desde, hasta },
        totalCompras: summary?.totalCompras ?? "0.00",
        comprasCount: summary?.comprasCount ?? 0,
        metros: summary?.metros ?? "0.000",
        kilos: summary?.kilos ?? "0.000",
        costo: summary?.costo ?? "0.00",
        margen: summary?.margen ?? "0.00",
        lineasSinCosto: summary?.lineasSinCosto ?? 0,
      });
    } catch (e) {
      if (e instanceof Error && e.message === "INVALID_PERIOD") {
        res.status(400).json({ error: "Periodo inválido; usa YYYY-MM-DD." });
        return;
      }
      next(e);
    }
  },
);

// ── GET /clientes/:id/pagos ───────────────────────────────────────────────────
// clientes_finanzas module

router.get(
  "/clientes/:id/pagos",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10,
      );
      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const rows = await db
        .select({
          id: movimientosCreditoTable.id,
          importe: movimientosCreditoTable.importe,
          fecha: movimientosCreditoTable.createdAt,
          formaPago: movimientosCreditoTable.formaPago,
          referencia: movimientosCreditoTable.referencia,
          ticketId: movimientosCreditoTable.ticketId,
          notas: movimientosCreditoTable.notas,
        })
        .from(movimientosCreditoTable)
        .where(
          and(
            eq(movimientosCreditoTable.clienteId, id),
            eq(movimientosCreditoTable.tipo, "ABONO"),
          ),
        )
        .orderBy(desc(movimientosCreditoTable.createdAt));
      res.json({
        clienteId: id,
        pagos: rows,
      });
    } catch (e) {
      next(e);
    }
  },
);

// ── POST /clientes/:id/pagos ──────────────────────────────────────────────────
// clientes_finanzas module + crear

router.post(
  "/clientes/:id/pagos",
  requierePermiso("clientes_finanzas", "crear"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10,
      );
      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const body = CreateClientePagoBody.parse(req.body);
      if (body.formaPago !== "EFECTIVO" && body.formaPago !== "TRANSFERENCIA") {
        res.status(400).json({ error: "Forma de pago inválida." });
        return;
      }
      const fechaEfectiva = body.fechaEfectiva
        ? new Date(body.fechaEfectiva)
        : new Date();
      if (Number.isNaN(fechaEfectiva.getTime()) || fechaEfectiva > new Date()) {
        res.status(400).json({ error: "Fecha efectiva inválida o futura." });
        return;
      }
      const result = await db.transaction(async (tx) => {
        const [client] = await tx
          .select()
          .from(clientesTable)
          .where(eq(clientesTable.id, id))
          .for("update")
          .limit(1);
        if (!client) return null;
        if (body.ticketId != null) {
          const [ticket] = await tx
            .select({ id: ticketsTable.id })
            .from(ticketsTable)
            .where(
              and(
                eq(ticketsTable.id, body.ticketId),
                eq(ticketsTable.clienteId, id),
              ),
            )
            .limit(1);
          if (!ticket) throw new Error("INVALID_PAYMENT_TICKET");
        }
        const importe = body.importe.toFixed(2);
        if (client.esSistema) throw new Error("SYSTEM_CLIENT_CREDIT");
        const [balance] = await tx
          .select({
            saldo: sql<string>`COALESCE(SUM(${movimientosCreditoTable.importe}), 0)::text`,
          })
          .from(movimientosCreditoTable)
          .where(eq(movimientosCreditoTable.clienteId, id));
        if (Number(importe) > Number(balance?.saldo ?? "0")) {
          throw new Error("PAYMENT_EXCEEDS_BALANCE");
        }
        const [created] = await tx
          .insert(movimientosCreditoTable)
          .values({
            clienteId: id,
            ticketId: body.ticketId ?? null,
            tipo: "ABONO",
            importe: `-${importe}`,
            usuarioId: req.auth!.user.id,
            notas: [
              `Forma: ${body.formaPago}`,
              body.referencia ? `Referencia: ${body.referencia}` : null,
              body.notas ?? null,
            ]
              .filter(Boolean)
              .join(" · "),
            formaPago: body.formaPago as "EFECTIVO" | "TRANSFERENCIA",
            referencia: body.referencia ?? null,
            createdAt: fechaEfectiva,
            metadata: JSON.stringify({
              origen: "CLIENTES",
              notas: body.notas ?? null,
              fechaCaptura: new Date().toISOString(),
            }),
          })
          .returning();
        await tx.insert(auditoriaTable).values({
          usuarioId: req.auth!.user.id,
          accion: "PAGO_CLIENTE",
          entidad: "clientes",
          entidadId: String(id),
          datosDespues: {
            movimientoCreditoId: created!.id,
            importe,
            formaPago: body.formaPago,
          },
          ip: getRequestIp(req),
        });
        return created!;
      });
      if (!result) {
        res.status(404).json({ error: "Cliente no encontrado." });
        return;
      }
      res.status(201).json(
        CreateClientePagoResponse.parse({
          id: result.id,
          clienteId: id,
        }),
      );
    } catch (e) {
      if (e instanceof Error && e.message === "PAYMENT_EXCEEDS_BALANCE") {
        res.status(400).json({
          error: "El pago no puede exceder el saldo actual.",
        });
        return;
      }
      if (e instanceof Error && e.message === "SYSTEM_CLIENT_CREDIT") {
        res.status(400).json({ error: "Venta a Público no admite movimientos de crédito." });
        return;
      }
      if (e instanceof Error && e.message === "INVALID_PAYMENT_TICKET") {
        res.status(400).json({ error: "El ticket no pertenece al cliente." });
        return;
      }
      next(e);
    }
  },
);

router.post(
  "/clientes/:id/ajustes",
  requierePermiso("clientes_finanzas", "autorizar"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseId(req.params.id);
      const importe = Number(req.body?.importe);
      const motivo =
        typeof req.body?.motivo === "string" ? req.body.motivo.trim() : "";
      const fechaEfectiva =
        typeof req.body?.fechaEfectiva === "string"
          ? new Date(req.body.fechaEfectiva)
          : new Date();
      if (!id || !Number.isFinite(importe) || importe === 0 || motivo.length < 10) {
        res.status(400).json({
          error: "Importe distinto de cero y motivo de al menos 10 caracteres son obligatorios.",
        });
        return;
      }
      if (Number.isNaN(fechaEfectiva.getTime()) || fechaEfectiva > new Date()) {
        res.status(400).json({ error: "Fecha efectiva inválida o futura." });
        return;
      }
      const ticketId =
        Number.isInteger(Number(req.body?.ticketId))
          ? Number(req.body.ticketId)
          : null;
      if (!canLinkAdjustmentToTicket(importe, ticketId)) {
        res.status(400).json({
          error:
            "Los ajustes negativos se aplican por antigüedad y no pueden ligarse a un ticket.",
        });
        return;
      }
      const result = await db.transaction(async (tx) => {
        const [client] = await tx
          .select({ id: clientesTable.id, esSistema: clientesTable.esSistema })
          .from(clientesTable)
          .where(eq(clientesTable.id, id))
          .for("update")
          .limit(1);
        if (!client) return null;
        if (client.esSistema) throw new Error("SYSTEM_CLIENT_CREDIT");
        if (ticketId != null) {
          const [ticket] = await tx
            .select({ id: ticketsTable.id })
            .from(ticketsTable)
            .where(
              and(
                eq(ticketsTable.id, ticketId),
                eq(ticketsTable.clienteId, id),
              ),
            )
            .limit(1);
          if (!ticket) throw new Error("INVALID_PAYMENT_TICKET");
        }
        const [created] = await tx
          .insert(movimientosCreditoTable)
          .values({
            clienteId: id,
            tipo: "AJUSTE",
            importe: importe.toFixed(2),
            usuarioId: req.auth!.user.id,
            notas: motivo,
            ticketId,
            referencia:
              typeof req.body?.referencia === "string"
                ? req.body.referencia
                : null,
            createdAt: fechaEfectiva,
            metadata: JSON.stringify({
              origen: "AJUSTE_MANUAL",
              ip: getRequestIp(req),
            }),
          })
          .returning();
        await tx.insert(auditoriaTable).values({
          usuarioId: req.auth!.user.id,
          accion: "AJUSTE_CREDITO",
          entidad: "clientes",
          entidadId: String(id),
          datosDespues: { movimientoCreditoId: created!.id, importe, motivo },
          ip: getRequestIp(req),
        });
        return created;
      });
      if (!result) {
        res.status(404).json({ error: "Cliente no encontrado." });
        return;
      }
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "SYSTEM_CLIENT_CREDIT") {
        res.status(400).json({ error: "Venta a Público no admite ajustes de crédito." });
        return;
      }
      if (error instanceof Error && error.message === "INVALID_PAYMENT_TICKET") {
        res.status(400).json({ error: "El ticket no pertenece al cliente." });
        return;
      }
      next(error);
    }
  },
);

export default router;
