#!/usr/bin/env bash
# Candidate only. Invoke from workspace root. Not wired into any workflow.
package=reports/e2-paquete-liberacion-preparado-20260921
preflight_status=not_run
preflight_exit=
stage=release_hash_before
record_attempt() {
  node "$package/api-start-audit-record.mjs" "$$" "$stage" "$preflight_status" "$preflight_exit" "$1" ||
    printf '%s\n' 'WARNING: API start audit could not be appended; hash/preflight policy unchanged.' >&2
  return 0
}
trap 'rc=$?; record_attempt "$rc"' EXIT
verify_hashes() {
  test "$(sha256sum "$package/release-assets.sha256" | cut -d' ' -f1)" = 14e994f880f6e03b71e0566a40bfba38d8d445c5ff6d0f997d735c0b5d5219de || return 1
  sha256sum --check --status "$package/release-assets.sha256"
}
verify_hashes || exit 1
export API_INSPECTION_BOOT=1 NODE_ENV=development
stage=preflight
node "$package/release-preflight.mjs"
preflight_exit=$?
if [ "$preflight_exit" -ne 0 ]; then
  preflight_status=failed
  exit "$preflight_exit"
fi
preflight_status=passed
stage=release_hash_after
verify_hashes || exit 1
stage=exec_attempt
record_attempt 0
trap - EXIT
exec node --enable-source-maps artifacts/api-server/dist-e2-20260927/index.mjs