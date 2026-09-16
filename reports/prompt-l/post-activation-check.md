# Prompt L — post-activation read-only check

## Status: **PASS_READONLY_POST_ACTIVATION**

- Observed UTC: `2026-09-16T05:15:29.746Z`; database `heliumdb`, schema `public`.
- Transaction: `REPEATABLE READ READ ONLY`; no source writes, initialization, authentication, or app start/import.
- Committed operator update: `reports/prompt-l/counter-update.json` (only `series_consecutivo`, row id=1 changed to `10000000`; source precondition was rollos/series zero).
- Managed workflows were restarted once successfully by the operator; this check did not pause or restart the API.

## Current database

- Series control: id=`1`, `ultimo_numero=10000000` — **PASS**.
- Rollos: total=`0`, assigned series=`0`; no reset performed; **PASS**.
- Other folios (entrada/salida/viaje/auditoria): all observed values `0`; **PASS**.
- `ticket_folio`: all observed values `999`; **PASS**.
- Physical PostgreSQL default remains `1000000` (expected historical `1000000`; no ALTER/DDL).
- Protected `productos`: `1234` rows, hash `9b5a7bfb4133c1c700f9d242628c0c46`; `precio_historial`: `1016` rows, hash `64f5ec3242e70cdfe37e1a242c26b506` — **PASS**.

## Built API static proof

Static grep/export-JS inspection of `artifacts/api-server/dist/index.mjs` only (not imported or started) found: eight-digit parser with 7/8 preference, explicit seed `10000000`, `99999999` guard, and `SERIES_EXHAUSTED` domain error — **PASS**.

## Retained gates and boundaries

- Tests from this Prompt L: parser **16/16**, reserve mock **3/3**, API contracts **3/3**, frontend contracts **8/8**; codegen **734 tracked paths / 0 diffs**; final root typecheck **PASS / 0 diagnostics** (`reports/prompt-l/typecheck-final.txt`).
- Label gate remains prior full-catalog evidence: 1234/1234 labels, QR 1234/1234 exact, zero introduced eight-digit overflow; one pre-existing AutoFit warning `CAMFLOMAR-AMA` (353px text vs 345.72px usable at min 14px), full text present. Physical print/scan remains pending; catalog was not rerun in this subturn.
- Historical Prompt H seven-digit counter `1000000` and backups remain explicitly historical; current generation rule is first `10000001`, range through `99999999`, exact capacity `89999999` (about 90m / 300 years).
- Normal startup writes were authorized separately; no test writes created real rollos.
