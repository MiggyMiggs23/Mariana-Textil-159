# Tarea 4 — rendimiento SQL/servidor, escenario anual sintético

## Conclusión y alcance

**Ninguna de las 126 ejecuciones medidas excedió dos segundos.** Esto es evidencia
de SQL y builders reales de servidor en esta copia y este escenario, **no de
latencia de pantalla, HTTP, cobro transaccional ni capacidad anual real del negocio**.
La parte de navegador queda pendiente; no se capturó ni se midió renderizado.

Base aislada `tanda_ga_performance`, puerto 55442, login limitado `ga_performance`.
Sin escrituras en la aplicación, cambios de código fuente, gates, triggers,
permisos o índices. Se usaron consultas y funciones del baseline congelado de
setup; no credenciales de actores reales ni autenticación con ellas.

## Volumen alcanzado y supuestos, no inferencias

La copia recibida tenía **3 tickets, 15 líneas, 1 pago, 4 movimientos de crédito,
964 rollos, 8 clientes, 1,238 productos y 6 sesiones**. Estos conteos son demasiado
pequeños y carecen de período representativo: **no permiten inferir ventas/año**.

Supuesto explícito, a validar por el propietario: 50 tickets por tienda/día,
3 tiendas, 365 días = **54,750 tickets añadidos**. Fechas 24-sep-2025 a 23-sep-2026,
25% crédito por regla modular, 5% pendientes; ambas reglas se superponen.
Una línea y un rollo por ticket; 35,000 rollos disponibles adicionales distribuidos
en los siete sitios. Se alcanzaron:

| Tabla | Total final |
|---|---:|
| tickets | 54,753 |
| ticket_lineas | 54,765 |
| ticket_pagos | 41,064 |
| movimientos_credito | 13,691 |
| rollos | 90,714 |
| clientes / productos / sesiones_caja | 8 / 1,238 / 6 |

Se concentraron las ventas sintéticas en **un cliente** y **cuatro productos**,
para estresar la cuenta larga, no para representar distribución comercial real.
Solo los 150 tickets del último día se vincularon a las tres sesiones abiertas
del fixture; no se generaron 1,095 cierres históricos. El corte probado consulta
una sesión y los pendientes del sitio; no representa un año de cierres.

La carga es **bulk SQL para rendimiento**, no simulación de corrección operativa.
No reproduce autorización comercial, límites de crédito, FIFO, cache de
existencias, recepciones/kardex completo, abonos, devoluciones o conciliación.
Los rollos y líneas respetan FKs/checks pero no prueban la trazabilidad comercial.
Se insertaron operaciones E1 explícitas antes del ledger y permanecieron activos
los triggers. Una primera carga falló por faltar contexto E1 y se revirtió
íntegra; la segunda incluyó la operación, sitio y naturaleza sin abrir puertas.
Las secuencias pueden tener huecos por esa transacción revertida.

## Método y resultados

Una primera ejecución por caso + 20 repeticiones calientes, concurrencia externa
del harness 1; los builders conservan su paralelismo interno. p50/p95 por rango
más cercano sobre las 20 repeticiones. Tiempo medido con reloj monotónico,
incluye espera del driver/deserialización y lógica del builder donde corresponde.
No incluye red HTTP, middleware, navegador ni PDF/XLSX.

**Frío real: no medido.** “Primera” es first-touch del harness, con cachés de
PostgreSQL/OS posiblemente calientes por la carga y trabajos vecinos. No se
reiniciaron servicios ni vaciaron cachés. Los planes guardados muestran hits
compartidos, no justifican una afirmación de disco frío.

| Caso real | Primera ms | p50 ms | p95 ms |
|---|---:|---:|---:|
| Cola de cobro: consulta de GET /tickets, pendientes, límite 200 | 45.67 | 13.81 | 18.75 |
| Estado de cuenta: SQL canónico de exportación, cliente de estrés | 99.48 | 59.84 | 186.49 |
| Inventario agrupado: SQL de /existencias/agrupadas, global | 31.48 | 12.16 | 18.07 |
| Inventario agrupado: mismo SQL, tienda 1 | 7.17 | 6.50 | 8.55 |
| Corte: buildCorteCaja real, sesión fixture tienda 1 | 198.87 | 36.40 | 43.67 |
| Reporte clientes/crédito: buildReport("clientes"), año/3 tiendas | 663.65 | 366.08 | 433.71 |

La consulta de cola se transcribió del SELECT real (mismos joins, columnas,
predicados, agrupación, orden y límite), sin serializador HTTP; inventario
agrupado también usa SQL real parametrizado. Estado de cuenta importa su
constructor canónico; corte y reporte importan directamente los builders
TypeScript del árbol congelado. No se ejecuta inicialización de la aplicación.

## Consultas e índices

`query-plans.json` conserva **EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)** de las 29
formas SQL distintas capturadas, no solamente estimaciones. Dos alcances del
inventario comparten forma SQL: el plan retenido corresponde al de mayor duración.
`query-summary.json` vincula hash, workload, máximo del driver y ejecución del plan.
No hay consulta culpable >2s que reportar ni índice demostrado imprescindible.

Hallazgos para revisar, sin afirmar mejora no medida:

* Corte `0445011e4b744b54`: filtra 17,338 tickets tras buscar por sitio;
  candidatos parciales para pendientes pueden reducir esa lectura.
* Cola `d882bd81bfb62b6e`: lee 54,765 líneas en secuencial; **ya existe**
  `ticket_lineas_ticket_idx`, por lo que no se propone duplicarlo ni se considera
  todo scan secuencial un defecto.
* Cuenta `0ad689d1c924c8a5`: sort de 13,687 movimientos, 53.33ms de ejecución.
  Existe `(cliente_id,created_at)`; añadir `id` puede ayudar al orden estable,
  pero el cliente de estrés ocupa casi todo el ledger y puede seguir conviniendo scan.
* Reporte `21e46560fbdadb5c`: 253.95ms de ejecución; agregado LATERAL por ticket,
  156,627 hits de buffers. El rango anual incluye casi todas las ventas, por lo
  que un índice de fecha no elimina el costo de procesarlas.
* Agrupado `e6fb460dfe495714`: 35,952 rollos disponibles, 28.54ms de plan.
  Un índice parcial cubriente por sitio/producto es candidato para alcance local.

**DDL exacto, únicamente propuesta:** `proposed-indexes.sql`. No se aplicó ninguna
sentencia. Las alternativas de pendientes se solapan; deben compararse con carga
de escritura y distribución representativas antes de escoger. No prometer mejora
sin A/B. `verification.json` comprueba que el catálogo de índices medidos no cambió.

## Hardware, límites y reproducción

Entorno compartido: 8 CPUs visibles Intel Xeon Platinum 8581C, cgroup
`800000 100000` (8 CPU), límite de memoria 16GiB. PostgreSQL 16 del setup:
shared_buffers 128MiB, work_mem 4MiB, effective_cache_size 4GiB,
max_parallel_workers_per_gather 2, max_connections 100. Sin exclusividad de CPU,
I/O o RAM; otros workers podían competir. No se hizo test de concurrencia,
saturación, percentil de producción, peor caso universal ni cold-start.

La carga confirmada tomó aproximadamente 20.58s; primer intento revertido aparte.
Las mediciones completas y parámetros del servidor están en JSON.
No se emitió ANALYZE manual ni se modificaron parámetros globales.

Con la copia fresca iniciada exclusivamente por MAIN:

1. `node reports/tanda-g-ampliada/tarea-4/load.mjs`
2. `node --import ./scripts/node_modules/tsx/dist/loader.mjs reports/tanda-g-ampliada/tarea-4/benchmark.mjs`
3. `node reports/tanda-g-ampliada/tarea-4/verification.mjs`

El loader rehúsa duplicar el lote; el benchmark puede repetirse sin recargar.
Timeout por sentencia de carga 100s; medición configurada 25s en la conexión
inicial (el pool de builders puede abrir otras conexiones). No tomarlo como
timeout global de todas las consultas. Identidad SQL obligatoria en cada script.
Los scripts requieren los secretos privados del setup, nunca los imprimen.
Destrucción de copias y servicios corresponde a MAIN después de conservar evidencia.

**Pendiente explícito:** validar el supuesto anual con el propietario; completar
una distribución real de clientes/productos/operaciones y latencia de navegador,
cobro transaccional, cierres históricos y arranque frío. Este resultado parcial
no certifica todas las pantallas bajo volumen anual real.