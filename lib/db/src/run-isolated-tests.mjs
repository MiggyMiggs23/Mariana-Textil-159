import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { randomBytes, randomInt } from "node:crypto";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  assertAllowedIsolatedSuite,
  formatPolicyList,
  getIsolatedTestPolicy,
} from "./isolated-test-policy.mjs";
import { prepareTestDatabase } from "./prepare-test-database.mjs";

const { Pool } = pg;
const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);
const PORT_MIN = 20_000;
const PORT_MAX = 59_999;
const STARTUP_TIMEOUT_SECONDS = 30;
const COMMAND_BUFFER_BYTES = 4 * 1024 * 1024;

// A machine-readable --list is commonly piped through head/jq.  Do not turn
// the consumer closing its pipe into a misleading runner failure (and never
// let that stream error bypass cluster cleanup).
for (const stream of [process.stdout, process.stderr]) {
  stream.on("error", (error) => {
    if (error?.code !== "EPIPE") process.exitCode = 1;
  });
}

function randomToken(bytes = 18) {
  return randomBytes(bytes).toString("hex");
}

function quotePostgresOption(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

export function createLocalConnectionUrl({
  socketDirectory,
  port,
  username,
  password,
  database,
}) {
  const encodedUser = encodeURIComponent(username);
  const encodedPassword = encodeURIComponent(password);
  const encodedSocket = encodeURIComponent(socketDirectory);
  const encodedDatabase = encodeURIComponent(database);
  return `postgresql://${encodedUser}:${encodedPassword}@${encodedSocket}/${encodedDatabase}?port=${port}`;
}

export function redactSensitiveText(text, secrets = []) {
  let redacted = String(text ?? "");
  for (const secret of secrets) {
    if (typeof secret !== "string" || secret.length === 0) continue;
    redacted = redacted.replaceAll(secret, "[redacted]");
  }
  return redacted;
}

function safeErrorMessage(error, secrets) {
  const message = error instanceof Error ? error.message : String(error);
  return redactSensitiveText(message, secrets);
}

function requirePostgresUrl(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} debe ser una URL PostgreSQL explícita.`);
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} debe ser una URL PostgreSQL válida.`);
  }
  if (!POSTGRES_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`${name} debe usar el protocolo PostgreSQL.`);
  }
  if (!parsed.pathname || parsed.pathname === "/") {
    throw new Error(`${name} debe identificar una base de datos.`);
  }
  if (!parsed.hostname) {
    throw new Error(
      `${name} debe incluir un host explícito; no se hereda PGHOST.`,
    );
  }
  return parsed;
}

/**
 * Validate only non-secret facts.  The password is intentionally never read
 * here: it is inherited into the child environment and consumed by the
 * canonical seed process.
 */
export function assertRunnerEnvironment(environment = process.env) {
  if (Object.hasOwn(environment, "TEST_DATABASE_URL")) {
    throw new Error(
      "TEST_DATABASE_URL no puede proporcionarse al runner; el runner crea su propio destino local.",
    );
  }
  const applicationUrl = environment.DATABASE_URL;
  requirePostgresUrl(applicationUrl, "DATABASE_URL");
  if (!Object.hasOwn(environment, "ADMIN_SEED_PASSWORD")) {
    throw new Error(
      "ADMIN_SEED_PASSWORD debe estar disponible como secreto para el seed canónico.",
    );
  }
  return { applicationUrl };
}

export function createChildEnvironment(
  parentEnvironment,
  { applicationUrl, testDatabaseUrl } = {},
) {
  const childEnvironment = {};
  for (const [name, value] of Object.entries(parentEnvironment)) {
    // PGHOST, PGOPTIONS, PGSERVICE, PGPASSWORD, and every other libpq
    // override can redirect a child away from the URL we derived.
    if (/^PG[A-Z0-9_]*$/i.test(name)) continue;
    childEnvironment[name] = value;
  }
  delete childEnvironment.TEST_DATABASE_URL;
  childEnvironment.DATABASE_URL = applicationUrl;
  childEnvironment.APPLICATION_DATABASE_URL = applicationUrl;
  childEnvironment.TEST_DATABASE_URL = testDatabaseUrl;
  childEnvironment.NODE_ENV = "test";
  childEnvironment.REQUIRE_ISOLATED_TEST_DATABASE = "1";
  return childEnvironment;
}

function spawnProcess(command, args, environment, { signal, onChild } = {}) {
  return new Promise((resolveResult, rejectResult) => {
    let stdout = "";
    let stderr = "";
    let childError;
    let settled = false;
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
      signal,
      windowsHide: true,
    });
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    const completion = new Promise((resolve) => {
      const finish = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      child.once("error", (error) => {
        childError = error;
      });
      child.once("close", (status) => {
        finish({
          status,
          stdout,
          stderr,
          error: childError,
        });
      });
    });
    try {
      onChild?.(child, { wait: () => completion });
    } catch (error) {
      child.kill("SIGTERM");
      rejectResult(error);
      return;
    }
    completion.then(resolveResult, rejectResult);
  });
}

async function runQuietCommand(
  command,
  args,
  environment,
  displayName = command,
  { signal, onChild } = {},
) {
  const result = await spawnProcess(command, args, environment, {
    signal,
    onChild,
  });
  if (result.error) {
    throw new Error(
      `${displayName} no pudo iniciarse (${result.error.code ?? "error del sistema"}).`,
      { cause: result.error },
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `${displayName} terminó con código ${result.status ?? "desconocido"}.`,
    );
  }
  return result;
}

async function runReviewedSuite(
  suite,
  environment,
  secrets,
  { signal, onChild } = {},
) {
  if (suite.id !== "api-script:test:ticket-iva-schema") {
    throw new Error(
      "La suite solicitada no tiene un comando fijo aprobado por la política.",
    );
  }
  const command = [
    "pnpm",
    "--filter",
    "@workspace/api-server",
    "run",
    "test:ticket-iva-schema",
  ];
  const result = await spawnProcess(command[0], command.slice(1), environment, {
    signal,
    onChild,
  });
  const stdout = redactSensitiveText(result.stdout ?? "", secrets);
  const stderr = redactSensitiveText(result.stderr ?? "", secrets);
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  if (result.error) {
    throw new Error(
      "La suite revisada ticket-iva-schema no pudo iniciarse.",
      { cause: result.error },
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `La suite revisada ${suite.id} terminó con código ${
        result.status ?? "desconocido"
      }.`,
    );
  }
}

function postgresStatus(dataDirectory) {
  if (!existsSync(dataDirectory)) return false;
  const result = spawnSync(
    "pg_ctl",
    ["--pgdata", dataDirectory, "status"],
    {
      encoding: "utf8",
      stdio: ["ignore", "ignore", "ignore"],
      windowsHide: true,
    },
  );
  if (result.error) {
    throw new Error("No se pudo comprobar el estado del clúster descartable.", {
      cause: result.error,
    });
  }
  if (result.status === 0) return true;
  // pg_ctl uses status 3 for a data directory whose server is not running.
  if (result.status === 3) return false;
  throw new Error(
    `No se pudo comprobar el estado del clúster descartable (código ${
      result.status ?? "desconocido"
    }).`,
  );
}

async function stopPostgres(dataDirectory, mode, onChild) {
  let running;
  try {
    running = postgresStatus(dataDirectory);
  } catch (statusError) {
    // A just-launched postmaster can report "starting" before pg_ctl status
    // recognizes it. A postmaster.pid is enough reason to issue a scoped stop;
    // status is checked again before any deletion.
    if (!existsSync(join(dataDirectory, "postmaster.pid"))) {
      throw statusError;
    }
    running = true;
  }
  if (!running) return;
  await runQuietCommand(
    "pg_ctl",
    [
      "--pgdata",
      dataDirectory,
      "--wait",
      "--timeout",
      String(STARTUP_TIMEOUT_SECONDS),
      "--mode",
      mode,
      "stop",
    ],
    process.env,
    `pg_ctl ${mode} stop`,
    { onChild },
  );
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if (!postgresStatus(dataDirectory)) return;
    } catch (statusError) {
      if (attempt === 49) throw statusError;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `No se pudo demostrar que el clúster PostgreSQL descartable está detenido (${mode}).`,
  );
}

function clusterPoolConfig(cluster) {
  return {
    host: cluster.socketDirectory,
    port: cluster.port,
    database: cluster.database,
    user: cluster.username,
    password: cluster.password,
    max: 1,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 1_000,
    ssl: false,
  };
}

async function queryClusterIdentity(cluster) {
  const pool = new Pool(clusterPoolConfig(cluster));
  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database,
        current_user AS "user",
        current_setting('data_directory') AS data_directory,
        current_setting('port') AS port,
        current_setting('unix_socket_directories') AS unix_socket_directories,
        current_setting('listen_addresses') AS listen_addresses
    `);
    return result.rows[0];
  } finally {
    await pool.end();
  }
}

function assertClusterIdentity(identity, cluster) {
  const expectedDataDirectory = cluster.dataDirectory;
  const socketDirectories = String(identity?.unix_socket_directories ?? "")
    .split(",")
    .map((value) => value.trim());
  if (
    identity?.database !== cluster.database ||
    identity?.user !== cluster.username ||
    identity?.data_directory !== expectedDataDirectory ||
    Number(identity?.port) !== cluster.port ||
    !socketDirectories.includes(cluster.socketDirectory) ||
    String(identity?.listen_addresses ?? "").trim() !== ""
  ) {
    throw new Error(
      "La conexión descartable no pertenece al clúster local creado por este runner.",
    );
  }
}

export class DisposablePostgresRunner {
  constructor({ parentEnvironment = process.env } = {}) {
    const { applicationUrl } = assertRunnerEnvironment(parentEnvironment);
    this.parentEnvironment = parentEnvironment;
    this.applicationUrl = applicationUrl;
    this.rootDirectory = undefined;
    this.dataDirectory = undefined;
    this.socketDirectory = undefined;
    this.passwordFile = undefined;
    this.logFile = undefined;
    this.username = undefined;
    this.password = undefined;
    this.database = undefined;
    this.port = undefined;
    this.testDatabaseUrl = undefined;
    this.started = false;
    this.cleanupPromise = undefined;
    this.abortController = new AbortController();
    this.activeChildren = new Set();
  }

  get signal() {
    return this.abortController.signal;
  }

  abort() {
    if (!this.abortController.signal.aborted) {
      this.abortController.abort();
    }
  }

  trackChild(_child, control) {
    const pending = control.wait().finally(() => {
      this.activeChildren.delete(pending);
    });
    this.activeChildren.add(pending);
  }

  async waitForChildren() {
    while (this.activeChildren.size > 0) {
      await Promise.allSettled([...this.activeChildren]);
    }
  }

  get childEnvironment() {
    if (!this.testDatabaseUrl) {
      throw new Error("El clúster descartable todavía no está listo.");
    }
    return createChildEnvironment(this.parentEnvironment, {
      applicationUrl: this.applicationUrl,
      testDatabaseUrl: this.testDatabaseUrl,
    });
  }

  get cluster() {
    if (
      !this.rootDirectory ||
      !this.dataDirectory ||
      !this.socketDirectory ||
      !this.passwordFile ||
      !this.logFile ||
      !this.username ||
      !this.password ||
      !this.database ||
      !this.port ||
      !this.testDatabaseUrl
    ) {
      throw new Error("El clúster descartable no ha sido creado.");
    }
    return {
      rootDirectory: this.rootDirectory,
      dataDirectory: this.dataDirectory,
      socketDirectory: this.socketDirectory,
      passwordFile: this.passwordFile,
      logFile: this.logFile,
      username: this.username,
      password: this.password,
      database: this.database,
      port: this.port,
      testDatabaseUrl: this.testDatabaseUrl,
    };
  }

  async start() {
    if (this.rootDirectory) return this.cluster;
    const rootDirectory = mkdtempSync(join(tmpdir(), "workspace-isolated-pg-"));
    chmodSync(rootDirectory, 0o700);
    this.rootDirectory = rootDirectory;
    this.dataDirectory = join(rootDirectory, "data");
    this.socketDirectory = join(rootDirectory, "socket");
    this.passwordFile = join(rootDirectory, "initdb-password");
    this.logFile = join(rootDirectory, "postgres.log");
    mkdirSync(this.socketDirectory, { mode: 0o700 });
    this.username = `isolated_${randomToken(10)}`;
    this.password = randomToken(32);
    this.database = `isolated_${randomToken(10)}`;
    this.port = randomInt(PORT_MIN, PORT_MAX + 1);
    chmodSync(rootDirectory, 0o700);
    // initdb consumes this file synchronously.  It is removed before any
    // child carrying the TEST_DATABASE_URL is started.
    writeFileSync(this.passwordFile, `${this.password}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    this.testDatabaseUrl = createLocalConnectionUrl({
      socketDirectory: this.socketDirectory,
      port: this.port,
      username: this.username,
      password: this.password,
      database: this.database,
    });

    const initdbEnvironment = createChildEnvironment(this.parentEnvironment, {
      applicationUrl: this.applicationUrl,
      testDatabaseUrl: this.testDatabaseUrl,
    });
    await runQuietCommand(
      "initdb",
      [
        "--pgdata",
        this.dataDirectory,
        "--username",
        this.username,
        "--pwfile",
        this.passwordFile,
        "--auth=scram-sha-256",
        "--no-locale",
        "--encoding=UTF8",
      ],
      initdbEnvironment,
      "initdb",
      { signal: this.signal, onChild: (child, control) => this.trackChild(child, control) },
    );
    if (existsSync(this.passwordFile)) unlinkSync(this.passwordFile);

    const postgresOptions = [
      "-p",
      this.port,
      "-h",
      "",
      "-k",
      this.socketDirectory,
    ]
      .map(quotePostgresOption)
      .join(" ");
    await runQuietCommand(
      "pg_ctl",
      [
        "--pgdata",
        this.dataDirectory,
        "--wait",
        "--timeout",
        String(STARTUP_TIMEOUT_SECONDS),
        "--log",
        this.logFile,
        "--options",
        postgresOptions,
        "start",
      ],
      initdbEnvironment,
      "pg_ctl start",
      { signal: this.signal, onChild: (child, control) => this.trackChild(child, control) },
    );
    this.started = true;
    if (existsSync(this.logFile)) chmodSync(this.logFile, 0o600);

    const databaseEnvironment = {
      ...initdbEnvironment,
      PGPASSWORD: this.password,
    };
    await runQuietCommand(
      "createdb",
      [
        "--host",
        this.socketDirectory,
        "--port",
        String(this.port),
        "--username",
        this.username,
        "--maintenance-db",
        "postgres",
        this.database,
      ],
      databaseEnvironment,
      "createdb",
      { signal: this.signal, onChild: (child, control) => this.trackChild(child, control) },
    );
    if (existsSync(this.passwordFile)) unlinkSync(this.passwordFile);
    return this.cluster;
  }

  async verifyIdentity() {
    const cluster = this.cluster;
    const identity = await queryClusterIdentity(cluster);
    assertClusterIdentity(identity, cluster);
    return identity;
  }

  async smoke() {
    const cluster = this.cluster;
    const pool = new Pool(clusterPoolConfig(cluster));
    try {
      const result = await pool.query(`
        SELECT
          current_database() AS database,
          current_user AS "user",
          EXISTS (
            SELECT 1 FROM public.usuarios
            WHERE usuario = 'admin' AND rol = 'ADMIN' AND activo = true
          ) AS canonical_admin
      `);
      const row = result.rows[0];
      if (
        row?.database !== cluster.database ||
        row?.user !== cluster.username ||
        row?.canonical_admin !== true
      ) {
        throw new Error(
          "El smoke check no confirmó la identidad y el ADMIN canónico del clúster.",
        );
      }
    } finally {
      await pool.end();
    }
  }

  cleanup() {
    if (this.cleanupPromise) return this.cleanupPromise;
    this.cleanupPromise = (async () => {
      if (!this.rootDirectory) return;
      const rootDirectory = this.rootDirectory;
      const dataDirectory = this.dataDirectory;
      await this.waitForChildren();
      if (dataDirectory && existsSync(dataDirectory)) {
        try {
          // Check liveness even when pg_ctl start timed out before start()
          // could mark the instance as started.
          await stopPostgres(
            dataDirectory,
            "fast",
            (child, control) => this.trackChild(child, control),
          );
        } catch (fastError) {
          try {
            await stopPostgres(
              dataDirectory,
              "immediate",
              (child, control) => this.trackChild(child, control),
            );
          } catch (immediateError) {
            // Never remove a data directory while liveness is unknown. The
            // retained private path lets an operator inspect the failure.
            throw new Error(
              `No se pudo detener el clúster descartable; se retuvo ${rootDirectory}.`,
              { cause: immediateError ?? fastError },
            );
          }
        }
        if (postgresStatus(dataDirectory)) {
          throw new Error(
            `El clúster descartable sigue activo; se retuvo ${rootDirectory}.`,
          );
        }
      }
      try {
        rmSync(rootDirectory, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 100,
        });
        if (existsSync(rootDirectory)) {
          throw new Error(
            `No se pudo eliminar completamente el clúster descartable; se retuvo ${rootDirectory}.`,
          );
        }
        this.started = false;
      } catch (error) {
        if (error instanceof Error && error.message.includes("se retuvo")) {
          throw error;
        }
        throw new Error(
          `No se pudo eliminar completamente el clúster descartable; se retuvo ${rootDirectory}.`,
          { cause: error },
        );
      }
    })();
    return this.cleanupPromise;
  }
}

export function parseRunnerArguments(argumentsList) {
  const options = {
    list: false,
    suite: "prepare-smoke",
    induceFailure: false,
    holdForSignal: false,
    lifecycleOnly: false,
  };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--") continue;
    if (argument === "--list" || argument === "--json") {
      options.list = true;
    } else if (argument === "--induce-failure") {
      options.induceFailure = true;
    } else if (argument === "--hold-for-signal") {
      options.holdForSignal = true;
    } else if (argument === "--lifecycle-only") {
      options.lifecycleOnly = true;
    } else if (argument === "--suite") {
      const suite = argumentsList[++index];
      if (!suite) throw new Error("--suite requiere un valor.");
      options.suite = suite;
    } else if (argument.startsWith("--suite=")) {
      options.suite = argument.slice("--suite=".length);
      if (!options.suite) throw new Error("--suite requiere un valor.");
    } else {
      throw new Error(`Argumento no reconocido: ${argument}`);
    }
  }
  if (options.list && options.suite !== "prepare-smoke") {
    throw new Error("--list no puede combinarse con una suite.");
  }
  if (options.lifecycleOnly && options.suite !== "prepare-smoke") {
    throw new Error("--lifecycle-only no puede combinarse con una suite.");
  }
  return options;
}

export function installSignalHandlers(cleanup, signalState) {
  const handlers = new Map();
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    const handler = () => {
      if (signalState.promise) return;
      signalState.signal = signal;
      signalState.promise = Promise.resolve()
        .then(cleanup)
        .then(
          () => signalState.resolve?.(),
          (error) => {
            signalState.cleanupError = error;
            signalState.resolve?.();
          },
        );
    };
    handlers.set(signal, handler);
    process.once(signal, handler);
  }
  return () => {
    for (const [signal, handler] of handlers) {
      process.removeListener(signal, handler);
    }
  };
}

function waitForSignal(signalState) {
  if (signalState.signal) return Promise.resolve();
  return new Promise((resolve) => {
    signalState.resolve = resolve;
  });
}

function signalExitCode(signal) {
  return signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 129;
}

function writeSummary(summary) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

export async function runIsolatedTests({
  argumentsList = process.argv.slice(2),
  parentEnvironment = process.env,
} = {}) {
  const options = parseRunnerArguments(argumentsList);
  const policy = getIsolatedTestPolicy();
  if (options.list) {
    process.stdout.write(formatPolicyList(policy));
    return { listed: true, policy };
  }
  const selectedSuite = assertAllowedIsolatedSuite(options.suite, policy);
  const { applicationUrl } = assertRunnerEnvironment(parentEnvironment);
  const runner = new DisposablePostgresRunner({ parentEnvironment });
  const signalState = {
    signal: undefined,
    promise: undefined,
    resolve: undefined,
    cleanupError: undefined,
  };
  const removeSignalHandlers = installSignalHandlers(
    () => {
      runner.abort();
      return runner.cleanup();
    },
    signalState,
  );
  const secrets = [applicationUrl];
  try {
    await runner.start();
    secrets.push(runner.testDatabaseUrl);
    await runner.verifyIdentity();
    if (options.lifecycleOnly) {
      if (options.induceFailure) {
        throw new Error(
          "Fallo de ciclo de vida inducido; la limpieza debe continuar.",
        );
      }
      if (options.holdForSignal) {
        await waitForSignal(signalState);
        if (signalState.signal) {
          process.exitCode = signalExitCode(signalState.signal);
          return { interrupted: signalState.signal };
        }
      }
      writeSummary({
        status: "lifecycle-bootstrap-passed",
        mode: "lifecycle-only",
        blockedRemaining: policy.blockedCount,
        note: "Only a minimal local cluster bootstrap ran; no schema, seed, fixtures, or application writes.",
      });
      return { passed: true, lifecycleOnly: true };
    }
    await prepareTestDatabase({
      environment: runner.childEnvironment,
      signal: runner.signal,
      onChild: (child, control) => runner.trackChild(child, control),
    });
    await runner.verifyIdentity();
    if (selectedSuite.id !== "prepare-smoke") {
      await runReviewedSuite(
        selectedSuite,
        runner.childEnvironment,
        secrets,
        {
          signal: runner.signal,
          onChild: (child, control) => runner.trackChild(child, control),
        },
      );
      await runner.verifyIdentity();
    }
    await runner.smoke();
    if (signalState.signal) {
      await signalState.promise;
      process.exitCode = signalExitCode(signalState.signal);
      return { interrupted: signalState.signal };
    }
    if (options.induceFailure) {
      throw new Error("Fallo inducido solicitado; la limpieza debe continuar.");
    }
    if (options.holdForSignal) {
      await waitForSignal(signalState);
      if (signalState.signal) {
        process.exitCode = signalExitCode(signalState.signal);
        return { interrupted: signalState.signal };
      }
    }
    writeSummary({
      status:
        selectedSuite.id === "prepare-smoke"
          ? "prepare-smoke-passed"
          : "prepare-smoke-reviewed-suite-passed",
      mode:
        selectedSuite.id === "prepare-smoke"
          ? "prepare+smoke"
          : "prepare+reviewed-suite+smoke",
      suite: selectedSuite.id,
      blockedRemaining: policy.blockedCount,
      blockedSuites: policy.blockedSuites.map(({ id, reason }) => ({
        id,
        reason,
      })),
      note:
        selectedSuite.id === "prepare-smoke"
          ? "No integration suite was run; blocked suites are not reported as passing."
          : "Only the explicitly reviewed schema suite ran; remaining blocked suites are not reported as passing.",
    });
    return { passed: true, blockedRemaining: policy.blockedCount };
  } catch (error) {
    if (signalState.signal) {
      await signalState.promise;
      process.stderr.write(
        `Runner interrumpido por ${signalState.signal}; se abortó el proceso hijo y se limpió el clúster.\n`,
      );
      process.exitCode = signalExitCode(signalState.signal);
      return { interrupted: signalState.signal };
    }
    process.stderr.write(
      `${safeErrorMessage(error, secrets)}\n`,
    );
    process.stderr.write(
      `${JSON.stringify({
        status: "failed",
        mode: options.lifecycleOnly
          ? "lifecycle-only"
          : selectedSuite.id === "prepare-smoke"
            ? "prepare+smoke"
            : "prepare+reviewed-suite+smoke",
        suite: selectedSuite.id,
        blockedRemaining: policy.blockedCount,
        blockedSuites: policy.blockedSuites.map(({ id }) => id),
      })}\n`,
    );
    process.exitCode = 1;
    return { passed: false, error };
  } finally {
    removeSignalHandlers();
    try {
      await runner.cleanup();
    } catch (cleanupError) {
      process.stderr.write(
        `${safeErrorMessage(cleanupError, secrets)}\n`,
      );
      process.exitCode = 1;
    }
    if (signalState.cleanupError) {
      process.stderr.write(
        `${safeErrorMessage(signalState.cleanupError, secrets)}\n`,
      );
      process.exitCode = 1;
    }
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runIsolatedTests().catch((error) => {
    process.stderr.write(`${safeErrorMessage(error, [process.env.DATABASE_URL])}\n`);
    process.exitCode = 1;
  });
}
