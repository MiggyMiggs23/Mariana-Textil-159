# E10 — resultado de aplicación operativa

## Resultado

**PASS / COMMITTED_VERIFIED**, 18 de septiembre de 2026,
12:55:58 America/Mexico_City (18:55:58 UTC).

Se aplicó únicamente el archivo autorizado
`reports/e10-aislado-2026-09-18/sql/operativo.sql`, sin cambiar sus bytes:

`a7eb52a85b3b3b6072d1b88941b9998bcafe15b253e52b0520b8bfc8cc43cdb4`

La autorización textual se guardó antes de la operación en
`reports/e10-autorizacion-operativa-2026-09-18.md`.

- 30 sentencias enviadas y 30 confirmadas, incluidos BEGIN y COMMIT.
- COMMIT confirmado y resultado vuelto a verificar desde una conexión nueva
  de sólo lectura. No se perdió su respuesta; cero reintentos automáticos.
- Transacción: 369.650 ms. Supervisor independiente: límite de 30 segundos.
- Límites de servidor: bloqueo 2 s, sentencia 15 s, inactividad transaccional 20 s.
- El supervisor comprobó la desaparición del backend exacto antes de desarmarse.
- No se ejecutaron fixtures ni DDL ajeno; no se modificaron E1, E9 ni E12.

Evidencia completa:
`operational-run-1789757757707-63932.json`, con los hashes de identidad y gates,
inventario, comparación antes/después y SHA del operador ejecutado.
La revisión base se registra sólo como contexto; no se atribuye a ella la
verificación del operador nuevo, cuyos bytes se fijan por SHA-256.

## Identidad y comprobación inmediatamente anterior

La identidad se obtuvo del BoundPool del proceso API vivo, PID 60771, mediante
una transacción READ ONLY seguida de ROLLBACK. El inspector temporal de
loopback se cerró. La conexión ejecutora y la del supervisor cotejaron:

- Base `heliumdb`, OID 16384; rol `postgres`; esquema `public`.
- PostgreSQL 16.10; system identifier `7676894468493955091`.
- Inicio de servidor `2026-09-18 15:21:20.26807+00`.
- Socket declarado `/run/postgresql`, puerto configurado 5432,
  dirección/puerto TCP nulos y replicación `origin`.

El preflight de sólo lectura comparó la operativa y la restauración nueva con
las mismas consultas. Coincidieron esquema, contenido de las 66 tablas
originales, estados de secuencias, usuarios y sesiones. Las tres guardas E1
coincidieron en definición y habilitación con su evidencia operativa aceptada.
No había objetos Fondo ni event triggers habilitados.

La conexión ejecutora volvió a verificar el estado inmediatamente antes del
DDL y rechazaba discrepancias. Evidencia:
`readonly-preflight-1789757731649-63893.json` y `execution-gates.json`.

Un primer intento de preflight no llegó al DDL: la restauración local ya no
tenía proceso servidor al terminar el shell finito del respaldo. Se arrancó
únicamente ese mismo cluster restaurado como proceso persistente, sin recrearlo
ni tocar la API o la copia del ensayo. La comparación posterior pasó completa.
Esto no fue un reintento de migración.

## Respaldo nuevo y Drive

Captura: 18/09/2026 12:48:23 America/Mexico_City. Snapshot exportado
REPEATABLE READ READ ONLY y dump custom completo, sin excluir tablas ni
sesiones existentes; restauración comprobada y secuencias sin cambios durante
la captura.

- Archivo: `.local/backups/e10-operativo-20260918124823-63437/e10-operativo-20260918124823-63437.dump`.
- Tamaño: **497065 bytes**.
- SHA-256 local y de la descarga desde Drive:
  `4f126fdc916a548bf8bdc3af7310a2acd3a3808fbf5dcd0c4c7afb0d85f51d0e`.
- Archivo de Drive:
  https://drive.google.com/file/d/1VxwiYsAlhsexJ0gB67G7t9CHQvkoPJCo/view
- Privacidad comprobada: sin compartir, sólo propietario; mismo tamaño y hash
  después de descargar. La URL de sesión de carga no se registró.
- Pruebas: `backup-restore-metadata.json`, `backup-restore.md` y
  `drive-verification.json`.

La API permaneció activa: el DDL es aditivo para estructura todavía sin uso.
Los bloqueos sobre catálogos existentes quedaron limitados a 2 segundos y la
transacción a 30 segundos mediante supervisión independiente. No se reinició
la API ni se inició sesión para verificar esta operación.

## Preservación y alcance pendiente

La lectura posterior confirmó:

- Esquema, contenido y secuencias de las 66 tablas originales idénticos al
  preflight, sin omitir columnas ni tablas.
- Los mismos **31 usuarios y 9 sesiones preexistentes**, con hashes idénticos.
  No se crearon cuentas ni sesiones de aplicación.
- Las tres guardas E1 intactas.
- Inventario E10 esperado: 3 tablas, 1 secuencia, 8 índices explícitos,
  4 funciones, 8 triggers y 12 checks nombrados.
- Un registro de configuración del Fondo, **cero movimientos y cero arqueos**.

**No se capturó saldo inicial ni dinero real y el Fondo continúa deshabilitado.**
No se declara E10 cerrado ni se habilita E9/E12.

Se conservan hasta que E10 cierre:

1. Copia del ensayo original: socket `/tmp/e10-0918-pg`, puerto 55432,
   base `e10_ensayo_20260918`; no se alteró.
2. Respaldo nuevo local y en Drive, junto con su descarga verificada.
3. Restauración nueva: socket
   `/tmp/prompt-h-block2-20260918124823-63437-63437`, puerto 5432,
   base `restore_disposable_20260918124823-63437`.

La comprobación global de tipos se documentará con su revisión exacta por
separado; el PASS de instalación SQL no sustituye esa comprobación.