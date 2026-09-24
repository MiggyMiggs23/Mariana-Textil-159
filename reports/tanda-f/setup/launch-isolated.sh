#!/usr/bin/env bash
set -euo pipefail
umask 077
ROOT=/home/runner/workspace
R="$ROOT/.local/tanda-f"
SOURCE="$R/source"
PG=/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin
NODE="$(command -v node)"
COPY_URL=postgresql://postgres@127.0.0.1:55440/tanda_f_browser
WITNESS_URL=postgresql://postgres@127.0.0.1:55440/tanda_f_witness
if "$PG/pg_isready" -h 127.0.0.1 -p 55440 >/dev/null 2>&1; then
  echo 'Private port occupied; MAIN must coordinate shared cluster lifecycle.' >&2; exit 1
fi
cleanup() {
  trap - EXIT INT TERM
  test -z "${PROXY_PID:-}" || kill "$PROXY_PID" 2>/dev/null || true
  test -z "${API_PID:-}" || kill "$API_PID" 2>/dev/null || true
  # Cluster serves independent workers too. MAIN stops it after all workers finish.
}
trap cleanup EXIT INT TERM
echo "$$" > "$R/launcher.pid"
"$PG/pg_ctl" -D "$R/cluster" -l "$R/postgres-runtime.log" -o "-p 55440 -k $R/socket -h 127.0.0.1" -w start >/dev/null
test "$("$PG/psql" -XAt "$COPY_URL" -c "select current_database()||'|'||current_setting('data_directory')")" = "tanda_f_browser|$R/cluster"
(
  cd "$SOURCE/artifacts/api-server"
  exec env -i PATH="$(dirname "$NODE"):/usr/bin:/bin" HOME="$R" NODE_ENV=test PORT=43821 \
    REQUIRE_ISOLATED_TEST_DATABASE=1 TEST_DATABASE_URL="$COPY_URL" \
    APPLICATION_DATABASE_URL="$WITNESS_URL" DATABASE_URL="$WITNESS_URL" \
    ISOLATED_API_MODULE="$SOURCE/artifacts/api-server/dist/index.mjs" \
    SESSION_SECRET="$(cat "$R/session-secret")" "$NODE" "$SOURCE/api-runner.mjs"
) >"$R/api-runtime.log" 2>&1 &
API_PID=$!
echo "$API_PID" > "$R/api.pid"
for _ in $(seq 1 300); do
  kill -0 "$API_PID" 2>/dev/null || { echo 'Private API failed; inspect private diagnostics.' >&2; exit 1; }
  curl -fsS --max-time 1 http://127.0.0.1:43821/api/healthz >/dev/null 2>&1 && break
  sleep .1
done
curl -fsS --max-time 2 http://127.0.0.1:43821/api/healthz >/dev/null
env -i PATH="$(dirname "$NODE"):/usr/bin:/bin" STATIC_ROOT="$SOURCE/artifacts/mariana-textil/dist" API_PORT=43821 PROXY_PORT=43820 \
  "$NODE" "$SOURCE/proxy.mjs" >"$R/proxy-runtime.log" 2>&1 &
PROXY_PID=$!
echo "$PROXY_PID" > "$R/proxy.pid"
echo 'Disposable browser URL: http://127.0.0.1:43820/'
wait "$PROXY_PID"