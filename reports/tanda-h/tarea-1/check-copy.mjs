import fs from "node:fs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(path.resolve("lib/db/package.json"));
const { Client } = require("pg");
assert.equal(process.env.MAIN_READY, "yes");
const config = JSON.parse(fs.readFileSync(".local/tanda-h/worker-databases.json", "utf8")).inventory;
const url = new URL(config.url);
assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, "55444");
assert.equal(url.pathname, "/tanda_h_inventory");
const c = new Client({ connectionString: config.url });
await c.connect();
const name = "rollos_physical_quantity_nonnegative_check";
const ddl = fs.readFileSync("reports/tanda-h/tarea-1/apply-physical-check.sql", "utf8");
const fixture = JSON.parse(fs.readFileSync("reports/tanda-h/setup/fixture-manifest-redacted.json", "utf8"));
const results = [];
const add = `ALTER TABLE public.rollos ADD CONSTRAINT ${name} CHECK (cantidad_actual >= 0 AND cantidad_actual <> 'NaN'::numeric)`;
const check = async (label, fn) => { await fn(); results.push({ label, pass: true }); };
const snapshot = async () => (await c.query("select md5(coalesce(string_agg(row_to_json(r)::text,',' order by id),'')) hash,count(*) count from public.rollos r")).rows[0];
const rollback = async (fn) => { await c.query("BEGIN"); try { await fn(); } finally { await c.query("ROLLBACK"); } };
try {
  const identity = (await c.query("select current_database() db,current_user actor,inet_server_port() port")).rows[0];
  assert.deepEqual(identity, { db: "tanda_h_inventory", actor: "h_inventory", port: 55444 });
  assert.equal((await c.query("select 1 from pg_constraint where conrelid='public.rollos'::regclass and conname=$1",[name])).rowCount, 0);
  const before = await snapshot();
  const roll = (await c.query("select id from public.rollos order by id limit 1")).rows[0];
  for (const quantity of ["-2", "NaN"]) {
    await check(`existing ${quantity}: validated ADD fails 23514`, () => rollback(async () => {
      await c.query("update public.rollos set cantidad_actual=$1 where id=$2", [quantity, roll.id]);
      await assert.rejects(c.query(add), e => e.code === "23514");
    }));
    await check(`operator preflight rejects existing ${quantity}`, async () => {
      await c.query("BEGIN");
      try {
        await c.query("update public.rollos set cantidad_actual=$1 where id=$2", [quantity, roll.id]);
        await assert.rejects(c.query(ddl), e => e.code === "P0001" && /Invalid existing/.test(e.message));
      } finally { await c.query("ROLLBACK"); }
    });
  }
  await check("operator adds validated reinforced CHECK", () => c.query(ddl));
  await check("operator exact catalog idempotence", () => c.query(ddl));
  const catalog = (await c.query("select conname,convalidated,pg_get_constraintdef(oid) definition from pg_constraint where conrelid='public.rollos'::regclass and conname=$1", [name])).rows[0];
  assert.equal(catalog.convalidated, true);
  for (const unit of ["METRO", "KILO", "PIEZA", "BOLSA"]) {
    const product = fixture.products.find(p => p.unidad === unit);
    const original = (await c.query("select id from public.rollos where producto_id=$1 order by id limit 1", [product.id])).rows[0];
    assert.ok(original);
    for (const operation of ["INSERT", "UPDATE"]) for (const quantity of ["-2", "NaN", "0", "2", "Infinity", "-Infinity"]) {
      await check(`${unit} ${operation} ${quantity}`, () => rollback(async () => {
        const statement = operation === "UPDATE"
          ? c.query("update public.rollos set cantidad_actual=$1 where id=$2 returning cantidad_actual", [quantity, original.id])
          : c.query("insert into public.rollos (serie,producto_id,ubicacion_id,estado,cantidad_inicial,cantidad_actual,costo_unitario,costo_total) values ($1,$2,$3,'DISPONIBLE',2,$4,100,200) returning cantidad_actual", [`tanda-h-check-${unit}-${quantity}`, product.id, fixture.sites[0].id, quantity]);
        if (["-2", "NaN"].includes(quantity)) await assert.rejects(statement, e => e.code === "23514" && e.constraint === name);
        else if (quantity.includes("Infinity")) await assert.rejects(statement, e => e.code === "22003");
        else assert.equal(Number((await statement).rows[0].cantidad_actual), Number(quantity));
      }));
    }
  }
  await check("operator refuses same-name weaker CHECK", () => rollback(async () => {
    await c.query(`ALTER TABLE public.rollos DROP CONSTRAINT ${name}`);
    await c.query(`ALTER TABLE public.rollos ADD CONSTRAINT ${name} CHECK (cantidad_actual >= 0)`);
    await assert.rejects(c.query(ddl), e => e.code === "P0001" && /catalog drift/.test(e.message));
  }));
  await check("operator refuses same-name unvalidated CHECK", () => rollback(async () => {
    await c.query(`ALTER TABLE public.rollos DROP CONSTRAINT ${name}`);
    await c.query(`${add} NOT VALID`);
    await assert.rejects(c.query(ddl), e => e.code === "P0001" && /catalog drift/.test(e.message));
  }));
  const after = await snapshot();
  assert.deepEqual(after, before);
  fs.writeFileSync("reports/tanda-h/tarea-1/check-copy.json", JSON.stringify({ identity, before, after, catalog, results, sequenceCaveat: "Rollback preserves rows, not nextval increments in the disposable copy." }, null, 2));
  console.log(JSON.stringify({ cases: results.length, passed: results.length, catalog }));
} finally { await c.end(); }