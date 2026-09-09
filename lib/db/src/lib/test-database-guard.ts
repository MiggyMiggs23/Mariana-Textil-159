import pg from "pg";

type DatabaseClient = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
};

export const PREPARED_TEST_DATABASE_TABLES = [
  "usuarios",
  "ubicaciones",
  "clientes",
  "productos",
  "rollos",
  "movimientos",
  "existencias",
  "entradas",
  "tickets",
  "ticket_lineas",
  "ticket_pagos",
  "sesiones_caja",
  "salidas",
  "salida_lineas",
  "salida_rollos",
  "permisos_rol",
  "permisos_usuario",
  "permisos_ubicacion",
  "auditoria",
  "notificaciones_sistema",
  "movimientos_credito",
  "autorizaciones_nota",
] as const;

function requireTestEnvironment(
  testDatabaseUrl: string | undefined,
  applicationDatabaseUrl: string | undefined,
) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "NODE_ENV debe ser test antes de conectar una base de pruebas.",
    );
  }
  if (!testDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL debe estar configurada explícitamente.");
  }
  if (!applicationDatabaseUrl) {
    throw new Error(
      "DATABASE_URL debe estar configurada para comprobar el aislamiento.",
    );
  }
  if (testDatabaseUrl === applicationDatabaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL apunta a la misma URL que DATABASE_URL; se rechazó cualquier operación.",
    );
  }
}

export async function assertIsolatedTestDatabaseUrls(
  testDatabaseUrl: string | undefined,
  applicationDatabaseUrl: string | undefined,
) {
  requireTestEnvironment(testDatabaseUrl, applicationDatabaseUrl);
  const testPool = new pg.Pool({ connectionString: testDatabaseUrl });
  const applicationPool = new pg.Pool({
    connectionString: applicationDatabaseUrl,
  });
  try {
    const [testIdentity, applicationIdentity] = await Promise.all([
      testPool.query<{ database: string }>(
        "SELECT current_database() AS database",
      ),
      applicationPool.query<{ database: string }>(
        "SELECT current_database() AS database",
      ),
    ]);
    const testDatabaseName = testIdentity.rows[0]?.database;
    const applicationDatabaseName = applicationIdentity.rows[0]?.database;
    if (!testDatabaseName || !applicationDatabaseName) {
      throw new Error(
        "No se pudo identificar la base de pruebas o la base de development.",
      );
    }
    if (testDatabaseName === applicationDatabaseName) {
      throw new Error(
        "current_database() confirmó que TEST_DATABASE_URL es la base de development; se rechazó cualquier operación.",
      );
    }
    return { testDatabaseName, applicationDatabaseName };
  } finally {
    await Promise.all([testPool.end(), applicationPool.end()]);
  }
}

export async function createTestDatabaseGuard(
  testClient: DatabaseClient,
  testDatabaseUrl: string | undefined,
  applicationDatabaseUrl: string | undefined,
) {
  const preservedApplicationUrl = process.env.APPLICATION_DATABASE_URL;
  const effectiveApplicationUrl =
    applicationDatabaseUrl === testDatabaseUrl && preservedApplicationUrl
      ? preservedApplicationUrl
      : applicationDatabaseUrl;
  requireTestEnvironment(testDatabaseUrl, effectiveApplicationUrl);

  const testIdentity = await testClient.query<{ database: string }>(
    "SELECT current_database() AS database",
  );
  const testDatabaseName = testIdentity.rows[0]?.database;
  if (!testDatabaseName) {
    throw new Error("No se pudo identificar la base de pruebas.");
  }

  const applicationPool = new pg.Pool({
    connectionString: effectiveApplicationUrl,
  });
  let applicationDatabaseName: string | undefined;
  try {
    const applicationIdentity = await applicationPool.query<{
      database: string;
    }>("SELECT current_database() AS database");
    applicationDatabaseName = applicationIdentity.rows[0]?.database;
  } finally {
    await applicationPool.end();
  }
  if (!applicationDatabaseName) {
    throw new Error("No se pudo identificar la base de development.");
  }
  if (testDatabaseName === applicationDatabaseName) {
    throw new Error(
      "current_database() confirmó que TEST_DATABASE_URL es la base de development; se rechazó cualquier operación.",
    );
  }

  const assertIsolated = async () => {
    const identity = await testClient.query<{ database: string }>(
      "SELECT current_database() AS database",
    );
    if (
      identity.rows[0]?.database !== testDatabaseName ||
      identity.rows[0]?.database === applicationDatabaseName
    ) {
      throw new Error(
        "La conexión dejó de apuntar a la base de pruebas aislada; se rechazó la operación.",
      );
    }
  };

  return { assertIsolated, testDatabaseName };
}

export async function assertPreparedTestDatabase(
  testClient: DatabaseClient,
): Promise<void> {
  const missingTablesResult = await testClient.query<{ table_name: string }>(
    `
      SELECT required.table_name
      FROM unnest($1::text[]) AS required(table_name)
      WHERE to_regclass('public.' || quote_ident(required.table_name)) IS NULL
      ORDER BY required.table_name
    `,
    [[...PREPARED_TEST_DATABASE_TABLES]],
  );
  const missingTables = missingTablesResult.rows.map((row) => row.table_name);

  let hasCanonicalAdmin = false;
  if (!missingTables.includes("usuarios")) {
    const adminResult = await testClient.query<{ present: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM public.usuarios
          WHERE usuario = 'admin'
            AND rol = 'ADMIN'
            AND activo = true
        ) AS present
      `,
    );
    hasCanonicalAdmin = adminResult.rows[0]?.present === true;
  }

  const missing: string[] = [];
  if (missingTables.length > 0) {
    missing.push(`faltan tablas esperadas: ${missingTables.join(", ")}`);
  }
  if (!hasCanonicalAdmin) {
    missing.push(
      "falta el ADMIN canónico activo (usuarios.usuario='admin', rol='ADMIN')",
    );
  }
  if (missing.length > 0) {
    throw new Error(
      `Base de pruebas incompleta: ${missing.join(
        "; ",
      )}. La preparación debe completar schema, seed e inicializadores antes de ejecutar suites.`,
    );
  }
}