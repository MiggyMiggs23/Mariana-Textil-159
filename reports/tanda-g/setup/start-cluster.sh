#!/usr/bin/env bash
set -euo pipefail
R=/home/runner/workspace/.local/tanda-g
PG=/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin
if "$PG/pg_isready" -h 127.0.0.1 -p 55441 >/dev/null 2>&1; then
  test "$("$PG/psql" -XAt -h 127.0.0.1 -p 55441 -U postgres -d postgres -c "select current_setting('data_directory')")" = "$R/cluster"
  exit 0
fi
"$PG/pg_ctl" -D "$R/cluster" -l "$R/postgres-runtime.log" -o "-p 55441 -k $R/socket -h 127.0.0.1" -w start