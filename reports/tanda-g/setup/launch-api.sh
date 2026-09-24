#!/usr/bin/env bash
set -euo pipefail
umask 077
ROOT=/home/runner/workspace
R="$ROOT/.local/tanda-g"
case "${1:-}" in
  baseline) DB=tanda_g_baseline; PORT=43841; BUNDLE="$R/baseline-source/artifacts/api-server/dist/index.mjs";;
  candidate) DB=tanda_g_candidate; PORT=43842; BUNDLE="$R/candidate-source/artifacts/api-server/dist/index.mjs";;
  browser) DB=tanda_g_browser; PORT=43843; BUNDLE="$R/candidate-source/artifacts/api-server/dist/index.mjs";;
  *) echo "Usage: launch-api.sh baseline|candidate|browser" >&2; exit 1;;
esac
PG=/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin
test -f "$BUNDLE"
test "$("$PG/psql" -XAt -h 127.0.0.1 -p 55441 -U postgres -d "$DB" -c "select current_database()||'|'||current_setting('data_directory')")" = "$DB|$R/cluster"
NODE="$(command -v node)"
echo "$$" > "$R/$1-api.pid"
exec env -i PATH="$(dirname "$NODE"):/usr/bin:/bin" HOME="$R" NODE_ENV=test PORT="$PORT" \
 REQUIRE_ISOLATED_TEST_DATABASE=1 TEST_DATABASE_URL="postgresql://postgres@127.0.0.1:55441/$DB" \
 DATABASE_URL=postgresql://postgres@127.0.0.1:55441/tanda_g_witness \
 APPLICATION_DATABASE_URL=postgresql://postgres@127.0.0.1:55441/tanda_g_witness \
 ISOLATED_API_MODULE="$BUNDLE" SESSION_SECRET="$(cat "$R/session-secret")" \
 "$NODE" "$ROOT/reports/tanda-g/setup/api-runner.mjs"