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
if (!/\/parte5_audit_test_20260827(?:\?|$)/.test(testUrl)) {
  throw new Error("TEST_DATABASE_URL no apunta a la base temporal segura esperada.");
}

test("auditoría: trigger, filtros, detalle, exportación y acceso ADMIN", async () => {
  const [{ pool, ensureAuditSchema }, { listAuditoria, getAuditoria, exportAuditoriaRows }, { default: app }] =
    await Promise.all([
      import("@workspace/db"),
      import("./lib/auditoria"),
      import("./app"),
    ]);
  await ensureAuditSchema(pool);

  const tag = `AUDIT-${randomUUID()}`;
  const ids = { sites: [] as number[], users: [] as number[], sessions: [] as string[] };
  let server: Server | undefined;
  try {
    const one = async (text: string, values: unknown[] = []) =>
      (await pool.query(text, values)).rows[0]!;
    const siteOne = await one(
      `INSERT INTO ubicaciones(nombre,iniciales,tipo,activa) VALUES($1,$2,'TIENDA',true) RETURNING id`,
      [`${tag} Uno`, "AUA"],
    );
    const siteTwo = await one(
      `INSERT INTO ubicaciones(nombre,iniciales,tipo,activa) VALUES($1,$2,'BODEGA',true) RETURNING id`,
      [`${tag} Dos`, "AUB"],
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
    ids.users.push(Number(admin.id), Number(caja.id));

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
    const old = await insert(Number(admin.id), "ACTUALIZAR", tag, "alpha", "2026-08-27T12:00:00Z", { estado: "antes" }, { estado: "después" });
    await insert(Number(caja.id), "OTRA_ACCION", `${tag}-otro`, "beta", "2026-08-27T13:00:00Z", null, { beta: true });
    const newest = await insert(Number(admin.id), "ACTUALIZAR", tag, "gamma", "2026-08-27T14:00:00Z", { valor: 1 }, { valor: 2 });

    const frozen = await one(
      `SELECT rol_snapshot,sitio_id,sitio_snapshot,modulo FROM auditoria WHERE id=$1`,
      [old.id],
    );
    assert.deepEqual(frozen, {
      rol_snapshot: "ADMIN", sitio_id: siteOne.id, sitio_snapshot: `${tag} Uno`, modulo: tag,
    });

    const all = await listAuditoria({ search: tag }, 1, 10);
    assert.deepEqual(all.items.map((row) => row.entidadId), ["gamma", "beta", "alpha"]);
    const paged = await listAuditoria({ search: tag }, 2, 1);
    assert.equal(paged.total, 3);
    assert.equal(paged.items[0]?.entidadId, "beta");
    assert.equal((await listAuditoria({ desde: "2026-08-27", hasta: "2026-08-27", search: tag }, 1, 10)).total, 3);
    assert.equal((await listAuditoria({ usuarioId: Number(caja.id), search: tag }, 1, 10)).total, 1);
    assert.equal((await listAuditoria({ modulo: tag, search: tag }, 1, 10)).total, 2);
    assert.equal((await listAuditoria({ accion: "OTRA_ACCION", search: tag }, 1, 10)).total, 1);
    assert.equal((await listAuditoria({ sitioId: Number(siteTwo.id), search: tag }, 1, 10)).total, 1);
    assert.equal((await listAuditoria({ search: "alpha" }, 1, 10)).total, 1);

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
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    await pool.query(`DELETE FROM sesiones WHERE id = ANY($1::uuid[])`, [ids.sessions]);
    await pool.query(`DELETE FROM auditoria WHERE entidad LIKE $1`, [`${tag}%`]);
    await pool.query(`DELETE FROM usuarios WHERE id = ANY($1::int[])`, [ids.users]);
    await pool.query(`DELETE FROM ubicaciones WHERE id = ANY($1::int[])`, [ids.sites]);
    await pool.end();
  }
});