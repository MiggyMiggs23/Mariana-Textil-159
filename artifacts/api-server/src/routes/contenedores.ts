import { Router, type Request, type Response } from "express";
import ExcelJS from "exceljs";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  CancelContenedorBody,
  CancelContenedorParams,
  CancelContenedorResponse,
  CreateContenedorBody,
  CreateContenedorResponse,
  ExportContenedoresPdfQueryParams,
  ExportContenedoresXlsxQueryParams,
  GetCatalogosContenedoresResponse,
  GetContenedorParams,
  GetContenedorResponse,
  GetResumenContenedoresQueryParams,
  GetResumenContenedoresResponse,
  ListContenedoresDisponiblesEntradaQueryParams,
  ListContenedoresDisponiblesEntradaResponse,
  ListContenedoresQueryParams,
  ListContenedoresResponse,
  UpdateContenedorBody,
  UpdateContenedorParams,
  UpdateContenedorResponse,
} from "@workspace/api-zod";
import {
  db,
  productosTable,
  proveedoresTable,
  ubicacionesTable,
} from "@workspace/db";
import { requireSession } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import {
  cancelContenedor,
  ContenedorError,
  createContenedor,
  getContenedorDetail,
  getContenedoresSummary,
  listAvailableForEntry,
  listContenedores,
  redactEconomicData,
  updateContenedor,
} from "../lib/contenedores";
import { createTextPdf } from "../lib/pdf";

const router = Router();

function scope(req: Request) {
  const user = req.auth!.user;
  return {
    admin: user.rol === "ADMIN",
    sitioId: user.rol === "BODEGA" ? (user.ubicacionId ?? -1) : undefined,
  };
}

function missingBodegaSite(req: Request, res: Response): boolean {
  if (req.auth!.user.rol !== "BODEGA" || req.auth!.user.ubicacionId != null) {
    return false;
  }
  res.status(403).json({ error: "No tienes una ubicación asignada." });
  return true;
}

function sendDomainError(res: Response, error: unknown): boolean {
  if (!(error instanceof ContenedorError)) return false;
  const status =
    error.code === "NOT_FOUND"
      ? 404
      : error.code === "NOT_EDITABLE"
        ? 409
        : 400;
  res.status(status).json({ error: error.message, code: error.code });
  return true;
}

function calendarString(
  value: Date | string | null | undefined,
): string | null | undefined {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function normalizeInput<T extends {
  fechaPedido?: Date | string | null;
  fechaEstimadaLlegada: Date | string;
}>(body: T) {
  return {
    ...body,
    fechaPedido: calendarString(body.fechaPedido),
    fechaEstimadaLlegada: calendarString(body.fechaEstimadaLlegada)!,
  };
}

router.get(
  "/contenedores/catalogos",
  requireSession,
  requierePermiso("contenedores", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const user = req.auth!.user;
      if (missingBodegaSite(req, res)) return;
      const siteCondition =
        user.rol === "BODEGA" && user.ubicacionId != null
          ? and(
              eq(ubicacionesTable.id, user.ubicacionId),
              eq(ubicacionesTable.activa, true),
              inArray(ubicacionesTable.tipo, ["TIENDA", "BODEGA"]),
            )
          : and(
              eq(ubicacionesTable.activa, true),
              inArray(ubicacionesTable.tipo, ["TIENDA", "BODEGA"]),
            );
      const [productos, proveedores, sitios] = await Promise.all([
        db
          .select({
            id: productosTable.id,
            sku: productosTable.sku,
            tela: productosTable.tela,
            color: productosTable.color,
            unidad: productosTable.unidad,
          })
          .from(productosTable)
          .where(eq(productosTable.activo, true))
          .orderBy(asc(productosTable.tela), asc(productosTable.color)),
        db
          .select({ id: proveedoresTable.id, nombre: proveedoresTable.nombre })
          .from(proveedoresTable)
          .where(eq(proveedoresTable.activo, true))
          .orderBy(asc(proveedoresTable.nombre)),
        db
          .select({ id: ubicacionesTable.id, nombre: ubicacionesTable.nombre })
          .from(ubicacionesTable)
          .where(siteCondition)
          .orderBy(asc(ubicacionesTable.nombre)),
      ]);
      res.json(
        GetCatalogosContenedoresResponse.parse({
          productos,
          proveedores,
          sitios,
        }),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/contenedores",
  requireSession,
  requierePermiso("contenedores", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      if (missingBodegaSite(req, res)) return;
      const query = ListContenedoresQueryParams.parse(req.query);
      const result = await listContenedores(
        {
          ...query,
          fechaDesde: calendarString(query.fechaDesde) ?? undefined,
          fechaHasta: calendarString(query.fechaHasta) ?? undefined,
          page: query.page ?? 1,
          pageSize: query.pageSize ?? 20,
        },
        scope(req),
      );
      res.json(ListContenedoresResponse.parse(result));
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/contenedores",
  requireSession,
  requierePermiso("contenedores", "crear"),
  async (req, res, next): Promise<void> => {
    try {
      const body = CreateContenedorBody.parse(req.body);
      const ownScope = scope(req);
      if (
        ownScope.sitioId != null &&
        ownScope.sitioId !== body.sitioDestinoId
      ) {
        res.status(403).json({ error: "Sitio fuera de tu alcance." });
        return;
      }
      const container = await db.transaction((tx) =>
        createContenedor(tx, normalizeInput(body), req.auth!.user.id),
      );
      const detail = await getContenedorDetail(container.id, ownScope);
      res.status(201).json(CreateContenedorResponse.parse(detail));
    } catch (error) {
      if (!sendDomainError(res, error)) next(error);
    }
  },
);

router.get(
  "/contenedores/resumen",
  requireSession,
  requierePermiso("contenedores", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      if (missingBodegaSite(req, res)) return;
      const query = GetResumenContenedoresQueryParams.parse(req.query);
      if (query.quarter != null && query.semester != null) {
        res.status(400).json({ error: "Selecciona trimestre o semestre, no ambos." });
        return;
      }
      const ownScope = scope(req);
      if (ownScope.sitioId == null && query.sitioDestinoId != null) {
        ownScope.sitioId = query.sitioDestinoId;
      }
      const summary = await getContenedoresSummary(
        query.year,
        query.quarter,
        query.semester,
        ownScope,
      );
      const output = ownScope.admin ? summary : redactEconomicData(summary);
      res.json(GetResumenContenedoresResponse.parse(output));
    } catch (error) {
      if (!sendDomainError(res, error)) next(error);
    }
  },
);

router.get(
  "/contenedores/disponibles-entrada",
  requireSession,
  requierePermiso("entradas", "crear"),
  async (req, res, next): Promise<void> => {
    try {
      const query = ListContenedoresDisponiblesEntradaQueryParams.parse(
        req.query,
      );
      const user = req.auth!.user;
      const siteId =
        user.rol === "ADMIN" ? query.ubicacionId : user.ubicacionId;
      if (siteId == null || (user.rol !== "ADMIN" && siteId !== query.ubicacionId)) {
        res.status(403).json({ error: "Sitio fuera de tu alcance." });
        return;
      }
      res.json(
        ListContenedoresDisponiblesEntradaResponse.parse(
          await listAvailableForEntry(siteId),
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/contenedores/:id",
  requireSession,
  requierePermiso("contenedores", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      if (req.params.id === "export.xlsx" || req.params.id === "export.pdf") {
        next();
        return;
      }
      if (missingBodegaSite(req, res)) return;
      const { id } = GetContenedorParams.parse(req.params);
      const detail = await getContenedorDetail(id, scope(req));
      if (!detail) {
        res.status(404).json({ error: "Contenedor no encontrado." });
        return;
      }
      res.json(GetContenedorResponse.parse(detail));
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/contenedores/:id",
  requireSession,
  requierePermiso("contenedores", "editar"),
  async (req, res, next): Promise<void> => {
    try {
      const { id } = UpdateContenedorParams.parse(req.params);
      const body = UpdateContenedorBody.parse(req.body);
      if (!(await getContenedorDetail(id, scope(req)))) {
        res.status(404).json({ error: "Contenedor no encontrado." });
        return;
      }
      const ownScope = scope(req);
      await db.transaction((tx) =>
        updateContenedor(tx, id, normalizeInput(body), ownScope.sitioId),
      );
      const detail = await getContenedorDetail(id, scope(req));
      res.json(UpdateContenedorResponse.parse(detail));
    } catch (error) {
      if (!sendDomainError(res, error)) next(error);
    }
  },
);

router.post(
  "/contenedores/:id/cancelar",
  requireSession,
  requierePermiso("contenedores", "autorizar"),
  async (req, res, next): Promise<void> => {
    try {
      const { id } = CancelContenedorParams.parse(req.params);
      const { motivo } = CancelContenedorBody.parse(req.body);
      if (!(await getContenedorDetail(id, scope(req)))) {
        res.status(404).json({ error: "Contenedor no encontrado." });
        return;
      }
      await db.transaction((tx) =>
        cancelContenedor(tx, id, motivo, scope(req).sitioId),
      );
      const detail = await getContenedorDetail(id, scope(req));
      res.json(CancelContenedorResponse.parse(detail));
    } catch (error) {
      if (!sendDomainError(res, error)) next(error);
    }
  },
);

async function exportRows(
  req: Request,
  query: { year: number; quarter?: number; semester?: number },
) {
  if (query.quarter != null && query.semester != null) {
    throw new ContenedorError(
      "Selecciona trimestre o semestre, no ambos.",
      "INVALID_PERIOD",
    );
  }
  const summary = await getContenedoresSummary(
    query.year,
    query.quarter,
    query.semester,
    scope(req),
  );
  return scope(req).admin ? summary : redactEconomicData(summary);
}

function exportDatasets(summary: Record<string, unknown>) {
  const actual = summary.actual as Record<string, unknown>;
  const periodo = summary.periodo as Record<string, unknown>;
  return [
    { name: "Situacion actual", rows: [{ seccion: "Actual", ...actual }] },
    { name: "Periodo", rows: [{ seccion: "Periodo", ...periodo }] },
    { name: "Proveedores", rows: summary.porProveedor as Array<Record<string, unknown>> },
    { name: "Productos", rows: summary.porProducto as Array<Record<string, unknown>> },
    { name: "Telas", rows: summary.porTela as Array<Record<string, unknown>> },
    { name: "Colores", rows: summary.porColor as Array<Record<string, unknown>> },
    { name: "Mensual", rows: summary.porMes as Array<Record<string, unknown>> },
    { name: "Diferencias", rows: summary.diferencias as Array<Record<string, unknown>> },
  ];
}

function cell(value: unknown): string | number {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return typeof value === "number" ? value : String(value);
}

function wrapPdfLine(value: string, width = 88): string[] {
  if (value.length <= width) return [value];
  const chunks: string[] = [];
  let remaining = value;
  while (remaining.length > width) {
    const breakAt = remaining.lastIndexOf(" ", width);
    const at = breakAt > 0 ? breakAt : width;
    chunks.push(remaining.slice(0, at));
    remaining = remaining.slice(at).trimStart();
  }
  chunks.push(remaining);
  return chunks;
}

router.get(
  "/contenedores/export.xlsx",
  requireSession,
  requierePermiso("contenedores", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      if (missingBodegaSite(req, res)) return;
      const query = ExportContenedoresXlsxQueryParams.parse(req.query);
      const summary = (await exportRows(req, query)) as Record<string, unknown>;
      const workbook = new ExcelJS.Workbook();
      for (const dataset of exportDatasets(summary)) {
        const { name, rows } = dataset;
        const sheet = workbook.addWorksheet(name.slice(0, 31));
        const keys = [...new Set(rows.flatMap((row) => Object.keys(row ?? {})))];
        sheet.addRow(keys);
        sheet.getRow(1).font = { bold: true };
        sheet.views = [{ state: "frozen", ySplit: 1 }];
        for (const row of rows) sheet.addRow(keys.map((key) => cell(row?.[key])));
        (sheet.columns ?? []).forEach((column) => {
          column.width = Math.min(
            40,
            Math.max(
              12,
              ...(column.values ?? []).map(
                (value) => String(value ?? "").length + 2,
              ),
            ),
          );
        });
      }
      const bytes = await workbook.xlsx.writeBuffer();
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", 'attachment; filename="contenedores.xlsx"');
      res.send(Buffer.from(bytes));
    } catch (error) {
      if (!sendDomainError(res, error)) next(error);
    }
  },
);

router.get(
  "/contenedores/export.pdf",
  requireSession,
  requierePermiso("contenedores", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      if (missingBodegaSite(req, res)) return;
      const query = ExportContenedoresPdfQueryParams.parse(req.query);
      const summary = (await exportRows(req, query)) as Record<string, unknown>;
      const lines = exportDatasets(summary).flatMap(({ name, rows }) =>
        [
          `=== ${name} ===`,
          ...rows.flatMap((row) =>
            Object.entries(row).flatMap(([key, value]) =>
              wrapPdfLine(`${key}: ${cell(value)}`),
            ),
          ),
          "",
        ].flatMap((line) => wrapPdfLine(line)),
      );
      const pdf = createTextPdf("Próximos contenedores", lines);
      res.type("application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="contenedores.pdf"');
      res.send(pdf);
    } catch (error) {
      if (!sendDomainError(res, error)) next(error);
    }
  },
);

export default router;