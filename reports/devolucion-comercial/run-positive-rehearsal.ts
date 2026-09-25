/**
 * MAIN-only integration runner. NO DDL installer or server startup.
 * Requires schema-only continuation_return_test, candidate already installed.
 * Own independent identity guard runs BEFORE importing any application module.
 */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const requireDb = createRequire(new URL("../../lib/db/package.json", import.meta.url));
const pg = requireDb("pg");
const ownerUrl = process.env.TEST_DATABASE_URL;
const pin = process.env.COMMERCIAL_RETURN_DISPOSABLE_SYSTEM_ID;
assert.ok(ownerUrl && pin && process.env.COMMERCIAL_RETURN_DISPOSABLE_ACK === "NEW_PRIVATE_CLUSTER_ONLY",
  "Require TEST_DATABASE_URL, pinned system ID, and NEW_PRIVATE_CLUSTER_ONLY acknowledgement");
const endpoint = new URL(ownerUrl);
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname), "Loopback private cluster only");
assert.equal(endpoint.port, "55536", "This runner is pinned to existing private PG55536");
assert.equal(endpoint.pathname, "/continuation_return_test", "Fresh dedicated DB only");
const owner = new pg.Client({ connectionString: ownerUrl, application_name: "commercial-return-rehearsal-owner",
  statement_timeout: 30000, query_timeout: 35000, lock_timeout: 10000 });
await owner.connect();
const role = `cr_rehearsal_${randomBytes(6).toString("hex")}`;
const password = randomBytes(32).toString("hex"); // memory only; never printed
let runtimePool: any;
let creditContract: typeof import("../../artifacts/api-server/src/lib/credit-evidence-contract");
let runtimeCreated = false;
let gateEnabled = false;
const passed: string[] = [];
let actor: number, product: number, origin: number;
let serial = 0;
type Fixture = { client: number; ticket: number; charge: number; source?: number;
  site: number; session: number; lines: Array<{ id: number; roll: number; amount: number; serie: string }> };
const fixtures: Fixture[] = [];
const money = (n: number) => n.toFixed(2);
// Real E1 canonical claim protocol, backed by this transaction's PostgreSQL
// connection. Shapes below come from pos.ts authorization and clientes.ts pago,
// not invented nonempty JSON or disabled constraints.
async function claimSeed(input: import("../../artifacts/api-server/src/lib/credit-evidence-contract").CreditOperationClaim) {
  const result = await creditContract.claimCreditOperationCore({
    async loadOperation(productor, clave) {
      return (await owner.query(`SELECT clave,naturaleza,usuario_id AS "usuarioId",
        solicitud_canonica AS "solicitudCanonica" FROM public.operaciones_credito_e1
        WHERE productor=$1 AND clave=$2`, [productor, clave])).rows[0] ?? null;
    },
    async insertOperation(record) {
      return (await owner.query(`INSERT INTO public.operaciones_credito_e1
        (productor,clave,naturaleza,usuario_id,solicitud_canonica) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (productor,clave) DO NOTHING`, [
        record.productor, record.clave, record.naturaleza, record.usuarioId, record.solicitudCanonica,
      ])).rowCount === 1;
    },
    async loadMovement(productor, clave) {
      return (await owner.query(`SELECT * FROM public.movimientos_credito
        WHERE operacion_productor=$1 AND operacion_clave=$2`, [productor, clave])).rows[0] ?? null;
    },
  }, input);
  assert.equal(result.replay, false, "Fresh generated fixture operation must not replay");
}
async function insert(c: any, table: string, values: Record<string, unknown>) {
  const keys = Object.keys(values);
  const result = await c.query(`INSERT INTO public.${table} (${keys.join(",")})
    VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`, Object.values(values));
  return result.rows[0];
}
async function receiving(fund = 3000) {
  const n = ++serial;
  const initials = `R${String.fromCharCode(65 + Math.floor(n / 26))}${String.fromCharCode(65 + n % 26)}`;
  const site = await insert(owner, "ubicaciones", { nombre: `CR synthetic receiving ${n}`, iniciales: initials, tipo: "TIENDA" });
  const session = await insert(owner, "sesiones_caja", {
    ubicacion_id: site.id, usuario_id: actor, fondo_inicial: money(fund),
    fecha_operativa: (await owner.query("SELECT (clock_timestamp() AT TIME ZONE 'America/Mexico_City')::date::text AS day")).rows[0].day,
  });
  return { site: site.id, session: session.id };
}
async function seed(paid: number, amounts = [1000], cash?: { site: number; session: number }) {
  const destination = cash ?? await receiving();
  await owner.query("BEGIN");
  try {
    const client = await insert(owner, "clientes", { nombre: `CR synthetic client ${++serial}` });
    const total = amounts.reduce((a, b) => a + b, 0);
    const ticket = await insert(owner, "tickets", {
      folio: serial, ubicacion_id: origin, usuario_terminal_id: actor, cliente_id: client.id,
      documento_tipo: "NOTA", subtotal: money(total), total: money(total), iva: "0.00", tasa_iva: "0.0000", cobrado: true,
      credito: true, dias_plazo: 30, fecha_vencimiento: "2099-01-01", uuid_cliente: randomUUID(),
      autorizacion_estado: "AUTORIZADA", autorizado_por: actor, autorizado_at: new Date(),
    });
    const lines: Fixture["lines"] = [];
    for (const amount of amounts) {
      const serie = String(70000000 + ++serial);
      const roll = await insert(owner, "rollos", { serie, producto_id: product, ubicacion_id: origin,
        estado: "VENDIDO", cantidad_inicial: "10.000", cantidad_actual: "0.000" });
      const line = await insert(owner, "ticket_lineas", { ticket_id: ticket.id, rollo_id: roll.id,
        producto_id: product, tipo: "NORMAL", cantidad: "10.000", precio_unitario: money(amount / 10),
        precio_sugerido: money(amount / 10), importe: money(amount),
        costo_unitario_congelado: "10.00", costo_total_congelado: "100.00" });
      for (const [tipo, cantidad, saldo] of [["ALTA", "10.000", "10.000"], ["VENTA", "-10.000", "0.000"]]) {
        await insert(owner, "movimientos", { rollo_id: roll.id, producto_id: product, ubicacion_id: origin,
          tipo, cantidad, saldo_posterior: saldo, usuario_id: actor,
          documento_tipo: tipo === "VENTA" ? "TICKET" : "REHEARSAL", documento_id: String(ticket.id) });
      }
      lines.push({ id: line.id, roll: roll.id, amount, serie });
    }
    const key = randomUUID();
    const saleEvidence = { sitioOrigenId: origin, naturaleza: "OPERACION_CREDITO_SIN_DINERO" as const,
      operacionClave: key, sesionCajaId: null, notaOrigenId: null, origenJustificacion: null };
    await claimSeed({ productor: "VENTA_CREDITO", clave: key,
      naturaleza: saleEvidence.naturaleza, actorId: actor, contenido: {
        ticketId: ticket.id, clienteId: client.id, importe: money(total),
        diasPlazo: 30, fechaVencimiento: "2099-01-01",
        evidencia: saleEvidence, metadata: { origen: "AUTORIZACION_NOTA" },
      } });
    const charge = await insert(owner, "movimientos_credito", { cliente_id: client.id, ticket_id: ticket.id,
      tipo: "VENTA_CREDITO", importe: money(total), usuario_id: actor, sitio_origen_id: origin,
      naturaleza: "OPERACION_CREDITO_SIN_DINERO", operacion_productor: "VENTA_CREDITO", operacion_clave: key,
      dias_plazo: 30, fecha_vencimiento: "2099-01-01", metadata: JSON.stringify({ origen: "AUTORIZACION_NOTA" }),
      created_at: new Date(Date.now() - 2000) });
    let source;
    if (paid) {
      const paymentKey = randomUUID();
      const paymentAt = new Date(Date.now() - 1000);
      const paymentEvidence = { sitioOrigenId: origin, naturaleza: "INGRESO_FISICO" as const,
        operacionClave: paymentKey, sesionCajaId: null, notaOrigenId: null, origenJustificacion: null };
      await claimSeed({ productor: "ABONO_ORDINARIO", clave: paymentKey,
        naturaleza: paymentEvidence.naturaleza, actorId: actor, contenido: {
          clienteId: client.id, importe: money(paid), formaPago: "TRANSFERENCIA", cuentaDestino: "CUENTA_NO_FISCAL",
          referencia: null, notas: null, fechaEfectiva: paymentAt.toISOString(), ticketId: null,
          destinos: [], ...paymentEvidence,
        } });
      source = (await insert(owner, "movimientos_credito", { cliente_id: client.id, tipo: "ABONO",
        importe: money(-paid), usuario_id: actor, sitio_origen_id: origin,
        naturaleza: "INGRESO_FISICO", operacion_productor: "ABONO_ORDINARIO", operacion_clave: paymentKey,
        forma_pago: "TRANSFERENCIA", cuenta_destino: "CUENTA_NO_FISCAL", created_at: paymentAt })).id;
      await insert(owner, "aplicaciones_credito", {
        abono_movimiento_id: source, venta_movimiento_id: charge.id, importe: money(paid),
      });
    }
    await owner.query("COMMIT"); // immutable baseline exists BEFORE return transactions
    const f = { client: client.id, ticket: ticket.id, charge: charge.id, source, lines, ...destination };
    fixtures.push(f);
    return f;
  } catch (error) { await owner.query("ROLLBACK"); throw error; }
}
function request(f: Fixture, debt: number, refund: number, line = 0) {
  return { uuidCliente: randomUUID(), ticketId: f.ticket, lineaId: f.lines[line].id,
    ubicacionRecepcionId: f.site, sesionCajaId: f.session, cantidad: "10.000", motivo: "Synthetic full-roll rehearsal",
    revision: { importeRollo: money(f.lines[line].amount), deudaCancelada: money(debt), efectivoDevuelto: money(refund) } };
}
async function rawReturn(f: Fixture, debt: number, refund: number, bypass = false) {
  const c = await runtimePool.connect();
  try {
    await c.query("BEGIN");
    if (bypass) {
      await c.query("SET LOCAL app.commercial_return_closed_guard='on'");
      await c.query("SET LOCAL app.credit_closed_guard='on'");
    }
    const req = request(f, debt, refund), id = randomUUID(), at = new Date();
    const line = f.lines[0];
    await c.query("UPDATE public.rollos SET estado='DISPONIBLE',cantidad_actual=10,ubicacion_id=$2 WHERE id=$1", [line.roll, f.site]);
    const inventory = await insert(c, "movimientos", { rollo_id: line.roll, producto_id: product,
      ubicacion_id: f.site, tipo: "DEVOLUCION", cantidad: "10.000", saldo_posterior: "10.000",
      usuario_id: actor, documento_tipo: "DEVOLUCION_COMERCIAL", documento_id: id });
    await insert(c, "operaciones_credito_e1", { productor: "DEVOLUCION_COMERCIAL", clave: id,
      naturaleza: "OPERACION_CREDITO_SIN_DINERO", usuario_id: actor, solicitud_canonica: req });
    const credit = await insert(c, "movimientos_credito", { cliente_id: f.client, ticket_id: f.ticket,
      tipo: "DEVOLUCION_COMERCIAL", importe: money(-debt), usuario_id: actor, sitio_origen_id: f.site,
      naturaleza: "OPERACION_CREDITO_SIN_DINERO", operacion_productor: "DEVOLUCION_COMERCIAL",
      operacion_clave: id, movimiento_origen_id: f.charge, origen_justificacion: req.motivo, created_at: at,
      metadata: JSON.stringify({ commercialReturnId: id, importeRollo: req.revision.importeRollo, efectivoDevuelto: money(refund) }) });
    const outflow = refund ? await insert(c, "salidas_dinero_caja", { sesion_caja_id: f.session,
      monto: money(refund), motivo: req.motivo, cuenta_origen: "CAJA_FISICA", creado_por_id: actor }) : null;
    const response = { id, ticketId: f.ticket, lineaId: line.id, rolloId: line.roll, serie: line.serie,
      cantidad: req.cantidad, ubicacionRecepcionId: f.site, sesionCajaId: f.session, motivo: req.motivo,
      ...req.revision, createdAt: at.toISOString() };
    await insert(c, "devoluciones_comerciales", { id, uuid_cliente: req.uuidCliente, ticket_id: f.ticket,
      linea_id: line.id, rollo_id: line.roll, ubicacion_recepcion_id: f.site, sesion_caja_id: f.session,
      actor_id: actor, cantidad: req.cantidad, importe_rollo: req.revision.importeRollo,
      deuda_cancelada: money(debt), efectivo_devuelto: money(refund), motivo: req.motivo,
      movimiento_inventario_id: inventory.id, movimiento_credito_id: credit.id, salida_caja_id: outflow?.id ?? null,
      fuentes_pago: f.source ? [f.source] : [], request: req, response, created_at: at });
    await c.query("SET CONSTRAINTS ALL IMMEDIATE");
    await c.query("COMMIT");
    return response;
  } catch (error) { await c.query("ROLLBACK"); throw error; } finally { c.release(); }
}
async function state(f: Fixture) {
  return (await owner.query(`SELECT
    (SELECT count(*)::int FROM public.devoluciones_comerciales WHERE ticket_id=$1) returns,
    (SELECT count(*)::int FROM public.movimientos_credito WHERE ticket_id=$1 AND tipo::text='DEVOLUCION_COMERCIAL') credits,
    (SELECT count(*)::int FROM public.salidas_dinero_caja WHERE sesion_caja_id=$2) outflows,
    (SELECT estado::text FROM public.rollos WHERE id=$3) stock`, [f.ticket, f.session, f.lines[0].roll])).rows[0];
}
async function check(name: string, fn: () => Promise<void>) {
  await fn(); passed.push(name); console.log(`PASS ${name}`);
}
async function retrySerialization<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await operation(); } catch (error) {
      // Installed E5 deliberately aborts concurrent writers with 40001 rather
      // than waiting on its global graph lock. Restart the WHOLE transaction;
      // never suppress constraints or retry a statement in a failed transaction.
      const code = (error as any)?.code ?? (error as any)?.cause?.code;
      if (code !== "40001" || attempt >= 4) throw error;
      console.log(`RETRY complete concurrent transaction: SQLSTATE 40001 (${attempt + 1}/4)`);
      await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
}
try {
  const identity = (await owner.query("SELECT current_database() db,system_identifier::text system FROM pg_control_system()")).rows[0];
  assert.equal(identity.db, "continuation_return_test"); assert.equal(identity.system, pin);
  const activity = (await owner.query(`SELECT pid,datname,state,wait_event_type
    FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND backend_type='client backend'
      AND state IS DISTINCT FROM 'idle'`)).rows;
  assert.deepEqual(activity, [], "Private cluster has other active/idle-in-transaction clients. MAIN must finish/cancel its other rehearsal first; runner makes no fixture writes.");
  assert.equal(Number((await owner.query(`SELECT
    (SELECT count(*) FROM public.usuarios)+(SELECT count(*) FROM public.clientes)+
    (SELECT count(*) FROM public.productos)+(SELECT count(*) FROM public.rollos)+
    (SELECT count(*) FROM public.tickets)+(SELECT count(*) FROM public.movimientos_credito)+
    (SELECT count(*) FROM public.operaciones_credito_e1)+(SELECT count(*) FROM public.sesiones_caja) n`)).rows[0].n), 0,
    "Requires fresh schema-only restore; never reuse another rehearsal's data");
  assert.equal((await owner.query("SELECT enabled FROM public.commercial_return_gate WHERE id=1")).rows[0]?.enabled, false);
  assert.ok((await owner.query("SELECT to_regprocedure('public.commercial_return_assert_financial(uuid)') installed")).rows[0].installed);
  creditContract = await import("../../artifacts/api-server/src/lib/credit-evidence-contract");
  await owner.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);
  runtimeCreated = true;
  await owner.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    GRANT USAGE ON SCHEMA public TO ${role};
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${role};
    GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role};
    REVOKE INSERT,UPDATE,DELETE ON public.commercial_return_gate,public.commercial_return_customer_fence,public.commercial_return_cash_fence FROM ${role}`);
  execFileSync("psql", ["-X", ownerUrl, "-v", "ON_ERROR_STOP=1", "-v", `runtime_role=${role}`,
    "-f", fileURLToPath(new URL("./03-runtime-role.sql", import.meta.url))], { stdio: ["ignore", "pipe", "pipe"] });
  actor = (await insert(owner, "usuarios", { nombre: "Synthetic rehearsal ADMIN", usuario: `synthetic_${randomUUID()}`,
    password_hash: `!disabled-login-${randomBytes(32).toString("hex")}`, rol: "ADMIN", alcance_consulta: "TODAS" })).id;
  origin = (await insert(owner, "ubicaciones", { nombre: "CR synthetic origin", iniciales: "ORG", tipo: "TIENDA" })).id;
  product = (await insert(owner, "productos", { sku: "CR-SYNTHETIC", tela: "Synthetic", color: "Rehearsal", unidad: "METRO" })).id;
  const partial = await seed(800), paid = await seed(1000), unpaid = await seed(0);
  const multi = await seed(800, [400, 600]), rollback = await seed(800), malicious = await seed(800);
  const sameSession = await receiving(800);
  const concurrent = [await seed(800, [1000], sameSession), await seed(800, [1000], sameSession)];
  const rawSession = await receiving(800);
  const rawConcurrent = [await seed(800, [1000], rawSession), await seed(800, [1000], rawSession)];
  await owner.query("UPDATE public.commercial_return_gate SET enabled=true WHERE id=1");
  gateEnabled = true;
  endpoint.username = role; endpoint.password = password;
  endpoint.searchParams.set("application_name", "commercial-return-rehearsal-runtime");
  // Independent guard above is stricter than the general application test guard.
  // Do not let that guard connect APPLICATION_DATABASE_URL even for identification.
  delete process.env.TEST_DATABASE_URL;
  delete process.env.REQUIRE_ISOLATED_TEST_DATABASE;
  delete process.env.APPLICATION_DATABASE_URL;
  process.env.NODE_ENV = "development";
  process.env.DATABASE_URL = endpoint.toString();
  const database = await import("../../lib/db/src/index");
  const service = await import("../../artifacts/api-server/src/lib/commercial-return");
  runtimePool = database.pool;
  const call = (f: Fixture, req: ReturnType<typeof request>) =>
    database.db.transaction(tx => service.commercialReturnInTransaction(tx, actor, req, "127.0.0.1"));
  for (const [name, f, debt, refund] of [
    ["partial 1000/800/200", partial, 200, 800],
    ["fully paid zero-debt event", paid, 0, 1000],
    ["fully unpaid zero-cash return", unpaid, 1000, 0],
  ] as const) {
    await check(name, async () => {
      const result = await call(f, request(f, debt, refund));
      assert.equal(result.deudaCancelada, money(debt)); assert.equal(result.efectivoDevuelto, money(refund));
      const actual = await state(f);
      assert.equal(actual.returns, 1); assert.equal(actual.credits, 1); assert.equal(actual.stock, "DISPONIBLE");
      assert.equal(actual.outflows, refund ? 1 : 0);
      const projection = (await owner.query("SELECT public.commercial_return_projection($1,2147483647) p", [f.client])).rows[0].p;
      assert.equal(projection.debt, 0); assert.equal(projection.favor, 0);
      assert.equal((await owner.query("SELECT importe::text FROM public.movimientos_credito WHERE id=$1", [f.charge])).rows[0].importe, "1000.00");
      const stock = (await owner.query("SELECT serie,cantidad_actual::text qty,ubicacion_id site FROM public.rollos WHERE id=$1", [f.lines[0].roll])).rows[0];
      assert.deepEqual(stock, { serie: f.lines[0].serie, qty: "10.000", site: f.site });
    });
  }
  await check("same-note two rolls; uncertain committed response identical retry", async () => {
    const req = request(multi, 80, 320);
    await call(multi, req); // deliberately discard response, simulating connection loss after commit
    const recovered = await call(multi, req), repeated = await call(multi, req);
    assert.deepEqual(recovered, repeated); assert.equal((await state(multi)).returns, 1);
    await call(multi, request(multi, 120, 480, 1));
    const sums = (await owner.query("SELECT sum(deuda_cancelada)::text debt,sum(efectivo_devuelto)::text refund FROM public.devoluciones_comerciales WHERE ticket_id=$1", [multi.ticket])).rows[0];
    assert.deepEqual(sums, { debt: "200.00", refund: "800.00" });
  });
  await check("forced transaction rollback leaves no return, credit, cash or inventory change", async () => {
    const before = await state(rollback);
    await assert.rejects(database.db.transaction(async tx => {
      await service.commercialReturnInTransaction(tx, actor, request(rollback, 200, 800), "127.0.0.1");
      throw new Error("REHEARSAL_FORCED_ROLLBACK");
    }), /REHEARSAL_FORCED_ROLLBACK/);
    assert.deepEqual(await state(rollback), before);
  });
  await check("malicious SQL consistent mirrors 1000/900/100 and forged guard flags rejected", async () => {
    const before = await state(malicious);
    // Reduction 100 fits pending debt 200: only exact allocation certification,
    // not a simplistic over-cancellation bound, can reject this forged split.
    await assert.rejects(rawReturn(malicious, 100, 900, true), /DEVOLUCION_REPARTO_NO_CANONICO/);
    assert.deepEqual(await state(malicious), before);
  });
  await check("concurrent service returns cannot spend same 800 cash twice", async () => {
    const results = await Promise.allSettled(concurrent.map(f => call(f, request(f, 200, 800))));
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    const failure = results.find(r => r.status === "rejected") as PromiseRejectedResult;
    assert.match(String(failure.reason), /efectivo|EFECTIVO/i);
    assert.equal((await owner.query("SELECT sum(monto)::text total FROM public.salidas_dinero_caja WHERE sesion_caja_id=$1", [sameSession.session])).rows[0].total, "800.00");
  });
  await check("concurrent direct SQL canonical captures cannot spend same cash twice", async () => {
    const results = await Promise.allSettled(rawConcurrent.map(f =>
      retrySerialization(() => rawReturn(f, 200, 800))));
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    const failure = results.find(r => r.status === "rejected") as PromiseRejectedResult;
    assert.match(String(failure.reason), /DEVOLUCION_EFECTIVO_NO_CONCILIADO/);
  });
  await check("linked event mutation rejected under nonowner runtime", async () => {
    await assert.rejects(runtimePool.query("UPDATE public.movimientos_credito SET importe=-1 WHERE ticket_id=$1 AND tipo::text='DEVOLUCION_COMERCIAL'", [partial.ticket]),
      /INMUTABLE|PROTEGIDA|immutable|inmutable/i);
  });
  console.log(JSON.stringify({ status: "PASS", tests: passed.length, database: identity.db,
    runtimeRole: role, syntheticCustomerIds: fixtures.map(f => f.client), gatesRemainClosedInProduct: true }));
} finally {
  if (runtimePool) await runtimePool.end();
  // Leave auditable fixtures, disable the generated login, close only the private gate.
  if (gateEnabled) await owner.query("UPDATE public.commercial_return_gate SET enabled=false WHERE id=1");
  if (runtimeCreated) await owner.query(`ALTER ROLE ${role} NOLOGIN PASSWORD NULL`);
  await owner.end();
}