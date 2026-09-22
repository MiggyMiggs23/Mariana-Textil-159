import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  createRequestDrain,
  installGracefulShutdown,
  observeBackgroundTask,
  withSchemaStartupLock,
} from "./server-lifecycle";

test("concurrent startup initializers serialize on the session lock", async () => {
  let held = false;
  const waiters: Array<() => void> = [];
  let physicalConnections = 0;
  const operationConnections: number[] = [];
  const pool = {
    async connect() {
      const id = ++physicalConnections;
      return {
        async query(query: string | { text?: string }) {
          const text = typeof query === "string" ? query : String(query.text);
          if (text.includes("pg_advisory_lock")) {
            if (held) await new Promise<void>((resolve) => waiters.push(resolve));
            held = true;
          } else if (text.includes("pg_advisory_unlock")) {
            held = false;
            waiters.shift()?.();
          } else if (text.includes("current_setting")) {
            return { rows: [{ value: "30s" }] };
          } else if (text.includes("set_config")) {
            return { rows: [{ value: "ok" }] };
          } else {
            operationConnections.push(id);
          }
          return { rows: [{ ok: true }] };
        },
        release() {},
      };
    },
  };
  const order: string[] = [];
  await Promise.all([
    withSchemaStartupLock(pool, async (executor) => {
      order.push("first-start");
      await executor.query("SELECT 1");
      const nested = await executor.connect();
      await nested.query("SELECT 2");
      nested.release();
      order.push("first-end");
    }),
    withSchemaStartupLock(pool, async (executor) => {
      order.push("second-start");
      await executor.query("SELECT 3");
      order.push("second-end");
    }),
  ]);
  assert.deepEqual(order, ["first-start", "first-end", "second-start", "second-end"]);
  assert.equal(physicalConnections, 2);
  assert.deepEqual(operationConnections, [1, 1, 2]);
});

test("startup lock extends and restores the PostgreSQL statement timeout", async () => {
  const queries: Array<{ query: string | object; values?: readonly unknown[] }> = [];
  const pool = {
    async connect() {
      return {
        async query(query: string | object, values?: readonly unknown[]) {
          queries.push({ query, values });
          if (typeof query === "string" && query.includes("current_setting")) {
            return { rows: [{ value: "30s" }] };
          }
          return { rows: [{ ok: true }] };
        },
        release() {},
      };
    },
  };
  await withSchemaStartupLock(pool, async (executor) => {
    await executor.query("SELECT pg_sleep(36)");
  });
  assert.deepEqual(queries[1]?.values, ["300000ms"]);
  assert.deepEqual(queries.at(-1)?.values, ["30s"]);
  const lockQuery = queries.find(
    ({ query }) => typeof query === "object" && "query_timeout" in query,
  );
  assert.equal(
    (lockQuery?.query as { query_timeout?: number }).query_timeout,
    300_000,
  );
  const ddlQuery = queries.find(
    ({ query }) =>
      typeof query === "object" &&
      "text" in query &&
      query.text === "SELECT pg_sleep(36)",
  );
  assert.equal(
    (ddlQuery?.query as { query_timeout?: number }).query_timeout,
    300_000,
  );
});

test("background task failures are observed and contained", async () => {
  const failure = new Error("backfill failed");
  let rejected: unknown;
  await observeBackgroundTask(Promise.reject(failure), {
    onFulfilled() {
      assert.fail("rejected task must not fulfill");
    },
    onRejected(error) {
      rejected = error;
    },
  });
  assert.equal(rejected, failure);
});

test("request drain waits for in-flight work and rejects new requests", async () => {
  const drain = createRequestDrain();
  const response = new EventEmitter() as EventEmitter & {
    status(code: number): typeof response; set(name: string, value: string): typeof response; json(body: unknown): void;
  };
  let nextCalls = 0;
  response.status = () => response;
  response.set = () => response;
  response.json = () => undefined;
  drain.middleware({} as any, response as any, () => { nextCalls += 1; });
  assert.equal(nextCalls, 1);
  drain.stopAccepting();
  let complete = false;
  const wait = drain.waitForDrain().then(() => { complete = true; });
  assert.equal(complete, false);
  response.emit("finish");
  await wait;
  assert.equal(complete, true);
  drain.middleware({} as any, response as any, () => { nextCalls += 1; });
  assert.equal(nextCalls, 1);
});

test("shutdown is idempotent, aborts backfill, and closes the pool", async () => {
  const drain = createRequestDrain();
  let ended = 0;
  let aborted = 0;
  let closeCalls = 0;
  let resolveBackfill!: () => void;
  const backfill = new Promise<void>((resolve) => { resolveBackfill = resolve; });
  const server = {
    close(callback: () => void) { closeCalls += 1; callback(); return this; },
  };
  const lifecycle = installGracefulShutdown({
    app: {} as any,
    server: server as any,
    pool: { async end() { ended += 1; } },
    drain,
    backfill: { promise: backfill, abort() { aborted += 1; resolveBackfill(); } },
    logger: { info() {}, warn() {}, error() {} },
    timeoutMs: 50,
  });
  await Promise.all([lifecycle.shutdown("SIGTERM"), lifecycle.shutdown("SIGINT")]);
  assert.equal(aborted, 1);
  assert.equal(closeCalls, 1);
  assert.equal(ended, 1);
  lifecycle.dispose();
});