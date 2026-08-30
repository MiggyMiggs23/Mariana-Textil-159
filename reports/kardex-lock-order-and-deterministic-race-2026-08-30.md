# Evidencia — orden de candados y carrera determinista del kardex

Fecha: 2026-08-30  
Base aislada: `loop_lock_validation`, dentro de la rama Neon desechable `br-misty-dream-axxzongq`.  
Base de development confirmada antes de operar: `heliumdb` (distinta de la base de prueba).

## Orden de candados en tickets

Se añadió `POS-LOCK`, que lanza dos tickets concurrentes con dos productos del
mismo sitio y orden de captura inverso.

Ejecución antes de corregir los bucles, sobre `8f1bad8` con solo la prueba sin
commit:

```text
✓ POS-LOCK: tickets inversos no se interbloquean por el orden de captura
POS/caja: 35 passed, 0 failed
```

Este resultado **no reprodujo** el `40P01`; por tanto fue no concluyente y no se
usó como prueba de que el código anterior fuera seguro. Después de la corrección,
POS volvió a pasar 35/35 y Salidas 7/7.

Auditoría del repositorio: además de POS y los dos bucles de Salidas, existe un
bucle en `lib/auditoria-inventario.ts` que puede llamar transferencias al resolver
sobrantes. Ese flujo bloquea previamente como conjunto los registros físicos de
rollos y cada rollo solo pertenece a la auditoría bloqueada; se reporta para
visibilidad, pero no fue uno de los tres bucles de documentos corregidos aquí.

## Carrera determinista contra el código anterior

Commit probado: `74e2b8f75a17c12175ab0b0a47138189e68856fd`, padre de
`f5306f1`.

Se creó un worktree temporal y se añadió únicamente la misma observación
inyectada después de leer el saldo; no se añadieron candados al código histórico.

Comando:

```sh
REQUIRE_ISOLATED_TEST_DATABASE=1 NODE_ENV=test \
TEST_DATABASE_URL=<rama-Neon-desechable> \
pnpm --filter @workspace/api-server exec tsx \
  src/lib/inventario-lock-barrier.test.ts
```

Resultado esperado y observado, código de salida 1:

```text
AssertionError [ERR_ASSERTION]:
La segunda transacción alcanzó la barrera: leyó el saldo antes de esperar el candado.

false !== true
```

Las dos transacciones alcanzaron el punto posterior a la lectura antes de liberar
la primera. Por eso la aserción `secondWasBlockedBeforeReading === true` falló de
forma controlada.

## Carrera determinista contra el código corregido

Commit probado: `e7c4cbf9ab91273c0743a4c67e68aa2fec8b338a`.

Comando:

```sh
TEST_DATABASE_URL=<rama-Neon-desechable> \
pnpm --filter @workspace/api-server run test:inventario-lock-barrier
```

Resultado, código de salida 0:

```text
PASS deterministic inventory lock barrier:
arrivals-before-release=1 timeout=2000ms
```

Durante los dos segundos de la barrera solo llegó la primera transacción. La
segunda permaneció antes de la lectura del saldo, esperando el advisory lock.
Al liberar la primera, los saldos observados fueron `2.000` y luego `1.000`; la
cadena persistida terminó en `0.000`.

## Verificación final

- Suite completa de inventario: 23/23, incluido T-LOCK; cleanup OK.
- `pnpm run typecheck` desde la raíz: aprobado.
- `pnpm run build` desde la raíz: aprobado.
- `tailwindcss-animate` quedó declarado directamente por `mariana-textil`;
  anteriormente el CSS lo usaba sin declararlo y el sandbox eliminado lo
  aportaba de forma transitiva.
