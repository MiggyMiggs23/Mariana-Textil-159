import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { ensureEquiposSchema } from "./equipos-schema";

function fakePool(failMigration = false) {
  const calls: string[] = [];
  let released = false;
  const client = {
    async query(query: string | { text: string }) {
      const text = typeof query === "string" ? query : query.text;
      calls.push(text);
      if (failMigration && text.includes("CREATE TABLE IF NOT EXISTS equipos")) {
        throw new Error("incompatible partial table");
      }
      return { rows: [] };
    },
    release() {
      released = true;
    },
  };
  return {
    pool: {
      async connect() {
        return client;
      },
    } as unknown as Pick<Pool, "connect">,
    calls,
    released: () => released,
  };
}

test("equipment initializer is transactional and repeatable", async () => {
  const fixture = fakePool();
  await ensureEquiposSchema(fixture.pool);
  await ensureEquiposSchema(fixture.pool);
  assert.equal(fixture.calls[0], "BEGIN");
  assert.equal(fixture.calls.filter((query) => query === "BEGIN").length, 2);
  assert.ok(fixture.calls.some((query) => query.includes("pg_advisory_xact_lock")));
  assert.ok(
    fixture.calls.some(
      (query) =>
        query.includes("ADD COLUMN IF NOT EXISTS marca text") &&
        query.includes("column validation failed") &&
        query.includes("WHERE permisos_rol.updated_por IS NULL"),
    ),
  );
  assert.equal(fixture.calls.at(-1), "COMMIT");
  assert.equal(fixture.released(), true);
});

test("equipment initializer rolls back incompatible structures", async () => {
  const fixture = fakePool(true);
  await assert.rejects(
    ensureEquiposSchema(fixture.pool),
    /incompatible partial table/,
  );
  assert.equal(fixture.calls.at(-1), "ROLLBACK");
  assert.equal(fixture.released(), true);
});