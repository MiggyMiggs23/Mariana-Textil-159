import { Router, type IRouter } from "express";
import ExcelJS from "exceljs";
import {
  ExportAuditoriaXlsxQueryParams,
  GetAuditoriaParams,
  GetAuditoriaResponse,
  ListAuditoriaQueryParams,
  ListAuditoriaResponse,
} from "@workspace/api-zod";
import { requireSession } from "../middlewares/auth";
import {
  exportAuditoriaRows,
  getAuditoria,
  listAuditoria,
} from "../lib/auditoria";
import { requierePermiso } from "../lib/permisos";

const router: IRouter = Router();

router.use(
  "/auditoria",
  requireSession,
  requierePermiso("auditoria", "ver"),
);

router.get("/auditoria", async (req, res): Promise<void> => {
  const parsed = ListAuditoriaQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { page, pageSize, ...filters } = parsed.data;
  res.json(ListAuditoriaResponse.parse(await listAuditoria(filters, page, pageSize)));
});

router.get("/auditoria/export.xlsx", async (req, res): Promise<void> => {
  const parsed = ExportAuditoriaXlsxQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  let rows;
  try {
    rows = await exportAuditoriaRows(parsed.data);
  } catch (error) {
    if (error instanceof Error && error.message === "AUDIT_EXPORT_LIMIT") {
      res.status(400).json({
        error: "El resultado supera 10000 registros; reduce el rango o aplica más filtros.",
      });
      return;
    }
    throw error;
  }
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Bitácora");
  sheet.columns = [
    { header: "Fecha", key: "fecha", width: 24 },
    { header: "Usuario", key: "usuario", width: 22 },
    { header: "Rol al momento", key: "rolSnapshot", width: 18 },
    { header: "Acción", key: "accion", width: 24 },
    { header: "Módulo", key: "modulo", width: 20 },
    { header: "Entidad", key: "entidad", width: 24 },
    { header: "Identificador", key: "entidadId", width: 20 },
    { header: "Sitio", key: "sitio", width: 24 },
    { header: "IP", key: "ip", width: 20 },
  ];
  rows.forEach((row) => sheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="bitacora.xlsx"');
  res.send(Buffer.from(buffer));
});

router.get("/auditoria/:id", async (req, res): Promise<void> => {
  const parsed = GetAuditoriaParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const result = await getAuditoria(String(parsed.data.id));
  if (!result) {
    res.status(404).json({ error: "Registro de bitácora no encontrado." });
    return;
  }
  res.json(GetAuditoriaResponse.parse(result));
});

export default router;