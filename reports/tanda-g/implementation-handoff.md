# Strict reversal implementation — progress

API worker investigation: movement rows have no physical before/after snapshot. `saldoPosterior` is a site/product ledger balance and cannot prove a roll poststate.

Proposed smallest additive implementation: record versioned before/after physical evidence in the existing transactional `auditoria` JSON columns, keyed to the movement, from the shared writer. This avoids DDL/application database migration. Explicit producer before-state is required to authorize a reversal; unknown or legacy evidence fails closed. Transfer legs are a coupled operation: a single-leg snapshot is not sufficient to restore physical and two-site ledgers; they fail closed with adjustment guidance, not a fabricated inferred state. Fresh simple supported movements retain chronological reversal capability. CANCELACION must not be reversed through the generic route (inverse-of-inverse ledger-only corruption).

04:33 UTC progress: source implementation and pure tests ready. API typecheck PASS; four pure evidence/provenance tests PASS. Candidate built separately at `artifacts/api-server/dist-tanda-g-strict-candidate` (rebuild after final changes). Existing API dist untouched.

Fresh `activarRollo`, `venderRollo`, `ajustarRollo` and extraordinary BAJA capture trusted before/after in the existing audit table. Strict guard restores exact before-state instead of arithmetic/state guesses. Missing/ambiguous evidence, compound transfer/tránsito, inverse-of-inverse and unresolved subsequent movements fail closed. Supported adjustment→sale→reverse sale→reverse adjustment→reverse receipt chain has an integration test ready; no blanket disable of the shared reversal function. New-row ALTA/direct entry receipts without an actual prior physical row remain conservatively unavailable, as do historical movements without evidence.

MAIN should run cluster on55441, then integration command (copy only):

```sh
REQUIRE_ISOLATED_TEST_DATABASE=1 NODE_ENV=test TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55441/tanda_g_candidate APPLICATION_DATABASE_URL=postgresql://postgres@127.0.0.1:55441/tanda_g_witness DATABASE_URL=postgresql://postgres@127.0.0.1:55441/tanda_g_witness STRICT_REVERSAL_DATABASE=tanda_g_candidate STRICT_REVERSAL_FIXTURE=/home/runner/workspace/reports/tanda-g/setup/fixture-manifest-redacted.json pnpm --filter @workspace/api-server exec tsx --test src/lib/inventory-strict-reversal.integration.test.ts
```

Verify actual prepared copy names before running (the command uses illustrative candidate name until setup reports it). Tests rollback own synthetic new rolls; no historical data edits. API worker awaits cluster readiness, but does not start it under delegated scope.

Scope excludes partial-ticket path 3 and historical DEVOLUCION 10; no enabling metrage or fabrication of history. No schema migration required for proposed audit evidence approach. MAIN can prepare unchanged-schema disposable copy.

## Additional negative-quantity route found (not fixed; owner asked diagnosis)

`activarRollo` only applies `assertWholeDiscreteQuantity` to its input; that helper returns immediately for METRO/KILO. POST `/rollos/:id/activar` forwards `ActivarRolloBody.cantidadReal`, whose OpenAPI contract is an unrestricted string. Therefore an authorized activation of a PROGRAMADO METRO/KILO roll with `cantidadReal="-2"` has **no producer or visible boundary nonnegative guard**, updates the roll to DISPONIBLE/-2 and emits RECEPCION/-2. `crearRollo` similarly has no positive-quantity validation for METRO/KILO beyond cost validation (internal producer; inspect individual callers before claiming public HTTP reachability). `ajustarRollo` DOES explicitly reject negative target quantity, and sales consumption bounds subtraction; ledger negatives themselves are valid and distinct from physical negatives. No unrelated DB constraint installed. MAIN should reproduce activation negative in the isolated copy and report that strict reversal does not by itself close it.