import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  DisposablePostgresRunner,
  assertRunnerEnvironment,
  createChildEnvironment,
  createLocalConnectionUrl,
  installSignalHandlers,
  parseRunnerArguments,
  redactSensitiveText,
} from "./run-isolated-tests.mjs";
import { getIsolatedTestPolicy } from "./isolated-test-policy.mjs";

const applicationUrl = "postgresql://application.example/inventory";
const safeEnvironment = {
  DATABASE_URL: applicationUrl,
  ADMIN_SEED_PASSWORD: "not-read-by-runner",
};

test("runner rejects every caller-provided TEST_DATABASE_URL", () => {
  assert.throws(
    () =>
      assertRunnerEnvironment({
        ...safeEnvironment,
        TEST_DATABASE_URL: "postgresql://external.example/fixture",
      }),
    /TEST_DATABASE_URL no puede proporcionarse/,
  );
});

test("runner requires an explicit application URL and never falls back to PGHOST", () => {
  assert.throws(
    () =>
      assertRunnerEnvironment({
        ADMIN_SEED_PASSWORD: "present",
        PGHOST: "external.example",
      }),
    /DATABASE_URL debe ser una URL PostgreSQL explícita/,
  );
  assert.throws(
    () =>
      assertRunnerEnvironment({
        ...safeEnvironment,
        DATABASE_URL: "postgresql:///database-from-pghost",
      }),
    /host explícito/,
  );
});

test("child environment strips all libpq overrides and leaves parent unchanged", () => {
  const parent = {
    ...safeEnvironment,
    PGHOST: "unsafe.example",
    PGPORT: "5432",
    PGPASSWORD: "parent-secret",
    PGOPTIONS: "-c statement_timeout=0",
    TEST_DATABASE_URL: undefined,
  };
  const generated = createLocalConnectionUrl({
    socketDirectory: "/tmp/private-test-socket",
    port: 45_123,
    username: "isolated_user",
    password: "generated-password",
    database: "isolated_database",
  });
  const child = createChildEnvironment(parent, {
    applicationUrl,
    testDatabaseUrl: generated,
  });
  assert.equal(child.DATABASE_URL, applicationUrl);
  assert.equal(child.TEST_DATABASE_URL, generated);
  assert.equal(child.APPLICATION_DATABASE_URL, applicationUrl);
  assert.equal(child.NODE_ENV, "test");
  assert.equal(child.PGHOST, undefined);
  assert.equal(child.PGOPTIONS, undefined);
  assert.equal(child.PGPASSWORD, undefined);
  assert.equal(parent.TEST_DATABASE_URL, undefined);
  assert.equal(parent.PGHOST, "unsafe.example");
});

test("generated URL uses the private Unix socket and redaction removes credentials", () => {
  const url = createLocalConnectionUrl({
    socketDirectory: "/tmp/private-test-socket",
    port: 45_123,
    username: "isolated_user",
    password: "generated-password",
    database: "isolated_database",
  });
  assert.match(url, /%2Ftmp%2Fprivate-test-socket/);
  assert.match(url, /port=45123/);
  assert.equal(
    redactSensitiveText(`connection=${url}`, [url]),
    "connection=[redacted]",
  );
});

test("policy allows only prepare-smoke and one audited schema suite", () => {
  const policy = getIsolatedTestPolicy();
  assert.equal(policy.default, "prepare-smoke");
  assert.deepEqual(
    parseRunnerArguments(["--suite", "prepare-smoke"]).suite,
    "prepare-smoke",
  );
  assert.ok(
    policy.allowedSuites.some(
      (suite) => suite.id === "api-script:test:ticket-iva-schema",
    ),
  );
  assert.ok(
    policy.reviewedSources.some(
      (source) =>
        source.id ===
        "api-file:artifacts/api-server/src/lib/ticket-iva-schema.test.ts",
    ),
  );
  assert.ok(policy.blockedCount > 0);
  assert.ok(
    policy.blockedSuites.every((suite) => suite.status === "blocked"),
  );
  assert.ok(
    policy.blockedSuites.some(
      (suite) => suite.kind === "alias" && suite.databaseRequired === "unknown",
    ),
  );
  assert.ok(
    policy.blockedSuites.some(
      (suite) =>
        suite.kind === "file" &&
        suite.databaseRequired === "unknown" &&
        suite.databaseEvidence.includes("not audited"),
    ),
  );
});

test("signal handler awaits cleanup and does not expose a connection URL", async () => {
  let cleaned = 0;
  const signalState = {
    signal: undefined,
    promise: undefined,
    resolve: undefined,
    cleanupError: undefined,
  };
  const removeHandlers = installSignalHandlers(async () => {
    cleaned += 1;
  }, signalState);
  try {
    process.emit("SIGTERM");
    await new Promise((resolve) => setImmediate(resolve));
    await signalState.promise;
    assert.equal(signalState.signal, "SIGTERM");
    assert.equal(cleaned, 1);
  } finally {
    removeHandlers();
  }
});

const runRealLifecycleTests =
  process.env.RUN_LOCAL_POSTGRES_LIFECYCLE_TESTS === "1" &&
  Boolean(process.env.DATABASE_URL && process.env.ADMIN_SEED_PASSWORD) &&
  ["initdb", "pg_ctl", "postgres"].every((binary) => {
    return (
      spawnSync("sh", ["-c", `command -v ${binary}`], {
        stdio: "ignore",
      }).status === 0
    );
  });

test(
  "real disposable runner starts, verifies identity, and cleans up on success",
  { skip: !runRealLifecycleTests },
  async () => {
    const runner = new DisposablePostgresRunner({
      parentEnvironment: { ...process.env, ...safeEnvironment },
    });
    let root;
    try {
      await runner.start();
      root = runner.cluster.rootDirectory;
      await runner.verifyIdentity();
    } finally {
      await runner.cleanup();
    }
    assert.equal(existsSync(root), false);
  },
);

test(
  "real disposable runner cleans up after an induced failure",
  { skip: !runRealLifecycleTests },
  async () => {
    const runner = new DisposablePostgresRunner({
      parentEnvironment: { ...process.env, ...safeEnvironment },
    });
    let root;
    try {
      await runner.start();
      root = runner.cluster.rootDirectory;
      await assert.rejects(
        Promise.reject(new Error("induced lifecycle failure")),
        /induced lifecycle failure/,
      );
    } finally {
      await runner.cleanup();
    }
    assert.equal(existsSync(root), false);
  },
);

test(
  "real disposable runners can bootstrap concurrently and both tear down",
  { skip: !runRealLifecycleTests },
  async () => {
    const runners = [
      new DisposablePostgresRunner({
        parentEnvironment: { ...process.env, ...safeEnvironment },
      }),
      new DisposablePostgresRunner({
        parentEnvironment: { ...process.env, ...safeEnvironment },
      }),
    ];
    const roots = [];
    try {
      await Promise.all(runners.map((runner) => runner.start()));
      roots.push(...runners.map((runner) => runner.cluster.rootDirectory));
      await Promise.all(runners.map((runner) => runner.verifyIdentity()));
    } finally {
      await Promise.all(runners.map((runner) => runner.cleanup()));
    }
    assert.ok(roots.every((root) => existsSync(root) === false));
  },
);

test(
  "real runner catches an OS SIGTERM during minimal bootstrap with exit 143",
  { skip: !runRealLifecycleTests },
  async () => {
    const runnerScript = fileURLToPath(
      new URL("./run-isolated-tests.mjs", import.meta.url),
    );
    const childEnvironment = {
      ...process.env,
      ...safeEnvironment,
    };
    delete childEnvironment.TEST_DATABASE_URL;
    const child = spawn(
      process.execPath,
      [runnerScript, "--lifecycle-only", "--hold-for-signal"],
      {
        cwd: process.cwd(),
        env: childEnvironment,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    try {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const roots = readdirSync("/tmp").filter((entry) =>
          entry.startsWith("workspace-isolated-pg-"),
        );
        if (roots.length > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      child.kill("SIGTERM");
      const exitCode = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code) => resolve(code));
      });
      assert.equal(exitCode, 143);
      assert.match(stderr, /Runner interrumpido por SIGTERM/);
      assert.doesNotMatch(`${stdout}\n${stderr}`, /postgres(?:ql)?:\/\//);
    } finally {
      if (!child.killed) child.kill("SIGTERM");
    }
    assert.equal(
      readdirSync("/tmp").some((entry) =>
        entry.startsWith("workspace-isolated-pg-"),
      ),
      false,
    );
  },
);

test(
  "real runner tears down after a genuine preparation child failure",
  { skip: !runRealLifecycleTests },
  async () => {
    const missingPnpmPath = mkdtempSync(join(tmpdir(), "isolated-no-pnpm-"));
    for (const binary of ["initdb", "pg_ctl", "postgres", "createdb"]) {
      const location = spawnSync("sh", ["-c", `command -v ${binary}`], {
        encoding: "utf8",
      }).stdout.trim();
      symlinkSync(location, join(missingPnpmPath, binary));
    }
    const runnerScript = fileURLToPath(
      new URL("./run-isolated-tests.mjs", import.meta.url),
    );
    const childEnvironment = {
      ...process.env,
      PATH: missingPnpmPath,
    };
    delete childEnvironment.TEST_DATABASE_URL;
    const child = spawn(process.execPath, [runnerScript], {
      cwd: process.cwd(),
      env: childEnvironment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    try {
      const exitCode = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code) => resolve(code));
      });
      assert.equal(exitCode, 1);
      assert.match(stderr, /spawn pnpm ENOENT/);
      assert.doesNotMatch(`${stdout}\n${stderr}`, /postgres(?:ql)?:\/\//);
    } finally {
      rmSync(missingPnpmPath, { recursive: true, force: true });
    }
    assert.equal(
      readdirSync("/tmp").some((entry) =>
        entry.startsWith("workspace-isolated-pg-"),
      ),
      false,
    );
  },
);
