import { Router, type IRouter } from "express";
import { GetAdminAlertasResponse } from "@workspace/api-zod";
import { requireRole, requireSession } from "../middlewares/auth";
import { getAdminAlertas } from "../lib/admin-alertas";

const router: IRouter = Router();

router.get(
  "/admin/alertas",
  requireSession,
  requireRole("ADMIN"),
  async (_req, res): Promise<void> => {
    res.setHeader("Cache-Control", "private, no-store");
    const parsed = GetAdminAlertasResponse.parse(await getAdminAlertas());
    res.json({
      ...parsed,
      generatedAt: parsed.generatedAt.toISOString(),
      ticketsPendientes: parsed.ticketsPendientes.map((ticket) => ({
        ...ticket,
        createdAt: ticket.createdAt.toISOString(),
      })),
      creditos: parsed.creditos.map((credito) => ({
        ...credito,
        fechaVencimiento: credito.fechaVencimiento.toISOString().slice(0, 10),
      })),
      salidasEnTransito: parsed.salidasEnTransito.map((salida) => ({
        ...salida,
        enviadaAt: salida.enviadaAt.toISOString(),
      })),
    });
  },
);

export default router;