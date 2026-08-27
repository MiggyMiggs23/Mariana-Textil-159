import pg from "pg";

type DatabaseClient = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
};

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