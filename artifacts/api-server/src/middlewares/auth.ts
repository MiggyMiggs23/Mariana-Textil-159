import type { NextFunction, Request, Response } from "express";
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
const INACTIVITY_MS = 30 * 60 * 1000;
const ABSOLUTE_SESSION_MS = 12 * 60 * 60 * 1000;

export type AuthContext = {
  sessionId: string;
  user: Usuario;
  location: Ubicacion | null;
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
    res.status(401).json({ error: "Debes iniciar sesión." });
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
    res.status(401).json({ error: "La sesión venció. Inicia sesión de nuevo." });
    return;
  }

  const inactivityDeadline = now.getTime() + INACTIVITY_MS;
  const absoluteDeadline =
    row.session.createdAt.getTime() + ABSOLUTE_SESSION_MS;
  const nextExpiry = new Date(Math.min(inactivityDeadline, absoluteDeadline));

  if (nextExpiry <= now) {
    clearSessionCookie(res);
    res.status(401).json({ error: "La sesión venció. Inicia sesión de nuevo." });
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