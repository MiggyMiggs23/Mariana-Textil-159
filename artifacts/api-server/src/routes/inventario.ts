import { Router } from "express";
import { and, count, desc, eq, gte, ilike, lte } from "drizzle-orm";
import {
  AltaLoteBody,
  AltaLoteResponse,
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
} from "@workspace/api-zod";
import {
  db,
  existenciasTable,
  movimientosTable,
  productosTable,
  rollosTable,
  ubicacionesTable,
  type EstadoRollo,
} from "@workspace/db";
import { requireRole, requireSession } from "../middlewares/auth";
import {
  crearRollo,
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

// ── Alta de lote ──────────────────────────────────────────────────────────────

inventarioRouter.post(
  "/entradas",
  requireSession,
  requireRole("ADMIN", "INVENTARIOS", "BODEGA"),
  async (req, res, next) => {
    try {
      const body = AltaLoteBody.parse(req.body);
      const usuarioId = req.auth!.user.id;

      const rollos = await db.transaction(async (tx) => {
        const results = [];
        for (const cantidad of body.cantidades) {
          const { rollo } = await crearRollo(tx, {
            productoId: body.productoId,
            ubicacionId: body.ubicacionId,
            proveedorId: body.proveedorId ?? null,
            cantidadInicial: cantidad,
            costoUnitario: body.costoUnitario,
            notas: body.notas ?? null,
            usuarioId,
            estado: "DISPONIBLE",
          });
          results.push({
            id: rollo.id,
            serie: rollo.serie,
            cantidadInicial: rollo.cantidadInicial,
          });
        }
        return results;
      });

      const response = AltaLoteResponse.parse({ rollos });
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
