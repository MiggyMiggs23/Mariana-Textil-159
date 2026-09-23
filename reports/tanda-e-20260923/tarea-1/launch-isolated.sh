#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT=/home/runner/workspace
R="$ROOT/.local/tanda-e-20260923/tarea-1"
SOURCE="$R/source-38dff5e8"
PG=/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin
NODE=/nix/store/s7awkfc4pym4zj139fsxrjs5xwf5hhnd-nodejs-24.13.0-wrapped/bin/node
CURL=/nix/store/s39027q39rd1qzi2m6cmf455kljn6l7p-replit-runtime-path/bin/curl
COPY_URL=postgresql://postgres@127.0.0.1:55439/tanda_e_e2e_copy
WITNESS_URL=postgresql://postgres@127.0.0.1:55439/tanda_e_app_witness
API_PORT=43821
PROXY_PORT=43820

for required in \
  "$R/cluster/PG_VERSION" \
  "$R/credentials.json" \
  "$R/session-secret" \
  "$SOURCE/artifacts/api-server/dist/index.mjs" \
  "$SOURCE/artifacts/mariana-textil/dist/public/index.html"; do
  test -e "$required" || { echo "Missing isolated prerequisite: $required" >&2; exit 1; }
done

if "$PG/pg_isready" -h 127.0.0.1 -p 55439 -d postgres -U postgres >/dev/null 2>&1; then
  echo "Port 55439 is already occupied; refusing ambiguous database reuse." >&2
  exit 1
fi

cleanup() {
  trap - EXIT INT TERM
  test -n "${PROXY_PID:-}" && kill "$PROXY_PID" 2>/dev/null || true
  test -n "${API_PID:-}" && kill "$API_PID" 2>/dev/null || true
  test -n "${PROXY_PID:-}" && wait "$PROXY_PID" 2>/dev/null || true
  test -n "${API_PID:-}" && wait "$API_PID" 2>/dev/null || true
  "$PG/pg_ctl" -D "$R/cluster" -m fast -w stop >/dev/null 2>&1 || true
  rm -f "$R/launcher.pid" "$R/api.pid" "$R/proxy.pid"
}
trap cleanup EXIT INT TERM

echo "$$" > "$R/launcher.pid"
"$PG/pg_ctl" -D "$R/cluster" -l "$R/postgres-runtime.log" \
  -o "-p 55439 -k $R/socket -h 127.0.0.1" -w start >/dev/null

actual="$("$PG/psql" --no-psqlrc --dbname "$COPY_URL" --tuples-only --no-align \
  --set ON_ERROR_STOP=1 --command "SELECT current_database()")"
test "$actual" = tanda_e_e2e_copy || {
  echo "Disposable database identity mismatch." >&2
  exit 1
}

(
  cd "$SOURCE/artifacts/api-server"
  export NODE_ENV=test
  export PORT="$API_PORT"
  export REQUIRE_ISOLATED_TEST_DATABASE=1
  export TEST_DATABASE_URL="$COPY_URL"
  export APPLICATION_DATABASE_URL="$WITNESS_URL"
  export DATABASE_URL="$WITNESS_URL"
  export ISOLATED_API_MODULE="$SOURCE/artifacts/api-server/dist/index.mjs"
  export SESSION_SECRET
  SESSION_SECRET="$(cat "$R/session-secret")"
  # The bundle intentionally does not auto-listen under NODE_ENV=test. Import
  # it under the database guard, then invoke its exported server entrypoint.
  exec "$NODE" --enable-source-maps \
    "$ROOT/reports/tanda-e-20260923/tarea-1/api-runner.mjs"
) >"$R/api-runtime.log" 2>&1 &
API_PID=$!
echo "$API_PID" > "$R/api.pid"

for _ in $(seq 1 300); do
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "Isolated API exited before becoming ready; inspect $R/api-runtime.log privately." >&2
    exit 1
  fi
  "$CURL" --fail --silent --max-time 1 "http://127.0.0.1:$API_PORT/api/healthz" >/dev/null 2>&1 && break
  sleep .1
done
"$CURL" --fail --silent --max-time 2 "http://127.0.0.1:$API_PORT/api/healthz" >/dev/null

STATIC_ROOT="$SOURCE/artifacts/mariana-textil/dist/public" \
API_PORT="$API_PORT" PROXY_PORT="$PROXY_PORT" \
"$NODE" "$ROOT/reports/tanda-e-20260923/tarea-1/proxy.mjs" \
  >"$R/proxy-runtime.log" 2>&1 &
PROXY_PID=$!
echo "$PROXY_PID" > "$R/proxy.pid"

for _ in $(seq 1 100); do
  "$CURL" --fail --silent --max-time 1 "http://127.0.0.1:$PROXY_PORT/" >/dev/null 2>&1 && break
  sleep .1
done
"$CURL" --fail --silent --max-time 2 "http://127.0.0.1:$PROXY_PORT/" >/dev/null
echo "Isolated Tanda E browser target: http://127.0.0.1:$PROXY_PORT/"
wait "$PROXY_PID"