import fs from "node:fs";
import pg from "../../../lib/db/node_modules/pg/lib/index.js";
const report = "reports/print-corrections-20260926/infra";
const privateFile = "/tmp/print-corrections-20260926/print_corrections_20260926/test-env.json";
const url = new URL(JSON.parse(fs.readFileSync(privateFile)).TEST_DATABASE_URL);
if (url.pathname !== "/print_corrections_20260926" || !url.hostname.endsWith(".neon.tech"))
  throw Error("Isolated copy required");
const c = new pg.Client({ connectionString: url.href, options: "-c default_transaction_read_only=on" });
await c.connect();
try {
  await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const source = (await c.query("SELECT current_database() database,current_setting('transaction_read_only') readonly")).rows[0];
  const products = (await c.query("SELECT id,sku,tela,color,unidad FROM productos ORDER BY id")).rows;
  const rolls = (await c.query(`SELECT r.id rollo_id,r.producto_id,r.serie,
    e.id entrada_id,r.ubicacion_id,r.piso_id,r.estado
    FROM rollos r LEFT JOIN entradas e ON e.id=r.recepcion_id ORDER BY r.producto_id,r.id`)).rows;
  const at = new Date().toISOString();
  fs.writeFileSync(`${report}/catalog-full.json`, JSON.stringify({
    at, source, count: products.length, products,
    provenance: "Read-only current isolated copy of captured authoritative application snapshot; all product rows without active filter",
  }, null, 2));
  fs.writeFileSync(`${report}/rollreferences.json`, JSON.stringify({
    at, source, count: rolls.length, rolls,
    policy: "Existing inventory identifiers/state only; entrada_id resolved by actual entradas join, null if absent. Native UI/API determines action eligibility. No customer/supplier data, costs, quantities, or secrets.",
  }, null, 2));
  await c.query("ROLLBACK");
  console.log(JSON.stringify({ source, products: products.length, rolls: rolls.length,
    rollsWithEntrada: rolls.filter(r => r.entrada_id !== null).length }));
} finally { await c.end(); }