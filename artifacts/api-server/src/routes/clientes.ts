import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  auditoriaTable,
  clientesTable,
  db,
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
      // POS not yet built — return empty structure
      res.json({
        totalClientes: 0,
        clientesConSaldo: 0,
        totalCartera: "0.00",
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

      // POS not yet built — return empty structure with only unit prices shape
      res.json({
        clienteId: id,
        precios: [],
        nota: "Historial de precios disponible cuando el POS esté activo.",
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
        .select({ id: clientesTable.id })
        .from(clientesTable)
        .where(eq(clientesTable.id, id))
        .limit(1);

      if (!row) {
        res.status(404).json({ error: "Cliente no encontrado." });
        return;
      }

      // POS not yet built — return empty structure
      res.json({ clienteId: id, movimientos: [], saldoActual: "0.00" });
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

      res.json({ clienteId: id, compras: [], total: 0 });
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

      res.json({ clienteId: id, estadisticas: {} });
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

      res.json({ clienteId: id, pagos: [] });
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

      // POS not yet built
      res
        .status(501)
        .json({ error: "Pagos de clientes pendiente de implementar con el POS." });
    } catch (e) {
      next(e);
    }
  },
);

export default router;
