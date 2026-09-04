import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import test, { after, before } from "node:test";
import { ensureClientesSchema, pool } from "@workspace/db";
import app from "../app";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const enabled = process.env.NODE_ENV === "test" && Boolean(testDatabaseUrl);

const run = `NOT-${randomUUID()}`;
const dueDate = "2030-02-03";
let server: Server;
let baseUrl = "";
let locationId = 0;
let adminId = 0;
let nonAdminId = 0;
let customerId = 0;
let ticketId = 0;
let notificationId = 0;
let adminSession = "";
let nonAdminSession = "";

function cookie(sessionId: string): string {
  return `mariana_session=${sessionId}`;
}

async function unusedLocationInitials(): Promise<string> {
  const result = await pool.query<{ iniciales: string }>(
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
  assert.ok(result.rows[0], "No hay iniciales válidas disponibles para la prueba.");
  return result.rows[0].iniciales;
}

async function request(
  path: string,
  sessionId: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Cookie: cookie(sessionId),
    },
  });
}

before(async () => {
  if (!enabled) return;
  if (testDatabaseUrl === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL debe ser distinta de DATABASE_URL.");
  }
  await ensureClientesSchema(pool);

  const locationInitials = await unusedLocationInitials();
  const location = await pool.query<{ id: number }>(
    `INSERT INTO ubicaciones (nombre,tipo,activa,iniciales)
     VALUES ($1,'TIENDA',true,$2) RETURNING id`,
    [`Tienda ${run}`, locationInitials],
  );
  locationId = location.rows[0]!.id;

  const users = await pool.query<{ id: number; rol: string }>(
    `INSERT INTO usuarios
       (nombre,usuario,password_hash,rol,ubicacion_id,activo,alcance_consulta)
     VALUES
       ($1,$2,'not-used','ADMIN',NULL,true,'TODAS'),
       ($3,$4,'not-used','BODEGA',$5,true,'PROPIA')
     RETURNING id,rol`,
    [
      `Admin ${run}`,
      `admin-${run}`,
      `Bodega ${run}`,
      `bodega-${run}`,
      locationId,
    ],
  );
  adminId = users.rows.find(({ rol }) => rol === "ADMIN")!.id;
  nonAdminId = users.rows.find(({ rol }) => rol === "BODEGA")!.id;

  adminSession = randomUUID();
  nonAdminSession = randomUUID();
  await pool.query(
    `INSERT INTO sesiones (id,usuario_id,expira_at,ip,user_agent)
     VALUES ($1,$2,now()+interval '1 hour','127.0.0.1',$3),
            ($4,$5,now()+interval '1 hour','127.0.0.1',$3)`,
    [adminSession, adminId, run, nonAdminSession, nonAdminId],
  );

  const customer = await pool.query<{ id: number }>(
    `INSERT INTO clientes (nombre,activo,limite_credito,dias_credito)
     VALUES ($1,true,100,30) RETURNING id`,
    [`Cliente ${run}`],
  );
  customerId = customer.rows[0]!.id;

  const ticket = await pool.query<{ id: number }>(
    `INSERT INTO tickets
       (folio,uuid_cliente,ubicacion_id,usuario_terminal_id,cliente_id,
         subtotal,iva,tasa_iva,total,facturado)
     VALUES
       ((SELECT COALESCE(MAX(folio),0)+100000 FROM tickets),gen_random_uuid(),
         $1,$2,$3,150,0,0,150,false)
     RETURNING id`,
    [locationId, nonAdminId, customerId],
  );
  ticketId = ticket.rows[0]!.id;

  const notification = await pool.query<{ id: number }>(
    `INSERT INTO notificaciones_credito
       (ticket_id,cliente_id,cliente_nombre,folio,importe,dias_plazo,
        fecha_vencimiento,cajero_id,cajero_nombre,tienda_id,tienda_nombre,urgente)
     VALUES ($1,$2,$3,999999,150,30,$4,$5,$6,$7,$8,true)
     RETURNING id`,
    [
      ticketId,
      customerId,
      `Cliente ${run}`,
      dueDate,
      nonAdminId,
      `Bodega ${run}`,
      locationId,
      `Tienda ${run}`,
    ],
  );
  notificationId = notification.rows[0]!.id;

  server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      baseUrl = `http://127.0.0.1:${address.port}/api`;
      resolve();
    });
  });
});

after(async () => {
  if (!enabled) return;
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  if (notificationId) {
    await pool.query("DELETE FROM notificaciones_credito WHERE id=$1", [
      notificationId,
    ]);
  }
  if (ticketId) {
    await pool.query("DELETE FROM tickets WHERE id=$1", [ticketId]);
  }
  if (customerId) {
    await pool.query("DELETE FROM clientes WHERE id=$1", [customerId]);
  }
  if (adminSession || nonAdminSession) {
    await pool.query("DELETE FROM sesiones WHERE id=ANY($1::uuid[])", [
      [adminSession, nonAdminSession].filter(Boolean),
    ]);
  }
  if (adminId || nonAdminId) {
    await pool.query("DELETE FROM usuarios WHERE id=ANY($1::int[])", [
      [adminId, nonAdminId].filter(Boolean),
    ]);
  }
  if (locationId) {
    await pool.query("DELETE FROM ubicaciones WHERE id=$1", [locationId]);
  }
  await pool.end();
});

test("notification endpoints preserve calendar dates, authorization, and persistence", async (t) => {
  if (!enabled) {
    t.skip("TEST_DATABASE_URL no está configurada explícitamente.");
    return;
  }
  const nonAdminList = await request("/notificaciones", nonAdminSession);
  assert.equal(nonAdminList.status, 200);
  assert.deepEqual(
    ((await nonAdminList.json()) as { notificaciones: unknown[] }).notificaciones,
    [],
    "Un usuario no ADMIN no debe recibir notificaciones de crédito globales.",
  );

  const listResponse = await request("/notificaciones", adminSession);
  assert.equal(listResponse.status, 200);
  const list = (await listResponse.json()) as {
    notificaciones: Array<{
      id: number;
      fechaVencimiento: string;
      urgente: boolean;
      leidaAt: string | null;
    }>;
  };
  const listed = list.notificaciones.find(({ id }) => id === notificationId);
  assert.ok(listed);
  assert.equal(listed.fechaVencimiento, dueDate);
  assert.equal(listed.urgente, true);
  assert.equal(listed.leidaAt, null);

  const readResponse = await request(
    `/notificaciones/${notificationId}/leer`,
    adminSession,
    { method: "POST" },
  );
  assert.equal(readResponse.status, 200);
  const marked = (await readResponse.json()) as {
    id: number;
    fechaVencimiento: string;
    urgente: boolean;
    leidaAt: string | null;
  };
  assert.equal(marked.id, notificationId);
  assert.equal(marked.fechaVencimiento, dueDate);
  assert.equal(marked.urgente, true);
  assert.ok(marked.leidaAt);

  const persistedResponse = await request("/notificaciones", adminSession);
  assert.equal(persistedResponse.status, 200);
  const persistedBody = (await persistedResponse.json()) as {
    notificaciones: Array<{
      id: number;
      fechaVencimiento: string;
      urgente: boolean;
      leidaAt: string | null;
    }>;
  };
  const persisted = persistedBody.notificaciones.find(
    ({ id }) => id === notificationId,
  );
  assert.ok(persisted);
  assert.equal(persisted.fechaVencimiento, dueDate);
  assert.equal(persisted.urgente, true);
  assert.ok(persisted.leidaAt);
});