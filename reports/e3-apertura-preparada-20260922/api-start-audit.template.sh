#!/usr/bin/env bash
# Candidate E3 ordinary + cash only, NOT RELEASED. Invoke from workspace root. Not wired into a workflow.
package=reports/e3-apertura-preparada-20260922
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
  test "$(sha256sum "$package/release-assets.sha256" | cut -d' ' -f1)" = d724585b2ac42658c32de38bd95e96dfc95a881a95c1377566d06d3fe64133fe || return 1
  sha256sum --check --status "$package/release-assets.sha256"
}
verify_hashes || exit 1
export API_INSPECTION_BOOT=1 NODE_ENV=development
export E3_ENABLED=true E3_DIRECTED_ENABLED=false REMATE_RELEASED=false REMATE_UI_RELEASED=false
stage=preflight
preflight_output=$(node "$package/release-preflight.mjs")
preflight_exit=$?
printf '%s\n' "$preflight_output"
if [ "$preflight_exit" -ne 0 ]; then
  preflight_status=failed
  exit "$preflight_exit"
fi
if ! printf '%s\n' "$preflight_output" | grep -q '^E3_OPEN_RELEASE_PREFLIGHT=PASS {'; then
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
exec node --enable-source-maps /home/runner/workspace/artifacts/api-server/dist-e3-apertura-20260922/index.mjs