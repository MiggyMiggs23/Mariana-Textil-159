import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256, readCustomers } from "./workbook.mjs";

export const expectedFile = "847e6e3305e66508bf7c5eefce1b73d107364e4ccd3d78852961a86f72fbed50";
const quote = name => `"${name.replaceAll('"', '""')}"`;
export async function snapshot(client, excludeCustomerIds = []) {
  const names = (await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)).rows.map(r => r.tablename);
  const result = {};
  for (const name of names) {
    const filter = name === "clientes" ? " WHERE NOT (id=ANY($1::integer[]))" : "";
    const row = (await client.query(`SELECT count(*)::int AS count,encode(digest(COALESCE(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),''),'sha256'),'hex') AS hash
      FROM public.${quote(name)} t${filter}`, name === "clientes" ? [excludeCustomerIds] : [])).rows[0];
    result[name] = row;
  }
  return result;
}

export async function importCustomers(client, { commit = false, forceFailure = false } = {}) {
  const { records, summary } = await readCustomers();
  assert.equal(summary.fileSha256, expectedFile, "Source workbook changed");
  assert.equal(summary.total, 2575);
  assert.equal(summary.withRFC, 2277); assert.equal(summary.withAddress, 2007); assert.equal(summary.withPhone, 1924);
  assert.equal(summary.genericRFC, 7); assert.equal(summary.duplicateNameRows.length, 0);
  const auth = await readFile(new URL("./autorizacion-propietario.txt", import.meta.url), "utf8");
  assert.equal(auth.trim(), "autorizo cargar estos 2,575 clientes en la base de la aplicación, con límite de crédito de $150,000 pesos cada uno, una sola vez, después de tu prueba en base desechable. No borres ni modifiques ningún otro dato.");
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL lock_timeout='10s'");
    await client.query("SET LOCAL statement_timeout='60s'");
    await client.query("SELECT pg_advisory_xact_lock(9252026,2575)");
    // A single short transaction isolates hashes against concurrent writers.
    // It neither changes nor disables existing guards.
    const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
    await client.query(`LOCK TABLE ${tables.map(r => `public.${quote(r.tablename)}`).join(",")} IN SHARE ROW EXCLUSIVE MODE`);
    const columns = (await client.query(`SELECT column_name,character_maximum_length FROM information_schema.columns
      WHERE table_schema='public' AND table_name='clientes'`)).rows;
    for (const [field, length] of Object.entries(summary.lengths)) {
      const col = columns.find(c => c.column_name === field);
      assert.ok(col && (col.character_maximum_length == null || col.character_maximum_length >= length), `STOP: ${field} capacity`);
    }
    // The unique normalized-name index and this overlap gate reject full OR partial
    // re-imports, without storing new metadata in another application table.
    const overlap = (await client.query(`SELECT count(*)::int AS n FROM clientes
      WHERE lower(btrim(nombre))=ANY($1::text[])`, [records.map(r => r.nombre.trim().toLowerCase())])).rows[0].n;
    assert.equal(overlap, 0, "REIMPORT_OR_NAME_COLLISION: existing customer matches this file; nothing inserted");
    const before = await snapshot(client);
    const existingCustomerIds = (await client.query("SELECT id FROM clientes ORDER BY id")).rows.map(r => r.id);
    const result = await client.query(`INSERT INTO clientes
      (nombre,rfc,direccion_particular,telefono,limite_credito,dias_credito,correo,contacto_nombre,saldo_credito,activo,es_sistema)
      SELECT nombre,rfc,direccion_particular,telefono,150000.00,0,NULL,NULL,0.00,true,false
      FROM jsonb_to_recordset($1::jsonb) AS x(nombre text,rfc text,direccion_particular text,telefono text)
      RETURNING id,nombre,rfc,direccion_particular,telefono,limite_credito::text,dias_credito,correo,contacto_nombre,saldo_credito::text,activo,es_sistema`,
    [JSON.stringify(records)]);
    assert.equal(result.rowCount, 2575);
    const expected = records.map(({ row, ...r }) => ({ ...r, limite_credito: "150000.00", dias_credito: 0, correo: null,
      contacto_nombre: null, saldo_credito: "0.00", activo: true, es_sistema: false })).sort((a,b) => a.nombre.localeCompare(b.nombre));
    const actual = result.rows.map(({ id, ...r }) => r).sort((a,b) => a.nombre.localeCompare(b.nombre));
    assert.deepEqual(actual, expected);
    await client.query("SET CONSTRAINTS ALL IMMEDIATE");
    if (forceFailure) throw new Error("FORCED_LATE_FAILURE");
    const ids = result.rows.map(r => r.id);
    assert.deepEqual(await snapshot(client, ids), before, "An existing row or another table changed");
    assert.deepEqual((await client.query("SELECT id FROM clientes WHERE NOT (id=ANY($1::integer[])) ORDER BY id", [ids])).rows.map(r => r.id), existingCustomerIds);
    await client.query(commit ? "COMMIT" : "ROLLBACK");
    return { committed: commit, ...summary, inserted: commit ? ids.length : 0, validated: ids.length, excluded: [],
      ids: commit ? ids : [], before, existingRowsAndAllOtherTablesUnchanged: true, customerValuesSha256: sha256(JSON.stringify(actual)) };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
}