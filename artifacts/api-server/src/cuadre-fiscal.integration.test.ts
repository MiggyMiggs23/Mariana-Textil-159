import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import test from "node:test";

const testUrl = process.env.TEST_DATABASE_URL;
const applicationUrl = process.env.DATABASE_URL;

if (!testUrl) {
  test.skip("cuadre fiscal integration (TEST_DATABASE_URL not set)", () => {});
} else if (testUrl === applicationUrl) {
  throw new Error(
    "TEST_DATABASE_URL must differ from DATABASE_URL; refusing to mutate the application database.",
  );
} else {
  test("cuadre fiscal freezes fiscal figures and preserves its approval workflow", async () => {
    const [{ pool, ensureCuadreFiscalSchema, createTestDatabaseGuard }, { default: app }] =
      await Promise.all([import("@workspace/db"), import("./app")]);
    const { assertIsolated } = await createTestDatabaseGuard(pool, testUrl, applicationUrl);
    await assertIsolated();
    await ensureCuadreFiscalSchema(pool);

    const tag = `FISCAL-${randomUUID()}`;
    const ids = {
      users: [] as number[],
      clients: [] as number[],
      tickets: [] as number[],
      creditMovements: [] as number[],
      creditApplications: [] as number[],
      payments: [] as number[],
      fiscalRecords: [] as number[],
      notifications: [] as number[],
      sessions: [] as string[],
      locations: [] as number[],
    };
    let server: Server | undefined;

    try {
      const one = async (text: string, values: unknown[] = []) =>
        (await pool.query(text, values)).rows[0]!;
      const initials = tag.slice(-3).replaceAll("-", "").split("").map(
        (character) => String.fromCharCode(65 + Number.parseInt(character, 16)),
      ).join("");
      const location = await one(
        `INSERT INTO ubicaciones(nombre,iniciales,tipo,activa)
         VALUES($1,$2,'TIENDA',true) RETURNING id`,
        [`${tag} tienda`, initials],
      );
      ids.locations.push(Number(location.id));
      const createUser = async (role: "ADMIN" | "CONTADOR") => {
        const user = await one(
          `INSERT INTO usuarios(nombre,usuario,password_hash,rol,activo,alcance_consulta)
           VALUES($1,$2,'integration-only',$3,true,'TODAS') RETURNING id,nombre`,
          [`${tag} ${role}`, `${tag.toLowerCase()}-${role.toLowerCase()}`, role],
        );
        ids.users.push(Number(user.id));
        const session = randomUUID();
        ids.sessions.push(session);
        await pool.query(
          `INSERT INTO sesiones(id,usuario_id,expira_at,ip,user_agent)
           VALUES($1,$2,now()+interval '1 hour','127.0.0.1',$3)`,
          [session, user.id, tag],
        );
        return { id: Number(user.id), session };
      };
      const admin = await createUser("ADMIN");
      const contador = await createUser("CONTADOR");
      const client = await one(
        `INSERT INTO clientes(nombre,activo) VALUES($1,true) RETURNING id`,
        [`${tag} cliente`],
      );
      ids.clients.push(Number(client.id));

      let folio = 1_900_000_000 + Math.floor(Math.random() * 100_000_000);
      const addTicket = async (total: number, input: {
        cobrado: boolean;
        cobradoAt?: string;
        createdAt: string;
      }) => {
        const ticket = await one(
          `INSERT INTO tickets(
             folio,uuid_cliente,ubicacion_id,usuario_terminal_id,cliente_id,
             subtotal,iva,total,estado,cobrado,cobrado_at,facturado,created_at
           ) VALUES($1,$2,$3,$4,$5,$6,0,$6,'VENDIDO',$7,$8,true,$9) RETURNING id`,
          [
            folio++, randomUUID(), location.id, admin.id, client.id, total,
            input.cobrado, input.cobradoAt ?? null, input.createdAt,
          ],
        );
        ids.tickets.push(Number(ticket.id));
        return Number(ticket.id);
      };

      // Credit is invoiced and receivable, but not collected.
      const creditTicket = await addTicket(100, {
        cobrado: false,
        createdAt: "2031-02-10T12:00:00Z",
      });
      const credit = await one(
        `INSERT INTO movimientos_credito(
           cliente_id,ticket_id,tipo,importe,usuario_id,dias_plazo,fecha_vencimiento,created_at
         ) VALUES($1,$2,'VENTA_CREDITO',100,$3,30,'2031-03-12','2031-02-10T12:00:00Z')
         RETURNING id`,
        [client.id, creditTicket, admin.id],
      );
      ids.creditMovements.push(Number(credit.id));
      const fiscalAbono = await one(
        `INSERT INTO movimientos_credito(
           cliente_id,ticket_id,tipo,importe,usuario_id,forma_pago,cuenta_destino,created_at
         ) VALUES($1,NULL,'ABONO',-50,$2,'TRANSFERENCIA','CUENTA_FISCAL','2031-02-10T14:30:00Z')
         RETURNING id`,
        [client.id, admin.id],
      );
      ids.creditMovements.push(Number(fiscalAbono.id));
      const application = await one(
        `INSERT INTO aplicaciones_credito(abono_movimiento_id,venta_movimiento_id,importe)
         VALUES($1,$2,30) RETURNING id`,
        [fiscalAbono.id, credit.id],
      );
      ids.creditApplications.push(Number(application.id));
      const reversedAbono = await one(
        `INSERT INTO movimientos_credito(
           cliente_id,tipo,importe,movimiento_origen_id,usuario_id,created_at
         ) VALUES($1,'REVERSO',50,$2,$3,'2031-02-10T15:00:00Z') RETURNING id`,
        [client.id, fiscalAbono.id, admin.id],
      );
      ids.creditMovements.push(Number(reversedAbono.id));

      // Collection is dated by the actual transfer entry, not a stale ticket flag.
      const transferTicket = await addTicket(75, {
        cobrado: true,
        cobradoAt: "2031-02-09T23:00:00Z",
        createdAt: "2031-02-10T13:00:00Z",
      });
      const transfer = await one(
        `INSERT INTO ticket_pagos(ticket_id,forma_pago,importe,usuario_id,created_at)
         VALUES($1,'TRANSFERENCIA',75,$2,'2031-02-10T14:00:00Z') RETURNING id`,
        [transferTicket, admin.id],
      );
      ids.payments.push(Number(transfer.id));

      server = createServer(app);
      await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const base = `http://127.0.0.1:${address.port}/api`;
      const request = async (method: string, path: string, body: unknown, session: string) => {
        const response = await fetch(`${base}${path}`, {
          method,
          headers: { "Content-Type": "application/json", Cookie: `mariana_session=${session}` },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        return { status: response.status, body: await response.json() as Record<string, unknown> };
      };
      const range = "desde=2031-02-10&hasta=2031-02-10";
      const figures = await request("GET", `/admin/cuadre-fiscal?${range}`, undefined, contador.session);
      assert.equal(figures.status, 200);
      assert.equal(figures.body.facturado, "175.00");
      assert.equal(figures.body.porCobrarFiscal, "100.00");
      assert.equal(figures.body.cobradoCuentaFiscal, "75.00");
      const siteFigures = await request(
        "GET",
        `/admin/cuadre-fiscal?${range}&ubicacionId=${location.id}`,
        undefined,
        contador.session,
      );
      assert.equal(siteFigures.status, 200);
      assert.equal(siteFigures.body.cobradoCuentaFiscal, "75.00");

      const confirmation = await request("POST", "/admin/cuadre-fiscal/confirmaciones", {
        desde: "2031-02-10", hasta: "2031-02-10",
      }, contador.session);
      assert.equal(confirmation.status, 201);
      assert.equal(confirmation.body.facturadoCongelado, "175.00");
      ids.fiscalRecords.push(Number(confirmation.body.id));

      await addTicket(25, { cobrado: false, createdAt: "2031-02-10T15:00:00Z" });
      const afterNewSale = await request("GET", `/admin/cuadre-fiscal?${range}`, undefined, contador.session);
      assert.equal(afterNewSale.body.facturado, "200.00");
      const history = afterNewSale.body.historial as Array<Record<string, unknown>>;
      assert.equal(
        history.find((record) => record.id === confirmation.body.id)?.facturadoCongelado,
        "175.00",
        "confirmation must retain the figure present when it was made",
      );

      const description = "Diferencia validada por conciliación bancaria";
      const difference = await request("POST", "/admin/cuadre-fiscal/diferencias", {
        desde: "2031-02-10", hasta: "2031-02-10", direccion: "MENOS", monto: 25, descripcion: description,
      }, contador.session);
      assert.equal(difference.status, 201);
      ids.fiscalRecords.push(Number(difference.body.id));
      assert.equal(difference.body.estado, "PENDIENTE");
      assert.equal(
        (await one(
          `SELECT count(*)::int count FROM notificaciones_sistema
           WHERE tipo='SOLICITUD_CUADRE_FISCAL' AND entidad='cuadre_fiscal_registros' AND entidad_id=$1`,
          [String(difference.body.id)],
        )).count,
        1,
      );
      const notification = await one(
        `SELECT id FROM notificaciones_sistema WHERE tipo='SOLICITUD_CUADRE_FISCAL' AND entidad_id=$1`,
        [String(difference.body.id)],
      );
      ids.notifications.push(Number(notification.id));
      assert.equal(
        (await one(
          `SELECT count(*)::int count FROM auditoria WHERE usuario_id=$1
           AND accion IN ('CONFIRMAR_CUADRE_FISCAL','REPORTAR_DIFERENCIA_FISCAL') AND entidad='cuadre_fiscal_registros'`,
          [contador.id],
        )).count,
        2,
      );

      assert.equal(
        (await request("POST", `/admin/cuadre-fiscal/diferencias/${difference.body.id}/resolver`, {
          nota: "El contador no puede resolver solicitudes fiscales.",
        }, contador.session)).status,
        403,
      );
      const resolved = await request("POST", `/admin/cuadre-fiscal/diferencias/${difference.body.id}/resolver`, {
        nota: "Conciliación bancaria revisada y autorizada por administración.",
      }, admin.session);
      assert.equal(resolved.status, 200);
      assert.equal(resolved.body.estado, "RESUELTA");
      assert.equal(
        (await one(
          `SELECT count(*)::int count FROM auditoria WHERE usuario_id=$1
           AND accion='RESOLVER_DIFERENCIA_FISCAL' AND entidad='cuadre_fiscal_registros' AND entidad_id=$2`,
          [admin.id, String(difference.body.id)],
        )).count,
        1,
      );
    } finally {
      await assertIsolated();
      if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
      if (ids.notifications.length) await pool.query(
        "DELETE FROM notificaciones_sistema WHERE id = ANY($1::int[])", [ids.notifications],
      );
      if (ids.fiscalRecords.length) await pool.query(
        "DELETE FROM cuadre_fiscal_registros WHERE id = ANY($1::int[])", [ids.fiscalRecords],
      );
      if (ids.payments.length) await pool.query(
        "DELETE FROM ticket_pagos WHERE id = ANY($1::int[])", [ids.payments],
      );
      if (ids.creditApplications.length) await pool.query(
        "DELETE FROM aplicaciones_credito WHERE id = ANY($1::int[])", [ids.creditApplications],
      );
      if (ids.creditMovements.length) await pool.query(
        "DELETE FROM movimientos_credito WHERE id = ANY($1::int[])", [ids.creditMovements],
      );
      if (ids.tickets.length) await pool.query(
        "DELETE FROM tickets WHERE id = ANY($1::int[])", [ids.tickets],
      );
      if (ids.sessions.length) await pool.query(
        "DELETE FROM sesiones WHERE id = ANY($1::uuid[])", [ids.sessions],
      );
      if (ids.clients.length) await pool.query(
        "DELETE FROM clientes WHERE id = ANY($1::int[])", [ids.clients],
      );
      await pool.end();
    }
  });
}