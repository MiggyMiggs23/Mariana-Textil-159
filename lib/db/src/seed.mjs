import pg from "pg";

const { Pool } = pg;

const connectionString =
  process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "NEON_DATABASE_URL o DATABASE_URL es obligatoria para ejecutar el seed.",
  );
}

const pool = new Pool({ connectionString });

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

  console.warn(
    "ADVERTENCIA: cambia la contraseña inicial del usuario admin inmediatamente después del primer acceso.",
  );
} finally {
  await pool.end();
}