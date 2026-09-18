/**
 * PREPARED ONLY. No top-level connection, fixture execution, route import or tests.
 * Called only by the reviewed clone orchestrator after explicit owner authorization.
 * All SQL is real PostgreSQL; handlers/domain code use real Drizzle and this pool.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { assertCloneIdentity, createRehearsalLoader } from "./e1-rehearsal-loader.mts";

const BASE = 1871000000;
const ADMIN = BASE + 1;
const CASHIER = BASE + 2;
const SITE = BASE + 1;
const SESSION = BASE + 1;
const CLIENTS = [10, 11, 12, 13, 14].map((n) => BASE + n);
const NOTES = [20, 21, 22, 23, 24].map((n) => BASE + n);
const SALES = [30, 31, 32, 33, 34].map((n) => BASE + n);
const USERNAME = "e1_customer_rehearsal_admin";
const key = (n: number) => `e1100001-0000-4000-8000-${String(n).padStart(12, "0")}`;

/**
 * Exact fixture writes. $1 is a freshly generated test-only password, retained
 * only in process memory; PostgreSQL stores crypt($1,gen_salt('bf',6)).
 * It is never printed, returned, saved in reports, or an operational credential.
 * All other fixture data/IDs/timestamps/UUIDs are fixed below.
 * Plain INSERT only: collision => rollback/refuse, never UPSERT/delete/reset.
 */
export const CUSTOMER_FIXTURE_SQL = `
INSERT INTO ubicaciones(id,nombre,iniciales,tipo,activa)
VALUES (1871000001,'E1 ensayo clientes','ECX','TIENDA',true);
INSERT INTO usuarios(id,nombre,usuario,password_hash,rol,ubicacion_id,activo,alcance_consulta)
VALUES
 (1871000001,'E1 ensayo ADMIN clientes','e1_customer_rehearsal_admin',crypt($1,gen_salt('bf',6)),'ADMIN',1871000001,true,'TODAS'),
 (1871000002,'E1 ensayo CAJA clientes','e1_customer_rehearsal_cashier',crypt($1,gen_salt('bf',6)),'CAJA',1871000001,true,'PROPIA');
INSERT INTO permisos_usuario(id,usuario_id,modulo,puede_ver,puede_crear,puede_editar,puede_autorizar,updated_por)
VALUES (1871000001,1871000002,'clientes_finanzas',true,true,false,false,1871000001);
INSERT INTO sesiones_caja(id,ubicacion_id,usuario_id,abierta_at,fecha_operativa,fondo_inicial,estado)
VALUES (1871000001,1871000001,1871000002,'2020-01-01T12:00:00Z','2020-01-01',0,'ABIERTA');
INSERT INTO clientes(id,nombre,activo,es_sistema,dias_credito,limite_credito,saldo_credito)
SELECT 1871000010+n,'E1 ensayo cliente '||n,true,false,15,10000,0 FROM generate_series(0,4) n;
INSERT INTO tickets(id,folio,ubicacion_id,usuario_terminal_id,cliente_id,subtotal,iva,tasa_iva,total,
 documento_tipo,estado,cobrado,credito,dias_plazo,fecha_vencimiento,uuid_cliente,
 created_at,autorizacion_estado,autorizado_por,autorizado_at)
SELECT 1871000020+n,1871000020+n,1871000001,1871000001,1871000010+n,1000,0,0,1000,
 'NOTA','VENDIDO',false,true,15,'2020-01-16',
 ('e1100000-0000-4000-8000-'||lpad((n+1)::text,12,'0'))::uuid,
 '2020-01-01T12:00:00Z','AUTORIZADA',1871000001,'2020-01-01T12:00:00Z'
FROM generate_series(0,4) n;
INSERT INTO operaciones_credito_e1(productor,clave,naturaleza,usuario_id,solicitud_canonica,created_at)
SELECT 'VENTA_CREDITO',('e1100000-0000-4000-8000-'||lpad((n+1)::text,12,'0'))::uuid,
 'OPERACION_CREDITO_SIN_DINERO',1871000001,
 jsonb_build_object('fixture','E1_CUSTOMER_REHEARSAL','clienteId',1871000010+n,'importe','1000.00'),
 '2020-01-01T12:00:00Z' FROM generate_series(0,4) n;
INSERT INTO movimientos_credito(id,cliente_id,ticket_id,tipo,importe,usuario_id,created_at,
 dias_plazo,fecha_vencimiento,metadata,sitio_origen_id,naturaleza,operacion_productor,operacion_clave,nota_origen_id)
SELECT 1871000030+n,1871000010+n,1871000020+n,'VENTA_CREDITO',1000,1871000001,
 '2020-01-01T12:00:00Z',15,'2020-01-16','{"origen":"E1_REHEARSAL_FIXTURE"}',1871000001,
 'OPERACION_CREDITO_SIN_DINERO','VENTA_CREDITO',
 ('e1100000-0000-4000-8000-'||lpad((n+1)::text,12,'0'))::uuid,1871000020+n
FROM generate_series(0,4) n;
`;
export const fixtureSql = CUSTOMER_FIXTURE_SQL;

export const CUSTOMER_CASE_PLAN = Object.freeze({
  state: "PREPARED_NOT_EXECUTED",
  expectedNamedCases: 59,
  fixtureCounts: { ubicaciones: 1, usuarios: 2, permisos_usuario: 1, sesiones_caja: 1,
    clientes: 5, tickets: 5, operaciones_credito_e1: 5, movimientos_credito: 5 },
  fixtureIds: { admin: ADMIN, cashier: CASHIER, site: SITE, session: SESSION,
    clients: CLIENTS, notes: NOTES, sales: SALES },
  credential: "New in-memory random test-only value; crypt($1,gen_salt('bf',6)); never serialized",
  seed: "Five explicit synthetic 1000.00 credit notes dated 2020-01-01, overdue 2020-01-16. These SQL fixtures are NOT claimed as POS-producer coverage.",
  calls: [
    "POST /clientes/:id/pagos: bank 100.00, original/replay/changed amount + negative contracts",
    "POST /clientes/:id/pagos/:pagoId/reversar: explicit correction 100.00, original/replay/changed motivo + negative contracts",
    "POST /clientes/:id/ajustes: correction -10.00 with owned nota, original/replay/changed amount + negative contracts",
    "POST /pagos-dirigidos: ADMIN immediate bank 100.00, original/replay/changed amount + negative contracts",
    "POST /pagos-dirigidos: CAJA pending bank 100.00, submission replay/conflict and zero payment before approval",
    "POST /pagos-dirigidos/:id/aprobar: original UUID, mismatch/legacy rejection, ADMIN application/replay",
    "POST /clientes/:id/baja: full overdue 1000.00 correction with synthetic ADMIN credentials, replay/conflict + negative contracts",
  ],
  additionalNegatives: [
    "Each producer: missing site, missing nature, incompatible nature, and legacy metadata rejection",
    "Ordinary/directed/reversal physical EFECTIVO denied with genuinely valid open same-site session",
    "Manual foreign-customer nota denied", "Writeoff missing/wrong credentials denied before replay",
  ],
  writes: [
    "Fixture INSERTs listed above in one explicit transaction; rollback on collision/failure",
    "Actual routes INSERT operaciones_credito_e1, movimientos_credito, aplicaciones_credito, auditoria",
    "Actual directed routes INSERT/UPDATE solicitudes_pago_dirigido and INSERT notificaciones_sistema",
    "Actual bad-debt route UPDATE only its synthetic cliente activo=false",
    "New rows use production serial sequences; no sequence reset, cleanup, historical UPDATE/DELETE or financial algorithm change",
  ],
  authBoundary: "Inject stored synthetic actor; run actual route-specific permission/role middleware and handler. No HTTP, login or cookie-session transport.",
});

type RecordResult = { name: string; status: "PASS" | "FAIL"; [key: string]: unknown };
export interface CustomerCaseContext {
  pool: Pool;
  loadModule?: (file: string) => any;
  record?: (result: RecordResult) => void | Promise<void>;
}
type Reply = { status: number; body: any };
type RequestSpec = {
  name: string; router: any; path: string; params: Record<string, number>;
  body: Record<string, any>; producer: string; expected?: number; role?: "ADMIN" | "CAJA";
};

export async function runCustomerCases(context: CustomerCaseContext) {
  const { pool } = context;
  await assertCloneIdentity(pool);
  const installed = await pool.query(`SELECT to_regclass('public.operaciones_credito_e1') AS operations`);
  assert.ok(installed.rows[0].operations, "Reviewed E1 clone DDL must be installed before customer fixtures");
  // No connection factory or application singleton: use one supplied clone pool.
  const loader = context.loadModule ? null : createRehearsalLoader({ pool });
  const loadModule = context.loadModule ?? loader!.loadModule;
  const routers = {
    ordinary: loadModule("artifacts/api-server/src/routes/clientes.ts").default,
    directed: loadModule("artifacts/api-server/src/routes/pagos-dirigidos.ts").default,
    admin: loadModule("artifacts/api-server/src/routes/clientes-admin.ts").default,
  };
  const password = randomBytes(32).toString("base64url");
  const fixtureClient = await pool.connect();
  try {
    await fixtureClient.query("BEGIN");
    // Extended pg protocol refuses multiple commands with parameters. Execute
    // the literal statement list sequentially without changing SQL or values.
    for (const statement of CUSTOMER_FIXTURE_SQL.split(";").map((s) => s.trim()).filter(Boolean)) {
      await fixtureClient.query(statement, statement.includes("$1") ? [password] : []);
    }
    await fixtureClient.query("COMMIT");
  } catch (error) {
    await fixtureClient.query("ROLLBACK");
    throw error;
  } finally { fixtureClient.release(); }

  const actors = new Map<string, any>();
  const actorRows = await pool.query(`SELECT id,nombre,usuario,rol,ubicacion_id AS "ubicacionId",
    activo,alcance_consulta AS "alcanceConsulta" FROM usuarios WHERE id=ANY($1::int[])`, [[ADMIN, CASHIER]]);
  for (const actor of actorRows.rows) actors.set(actor.rol, actor);
  assert.equal(actors.size, 2);
  const results: RecordResult[] = [];
  let counter = 100;

  async function invoke(spec: RequestSpec): Promise<Reply> {
    const route = spec.router.stack.find((layer: any) => layer.route?.path === spec.path && layer.route.methods.post)?.route;
    assert.ok(route, `Actual POST route missing: ${spec.path}`);
    let status = 200, body: any, ended = false;
    const req = {
      body: spec.body, params: Object.fromEntries(Object.entries(spec.params).map(([k, v]) => [k, String(v)])),
      query: {}, ip: "127.0.0.1", headers: {}, method: "POST", path: spec.path,
      auth: { user: actors.get(spec.role ?? "ADMIN"), sessionId: null },
    };
    const res = {
      status(value: number) { status = value; return this; },
      json(value: any) { body = value; ended = true; return this; },
    };
    // Actual per-route middleware (permissions/ADMIN role) + actual handler.
    // Router-level cookie/session transport is deliberately outside this scope.
    for (const layer of route.stack) {
      let nextCalled = false, forwarded: unknown;
      await layer.handle(req, res, (error?: unknown) => { nextCalled = true; forwarded = error; });
      if (forwarded) throw forwarded; // SQL/loader/programming failures are NOT rejection evidence.
      if (ended) break;
      assert.ok(nextCalled, `Route middleware neither responded nor continued: ${spec.path}`);
    }
    assert.ok(ended, "Real handler must send a response");
    return { status, body };
  }

  async function footprint() {
    const result = await pool.query(`SELECT
      (SELECT count(*)::int FROM operaciones_credito_e1 WHERE usuario_id=ANY($1::int[])) AS operations,
      (SELECT count(*)::int FROM movimientos_credito WHERE cliente_id=ANY($2::int[])) AS movements,
      (SELECT coalesce(sum(importe),0)::text FROM movimientos_credito WHERE cliente_id=ANY($2::int[])) AS balance,
      (SELECT count(*)::int FROM aplicaciones_credito a JOIN movimientos_credito m ON m.id=a.abono_movimiento_id WHERE m.cliente_id=ANY($2::int[])) AS applications,
      (SELECT count(*)::int FROM auditoria WHERE usuario_id=ANY($1::int[])) AS audits,
      (SELECT count(*)::int FROM solicitudes_pago_dirigido WHERE tipo='CLIENTE' AND entidad_id=ANY($2::int[])) AS requests,
      (SELECT md5(coalesce(jsonb_agg(to_jsonb(s) ORDER BY id)::text,'[]')) FROM solicitudes_pago_dirigido s WHERE tipo='CLIENTE' AND entidad_id=ANY($2::int[])) AS request_state_hash,
      (SELECT count(*)::int FROM notificaciones_sistema WHERE destinatario_usuario_id=ANY($1::int[])) AS notifications,
      (SELECT md5(coalesce(jsonb_agg(to_jsonb(c) ORDER BY id)::text,'[]')) FROM clientes c WHERE id=ANY($2::int[])) AS customer_state_hash`,
    [[ADMIN, CASHIER], CLIENTS]);
    return result.rows[0];
  }

  async function record(name: string, fn: () => Promise<Record<string, unknown>>) {
    try {
      const entry: RecordResult = { name, status: "PASS", ...await fn() };
      results.push(entry); await context.record?.(entry);
      return entry;
    } catch (error) {
      // Never include request bodies, credential values or SQL parameter dumps.
      const entry: RecordResult = { name, status: "FAIL", errorType: error instanceof Error ? error.name : "Unknown" };
      results.push(entry); await context.record?.(entry);
      throw error;
    }
  }

  async function reject(spec: RequestSpec, label: string, expected: number, message?: RegExp) {
    await record(`${spec.name}: ${label}`, async () => {
      const before = await footprint();
      const reply = await invoke(spec);
      assert.equal(reply.status, expected, `${label}: ${String(reply.body?.error ?? "")}`);
      if (message) assert.match(String(reply.body?.error ?? ""), message);
      assert.deepEqual(await footprint(), before, "Rejected request must leave no claim/domain side effects");
      return { route: spec.path, statusCode: reply.status, boundary: "actual-handler-real-postgres" };
    });
  }

  async function negatives(spec: RequestSpec) {
    for (const missing of ["sitioOrigenId", "naturaleza"]) {
      const body = { ...spec.body, operacionClave: key(counter++) }; delete body[missing];
      await reject({ ...spec, body }, `missing ${missing}`, 400, /Actualiza/i);
    }
    const legacy = { ...spec.body };
    for (const field of ["sitioOrigenId", "naturaleza", "operacionClave", "sesionCajaId", "notaOrigenId", "origenJustificacion"]) delete legacy[field];
    await reject({ ...spec, body: legacy }, "legacy request", 400, /Actualiza/i);
    const incompatible = spec.producer === "REVERSO_ABONO" ? "INGRESO_FISICO" : "DEVOLUCION_FISICA";
    await reject({ ...spec, body: { ...spec.body, operacionClave: key(counter++), naturaleza: incompatible } },
      "incompatible producer nature", 400, /naturaleza incompatible/i);
  }

  async function cashClosed(spec: RequestSpec) {
    await reject({ ...spec, body: { ...spec.body, operacionClave: key(counter++),
      naturaleza: spec.producer === "REVERSO_ABONO" ? "DEVOLUCION_FISICA" : "INGRESO_FISICO",
      formaPago: "EFECTIVO", cuentaDestino: "CAJA_FISICA", sesionCajaId: SESSION,
    } }, "physical cash closed despite valid open session", 403, /deshabilitada/i);
  }

  async function successReplay(spec: RequestSpec, changed: Record<string, unknown>) {
    let first!: Reply;
    await record(`${spec.name}: accepted`, async () => {
      first = await invoke(spec);
      assert.equal(first.status, spec.expected ?? 201, String(first.body?.error ?? "producer failed"));
      const operation = await pool.query(`SELECT o.productor,m.id,m.naturaleza,m.sitio_origen_id,
        m.operacion_clave,m.importe::text FROM operaciones_credito_e1 o
        JOIN movimientos_credito m ON m.operacion_productor=o.productor AND m.operacion_clave=o.clave
        WHERE o.productor=$1 AND o.clave=$2::uuid`, [spec.producer, spec.body.operacionClave]);
      assert.equal(operation.rowCount, 1, "Exactly one actual operation/movement pair");
      assert.equal(operation.rows[0].naturaleza, spec.body.naturaleza);
      assert.equal(operation.rows[0].sitio_origen_id, SITE);
      const movementId = first.body.movimientoId ?? first.body.id;
      assert.equal(movementId, operation.rows[0].id, "Response must identify persisted real movement");
      return { producer: spec.producer, movementId, uuid: spec.body.operacionClave, statusCode: first.status };
    });
    await record(`${spec.name}: replay preserves response and all effects`, async () => {
      const before = await footprint();
      const replay = await invoke(spec);
      assert.deepEqual(replay, first);
      assert.deepEqual(await footprint(), before, "Replay cannot append any claim/movement/audit/allocation/request");
      return { producer: spec.producer, statusCode: replay.status };
    });
    await reject({ ...spec, body: { ...spec.body, ...changed } }, "changed content conflicts", 409);
    return first;
  }

  const evidence = (n: number, nature = "CORRECCION_CONTABLE", note?: number) => ({
    sitioOrigenId: SITE, naturaleza: nature, operacionClave: key(n),
    sesionCajaId: null, notaOrigenId: note ?? null,
    origenJustificacion: "Ensayo sintético E1 autorizado exclusivamente en clon",
  });
  const bank = { importe: 100, formaPago: "TRANSFERENCIA", cuentaDestino: "CUENTA_FISCAL", referencia: "E1-CLON-100" };
  const ordinary: RequestSpec = { name: "ordinary", router: routers.ordinary,
    path: "/clientes/:id/pagos", params: { id: CLIENTS[0]! }, producer: "ABONO_ORDINARIO",
    body: { ...bank, ...evidence(1, "INGRESO_FISICO") } };
  await negatives(ordinary); await cashClosed(ordinary);
  const paid = await successReplay(ordinary, { importe: 101 });

  const reverse: RequestSpec = { name: "reversal", router: routers.ordinary,
    path: "/clientes/:id/pagos/:pagoId/reversar", params: { id: CLIENTS[0]!, pagoId: paid.body.id },
    producer: "REVERSO_ABONO",
    body: { importe: 100, motivo: "Corrección sintética de abono para ensayo E1", ...evidence(2) } };
  await negatives(reverse); await cashClosed(reverse);
  await successReplay(reverse, { motivo: "Otro motivo documentado de corrección sintética" });

  const manual: RequestSpec = { name: "manual adjustment", router: routers.ordinary,
    path: "/clientes/:id/ajustes", params: { id: CLIENTS[3]! }, producer: "AJUSTE_MANUAL",
    body: { importe: -10, motivo: "Ajuste sintético documentado del ensayo", ...evidence(3, "CORRECCION_CONTABLE", NOTES[3]) } };
  await negatives(manual);
  await reject({ ...manual, body: { ...manual.body, operacionClave: key(counter++), notaOrigenId: NOTES[0] } },
    "foreign customer note rejected", 400, /nota de origen/i);
  await successReplay(manual, { importe: -11 });

  const directed: RequestSpec = { name: "directed immediate", router: routers.directed,
    path: "/pagos-dirigidos", params: {}, producer: "ABONO_DIRIGIDO",
    body: { ...bank, ...evidence(4, "INGRESO_FISICO"), tipo: "CLIENTE", entidadId: CLIENTS[1],
      documentoMovimientoId: SALES[1], motivo: "Pago dirigido sintético del ensayo" } };
  await negatives(directed); await cashClosed(directed);
  await successReplay(directed, { importe: 101 });

  const pending: RequestSpec = { ...directed, name: "directed pending", role: "CAJA",
    body: { ...directed.body, ...evidence(5, "INGRESO_FISICO"), entidadId: CLIENTS[2], documentoMovimientoId: SALES[2] } };
  await negatives(pending); await cashClosed(pending);
  let request!: Reply;
  await record("directed pending: request is not money or an operation claim", async () => {
    const before = await footprint();
    request = await invoke(pending);
    assert.equal(request.status, 201);
    assert.equal(request.body.estado, "PENDIENTE");
    assert.equal(request.body.movimientoId, null);
    const after = await footprint();
    assert.equal(after.operations, before.operations);
    assert.equal(after.movements, before.movements);
    assert.equal(after.applications, before.applications);
    assert.equal(after.balance, before.balance);
    return { requestId: request.body.id, uuid: pending.body.operacionClave };
  });
  await record("directed pending: submission replay", async () => {
    const before = await footprint();
    assert.deepEqual(await invoke(pending), request);
    assert.deepEqual(await footprint(), before);
    return { requestId: request.body.id };
  });
  await reject({ ...pending, body: { ...pending.body, importe: 101 } }, "changed request conflicts", 409);
  const approval: RequestSpec = { name: "directed approval", router: routers.directed,
    path: "/pagos-dirigidos/:id/aprobar", params: { id: request.body.id }, producer: "ABONO_DIRIGIDO",
    body: evidence(5, "INGRESO_FISICO") };
  await reject({ ...approval, body: {} }, "legacy approval", 400, /Actualiza/i);
  for (const missing of ["sitioOrigenId", "naturaleza"]) {
    const body = { ...approval.body }; delete body[missing];
    await reject({ ...approval, body }, `missing ${missing}`, 400, /Actualiza/i);
  }
  await reject({ ...approval, body: { ...approval.body, operacionClave: key(counter++) } }, "another UUID cannot approve", 409);
  await reject({ ...approval, body: { ...approval.body, naturaleza: "DEVOLUCION_FISICA" } }, "changed nature cannot approve", 409);
  await successReplay(approval, { sitioOrigenId: SITE + 99 });
  await record("directed approval: original submitter can replay resolved request", async () => {
    const before = await footprint(), resolved = await invoke(pending);
    assert.equal(resolved.status, 201); assert.equal(resolved.body.id, request.body.id);
    assert.equal(resolved.body.estado, "APROBADA");
    assert.ok(resolved.body.movimientoId);
    assert.deepEqual(await footprint(), before);
    return { requestId: resolved.body.id, movementId: resolved.body.movimientoId };
  });

  const writeoff: RequestSpec = { name: "bad debt", router: routers.admin,
    path: "/clientes/:id/baja", params: { id: CLIENTS[4]! }, producer: "BAJA_INCOBRABLE", expected: 200,
    body: { ...evidence(6, "CORRECCION_CONTABLE", NOTES[4]), montoIncobrable: 1000,
      motivo: "Baja sintética de saldo vencido exclusivamente para el ensayo E1",
      adminUsuario: USERNAME, adminPassword: password } };
  await negatives(writeoff);
  const noCredentials = { ...writeoff.body }; delete noCredentials.adminUsuario; delete noCredentials.adminPassword;
  await reject({ ...writeoff, body: noCredentials }, "missing ADMIN credentials", 401);
  await successReplay(writeoff, { montoIncobrable: 999 });
  await reject({ ...writeoff, body: { ...writeoff.body, adminPassword: "deliberately-invalid-synthetic-value" } },
    "invalid ADMIN credentials cannot replay", 401);
  await record("bad debt: persisted inactive customer and exact audited writeoff", async () => {
    const customer = await pool.query("SELECT activo FROM clientes WHERE id=$1", [CLIENTS[4]]);
    const movement = await pool.query(`SELECT importe::text,es_incobrable,autorizado_por FROM movimientos_credito
      WHERE operacion_productor='BAJA_INCOBRABLE' AND operacion_clave=$1::uuid`, [writeoff.body.operacionClave]);
    assert.equal(customer.rows[0].activo, false);
    assert.equal(movement.rows[0].importe, "-1000.00");
    assert.equal(movement.rows[0].es_incobrable, true);
    assert.equal(movement.rows[0].autorizado_por, ADMIN);
    return { clienteId: CLIENTS[4], amount: "-1000.00" };
  });

  assert.equal(results.length, CUSTOMER_CASE_PLAN.expectedNamedCases, "Every planned named case must execute");
  return { status: "PASS", cases: results, footprint: await footprint(),
    sourceIdentities: loader?.loadedSources ?? "provided-by-orchestrator" };
}

export const runCases = runCustomerCases;