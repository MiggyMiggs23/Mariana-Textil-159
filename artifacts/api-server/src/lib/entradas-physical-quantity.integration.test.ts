import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { crearEntrada, InventarioError } from "./inventario";

// Dedicated real-copy suite: never resolves an ambient application database.
assert.equal(process.env.MAIN_READY, "yes");
const identity = (await pool.query("select current_database() db, current_user actor, inet_server_port() port")).rows[0];
assert.deepEqual(identity, { db: "tanda_h_inventory", actor: "h_inventory", port: 55444 });
const guards = (await pool.query("select conname,pg_get_constraintdef(oid) definition from pg_constraint where conrelid='public.rollos'::regclass and contype='c'")).rows;
assert.equal(guards.length, 0, "Producer regression must run without physical CHECK assistance");
const fixture = JSON.parse(fs.readFileSync("reports/tanda-h/setup/fixture-manifest-redacted.json", "utf8"));
const site = fixture.sites[0].id;
const floor = (await pool.query("select id from public.pisos where ubicacion_id=$1 and activo order by id limit 1", [site])).rows[0]?.id ?? null;
const rollback = new Error("intentional rollback");
const results: object[] = [];
let failed = 0;
try {
  for (const unit of ["METRO", "KILO", "PIEZA", "BOLSA"]) {
    const product = fixture.products.find((p: { unidad: string }) => p.unidad === unit);
    for (const quantity of ["-2", "-0.001", "NaN", "Infinity", "-Infinity", "invalid", "", "0", "-0", "2", "1.5"]) {
      const uuid = randomUUID();
      let accepted = false;
      let error: unknown;
      let persisted: string | undefined;
      try {
        await db.transaction(async (tx) => {
          const entry = await crearEntrada(tx, {
            ubicacionId: site, usuarioId: fixture.actors.admin.id, uuidCliente: uuid,
            lineas: [{ productoId: product.id, costoUnitario: "100", cantidades: [quantity], pisosPorCantidad: [floor] }],
          });
          accepted = true;
          const row = await tx.execute(sql`select cantidad_actual from public.rollos where id=${entry.rollos[0]!.id}`);
          persisted = row.rows[0]!.cantidad_actual as string;
          throw rollback;
        });
      } catch (e) { if (e !== rollback) error = e; }
      const invalid = !["0", "-0", "2", "1.5"].includes(quantity);
      const fractionalDiscrete = quantity === "1.5" && ["PIEZA", "BOLSA"].includes(unit);
      const pass = invalid
        ? !accepted && error instanceof InventarioError && error.code === "INVALID_PHYSICAL_QUANTITY"
        : fractionalDiscrete
          ? !accepted && error instanceof InventarioError && error.code === `${unit}_INTEGER_QUANTITY_REQUIRED`
          : accepted && Number(persisted) === Number(quantity);
      if (!pass) failed++;
      assert.equal((await pool.query("select id from public.entradas where uuid_cliente=$1", [uuid])).rowCount, 0);
      results.push({ unit, quantity, accepted, persisted, pass, error: error instanceof Error ? { name: error.name, message: error.message, code: (error as InventarioError).code } : undefined });
    }
  }
  const output = process.env.ENTRADAS_RESULT;
  assert.ok(output);
  fs.writeFileSync(output, JSON.stringify({ identity, guards, results, failed }, null, 2));
  console.log(JSON.stringify({ cases: results.length, failed }));
  assert.equal(failed, 0, "Physical quantities must be rejected explicitly by crearEntrada, not by PostgreSQL");
} finally { await pool.end(); }