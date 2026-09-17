# Prompt S mechanical replacement and guard

## Mechanical scope

- Preserved the original `HEAD` tree before edits with `git archive HEAD` at
  `/tmp/prompt-s-head`; the watched module was never restored or replaced.
- Replaced exactly six full equivalent predicates in
  `artifacts/api-server/src/lib/admin-analytics.ts`: five with alias `f`
  (the `lines` CTE plus Sales, Subtotal, IVA, and Ticket filters) and one
  with alias `t` (`getSessionMargin`).
- The before scanner found `6` copies (`f,f,f,f,f,t`); the after scanner found
  `0`. The canonical predicate definition was not edited.
- `destinationReadModel()` is byte-identical before and after:
  `sha256 e8c311a464afca25fd042088d2d0808544c326fc365ca3da7324c53b8f1333d9`.
- `admin-analytics.ts` changed from `93466` to `92790` bytes (`-676` bytes);
  the mechanical tracked diff is `6` added and `14` removed lines. The new
  guard test is `7247` bytes.

## Runtime source guard

`artifacts/api-server/src/lib/accounted-document-source-guard.contract.ts`
walks `artifacts`, `lib`, and `scripts` for `.ts`, `.tsx`, `.mts`, `.cts`,
`.js`, `.jsx`, `.mjs`, `.cjs`, and `.sql` files. It excludes dependency, generated, distribution,
report, attachment, and VCS directories (`node_modules`, `deps`, `generated`,
`dist`, `reports`, `attached_assets`, and `.git`). Fixture directories are
not excluded: a full copy in any scanned source file fails. Tests themselves
remain scanned; their predicate fixture is dynamically assembled so the test
source cannot mask a real literal copy. JavaScript line/block comments are
masked before matching. The only production allowlist entry is the canonical
predicate module.

The current whole-source inventory is 732 scanned files: 511 `.ts`, 176
`.tsx`, 16 `.mts`, 27 `.mjs`, and 2 `.sql` (zero current `.cts`, `.jsx`,
`.js`, and `.cjs`). The 16 maintained `.mts` files are now guarded rather
than silently outside the extension set.

The detector requires the VENDIDO state context, both TICKET/NOTA branches,
one shared alias (including aliases other than `f`/`t`), and accepts either
bare `cobrado` or `cobrado=true`. It tolerates newlines and arbitrary
whitespace around qualified-name dots, and matches SQL keywords
case-insensitively. Negative coverage verifies partial conditions,
`cobrado=false`, mixed aliases, and comments; a full predicate in a fixture
directory is positively detected.

The copied guard itself was deliberately executed red then green against a
temporary scanned tree, never a watched production file:

1. Copied the actual guard to
   `/tmp/prompt-s-guard-isolated-mts/artifacts/api-server/src/lib/accounted-document-source-guard.contract.ts`,
   with the API package `node_modules` linked there so its root resolution
   remained valid.
2. Injected a complete, whitespace-varied, mixed-case SQL copy at
   `/tmp/prompt-s-guard-isolated-mts/artifacts/reintroduced-copy.mts`.
   Running `node:test` against the copied guard failed its actual repository
   assertion (`exit 1`, 2 pass / 1 fail).
3. Removed only that temporary file and reran the copied guard. Its actual
   repository assertion passed (`exit 0`, 3 pass / 0 fail).

The red process terminal summary was:

```text
pnpm --dir artifacts/api-server exec tsx --test /tmp/prompt-s-guard-isolated-mts/artifacts/api-server/src/lib/accounted-document-source-guard.contract.ts
mts_red_status=1
✖ runtime source has no hand-written full accounted-document predicate
✔ source guard detects aliases, bare and explicit true, then returns green after removal
✔ source guard leaves partial, false-paid, mixed-alias, and comments alone
ℹ tests 3
ℹ suites 0
ℹ pass 2
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

The green process terminal summary was:

```text
pnpm --dir artifacts/api-server run test:accounted-document-source
package_green_status=0
✔ runtime source has no hand-written full accounted-document predicate
✔ source guard detects aliases, bare and explicit true, then returns green after removal
✔ source guard leaves partial, false-paid, mixed-alias, and comments alone
ℹ tests 3
ℹ suites 0
ℹ pass 3
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 489.565553
```

The API package now exposes that exact command as
`test:accounted-document-source`; its existing `test:admin-analytics` command
also invokes the guard alongside the three established analytics contracts.
The guard’s positive coverage writes full copies with `.mts` and `.cts`
extensions (and also `.ts`/`.jsx`) and verifies each is detected.

## Safe no-DB regression manifest

The same explicit, hand-selected manifest was run first from the archived
isolated source, then after the change. It contains only existing
non-integration analytics, Caja, cartera, report, and frontend contracts:

```text
artifacts/api-server/src/lib/admin-analytics.contract.ts
artifacts/api-server/src/lib/admin-analytics-active-stores.contract.ts
artifacts/api-server/src/lib/store-order.test.ts
artifacts/api-server/src/realtime-breakdown.contract.test.ts
artifacts/api-server/src/pos-caja-final.contract.test.ts
artifacts/api-server/src/caja-diaria-block4.contract.test.ts
artifacts/api-server/src/hoja-ventas-dia.test.ts
artifacts/api-server/src/lib/clientes-aging.test.ts
artifacts/api-server/src/lib/clientes-cartera-read-model.test.ts
artifacts/api-server/src/lib/reportes-commercial.test.ts
artifacts/api-server/src/lib/reportes-composed-export.test.ts
artifacts/api-server/src/lib/reportes-control-operativo.test.ts
artifacts/api-server/src/lib/reportes-inventory.test.ts
artifacts/api-server/src/lib/reportes-que-comprar.test.ts
artifacts/api-server/src/lib/reportes-sales.test.ts
artifacts/api-server/src/lib/reportes.test.ts
artifacts/api-server/src/lib/report-export.test.ts
artifacts/api-server/src/lib/report-presentation.test.ts
artifacts/api-server/src/reportes-scope.contract.test.ts
artifacts/mariana-textil/src/lib/cuentas-destino-financial.contract.test.ts
artifacts/mariana-textil/src/pages/caja/cuentas-destino.contract.test.ts
artifacts/mariana-textil/src/pages/caja/tiempo-real.contract.test.ts
artifacts/mariana-textil/src/pages/caja/tiempo-real-breakdown.contract.test.ts
artifacts/mariana-textil/src/pages/caja/tiempo-real-credit.contract.test.ts
artifacts/mariana-textil/src/pages/caja/tienda-ventas.contract.test.ts
artifacts/mariana-textil/src/pages/cartera.contract.test.ts
artifacts/mariana-textil/src/pages/detail-link-tables.contract.test.ts
artifacts/mariana-textil/src/pages/hoja-ventas-dia.contract.test.ts
```

No API was started, no integration runner was used, and no database-writing
fixture ran. `reportes-que-comprar.test.ts` was included because it replaces
the pool query method with a test-local mock and restores it; its fixture
does not write a database.

| run | terminal status | tests | pass | fail | skipped |
| --- | ---: | ---: | ---: | ---: | ---: |
| archived `HEAD` baseline | 1 | 215 | 210 | 5 | 0 |
| changed source | 1 | 215 | 210 | 5 | 0 |

Both complete summaries ended with:

```text
ℹ tests 215
ℹ suites 0
ℹ pass 210
ℹ fail 5
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

The five failures are unchanged between the archived baseline and changed
source: two static Caja assertions in
`artifacts/api-server/src/pos-caja-final.contract.test.ts` expect
`/Ticket"} folio/` and `/projectCreditLedger\(ledger\)/`; the frontend
assertions expect the old realtime-card count/layout in
`artifacts/mariana-textil/src/pages/caja/tiempo-real-breakdown.contract.test.ts`
and `artifacts/mariana-textil/src/pages/caja/tiempo-real.contract.test.ts`;
and `artifacts/mariana-textil/src/pages/detail-link-tables.contract.test.ts`
expects `/href=\{row\.referenciaRolloRuta\}/`. None covers one of the six
replaced predicates, so no assertion was weakened or altered.

The deliberately excluded integration files are
`artifacts/api-server/src/admin-analytics.integration.test.ts`,
`artifacts/api-server/src/admin-realtime-reconciliation.integration.test.ts`,
and `artifacts/api-server/src/reportes.integration.test.ts`; each is an
isolated-database integration suite and is excluded to honor the no-DB-write
boundary. `artifacts/api-server/src/admin-alertas.integration.test.ts` and
`artifacts/api-server/src/admin-invariants.integration.test.ts` are likewise
database integration suites outside this read-only manifest.