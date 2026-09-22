import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to verify the database connection.");
}

const configuredUrl = new URL(connectionString);
const pool = new Pool({ connectionString });

try {
  const result = await pool.query(`
    SELECT
      current_database() AS database,
      current_schema() AS schema,
      current_setting('server_version') AS server_version,
      to_regclass('public.usuarios') IS NOT NULL AS has_usuarios,
      to_regclass('public.permisos_rol') IS NOT NULL AS has_permisos_rol,
      to_regclass('public.permisos_usuario') IS NOT NULL AS has_permisos_usuario,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'usuarios'
          AND column_name = 'alcance_consulta'
      ) AS has_alcance_consulta
  `);

  const row = result.rows[0];
  const schemaReady =
    row.has_usuarios &&
    row.has_permisos_rol &&
    row.has_permisos_usuario &&
    row.has_alcance_consulta;

  console.log(
    JSON.stringify(
      {
        connectionVariable: "DATABASE_URL",
        configuredHost: configuredUrl.hostname,
        configuredPort: configuredUrl.port || "5432",
        configuredDatabase: configuredUrl.pathname.replace(/^\//, ""),
        actualDatabase: row.database,
        schema: row.schema,
        serverVersion: row.server_version,
        schemaReady,
        requiredObjects: {
          usuarios: row.has_usuarios,
          permisosRol: row.has_permisos_rol,
          permisosUsuario: row.has_permisos_usuario,
          alcanceConsulta: row.has_alcance_consulta,
        },
      },
      null,
      2,
    ),
  );

  if (!schemaReady) {
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}