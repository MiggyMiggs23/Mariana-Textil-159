import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import pg from "pg";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const pushedSchemaTables = [
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
  "salidas",
  "salida_lineas",
  "salida_rollos",
  "permisos_rol",
  "permisos_usuario",
  "permisos_ubicacion",
];
const pushedSchemaConstraints = [
  "permisos_rol_rol_modulo_unique",
  "permisos_usuario_usuario_modulo_unique",
  "permisos_ubicacion_ubicacion_rol_modulo_unique",
];

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

export function assertCommandSucceeded(
  name,
  result,
  rejectedOutputPatterns = [],
) {
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
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
  const matchedFailure = rejectedOutputPatterns.find((pattern) =>
    pattern.test(output),
  );
  if (matchedFailure) {
    throw new Error(
      `Preparación abortada en ${name}: el comando reportó un error aunque devolvió código 0.`,
    );
  }
}

async function runCommandStep(
  name,
  command,
  args,
  environment,
  rejectedOutputPatterns = [],
  signal,
  onChild,
) {
  process.stdout.write(`Preparación: ${name}...\n`);
  let settled = false;
  let stdout = "";
  let stderr = "";
  const result = await new Promise((resolveResult, rejectResult) => {
    const child = spawn(command, args, {
      cwd: workspaceRoot,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
      signal,
    });
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolveResult(value);
    };
    onChild?.(child, {
      wait: () =>
        new Promise((resolve) => {
          if (settled) {
            resolve();
          } else {
            child.once("close", resolve);
          }
        }),
    });
    child.once("error", (error) => {
      finish({ status: null, stdout, stderr, error });
    });
    child.once("close", (status) => {
      finish({ status, stdout, stderr });
    });
  });
  const safeStdout = redactCommandOutput(result.stdout ?? "", environment);
  const safeStderr = redactCommandOutput(result.stderr ?? "", environment);
  if (safeStdout) {
    process.stdout.write(safeStdout);
  }
  if (safeStderr) {
    process.stderr.write(safeStderr);
  }
  assertCommandSucceeded(name, result, rejectedOutputPatterns);
  return result;
}

function redactCommandOutput(output, environment) {
  let redacted = output;
  for (const name of [
    "DATABASE_URL",
    "APPLICATION_DATABASE_URL",
    "TEST_DATABASE_URL",
    "ADMIN_SEED_PASSWORD",
  ]) {
    const value = environment[name];
    if (typeof value === "string" && value.length > 0) {
      redacted = redacted.replaceAll(value, "[redacted]");
    }
  }
  return redacted;
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const error = new Error("La preparación de la base de pruebas fue cancelada.");
    error.name = "AbortError";
    throw error;
  }
}

async function verifyPushedSchema(testDatabaseUrl) {
  const testPool = new pg.Pool({ connectionString: testDatabaseUrl });
  try {
    const [tables, constraints] = await Promise.all([
      testPool.query(
        `
          SELECT required.name
          FROM unnest($1::text[]) AS required(name)
          WHERE to_regclass('public.' || quote_ident(required.name)) IS NULL
          ORDER BY required.name
        `,
        [pushedSchemaTables],
      ),
      testPool.query(
        `
          SELECT required.name
          FROM unnest($1::text[]) AS required(name)
          WHERE NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = required.name
          )
          ORDER BY required.name
        `,
        [pushedSchemaConstraints],
      ),
    ]);
    const missing = [
      ...tables.rows.map((row) => `tabla ${row.name}`),
      ...constraints.rows.map((row) => `constraint ${row.name}`),
    ];
    if (missing.length > 0) {
      throw new Error(
        `Schema incompleto después de push: faltan ${missing.join(", ")}.`,
      );
    }
  } finally {
    await testPool.end();
  }
}

export async function prepareTestDatabase({
  environment = process.env,
  runStep = runCommandStep,
  signal,
  onChild,
  isolate = verifyIsolation,
  verifySchema = verifyPushedSchema,
  reportSuccess = (message) => process.stdout.write(`${message}\n`),
} = {}) {
  throwIfAborted(signal);
  const { applicationDatabaseUrl, testDatabaseUrl } =
    requiredEnvironment(environment);
  const testDatabaseName = await isolate(
    applicationDatabaseUrl,
    testDatabaseUrl,
  );
  throwIfAborted(signal);
  const preparationEnvironment = {
    ...environment,
    NODE_ENV: "test",
    REQUIRE_ISOLATED_TEST_DATABASE: "1",
    APPLICATION_DATABASE_URL: applicationDatabaseUrl,
    TEST_DATABASE_URL: testDatabaseUrl,
  };

  await runStep(
    "aplicar schema vigente",
    "pnpm",
    ["--filter", "@workspace/db", "run", "push-force"],
    { ...preparationEnvironment, DATABASE_URL: testDatabaseUrl },
    [
      /Interactive prompts require a TTY/i,
      /ERR_PNPM_[A-Z_]+/,
      /(^|\n)Error:/m,
    ],
    signal,
    onChild,
  );
  await verifySchema(testDatabaseUrl);
  throwIfAborted(signal);
  await runStep(
    "ejecutar seed completo",
    "pnpm",
    ["--filter", "@workspace/db", "run", "seed"],
    { ...preparationEnvironment, DATABASE_URL: testDatabaseUrl },
    [],
    signal,
    onChild,
  );
  throwIfAborted(signal);
  await runStep(
    "ejecutar inicializadores y comprobar readiness",
    "pnpm",
    [
      "--filter",
      "@workspace/api-server",
      "exec",
      "tsx",
      "src/scripts/initialize-test-database.ts",
    ],
    {
      ...preparationEnvironment,
      DATABASE_URL: applicationDatabaseUrl,
      TEST_DATABASE_PREPARATION_PHASE: "initializers",
    },
    [],
    signal,
    onChild,
  );
  throwIfAborted(signal);

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