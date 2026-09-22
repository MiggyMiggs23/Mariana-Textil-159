import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
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
  INACTIVITY_MS,
  requireSession,
  setSessionCookie,
} from "../middlewares/auth";
import { presentUser } from "../lib/presenters";
import { buildPermissionMatrix } from "../lib/permisos";
import { getRequestIp } from "../lib/request";
import { normalizeUsername } from "../lib/auth-identifiers";
import {
  getLoginLockoutReason,
  LOGIN_LOCKOUT_WINDOW_MS,
} from "../lib/login-lockout";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Usuario y contraseña son obligatorios." });
    return;
  }

  const username = normalizeUsername(parsed.data.usuario);
  const ip = getRequestIp(req);
  const since = new Date(Date.now() - LOGIN_LOCKOUT_WINDOW_MS);

  // A successful login closes the prior failure window without mutating the
  // append-only audit log. The source threshold limits one origin, while the
  // higher global threshold still protects a username from distributed abuse.
  const attemptsResult = await db.execute(sql`
    WITH latest_success AS (
      SELECT MAX(created_at) AS created_at
      FROM auditoria
      WHERE accion = 'LOGIN_EXITOSO'
        AND datos_despues ->> 'usuario' = ${username}
        AND created_at > ${since}
    )
    SELECT
      COUNT(*) FILTER (WHERE ip = ${ip})::int AS "sourceFailures",
      COUNT(*)::int AS "globalFailures"
    FROM auditoria
    WHERE accion = 'LOGIN_FALLIDO'
      AND entidad = 'usuarios'
      AND entidad_id = ${username}
      AND created_at > GREATEST(
        ${since},
        COALESCE((SELECT created_at FROM latest_success), ${since})
      )
  `);
  const attempts = attemptsResult.rows[0] as
    | { sourceFailures: number; globalFailures: number }
    | undefined;
  const lockoutReason = getLoginLockoutReason({
    sourceFailures: Number(attempts?.sourceFailures ?? 0),
    globalFailures: Number(attempts?.globalFailures ?? 0),
  });

  if (lockoutReason) {
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

router.use("/auth", requireSession);

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