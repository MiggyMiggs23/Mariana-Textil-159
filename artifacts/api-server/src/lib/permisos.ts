/**
 * Central permission service for Mariana Textil.
 *
 * Resolution order:
 *  1. ADMIN receives full access without reading permission tables.
 *  2. permisos_usuario row for (usuario_id, modulo) with a non-null value
 *  3. permisos_rol row for (rol, modulo)
 *  4. Deny (no row = deny by default)
 */

import type { NextFunction, Request, Response } from "express";
import { and, eq, isNotNull, or, sql } from "drizzle-orm";
import {
  db,
  permisosRolTable,
  permisosUsuarioTable,
  type RolUsuario,
} from "@workspace/db";
import {
  SUPERVISOR_PERMISSION_CEILING,
  supervisorAllows,
} from "./supervisor-policy";

export { SUPERVISOR_PERMISSION_CEILING, supervisorAllows };

export type AccionPermiso = "ver" | "crear" | "editar" | "autorizar";

export interface ModulePermission {
  modulo: string;
  puedeVer: boolean;
  puedeCrear: boolean;
  puedeEditar: boolean;
  puedeAutorizar: boolean;
}

export interface PermissionMatrix {
  [modulo: string]: ModulePermission;
}

type PermissionReader = Pick<typeof db, "select">;

/** All configurable module identifiers. */
export const MODULOS = [
  "dashboard",
  "pos",
  "entradas",
  "salidas",
  "movimientos",
  "etiquetas",
  "inventario",
  "productos",
  "precios",
  "ajustes",
  "clientes",
  "clientes_credito",
  "clientes_precios",
  "clientes_finanzas",
  "proveedores",
  "proveedores_finanzas",
  "contenedores",
  "ubicaciones",
  "usuarios",
  "permisos",
  "resumen_caja",
  "cortes",
  "cobros_pagos",
  "reportes",
  "conciliacion",
  "auditoria",
  "camionetas",
  "choferes",
  "viajes",
] as const;

export type ModuloId = (typeof MODULOS)[number];

const FULL_ACCESS = {
  puedeVer: true,
  puedeCrear: true,
  puedeEditar: true,
  puedeAutorizar: true,
} as const;

/**
 * SUPERVISOR is a deliberately non-financial, operational role.  These are
 * ceilings, not defaults: database rows may further restrict access, but can
 * never broaden it.  Keeping the ceiling here makes user overrides unable to
 * turn a supervisor into a cashier or administrator.
 */
function applySupervisorCeiling(
  permission: ModulePermission,
): ModulePermission {
  const actions = SUPERVISOR_PERMISSION_CEILING[permission.modulo as ModuloId];
  return {
    modulo: permission.modulo,
    puedeVer: permission.puedeVer && actions?.has("ver") === true,
    puedeCrear: permission.puedeCrear && actions?.has("crear") === true,
    puedeEditar: permission.puedeEditar && actions?.has("editar") === true,
    puedeAutorizar:
      permission.puedeAutorizar && actions?.has("autorizar") === true,
  };
}

/**
 * Resolve the effective permission for a single (userId, rol, modulo).
 * Returns null if no permission row found (= deny).
 */
export async function resolvePermiso(
  userId: number,
  rol: RolUsuario,
  modulo: string,
  database: PermissionReader = db,
): Promise<ModulePermission | null> {
  if (rol === "ADMIN") {
    return { modulo, ...FULL_ACCESS };
  }

  // Check per-user override first
  const [userRow] = await database
    .select()
    .from(permisosUsuarioTable)
    .where(
      and(
        eq(permisosUsuarioTable.usuarioId, userId),
        eq(permisosUsuarioTable.modulo, modulo),
      ),
    )
    .limit(1);

  // Get role row
  const [rolRow] = await database
    .select()
    .from(permisosRolTable)
    .where(
      and(eq(permisosRolTable.rol, rol), eq(permisosRolTable.modulo, modulo)),
    )
    .limit(1);

  if (!userRow && !rolRow) return null;

  // Merge: user override wins for non-null values
  const puedeVer =
    userRow?.puedeVer !== null && userRow?.puedeVer !== undefined
      ? userRow.puedeVer
      : (rolRow?.puedeVer ?? false);

  const puedeCrear =
    userRow?.puedeCrear !== null && userRow?.puedeCrear !== undefined
      ? userRow.puedeCrear
      : (rolRow?.puedeCrear ?? false);

  const puedeEditar =
    userRow?.puedeEditar !== null && userRow?.puedeEditar !== undefined
      ? userRow.puedeEditar
      : (rolRow?.puedeEditar ?? false);

  const puedeAutorizar =
    userRow?.puedeAutorizar !== null && userRow?.puedeAutorizar !== undefined
      ? userRow.puedeAutorizar
      : (rolRow?.puedeAutorizar ?? false);

  const permission = {
    modulo,
    puedeVer,
    puedeCrear,
    puedeEditar,
    puedeAutorizar,
  };
  return rol === "SUPERVISOR" ? applySupervisorCeiling(permission) : permission;
}

/**
 * Build the full effective permission matrix for a user.
 * Used at login and for /auth/me.
 */
export async function buildPermissionMatrix(
  userId: number,
  rol: RolUsuario,
  database: PermissionReader = db,
): Promise<PermissionMatrix> {
  if (rol === "ADMIN") {
    return Object.fromEntries(
      MODULOS.map((modulo) => [modulo, { modulo, ...FULL_ACCESS }]),
    );
  }

  // Fetch all role permissions
  const rolRows = await database
    .select()
    .from(permisosRolTable)
    .where(eq(permisosRolTable.rol, rol));

  // Fetch all user overrides
  const userRows = await database
    .select()
    .from(permisosUsuarioTable)
    .where(eq(permisosUsuarioTable.usuarioId, userId));

  const rolMap = new Map(rolRows.map((r) => [r.modulo, r]));
  const userMap = new Map(userRows.map((r) => [r.modulo, r]));

  const matrix: PermissionMatrix = {};

  for (const modulo of MODULOS) {
    const rolRow = rolMap.get(modulo);
    const userRow = userMap.get(modulo);

    const puedeVer =
      userRow?.puedeVer !== null && userRow?.puedeVer !== undefined
        ? userRow.puedeVer
        : (rolRow?.puedeVer ?? false);

    const puedeCrear =
      userRow?.puedeCrear !== null && userRow?.puedeCrear !== undefined
        ? userRow.puedeCrear
        : (rolRow?.puedeCrear ?? false);

    const puedeEditar =
      userRow?.puedeEditar !== null && userRow?.puedeEditar !== undefined
        ? userRow.puedeEditar
        : (rolRow?.puedeEditar ?? false);

    const puedeAutorizar =
      userRow?.puedeAutorizar !== null && userRow?.puedeAutorizar !== undefined
        ? userRow.puedeAutorizar
        : (rolRow?.puedeAutorizar ?? false);

    const permission = {
      modulo,
      puedeVer,
      puedeCrear,
      puedeEditar,
      puedeAutorizar,
    };
    matrix[modulo] =
      rol === "SUPERVISOR" ? applySupervisorCeiling(permission) : permission;
  }

  return matrix;
}

/**
 * Express middleware factory.
 * Usage: requierePermiso("clientes", "ver")
 *
 * Deny-by-default: if no permission row exists → 403.
 */
export function requierePermiso(modulo: string, accion: AccionPermiso) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.auth) {
      res.status(401).json({ error: "Debes iniciar sesión." });
      return;
    }

    const { user } = req.auth;
    const permiso = await resolvePermiso(user.id, user.rol, modulo);

    if (!permiso) {
      res.status(403).json({
        error: `Sin acceso al módulo '${modulo}'.`,
      });
      return;
    }

    const accionMap: Record<AccionPermiso, boolean> = {
      ver: permiso.puedeVer,
      crear: permiso.puedeCrear,
      editar: permiso.puedeEditar,
      autorizar: permiso.puedeAutorizar,
    };

    if (!accionMap[accion]) {
      res.status(403).json({
        error: `No tienes permiso para '${accion}' en el módulo '${modulo}'.`,
      });
      return;
    }

    next();
  };
}

/**
 * ADMIN is not configurable through either permission table.
 */
export function validateAdminInvariants(
  rol: string,
  _modulo: string,
  _updates: {
    puedeVer?: boolean;
    puedeCrear?: boolean;
    puedeEditar?: boolean;
    puedeAutorizar?: boolean;
  },
): string | null {
  if (rol === "ADMIN") {
    return "El administrador tiene acceso total a todos los módulos y no puede ser restringido.";
  }
  return null;
}

/**
 * Serializes changes that could affect administrative recovery and verifies
 * the post-change state without trusting the ADMIN runtime bypass.  An ADMIN
 * with an explicit false override is deliberately not a recovery account,
 * even though normal request authorization still grants ADMIN full access.
 *
 * `plannedUserId` is omitted for a new user.  When provided, that user's
 * current row is excluded and represented by `plannedUserHasFullAccess`.
 */
export async function hasAdminRecoveryAccount(
  database: Pick<typeof db, "execute">,
  plannedUserId?: number,
  plannedUserHasFullAccess = false,
): Promise<boolean> {
  // This same lock is used by both Usuarios and Permisos mutation paths.
  await database.execute(sql`select pg_advisory_xact_lock(73462026)`);

  if (plannedUserHasFullAccess) return true;

  const targetCondition =
    plannedUserId == null ? sql`true` : sql`u.id <> ${plannedUserId}`;
  const result = await database.execute(sql`
    select exists (
      select 1
      from usuarios u
      where u.rol = 'ADMIN'
        and u.activo = true
        and ${targetCondition}
        and not exists (
          select 1
          from permisos_usuario pu
          where pu.usuario_id = u.id
            and (
              pu.puede_ver = false
              or pu.puede_crear = false
              or pu.puede_editar = false
              or pu.puede_autorizar = false
            )
        )
    ) as has_full_access
  `);
  return (
    (result.rows[0] as { has_full_access: boolean } | undefined)
      ?.has_full_access === true
  );
}
