import { Router, type IRouter } from "express";
import { and, count, eq, inArray, sql, type SQL } from "drizzle-orm";
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
import { requierePermiso } from "../lib/permisos";
import { getRequestIp } from "../lib/request";

const router: IRouter = Router();

router.use("/users", requireSession, requierePermiso("usuarios", "ver"));

const DEFAULT_QUERY_SCOPE: Record<RolUsuario, AlcanceConsulta> = {
  ADMIN: "TODAS",
  TERMINAL: "PROPIA",
  CAJA: "TODAS",
  INVENTARIOS: "TODAS",
  BODEGA: "PROPIA",
};

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
  if (role === "ADMIN" && location !== null) {
    return "Los administradores deben tener acceso global.";
  }
  if (role !== "ADMIN" && !location) {
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
    res.status(400).json({ error: "Los datos del usuario son inválidos." });
    return;
  }

  const role = parsed.data.rol as RolUsuario;
  if (role === "ADMIN" && req.auth!.user.rol !== "ADMIN") {
    res.status(403).json({
      error: "Solo un ADMIN puede crear otra cuenta ADMIN.",
    });
    return;
  }
  const location = await findRealLocation(parsed.data.ubicacionId);
  const alcanceConsulta =
    role === "ADMIN"
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
          usuario: parsed.data.usuario.trim().toLowerCase(),
          passwordHash: sql`crypt(${parsed.data.password}, gen_salt('bf', 12))`,
          rol: role,
          ubicacionId: role === "ADMIN" ? null : location!.id,
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
  if (!params.success || !body.success || Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "Los datos del usuario son inválidos." });
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
  if (actor.rol !== "ADMIN" && beforeRow.user.rol === "ADMIN") {
    res.status(403).json({
      error: "Solo un ADMIN puede modificar una cuenta ADMIN.",
    });
    return;
  }
  if (actor.rol !== "ADMIN" && finalRole === "ADMIN") {
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
    res.status(403).json({
      error: "No puedes modificar tu propio rol.",
    });
    return;
  }

  const finalActive = body.data.activo ?? beforeRow.user.activo;
  const removesActiveAdmin =
    beforeRow.user.rol === "ADMIN" &&
    beforeRow.user.activo &&
    (finalRole !== "ADMIN" || !finalActive);
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
    updates.usuario = body.data.usuario.trim().toLowerCase();
  }
  if (body.data.rol !== undefined) updates.rol = finalRole;
  if (body.data.activo !== undefined) updates.activo = body.data.activo;
  updates.ubicacionId = finalRole === "ADMIN" ? null : location!.id;
  updates.alcanceConsulta =
    finalRole === "ADMIN"
      ? "TODAS"
      : ((body.data.alcanceConsulta as AlcanceConsulta | undefined) ??
        beforeRow.user.alcanceConsulta ??
        DEFAULT_QUERY_SCOPE[finalRole]);
  if (body.data.password !== undefined) {
    updates.passwordHash = sql`crypt(${body.data.password}, gen_salt('bf', 12))`;
  }

  try {
    const updated = await db.transaction(async (tx) => {
      if (removesActiveAdmin) {
        // Serialize ADMIN-removal checks so two concurrent requests cannot both
        // observe another active ADMIN and deactivate the final two at once.
        await tx.execute(sql`select pg_advisory_xact_lock(73462026)`);
        const [{ value: activeAdmins }] = await tx
          .select({ value: count() })
          .from(usuariosTable)
          .where(
            and(
              eq(usuariosTable.rol, "ADMIN"),
              eq(usuariosTable.activo, true),
            ),
          );
        if (activeAdmins <= 1) return null;
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