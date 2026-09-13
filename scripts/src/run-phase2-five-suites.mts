import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// @ts-expect-error The disposable runner is an intentionally unbuilt local .mjs helper.
import * as disposableRunner from "../../lib/db/src/run-isolated-tests.mjs";
// @ts-expect-error The preparation helper is an intentionally unbuilt local .mjs helper.
import { prepareTestDatabase } from "../../lib/db/src/prepare-test-database.mjs";

const {
  DisposablePostgresRunner,
  createChildEnvironment,
  createLocalConnectionUrl,
  installSignalHandlers,
  redactSensitiveText,
} = disposableRunner;

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const AUTHORIZATION_VARIABLE = "PHASE2_FIVE_SUITES_AUTHORIZATION";
const AUTHORIZATION_VALUE = "RUN_FIVE_SUITES_IN_OWN_DISPOSABLE_ONLY";
const PARENT_SENTINEL_URL =
  "postgresql://phase2-parent-sentinel.invalid/application_sentinel";

const SUITES = [
  "test:inventario",
  "test:pos",
  "test:cuadre-fiscal-integration",
  "test:salidas",
  "test:admin-analytics-integration",
] as const;

type SuiteName = (typeof SUITES)[number];
type Environment = Record<string, string>;

type ChildResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
};

type SignalState = {
  signal?: string;
  promise?: Promise<void>;
  resolve?: () => void;
  cleanupError?: unknown;
};

function requireAuthorization(): void {
  if (process.argv.length !== 2) {
    throw new Error(
      "Este wrapper no acepta argumentos: las cinco suites están fijadas en el código.",
    );
  }
  if (process.env[AUTHORIZATION_VARIABLE] !== AUTHORIZATION_VALUE) {
    throw new Error(
      `${AUTHORIZATION_VARIABLE} debe contener la autorización explícita de esta corrida.`,
    );
  }
  if (process.env.TEST_DATABASE_URL) {
    throw new Error(
      "TEST_DATABASE_URL externo está prohibido: el wrapper crea su propio destino.",
    );
  }
  if (process.env.APPLICATION_DATABASE_URL) {
    throw new Error(
      "APPLICATION_DATABASE_URL externo está prohibido: el wrapper crea su propio sentinel.",
    );
  }
  if (!process.env.ADMIN_SEED_PASSWORD) {
    throw new Error(
      "ADMIN_SEED_PASSWORD debe estar disponible como secreto de runtime para el seed.",
    );
  }
}

function createPrivateParentEnvironment(): Environment {
  const parent: Environment = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    if (/^PG[A-Z0-9_]*$/i.test(name)) continue;
    if (
      name === "DATABASE_URL" ||
      name === "TEST_DATABASE_URL" ||
      name === "APPLICATION_DATABASE_URL"
    ) {
      continue;
    }
    parent[name] = value;
  }
  // DisposablePostgresRunner validates that the parent has an explicit
  // PostgreSQL URL, but no child receives this syntactic-only placeholder.
  parent.DATABASE_URL = PARENT_SENTINEL_URL;
  delete parent[AUTHORIZATION_VARIABLE];
  return parent;
}

function createSuiteEnvironment(
  parentEnvironment: Environment,
  applicationSentinelUrl: string,
  testDatabaseUrl: string,
  includeSeedSecret: boolean,
): Environment {
  const environment = createChildEnvironment(parentEnvironment, {
    applicationUrl: applicationSentinelUrl,
    testDatabaseUrl,
  }) as Environment;
  // Two suites read DATABASE_URL themselves before importing @workspace/db.
  // It is the disposable-cluster sentinel, never the original application URL.
  environment.DATABASE_URL = applicationSentinelUrl;
  environment.APPLICATION_DATABASE_URL = applicationSentinelUrl;
  environment.TEST_DATABASE_URL = testDatabaseUrl;
  environment.NODE_ENV = "test";
  environment.REQUIRE_ISOLATED_TEST_DATABASE = "1";
  delete environment[AUTHORIZATION_VARIABLE];
  if (!includeSeedSecret) delete environment.ADMIN_SEED_PASSWORD;
  return environment;
}

function redactOutput(text: string, secrets: string[]): string {
  const redacted = redactSensitiveText(text, secrets);
  return redacted.replace(
    /postgres(?:ql)?:\/\/[^\s'"`]+/gi,
    "[redacted-disposable-db-url]",
  );
}

function registerTrackedChild(
  runner: {
    trackChild: (
      child: unknown,
      control: { wait: () => Promise<void> },
    ) => void;
  },
  child: unknown,
  completion: Promise<void>,
): void {
  runner.trackChild(child, {
    wait: () => completion.then(() => undefined),
  });
}

function assertChildRegistrationSelfCheck(): void {
  let resolveCompletion!: () => void;
  const completion = new Promise<void>((resolve) => {
    resolveCompletion = resolve;
  });
  let registrationCount = 0;
  let immediateWait: Promise<void> | undefined;
  const fakeRunner = {
    trackChild: (
      _child: unknown,
      control: { wait: () => Promise<void> },
    ) => {
      registrationCount += 1;
      immediateWait = control.wait();
    },
  };
  // trackChild implementations may invoke wait() synchronously. Keeping the
  // deferred promise initialized before registration prevents a TDZ regression.
  registerTrackedChild(fakeRunner, {}, completion);
  if (registrationCount !== 1 || !immediateWait) {
    throw new Error("La autoprueba de registro de hijos descartables falló.");
  }
  resolveCompletion();
}

function runFixedSuite(
  suite: SuiteName,
  environment: Environment,
  runner: InstanceType<typeof DisposablePostgresRunner>,
  secrets: string[],
): Promise<void> {
  let resolveCompletion!: (result: ChildResult) => void;
  const completion = new Promise<ChildResult>((resolve) => {
    resolveCompletion = resolve;
  });
  let stdout = "";
  let stderr = "";
  let settled = false;
  const finish = (result: ChildResult) => {
    if (settled) return;
    settled = true;
    resolveCompletion(result);
  };
  const child = spawn(
    "pnpm",
    ["--filter", "@workspace/api-server", "run", suite],
    {
      cwd: workspaceRoot,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
      signal: runner.signal,
    },
  );
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr?.on("data", (chunk: string) => {
    stderr += chunk;
  });
  let childError: Error | undefined;
  child.once("error", (error: Error) => {
    childError = error;
    child.kill("SIGTERM");
  });
  child.once("close", (status: number | null) => {
    finish({ status, stdout, stderr, error: childError });
  });
  registerTrackedChild(runner, child, completion.then(() => undefined));

  return completion.then((result) => {
    const output = redactOutput(
      `${result.stdout}${result.stderr}`,
      secrets,
    );
    if (output) process.stdout.write(output);
    if (result.error) {
      throw new Error(
        `No se pudo iniciar la suite fija ${suite}: ${result.error.message}`,
      );
    }
    if (result.status !== 0) {
      throw new Error(
        `La suite fija ${suite} terminó con código ${result.status ?? "desconocido"}.`,
      );
    }
  });
}

async function runOneSuite(
  suite: SuiteName,
  parentEnvironment: Environment,
): Promise<void> {
  const runner = new DisposablePostgresRunner({
    parentEnvironment,
  }) as InstanceType<typeof DisposablePostgresRunner>;
  const signalState: SignalState = {};
  const removeSignalHandlers = installSignalHandlers(
    () => {
      runner.abort();
      return runner.cleanup();
    },
    signalState,
  );
  let cleanupError: unknown;
  try {
    await runner.start();
    await runner.verifyIdentity();
    const cluster = runner.cluster;
    const applicationSentinelUrl = createLocalConnectionUrl({
      socketDirectory: cluster.socketDirectory,
      port: cluster.port,
      username: cluster.username,
      password: cluster.password,
      database: "postgres",
    });
    const preparationEnvironment = createSuiteEnvironment(
      parentEnvironment,
      applicationSentinelUrl,
      cluster.testDatabaseUrl,
      true,
    );
    await prepareTestDatabase({
      environment: preparationEnvironment,
      signal: runner.signal,
      onChild: (child: unknown, control: unknown) =>
        runner.trackChild(child, control),
    });
    // This is the target-pool identity guard immediately before fixtures.
    // Each suite retains its own @workspace/db current_database guard too.
    await runner.verifyIdentity();
    const suiteEnvironment = createSuiteEnvironment(
      parentEnvironment,
      applicationSentinelUrl,
      cluster.testDatabaseUrl,
      false,
    );
    const secrets = [
      cluster.testDatabaseUrl,
      applicationSentinelUrl,
      process.env.ADMIN_SEED_PASSWORD ?? "",
      AUTHORIZATION_VALUE,
    ];
    await runFixedSuite(suite, suiteEnvironment, runner, secrets);
    await runner.verifyIdentity();
  } finally {
    removeSignalHandlers();
    try {
      await runner.cleanup();
    } catch (error) {
      cleanupError = error;
    }
  }
  if (signalState.cleanupError) {
    throw signalState.cleanupError;
  }
  if (cleanupError) throw cleanupError;
  if (signalState.signal) {
    throw new Error(`Wrapper interrumpido por ${signalState.signal}.`);
  }
}

assertChildRegistrationSelfCheck();
requireAuthorization();
const parentEnvironment = createPrivateParentEnvironment();

try {
  for (const suite of SUITES) {
    process.stdout.write(`Fase 2: iniciando ${suite} en clúster nuevo.\n`);
    await runOneSuite(suite, parentEnvironment);
    process.stdout.write(`Fase 2: ${suite} terminó y su clúster fue eliminado.\n`);
  }
  process.stdout.write("Fase 2: cinco suites completadas en clústeres desechables.\n");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Fase 2 bloqueada/fallida: ${message}\n`);
  process.exitCode = 1;
}