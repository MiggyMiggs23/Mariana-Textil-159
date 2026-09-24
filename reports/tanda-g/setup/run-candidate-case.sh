#!/usr/bin/env bash
set -euo pipefail
cd /home/runner/workspace
case "${1:-}" in 1|2|4|5|6|7|8|9) ;; *) exit 2;; esac
NODE="$(command -v node)"
exec env -i PATH="$(dirname "$NODE"):/usr/bin:/bin" HOME=/home/runner/workspace/.local/tanda-g \
 NODE_ENV=test REQUIRE_ISOLATED_TEST_DATABASE=1 \
 TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55441/tanda_g_candidate \
 APPLICATION_DATABASE_URL=postgresql://postgres@127.0.0.1:55441/tanda_g_witness \
 DATABASE_URL=postgresql://postgres@127.0.0.1:55441/tanda_g_witness \
 "$NODE" .local/tanda-g/candidate-run.mjs "$@"