# Prompt S — independent final verification

**Terminal status: PASS.** This verifier compared archived `HEAD`
`075bfdbeb7180756a2e5b4cda8985757ceb9aba7` (before) to the actual current
working-tree `admin-analytics.ts` (after). The baseline had been captured in
`/tmp/prompt-s-baseline` before the mechanical edit; no watched module was
replaced.

## Mechanical boundary

The whitespace-tolerant, same-alias full-predicate scan now has zero matches
outside `accounted-document.ts`. `admin-analytics.ts` contains 22 canonical
calls versus 16 in the archived baseline: the required increase is exactly
six. The diff is limited to five replacements in `getSalesSummary` and one in
`getSessionMargin`.

## Same-snapshot real execution

Completed command:

```sh
node /tmp/prompt-s-final-verify.mjs
```

The corrected consumer-band and positive pagination probes also completed:

```sh
node /tmp/prompt-s-cobranza-band.mjs
node /tmp/prompt-s-cte-positive-detail.mjs
```

The temporary script used esbuild only to bundle the archived and current
modules with a pool-only adapter. It imported neither the application DB
module nor an API/server entrypoint, and therefore did not run database
initializers. The adapter forwarded every generated read to one direct `pg`
client and rejects write SQL. Both before and after executed on this one
transaction:

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY
```

It made 94 generated-query calls (4 CTE-fixture and 90 real-data calls).
Generated SQL hashes, rather than query rows or credentials, are retained by
the temporary verifier; no result was mocked or supplied as canned data.

`getSalesSummary` was compared field-by-field for global plus every active
site (`1`, `2`, `3`) across all-time and the observed-accounted window: eight
before/after pairs. All 14 fields were compared, including strings, numbers,
and nulls; no fields were excluded. `getSessionMargin` was also compared
field-by-field for the real discovered session (`43`). There were no
differences. Full sanitized values and field paths are in
`verification-final.json`.

## CTE VALUES SQL-shape coverage

Archived-before and actual-current-after functions also ran against the same
read-only CTE `VALUES` shadow relations. The executed function SQL covered a
positive charged ticket, positive authorized note, pending ticket, pending
note, cancelled row, nullable `cobrado`, zero amount, and missing frozen cost.
Both affected function objects were exactly equal. This CTE is query-local:
it created no relation and made no database write.

## Real-data identities and pagination

All scope/period checks passed:

* **Ventas = contado + crédito:** global all-time
  `16000.00 = 0.00 + 16000.00`.
* **Requested dashboard Cobranza band = Cuentas Destino Cobrado total:** PASS.
  The actual consumer source establishes one shared hook
  (`useSharedCuentasDestino` → `useGetAdminCuentasDestino`) for both
  surfaces. The Tiempo real band reads `header.cobrado.total` and declares
  `POS`, `ABONO`, and `ABONO_SALDO_FAVOR`; it does **not** use the operational
  Contado card value. The fresh actual `getDestinationAccounts` response
  proved `totalCobrado = encabezado.cobrado.total = 18000.00`, composed of
  `0.00` contado, `16000.00` ABONOs, and `2000.00` saldos a favor (all net of
  their corresponding reversal sources in the canonical read model).
* **Separate operational Contado card/detail:** `0.00 = 0.00` against
  `encabezado.cobrado.contado`; this is recorded only to distinguish it from
  the Cobranza band, not as the requested band identity. The current real
  dataset has zero COBRADO detail rows, so it is explicitly **not** positive
  real-data page coverage.
* **Positive actual-function CTE card/detail coverage:** PASS. A query-local,
  no-write CTE supplied three COBRADO ticket rows totaling `180.00`.
  `getSalesSummary.ticketsCobrados` and `.cobrado` matched
  `listRealtimeBreakdown("COBRADO")` on all pages with page sizes 1
  (three pages) and 2 (two pages). The fixture also retained the authorized,
  pending, cancelled, nullable-boolean, zero, and missing-cost cases.
* **Destination card/detail:** one positive global observed-window row was
  traversed across all pages; count `1` and amount `16000.00` agree.

The fresh count obtained inside the final transaction is
`credit_rows = 1`. It is a current snapshot observation only; no Q3 or other
historical snapshot was merged into this conclusion.

## Scope not run

No workflow was started/restarted. No API, server entrypoint, initializer,
broad unrelated verifier, application test suite, typecheck, or codegen was
run by this independent verification task. The worker-reported contract and
codegen statuses are not represented as executions by this verifier.