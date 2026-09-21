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
  test "$(sha256sum "$package/release-assets.sha256" | cut -d' ' -f1)" = 2f62ecdcd6e2127f8724e42fbb0a1e81205479219ed1ccd69eef7dc5f1798be1 || return 1
  sha256sum --check --status "$package/release-assets.sha256"
}
verify_hashes || exit 1
export API_INSPECTION_BOOT=1 NODE_ENV=development
stage=preflight
preflight_output=$(node "$package/release-preflight.mjs")
preflight_exit=$?
printf '%s\n' "$preflight_output"
if [ "$preflight_exit" -ne 0 ]; then
  preflight_status=failed
  exit "$preflight_exit"
fi
if ! printf '%s\n' "$preflight_output" | grep -q '^E2_COMPLETE_RELEASE_PREFLIGHT=PASS {'; then
  printf '%s\n' 'FATAL: preflight returned without positive verification proof.' >&2
  preflight_status=failed
  preflight_exit=1
  exit 1
fi
preflight_status=passed
stage=release_hash_after
verify_hashes || exit 1
stage=exec_attempt
record_attempt 0
trap - EXIT
exec node --enable-source-maps artifacts/api-server/dist-e2-20260927/index.mjs