#!/usr/bin/env bash
# Not wired to the workflow. Run from workspace root; no build or DB calls here.
# Keep the original guard order, exported modes, preflight output and exec intact.
preflight_status=not_run
preflight_exit=
stage=preflight_hash
record_attempt() {
  node scripts/api-start-audit-record.mjs "$$" "$stage" "$preflight_status" "$preflight_exit" "$1" ||
    printf '%s\n' 'WARNING: API start audit could not be appended; startup policy unchanged.' >&2
  return 0
}
trap 'rc=$?; record_attempt "$rc"' EXIT

test "$(sha256sum reports/e2-apertura-limitada/reconstruccion/runtime-preflight.mjs | cut -d' ' -f1)" = 9a87b47b52d3776b10d760bdab6b9f5e71158f75ef71921ec8adbb3e0585de9f || exit $?
stage=bundle_hash_before
test "$(sha256sum artifacts/api-server/dist/index.mjs | cut -d' ' -f1)" = 3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98 || exit $?
export API_INSPECTION_BOOT=1 NODE_ENV=development
stage=preflight
node reports/e2-apertura-limitada/reconstruccion/runtime-preflight.mjs
preflight_exit=$?
if [ "$preflight_exit" -ne 0 ]; then
  preflight_status=failed
  exit "$preflight_exit"
fi
preflight_status=passed
stage=bundle_hash_after
test "$(sha256sum artifacts/api-server/dist/index.mjs | cut -d' ' -f1)" = 3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98 || exit $?
stage=exec_attempt
record_attempt 0
trap - EXIT
exec node --enable-source-maps artifacts/api-server/dist/index.mjs