# Prompt S — independent verification, pre-change capture

## Boundary

This report is verification-only. It did not modify application sources,
`destinationReadModel`, or financial definitions; it did not start/restart a
workflow. The only repository files created are this report and its sanitized
JSON companion. Temporary archive, bundle, and node scripts are under
`/tmp/prompt-s-*`.

## Baseline preserved before mechanical work

`git HEAD` was `075bfdbeb7180756a2e5b4cda8985757ceb9aba7`. I captured
`artifacts/api-server/src/lib` with:

```sh
git archive --format=tar HEAD artifacts/api-server/src/lib | tar -xf - -C /tmp/prompt-s-baseline
sha256sum artifacts/api-server/src/lib/admin-analytics.ts \
  /tmp/prompt-s-baseline/artifacts/api-server/src/lib/admin-analytics.ts
```

Both hashes were
`6ebfb2e158a78bfa187bea3096fdb3bcc6a26dcd8d3c863ae6fb5af200d90f80`.
No watched module was replaced.

At capture time all six full literals were still present in the working tree.
The final verifier must therefore load this archive as **before** and load the
working tree only after the mechanical worker has replaced all six.

## Exact-literal inventory

The repository-wide whitespace-tolerant scan found **six**, all in
`artifacts/api-server/src/lib/admin-analytics.ts`:

| Lines | Alias | Consumer | Canonical-equivalent |
| --- | --- | --- | --- |
| 382–383 | `f` | `getSalesSummary` line-margin eligibility | yes |
| 388 | `f` | `getSalesSummary.ventas` | yes |
| 392 | `f` | `getSalesSummary.subtotal` | yes |
| 394 | `f` | `getSalesSummary.iva` | yes |
| 398 | `f` | `getSalesSummary.tickets` | yes |
| 442–443 | `t` | `getSessionMargin` | yes |

`accountedDocumentPredicate(alias = "t")` accepts any alias string, so both
`f` and `t` are supported without changing the canonical definition.

The following partial variants are deliberately not copies and were not
unified: line 369 (`VENDIDO` + bare `cobrado`, cash-payment subset), line 920
(authorized credit-note payment-method branch), and line 1242 (`VENDIDO` +
bare `cobrado`, cash-session operational count). Their exact behavioral
differences are in `verification-prechange.json`.

## Read-only execution completed

The following command completed successfully:

```sh
node /tmp/prompt-s-fixture-verify.mjs
```

It esbuild-bundled the archived pre-change module and a **temporary** clone
with exactly six canonical calls, aliasing only `@workspace/db` to a
single-client adapter. It imported no server entrypoint or application DB
initializer. The adapter rejected write SQL. Both affected functions ran
inside:

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY
```

The CTE `VALUES` shadow relation covered a charged ticket, authorized note,
pending ticket, pending note, cancelled row, `NULL` `cobrado`, zero amount,
and missing frozen cost. `getSalesSummary` compared all 14 returned fields;
`getSessionMargin` compared all four. Both were exactly equal. This is an
actual execution of each generated SQL shape, not a canned query result.

Fresh production-configured, direct-`pg`, read-only counts also completed:

```sh
node /tmp/prompt-s-real-counts.mjs
```

The sanitized snapshot counts are in the JSON. They observed one
`VENTA_CREDITO` row (not three); this is a fresh observation, not a historical
claim. No identifiers, names, folios, dates, or credentials were written.

## Deliberately not claimed yet

This was a pre-change record. The completed final same-snapshot execution is
documented in `verification-final.md` and `verification-final.json`.