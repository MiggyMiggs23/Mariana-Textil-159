#!/usr/bin/env bash
#
# Operator-only disposable Phase 2/UI rehearsal.
#
# This helper never reads DATABASE_URL as a target.  Every database operation
# below uses the fixed local restore described by restore-metadata.json.  The
# API harness is deliberately separate from the normal API startup entrypoint:
# it imports app.ts, not index.ts, so startup initializers and background tasks
# cannot run as a side effect of this rehearsal.
#
# The helper leaves the disposable cluster running between commands.  Use
# "run" for a single foreground session that restores, rehearse-purges,
# prepares the synthetic actor, serves the API, and cleans up on exit.

set -Eeuo pipefail
umask 077

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
BACKUP="$ROOT/scripts/.local/backups/respaldo-antes-de-purga-2026-09-13-101833"
METADATA="$BACKUP/restore-metadata.json"
DUMP="$BACKUP/respaldo-antes-de-purga-2026-09-13-101833.dump"
RUNTIME="$ROOT/.local/phase2-ui-rehearsal"
OPS_LOG="$RUNTIME/orchestration.log"
API_PID_FILE="$RUNTIME/api.pid"
API_STATE_FILE="$RUNTIME/api-state.json"
FIXTURE_MANIFEST="$RUNTIME/fixture-manifest.json"
POSTPURGE_PROOF="$RUNTIME/phase2-disposable-postpurge-proof.json"
EXPECTED_PORT=44337
DEFAULT_API_PORT=43110
OPERATOR_ACK="DISPOSABLE_PHASE2_UI_REHEARSAL_AUTHORIZED"
PHASE2_REHEARSAL_ACK="REHEARSE_LISTS_A33_B7_C18_RESTORE"

mkdir -p "$RUNTIME"
chmod 700 "$RUNTIME"
touch "$OPS_LOG"
chmod 600 "$OPS_LOG"

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 2
}

usage() {
  cat >&2 <<'EOF'
Operator-only disposable Phase 2/UI rehearsal.

Required acknowledgement for mutating/serving commands:
  PHASE2_UI_OPERATOR_ACK=DISPOSABLE_PHASE2_UI_REHEARSAL_AUTHORIZED

Commands:
  restore       stop the disposable cluster, restore the pristine custom dump,
                start it on the fixed socket and port 44337, and leave it up
  start         start the already-rehearsed disposable cluster without
                restoring or rerunning Phase 2
  rehearse      invoke purge-operational-phase2.mts --rehearse against only
                restore-metadata.json's restored_database_url
  prepare       verify committed Phase 2 evidence, then insert only one new
                synthetic ADMIN and one session; credentials stay in the
                private fixture manifest
  serve         import app.ts without index.ts/startup initializers and serve
                 the real API only on 127.0.0.1:PHASE2_API_PORT (default
                 43110); it never routes through an existing API on :8080
  ticketprobe   after honest browser empty-UI checks, commit one real metered
                 ticket through the actual ticket helper at folio 1000 and
                 write the private proof (set PHASE2_EMPTY_UI_EVIDENCE_PATH)
  stop-api      stop only the foreground/background API harness
  stop          stop the API harness and disposable PostgreSQL cluster
  run           restore, rehearse, prepare, serve, and clean up on exit
  help          show this help

The frontend is not changed or started by this helper.  With the existing
frontend preview, use /login?returnTo=/; after login the ADMIN home route is /.
The disposable API's routes are /api/* and health is /api/healthz on the
explicit 43110 port.  The existing API :8080 is not a test route; the preview
must be pointed/proxied to 43110 by the operator without changing workflow
configuration.
EOF
}

require_ack() {
  [[ "${PHASE2_UI_OPERATOR_ACK:-}" == "$OPERATOR_ACK" ]] || die \
    "set PHASE2_UI_OPERATOR_ACK=$OPERATOR_ACK for this operator-only helper"
}

require_files() {
  [[ -f "$METADATA" ]] || die "restore metadata is missing"
  [[ -f "$DUMP" ]] || die "verified custom dump is missing"
  [[ -r "$METADATA" ]] || die "restore metadata is not readable"
  [[ -r "$DUMP" ]] || die "verified custom dump is not readable"
}

metadata_value() {
  local field="$1"
  node -e '
    const fs = require("node:fs");
    const metadata = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const field = process.argv[2];
    const value = metadata[field];
    if (typeof value !== "string" && typeof value !== "number") process.exit(2);
    process.stdout.write(String(value));
  ' "$METADATA" "$field"
}

load_metadata() {
  require_files
  CLUSTER_DIR="$(metadata_value cluster_directory)"
  SOCKET_DIR="$(metadata_value socket_directory)"
  RESTORE_DB="$(metadata_value database)"
  ADMIN_DB="$(metadata_value admin_database)"
  ADMIN_URL="$(metadata_value admin_url)"
  RESTORED_URL="$(metadata_value restored_database_url)"
  BINARY_DIR="$(metadata_value postgres_binary_directory)"
  METADATA_PORT="$(metadata_value port)"

  [[ "$METADATA_PORT" == "$EXPECTED_PORT" ]] || die \
    "restore metadata port is not the fixed disposable port"
  [[ "$BINARY_DIR" == "/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10" ]] || die \
    "restore metadata PostgreSQL binary directory is not the reviewed PostgreSQL 16.10 path"
  [[ "$CLUSTER_DIR" == "$BACKUP/restore-cluster-verified" ]] || die \
    "restore metadata cluster directory is not the reviewed disposable cluster"
  [[ "$SOCKET_DIR" == /tmp/respaldo-purge-2026-09-13-101833-* ]] || die \
    "restore metadata socket directory is not the reviewed private socket"
  [[ "$RESTORE_DB" =~ ^[A-Za-z0-9_-]+$ ]] || die "restore database name is invalid"
  [[ "$ADMIN_DB" =~ ^[A-Za-z0-9_-]+$ ]] || die "restore admin database name is invalid"
  [[ "$RESTORE_DB" != "$ADMIN_DB" ]] || die "restore and admin database names must differ"
  [[ -x "$BINARY_DIR/bin/pg_ctl" ]] || die "reviewed pg_ctl binary is unavailable"
  [[ -x "$BINARY_DIR/bin/pg_restore" ]] || die "reviewed pg_restore binary is unavailable"
  [[ -d "$CLUSTER_DIR" ]] || die "reviewed disposable cluster directory is missing"
}

api_port() {
  local value="${PHASE2_API_PORT:-$DEFAULT_API_PORT}"
  [[ "$value" =~ ^[0-9]+$ ]] || die "PHASE2_API_PORT must be an integer"
  (( value >= 1024 && value <= 65535 )) || die "PHASE2_API_PORT is outside the user-port range"
  [[ "$value" != "$EXPECTED_PORT" ]] || die "API port must be separate from PostgreSQL port 44337"
  printf '%s' "$value"
}

run_private() {
  local label="$1"
  shift
  if ! "$@" >>"$OPS_LOG" 2>&1; then
    die "$label failed; inspect the private log at .local/phase2-ui-rehearsal/orchestration.log"
  fi
}

capture_private() {
  local label="$1"
  shift
  local output
  if ! output="$("$@" 2>>"$OPS_LOG")"; then
    die "$label failed; inspect the private log at .local/phase2-ui-rehearsal/orchestration.log"
  fi
  printf '%s' "$output"
}

cluster_running() {
  "$BINARY_DIR/bin/pg_ctl" \
    --pgdata "$CLUSTER_DIR" \
    --silent \
    status >/dev/null 2>&1
}

stop_cluster_internal() {
  load_metadata
  if cluster_running; then
    run_private "pg_ctl stop" "$BINARY_DIR/bin/pg_ctl" \
      --pgdata "$CLUSTER_DIR" \
      --mode fast \
      --wait \
      --timeout 120 \
      stop
  fi
  # Remove only this helper's known private socket directory, and only after
  # pg_ctl confirmed the cluster is stopped.
  if [[ "$SOCKET_DIR" == /tmp/respaldo-purge-2026-09-13-101833-* ]]; then
    rm -rf -- "$SOCKET_DIR"
  fi
}

start_cluster_internal() {
  load_metadata
  if cluster_running; then
    die "disposable cluster is already running; use restore to reset it first"
  fi
  mkdir -p "$SOCKET_DIR"
  chmod 700 "$SOCKET_DIR"
  local postgres_log="$RUNTIME/postgres-44337.log"
  chmod 600 "$postgres_log" 2>/dev/null || true
  run_private "pg_ctl start" "$BINARY_DIR/bin/pg_ctl" \
    --pgdata "$CLUSTER_DIR" \
    --wait \
    --timeout 120 \
    --log "$postgres_log" \
    --options "-p $EXPECTED_PORT -k $SOCKET_DIR -h 127.0.0.1" \
    start
}

verify_cluster_identity() {
  load_metadata
  cluster_running || die "disposable cluster is not running"
  local identity
  identity="$(capture_private "PostgreSQL identity check" \
    "$BINARY_DIR/bin/psql" \
    --no-psqlrc \
    --no-password \
    --dbname "$RESTORED_URL" \
    --tuples-only \
    --no-align \
    --command "SELECT current_database() || '|' || inet_server_port() || '|' || split_part(current_setting('server_version'), '.', 1);")"
  [[ "$identity" == "$RESTORE_DB|$EXPECTED_PORT|16" ]] || die \
    "same-runtime PostgreSQL identity check failed"
}

verify_admin_cluster_identity() {
  load_metadata
  cluster_running || die "disposable cluster is not running"
  local identity
  identity="$(capture_private "PostgreSQL admin identity check" \
    "$BINARY_DIR/bin/psql" \
    --no-psqlrc \
    --no-password \
    --dbname "$ADMIN_URL" \
    --tuples-only \
    --no-align \
    --command "SELECT current_database() || '|' || inet_server_port() || '|' || split_part(current_setting('server_version'), '.', 1);")"
  [[ "$identity" == "$ADMIN_DB|$EXPECTED_PORT|16" ]] || die \
    "same-runtime PostgreSQL admin identity check failed"
}

drop_restore_databases() {
  # Database names have already been restricted to safe identifier characters;
  # quote them for SQL regardless.
  local restore_quoted admin_quoted
  restore_quoted="${RESTORE_DB//\"/\"\"}"
  admin_quoted="${ADMIN_DB//\"/\"\"}"
  run_private "drop stale disposable databases" \
    "$BINARY_DIR/bin/psql" \
    --no-psqlrc \
    --no-password \
    --dbname "$ADMIN_URL" \
    --set ON_ERROR_STOP=1 \
    --command "DROP DATABASE IF EXISTS \"$restore_quoted\" WITH (FORCE);" \
    --command 'DROP DATABASE IF EXISTS "heliumdb" WITH (FORCE);'
  # The archive creates heliumdb.  It is renamed to the reviewed fixed restore
  # name only after pg_restore completes.
  : "$admin_quoted"
}

restore_pristine() {
  require_ack
  load_metadata
  stop_api
  rm -f -- "$FIXTURE_MANIFEST" "$API_STATE_FILE" "$API_PID_FILE"
  stop_cluster_internal
  start_cluster_internal
  verify_admin_cluster_identity
  drop_restore_databases
  run_private "pg_restore pristine custom dump" \
    "$BINARY_DIR/bin/pg_restore" \
    --create \
    --exit-on-error \
    --dbname "$ADMIN_URL" \
    "$DUMP"
  local restore_quoted
  restore_quoted="${RESTORE_DB//\"/\"\"}"
  run_private "rename restored database" \
    "$BINARY_DIR/bin/psql" \
    --no-psqlrc \
    --no-password \
    --dbname "$ADMIN_URL" \
    --set ON_ERROR_STOP=1 \
    --command "ALTER DATABASE \"heliumdb\" RENAME TO \"$restore_quoted\";"
  verify_cluster_identity
  printf 'PASS: pristine disposable restore is running on PostgreSQL port %s.\n' "$EXPECTED_PORT"
}

run_phase2_rehearsal() {
  require_ack
  load_metadata
  verify_cluster_identity
  local log="$RUNTIME/phase2-rehearse.log"
  : >"$log"
  chmod 600 "$log"
  # DATABASE_URL is removed rather than overwritten.  The phase2 script must
  # accept exactly the URL from restore-metadata.json as TEST_DATABASE_URL.
  if ! env -u DATABASE_URL -u TEST_DATABASE_URL -u APPLICATION_DATABASE_URL \
    NODE_ENV=test \
    PHASE2_REHEARSAL=1 \
    REQUIRE_PHASE2_AUTHORIZATION="$PHASE2_REHEARSAL_ACK" \
    TEST_DATABASE_URL="$RESTORED_URL" \
    pnpm --filter @workspace/scripts exec tsx \
      src/purge-operational-phase2.mts --rehearse >>"$log" 2>&1; then
    die "phase2 --rehearse failed; inspect the private log at .local/phase2-ui-rehearsal/phase2-rehearse.log"
  fi
  printf 'PASS: Phase 2 rehearsal completed; private evidence remains under .local.\n'
}

start_rehearsed_cluster() {
  require_ack
  load_metadata
  start_cluster_internal
  verify_cluster_identity
  printf 'PASS: existing rehearsed disposable cluster started on PostgreSQL port %s; no restore/rehearse was run.\n' "$EXPECTED_PORT"
}

prepare_fixture() {
  require_ack
  load_metadata
  verify_cluster_identity
  local log="$RUNTIME/prepare.log"
  : >"$log"
  chmod 600 "$log"
  if ! env -u DATABASE_URL \
    NODE_ENV=test \
    REQUIRE_ISOLATED_TEST_DATABASE=1 \
    TEST_DATABASE_URL="$RESTORED_URL" \
    APPLICATION_DATABASE_URL="$ADMIN_URL" \
    PHASE2_UI_OPERATOR_ACK="$OPERATOR_ACK" \
    pnpm --filter @workspace/scripts exec tsx \
      src/disposable-phase2-ui-harness.mts prepare >>"$log" 2>&1; then
    die "synthetic fixture preparation failed; inspect the private log at .local/phase2-ui-rehearsal/prepare.log"
  fi
  printf 'PASS: synthetic ADMIN/session prepared; credentials are only in the private fixture manifest.\n'
}

ticket_probe() {
  require_ack
  load_metadata
  verify_cluster_identity
  [[ -f "$FIXTURE_MANIFEST" ]] || die \
    "private fixture manifest is missing; run prepare before browser checks"
  local browser_evidence="${PHASE2_EMPTY_UI_EVIDENCE_PATH:-}"
  [[ -n "$browser_evidence" ]] || die \
    "set PHASE2_EMPTY_UI_EVIDENCE_PATH to the honest browser empty-UI evidence file"
  [[ -f "$ROOT/$browser_evidence" || -f "$browser_evidence" ]] || die \
    "browser empty-UI evidence file is missing"
  local log="$RUNTIME/ticketprobe.log"
  : >"$log"
  chmod 600 "$log"
  if ! env -u DATABASE_URL \
    NODE_ENV=test \
    REQUIRE_ISOLATED_TEST_DATABASE=1 \
    TEST_DATABASE_URL="$RESTORED_URL" \
    APPLICATION_DATABASE_URL="$ADMIN_URL" \
    PHASE2_EMPTY_UI_EVIDENCE_PATH="$browser_evidence" \
    PHASE2_UI_OPERATOR_ACK="$OPERATOR_ACK" \
    pnpm --filter @workspace/scripts exec tsx \
      src/disposable-phase2-ui-harness.mts ticketprobe >>"$log" 2>&1; then
    die "ticket probe failed; inspect the private log at .local/phase2-ui-rehearsal/ticketprobe.log"
  fi
  local proof_sha
  proof_sha="$(sha256sum "$POSTPURGE_PROOF" | awk '{print $1}')"
  printf 'PASS: committed folio-1000 proof is private at .local/phase2-ui-rehearsal/phase2-disposable-postpurge-proof.json.\n'
  printf 'Use PHASE2_DISPOSABLE_PROOF_PATH=.local/phase2-ui-rehearsal/phase2-disposable-postpurge-proof.json and PHASE2_DISPOSABLE_PROOF_SHA256=%s for reviewed apply.\n' "$proof_sha"
}

serve_api() {
  require_ack
  load_metadata
  verify_cluster_identity
  [[ -f "$FIXTURE_MANIFEST" ]] || die \
    "private fixture manifest is missing; run prepare after the committed rehearsal"
  local port
  port="$(api_port)"
  local log="$RUNTIME/api.log"
  : >"$log"
  chmod 600 "$log"
  printf 'Starting actual API harness on internal port %s; logs are private.\n' "$port"
  env -u DATABASE_URL \
    NODE_ENV=test \
    REQUIRE_ISOLATED_TEST_DATABASE=1 \
    TEST_DATABASE_URL="$RESTORED_URL" \
    APPLICATION_DATABASE_URL="$ADMIN_URL" \
    PHASE2_API_PORT="$port" \
    PHASE2_UI_OPERATOR_ACK="$OPERATOR_ACK" \
    pnpm --filter @workspace/scripts exec tsx \
      src/disposable-phase2-ui-harness.mts serve >>"$log" 2>&1
}

stop_api() {
  if [[ -s "$API_PID_FILE" ]]; then
    local pid
    pid="$(node -e 'try { const value = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")); const pid = typeof value === "number" ? value : value.pid; if (Number.isSafeInteger(pid) && pid > 0) process.stdout.write(String(pid)); } catch {}' "$API_PID_FILE")"
    local command_line=""
    if [[ "$pid" =~ ^[0-9]+$ ]] && [[ -r "/proc/$pid/cmdline" ]]; then
      command_line="$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null || true)"
    fi
    if [[ "$pid" =~ ^[0-9]+$ ]] &&
      [[ "$command_line" == *"disposable-phase2-ui-harness.mts"* ]] &&
      kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null || true
      for _ in $(seq 1 50); do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.1
      done
      kill -KILL "$pid" 2>/dev/null || true
    fi
  fi
  rm -f -- "$API_PID_FILE" "$API_STATE_FILE"
}

stop_all() {
  require_ack
  stop_api
  stop_cluster_internal
  rm -f -- "$FIXTURE_MANIFEST"
  printf 'PASS: API harness and disposable PostgreSQL cluster stopped; private fixture removed.\n'
}

run_all() {
  require_ack
  trap 'stop_api >/dev/null 2>&1 || true; stop_cluster_internal >/dev/null 2>&1 || true; rm -f -- "$FIXTURE_MANIFEST"' EXIT INT TERM
  restore_pristine
  run_phase2_rehearsal
  prepare_fixture
  serve_api
}

command="${1:-help}"
case "$command" in
  restore)
    # A failed restore must not leave a half-restored cluster running.  On
    # success the trap is removed so the operator can continue with rehearse.
    cleanup_restore_failure() {
      local status=$?
      if (( status != 0 )); then
        stop_cluster_internal >/dev/null 2>&1 || true
      fi
      return "$status"
    }
    trap cleanup_restore_failure EXIT
    restore_pristine
    trap - EXIT
    ;;
  start)
    start_rehearsed_cluster
    ;;
  rehearse)
    run_phase2_rehearsal
    ;;
  prepare)
    prepare_fixture
    ;;
  ticketprobe)
    ticket_probe
    ;;
  serve)
    serve_api
    ;;
  stop-api)
    stop_api
    printf 'PASS: API harness stop requested.\n'
    ;;
  stop|down)
    stop_all
    ;;
  run)
    run_all
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    usage
    die "unknown command: $command"
    ;;
esac