# Prompt L — block 0 database gate

- **Status:** `PASS_READONLY_GATE`
- **Observed at (Mexico City, from DB):** `2026-09-15T22:40:38.967`
- **Scope:** one direct `DATABASE_URL` connection, one PostgreSQL `READ ONLY` transaction, SELECTs only; no API restart, workflow, initializer, seed, session/auth action, SQL write, or `nextval` call.

## Source connection identity

- Application connection selected from current app configuration variable `DATABASE_URL`; credentials are omitted.
- Configured target: `helium:5432/heliumdb` (protocol postgresql).
- PostgreSQL identity: database `heliumdb`, schema `public`, server `16.10`.
- Read-only transaction setting: `on`; isolation: `repeatable read`.
- DB-observed timestamp: `2026-09-15T22:40:38.967`.

## Zero gate

- `public.rollos` rows: **0**.
- Assigned-series interpretation: `public.rollos.serie` values with `serie IS NOT NULL AND btrim(serie) <> ''`: **0**.
- Null/empty `rollos.serie` rows: **0**; distinct non-empty assigned series: **0**.
- Duplicate non-empty assigned series: **0** duplicate groups.

## `series_consecutivo`

- Rows: **1**; current `ultimo_numero` range: **1000000..1000000**.
- Rows/values: `[{"id":"1","ultimoNumero":"1000000"}]`.
- Column metadata/type ranges: `[{"columnName":"id","dataType":"integer","udtName":"int4","isNullable":"NO","numericPrecision":"32","numericScale":"0","columnDefault":"1","declaredTypeRange":"-2147483648..2147483647"},{"columnName":"ultimo_numero","dataType":"integer","udtName":"int4","isNullable":"NO","numericPrecision":"32","numericScale":"0","columnDefault":"1000000","declaredTypeRange":"-2147483648..2147483647"}]`.
- Duplicate `ultimo_numero` values: **0** duplicate groups.

## Protected catalog comparison

- Snapshot: `.local/backups/prompt-h-block2-20260915214248-7517/source-snapshot.json`; captured at `2026-09-15 21:42:48`; commit `70ebe2a193c7ca6ca60257d2ff80260f45718554`.
- `productos`: current count **1234**, canonical hash `9b5a7bfb4133c1c700f9d242628c0c46`; expected count **1234**, hash `9b5a7bfb4133c1c700f9d242628c0c46`; match: **true**.
- `precio_historial`: current count **1016**, canonical hash `64f5ec3242e70cdfe37e1a242c26b506`; expected count **1016**, hash `64f5ec3242e70cdfe37e1a242c26b506`; match: **true**.
- `productos` color coverage: total **1234**, non-null/non-empty `color` **1234**, distinct non-empty colors **175**; `color_hex` non-null/non-empty **17**. The canonical `to_jsonb(t)::text` hash covers every `productos` column, including both color fields.

## Gate decision

- Zero rollos: **true**; zero assigned series: **true**; protected catalog unchanged: **true**.
- **Decision:** `PASS_READONLY_GATE`.

## Executed SQL safety

- Transaction began as `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY` and ended with `COMMIT` after SELECT-only work (or `ROLLBACK` on error).
- Canonical comparison used the exact approved form `to_jsonb(t)::text`, ordered `string_agg(md5(canonical), '' ORDER BY canonical, md5(canonical))`, wrapped in `md5(COALESCE(...))`.
- No credentials, raw connection URL, raw product rows, or user/session data are included.
