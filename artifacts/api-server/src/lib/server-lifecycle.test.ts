import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { createRequestDrain, installGracefulShutdown, withSchemaStartupLock } from "./server-lifecycle";

test("concurrent startup initializers serialize on the session lock", async () => {
  let held = false;
  const waiters: Array<() => void> = [];
  const calls = new Map<number, number>();
  const pool = {
    async connect() {
      const id = calls.size + 1;
      calls.set(id, 0);
      return {
        async query() {
          const call = (calls.get(id) ?? 0) + 1;
          calls.set(id, call);
          if (call === 1) {
            if (held) await new Promise<void>((resolve) => waiters.push(resolve));
            held = true;
          } else {
            held = false;
            waiters.shift()?.();
          }
          return { rows: [{ ok: true }] };
        },
        release() {},
      };
    },
  };
  const order: string[] = [];
  await Promise.all([
    withSchemaStartupLock(pool, async () => { order.push("first-start"); await Promise.resolve(); order.push("first-end"); }),
    withSchemaStartupLock(pool, async () => { order.push("second-start"); order.push("second-end"); }),
  ]);
  assert.deepEqual(order, ["first-start", "first-end", "second-start", "second-end"]);
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