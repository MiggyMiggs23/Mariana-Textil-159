# Evidencia — cierre de candados de inventario

Fecha: 2026-08-30  
Base final aislada: `test_task69_receive_revalidation`, dentro de la rama Neon
desechable `br-sweet-base-ax7qfxbg`.
Base de development confirmada: `heliumdb`; ambas identidades fueron distintas
antes de cada operación con datos.

## Recepciones concurrentes

Se añadieron dos recepciones simultáneas hacia destinos distintos. Ambas salidas
comparten dos productos y guardan sus rollos en orden inverso.

Antes de agregar el par de tránsito, la prueba terminó sin `40P01`. Ese resultado
es **no concluyente**: la sincronía casual no demuestra que el código anterior
fuera seguro.

Después de la corrección, el bloqueo previo toma para cada rollo:

- `{producto, rollos.ubicacion_id}`, leído de la fila y no deducido;
- `{producto, salida.destino_id}`.

Después del prebloqueo, la recepción vuelve a leer producto, ubicación y estado
sin candados de fila. Si algún candidato difiere o dejó de estar
`EN_TRANSITO`, aborta con `INVENTORY_CHANGED_RETRY` antes de llamar al motor.
Solo el conjunto estable se toma con `FOR UPDATE` y se verifica una vez más.

La barrera determinista pausa una recepción justo después de la primera lectura,
mueve el rollo concurrentemente hacia otra ubicación y después libera la
recepción. Se comprobó que la salida permanece `EN_TRANSITO`, no existe
recepción parcial y la operación termina con el error controlado, sin adquirir
un par nuevo dentro del ciclo.

Resultado final:

```text
SALIDAS-LOCK: recepciones inversas a destinos distintos no se interbloquean
tests 9
pass 9
fail 0
```

## Lista definitiva de bucles

La lista revisada vive en `docs/inventory-engine-lock-loops.md` y está protegida
por `inventory-lock-loops.contract.test.ts`.

Se corrigieron los huecos de:

- cancelación de tickets;
- salida directa a mostrador;
- faltantes de auditoría;
- sobrantes de auditoría.

La confirmación de auditoría lee primero todos los faltantes, mal acomodados y
sobrantes. Una sola llamada bloquea el conjunto global: pares actuales de
faltantes/mal acomodados y origen real + destino auditado de sobrantes. Después
se vuelven a leer los candidatos **sin** `FOR UPDATE`. Solo el subconjunto cuyo
producto, ubicación y estado siguen iguales toma candados de fila; los demás
quedan para resolución manual sin bloquear su rollo. Así, una lectura obsoleta
no puede recrear una inversión entre candados consultivos y de fila.

La prueba determinista de auditoría mantiene un par consultivo desde una
transacción, observa en `pg_stat_activity` que la confirmación espera ese
candado y comprueba que la transacción dueña todavía puede bloquear y cambiar
el rollo antes de liberar el par. La relectura posterior conserva ambos cambios
como resolución manual.

Los dos handlers señalados en `routes/inventario.ts` no son bucles: cada uno
ejecuta una sola operación del motor dentro de su transacción, por lo que no se
modificaron.

## Verificación del commit funcional

Commit verificado:
`9b0df55b6b461363461027e60724d1236b5157ca`.

```text
Inventario: 23 passed, 0 failed; cleanup OK
T-LOCK: passed
Barrera determinista: arrivals-before-release=1 timeout=2000ms
POS: 35 passed, 0 failed
Salidas: 9 passed, 0 failed
Auditoría/concurrencia task57: 2 passed, 0 failed
Auditoría/pisos y carreras task58: 6 passed, 0 failed
Contrato AST de bucles/documentación: 2 passed, 0 failed
Typecheck raíz: passed
Build raíz: passed
Revisión arquitectónica de auditoría: PASS, sin hallazgos críticos ni altos
Revisión arquitectónica de recepción revalidada: PASS, sin hallazgos críticos ni altos
```
