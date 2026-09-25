#!/usr/bin/env bash
set -euo pipefail
# MAIN-only. This script was not executed by the implementation worker.
: "${TEST_DATABASE_URL:?Explicit newly-created disposable database URL required}"
: "${COMMERCIAL_RETURN_DISPOSABLE_SYSTEM_ID:?MAIN must pin the new private cluster system identifier}"
if [[ "${COMMERCIAL_RETURN_DISPOSABLE_ACK:-}" != "NEW_PRIVATE_CLUSTER_ONLY" ]]; then
  echo "Refusing: explicit disposable acknowledgement required" >&2
  exit 1
fi
name="$(psql -XAt "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'SELECT current_database()')"
case "$name" in test_*|disposable_*|continuation_*) ;; *) echo "Refusing non-disposable database name" >&2; exit 1;; esac
identity="$(psql -XAt "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'SELECT system_identifier FROM pg_control_system()')"
[[ "$identity" == "$COMMERCIAL_RETURN_DISPOSABLE_SYSTEM_ID" ]] || { echo "Wrong cluster identity" >&2; exit 1; }
base="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
sha256sum "$base"/00-enum.sql "$base"/01-schema.sql "$base"/01b-financial-integrity.sql "$base"/02-rehearsal-closed.sql
psql -X "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$base/00-enum.sql"
psql -X "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$base/01-schema.sql"
psql -X "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$base/01b-financial-integrity.sql"
psql -X "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$base/02-rehearsal-closed.sql"
echo "CLOSED installation/direct-write rehearsal completed. Positive financial/concurrency rehearsal still required."