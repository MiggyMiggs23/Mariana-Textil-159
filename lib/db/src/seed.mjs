import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const isDevelopment = process.env.NODE_ENV === "development";
const adminSeedPassword =
  process.env.ADMIN_SEED_PASSWORD ??
  (isDevelopment ? "Mariana2026*" : undefined);

if (!connectionString) {
  throw new Error("DATABASE_URL es obligatoria para ejecutar el seed.");
}

if (!adminSeedPassword) {
  throw new Error(
    "ADMIN_SEED_PASSWORD es obligatoria fuera del entorno de desarrollo.",
  );
}

const pool = new Pool({ connectionString });

// 25 module identifiers as specified in PROMPT 3D
const MODULOS = [
  "dashboard",
  "pos",
  "entradas",
  "salidas",
  "transferencias",
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
];

// Default role matrix
// total = [ver, crear, editar, autorizar] all true
// — = all false
// ver = [true, false, false, false]
// ver/crear = [true, true, false, false]
// ver/crear/editar = [true, true, true, false]
const N = [false, false, false, false]; // —
const V = [true, false, false, false]; // ver
const VC = [true, true, false, false]; // ver/crear
const VCE = [true, true, true, false]; // ver/crear/editar

// Matrix: modulo -> [TERMINAL, CAJA, INVENTARIOS, BODEGA]
const MATRIX = {
  dashboard: [V, N, V, V],
  pos: [VC, N, N, N],
  entradas: [N, N, VCE, VCE],
  salidas: [N, N, VCE, VCE],
  transferencias: [N, N, VCE, VCE],
  movimientos: [N, V, V, V],
  inventario: [V, V, V, V],
  productos: [V, V, V, V],
  ajustes: [N, N, VC, VC],
  clientes: [VCE, V, N, N],
  clientes_credito: [V, V, N, N],
  clientes_precios: [V, N, N, N],
  clientes_finanzas: [N, V, N, N],
  proveedores: [N, N, V, V],
  proveedores_finanzas: [N, N, N, N],
  contenedores: [N, N, V, V],
  ubicaciones: [N, N, N, N],
  usuarios: [N, N, N, N],
  permisos: [N, N, N, N],
  resumen_caja: [N, V, N, N],
  cortes: [N, VC, N, N],
  cobros_pagos: [N, VC, N, N],
  reportes: [N, V, V, V],
  conciliacion: [N, N, N, N],
  auditoria: [N, N, N, N],
};

const ROLES = ["TERMINAL", "CAJA", "INVENTARIOS", "BODEGA"];

try {
  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");

  const locations = [
    ["Mariana", "TIENDA"],
    ["Cruces", "TIENDA"],
    ["Coco", "TIENDA"],
    ["Tomás", "BODEGA"],
    ["Don Nacho", "BODEGA"],
    ["Lucas Alamán", "BODEGA"],
    ["Bodega Cruces", "BODEGA"],
    ["En tránsito", "TRANSITO"],
    ["Externo", "EXTERNO"],
  ];

  for (const [nombre, tipo] of locations) {
    await pool.query(
      `INSERT INTO ubicaciones (nombre, tipo)
       VALUES ($1, $2)
       ON CONFLICT (nombre) DO UPDATE SET tipo = EXCLUDED.tipo`,
      [nombre, tipo],
    );
  }

  await pool.query(
    `INSERT INTO usuarios (nombre, usuario, password_hash, rol, ubicacion_id)
     VALUES ('Administrador', 'admin', crypt($1, gen_salt('bf', 12)), 'ADMIN', NULL)
     ON CONFLICT (usuario) DO NOTHING`,
    [adminSeedPassword],
  );

  await pool.query(
    `DELETE FROM permisos_usuario
     WHERE usuario_id IN (SELECT id FROM usuarios WHERE rol = 'ADMIN')`,
  );
  await pool.query("DELETE FROM permisos_rol WHERE rol = 'ADMIN'");

  // Only maintain configurable role/module rows. This never touches users,
  // their overrides, operational data, or the ADMIN bypass.
  await pool.query(
    `DELETE FROM permisos_rol
     WHERE rol = ANY($1::rol_usuario[])
       AND NOT (modulo = ANY($2::text[]))`,
    [ROLES, MODULOS],
  );

  const { rows: cajaRows } = await pool.query(
    "SELECT count(*)::int AS count FROM usuarios WHERE rol = 'CAJA'",
  );

  // Seed default permission matrix. Updates ensure the documented matrix is
  // applied to existing installations as well as new ones.
  for (const modulo of MODULOS) {
    const matrixRow = MATRIX[modulo];
    if (!matrixRow) continue;

    for (let i = 0; i < ROLES.length; i++) {
      const rol = ROLES[i];
      const [puedeVer, puedeCrear, puedeEditar, puedeAutorizar] = matrixRow[i];

      await pool.query(
        `INSERT INTO permisos_rol (rol, modulo, puede_ver, puede_crear, puede_editar, puede_autorizar)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (rol, modulo) DO UPDATE SET
           puede_ver = EXCLUDED.puede_ver,
           puede_crear = EXCLUDED.puede_crear,
           puede_editar = EXCLUDED.puede_editar,
           puede_autorizar = EXCLUDED.puede_autorizar,
           updated_at = NOW()`,
        [rol, modulo, puedeVer, puedeCrear, puedeEditar, puedeAutorizar],
      );
    }
  }

  await pool.query(
    `INSERT INTO ticket_folio (id, ultimo_folio)
     VALUES (1, 999)
     ON CONFLICT (id) DO NOTHING`,
  );

  console.log(
    "Seed completado: ubicaciones, admin, ticket_folio y matriz de permisos para TERMINAL, CAJA, INVENTARIOS y BODEGA.",
  );
  console.log(
    `Usuarios existentes con rol CAJA conservados sin cambios: ${cajaRows[0].count}.`,
  );
  console.warn(
    "ADVERTENCIA: cambia la contraseña inicial del usuario admin inmediatamente después del primer acceso.",
  );
} finally {
  await pool.end();
}
