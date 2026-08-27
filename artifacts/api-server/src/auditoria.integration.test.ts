import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import test from "node:test";

const testUrl = process.env.TEST_DATABASE_URL;
const applicationUrl = process.env.DATABASE_URL;

if (!testUrl) {
  throw new Error("Auditoría integration requiere TEST_DATABASE_URL explícita.");
}
if (testUrl === applicationUrl) {
  throw new Error("TEST_DATABASE_URL debe ser distinta de DATABASE_URL.");
}
test("auditoría: trigger, filtros, detalle, exportación y acceso ADMIN", async () => {
  const [{ pool, ensureAuditSchema }, { listAuditoria, getAuditoria, exportAuditoriaRows }, { default: app }] =
    await Promise.all([
      import("@workspace/db"),
      import("./lib/auditoria"),
      import("./app"),
    ]);
  const { createTestDatabaseGuard } = await import("@workspace/db");
  const { assertIsolated, testDatabaseName } =
    await createTestDatabaseGuard(pool, testUrl, applicationUrl);
  await assertIsolated();
  await ensureAuditSchema(pool);

  const tag = `AUDIT-${randomUUID()}`;
  const uuidHex = tag.slice("AUDIT-".length).replaceAll("-", "");
  const initialsFromHex = (value: string) =>
    value
      .split("")
      .map((character) => String.fromCharCode(65 + Number.parseInt(character, 16)))
      .join("");
  const siteOneInitials = initialsFromHex(uuidHex.slice(0, 3));
  const siteTwoInitials = initialsFromHex(uuidHex.slice(-3));
  const ids = { sites: [] as number[], users: [] as number[], sessions: [] as string[] };
  let server: Server | undefined;
  try {
    const one = async (text: string, values: unknown[] = []) =>
      (await pool.query(text, values)).rows[0]!;
    const siteOne = await one(
      `INSERT INTO ubicaciones(nombre,iniciales,tipo,activa) VALUES($1,$2,'TIENDA',true) RETURNING id`,
      [`${tag} Uno`, siteOneInitials],
    );
    const siteTwo = await one(
      `INSERT INTO ubicaciones(nombre,iniciales,tipo,activa) VALUES($1,$2,'BODEGA',true) RETURNING id`,
      [`${tag} Dos`, siteTwoInitials],
    );
    ids.sites.push(Number(siteOne.id), Number(siteTwo.id));
    const admin = await one(
      `INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id,activo,alcance_consulta)
       VALUES($1,$2,'integration-only','ADMIN',$3,true,'TODAS') RETURNING id`,
      [`${tag} Admin`, `${tag.toLowerCase()}-admin`, siteOne.id],
    );
    const caja = await one(
      `INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id,activo,alcance_consulta)
       VALUES($1,$2,'integration-only','CAJA',$3,true,'PROPIA') RETURNING id`,
      [`${tag} Caja`, `${tag.toLowerCase()}-caja`, siteTwo.id],
    );
    const adminWithoutSite = await one(
      `INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id,activo,alcance_consulta)
       VALUES($1,$2,'integration-only','ADMIN',NULL,true,'TODAS') RETURNING id`,
      [`${tag} Admin sin sitio`, `${tag.toLowerCase()}-admin-sin-sitio`],
    );
    ids.users.push(Number(admin.id), Number(caja.id), Number(adminWithoutSite.id));

    const insert = async (
      userId: number,
      action: string,
      entity: string,
      entityId: string,
      timestamp: string,
      before: unknown,
      after: unknown,
    ) => one(
      `INSERT INTO auditoria(usuario_id,accion,entidad,entidad_id,datos_antes,datos_despues,ip,created_at)
       VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,'127.0.0.1',$7) RETURNING id`,
      [userId, action, entity, entityId, JSON.stringify(before), JSON.stringify(after), timestamp],
    );
    const old = await insert(Number(admin.id), "ACTUALIZAR", tag, `${tag}-alpha`, "2026-08-27T12:00:00Z", { estado: "antes" }, { estado: "después" });
    await insert(Number(caja.id), "OTRA_ACCION", `${tag}-otro`, `${tag}-beta`, "2026-08-27T13:00:00Z", null, { beta: true });
    const newest = await insert(Number(admin.id), "ACTUALIZAR", tag, `${tag}-gamma`, "2026-08-27T14:00:00Z", { valor: 1 }, { valor: 2 });

    const frozen = await one(
      `SELECT usuario_snapshot,rol_snapshot,sitio_id,sitio_snapshot,modulo FROM auditoria WHERE id=$1`,
      [old.id],
    );
    assert.deepEqual(frozen, {
      usuario_snapshot: `${tag.toLowerCase()}-admin`, rol_snapshot: "ADMIN", sitio_id: siteOne.id, sitio_snapshot: `${tag} Uno`, modulo: tag,
    });
    await pool.query(`UPDATE usuarios SET usuario=$1 WHERE id=$2`, [`${tag.toLowerCase()}-renamed`, admin.id]);
    assert.equal((await getAuditoria(String(old.id)))?.usuario, `${tag.toLowerCase()}-admin`);
    await assert.rejects(() => pool.query(`UPDATE auditoria SET accion='MUTADA' WHERE id=$1`, [old.id]), /append-only/);
    await assert.rejects(() => pool.query(`DELETE FROM auditoria WHERE id=$1`, [old.id]), /append-only/);
    const explicitSiteAudit = await one(
      `INSERT INTO auditoria(usuario_id,accion,entidad,entidad_id,sitio_id,ip)
       VALUES($1,'REIMPRIMIR_ETIQUETA','reimpresiones_etiqueta',$2,$3,'127.0.0.1')
       RETURNING id`,
      [adminWithoutSite.id, `${tag}-rollo`, siteTwo.id],
    );
    const explicitSiteFrozen = await one(
      `SELECT usuario_snapshot,rol_snapshot,sitio_id,sitio_snapshot,modulo
       FROM auditoria WHERE id=$1`,
      [explicitSiteAudit.id],
    );
    assert.deepEqual(explicitSiteFrozen, {
      usuario_snapshot: `${tag.toLowerCase()}-admin-sin-sitio`,
      rol_snapshot: "ADMIN",
      sitio_id: siteTwo.id,
      sitio_snapshot: `${tag} Dos`,
      modulo: "etiquetas",
    });
    const explicitSiteResult = await listAuditoria({
      sitioId: Number(siteTwo.id),
      search: `${tag}-rollo`,
    }, 1, 10);
    assert.equal(explicitSiteResult.total, 1);
    assert.equal(explicitSiteResult.items[0]?.sitioId, Number(siteTwo.id));

    const all = await listAuditoria({ search: tag }, 1, 10);
    assert.deepEqual(all.items.map((row) => row.entidadId), [
      `${tag}-gamma`,
      `${tag}-beta`,
      `${tag}-alpha`,
      `${tag}-rollo`,
    ]);
    const paged = await listAuditoria({ search: tag }, 2, 1);
    assert.equal(paged.total, 4);
    assert.equal(paged.items[0]?.entidadId, `${tag}-beta`);
    assert.equal((await listAuditoria({ desde: "2026-08-27", hasta: "2026-08-27", search: tag }, 1, 10)).total, 4);
    assert.equal((await listAuditoria({ usuarioId: Number(caja.id), search: tag }, 1, 10)).total, 1);
    assert.equal((await listAuditoria({ modulo: tag, search: tag }, 1, 10)).total, 2);
    assert.equal((await listAuditoria({ accion: "OTRA_ACCION", search: tag }, 1, 10)).total, 1);
    assert.equal((await listAuditoria({ sitioId: Number(siteTwo.id), search: tag }, 1, 10)).total, 2);
    assert.equal((await listAuditoria({ search: `${tag}-alpha` }, 1, 10)).total, 1);

    const detail = await getAuditoria(String(newest.id));
    assert.deepEqual(detail?.datosAntes, { valor: 1 });
    assert.deepEqual(detail?.datosDespues, { valor: 2 });
    assert.equal((await exportAuditoriaRows({ modulo: tag })).length, 2);

    await pool.query(
      `INSERT INTO auditoria(accion,entidad,entidad_id,ip)
       SELECT 'BULK',$1,gs::text,'127.0.0.1' FROM generate_series(1,10001) gs`,
      [`${tag}-bulk`],
    );
    await assert.rejects(
      () => exportAuditoriaRows({ modulo: `${tag}-bulk` }),
      /AUDIT_EXPORT_LIMIT/,
    );

    for (const userId of ids.users) {
      const sessionId = randomUUID();
      ids.sessions.push(sessionId);
      await pool.query(
        `INSERT INTO sesiones(id,usuario_id,expira_at,ip,user_agent)
         VALUES($1,$2,now()+interval '1 hour','127.0.0.1',$3)`,
        [sessionId, userId, tag],
      );
    }
    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    const request = (method: string, path: string, cookie: string) =>
      fetch(`${base}${path}`, { method, headers: { Cookie: `mariana_session=${cookie}` } });
    assert.equal((await request("GET", `/api/auditoria?search=${encodeURIComponent(tag)}`, ids.sessions[0]!)).status, 200);
    assert.equal((await request("GET", "/api/auditoria", ids.sessions[1]!)).status, 403);
    for (const method of ["POST", "PATCH", "DELETE"]) {
      const response = await request(method, "/api/auditoria", ids.sessions[0]!);
      assert.ok([404, 405].includes(response.status), `${method} must not mutate audit`);
    }
    const cleanupClient = await pool.connect();
    try {
      assert.equal(
        (await cleanupClient.query<{ database: string }>("SELECT current_database() AS database")).rows[0]?.database,
        testDatabaseName,
      );
      await cleanupClient.query(`
        CREATE TABLE IF NOT EXISTS public.integration_test_database_guard (
          singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton)
        )
      `);
      await cleanupClient.query("BEGIN");
      await cleanupClient.query("SET LOCAL app.audit_test_cleanup = 'on'");
      await assert.rejects(
        () => cleanupClient.query("DELETE FROM auditoria WHERE id=$1", [old.id]),
        /append-only/,
      );
      await cleanupClient.query("ROLLBACK");
      assert.equal((await pool.query("SELECT 1 FROM auditoria WHERE id=$1", [old.id])).rowCount, 1);
    } finally {
      await cleanupClient.query("ROLLBACK").catch(() => undefined);
      await cleanupClient.query("DROP TABLE IF EXISTS public.integration_test_database_guard");
      cleanupClient.release();
    }
  } finally {
    await assertIsolated();
    if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    await pool.query(`DELETE FROM sesiones WHERE id = ANY($1::uuid[])`, [ids.sessions]);
    await pool.end();
  }
});