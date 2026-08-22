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
  MoverRolloParams,
  MoverRolloBody,
  MoverRolloResponse,
  RecibirTransferenciaParams,
  RecibirTransferenciaBody,
  RecibirTransferenciaResponse,
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
import { requireRole, requireSession } from "../middlewares/auth";
import { getRequestIp } from "../lib/request";
import {
  crearEntrada,
  buildEntradaResult,
  activarRollo,
  moverRollo,
  recibirTransferencia,
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
  requireRole("ADMIN", "INVENTARIOS", "BODEGA"),
  async (req, res, next) => {
    try {
      const body = CrearEntradaBody.parse(req.body);
      const auth = req.auth!;
      const usuarioId = auth.user.id;

      // Non-ADMIN users are constrained to their assigned location.
      let ubicacionId = body.ubicacionId;
      if (auth.user.rol !== "ADMIN") {
        if (auth.user.ubicacionId == null) {
          res
            .status(403)
            .json({ error: "No tienes una ubicación asignada." });
          return;
        }
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
      res.status(201).json(response);
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

inventarioRouter.get("/entradas", requireSession, async (req, res, next) => {
  try {
    const q = ListEntradasQueryParams.parse(req.query);
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (q.folio) conditions.push(eq(entradasTable.folio, q.folio));
    if (q.proveedorId)
      conditions.push(eq(entradasTable.proveedorId, q.proveedorId));

    // Non-ADMIN users see only their assigned location.
    if (req.auth!.user.rol !== "ADMIN") {
      if (req.auth!.user.ubicacionId != null) {
        conditions.push(eq(entradasTable.ubicacionId, req.auth!.user.ubicacionId));
      }
    } else if (q.ubicacionId) {
      conditions.push(eq(entradasTable.ubicacionId, q.ubicacionId));
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
    res.json(response);
  } catch (e) {
    next(e);
  }
});

// ── Detalle de entrada ─────────────────────────────────────────────────────────

inventarioRouter.get("/entradas/:id", requireSession, async (req, res, next) => {
  try {
    const { id } = GetEntradaParams.parse(req.params);

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

    // Non-ADMIN users can only view entries at their assigned location.
    if (
      req.auth!.user.rol !== "ADMIN" &&
      req.auth!.user.ubicacionId != null &&
      entrada.ubicacionId !== req.auth!.user.ubicacionId
    ) {
      res.status(404).json({ error: "Entrada no encontrada" });
      return;
    }

    const detail = await db.transaction(async (tx) =>
      buildEntradaResult(tx, id),
    );
    const response = GetEntradaResponse.parse(detail);
    res.json(response);
  } catch (e) {
    if (e instanceof InventarioError) {
      res.status(e.code === "ENTRADA_NOT_FOUND" ? 404 : 400).json({ error: e.message });
      return;
    }
    next(e);
  }
});

// ── Activar rollo (PROGRAMADO → DISPONIBLE) ───────────────────────────────────

inventarioRouter.post(
  "/rollos/:id/activar",
  requireSession,
  requireRole("ADMIN", "INVENTARIOS", "BODEGA"),
  async (req, res, next) => {
    try {
      const { id } = ActivarRolloParams.parse(req.params);
      const body = ActivarRolloBody.parse(req.body);
      const usuarioId = req.auth!.user.id;

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

// ── Mover rollo (DISPONIBLE → EN_TRANSITO) ────────────────────────────────────

inventarioRouter.post(
  "/rollos/:id/mover",
  requireSession,
  requireRole("ADMIN", "INVENTARIOS", "BODEGA"),
  async (req, res, next) => {
    try {
      const { id } = MoverRolloParams.parse(req.params);
      const body = MoverRolloBody.parse(req.body);
      const usuarioId = req.auth!.user.id;

      const result = await db.transaction(async (tx) =>
        moverRollo(tx, {
          rolloId: id,
          ubicacionOrigenId: body.ubicacionOrigenId,
          ubicacionTransitoId: body.ubicacionTransitoId,
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
      const response = MoverRolloResponse.parse(detail);
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

// ── Recibir transferencia (EN_TRANSITO → DISPONIBLE) ─────────────────────────

inventarioRouter.post(
  "/rollos/:id/recibir",
  requireSession,
  requireRole("ADMIN", "INVENTARIOS", "BODEGA"),
  async (req, res, next) => {
    try {
      const { id } = RecibirTransferenciaParams.parse(req.params);
      const body = RecibirTransferenciaBody.parse(req.body);
      const usuarioId = req.auth!.user.id;

      const result = await db.transaction(async (tx) =>
        recibirTransferencia(tx, {
          rolloId: id,
          ubicacionDestinoId: body.ubicacionDestinoId,
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
      const response = RecibirTransferenciaResponse.parse(detail);
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

// ── Salida mostrador (DISPONIBLE → ABIERTO) ───────────────────────────────────

inventarioRouter.post(
  "/rollos/:id/salida-mostrador",
  requireSession,
  requireRole("ADMIN", "CAJA", "INVENTARIOS"),
  async (req, res, next) => {
    try {
      const { id } = SalidaMostradorParams.parse(req.params);
      const body = SalidaMostradorBody.parse(req.body);
      const usuarioId = req.auth!.user.id;

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

// ── Vender rollo (DISPONIBLE → VENDIDO) ──────────────────────────────────────

inventarioRouter.post(
  "/rollos/:id/vender",
  requireSession,
  requireRole("ADMIN", "CAJA", "INVENTARIOS"),
  async (req, res, next) => {
    try {
      const { id } = VenderRolloParams.parse(req.params);
      const body = VenderRolloBody.parse(req.body);
      const usuarioId = req.auth!.user.id;

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

inventarioRouter.post(
  "/rollos/:id/ajustar",
  requireSession,
  requireRole("ADMIN", "INVENTARIOS"),
  async (req, res, next) => {
    try {
      const { id } = AjustarRolloParams.parse(req.params);
      const body = AjustarRolloBody.parse(req.body);
      const usuarioId = req.auth!.user.id;

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

// ── Revertir movimiento ───────────────────────────────────────────────────────

inventarioRouter.post(
  "/rollos/:id/revertir",
  requireSession,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      // id in path is rolloId, but reversal targets movimientoOrigenId from body
      RevertirMovimientoParams.parse(req.params);
      const body = RevertirMovimientoBody.parse(req.body);
      const usuarioId = req.auth!.user.id;

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
      res.json(response);
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

inventarioRouter.get("/rollos/:id", requireSession, async (req, res, next) => {
  try {
    const { id } = GetRolloParams.parse(req.params);
    const detail = await getRolloDetail(id);
    if (!detail) {
      res.status(404).json({ error: "Rollo no encontrado" });
      return;
    }
    const response = GetRolloResponse.parse(detail);
    res.json(response);
  } catch (e) {
    next(e);
  }
});

// ── List rollos ───────────────────────────────────────────────────────────────

inventarioRouter.get("/rollos", requireSession, async (req, res, next) => {
  try {
    const q = ListRollosQueryParams.parse(req.query);
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (q.ubicacionId)
      conditions.push(eq(rollosTable.ubicacionId, q.ubicacionId));
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
    res.json(response);
  } catch (e) {
    next(e);
  }
});

// ── Existencias ───────────────────────────────────────────────────────────────

inventarioRouter.get(
  "/existencias",
  requireSession,
  async (req, res, next) => {
    try {
      const q = GetExistenciasQueryParams.parse(req.query);

      const conditions = [];
      if (q.ubicacionId)
        conditions.push(eq(existenciasTable.ubicacionId, q.ubicacionId));
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
      res.json(response);
    } catch (e) {
      next(e);
    }
  },
);

// ── Kardex ────────────────────────────────────────────────────────────────────

inventarioRouter.get("/kardex", requireSession, async (req, res, next) => {
  try {
    const q = GetKardexQueryParams.parse(req.query);
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 100;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(movimientosTable.productoId, q.productoId)];
    if (q.ubicacionId)
      conditions.push(eq(movimientosTable.ubicacionId, q.ubicacionId));
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
    res.json(response);
  } catch (e) {
    next(e);
  }
});

// ── Ajustes pendientes ────────────────────────────────────────────────────────

inventarioRouter.get(
  "/ajustes/pendientes",
  requireSession,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const rows = await db
        .select()
        .from(movimientosTable)
        .where(eq(movimientosTable.revisado, false))
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

inventarioRouter.post(
  "/ajustes/:id/revisar",
  requireSession,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const { id } = RevisarAjusteParams.parse(req.params);
      const usuarioId = req.auth!.user.id;

      await revisarAjuste(id, usuarioId);

      const [mov] = await db
        .select()
        .from(movimientosTable)
        .where(eq(movimientosTable.id, id))
        .limit(1);

      if (!mov) {
        res.status(404).json({ error: "Movimiento no encontrado" });
        return;
      }
      const response = RevisarAjusteResponse.parse(await enrichMovimiento(mov));
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

inventarioRouter.get(
  "/conciliacion",
  requireSession,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const q = GetConciliacionQueryParams.parse(req.query);
      const rows = await conciliarTodo(q.productoId, q.ubicacionId);
      const response = GetConciliacionResponse.parse(rows);
      res.json(response);
    } catch (e) {
      next(e);
    }
  },
);

// ── Recalcular existencias ────────────────────────────────────────────────────

inventarioRouter.post(
  "/conciliacion/recalcular",
  requireSession,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const body = RecalcularExistenciasBody.parse(req.body);
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
