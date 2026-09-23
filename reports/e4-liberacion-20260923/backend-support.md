# E4 backend support — 2026-09-23

## Contract synchronized for UI

`SalidaDineroCajaInput` now requires `tipo` and `claveOperacion`.

The E4-native exceptional field is:

```json
{
  "desbloqueoCaja": {
    "motivo": "required non-empty text, maximum 1000 characters"
  }
}
```

It is accepted only for an `EXTRAORDINARIA`, only from an authenticated `ADMIN`,
and only when canonical session cash is insufficient. The native evidence is
returned at `salida.e4.desbloqueoCaja` as either `null` or:

```json
{
  "motivo": "...",
  "usuarioId": 1,
  "createdAt": "2026-09-23T00:00:00.000Z",
  "saldoAntes": "9.99",
  "egreso": "10.00"
}
```

No E12 table, E12 gate, or E12 DTO participates in this path.

## Implemented backend behavior

- E4 source gate is ON; E12 source gate remains OFF.
- ADMIN, SUPERVISOR, and CAJA may create extraordinary physical-cash outflows
  in the normal authorized store scope; motive is mandatory.
- The session row is locked before canonical open-session cash is read, so
  concurrent E4 withdrawals for one session serialize.
- Insufficient cash is blocked. Only an extraordinary ADMIN operation can use
  the motivated native unlock; supplier payments can never use it.
- Supplier payment remains Mariana-only, physical-cash-only, active-supplier
  only, and is capped by both canonical cash and current supplier debt.
- Supplier ledger is locked before the session and the real `registrarPago`
  producer runs in the same transaction as the physical cash outflow, E4
  evidence, idempotency row, and audits.
- Review/reclaim/response updates evidence only and never creates a second cash
  movement.
- Idempotent replay remains actor-and-content bound.

## Legacy supplier ambiguity inspected

At baseline `bbdddb8`, the non-E12 `crearSalidaDineroCaja` branch only inserted
`salidas_dinero_caja`; it checked Mariana, open session, and active supplier, but
did **not** call `registrarPago`, reduce supplier debt, cap against debt, or guard
cash. Therefore “preserve the existing supplier producer” was not literally
satisfiable: no supplier-ledger producer existed in that branch. MAIN interpreted
the owner's “Pago a proveedor sigue duro y solo Mariana” as requiring an actual
supplier payment with hard cash/debt limits; this was an implementation decision,
not a separate literal owner clarification. The E4 path calls `registrarPago` rather
than inventing a second ledger implementation. E12 remains OFF and unchanged.

## Verification completed

- OpenAPI codegen plus workspace library typecheck: PASS.
- API server TypeScript typecheck: PASS.
- Focused E4/E12/E11 tests: **85 passed, 0 failed, 0 skipped**.
- E4 cases covered in that focused run include every store and all three
  authorized roles, own-site denial, motive/amount validation, insufficient
  cash, ADMIN native unlock, forged non-ADMIN unlock, supplier hard cash/debt,
  replay/conflict, review state/version/history, no review cash movement,
  audit rollback model, adapter locks/CAS, contract parsing, E4 ON permission,
  and explicit E4 OFF behavior.
- E12 OFF and Fondo hard-withdrawal tests remained green.

## Disposable PostgreSQL verification

PASS through the focused `lib/db/src/run-e4-isolated-tests.mjs` harness. It does
not modify the exactly-28 global manifest/runner policy, rejects inherited
application DB targeting, creates its own local PostgreSQL cluster, runs the
canonical full schema/seed preparation, and applies the **existing** approved
Tanda-B E4 SQL only inside that disposable database.

The real `crearSalidaDineroCaja` producer and repository were exercised against
PostgreSQL for:

- normal scope in all three stores for **SUPERVISOR and CAJA independently**
  (six real producer writes), in addition to ADMIN-specific unlock/review cases;
- cross-store rejection;
- canonical insufficient cash, motivated ADMIN unlock, and persisted evidence;
- replay after a later balance change;
- two concurrent withdrawals competing for the same session cash;
- review history with unchanged outflow count and total;
- supplier ledger mutation through `registrarPago`, debt cap, and no unlock;
- rollback of supplier ledger, physical outflow, E4 evidence, idempotency, and
  audit when the final audit insertion is forced to fail.

The run emitted both `E4_DISPOSABLE_PG_PASS` and
`E4_DISPOSABLE_CLUSTER_DESTROYED_PASS`. During the first proof run it also found
and fixed a real adapter issue: raw PostgreSQL returned `abierta_at` as a string,
so the repository now validates and normalizes it to `Date` before invoking the
canonical cash reader.

The final positive stdout is archived at `disposable-pg-stdout.txt`; the
post-run filesystem cleanup proof is archived at
`disposable-pg-cleanup.txt`. Both evidence files were scanned to ensure they
contain no connection URL or named credential material.

The actual HTTP route now parses `CrearSalidaDineroCajaBody.strict()`. Unknown
legacy E12/Fondo fields such as `fondoId`, `split`, or `desbloqueoCajaE12` are
rejected instead of silently stripped; focused contract coverage freezes this.

No real API database was touched, no workflow was run/restarted, and no new SQL
was created or applied outside the destroyed disposable cluster.