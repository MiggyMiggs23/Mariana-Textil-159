import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolve } from "node:path";

const root = process.env.E10_MUTANT_API_ROOT;
assert.ok(root, "E10_MUTANT_API_ROOT required");
const service = await readFile(resolve(root, "src/lib/fondo.ts"), "utf8");
const router = await readFile(resolve(root, "src/routes/fondo.ts"), "utf8");

test("site and unknown-input validation remains strict", () => {
  assert.match(router, /const strictEmpty = z\.object\(\{\}\)\.strict\(\)/);
  assert.match(router, /const movementQuery = z\.object\([\s\S]*?\)\.strict\(\)\.superRefine/);
  assert.match(router, /const movementInput = z\.object\([\s\S]*?\)\.strict\(\)\.superRefine/);
});

test("inverse is immutable and only one inverse is allowed", () => {
  assert.match(service, /if \(original\.original_id\)/);
  assert.match(service, /if \(original\.inverso_id\)/);
  assert.match(service, /original_id,idempotency_key,idempotency_producer,payload_hash/);
});

test("arqueo difference is calculated and persisted", () => {
  assert.match(service, /const difference = counted - state\.saldo/);
  assert.match(service, /diferencia_centavos[\s\S]*difference\.toString\(\)/);
});

test("idempotency replay precedes mutable state", () => {
  const replay = service.indexOf("const replay = await existingReplay");
  const state = service.indexOf("const amount = parseMoney");
  assert.ok(replay >= 0 && state > replay);
  assert.match(service, /payload_hash !== hash/);
});

test("stale version and insufficient withdrawal remain explicit conflicts", () => {
  assert.match(service, /state\.version !== input\.expectedVersionSaldo/);
  assert.match(service, /state\.saldo < amount/);
  assert.match(service, /FONDO_VERSION_SALDO_OBSOLETA/);
  assert.match(service, /FONDO_SALDO_INSUFICIENTE/);
});