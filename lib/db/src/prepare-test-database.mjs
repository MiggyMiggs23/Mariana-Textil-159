import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import pg from "pg";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function requiredEnvironment(environment) {
  const missing = [
    "DATABASE_URL",
    "TEST_DATABASE_URL",
    "ADMIN_SEED_PASSWORD",
  ].filter((name) => !environment[name]);
  if (missing.length > 0) {
    throw new Error(
      `No se puede preparar la base de pruebas: faltan variables requeridas: ${missing.join(
        ", ",
      )}.`,
    );
  }
  if (environment.DATABASE_URL === environment.TEST_DATABASE_URL) {
    throw new Error(
      "No se puede preparar la base de pruebas: TEST_DATABASE_URL coincide con DATABASE_URL.",
    );
  }
  return {
    applicationDatabaseUrl: environment.DATABASE_URL,
    testDatabaseUrl: environment.TEST_DATABASE_URL,
  };
}

async function verifyIsolation(applicationDatabaseUrl, testDatabaseUrl) {
  const applicationPool = new pg.Pool({
    connectionString: applicationDatabaseUrl,
  });
  const testPool = new pg.Pool({ connectionString: testDatabaseUrl });
  try {
    const [application, test] = await Promise.all([
      applicationPool.query("SELECT current_database() AS database"),
      testPool.query("SELECT current_database() AS database"),
    ]);
    const applicationName = application.rows[0]?.database;
    const testName = test.rows[0]?.database;
    if (!applicationName || !testName) {
      throw new Error(
        "No se pudo identificar la base de development o la base de pruebas.",
      );
    }
    if (applicationName === testName) {
      throw new Error(
        "No se puede preparar la base de pruebas: current_database() coincide con development.",
      );
    }
    return testName;
  } finally {
    await Promise.all([applicationPool.end(), testPool.end()]);
  }
}

function runCommandStep(name, command, args, environment) {
  process.stdout.write(`Preparación: ${name}...\n`);
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    env: environment,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.error) {
    throw new Error(
      `Preparación abortada en ${name}: ${result.error.message}`,
      { cause: result.error },
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `Preparación abortada en ${name}: el comando terminó con código ${
        result.status ?? "desconocido"
      }.`,
    );
  }
}

export async function prepareTestDatabase({
  environment = process.env,
  runStep = runCommandStep,
  isolate = verifyIsolation,
  reportSuccess = (message) => process.stdout.write(`${message}\n`),
} = {}) {
  const { applicationDatabaseUrl, testDatabaseUrl } =
    requiredEnvironment(environment);
  const testDatabaseName = await isolate(
    applicationDatabaseUrl,
    testDatabaseUrl,
  );
  const preparationEnvironment = {
    ...environment,
    NODE_ENV: "test",
    REQUIRE_ISOLATED_TEST_DATABASE: "1",
    APPLICATION_DATABASE_URL: applicationDatabaseUrl,
    TEST_DATABASE_URL: testDatabaseUrl,
  };

  runStep(
    "aplicar schema vigente",
    "pnpm",
    ["--filter", "@workspace/db", "run", "push-force"],
    { ...preparationEnvironment, DATABASE_URL: testDatabaseUrl },
  );
  runStep(
    "ejecutar seed completo",
    "pnpm",
    ["--filter", "@workspace/db", "run", "seed"],
    { ...preparationEnvironment, DATABASE_URL: testDatabaseUrl },
  );
  runStep(
    "ejecutar inicializadores y comprobar readiness",
    "pnpm",
    [
      "--filter",
      "@workspace/api-server",
      "exec",
      "tsx",
      "src/scripts/initialize-test-database.ts",
    ],
    { ...preparationEnvironment, DATABASE_URL: applicationDatabaseUrl },
  );

  reportSuccess(
    `Base de pruebas preparada completamente: ${testDatabaseName}.`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  prepareTestDatabase().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}