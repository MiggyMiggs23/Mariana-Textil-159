import type { Request } from "express";

export function getRequestIp(req: Request): string {
  // Express resolves req.ip using the application's trust proxy policy. Reading
  // X-Forwarded-For directly here would let an untrusted client spoof its
  // lockout/audit source.
  return req.ip || "desconocida";
}