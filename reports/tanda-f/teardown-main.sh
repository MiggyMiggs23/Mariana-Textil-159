#!/usr/bin/env bash
set -euo pipefail
umask 077

# HISTÓRICO: MAIN ya completó y verificó el teardown. El entorno no existe.
# Este script se conserva como evidencia y no debe volver a ejecutarse.
printf 'teardown rechazado: Tanda F ya fue eliminada y verificada\n' >&2
exit 1

# Implementación histórica no alcanzable:
ROOT="${ROOT:-/home/runner/workspace}"
R="$ROOT/.local/tanda-f"
CLUSTER="$R/cluster"
EXPECTED_PORT=55440
PG_CTL=/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin/pg_ctl

die() { printf 'teardown rechazado: %s\n' "$*" >&2; exit 1; }

test "$(id -u)" != 0 || die "no debe ejecutarse como root"
test -d "$R" || die "no existe el árbol desechable esperado"
test -d "$CLUSTER" || die "no existe el cluster esperado"
test "$(realpath -e "$R")" = "$ROOT/.local/tanda-f" || die "ruta desechable inesperada"
test "$(realpath -e "$CLUSTER")" = "$ROOT/.local/tanda-f/cluster" || die "ruta de cluster inesperada"

is_owned_tanda_process() {
  local pid="$1" cmd cwd uid
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  test -r "/proc/$pid/status" || return 1
  uid="$(awk '/^Uid:/{print $2}' "/proc/$pid/status")"
  test "$uid" = "$(id -u)" || return 1
  cmd="$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null || true)"
  cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
  [[ "$cmd" == *"$R"* || "$cwd" == "$R" || "$cwd" == "$R/"* ]]
}

stop_pid() {
  local pid="$1"
  is_owned_tanda_process "$pid" || return 0
  kill -TERM "$pid" 2>/dev/null || true
  for _ in $(seq 1 50); do
    kill -0 "$pid" 2>/dev/null || return 0
    sleep .1
  done
  is_owned_tanda_process "$pid" || return 0
  kill -KILL "$pid" 2>/dev/null || true
}

# Solo PID files creados dentro del árbol de esta campaña.
while IFS= read -r -d '' pidfile; do
  pid="$(head -n1 "$pidfile" 2>/dev/null || true)"
  stop_pid "$pid"
done < <(find "$R" -xdev -path "$CLUSTER" -prune -o -type f -name '*.pid' -print0)

if test -s "$CLUSTER/postmaster.pid"; then
  postmaster_pid="$(head -n1 "$CLUSTER/postmaster.pid")"
  [[ "$postmaster_pid" =~ ^[0-9]+$ ]] || die "PID de postmaster inválido"
  test -r "/proc/$postmaster_pid/cmdline" || die "postmaster declarado no está disponible"
  test "$(awk '/^Uid:/{print $2}' "/proc/$postmaster_pid/status")" = "$(id -u)" || die "postmaster no pertenece al usuario actual"
  postmaster_cmd="$(tr '\0' ' ' <"/proc/$postmaster_pid/cmdline")"
  [[ "$postmaster_cmd" == *"$CLUSTER"* ]] || die "postmaster no apunta al cluster de Tanda F"
  test -f "$CLUSTER/postmaster.opts" || die "faltan opciones del postmaster"
  grep -Eq -- '(^|[[:space:]])-p[[:space:]]+55440([[:space:]]|$)' "$CLUSTER/postmaster.opts" ||
    die "el cluster no declara el puerto 55440"
  "$PG_CTL" -D "$CLUSTER" -m fast -w stop
fi

# Una segunda pasada recoge launchers/API/proxies propios que sobrevivieran al cluster.
while IFS= read -r procdir; do
  pid="${procdir##*/}"
  is_owned_tanda_process "$pid" && stop_pid "$pid"
done < <(find /proc -maxdepth 1 -type d -regex '/proc/[0-9]+' 2>/dev/null)

test ! -s "$CLUSTER/postmaster.pid" || die "el cluster sigue declarando un postmaster"

# Límite destructivo deliberado: solo activos creados bajo .local/tanda-f.
# No se buscan ni tocan dumps/backups preexistentes fuera de esta ruta.
rm -rf --one-file-system -- "$R"
test ! -e "$R" || die "no se pudo eliminar el árbol desechable"
printf 'teardown Tanda F completado: solo %s\n' "$R"