#!/usr/bin/env bash
# MAIN ONLY. Native tsc parses frontend types; never starts app/tests/codegen.
set -euo pipefail
cd "$(dirname "$0")/../../.."
nodebin="$(command -v node)"
scratch="$(mktemp -d /tmp/e4-frontend-types-XXXXXX)"
out="reports/tanda-b-20260922/e4/frontend-types-$(date -u +%Y%m%dT%H%M%SZ).log"
# Same offline preload as the backend type-check command: no network/DB/children.
# tsc is invoked directly, not through package scripts. noEmit + incremental
# false prevent JS/declaration/.tsbuildinfo writes to app/workspace directories.
env -i PATH="$(dirname "$nodebin")" HOME="$scratch" TMPDIR="$scratch" \
  NODE_ENV=test LANG=C.UTF-8 TZ=UTC \
  "$nodebin" --require ./reports/tanda-b-20260922/e4/offline-guard.cjs \
  ./node_modules/typescript/bin/tsc --noEmit --incremental false \
  --project artifacts/mariana-textil/tsconfig.json 2>&1 | tee "$out"
echo "TYPECHECK_PASS: $out"