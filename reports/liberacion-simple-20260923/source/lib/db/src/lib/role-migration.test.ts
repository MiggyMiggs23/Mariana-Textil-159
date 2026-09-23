import assert from "node:assert/strict";
import type { Pool } from "pg";
import { ensureSupervisorRole } from "./role-migration";

const queries: string[] = [];
let released = false;
const client = {
  async query(statement: string) {
    queries.push(statement);
    return statement.includes("count(*)::int")
      ? { rows: [{ count: 3 }], rowCount: 1 }
      : { rows: [], rowCount: 0 };
  },
  release() {
    released = true;
  },
};

const supportUserCount = await ensureSupervisorRole({
  async connect() {
    return client;
  },
} as unknown as Pick<Pool, "connect">);

assert.equal(queries[0], "BEGIN");
assert.match(queries[1], /pg_advisory_xact_lock/);
assert.match(queries[2], /rol::text = 'SOPORTE'/);
assert.match(queries[3], /RENAME VALUE 'INVENTARIOS' TO 'SUPERVISOR'/);
assert.match(
  queries[3],
  /information_schema\.columns[\s\S]*table_schema = 'public'[\s\S]*table_name = 'usuarios'[\s\S]*column_name = 'alcance_consulta'/,
);
assert.match(queries[3], /RENAME VALUE 'SOPORTE' TO 'SISTEMAS'/);
assert.match(queries[3], /ALTER TYPE rol_usuario ADD VALUE 'CONTADOR'/);
assert.match(queries[3], /UPDATE usuarios[\s\S]*alcance_consulta = 'TODAS'/);
assert.ok(
  queries[3].indexOf("RENAME VALUE 'INVENTARIOS' TO 'SUPERVISOR'") <
    queries[3].indexOf("column_name = 'alcance_consulta'") &&
    queries[3].indexOf("column_name = 'alcance_consulta'") <
      queries[3].indexOf("UPDATE usuarios"),
  "The rename must precede the guarded scope update.",
);
assert.equal(queries[4], "COMMIT");
assert.equal(supportUserCount, 3);
assert.equal(released, true);