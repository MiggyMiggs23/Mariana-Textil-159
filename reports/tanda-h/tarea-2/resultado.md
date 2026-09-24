# Tarea 2 — COPY ejecutada; límites explícitos

## Índices y prueba pareada

Con autorización expresa de MAIN se aplicaron **únicamente** los dos índices aprobados a `tanda_h_performance`, actor `h_performance`, puerto 55444. No hubo DDL en aplicación real ni schema push. `copy-ddl.json` conserva sentencias y revisión de prefijos: el índice previo ubicación/fecha no tiene ID ni predicado parcial; no existe prefijo de ubicación/expresión de fecha contabilizada. No se tocaron los candidatos de otros dominios.

Se cargaron 54,750 tickets adicionales y 89,750 rollos adicionales. La distribución de rollos se adaptó a las **tres** tiendas realmente creadas en H, no las siete ubicaciones de G; restantes supuestos anuales idénticos. Total: 54,753 tickets. `workload-source.json` identifica fuente y hash.

Tres muestras, milisegundos, constructores reales del fuente congelado que usa COPY:

| Operación | Antes | Después |
|---|---|---|
| Corte | 61.78 / 37.72 / 37.23 | 50.18 / 32.86 / 32.04 |
| Crédito anual | 399.47 / 439.17 / 386.63 | 417.34 / 373.92 / 381.71 |

No se afirma mejora causal robusta con tres muestras ni caché fría.

**Todos los resultados ordenados de consultas capturadas y ambas operaciones son iguales. Todas las tablas comerciales tienen exactamente el mismo digest.** Sólo cambió la tabla de sesiones de autenticación `sesiones` (no `sesiones_caja`). Por honestidad, `paired-proof.json` conserva `datasetEqual:false`; no se reescribió esa evidencia como éxito. `business-paired-proof.json` identifica la exclusión explícita y las igualdades comprobadas. MAIN debe decidir si esta exclusión de metadatos de autenticación satisface la prueba exigida o si requiere una nueva pareja sin actividad de sesiones. La escritura de cobros descrita más abajo ocurrió **después** de esta pareja.

## Navegador real, no tiempos SQL presentados como UI

Puerto UI 43882. Autenticación y selección inicial de sitio figuran aparte en cada `results.json`. Navegación hasta contenido visible y dos frames; no `networkidle`. Los archivos incluyen solicitudes y métricas CDP. Hay fallos de readiness preservados, no muestras descartadas como éxito.

- Crédito antes: **6,682 / 5,415 ms**, tercera muestra falló a 15 s.
- Crédito después: **8,112 ms**, siguiente navegación quedó en “Comprobando sesión…” y no emitió solicitud de reporte.
- Corte después, sitio correctamente seleccionado: navegación completa **2,799 ms** (incluye reselección del sitio después del reload); acción de abrir corte hasta cifras listas **961 ms**. La solicitud `/api/sesiones-caja/46/corte` tardó **110 ms**. Captura correcta inspeccionada en `browser-post-cut-site-correct/cut-0.png`. No se declara cumplido el objetivo de navegación completa <2 s ni una serie de tres éxitos.

**Crédito >3 s no está explicado por la consulta principal:** antes la respuesta `/api/reportes/clientes` fue ~925/685 ms; después ~579 ms, frente a 8.1 s de readiness. En esa muestra CDP registra 261,672 nodos, 7.51 s de tareas, 2.38 s de script, 2.79 s de layout y 1.47 s de recálculo de estilos. El coste dominante observado es construcción/renderizado de DOM, no esperar esa consulta. Las consultas servidor están capturadas en `pre.json`/`post.json`; planes después de las consultas de crédito más caras ~169/156/113 ms. No atribuir toda la demora de UI a uno de esos SQL.

Propuesta **no implementada**: instrumentar y virtualizar/paginar la representación de filas en los componentes de reportes, manteniendo agregados, filtros, exportación y significado comercial; evitar montar masivamente tablas ocultas. Separadamente investigar el bloqueo de la frontera de autenticación tras reload, antes de aceptar una serie de navegación. No se cambió ninguna consulta ni métrica.

## Estado de cuenta E7: bloqueo distinto y comprobado

Se usaron los selectores reales `e7-client-export` y `e7-global-four`, y también navegación nativa por Clientes hacia el cliente sintético. **No se obtuvo captura E7 lista.** La pantalla permanece “Verificando autorización E7…”, sin emitir solicitud `/api/e7/clientes/.../exportacion`. En navegación nativa hubo respuestas de auth (~87/208/1,155 ms), pero no petición E7 y ~19.7 s de script durante la espera de 20 s. Por tanto esta ejecución no puede atribuir ese bloqueo a la consulta de movimientos ni demostrar readiness de la cuenta. No se recortó el libro mayor, cambió de cliente ni se falsificó una captura lista. Evidencia: `browser-account-native-navigation`.

## Cobro real nativo, tres transacciones confirmadas

`cash-write.mjs` creó tres tickets nuevos mediante `crearTicket` usando rollos originales de la recepción sintética trazada (IDs 6233–6235, entrada 468), y cobró con `cobrarTicket` en la sesión nativa 46. Sin SQL directo de cobro ni rollos masivos sin procedencia como fuente.

Latencia **hasta COMMIT**: **131.76 / 26.30 / 16.38 ms**. Tickets 54859–54861. `cash-write.json` verifica `cobrado`, sesión, total y filas persistidas de pagos. Es latencia de servicio/transacción, **no** una afirmación de latencia navegador/clic-a-confirmación. No se ocultó ni truncó una operación lenta.

## Pendientes para MAIN

No certificar objetivos UI ni screenshot E7 completados. Faltan tres muestras exitosas de navegación comparables, resolución/diagnóstico ampliado de la frontera auth/E7 y, si se exige, cobro clic-a-confirmación en navegador. MAIN conserva control exclusivo sobre cualquier DDL real. Los fallos iniciales de selector/sitio y de reload permanecen en sus carpetas de evidencia.