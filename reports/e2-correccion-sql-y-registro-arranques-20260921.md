# Corrección SQL A+C y registro de arranques — cierre

## Paso 1 y autorización

Antes de cualquier escritura se leyeron `/proc/132/cmdline`,
`/proc/132/cwd` y los bytes del bundle referenciado. El PID **132** ejecutaba
`artifacts/api-server/dist/index.mjs` desde `/home/runner/workspace`.

SHA-256 completo observado, idéntico al autorizado:

```text
3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98
```

No se importó ni ejecutó el bundle para comprobarlo. Esta evidencia relaciona
el proceso con el archivo y su hash; no es una extracción de su código en memoria.
La primera escritura fue guardar íntegro el [texto del propietario](e2-apertura-limitada/evidencia-a-c/autorizacion-propietario-correccion-sql-y-registro-arranques.txt).
El [registro del paso 1](e2-apertura-limitada/evidencia-a-c/paso-1-integridad-runtime-20260921.json)
conserva comando, ruta y ambos hashes.

## Corrección y validación PostgreSQL

**Revisión SQL exacta:** `d3b3154753563adc1a64ee1427518a6e6a0a22d6`.

Se agrupó con paréntesis el `CASE` dentro del `IF` del instalador. Se revisaron
los tres SQL preparados completos. No se modificaron sus reglas de negocio,
las guardas E1, el runtime ni la evidencia del fallo anterior.

En PostgreSQL 16.10, con un clúster nuevo y socket privado, sin listener TCP:

- El SQL anterior reprodujo su error y no dejó objetos A+C.
- Instalación corregida, reversión vacía, reinstalación y preflight SQL: **PASS**.
- Validación completa: **51 casos, 47 PASS y 4 FAIL**, proceso **exit 1**.
- Se ejecutaron todos los casos del harness anterior, sin cambiar expectativas.
- Los cuatro fallos corresponden a fuentes ordinarias/retenidas creadas después
  de `SAVEPOINT`, con la subtransacción activa o ya liberada. La comparación de
  `xmin` contra `txid_current()` rechaza esos casos. Esta lógica no se reparó:
  excede la corrección de sintaxis/impedimentos de instalación autorizada.
- La caracterización de reversos dentro de la fixture parcial no acredita
  integridad global ni una vulnerabilidad explotable en producción.

**Resultado global: FAIL; no es aprobación de apertura.**

La base desechable se destruyó pese al resultado FAIL: DROP y parada exit 0,
estado posterior sin servidor, PID/socket/directorio ausentes.
No se usó la base de la API ni los clones E1/E10, ni se importaron sus datos.
La coordinación comprobó también la ausencia del PID y directorio al cierre.

Informe completo, límites de la fixture y los 51 resultados:
[e2-validacion-postgresql-corregida-20260921.md](e2-validacion-postgresql-corregida-20260921.md).

Commits de evidencia PostgreSQL:

- `971d577d4cd4cee651c6e344b4356eea83b0037c`
- `0ce158878b233e4335ddb4479333c3605c3f4091`

## Registro de arranques: preparado, NO activado

**Revisión exacta de scripts y pruebas:** `9c2fd42dc1f87c5dd919ad4908aaaf63a9122520`.
Reporte específico: `ea3f9561031ee89c7f4d6f884eac568b6782a182`.

El wrapper `scripts/api-start-audit.sh` instala su propio paso antes del preflight.
Conserva los controles de hash y el comando de preflight sin modificar
`runtime-preflight.mjs`. Recoge su resultado y agrega una única línea JSON antes
del `exec` de la API, o al rechazo controlado previo:

- Fecha/hora UTC.
- PID del shell que heredará el `exec`; los rechazos se identifican como
  shell sin API, no como proceso API arrancado.
- SHA-256 completo del bundle; si no se puede leer, null y código de error.
- `NODE_ENV` y `API_INSPECTION_BOOT` efectivos, que son los selectores del
  bundle retenido. Las fuentes futuras tienen otros modos, no presentes en él.
- Resultado del preflight, su código de salida y etapa del arranque.

El destino es `reports/arranques-api.log`, abierto exclusivamente en modo append.
No trunca, borra ni rota. Un fallo de registro advierte y no cambia la decisión
ni el código de salida del arranque original.

**8/8 pruebas aisladas PASS** con stubs en `/tmp`: PID heredado, hashes,
resultados/códigos, fallo de preflight, conservación de líneas previas,
concurrencia, permisos denegados reales y ausencia de un secreto canario.
No se ejecutó el preflight real ni el bundle en estas pruebas.
Una línea anterior al exec registra un intento, no certifica que la API
después escuche o esté sana. SIGKILL, disco lleno o escritura parcial pueden
impedir una línea completa; el registro sigue sin ser una barrera de arranque.

### Cambio detenido por la condición de no reiniciar

No hay garantía de que cambiar el comando del servicio gestionado no provoque
un reinicio. Por esa razón **no se modificó el workflow ni `artifact.toml`**.
El registro todavía no está conectado y **no se creó un arranque ficticio
en el log real**.

Comando propuesto para sustituir únicamente el comando de desarrollo del mismo
servicio, **en el próximo arranque autorizado, no ahora**:

```sh
cd /home/runner/workspace && exec bash scripts/api-start-audit.sh
```

No crear otro workflow ni alterar puertos, rutas o entorno. El detalle de
implementación y pruebas está en
[registro-arranques-preparado.txt](e2-apertura-limitada/evidencia-a-c/registro-arranques-preparado.txt).

## Integridad al cierre

Observada a **2026-09-21T17:44:22.740Z**:

- PID **132**, mismo inicio **2026-09-21 17:26:03 UTC**.
- Bundle: `3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98`.
- Preflight: `9a87b47b52d3776b10d760bdab6b9f5e71158f75ef71921ec8adbb3e0585de9f`.
- Workflow/configuración sin cambios; sin reinicios, builds o instalaciones.
- Base aislada destruida; no consultas ni escrituras a la base de la API.
- Captura y devolución siguen cerradas.

Evidencia: [integridad-final-correccion-20260921.json](e2-apertura-limitada/evidencia-a-c/integridad-final-correccion-20260921.json).

Este cierre no autoriza reparar los cuatro fallos de contrato, abrir operación
ni aplicar el comando al workflow en ejecución.# Corrección SQL A+C y registro de arranques — cierre

## Paso 1 y autorización

Antes de cualquier escritura se leyeron `/proc/132/cmdline`,
`/proc/132/cwd` y los bytes del bundle referenciado. El PID **132** ejecutaba
`artifacts/api-server/dist/index.mjs` desde `/home/runner/workspace`.

SHA-256 completo observado, idéntico al autorizado:

```text
3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98
```

No se importó ni ejecutó el bundle para comprobarlo. Esta evidencia relaciona
el proceso con el archivo y su hash; no es una extracción de su código en memoria.
La primera escritura fue guardar íntegro el [texto del propietario](e2-apertura-limitada/evidencia-a-c/autorizacion-propietario-correccion-sql-y-registro-arranques.txt).
El [registro del paso 1](e2-apertura-limitada/evidencia-a-c/paso-1-integridad-runtime-20260921.json)
conserva comando, ruta y ambos hashes.

## Corrección y validación PostgreSQL

**Revisión SQL exacta:** `d3b3154753563adc1a64ee1427518a6e6a0a22d6`.

Se agrupó con paréntesis el `CASE` dentro del `IF` del instalador. Se revisaron
los tres SQL preparados completos. No se modificaron sus reglas de negocio,
las guardas E1, el runtime ni la evidencia del fallo anterior.

En PostgreSQL 16.10, con un clúster nuevo y socket privado, sin listener TCP:

- El SQL anterior reprodujo su error y no dejó objetos A+C.
- Instalación corregida, reversión vacía, reinstalación y preflight SQL: **PASS**.
- Validación completa: **51 casos, 47 PASS y 4 FAIL**, proceso **exit 1**.
- Se ejecutaron todos los casos del harness anterior, sin cambiar expectativas.
- Los cuatro fallos corresponden a fuentes ordinarias/retenidas creadas después
  de `SAVEPOINT`, con la subtransacción activa o ya liberada. La comparación de
  `xmin` contra `txid_current()` rechaza esos casos. Esta lógica no se reparó:
  excede la corrección de sintaxis/impedimentos de instalación autorizada.
- La caracterización de reversos dentro de la fixture parcial no acredita
  integridad global ni una vulnerabilidad explotable en producción.

**Resultado global: FAIL; no es aprobación de apertura.**

La base desechable se destruyó pese al resultado FAIL: DROP y parada exit 0,
estado posterior sin servidor, PID/socket/directorio ausentes.
No se usó la base de la API ni los clones E1/E10, ni se importaron sus datos.
La coordinación comprobó también la ausencia del PID y directorio al cierre.

Informe completo, límites de la fixture y los 51 resultados:
[e2-validacion-postgresql-corregida-20260921.md](e2-validacion-postgresql-corregida-20260921.md).

Commits de evidencia PostgreSQL:

- `971d577d4cd4cee651c6e344b4356eea83b0037c`
- `0ce158878b233e4335ddb4479333c3605c3f4091`

## Registro de arranques: preparado, NO activado

**Revisión exacta de scripts y pruebas:** `9c2fd42dc1f87c5dd919ad4908aaaf63a9122520`.
Reporte específico: `ea3f9561031ee89c7f4d6f884eac568b6782a182`.

El wrapper `scripts/api-start-audit.sh` instala su propio paso antes del preflight.
Conserva los controles de hash y el comando de preflight sin modificar
`runtime-preflight.mjs`. Recoge su resultado y agrega una única línea JSON antes
del `exec` de la API, o al rechazo controlado previo:

- Fecha/hora UTC.
- PID del shell que heredará el `exec`; los rechazos se identifican como
  shell sin API, no como proceso API arrancado.
- SHA-256 completo del bundle; si no se puede leer, null y código de error.
- `NODE_ENV` y `API_INSPECTION_BOOT` efectivos, que son los selectores del
  bundle retenido. Las fuentes futuras tienen otros modos, no presentes en él.
- Resultado del preflight, su código de salida y etapa del arranque.

El destino es `reports/arranques-api.log`, abierto exclusivamente en modo append.
No trunca, borra ni rota. Un fallo de registro advierte y no cambia la decisión
ni el código de salida del arranque original.

**8/8 pruebas aisladas PASS** con stubs en `/tmp`: PID heredado, hashes,
resultados/códigos, fallo de preflight, conservación de líneas previas,
concurrencia, permisos denegados reales y ausencia de un secreto canario.
No se ejecutó el preflight real ni el bundle en estas pruebas.
Una línea anterior al exec registra un intento, no certifica que la API
después escuche o esté sana. SIGKILL, disco lleno o escritura parcial pueden
impedir una línea completa; el registro sigue sin ser una barrera de arranque.

### Cambio detenido por la condición de no reiniciar

No hay garantía de que cambiar el comando del servicio gestionado no provoque
un reinicio. Por esa razón **no se modificó el workflow ni `artifact.toml`**.
El registro todavía no está conectado y **no se creó un arranque ficticio
en el log real**.

Comando propuesto para sustituir únicamente el comando de desarrollo del mismo
servicio, **en el próximo arranque autorizado, no ahora**:

```sh
cd /home/runner/workspace && exec bash scripts/api-start-audit.sh
```

No crear otro workflow ni alterar puertos, rutas o entorno. El detalle de
implementación y pruebas está en
[registro-arranques-preparado.txt](e2-apertura-limitada/evidencia-a-c/registro-arranques-preparado.txt).

## Integridad al cierre

Observada a **2026-09-21T17:44:22.740Z**:

- PID **132**, mismo inicio **2026-09-21 17:26:03 UTC**.
- Bundle: `3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98`.
- Preflight: `9a87b47b52d3776b10d760bdab6b9f5e71158f75ef71921ec8adbb3e0585de9f`.
- Workflow/configuración sin cambios; sin reinicios, builds o instalaciones.
- Base aislada destruida; no consultas ni escrituras a la base de la API.
- Captura y devolución siguen cerradas.

Evidencia: [integridad-final-correccion-20260921.json](e2-apertura-limitada/evidencia-a-c/integridad-final-correccion-20260921.json).

Este cierre no autoriza reparar los cuatro fallos de contrato, abrir operación
ni aplicar el comando al workflow en ejecución.# Corrección SQL A+C y registro de arranques — cierre

## Paso 1 y autorización

Antes de cualquier escritura se leyeron `/proc/132/cmdline`,
`/proc/132/cwd` y los bytes del bundle referenciado. El PID **132** ejecutaba
`artifacts/api-server/dist/index.mjs` desde `/home/runner/workspace`.

SHA-256 completo observado, idéntico al autorizado:

```text
3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98
```

No se importó ni ejecutó el bundle para comprobarlo. Esta evidencia relaciona
el proceso con el archivo y su hash; no es una extracción de su código en memoria.
La primera escritura fue guardar íntegro el [texto del propietario](e2-apertura-limitada/evidencia-a-c/autorizacion-propietario-correccion-sql-y-registro-arranques.txt).
El [registro del paso 1](e2-apertura-limitada/evidencia-a-c/paso-1-integridad-runtime-20260921.json)
conserva comando, ruta y ambos hashes.

## Corrección y validación PostgreSQL

**Revisión SQL exacta:** `d3b3154753563adc1a64ee1427518a6e6a0a22d6`.

Se agrupó con paréntesis el `CASE` dentro del `IF` del instalador. Se revisaron
los tres SQL preparados completos. No se modificaron sus reglas de negocio,
las guardas E1, el runtime ni la evidencia del fallo anterior.

En PostgreSQL 16.10, con un clúster nuevo y socket privado, sin listener TCP:

- El SQL anterior reprodujo su error y no dejó objetos A+C.
- Instalación corregida, reversión vacía, reinstalación y preflight SQL: **PASS**.
- Validación completa: **51 casos, 47 PASS y 4 FAIL**, proceso **exit 1**.
- Se ejecutaron todos los casos del harness anterior, sin cambiar expectativas.
- Los cuatro fallos corresponden a fuentes ordinarias/retenidas creadas después
  de `SAVEPOINT`, con la subtransacción activa o ya liberada. La comparación de
  `xmin` contra `txid_current()` rechaza esos casos. Esta lógica no se reparó:
  excede la corrección de sintaxis/impedimentos de instalación autorizada.
- La caracterización de reversos dentro de la fixture parcial no acredita
  integridad global ni una vulnerabilidad explotable en producción.

**Resultado global: FAIL; no es aprobación de apertura.**

La base desechable se destruyó pese al resultado FAIL: DROP y parada exit 0,
estado posterior sin servidor, PID/socket/directorio ausentes.
No se usó la base de la API ni los clones E1/E10, ni se importaron sus datos.
La coordinación comprobó también la ausencia del PID y directorio al cierre.

Informe completo, límites de la fixture y los 51 resultados:
[e2-validacion-postgresql-corregida-20260921.md](e2-validacion-postgresql-corregida-20260921.md).

Commits de evidencia PostgreSQL:

- `971d577d4cd4cee651c6e344b4356eea83b0037c`
- `0ce158878b233e4335ddb4479333c3605c3f4091`

## Registro de arranques: preparado, NO activado

**Revisión exacta de scripts y pruebas:** `9c2fd42dc1f87c5dd919ad4908aaaf63a9122520`.
Reporte específico: `ea3f9561031ee89c7f4d6f884eac568b6782a182`.

El wrapper `scripts/api-start-audit.sh` instala su propio paso antes del preflight.
Conserva los controles de hash y el comando de preflight sin modificar
`runtime-preflight.mjs`. Recoge su resultado y agrega una única línea JSON antes
del `exec` de la API, o al rechazo controlado previo:

- Fecha/hora UTC.
- PID del shell que heredará el `exec`; los rechazos se identifican como
  shell sin API, no como proceso API arrancado.
- SHA-256 completo del bundle; si no se puede leer, null y código de error.
- `NODE_ENV` y `API_INSPECTION_BOOT` efectivos, que son los selectores del
  bundle retenido. Las fuentes futuras tienen otros modos, no presentes en él.
- Resultado del preflight, su código de salida y etapa del arranque.

El destino es `reports/arranques-api.log`, abierto exclusivamente en modo append.
No trunca, borra ni rota. Un fallo de registro advierte y no cambia la decisión
ni el código de salida del arranque original.

**8/8 pruebas aisladas PASS** con stubs en `/tmp`: PID heredado, hashes,
resultados/códigos, fallo de preflight, conservación de líneas previas,
concurrencia, permisos denegados reales y ausencia de un secreto canario.
No se ejecutó el preflight real ni el bundle en estas pruebas.
Una línea anterior al exec registra un intento, no certifica que la API
después escuche o esté sana. SIGKILL, disco lleno o escritura parcial pueden
impedir una línea completa; el registro sigue sin ser una barrera de arranque.

### Cambio detenido por la condición de no reiniciar

No hay garantía de que cambiar el comando del servicio gestionado no provoque
un reinicio. Por esa razón **no se modificó el workflow ni `artifact.toml`**.
El registro todavía no está conectado y **no se creó un arranque ficticio
en el log real**.

Comando propuesto para sustituir únicamente el comando de desarrollo del mismo
servicio, **en el próximo arranque autorizado, no ahora**:

```sh
cd /home/runner/workspace && exec bash scripts/api-start-audit.sh
```

No crear otro workflow ni alterar puertos, rutas o entorno. El detalle de
implementación y pruebas está en
[registro-arranques-preparado.txt](e2-apertura-limitada/evidencia-a-c/registro-arranques-preparado.txt).

## Integridad al cierre

Observada a **2026-09-21T17:44:22.740Z**:

- PID **132**, mismo inicio **2026-09-21 17:26:03 UTC**.
- Bundle: `3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98`.
- Preflight: `9a87b47b52d3776b10d760bdab6b9f5e71158f75ef71921ec8adbb3e0585de9f`.
- Workflow/configuración sin cambios; sin reinicios, builds o instalaciones.
- Base aislada destruida; no consultas ni escrituras a la base de la API.
- Captura y devolución siguen cerradas.

Evidencia: [integridad-final-correccion-20260921.json](e2-apertura-limitada/evidencia-a-c/integridad-final-correccion-20260921.json).

Este cierre no autoriza reparar los cuatro fallos de contrato, abrir operación
ni aplicar el comando al workflow en ejecución.# Corrección SQL A+C y registro de arranques — cierre

## Paso 1 y autorización

Antes de cualquier escritura se leyeron `/proc/132/cmdline`,
`/proc/132/cwd` y los bytes del bundle referenciado. El PID **132** ejecutaba
`artifacts/api-server/dist/index.mjs` desde `/home/runner/workspace`.

SHA-256 completo observado, idéntico al autorizado:

```text
3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98
```

No se importó ni ejecutó el bundle para comprobarlo. Esta evidencia relaciona
el proceso con el archivo y su hash; no es una extracción de su código en memoria.
La primera escritura fue guardar íntegro el [texto del propietario](e2-apertura-limitada/evidencia-a-c/autorizacion-propietario-correccion-sql-y-registro-arranques.txt).
El [registro del paso 1](e2-apertura-limitada/evidencia-a-c/paso-1-integridad-runtime-20260921.json)
conserva comando, ruta y ambos hashes.

## Corrección y validación PostgreSQL

**Revisión SQL exacta:** `d3b3154753563adc1a64ee1427518a6e6a0a22d6`.

Se agrupó con paréntesis el `CASE` dentro del `IF` del instalador. Se revisaron
los tres SQL preparados completos. No se modificaron sus reglas de negocio,
las guardas E1, el runtime ni la evidencia del fallo anterior.

En PostgreSQL 16.10, con un clúster nuevo y socket privado, sin listener TCP:

- El SQL anterior reprodujo su error y no dejó objetos A+C.
- Instalación corregida, reversión vacía, reinstalación y preflight SQL: **PASS**.
- Validación completa: **51 casos, 47 PASS y 4 FAIL**, proceso **exit 1**.
- Se ejecutaron todos los casos del harness anterior, sin cambiar expectativas.
- Los cuatro fallos corresponden a fuentes ordinarias/retenidas creadas después
  de `SAVEPOINT`, con la subtransacción activa o ya liberada. La comparación de
  `xmin` contra `txid_current()` rechaza esos casos. Esta lógica no se reparó:
  excede la corrección de sintaxis/impedimentos de instalación autorizada.
- La caracterización de reversos dentro de la fixture parcial no acredita
  integridad global ni una vulnerabilidad explotable en producción.

**Resultado global: FAIL; no es aprobación de apertura.**

La base desechable se destruyó pese al resultado FAIL: DROP y parada exit 0,
estado posterior sin servidor, PID/socket/directorio ausentes.
No se usó la base de la API ni los clones E1/E10, ni se importaron sus datos.
La coordinación comprobó también la ausencia del PID y directorio al cierre.

Informe completo, límites de la fixture y los 51 resultados:
[e2-validacion-postgresql-corregida-20260921.md](e2-validacion-postgresql-corregida-20260921.md).

Commits de evidencia PostgreSQL:

- `971d577d4cd4cee651c6e344b4356eea83b0037c`
- `0ce158878b233e4335ddb4479333c3605c3f4091`

## Registro de arranques: preparado, NO activado

**Revisión exacta de scripts y pruebas:** `9c2fd42dc1f87c5dd919ad4908aaaf63a9122520`.
Reporte específico: `ea3f9561031ee89c7f4d6f884eac568b6782a182`.

El wrapper `scripts/api-start-audit.sh` instala su propio paso antes del preflight.
Conserva los controles de hash y el comando de preflight sin modificar
`runtime-preflight.mjs`. Recoge su resultado y agrega una única línea JSON antes
del `exec` de la API, o al rechazo controlado previo:

- Fecha/hora UTC.
- PID del shell que heredará el `exec`; los rechazos se identifican como
  shell sin API, no como proceso API arrancado.
- SHA-256 completo del bundle; si no se puede leer, null y código de error.
- `NODE_ENV` y `API_INSPECTION_BOOT` efectivos, que son los selectores del
  bundle retenido. Las fuentes futuras tienen otros modos, no presentes en él.
- Resultado del preflight, su código de salida y etapa del arranque.

El destino es `reports/arranques-api.log`, abierto exclusivamente en modo append.
No trunca, borra ni rota. Un fallo de registro advierte y no cambia la decisión
ni el código de salida del arranque original.

**8/8 pruebas aisladas PASS** con stubs en `/tmp`: PID heredado, hashes,
resultados/códigos, fallo de preflight, conservación de líneas previas,
concurrencia, permisos denegados reales y ausencia de un secreto canario.
No se ejecutó el preflight real ni el bundle en estas pruebas.
Una línea anterior al exec registra un intento, no certifica que la API
después escuche o esté sana. SIGKILL, disco lleno o escritura parcial pueden
impedir una línea completa; el registro sigue sin ser una barrera de arranque.

### Cambio detenido por la condición de no reiniciar

No hay garantía de que cambiar el comando del servicio gestionado no provoque
un reinicio. Por esa razón **no se modificó el workflow ni `artifact.toml`**.
El registro todavía no está conectado y **no se creó un arranque ficticio
en el log real**.

Comando propuesto para sustituir únicamente el comando de desarrollo del mismo
servicio, **en el próximo arranque autorizado, no ahora**:

```sh
cd /home/runner/workspace && exec bash scripts/api-start-audit.sh
```

No crear otro workflow ni alterar puertos, rutas o entorno. El detalle de
implementación y pruebas está en
[registro-arranques-preparado.txt](e2-apertura-limitada/evidencia-a-c/registro-arranques-preparado.txt).

## Integridad al cierre

Observada a **2026-09-21T17:44:22.740Z**:

- PID **132**, mismo inicio **2026-09-21 17:26:03 UTC**.
- Bundle: `3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98`.
- Preflight: `9a87b47b52d3776b10d760bdab6b9f5e71158f75ef71921ec8adbb3e0585de9f`.
- Workflow/configuración sin cambios; sin reinicios, builds o instalaciones.
- Base aislada destruida; no consultas ni escrituras a la base de la API.
- Captura y devolución siguen cerradas.

Evidencia: [integridad-final-correccion-20260921.json](e2-apertura-limitada/evidencia-a-c/integridad-final-correccion-20260921.json).

Este cierre no autoriza reparar los cuatro fallos de contrato, abrir operación
ni aplicar el comando al workflow en ejecución.