import { Router, type IRouter } from "express";
import {
  DeleteRegistroInactivoBody,
  DeleteRegistroInactivoParams,
  DeleteRegistroInactivoResponse,
  GetPurgaPreflightParams,
  GetPurgaPreflightResponse,
} from "@workspace/api-zod";
import { requireRole, requireSession } from "../middlewares/auth";
import { getRequestIp } from "../lib/request";
import {
  getPurgaPreflight,
  purgeInactiveRecord,
  PurgaAuthorizationError,
  PurgaConflictError,
  PurgaNotFoundError,
} from "../lib/purga-catalogos";

const router: IRouter = Router();
router.use("/purga", requireSession, requireRole("ADMIN"));

router.get("/purga/:entidad/:id/preflight", async (req, res): Promise<void> => {
  const params = GetPurgaPreflightParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Parámetros de purga inválidos." });
    return;
  }
  try {
    const result = await getPurgaPreflight(params.data.entidad, params.data.id);
    res.json(GetPurgaPreflightResponse.parse(result));
  } catch (error) {
    if (error instanceof PurgaNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

router.delete("/purga/:entidad/:id", async (req, res): Promise<void> => {
  const params = DeleteRegistroInactivoParams.safeParse(req.params);
  const body = DeleteRegistroInactivoBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "La confirmación de purga es inválida." });
    return;
  }
  try {
    const confirmation = body.data;
    if (
      (params.data.entidad === "productos" && !("usuario" in confirmation)) ||
      (params.data.entidad !== "productos" && !("confirmacion" in confirmation))
    ) {
      res.status(400).json({
        error:
          params.data.entidad === "productos"
            ? "Se requiere usuario y contraseña para confirmar el borrado."
            : "Se requiere el texto de confirmación.",
      });
      return;
    }
    await purgeInactiveRecord({
      ...params.data,
      ...("confirmacion" in confirmation
        ? { confirmacion: confirmation.confirmacion }
        : {
            adminUsuario: confirmation.usuario,
            adminPassword: confirmation.password,
          }),
      actorId: req.auth!.user.id,
      ip: getRequestIp(req),
    });
    res.json(DeleteRegistroInactivoResponse.parse({ eliminado: true }));
  } catch (error) {
    if (error instanceof PurgaAuthorizationError) {
      res.status(403).json({ error: error.message });
      return;
    }
    if (error instanceof PurgaNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    if (
      error instanceof PurgaConflictError ||
      (error as { code?: string }).code === "23503"
    ) {
      const references =
        error instanceof PurgaConflictError ? error.referencias : [];
      res.status(409).json({
        error:
          error instanceof PurgaConflictError
            ? error.message
            : "El registro conserva una referencia no disponible en el preflight.",
        referencias: references,
        totalReferencias: references.reduce((sum, item) => sum + item.cantidad, 0),
      });
      return;
    }
    throw error;
  }
});

export default router;