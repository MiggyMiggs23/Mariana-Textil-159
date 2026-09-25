import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { DisposablePostgresRunner } from "../../../lib/db/src/run-isolated-tests.mjs";
import { prepareTestDatabase } from "../../../lib/db/src/prepare-test-database.mjs";
import { baselineE1E2 } from "./baseline-e1-e2.mjs";
const require = createRequire(resolve("lib/db/package.json"));
const { Client } = require("pg");
const environment = { PATH: process.env.PATH, HOME: process.env.HOME, LANG: "C.UTF-8" };
const runner = new DisposablePostgresRunner({ parentEnvironment: environment, actorMode: true });
let root;
try {
  await runner.start();
  root = runner.cluster.rootDirectory;
  await runner.verifyIdentity();
  await prepareTestDatabase({ environment: runner.childEnvironment() });
  await runner.verifyIdentity();
  const client = new Client({ connectionString: runner.testDatabaseUrl });
  await client.connect();
  try {
    assert.equal((await client.query("SELECT count(*)::int n FROM usuarios WHERE rol='ADMIN'")).rows[0].n, 1);
    await client.query("ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS e2_insert_xid xid8; ALTER TABLE cobros_credito_pendientes_e1 ADD COLUMN IF NOT EXISTS e2_insert_xid xid8");
    await client.query(baselineE1E2());
    for (const file of [
      "reports/e3-apertura-preparada-20260922/sql/01-install-prepared.sql",
      "reports/e3-apertura-preparada-20260922/sql/03-prepare-ordinary-cash-gate-retirement.REHEARSAL-ONLY.sql",
      ...[1, 2, 3, 4].map(n => `reports/tanda-b-b0-b1-20260923/r5/sql/${n}.sql`),
      "reports/trabajo-nocturno-20260925/tarea-2/historical-pre-e11-graph.sql",
      "reports/e11/01-preparado.sql",
      "reports/trabajo-nocturno-20260925/tarea-1/installed-graph-readonly.sql",
      "reports/trabajo-nocturno-20260925/tarea-1/01-candidate-not-approved.sql",
      "reports/trabajo-nocturno-20260925/tarea-2/00-graph-correction-candidate.sql",
      "reports/trabajo-nocturno-20260925/tarea-2/00b-fiscal-folio-correction-candidate.sql",
      "reports/trabajo-nocturno-20260925/tarea-2/01-candidate-not-approved.sql",
    ]) {
      let text = readFileSync(file, "utf8").replace(/^\\set ON_ERROR_STOP on\r?\n/, "");
      if (file.endsWith("/01-install-prepared.sql"))
        text = "BEGIN;\n" + text.slice(text.indexOf("CREATE FUNCTION public.e3_receipt_immutable()"));
      await client.query(text);
    }
  } finally { await client.end(); }
  const code = await new Promise((resolveStatus, reject) => {
    const child = spawn("artifacts/api-server/node_modules/.bin/tsx",
      ["reports/trabajo-nocturno-20260925/tarea-1/positive-producers.mts"], {
        env: { ...runner.childEnvironment(), TEST_DATABASE_PREPARATION_PHASE: "initializers" },
        stdio: "inherit",
      });
    child.once("error", reject);
    child.once("close", resolveStatus);
  });
  assert.equal(code, 0);
} finally {
  await runner.cleanup();
  if (root) assert.equal(existsSync(root), false);
  console.log("OWNED_FINANCIAL_DISPOSABLE_DESTROYED");
}