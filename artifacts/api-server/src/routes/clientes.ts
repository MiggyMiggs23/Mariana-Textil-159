import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  CreateClientePagoBody,
  CreateClientePagoResponse,
} from "@workspace/api-zod";
import {
  auditoriaTable,
  clientesTable,
  db,
  movimientosCreditoTable,
  productosTable,
  ticketLineasTable,
  ticketsTable,
} from "@workspace/db";
import { requireSession } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { getRequestIp } from "../lib/request";

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
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── GET /clientes/resumen ─────────────────────────────────────────────────────
// Must come BEFORE /:id to avoid Express matching "resumen" as an id.
// clientes_finanzas module (cartera, vencidos)

router.get(
  "/clientes/resumen",
  requierePermiso("clientes_finanzas", "ver"),
  async (_req, res, next): Promise<void> => {
    try {
      const [row] = await db
        .select({
          totalClientes: sql<number>`COUNT(*)::int`,
          clientesConSaldo: sql<number>`COUNT(*) FILTER (WHERE ${clientesTable.saldoCredito} > 0)::int`,
          totalCartera: sql<string>`COALESCE(SUM(${clientesTable.saldoCredito}), 0)::text`,
        })
        .from(clientesTable)
        .where(eq(clientesTable.activo, true));
      res.json({
        totalClientes: row?.totalClientes ?? 0,
        clientesConSaldo: row?.clientesConSaldo ?? 0,
        totalCartera: row?.totalCartera ?? "0.00",
        totalVencido: "0.00",
      });
    } catch (e) {
      next(e);
    }
  },
);

// ── GET /clientes ─────────────────────────────────────────────────────────────

router.get(
  "/clientes",
  requierePermiso("clientes", "ver"),
  async (_req, res, next): Promise<void> => {
    try {
      const rows = await db
        .select()
        .from(clientesTable)
        .orderBy(clientesTable.nombre);

      res.json(rows.map(presentClienteOperativo));
    } catch (e) {
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
      const { nombre, telefono, correo, direccion, rfc, notas } =
        req.body as Record<string, unknown>;

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

      res.json(presentClienteOperativo(row));
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

      const { nombre, telefono, correo, direccion, rfc, notas, activo } =
        req.body as Record<string, unknown>;

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

      const limite = parseFloat(row.limiteCredito ?? "0");
      const saldo = parseFloat(row.saldoCredito ?? "0");
      const disponible = Math.max(0, limite - saldo);
      const puedeComprarCredito = disponible > 0;

      res.json({
        clienteId: row.id,
        limiteCredito: row.limiteCredito,
        saldoActual: row.saldoCredito,
        creditoDisponible: disponible.toFixed(2),
        puedeComprarCredito,
      });
    } catch (e) {
      next(e);
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
          saldoCredito: clientesTable.saldoCredito,
        })
        .from(clientesTable)
        .where(eq(clientesTable.id, id))
        .limit(1);

      if (!row) {
        res.status(404).json({ error: "Cliente no encontrado." });
        return;
      }

      const movements = await db
        .select({
          tipo: movimientosCreditoTable.tipo,
          importe: movimientosCreditoTable.importe,
          fecha: movimientosCreditoTable.createdAt,
          notas: movimientosCreditoTable.notas,
        })
        .from(movimientosCreditoTable)
        .where(eq(movimientosCreditoTable.clienteId, id))
        .orderBy(desc(movimientosCreditoTable.createdAt));
      res.json({
        clienteId: id,
        movimientos: movements,
        saldoActual: row.saldoCredito,
      });
    } catch (e) {
      next(e);
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

      const rows = await db
        .select({
          id: ticketsTable.id,
          fecha: ticketsTable.createdAt,
          total: ticketsTable.total,
        })
        .from(ticketsTable)
        .where(
          and(
            eq(ticketsTable.clienteId, id),
            eq(ticketsTable.estado, "VENDIDO"),
          ),
        )
        .orderBy(desc(ticketsTable.createdAt));
      res.json({
        clienteId: id,
        compras: rows,
        total: rows.length,
      });
    } catch (e) {
      next(e);
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

      const [summary] = await db
        .select({
          totalCompras: sql<string>`COALESCE(SUM(${ticketsTable.total}), 0)::text`,
          comprasCount: sql<number>`COUNT(*)::int`,
        })
        .from(ticketsTable)
        .where(
          and(
            eq(ticketsTable.clienteId, id),
            eq(ticketsTable.estado, "VENDIDO"),
          ),
        );
      res.json({
        clienteId: id,
        totalCompras: summary?.totalCompras ?? "0.00",
        comprasCount: summary?.comprasCount ?? 0,
      });
    } catch (e) {
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
        pagos: rows.map((row) => ({ ...row, formaPago: null })),
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
      const result = await db.transaction(async (tx) => {
        const [client] = await tx
          .select()
          .from(clientesTable)
          .where(eq(clientesTable.id, id))
          .for("update")
          .limit(1);
        if (!client) return null;
        const importe = body.importe.toFixed(2);
        if (Number(importe) > Number(client.saldoCredito)) {
          throw new Error("PAYMENT_EXCEEDS_BALANCE");
        }
        const [created] = await tx
          .insert(movimientosCreditoTable)
          .values({
            clienteId: id,
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
          })
          .returning();
        await tx
          .update(clientesTable)
          .set({
            saldoCredito: sql`${clientesTable.saldoCredito} - ${importe}::numeric`,
          })
          .where(eq(clientesTable.id, id));
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
      next(e);
    }
  },
);

export default router;
