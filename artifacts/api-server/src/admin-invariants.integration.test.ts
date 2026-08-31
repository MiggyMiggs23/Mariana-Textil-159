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
test("ADMIN invariants: rechazos auditados, transaccionales y sin cambios parciales", async () => {
  const [{ pool }, { default: app }] = await Promise.all([
    import("@workspace/db"),
    import("./app"),
  ]);
  const { createTestDatabaseGuard } = await import("@workspace/db");
  const { assertIsolated } = await createTestDatabaseGuard(
    pool,
    testUrl,
    applicationUrl,
  );
  await assertIsolated();
  const tag = `PART5-${randomUUID()}`;
  const fixtureUsers: number[] = [];
  const fixtureSessions: string[] = [];
  const fixtureLocations: number[] = [];
  const disabledNonFixtures: Array<{ id: number; activo: boolean }> = [];
  let server: Server | undefined;

  try {
    const one = async (text: string, values: unknown[] = []) =>
      (await pool.query(text, values)).rows[0]!;
    let initials = "";
    do {
      initials = randomUUID()
        .replaceAll("-", "")
        .slice(0, 3)
        .split("")
        .map((character) =>
          String.fromCharCode(65 + Number.parseInt(character, 16))
        )
        .join("");
    } while (
      (
        await pool.query(
          "SELECT 1 FROM ubicaciones WHERE iniciales=$1 LIMIT 1",
          [initials],
        )
      ).rowCount
    );
    const location = await one(
      `INSERT INTO ubicaciones(nombre,iniciales,tipo,activa)
       VALUES($1,$2,'TIENDA',true) RETURNING id`,
      [`${tag} ubicación`, initials],
    );
    fixtureLocations.push(Number(location.id));

    const makeUser = async (role: "ADMIN" | "CAJA" | "SISTEMAS", suffix: string) => {
      const user = await one(
        `INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id,activo,alcance_consulta)
         VALUES($1,$2,'integration-only',$3,$4,true,$5) RETURNING id`,
        [
          `${tag} ${suffix}`,
          `${tag.toLowerCase()}-${suffix}`,
          role,
          role === "ADMIN" || role === "SISTEMAS" ? null : location.id,
          role === "ADMIN" || role === "SISTEMAS" ? "TODAS" : "PROPIA",
        ],
      );
      fixtureUsers.push(Number(user.id));
      return Number(user.id);
    };

    const actorId = await makeUser("ADMIN", "actor");
    const secondAdminId = await makeUser("ADMIN", "second-admin");
    const cajaId = await makeUser("CAJA", "caja");
    const sistemasId = await makeUser("SISTEMAS", "sistemas");
    const actorSession = randomUUID();
    const sistemasSession = randomUUID();
    fixtureSessions.push(actorSession);
    fixtureSessions.push(sistemasSession);
    await pool.query(
      `INSERT INTO sesiones(id,usuario_id,expira_at,ip,user_agent)
       VALUES($1,$2,now()+interval '1 hour','127.0.0.1',$3)`,
      [actorSession, actorId, tag],
    );
    await pool.query(
      `INSERT INTO sesiones(id,usuario_id,expira_at,ip,user_agent)
       VALUES($1,$2,now()+interval '1 hour','127.0.0.1',$3)`,
      [sistemasSession, sistemasId, tag],
    );
    await pool.query(
      `INSERT INTO permisos_rol(rol,modulo,puede_ver,puede_crear,puede_editar,puede_autorizar)
       VALUES
         ('SISTEMAS','usuarios',true,true,true,false),
         ('SISTEMAS','permisos',true,false,true,false)
       ON CONFLICT (rol,modulo) DO UPDATE SET
         puede_ver=excluded.puede_ver, puede_crear=excluded.puede_crear,
         puede_editar=excluded.puede_editar, puede_autorizar=excluded.puede_autorizar`,
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
    const request = async (
      method: string,
      path: string,
      body?: unknown,
      session = actorSession,
    ) => {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          Cookie: `mariana_session=${session}`,
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
    const rejectedBySistemas = async (entity: string, entityId: string, expected = 1) => {
      const result = await pool.query(
        `SELECT count(*)::int AS count FROM auditoria
         WHERE usuario_id=$1 AND accion='RECHAZAR_INVARIANTE'
           AND entidad=$2 AND entidad_id=$3`,
        [sistemasId, entity, entityId],
      );
      assert.equal(result.rows[0]?.count, expected, `expected SISTEMAS rejection audit for ${entity}:${entityId}`);
    };

    const adminBeforeSistemasAttempts = await pool.query(
      `SELECT nombre,rol,activo,password_hash FROM usuarios WHERE id=$1`,
      [secondAdminId],
    );
    const forbiddenAdminUsername = `${tag.toLowerCase()}-forbidden-admin`;
    assert.equal(
      (await request("POST", "/users", {
        nombre: `${tag} forbidden admin`,
        usuario: forbiddenAdminUsername,
        password: "integration-only-password",
        rol: "ADMIN",
        ubicacionId: null,
      }, sistemasSession)).status,
      403,
    );
    await rejectedBySistemas("usuarios", forbiddenAdminUsername);
    assert.equal(
      (await pool.query(`SELECT count(*)::int AS count FROM usuarios WHERE usuario=$1`, [forbiddenAdminUsername])).rows[0]?.count,
      0,
    );
    assert.equal(
      (await request("PATCH", `/users/${cajaId}`, { rol: "ADMIN" }, sistemasSession)).status,
      403,
    );
    await rejectedBySistemas("usuarios", String(cajaId));
    for (const update of [
      { nombre: `${tag} hacked` },
      { rol: "CAJA", ubicacionId: Number(location.id) },
      { activo: false },
      { password: "replacement-password" },
    ]) {
      assert.equal(
        (await request("PATCH", `/users/${secondAdminId}`, update, sistemasSession)).status,
        403,
      );
    }
    await rejectedBySistemas("usuarios", String(secondAdminId), 4);
    assert.deepEqual(
      (await pool.query(`SELECT nombre,rol,activo,password_hash FROM usuarios WHERE id=$1`, [secondAdminId])).rows,
      adminBeforeSistemasAttempts.rows,
    );
    assert.equal(
      (await request("PUT", "/permisos/roles/ADMIN/dashboard", {
        puedeVer: false, puedeCrear: false, puedeEditar: false, puedeAutorizar: false,
      }, sistemasSession)).status,
      403,
    );
    await rejectedBySistemas("permisos_rol", "ADMIN:dashboard");
    assert.equal(
      (await request("PUT", "/permisos/roles/SISTEMAS/pos", {
        puedeVer: true, puedeCrear: false, puedeEditar: false, puedeAutorizar: false,
      }, sistemasSession)).status,
      403,
    );
    await rejectedBySistemas("permisos_rol", "SISTEMAS:pos");
    assert.equal(
      (await request("PUT", `/permisos/usuarios/${sistemasId}/pos`, {
        puedeVer: true, puedeCrear: false, puedeEditar: false, puedeAutorizar: false,
      }, sistemasSession)).status,
      403,
    );
    await rejectedBySistemas("permisos_usuario", `${sistemasId}:pos`);
    assert.equal(
      (await request("PATCH", `/users/${sistemasId}`, { rol: "ADMIN" }, sistemasSession)).status,
      403,
    );
    await rejectedBySistemas("usuarios", String(sistemasId));

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
    for (const role of [
      "ADMIN",
      "TERMINAL",
      "CAJA",
      "SUPERVISOR",
      "BODEGA",
      "SISTEMAS",
      "CONTADOR",
    ] as const) {
      const username = `${tag.toLowerCase()}-created-${role.toLowerCase()}`;
      const globalRole = role === "ADMIN" || role === "SISTEMAS" || role === "CONTADOR";
      const response = await request("POST", "/users", {
        nombre: `${tag} created ${role}`,
        usuario: username,
        password: "integration-only-password",
        rol: role,
        ubicacionId: globalRole ? null : Number(location.id),
      });
      assert.equal(
        response.status,
        201,
        `customized ADMIN must still be able to create ${role}: ${JSON.stringify(response.body)}`,
      );
      const createdUserId = Number(response.body.id);
      fixtureUsers.push(createdUserId);
      if (role === "ADMIN") {
        await pool.query(
          `INSERT INTO permisos_usuario(
             usuario_id,modulo,puede_ver,puede_crear,puede_editar,puede_autorizar
           ) VALUES($1,'dashboard',false,null,null,null)`,
          [createdUserId],
        );
      }
    }
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
    await pool.end();
  }
});