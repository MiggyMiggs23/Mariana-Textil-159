/**
 * PROPOSED operator module; inert on import. No CLI or automatic connection.
 * Call only after separate authorization, against the named disposable clone.
 * Fixtures are synthetic and deliberately do not exercise physical inventory.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import type { Tx } from "../../artifacts/api-server/src/lib/inventario";
import { assertCloneIdentity, createRehearsalLoader } from "./e1-rehearsal-loader.mts";

type Database = typeof import("../../lib/db/src/index").db;
export type PosCaseResult = { name: string; status: "PASS" | "FAIL"; message?: string };
export type PosRehearsalContext = {
  pool: Pool;
  record?: (result: PosCaseResult) => void | Promise<void>;
};
export const POS_TARGET = Object.freeze({
  socketDirectory: "/tmp/prompt-h-block2-20260917165108-3655-3655",
  port: 5432,
  database: "restore_disposable_20260917165108-3655",
});
export const POS_IDS = Object.freeze({
  site: 1872000101, actor: 1872000101, session: 1872000101,
  customer: 1872000101, note: 1872000101, overLimitNote: 1872000102,
  salida: 1872000101,
});
const key = (suffix: number) => `e1170000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const SALE_KEY = key(121);
const CANCEL_KEY = key(122);
const OVER_LIMIT_KEY = key(123);
const MOTIVE = "Ensayo E1 cancelacion de nota sintetica";
const apiRequire = createRequire(new URL("../../artifacts/api-server/package.json", import.meta.url));

/** Complete deterministic fixture DML; MASTER owns its transaction and target guard. */
export const POS_FIXTURE_SQL = `
INSERT INTO public.ubicaciones (id,nombre,iniciales,tipo,activa,created_at)
VALUES (1872000101,'E1 POS rehearsal 20260917','EPR','TIENDA',true,'2026-09-17T12:00:00Z');
INSERT INTO public.usuarios
 (id,nombre,usuario,password_hash,rol,ubicacion_id,activo,alcance_consulta,created_at)
VALUES (1872000101,'E1 POS synthetic actor','e1_pos_rehearsal_20260917',
 '!E1_DISABLED_NO_LOGIN!','ADMIN',1872000101,true,'TODAS','2026-09-17T12:00:00Z');
INSERT INTO public.clientes
 (id,nombre,activo,es_sistema,dias_credito,limite_credito,saldo_credito,created_at,updated_at)
VALUES (1872000101,'E1 POS synthetic customer',true,false,7,1000.00,0.00,
 '2026-09-17T12:00:00Z','2026-09-17T12:00:00Z');
INSERT INTO public.sesiones_caja
 (id,ubicacion_id,usuario_id,abierta_at,fecha_operativa,fondo_inicial,estado)
VALUES (1872000101,1872000101,1872000101,'2026-09-17T12:00:00Z','2026-09-17',0.00,'ABIERTA');
INSERT INTO public.tickets
 (id,folio,ubicacion_id,usuario_terminal_id,cliente_id,documento_tipo,subtotal,iva,tasa_iva,
 total,estado,cobrado,facturado,credito,dias_plazo,fecha_vencimiento,uuid_cliente,
 created_at,autorizacion_estado)
VALUES
 (1872000101,1872000101,1872000101,1872000101,1872000101,'NOTA',100.00,0.00,0.0000,
 100.00,'VENDIDO',false,false,true,7,'2026-09-24',
 'e1170000-0000-4000-8000-000000000101','2026-09-17T12:00:00Z','PENDIENTE'),
 (1872000102,1872000102,1872000101,1872000101,1872000101,'NOTA',1001.00,0.00,0.0000,
 1001.00,'VENDIDO',false,false,true,7,'2026-09-24',
 'e1170000-0000-4000-8000-000000000102','2026-09-17T12:00:00Z','PENDIENTE');
INSERT INTO public.salidas
 (id,folio,origen_id,cliente_id,ticket_id,modalidad,estado,usuario_solicita_id,uuid_cliente,
 created_at,actividad_at,recibida_at)
VALUES (1872000101,1872000101,1872000101,1872000101,1872000101,
 'VENTA_CLIENTE','RECIBIDA',1872000101,'e1170000-0000-4000-8000-000000000111',
 '2026-09-17T12:00:00Z','2026-09-17T12:00:00Z','2026-09-17T12:00:00Z');
`;
export const fixtureSql = POS_FIXTURE_SQL;

// Whole fixture rows, including immutable IDs/timestamps, rather than counts only.
// Do not compare sequences: PostgreSQL sequences intentionally survive rollback.
const SNAPSHOT_SQL = `
SELECT jsonb_build_object(
 'operations',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY productor,clave),'[]') FROM public.operaciones_credito_e1 x WHERE usuario_id=1872000101),
 'ledger',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM public.movimientos_credito x WHERE cliente_id=1872000101),
 'tickets',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM public.tickets x WHERE id IN (1872000101,1872000102)),
 'authorizations',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM public.autorizaciones_nota x WHERE ticket_id IN (1872000101,1872000102)),
 'notifications',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM public.notificaciones_credito x WHERE cliente_id=1872000101),
 'audit',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM public.auditoria x WHERE usuario_id=1872000101),
 'salida',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM public.salidas x WHERE id=1872000101),
 'session',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM public.sesiones_caja x WHERE id=1872000101),
 'customer',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM public.clientes x WHERE id=1872000101),
 'actor',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM public.usuarios x WHERE id=1872000101),
 'inventory',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM public.movimientos x WHERE documento_id IN ('1872000101','1872000102')),
 'applications',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM public.aplicaciones_credito x WHERE abono_movimiento_id IN (SELECT id FROM public.movimientos_credito WHERE cliente_id=1872000101) OR venta_movimiento_id IN (SELECT id FROM public.movimientos_credito WHERE cliente_id=1872000101))
) AS snapshot`;
type Snapshot = Record<string, Array<Record<string, unknown>>>;
async function snapshot(client: Pool): Promise<Snapshot> {
  return (await client.query(SNAPSHOT_SQL)).rows[0].snapshot;
}

export async function runPosCases(context: PosRehearsalContext) {
  await assertCloneIdentity(context.pool);
  const loader = createRehearsalLoader({ pool: context.pool });
  const db = loader.db as Database;
  const { autorizarNota, cancelarTicket } = loader.loadModule("artifacts/api-server/src/lib/pos.ts") as typeof import("../../artifacts/api-server/src/lib/pos");
  const { cancelarSalidaODocumentoLigado, buildSalidaDetail } = loader.loadModule("artifacts/api-server/src/lib/salidas.ts") as typeof import("../../artifacts/api-server/src/lib/salidas");
  const { sql } = apiRequire("drizzle-orm") as typeof import("../../artifacts/api-server/node_modules/drizzle-orm");
  const results: PosCaseResult[] = [];
  async function caseOf(name: string, body: () => Promise<void>) {
    try {
      await body();
      const result: PosCaseResult = { name, status: "PASS" };
      results.push(result);
      await context.record?.(result);
    } catch (error) {
      // No SQL, parameter arrays, credentials or connection strings are reported.
      const result: PosCaseResult = { name, status: "FAIL", message: error instanceof assert.AssertionError ? error.message : "Execution failed; owner must inspect the original error safely" };
      results.push(result);
      await context.record?.(result);
      throw error;
    }
  }
  const request = { auth: { user: { id: POS_IDS.actor, rol: "ADMIN", ubicacionId: POS_IDS.site } } } as NonNullable<Parameters<typeof autorizarNota>[1]["creditRequest"]>;
  const evidence = (operationKey: string, noteId: number = POS_IDS.note): Record<string, unknown> => ({
    sitioOrigenId: POS_IDS.site, naturaleza: "OPERACION_CREDITO_SIN_DINERO",
    operacionClave: operationKey, sesionCajaId: null, notaOrigenId: noteId,
    origenJustificacion: "Ensayo E1 clone POS",
  });
  const authorize = (tx: Tx, data: unknown = evidence(SALE_KEY), ticketId: number = POS_IDS.note) =>
    autorizarNota(tx, {
      ticketId, sesionCajaId: POS_IDS.session, usuarioId: POS_IDS.actor,
      ip: "127.0.0.1", creditRequest: request, creditEvidence: data,
    }, false);
  const cancel = (tx: Tx, data: unknown = evidence(CANCEL_KEY), motivo = MOTIVE, onReplay?: () => void) =>
    cancelarTicket(tx, {
      ticketId: POS_IDS.note, requestedSalidaId: POS_IDS.salida,
      usuarioId: POS_IDS.actor, autorizadoPor: POS_IDS.actor, motivo,
      ip: "127.0.0.1", creditRequest: request, creditEvidence: data, onCreditReplay: onReplay,
    }, false);
  const linkedCancel = async (tx: Tx, data: unknown = evidence(CANCEL_KEY), motivo = MOTIVE, onReplay?: () => void) => {
    const header = (await tx.execute(sql`SELECT id AS "salidaId", modalidad, ticket_id AS "ticketId"
      FROM public.salidas WHERE id=${POS_IDS.salida}`)).rows[0];
    assert.ok(header, "Linked salida fixture missing");
    return cancelarSalidaODocumentoLigado({
      salidaId: Number(header.salidaId), modalidad: String(header.modalidad),
      ticketId: header.ticketId == null ? null : Number(header.ticketId),
    }, {
      cancelarDocumento: async (ticketId, salidaId) => {
        assert.equal(ticketId, POS_IDS.note);
        assert.equal(salidaId, POS_IDS.salida);
        await cancel(tx, data, motivo, onReplay);
      },
      buildSalida: () => buildSalidaDetail(tx, POS_IDS.salida),
      cancelarSalida: async () => { throw new Error("Unexpected standalone cancellation branch"); },
    }, null);
  };
  const e1Error = (status: number, message: RegExp) => (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.name, "CreditEvidenceError");
    assert.equal((error as Error & { status: number }).status, status);
    assert.match(error.message, message);
    return true;
  };
  async function rejectsUnchanged(body: () => Promise<unknown>, checkError: (error: unknown) => boolean) {
    const before = await snapshot(context.pool);
    await assert.rejects(body, checkError);
    assert.deepEqual(await snapshot(context.pool), before);
  }
  await caseOf("POS fixture prerequisites are exact and unused", async () => {
    const state = await snapshot(context.pool);
    assert.equal(state.tickets.length, 2);
    assert.equal(state.customer[0]?.limite_credito, 1000);
    assert.equal(state.session[0]?.estado, "ABIERTA");
    assert.equal(state.salida[0]?.estado, "RECIBIDA");
    assert.ok(state.tickets.every(t => t.autorizacion_estado === "PENDIENTE"));
    for (const name of ["operations", "ledger", "authorizations", "notifications", "audit", "inventory", "applications"]) {
      assert.equal(state[name].length, 0, `Fixture contamination: ${name}`);
    }
  });
  const invalidInputs = [
    { name: "legacy missing all E1 metadata", change: (_value: Record<string, unknown>) => ({}), pattern: /Actualiza la aplicación/ },
    { name: "missing origin", change: (value: Record<string, unknown>) => { const { sitioOrigenId, ...rest } = value; return rest; }, pattern: /Actualiza la aplicación/ },
    { name: "missing nature", change: (value: Record<string, unknown>) => { const { naturaleza, ...rest } = value; return rest; }, pattern: /Actualiza la aplicación/ },
    { name: "unknown nature", change: (value: Record<string, unknown>) => ({ ...value, naturaleza: "NO_EXISTE" }), pattern: /naturaleza desconocida/ },
    { name: "incompatible correction nature", change: (value: Record<string, unknown>) => ({ ...value, naturaleza: "CORRECCION_CONTABLE" }), pattern: /naturaleza incompatible/ },
  ];
  for (const invalid of invalidInputs) {
    await caseOf(`VENTA_CREDITO rejects ${invalid.name} without residual writes`, () =>
      rejectsUnchanged(() => db.transaction(tx => authorize(tx, invalid.change(evidence(SALE_KEY)))), e1Error(400, invalid.pattern)));
  }
  await caseOf("VENTA_CREDITO real post-ledger credit-limit failure rolls claim and ledger back", async () => {
    await rejectsUnchanged(() => db.transaction(tx =>
      authorize(tx, evidence(OVER_LIMIT_KEY, POS_IDS.overLimitNote), POS_IDS.overLimitNote)), error => {
      assert.ok(error instanceof Error);
      assert.equal((error as Error & { code: string }).code, "CREDIT_LIMIT_EXCEEDED");
      return true;
    });
  });
  let originalAuthorization: unknown;
  await caseOf("VENTA_CREDITO accepts complete E1 evidence and persists exact original result", async () => {
    originalAuthorization = await db.transaction(tx => authorize(tx));
    const state = await snapshot(context.pool);
    assert.equal(state.operations.length, 1);
    assert.equal(state.authorizations.length, 1);
    assert.equal(state.notifications.length, 1);
    assert.equal(state.audit.length, 1);
    assert.equal(state.ledger.length, 1);
    const movement = state.ledger[0];
    assert.equal(movement.importe, 100);
    assert.equal(movement.tipo, "VENTA_CREDITO");
    assert.equal(movement.operacion_productor, "VENTA_CREDITO");
    assert.equal(movement.operacion_clave, SALE_KEY);
    assert.equal(movement.naturaleza, "OPERACION_CREDITO_SIN_DINERO");
    assert.equal(movement.sitio_origen_id, POS_IDS.site);
    assert.equal(movement.sesion_caja_id, null);
    assert.equal(movement.nota_origen_id, POS_IDS.note);
    assert.equal(movement.origen_justificacion, "Ensayo E1 clone POS");
    assert.equal(movement.usuario_id, POS_IDS.actor);
    assert.equal(state.authorizations[0].movimiento_credito_id, movement.id);
    assert.equal(state.tickets[0].autorizacion_estado, "AUTORIZADA");
    assert.equal(state.operations[0].productor, "VENTA_CREDITO");
    assert.equal(state.operations[0].clave, SALE_KEY);
    assert.equal(state.operations[0].usuario_id, POS_IDS.actor);
    assert.equal(state.operations[0].naturaleza, "OPERACION_CREDITO_SIN_DINERO");
    assert.deepEqual(state.operations[0].solicitud_canonica, {
      productor: "VENTA_CREDITO", naturaleza: "OPERACION_CREDITO_SIN_DINERO",
      actorId: POS_IDS.actor,
      intent: {
        ticketId: POS_IDS.note, clienteId: POS_IDS.customer, importe: "100.00",
        diasPlazo: 7, fechaVencimiento: "2026-09-24",
        evidencia: evidence(SALE_KEY), metadata: { origen: "AUTORIZACION_NOTA" },
      },
    });
  });
  for (const invalid of invalidInputs) {
    await caseOf(`CANCELACION_VENTA_CREDITO linked dispatch rejects ${invalid.name} without residual writes`, () =>
      rejectsUnchanged(() => db.transaction(tx => linkedCancel(tx, invalid.change(evidence(CANCEL_KEY)))), e1Error(400, invalid.pattern)));
  }
  await caseOf("CANCELACION_VENTA_CREDITO completed real transaction rolls all dependent state back on abort", async () => {
    const abort = new Error("E1_REHEARSAL_INTENTIONAL_ROLLBACK_AFTER_COMPLETED_CANCELLATION");
    await rejectsUnchanged(() => db.transaction(async tx => {
      await linkedCancel(tx);
      const row = (await tx.execute(sql`SELECT
        (SELECT estado::text FROM public.tickets WHERE id=${POS_IDS.note}) AS ticket,
        (SELECT estado::text FROM public.salidas WHERE id=${POS_IDS.salida}) AS salida,
        (SELECT count(*)::int FROM public.movimientos_credito WHERE cliente_id=${POS_IDS.customer} AND tipo='REVERSO') AS reversals,
        (SELECT count(*)::int FROM public.operaciones_credito_e1 WHERE usuario_id=${POS_IDS.actor}) AS claims,
        (SELECT count(*)::int FROM public.auditoria WHERE usuario_id=${POS_IDS.actor}) AS audits,
        (SELECT count(*)::int FROM public.notificaciones_credito WHERE cliente_id=${POS_IDS.customer} AND leida_at IS NOT NULL) AS read_notifications`)).rows[0];
      assert.deepEqual(row, { ticket: "CANCELADO", salida: "CANCELADA", reversals: 1, claims: 2, audits: 2, read_notifications: 1 });
      throw abort;
    }), error => error === abort);
  });
  await caseOf("VENTA_CREDITO replays original result after cash-session closure with no repeated side effects", async () => {
    await context.pool.query(`UPDATE public.sesiones_caja SET estado='CERRADA',
      cerrada_at='2026-09-17T13:00:00Z',cerrada_por_id=1872000101 WHERE id=1872000101`);
    const before = await snapshot(context.pool);
    const replay = await db.transaction(tx => authorize(tx));
    assert.deepEqual(replay, originalAuthorization);
    assert.deepEqual(await snapshot(context.pool), before);
  });
  await caseOf("VENTA_CREDITO changed immutable evidence conflicts on same key", () =>
    rejectsUnchanged(() => db.transaction(tx => authorize(tx, {
      ...evidence(SALE_KEY), origenJustificacion: "Changed immutable intent",
    })), e1Error(409, /otro contenido|distintos/)));
  await caseOf("VENTA_CREDITO changed ticket amount conflicts and attempted amount edit rolls back", () =>
    rejectsUnchanged(() => db.transaction(async tx => {
      await tx.execute(sql`UPDATE public.tickets SET total=101.00,subtotal=101.00 WHERE id=${POS_IDS.note}`);
      return authorize(tx);
    }), e1Error(409, /otro contenido|distintos/)));
  let originalCancellation: unknown;
  await caseOf("CANCELACION_VENTA_CREDITO accepts complete evidence and reverses the exact charge through linked dispatch", async () => {
    originalCancellation = await db.transaction(tx => linkedCancel(tx));
    const state = await snapshot(context.pool);
    assert.equal(state.operations.length, 2);
    assert.equal(state.ledger.length, 2);
    assert.equal(state.audit.length, 2);
    assert.equal(state.authorizations.length, 1);
    const charge = state.ledger.find(row => row.tipo === "VENTA_CREDITO")!;
    const reversal = state.ledger.find(row => row.tipo === "REVERSO")!;
    assert.equal(reversal.importe, -100);
    assert.equal(reversal.movimiento_origen_id, charge.id);
    assert.equal(reversal.operacion_productor, "CANCELACION_VENTA_CREDITO");
    assert.equal(reversal.operacion_clave, CANCEL_KEY);
    assert.equal(reversal.naturaleza, "OPERACION_CREDITO_SIN_DINERO");
    assert.equal(reversal.sitio_origen_id, POS_IDS.site);
    assert.equal(reversal.sesion_caja_id, null);
    assert.equal(reversal.nota_origen_id, POS_IDS.note);
    assert.equal(reversal.origen_justificacion, "Ensayo E1 clone POS");
    const operation = state.operations.find(row => row.productor === "CANCELACION_VENTA_CREDITO")!;
    assert.equal(operation.clave, CANCEL_KEY);
    assert.equal(operation.usuario_id, POS_IDS.actor);
    assert.equal(operation.naturaleza, "OPERACION_CREDITO_SIN_DINERO");
    assert.deepEqual(operation.solicitud_canonica, {
      productor: "CANCELACION_VENTA_CREDITO", naturaleza: "OPERACION_CREDITO_SIN_DINERO",
      actorId: POS_IDS.actor,
      intent: {
        ticketId: POS_IDS.note, clienteId: POS_IDS.customer, importe: "100.00",
        motivo: MOTIVE, autorizadoPor: POS_IDS.actor, requestedSalidaId: POS_IDS.salida,
        evidencia: evidence(CANCEL_KEY),
        metadata: { origen: "CANCELACION_TICKET", ticketFolio: POS_IDS.note },
      },
    });
    assert.equal(state.tickets[0].estado, "CANCELADO");
    assert.equal(state.salida[0].estado, "CANCELADA");
    assert.ok(state.notifications[0].leida_at);
  });
  await caseOf("CANCELACION_VENTA_CREDITO replays original linked result and explicit replay marker without writes", async () => {
    const before = await snapshot(context.pool);
    let replayMarker = 0;
    const replay = await db.transaction(tx => linkedCancel(tx, evidence(CANCEL_KEY), MOTIVE, () => { replayMarker++; }));
    assert.equal(replayMarker, 1);
    assert.deepEqual(replay, originalCancellation);
    assert.deepEqual(await snapshot(context.pool), before);
  });
  await caseOf("CANCELACION_VENTA_CREDITO changed cancellation reason conflicts on same key", () =>
    rejectsUnchanged(() => db.transaction(tx => linkedCancel(tx, evidence(CANCEL_KEY), `${MOTIVE} alterado`)), e1Error(409, /otro contenido|distintos/)));
  return {
    status: "PASS" as const, target: POS_TARGET, fixtureIds: POS_IDS, sources: loader.loadedSources, cases: results,
    fixtureSqlSha256: createHash("sha256").update(POS_FIXTURE_SQL).digest("hex"),
    limitations: [
      "Actual core and linked production dispatcher, not Express HTTP/middleware execution",
      "Synthetic actor context, not user/session login",
      "No product/roll/ticket-line fixtures: no physical inventory assertion",
      "Single-client sequential rehearsal, not concurrent PostgreSQL uniqueness/race proof",
      "Clone sequences may advance on failed/rolled-back writes; no source readiness claim",
    ],
  };
}
export const runCases = runPosCases;