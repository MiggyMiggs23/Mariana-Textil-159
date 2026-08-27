import pg from "pg";

type DatabaseClient = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
};

export async function createTestDatabaseGuard(
  testClient: DatabaseClient,
  testDatabaseUrl: string | undefined,
  applicationDatabaseUrl: string | undefined,
) {
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
      "TEST_DATABASE_URL apunta a la misma base que DATABASE_URL; se rechazó cualquier operación.",
    );
  }

  const testIdentity = await testClient.query<{ database: string }>(
    "SELECT current_database() AS database",
  );
  const testDatabaseName = testIdentity.rows[0]?.database;
  if (!testDatabaseName) {
    throw new Error("No se pudo identificar la base de pruebas.");
  }

  const applicationPool = new pg.Pool({
    connectionString: applicationDatabaseUrl,
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