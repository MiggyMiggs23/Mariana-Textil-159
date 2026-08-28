/**
 * Permissions administration API
 * - GET  /permisos/roles                – list role matrix
 * - PUT  /permisos/roles/:rol/:modulo   – update role matrix entry
 * - GET  /permisos/usuarios/:id         – list user overrides
 * - PUT  /permisos/usuarios/:id/:modulo – update user override
 * - DELETE /permisos/usuarios/:id/:modulo – reset user override (inherit from role)
 * - GET  /permisos/preview/:id          – effective permission preview for user
 */

import { Router, type IRouter, type Request } from "express";
import { and, count, eq, ne } from "drizzle-orm";
import {
  auditoriaTable,
  db,
  permisosRolTable,
  permisosUsuarioTable,
  usuariosTable,
  type RolUsuario,
} from "@workspace/db";
import { requireSession } from "../middlewares/auth";
import {
  requierePermiso,
  buildPermissionMatrix,
  hasAdminRecoveryAccount,
  validateAdminInvariants,
} from "../lib/permisos";
import { getRequestIp } from "../lib/request";

const router: IRouter = Router();

router.use("/permisos", requireSession, requierePermiso("permisos", "ver"));

async function auditRejectedPermissionChange(
  req: Request,
  entidad: "permisos_rol" | "permisos_usuario",
  entidadId: string,
  motivo: string,
  datosAntes: Record<string, unknown> | null = null,
  datosDespues: Record<string, unknown> | null = null,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(auditoriaTable).values({
      usuarioId: req.auth?.user.id,
      accion: "RECHAZAR_INVARIANTE",
      entidad,
      entidadId,
      datosAntes,
      datosDespues: { ...(datosDespues ?? {}), motivo },
      ip: getRequestIp(req),
    });
  });
}

// ── GET /permisos/roles ───────────────────────────────────────────────────────

router.get("/permisos/roles", async (_req, res, next): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(permisosRolTable)
      .where(ne(permisosRolTable.rol, "ADMIN"))
      .orderBy(permisosRolTable.rol, permisosRolTable.modulo);

    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// ── PUT /permisos/roles/:rol/:modulo ──────────────────────────────────────────

router.put(
  "/permisos/roles/:rol/:modulo",
  requierePermiso("permisos", "editar"),
  async (req, res, next): Promise<void> => {
    try {
      const raw = req.params as { rol?: string | string[]; modulo?: string | string[] };
      const rol = (Array.isArray(raw.rol) ? raw.rol[0] : raw.rol) ?? "";
      const modulo = (Array.isArray(raw.modulo) ? raw.modulo[0] : raw.modulo) ?? "";

      if (rol === "ADMIN") {
        await auditRejectedPermissionChange(
          req,
          "permisos_rol",
          `ADMIN:${modulo}`,
          "El rol ADMIN del catálogo no puede modificarse ni vaciarse.",
          null,
          req.body as Record<string, unknown>,
        );
        res.status(403).json({
          error: "El administrador tiene acceso total a todos los módulos y no puede ser restringido.",
        });
        return;
      }

      const validRoles: RolUsuario[] = [
        "TERMINAL",
        "CAJA",
        "SUPERVISOR",
        "BODEGA",
        "SISTEMAS",
        "CONTADOR",
      ];
      if (!validRoles.includes(rol as RolUsuario)) {
        res.status(400).json({ error: "Rol inválido." });
        return;
      }

      const { puedeVer, puedeCrear, puedeEditar, puedeAutorizar } = req.body as Record<
        string,
        unknown
      >;

      if (
        typeof puedeVer !== "boolean" ||
        typeof puedeCrear !== "boolean" ||
        typeof puedeEditar !== "boolean" ||
        typeof puedeAutorizar !== "boolean"
      ) {
        res.status(400).json({
          error: "puedeVer, puedeCrear, puedeEditar y puedeAutorizar son obligatorios (boolean).",
        });
        return;
      }

      // Enforce: if ver=false, all others must be false too
      if (!puedeVer && (puedeCrear || puedeEditar || puedeAutorizar)) {
        res.status(400).json({
          error: "Al desactivar 'ver', las otras acciones deben también estar desactivadas.",
        });
        return;
      }

      // Validate admin invariants
      const invariantError = validateAdminInvariants(rol, modulo, {
        puedeVer,
        puedeCrear,
        puedeEditar,
        puedeAutorizar,
      });
      if (invariantError) {
        res.status(403).json({ error: invariantError });
        return;
      }

      // Get before state for audit
      const [before] = await db
        .select()
        .from(permisosRolTable)
        .where(
          and(
            eq(permisosRolTable.rol, rol as RolUsuario),
            eq(permisosRolTable.modulo, modulo),
          ),
        )
        .limit(1);

      const updated = await db.transaction(async (tx) => {
        if (!(await hasAdminRecoveryAccount(tx))) {
          await tx.insert(auditoriaTable).values({
            usuarioId: req.auth!.user.id,
            accion: "RECHAZAR_INVARIANTE",
            entidad: "permisos_rol",
            entidadId: `${rol}:${modulo}`,
            datosAntes: before
              ? {
                  puedeVer: before.puedeVer, puedeCrear: before.puedeCrear,
                  puedeEditar: before.puedeEditar, puedeAutorizar: before.puedeAutorizar,
                }
              : null,
            datosDespues: { puedeVer, puedeCrear, puedeEditar, puedeAutorizar, motivo: "Debe conservarse al menos un ADMIN activo con acceso completo." },
            ip: getRequestIp(req),
          });
          return null;
        }
        const [row] = await tx
          .insert(permisosRolTable)
          .values({
            rol: rol as RolUsuario,
            modulo,
            puedeVer,
            puedeCrear,
            puedeEditar,
            puedeAutorizar,
            updatedPor: req.auth!.user.id,
          })
          .onConflictDoUpdate({
            target: [permisosRolTable.rol, permisosRolTable.modulo],
            set: {
              puedeVer,
              puedeCrear,
              puedeEditar,
              puedeAutorizar,
              updatedPor: req.auth!.user.id,
              updatedAt: new Date(),
            },
          })
          .returning();

        await tx.insert(auditoriaTable).values({
          usuarioId: req.auth!.user.id,
          accion: "ACTUALIZAR",
          entidad: "permisos_rol",
          entidadId: `${rol}:${modulo}`,
          datosAntes: before
            ? {
                puedeVer: before.puedeVer,
                puedeCrear: before.puedeCrear,
                puedeEditar: before.puedeEditar,
                puedeAutorizar: before.puedeAutorizar,
              }
            : null,
          datosDespues: { puedeVer, puedeCrear, puedeEditar, puedeAutorizar },
          ip: getRequestIp(req),
        });

        return row;
      });
      if (!updated) {
        res.status(409).json({ error: "Debe conservarse al menos un ADMIN activo con acceso completo." });
        return;
      }
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);

// ── GET /permisos/usuarios/:id ────────────────────────────────────────────────

router.get(
  "/permisos/usuarios/:id",
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10,
      );
      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const [user] = await db
        .select({ id: usuariosTable.id, rol: usuariosTable.rol })
        .from(usuariosTable)
        .where(eq(usuariosTable.id, id))
        .limit(1);

      if (!user) {
        res.status(404).json({ error: "Usuario no encontrado." });
        return;
      }

      if (user.rol === "ADMIN") {
        res.status(403).json({
          error: "El administrador tiene acceso total a todos los módulos y no puede ser restringido.",
        });
        return;
      }

      const overrides = await db
        .select()
        .from(permisosUsuarioTable)
        .where(eq(permisosUsuarioTable.usuarioId, id))
        .orderBy(permisosUsuarioTable.modulo);

      res.json({ usuarioId: id, rol: user.rol, overrides });
    } catch (e) {
      next(e);
    }
  },
);

// ── PUT /permisos/usuarios/:id/:modulo ────────────────────────────────────────

router.put(
  "/permisos/usuarios/:id/:modulo",
  requierePermiso("permisos", "editar"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10,
      );
      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const modulo = Array.isArray(req.params.modulo)
        ? req.params.modulo[0]
        : req.params.modulo;

      // A user cannot modify their own overrides
      if (req.auth!.user.id === id) {
        await auditRejectedPermissionChange(
          req,
          "permisos_usuario",
          `${id}:${modulo}`,
          "Un usuario no puede modificar sus propios permisos.",
          null,
          req.body as Record<string, unknown>,
        );
        res.status(403).json({
          error: "No puedes modificar tus propios permisos.",
        });
        return;
      }

      const [user] = await db
        .select({ id: usuariosTable.id, rol: usuariosTable.rol })
        .from(usuariosTable)
        .where(eq(usuariosTable.id, id))
        .limit(1);

      if (!user) {
        res.status(404).json({ error: "Usuario no encontrado." });
        return;
      }

      if (user.rol === "ADMIN") {
        await auditRejectedPermissionChange(
          req,
          "permisos_usuario",
          `${id}:${modulo}`,
          "Un ADMIN no puede tener overrides explícitos.",
        );
        res.status(403).json({
          error: "El administrador tiene acceso total a todos los módulos y no puede ser restringido.",
        });
        return;
      }

      const body = req.body as Record<string, unknown>;
      const puedeVer = body.puedeVer === null ? null : (body.puedeVer as boolean | null | undefined);
      const puedeCrear = body.puedeCrear === null ? null : (body.puedeCrear as boolean | null | undefined);
      const puedeEditar = body.puedeEditar === null ? null : (body.puedeEditar as boolean | null | undefined);
      const puedeAutorizar = body.puedeAutorizar === null ? null : (body.puedeAutorizar as boolean | null | undefined);

      // Validate that values are boolean or null
      for (const [key, val] of Object.entries({ puedeVer, puedeCrear, puedeEditar, puedeAutorizar })) {
        if (val !== null && val !== undefined && typeof val !== "boolean") {
          res.status(400).json({ error: `${key} debe ser boolean o null.` });
          return;
        }
      }

      const [before] = await db
        .select()
        .from(permisosUsuarioTable)
        .where(
          and(
            eq(permisosUsuarioTable.usuarioId, id),
            eq(permisosUsuarioTable.modulo, modulo),
          ),
        )
        .limit(1);

      const updated = await db.transaction(async (tx) => {
        if (!(await hasAdminRecoveryAccount(tx))) {
          await tx.insert(auditoriaTable).values({
            usuarioId: req.auth!.user.id,
            accion: "RECHAZAR_INVARIANTE",
            entidad: "permisos_usuario",
            entidadId: `${id}:${modulo}`,
            datosAntes: before
              ? {
                  puedeVer: before.puedeVer, puedeCrear: before.puedeCrear,
                  puedeEditar: before.puedeEditar, puedeAutorizar: before.puedeAutorizar,
                }
              : null,
            datosDespues: { puedeVer, puedeCrear, puedeEditar, puedeAutorizar, motivo: "Debe conservarse al menos un ADMIN activo con acceso completo." },
            ip: getRequestIp(req),
          });
          return null;
        }
        // The initial lookup is only for a useful 404 response. Re-read after
        // taking the invariant lock so a concurrent promotion cannot receive
        // an override based on stale role data.
        const [lockedUser] = await tx
          .select({ rol: usuariosTable.rol })
          .from(usuariosTable)
          .where(eq(usuariosTable.id, id))
          .limit(1);
        if (lockedUser?.rol === "ADMIN") {
          await tx.insert(auditoriaTable).values({
            usuarioId: req.auth!.user.id,
            accion: "RECHAZAR_INVARIANTE",
            entidad: "permisos_usuario",
            entidadId: `${id}:${modulo}`,
            datosDespues: { motivo: "Un ADMIN no puede tener overrides explícitos." },
            ip: getRequestIp(req),
          });
          return null;
        }
        const [row] = await tx
          .insert(permisosUsuarioTable)
          .values({
            usuarioId: id,
            modulo,
            puedeVer: puedeVer ?? null,
            puedeCrear: puedeCrear ?? null,
            puedeEditar: puedeEditar ?? null,
            puedeAutorizar: puedeAutorizar ?? null,
            updatedPor: req.auth!.user.id,
          })
          .onConflictDoUpdate({
            target: [permisosUsuarioTable.usuarioId, permisosUsuarioTable.modulo],
            set: {
              puedeVer: puedeVer ?? null,
              puedeCrear: puedeCrear ?? null,
              puedeEditar: puedeEditar ?? null,
              puedeAutorizar: puedeAutorizar ?? null,
              updatedPor: req.auth!.user.id,
              updatedAt: new Date(),
            },
          })
          .returning();

        await tx.insert(auditoriaTable).values({
          usuarioId: req.auth!.user.id,
          accion: "ACTUALIZAR",
          entidad: "permisos_usuario",
          entidadId: `${id}:${modulo}`,
          datosAntes: before
            ? {
                puedeVer: before.puedeVer,
                puedeCrear: before.puedeCrear,
                puedeEditar: before.puedeEditar,
                puedeAutorizar: before.puedeAutorizar,
              }
            : null,
          datosDespues: { puedeVer, puedeCrear, puedeEditar, puedeAutorizar },
          ip: getRequestIp(req),
        });

        return row;
      });
      if (!updated) {
        res.status(409).json({ error: "Debe conservarse al menos un ADMIN activo con acceso completo." });
        return;
      }
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);

// ── DELETE /permisos/usuarios/:id/:modulo ─────────────────────────────────────
// Reset a user override (they inherit from role again)

router.delete(
  "/permisos/usuarios/:id/:modulo",
  requierePermiso("permisos", "editar"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10,
      );
      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const modulo = Array.isArray(req.params.modulo)
        ? req.params.modulo[0]
        : req.params.modulo;

      // A user cannot modify their own overrides
      if (req.auth!.user.id === id) {
        await auditRejectedPermissionChange(
          req,
          "permisos_usuario",
          `${id}:${modulo}`,
          "Un usuario no puede modificar sus propios permisos.",
          null,
          { accion: "eliminar_override" },
        );
        res.status(403).json({
          error: "No puedes modificar tus propios permisos.",
        });
        return;
      }

      const [user] = await db
        .select({ id: usuariosTable.id, rol: usuariosTable.rol })
        .from(usuariosTable)
        .where(eq(usuariosTable.id, id))
        .limit(1);

      if (!user) {
        res.status(404).json({ error: "Usuario no encontrado." });
        return;
      }

      if (user.rol === "ADMIN") {
        await auditRejectedPermissionChange(
          req,
          "permisos_usuario",
          `${id}:${modulo}`,
          "Un ADMIN no puede tener overrides explícitos.",
        );
        res.status(403).json({
          error: "El administrador tiene acceso total a todos los módulos y no puede ser restringido.",
        });
        return;
      }

      const deleted = await db.transaction(async (tx) => {
        if (!(await hasAdminRecoveryAccount(tx))) {
          await tx.insert(auditoriaTable).values({
            usuarioId: req.auth!.user.id,
            accion: "RECHAZAR_INVARIANTE",
            entidad: "permisos_usuario",
            entidadId: `${id}:${modulo}`,
            datosDespues: { accion: "eliminar_override", motivo: "Debe conservarse al menos un ADMIN activo con acceso completo." },
            ip: getRequestIp(req),
          });
          return false;
        }
        const [lockedUser] = await tx
          .select({ rol: usuariosTable.rol })
          .from(usuariosTable)
          .where(eq(usuariosTable.id, id))
          .limit(1);
        if (lockedUser?.rol === "ADMIN") {
          await tx.insert(auditoriaTable).values({
            usuarioId: req.auth!.user.id,
            accion: "RECHAZAR_INVARIANTE",
            entidad: "permisos_usuario",
            entidadId: `${id}:${modulo}`,
            datosDespues: { accion: "eliminar_override", motivo: "Un ADMIN no puede tener overrides explícitos." },
            ip: getRequestIp(req),
          });
          return false;
        }
        await tx
          .delete(permisosUsuarioTable)
          .where(
            and(
              eq(permisosUsuarioTable.usuarioId, id),
              eq(permisosUsuarioTable.modulo, modulo),
            ),
          );

        await tx.insert(auditoriaTable).values({
          usuarioId: req.auth!.user.id,
          accion: "ELIMINAR",
          entidad: "permisos_usuario",
          entidadId: `${id}:${modulo}`,
          datosAntes: { accion: "permiso_personalizado", modulo },
          ip: getRequestIp(req),
        });
        return true;
      });

      if (!deleted) {
        res.status(409).json({ error: "Debe conservarse al menos un ADMIN activo con acceso completo." });
        return;
      }
      res.sendStatus(204);
    } catch (e) {
      next(e);
    }
  },
);

// ── GET /permisos/preview/:id ─────────────────────────────────────────────────
// Preview effective permissions for any user

router.get(
  "/permisos/preview/:id",
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10,
      );
      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const [user] = await db
        .select({ id: usuariosTable.id, rol: usuariosTable.rol, nombre: usuariosTable.nombre })
        .from(usuariosTable)
        .where(eq(usuariosTable.id, id))
        .limit(1);

      if (!user) {
        res.status(404).json({ error: "Usuario no encontrado." });
        return;
      }

      const matrix = await buildPermissionMatrix(user.id, user.rol);

      res.json({
        usuarioId: user.id,
        nombre: user.nombre,
        rol: user.rol,
        permisos: Object.values(matrix),
      });
    } catch (e) {
      next(e);
    }
  },
);

export default router;
