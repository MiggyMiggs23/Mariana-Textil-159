import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";

type PoolClient = {
  query: (text: string, values?: unknown[]) => Promise<unknown>;
  release: () => void;
};

const testUrl = process.env.TEST_DATABASE_URL;
const appUrl = process.env.DATABASE_URL;

if (process.env.NODE_ENV !== "test" || !testUrl) {
  throw new Error(
    "PostgreSQL unique concurrency integration requires NODE_ENV=test and explicit TEST_DATABASE_URL.",
  );
}
if (testUrl === appUrl) {
  throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL.");
}
const expectedDb = decodeURIComponent(new URL(testUrl).pathname.slice(1));
if (!expectedDb) {
  throw new Error("TEST_DATABASE_URL must name an isolated database.");
}
if (appUrl) {
  const appDb = decodeURIComponent(new URL(appUrl).pathname.slice(1));
  if (appDb === expectedDb) {
    throw new Error(
      "TEST_DATABASE_URL must name a database different from the application database.",
    );
  }
}

const BARRIER_TIMEOUT_MS = 1_000;
const RESPONSE_TIMEOUT_MS = 10_000;
const tag = `PG-UNIQUE-RACE-${randomUUID()}`;

let server: Server;
let baseUrl = "";
let adminId = 0;
let adminSession = "";
let pool: typeof import("@workspace/db")["pool"];

async function mutate(text: string, values: unknown[] = []) {
  const identity = await pool.query<{ database: string }>(
    "SELECT current_database() AS database",
  );
  assert.equal(
    identity.rows[0]?.database,
    expectedDb,
    "Refusing fixture mutation outside TEST_DATABASE_URL.",
  );
  return pool.query(text, values);
}

async function post(path: string, body: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      cookie: `mariana_session=${adminSession}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as Record<string, unknown>;
  return { status: response.status, payload };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`Timed out after ${timeoutMs}ms.`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function expectConcurrentConflict(input: {
  insertFirst: (client: PoolClient) => Promise<void>;
  requestSecond: () => Promise<{ status: number; payload: Record<string, unknown> }>;
  expectedStatus: 400 | 409;
  expectedMessage: RegExp;
}) {
  let releaseFirst!: () => void;
  const firstMayContinue = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let signalFirstReached!: () => void;
  const firstReached = new Promise<void>((resolve) => {
    signalFirstReached = resolve;
  });
  let blocker: PoolClient | undefined;
  let firstFailure: unknown;

  const first = (async () => {
    blocker = await pool.connect() as unknown as PoolClient;
    try {
      await blocker.query("BEGIN");
      await input.insertFirst(blocker);
      signalFirstReached();
      await firstMayContinue;
      await blocker.query("COMMIT");
    } catch (error) {
      firstFailure = error;
      signalFirstReached();
      await blocker.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      blocker.release();
    }
  })();

  let secondSettled = false;
  try {
    await withTimeout(firstReached, RESPONSE_TIMEOUT_MS);
    if (firstFailure) throw firstFailure;

    const second = input.requestSecond().finally(() => {
      secondSettled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, BARRIER_TIMEOUT_MS));
    const secondWasBlockedByUncommittedUniqueKey = !secondSettled;

    releaseFirst();
    await withTimeout(first, RESPONSE_TIMEOUT_MS);
    const result = await withTimeout(second, RESPONSE_TIMEOUT_MS);

    assert.equal(
      secondWasBlockedByUncommittedUniqueKey,
      true,
      "The second create did not wait behind the uncommitted unique key.",
    );
    assert.equal(result.status, input.expectedStatus, JSON.stringify(result.payload));
    assert.match(String(result.payload.error), input.expectedMessage);
  } finally {
    releaseFirst();
    if (blocker) {
      await blocker.query("ROLLBACK").catch(() => undefined);
    }
    await first.catch(() => undefined);
  }
}

before(async () => {
  const database = await import("@workspace/db");
  ({ pool } = database);
  await database.ensureClientesSchema(pool);
  const { default: app } = await import("./app");

  const user = await mutate(
    `INSERT INTO usuarios
      (nombre,usuario,password_hash,rol,ubicacion_id,activo,alcance_consulta)
     VALUES($1,$2,'integration-session-only','ADMIN',NULL,true,'TODAS')
     RETURNING id`,
    [`${tag} Admin`, `${tag}-admin`.toLowerCase()],
  );
  adminId = Number(user.rows[0]!.id);
  adminSession = randomUUID();
  await mutate(
    `INSERT INTO sesiones(id,usuario_id,expira_at,ip,user_agent)
     VALUES($1,$2,now()+interval '1 hour','127.0.0.1',$3)`,
    [adminSession, adminId, tag],
  );

  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
  }
  await pool.end();
});

test("clientes maps a barrier-forced concurrent unique conflict to 409", async () => {
  const nombre = `${tag} Cliente`;
  await expectConcurrentConflict({
    insertFirst: async (client) => {
      await client.query(
        "INSERT INTO clientes(nombre,activo,es_sistema) VALUES($1,true,false)",
        [nombre],
      );
    },
    requestSecond: () => post("/api/clientes", { nombre: `  ${nombre.toUpperCase()}  ` }),
    expectedStatus: 409,
    expectedMessage: /cliente activo con ese nombre/i,
  });
});

test("productos maps a barrier-forced concurrent unique conflict to 400", async () => {
  const sku = `${tag}-SKU`.toUpperCase();
  const tela = `${tag} Tela`;
  const color = `${tag} Color`;
  await expectConcurrentConflict({
    insertFirst: async (client) => {
      await client.query(
        `INSERT INTO productos
          (sku,tela,color,unidad,se_vende_por_metro,precio_sugerido)
         VALUES($1,$2,$3,'METRO',true,'100.00')`,
        [sku, tela, color],
      );
    },
    requestSecond: () => post("/api/productos", {
      sku,
      tela,
      color,
      unidad: "METRO",
      precioSugerido: "100.00",
    }),
    expectedStatus: 400,
    expectedMessage: /Ya existe un producto/i,
  });
});

test("ubicaciones maps a barrier-forced concurrent unique conflict to 400", async () => {
  const name = `${tag} Ubicación`;
  const initials = String(
    (await mutate(
      `SELECT candidate
       FROM (
         SELECT chr(a) || chr(b) || chr(c) AS candidate
         FROM generate_series(65,90) AS a
         CROSS JOIN generate_series(65,90) AS b
         CROSS JOIN generate_series(65,90) AS c
       ) AS candidates
       WHERE NOT EXISTS (
         SELECT 1 FROM ubicaciones WHERE iniciales=candidate
       )
       ORDER BY candidate LIMIT 1`,
    )).rows[0]!.candidate,
  );
  await expectConcurrentConflict({
    insertFirst: async (client) => {
      await client.query(
        "INSERT INTO ubicaciones(nombre,iniciales,tipo) VALUES($1,$2,'TIENDA')",
        [name, initials],
      );
    },
    requestSecond: () => post("/api/locations", {
      nombre: name,
      iniciales: initials,
      tipo: "TIENDA",
    }),
    expectedStatus: 400,
    expectedMessage: /Ya existe un sitio/i,
  });
});

test("usuarios maps a barrier-forced concurrent unique conflict to 400", async () => {
  const username = `${tag}-usuario`.toLowerCase();
  await expectConcurrentConflict({
    insertFirst: async (client) => {
      await client.query(
        `INSERT INTO usuarios
          (nombre,usuario,password_hash,rol,ubicacion_id,activo,alcance_consulta)
         VALUES($1,$2,'integration-session-only','ADMIN',NULL,true,'TODAS')`,
        [`${tag} Usuario`, username],
      );
    },
    requestSecond: () => post("/api/users", {
      nombre: `${tag} Usuario Concurrente`,
      usuario: username,
      password: "Concurrente-12345",
      rol: "ADMIN",
      ubicacionId: null,
      alcanceConsulta: "TODAS",
    }),
    expectedStatus: 400,
    expectedMessage: /nombre de usuario ya está en uso/i,
  });
});