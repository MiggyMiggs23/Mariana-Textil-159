import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { DisposablePostgresRunner } from "../../../lib/db/src/run-isolated-tests.mjs";
const require = createRequire(resolve("lib/db/package.json"));
const { Client } = require("pg");
const environment = { ...process.env };
for (const key of Object.keys(environment)) {
  if (/^PG[A-Z0-9_]*$/i.test(key) || ["DATABASE_URL", "APPLICATION_DATABASE_URL", "TEST_DATABASE_URL"].includes(key))
    delete environment[key];
}
const runner = new DisposablePostgresRunner({ parentEnvironment: environment });
const e11 = process.argv.includes("--e11");
let root;
try {
  await runner.start();
  root = runner.cluster.rootDirectory;
  await runner.verifyIdentity();
  const client = new Client({ connectionString: runner.testDatabaseUrl });
  await client.connect();
  try {
    // Schema-only snapshot: no application users, sessions, seed substitutions or financial fixtures.
    for (const file of [
      "reports/liberacion-simple-20260923/fixture.sql",
      "reports/e3-apertura-preparada-20260922/sql/01-install-prepared.sql",
      "reports/e3-apertura-preparada-20260922/sql/03-prepare-ordinary-cash-gate-retirement.REHEARSAL-ONLY.sql",
      ...[1, 2, 3, 4].map(n => `reports/tanda-b-b0-b1-20260923/r5/sql/${n}.sql`),
      ...(e11 ? ["reports/trabajo-nocturno-20260925/tarea-2/historical-pre-e11-graph.sql"] : []),
      ...(e11 ? ["reports/tanda-b-b0-b1-20260923/r5/sql/5.sql"] : []),
      "reports/trabajo-nocturno-20260925/tarea-1/installed-graph-readonly.sql",
      "reports/trabajo-nocturno-20260925/tarea-1/01-candidate-not-approved.sql",
    ]) {
      await client.query(readFileSync(file, "utf8").replace(/^\\set ON_ERROR_STOP on\r?\n/, ""));
    }
    const closures = await client.query(`SELECT c.relname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      WHERE t.tgname='e5_closed' AND t.tgenabled='O' ORDER BY c.relname`);
    assert.deepEqual(closures.rows.map(row => row.relname), ["e5_devoluciones", "e5_salidas_bancarias"]);
    for (const table of ["e5_devoluciones", "e5_salidas_bancarias"]) {
      await assert.rejects(client.query(`INSERT INTO public.${table} DEFAULT VALUES`), /E5_DISABLED/);
    }
    assert.equal((await client.query("SELECT count(*)::int AS n FROM usuarios")).rows[0].n, 0);
    if (e11) {
      await client.query(readFileSync("reports/trabajo-nocturno-20260925/tarea-2/01-candidate-not-approved.sql", "utf8"));
      assert.equal((await client.query("SELECT count(*)::int AS n FROM pg_trigger WHERE tgname='e11_closed'")).rows[0].n, 0);
      assert.equal((await client.query("SELECT count(*)::int AS n FROM e11_perfiles")).rows[0].n, 0);
      console.log("E11_NARROW_SQL_SCHEMA_ONLY_PASS; no assignments; NOT_PROFILE_FLOW_VERIFICATION");
    }
    console.log("E5_NARROW_SQL_SCHEMA_ONLY_PASS; refund closures enforced; zero users");
    // Deliberate defect exists exclusively inside this disposable transaction.
    await client.query("BEGIN; DROP TRIGGER e5_closed ON public.e5_devoluciones");
    let defectDetected = false;
    try {
      await assert.rejects(client.query("INSERT INTO public.e5_devoluciones DEFAULT VALUES"), /E5_DISABLED/);
    } catch (error) {
      if (error.code !== "ERR_ASSERTION") throw error;
      defectDetected = true;
    } finally {
      await client.query("ROLLBACK");
    }
    assert.equal(defectDetected, true, "refund-closure mutant must fail the expected guard assertion");
    await assert.rejects(client.query("INSERT INTO public.e5_devoluciones DEFAULT VALUES"), /E5_DISABLED/);
    console.log("E5_REFUND_SQL_MUTANT_RED_AND_RESTORED_PASS");
  } finally {
    await client.end();
  }
} finally {
  await runner.cleanup();
  if (root) assert.equal(existsSync(root), false);
}
console.log("E5_DISPOSABLE_SCHEMA_CLUSTER_DESTROYED_PASS; NOT_FINANCIAL_FLOW_VERIFICATION");