#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."
out="reports/tanda-b-20260922/e4/logs/backend-types-$(date -u +%Y%m%dT%H%M%SZ).log"
mkdir -p "$(dirname "$out")"
# NoEmit + incremental false: no bundle, .tsbuildinfo, workflow, DB or server.
node --require ./reports/tanda-b-20260922/e4/offline-guard.cjs \
  ./node_modules/typescript/bin/tsc --noEmit --incremental false \
  --project artifacts/api-server/tsconfig.json 2>&1 | tee "$out"
echo "PASS: $out"