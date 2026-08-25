import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, count, eq, gt, sql } from "drizzle-orm";
import {
  GetCurrentUserResponse,
  LoginBody,
  LoginResponse,
} from "@workspace/api-zod";
import {
  auditoriaTable,
  db,
  sesionesTable,
  ubicacionesTable,
  usuariosTable,
} from "@workspace/db";
import {
  clearSessionCookie,
  requireSession,
  setSessionCookie,
} from "../middlewares/auth";
import { presentUser } from "../lib/presenters";
import { buildPermissionMatrix } from "../lib/permisos";
import { getRequestIp } from "../lib/request";
import { normalizeUsername } from "../lib/auth-identifiers";

const router: IRouter = Router();
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const INACTIVITY_MS = 30 * 60 * 1000;

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Usuario y contraseña son obligatorios." });
    return;
  }

  const username = normalizeUsername(parsed.data.usuario);
  const ip = getRequestIp(req);
  const since = new Date(Date.now() - LOCKOUT_WINDOW_MS);

  const [attempts] = await db
    .select({ value: count() })
    .from(auditoriaTable)
    .where(
      and(
        eq(auditoriaTable.accion, "LOGIN_FALLIDO"),
        eq(auditoriaTable.entidad, "usuarios"),
        eq(auditoriaTable.entidadId, username),
        gt(auditoriaTable.createdAt, since),
      ),
    );

  if (Number(attempts?.value ?? 0) >= 5) {
    res.status(429).json({
      error:
        "La cuenta está temporalmente bloqueada. Intenta de nuevo en 15 minutos.",
    });
    return;
  }

  const [row] = await db
    .select({ user: usuariosTable, location: ubicacionesTable })
    .from(usuariosTable)
    .leftJoin(
      ubicacionesTable,
      eq(usuariosTable.ubicacionId, ubicacionesTable.id),
    )
    .where(
      and(
        eq(usuariosTable.usuario, username),
        sql`${usuariosTable.passwordHash} = crypt(${parsed.data.password}, ${usuariosTable.passwordHash})`,
      ),
    )
    .limit(1);

  if (!row || !row.user.activo) {
    await db.insert(auditoriaTable).values({
      usuarioId: row?.user.id ?? null,
      accion: "LOGIN_FALLIDO",
      entidad: "usuarios",
      entidadId: username,
      datosDespues: { motivo: row?.user.activo === false ? "inactivo" : "credenciales" },
      ip,
    });
    res.status(401).json({ error: "Usuario o contraseña incorrectos." });
    return;
  }

  const sessionId = randomUUID();
  const now = new Date();
  const expiraAt = new Date(now.getTime() + INACTIVITY_MS);

  await db.transaction(async (tx) => {
    await tx.insert(sesionesTable).values({
      id: sessionId,
      usuarioId: row.user.id,
      expiraAt,
      ip,
      userAgent: req.get("user-agent") ?? "desconocido",
    });
    await tx
      .update(usuariosTable)
      .set({ ultimoAcceso: now })
      .where(eq(usuariosTable.id, row.user.id));
    await tx.insert(auditoriaTable).values({
      usuarioId: row.user.id,
      accion: "LOGIN_EXITOSO",
      entidad: "sesiones",
      entidadId: sessionId,
      datosDespues: { usuario: username },
      ip,
    });
  });

  const permisos = await buildPermissionMatrix(row.user.id, row.user.rol);

  setSessionCookie(res, sessionId);
  res.json(
    LoginResponse.parse(
      presentUser({ ...row.user, ultimoAcceso: now }, row.location, permisos),
    ),
  );
});

router.use(requireSession);

router.get("/auth/me", async (req, res): Promise<void> => {
  const permisos = await buildPermissionMatrix(req.auth!.user.id, req.auth!.user.rol);
  res.json(
    GetCurrentUserResponse.parse(
      presentUser(req.auth!.user, req.auth!.location, permisos),
    ),
  );
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const ip = getRequestIp(req);
  await db.transaction(async (tx) => {
    await tx
      .delete(sesionesTable)
      .where(eq(sesionesTable.id, req.auth!.sessionId));
    await tx.insert(auditoriaTable).values({
      usuarioId: req.auth!.user.id,
      accion: "LOGOUT",
      entidad: "sesiones",
      entidadId: req.auth!.sessionId,
      ip,
    });
  });
  clearSessionCookie(res);
  res.sendStatus(204);
});

export default router;