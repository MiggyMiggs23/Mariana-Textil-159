import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { Request, Response } from "express";
import { testResetBarrier, withResetBarrier } from "./barrier";

function response() {
  const events = new EventEmitter();
  let status = 200;
  let body: unknown;
  const res = Object.assign(events, {
    status(code: number) { status = code; return res; },
    json(value: unknown) { body = value; return res; },
  });
  return { res: res as unknown as Response, code: () => status, body: () => body };
}

test("reset drains existing writes, blocks new requests and rejects simultaneous reset", async () => {
  const existing = response();
  testResetBarrier({ path: "/pos/cobrar", method: "POST" } as Request, existing.res, () => {});
  let executed = false;
  const reset = withResetBarrier(async () => { executed = true; return "committed"; });
  assert.equal(executed, false);
  const blocked = response();
  testResetBarrier({ path: "/inventario", method: "GET" } as Request, blocked.res, () => assert.fail("request must wait"));
  assert.equal(blocked.code(), 503);
  await assert.rejects(withResetBarrier(async () => {}), /en curso/);
  // Socket closure alone is not proof the write finished.
  existing.res.emit("close");
  assert.equal(executed, false);
  existing.res.emit("finish");
  assert.equal(await reset, "committed");
  const after = response();
  let proceeded = false;
  testResetBarrier({ path: "/auth/login", method: "POST" } as Request, after.res, () => { proceeded = true; });
  assert.equal(proceeded, true);
  after.res.emit("finish");
});

test("reset error releases barrier and trailing-slash reset does not count itself", async () => {
  const resetResponse = response();
  testResetBarrier({ path: "/admin/test-reset/", method: "POST" } as Request, resetResponse.res, () => {});
  await assert.rejects(withResetBarrier(async () => { throw new Error("rollback"); }), /rollback/);
  assert.equal(await withResetBarrier(async () => "retry"), "retry");
});