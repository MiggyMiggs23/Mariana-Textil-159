#!/usr/bin/env bash
set -euo pipefail
: "${TEST_DATABASE_URL:?Owner URL for fresh continuation_return_test at private PG55536}"
: "${COMMERCIAL_RETURN_DISPOSABLE_SYSTEM_ID:?MAIN-pinned private cluster identity}"
[[ "${COMMERCIAL_RETURN_DISPOSABLE_ACK:-}" == NEW_PRIVATE_CLUSTER_ONLY ]] || {
  echo "Explicit private-cluster acknowledgement required" >&2; exit 1;
}
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"
pnpm --filter @workspace/api-server exec tsx ../../reports/devolucion-comercial/run-positive-rehearsal.ts