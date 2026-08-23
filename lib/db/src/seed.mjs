import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL es obligatoria para ejecutar el seed.");
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
const T = [true, true, true, true]; // total / ADMIN
const N = [false, false, false, false]; // —
const V = [true, false, false, false]; // ver
const VC = [true, true, false, false]; // ver/crear
const VCE = [true, true, true, false]; // ver/crear/editar

// Matrix: modulo -> [ADMIN, CAJA, INVENTARIOS, BODEGA]
const MATRIX = {
  dashboard: [T, V, V, V],
  pos: [T, VCE, N, N],
  entradas: [T, VC, VCE, VCE],
  salidas: [T, V, VCE, VCE],
  transferencias: [T, VC, VCE, VCE],
  movimientos: [T, V, V, V],
  inventario: [T, V, V, V],
  productos: [T, V, V, V],
  ajustes: [T, N, VC, VC],
  clientes: [T, VCE, N, N],
  clientes_credito: [T, V, N, N],
  clientes_precios: [T, V, N, N],
  clientes_finanzas: [T, N, N, N],
  proveedores: [T, N, V, V],
  proveedores_finanzas: [T, N, N, N],
  contenedores: [T, N, V, V],
  ubicaciones: [T, N, N, N],
  usuarios: [T, N, N, N],
  permisos: [T, N, N, N],
  resumen_caja: [T, V, N, N],
  cortes: [T, VC, N, N],
  cobros_pagos: [T, VC, N, N],
  reportes: [T, V, V, V],
  conciliacion: [T, N, N, N],
  auditoria: [T, N, N, N],
};

const ROLES = ["ADMIN", "CAJA", "INVENTARIOS", "BODEGA"];

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
    ["Mariana2026*"],
  );

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

  console.log("Seed completado: ubicaciones, admin, y matriz de permisos por rol.");
  console.warn(
    "ADVERTENCIA: cambia la contraseña inicial del usuario admin inmediatamente después del primer acceso.",
  );
} finally {
  await pool.end();
}
