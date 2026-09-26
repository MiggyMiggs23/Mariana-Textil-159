// Authorized isolated-copy API-only receipt/relocation fixture. Never reads app DATABASE_URL.
import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import pg from "../../../lib/db/node_modules/pg/lib/index.js";
const dir = "/tmp/print-corrections-20260926/print_corrections_20260926";
const base = "http://127.0.0.1:18428";
const report = new URL("./native-evidence.json", import.meta.url);
assert.equal(fs.existsSync(report), false, "Do not duplicate fixture");
const cookie = fs.readFileSync(`${dir}/entrada-cookie.txt`, "utf8");
async function api(route, method = "GET", body) {
  const r = await fetch(base + route, {
    method, headers: { cookie, "Content-Type": "application/json", Origin: base },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await r.json();
  assert.equal(r.ok, true, `${method} ${route} ${r.status}: ${JSON.stringify(result)}`);
  return result;
}
const floors = (await api("/api/locations/1/pisos")).filter(p => p.activo);
assert.equal(floors.length >= 2, true);
const catalog = await api("/api/inventario/entradas/catalogos");
const products = catalog.productos.filter(p => p.activo).slice(0, 2);
assert.equal(products.length, 2);
const request = {
  ubicacionId: 1, proveedorId: null, uuidCliente: crypto.randomUUID(),
  observaciones: "Prueba autorizada de impresión: dos pisos originales. Copia aislada 20260926.",
  lineas: products.map((p, i) => ({
    productoId: p.id, cantidades: ["5"], costoUnitario: "1.00", pisosPorCantidad: [floors[i].id],
  })),
};
const created = await api("/api/inventario/entradas", "POST", request);
assert.deepEqual(created.lineas.map(r => r.pisoEntrada), floors.slice(0, 2).map(p => p.nombre));
// Persist identity immediately so browser worker can find it even if a later assertion fails.
fs.writeFileSync(report, JSON.stringify({ status: "CREATED_AWAITING_RELOCATION_AND_READONLY_AUDIT", entryId: created.id,
  documentUrl: `${base}/entradas/${created.id}/documento`, request, created }, null, 2));
const moved = created.rollos[0];
await api(`/api/inventario/rollos/${moved.id}/piso`, "PATCH", { pisoId: floors[1].id });
const after = await api(`/api/inventario/entradas/${created.id}`);
assert.deepEqual(after.lineas.map(r => r.pisoEntrada), created.lineas.map(r => r.pisoEntrada));
assert.equal(after.rollos.find(r => r.id === moved.id).pisoId, floors[1].id);
assert.notEqual(after.lineas[0].pisoEntrada, after.rollos.find(r => r.id === moved.id).nombrePiso);
const env = JSON.parse(fs.readFileSync(`${dir}/test-env.json`, "utf8"));
const sql = new pg.Client({ connectionString: env.TEST_DATABASE_URL, options: "-c default_transaction_read_only=on" });
await sql.connect();
try {
  await sql.query("BEGIN READ ONLY");
  const identity = (await sql.query("SELECT current_database() database, current_setting('transaction_read_only') readonly")).rows[0];
  assert.equal(identity.database, "print_corrections_20260926");
  assert.equal(identity.readonly, "on");
  const audit = (await sql.query(
    "SELECT id::text, accion, entidad, entidad_id, datos_despues FROM auditoria WHERE entidad='entradas' AND entidad_id=$1 AND accion='CREAR'",
    [String(created.id)])).rows;
  assert.equal(audit.length, 1);
  assert.equal(audit[0].datos_despues.pisosEntradaVersion, 1);
  assert.deepEqual(audit[0].datos_despues.pisosEntrada.map(p => p.nombrePiso), floors.slice(0, 2).map(p => p.nombre));
  const purchases = (await sql.query("SELECT count(*)::int count FROM pagos_proveedor WHERE entrada_id=$1", [created.id])).rows[0].count;
  assert.equal(purchases, 0);
  await sql.query("ROLLBACK");
  fs.writeFileSync(report, JSON.stringify({
    status: "PASSED_NATIVE_API_RECEIPT_RELOCATION_PERSISTED_AUDIT",
    entryId: created.id, documentUrl: `${base}/entradas/${created.id}/documento`,
    request, created, relocatedRollId: moved.id, after, identity, audit,
    supplierLedgerRows: purchases, sqlWrites: false, noSupplierDebt: true,
  }, null, 2));
  console.log(JSON.stringify({ entryId: created.id, folio: created.folioFormateado,
    documentUrl: `${base}/entradas/${created.id}/documento`, originalFloors: created.lineas.map(r => r.pisoEntrada),
    currentFloorsAfterRelocation: after.rollos.map(r => r.nombrePiso), persistedAuditVerified: true, supplierLedgerRows: purchases }));
} finally { await sql.end(); }