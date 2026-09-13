# `reconstruirCacheExistencias` regression report

## Result

- Unit coverage: **5 passed, 0 failed, 0 skipped**.
- Canonical-seed PostgreSQL regression: **1 passed, 0 failed**.
- API-server TypeScript check: **passed**.
- No runner allowlist or database-policy files were changed.

## PostgreSQL scope and guards

The regression used the existing `DisposablePostgresRunner`, a fresh local
cluster, the canonical schema/seed, and the runner's identity checks. The
cluster was cleaned up after the test. No application, development, production,
backup, user, session, product, or inventory fixture was inserted or modified.
The application database was used only for the runner's existing read-only
identity isolation check.

Inside one real `db.transaction`, the test:

1. Snapshotted all seeded `permisos_rol` rows from a separate connection.
2. Deleted those existing rows and asserted that the affected row count was
   greater than zero.
3. Called the real `reconstruirCacheExistencias(tx)`.
4. Threw an intentional sentinel to force rollback.
5. Used a newly acquired connection to assert that every permission row was
   restored exactly.

The real PostgreSQL rebuild-failure injection replaced only the selected
function SQL execution with `SELECT 1 / 0` on the real caller transaction. The
database error propagated through Drizzle and the transaction rejected. The
canonical seed contains no inventory pairs, so lock-failure injection was
reported as skipped rather than represented as no-op lock coverage.

## Related explicit test paths

- `inventory-status-semantics.test.ts`: **6 passed**.
- `stock-minimos-engine.test.ts`: **12 passed, 1 existing skipped**. The
  skipped test is the pre-existing “mocked DB (blocked: no injectable
  executor; never run real DB rebuild)” test; the new dedicated unit test
  supplies executable transaction coverage.