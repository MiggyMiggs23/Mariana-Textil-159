/** MAIN-only, read-only differential proof on explicitly pinned disposable DB. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { projectCreditLedger, type CreditLedgerMovement } from "../../artifacts/api-server/src/lib/credit-allocation";
const url = process.env.TEST_DATABASE_URL;
const pg = createRequire(new URL("../../lib/db/package.json", import.meta.url))("pg");
const identity = process.env.COMMERCIAL_RETURN_DISPOSABLE_SYSTEM_ID;
const clients = (process.env.COMMERCIAL_RETURN_TEST_CLIENT_IDS ?? "").split(",").map(Number);
if (!url || !identity || process.env.COMMERCIAL_RETURN_DISPOSABLE_ACK !== "NEW_PRIVATE_CLUSTER_ONLY" ||
    !clients.length || clients.some(id => !Number.isSafeInteger(id) || id <= 0)) {
  throw new Error("Explicit disposable URL, pinned system ID, acknowledgement and synthetic client IDs required.");
}
const db = new pg.Client({ connectionString: url });
await db.connect();
try {
  const dbIdentity = (await db.query("SELECT current_database() AS name,system_identifier::text AS system FROM pg_control_system()")).rows[0];
  assert.match(dbIdentity.name, /^(test_|disposable_|continuation_)/);
  assert.equal(dbIdentity.system, identity);
  await db.query("BEGIN READ ONLY");
  let checked = 0;
  for (const client of clients) {
    const prefixes = (await db.query("SELECT id FROM public.movimientos_credito WHERE cliente_id=$1 ORDER BY id", [client])).rows;
    assert.ok(prefixes.length > 0, `Synthetic client ${client} has no ledger`);
    for (const { id } of prefixes) {
      const sql = (await db.query("SELECT public.commercial_return_projection($1,$2) AS p", [client, id])).rows[0].p;
      const ledger: CreditLedgerMovement[] = sql.ledger.map((m: any) => ({
        id: m.id, ticketId: m.ticket, tipo: m.kind, importe: (m.amount / 100).toFixed(2),
        createdAt: new Date(m.at), movimientoOrigenId: m.origin, directedMovimientoId: m.directed,
        preventImplicitFavor: m.marked,
        explicitFavorApplications: m.applications.map((a: any) => ({ sourceId: m.id, targetId: a.target, amountCents: a.amount })),
      }));
      const js = projectCreditLedger(ledger);
      assert.equal(sql.debt, js.balanceCents, `client=${client},through=${id}: debt`);
      assert.equal(sql.favor, js.overpaymentCents, `client=${client},through=${id}: favor`);
      assert.deepEqual(sql.balances, Object.fromEntries(js.allCharges.map(c => [c.movimientoId, c.pendienteCents])));
      assert.deepEqual(sql.allocations, js.allocations.map(a => ({
        source: a.sourceId, target: a.targetId, amount: a.appliedCents, before: a.balanceBeforeCents, after: a.balanceAfterCents,
      })), `client=${client},through=${id}: immutable allocations`);
      checked++;
    }
  }
  await db.query("ROLLBACK");
  console.log(`SQL/TypeScript canonical projection parity: ${checked} synthetic prefixes PASS`);
} finally { await db.end(); }