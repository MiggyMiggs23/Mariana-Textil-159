#!/usr/bin/env bash
set -euo pipefail
cd /home/runner/workspace
case "${1:-}" in 1|2|3|4|5|6|7|8|9|10) ;; *) exit 2;; esac
export NODE_ENV=test REQUIRE_ISOLATED_TEST_DATABASE=1
export TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55440/tanda_f_reversal
export APPLICATION_DATABASE_URL=postgresql://postgres@127.0.0.1:55440/tanda_f_witness
export DATABASE_URL="$APPLICATION_DATABASE_URL"
timeout 720 artifacts/api-server/node_modules/.bin/tsx reports/tanda-f/tarea-5/run.ts "$1"