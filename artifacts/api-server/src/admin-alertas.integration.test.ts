import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import test from "node:test";

const testUrl = process.env.TEST_DATABASE_URL;
const applicationUrl = process.env.DATABASE_URL;

if (!testUrl) {
  test.skip("admin alerts integration (TEST_DATABASE_URL not set)", () => {});
} else if (testUrl === applicationUrl) {
  throw new Error(
    "TEST_DATABASE_URL must differ from DATABASE_URL; refusing to mutate the application database.",
  );
} else {
  test("GET /admin/alertas is live, FIFO-based, ordered, and ADMIN-only", async () => {
    const [{ pool, ensureClientesSchema }, { default: app }] = await Promise.all([
      import("@workspace/db"),
      import("./app"),
    ]);
    await ensureClientesSchema(pool);

    const tag = `ALERT-${randomUUID()}`;
    const ids = {
      locations: [] as number[],
      users: [] as number[],
      clients: [] as number[],
      tickets: [] as number[],
      movements: [] as number[],
      notifications: [] as number[],
      sessions: [] as string[],
      salidas: [] as number[],
    };
    let server: Server | undefined;
    let baseUrl = "";
    const one = async (text: string, values: unknown[] = []) =>
      (await pool.query(text, values)).rows[0]!;
    const unusedLocationInitials = async () => {
      const row = await one(
        `SELECT candidate AS iniciales
         FROM (
           SELECT chr(first_code) || chr(second_code)
             || CASE WHEN third_code = 0 THEN '' ELSE chr(third_code) END AS candidate
           FROM generate_series(65,90) AS first_code
           CROSS JOIN generate_series(65,90) AS second_code
           CROSS JOIN generate_series(0,90) AS third_code
           WHERE third_code = 0 OR third_code >= 65
         ) AS candidates
         WHERE NOT EXISTS (
           SELECT 1 FROM ubicaciones WHERE iniciales = candidates.candidate
         )
         ORDER BY length(candidate), candidate
         LIMIT 1`,
      );
      assert.ok(row, "No valid unused location initials remain.");
      return String(row.iniciales);
    };

    try {
      const location = await one(
        "INSERT INTO ubicaciones(nombre,tipo,activa,iniciales) VALUES($1,'TIENDA',true,$2) RETURNING id",
        [`${tag} Tienda`, await unusedLocationInitials()],
      );
      ids.locations.push(Number(location.id));
      for (const role of ["ADMIN", "CAJA"] as const) {
        const user = await one(
          `INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id,activo,alcance_consulta)
           VALUES($1,$2,'integration-only',$3,$4,true,$5) RETURNING id`,
          [
            `${tag} ${role}`,
            `${tag.toLowerCase()}-${role.toLowerCase()}`,
            role,
            role === "ADMIN" ? null : location.id,
            role === "ADMIN" ? "TODAS" : "PROPIA",
          ],
        );
        ids.users.push(Number(user.id));
      }
      const client = await one(
        `INSERT INTO clientes(nombre,activo,limite_credito,saldo_credito,dias_credito)
         VALUES($1,true,1000,0,30) RETURNING id`,
        [`${tag} Cliente`],
      );
      ids.clients.push(Number(client.id));

      for (const userId of ids.users) {
        const sessionId = randomUUID();
        ids.sessions.push(sessionId);
        await pool.query(
          `INSERT INTO sesiones(id,usuario_id,expira_at,ip,user_agent)
           VALUES($1,$2,now()+interval '1 hour','127.0.0.1',$3)`,
          [sessionId, userId, tag],
        );
      }
      let folio = 1_700_000_000 + Math.floor(Math.random() * 100_000_000);
      const addTransitExit = async (age: "old" | "recent") => {
        const interval = age === "old" ? "25 hours" : "23 hours 59 minutes";
        const row = await one(
          `INSERT INTO salidas(
             folio,origen_id,destino_id,estado,usuario_envia_id,enviada_at,uuid_cliente
           ) VALUES($1,$2,$2,'EN_TRANSITO',$3,now()-$4::interval,gen_random_uuid())
           RETURNING id,folio`,
          [folio++, location.id, ids.users[0], interval],
        );
        ids.salidas.push(Number(row.id));
        return row;
      };
      const overdueExit = await addTransitExit("old");
      await addTransitExit("recent");

      const addTicket = async (
        ageMinutes: number,
        state: "VENDIDO" | "CANCELADO" = "VENDIDO",
        paid = false,
      ) => {
        const row = await one(
          `INSERT INTO tickets(
             folio,uuid_cliente,ubicacion_id,usuario_terminal_id,cliente_id,
              subtotal,iva,tasa_iva,total,estado,cobrado,cobrado_at,
             facturado,created_at
           ) VALUES(
              $1,gen_random_uuid(),$2,$3,$4,100,0,0,100,$5,$6,
             CASE WHEN $6 THEN now() ELSE NULL END,false,
             now()-($7::text || ' minutes')::interval
           ) RETURNING id,folio`,
          [folio++, location.id, ids.users[1], client.id, state, paid, ageMinutes],
        );
        ids.tickets.push(Number(row.id));
        return row;
      };

      const oldest = await addTicket(61);
      const old = await addTicket(31);
      await addTicket(29);
      await addTicket(90, "VENDIDO", true);
      await addTicket(90, "CANCELADO");

      const addCredit = async (
        amount: number,
        dueOffset: number,
        ticketId: number | null,
        note: string,
        ageDays: number,
      ) => {
        const row = await one(
          `INSERT INTO movimientos_credito(
             cliente_id,ticket_id,tipo,importe,usuario_id,notas,dias_plazo,
             fecha_vencimiento,created_at
           ) VALUES(
             $1,$2,'VENTA_CREDITO',$3,$4,$5,30,
              (now() AT TIME ZONE 'America/Mexico_City')::date+$6::int,
             now()-($7::text || ' days')::interval
           ) RETURNING id,fecha_vencimiento`,
          [client.id, ticketId, amount, ids.users[0], note, dueOffset, ageDays],
        );
        ids.movements.push(Number(row.id));
        return row;
      };
      const overdue = await addCredit(100, -1, Number(oldest.id), `${tag} vencida`, 3);
      const upcoming = await addCredit(80, 2, Number(old.id), `${tag} próxima`, 2);
      await addCredit(90, 4, null, `${tag} fuera`, 1);
      const payment = await one(
        `INSERT INTO movimientos_credito(cliente_id,tipo,importe,usuario_id,notas)
         VALUES($1,'ABONO',-40,$2,$3) RETURNING id`,
        [client.id, ids.users[0], `${tag} abono`],
      );
      ids.movements.push(Number(payment.id));

      const notification = await one(
        `INSERT INTO notificaciones_credito(
           ticket_id,cliente_id,cliente_nombre,folio,importe,dias_plazo,
           fecha_vencimiento,cajero_id,cajero_nombre,tienda_id,tienda_nombre,urgente
         ) VALUES($1,$2,$3,$4,999,30,
           (now() AT TIME ZONE 'America/Mexico_City')::date,
           $5,$6,$7,$8,true) RETURNING id`,
        [
          oldest.id,
          client.id,
          `${tag} Cliente`,
          oldest.folio,
          ids.users[1],
          `${tag} CAJA`,
          location.id,
          `${tag} Tienda`,
        ],
      );
      ids.notifications.push(Number(notification.id));

      server = createServer(app);
      await new Promise<void>((resolve) => {
        server!.listen(0, "127.0.0.1", () => {
          const address = server!.address();
          assert.ok(address && typeof address !== "string");
          baseUrl = `http://127.0.0.1:${address.port}/api`;
          resolve();
        });
      });
      const request = (sessionId: string) =>
        fetch(`${baseUrl}/admin/alertas`, {
          headers: { Cookie: `mariana_session=${sessionId}` },
        });

      assert.equal((await request(ids.sessions[1]!)).status, 403);
      const notificationsBefore = Number(
        (await one("SELECT COUNT(*)::int count FROM notificaciones_credito")).count,
      );
      const response = await request(ids.sessions[0]!);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control") ?? "", /no-store/);
      const body = (await response.json()) as {
        total: number;
        ticketsPendientes: Array<{
          id: number;
          minutosTranscurridos: number;
          nombreUbicacion: string;
          nombreCliente: string;
          importe: string;
          nombreCreador: string;
        }>;
        creditos: Array<{
          movimientoId: number;
          nota: string | null;
          ticketFolio: number | null;
          importe: string;
          fechaVencimiento: string;
          diasRestantes: number;
        }>;
        salidasEnTransito: Array<{
          id: number;
          folio: number;
          horasEnTransito: number;
          nombreOrigen: string;
          nombreDestino: string;
          enviadaAt: string;
        }>;
      };
       assert.equal(body.total, body.ticketsPendientes.length + body.creditos.length + body.salidasEnTransito.length);
      const fixtureTickets = body.ticketsPendientes.filter(({ id }) =>
        ids.tickets.includes(id),
      );
      assert.deepEqual(fixtureTickets.map(({ id }) => id), [
        Number(oldest.id),
        Number(old.id),
      ]);
      assert.ok(fixtureTickets.every(({ minutosTranscurridos }) => minutosTranscurridos > 30));
      assert.equal(fixtureTickets[0]!.nombreUbicacion, `${tag} Tienda`);
      assert.equal(fixtureTickets[0]!.nombreCliente, `${tag} Cliente`);
      assert.equal(fixtureTickets[0]!.importe, "100.00");
      assert.equal(fixtureTickets[0]!.nombreCreador, `${tag} CAJA`);

      const fixtureCredit = body.creditos.filter(({ movimientoId }) =>
        [Number(overdue.id), Number(upcoming.id)].includes(movimientoId),
      );
      assert.deepEqual(fixtureCredit.map(({ movimientoId }) => movimientoId), [
        Number(overdue.id),
        Number(upcoming.id),
      ]);
      assert.equal(fixtureCredit[0]!.importe, "60.00");
      assert.equal(fixtureCredit[0]!.diasRestantes, -1);
      assert.equal(fixtureCredit[0]!.ticketFolio, Number(oldest.folio));
      assert.equal(fixtureCredit[1]!.diasRestantes, 2);
      assert.equal(fixtureCredit[1]!.nota, `${tag} próxima`);
      assert.match(fixtureCredit[0]!.fechaVencimiento, /^\d{4}-\d{2}-\d{2}$/);
       const fixtureTransit = body.salidasEnTransito.filter(({ id }) => ids.salidas.includes(id));
       assert.deepEqual(fixtureTransit.map(({ id }) => id), [Number(overdueExit.id)]);
       assert.equal(fixtureTransit[0]!.folio, Number(overdueExit.folio));
       assert.ok(fixtureTransit[0]!.horasEnTransito >= 25);
       assert.equal(fixtureTransit[0]!.nombreOrigen, `${tag} Tienda`);
       assert.equal(fixtureTransit[0]!.nombreDestino, `${tag} Tienda`);
       assert.match(fixtureTransit[0]!.enviadaAt, /^\d{4}-\d{2}-\d{2}T/);
      assert.equal(
        Number((await one("SELECT COUNT(*)::int count FROM notificaciones_credito")).count),
        notificationsBefore,
      );

      await pool.query(
        "UPDATE tickets SET cobrado=true,cobrado_at=now() WHERE id=$1",
        [oldest.id],
      );
      const settlement = await one(
        `INSERT INTO movimientos_credito(cliente_id,tipo,importe,usuario_id,notas)
         VALUES($1,'ABONO',-140,$2,$3) RETURNING id`,
        [client.id, ids.users[0], `${tag} liquidación`],
      );
      ids.movements.push(Number(settlement.id));

      const afterSettlementResponse = await request(ids.sessions[0]!);
      assert.equal(afterSettlementResponse.status, 200);
      const afterSettlement = (await afterSettlementResponse.json()) as {
        ticketsPendientes: Array<{ id: number }>;
        creditos: Array<{ movimientoId: number }>;
      };
      assert.ok(
        !afterSettlement.ticketsPendientes.some(({ id }) => id === Number(oldest.id)),
        "A collected ticket must disappear from the live alerts response",
      );
      assert.ok(
        afterSettlement.ticketsPendientes.some(({ id }) => id === Number(old.id)),
        "Other unpaid old tickets must remain visible",
      );
      assert.ok(
        !afterSettlement.creditos.some(({ movimientoId }) =>
          [Number(overdue.id), Number(upcoming.id)].includes(movimientoId),
        ),
        "Fully settled credit rows must disappear from the live alerts response",
      );
    } finally {
      if (server) {
        await new Promise<void>((resolve) => server!.close(() => resolve()));
      }
      if (ids.notifications.length) {
        await pool.query("DELETE FROM notificaciones_credito WHERE id=ANY($1::int[])", [
          ids.notifications,
        ]);
      }
       if (ids.salidas.length) {
         await pool.query("DELETE FROM salidas WHERE id=ANY($1::int[])", [ids.salidas]);
       }
      if (ids.sessions.length) {
        await pool.query("DELETE FROM sesiones WHERE id=ANY($1::uuid[])", [ids.sessions]);
      }
      await pool.end();
    }
  });
}