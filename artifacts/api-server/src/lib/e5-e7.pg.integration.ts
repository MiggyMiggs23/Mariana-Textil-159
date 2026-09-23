import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db, pool } from "@workspace/db";
import { E5_ENABLED, E5_CONTADOR_A_ENABLED } from "./e5-feature";
import { e5OffBoundary } from "./e5-http";
import { e5Command, type E5Actor } from "./e5";
import { e5Repository, type E5Dependencies } from "./e5-repository";
import { loadCustomerCreditLedgerInTransaction } from "./credit-aging-read-model";
import { E7_ATTRIBUTION_ENABLED, E7_E5_READ_SOURCE_ENABLED } from "./e7-feature";
import { createE7Reader } from "./e7-read-model";

if (process.env.REQUIRE_ISOLATED_TEST_DATABASE !== "1" || !process.env.TEST_DATABASE_URL) {
  throw new Error("E5/E7 PostgreSQL verification requires the focused disposable runner.");
}
const e7Reader = createE7Reader({
  database: pool,
  transaction: async work => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
});
const actor: E5Actor = {
  id: 1,
  nombre: "ADMIN disposable",
  rol: "ADMIN",
  ubicacionId: null,
  ip: "127.0.0.1",
  ver: true,
  recibirCaja: true,
  recibirCliente: true,
  todas: true,
  capacidadAE11: false,
};
const dependencies: E5Dependencies = {
  ledger: (tx, client) => loadCustomerCreditLedgerInTransaction(client, tx),
  async cash() { throw new Error("Disposable E5 lifecycle must not use a cash refund."); },
};
const evidence = { descripcion: "Evidencia PostgreSQL desechable", referencias: ["PG-E5-1"] };

const before = await pool.query<{ e5: string; credit: string }>(`
  SELECT
    (SELECT count(*)::text FROM e5_recepciones) AS e5,
    (SELECT count(*)::text FROM movimientos_credito) AS credit`);

try {
  assert.equal(E5_ENABLED, false);
  assert.equal(E5_CONTADOR_A_ENABLED, false);
  assert.equal(E7_E5_READ_SOURCE_ENABLED, true);
  assert.equal(E7_ATTRIBUTION_ENABLED, true);

  let status = 0;
  let body: unknown;
  e5OffBoundary(
    { method: "POST", path: "/cobros" } as never,
    {
      status(value: number) { status = value; return this; },
      json(value: unknown) { body = value; },
    } as never,
    () => assert.fail("E5 OFF boundary must not continue"),
  );
  assert.equal(status, 403);
  assert.equal((body as { error: { code: string } }).error.code, "E5_DISABLED");

  const identities = await pool.query<{ user_id: number; client_id: number; site_id: number }>(`
    SELECT
      (SELECT id FROM usuarios ORDER BY id LIMIT 1) AS user_id,
      (SELECT id FROM clientes ORDER BY id LIMIT 1) AS client_id,
      (SELECT id FROM ubicaciones WHERE tipo='TIENDA' ORDER BY id LIMIT 1) AS site_id`);
  const identity = identities.rows[0];
  assert.ok(identity?.user_id && identity.client_id && identity.site_id, "canonical seed identities required");

  // The database guard is independent of the source gate and rejects a
  // producer even when called directly.
  await assert.rejects(
    () => pool.query(`
      INSERT INTO e5_recepciones
        (id,cliente_id,ubicacion_id,importe,fecha_recepcion,medio,cuenta_destino,actor_id,snapshot)
      VALUES ($1,$2,$3,10,now(),'TRANSFERENCIA','CUENTA_FISCAL',$4,'{}'::jsonb)`,
    [randomUUID(), identity.client_id, identity.site_id, identity.user_id]),
    (error: unknown) => {
      const value = error as { code?: string; message?: string };
      return value.code === "P0001" && value.message?.startsWith("E5_DISABLED:") === true;
    },
  );

  // Explicit test-only activation: remove only the blanket E5 construction
  // trigger in this disposable cluster. The E1 retained-source guard, directed
  // marker guards, graph constraints and immutable evidence guards remain ON.
  assert.equal(process.env.E5_DISPOSABLE_LIFECYCLE, "1");
  await pool.query(`
    DO $$
    DECLARE table_name text;
    BEGIN
      FOREACH table_name IN ARRAY ARRAY[
        'e5_recepciones','e5_cobros','e5_aplicaciones','e5_vinculos_credito',
        'e5_salidas_bancarias','e5_devoluciones','e5_documentos','e5_operaciones',
        'e5_impresiones'
      ] LOOP
        EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER e5_closed',table_name);
      END LOOP;
    END $$`);
  const protectedTriggers = await pool.query<{ name: string; enabled: string }>(`
    SELECT tgname AS name,tgenabled AS enabled FROM pg_trigger
    WHERE tgname IN (
      'zz_e1_pending_receipts_closed','e5_favor_initial_guard','e5_graph'
    )`);
  assert.equal(protectedTriggers.rows.length >= 3, true);
  assert.equal(
    protectedTriggers.rows.every(row => row.enabled === "O"),
    true,
    "retained/directed/graph guards must remain enabled",
  );

  const receive = async (receipt: string, noteId: number) => db.transaction(async tx => {
    const repo = e5Repository(tx, dependencies);
    const context = await repo.context(1, 1, actor);
    return e5Command(repo, actor, "RECIBIR", {
      claveOperacion: receipt,
      clienteId: 1,
      ubicacionId: 1,
      versionContexto: context.versionContexto,
      entrada: "CLIENTE",
      importe: "10.00",
      formaPago: "TRANSFERENCIA",
      cuentaDestino: "CUENTA_FISCAL",
      notasIndicadas: [noteId],
      evidencia: evidence,
    }, undefined, true);
  });

  // Real receive -> propose succeeds. Authorization currently proves the exact
  // integration blocker and atomic rollback: E1 rejects the installed E5
  // producer before its directed marker can be committed.
  const receiptApplied = "50000000-0000-4000-8000-000000000001";
  const received = await receive(receiptApplied, 10);
  assert.equal(received.estado, "PENDIENTE");
  const proposed = await db.transaction(async tx => {
    const repo = e5Repository(tx, dependencies);
    const context = await repo.context(1, 1, actor);
    return e5Command(repo, actor, "PROPONER", {
      claveOperacion: "50000000-0000-4000-8000-000000000002",
      revisionEsperada: 1,
      versionContexto: context.versionContexto,
      asignaciones: [{ notaId: 10, movimientoVentaId: 100, importe: "10.00" }],
      evidencia: evidence,
    }, receiptApplied, true);
  });
  const authorized = await db.transaction(async tx => {
    const repo = e5Repository(tx, dependencies);
    const context = await repo.context(1, 1, actor);
    return e5Command(repo, actor, "AUTORIZAR", {
      claveOperacion: "50000000-0000-4000-8000-000000000003",
      revisionEsperada: 2,
      versionContexto: context.versionContexto,
      propuestaId: proposed.propuestaVigenteId,
      asignaciones: [{ notaId: 10, movimientoVentaId: 100, importe: "10.00" }],
      evidencia: evidence,
    }, receiptApplied, true);
  });
  assert.equal(authorized.estado, "APLICADO");
  const appliedFacts = await pool.query<{ revision: number; applications: string; directed: string; links: string }>(`
    SELECT c.revision,
      (SELECT count(*)::text FROM e5_aplicaciones WHERE cobro_id=c.id) applications,
      (SELECT count(*)::text FROM solicitudes_pago_dirigido d
        JOIN movimientos_credito m ON m.id=d.movimiento_id
        WHERE m.operacion_productor='E5_APLICACION_RETENIDA') directed,
      (SELECT count(*)::text FROM e5_vinculos_credito v
        JOIN e5_aplicaciones a ON a.id=v.aplicacion_id WHERE a.cobro_id=c.id) links
    FROM e5_cobros c WHERE c.id=$1`, [receiptApplied]);
  assert.deepEqual(appliedFacts.rows[0],
    { revision: 3, applications: "1", directed: "1", links: "1" });

  // A separate never-applied receipt can be refunded through an evidenced bank
  // source. Fondo and cash producers are not exercised.
  const receiptRefunded = "50000000-0000-4000-8000-000000000004";
  await receive(receiptRefunded, 11);
  const refunded = await db.transaction(tx => e5Command(
    e5Repository(tx, dependencies),
    actor,
    "DEVOLVER",
    {
      claveOperacion: "50000000-0000-4000-8000-000000000005",
      revisionEsperada: 1,
      peticionCliente: "Solicitud expresa probada en PostgreSQL desechable",
      evidencia: evidence,
      fuente: { tipo: "CUENTA", ubicacionId: 1, cuentaOrigen: "CUENTA_FISCAL" },
    },
    receiptRefunded,
    true,
  ));
  assert.equal(refunded.estado, "DEVUELTO");
  const refundFacts = await pool.query<{ refunds: string; bank: string }>(`
    SELECT
      (SELECT count(*)::text FROM e5_devoluciones WHERE cobro_id=$1) refunds,
      (SELECT count(*)::text FROM e5_salidas_bancarias WHERE cobro_id=$1) bank`,
  [receiptRefunded]);
  assert.deepEqual(refundFacts.rows[0], { refunds: "1", bank: "1" });

  // Exercise the production E7 SQL adapter in a real read-only transaction.
  const sessionId = randomUUID();
  await pool.query(
    `INSERT INTO sesiones(id,usuario_id,expira_at,ip,user_agent,created_at)
     VALUES ($1,$2,now()+interval '1 hour','127.0.0.1','e5-e7-disposable',now())`,
    [sessionId, identity.user_id],
  );
  const result = await e7Reader.attribution(
    { userId: identity.user_id, sessionId },
    { desde: "2026-01-01", hasta: "2026-12-31" },
  );
  assert.equal(result.alcance.tipo, "GLOBAL");
  assert.equal(result.cobranzaTotal, "10.00");
  assert.equal(result.recepcionesFisicas, "20.00");
  assert.equal(result.aplicacionesNotas, "0.00");
  assert.equal(result.totalRetenido, "0.00");

  const after = await pool.query<{ e5: string; credit: string }>(`
    SELECT
      (SELECT count(*)::text FROM e5_recepciones) AS e5,
      (SELECT count(*)::text FROM movimientos_credito) AS credit`);
  assert.deepEqual(after.rows[0], { e5: "2", credit: "3" });
  process.stdout.write("E5_RECEIVE_PROPOSE_APPLY_REFUND_E7_DISPOSABLE_PASS\n");
} finally {
  await pool.end();
}