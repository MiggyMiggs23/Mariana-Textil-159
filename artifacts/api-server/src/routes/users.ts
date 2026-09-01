import { Router, type IRouter, type Request } from "express";
import { eq, inArray, sql, type SQL } from "drizzle-orm";
import {
  CreateUserBody,
  CreateUserResponse,
  ListUsersResponse,
  UpdateUserBody,
  UpdateUserParams,
  UpdateUserResponse,
} from "@workspace/api-zod";
import {
  auditoriaTable,
  db,
  permisosUsuarioTable,
  ubicacionesTable,
  usuariosTable,
  type AlcanceConsulta,
  type RolUsuario,
} from "@workspace/db";
import { requireSession } from "../middlewares/auth";
import {
  presentUser,
  sanitizeUserForAudit,
} from "../lib/presenters";
import { hasAdminRecoveryAccount, requierePermiso } from "../lib/permisos";
import { getRequestIp } from "../lib/request";
import { normalizeUsername } from "../lib/auth-identifiers";
import { formatUserValidationErrors } from "../lib/user-validation-errors";

const router: IRouter = Router();

router.use("/users", requireSession, requierePermiso("usuarios", "ver"));

const DEFAULT_QUERY_SCOPE: Record<RolUsuario, AlcanceConsulta> = {
  ADMIN: "TODAS",
  TERMINAL: "PROPIA",
  CAJA: "TODAS",
  SUPERVISOR: "TODAS",
  BODEGA: "PROPIA",
  SISTEMAS: "TODAS",
  CONTADOR: "TODAS",
};

async function auditRejectedUserChange(
  req: Request,
  entidadId: string,
  motivo: string,
  datosAntes: Record<string, unknown> | null = null,
  datosDespues: Record<string, unknown> | null = null,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(auditoriaTable).values({
      usuarioId: req.auth?.user.id,
      accion: "RECHAZAR_INVARIANTE",
      entidad: "usuarios",
      entidadId,
      datosAntes,
      datosDespues: { ...(datosDespues ?? {}), motivo },
      ip: getRequestIp(req),
    });
  });
}

async function findRealLocation(id: number | null | undefined) {
  if (id == null) return null;
  const [location] = await db
    .select()
    .from(ubicacionesTable)
    .where(inArray(ubicacionesTable.id, [id]))
    .limit(1);
  if (
    !location ||
    location.tipo === "TRANSITO" ||
    location.tipo === "EXTERNO"
  ) {
    return undefined;
  }
  return location;
}

function validateAssignment(
  role: RolUsuario,
  location: Awaited<ReturnType<typeof findRealLocation>>,
): string | null {
  if (
    (role === "ADMIN" || role === "SISTEMAS" || role === "CONTADOR") &&
    location !== null
  ) {
    return "Los roles globales deben tener acceso a todos los sitios.";
  }
  if (
    role !== "ADMIN" &&
    role !== "SISTEMAS" &&
    role !== "CONTADOR" &&
    !location
  ) {
    return "La ubicación es obligatoria para este rol.";
  }
  return null;
}

router.get("/users", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ user: usuariosTable, location: ubicacionesTable })
    .from(usuariosTable)
    .leftJoin(
      ubicacionesTable,
      eq(usuariosTable.ubicacionId, ubicacionesTable.id),
    )
    .orderBy(usuariosTable.nombre);
  res.json(
    ListUsersResponse.parse(
      rows.map((row) => presentUser(row.user, row.location)),
    ),
  );
});

router.post("/users", requierePermiso("usuarios", "crear"), async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: formatUserValidationErrors(parsed.error.issues, req.body, "create"),
    });
    return;
  }

  const role = parsed.data.rol as RolUsuario;
  if (role === "ADMIN" && req.auth!.user.rol !== "ADMIN") {
    await auditRejectedUserChange(
      req,
      normalizeUsername(parsed.data.usuario),
      "Solo un ADMIN puede crear cuentas ADMIN.",
      null,
      { rol: role },
    );
    res.status(403).json({
      error: "Solo un ADMIN puede crear cuentas ADMIN.",
    });
    return;
  }
  const location = await findRealLocation(parsed.data.ubicacionId);
  const alcanceConsulta =
    role === "ADMIN" ||
    role === "SUPERVISOR" ||
    role === "SISTEMAS" ||
    role === "CONTADOR"
      ? "TODAS"
      : ((parsed.data.alcanceConsulta as AlcanceConsulta | undefined) ??
        DEFAULT_QUERY_SCOPE[role]);
  const assignmentError = validateAssignment(role, location);
  if (assignmentError) {
    res.status(400).json({ error: assignmentError });
    return;
  }

  try {
    const created = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(usuariosTable)
        .values({
          nombre: parsed.data.nombre.trim(),
          usuario: normalizeUsername(parsed.data.usuario),
          passwordHash: sql`crypt(${parsed.data.password}, gen_salt('bf', 12))`,
          rol: role,
          ubicacionId:
            role === "ADMIN" || role === "SISTEMAS" || role === "CONTADOR"
              ? null
              : location!.id,
          alcanceConsulta,
        })
        .returning();
      await tx.insert(auditoriaTable).values({
        usuarioId: req.auth!.user.id,
        accion: "CREAR",
        entidad: "usuarios",
        entidadId: String(user.id),
        datosDespues: sanitizeUserForAudit(user),
        ip: getRequestIp(req),
      });
      return user;
    });
    res
      .status(201)
      .json(CreateUserResponse.parse(presentUser(created, location ?? null)));
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(400).json({ error: "Ese nombre de usuario ya está en uso." });
      return;
    }
    throw error;
  }
});

router.patch("/users/:id", requierePermiso("usuarios", "editar"), async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  const body = UpdateUserBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: "Usuario: el identificador no es válido." });
    return;
  }
  if (!body.success) {
    res.status(400).json({
      error: formatUserValidationErrors(body.error.issues, req.body, "update"),
    });
    return;
  }
  if (Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "Debes indicar al menos un cambio." });
    return;
  }

  const [beforeRow] = await db
    .select({ user: usuariosTable, location: ubicacionesTable })
    .from(usuariosTable)
    .leftJoin(
      ubicacionesTable,
      eq(usuariosTable.ubicacionId, ubicacionesTable.id),
    )
    .where(eq(usuariosTable.id, params.data.id))
    .limit(1);
  if (!beforeRow) {
    res.status(404).json({ error: "Usuario no encontrado." });
    return;
  }

  const actor = req.auth!.user;
  const finalRole = (body.data.rol ?? beforeRow.user.rol) as RolUsuario;
  if (
    actor.rol !== "ADMIN" &&
    beforeRow.user.rol === "ADMIN"
  ) {
    await auditRejectedUserChange(
      req,
      String(beforeRow.user.id),
      "Solo un ADMIN puede modificar una cuenta ADMIN.",
      sanitizeUserForAudit(beforeRow.user),
    );
    res.status(403).json({
      error: "Solo un ADMIN puede modificar una cuenta ADMIN.",
    });
    return;
  }
  if (
    actor.rol !== "ADMIN" &&
    finalRole === "ADMIN"
  ) {
    await auditRejectedUserChange(
      req,
      String(beforeRow.user.id),
      "Solo un ADMIN puede asignar el rol ADMIN.",
      sanitizeUserForAudit(beforeRow.user),
      { rol: finalRole },
    );
    res.status(403).json({
      error: "Solo un ADMIN puede asignar el rol ADMIN.",
    });
    return;
  }
  if (
    actor.id === beforeRow.user.id &&
    body.data.rol !== undefined &&
    finalRole !== beforeRow.user.rol
  ) {
    await auditRejectedUserChange(
      req,
      String(beforeRow.user.id),
      "Un ADMIN no puede quitarse su propio rol.",
      sanitizeUserForAudit(beforeRow.user),
      { rol: finalRole },
    );
    res.status(403).json({
      error: "No puedes modificar tu propio rol.",
    });
    return;
  }

  const finalActive = body.data.activo ?? beforeRow.user.activo;
  const requestedLocationId =
    "ubicacionId" in body.data
      ? body.data.ubicacionId
      : beforeRow.user.ubicacionId;
  const location = await findRealLocation(requestedLocationId);
  const assignmentError = validateAssignment(finalRole, location);
  if (assignmentError) {
    res.status(400).json({ error: assignmentError });
    return;
  }

  const updates: {
    nombre?: string;
    usuario?: string;
    rol?: RolUsuario;
    ubicacionId?: number | null;
    alcanceConsulta?: AlcanceConsulta;
    activo?: boolean;
    passwordHash?: string | SQL;
  } = {};
  if (body.data.nombre !== undefined) updates.nombre = body.data.nombre.trim();
  if (body.data.usuario !== undefined) {
    updates.usuario = normalizeUsername(body.data.usuario);
  }
  if (body.data.rol !== undefined) updates.rol = finalRole;
  if (body.data.activo !== undefined) updates.activo = body.data.activo;
  updates.ubicacionId =
    finalRole === "ADMIN" ||
    finalRole === "SISTEMAS" ||
    finalRole === "CONTADOR"
      ? null
      : location!.id;
  updates.alcanceConsulta =
    finalRole === "ADMIN" ||
    finalRole === "SUPERVISOR" ||
    finalRole === "SISTEMAS" ||
    finalRole === "CONTADOR"
      ? "TODAS"
      : ((body.data.alcanceConsulta as AlcanceConsulta | undefined) ??
        beforeRow.user.alcanceConsulta ??
        DEFAULT_QUERY_SCOPE[finalRole]);
  if (body.data.password !== undefined) {
    updates.passwordHash = sql`crypt(${body.data.password}, gen_salt('bf', 12))`;
  }

  try {
    const updated = await db.transaction(async (tx) => {
      const recoveryAccountRemains = await hasAdminRecoveryAccount(
        tx,
        beforeRow.user.id,
        finalRole === "ADMIN" && finalActive,
      );
      if (!recoveryAccountRemains) {
        await tx.insert(auditoriaTable).values({
          usuarioId: req.auth!.user.id,
          accion: "RECHAZAR_INVARIANTE",
          entidad: "usuarios",
          entidadId: String(beforeRow.user.id),
          datosAntes: sanitizeUserForAudit(beforeRow.user),
          datosDespues: {
            rol: finalRole,
            activo: finalActive,
            ubicacionId: finalRole === "ADMIN" ? null : location!.id,
            alcanceConsulta: updates.alcanceConsulta,
            motivo: "Debe conservarse al menos un ADMIN activo con acceso completo.",
          },
          ip: getRequestIp(req),
        });
        return null;
      }

      const [user] = await tx
        .update(usuariosTable)
        .set(updates)
        .where(eq(usuariosTable.id, params.data.id))
        .returning();

      if (finalRole === "ADMIN") {
        await tx
          .delete(permisosUsuarioTable)
          .where(eq(permisosUsuarioTable.usuarioId, user.id));
      }

      await tx.insert(auditoriaTable).values({
        usuarioId: req.auth!.user.id,
        accion: "ACTUALIZAR",
        entidad: "usuarios",
        entidadId: String(user.id),
        datosAntes: sanitizeUserForAudit(beforeRow.user),
        datosDespues: sanitizeUserForAudit(user),
        ip: getRequestIp(req),
      });
      return user;
    });
    if (!updated) {
      res.status(409).json({
        error: "Debe conservarse al menos un ADMIN activo.",
      });
      return;
    }
    res.json(
      UpdateUserResponse.parse(presentUser(updated, location ?? null)),
    );
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(400).json({ error: "Ese nombre de usuario ya está en uso." });
      return;
    }
    throw error;
  }
});

export default router;