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
import { and, eq, isNotNull, or } from "drizzle-orm";
import {
  db,
  permisosRolTable,
  permisosUsuarioTable,
  type RolUsuario,
} from "@workspace/db";

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

/** All 24 module identifiers */
export const MODULOS = [
  "dashboard",
  "pos",
  "entradas",
  "salidas",
  "movimientos",
  "inventario",
  "productos",
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
] as const;

export type ModuloId = (typeof MODULOS)[number];

const FULL_ACCESS = {
  puedeVer: true,
  puedeCrear: true,
  puedeEditar: true,
  puedeAutorizar: true,
} as const;

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
      and(
        eq(permisosRolTable.rol, rol),
        eq(permisosRolTable.modulo, modulo),
      ),
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

  return {
    modulo,
    puedeVer,
    puedeCrear,
    puedeEditar,
    puedeAutorizar,
  };
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

    matrix[modulo] = {
      modulo,
      puedeVer,
      puedeCrear,
      puedeEditar,
      puedeAutorizar,
    };
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
  _updates: { puedeVer?: boolean; puedeCrear?: boolean; puedeEditar?: boolean; puedeAutorizar?: boolean },
): string | null {
  if (rol === "ADMIN") {
    return "El administrador tiene acceso total a todos los módulos y no puede ser restringido.";
  }
  return null;
}
