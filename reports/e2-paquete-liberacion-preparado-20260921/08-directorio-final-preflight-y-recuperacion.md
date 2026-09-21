# Directorio definitivo, verificaciones y recuperación

**NO AUTORIZABLE — STOP por fallo real de arranque y preflight omitido en el
runner con enlace simbólico.** El documento 10 registra el diagnóstico.
Los procedimientos futuros de este documento quedan bloqueados; no corregir
runtime/preflight ni reintentar como si solo faltara completar una prueba.

## Procedencia y límites

Autorización: `autorizacion-directorio-final-y-arranque.txt`.
Composición exacta, no HEAD arbitrario:

- Fuente: `31804125a1e752bde128d72e9fd44d23972ffff1`.
- Superposición de los dos tests: `07cc804a35b6bba7f3ed640129231ba7434a8767`.
- Único cambio del build: `e0f1c227e013c59987c06604e21a8036e73c82a5`.
  Ese commit contiene solo la selección de directorio de salida en `build.mjs`.
- 1,261 archivos API/lib contrastados con esos blobs: cero diferencias no
  autorizadas. Detalle en `manifest-final.json`.

La compilación se ejecutó desde la exportación aislada con `env -i`,
allowlist PATH/HOME/LANG/API_BUILD_OUTPUT_DIR, sin `.env` ni credenciales,
directamente en el directorio nuevo:

`/home/runner/workspace/artifacts/api-server/dist-e2-20260927`

No se movió ni sobrescribió `artifacts/api-server/dist`. Su `index.mjs` conserva
`3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98`.
El nuevo hash autorizado por el cambio de directorio es
`1102baeec9de7d7c7773f142a835f39234ec1ba2f278373cdedcd4814ff2feb3`.
Los workers de Pino apuntan ahora al directorio definitivo, no a `/tmp`.
No se parchearon bytes del bundle ni se cambió el plugin.

## Verificaciones terminadas

| Verificación | Resultado |
|---|---|
| Typecheck raíz, exportación y tests actualizados | PASS, todos los paquetes, cero diagnósticos |
| Compilación en directorio final | exit 0 |
| Selección explícita sin base/red | 119/119 PASS |
| Wrapper/registrador, usando ejecutable centinela, no API | 8/8 PASS |
| Preflight completo, PostgreSQL 16.10 nuevo vacío | 19 comprobaciones PASS |
| Detención y destrucción del PostgreSQL de preflight | verificadas |
| API candidata real | FAIL: no healthz 200 en 30 s; importación bloqueada antes de listen |
| Workers reales | thread-stream-worker.mjs y pino-pretty.mjs abiertos correctamente según strace |
| Preflight del arranque real | no demostrado: guard CLI omitió main por diferencia de ruta symlink/real |
| Limpieza del intento real | candidato detenido; PostgreSQL stop exit 0 y directorio destruido |

El agente principal ejecutó `validate-candidate-start.mjs` con entorno limpio,
PostgreSQL nuevo en socket privado/55439 y HTTP 18092. La consulta inicial
SELECT 1 pasó y se emitió INSPECTION; el aviso no equivale a servidor escuchando.
El ciclo async inventario → salida-venta-reservation → inventario bloquea
`await import("./app")` antes de `app.listen`. No se obtuvo healthz 200.

El preflight directo probado independientemente sí pasó; en este intento,
la comparación argv/import.meta.url del guard CLI no coincide por el symlink
y omite main. Su exit 0 no prueba validación de base. El runner tampoco llegó
a la comparación posterior de catálogo/filas/secuencias: no se afirma ese PASS.
Los resultados y traza se preservan en
`verificacion-final/failed-start-20260921-212811/`. Las pruebas 19+8+119 siguen
válidas en sus alcances independientes, no como validación del recorrido real.
No se aplicaron correcciones después del diagnóstico; fase B queda bloqueada.

## Preflight externo y controles de arranque

`release-preflight.mjs` nunca importa el backend. Su consulta es REPEATABLE READ
READ ONLY y termina con ROLLBACK; limita espera a 2 s y sentencias a 15 s.
Usa la misma DATABASE_URL que usará el runtime, sin heredar otro destino PG.
Rechaza selectores de base de prueba/preload y exige INSPECTION/development.

El preflight compara:

- Identidad completa declarada: base `heliumdb`, OID `16384`, esquema `public`,
  rol `postgres`, PostgreSQL `160010`; no acepta solo un nombre de base.
- Catálogo completo: tablas, columnas, defaults, constraints, índices,
  funciones, triggers y secuencias; incluye las dependencias de Caja/auditoría
  para snapshot, E1, E8 y demás rutas del bundle.
- Atributos: estado de triggers y deferrabilidad, validación de constraints/
  índices, propietarios/privilegios de funciones, seguridad de tablas y enums.
- Ausencia de event triggers habilitados y sesión efectivamente READ ONLY.

`--before` exige B0 exacto sin A+C; el modo por defecto exige B1 completo.
No acepta el catálogo observado para “actualizar” automáticamente expectativas.
B0 fue reconstruido vacío a partir del inventario archivado: 1,519 filas y
hash `37f6af5a2e06748a8499b995caeec072770090c36f2ad741d35c65953421bec8`.
B1 se derivó aplicando únicamente el SQL autorizado sobre esa reconstrucción.
No se usó un clon E1/E10, un respaldo de datos ni una consulta a la base API.
`release-expected.json` conserva las expectativas exactas y sus hashes.

Las pruebas PostgreSQL introdujeron/restauraron exclusivamente en esa base
desechable guardas E1/A+C deshabilitadas, columna ajena y permiso de función
alterado: todos fueron rechazados antes de restaurar. También se rechazaron
A+C ausente, identidad errónea y modo incorrecto; se probó el CLI final.

El wrapper preparado `api-start-audit.sh`:

1. Fija el hash de `release-assets.sha256` y verifica todos los artefactos.
2. Exporta INSPECTION/development y ejecuta el preflight externo.
3. Repite toda la verificación de hashes inmediatamente antes de exec.
4. Registra el intento con PID real, hash del candidato y resultado.
5. Hace exec del bundle del directorio nuevo; no compila ni aplica SQL.

Fallo de append de auditoría: advertencia no fatal. Fallo de hash/preflight:
fatal, sin exec. La matriz de ocho pruebas lo demuestra sin ejecutar la API.
No se reemplazaron los scripts antiguos ni se conectó nada al workflow.

## Respaldo Google Drive y ventana — procedimiento futuro, no ejecutado

Ventana: domingo 27 de septiembre de 2026; hora a completar por el propietario.

1. Confirmar autorización fase B, hashes, destino y ausencia de escritores
   antes de intervenir. No usar una purga o autorización del 13 de septiembre
   como autorización de esta ventana.
2. Preflight `--before`; si falla, detener, sin reparar automáticamente.
3. Con escritores pausados, obtener respaldo completo de la base y conservar
   la totalidad del bundle actualmente servido, workers, mapas, fonts,
   preflight y comando de recuperación. No basta guardar solo index.mjs.
4. Usar el procedimiento del 13 de septiembre: cargar respaldo en Google
   Drive, verificar identificador remoto/tamaño/checksum, volver a descargar
   y ensayar restauración desechable. Registrar los resultados y retención;
   un archivo local no satisface la exigencia Google Drive.
5. Solo tras verificar respaldo/restauración, capturar B0 de datos y secuencias,
   aplicar el SQL exacto de instalación con ON_ERROR_STOP y confirmar el delta.
   Comparar filas por sus columnas preexistentes, no incluyendo xid8 nuevo.
   A+C debe quedar vacío y sin backfill de marcas históricas.
6. Ejecutar postflight SQL y preflight B1. Si cualquiera falla, no iniciar
   operación ni cambiar expectativas para ocultar diferencias.
7. Arrancar exclusivamente mediante el wrapper aprobado en la misma ventana,
   mantener captura/devolución apagadas y verificar identidad, modo y salud.
8. Primer cierre: propietario en Mariana, con tickets de prueba en efectivo
   y transferencia. Conservar snapshot y evidencia; la purga final es futura.

No se realizó respaldo local/Drive, restauración de datos, parada de escritores,
SQL operativo ni cierre de caja durante esta preparación.

## Recuperación sin pérdida de evidencia

- Antes de cualquier nuevo snapshot/captura: detener únicamente el candidato
  de liberación, conservar evidencia, comprobar A+C vacío y guardas CLOSED,
  aplicar la reversión exacta solo si sus condiciones y fase B lo permiten,
  verificar nuevamente B0 y volver al comando/bundle retenidos completos.
  No usar la reversión como “paso 2” normal de instalación.
- Si hubo snapshot nuevo: no borrar auditoría ni recomputar cierres; no
  afirmar que el lector antiguo es compatible. Conservar esquema/snapshots,
  cerrar operación y mantener una versión E2 CLOSED compatible (estos bytes
  candidatos verificados), sin reconstrucción improvisada ni downgrade ciego.
- Si existe evidencia A+C o difiere la guarda esperada: no vaciar tablas ni
  desactivar triggers para forzar rollback. Detener y reportar.
- Google Drive permanece como custodia verificable del respaldo previo;
  restaurar un respaldo no puede descartar movimientos posteriores sin una
  decisión explícita. No se ejecuta recuperación durante la preparación.

## Preparaciones abortadas, no resultados falsos

El primer fixture vacío omitía las funciones C usadas por defaults; se corrigió
su orden antes de aplicarlo exitosamente. También se incluyeron los enums de
proveedores/solicitudes exportados fuera de enums.ts. Un intento de conexión
entre llamadas encontró el servidor temporal ya detenido; no ejecutó pruebas.
El runner definitivo agrupa initdb, validación y destrucción en un proceso y
siempre conserva el resultado terminal. El clúster abortado fue eliminado.
Estos fallos de preparación no se presentan como defectos del código de negocio.