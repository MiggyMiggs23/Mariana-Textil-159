import type { NextFunction, Request, Response } from "express";
import { e11AuthIdentity } from "../lib/e11-repository";
import { e11ErrorBody, E11Error, type E11Identity } from "../lib/e11";
import { and, eq, gt } from "drizzle-orm";
import {
  db,
  sesionesTable,
  ubicacionesTable,
  usuariosTable,
  type RolUsuario,
  type Ubicacion,
  type Usuario,
} from "@workspace/db";

const SESSION_COOKIE = "mariana_session";
function unauthenticated(req: Request, res: Response, message: string) {
  res.status(401).json(req.baseUrl.endsWith("/e11")
    ? e11ErrorBody(new E11Error("NO_AUTENTICADO", message, 401)) : { error: message });
}
// Eight idle hours cover a complete quiet shift but still let the session die
// overnight. The fixed sixteen-hour ceiling protects unusually long shifts and
// never slides with activity.
export const INACTIVITY_MS = 8 * 60 * 60 * 1000;
export const ABSOLUTE_SESSION_MS = 16 * 60 * 60 * 1000;

export function calculateSessionExpiry(now: Date, createdAt: Date): Date {
  const inactivityDeadline = now.getTime() + INACTIVITY_MS;
  const absoluteDeadline = createdAt.getTime() + ABSOLUTE_SESSION_MS;
  return new Date(Math.min(inactivityDeadline, absoluteDeadline));
}

export type AuthContext = {
  sessionId: string;
  user: Usuario;
  location: Ubicacion | null;
  /** Separate gated sidecar identity; never a new base role or users column. */
  e11?: E11Identity;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export function setSessionCookie(res: Response, sessionId: string): void {
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: ABSOLUTE_SESSION_MS,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function requireSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const sessionId = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!sessionId) {
    unauthenticated(req, res, "Debes iniciar sesión.");
    return;
  }

  const now = new Date();
  const [row] = await db
    .select({
      session: sesionesTable,
      user: usuariosTable,
      location: ubicacionesTable,
    })
    .from(sesionesTable)
    .innerJoin(usuariosTable, eq(sesionesTable.usuarioId, usuariosTable.id))
    .leftJoin(
      ubicacionesTable,
      eq(usuariosTable.ubicacionId, ubicacionesTable.id),
    )
    .where(
      and(
        eq(sesionesTable.id, sessionId),
        gt(sesionesTable.expiraAt, now),
        eq(usuariosTable.activo, true),
      ),
    )
    .limit(1);

  if (!row) {
    clearSessionCookie(res);
    unauthenticated(req, res, "La sesión venció. Inicia sesión de nuevo.");
    return;
  }

  const nextExpiry = calculateSessionExpiry(now, row.session.createdAt);

  if (nextExpiry <= now) {
    clearSessionCookie(res);
    unauthenticated(req, res, "La sesión venció. Inicia sesión de nuevo.");
    return;
  }

  await db
    .update(sesionesTable)
    .set({ expiraAt: nextExpiry })
    .where(eq(sesionesTable.id, sessionId));

  req.auth = {
    sessionId,
    user: row.user,
    location: row.location,
  };
  const e11 = await e11AuthIdentity(row.user.id, sessionId);
  if (e11) {
    if (e11.rolBase !== row.user.rol) {
      res.status(409).json(e11ErrorBody(new E11Error("PERFIL_CAMBIADO", "La identidad cambió; recarga la sesión.")));
      return;
    }
    req.auth.e11 = e11;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-E11-Perfil", e11.perfil ?? "NINGUNO");
    res.setHeader("X-E11-Perfil-Version", String(e11.perfilVersion));
    res.setHeader("X-E11-Permisos-Version", e11.permisosVersion);
  }
  next();
}

export function requireRole(...roles: RolUsuario[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth || !roles.includes(req.auth.user.rol)) {
      res.status(403).json({ error: "No tienes permisos para esta operación." });
      return;
    }
    next();
  };
}