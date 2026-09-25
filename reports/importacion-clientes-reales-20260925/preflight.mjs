import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import pg from "../../artifacts/api-server/node_modules/pg/lib/index.js";
import { readCustomers } from "./workbook.mjs";
const { summary } = await readCustomers();
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const columns = (await client.query(`SELECT column_name,data_type,character_maximum_length,numeric_precision,numeric_scale,is_nullable,column_default
    FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' ORDER BY ordinal_position`)).rows;
  for (const [field, length] of Object.entries(summary.lengths)) {
    const column = columns.find(c => c.column_name === field);
    if (!column || column.character_maximum_length != null && column.character_maximum_length < length) throw new Error(`STOP: insufficient field capacity ${field}`);
  }
  const indexes = (await client.query("SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='clientes' ORDER BY indexname")).rows;
  const constraints = (await client.query("SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='public.clientes'::regclass ORDER BY conname")).rows;
  const triggers = (await client.query("SELECT tgname,pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE tgrelid='public.clientes'::regclass AND NOT tgisinternal ORDER BY tgname")).rows;
  const existing = (await client.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE NOT es_sistema)::int AS non_system FROM clientes")).rows[0];
  await client.query("COMMIT");
  const preflightText = JSON.stringify({ ...summary, columns, indexes, constraints, triggers, existing }, null, 2);
  try { await writeFile(new URL("./preflight.json", import.meta.url), preflightText, { flag: "wx" }); }
  catch (error) { if (error.code !== "EEXIST" || await readFile(new URL("./preflight.json", import.meta.url), "utf8") !== preflightText) throw error; }
  const url = new URL(process.env.DATABASE_URL);
  const schema = execFileSync("pg_dump", ["--schema-only", "--no-owner", "--no-privileges"], {
    env: { ...process.env, PGHOST: url.hostname, PGPORT: url.port || "5432", PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
      PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
      PGSSLMODE: url.searchParams.get("sslmode") || "prefer", PGCONNECT_TIMEOUT: "20", PGOPTIONS: "-c default_transaction_read_only=on" },
    maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
  });
  await writeFile(new URL("./schema-only.sql", import.meta.url), schema, { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ total: summary.total, withRFC: summary.withRFC, withAddress: summary.withAddress, withPhone: summary.withPhone,
    corrections: summary.corrections, genericRFC: summary.genericRFC, maxName: summary.lengths.nombre, existing }));
} catch (error) {
  console.error(error.message?.startsWith("STOP:") ? error.message : "Read-only preflight failed; no application mutation was executed.");
  process.exitCode = 1;
} finally { await client.end(); }