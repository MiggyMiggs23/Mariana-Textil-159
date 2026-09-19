# A+C — cierre de los pendientes offline 1–4

## Dictamen y revisiones

**Preparación offline completada. Candidato inactivo y no aplicado. No autorizado para apertura.**

- Revisión de fuentes congelada y comprobada: `f8818255bcb11784c422cc559c3273e1f2e25aa9`.
- Árbol de esa revisión: `7769fbaad0f58c223b4fab6694f58ca76faafb10`.
- Baseline: `80eaa93d4300e86d9be54492e634f88f0c0abc90`.
- Inicio de esta continuación: `a0a713e245fed21d0fc6e85edf869159a3c743e9`.
- El cierre documental posterior no modifica las fuentes ni los SQL comprobados.

## 1. Revisión independiente

Informe: [revision-independiente-offline-20260919.md](revision-independiente-offline-20260919.md).
Es un registro cronológico; sus reconfirmaciones finales sustituyen los dictámenes intermedios.

Se corrigieron y reconfirmaron estáticamente:

1. Inventario E1 que rechazaba A+C tanto al abrir como al cerrar conservando evidencia.
2. Inventarios y digests de los planes de activación/cierre descoordinados.
3. Carrera al comprobar tablas vacías antes de obtener los locks de reversión.
4. Posibilidad de una clasificación coherente en JSON pero contradictoria con aplicaciones persistidas. También se protegió la inserción posterior a finalización dentro de la misma transacción, incluso tras adelantar las restricciones diferidas.
5. Omisiones de PK/UNIQUE/FK/CHECK, nulabilidad, metadatos de columna y deferrabilidad en preflight.
6. Join de finalización ABONO que hacía imposible el origen retenido. Ahora cada origen exige su prueba positiva tipada y el ABONO conserva obligatoriamente `UNUSED`.
7. Uso inválido de `pg_catalog.coalesce` en los planes preparados.

También se corrigió la procedencia del dirigido: no se etiqueta como salida de `projectCreditLedger` una asignación explícita dirigida. Se exige `FULL`, importe íntegro y correspondencia con aplicaciones guardadas; SQL deriva la procedencia admitida del productor del movimiento original. El diseño documenta esta distinción, sin añadir otro FIFO ni fingir una proyección posterior a aprobación.

## 2. Reconciliación del SQL futuro

Informe: [reconciliacion-offline-20260919.md](reconciliacion-offline-20260919.md).

- Propietario único de evidencia: instalación A+C.
- ABONO y COBRO_RETENIDO siguen preparados con orígenes disjuntos y sus restricciones correspondientes.
- El attester retenido permanece sin productor activo; no se añadió E5 ni backfill.
- Devolución conserva una barrera SQL independiente, además de los permisos cerrados y las defensas E1 de aplicación.
- Contrato V3 vincula cuatro artefactos. Preflight describe 19 columnas, 21 constraints, seis triggers y siete funciones A+C.
- Los planes preparados no se ejecutaron. Las comprobaciones SQL fueron lectura y análisis de texto.

| Artefacto | SHA-256 |
|---|---|
| Instalación A+C | `dd99574f022b4d325a73238bf0d1e348e015003d2dad3ebc9de00ede8b094cbd` |
| Reversión previa a captura | `522f8bac6d8b78e2eee158e47249aac8e8fac264cabd64546b00b6f3bf7ae4bc` |
| SQL preparado de devolución | `1bb36ac4eddd07d54e28686b83a3ded3d98b115e4190fbce6e97a11c7576587d` |
| Preflight SQL compartido | `f5870c20276001bd2c8269e534b2ef696217e13087a27cd350127ce8dfa9b5d2` |
| Servicio de evidencia | `7ce0967733c4fd61b09db804cb4231ec080236bb26b7861e145f157fdb93893e` |
| Consumidor de devolución | `04f40603037fbd01e56491d320272798599f936a878515e02e0e881c5ee2ae8d` |

## 3. Pruebas y mutantes

- Suite ampliada: **428/428**, incluidos **421** casos independientes de deriva de catálogo.
- **24/24** mutantes rechazados por el proceso real, con exit 1, `AssertionError` y mensaje semántico esperado.
- **24/24** restauraciones verificadas, cada una con 428/428. Incluyendo el verde inicial: 49 procesos registrados.
- Productores reales montados mediante dependencias interceptadas: omisión, clasificación, orden respecto a FIFO/aplicación y procedencia.
- Consumidor real en aislamiento: prueba faltante, join ABONO omitido y join indebido sobre retenido.
- Preflight: cada objeto y metadato cubierto, además de mutantes que omiten verificaciones.
- El mutante sobre la guarda SQL de aplicaciones es **solo léxico**. Su rechazo no demuestra la semántica real de `SET CONSTRAINTS`, commit ni concurrencia.
- Suite enfocada de evidencia/devolución: **29/29**; preflight/modos: **14/14**. Dos verificadores estructurales SQL: PASS. Conteos con posible solapamiento, no sumados como casos únicos.

Evidencia:

- [negativos-offline-20260919.md](negativos-offline-20260919.md)
- `negativos-offline-logs-20260919/results.json`, hashes de entradas y logs de cada proceso.
- `validacion-offline-20260919/focused-manifest.txt`, `focused-tests.log` y `.exit`.
- `reconciliacion-offline-20260919-terminal.log`.

Se conserva el primer intento de la suite enfocada: una aserción léxica eliminaba solo la primera de dos consultas de prueba tipada y no fallaba como esperaba. Se corrigió el mutante para eliminar ambas ocurrencias; no se ocultó ese intento ni se cambió el consumidor para acomodarlo.

## 4. Typecheck raíz contra baseline

Ambas revisiones ejecutaron el comando canónico `pnpm run typecheck` en archivos Git exportados a copias temporales distintas, sin emisiones en el workspace activo.

| Resultado | Baseline | Candidato |
|---|---:|---:|
| Exit canónico | 0 | 0 |
| Bibliotecas referenciadas | 6 PASS | 6 PASS |
| Artefactos/scripts | 4 PASS | 4 PASS |
| Diagnósticos únicos / repetidos | 0 / 0 | 0 / 0 |
| Fallos de proceso/parser | 0 | 0 |

No hay diagnósticos nuevos ni anteriores en esta comparación. El acompañante estructurado confirma terminación de todos los paquetes; no se infiere éxito de un proceso incompleto.

Los enlaces internos de cada copia resuelven a sus propias fuentes; solo se comparten dependencias externas instaladas. El entorno de compilación fue saneado. No se atribuye a `pnpm` el bloqueo de sockets del harness de pruebas: el guard de pruebas también bloquea el shell que necesita pnpm.

Integridad del candidato: 3,458 rutas comprobadas sin diferencias, incluyendo dos materializaciones Git LFS verificadas contra sus punteros. Las 1,967 rutas activas de `dist`/`tsbuildinfo` y sus hashes permanecieron iguales.

Ver `validacion-offline-20260919/root-comparison.json`, logs canónicos, `.exit`, detalles por paquete, inventarios de aislamiento/integridad y manifiestos SHA-256.

**No se volvió a ejecutar el antiguo manifiesto con navegador/HTTP.** Sus cinco fallos históricos no se presentan como un resultado nuevo, ni se sustituyó por un subconjunto para declarar una comparación global inexistente.

## Límites operativos

No hubo acceso a base de datos, ejecución SQL, pruebas PostgreSQL, inicializadores, build de aplicación, cambio de workflow, reinicio de API ni sustitución del bundle servido.

- API observada antes y después: PID 176, inicio `2026-09-19 02:34:33` mostrado por el sistema; ejecuta `artifacts/api-server/dist/index.mjs`.
- Bundle preservado: `3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98`.
- Preflight del runtime preservado: `9a87b47b52d3776b10d760bdab6b9f5e71158f75ef71921ec8adbb3e0585de9f`.
- Captura, evidencia y devolución siguen cerradas. Fuentes candidatas y bundle servido son versiones distintas deliberadamente.

Pendiente exclusivamente con autorización separada: PostgreSQL aislado para instalación/reversión, representación real del catálogo, restricciones inmediatas/diferidas, subtransacciones/xmin, rollback, permisos efectivos, replay, locks/concurrencia y aplicaciones futuras legítimas. Después hará falta otra decisión de apertura. **Este cierre no autoriza ninguna de las dos cosas.**