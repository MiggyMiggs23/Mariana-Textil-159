#!/usr/bin/env bash
set -euo pipefail
umask 077
ROOT=/home/runner/workspace
R="$ROOT/.local/tanda-g"
# MAIN may pass candidate's compiled UI directory explicitly.
STATIC_ROOT="${1:-$R/baseline-source/artifacts/mariana-textil/dist/public}"
case "$STATIC_ROOT" in "$R"/*|"$ROOT/.local/tanda-g-ui-candidate") ;; *) echo "Private UI required" >&2; exit 1;; esac
test -f "$STATIC_ROOT/index.html"
NODE="$(command -v node)"
echo "$$" > "$R/proxy.pid"
exec env -i PATH="$(dirname "$NODE"):/usr/bin:/bin" STATIC_ROOT="$STATIC_ROOT" \
 API_PORT=43843 PROXY_PORT=43840 "$NODE" \
 "$ROOT/reports/tanda-e-20260923/tarea-1/proxy.mjs"