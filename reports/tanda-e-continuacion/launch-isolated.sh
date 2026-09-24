#!/usr/bin/env bash
set -euo pipefail
umask 077
ROOT=/home/runner/workspace
R="$ROOT/.local/tanda-e-continuacion"
SOURCE="$R/source"
PG=/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin
NODE=/nix/store/9cyx2v23dip6p9q98384k9v06c96qskb-nodejs-24.13.0/bin/node
COPY_URL=postgresql://postgres@127.0.0.1:55439/tanda_e_continuacion_copy
WITNESS_URL=postgresql://postgres@127.0.0.1:55439/tanda_e_continuacion_witness
for file in "$R/cluster/PG_VERSION" "$R/credentials.json" "$R/session-secret" "$SOURCE/artifacts/api-server/dist/index.mjs" "$SOURCE/artifacts/mariana-textil/dist/public/index.html"; do
  test -f "$file" || { echo "Missing disposable prerequisite: $file" >&2; exit 1; }
done
if "$PG/pg_isready" -h 127.0.0.1 -p 55439 >/dev/null 2>&1; then
  echo 'Disposable port occupied; refusing reuse.' >&2; exit 1
fi
cleanup() {
  trap - EXIT INT TERM
  test -z "${PROXY_PID:-}" || kill "$PROXY_PID" 2>/dev/null || true
  test -z "${API_PID:-}" || kill "$API_PID" 2>/dev/null || true
  "$PG/pg_ctl" -D "$R/cluster" -m fast -w stop >/dev/null 2>&1 || true
  rm -f "$R/launcher.pid"
}
trap cleanup EXIT INT TERM
echo "$$" > "$R/launcher.pid"
"$PG/pg_ctl" -D "$R/cluster" -l "$R/postgres-runtime.log" -o "-p 55439 -k $R/socket -h 127.0.0.1" -w start >/dev/null
test "$("$PG/psql" -XAt "$COPY_URL" -c 'select current_database()')" = tanda_e_continuacion_copy
(
  cd "$SOURCE/artifacts/api-server"
  # Minimal environment: never inherit the real application database or secrets.
  exec env -i PATH="$(dirname "$NODE"):/usr/bin:/bin" HOME="$R" \
    NODE_ENV=test PORT=43821 REQUIRE_ISOLATED_TEST_DATABASE=1 \
    TEST_DATABASE_URL="$COPY_URL" APPLICATION_DATABASE_URL="$WITNESS_URL" DATABASE_URL="$WITNESS_URL" \
    ISOLATED_API_MODULE="$SOURCE/artifacts/api-server/dist/index.mjs" \
    SESSION_SECRET="$(cat "$R/session-secret")" \
    "$NODE" "$SOURCE/api-runner.mjs"
) >"$R/api-runtime.log" 2>&1 &
API_PID=$!
for _ in $(seq 1 300); do
  kill -0 "$API_PID" 2>/dev/null || { echo 'Private API failed; inspect private diagnostics.' >&2; exit 1; }
  curl -fsS --max-time 1 http://127.0.0.1:43821/api/healthz >/dev/null 2>&1 && break
  sleep .1
done
curl -fsS --max-time 2 http://127.0.0.1:43821/api/healthz >/dev/null
env -i PATH="$(dirname "$NODE"):/usr/bin:/bin" STATIC_ROOT="$SOURCE/artifacts/mariana-textil/dist/public" API_PORT=43821 PROXY_PORT=43820 \
  "$NODE" "$SOURCE/proxy.mjs" >"$R/proxy-runtime.log" 2>&1 &
PROXY_PID=$!
echo 'Disposable browser URL: http://127.0.0.1:43820/'
wait "$PROXY_PID"