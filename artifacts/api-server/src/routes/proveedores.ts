import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import ExcelJS from "exceljs";
import {
  CreateProveedorBody,
  CreateProveedorResponse,
  GetProveedorParams,
  GetProveedorResponse,
  ListProveedoresResponse,
  UpdateProveedorBody,
  UpdateProveedorParams,
  UpdateProveedorResponse,
  RegistrarPagoProveedorParams,
  RegistrarAjusteProveedorParams,
  ListComprasProveedorParams,
  EstadoCuentaProveedorParams,
  EstadisticasProveedorParams,
  ExportarProveedorXlsxParams,
  PreviewPagoProveedorBody,
  PreviewPagoProveedorResponse,
  GetProveedorCompraDetalleParams,
  GetProveedorCompraDetalleResponse,
  GetProveedorPagoDetalleParams,
  GetProveedorPagoDetalleResponse,
} from "@workspace/api-zod";
import {
  auditoriaTable,
  db,
  entradasTable,
  proveedoresTable,
  type TipoProveedor,
  type Moneda,
  type FormaPagoProveedor,
} from "@workspace/db";
import { requireSession } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { resolvePermiso } from "../lib/permisos";
import { parseMexicoDateQuery } from "../lib/mexico-date";
import { getRequestIp } from "../lib/request";
import {
  backfillCompras,
  comprasPorProveedor,
  estadoCuenta,
  estadisticasPeriodo,
  registrarPago,
  registrarAjuste,
  previewPagoProveedor,
  resumenProveedores,
  analiticaGlobalProveedores,
  type EstadoCompra,
} from "../lib/compras-proveedor";
import {
  EXCEL_NUMBER_FORMAT,
  toExcelNumber,
} from "@workspace/number-format";
import { ordenarEspanol } from "../lib/spanish-order";

const router: IRouter = Router();

router.use("/proveedores", requireSession);

// ── helpers ────────────────────────────────────────────────────────────────

function presentProveedor(row: typeof proveedoresTable.$inferSelect) {
  return {
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo,
    monedaDefault: row.monedaDefault,
    contactoNombre: row.contactoNombre,
    telefono: row.telefono,
    correo: row.correo,
    pais: row.pais,
    notas: row.notas,
    activo: row.activo,
    createdAt: row.createdAt,
  };
}

// ── GET /proveedores/resumen  ──────────────────────────────────────────────
// Must come BEFORE /:id to avoid Express matching "resumen" as an id
// proveedores_finanzas module

router.get(
  "/proveedores/resumen",
  requierePermiso("proveedores_finanzas", "ver"),
  async (_req, res, next): Promise<void> => {
    try {
      const resumen = await resumenProveedores();
      res.json(resumen);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/proveedores/:id/pagos/preview",
  requierePermiso("proveedores_finanzas", "crear"),
  async (req, res, next): Promise<void> => {
    try {
      const params = RegistrarPagoProveedorParams.safeParse(req.params);
      const body = PreviewPagoProveedorBody.safeParse(req.body);
      if (!params.success || !body.success) {
        res.status(400).json({ error: "Datos del pago inválidos." });
        return;
      }
      const [prov] = await db.select({ id: proveedoresTable.id }).from(proveedoresTable)
        .where(eq(proveedoresTable.id, params.data.id)).limit(1);
      if (!prov) {
        res.status(404).json({ error: "Proveedor no encontrado." });
        return;
      }
      const preview = await previewPagoProveedor({ proveedorId: prov.id, importe: body.data.importe });
      res.json(PreviewPagoProveedorResponse.parse({
        ...preview,
        asignaciones: preview.asignaciones.map((a) => ({ ...a, resultado: a.resultado === "PAGADA" ? "SALDADA" : "PARCIAL" })),
      }));
    } catch (e) { next(e); }
  },
);

router.get(
  "/proveedores/analitica-global",
  requierePermiso("proveedores_finanzas", "ver"),
  async (_req, res, next): Promise<void> => {
    try {
      res.json(await analiticaGlobalProveedores());
    } catch (e) {
      next(e);
    }
  },
);

// ── GET /proveedores (list) ────────────────────────────────────────────────
// Requires proveedores.ver. If user also has proveedores_finanzas.ver, include
// financial metrics in response. Otherwise, omit them entirely.

router.get(
  "/proveedores",
  requierePermiso("proveedores", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const { user } = req.auth!;

      // Check if user also has financial access
      const finanzasPerm = await resolvePermiso(
        user.id,
        user.rol,
        "proveedores_finanzas",
      );
      const hasFinanzas = finanzasPerm?.puedeVer === true;

      const rows = ordenarEspanol(
        await db.select().from(proveedoresTable),
      );

      if (!hasFinanzas) {
        // Omit all financial fields
        res.json({
          totalProveedores: rows.length,
          items: rows.map(presentProveedor),
        });
        return;
      }

      // Include financial metrics
      const resumen = await resumenProveedores();
      const metricsMap = new Map(resumen.items.map((i) => [i.proveedorId, i]));

      const items = rows.map((row) => {
        const m = metricsMap.get(row.id);
        return {
          ...presentProveedor(row),
          totalCompras: m?.totalCompras ?? "0.00",
          totalComprado12Meses: m?.totalComprado12Meses ?? "0.00",
          comprasMes: m?.comprasMes ?? "0.00",
          totalPagado: m?.totalPagado ?? "0.00",
          saldoPendiente: m?.saldoPendiente ?? "0.00",
          ultimaCompra: m?.ultimaCompra ?? null,
          comprasCount: m?.comprasCount ?? 0,
        };
      });

      res.json({
        totalProveedores: resumen.totalProveedores,
        proveedoresConSaldo: resumen.proveedoresConSaldo,
        totalDeuda: resumen.totalDeuda,
        totalPagado: resumen.totalPagado,
        comprasMes: resumen.comprasMes,
        items,
      });
    } catch (e) {
      next(e);
    }
  },
);

// ── POST /proveedores ──────────────────────────────────────────────────────

router.post(
  "/proveedores",
  requierePermiso("proveedores", "crear"),
  async (req, res, next): Promise<void> => {
    try {
      const parsed = CreateProveedorBody.safeParse(req.body);
      if (!parsed.success) {
        req.log.warn({ err: parsed.error.message }, "Datos del proveedor inválidos");
        res.status(400).json({ error: "Datos del proveedor inválidos." });
        return;
      }

      const created = await db.transaction(async (tx) => {
        const [proveedor] = await tx
          .insert(proveedoresTable)
          .values({
            nombre: parsed.data.nombre.trim(),
            tipo: parsed.data.tipo as TipoProveedor,
            monedaDefault: (parsed.data.monedaDefault ?? "MXN") as Moneda,
            contactoNombre: parsed.data.contactoNombre ?? null,
            telefono: parsed.data.telefono ?? null,
            correo: parsed.data.correo ?? null,
            pais: parsed.data.pais ?? null,
            notas: parsed.data.notas ?? null,
          })
          .returning();
        await tx.insert(auditoriaTable).values({
          usuarioId: req.auth!.user.id,
          accion: "CREAR",
          entidad: "proveedores",
          entidadId: String(proveedor!.id),
          datosDespues: { ...proveedor! } as Record<string, unknown>,
          ip: getRequestIp(req),
        });
        return proveedor!;
      });

      res.status(201).json(CreateProveedorResponse.parse(presentProveedor(created)));
    } catch (e) {
      next(e);
    }
  },
);

// ── GET /proveedores/:id ───────────────────────────────────────────────────

router.get(
  "/proveedores/:id",
  requierePermiso("proveedores", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const params = GetProveedorParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const [proveedor] = await db
        .select()
        .from(proveedoresTable)
        .where(eq(proveedoresTable.id, params.data.id))
        .limit(1);

      if (!proveedor) {
        res.status(404).json({ error: "Proveedor no encontrado." });
        return;
      }

      res.json(GetProveedorResponse.parse(presentProveedor(proveedor)));
    } catch (e) {
      next(e);
    }
  },
);

// ── PATCH /proveedores/:id ─────────────────────────────────────────────────

router.patch(
  "/proveedores/:id",
  requierePermiso("proveedores", "editar"),
  async (req, res, next): Promise<void> => {
    try {
      const params = UpdateProveedorParams.safeParse(req.params);
      const body = UpdateProveedorBody.safeParse(req.body);
      if (!params.success || !body.success || Object.keys(body.data).length === 0) {
        res.status(400).json({ error: "Datos del proveedor inválidos." });
        return;
      }

      const [before] = await db
        .select()
        .from(proveedoresTable)
        .where(eq(proveedoresTable.id, params.data.id))
        .limit(1);

      if (!before) {
        res.status(404).json({ error: "Proveedor no encontrado." });
        return;
      }

      // Only ADMIN may change activo
      if (body.data.activo !== undefined && req.auth!.user.rol !== "ADMIN") {
        res.status(403).json({
          error: "Solo ADMIN puede activar/desactivar proveedores.",
        });
        return;
      }

      const updates: {
        nombre?: string;
        tipo?: TipoProveedor;
        monedaDefault?: Moneda;
        contactoNombre?: string | null;
        telefono?: string | null;
        correo?: string | null;
        pais?: string | null;
        notas?: string | null;
        activo?: boolean;
      } = {};

      if (body.data.nombre !== undefined) updates.nombre = body.data.nombre.trim();
      if (body.data.tipo !== undefined) updates.tipo = body.data.tipo as TipoProveedor;
      if (body.data.monedaDefault !== undefined)
        updates.monedaDefault = body.data.monedaDefault as Moneda;
      if ("contactoNombre" in body.data)
        updates.contactoNombre = body.data.contactoNombre ?? null;
      if ("telefono" in body.data) updates.telefono = body.data.telefono ?? null;
      if ("correo" in body.data) updates.correo = body.data.correo ?? null;
      if ("pais" in body.data) updates.pais = body.data.pais ?? null;
      if ("notas" in body.data) updates.notas = body.data.notas ?? null;
      if (body.data.activo !== undefined) updates.activo = body.data.activo;

      const updated = await db.transaction(async (tx) => {
        const [proveedor] = await tx
          .update(proveedoresTable)
          .set(updates)
          .where(eq(proveedoresTable.id, params.data.id))
          .returning();
        await tx.insert(auditoriaTable).values({
          usuarioId: req.auth!.user.id,
          accion: "ACTUALIZAR",
          entidad: "proveedores",
          entidadId: String(params.data.id),
          datosAntes: { ...before } as Record<string, unknown>,
          datosDespues: { ...proveedor! } as Record<string, unknown>,
          ip: getRequestIp(req),
        });
        return proveedor!;
      });

      res.json(UpdateProveedorResponse.parse(presentProveedor(updated)));
    } catch (e) {
      next(e);
    }
  },
);

// ── GET /proveedores/:id/compras ───────────────────────────────────────────
// proveedores_finanzas module

router.get(
  "/proveedores/:id/compras",
  requierePermiso("proveedores_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const params = ListComprasProveedorParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const [prov] = await db
        .select({ id: proveedoresTable.id })
        .from(proveedoresTable)
        .where(eq(proveedoresTable.id, params.data.id))
        .limit(1);
      if (!prov) {
        res.status(404).json({ error: "Proveedor no encontrado." });
        return;
      }

      const desde = parseMexicoDateQuery(req.query.desde, "start");
      const hasta = parseMexicoDateQuery(req.query.hasta, "end");
      if (desde === null || hasta === null) {
        res.status(400).json({
          error: "Las fechas deben usar el formato YYYY-MM-DD.",
        });
        return;
      }
      const estado =
        typeof req.query.estado === "string"
          ? (req.query.estado as EstadoCompra)
          : null;
      const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
      const pageSize =
        typeof req.query.pageSize === "string"
          ? parseInt(req.query.pageSize, 10)
          : 20;

      const result = await comprasPorProveedor({
        proveedorId: params.data.id,
        desde,
        hasta,
        estado,
        page,
        pageSize,
      });

      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

// ── GET /proveedores/:id/pagos ─────────────────────────────────────────────
// proveedores_finanzas module

router.get(
  "/proveedores/:id/pagos",
  requierePermiso("proveedores_finanzas", "ver"),
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

      const [prov] = await db
        .select({ id: proveedoresTable.id })
        .from(proveedoresTable)
        .where(eq(proveedoresTable.id, id))
        .limit(1);
      if (!prov) {
        res.status(404).json({ error: "Proveedor no encontrado." });
        return;
      }

      // Return pagos from estado de cuenta
      const desde = parseMexicoDateQuery(req.query.desde, "start");
      const hasta = parseMexicoDateQuery(req.query.hasta, "end");
      if (desde === null || hasta === null) {
        res.status(400).json({ error: "Las fechas deben usar el formato YYYY-MM-DD." });
        return;
      }

      const { movimientos } = await estadoCuenta({ proveedorId: id, desde, hasta });
      const pagos = movimientos.filter((m) => m.tipo === "PAGO" || m.tipo === "AJUSTE");
      const aplicaciones = await db.execute<any>(sql`
        SELECT pago_proveedor_id, compra_proveedor_id, importe
        FROM aplicaciones_pago_proveedor
        WHERE pago_proveedor_id = ANY(ARRAY[${sql.raw(pagos.filter((p) => p.tipo === "PAGO").map((p) => p.id).join(",") || "0")}]::int[])`);
      const byPago = new Map<number, any[]>();
      for (const app of aplicaciones.rows) {
        const idPago = Number(app.pago_proveedor_id);
        byPago.set(idPago, [...(byPago.get(idPago) ?? []), {
          pagoProveedorId: idPago, compraProveedorId: Number(app.compra_proveedor_id), importe: app.importe,
        }]);
      }
      res.json({ proveedorId: id, pagos: pagos.map((p) => {
        const apps = byPago.get(p.id) ?? [];
        const applied = apps.reduce((sum, app) => sum + Number(app.importe), 0);
        return { ...p, aplicaciones: apps, saldoDisponible: p.tipo === "PAGO" ? (-Number(p.importe) - applied).toFixed(2) : "0.00" };
      }) });
    } catch (e) {
      next(e);
    }
  },
);

// ── GET /proveedores/:id/estado-cuenta ────────────────────────────────────
// proveedores_finanzas module

router.get(
  "/proveedores/:id/estado-cuenta",
  requierePermiso("proveedores_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const params = EstadoCuentaProveedorParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const [prov] = await db
        .select({ id: proveedoresTable.id })
        .from(proveedoresTable)
        .where(eq(proveedoresTable.id, params.data.id))
        .limit(1);
      if (!prov) {
        res.status(404).json({ error: "Proveedor no encontrado." });
        return;
      }

      const desde = parseMexicoDateQuery(req.query.desde, "start");
      const hasta = parseMexicoDateQuery(req.query.hasta, "end");
      if (desde === null || hasta === null) {
        res.status(400).json({
          error: "Las fechas deben usar el formato YYYY-MM-DD.",
        });
        return;
      }

      const result = await estadoCuenta({
        proveedorId: params.data.id,
        desde,
        hasta,
      });

      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

// ── POST /proveedores/:id/pagos ───────────────────────────────────────────
// proveedores_finanzas module + crear

router.post(
  "/proveedores/:id/pagos",
  requierePermiso("proveedores_finanzas", "crear"),
  async (req, res, next): Promise<void> => {
    try {
      const params = RegistrarPagoProveedorParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const [prov] = await db
        .select({ id: proveedoresTable.id, activo: proveedoresTable.activo })
        .from(proveedoresTable)
        .where(eq(proveedoresTable.id, params.data.id))
        .limit(1);
      if (!prov) {
        res.status(404).json({ error: "Proveedor no encontrado." });
        return;
      }
      if (!prov.activo) {
        res.status(400).json({ error: "El proveedor está inactivo." });
        return;
      }

      const { importe, formaPago, fecha: fechaRaw, referencia, notas } = req.body as {
        importe?: unknown;
        formaPago?: unknown;
        fecha?: unknown;
        referencia?: unknown;
        notas?: unknown;
      };

      if (typeof importe !== "number" || importe <= 0) {
        res.status(400).json({ error: "El importe debe ser un número positivo." });
        return;
      }

      const validFormas: FormaPagoProveedor[] = [
        "EFECTIVO",
        "TRANSFERENCIA",
        "CHEQUE",
        "OTRO",
      ];
      if (
        typeof formaPago !== "string" ||
        !validFormas.includes(formaPago as FormaPagoProveedor)
      ) {
        res.status(400).json({ error: "formaPago inválido." });
        return;
      }

      let fecha: Date | null = null;
      if (fechaRaw != null) {
        const parsed = new Date(fechaRaw as string);
        if (isNaN(parsed.getTime())) {
          res.status(400).json({ error: "fecha inválida." });
          return;
        }
        fecha = parsed;
      }

      if ("entradaId" in (req.body as Record<string, unknown>)) {
        res.status(400).json({ error: "entradaId no se admite; el pago se reparte FIFO." });
        return;
      }

      const row = await db.transaction(async (tx) =>
        registrarPago(tx, {
          proveedorId: params.data.id,
          importe: importe as number,
          formaPago: formaPago as FormaPagoProveedor,
          fecha,
          referencia: typeof referencia === "string" ? referencia : null,
          notas: typeof notas === "string" ? notas : null,
          usuarioId: req.auth!.user.id,
          ip: getRequestIp(req),
        }),
      );

      res.status(201).json({
        id: row.pago.id,
        proveedorId: row.pago.proveedorId,
        entradaId: null,
        importe: row.pago.importe,
        tipo: row.pago.tipo,
        formaPago: row.pago.formaPago ?? null,
        referencia: row.pago.referencia ?? null,
        fecha: row.pago.fecha.toISOString(),
        usuarioId: row.pago.usuarioId,
        notas: row.pago.notas ?? null,
        createdAt: row.pago.createdAt.toISOString(),
        saldoDisponible: row.saldoAFavor,
        aplicaciones: row.asignaciones,
      });
    } catch (e) {
      next(e);
    }
  },
);

// ── POST /proveedores/:id/ajustes ─────────────────────────────────────────
// proveedores_finanzas module + autorizar

router.post(
  "/proveedores/:id/ajustes",
  requierePermiso("proveedores_finanzas", "autorizar"),
  async (req, res, next): Promise<void> => {
    try {
      const params = RegistrarAjusteProveedorParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const [prov] = await db
        .select({ id: proveedoresTable.id, activo: proveedoresTable.activo })
        .from(proveedoresTable)
        .where(eq(proveedoresTable.id, params.data.id))
        .limit(1);
      if (!prov) {
        res.status(404).json({ error: "Proveedor no encontrado." });
        return;
      }
      if (!prov.activo) {
        res.status(400).json({ error: "El proveedor está inactivo." });
        return;
      }

      const { importe, notas } = req.body as {
        importe?: unknown;
        notas?: unknown;
      };

      if (typeof importe !== "number" || importe === 0) {
        res.status(400).json({ error: "El importe debe ser un número no cero." });
        return;
      }

      if (typeof notas !== "string" || notas.length < 10) {
        res.status(400).json({
          error: "Las notas deben tener al menos 10 caracteres.",
        });
        return;
      }

      const row = await db.transaction(async (tx) =>
        registrarAjuste(tx, {
          proveedorId: params.data.id,
          importe: importe as number,
          notas,
          usuarioId: req.auth!.user.id,
          ip: getRequestIp(req),
        }),
      );

      res.status(201).json({
        id: row.id,
        proveedorId: row.proveedorId,
        entradaId: row.entradaId ?? null,
        importe: row.importe,
        tipo: row.tipo,
        formaPago: row.formaPago ?? null,
        referencia: row.referencia ?? null,
        fecha: row.fecha.toISOString(),
        usuarioId: row.usuarioId,
        notas: row.notas ?? null,
        createdAt: row.createdAt.toISOString(),
      });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/proveedores/:id/compras/:compraId",
  requierePermiso("proveedores_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const params = GetProveedorCompraDetalleParams.safeParse(req.params);
      if (!params.success) { res.status(400).json({ error: "ID inválido." }); return; }
      const compra = await db.execute<any>(sql`SELECT * FROM pagos_proveedor WHERE id=${params.data.compraId} AND proveedor_id=${params.data.id} AND tipo='COMPRA'`);
      if (!compra.rows[0]) { res.status(404).json({ error: "Compra no encontrada." }); return; }
      const apps = await db.execute<any>(sql`
        SELECT a.pago_proveedor_id,a.compra_proveedor_id,a.importe,
          p.entrada_id,e.folio,p.fecha,
          (c.importe-COALESCE((SELECT SUM(x.importe) FROM aplicaciones_pago_proveedor x WHERE x.compra_proveedor_id=c.id),0))::text saldo
        FROM aplicaciones_pago_proveedor a JOIN pagos_proveedor p ON p.id=a.pago_proveedor_id
        JOIN pagos_proveedor c ON c.id=a.compra_proveedor_id LEFT JOIN entradas e ON e.id=c.entrada_id
        WHERE a.compra_proveedor_id=${params.data.compraId} ORDER BY a.id`);
      res.json(GetProveedorCompraDetalleResponse.parse({ compra: compra.rows[0], aplicaciones: apps.rows.map((a: any) => ({
        pagoProveedorId: Number(a.pago_proveedor_id), compraProveedorId: Number(a.compra_proveedor_id), importe: a.importe,
        saldoAntes: a.saldo, saldoDespues: a.saldo, entradaId: a.entrada_id, folio: a.folio,
        fecha: new Date(a.fecha).toISOString(), resultado: Number(a.saldo) === 0 ? "SALDADA" : "PARCIAL",
      })) }));
    } catch (e) { next(e); }
  },
);

router.get(
  "/proveedores/:id/pagos/:pagoId",
  requierePermiso("proveedores_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const params = GetProveedorPagoDetalleParams.safeParse(req.params);
      if (!params.success) { res.status(400).json({ error: "ID inválido." }); return; }
      const pago = await db.execute<any>(sql`SELECT * FROM pagos_proveedor WHERE id=${params.data.pagoId} AND proveedor_id=${params.data.id} AND tipo='PAGO'`);
      if (!pago.rows[0]) { res.status(404).json({ error: "Pago no encontrado." }); return; }
      const apps = await db.execute<any>(sql`
        SELECT a.*,c.entrada_id,e.folio,c.fecha,
          (c.importe-COALESCE((SELECT SUM(x.importe) FROM aplicaciones_pago_proveedor x WHERE x.compra_proveedor_id=c.id),0))::text saldo
        FROM aplicaciones_pago_proveedor a JOIN pagos_proveedor c ON c.id=a.compra_proveedor_id
        LEFT JOIN entradas e ON e.id=c.entrada_id WHERE a.pago_proveedor_id=${params.data.pagoId} ORDER BY a.id`);
      const saldo = await db.execute<any>(sql`SELECT (-importe-COALESCE((SELECT SUM(importe) FROM aplicaciones_pago_proveedor WHERE pago_proveedor_id=${params.data.pagoId}),0))::text saldo FROM pagos_proveedor WHERE id=${params.data.pagoId}`);
      res.json(GetProveedorPagoDetalleResponse.parse({ pago: pago.rows[0], saldoDisponible: saldo.rows[0]?.saldo ?? "0.00",
        aplicaciones: apps.rows.map((a: any) => ({ pagoProveedorId: Number(a.pago_proveedor_id), compraProveedorId: Number(a.compra_proveedor_id), importe: a.importe,
          saldoAntes: a.saldo, saldoDespues: a.saldo, entradaId: a.entrada_id, folio: a.folio, fecha: new Date(a.fecha).toISOString(),
          resultado: Number(a.saldo) === 0 ? "SALDADA" : "PARCIAL" })) }));
    } catch (e) { next(e); }
  },
);

// ── GET /proveedores/:id/estadisticas ─────────────────────────────────────
// proveedores_finanzas module

router.get(
  "/proveedores/:id/estadisticas",
  requierePermiso("proveedores_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const params = EstadisticasProveedorParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const [prov] = await db
        .select({ id: proveedoresTable.id })
        .from(proveedoresTable)
        .where(eq(proveedoresTable.id, params.data.id))
        .limit(1);
      if (!prov) {
        res.status(404).json({ error: "Proveedor no encontrado." });
        return;
      }

      const desde = parseMexicoDateQuery(req.query.desde, "start");
      const hasta = parseMexicoDateQuery(req.query.hasta, "end");

      if (desde === undefined || hasta === undefined) {
        res.status(400).json({
          error: "Los parámetros desde y hasta son requeridos.",
        });
        return;
      }
      if (desde === null || hasta === null) {
        res.status(400).json({
          error: "Las fechas deben usar el formato YYYY-MM-DD.",
        });
        return;
      }
      if (desde > hasta) {
        res.status(400).json({
          error: "La fecha desde no puede ser posterior a la fecha hasta.",
        });
        return;
      }

      const stats = await estadisticasPeriodo({
        proveedorId: params.data.id,
        desde,
        hasta,
      });

      res.json(stats);
    } catch (e) {
      next(e);
    }
  },
);

// ── GET /proveedores/:id/exportar ─────────────────────────────────────────
// proveedores_finanzas module

router.get(
  "/proveedores/:id/exportar",
  requierePermiso("proveedores_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const params = ExportarProveedorXlsxParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const [prov] = await db
        .select()
        .from(proveedoresTable)
        .where(eq(proveedoresTable.id, params.data.id))
        .limit(1);
      if (!prov) {
        res.status(404).json({ error: "Proveedor no encontrado." });
        return;
      }

      const desde = parseMexicoDateQuery(req.query.desde, "start");
      const hasta = parseMexicoDateQuery(req.query.hasta, "end");
      if (desde === null || hasta === null) {
        res.status(400).json({
          error: "Las fechas deben usar el formato YYYY-MM-DD.",
        });
        return;
      }

      const { movimientos, saldoActual } = await estadoCuenta({
        proveedorId: params.data.id,
        desde,
        hasta,
      });

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Mariana Textil";
      workbook.created = new Date();

      const sheet = workbook.addWorksheet("Estado de Cuenta");
      sheet.addRow(["Proveedor:", prov.nombre]);
      sheet.addRow(["Generado:", new Date().toLocaleString("es-MX")]);
      if (desde) sheet.addRow(["Desde:", desde.toLocaleDateString("es-MX")]);
      if (hasta) sheet.addRow(["Hasta:", hasta.toLocaleDateString("es-MX")]);
      sheet.addRow([]);
      sheet.addRow([
        "Fecha",
        "Tipo",
        "Folio",
        "Importe",
        "Saldo Acumulado",
        "Forma de Pago",
        "Referencia",
        "Notas",
      ]);

      for (const m of movimientos) {
        sheet.addRow([
          new Date(m.fecha).toLocaleDateString("es-MX"),
          m.tipo,
          m.folio == null ? "" : String(m.folio),
          toExcelNumber(m.importe),
          toExcelNumber(m.saldoAcumulado),
          m.formaPago ?? "",
          m.referencia ?? "",
          m.notas ?? "",
        ]);
      }

      sheet.addRow([]);
      sheet.addRow(["Saldo actual:", toExcelNumber(saldoActual)]);
      sheet.getColumn(4).numFmt = EXCEL_NUMBER_FORMAT.money;
      sheet.getColumn(5).numFmt = EXCEL_NUMBER_FORMAT.money;
      sheet.getRow(sheet.rowCount).getCell(2).numFmt = EXCEL_NUMBER_FORMAT.money;

      const filename = `estado-cuenta-${prov.nombre.replace(/\s+/g, "-").toLowerCase()}.xlsx`;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (e) {
      next(e);
    }
  },
);

export default router;
