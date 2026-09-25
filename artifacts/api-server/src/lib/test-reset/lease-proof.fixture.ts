import assert from "node:assert/strict";
import { once } from "node:events";
import { Pool } from "pg";
import { acquireResetProcessLease } from "./process-lease";
const url = new URL(process.env.DATABASE_URL!);
assert.equal(url.searchParams.get("host"), process.env.RESET_TEST_SOCKET);
assert.ok(process.env.RESET_TEST_SOCKET?.startsWith("/tmp/test-reset-isolated-"));
const pool = new Pool({ connectionString: url.toString() });
try {
  const lease = await acquireResetProcessLease(pool.options, false);
  try {
    process.stdout.write("LEASE_READY\n");
    await once(process.stdin, "data");
    // Represent a previously authorized write: the normal API lifetime lease
    // is not released until all of its SQL work and pool have drained.
    await pool.query("UPDATE ticket_folio SET ultimo_folio=ultimo_folio+1 WHERE id=1");
    await pool.end();
  } finally { await lease.close(); }
} catch (error) {
  if (String(error).includes("otra API")) process.stdout.write("LEASE_BLOCKED\n");
  else throw error;
  await pool.end();
}