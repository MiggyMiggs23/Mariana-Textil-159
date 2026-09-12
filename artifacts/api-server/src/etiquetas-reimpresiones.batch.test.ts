import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { ZodError, z } from "zod/v4";

/**
 * These are no-DB route regressions. The route source is extracted and
 * transpiled just like the existing resolver tests, then registered on a
 * small router double. The handler, validation schema, transaction callback,
 * and read routes are the application's code; only db, auth middleware, and
 * Express response/request objects are mocked.
 */
const routeSource = readFileSync(new URL("./routes/etiquetas.ts", import.meta.url), "utf8");
const sourceStart = routeSource.indexOf("const id =");
const sourceEnd = routeSource.lastIndexOf("export default router;");
assert.ok(sourceStart >= 0, "could not locate etiquetas route declarations");
assert.ok(sourceEnd > sourceStart, "could not locate etiquetas route export");

type Query = {
  kind: "template" | "join" | "raw";
  strings: string[];
  values: unknown[];
};

type SqlTag = {
  (strings: TemplateStringsArray, ...values: unknown[]): Query;
  join(chunks: Query[], separator: Query): Query;
  raw(value: string): Query;
};

const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => ({
  kind: "template" as const,
  strings: [...strings],
  values,
})) as SqlTag;
sql.join = (chunks, separator) => ({
  kind: "join",
  strings: ["join"],
  values: [chunks, separator],
});
sql.raw = (value) => ({ kind: "raw", strings: [value], values: [] });

type DbRow = Record<string, unknown>;
type Handler = (req: any, res: any, next: (error?: unknown) => void) => unknown;
type Route = { method: "get" | "post"; path: string; handler: Handler };

type Scenario = {
  rows: DbRow[];
  counts: Map<number, number>;
  allQueries: Query[];
  dbQueries: Query[];
  txQueries: Query[];
  reprintQueries: Query[];
  auditQueries: Query[];
  transactions: number;
  committed: number;
  rolledBack: number;
  failOnReprintInsert?: number;
};

function queryText(query: Query): string {
  return query.strings.join(" ");
}

function hasText(query: Query, text: string): boolean {
  return queryText(query).includes(text);
}

function rollo(id: number, reimpresionesCount = 0): DbRow {
  return {
    id,
    serie: `SERIE-${id}`,
    producto_id: 73,
    ubicacion_id: 11,
    sku: "SKU-73",
    tela: "Lino",
    color: "Azul",
    unidad: "METRO",
    cantidad_actual: "20.000",
    sitio_nombre: "Bodega principal",
    sitio_id: 11,
    estado: "DISPONIBLE",
    created_at: "2026-09-12T10:00:00.000Z",
    entrada_id: null,
    folio: null,
    reimpresiones_count: reimpresionesCount,
    ultima_reimpresion: null,
  };
}

function createScenario(rows: DbRow[]): { scenario: Scenario; db: Record<string, unknown> } {
  const counts = new Map(
    rows.map((row) => [Number(row.id), Number(row.reimpresiones_count ?? 0)] as const),
  );
  const scenario: Scenario = {
    rows,
    counts,
    allQueries: [],
    dbQueries: [],
    txQueries: [],
    reprintQueries: [],
    auditQueries: [],
    transactions: 0,
    committed: 0,
    rolledBack: 0,
  };

  const db = {
    async execute(query: Query) {
      scenario.allQueries.push(query);
      scenario.dbQueries.push(query);
      if (hasText(query, "SELECT COUNT(*)::int AS count")) {
        return {
          rows: [
            {
              count: [...scenario.counts.values()].filter((count) => count >= 3).length,
            },
          ],
        };
      }
      if (hasText(query, "FROM rollos r")) {
        return {
          rows: scenario.rows.map((row) => ({
            ...row,
            reimpresiones_count: scenario.counts.get(Number(row.id)) ?? 0,
            total: scenario.rows.length,
          })),
        };
      }
      return { rows: [] };
    },

    async transaction<T>(callback: (tx: { execute(query: Query): Promise<{ rows: DbRow[] }> }) => Promise<T>) {
      scenario.transactions += 1;
      const before = new Map(scenario.counts);
      let reprintInsertAttempt = 0;
      const tx = {
        async execute(query: Query) {
          scenario.allQueries.push(query);
          scenario.txQueries.push(query);
          if (hasText(query, "SELECT r.id,r.serie")) {
            return { rows: scenario.rows };
          }
          if (hasText(query, "INSERT INTO reimpresiones_etiqueta")) {
            scenario.reprintQueries.push(query);
            reprintInsertAttempt += 1;
            if (scenario.failOnReprintInsert === reprintInsertAttempt) {
              throw new Error("simulated reprint insert failure");
            }
            const id = Number(query.values[0]);
            scenario.counts.set(id, (scenario.counts.get(id) ?? 0) + 1);
            return { rows: [] };
          }
          if (hasText(query, "INSERT INTO auditoria")) {
            scenario.auditQueries.push(query);
            return { rows: [] };
          }
          return { rows: [] };
        },
      };

      try {
        const result = await callback(tx);
        scenario.committed += 1;
        return result;
      } catch (error) {
        scenario.counts.clear();
        for (const [id, count] of before) scenario.counts.set(id, count);
        scenario.rolledBack += 1;
        throw error;
      }
    },
  };

  return { scenario, db };
}

function compileRoutes(db: Record<string, unknown>): {
  routes: Route[];
  errorHandlers: Array<(error: unknown, req: any, res: any, next: () => void) => void>;
} {
  const javascript = ts.transpileModule(
    routeSource.slice(sourceStart, sourceEnd),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    },
  ).outputText;
  const routes: Route[] = [];
  const errorHandlers: Array<(error: unknown, req: any, res: any, next: () => void) => void> = [];
  const router = {
    get(...args: unknown[]) {
      const path = String(args[0]);
      const handler = args.at(-1);
      assert.equal(typeof handler, "function");
      routes.push({ method: "get", path, handler: handler as Handler });
    },
    post(...args: unknown[]) {
      const path = String(args[0]);
      const handler = args.at(-1);
      assert.equal(typeof handler, "function");
      routes.push({ method: "post", path, handler: handler as Handler });
    },
    use(...args: unknown[]) {
      if (args.length === 1 && typeof args[0] === "function") {
        errorHandlers.push(args[0] as (error: unknown, req: any, res: any, next: () => void) => void);
      }
    },
  };
  const requireSession = () => undefined;
  const requierePermiso = () => () => undefined;
  const normalizeUsername = (value: string) => value.trim().toLowerCase();
  const getRequestIp = (req: { ip?: string }) => req.ip ?? "127.0.0.1";
  const interpretarCodigoEscaneado = () => ({ serie: null });

  new Function(
    "router",
    "z",
    "ZodError",
    "sql",
    "db",
    "interpretarCodigoEscaneado",
    "requireSession",
    "requierePermiso",
    "normalizeUsername",
    "getRequestIp",
    "ExcelJS",
    javascript,
  )(
    router,
    z,
    ZodError,
    sql,
    db,
    interpretarCodigoEscaneado,
    requireSession,
    requierePermiso,
    normalizeUsername,
    getRequestIp,
    {},
  );

  return { routes, errorHandlers };
}

const actor = {
  id: 7001,
  nombre: "Ana Operadora",
  usuario: "ana.operadora",
  rol: "ADMIN",
  ubicacionId: 11,
  alcanceConsulta: "TODAS",
};

async function invoke(
  compiled: ReturnType<typeof compileRoutes>,
  method: "get" | "post",
  path: string,
  request: Record<string, unknown>,
): Promise<{ status: number; body: unknown; nextError?: unknown }> {
  const route = compiled.routes.find((candidate) => candidate.method === method && candidate.path === path);
  assert.ok(route, `route ${method.toUpperCase()} ${path} was not registered`);
  let status = 200;
  let body: unknown;
  let nextError: unknown;
  const response = {
    status(code: number) {
      status = code;
      return response;
    },
    json(value: unknown) {
      body = value;
      return response;
    },
    setHeader() {
      return response;
    },
    send(value: unknown) {
      body = value;
      return response;
    },
  };
  const next = (error?: unknown) => {
    if (error === undefined) return;
    const errorHandler = compiled.errorHandlers[0];
    if (!errorHandler) {
      nextError = error;
      return;
    }
    let delegated = false;
    errorHandler(error, request, response, () => {
      delegated = true;
    });
    if (delegated) nextError = error;
  };
  await route.handler(
    {
      ip: "192.0.2.44",
      query: {},
      params: {},
      ...request,
    },
    response,
    next,
  );
  return { status, body, nextError };
}

function reprintValues(query: Query) {
  return {
    rolloId: Number(query.values[0]),
    usuarioId: Number(query.values[1]),
    autorizadoPor: query.values[2],
    motivo: String(query.values[3]),
  };
}

function auditValues(query: Query) {
  const data = JSON.parse(String(query.values[3])) as {
    rolloId: number;
    motivo: string;
  };
  return {
    usuarioId: Number(query.values[0]),
    accion: "REIMPRIMIR_ETIQUETA",
    entidad: "reimpresiones_etiqueta",
    entidadId: String(query.values[1]),
    data,
  };
}

function request(body: unknown, extra: Record<string, unknown> = {}) {
  return {
    auth: { user: actor },
    body,
    ...extra,
  };
}

test("batch route performs one reprint and one audit insert for one roll", async () => {
  const { scenario, db } = createScenario([rollo(101)]);
  const compiled = compileRoutes(db);
  const motivo = "Etiqueta dañada durante traslado";

  const result = await invoke(
    compiled,
    "post",
    "/etiquetas/reimpresiones",
    request({ rolloIds: [101], motivo }),
  );

  assert.equal(result.status, 201);
  assert.equal(result.nextError, undefined);
  assert.equal(scenario.transactions, 1);
  assert.equal(scenario.committed, 1);
  assert.equal(scenario.rolledBack, 0);
  assert.deepEqual(scenario.reprintQueries.map(reprintValues), [
    { rolloId: 101, usuarioId: actor.id, autorizadoPor: null, motivo },
  ]);
  assert.deepEqual(scenario.auditQueries.map(auditValues), [
    {
      usuarioId: actor.id,
      accion: "REIMPRIMIR_ETIQUETA",
      entidad: "reimpresiones_etiqueta",
      entidadId: "101",
      data: { rolloId: 101, serie: "SERIE-101", motivo, autorizadoPor: null },
    },
  ]);
});

test("batch route keeps one same-actor/same-reason pair per roll, never a batch audit replacement", async () => {
  const ids = [201, 202, 203];
  const { scenario, db } = createScenario(ids.map((id) => rollo(id)));
  const compiled = compileRoutes(db);
  const motivo = "Reposición solicitada por control de calidad";

  const result = await invoke(
    compiled,
    "post",
    "/etiquetas/reimpresiones",
    request({ rolloIds: ids, motivo }),
  );

  assert.equal(result.status, 201);
  assert.deepEqual(scenario.reprintQueries.map(reprintValues), ids.map((rolloId) => ({
    rolloId,
    usuarioId: actor.id,
    autorizadoPor: null,
    motivo,
  })));
  assert.deepEqual(scenario.auditQueries.map(auditValues), ids.map((rolloId) => ({
    usuarioId: actor.id,
    accion: "REIMPRIMIR_ETIQUETA",
    entidad: "reimpresiones_etiqueta",
    entidadId: String(rolloId),
    data: { rolloId, serie: `SERIE-${rolloId}`, motivo, autorizadoPor: null },
  })));
  assert.equal(scenario.reprintQueries.length, ids.length);
  assert.equal(scenario.auditQueries.length, ids.length);
  assert.equal(scenario.txQueries.filter((query) => hasText(query, "INSERT INTO auditoria")).length, ids.length);
  assert.deepEqual((result.body as { etiquetas: unknown[] }).etiquetas.length, ids.length);
});

test("invalid reason and 51-roll batch are rejected before opening a transaction or inserting", async () => {
  for (const body of [
    { rolloIds: [301], motivo: "corto" },
    { rolloIds: Array.from({ length: 51 }, (_, index) => index + 301), motivo: "Motivo suficientemente largo" },
  ]) {
    const { scenario, db } = createScenario([rollo(301)]);
    const compiled = compileRoutes(db);
    const result = await invoke(compiled, "post", "/etiquetas/reimpresiones", request(body));

    assert.equal(result.status, 400);
    assert.equal(result.nextError, undefined);
    assert.deepEqual(scenario.reprintQueries, []);
    assert.deepEqual(scenario.auditQueries, []);
    assert.equal(scenario.transactions, 0);
  }
});

test("the 50-roll maximum and exact ten-character reason remain accepted", async () => {
  const ids = Array.from({ length: 50 }, (_, index) => index + 350);
  const { scenario, db } = createScenario(ids.map((id) => rollo(id)));
  const compiled = compileRoutes(db);

  const result = await invoke(
    compiled,
    "post",
    "/etiquetas/reimpresiones",
    request({ rolloIds: ids, motivo: "1234567890" }),
  );

  assert.equal(result.status, 201);
  assert.equal(scenario.reprintQueries.length, 50);
  assert.equal(scenario.auditQueries.length, 50);
  assert.equal(scenario.reprintQueries.every((query) => query.values[3] === "1234567890"), true);
});

test("transaction failure rolls back earlier roll inserts in the mocked transaction", async () => {
  const { scenario, db } = createScenario([rollo(401), rollo(402)]);
  scenario.failOnReprintInsert = 2;
  const compiled = compileRoutes(db);

  const result = await invoke(
    compiled,
    "post",
    "/etiquetas/reimpresiones",
    request({
      rolloIds: [401, 402],
      motivo: "Falla simulada para probar rollback",
    }),
  );

  assert.equal(result.status, 200);
  assert.match(String(result.nextError), /simulated reprint insert failure/);
  assert.equal(scenario.transactions, 1);
  assert.equal(scenario.committed, 0);
  assert.equal(scenario.rolledBack, 1);
  assert.equal(scenario.counts.get(401), 0);
  assert.equal(scenario.counts.get(402), 0);
  assert.equal(scenario.auditQueries.length, 1);
});

test("prior two reprints become the third and activate both read thresholds", async () => {
  const { scenario, db } = createScenario([rollo(501, 2)]);
  const compiled = compileRoutes(db);
  const motivo = "Tercera impresión necesaria por daño";

  const before = await invoke(compiled, "get", "/etiquetas/rollos", request(undefined));
  assert.equal(before.status, 200);
  assert.equal((before.body as any).items[0].reimpresionesCount, 2);
  assert.equal((before.body as any).items[0].alertaReimpresiones, false);

  const reprint = await invoke(
    compiled,
    "post",
    "/etiquetas/reimpresiones",
    request({ rolloIds: [501], motivo }),
  );
  assert.equal(reprint.status, 201);
  assert.equal(scenario.counts.get(501), 3);

  const after = await invoke(compiled, "get", "/etiquetas/rollos", request(undefined));
  assert.equal(after.status, 200);
  assert.equal((after.body as any).items[0].reimpresionesCount, 3);
  assert.equal((after.body as any).items[0].alertaReimpresiones, true);

  const alerts = await invoke(compiled, "get", "/etiquetas/alertas/count", request(undefined));
  assert.equal(alerts.status, 200);
  assert.deepEqual(alerts.body, { count: 1, threshold: 3 });
  assert.ok(
    scenario.dbQueries.some((query) => hasText(query, "HAVING COUNT(*) >= 3")),
    "global alert query must retain the threshold of three",
  );
});