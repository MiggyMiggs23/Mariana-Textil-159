# Incidente: el segundo arranque entró al modo normal

## Resolución posterior

**RESUELTO / API EN EJECUCIÓN ACOTADA.** El arranque final aprobado ocurrió a
las `2026-09-18T22:16:58Z` (`2026-09-18 16:16:58` hora de México). El preflight
READ ONLY aprobó; el bundle registró explícitamente que inspection pausó
inicializadores, backfill y monitor de mínimos; después escuchó en el puerto
8080. La comprobación por proxy de `/api/healthz` respondió HTTP 200 con
`{"status":"ok"}`.

El log final se preservó como `workflow-final-success.log`, SHA-256
`94fda24b7dd71ff8443d13347208b96e4f187a6bafeb179ac9537d5d06330e40`.
Una lectura barata posterior confirmó cero timestamps nuevos de permisos y las
secuencias sin cambio (`34004`/`9828`) desde la lectura del incidente.

El incidente y sus efectos de abajo se conservan como historia; no se borran ni
se reinterpretan por el arranque exitoso.

Observación: `2026-09-18T22:10:44Z`–`22:14:15Z`.

## Dictamen

**STOP aplicado durante el incidente.** El preflight externo aprobó y el bundle autorizado
comenzó a escuchar, pero ejecutó todos los inicializadores, el backfill y el
poller del modo normal. El agente principal detuvo inmediatamente el workflow.
En ese momento no se autorizó otro arranque hasta revisar la barrera.

El log original se preservó como `workflow-restart2.log`, SHA-256
`22303ac8b7d243507c47e7679f5d1dec67bb892caedfa67e946692ae94d9b61e`.

## Causa comprobada

La fuente exacta del commit 7cb y el bundle instalado **sí contienen** el modo
inspection. `startupMode(process.env)` solo entra en ese modo cuando
`API_INSPECTION_BOOT === "1"`; entonces omite `ensureStartupSchemas`, backfill y
poller. El bundle contiene tanto esa condición como el mensaje de modo.

El comportamiento observado acredita que el proceso Node no recibió
`API_INSPECTION_BOOT` con valor exacto `1`. Aunque `artifact.toml` declaraba
`[services.development.env]`, esa metadata no resultó efectiva para este
proceso administrado. No se atribuye al bundle la ausencia del modo y no se
afirma una causa interna de plataforma más específica sin evidencia.

El preflight anterior no comprobaba esas variables y su propio proceso terminó
antes del `exec`; por eso pudo aprobar y después el bundle eligió normal.

## Efectos comprobados por lectura

La lectura posterior fue `REPEATABLE READ READ ONLY` y terminó con `ROLLBACK`.

- Identidad: `heliumdb`, OID `16384`, `public`, rol `postgres`, PostgreSQL
  `160010`.
- Catálogo: 69 tablas, 1,519 filas y SHA canónico E10
  `37f6af5a2e06748a8499b995caeec072770090c36f2ad741d35c65953421bec8`;
  cero drift. Las tres guardas E1 siguen cerradas y habilitadas.
- Operaciones desde `22:10:44Z`: cero tickets, pagos de ticket, aperturas o
  cierres de caja, movimientos de crédito, auditorías, movimientos/arqueos de
  Fondo y notificaciones de crédito/sistema.
- Backfill: el propio log informa `inserted: 0`.
- Transacciones al observar: cero clientes con transacción abierta, cero
  `idle in transaction` y cero preparadas.

Permisos contra el respaldo operativo:

- 192/192 filas de rol, 54/54 de sitio, 0/0 overrides y 31/31 entradas de
  usuario;
- cero altas/bajas, cambios efectivos o cambios de ID/autor;
- matriz de 3,968 decisiones: cero diferencias, SHA
  `a305a672a33a6846244dd48389a2d82bf02795fbb8d78b1d547ffbed79e0cc8e`.

Sí se actualizaron timestamps durante el incidente: 70 filas de rol entre
`22:10:45.062642Z` y `22:10:45.940034Z`, y las 54 filas de sitio a
`22:10:45.940034Z`. Todas las 192 filas de rol ya difieren en timestamp del
respaldo histórico por inicializaciones acumuladas; esto no es cambio efectivo.

Las secuencias observadas quedaron en `permisos_rol_id_seq=34004` y
`permisos_ubicacion_id_seq=9828`. La última observación documentada anterior
era 33917/9774; no hubo snapshot inmediatamente anterior a este segundo
arranque, por lo que se registran la diferencia (+87/+54) y su ventana, sin
atribuir cada consumo individual más allá de la evidencia.

## Barrera corregida y estado

`runtime-preflight.mjs` ahora aborta **antes de invocar `psql`** si faltan
`API_INSPECTION_BOOT=1` o `NODE_ENV=development`. Negativo probado con un
`psql` centinela: exit 1 y centinela no invocado. Positivo con variables
explícitas: PASS contra el catálogo real. SHA nuevo:
`9a87b47b52d3776b10d760bdab6b9f5e71158f75ef71921ec8adbb3e0585de9f`.

Después de la revisión del agente principal, el comando administrado final quedó
configurado: fija ambos hashes, exporta explícitamente las
dos variables, ejecuta el preflight y vuelve a fijar el hash del bundle justo
antes de `exec`. Todo ocurre en el mismo shell, por lo que ya no depende de la
metadata de entorno ignorada. Cualquier variable ausente, preflight fallido o
cambio del bundle aborta antes de importar la API.

No se reparó/restauró la base, no se construyó otro bundle y no se activó A+C.
