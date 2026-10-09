import assert from "node:assert/strict";
import test from "node:test";
import { ensureChoferesSchema } from "./choferes-schema";

test("choferes initializer is additive, nullable and repeatable without data rewrites", async () => {
  const queries: string[] = [];
  let releases = 0;
  const pool = { async connect() {
    return {
      async query(sql: string) { queries.push(sql); },
      release() { releases++; },
    };
  } };
  await ensureChoferesSchema(pool as never);
  await ensureChoferesSchema(pool as never);
  const ddl = queries.join("\n");
  assert.equal(releases, 2);
  assert.equal(queries.filter((q) => q === "COMMIT").length, 2);
  assert.match(ddl, /telefono text NOT NULL/);
  assert.match(ddl, /ALTER TABLE choferes ADD COLUMN IF NOT EXISTS telefonos jsonb;/);
  assert.doesNotMatch(ddl, /UPDATE choferes|DELETE|DROP|telefonos jsonb NOT NULL/i);
});