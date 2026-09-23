import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db, pool } from "@workspace/db";
import { calculateCash } from "./caja-cash-ledger";
import { e9Command, E9Error, type E9Actor, type E9Detail } from "./e9";
import { e9Repository } from "./e9-repository";

if (process.env.REQUIRE_ISOLATED_TEST_DATABASE !== "1" || !process.env.TEST_DATABASE_URL) {
  throw new Error("E9 PG verification requires the focused disposable runner.");
}

const evidence = {
  descripcion: "E9 disposable PostgreSQL producer proof",
  referencias: ["isolated"],
};
const operationKey = () => randomUUID();

async function errorCode(work: () => Promise<unknown>) {
  try {
    await work();
    return "NO_ERROR";
  } catch (error) {
    return error instanceof E9Error ? error.code : (error as Error).message;
  }
}

async function command(
  actor: E9Actor,
  action: "ENVIAR" | "CONTAR" | "AUTORIZAR" | "CERRAR",
  body: Record<string, unknown>,
  id?: string,
) {
  return db.transaction((tx) => e9Command(e9Repository(tx), actor, action, body, id, true));
}

async function createClosedCut(userId: number, site: number, amount: string) {
  const session = await pool.query<{ id: number; closed_at: Date; operating_date: string }>(
    `INSERT INTO sesiones_caja
       (ubicacion_id,usuario_id,fecha_operativa,fondo_inicial,efectivo_contado,
        estado,cerrada_at,cerrada_por_id)
     VALUES ($1,$2,current_date,0,$3,'CERRADA',date_trunc('milliseconds',clock_timestamp()),$2)
     RETURNING id,cerrada_at AS closed_at,fecha_operativa::text AS operating_date`,
    [site, userId, amount],
  );
  const row = session.rows[0]!;
  const snapshot = {
    version: "E2",
    sesionId: row.id,
    efectivoContado: amount,
    diferencia: "0.00",
    efectivoDesglose: calculateCash([
      { origen: "FONDO_INICIAL", id: String(row.id), folio: null, href: null, importe: amount },
    ]),
  };
  await pool.query(
    `INSERT INTO auditoria
       (usuario_id,modulo,accion,entidad,entidad_id,datos_despues,ip)
     VALUES ($1,'CAJA','CERRAR_CAJA','sesiones_caja',$2,$3::jsonb,'127.0.0.1')`,
    [userId, String(row.id), JSON.stringify({ cashSnapshot: snapshot })],
  );
  return row.id;
}

async function send(actor: E9Actor, cutId: number, claveOperacion = operationKey()) {
  const version = await db.transaction(async (tx) => {
    const cut = await e9Repository(tx).cut(cutId, actor);
    assert.ok(cut);
    return cut.versionCorte;
  });
  return command(actor, "ENVIAR", {
    claveOperacion,
    corteId: cutId,
    versionCorte: version,
    evidencia: evidence,
  });
}

async function countAndAuthorize(admin: E9Actor, sent: E9Detail, amount: string) {
  const counted = await command(admin, "CONTAR", {
    claveOperacion: operationKey(),
    importeRecibido: amount,
    evidencia: evidence,
  }, sent.id);
  assert.equal(counted.investigacion?.estado, "ABIERTA");
  const authorizeInput = {
    claveOperacion: operationKey(),
    conteoId: counted.conteoVigenteId!,
    motivo: "Diferencia investigada durante prueba desechable",
  };
  const authorized = await command(admin, "AUTORIZAR", authorizeInput, sent.id);
  assert.equal(authorized.estado, "AUTORIZADA");
  assert.equal(authorized.fondo, undefined);
  assert.equal(authorized.investigacion?.estado, "ABIERTA");
  assert.deepEqual(await command(admin, "AUTORIZAR", authorizeInput, sent.id), authorized);
  return authorized;
}

try {
  const adminRow = await pool.query<{ id: number; nombre: string }>(
    "SELECT id,nombre FROM usuarios WHERE rol='ADMIN' AND activo=true ORDER BY id LIMIT 1",
  );
  assert.ok(adminRow.rows[0], "canonical seed must contain an ADMIN");
  const admin: E9Actor = {
    id: adminRow.rows[0].id,
    nombre: adminRow.rows[0].nombre,
    rol: "ADMIN",
    ubicacionId: null,
    ip: "127.0.0.1",
    puedeEnviar: true,
  };
  const supervisorRow = await pool.query<{ id: number }>(
    `INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id,activo)
     VALUES ('Supervisor E9 aislado',$1,'not-used','SUPERVISOR',2,true) RETURNING id`,
    [`e9-supervisor-${randomUUID()}`],
  );
  const supervisor: E9Actor = {
    id: supervisorRow.rows[0]!.id,
    nombre: "Supervisor E9 aislado",
    rol: "SUPERVISOR",
    ubicacionId: 2,
    ip: "127.0.0.1",
    puedeEnviar: true,
  };

  const fundBefore = await pool.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM fondo_movimientos",
  );

  // Deficit: real SUPERVISOR sends, ADMIN counts, authorizes and closes investigation.
  const deficitCut = await createClosedCut(admin.id, 2, "100.00");
  const cutBefore = await pool.query("SELECT * FROM sesiones_caja WHERE id=$1", [deficitCut]);
  const sendReplayKey = operationKey();
  const sent = await send(supervisor, deficitCut, sendReplayKey);
  assert.equal(sent.importeEnviado, "100.00");
  assert.deepEqual(await send(supervisor, deficitCut, sendReplayKey), sent);
  const authorizedDeficit = await countAndAuthorize(admin, sent, "95.00");
  assert.equal(authorizedDeficit.conteos.at(-1)!.diferencia, "-5.00");
  const authKey = operationKey();
  const currentCount = authorizedDeficit.conteoVigenteId!;
  // An already-authorized record rejects a new intent, while the persisted operation remains unique.
  assert.equal(await errorCode(() => command(admin, "AUTORIZAR", {
    claveOperacion: authKey, conteoId: currentCount,
    motivo: "No debe autorizar dos veces",
  }, sent.id)), "E9_ALREADY_AUTHORIZED");
  const closed = await command(admin, "CERRAR", {
    claveOperacion: operationKey(),
    conclusion: "Diferencia negativa investigada y documentada",
    evidencia: evidence,
  }, sent.id);
  assert.equal(closed.investigacion?.estado, "CERRADA_DOCUMENTAL");

  // Surplus follows the same producer path and leaves its investigation open.
  const surplusCut = await createClosedCut(admin.id, 3, "50.00");
  const surplusSent = await send(admin, surplusCut);
  const authorizedSurplus = await countAndAuthorize(admin, surplusSent, "55.00");
  assert.equal(authorizedSurplus.conteos.at(-1)!.diferencia, "5.00");

  // Scope and role denials perform no write.
  const crossCut = await createClosedCut(admin.id, 3, "20.00");
  assert.equal(await errorCode(() => send(supervisor, crossCut)), "E9_NOT_FOUND");
  const forgedAdmin = { ...supervisor, rol: "ADMIN", ubicacionId: null };
  assert.notEqual(
    await errorCode(() => command(forgedAdmin, "CONTAR", {
      claveOperacion: operationKey(), importeRecibido: "56.00", evidencia: evidence,
    }, surplusSent.id)),
    "NO_ERROR",
  );

  // Inject a final-audit failure: update and immutable operation must roll back together.
  const rollbackCut = await createClosedCut(admin.id, 1, "40.00");
  const rollbackSent = await send(admin, rollbackCut);
  const rollbackCounted = await command(admin, "CONTAR", {
    claveOperacion: operationKey(), importeRecibido: "35.00", evidencia: evidence,
  }, rollbackSent.id);
  await pool.query(`
    CREATE FUNCTION e9_test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.accion='E9_AUTORIZAR' THEN RAISE EXCEPTION 'E9 injected audit failure'; END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER e9_test_fail_audit BEFORE INSERT ON auditoria
      FOR EACH ROW EXECUTE FUNCTION e9_test_fail_audit()`);
  const failedKey = operationKey();
  assert.notEqual(await errorCode(() => command(admin, "AUTORIZAR", {
    claveOperacion: failedKey,
    conteoId: rollbackCounted.conteoVigenteId!,
    motivo: "Debe revertirse por auditoría",
  }, rollbackSent.id)), "NO_ERROR");
  await pool.query("DROP TRIGGER e9_test_fail_audit ON auditoria; DROP FUNCTION e9_test_fail_audit()");
  const rolledBack = await pool.query<{ detail: E9Detail }>(
    "SELECT detail FROM e9_entregas WHERE id=$1", [rollbackSent.id],
  );
  assert.equal(rolledBack.rows[0]!.detail.estado, "CONTADA");
  assert.equal(
    (await pool.query("SELECT 1 FROM e9_operaciones WHERE clave=$1", [failedKey])).rowCount,
    0,
  );

  const fundAfter = await pool.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM fondo_movimientos",
  );
  assert.deepEqual(fundAfter.rows[0], fundBefore.rows[0]);
  assert.equal(
    (await pool.query("SELECT count(*)::int AS count FROM e9_entregas WHERE detail ? 'fondo'")).rows[0]!.count,
    0,
  );
  const cutAfter = await pool.query("SELECT * FROM sesiones_caja WHERE id=$1", [deficitCut]);
  assert.deepEqual(cutAfter.rows[0], cutBefore.rows[0]);

  process.stdout.write("E9_DISPOSABLE_PG_PASS\n");
} finally {
  await pool.end();
}