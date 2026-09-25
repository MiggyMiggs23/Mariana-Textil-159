import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import pg from "../../artifacts/api-server/node_modules/pg/lib/index.js";
import { importCustomers, snapshot } from "./importer.mjs";
import { readCustomers, sha256 } from "./workbook.mjs";
const root = await mkdtemp(join(tmpdir(), "customer-import-disposable-"));
const data = join(root, "data");
let pool, started = false;
try {
  execFileSync("initdb", ["-D", data, "-A", "trust", "-U", "import_tester"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", data, "-l", join(root, "pg.log"), "-o", `-k ${root} -h '' -p 25449`, "-w", "start"], { stdio: "pipe" });
  started = true;
  // Explicit private Unix socket: application DATABASE_URL and PG* cannot select
  // this connection. Schema only, never application rows or accounts.
  pool = new pg.Pool({ host: root, port: 25449, user: "import_tester", database: "postgres" });
  const schemaBytes = await readFile(new URL("./schema-only.sql", import.meta.url));
  await pool.query(schemaBytes.toString().replace(/^\\.*$/gm, ""));
  await pool.query("SET search_path=public,pg_catalog");
  await pool.query("INSERT INTO clientes(nombre,es_sistema) VALUES('Cliente interno sintético',true)");
  await pool.query("INSERT INTO proveedores(nombre,tipo) VALUES('Proveedor de prueba preservado','NACIONAL')");
  const client = await pool.connect();
  try {
    const before = await snapshot(client);
    await assert.rejects(importCustomers(client, { commit: true, forceFailure: true }), /FORCED_LATE_FAILURE/);
    assert.deepEqual(await snapshot(client), before, "Late rollback changed existing data");
    const result = await importCustomers(client, { commit: true });
    assert.equal(result.inserted, 2575);
    const after = await snapshot(client);
    const finance = (await client.query(`SELECT count(*)::int AS total,
      count(*) FILTER(WHERE rfc IS NOT NULL)::int AS with_rfc,
      count(*) FILTER(WHERE direccion_particular IS NOT NULL)::int AS with_address,
      count(*) FILTER(WHERE telefono IS NOT NULL)::int AS with_phone,
      count(*) FILTER(WHERE rfc='XAXX010101000')::int AS generic_rfc,
      count(*) FILTER(WHERE limite_credito<>150000 OR dias_credito<>0 OR saldo_credito<>0
        OR correo IS NOT NULL OR contacto_nombre IS NOT NULL OR direccion_entrega IS NOT NULL)::int AS invalid_defaults,
      max(char_length(nombre))::int AS longest_name
      FROM clientes WHERE NOT es_sistema`)).rows[0];
    assert.deepEqual(finance, { total: 2575, with_rfc: 2277, with_address: 2007, with_phone: 1924, generic_rfc: 7, invalid_defaults: 0, longest_name: 97 });
    await assert.rejects(importCustomers(client, { commit: true }), /REIMPORT_OR_NAME_COLLISION/);
    assert.deepEqual(await snapshot(client), after, "Retry changed committed data");
    const { summary } = await readCustomers();
    const sources = {};
    for (const file of ["workbook.mjs", "importer.mjs", "disposable-test.mjs", "autorizacion-propietario.txt"]) {
      sources[file] = sha256(await readFile(new URL(`./${file}`, import.meta.url)));
    }
    const report = { passed: true, createdAt: new Date().toISOString(), fileSha256: summary.fileSha256,
      payloadSha256: summary.payloadSha256, schemaSha256: sha256(schemaBytes), sourceHashes: sources,
      summary, finance, inserted: 2575, excluded: [], assertions: {
        fullEffectiveSchema: true, actual2575RowsCommittedInDisposable: true, exactEveryFieldCompared: true,
        onlyCustomerRowsAdded: true, everyOtherTableUnchanged: true, existingCustomerUnchanged: true,
        retryRejectedWithZeroChanges: true, lateFailureRolledBack: true, noAppWrites: true,
      }, schemaTables: Object.keys(before).length };
    await writeFile(new URL("./disposable-proof.json", import.meta.url), JSON.stringify(report, null, 2), { flag: "wx" });
    console.log(JSON.stringify({ PASS: true, ...finance, tablesUnchangedExceptCustomerInserts: Object.keys(before).length,
      retryRejected: true, lateFailureRollback: true, applicationDatabaseWrites: 0 }));
  } finally { client.release(); }
} finally {
  await pool?.end();
  if (started) execFileSync("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"], { stdio: "pipe" });
  await rm(root, { recursive: true, force: true });
}