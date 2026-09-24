#!/usr/bin/env bash
set -euo pipefail
R=/home/runner/workspace/.local/tanda-e-continuacion
PG=/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin
if test -f "$R/launcher.pid"; then
  pid="$(cat "$R/launcher.pid")"
  if [[ "$pid" =~ ^[0-9]+$ ]] && test -r "/proc/$pid/cmdline" &&
    tr '\0' ' ' <"/proc/$pid/cmdline" | grep -Fq 'reports/tanda-e-continuacion/launch-isolated.sh'; then
    kill "$pid"
    for _ in $(seq 1 100); do kill -0 "$pid" 2>/dev/null || break; sleep .1; done
  fi
fi
if test -f "$R/cluster/PG_VERSION"; then
  "$PG/pg_ctl" -D "$R/cluster" -m fast -w stop >/dev/null 2>&1 || true
fi
rm -rf -- "$R"
echo 'Only the private Tanda E continuation environment was removed; reports retained.'