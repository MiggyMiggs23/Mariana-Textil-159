# 10. Arranque real fallido — NO AUTORIZABLE / STOP

**Continuación resuelta del control:** ver documento 11. El agente principal
confirmó control PASS y candidato anterior FAIL con el mismo ensayo. La
corrección condicional autorizada se limita al nuevo límite de importación
lazy en index.ts, no al ciclo preexistente. El candidato corregido está
compilado; falta su verificación real. Lo siguiente conserva el historial.

## Rectificación y autorización posterior de control

La atribución causal inicial fue prematura. El ciclo de fuentes inventario ↔
salida-venta-reservation ya existía en la revisión retenida 7cb77f8 y no demuestra
por sí solo un defecto nuevo del candidato. Las esperas async descritas abajo
son observaciones estáticas e hipótesis; el fallo de health del candidato sí
es observado. No se decide cambiar runtime antes del control autorizado.

`autorizacion-control-y-preflight.txt` exige compilar 7cb77f8 por el mismo método
y ejecutar el mismo ensayo. Si también falla, se corrige el ensayo, no fuentes.
Si el control arranca y el candidato no, se identifica el delta causal y solo
entonces se considera la corrección mínima separada autorizada. El agente
principal ejecutará el control; el subagente no ejecutó ninguna aplicación.

Independientemente, el preflight CLI fue corregido bajo esa nueva autorización
para resolver realpath; el wrapper ahora exige evidencia positiva, no exit 0
solamente. La regresión symlink falló antes (exit 1 del test, CLI omitido con
exit 0) y pasó después. La matriz ampliada tiene 20 PASS PostgreSQL incluyendo
CLI real por symlink, y 9 PASS de wrapper incluyendo falta de prueba positiva.
Esto no reescribe ni valida retroactivamente el arranque fallido conservado.

## Resultado observado

El agente principal ejecutó el candidato autorizado con entorno limpio,
PostgreSQL nuevo y desechable, socket privado en puerto 55439 y HTTP 18092.
No se obtuvo `/api/healthz` 200 dentro de 30 segundos. El log contiene el aviso
INSPECTION; no contiene confirmación de escucha ni PASS del preflight externo.
No es una prueba pendiente: el intento real **falló**.

La traza demuestra aperturas exitosas del worker thread-stream-worker.mjs
y del transporte pino-pretty.mjs desde el directorio definitivo, por el hilo
3555 (traza líneas 2456/2458). El aviso Pino real fue emitido por PID 3525.
La portabilidad de esos workers no es el bloqueo de este intento.

## Hipótesis de espera circular: falta contrastar control

En la fuente exacta exportada de 31804125:

- `artifacts/api-server/src/index.ts:167–170`: la consulta SELECT 1 termina
  antes del aviso INSPECTION observado. La conexión pg por Unix socket funcionó.
- `index.ts:196` espera importar app; `index.ts:198` escucha solo después.
- `lib/inventario.ts:57` importa assertNoActiveVentaClienteReservation desde
  salida-venta-reservation.
- `lib/salida-venta-reservation.ts:4` importa InventarioError desde inventario.
- `lib/db/src/index.ts:79,138` contiene top-level awaits de las ramas de prueba;
  el empaquetador genera inicializadores async incluso al estar desactivadas.

En `artifacts/api-server/dist-e2-20260927/index.mjs`, el análisis estático AST
del archivo real muestra el camino app → routes/index → routes/dashboard →
inventario, y estas esperas recíprocas:

- `84813–84819`: init_salida_venta_reservation espera init_src e init_inventario.
- `86534–86544`: init_inventario espera init_src y luego
  init_salida_venta_reservation.
- `324139` inicializa app esperando routes; `324956` espera init_app antes de
  llegar a listen.

El helper esbuild `__esm` (líneas 21–23) conserva las promesas pendientes.
Después del primer await, ambos inicializadores terminan esperando la promesa
inconclusa del otro según el análisis estático; el control debe discriminar
esa hipótesis de un problema del ensayo. La ruta HTTP `/api` +
`/healthz` y PORT 18092 del runner son correctos; cambiar puerto o aumentar
timeout no elimina este ciclo.

## Defecto adicional del recorrido de preflight

`release-preflight.mjs:70` compara argv resuelto sin realpath contra
import.meta.url, que usa la ruta real. El runner enlaza simbólicamente el
directorio del paquete. En esa invocación las rutas no coinciden: main no
se ejecuta y el proceso termina 0. Por tanto, **el preflight externo del
arranque real no está demostrado**, aunque el wrapper interprete exit 0.

Las 19 comprobaciones independientes PostgreSQL, incluyendo el CLI invocado
directamente por ruta real, permanecen válidas. Lo mismo ocurre con los 8
tests del wrapper usando centinela y los 119 tests offline. Ninguno demuestra
éxito del recorrido real fallido. La comparación posterior de catálogo,
filas y secuencias no fue alcanzada después del timeout y no se presenta como
aprobada.

## Evidencia preservada y limpieza

Copias byte a byte en `verificacion-final/failed-start-20260921-212811/`:

| Archivo | SHA-256 |
|---|---|
| candidate-start.log | f3fdb13abde945f09d75af45236eb26c0a23d49276c684d08152e3f99116753e |
| candidate-start-results.json | a34b55cf9f0caa31dc085b47d768827f7f5c7d053d2c1e6df4e315d297706c10 |
| candidate-worker-open.trace | 1b704b2a2da5dd67058ba50f2175384f8e1310fa548190abed26c8075c5e50c1 |

El resultado registra candidato detenido, PostgreSQL stop exit 0 y directorio
desechable destruido. La comprobación final de solo lectura no encontró proceso
del candidato ni PostgreSQL asociado al intento; confirmó ausencia de
`/tmp/e2-candidate-start-9W5ksE`.

Hash activo final, sin cambios:
`3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98`.
Hash candidato preservado:
`1102baeec9de7d7c7773f142a835f39234ec1ba2f278373cdedcd4814ff2feb3`.

No se corrigió runtime ni plugin después del diagnóstico. El preflight y la
preparación de control sí se modificaron con la nueva autorización explícita.
No se tocó la API activa, su base, workflow o clones E1/E10. No se realizó
backup Drive ni liberación. Fase B queda **NO AUTORIZABLE**; cualquier corrección
fuera del directorio de salida requiere autorización separada, revisión de
hashes y nueva verificación real. Ahora procede únicamente el control autorizado
y las acciones condicionales indicadas arriba; fase B continúa bloqueada.