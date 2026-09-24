import fs from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db, pool } from "@inventory-db";
import { crearRollo, crearEntrada, activarRollo, ajustarRollo } from "@inventory-engine";

// Build only with build.mjs; never loads ambient application DATABASE_URL.
const config = JSON.parse(fs.readFileSync(process.env.INVENTORY_HANDOFF!, "utf8"));
assert.equal(process.env.MAIN_READY, "yes", "MAIN readiness required");
assert.match(config.databaseName, /^tanda_ga_inventory(?:_[a-z0-9]+)*$/);
assert.equal(config.sourceIdentity, "currentsource61d-strict");
const identity = (await pool.query("select current_database() db,current_setting('data_directory') dir")).rows[0];
assert.equal(identity.db, config.databaseName);
assert.equal(identity.dir, config.dataDirectory);
const f = JSON.parse(fs.readFileSync(config.fixtureManifest, "utf8"));
assert.ok(f.sites.length >= 2);
const results: any[] = [];
const output = "reports/tanda-g-ampliada/tarea-2/results.json";
const save = () => fs.writeFileSync(output, JSON.stringify({ identity, sourceIdentity: config.sourceIdentity, results }, null, 2));
const constraint = "tanda_ga_t2_physical_nonnegative";
assert.equal((await pool.query("select 1 from pg_constraint where conname=$1", [constraint])).rowCount, 0);
const guards = (await pool.query("select conname,pg_get_constraintdef(oid) definition,convalidated from pg_constraint where conrelid in ('rollos'::regclass,'movimientos'::regclass,'existencias'::regclass)")).rows;
results.push({ type: "database-guards", guards });
let cookie: string | undefined;
if (config.apiOrigin) {
  const origin = new URL(config.apiOrigin);
  assert.equal(origin.hostname, "127.0.0.1");
  const env = fs.readFileSync(`/proc/${config.apiPid}/environ`, "utf8").split("\0");
  assert.ok(env.includes(`TEST_DATABASE_URL=${config.databaseUrl}`), "API DB identity mismatch");
  assert.ok(env.includes(`ISOLATED_API_MODULE=${config.apiModule}`), "API module identity mismatch");
  const credentials = JSON.parse(fs.readFileSync(config.credentialsFile, "utf8")).admin;
  const login = await fetch(`${origin}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ usuario: credentials.username, password: credentials.password }) });
  assert.ok(login.ok, "Isolated login failed");
  cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
}
const rollback = new Error("controlled rollback");
let ownConstraint = false;
try {
  // Constraint first: baseline API intentionally leaves corrupt fixtures as evidence.
  // Normal ADD scans existing rows; aborts rather than silently repairing any.
  for (const phase of ["check", "baseline"]) {
    if (phase === "check") {
      await pool.query(`ALTER TABLE rollos ADD CONSTRAINT ${constraint} CHECK (cantidad_actual >= 0)`);
      ownConstraint = true;
    }
    for (const site of f.sites.slice(0, 2)) for (const unit of ["METRO", "KILO", "PIEZA", "BOLSA"]) {
      const product = f.products.find((p: any) => p.unidad === unit);
      assert.ok(product, `Missing ${unit}`);
      const base = { productoId: product.id, ubicacionId: site.id, usuarioId: f.actors.admin.id, costoUnitario: "100", proveedorId: f.supplier.id };
      for (const quantity of ["-2", "0", "1.5", "2", "9999999.999", "-9999999.999", "10000000"]) {
        for (const producer of ["crearRollo", "crearEntrada", "activarRollo", "ajustarRollo"]) {
          const record: any = { phase, site: site.id, unit, quantity, producer, transport: "service" };
          try {
            await db.transaction(async (tx: any) => {
              let result: any;
              if (producer === "crearRollo") result = await crearRollo(tx, { ...base, cantidadInicial: quantity });
              else if (producer === "crearEntrada") {
                const floors = (await pool.query("select id from pisos where ubicacion_id=$1 and activo=true order by id", [site.id])).rows;
                result = await crearEntrada(tx, { ...base, uuidCliente: randomUUID(), lineas: [{ productoId: product.id, costoUnitario: "100", cantidades: [quantity], pisosPorCantidad: [floors[0]?.id ?? null] }] });
              } else {
                const created = await crearRollo(tx, { ...base, cantidadInicial: "10", estado: producer === "ajustarRollo" ? "DISPONIBLE" : "PROGRAMADO" });
                result = producer === "activarRollo"
                  ? await activarRollo(tx, { rolloId: created.rollo.id, cantidadReal: quantity, usuarioId: base.usuarioId })
                  : await ajustarRollo(tx, { rolloId: created.rollo.id, cantidadNueva: quantity, usuarioId: base.usuarioId, justificacion: "Tanda GA numeric producer boundary" });
              }
              record.accepted = true;
              record.result = result;
              throw rollback;
            });
          } catch (error: any) {
            if (error !== rollback) Object.assign(record, { accepted: false, code: error.code ?? error.cause?.code, constraint: error.constraint ?? error.cause?.constraint, message: error.message });
          }
          results.push(record); save();
        }
        if (cookie) {
          const created = await db.transaction((tx: any) => crearRollo(tx, { ...base, cantidadInicial: "10" }));
          const response = await fetch(`${config.apiOrigin}/api/inventario/rollos/${created.rollo.id}/activar`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ cantidadReal: quantity, uuidCliente: randomUUID(), notas: "Tanda GA isolated numeric API matrix" }) });
          const responseText = await response.text();
          const after = (await pool.query("select id,estado,cantidad_inicial,cantidad_actual,ubicacion_id from rollos where id=$1", [created.rollo.id])).rows[0];
          const ledger = (await pool.query("select tipo,cantidad,saldo_posterior from movimientos where rollo_id=$1 order by id", [created.rollo.id])).rows;
          results.push({ phase, site: site.id, unit, quantity, transport: "API", producer: "activarRollo", before: created.rollo, status: response.status, responseText, after, ledger, negativePhysicalCommitted: Number(after.cantidad_actual) < 0 });
          save();
        }
      }
    }
    if (ownConstraint) {
      await pool.query(`ALTER TABLE rollos DROP CONSTRAINT ${constraint}`);
      ownConstraint = false;
    }
  }
  const comparisons: any[] = [];
  for (const site of f.sites.slice(0, 2)) for (const unit of ["METRO", "KILO", "PIEZA", "BOLSA"]) {
    const rows = results.filter(r => r.site === site.id && r.unit === unit);
    for (const producer of ["crearRollo", "crearEntrada", "activarRollo", "ajustarRollo"]) {
      const valid = rows.filter(r => r.transport === "service" && r.producer === producer && r.quantity === "2");
      comparisons.push({ site: site.id, unit, producer, check: "valid-2-both-phases", pass: valid.length === 2 && valid.every(r => r.accepted) });
    }
    if (cookie) {
      const negative = rows.filter(r => r.transport === "API" && r.quantity === "-2");
      const constrained = negative.find(r => r.phase === "check");
      const baseline = negative.find(r => r.phase === "baseline");
      comparisons.push({ site: site.id, unit, check: "API-check-blocks-negative-physical", pass: constrained && !constrained.negativePhysicalCommitted && constrained.status >= 400 });
      if (unit === "METRO" || unit === "KILO") comparisons.push({ site: site.id, unit, check: "API-baseline-reproduces-minus-2", pass: baseline?.status === 200 && baseline?.negativePhysicalCommitted });
      const valid = rows.filter(r => r.transport === "API" && r.quantity === "2");
      comparisons.push({ site: site.id, unit, check: "API-valid-2-both-phases", pass: valid.length === 2 && valid.every(r => r.status === 200 && Number(r.after.cantidad_actual) === 2) });
    }
  }
  results.push({ type: "comparisons", comparisons, apiExecuted: !!cookie });
  save();
  assert.ok(cookie, "API handoff absent: producer evidence only, incomplete acceptance");
  assert.ok(comparisons.every(r => r.pass), "Matrix comparison failed; inspect results.json");
} finally {
  // Drop only this runner's named constraint, never production guards.
  if (ownConstraint) await pool.query(`ALTER TABLE rollos DROP CONSTRAINT ${constraint}`);
  save();
  await pool.end();
}