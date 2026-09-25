import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import pg from "../../artifacts/api-server/node_modules/pg/lib/index.js";
import { readCustomers, sha256 } from "./workbook.mjs";
import { importCustomers } from "./importer.mjs";

// Default is genuinely READ ONLY: unlike an INSERT followed by ROLLBACK,
// this does not consume customer sequence values.
const apply = process.argv.includes("--apply");
if (process.argv.some(arg => arg.startsWith("--") && !["--apply", "--report-delivered"].includes(arg))) throw new Error("Unsupported flag");
if (apply && !process.argv.includes("--report-delivered")) throw new Error("MAIN must report the disposable result BEFORE authorizing application writes");
const proof = JSON.parse(await readFile(new URL("./disposable-proof.json", import.meta.url), "utf8"));
assert.equal(proof.passed, true);
assert.equal(proof.inserted, 2575);
for (const [name, expected] of Object.entries(proof.sourceHashes)) {
  assert.equal(sha256(await readFile(new URL(`./${name}`, import.meta.url))), expected, `Retest required: ${name} changed`);
}
const { records, summary } = await readCustomers();
assert.equal(summary.fileSha256, proof.fileSha256);
assert.equal(summary.payloadSha256, proof.payloadSha256);
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, options: "-c search_path=public,pg_catalog" });
try {
  await client.connect();
  await client.query("BEGIN READ ONLY");
  const existingMatches = (await client.query(`SELECT count(*)::int AS count FROM clientes WHERE lower(btrim(nombre))=ANY($1::text[])`,
    [records.map(r => r.nombre.trim().toLowerCase())])).rows[0].count;
  await client.query("COMMIT");
  assert.equal(existingMatches, 0, "Existing matching customers: reject full or partial re-import");
  if (!apply) {
    console.log(JSON.stringify({ mode: "READ_ONLY_CHECK", ready: true, applicationWrites: 0, ...summary }));
  } else {
    // A durable local claim is created BEFORE the DB transaction. Any interrupted
    // attempt is blocked on retry until explicitly reconciled against DB evidence.
    await writeFile(new URL("./apply-once.claim.json", import.meta.url), JSON.stringify({
      claimedAt: new Date().toISOString(), fileSha256: summary.fileSha256, payloadSha256: summary.payloadSha256,
      warning: "Do not retry automatically. Retain even after an error until database state is reconciled.",
    }, null, 2), { flag: "wx", mode: 0o600 });
    const result = await importCustomers(client, { commit: true });
    await writeFile(new URL("./application-result.json", import.meta.url), JSON.stringify(result, null, 2), { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify({ mode: "COMMITTED", inserted: result.inserted, withRFC: result.withRFC,
      withAddress: result.withAddress, withPhone: result.withPhone, genericRFC: result.genericRFC,
      excluded: result.excluded, existingRowsAndAllOtherTablesUnchanged: result.existingRowsAndAllOtherTablesUnchanged }));
  }
} catch (error) {
  console.error(JSON.stringify({ failed: true, code: error.code || "VALIDATION_OR_IO", applyRequested: apply,
    instruction: apply ? "Do not retry; reconcile the claim and database state." : "No application writes were attempted." }));
  process.exitCode = 1;
} finally { await client.end(); }