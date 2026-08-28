import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import test from "node:test";

// Fail closed before importing the application (and therefore @workspace/db).
const testUrl = process.env.TEST_DATABASE_URL;
const applicationUrl = process.env.DATABASE_URL;
if (process.env.NODE_ENV !== "test") {
  throw new Error("POS location authorization integration requires NODE_ENV=test.");
}
if (!testUrl || process.env.REQUIRE_ISOLATED_TEST_DATABASE !== "1") {
  throw new Error(
    "POS location authorization integration requires explicit TEST_DATABASE_URL and REQUIRE_ISOLATED_TEST_DATABASE=1.",
  );
}
if (testUrl === applicationUrl) {
  throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL.");
}
const parsedTestUrl = new URL(testUrl);
const expectedDatabase = decodeURIComponent(parsedTestUrl.pathname).replace(
  /^\/+/,
  "",
);
if (!expectedDatabase || expectedDatabase.includes("/")) {
  throw new Error("TEST_DATABASE_URL must name exactly one database.");
}
if (!/(test|ci|e2e)/i.test(`${parsedTestUrl.hostname}/${expectedDatabase}`)) {
  throw new Error(
    "TEST_DATABASE_URL must visibly identify an isolated test/CI database.",
  );
}

type Json = Record<string, unknown>;
type Actor = {
  role: "CONTADOR" | "SISTEMAS";
  cookie: string;
};

test("CONTADOR y SISTEMAS leen tickets globalmente pero no operan fuera de ubicación", async (t) => {
  const [{ pool, createTestDatabaseGuard }, { default: app }] =
    await Promise.all([import("@workspace/db"), import("./app")]);
  const { assertIsolated } = await createTestDatabaseGuard(
    pool,
    testUrl,
    applicationUrl,
  );

  const assertDatabase = async (stage: string): Promise<void> => {
    await assertIsolated();
    const current = (
      await pool.query<{ database: string }>(
        "SELECT current_database() AS database",
      )
    ).rows[0]?.database;
    assert.equal(
      current,
      expectedDatabase,
      `${stage}: connection is outside TEST_DATABASE_URL`,
    );
    assert.match(current ?? "", /test|ci|e2e/i);
  };
  await assertDatabase("initial");

  const tag = `POS-AUTH-${randomUUID()}`;
  const hex = randomUUID().replaceAll("-", "");
  const initialsPrefix = `${String.fromCharCode(
    65 + ((Number.parseInt(hex.slice(0, 2), 16) || 0) % 26),
  )}${String.fromCharCode(
    65 + ((Number.parseInt(hex.slice(2, 4), 16) || 0) % 26),
  )}`;
  const initials = (suffix: "X" | "Y") => `${initialsPrefix}${suffix}`;
  const created = {
    locations: [] as number[],
    users: [] as number[],
    sessions: [] as string[],
    permissions: [] as number[],
    products: [] as number[],
    clients: [] as number[],
    tickets: [] as number[],
    cashSessions: [] as number[],
  };
  let server: Server | undefined;

  const mutate = async <T extends Json>(
    statement: string,
    values: unknown[] = [],
  ): Promise<T[]> => {
    await assertDatabase("before fixture mutation");
    return (await pool.query<T>(statement, values)).rows;
  };
  const one = async <T extends Json>(
    statement: string,
    values: unknown[] = [],
  ): Promise<T> => {
    const row = (await mutate<T>(statement, values))[0];
    assert.ok(row, "fixture mutation did not return a row");
    return row;
  };

  const makeActor = async (
    role: Actor["role"],
    locationId: number | null,
  ): Promise<Actor> => {
    const user = await one<{ id: number }>(
      `INSERT INTO usuarios
         (nombre,usuario,password_hash,rol,ubicacion_id,alcance_consulta,activo)
       VALUES ($1,$2,'integration-session-only',$3,$4,'TODAS',true)
       RETURNING id`,
      [
        `${tag} ${role}`,
        `${tag}-${role}-${randomUUID()}`.toLowerCase(),
        role,
        locationId,
      ],
    );
    const userId = Number(user.id);
    created.users.push(userId);
    for (const module of ["pos", "cobros_pagos", "cortes"]) {
      const permission = await one<{ id: number }>(
        `INSERT INTO permisos_usuario
           (usuario_id,modulo,puede_ver,puede_crear,puede_editar,puede_autorizar)
         VALUES ($1,$2,true,true,true,true)
         RETURNING id`,
        [userId, module],
      );
      created.permissions.push(Number(permission.id));
    }
    const sessionId = randomUUID();
    await mutate(
      `INSERT INTO sesiones(id,usuario_id,expira_at,ip,user_agent)
       VALUES($1,$2,now()+interval '2 hours','127.0.0.1',$3)`,
      [sessionId, userId, tag],
    );
    created.sessions.push(sessionId);
    return { role, cookie: `mariana_session=${sessionId}` };
  };

  try {
    const ticketLocation = await one<{ id: number }>(
      `INSERT INTO ubicaciones(nombre,iniciales,tipo,activa)
       VALUES($1,$2,'TIENDA',true) RETURNING id`,
      [`${tag} ticket`, initials("X")],
    );
    const otherLocation = await one<{ id: number }>(
      `INSERT INTO ubicaciones(nombre,iniciales,tipo,activa)
       VALUES($1,$2,'TIENDA',true) RETURNING id`,
      [`${tag} other`, initials("Y")],
    );
    const ticketLocationId = Number(ticketLocation.id);
    const otherLocationId = Number(otherLocation.id);
    created.locations.push(ticketLocationId, otherLocationId);

    const adminPassword = `Admin-${hex}`;
    const adminUsername = `${tag}-admin`.toLowerCase();
    const admin = await one<{ id: number }>(
      `INSERT INTO usuarios
         (nombre,usuario,password_hash,rol,ubicacion_id,alcance_consulta,activo)
       VALUES($1,$2,crypt($3,gen_salt('bf',8)),'ADMIN',$4,'TODAS',true)
       RETURNING id`,
      [`${tag} admin`, adminUsername, adminPassword, ticketLocationId],
    );
    const adminId = Number(admin.id);
    created.users.push(adminId);

    const actors = [
      await makeActor("CONTADOR", otherLocationId),
      await makeActor("SISTEMAS", null),
    ];
    const client = await one<{ id: number }>(
      "INSERT INTO clientes(nombre,activo) VALUES($1,true) RETURNING id",
      [`${tag} client`],
    );
    const clientId = Number(client.id);
    created.clients.push(clientId);
    const product = await one<{ id: number }>(
      `INSERT INTO productos
         (sku,tela,color,unidad,precio_sugerido,activo,se_vende_por_metro)
       VALUES($1,$2,$3,'METRO',25,true,true) RETURNING id`,
      [`${tag}-SKU`, `${tag} fabric`, `${tag} color`],
    );
    const productId = Number(product.id);
    created.products.push(productId);
    const folio = -Number.parseInt(hex.slice(0, 7), 16);
    const ticket = await one<{ id: number }>(
      `INSERT INTO tickets
         (folio,ubicacion_id,usuario_terminal_id,cliente_id,documento_tipo,
          subtotal,iva,tasa_iva,total,estado,cobrado,facturado,uuid_cliente)
       VALUES($1,$2,$3,$4,'TICKET',25,0,0.16,25,'VENDIDO',false,false,$5)
       RETURNING id`,
      [folio, ticketLocationId, adminId, clientId, randomUUID()],
    );
    const ticketId = Number(ticket.id);
    created.tickets.push(ticketId);
    await mutate(
      `INSERT INTO ticket_lineas
         (ticket_id,rollo_id,producto_id,tipo,cantidad,precio_unitario,
          precio_sugerido,importe,costo_referencia_estado)
       VALUES($1,NULL,$2,'METREADO',1,25,25,25,'NO_COST')`,
      [ticketId, productId],
    );
    const cashSession = await one<{ id: number }>(
      `INSERT INTO sesiones_caja
         (ubicacion_id,usuario_id,fecha_operativa,fondo_inicial,estado)
       VALUES($1,$2,CURRENT_DATE,100,'ABIERTA') RETURNING id`,
      [ticketLocationId, adminId],
    );
    const cashSessionId = Number(cashSession.id);
    created.cashSessions.push(cashSessionId);

    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server!.listen(0, "127.0.0.1", resolve);
      server!.on("error", reject);
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const api = async (
      method: string,
      path: string,
      actor: Actor,
      body?: unknown,
    ) => {
      if (method !== "GET") {
        await assertDatabase(`before HTTP ${method} ${path}`);
      }
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Cookie: actor.cookie,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return {
        status: response.status,
        body: (await response.json()) as Json,
      };
    };

    for (const actor of actors) {
      await t.test(`${actor.role} tiene lectura global inmutable`, async () => {
        const detail = await api("GET", `/tickets/${ticketId}`, actor);
        assert.equal(
          detail.status,
          200,
          `${actor.role} must read a ticket outside its operational location`,
        );
        assert.equal(detail.body.id, ticketId);

        const document = await api(
          "GET",
          `/tickets/${ticketId}/documento-impresion?copia=INTERNA`,
          actor,
        );
        assert.equal(
          document.status,
          200,
          `${actor.role} must read the print document outside its location`,
        );
      });

      await t.test(
        `${actor.role} no opera fuera de ubicación aunque tenga permisos`,
        async () => {
          const attempts = [
            await api("POST", `/tickets/${ticketId}/cobrar`, actor, {
              pagos: [{ formaPago: "EFECTIVO", importe: 25 }],
              clienteId: clientId,
            }),
            await api("POST", `/tickets/${ticketId}/cancelar`, actor, {
              motivo: "Cancelación autorizada para prueba aislada",
              credencialesAdmin: {
                usuario: adminUsername,
                password: adminPassword,
              },
            }),
            await api(
              "POST",
              `/sesiones-caja/${cashSessionId}/cerrar`,
              actor,
              { efectivoContado: 100 },
            ),
            await api(
              "POST",
              `/sesiones-caja/${cashSessionId}/salidas-dinero`,
              actor,
              {
                monto: "1.00",
                motivo: "Salida que debe rechazarse",
                cuentaOrigen: "CAJA_FISICA",
              },
            ),
          ];
          for (const result of attempts) {
            assert.equal(result.status, 403);
            assert.equal(
              result.body.code,
              "LOCATION_FORBIDDEN",
              "the request must pass granular permission checks and fail at the location boundary",
            );
          }
        },
      );
    }
  } finally {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => (error ? reject(error) : resolve())),
      );
    }
    await assertDatabase("cleanup");
    // Never delete from auditoria: it is append-only. These denied operations
    // create no audit events, so ordinary disposable fixtures can be removed.
    if (created.sessions.length) {
      await mutate("DELETE FROM sesiones WHERE id = ANY($1::uuid[])", [
        created.sessions,
      ]);
    }
    if (created.permissions.length) {
      await mutate("DELETE FROM permisos_usuario WHERE id = ANY($1::int[])", [
        created.permissions,
      ]);
    }
    if (created.tickets.length) {
      await mutate("DELETE FROM ticket_lineas WHERE ticket_id = ANY($1::int[])", [
        created.tickets,
      ]);
      await mutate("DELETE FROM tickets WHERE id = ANY($1::int[])", [
        created.tickets,
      ]);
    }
    if (created.cashSessions.length) {
      await mutate("DELETE FROM sesiones_caja_dias WHERE sesion_caja_id = ANY($1::int[])", [
        created.cashSessions,
      ]);
      await mutate("DELETE FROM sesiones_caja WHERE id = ANY($1::int[])", [
        created.cashSessions,
      ]);
    }
    if (created.products.length) {
      await mutate("DELETE FROM productos WHERE id = ANY($1::int[])", [
        created.products,
      ]);
    }
    if (created.clients.length) {
      await mutate("DELETE FROM clientes WHERE id = ANY($1::int[])", [
        created.clients,
      ]);
    }
    if (created.users.length) {
      await mutate("DELETE FROM usuarios WHERE id = ANY($1::int[])", [
        created.users,
      ]);
    }
    if (created.locations.length) {
      await mutate("DELETE FROM ubicaciones WHERE id = ANY($1::int[])", [
        created.locations,
      ]);
    }
    await pool.end();
  }
});