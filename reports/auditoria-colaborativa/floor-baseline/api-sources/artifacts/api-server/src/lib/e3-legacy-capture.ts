import type { RequestHandler } from "express";
import { E3_ENABLED } from "./e3-collection";

/** Once E3 is released the old generic preview cannot identify recaptures reliably
 * (its legacy body can omit naturaleza). Close BOTH legacy capture endpoints,
 * rather than trusting a client-supplied nature or silently granting the new permission.
 * OFF preserves the pre-E3 routes unchanged. Tests inject only this policy switch. */
export function legacyPaymentCaptureGuard(enabled: boolean = E3_ENABLED): RequestHandler {
  return (_req, res, next) => {
    if (enabled) {
      res.status(409).json({
        code: "E3_DEDICATED_CAPTURE_REQUIRED",
        error: "Usa Caja para dinero recibido ahora. Para recapturas usa la pantalla del cliente: exige motivo y permiso clientes_recapturas.",
      });
      return;
    }
    next();
  };
}