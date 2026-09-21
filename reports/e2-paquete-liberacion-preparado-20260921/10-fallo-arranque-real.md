# 10. Arranque real fallido — NO AUTORIZABLE / STOP

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

## Defecto real: ciclo de inicialización async

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
inconclusa del otro. La aplicación no llega a listen. La ruta HTTP `/api` +
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

No se corrigió runtime, plugin, preflight ni runner después del diagnóstico.
No se tocó la API activa, su base, workflow o clones E1/E10. No se realizó
backup Drive ni liberación. Fase B queda **NO AUTORIZABLE**; cualquier corrección
fuera del directorio de salida requiere autorización separada, revisión de
hashes y nueva verificación real. No se sugiere reintentar bajo la autorización
limitada actual.