#!/usr/bin/env bash
set -euo pipefail
cd /home/runner/workspace
# Do not start/restart any app or cluster. Wait no longer than four minutes.
PG=/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin
for i in $(seq 1 120); do
  "$PG/pg_isready" -h 127.0.0.1 -p 55440 >/dev/null 2>&1 && break
  if test "$i" = 120; then echo 'BLOCKED: private cluster not ready within four minutes'; exit 1; fi
  sleep 2
done
node reports/tanda-f/tarea-3/build.mjs
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test REQUIRE_ISOLATED_TEST_DATABASE=1 \
 TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55440/tanda_f_concurrency \
 APPLICATION_DATABASE_URL=postgresql://postgres@127.0.0.1:55440/tanda_f_witness \
 DATABASE_URL=postgresql://postgres@127.0.0.1:55440/tanda_f_witness \
 DB_STATEMENT_TIMEOUT_MS=45000 DB_QUERY_TIMEOUT_MS=50000 \
 TANDA_F_ABONO_ONLY="${1:-0}" \
 timeout 360 node .local/tanda-f/concurrency-run.mjs