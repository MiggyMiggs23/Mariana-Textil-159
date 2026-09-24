#!/usr/bin/env bash
set -euo pipefail
umask 077
ROOT=/home/runner/workspace
R="$ROOT/.local/tanda-f"
SOURCE="$R/source"
PG=/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin
NODE="$(command -v node)"
COPY_URL=postgresql://postgres@127.0.0.1:55440/tanda_f_permissions
WITNESS_URL=postgresql://postgres@127.0.0.1:55440/tanda_f_witness
test "$("$PG/psql" -XAt "$COPY_URL" -c "select current_database()||'|'||current_setting('data_directory')||'|'||inet_server_port()")" = "tanda_f_permissions|$R/cluster|55440"
CLUSTER_PID="$(head -n1 "$R/cluster/postmaster.pid")"
tr '\0' ' ' <"/proc/$CLUSTER_PID/cmdline" | grep -F -- "$R/cluster" >/dev/null
cleanup() {
  trap - EXIT INT TERM
  test -z "${API_PID:-}" || kill "$API_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
(
  cd "$SOURCE/artifacts/api-server"
  exec env -i PATH="$(dirname "$NODE"):/usr/bin:/bin" HOME="$R" NODE_ENV=test PORT=43831 \
    REQUIRE_ISOLATED_TEST_DATABASE=1 TEST_DATABASE_URL="$COPY_URL" \
    APPLICATION_DATABASE_URL="$WITNESS_URL" DATABASE_URL="$WITNESS_URL" \
    ISOLATED_API_MODULE="$SOURCE/artifacts/api-server/dist/index.mjs" \
    SESSION_SECRET="$(cat "$R/session-secret")" "$NODE" "$SOURCE/api-runner.mjs"
) >"$R/permissions-api-runtime.log" 2>&1 &
API_PID=$!
echo "$API_PID" > "$R/permissions-api.pid"
for _ in $(seq 1 300); do
  kill -0 "$API_PID" 2>/dev/null || { echo 'Isolated permissions API exited.' >&2; exit 1; }
  curl -fsS --max-time 1 http://127.0.0.1:43831/api/healthz >/dev/null 2>&1 && break
  sleep .1
done
curl -fsS --max-time 2 http://127.0.0.1:43831/api/healthz >/dev/null
echo 'Permissions API ready at localhost:43831 (tanda_f_permissions only)'
wait "$API_PID"