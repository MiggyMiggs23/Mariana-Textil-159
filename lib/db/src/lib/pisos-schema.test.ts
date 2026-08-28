import assert from "node:assert/strict";
import test from "node:test";
import { ensurePisosSchema } from "./pisos-schema";

test("floor migration only extends physical rolls, never ledger/cache tables", async () => {
  const queries: string[] = [];
  const pool = {
    async connect() {
      return {
        async query(query: string) { queries.push(query); },
        release() {},
      };
    },
  };
  await ensurePisosSchema(pool as never);
  const ddl = queries.join("\n");
  assert.match(ddl, /ALTER TABLE rollos ADD COLUMN IF NOT EXISTS piso_id/);
  assert.doesNotMatch(ddl, /ALTER TABLE movimientos[\s\S]*piso_id/i);
  assert.doesNotMatch(ddl, /ALTER TABLE existencias[\s\S]*piso_id/i);
});