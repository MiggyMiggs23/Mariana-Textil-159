#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/runner/workspace
R="$ROOT/.local/tanda-e-20260923/tarea-1"
SOURCE="$R/source-38dff5e8"
PG=/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin

if test -f "$R/launcher.pid"; then
  pid="$(cat "$R/launcher.pid")"
  if [[ "$pid" =~ ^[0-9]+$ ]] && test -r "/proc/$pid/cmdline" &&
      tr '\0' ' ' <"/proc/$pid/cmdline" | grep -Fq "reports/tanda-e-20260923/tarea-1/launch-isolated.sh"; then
    kill "$pid"
    for _ in $(seq 1 100); do
      kill -0 "$pid" 2>/dev/null || break
      sleep .1
    done
  fi
fi

if test -d "$R/cluster"; then
  "$PG/pg_ctl" -D "$R/cluster" -m fast -w stop >/dev/null 2>&1 || true
fi

if git -C "$ROOT" worktree list --porcelain | grep -Fxq "worktree $SOURCE"; then
  git -C "$ROOT" worktree remove --force "$SOURCE"
fi
rm -rf -- "$R"
echo "Disposable Tanda E environment removed."