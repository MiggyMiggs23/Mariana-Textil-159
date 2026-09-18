/**
 * E10 real PostgreSQL/HTTP cases.
 *
 * This module deliberately has no executable top-level work. The guarded E10
 * operator must set the isolated child DATABASE_URL and NODE_ENV=test, verify
 * the manifest/destination, and only then dynamically import this file.
 *
 * Authentication here is an in-process test AuthContext, not a login or a
 * persisted session. The production auth router/middleware is never imported.
 */
import assert from "node:assert/strict";
import { once } from "node:events";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Pool } from "pg";
import { createFondoRouter } from "../../artifacts/api-server/src/routes/fondo";

const requireFromApi = createRequire(new URL("../../artifacts/api-server/package.json", import.meta.url));
const express: any = requireFromApi("express");
const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));

type Json = Record<string, any>;
type Timing = { name: string; milliseconds: number; assertions: number };
type TestActor = { id: number; nombre: string; rol: string };
type RunContext = {
  pool: Pool;
  actor: TestActor;
  /** Filled by the guarded operator after its effective-identity checks. */
  destinationEvidence: Json;
  caseTimeoutMs?: number;
};

const UUIDS = Object.freeze({
  initial: "e1000000-0000-4000-8000-000000000001",
  capital: "e1000000-0000-4000-8000-000000000002",
  withdrawal: "e1000000-0000-4000-8000-000000000003",
  withdrawalInverse: "e1000000-0000-4000-8000-000000000004",
  surplus: "e1000000-0000-4000-8000-000000000005",
  shortage: "e1000000-0000-4000-8000-000000000006",
  staleMovement: "e1000000-0000-4000-8000-000000000007",
  staleCount: "e1000000-0000-4000-8000-000000000008",
  raceInverseA: "e1000000-0000-4000-8000-000000000009",
  raceInverseB: "e1000000-0000-4000-8000-00000000000a",
  drain: "e1000000-0000-4000-8000-00000000000b",
  incomeInverse: "e1000000-0000-4000-8000-00000000000c",
  insufficient: "e1000000-0000-4000-8000-00000000000d",
  simultaneous: "e1000000-0000-4000-8000-00000000000e",
  mixedIncome: "e1000000-0000-4000-8000-00000000000f",
  mixedWithdrawal: "e1000000-0000-4000-8000-000000000010",
  metricCapital: "e1000000-0000-4000-8000-000000000012",
  metricWithdrawal: "e1000000-0000-4000-8000-000000000013",
  metricWithdrawalInverse: "e1000000-0000-4000-8000-000000000014",
  metricCapitalInverse: "e1000000-0000-4000-8000-000000000015",
});

function monotonicMs(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1_000_000;
}

async function timed(timings: Timing[], name: string, fn: () => Promise<number>): Promise<void> {
  const start = process.hrtime.bigint();
  const assertions = await fn();
  timings.push({ name, milliseconds: monotonicMs(start), assertions });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`E10 deterministic timeout: ${label}`)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer!));
}

function cents(value: string): bigint {
  assert.match(value, /^-?(0|[1-9][0-9]*)\.[0-9]{2}$/);
  const negative = value.startsWith("-");
  const [units, fraction] = (negative ? value.slice(1) : value).split(".");
  const result = BigInt(units) * 100n + BigInt(fraction);
  return negative ? -result : result;
}

async function startHarness(pool: Pool, actor: TestActor) {
  const app = express();
  app.use(express.json({ limit: "32kb" }));
  let queries = 0;
  const countedPool = {
    query: (...args: any[]) => {
      queries += 1;
      return (pool.query as any)(...args);
    },
    connect: async () => {
      const client = await pool.connect();
      return {
        query: (...args: any[]) => {
          queries += 1;
          return (client.query as any)(...args);
        },
        release: () => client.release(),
      };
    },
  };
  app.use((req: any, _res: any, next: any) => {
    const requestedRole = String(req.header("x-e10-test-role") ?? "ADMIN");
    req.auth = {
      sessionId: "in-process-e10-context-not-a-real-session",
      user: {
        id: actor.id,
        nombre: actor.nombre,
        rol: requestedRole as any,
        activo: true,
        ubicacionId: null,
        email: null,
        telefono: null,
        passwordHash: "not-loaded-by-e10-harness",
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
      location: null,
    };
    next();
  });
  const authorizeAdmin = (req: any, res: any, next: any) => {
    if (req.auth?.user.rol !== "ADMIN") {
      res.status(403).json({ error: "No tienes permisos para esta operación.", code: "FORBIDDEN" });
      return;
    }
    next();
  };
  app.use("/api", createFondoRouter({
    db: countedPool,
    authorizeAdmin: [authorizeAdmin],
    enabled: () => true,
  }));
  app.use((error: any, _req: any, res: any, _next: any) => {
    if (error?.name === "ZodError") {
      res.status(400).json({ error: "Solicitud inválida.", code: "VALIDATION_ERROR" });
      return;
    }
    res.status(500).json({ error: "Error interno.", code: "INTERNAL_ERROR" });
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  assert.equal(address.address, "127.0.0.1");
  const base = `http://127.0.0.1:${address.port}`;
  async function request(path: string, init: RequestInit = {}) {
    return fetch(`${base}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    });
  }
  return {
    request,
    queryCount: () => queries,
    close: async () => {
      server.close();
      await once(server, "close");
    },
    boundary: {
      listener: `${address.address}:${address.port}`,
      authentication: "standalone in-process AuthContext; no login, renewal, user, or session writes",
      router: "actual createFondoRouter; no normal API index startup",
    },
  };
}

async function json(response: globalThis.Response): Promise<Json> {
  return await response.json() as Json;
}

async function post(request: (path: string, init?: RequestInit) => Promise<globalThis.Response>, path: string, body: Json, role = "ADMIN") {
  const response = await request(path, {
    method: "POST",
    headers: { "x-e10-test-role": role },
    body: JSON.stringify(body),
  });
  return { response, body: await json(response) };
}

async function productionFinancialReaders(pool: Pool, actor: TestActor) {
  const output = resolve(ROOT, ".local/e10-financial-readers.mjs");
  await fs.mkdir(resolve(ROOT, ".local"), { recursive: true, mode: 0o700 });
  const esbuild = requireFromApi("esbuild") as { build(options: Json): Promise<void> };
  const adminAnalytics = resolve(ROOT, "artifacts/api-server/src/lib/admin-analytics.ts");
  const cartera = resolve(ROOT, "artifacts/api-server/src/lib/clientes-cartera-read-model.ts");
  await esbuild.build({
    stdin: {
      contents: `export { getSalesSummary, getDestinationCollectedAmount } from ${JSON.stringify(adminAnalytics)};
        export { readClientesCartera } from ${JSON.stringify(cartera)};`,
      resolveDir: ROOT,
      sourcefile: "e10-production-financial-entry.ts",
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: output,
    plugins: [{
      name: "e10-guarded-workspace-db",
      setup(build: any) {
        build.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "workspace-db", namespace: "e10" }));
        build.onLoad({ filter: /.*/, namespace: "e10" }, () => ({
          contents: "export const pool = globalThis.__e10ReadOnlyPool;",
          loader: "js",
        }));
      },
    }],
  });
  const readOnlyPool = {
    query: (text: string, values?: readonly unknown[]) => {
      assert.match(text, /^\s*(SELECT|WITH)\b/i, "Production financial reader attempted a write");
      return pool.query(text, values as any[]);
    },
    connect: () => {
      throw new Error("Production financial reader attempted singleton connect");
    },
  };
  (globalThis as any).__e10ReadOnlyPool = readOnlyPool;
  const production = await import(`${pathToFileURL(output).href}?run=${Date.now()}`);
  const window = {
    desde: new Date("2000-01-01T00:00:00.000Z"),
    hasta: new Date("2099-12-31T23:59:59.999Z"),
  };
  const sales = await production.getSalesSummary(window);
  const carteraResult = await production.readClientesCartera({
    auth: {
      sessionId: "e10-read-only-financial-context",
      user: { ...actor, activo: true, ubicacionId: null },
      location: null,
    },
    query: {},
    database: readOnlyPool,
    resolveReadScope: () => ({ ubicacionId: undefined, scopeError: null }),
    now: () => new Date("2026-09-18T12:00:00.000-06:00"),
  });
  return {
    ventas: sales.ventas,
    contadoCobrado: sales.cobrado,
    cobranzaClientes: await production.getDestinationCollectedAmount(window, "CUENTAS_POR_COBRAR"),
    deudaClientes: carteraResult.resumen.totalCartera,
    window: { desde: window.desde.toISOString(), hasta: window.hasta.toISOString(), scope: "GLOBAL ADMIN, active clients" },
    sources: {
      ventas: "production getSalesSummary().ventas",
      contadoCobrado: "production getSalesSummary().cobrado",
      cobranzaClientes: "production getDestinationCollectedAmount(..., CUENTAS_POR_COBRAR)",
      deudaClientes: "production readClientesCartera(...).resumen.totalCartera (FIFO ledger projection)",
      databaseAlias: "test-only esbuild alias to guarded SELECT/WITH-only pool; production files unchanged",
    },
  };
}

async function immutableAccountSnapshots(pool: Pool) {
  const result: Json = {};
  for (const name of ["usuarios", "sesiones", "roles"]) {
    const exists = await pool.query<{ present: string | null }>("SELECT to_regclass($1)::text AS present", [`public.${name}`]);
    if (!exists.rows[0].present) {
      result[name] = { feasible: false, reason: name === "sesiones" ? "omitted from isolated clone" : "table absent" };
      continue;
    }
    const identifier = `"${name}"`;
    const rows = await pool.query<{ count: string; digest: string }>(
      `SELECT count(*)::text AS count,
              md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS digest
         FROM public.${identifier} t`,
    );
    result[name] = { feasible: true, ...rows.rows[0] };
  }
  return result;
}

function assertSnapshotsEqual(before: Json, after: Json, label: string) {
  assert.deepEqual(after, before, `${label} changed during E10 rehearsal`);
}

export async function runE10RehearsalCases(context: RunContext) {
  assert.equal(process.env.NODE_ENV, "test", "E10 cases require NODE_ENV=test");
  assert.ok(context.destinationEvidence?.nonTcp === true, "guarded operator must prove non-TCP transport");
  const timeoutMs = context.caseTimeoutMs ?? 10_000;
  const timings: Timing[] = [];
  const started = process.hrtime.bigint();
  const legacyBefore = await productionFinancialReaders(context.pool, context.actor);
  const accountsBefore = await immutableAccountSnapshots(context.pool);
  const harness = await startHarness(context.pool, context.actor);
  const evidence: Json = { destination: context.destinationEvidence, httpBoundary: harness.boundary };
  const existingFixtureRows = Number((await context.pool.query(
    "SELECT count(*)::int count FROM fondo_movimientos WHERE idempotency_key=$1",
    [UUIDS.initial],
  )).rows[0].count);
  const resumedAfterHarnessAssertionFix = existingFixtureRows === 1;
  evidence.retry = {
    resumedAfterHarnessAssertionFix,
    reason: resumedAfterHarnessAssertionFix
      ? "Prior run committed append-only fixtures before a harness-only BOM decoding assertion failed."
      : null,
  };
  let originalWithdrawal: Json;
  let versionBeforeStale: string;

  try {
    await timed(timings, "authorization-and-validation", async () => {
      let assertions = 0;
      const roles = ["CAJA", "SUPERVISOR", "CONTADOR", "SISTEMAS", "BODEGA", "VENTAS"];
      const routes = [
        ["GET", "/api/fondo"], ["GET", "/api/fondo/movimientos"],
        ["GET", "/api/fondo/arqueos"], ["GET", "/api/fondo/exportar?tipo=movimientos"],
        ["GET", "/api/fondo/exportar?tipo=arqueos"],
      ];
      for (const role of roles) {
        for (const [method, path] of routes) {
          const before = harness.queryCount();
          const response = await harness.request(path, { method, headers: { "x-e10-test-role": role } });
          assert.equal(response.status, 403); assertions++;
          assert.equal(harness.queryCount(), before, `${role} denial leaked a DB read`); assertions++;
          const denied = await json(response);
          assert.equal(typeof denied.error, "string"); assertions++;
          assert.ok(Object.keys(denied).every((key) => key === "error" || key === "code")); assertions++;
        }
      }
      const invalidRequests: Array<[string, RequestInit]> = [
        ["/api/fondo?site=2", {}],
        ["/api/fondo/movimientos?ubicacionId=2", {}],
        ["/api/fondo/movimientos/not-a-uuid", {}],
        ["/api/fondo/exportar?tipo=E9", {}],
        ["/api/fondo/exportar?tipo=arqueos&sitioId=1", {}],
        ["/api/fondo/movimientos", { method: "POST", body: JSON.stringify({
          idempotencyKey: UUIDS.initial, categoria: "ENTREGA_TIENDA", importe: "1.00", motivo: "E9",
        }) }],
        ["/api/fondo/movimientos", { method: "POST", body: JSON.stringify({
          idempotencyKey: UUIDS.initial, categoria: "RETIRO", importe: "1e2", motivo: "E12", proveedorId: 1,
        }) }],
      ];
      for (const [path, init] of invalidRequests) {
        const response = await harness.request(path, init);
        assert.equal(response.status, 400); assertions++;
        assert.equal((await json(response)).code, "VALIDATION_ERROR"); assertions++;
      }
      return assertions;
    });

    await timed(timings, "ledger-idempotency-and-inverse", async () => {
      let assertions = 0;
      const initialInput = {
        idempotencyKey: UUIDS.initial, categoria: "SALDO_INICIAL", importe: "1000.00", motivo: "saldo inicial",
        conciliacionInicial: {
          efectivoFisicoContado: "1000.00", declaracionSinDuplicacion: true,
          evidencia: "Fixture aislado E10: declaración de conciliación, no efectivo operativo.",
        },
      };
      const initial = await post(harness.request, "/api/fondo/movimientos", initialInput);
      assert.ok(initial.response.status === 201 || (resumedAfterHarnessAssertionFix && initial.response.status === 200)); assertions++;
      const replay = await post(harness.request, "/api/fondo/movimientos", initialInput);
      assert.equal(replay.response.status, 200); assertions++;
      assert.equal(replay.response.headers.get("idempotent-replay"), "true"); assertions++;
      assert.deepEqual(replay.body, initial.body); assertions++;
      const conflict = await post(harness.request, "/api/fondo/movimientos", { ...initialInput, importe: "999.99",
        conciliacionInicial: { ...initialInput.conciliacionInicial, efectivoFisicoContado: "999.99" } });
      assert.equal(conflict.response.status, 409); assertions++;
      assert.equal(conflict.body.code, "IDEMPOTENCY_CONFLICT"); assertions++;

      const simultaneousInput = {
        idempotencyKey: UUIDS.simultaneous, categoria: "CAPITAL", importe: "0.01", motivo: "idempotencia concurrente",
      };
      const simultaneous = await withTimeout(Promise.all([
        post(harness.request, "/api/fondo/movimientos", simultaneousInput),
        post(harness.request, "/api/fondo/movimientos", simultaneousInput),
      ]), timeoutMs, "same-key requests");
      assert.deepEqual(simultaneous.map((item) => item.response.status).sort(),
        resumedAfterHarnessAssertionFix ? [200, 200] : [200, 201]); assertions++;
      assert.deepEqual(simultaneous[0].body, simultaneous[1].body); assertions++;
      const simultaneousRows = await context.pool.query(
        "SELECT count(*)::int count FROM fondo_movimientos WHERE idempotency_key=$1",
        [UUIDS.simultaneous],
      );
      assert.equal(simultaneousRows.rows[0].count, 1); assertions++;

      const capital = await post(harness.request, "/api/fondo/movimientos", {
        idempotencyKey: UUIDS.capital, categoria: "CAPITAL", importe: "250.25", motivo: "capital fixture",
      });
      assert.ok(capital.response.status === 201 || (resumedAfterHarnessAssertionFix && capital.response.status === 200)); assertions++;
      const withdrawal = await post(harness.request, "/api/fondo/movimientos", {
        idempotencyKey: UUIDS.withdrawal, categoria: "RETIRO", importe: "100.10", motivo: "retiro fixture",
      });
      assert.ok(withdrawal.response.status === 201 || (resumedAfterHarnessAssertionFix && withdrawal.response.status === 200)); assertions++;
      originalWithdrawal = withdrawal.body;
      const inverse = await post(harness.request, `/api/fondo/movimientos/${withdrawal.body.id}/inverso`, {
        idempotencyKey: UUIDS.withdrawalInverse, motivo: "corrección exacta del retiro fixture",
      });
      assert.ok(inverse.response.status === 201 || (resumedAfterHarnessAssertionFix && inverse.response.status === 200)); assertions++;
      assert.equal(inverse.body.importe, "100.10"); assertions++;
      assert.equal(inverse.body.naturaleza, "INGRESO"); assertions++;
      assert.equal(inverse.body.originalId, withdrawal.body.id); assertions++;
      assert.match(inverse.body.advertencia, /Corrección contable/); assertions++;
      const originalReload = await harness.request(`/api/fondo/movimientos/${withdrawal.body.id}`);
      assert.equal(originalReload.status, 200); assertions++;
      const originalBody = await json(originalReload);
      assert.equal(originalBody.importe, originalWithdrawal.importe); assertions++;
      assert.equal(originalBody.motivo, originalWithdrawal.motivo); assertions++;
      assert.equal(originalBody.inversoId, inverse.body.id); assertions++;

      const ledgerResponse = await harness.request("/api/fondo/movimientos");
      assert.equal(ledgerResponse.status, 200); assertions++;
      const ledger = await json(ledgerResponse);
      const sum = ledger.items.reduce((total: bigint, movement: Json) => total + cents(movement.importeFirmado), 0n);
      assert.equal(sum, cents(ledger.saldo)); assertions++;
      // The simultaneous cent is intentionally included and proves cent arithmetic.
      if (!resumedAfterHarnessAssertionFix) {
        assert.equal(ledger.saldo, "1250.26"); assertions++;
      }
      evidence.conciliation = { itemCount: ledger.items.length, sumCents: sum.toString(), saldo: ledger.saldo };
      return assertions;
    });

    await timed(timings, "arqueo-persistence-stale-and-replay", async () => {
      let assertions = 0;
      let summary = await json(await harness.request("/api/fondo"));
      // Add 0.01 adjustment so the owner-specified 1250.25 book fixture is exact.
      const correction = await post(harness.request, `/api/fondo/movimientos/${(await json(await harness.request("/api/fondo/movimientos"))).items.find((x: Json) => x.motivo === "idempotencia concurrente").id}/inverso`, {
        idempotencyKey: UUIDS.raceInverseA, motivo: "retira centavo de prueba concurrente",
      });
      assert.ok(correction.response.status === 201 || (resumedAfterHarnessAssertionFix && correction.response.status === 200)); assertions++;
      summary = await json(await harness.request("/api/fondo"));
      if (!resumedAfterHarnessAssertionFix) {
        assert.equal(summary.saldo, "1250.25"); assertions++;
      }
      let surplus: { response: globalThis.Response | null; body: Json };
      let shortage: { response: globalThis.Response | null; body: Json };
      if (resumedAfterHarnessAssertionFix) {
        const existing = await json(await harness.request("/api/fondo/arqueos"));
        surplus = { response: null, body: existing.items.find((item: Json) => item.motivo === "arqueo fixture sobrante") };
        shortage = { response: null, body: existing.items.find((item: Json) => item.motivo === "arqueo fixture faltante") };
        assert.ok(surplus.body && shortage.body); assertions++;
      } else {
        surplus = await post(harness.request, "/api/fondo/arqueos", {
          idempotencyKey: UUIDS.surplus, efectivoContado: "1255.75",
          expectedVersionSaldo: summary.versionSaldo, motivo: "arqueo fixture sobrante",
        });
        assert.ok(surplus.response);
        assert.equal(surplus.response.status, 201); assertions++;
        shortage = await post(harness.request, "/api/fondo/arqueos", {
          idempotencyKey: UUIDS.shortage, efectivoContado: "1240.00",
          expectedVersionSaldo: summary.versionSaldo, motivo: "arqueo fixture faltante",
        });
        assert.ok(shortage.response);
        assert.equal(shortage.response.status, 201); assertions++;
      }
      assert.equal(surplus.body.diferencia, "5.50"); assertions++;
      assert.equal(shortage.body.diferencia, "-10.25"); assertions++;
      const movementCountBefore = Number((await json(await harness.request("/api/fondo"))).totalMovimientos);
      const reloaded = await context.pool.connect();
      try {
        const persisted = await reloaded.query(
          "SELECT saldo_sistema_centavos::text saldo,efectivo_contado_centavos::text contado,diferencia_centavos::text diferencia FROM fondo_arqueos WHERE id=$1",
          [shortage.body.id],
        );
        assert.deepEqual(persisted.rows[0], { saldo: "125025", contado: "124000", diferencia: "-1025" }); assertions++;
      } finally {
        reloaded.release();
      }
      assert.equal(Number((await json(await harness.request("/api/fondo"))).totalMovimientos), movementCountBefore); assertions++;

      versionBeforeStale = resumedAfterHarnessAssertionFix ? shortage.body.versionSaldo : summary.versionSaldo;
      const movement = await post(harness.request, "/api/fondo/movimientos", {
        idempotencyKey: UUIDS.staleMovement, categoria: "CAPITAL", importe: "0.01", motivo: "cambio concurrente de versión",
      });
      assert.ok(movement.response.status === 201 || (resumedAfterHarnessAssertionFix && movement.response.status === 200)); assertions++;
      const stale = await post(harness.request, "/api/fondo/arqueos", {
        idempotencyKey: UUIDS.staleCount, efectivoContado: "1250.25",
        expectedVersionSaldo: versionBeforeStale, motivo: "conteo con versión obsoleta",
      });
      assert.equal(stale.response.status, 409); assertions++;
      assert.equal(stale.body.code, "FONDO_VERSION_SALDO_OBSOLETA"); assertions++;
      const replayAfterMovement = await post(harness.request, "/api/fondo/arqueos", {
        idempotencyKey: UUIDS.shortage, efectivoContado: "1240.00",
        expectedVersionSaldo: versionBeforeStale, motivo: "arqueo fixture faltante",
      });
      assert.equal(replayAfterMovement.response.status, 200); assertions++;
      assert.deepEqual(replayAfterMovement.body, shortage.body); assertions++;
      evidence.arqueos = { surplus: surplus.body, shortage: shortage.body, persistedAfterNewConnection: true };
      return assertions;
    });

    await timed(timings, "mixed-writes-and-race-inverse", async () => {
      let assertions = 0;
      // A PostgreSQL advisory lock forms a deterministic start barrier. Both
      // requests are issued while held and must complete only after release.
      const barrier = await context.pool.connect();
      await barrier.query("BEGIN");
      await barrier.query("SELECT pg_advisory_xact_lock($1)", [0x463130]);
      const incomePromise = post(harness.request, "/api/fondo/movimientos", {
        idempotencyKey: UUIDS.mixedIncome, categoria: "CAPITAL", importe: "10.00", motivo: "=1+1 formula probe",
      });
      const withdrawalPromise = post(harness.request, "/api/fondo/movimientos", {
        idempotencyKey: UUIDS.mixedWithdrawal, categoria: "RETIRO", importe: "5.00", motivo: "mixed barrier withdrawal",
      });
      await new Promise((resolve) => setTimeout(resolve, 25));
      await barrier.query("COMMIT");
      barrier.release();
      const mixed = await withTimeout(Promise.all([incomePromise, withdrawalPromise]), timeoutMs, "mixed writers");
      assert.deepEqual(mixed.map((item) => item.response.status),
        resumedAfterHarnessAssertionFix ? [200, 200] : [201, 201]); assertions++;

      const race = await withTimeout(Promise.all([
        post(harness.request, `/api/fondo/movimientos/${mixed[0].body.id}/inverso`, {
          idempotencyKey: UUIDS.raceInverseB, motivo: "race inverse A",
        }),
        post(harness.request, `/api/fondo/movimientos/${mixed[0].body.id}/inverso`, {
          idempotencyKey: "e1000000-0000-4000-8000-000000000011", motivo: "race inverse B",
        }),
      ]), timeoutMs, "inverse race");
      assert.deepEqual(race.map((item) => item.response.status).sort(),
        resumedAfterHarnessAssertionFix ? [200, 409] : [201, 409]); assertions++;
      assert.equal(race.find((item) => item.response.status === 409)?.body.code, "FONDO_MOVIMIENTO_YA_INVERTIDO"); assertions++;
      return assertions;
    });

    await timed(timings, "sql-immutability-and-fixed-location", async () => {
      let assertions = 0;
      const attacks = [
        ["UPDATE fondo_movimientos SET motivo='mutado' WHERE id=$1", [originalWithdrawal.id]],
        ["DELETE FROM fondo_movimientos WHERE id=$1", [originalWithdrawal.id]],
        ["UPDATE fondo_arqueos SET diferencia_centavos=0 WHERE id=$1", [evidence.arqueos.shortage.id]],
        ["DELETE FROM fondo_arqueos WHERE id=$1", [evidence.arqueos.shortage.id]],
        ["UPDATE fondo_mariana SET ubicacion_id=(SELECT min(id) FROM ubicaciones WHERE upper(btrim(nombre))<>'MARIANA')", []],
      ] as const;
      for (const [statement, values] of attacks) {
        const client = await context.pool.connect();
        try {
          await client.query("BEGIN");
          await assert.rejects(client.query(statement, values as any)); assertions++;
          await client.query("ROLLBACK");
        } finally {
          client.release();
        }
      }
      for (const table of ["fondo_mariana", "fondo_movimientos", "fondo_arqueos"]) {
        const client = await context.pool.connect();
        try {
          await client.query("BEGIN");
          await assert.rejects(client.query(`TRUNCATE TABLE "${table}"`)); assertions++;
          await client.query("ROLLBACK");
        } finally {
          client.release();
        }
      }
      const triggerCount = await context.pool.query(`SELECT count(*)::int count
        FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relname IN ('fondo_mariana','fondo_movimientos','fondo_arqueos')
          AND t.tgname LIKE '%immutable_before_truncate' AND NOT t.tgisinternal`);
      assert.equal(triggerCount.rows[0].count, 3); assertions++;
      const allThree = await context.pool.connect();
      try {
        await allThree.query("BEGIN");
        await assert.rejects(
          allThree.query("TRUNCATE TABLE fondo_arqueos,fondo_movimientos,fondo_mariana"),
          /FONDO_IMMUTABLE/,
        ); assertions++;
        await allThree.query("ROLLBACK");
      } finally {
        allThree.release();
      }
      const identity = await context.pool.query(
        "SELECT f.nombre,u.nombre ubicacion FROM fondo_mariana f JOIN ubicaciones u ON u.id=f.ubicacion_id",
      );
      assert.deepEqual(identity.rows, [{ nombre: "Fondo de Mariana", ubicacion: "Mariana" }]); assertions++;
      return assertions;
    });

    await timed(timings, "exports-and-confidential-audit-readers", async () => {
      let assertions = 0;
      for (const type of ["movimientos", "arqueos"]) {
        const response = await harness.request(`/api/fondo/exportar?tipo=${type}`);
        assert.equal(response.status, 200); assertions++;
        assert.match(response.headers.get("content-type") ?? "", /^text\/csv/); assertions++;
        const bytes = new Uint8Array(await response.arrayBuffer());
        assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]); assertions++;
        const body = new TextDecoder("utf-8").decode(bytes);
        assert.ok(body.includes(type === "movimientos" ? originalWithdrawal.id : evidence.arqueos.shortage.id)); assertions++;
        assert.ok(!body.includes('"=1+1 formula probe"'), "CSV contains an unneutralized formula cell"); assertions++;
        if (type === "movimientos") {
          assert.ok(body.includes("\"'=1+1 formula probe\""), "CSV did not retain neutralized formula evidence"); assertions++;
        }
      }
      const fondoRows = await context.pool.query<{ id: string }>(
        "SELECT id::text FROM auditoria WHERE modulo='FONDO' ORDER BY id",
      );
      assert.ok(fondoRows.rows.length > 0); assertions++;
      // Import production pure query builders (no @workspace/db singleton),
      // compile with Drizzle's production dialect, then execute their actual
      // SQL/params through the exact guarded connector.
      const auditQueries = await import("../../artifacts/api-server/src/lib/auditoria-queries");
      const { PgDialect } = requireFromApi("drizzle-orm/pg-core") as { PgDialect: new () => {
        sqlToQuery(query: unknown): { sql: string; params: unknown[] };
      } };
      const dialect = new PgDialect();
      const execute = async (query: unknown) => {
        const compiled = dialect.sqlToQuery(query);
        return context.pool.query(compiled.sql, compiled.params);
      };
      const hiddenList = await execute(auditQueries.listAuditoriaQuery({ modulo: "FONDO" }, 1, 100, false));
      assert.equal(hiddenList.rows.length, 0); assertions++;
      const visibleList = await execute(auditQueries.listAuditoriaQuery({ modulo: "FONDO" }, 1, 100, true));
      assert.equal(visibleList.rows.length, fondoRows.rows.length); assertions++;
      const hiddenDetail = await execute(auditQueries.getAuditoriaQuery(fondoRows.rows[0].id, false));
      assert.equal(hiddenDetail.rows.length, 0); assertions++;
      const visibleDetail = await execute(auditQueries.getAuditoriaQuery(fondoRows.rows[0].id, true));
      assert.equal(visibleDetail.rows.length, 1); assertions++;
      const hiddenExportSource = await execute(auditQueries.exportAuditoriaQuery({ modulo: "FONDO" }, false));
      assert.equal(hiddenExportSource.rows.length, 0); assertions++;
      const visibleExportSource = await execute(auditQueries.exportAuditoriaQuery({ modulo: "FONDO" }, true));
      assert.equal(visibleExportSource.rows.length, fondoRows.rows.length); assertions++;
      evidence.genericAuditBoundary = {
        rowsCreatedByFondoOnly: fondoRows.rows.length,
        nonAdminListDetailAndXlsxSourceExcluded: true,
        adminIncluded: true,
        note: "Production pure list/detail/XLSX-source query builders compiled and executed through connectExactE10; no singleton DB or requireSession.",
      };
      return assertions;
    });

    await timed(timings, "canonical-financial-readers-after-each-fondo-write", async () => {
      let assertions = 0;
      const probes: Json[] = [];
      const assertReadersUnchanged = async (label: string, movement: Json) => {
        const observed = await productionFinancialReaders(context.pool, context.actor);
        assert.deepEqual(observed, legacyBefore, `${label} contaminated a canonical financial reader`); assertions++;
        probes.push({
          label,
          movimientoId: movement.id,
          naturaleza: movement.naturaleza,
          importe: movement.importe,
          readers: observed,
        });
      };
      const capital = await post(harness.request, "/api/fondo/movimientos", {
        idempotencyKey: UUIDS.metricCapital,
        categoria: "CAPITAL",
        importe: "123.45",
        motivo: "sonda canónica lectores capital",
      });
      assert.ok(capital.response.status === 201 || capital.response.status === 200); assertions++;
      await assertReadersUnchanged("after CAPITAL 123.45", capital.body);
      const capitalInverse = await post(harness.request, `/api/fondo/movimientos/${capital.body.id}/inverso`, {
        idempotencyKey: UUIDS.metricCapitalInverse,
        motivo: "sonda canónica inverso capital",
      });
      assert.ok(capitalInverse.response.status === 201 || capitalInverse.response.status === 200); assertions++;
      await assertReadersUnchanged("after inverse RETIRO 123.45", capitalInverse.body);
      const withdrawalProducer = await post(harness.request, "/api/fondo/movimientos", {
        idempotencyKey: UUIDS.metricWithdrawal,
        categoria: "CAPITAL",
        importe: "23.45",
        motivo: "sonda canónica productor retiro",
      });
      assert.ok(withdrawalProducer.response.status === 201 || withdrawalProducer.response.status === 200); assertions++;
      await assertReadersUnchanged("after CAPITAL 23.45", withdrawalProducer.body);
      const withdrawal = await post(harness.request, `/api/fondo/movimientos/${withdrawalProducer.body.id}/inverso`, {
        idempotencyKey: UUIDS.metricWithdrawalInverse,
        motivo: "sonda canónica retiro exacto",
      });
      assert.ok(withdrawal.response.status === 201 || withdrawal.response.status === 200); assertions++;
      await assertReadersUnchanged("after inverse RETIRO 23.45", withdrawal.body);
      evidence.canonicalFinancialReaderProbes = probes;
      return assertions;
    });

    await timed(timings, "negative-balance-and-insufficient-withdrawal", async () => {
      let assertions = 0;
      const current = await json(await harness.request("/api/fondo"));
      const initialMovement = (await json(await harness.request("/api/fondo/movimientos"))).items.find(
        (item: Json) => item.categoria === "SALDO_INICIAL" && item.esInverso === false,
      );
      if (current.saldo !== "-1000.00") {
        const drain = await post(harness.request, "/api/fondo/movimientos", {
          idempotencyKey: UUIDS.drain, categoria: "RETIRO", importe: current.saldo, motivo: "drena fixture para probar inverso negativo",
        });
        assert.equal(drain.response.status, 201); assertions++;
        const inverse = await post(harness.request, `/api/fondo/movimientos/${initialMovement.id}/inverso`, {
          idempotencyKey: UUIDS.incomeInverse, motivo: "inverso de ingreso permitido bajo cero",
        });
        assert.equal(inverse.response.status, 201); assertions++;
      } else {
        assert.ok(initialMovement.inversoId); assertions++;
      }
      assert.equal((await json(await harness.request("/api/fondo"))).saldo, "-1000.00"); assertions++;
      const insufficient = await post(harness.request, "/api/fondo/movimientos", {
        idempotencyKey: UUIDS.insufficient, categoria: "RETIRO", importe: "0.01", motivo: "retiro normal sin saldo",
      });
      assert.equal(insufficient.response.status, 409); assertions++;
      assert.equal(insufficient.body.code, "FONDO_SALDO_INSUFICIENTE"); assertions++;
      return assertions;
    });
  } finally {
    await harness.close();
  }

    const legacyAfter = await productionFinancialReaders(context.pool, context.actor);
  const accountsAfter = await immutableAccountSnapshots(context.pool);
  assertSnapshotsEqual(legacyBefore, legacyAfter, "Legacy financial tables");
  assertSnapshotsEqual(accountsBefore, accountsAfter, "Users/sessions/roles");
  evidence.preservation = {
    legacyReaders: { before: legacyBefore, after: legacyAfter, unchanged: true },
    accounts: { before: accountsBefore, after: accountsAfter, unchanged: true },
  };
  const finalLedger = await context.pool.query<{ saldo: string; count: string }>(
    `SELECT COALESCE(sum(CASE WHEN naturaleza='INGRESO' THEN importe_centavos ELSE -importe_centavos END),0)::text saldo,
            count(*)::text count FROM fondo_movimientos`,
  );
  return {
    status: "PASS",
    elapsedMilliseconds: monotonicMs(started),
    timings,
    assertionCount: timings.reduce((sum, timing) => sum + timing.assertions, 0),
    finalLedger: finalLedger.rows[0],
    evidence,
    fixturePolicy: "append-only Fondo and associated auditoria only; retained; no cleanup DELETE",
  };
}