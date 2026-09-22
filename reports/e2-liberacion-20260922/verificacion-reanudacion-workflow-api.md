# Reanudación observada de la API — sin liberación

La autorización literal se guardó en `autorizacion-reanudacion-workflow-api.txt`
como primera escritura de esta intervención.

Al comprobar el entorno, el workflow ya estaba ejecutándose. MAIN **no**
emitió una orden de inicio ni reinicio: evitó un segundo arranque innecesario.
El propietario informó que la detención anterior fue del entorno.

## Resultados comprobados

- Workflow: `artifacts/api-server: API Server`, estado `running`, puerto 8080.
- Comando sin cambios:
  `cd /home/runner/workspace && exec bash reports/e2-paquete-liberacion-preparado-20260921/api-start-audit.sh`.
- PID vivo: **110**, `TracerPid=0`.
- Bundle: `artifacts/api-server/dist-e2-20260927/index.mjs`.
- SHA-256 completo calculado:
  `008dfd54d93f6a1606370d44cb2086673669c51278c92ebb6a5a63f4d503e7f5`.
- `reports/arranques-api.log` registra PID 110 a
  `2026-09-22T21:15:34.954Z`, hash coincidente,
  `API_INSPECTION_BOOT=1`, `NODE_ENV=development`, preflight `passed`,
  exit 0 y etapa `exec_attempt`.
- El log efectivo del workflow confirma `E2_COMPLETE_RELEASE_PREFLIGHT=PASS`,
  modo `INSPECTION`, `capture:false`, `refund:false`.
- A `21:15:36.863` el proceso 110 informó:
  `Inspection boot: schema initializers, purchase backfill and stock-minimum monitor are paused; no startup maintenance will run.`
- `/api/healthz` por el proxy del entorno respondió **HTTP 200**,
  `{"status":"ok"}`.

## Ausencia de escrituras de arranque: alcance de la verificación

Se revisó **el bundle retenido**, no las fuentes en desarrollo:

- Líneas 314763–314774: selección del modo e inspección; la consulta de
  esa rama es únicamente `SELECT 1`.
- Líneas 314793–314795: los inicializadores pertenecen a la rama normal,
  no a la rama observada.
- Líneas 314806–314816: retorno no escritor antes de crear/arrancar
  backfill y monitor, cuyas invocaciones están en 314818–314850.

La identidad del artefacto, el registro del wrapper, el mensaje runtime
y el control de flujo coinciden con un arranque sin mantenimiento escritor.
No se ejecutaron SQL, inicializadores ni backfills por MAIN.

**Límite:** no se capturó una comparación de filas/secuencias antes y después
de este arranque, que ya había ocurrido. No se presenta esa comparación como
realizada ni se certifica ausencia de escrituras posteriores de otros actores.
El campo `phase:"after"` del preflight compara el catálogo con la expectativa
de liberación E2; no es una medición antes/después de este arranque.

No se cambió comando, bundle, modo ni puertas de captura. No se ejecutó la
fase B de E3. Continúa la construcción OFF autorizada, sin usar la API para
las pruebas nuevas.