import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import pg from "../../artifacts/api-server/node_modules/pg/lib/index.js";
import { readCustomers, sha256 } from "./workbook.mjs";

const result = JSON.parse(await readFile(new URL("./application-result.json", import.meta.url), "utf8"));
const { records, summary } = await readCustomers();
assert.equal(result.committed, true);
assert.equal(result.fileSha256, summary.fileSha256);
assert.equal(result.payloadSha256, summary.payloadSha256);
assert.equal(new Set(result.ids).size, 2575);
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  assert.equal((await client.query("SHOW transaction_read_only")).rows[0].transaction_read_only, "on");
  const actual = (await client.query(`SELECT nombre,rfc,direccion_particular,telefono,limite_credito::text,dias_credito,
    correo,contacto_nombre,saldo_credito::text,activo,es_sistema FROM public.clientes
    WHERE id=ANY($1::integer[])`, [result.ids])).rows.sort((a,b) => a.nombre.localeCompare(b.nombre));
  const expected = records.map(({ row, ...r }) => ({ ...r, limite_credito: "150000.00", dias_credito: 0,
    correo: null, contacto_nombre: null, saldo_credito: "0.00", activo: true, es_sistema: false }))
    .sort((a,b) => a.nombre.localeCompare(b.nombre));
  assert.deepEqual(actual, expected, "Committed rows do not exactly match source and authorized defaults");
  assert.equal(sha256(JSON.stringify(actual)), result.customerValuesSha256);
  const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
  assert.deepEqual(tables.map(r => r.tablename), Object.keys(result.before).sort());
  const current = {};
  for (const { tablename: name } of tables) {
    const quoted = `"${name.replaceAll('"', '""')}"`;
    const where = name === "clientes" ? " WHERE NOT (id=ANY($1::integer[]))" : "";
    current[name] = (await client.query(`SELECT count(*)::int AS count,
      encode(digest(COALESCE(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),''),'sha256'),'hex') AS hash
      FROM public.${quoted} t${where}`, name === "clientes" ? [result.ids] : [])).rows[0];
  }
  assert.deepEqual(current, result.before, "Existing customer or another table differs from pre-import evidence");
  const totals = (await client.query(`SELECT count(*)::int AS total,
    count(*) FILTER(WHERE es_sistema)::int AS system_customers,
    count(*) FILTER(WHERE NOT es_sistema)::int AS non_system_customers FROM public.clientes`)).rows[0];
  assert.deepEqual(totals, { total: 2576, system_customers: 1, non_system_customers: 2575 });
  await client.query("COMMIT");
  const proof = { passed: true, capturedAt: new Date().toISOString(), transactionReadOnly: true,
    applicationWrites: 0, fileSha256: summary.fileSha256, payloadSha256: summary.payloadSha256,
    exactSourceAndDefaultsCompared: actual.length, importedIds: result.ids.length, totals,
    originalCustomerPreserved: true, all107OtherTablesUnchanged: true, all108HashesMatchAfterExcludingNewCustomers: true,
    summary, excluded: [], authorizationFile: "autorizacion-propietario.txt" };
  await writeFile(new URL("./postcommit-readonly-proof.json", import.meta.url), JSON.stringify(proof, null, 2), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ PASS: true, transactionReadOnly: true, exactRowsCompared: actual.length, totals,
    originalCustomerPreserved: true, otherTablesUnchanged: 107, applicationWrites: 0 }));
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(JSON.stringify({ passed: false, code: error.code || "VERIFICATION_FAILED", applicationWrites: 0 }));
  process.exitCode = 1;
} finally { await client.end(); }