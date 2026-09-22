# E2 CLOSED — liberación del 22 de septiembre de 2026

**Estado: liberación técnica verificada; primer cierre pendiente exclusivamente
del propietario, sin bloquear las demás verificaciones, conforme a su autorización.**

## Autorización y alcance

El adjunto del propietario se guardó byte a byte, antes de cualquier otra
escritura, en:

`reports/e2-paquete-liberacion-preparado-20260921/autorizacion-fase-b-20260922-recibida.txt`

Su SHA-256 es
`ea0115d5b57cc3ca5a356271e65164f00bca5acd60f58ac83a4f605f572f788b`.

El manifiesto aprobado conserva SHA-256
`8e9ffc71872d16b0193b00d51aa1f4cd47458bef918057a0ef8529f3f34bb831`.
No se regeneraron expectativas ni se modificaron el bundle, SQL, wrapper o
lógica de preflight aprobados. El inventario de integridad aprobado sigue
pasando; estas evidencias operativas nuevas se conservan por separado.

## Orden ejecutado y resultados

1. **Entrada B0: PASS.** CLI original y conexión efectiva del proceso retenido.
   Coincidieron identidad y hashes aprobados. La conexión del shell se comparó
   internamente con la del proceso; no se registraron credenciales.
2. **Ventana sin escritores.** Se detuvo únicamente el workflow de API.
   B0 se comprobó otra vez después de detenerlo. El respaldo y la operación
   exigieron cero otros client backends. No se reanudó la API entre respaldo
   y postflight.
3. **Respaldo completo: PASS.** Dump custom completo, ownership y ACL incluidos,
   snapshot REPEATABLE READ READ ONLY, sin excluir tablas o filas.
   Restauración local comparada con todos los datos, catálogo semántico y
   secuencias. No hubo cambio de secuencias durante el dump.
4. **Google Drive: PASS.** Carpeta y archivo con permisos solo de propietario.
   Archivo remoto `1axX9PuTdeVoQbceX_l0CVDA6z1OOSsvc`, tamaño 522472 bytes.
   Dump original y descarga con SHA-256 idéntico:
   `fbd7fd4bbbc1b2411ab8c7c40ad40047c552d3388ff8697a49f21a6cd7b649f6`.
   Se restauró la descarga en otra instancia desechable y las comparaciones
   completas dieron PASS. No se usó solamente la copia local como evidencia.
5. **Runtime retenido conservado.** Archivo local comprimido con dist completo,
   workers, mapas, fuentes/licencia, preflight retenido, comando/configuración
   de recuperación y cierre de dependencias externas de Google Cloud Storage
   (64 unidades pnpm). No se sobrescribió ni movió el dist servido anteriormente.
6. **B0 final y conservación del respaldo: PASS.** El catálogo y los datos vivos
   seguían idénticos al respaldo justo antes del SQL. Cero otros clientes.
7. **SQL A+C exacto: PASS, un intento.** Instalación aprobada, ON_ERROR_STOP,
   lock_timeout 2 s, statement_timeout 60 s. No hubo reintentos, reparación,
   reversión, purga, backfill ni ejecución del SQL de devolución.
8. **Postflight SQL y B1: PASS.** Las 69 tablas preexistentes conservan sus filas
   y valores comparando columnas preexistentes. Se conservaron valores e
   is_called de las secuencias. Solo se añadieron las dos tablas A+C previstas,
   ambas vacías; las marcas e2_insert_xid históricas permanecieron NULL.
9. **Un único arranque de liberación: PASS.** El workflow de API existente
   invoca el wrapper aprobado desde la raíz, bajo observación de solo lectura
   `strace -f -e trace=openat`. El observador no cambia wrapper, bundle ni
   NODE_OPTIONS. Se conserva la traza; no se creó otra API o puerto operativo.
10. **Verificaciones de arranque: PASS.** PID 2419 coincide con el PID exec_target
    registrado por el wrapper. Puerto 8080, API_INSPECTION_BOOT=1,
    NODE_ENV=development. Hubo prueba positiva de B1 antes del exec y aviso
    explícito de inicializadores/backfill/monitor pausados. Las aperturas de
    thread-stream-worker.mjs y pino-pretty.mjs se atribuyeron a un hilo del
    mismo proceso API, no a los procesos sha256sum del wrapper.
11. **Salud y preservación posterior: PASS.** `/api/healthz` respondió HTTP 200
    con `{"status":"ok"}`. Comparación completa posterior contra el estado al
    commit: datos, catálogo semántico y secuencias, incluido is_called, sin
    cambios. Los hashes aprobados siguen coincidiendo. La vista de acceso de
    Mariana carga; no se inició sesión ni se creó ningún ticket o cierre.

## Incidencia de cierre de instancias desechables

Después de las verificaciones de liberación, la orden de parada del primer
PostgreSQL desechable devolvió exit 1 porque su PID ya no existía. No se
reintentó ni se presentó esa orden como exit 0. Las comprobaciones posteriores
de ambos clusters confirmaron `pg_ctl status` exit 3 (sin servidor), ausencia
de sus PIDs y `pg_isready` exit 2 (sin respuesta). Sus directorios permanecen
conservados, junto con dumps y evidencias. No se borró nada ni se reinició
la API por esta incidencia. Detalle en `disposable-clusters-retained.json`.

## Estado final y límites

- E2 CLOSED servido por el bundle aprobado
  `008dfd54d93f6a1606370d44cb2086673669c51278c92ebb6a5a63f4d503e7f5`.
- Bundle retenido intacto:
  `3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98`.
- Captura, devolución, retenidos, atribución y Fondo continúan cerrados.
  Remate, precio mínimo y borrado de producto no se activaron.
- No se cambió a modo normal, no se publicó, no se instaló frontend y
  no se modificó el workflow web.
- El primer cierre con tickets en efectivo y transferencia **no fue ejecutado
  por el agente**. Queda pendiente para el propietario en Mariana.
- Respaldos, runtime retenido, directorios desechables y evidencia se conservan
  hasta instrucción expresa posterior. No se ejecutó purga ni reversión.

## Evidencia principal

- `e2-backup-restore-20260922-metadata.json`
- `drive-verification.json` y `drive-restoration.json`
- `retained-runtime.json`
- `b0-final.json`, `sql-attempt.json`, `sql-result.json`, `postflight-sql.json`
- `sql-preservation.json`, `startup-preservation.json`
- `runtime-verification.json`, `startup-audit-preserved.json`
- `startup-log-preserved.log`, `candidate-worker-open.trace`
- `disposable-clusters-retained.json`
- `workflows-before.json`, `workflows-after.json`