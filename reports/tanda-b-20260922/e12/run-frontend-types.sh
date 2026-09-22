#!/usr/bin/env bash
# MAIN ONLY. No app/tests/codegen; same accepted E4 native tsc protocol.
set -euo pipefail
cd "$(dirname "$0")/../../.."
nodebin="$(command -v node)"
scratch="$(mktemp -d /tmp/e12-frontend-types-XXXXXX)"
out="reports/tanda-b-20260922/e12/frontend-types-$(date -u +%Y%m%dT%H%M%SZ).log"
env -i PATH="$(dirname "$nodebin")" HOME="$scratch" TMPDIR="$scratch" \
  NODE_ENV=test LANG=C.UTF-8 TZ=UTC \
  "$nodebin" --require ./reports/tanda-b-20260922/e12/offline-guard.cjs \
  ./node_modules/typescript/bin/tsc --noEmit --incremental false \
  --project artifacts/mariana-textil/tsconfig.json 2>&1 | tee "$out"
echo "TYPECHECK_PASS: $out"