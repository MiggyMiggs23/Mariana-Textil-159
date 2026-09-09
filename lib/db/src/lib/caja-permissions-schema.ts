import type { Pool } from "pg";

const MODULES = [
  "dashboard", "pos", "entradas", "salidas", "movimientos", "etiquetas",
  "inventario", "auditoria_inventario", "productos", "precios", "ajustes",
  "clientes", "clientes_credito", "clientes_precios", "clientes_finanzas",
  "proveedores", "proveedores_finanzas", "contenedores", "ubicaciones",
  "usuarios", "permisos", "resumen_caja", "cortes", "cobros_pagos",
  "reportes", "conciliacion", "auditoria", "camionetas", "choferes", "viajes",
  "salidas_venta",
] as const;

/**
 * Repairs inherited CAJA defaults on every startup. Rows marked updated_por
 * are administrator customizations and are deliberately left untouched.
 * Per-user overrides are never queried or modified.
 */
export async function ensureCajaPermissions(
  pool: Pick<Pool, "query">,
): Promise<void> {
  await pool.query(
    `INSERT INTO permisos_rol
       (rol, modulo, puede_ver, puede_crear, puede_editar, puede_autorizar)
     SELECT
       'CAJA'::rol_usuario,
       modulo,
       modulo = 'cobros_pagos',
       modulo = 'cobros_pagos',
       false,
       false
     FROM unnest($1::text[]) AS modulo
     ON CONFLICT (rol, modulo) DO UPDATE SET
       puede_ver = EXCLUDED.puede_ver,
       puede_crear = EXCLUDED.puede_crear,
       puede_editar = false,
       puede_autorizar = false,
       updated_at = NOW()
     WHERE permisos_rol.updated_por IS NULL`,
    [MODULES],
  );
}