import assert from "node:assert/strict";
import type { Pool } from "pg";
import { ensureSupervisorRole } from "./role-migration";

const queries: string[] = [];
let released = false;
const client = {
  async query(statement: string) {
    queries.push(statement);
    return { rows: [], rowCount: 0 };
  },
  release() {
    released = true;
  },
};

await ensureSupervisorRole({
  async connect() {
    return client;
  },
} as unknown as Pick<Pool, "connect">);

assert.equal(queries[0], "BEGIN");
assert.match(queries[1], /pg_advisory_xact_lock/);
assert.match(queries[2], /RENAME VALUE 'INVENTARIOS' TO 'SUPERVISOR'/);
assert.match(
  queries[2],
  /information_schema\.columns[\s\S]*table_schema = 'public'[\s\S]*table_name = 'usuarios'[\s\S]*column_name = 'alcance_consulta'/,
);
assert.match(queries[2], /UPDATE usuarios[\s\S]*alcance_consulta = 'TODAS'/);
assert.ok(
  queries[2].indexOf("RENAME VALUE 'INVENTARIOS' TO 'SUPERVISOR'") <
    queries[2].indexOf("column_name = 'alcance_consulta'") &&
    queries[2].indexOf("column_name = 'alcance_consulta'") <
      queries[2].indexOf("UPDATE usuarios"),
  "The rename must precede the guarded scope update.",
);
assert.equal(queries[3], "COMMIT");
assert.equal(released, true);