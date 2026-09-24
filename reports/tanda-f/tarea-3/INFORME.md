# Tanda F — tarea 3: concurrencia real

## Resultado

**Cuatro escenarios PASS; abonos simultáneos con rechazo transaccional seguro, no PASS de “ambos terminan”. No se observó duplicación de dinero ni inventario.**

Prueba terminada el 24/09/2026 UTC. Evidencia detallada: `results.json`; cronología: `progress.txt`. Scripts: `run.ts`, `build.mjs`, `run.sh`. Sin cambios de producto, permisos especiales, gates, mocks, navegador, servidor de aplicación ni reinicios.

| Escenario | Resultado y evidencia |
|---|---|
| Dos cajeros, tickets distintos, sesión 46 | **PASS**. Actores CAJA 236 y 241. Ambos productores `cobrarTicket` se observaron bloqueados en PostgreSQL contra la sesión. Tickets 109/110: dos cobros de 1500, delta de pagos **3000**, sin pérdida de actualización. |
| Dos cajeros, mismo ticket | **PASS negativo**. Ticket 111: un cobro de 1500; el otro recibe `ALREADY_CHARGED`. Un solo pago persistido. |
| Dos usuarios, mismo rollo | **PASS**. Rollo 6236, producto 2078/sitio 836. Dos conexiones observadas esperando el candado advisory real `hashtextextended('2078:836',650001)`. Una venta (ticket 112); otra `ROLLO_NOT_AVAILABLE`. Cache, rollos disponibles y ledger bajan exactamente **10 METRO**, no 20. Se utilizaron clientes distintos para que un candado de cliente anterior no ocultara el del par producto/sitio. |
| Dos abonos del cliente 8 | **CONCURRENCIA OBSERVADA, RECHAZO SEGURO**. Ambos handlers reales alcanzaron la inserción de la operación, detenidos por barrera SQL de tabla. Uno acepta 100; el otro aborta con **SQLSTATE 40001**, `E5: grafo ocupado; abortar transacción completa, sin espera global`. No aceptar esto como PASS de dos abonos completados. La función restaurada `public.e5_serialize()` usa `pg_try_advisory_xact_lock(650005,5)` y exige reintentar la transacción completa. |
| Dos E4, efectivo conjunto insuficiente | **PASS**. Saldo real previo **9600**; cada solicitud **6720**, juntas **13440**. Ambos productores se observaron esperando la sesión. Una salida persiste; la otra falla `E4_CAJA_INSUFICIENTE`. Saldo resultante **2880**. Sin desbloqueo ADMIN. |

## Abonos: límite y seguimiento

El primer intento retuvo el candado de cliente. E5 rechazó un escritor antes de que ambos llegaran a ese candado; por eso **no cumple la barrera de dos conexiones** y permanece `FAIL_OR_BLOCKED` en la evidencia, aunque un abono 100 persistió.

Se pasó a una barrera anterior: `LOCK TABLE operaciones_credito_e1 IN SHARE MODE`. La observación `pg_stat_activity` registra dos PID distintos esperando `relation` en los INSERT reales. Tras liberar, un abono 100 persiste y el otro retorna 40001. La prueba estricta de dos éxitos falla.

Seguimiento explícito, no retry añadido al producto:

- La operación UUID perdedora no existía tras el rollback.
- Reintento del **mismo actor, UUID e intención**: abono 57, 100, aceptado.
- Replay exacto: devuelve abono 57; no agrega movimiento ni dinero.
- El resultado demuestra atomicidad y replay seguro; **no demuestra recuperación automática en UI/API**, ni que dos solicitudes concurrentes terminen sin intervención.
- Este cliente no tenía deuda al inicio: los abonos generan saldo a favor. No se presenta esta prueba como cobertura FIFO de notas pendientes; esa cobertura pertenece a tarea 1.

## Conciliación

Saldo final de caja leído con el repositorio real:

**5000 fondo + 4500 tickets + 300 abonos físicos − 6720 E4 = 3080.**

Los 300 corresponden a los dos ganadores de intentos concurrentes diferentes y el reintento explícito; el replay suma cero. Ledger de crédito del cliente: tres ABONO de −100; saldo a favor 300. La venta del rollo competido quedó sin cobrar y no añade efectivo.

Inventario del sitio 836 al final, tres representaciones iguales:

| Unidad / producto | Inicial | Final cache = rollos = ledger |
|---|---:|---:|
| METRO / 2078 | 80 | 40 |
| KILO / 2079 | 80 | 80 |
| PIEZA / 2080 | 80 | 80 |
| BOLSA / 2081 | 80 | 80 |

Los 40 METRO consumidos son cuatro rollos completos: tres tickets cobrados y la venta ganadora competida. También se verificó igualdad por producto en todos los snapshots antes/después; no se suman unidades distintas.

## Aislamiento y método

- Única base escrita: `tanda_f_concurrency`, servidor 127.0.0.1:55440, directorio privado `.local/tanda-f/cluster`. PID/command line, puerto, directorio y `current_database()` verificados antes de fixtures y cada caso.
- Guard nativo: `NODE_ENV=test`, `REQUIRE_ISOLATED_TEST_DATABASE=1`, URL de prueba explícita; URL “application” y default apuntan al witness vacío **no a la base de aplicación**. El witness se usa únicamente para identidad por el guard.
- Se reutiliza el cluster ya iniciado por el propietario. Espera máxima de disponibilidad: cuatro minutos. No se inicia ni detiene ningún servicio.
- Fixtures sintéticos preparados. Solo en esta copia se asignó CAJA 241 al sitio 836 y se creó un segundo cliente sintético. No se cambió rol, matriz, override ni gate.
- Se empaquetan los productores congelados y el código DB congelado mediante alias explícito; dependencias existentes se reutilizan. No se altera el código fuente ni el esquema.
- Los cobros, ventas y E4 usan funciones productoras reales, repositorio Drizzle real y transacciones PostgreSQL reales. Los abonos invocan el handler de producción intacto con actores reales verificados por su lógica de acceso; `req/res` son adaptadores de llamada, no una API HTTP. No se ejecuta middleware de sesión/permisos ni se reclama cobertura HTTP: tarea 4 es independiente.
- Barreras SQL externas solo para programar la contención. Se registra PID, clase de espera, query y bloqueadores. No se reemplaza ni instrumenta la lógica del productor.
- Barrera 20 segundos, lock timeout 30 segundos en productores transaccionales, statement timeout 45 segundos y proceso completo limitado a 360 segundos. El handler de abonos conserva sus transacciones originales con statement timeout del pool.
- Incidencias iniciales del arnés (nombres de columnas, estado de rollo, duplicado de fixture) quedaron en `progress.txt`; se corrigió solo el arnés. Ocurrieron antes de ventas/cobros. Build muestra una advertencia no fatal por tsconfig base ausente en la copia; bundle y ejecución terminaron.

## Reproducción y alcance

Sobre una **copia nueva equivalente**, con este mismo manifest y cluster ya disponible: `bash reports/tanda-f/tarea-3/run.sh`. Después, `run.sh 1` ejecuta únicamente la barrera de abonos anterior a E5, conservando resultados; `run.sh 2` reintenta/reproduce la operación perdedora registrada. No ejecutar repetidamente la corrida completa sobre rollos ya vendidos.

No es una prueba de carga prolongada ni de todos los interleavings. Los casos positivos tienen contención PostgreSQL observada, no solo `Promise.all`. El rechazo de E5 es una limitación de disponibilidad concurrente observada, **no evidencia de corrupción**. No se corrigió producto ni se destruyó la copia/cluster compartido; MAIN conserva la responsabilidad de teardown final.