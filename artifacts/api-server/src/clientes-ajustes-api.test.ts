/**
 * Focused isolated-DB regression suite for customer addresses, ordering,
 * write-off rules and private INE endpoints.
 * TEST_DATABASE_URL is enforced by @workspace/db before any query is made.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { Readable } from "node:stream";
import test, { after, before } from "node:test";
import type { PrivateObjectStorageAdapter } from "./lib/private-object-storage";
// @ts-ignore Shared infrastructure preflight is plain ESM without declarations.
import { assertActorSuiteEnvironmentSync } from "../../../lib/db/src/actor-suite-preflight.mjs";

assertActorSuiteEnvironmentSync(process.env);
if (process.env.ACTOR_SUITE_IDENTITY_VERIFIED !== "1") {
  throw new Error("Actor bootstrap must verify the local database identity before suite imports.");
}

const { db, ensureClientesSchema, pool } = await import("@workspace/db");
const {
  ADVISORY_LOCK_NAMESPACES,
  transactionAdvisoryLock,
} = await import("@workspace/db/advisory-locks");
const { default: app } = await import("./app");
const {
  setPrivateObjectStorageForTests,
} = await import("./lib/private-object-storage");
const { loadCustomerCreditProjection, loadCustomerCreditProjections } = await import("./lib/credit-aging-read-model");

const RUN = `clientes-ajustes-${Date.now()}`;
let server: Server;
let base = "";
let adminId = 0;
let terminalId = 0;
let locationId = 0;
let productId = 0;
let adminCookie = "";
let terminalCookie = "";
const clientIds: number[] = [];
const objects = new Map<string, Buffer>();
const originalPrivateObjectDir = process.env.PRIVATE_OBJECT_DIR;

const memoryStorage: PrivateObjectStorageAdapter = {
  async save(path, body) { objects.set(path, Buffer.from(body)); },
  createReadStream(path) {
    const value = objects.get(path);
    if (!value) return Readable.from((async function* () { throw new Error("not found"); })());
    return Readable.from(value);
  },
};

async function request(path: string, init: RequestInit = {}, cookie = adminCookie) {
  return fetch(`${base}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), ...(cookie ? { cookie } : {}) },
  });
}

async function json(path: string, init: RequestInit = {}, cookie = adminCookie) {
  const response = await request(path, init, cookie);
  return { response, body: await response.json() as Record<string, unknown> };
}

async function createClient(nombre: string) {
  const result = await pool.query(
    `INSERT INTO clientes(nombre,activo,es_sistema,limite_credito,saldo_credito,dias_credito)
     VALUES($1,true,false,0,0,0) RETURNING id`,
    [`${RUN} ${nombre}`],
  );
  const id = Number(result.rows[0].id);
  clientIds.push(id);
  return id;
}

async function credit(clientId: number, amount: string, due: string | null) {
  await pool.query(
    `INSERT INTO movimientos_credito(cliente_id,tipo,importe,usuario_id,dias_plazo,fecha_vencimiento)
     VALUES($1,'VENTA_CREDITO',$2,$3,$4,$5)`,
    [clientId, amount, adminId, due ? 30 : null, due],
  );
}

before(async () => {
  await ensureClientesSchema(pool);
  // Only the memory transport below uses this inert, local object namespace.
  process.env.PRIVATE_OBJECT_DIR = `/actor-suite-memory/${RUN}`;
  setPrivateObjectStorageForTests(memoryStorage);
  const location = await pool.query(
    `WITH candidate AS (
       SELECT chr(first_letter) || chr(second_letter) AS iniciales
       FROM generate_series(65,90) first_letter
       CROSS JOIN generate_series(65,90) second_letter
       WHERE NOT EXISTS (
         SELECT 1 FROM ubicaciones
         WHERE iniciales = chr(first_letter) || chr(second_letter)
       )
       ORDER BY first_letter, second_letter
       LIMIT 1
     )
     INSERT INTO ubicaciones(nombre,iniciales,tipo)
     SELECT $1,candidate.iniciales,'TIENDA' FROM candidate
     RETURNING id`,
    [`${RUN} tienda`],
  );
  locationId = Number(location.rows[0].id);
  const product = await pool.query(
    `INSERT INTO productos(
       sku,tela,color,unidad,precio_sugerido,se_vende_por_metro,precio_menudeo
     )
     VALUES($1,$2,'Azul','METRO',100,true,100) RETURNING id`,
    [`${RUN}-sku`, `${RUN} tela`],
  );
  productId = Number(product.rows[0].id);
  const users = await pool.query(
    `INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id)
     VALUES
       ($1,$2,crypt('Admin123!',gen_salt('bf',8)),'ADMIN',NULL),
       ($3,$4,crypt('Terminal123!',gen_salt('bf',8)),'TERMINAL',$5)
     RETURNING id,usuario`,
    [`${RUN} Admin`, `${RUN}-admin`, `${RUN} Terminal`, `${RUN}-terminal`, locationId],
  );
  adminId = Number(users.rows[0].id);
  terminalId = Number(users.rows[1].id);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  base = `http://127.0.0.1:${address.port}/api`;
  const login = await request("/auth/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ usuario: `${RUN}-admin`, password: "Admin123!" }),
  }, "");
  assert.equal(login.status, 200);
  adminCookie = `mariana_session=${login.headers.get("set-cookie")!.match(/mariana_session=([^;]+)/)![1]}`;
  const terminalLogin = await request("/auth/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ usuario: `${RUN}-terminal`, password: "Terminal123!" }),
  }, "");
  terminalCookie = `mariana_session=${terminalLogin.headers.get("set-cookie")!.match(/mariana_session=([^;]+)/)![1]}`;
});

test("migración conserva dirección y helper usa entrega/fallback", async () => {
  const id = await createClient("migracion");
  await pool.query(`UPDATE clientes SET direccion_particular='Casa heredada' WHERE id=$1`, [id]);
  await pool.query("ALTER TABLE clientes RENAME COLUMN direccion_particular TO direccion");
  await ensureClientesSchema(pool);
  const row = await pool.query("SELECT direccion_particular,direccion_entrega FROM clientes WHERE id=$1", [id]);
  assert.equal(row.rows[0].direccion_particular, "Casa heredada");
  assert.equal(row.rows[0].direccion_entrega, null);
});

test("API acepta y expone alias temporal direccion", async () => {
  let result = await json("/clientes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nombre: `${RUN} dirección legacy`, direccion: "Calle anterior" }),
  });
  assert.equal(result.response.status, 201);
  const id = Number(result.body.id);
  clientIds.push(id);
  assert.equal(result.body.direccion, "Calle anterior");
  assert.equal(result.body.direccionParticular, "Calle anterior");
  result = await json(`/clientes/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ direccion: "Calle actualizada" }),
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.direccion, "Calle actualizada");
  assert.equal(result.body.direccionParticular, "Calle actualizada");
});

test("ensure siembra seis clientes y GET clientes aplica español/sistema", async () => {
  await ensureClientesSchema(pool);
  await pool.query(
    `INSERT INTO clientes(nombre,activo,es_sistema,limite_credito,saldo_credito,dias_credito)
     VALUES($1,true,false,0,0,0),($2,true,false,0,0,0)
     ON CONFLICT DO NOTHING`,
    [`${RUN} Nora`, `${RUN} Ñora`],
  );
  const { response, body } = await json("/clientes");
  assert.equal(response.status, 200);
  const items = body as unknown as Array<{ nombre: string }>;
  const required = ["Venta a Público", "Hilario Bonifacio", "Jacinta Mendoza", "Jesús López", "José López", "Miguel Esteban", "Rafael Flores"];
  assert.deepEqual(items.filter((x) => required.includes(x.nombre)).map((x) => x.nombre), required);
  const names = items.map((x) => x.nombre);
  assert.ok(names.indexOf(`${RUN} Nora`) < names.indexOf(`${RUN} Ñora`));
});

test("baja: elimina sin historial, desactiva historial saldo cero y bloquea saldo vigente", async () => {
  const empty = await createClient("empty");
  let result = await json(`/clientes/${empty}/baja`, { method: "POST" });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.resultado, "ELIMINADO");
  const historical = await createClient("historical");
  await credit(historical, "100.00", null);
  await pool.query(`INSERT INTO movimientos_credito(cliente_id,tipo,importe,usuario_id) VALUES($1,'ABONO',-100,$2)`, [historical, adminId]);
  result = await json(`/clientes/${historical}/baja`, { method: "POST" });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.resultado, "DESACTIVADO");
  const current = await pool.query("SELECT activo FROM clientes WHERE id=$1", [historical]);
  assert.equal(current.rows[0].activo, false);
  const currentCredit = await createClient("current credit");
  await credit(currentCredit, "123.45", new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  result = await json(`/clientes/${currentCredit}/baja`, { method: "POST" });
  assert.equal(result.response.status, 409);
  assert.equal(result.body.code, "CLIENT_BALANCE_PENDING");
  assert.equal(result.body.monto, "123.45");
  assert.equal(result.body.requiereAutorizacion, false);
});

test("resúmenes y baja usan aging ante reverso de ticket y ABONO revertido", async () => {
  const id = await createClient("aging authoritative");
  const ticket = await pool.query(
    `INSERT INTO tickets(folio,uuid_cliente,ubicacion_id,usuario_terminal_id,cliente_id,
       subtotal,iva,total,estado,cobrado,cobrado_at,created_at)
     VALUES($1,$2,$3,$4,$5,100,0,100,'VENDIDO',true,now(),now()) RETURNING id`,
    [1_800_000_000 + Math.floor(Math.random() * 100_000_000), randomUUID(), locationId, terminalId, id],
  );
  const ticketId = Number(ticket.rows[0].id);
  const sale = await pool.query(
    `INSERT INTO movimientos_credito(cliente_id,ticket_id,tipo,importe,usuario_id,dias_plazo,fecha_vencimiento)
     VALUES($1,$2,'VENTA_CREDITO',100,$3,30,(now() AT TIME ZONE 'America/Mexico_City')::date+30)
     RETURNING id`,
    [id, ticketId, adminId],
  );
  const payment = await pool.query(
    `INSERT INTO movimientos_credito(cliente_id,ticket_id,tipo,importe,usuario_id)
     VALUES($1,$2,'ABONO',-25,$3) RETURNING id`,
    [id, ticketId, adminId],
  );
  await pool.query(
    `INSERT INTO movimientos_credito(cliente_id,ticket_id,tipo,importe,usuario_id,movimiento_origen_id)
     VALUES($1,$2,'REVERSO',25,$3,$4)`,
    [id, ticketId, adminId, payment.rows[0].id],
  );
  await pool.query(
    `INSERT INTO movimientos_credito(cliente_id,ticket_id,tipo,importe,usuario_id)
      VALUES($1,$2,'AJUSTE',-40,$3)`,
    [id, ticketId, adminId],
  );

  const authoritative = await loadCustomerCreditProjection(id);
  assert.equal((authoritative.balanceCents / 100).toFixed(2), "60.00");
  assert.ok(sale.rows[0].id);

  const [detail, account, creditState, list, summary, baja] = await Promise.all([
    json(`/clientes/${id}`),
    json(`/clientes/${id}/estado-cuenta`),
    json(`/clientes/${id}/credito`),
    json("/clientes"),
    json("/clientes/resumen"),
    json(`/clientes/${id}/baja`, { method: "POST" }),
  ]);
  assert.equal(detail.body.saldoActual, "60.00");
  assert.equal(account.body.saldoActual, "60.00");
  assert.equal(creditState.body.saldoActual, "60.00");
  const listed = (list.body as unknown as Array<Record<string, unknown>>).find((item) => item.id === id);
  assert.equal(listed?.saldoActual, "60.00");
  const activeClients = await pool.query<{ id: number }>(
    "SELECT id FROM clientes WHERE activo",
  );
  const activePortfolio = await loadCustomerCreditProjections(
    activeClients.rows.map((row) => Number(row.id)),
  );
  const balances = [...activePortfolio.values()];
  assert.equal(
    summary.body.totalCartera,
    (balances.reduce((sum, projection) => sum + projection.balanceCents, 0) / 100).toFixed(2),
  );
  assert.equal(
    summary.body.clientesConSaldo,
    balances.filter((projection) => projection.balanceCents > 0).length,
  );
  assert.equal(baja.response.status, 409);
  assert.equal(baja.body.code, "CLIENT_BALANCE_PENDING");
  assert.equal(baja.body.saldo, "60.00");
});

test("crearTicket y baja se serializan con el mismo lock de cliente", async () => {
  const id = await createClient("concurrent");
  const provider = await pool.query(
    `INSERT INTO proveedores(nombre,tipo,moneda_default,activo)
     VALUES($1,'NACIONAL','MXN',true) RETURNING id`, [`${RUN} source provider`],
  );
  const entry = await pool.query(
    `INSERT INTO entradas(folio,ubicacion_id,proveedor_id,usuario_id,fecha,total_rollos,total_costo,uuid_cliente)
     VALUES((SELECT COALESCE(MAX(folio),0)+1 FROM entradas WHERE ubicacion_id=$1),
       $1,$2,$3,now(),1,400,$4) RETURNING id`,
    [locationId, provider.rows[0].id, adminId, randomUUID()],
  );
  const source = await pool.query(
    `INSERT INTO rollos(serie,producto_id,ubicacion_id,recepcion_id,estado,
       cantidad_inicial,cantidad_actual,costo_unitario,costo_total)
     VALUES($1,$2,$3,$4,'DISPONIBLE',10,10,40,400) RETURNING id`,
    [String(700000000000 + productId), productId, locationId, entry.rows[0].id],
  );
  const sourceRollId = Number(source.rows[0].id);
  await pool.query(
    `INSERT INTO movimientos(rollo_id,producto_id,ubicacion_id,tipo,cantidad,saldo_posterior,
       usuario_id,documento_tipo,documento_id)
     VALUES($1,$2,$3,'ALTA',10,10,$4,'ENTRADA',$5)`,
    [sourceRollId, productId, locationId, adminId, String(entry.rows[0].id)],
  );
  const blocker = await pool.connect();
  await blocker.query("BEGIN");
  await transactionAdvisoryLock(
    blocker,
    ADVISORY_LOCK_NAMESPACES.CUSTOMER_CREDIT,
    id,
  );
  await blocker.query("SELECT id FROM clientes WHERE id=$1 FOR UPDATE", [id]);
  const ticketPromise = json("/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      uuidCliente: randomUUID(),
      ubicacionId: locationId,
      clienteId: id,
      tipo: "METREADO",
      facturado: false,
      lineas: [{
        rolloId: null,
        productoId: productId,
         tipo: "METREADO",
        cantidad: 1,
        precioUnitario: 100,
        fuentesRollo: [{ rolloId: sourceRollId, cantidad: 1 }],
      }],
    }),
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const bajaPromise = json(`/clientes/${id}/baja`, { method: "POST" });
  await new Promise((resolve) => setTimeout(resolve, 100));
  await blocker.query("COMMIT");
  blocker.release();
  const [ticket, baja] = await Promise.all([ticketPromise, bajaPromise]);
  assert.equal(ticket.response.status, 201, JSON.stringify(ticket.body));
  assert.equal(baja.response.status, 200, JSON.stringify(baja.body));
  assert.equal(
    baja.body.resultado,
    "DESACTIVADO",
    "la baja debe observar el ticket concurrente y nunca borrar al cliente",
  );
  assert.equal(
    (await pool.query("SELECT count(*)::int n FROM tickets WHERE cliente_id=$1", [id])).rows[0].n,
    1,
  );
});

test("baja vencida requiere ADMIN activo/motivo y conserva historial como incobrable; reactivar no revierte", async () => {
  const id = await createClient("overdue");
  await credit(id, "80.00", "2020-01-01");
  await pool.query(
    `INSERT INTO tickets(folio,ubicacion_id,usuario_terminal_id,cliente_id,subtotal,total,uuid_cliente)
     VALUES($1,$2,$3,$4,80,80,$5)`,
    [900000 + id, locationId, terminalId, id, randomUUID()],
  );
  let result = await json(`/clientes/${id}/baja`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ motivo: "motivo suficientemente largo para prueba" }),
  });
  assert.equal(result.response.status, 401);
  assert.equal(result.body.code, "ADMIN_AUTH_REQUIRED");
  const writeoff = {
    adminUsuario: `${RUN}-admin`, adminPassword: "Admin123!",
    sitioOrigenId: locationId,
    naturaleza: "CORRECCION_CONTABLE" as const,
    operacionClave: randomUUID(),
    montoIncobrable: "80.00",
    origenJustificacion: "Saldo vencido del cliente registrado en la tienda local de esta prueba.",
  };
  result = await json(`/clientes/${id}/baja`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...writeoff, motivo: "corto" }),
  });
  assert.equal(result.response.status, 400);
  // Current E1 preflight rejects the short reason before the legacy coded branch.
  assert.deepEqual(result.body, {
    error: "Declara monto incobrable positivo y motivo de al menos 20 caracteres.",
  });
  const rejected = await pool.query(
    `SELECT c.activo,
       (SELECT COALESCE(sum(importe),0)::text FROM movimientos_credito WHERE cliente_id=c.id) AS saldo,
       (SELECT count(*)::int FROM movimientos_credito WHERE cliente_id=c.id AND es_incobrable) AS incobrables,
       (SELECT count(*)::int FROM auditoria WHERE entidad='clientes' AND entidad_id=c.id::text
         AND accion='BAJA_INCOBRABLE') AS auditorias,
       (SELECT count(*)::int FROM operaciones_credito_e1
         WHERE productor='BAJA_INCOBRABLE' AND clave=$2::uuid) AS claims
     FROM clientes c WHERE c.id=$1`,
    [id, writeoff.operacionClave],
  );
  assert.deepEqual(rejected.rows[0], {
    activo: true, saldo: "80.00", incobrables: 0, auditorias: 0, claims: 0,
  });
  result = await json(`/clientes/${id}/baja`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...writeoff,
      motivo: "Cliente insolvente confirmado por administración",
    }),
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.resultado, "DESACTIVADO_INCOBRABLE");
  assert.equal((await pool.query(
    `SELECT count(*)::int n FROM operaciones_credito_e1
     WHERE productor='BAJA_INCOBRABLE' AND clave=$1::uuid AND naturaleza='CORRECCION_CONTABLE'`,
    [writeoff.operacionClave],
  )).rows[0].n, 1);
  const ledger = await pool.query(
    `SELECT COALESCE(sum(importe),0)::text saldo, count(*) FILTER (WHERE es_incobrable)::int AS incobrables
     FROM movimientos_credito WHERE cliente_id=$1`, [id],
  );
  assert.equal(ledger.rows[0].saldo, "0.00");
  assert.equal(ledger.rows[0].incobrables, 1);
  assert.equal((await pool.query("SELECT count(*)::int n FROM tickets WHERE cliente_id=$1", [id])).rows[0].n, 1);
  assert.equal((await pool.query("SELECT count(*)::int n FROM auditoria WHERE entidad_id=$1 AND accion='BAJA_INCOBRABLE'", [String(id)])).rows[0].n, 1);
  result = await json(`/clientes/${id}/reactivar`, { method: "POST" });
  assert.equal(result.response.status, 200);
  assert.equal((await pool.query("SELECT count(*)::int n FROM movimientos_credito WHERE cliente_id=$1 AND es_incobrable", [id])).rows[0].n, 1);
  const report = await json("/clientes/incobrables");
  assert.equal(report.response.status, 200);
  assert.ok((report.body.filas as Array<{ clienteId: number }>).some((row) => row.clienteId === id));
});

test("Venta a Público permanece protegido", async () => {
  const system = await pool.query("SELECT id FROM clientes WHERE es_sistema LIMIT 1");
  const result = await json(`/clientes/${system.rows[0].id}/baja`, { method: "POST" });
  assert.equal(result.response.status, 409);
  assert.equal(result.body.code, "SYSTEM_CLIENT_PROTECTED");
});

test("INE: ADMIN, MIME/tamaño, slots/reemplazo, privacidad y auditoría", async () => {
  const id = await createClient("INE");
  const upload = (lado: string, bytes: Buffer, mime = "image/png", filename = "ine.png") =>
    request(`/clientes/${id}/documentos/${lado}`, {
      method: "POST",
      headers: { "content-type": mime, "x-file-name": filename },
      body: bytes,
    });
  assert.equal((await upload("FRENTE", Buffer.from("x"), "text/plain")).status, 415);
  assert.equal((await upload("FRENTE", Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413);
  const first = await upload("FRENTE", Buffer.from("front-one"));
  assert.equal(first.status, 201);
  const firstBody = await first.json() as Record<string, unknown>;
  assert.match(String(firstBody.publicId), /^[0-9a-f-]{36}$/i);
  assert.equal(JSON.stringify(firstBody).includes("rutaArchivo"), false);
  assert.notEqual(String(firstBody.publicId), String(id));
  const stored = await pool.query(
    "SELECT ruta_archivo FROM cliente_documentos WHERE public_id=$1",
    [firstBody.publicId],
  );
  assert.equal(String(stored.rows[0].ruta_archivo).includes(`/${id}/`), false);
  assert.equal((await upload("REVERSO", Buffer.from("back"))).status, 201);
  const replacement = await upload("FRENTE", Buffer.from("front-two"), "image/png", "nuevo.png");
  assert.equal(replacement.status, 201);
  assert.equal(
    (await pool.query(
      "SELECT vigente FROM cliente_documentos WHERE public_id=$1",
      [firstBody.publicId],
    )).rows[0].vigente,
    false,
  );
  const listed = await json(`/clientes/${id}/documentos`);
  assert.equal(listed.response.status, 200);
  assert.equal((listed.body as unknown as unknown[]).length, 2);
  assert.equal((await pool.query("SELECT count(*)::int n FROM cliente_documentos WHERE cliente_id=$1", [id])).rows[0].n, 3);
  const denied = await request(`/cliente-documentos/${firstBody.publicId}/ver`, {}, terminalCookie);
  assert.equal(denied.status, 403);
  const viewed = await request(`/cliente-documentos/${firstBody.publicId}/ver`);
  assert.equal(viewed.status, 200);
  assert.equal(await viewed.text(), "front-one");
  const downloaded = await request(`/cliente-documentos/${firstBody.publicId}/descargar`);
  assert.equal(downloaded.status, 200);
  assert.equal(await downloaded.text(), "front-one");
  const audit = await pool.query(
    `SELECT count(*)::int n FROM auditoria WHERE entidad_id=$1 AND accion IN ('VER_INE','DESCARGAR_INE')`,
    [String(id)],
  );
  assert.equal(audit.rows[0].n, 2);
});

after(async () => {
  setPrivateObjectStorageForTests(null);
  if (originalPrivateObjectDir === undefined) delete process.env.PRIVATE_OBJECT_DIR;
  else process.env.PRIVATE_OBJECT_DIR = originalPrivateObjectDir;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});