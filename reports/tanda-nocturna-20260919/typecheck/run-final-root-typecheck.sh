#!/usr/bin/env bash
set -euo pipefail

# Run only after the owner declares all source tasks frozen at an exact Git revision.
# This script performs no install, build, SQL/DB/API/network operation, or active-tree typecheck.
SOURCE=$(git rev-parse --show-toplevel)
REPORT="$SOURCE/reports/tanda-nocturna-20260919/typecheck"
REQUESTED=${1:?usage: run-final-root-typecheck.sh EXACT_REVISION}
LABEL=${2:-final}
case "$LABEL" in
  baseline|final) ;;
  *) printf 'label must be baseline or final\n' >&2; exit 2 ;;
esac
REVISION=$(git -C "$SOURCE" rev-parse --verify "${REQUESTED}^{commit}")
COPY=$(mktemp -d "/tmp/night5-root-typecheck-${REVISION:0:12}-XXXXXX")

git -C "$SOURCE" archive "$REVISION" | tar -x -C "$COPY"
node "$REPORT/prepare-isolated-copy.mjs" "$SOURCE" "$COPY" > "$REPORT/$LABEL-isolation.json"

printf '%s\n' "$REVISION" > "$REPORT/$LABEL-revision.txt"
printf '%s\n' "$COPY" > "$REPORT/$LABEL-temp-root.txt"
{
  printf 'node_version=%s\n' "$(node --version)"
  printf 'node_path=%s\n' "$(command -v node)"
  printf 'pnpm_version=%s\n' "$(pnpm --version)"
  printf 'pnpm_path=%s\n' "$(command -v pnpm)"
  printf 'typescript_version=%s\n' "$("$SOURCE/node_modules/.bin/tsc" --version)"
  sha256sum \
    "$SOURCE/node_modules/typescript/bin/tsc" \
    "$SOURCE/pnpm-lock.yaml" \
    "$SOURCE/pnpm-workspace.yaml" \
    "$SOURCE/scripts/src/typecheck-runner.mjs"
} > "$REPORT/$LABEL-toolchain.txt"

PNPM_DIR=$(dirname "$(command -v pnpm)")
NODE_DIR=$(dirname "$(command -v node)")
set +e
(
  cd "$COPY"
  env -i \
    PATH="$COPY/node_modules/.bin:$PNPM_DIR:$NODE_DIR:/usr/bin:/bin" \
    HOME="$COPY" \
    NODE_ENV=test \
    CI=1 \
    pnpm run typecheck
) > "$REPORT/$LABEL-root-typecheck.log" 2>&1
status=$?
set -e
printf '%s\n' "$status" > "$REPORT/$LABEL-root-typecheck.exit"

node "$REPORT/analyze-typecheck.mjs" \
  "$REPORT/$LABEL-root-typecheck.log" \
  "$REPORT/$LABEL-root-typecheck.exit" \
  "$REPORT/$LABEL-summary.json" \
  "$REVISION"

printf 'revision=%s\ncopy=%s\nexit=%s\nsummary=%s\n' \
  "$REVISION" "$COPY" "$status" "$REPORT/$LABEL-summary.json"
exit "$status"