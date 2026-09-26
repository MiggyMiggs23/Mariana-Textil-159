import { Router } from "express";
import { pool } from "@workspace/db";
import { ListClientesListadoQueryParams, ListClientesListadoResponse } from "@workspace/api-zod";
import { requireSession } from "../middlewares/auth";
import { requierePermiso, resolvePermiso } from "../lib/permisos";
import { resolveClienteFinancialReadScope } from "../lib/clientes-financial-read-scope";
import { CarteraScopeError } from "../lib/clientes-cartera-read-model";
import { readClientesListado } from "../lib/clientes-listado";
import { resolveReadScope } from "./inventario";

const router = Router();
router.get("/clientes/listado", requireSession, requierePermiso("clientes", "ver"), async (req, res, next): Promise<void> => {
  const parsed = ListClientesListadoQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Filtros de clientes inválidos." }); return; }
  res.setHeader("Cache-Control", "private, no-store");
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const permission = await resolvePermiso(req.auth!.user.id, req.auth!.user.rol, "clientes_finanzas");
    const financial = req.auth!.user.rol === "ADMIN" || permission?.puedeVer === true;
    const scope = financial ? await resolveClienteFinancialReadScope(req.auth!, {}, client, resolveReadScope) : null;
    const result = await readClientesListado(client, parsed.data, financial,
      scope?.tipo === "SITIOS" ? scope.ubicaciones.map(site => site.id) : null);
    const response = ListClientesListadoResponse.parse(result);
    await client.query("COMMIT");
    res.json(response);
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof CarteraScopeError) { res.status(error.status).json({ error: error.message }); return; }
    next(error);
  } finally { client.release(); }
});
export default router;