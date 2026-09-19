#!/usr/bin/env bash
set -euo pipefail
# No install, startup, SQL, application build, or candidate execution.
SOURCE=$(git rev-parse --show-toplevel)
E="$SOURCE/reports/e2-apertura-limitada/evidencia-a-c/validacion-offline-20260919"
BASELINE=80eaa93d4300e86d9be54492e634f88f0c0abc90
COPY=$(mktemp -d /tmp/e2-ac-baseline-80eaa93d-XXXXXX)
git -C "$SOURCE" archive "$BASELINE" | tar -x -C "$COPY"
node "$E/prepare-copy.mjs" "$SOURCE" "$COPY" > "$COPY/isolation.json"
# All workspace links point to COPY; compiler emissions remain in COPY.
# HOME and process environment do not inherit credentials or DB URLs.
set +e
(cd "$COPY" && env -i PATH="$COPY/node_modules/.bin:$PATH" HOME="$COPY" NODE_ENV=test pnpm run typecheck) > "$COPY/root-typecheck.log" 2>&1
status=$?
set -e
printf '%s\n' "$status" > "$COPY/root-typecheck.exit"
printf 'copy=%s\nroot_typecheck_exit=%s\n' "$COPY" "$status"
exit "$status"