import fs from "node:fs";
import pg from "../../../lib/db/node_modules/pg/lib/index.js";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, options: "-c default_transaction_read_only=on" });
await c.connect();
try {
  await c.query("BEGIN READ ONLY");
  const identity = (await c.query("SELECT current_database() database,current_setting('transaction_read_only') readonly")).rows[0];
  const catalog = (await c.query(`SELECT id,tela,color,activo,
    char_length(tela) tela_length,char_length(color) color_length,
    char_length(tela||' '||color) combined_length,
    row_number() OVER(ORDER BY char_length(tela||' '||color) DESC,id)::int length_rank
    FROM productos ORDER BY combined_length DESC,id`)).rows;
  const matches = catalog.filter(p => /GABARDINA\s+METEPEC/i.test(p.tela));
  const floors = (await c.query(`SELECT p.id piso_id,p.ubicacion_id,p.activo,u.activa ubicacion_activa
    FROM pisos p JOIN ubicaciones u ON u.id=p.ubicacion_id ORDER BY p.ubicacion_id,p.id`)).rows;
  fs.writeFileSync("reports/print-corrections-20260926/infra/reportcatalog.json", JSON.stringify({
    at: new Date().toISOString(), source: identity, productCount: catalog.length,
    longest: catalog.slice(0, 25), matches, floors,
    policy: "READ ONLY product names/colors/IDs/lengths and floor/location IDs only; no PII, prices, stock, secrets or business writes",
  }, null, 2));
  console.log(JSON.stringify({ products: catalog.length, longest: catalog.slice(0, 3), matchCount: matches.length, floors }));
  await c.query("ROLLBACK");
} finally { await c.end(); }