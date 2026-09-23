# Tanda B OFF — BLOCKED, no listo para liberación

**No hay sello de éxito ni autorización de fase B.** E3 y Tanda B siguen OFF;
no se aplicó activation.patch, no se reparó catálogo y no se rebaselinaron
expectativas. La captura y el preflight reales pasaron; el ensayo r1 falló
antes de arrancar el candidato o el control E2.

## Fuente y artefactos

- Fuente congelada: `1031a630fd461c3df89767bad7a14cc777e56261`.
- Archivo de procedencia: `source-manifest.json`, SHA256
  `bffe1ca78af5a6467f3a985dc238d9dbda70cc4c30f197e9f3b7da601e104360`.
- API: `artifacts/api-server/dist-tanda-b-off-20260923/index.mjs`,
  SHA256 `970c806fa3759a9aa72b57648ff6813a81cef64d703e05e26f17407fa6a79190`.
- UI: `artifacts/mariana-textil/dist-tanda-b-off-20260923/index.html`,
  SHA256 `118cfee92b28955f81685aeb0bc6d5c4d99f7233e5e5c681403aad5feaa64af6`.
- JS principal UI `assets/index-CLqeiEwA.js`,
  SHA256 `836c33b82cee4a16eb384767e767f948fe2c004621e77691833d541dd62a3c93`.
- Las 23 salidas completas están en `manifest.json` y `release-assets.sha256`.
  Builds aislados: `build-api.log`, `build-ui.log`. Auditoría estática:
  `evidencia/static-audit.json` (27 declaraciones OFF; workers Pino referidos
  a la ubicación final absoluta). No se acredita portabilidad a otra ruta.

## Evidencia real ejecutada por MAIN

`evidencia/capture-cli.json`: PASS, exit 0, token positivo
`TANDA_B_CAPTURE=PASS_READ_ONLY`. `evidencia/live/read-only-capture.json`:
PID191, mismo DATABASE_URL verificado sin conservarlo, transacción
REPEATABLE READ READ ONLY y ROLLBACK, catálogo estable; schema-only sin actores.

`evidencia/preflight-cli.json`: PASS, exit 0, token positivo
`TANDA_B_OFF_REAL_PREFLIGHT=PASS`. Identidad capturada: heliumdb, OID16384,
public, postgres, PostgreSQL 160010. La igualdad numérica de esa identidad
con la desechable **no convierte el fixture en la base real**.

`release-expected.json` conserva los hashes reales originales:

| Evidencia | SHA256 |
|---|---|
| Catálogo JSON real (archivo) | `0fab3aa64f42f43ed9f4efa17b3715eff86723ce7b833f47cd16b4072742bd09` |
| Dump schema-only real | `d0a81921ea0c6d637dbf6010b90c106b777382f2243b368647bb9a86e0604e38` |
| schemaRows canónico real y reconstruido | `89c445d53c3db7d8cb3a45bdab49f82acb12943d62084eced21ab3af5cf5a358` |
| attributes canónico real | `597213c727c1b825a480720b0484badf26c17a02309fba8cd57d72af0e7a7665` |
| attributes canónico reconstruido r1 | `a8389a4be6f0765a58849a425e742fc941821fbdf9c6fab0fa9c1eeb428d5ec6` |

## Bloqueo exacto r1

Comparación estática de los JSON guardados: 1585 schemaRows idénticas;
902 attributes en ambos, con exactamente seis valores distintos, todos
`kind=enum`, `parent=rol_usuario`, campo `definition` (enumsortorder):

| Etiqueta | Real | Reconstruido |
|---|---:|---:|
| TERMINAL | 1.5 | 2 |
| CAJA | 2 | 3 |
| SUPERVISOR | 3 | 4 |
| BODEGA | 4 | 5 |
| SISTEMAS | 5 | 6 |
| CONTADOR | 6 | 7 |

ADMIN conserva 1. Las siete etiquetas y su orden relativo coinciden
(ADMIN, TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR), pero sus
posiciones numéricas no: el verificador estricto rechazó correctamente.
Los **42 atributos trigger son idénticos**; no hay diferencias observadas
de tgenabled, ACL, owner u otros atributos representados en estos JSON.
No se atribuye esta pérdida de fidelidad a una modificación de la base real.
El detalle reproducible está en `evidencia/comparacion-r1-offline.json`.

`evidencia/rehearsal-r1/terminal.json`: FAIL, postgresStarted=true,
postgresStatusBeforeCleanup=0, postgresStopExit=0, disposableDestroyed=true.
`candidateStopped=false` aquí no prueba un proceso pendiente: el fallo ocurrió
en la comparación anterior a `boot`; **ni candidato ni control arrancaron**.
No hay prueba de preservación de startup, logs de esos bundles, sensibilidad
de filas o integración funcional en r1.

El campo `rawEnumAndTriggerAttributesPreserved:true` del registro original
`catalog-fidelity.json` era declarativo y queda **refutado para enums por sus
propios hashes y por el FAIL**. Se preservó sin alterarlo; no es un PASS.

Control E2 previsto: SHA256
`008dfd54d93f6a1606370d44cb2086673669c51278c92ebb6a5a63f4d503e7f5`,
asociación de ruta de disco con línea de comando PID191 registrada por MAIN.
**No arrancó sobre el fixture infiel ni se reinició el servicio actual.**
El hash de disco no acredita los bytes cargados en memoria por PID191.

## Trazabilidad y siguientes pasos

`antecedentes/preliminar/` conserva byte por byte el manifiesto y los inventarios
anteriores; sus entradas son rutas/hashes históricos, no validadores del estado
actual. `manifest.json` ahora declara BLOCKED y enlaza captura, preflight,
fallo y cleanup reales. `package-integrity.sha256` inventaría el paquete actual
incluyendo los antecedentes; su sidecar y `manifest.sha256` son integridad
documental, **no sellos de éxito operacional**. R1 y las expectativas reales
permanecen inmutables.

No repetir builds, DB, SQL, arranques ni integración bajo esta entrega.
Siguiente paso: decisión explícita del propietario/MAIN sobre cómo lograr
un fixture fiel a enumsortorder sin modificar la base real ni rebajar el
contrato. Ninguna reparación está autorizada aquí. Después de una decisión
separada seguirían pendientes arranque candidato en desechable fiel,
preservación catálogo/filas/secuencias, controles negativos, sensibilidad
real de fila desechable y pruebas HTTP de gates cerradas. El control E2
solo procedería en una prueba autorizada con fixture fiel si falla candidato.

**MAIN debe comprobar el runtime mediante lectura antes de entregar.**
Esta comprobación final no fue ejecutada por el subagente y no se presume.
`fase-b-BORRADOR-NOEJECUTABLE.txt` permanece no ejecutable; comandos anteriores
son referencia histórica, no instrucción de reintento ni autorización.