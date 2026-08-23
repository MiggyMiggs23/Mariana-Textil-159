import { Router } from "express";
import { and, count, desc, eq, gte, ilike, inArray, lte } from "drizzle-orm";
import {
  CrearEntradaBody,
  CrearEntradaResponse,
  ListEntradasQueryParams,
  ListEntradasResponse,
  GetEntradaParams,
  GetEntradaResponse,
  ActivarRolloParams,
  ActivarRolloBody,
  ActivarRolloResponse,
  SalidaMostradorParams,
  SalidaMostradorBody,
  SalidaMostradorResponse,
  VenderRolloParams,
  VenderRolloBody,
  VenderRolloResponse,
  AjustarRolloParams,
  AjustarRolloBody,
  AjustarRolloResponse,
  RevertirMovimientoParams,
  RevertirMovimientoBody,
  RevertirMovimientoResponse,
  GetRolloParams,
  GetRolloResponse,
  ListRollosQueryParams,
  ListRollosResponse,
  GetExistenciasQueryParams,
  GetExistenciasResponse,
  GetKardexQueryParams,
  GetKardexResponse,
  ListAjustesPendientesResponse,
  RevisarAjusteParams,
  RevisarAjusteResponse,
  GetConciliacionQueryParams,
  GetConciliacionResponse,
  RecalcularExistenciasBody,
  RecalcularExistenciasResponse,
  GetFechaServidorResponse,
} from "@workspace/api-zod";
import {
  db,
  entradasTable,
  existenciasTable,
  movimientosTable,
  productosTable,
  proveedoresTable,
  rollosTable,
  ubicacionesTable,
  usuariosTable,
  type EstadoRollo,
} from "@workspace/db";
import { requireSession } from "../middlewares/auth";
import type { AuthContext } from "../middlewares/auth";
import { getRequestIp } from "../lib/request";
import { omitTerminalSensitiveFields } from "../lib/sensitive-data";
import { requierePermiso } from "../lib/permisos";
import {
  crearEntrada,
  buildEntradaResult,
  activarRollo,
  salidaMostrador,
  venderRollo,
  ajustarRollo,
  revertirMovimiento,
  conciliarTodo,
  recalcularExistencias,
  revisarAjuste,
  InventarioError,
} from "../lib/inventario";

export const inventarioRouter = Router();

// ── Scope helpers ─────────────────────────────────────────────────────────────
//
// Read scope (alcanceConsulta):
//   TODAS  — user may see data for any location; if they pass a ubicacionId
//             filter we honor it, otherwise no location filter is applied.
//   PROPIA — user may only see data for their own assigned location; any
//             requested ubicacionId is ignored and overridden by the assigned one.
//
// Operational scope (mutations):
//   ADMIN  — may operate on any location without restriction.
//   others — may only touch their own assigned ubicacionId. Attempting to
//             operate on a different location returns 403 before engine call.

/**
 * Returns the `ubicacionId` that should be used to filter a read query.
 *
 * - ADMIN: use requestedUbicacionId (may be undefined = all), regardless of
 *   alcanceConsulta.
 * - Non-ADMIN with alcanceConsulta PROPIA: always use assigned ubicacionId.
 * - If the user has no assigned location and scope is PROPIA, returns null
 *   (caller should return an empty set or 400).
 */
function resolveReadScope(
  auth: AuthContext,
  requestedUbicacionId?: number,
): { ubicacionId: number | null | undefined; scopeError: string | null } {
  const alcance = auth.user.alcanceConsulta;
  const assigned = auth.user.ubicacionId;

  // ADMIN is always unrestricted; alcanceConsulta never limits this role.
  if (auth.user.rol === "ADMIN") {
    return { ubicacionId: requestedUbicacionId, scopeError: null };
  }

  // alcanceConsulta TODAS (non-ADMIN): honor the requested filter
  if (alcance === "TODAS") {
    return { ubicacionId: requestedUbicacionId, scopeError: null };
  }

  // alcanceConsulta PROPIA: force assigned location regardless of request
  if (assigned == null) {
    return {
      ubicacionId: null,
      scopeError: "No tienes una ubicación asignada.",
    };
  }
  return { ubicacionId: assigned, scopeError: null };
}

/**
 * For mutations: verifies that all implicated ubicacionIds are within the
 * user's operational scope.
 *
 * ADMIN may operate any location (returns null = no error).
 * Non-ADMIN must have all provided ubicacionIds equal to their assigned one.
 *
 * Returns an error message string if the check fails, or null if allowed.
 */
function checkOperationalScope(
  auth: AuthContext,
  ubicacionIds: number[],
): string | null {
  if (auth.user.rol === "ADMIN") return null;

  const assigned = auth.user.ubicacionId;
  if (assigned == null) {
    return "No tienes una ubicación asignada.";
  }

  for (const id of ubicacionIds) {
    if (id !== assigned) {
      return "No tienes permiso para operar en esa ubicación.";
    }
  }
  return null;
}

// ── Fecha del servidor ────────────────────────────────────────────────────────
// Unauthenticated — returns the server clock so the UI can display the real
// server date/time before the user submits a form. Accepts no client input.

inventarioRouter.get("/fecha-servidor", (_req, res): void => {
  const now = new Date();
  res.json(
    GetFechaServidorResponse.parse({
      fecha: now.toISOString(),
      zonaHoraria: "America/Mexico_City",
    }),
  );
});

// ── Helper types ──────────────────────────────────────────────────────────────

type MovimientoRow = {
  id: number;
  rolloId: number;
  productoId: number;
  ubicacionId: number;
  tipo: string;
  cantidad: string;
  saldoPosterior: string;
  documentoTipo: string | null;
  documentoId: string | null;
  movimientoOrigenId: number | null;
  usuarioId: number;
  justificacion: string | null;
  revisado: boolean;
  revisadoPor: number | null;
  revisadoAt: string | null;
  uuidCliente: string | null;
  createdAt: string;
};

async function enrichMovimiento(
  mov: typeof movimientosTable.$inferSelect,
): Promise<MovimientoRow> {
  return {
    id: Number(mov.id),
    rolloId: mov.rolloId,
    productoId: mov.productoId,
    ubicacionId: mov.ubicacionId,
    tipo: mov.tipo,
    cantidad: mov.cantidad,
    saldoPosterior: mov.saldoPosterior,
    documentoTipo: mov.documentoTipo ?? null,
    documentoId: mov.documentoId ?? null,
    movimientoOrigenId: mov.movimientoOrigenId ?? null,
    usuarioId: mov.usuarioId,
    justificacion: mov.justificacion ?? null,
    revisado: mov.revisado,
    revisadoPor: mov.revisadoPor ?? null,
    revisadoAt: mov.revisadoAt?.toISOString() ?? null,
    uuidCliente: mov.uuidCliente ?? null,
    createdAt: mov.createdAt.toISOString(),
  };
}

async function getRolloDetail(rolloId: number) {
  const [rollo] = await db
    .select({
      id: rollosTable.id,
      serie: rollosTable.serie,
      productoId: rollosTable.productoId,
      sku: productosTable.sku,
      tela: productosTable.tela,
      color: productosTable.color,
      unidad: productosTable.unidad,
      ubicacionId: rollosTable.ubicacionId,
      nombreUbicacion: ubicacionesTable.nombre,
      proveedorId: rollosTable.proveedorId,
      estado: rollosTable.estado,
      cantidadInicial: rollosTable.cantidadInicial,
      cantidadActual: rollosTable.cantidadActual,
      costoUnitario: rollosTable.costoUnitario,
      costoTotal: rollosTable.costoTotal,
      notas: rollosTable.notas,
      createdAt: rollosTable.createdAt,
      updatedAt: rollosTable.updatedAt,
    })
    .from(rollosTable)
    .innerJoin(productosTable, eq(rollosTable.productoId, productosTable.id))
    .innerJoin(ubicacionesTable, eq(rollosTable.ubicacionId, ubicacionesTable.id))
    .where(eq(rollosTable.id, rolloId))
    .limit(1);

  if (!rollo) return null;

  const movimientos = await db
    .select()
    .from(movimientosTable)
    .where(eq(movimientosTable.rolloId, rolloId))
    .orderBy(desc(movimientosTable.id));

  return {
    id: rollo.id,
    serie: rollo.serie,
    productoId: rollo.productoId,
    skuProducto: rollo.sku,
    telaProducto: rollo.tela,
    colorProducto: rollo.color,
    unidadProducto: rollo.unidad,
    ubicacionId: rollo.ubicacionId,
    nombreUbicacion: rollo.nombreUbicacion,
    proveedorId: rollo.proveedorId ?? null,
    estado: rollo.estado,
    cantidadInicial: rollo.cantidadInicial,
    cantidadActual: rollo.cantidadActual,
    costoUnitario: rollo.costoUnitario,
    costoTotal: rollo.costoTotal,
    notas: rollo.notas ?? null,
    historial: await Promise.all(movimientos.map(enrichMovimiento)),
    createdAt: rollo.createdAt.toISOString(),
    updatedAt: rollo.updatedAt.toISOString(),
  };
}

// ── Crear entrada (entrada completa en una transacción) ───────────────────────

inventarioRouter.post(
  "/entradas",
  requireSession,
  requierePermiso("entradas", "crear"),
  async (req, res, next) => {
    try {
      const body = CrearEntradaBody.parse(req.body);
      const auth = req.auth!;
      const usuarioId = auth.user.id;

      // Determine target location: ADMIN uses body value; non-ADMIN is forced
      // to their assigned location (operational scope check).
      let ubicacionId = body.ubicacionId;
      const scopeErr = checkOperationalScope(auth, [ubicacionId]);
      if (scopeErr) {
        res.status(403).json({ error: scopeErr });
        return;
      }
      // For non-ADMIN, override with their assigned location to be safe even if
      // checkOperationalScope passed (assigned === body.ubicacionId).
      if (auth.user.rol !== "ADMIN" && auth.user.ubicacionId != null) {
        ubicacionId = auth.user.ubicacionId;
      }

      // ── Business validation ──────────────────────────────────────────────
      if (body.lineas.length === 0) {
        res.status(400).json({ error: "La entrada debe incluir al menos una línea." });
        return;
      }

      // Duplicate product lines
      const productoIds = body.lineas.map((l) => l.productoId);
      if (new Set(productoIds).size !== productoIds.length) {
        res
          .status(400)
          .json({ error: "No se permiten líneas de producto duplicadas." });
        return;
      }

      // Quantities and costs must be positive
      for (const linea of body.lineas) {
        if (linea.cantidades.length === 0) {
          res
            .status(400)
            .json({ error: "Cada línea debe incluir al menos una cantidad." });
          return;
        }
        if (parseFloat(linea.costoUnitario) <= 0) {
          res
            .status(400)
            .json({ error: "El costo unitario debe ser mayor a cero." });
          return;
        }
        for (const c of linea.cantidades) {
          if (parseFloat(c) <= 0) {
            res
              .status(400)
              .json({ error: "Las cantidades deben ser mayores a cero." });
            return;
          }
        }
      }

      // Location must exist, be active, and not TRANSITO/EXTERNO
      const [ubicacion] = await db
        .select()
        .from(ubicacionesTable)
        .where(eq(ubicacionesTable.id, ubicacionId))
        .limit(1);
      if (!ubicacion || !ubicacion.activa) {
        res.status(400).json({ error: "Ubicación inválida o inactiva." });
        return;
      }
      if (ubicacion.tipo === "TRANSITO" || ubicacion.tipo === "EXTERNO") {
        res.status(400).json({
          error: "No se pueden dar entradas en ubicaciones de tránsito o externas.",
        });
        return;
      }

      // Products must exist and be active
      const productos = await db
        .select({ id: productosTable.id, activo: productosTable.activo })
        .from(productosTable)
        .where(inArray(productosTable.id, productoIds));
      const productoMap = new Map(productos.map((p) => [p.id, p]));
      for (const id of productoIds) {
        const p = productoMap.get(id);
        if (!p) {
          res.status(400).json({ error: `Producto ${id} no encontrado.` });
          return;
        }
        if (!p.activo) {
          res.status(400).json({ error: `Producto ${id} está inactivo.` });
          return;
        }
      }

      // Provider (optional) must exist and be active
      if (body.proveedorId != null) {
        const [prov] = await db
          .select({ id: proveedoresTable.id, activo: proveedoresTable.activo })
          .from(proveedoresTable)
          .where(eq(proveedoresTable.id, body.proveedorId))
          .limit(1);
        if (!prov) {
          res.status(400).json({ error: "Proveedor no encontrado." });
          return;
        }
        if (!prov.activo) {
          res.status(400).json({ error: "El proveedor está inactivo." });
          return;
        }
      }

      const result = await db.transaction(async (tx) =>
        crearEntrada(tx, {
          ubicacionId,
          proveedorId: body.proveedorId ?? null,
          observaciones: body.observaciones ?? null,
          usuarioId,
          ip: getRequestIp(req),
          uuidCliente: body.uuidCliente,
          lineas: body.lineas.map((l) => ({
            productoId: l.productoId,
            costoUnitario: l.costoUnitario,
            cantidades: l.cantidades,
          })),
        }),
      );

      const response = CrearEntradaResponse.parse(result);
      res
        .status(201)
        .json(omitTerminalSensitiveFields(response, auth.user.rol === "TERMINAL"));
    } catch (e) {
      if (e instanceof InventarioError) {
        res.status(400).json({ error: e.message });
        return;
      }
      next(e);
    }
  },
);

// ── Listar entradas ───────────────────────────────────────────────────────────

inventarioRouter.get(
  "/entradas",
  requireSession,
  requierePermiso("entradas", "ver"),
  async (req, res, next) => {
    try {
      const q = ListEntradasQueryParams.parse(req.query);
      const page = q.page ?? 1;
      const pageSize = q.pageSize ?? 20;
      const offset = (page - 1) * pageSize;

      const auth = req.auth!;

      // Read scope: PROPIA forces assigned location; TODAS honors requested filter
      const { ubicacionId: scopedUbicacionId, scopeError } = resolveReadScope(
        auth,
        q.ubicacionId,
      );
      if (scopeError) {
        res.status(403).json({ error: scopeError });
        return;
      }

      const conditions = [];
      if (q.folio) conditions.push(eq(entradasTable.folio, q.folio));
      if (q.proveedorId)
        conditions.push(eq(entradasTable.proveedorId, q.proveedorId));

      // Apply resolved location scope
      if (scopedUbicacionId != null) {
        conditions.push(eq(entradasTable.ubicacionId, scopedUbicacionId));
      }

      const desde =
        typeof req.query.fechaDesde === "string" ? req.query.fechaDesde : null;
      const hasta =
        typeof req.query.fechaHasta === "string" ? req.query.fechaHasta : null;
      if (desde) conditions.push(gte(entradasTable.fecha, new Date(desde)));
      if (hasta) {
        const hastaDate = new Date(hasta);
        hastaDate.setDate(hastaDate.getDate() + 1);
        conditions.push(lte(entradasTable.fecha, hastaDate));
      }

      const where = conditions.length ? and(...conditions) : undefined;

      const [totalRow] = await db
        .select({ cnt: count() })
        .from(entradasTable)
        .where(where);

      const rows = await db
        .select({
          id: entradasTable.id,
          folio: entradasTable.folio,
          ubicacionId: entradasTable.ubicacionId,
          nombreUbicacion: ubicacionesTable.nombre,
          proveedorId: entradasTable.proveedorId,
          nombreProveedor: proveedoresTable.nombre,
          usuarioId: entradasTable.usuarioId,
          nombreUsuario: usuariosTable.nombre,
          fecha: entradasTable.fecha,
          totalRollos: entradasTable.totalRollos,
          totalCosto: entradasTable.totalCosto,
          createdAt: entradasTable.createdAt,
        })
        .from(entradasTable)
        .innerJoin(
          ubicacionesTable,
          eq(entradasTable.ubicacionId, ubicacionesTable.id),
        )
        .innerJoin(usuariosTable, eq(entradasTable.usuarioId, usuariosTable.id))
        .leftJoin(
          proveedoresTable,
          eq(entradasTable.proveedorId, proveedoresTable.id),
        )
        .where(where)
        .orderBy(desc(entradasTable.folio))
        .limit(pageSize)
        .offset(offset);

      const items = rows.map((r) => ({
        id: r.id,
        folio: r.folio,
        ubicacionId: r.ubicacionId,
        nombreUbicacion: r.nombreUbicacion,
        proveedorId: r.proveedorId ?? null,
        nombreProveedor: r.nombreProveedor ?? null,
        usuarioId: r.usuarioId,
        nombreUsuario: r.nombreUsuario,
        fecha: r.fecha.toISOString(),
        totalRollos: r.totalRollos,
        totalCosto: r.totalCosto,
        createdAt: r.createdAt.toISOString(),
      }));

      const response = ListEntradasResponse.parse({
        items,
        total: totalRow?.cnt ?? 0,
        page,
        pageSize,
      });
      res.json(
        omitTerminalSensitiveFields(
          response,
          auth.user.rol === "TERMINAL",
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

// ── Detalle de entrada ─────────────────────────────────────────────────────────

inventarioRouter.get(
  "/entradas/:id",
  requireSession,
  requierePermiso("entradas", "ver"),
  async (req, res, next) => {
    try {
      const { id } = GetEntradaParams.parse(req.params);
      const auth = req.auth!;

      const [entrada] = await db
        .select({
          ubicacionId: entradasTable.ubicacionId,
        })
        .from(entradasTable)
        .where(eq(entradasTable.id, id))
        .limit(1);

      if (!entrada) {
        res.status(404).json({ error: "Entrada no encontrada" });
        return;
      }

      // Read scope check: PROPIA users can only see entries at their location
      const { ubicacionId: scopedUbicacionId, scopeError } = resolveReadScope(auth);
      if (scopeError) {
        res.status(403).json({ error: scopeError });
        return;
      }
      if (
        scopedUbicacionId != null &&
        entrada.ubicacionId !== scopedUbicacionId
      ) {
        res.status(404).json({ error: "Entrada no encontrada" });
        return;
      }

      const detail = await db.transaction(async (tx) =>
        buildEntradaResult(tx, id),
      );
      const response = GetEntradaResponse.parse(detail);
      res.json(omitTerminalSensitiveFields(response, auth.user.rol === "TERMINAL"));
    } catch (e) {
      if (e instanceof InventarioError) {
        res.status(e.code === "ENTRADA_NOT_FOUND" ? 404 : 400).json({ error: e.message });
        return;
      }
      next(e);
    }
  },
);

// ── Activar rollo (PROGRAMADO → DISPONIBLE) ───────────────────────────────────
// Module: entradas / editar — rollo location is the relevant operational scope

inventarioRouter.post(
  "/rollos/:id/activar",
  requireSession,
  requierePermiso("entradas", "editar"),
  async (req, res, next) => {
    try {
      const { id } = ActivarRolloParams.parse(req.params);
      const body = ActivarRolloBody.parse(req.body);
      const auth = req.auth!;
      const usuarioId = auth.user.id;

      // Fetch rollo location before mutating so we can check operational scope
      const [rolloCheck] = await db
        .select({ ubicacionId: rollosTable.ubicacionId })
        .from(rollosTable)
        .where(eq(rollosTable.id, id))
        .limit(1);

      if (!rolloCheck) {
        res.status(404).json({ error: "Rollo no encontrado" });
        return;
      }

      const scopeErr = checkOperationalScope(auth, [rolloCheck.ubicacionId]);
      if (scopeErr) {
        res.status(403).json({ error: scopeErr });
        return;
      }

      const result = await db.transaction(async (tx) =>
        activarRollo(tx, {
          rolloId: id,
          cantidadReal: body.cantidadReal,
          usuarioId,
          notas: body.notas ?? null,
          uuidCliente: body.uuidCliente ?? null,
        }),
      );

      const detail = await getRolloDetail(result.rollo.id);
      if (!detail) {
        res.status(404).json({ error: "Rollo no encontrado" });
        return;
      }
      const response = ActivarRolloResponse.parse(detail);
      res.json(omitTerminalSensitiveFields(response, auth.user.rol === "TERMINAL"));
    } catch (e) {
      if (e instanceof InventarioError) {
        res.status(e.code === "ROLLO_NOT_FOUND" ? 404 : 400).json({ error: e.message });
        return;
      }
      next(e);
    }
  },
);

// Compatibility tombstones for clients built before the documented Salidas
// lifecycle. They intentionally never mutate inventory.
inventarioRouter.post("/rollos/:id/mover", requireSession, (_req, res) => {
  res.status(410).json({
    error: "Esta operación fue reemplazada por el flujo documentado de Salidas.",
    code: "SALIDAS_FLOW_REQUIRED",
  });
});

inventarioRouter.post("/rollos/:id/recibir", requireSession, (_req, res) => {
  res.status(410).json({
    error: "Esta operación fue reemplazada por el flujo documentado de Salidas.",
    code: "SALIDAS_FLOW_REQUIRED",
  });
});

// ── Salida mostrador (DISPONIBLE → ABIERTO) ───────────────────────────────────
// Module: salidas / crear — scope: rollo's current location

inventarioRouter.post(
  "/rollos/:id/salida-mostrador",
  requireSession,
  requierePermiso("salidas", "crear"),
  async (req, res, next) => {
    try {
      const { id } = SalidaMostradorParams.parse(req.params);
      const body = SalidaMostradorBody.parse(req.body);
      const auth = req.auth!;
      const usuarioId = auth.user.id;

      // Fetch rollo location before mutating
      const [rolloCheck] = await db
        .select({ ubicacionId: rollosTable.ubicacionId })
        .from(rollosTable)
        .where(eq(rollosTable.id, id))
        .limit(1);

      if (!rolloCheck) {
        res.status(404).json({ error: "Rollo no encontrado" });
        return;
      }

      const scopeErr = checkOperationalScope(auth, [rolloCheck.ubicacionId]);
      if (scopeErr) {
        res.status(403).json({ error: scopeErr });
        return;
      }

      const result = await db.transaction(async (tx) =>
        salidaMostrador(tx, {
          rolloId: id,
          usuarioId,
          justificacion: body.justificacion ?? null,
          uuidCliente: body.uuidCliente ?? null,
        }),
      );

      const detail = await getRolloDetail(result.rollo.id);
      if (!detail) {
        res.status(404).json({ error: "Rollo no encontrado" });
        return;
      }
      const response = SalidaMostradorResponse.parse(detail);
      res.json(omitTerminalSensitiveFields(response, auth.user.rol === "TERMINAL"));
    } catch (e) {
      if (e instanceof InventarioError) {
        res.status(e.code === "ROLLO_NOT_FOUND" ? 404 : 400).json({ error: e.message });
        return;
      }
      next(e);
    }
  },
);

// ── Vender rollo (DISPONIBLE → VENDIDO) ──────────────────────────────────────
// Module: pos / crear — scope: rollo's current location

inventarioRouter.post(
  "/rollos/:id/vender",
  requireSession,
  requierePermiso("pos", "crear"),
  async (req, res, next) => {
    try {
      const { id } = VenderRolloParams.parse(req.params);
      const body = VenderRolloBody.parse(req.body);
      const auth = req.auth!;
      const usuarioId = auth.user.id;
      if (auth.user.rol !== "ADMIN") {
        res.status(403).json({
          error:
            "Las ventas operativas deben registrarse mediante un ticket de Punto de venta.",
        });
        return;
      }

      // Fetch rollo location before mutating
      const [rolloCheck] = await db
        .select({ ubicacionId: rollosTable.ubicacionId })
        .from(rollosTable)
        .where(eq(rollosTable.id, id))
        .limit(1);

      if (!rolloCheck) {
        res.status(404).json({ error: "Rollo no encontrado" });
        return;
      }

      const scopeErr = checkOperationalScope(auth, [rolloCheck.ubicacionId]);
      if (scopeErr) {
        res.status(403).json({ error: scopeErr });
        return;
      }

      const result = await db.transaction(async (tx) =>
        venderRollo(tx, {
          rolloId: id,
          usuarioId,
          justificacion: body.justificacion ?? null,
          uuidCliente: body.uuidCliente ?? null,
        }),
      );

      const detail = await getRolloDetail(result.rollo.id);
      if (!detail) {
        res.status(404).json({ error: "Rollo no encontrado" });
        return;
      }
      const response = VenderRolloResponse.parse(detail);
      res.json(response);
    } catch (e) {
      if (e instanceof InventarioError) {
        res.status(e.code === "ROLLO_NOT_FOUND" ? 404 : 400).json({ error: e.message });
        return;
      }
      next(e);
    }
  },
);

// ── Ajustar rollo ─────────────────────────────────────────────────────────────
// Module: ajustes / crear — scope: rollo's current location

inventarioRouter.post(
  "/rollos/:id/ajustar",
  requireSession,
  requierePermiso("ajustes", "crear"),
  async (req, res, next) => {
    try {
      const { id } = AjustarRolloParams.parse(req.params);
      const body = AjustarRolloBody.parse(req.body);
      const auth = req.auth!;
      const usuarioId = auth.user.id;

      // Fetch rollo location before mutating
      const [rolloCheck] = await db
        .select({ ubicacionId: rollosTable.ubicacionId })
        .from(rollosTable)
        .where(eq(rollosTable.id, id))
        .limit(1);

      if (!rolloCheck) {
        res.status(404).json({ error: "Rollo no encontrado" });
        return;
      }

      const scopeErr = checkOperationalScope(auth, [rolloCheck.ubicacionId]);
      if (scopeErr) {
        res.status(403).json({ error: scopeErr });
        return;
      }

      const result = await db.transaction(async (tx) =>
        ajustarRollo(tx, {
          rolloId: id,
          cantidadNueva: body.cantidadNueva ?? null,
          justificacion: body.justificacion,
          usuarioId,
          uuidCliente: body.uuidCliente ?? null,
        }),
      );

      const detail = await getRolloDetail(result.rollo.id);
      if (!detail) {
        res.status(404).json({ error: "Rollo no encontrado" });
        return;
      }
      const response = AjustarRolloResponse.parse(detail);
      res.json(omitTerminalSensitiveFields(response, auth.user.rol === "TERMINAL"));
    } catch (e) {
      if (e instanceof InventarioError) {
        res.status(e.code === "ROLLO_NOT_FOUND" ? 404 : 400).json({ error: e.message });
        return;
      }
      next(e);
    }
  },
);

// ── Revertir movimiento ───────────────────────────────────────────────────────
// Module: ajustes / autorizar — scope: rollo's current location (ADMIN-centric)

inventarioRouter.post(
  "/rollos/:id/revertir",
  requireSession,
  requierePermiso("ajustes", "autorizar"),
  async (req, res, next) => {
    try {
      // id in path is rolloId, but reversal targets movimientoOrigenId from body
      RevertirMovimientoParams.parse(req.params);
      const body = RevertirMovimientoBody.parse(req.body);
      const auth = req.auth!;
      const usuarioId = auth.user.id;

      // Fetch the origin movement to determine rollo's location for scope check
      const [movCheck] = await db
        .select({
          ubicacionId: movimientosTable.ubicacionId,
          rolloId: movimientosTable.rolloId,
        })
        .from(movimientosTable)
        .where(eq(movimientosTable.id, body.movimientoOrigenId))
        .limit(1);

      if (!movCheck) {
        res.status(404).json({ error: "Movimiento no encontrado" });
        return;
      }

      const scopeErr = checkOperationalScope(auth, [movCheck.ubicacionId]);
      if (scopeErr) {
        res.status(403).json({ error: scopeErr });
        return;
      }

      const result = await db.transaction(async (tx) =>
        revertirMovimiento(tx, {
          movimientoOrigenId: body.movimientoOrigenId,
          usuarioId,
          justificacion: body.justificacion ?? null,
          uuidCliente: body.uuidCliente ?? null,
        }),
      );

      const detail = await getRolloDetail(result.rollo.id);
      if (!detail) {
        res.status(404).json({ error: "Rollo no encontrado" });
        return;
      }
      const response = RevertirMovimientoResponse.parse(detail);
      res.json(omitTerminalSensitiveFields(response, auth.user.rol === "TERMINAL"));
    } catch (e) {
      if (e instanceof InventarioError) {
        const status =
          e.code === "ROLLO_NOT_FOUND" || e.code === "MOVIMIENTO_NOT_FOUND"
            ? 404
            : 400;
        res.status(status).json({ error: e.message });
        return;
      }
      next(e);
    }
  },
);

// ── Get rollo detail ──────────────────────────────────────────────────────────
// Module: inventario / ver — read scope applied to detail

inventarioRouter.get(
  "/rollos/:id",
  requireSession,
  requierePermiso("inventario", "ver"),
  async (req, res, next) => {
    try {
      const { id } = GetRolloParams.parse(req.params);
      const auth = req.auth!;

      const detail = await getRolloDetail(id);
      if (!detail) {
        res.status(404).json({ error: "Rollo no encontrado" });
        return;
      }

      // Read scope: PROPIA users can only view rollos in their assigned location
      const { ubicacionId: scopedUbicacionId, scopeError } = resolveReadScope(auth);
      if (scopeError) {
        res.status(403).json({ error: scopeError });
        return;
      }
      if (scopedUbicacionId != null && detail.ubicacionId !== scopedUbicacionId) {
        res.status(404).json({ error: "Rollo no encontrado" });
        return;
      }

      const response = GetRolloResponse.parse(detail);
      res.json(omitTerminalSensitiveFields(response, auth.user.rol === "TERMINAL"));
    } catch (e) {
      next(e);
    }
  },
);

// ── List rollos ───────────────────────────────────────────────────────────────
// Module: inventario / ver — read scope applied to list

inventarioRouter.get(
  "/rollos",
  requireSession,
  requierePermiso("inventario", "ver"),
  async (req, res, next) => {
    try {
      const q = ListRollosQueryParams.parse(req.query);
      const page = q.page ?? 1;
      const pageSize = q.pageSize ?? 20;
      const offset = (page - 1) * pageSize;
      const auth = req.auth!;

      // Read scope: PROPIA forces assigned location; TODAS honors requested filter
      const { ubicacionId: scopedUbicacionId, scopeError } = resolveReadScope(
        auth,
        q.ubicacionId,
      );
      if (scopeError) {
        res.status(403).json({ error: scopeError });
        return;
      }

      const conditions = [];
      // Apply resolved location scope (overrides any q.ubicacionId for PROPIA users)
      if (scopedUbicacionId != null) {
        conditions.push(eq(rollosTable.ubicacionId, scopedUbicacionId));
      }
      if (q.productoId)
        conditions.push(eq(rollosTable.productoId, q.productoId));
      if (q.estado)
        conditions.push(eq(rollosTable.estado, q.estado as EstadoRollo));
      if (q.serie) conditions.push(ilike(rollosTable.serie, `%${q.serie}%`));
      if (q.soloAbiertos) conditions.push(eq(rollosTable.estado, "ABIERTO"));

      const where = conditions.length ? and(...conditions) : undefined;

      const [totalRow] = await db
        .select({ cnt: count() })
        .from(rollosTable)
        .where(where);

      const rows = await db
        .select({
          id: rollosTable.id,
          serie: rollosTable.serie,
          productoId: rollosTable.productoId,
          sku: productosTable.sku,
          tela: productosTable.tela,
          color: productosTable.color,
          unidad: productosTable.unidad,
          ubicacionId: rollosTable.ubicacionId,
          nombreUbicacion: ubicacionesTable.nombre,
          proveedorId: rollosTable.proveedorId,
          estado: rollosTable.estado,
          cantidadInicial: rollosTable.cantidadInicial,
          cantidadActual: rollosTable.cantidadActual,
          costoUnitario: rollosTable.costoUnitario,
          costoTotal: rollosTable.costoTotal,
          notas: rollosTable.notas,
          createdAt: rollosTable.createdAt,
          updatedAt: rollosTable.updatedAt,
        })
        .from(rollosTable)
        .innerJoin(productosTable, eq(rollosTable.productoId, productosTable.id))
        .innerJoin(
          ubicacionesTable,
          eq(rollosTable.ubicacionId, ubicacionesTable.id),
        )
        .where(where)
        .orderBy(desc(rollosTable.createdAt))
        .limit(pageSize)
        .offset(offset);

      const items = rows.map((r) => ({
        id: r.id,
        serie: r.serie,
        productoId: r.productoId,
        skuProducto: r.sku,
        telaProducto: r.tela,
        colorProducto: r.color,
        ubicacionId: r.ubicacionId,
        nombreUbicacion: r.nombreUbicacion,
        proveedorId: r.proveedorId ?? null,
        estado: r.estado,
        cantidadInicial: r.cantidadInicial,
        cantidadActual: r.cantidadActual,
        costoUnitario: r.costoUnitario,
        costoTotal: r.costoTotal,
        notas: r.notas ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }));

      const response = ListRollosResponse.parse({
        items,
        total: totalRow?.cnt ?? 0,
        page,
        pageSize,
      });
      res.json(omitTerminalSensitiveFields(response, auth.user.rol === "TERMINAL"));
    } catch (e) {
      next(e);
    }
  },
);

// ── Existencias ───────────────────────────────────────────────────────────────
// Module: inventario / ver — read scope applied

inventarioRouter.get(
  "/existencias",
  requireSession,
  requierePermiso("inventario", "ver"),
  async (req, res, next) => {
    try {
      const q = GetExistenciasQueryParams.parse(req.query);
      const auth = req.auth!;

      // Read scope: PROPIA forces assigned location; TODAS honors requested filter
      const { ubicacionId: scopedUbicacionId, scopeError } = resolveReadScope(
        auth,
        q.ubicacionId,
      );
      if (scopeError) {
        res.status(403).json({ error: scopeError });
        return;
      }

      const conditions = [];
      // Apply resolved location scope
      if (scopedUbicacionId != null) {
        conditions.push(eq(existenciasTable.ubicacionId, scopedUbicacionId));
      }
      if (q.productoId)
        conditions.push(eq(existenciasTable.productoId, q.productoId));

      const rows = await db
        .select({
          productoId: existenciasTable.productoId,
          sku: productosTable.sku,
          tela: productosTable.tela,
          color: productosTable.color,
          unidad: productosTable.unidad,
          ubicacionId: existenciasTable.ubicacionId,
          nombreUbicacion: ubicacionesTable.nombre,
          rollosCount: existenciasTable.rollosCount,
          cantidadTotal: existenciasTable.cantidadTotal,
        })
        .from(existenciasTable)
        .innerJoin(
          productosTable,
          eq(existenciasTable.productoId, productosTable.id),
        )
        .innerJoin(
          ubicacionesTable,
          eq(existenciasTable.ubicacionId, ubicacionesTable.id),
        )
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(ubicacionesTable.nombre, productosTable.tela);

      const items = rows.map((r) => ({
        productoId: r.productoId,
        skuProducto: r.sku,
        telaProducto: r.tela,
        colorProducto: r.color,
        unidadProducto: r.unidad,
        ubicacionId: r.ubicacionId,
        nombreUbicacion: r.nombreUbicacion,
        rollosCount: r.rollosCount,
        cantidadTotal: r.cantidadTotal,
      }));

      const response = GetExistenciasResponse.parse(items);
      res.json(
        omitTerminalSensitiveFields(
          response,
          auth.user.rol === "TERMINAL",
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

// ── Kardex ────────────────────────────────────────────────────────────────────
// Module: movimientos / ver — read scope applied via ubicacionId filter

inventarioRouter.get(
  "/kardex",
  requireSession,
  requierePermiso("movimientos", "ver"),
  async (req, res, next) => {
    try {
      const q = GetKardexQueryParams.parse(req.query);
      const page = q.page ?? 1;
      const pageSize = q.pageSize ?? 100;
      const offset = (page - 1) * pageSize;
      const auth = req.auth!;

      // Read scope: PROPIA forces assigned location; TODAS honors requested filter
      const { ubicacionId: scopedUbicacionId, scopeError } = resolveReadScope(
        auth,
        q.ubicacionId,
      );
      if (scopeError) {
        res.status(403).json({ error: scopeError });
        return;
      }

      const conditions = [eq(movimientosTable.productoId, q.productoId)];
      // Apply resolved location scope (overrides q.ubicacionId for PROPIA)
      if (scopedUbicacionId != null) {
        conditions.push(eq(movimientosTable.ubicacionId, scopedUbicacionId));
      }
      if (q.desde)
        conditions.push(gte(movimientosTable.createdAt, new Date(q.desde)));
      if (q.hasta) {
        const hastaDate = new Date(q.hasta);
        hastaDate.setDate(hastaDate.getDate() + 1);
        conditions.push(lte(movimientosTable.createdAt, hastaDate));
      }

      const where = and(...conditions);

      const [totalRow] = await db
        .select({ cnt: count() })
        .from(movimientosTable)
        .where(where);

      const rows = await db
        .select()
        .from(movimientosTable)
        .where(where)
        .orderBy(desc(movimientosTable.id))
        .limit(pageSize)
        .offset(offset);

      const movimientos = await Promise.all(rows.map(enrichMovimiento));

      const response = GetKardexResponse.parse({
        productoId: q.productoId,
        movimientos,
        total: totalRow?.cnt ?? 0,
        page,
        pageSize,
      });
      res.json(
        omitTerminalSensitiveFields(
          response,
          auth.user.rol === "TERMINAL",
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

// ── Ajustes pendientes ────────────────────────────────────────────────────────
// Module: ajustes / autorizar (review pending adjustments — admin-level)

inventarioRouter.get(
  "/ajustes/pendientes",
  requireSession,
  requierePermiso("ajustes", "autorizar"),
  async (req, res, next) => {
    try {
      const { ubicacionId: scopedUbicacionId, scopeError } = resolveReadScope(
        req.auth!,
      );
      if (scopeError) {
        res.status(403).json({ error: scopeError });
        return;
      }

      const rows = await db
        .select()
        .from(movimientosTable)
        .where(
          scopedUbicacionId == null
            ? eq(movimientosTable.revisado, false)
            : and(
                eq(movimientosTable.revisado, false),
                eq(movimientosTable.ubicacionId, scopedUbicacionId),
              ),
        )
        .orderBy(desc(movimientosTable.createdAt));

      const items = await Promise.all(rows.map(enrichMovimiento));
      const response = ListAjustesPendientesResponse.parse(items);
      res.json(response);
    } catch (e) {
      next(e);
    }
  },
);

// ── Revisar ajuste ────────────────────────────────────────────────────────────
// Module: ajustes / autorizar

inventarioRouter.post(
  "/ajustes/:id/revisar",
  requireSession,
  requierePermiso("ajustes", "autorizar"),
  async (req, res, next) => {
    try {
      const { id } = RevisarAjusteParams.parse(req.params);
      const [mov] = await db
        .select()
        .from(movimientosTable)
        .where(eq(movimientosTable.id, id))
        .limit(1);

      if (!mov) {
        res.status(404).json({ error: "Movimiento no encontrado" });
        return;
      }

      const scopeError = checkOperationalScope(req.auth!, [mov.ubicacionId]);
      if (scopeError) {
        res.status(403).json({ error: scopeError });
        return;
      }

      const usuarioId = req.auth!.user.id;
      await revisarAjuste(id, usuarioId);

      const [updated] = await db
        .select()
        .from(movimientosTable)
        .where(eq(movimientosTable.id, id))
        .limit(1);
      if (!updated) {
        res.status(404).json({ error: "Movimiento no encontrado" });
        return;
      }
      const response = RevisarAjusteResponse.parse(
        await enrichMovimiento(updated),
      );
      res.json(response);
    } catch (e) {
      if (e instanceof InventarioError) {
        res
          .status(e.code === "MOVIMIENTO_NOT_FOUND" ? 404 : 400)
          .json({ error: e.message });
        return;
      }
      next(e);
    }
  },
);

// ── Conciliación ──────────────────────────────────────────────────────────────
// Module: conciliacion / ver — read scope applied

inventarioRouter.get(
  "/conciliacion",
  requireSession,
  requierePermiso("conciliacion", "ver"),
  async (req, res, next) => {
    try {
      const q = GetConciliacionQueryParams.parse(req.query);
      const auth = req.auth!;

      // Read scope: PROPIA forces assigned location; TODAS honors requested filter
      const { ubicacionId: scopedUbicacionId, scopeError } = resolveReadScope(
        auth,
        q.ubicacionId,
      );
      if (scopeError) {
        res.status(403).json({ error: scopeError });
        return;
      }

      const rows = await conciliarTodo(q.productoId, scopedUbicacionId ?? undefined);
      const response = GetConciliacionResponse.parse(rows);
      res.json(response);
    } catch (e) {
      next(e);
    }
  },
);

// ── Recalcular existencias ────────────────────────────────────────────────────
// Module: conciliacion / autorizar

inventarioRouter.post(
  "/conciliacion/recalcular",
  requireSession,
  requierePermiso("conciliacion", "autorizar"),
  async (req, res, next) => {
    try {
      const body = RecalcularExistenciasBody.parse(req.body);
      const auth = req.auth!;

      // The contract requires a concrete pair. Non-ADMIN users may only
      // recalculate the pair in their assigned operational location.
      const scopeErr = checkOperationalScope(auth, [body.ubicacionId]);
      if (scopeErr) {
        res.status(403).json({ error: scopeErr });
        return;
      }

      await recalcularExistencias(body.productoId, body.ubicacionId);

      const rows = await conciliarTodo(body.productoId, body.ubicacionId);
      const row = rows[0];
      if (!row) {
        res
          .status(404)
          .json({ error: "Par (producto, ubicacion) no encontrado" });
        return;
      }
      const response = RecalcularExistenciasResponse.parse(row);
      res.json(response);
    } catch (e) {
      next(e);
    }
  },
);
