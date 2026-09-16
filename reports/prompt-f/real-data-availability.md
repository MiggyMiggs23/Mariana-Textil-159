# Real-data availability — Block 0 evidence handoff

**Scope:** readonly evidence acquisition only. No primary application file was edited. No database write, migration, restore-to-database, authentication/session action, user inspection, remote integration, API restart, pool/secret inspection, or workflow execution was performed by this task.

## Current verified zero state

MAIN's current `REPEATABLE READ READ ONLY` transaction already verified `heliumdb/public` on PostgreSQL 16.10. This task did not repeat that database query or inspect the running pool.

The supplied current result is:

- `movimientos_credito GROUP BY tipo`: **zero rows**.
- Client `7`: **exists**.
- Movement ids `43..50`: **count 0**.
- The prior canonical snapshot is `reports/prompt-j/real-data-canonical-snapshot.json` (SHA-256 `5d84f021e234fb25259c119b84ad2ebdd011eec5d72631f5f295909e4c8ec9ef`), captured `2026-09-16T07:32:25.022Z`; it also records seven clients and zero current tickets/ticket lines.

Therefore the current API/database state cannot truthfully provide a non-zero credit example. The archive cases below are historical evidence only and are not current live rows.

## Bounded local archive search

The scoped search covered 15 local dump files: eight `.local/backups/prompt-h` dumps, six pre-purge backup dumps under `.local/backups`/`scripts/.local/backups`, and `mariana-replit-20260907.dump`. For each archive, only these four data tables were extracted to temporary text with `pg_restore --file=/tmp/... --data-only --table=...`, never with `--dbname`:

- `public.movimientos_credito`
- `public.aplicaciones_credito`
- `public.clientes`
- `public.tickets`

No users, auth, session, ticket-line, product, or secret data was extracted. The bounded search found:

1. **Latest prompt-h snapshot** — `.local/backups/prompt-h-block2-20260915214248-7517/prompt-h-block2-20260915214248-7517.dump`, SHA-256 `da7d3f7f342756511c6a04d000f0f4f4fa3feea6b9caad21e6abec5213dffb22`, archived filesystem timestamp `2026-09-16T03:42:49.250266666Z`. It contains literal movements `43..50`, two applications, clients 6/7, and tickets 104/105.
2. **Earlier pre-purge snapshot** — `.local/backups/respaldo-antes-de-purga-2026-09-13-092331/respaldo-antes-de-purga-2026-09-13-092331.dump`, SHA-256 `f39951acc3bbeeff60a3007806b9f05b6a36b21299c586f9f0829bc54d4b0f67`, archived filesystem timestamp `2026-09-13T15:23:32.490299892Z`. It contains client 7 movements 40/41, application 4, and ticket 96.
3. The remaining prompt-h/pre-purge copies are duplicate or earlier snapshots of those same bounded cases; no additional permitted transaction shape was found.

Exact provenance, literal fields, the offline client-7 ledger, and the separate historical cases are in [`historical-credit-cases.json`](./historical-credit-cases.json).

## Verified historical shapes

The latest archive has the complete 43–50 sequence:

| movement | client | type | literal amount | historical date | origin |
|---:|---:|---|---:|---|---:|
| 43 | 6 / Miguel Esteban | `VENTA_CREDITO` | `"15750.00"` | `2026-09-15 19:29:34.336084+00` | — |
| 44 | 7 / Jacinta Mendoza | `VENTA_CREDITO` | `"22022.00"` | `2026-09-15 19:32:04.605206+00` | — |
| 45 | 7 / Jacinta Mendoza | `ABONO` | `"-15000.00"` | `2026-09-15 00:00:00+00` | — |
| 46 | 6 / Miguel Esteban | `ABONO` | `"-10000.00"` | `2026-09-15 00:00:00+00` | — |
| 47 | 6 / Miguel Esteban | `REVERSO` | `"10000.00"` | `2026-09-15 21:16:51.254+00` | 46 |
| 48 | 7 / Jacinta Mendoza | `REVERSO` | `"15000.00"` | `2026-09-15 21:16:51.304+00` | 45 |
| 49 | 6 / Miguel Esteban | `ABONO` | `"-10000.00"` | `2026-09-15 19:35:17.006+00` | — |
| 50 | 7 / Jacinta Mendoza | `ABONO` | `"-15000.00"` | `2026-09-15 19:34:10.192+00` | — |

The corresponding applications are literal archive rows:

- application 5: ABONO 49 → sale 43, `"10000.00"`;
- application 6: ABONO 50 → sale 44, `"15000.00"`.

The client-7 linked ticket is id `105`, folio `1005`, total `"22022.00"`, due `2026-10-15`, client name `Jacinta Mendoza`. The earlier separate case is ticket id `96`, folio `1003`, total `"5000.00"`, due `2026-10-11`, with movement 40 (`VENTA_CREDITO`) and movement 41 (`ABONO`).

The historical reports corroborating the later snapshot are `reports/prompt-h/history-paused-213056/block3-preflight-metadata.json` (SHA-256 `3c4c4578afd9248fc9cb8c2644e88f7f7f12d872aa63046fc8a67f3b38bae991`) and `reports/abonos-bloque4-2026-09-15-ejecucion.jsonl` (SHA-256 `608072dc37b30528ba4759f1a45782ae0bb41e0c00cfacc442058b306c5cc3d7`). Those are historical read-only reports, not current DB evidence.

## Explicit gaps in the bounded evidence

- **Split ABONO:** not present. No extracted ABONO has more than one `aplicaciones_credito` row. The latest archive has one application per ABONO (49→43 and 50→44); the earlier archive has one (41→40). This is a bounded finding, not an infinite-hunt claim.
- **`AJUSTE`:** not present as a literal movement row in the scoped archives. SQL/function references to `AJUSTE` were not promoted into fake data.
- **Seven-digit real amount:** not present. No credit movement, credit application, or ticket total in the scoped rows has seven or more integer digits. `series_consecutivo=1000000` is a counter, not a financial transaction amount, and is excluded.
- **Long names:** no qualifying long client name or linked ticket recipient exists in the permitted rows. Catalog-only long product labels in the canonical snapshot are not transaction evidence and are excluded from the JSON field set. Names cannot be inferred from those labels.

## Block 0 code-audit handoff (data only)

The requested source reference is `artifacts/api-server/src/routes/clientes.ts:1787` (payment-detail route context). The adjacent customer-payment list still filters the ledger at lines 1688–1693 with `tipo = 'ABONO'`; this is the old ABONO-only route audit reference supplied for handoff, not a claim that the current database contains those rows. The historical data demonstrably includes `REVERSO` rows and append-only recaptured `ABONO` rows, so the data handoff intentionally does not prescribe an API implementation.

## Non-claims

`historical-credit-cases.json` is an offline canonical input ledger for review/project work only. Its historical IDs must not be treated as live foreign keys. No historical row was merged into the live app, and these archives do not establish deployed-production equivalence or live E2E behavior.