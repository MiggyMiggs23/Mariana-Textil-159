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

// Matrix: modulo -> [CAJA, INVENTARIOS, BODEGA]
const MATRIX = {
  dashboard: [V, V, V],
  pos: [VCE, N, N],
  entradas: [VC, VCE, VCE],
  salidas: [V, VCE, VCE],
  transferencias: [VC, VCE, VCE],
  movimientos: [V, V, V],
  inventario: [V, V, V],
  productos: [V, V, V],
  ajustes: [N, VC, VC],
  clientes: [VCE, N, N],
  clientes_credito: [V, N, N],
  clientes_precios: [V, N, N],
  clientes_finanzas: [N, N, N],
  proveedores: [N, V, V],
  proveedores_finanzas: [N, N, N],
  contenedores: [N, V, V],
  ubicaciones: [N, N, N],
  usuarios: [N, N, N],
  permisos: [N, N, N],
  resumen_caja: [V, N, N],
  cortes: [VC, N, N],
  cobros_pagos: [VC, N, N],
  reportes: [V, V, V],
  conciliacion: [N, N, N],
  auditoria: [N, N, N],
};

const ROLES = ["CAJA", "INVENTARIOS", "BODEGA"];

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

  // Seed default permission matrix (idempotent)
  for (const modulo of MODULOS) {
    const matrixRow = MATRIX[modulo];
    if (!matrixRow) continue;

    for (let i = 0; i < ROLES.length; i++) {
      const rol = ROLES[i];
      const [puedeVer, puedeCrear, puedeEditar, puedeAutorizar] = matrixRow[i];

      await pool.query(
        `INSERT INTO permisos_rol (rol, modulo, puede_ver, puede_crear, puede_editar, puede_autorizar)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (rol, modulo) DO NOTHING`,
        [rol, modulo, puedeVer, puedeCrear, puedeEditar, puedeAutorizar],
      );
    }
  }

  console.log(
    "Seed completado: ubicaciones, admin, y matriz de permisos para CAJA, INVENTARIOS y BODEGA.",
  );
  console.warn(
    "ADVERTENCIA: cambia la contraseña inicial del usuario admin inmediatamente después del primer acceso.",
  );
} finally {
  await pool.end();
}
