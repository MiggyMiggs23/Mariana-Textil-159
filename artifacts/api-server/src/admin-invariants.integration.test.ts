import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import test from "node:test";

const testUrl = process.env.TEST_DATABASE_URL;
const applicationUrl = process.env.DATABASE_URL;

if (!testUrl) {
  throw new Error("ADMIN invariants integration requiere TEST_DATABASE_URL explícita.");
}
if (testUrl === applicationUrl) {
  throw new Error("TEST_DATABASE_URL debe ser distinta de DATABASE_URL.");
}
if (!/\/parte5_audit_test_20260827(?:\?|$)/.test(testUrl)) {
  throw new Error("TEST_DATABASE_URL no apunta a parte5_audit_test_20260827.");
}

test("ADMIN invariants: rechazos auditados, transaccionales y sin cambios parciales", async () => {
  const [{ pool }, { default: app }] = await Promise.all([
    import("@workspace/db"),
    import("./app"),
  ]);
  const tag = `PART5-${randomUUID()}`;
  const initials = tag
    .slice(-2)
    .split("")
    .map((character) => String.fromCharCode(65 + Number.parseInt(character, 16)))
    .join("");
  const fixtureUsers: number[] = [];
  const fixtureSessions: string[] = [];
  const fixtureLocations: number[] = [];
  const disabledNonFixtures: Array<{ id: number; activo: boolean }> = [];
  let server: Server | undefined;

  try {
    const one = async (text: string, values: unknown[] = []) =>
      (await pool.query(text, values)).rows[0]!;
    const location = await one(
      `INSERT INTO ubicaciones(nombre,iniciales,tipo,activa)
       VALUES($1,$2,'TIENDA',true) RETURNING id`,
      [`${tag} ubicación`, initials],
    );
    fixtureLocations.push(Number(location.id));

    const makeUser = async (role: "ADMIN" | "CAJA", suffix: string) => {
      const user = await one(
        `INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id,activo,alcance_consulta)
         VALUES($1,$2,'integration-only',$3,$4,true,$5) RETURNING id`,
        [
          `${tag} ${suffix}`,
          `${tag.toLowerCase()}-${suffix}`,
          role,
          role === "ADMIN" ? null : location.id,
          role === "ADMIN" ? "TODAS" : "PROPIA",
        ],
      );
      fixtureUsers.push(Number(user.id));
      return Number(user.id);
    };

    const actorId = await makeUser("ADMIN", "actor");
    const secondAdminId = await makeUser("ADMIN", "second-admin");
    const cajaId = await makeUser("CAJA", "caja");
    const actorSession = randomUUID();
    fixtureSessions.push(actorSession);
    await pool.query(
      `INSERT INTO sesiones(id,usuario_id,expira_at,ip,user_agent)
       VALUES($1,$2,now()+interval '1 hour','127.0.0.1',$3)`,
      [actorSession, actorId, tag],
    );

    // The production fixtures are never deleted. Their active state is
    // restored below; limiting this window lets the HTTP requests exercise
    // the actual "last recoverable ADMIN" branch.
    const activeNonFixtures = await pool.query(
      `SELECT id,activo FROM usuarios
       WHERE rol='ADMIN' AND activo=true AND id <> ALL($1::int[])`,
      [fixtureUsers],
    );
    disabledNonFixtures.push(
      ...activeNonFixtures.rows.map((row) => ({ id: Number(row.id), activo: Boolean(row.activo) })),
    );
    if (disabledNonFixtures.length) {
      await pool.query(
        `UPDATE usuarios SET activo=false WHERE id = ANY($1::int[])`,
        [disabledNonFixtures.map(({ id }) => id)],
      );
    }

    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api`;
    const request = async (method: string, path: string, body?: unknown) => {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          Cookie: `mariana_session=${actorSession}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() as Record<string, unknown> };
    };
    const rejected = async (entity: string, entityId: string, expected = 1) => {
      const result = await pool.query(
        `SELECT count(*)::int AS count FROM auditoria
         WHERE usuario_id=$1 AND accion='RECHAZAR_INVARIANTE'
           AND entidad=$2 AND entidad_id=$3`,
        [actorId, entity, entityId],
      );
      assert.equal(result.rows[0]?.count, expected, `expected rejection audit for ${entity}:${entityId}`);
    };

    // Another ADMIN may remove ADMIN from a different account only while a
    // recoverable ADMIN remains. This also establishes actorId as the last.
    assert.equal(
      (await request("PATCH", `/users/${secondAdminId}`, {
        rol: "CAJA", ubicacionId: Number(location.id), alcanceConsulta: "PROPIA",
      })).status,
      200,
    );

    const beforeLastAttempt = await pool.query(
      `SELECT rol,activo FROM usuarios WHERE id=$1`, [actorId],
    );
    assert.equal((await request("PATCH", `/users/${actorId}`, { activo: false })).status, 409);
    assert.deepEqual(
      (await pool.query(`SELECT rol,activo FROM usuarios WHERE id=$1`, [actorId])).rows,
      beforeLastAttempt.rows,
      "last-admin rejection must be atomic",
    );
    await rejected("usuarios", String(actorId));

    assert.equal((await request("PATCH", `/users/${actorId}`, { rol: "CAJA", ubicacionId: Number(location.id) })).status, 403);
    await rejected("usuarios", String(actorId), 2);

    assert.equal(
      (await request("PUT", `/permisos/usuarios/${actorId}/dashboard`, {
        puedeVer: true, puedeCrear: true, puedeEditar: true, puedeAutorizar: true,
      })).status,
      403,
    );
    await rejected("permisos_usuario", `${actorId}:dashboard`);

    assert.equal(
      (await request("PUT", "/permisos/roles/ADMIN/dashboard", {
        puedeVer: false, puedeCrear: false, puedeEditar: false, puedeAutorizar: false,
      })).status,
      403,
    );
    await rejected("permisos_rol", "ADMIN:dashboard");

    // A direct fixture-only corrupt override models legacy data. The next
    // Permisos save must reject before its write and leave the role row intact.
    await pool.query(
      `INSERT INTO permisos_usuario(usuario_id,modulo,puede_ver,puede_crear,puede_editar,puede_autorizar)
       VALUES($1,'dashboard',false,null,null,null)`,
      [actorId],
    );
    const roleBefore = await pool.query(
      `SELECT puede_ver,puede_crear FROM permisos_rol WHERE rol='CAJA' AND modulo='dashboard'`,
    );
    const permissionAttempt = await request("PUT", "/permisos/roles/CAJA/dashboard", {
      puedeVer: true, puedeCrear: true, puedeEditar: true, puedeAutorizar: false,
    });
    assert.equal(permissionAttempt.status, 409);
    await rejected("permisos_rol", "CAJA:dashboard");
    const roleAfter = await pool.query(
      `SELECT puede_ver,puede_crear FROM permisos_rol WHERE rol='CAJA' AND modulo='dashboard'`,
    );
    assert.deepEqual(roleAfter.rows, roleBefore.rows, "permission rejection must be atomic");
    await pool.query(
      `DELETE FROM permisos_usuario WHERE usuario_id=$1 AND modulo='dashboard'`,
      [actorId],
    );

    // The ordinary non-ADMIN target remains mutable after the failed save.
    assert.equal(
      (await request("PUT", `/permisos/usuarios/${cajaId}/dashboard`, {
        puedeVer: true, puedeCrear: false, puedeEditar: false, puedeAutorizar: false,
      })).status,
      200,
    );
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    if (disabledNonFixtures.length) {
      await pool.query(`UPDATE usuarios SET activo=true WHERE id = ANY($1::int[])`, [disabledNonFixtures.map(({ id }) => id)]);
    }
    await pool.query(`DELETE FROM sesiones WHERE id = ANY($1::uuid[])`, [fixtureSessions]);
    await pool.query(`DELETE FROM permisos_usuario WHERE usuario_id = ANY($1::int[])`, [fixtureUsers]);
    await pool.query(`DELETE FROM auditoria WHERE usuario_id = ANY($1::int[])`, [fixtureUsers]);
    await pool.query(`DELETE FROM usuarios WHERE id = ANY($1::int[])`, [fixtureUsers]);
    await pool.query(`DELETE FROM ubicaciones WHERE id = ANY($1::int[])`, [fixtureLocations]);
    await pool.end();
  }
});