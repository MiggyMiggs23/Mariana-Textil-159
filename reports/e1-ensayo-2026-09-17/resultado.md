# E1 — identidad actual, respaldo verificado y ensayo medido

**17 de septiembre de 2026. Preparación y ensayo completados. Migración operativa NO ejecutada.**

El orden realizado fue: identidad desde el pool actual → pausa de API → respaldo y restauración verificada → Drive y descarga verificada → ensayo exclusivamente desechable → comprobación final de conservación del origen → presentación.

**La autorización textual de migración operativa todavía falta.** La API permanece pausada; no se ejecutaron sus inicializadores ni se habilitaron capturas.

## 1. Identidad confirmada hoy desde la API

El procedimiento del Prompt H sí se pudo repetir. El diagnóstico anterior de inaccesibilidad fue incorrecto: el filtro por nombre `node` no mostraba el proceso porque aparecía como **`MainThread`**.

- Proceso existente: **PID 306**, ejecutable Node, CWD de `artifacts/api-server`, bundle `dist/index.mjs`.
- Captura: breakpoint temporal en el método `query` de `pg-pool`; se tomó el objeto `this` existente, confirmado como **BoundPool** del PID 306.
- Se retiró el breakpoint y se reanudó el proceso antes de consultar.
- Se obtuvo una conexión de ese mismo pool, se inició **READ ONLY**, se consultó identidad/inventario y se cerró con ROLLBACK y liberación de conexión.
- Inspector utilizado únicamente en loopback, referencia temporal eliminada y puerto 9229 comprobado cerrado al terminar.
- No se creó un pool alternativo para acreditar esta identidad ni se enviaron peticiones autenticadas.

| Campo | Resultado |
|---|---|
| Observación PostgreSQL | **17/09/2026 16:46:46.894065, México** (`2026-09-17 22:46:46.894065+00`) |
| Base / esquema | **heliumdb / public** |
| OID de base | 16384 |
| Versión | PostgreSQL **16.10** |
| Rol de conexión | postgres |
| Inicio de esa instancia | `2026-09-17 21:43:07.917935+00` |
| Dirección y puerto SQL | NULL / NULL, conexión Unix |
| Transacción de diagnóstico | `transaction_read_only = on` |
| Movimientos de crédito | **3** |
| Tamaño total del libro observado | **73,728 bytes** |

Evidencia con SQL literal: `api-pool-identity.json`. La conexión del respaldo y la comprobación final se compararon con esta identidad, incluyendo OID e inicio de PostgreSQL; no se aceptó solamente la coincidencia del nombre de base.

## 2. Diferencia frente al antecedente de 60 tablas y 14 triggers

La base efectiva actual tiene **63 tablas y 17 triggers no internos**. Respecto del respaldo del catálogo se agregaron:

| Tabla | Trigger |
|---|---|
| `auditoria_faltante_reactivaciones` | `auditoria_faltante_reactivaciones_append_only` |
| `auditoria_sobrante_contextos` | `auditoria_sobrante_contextos_append_only` |
| `auditoria_sobrante_decisiones` | `auditoria_sobrante_decisiones_append_only` |

Esos objetos ya estaban presentes al consultar el pool, antes de este respaldo o del ensayo. **No son objetos E1 creados por esta entrega.** Se respaldaron y verificaron los 63/17 completos, sin reducir la revisión a los 60/14 anteriores.

## 3. Respaldo nuevo y restauración

- API detenida mediante su workflow y ausencia de PID/listener comprobada a las **16:51:07, México**.
- Snapshot capturado: **17/09/2026 16:51:08.099, México** (`2026-09-17T22:51:08.099Z`).
- Fuente dentro de una transacción **REPEATABLE READ READ ONLY**, snapshot exportado compartido con `pg_dump`.
- Cero otros clientes de esa base al tomar la referencia.
- Respaldo completo custom de PostgreSQL 16, con propiedad y ACL, sin filtrar tablas ni datos.
- Restauración en PostgreSQL 16.10 desechable, aislado por socket Unix privado; sin API, semillas ni nuevos usuarios/sesiones de aplicación.
- Resultado: **PASS**.

### Comparaciones verificadas

| Categoría | Inventario completo actual |
|---|---:|
| Tablas y sus conteos/huellas canónicas de filas | **63** |
| Columnas | **634** |
| Restricciones | **310** |
| Índices | **227** |
| Funciones | **50** |
| Triggers no internos, definiciones y estados | **17** |
| Secuencias y sus estados | **47** |

También se compararon propietarios, características de la base y los metadatos cubiertos por el procedimiento anterior. No hubo cambios de secuencias durante el respaldo.

La restauración compara el esquema semántico, no posiciones físicas internas de columnas ni tamaño físico de archivos. No se eliminaron restricciones, índices o triggers de la comparación para obtener PASS.

Evidencias: `block2-restore.md`, `block2-restore-metadata.json` y el snapshot privado indicado en esos archivos.

## 4. Drive y SHA-256 de la copia descargada

[Abrir el respaldo verificado en Drive](https://drive.google.com/file/d/1UgcoIAnLcynUZp-QGZ92TiVX0jcb0DQU/view?usp=drivesdk).

- Archivo: `Mariana-Textil-E1-preensayo-2026-09-17-165108.dump`.
- Tamaño local: **464,990 bytes**.
- Tamaño descargado de Drive: **464,990 bytes**.
- Permisos comprobados de carpeta y archivo: **solo propietario**, sin enlace público habilitado.
- Subida reanudable; descarga posterior independiente del archivo guardado.
- Verificación final de descarga: `2026-09-17T22:52:13.668Z`.

**SHA-256 local y descargado, idénticos:**

```text
583ac96297ca40573aa96249e2b25de68812f98bd7b675214473932fe81f2925
```

Evidencia: `drive-verification.json`. El respaldo anterior se conserva, sin sobrescribirlo.

## 5. Ensayo real sobre el clon

Se ejecutó el DDL que se había presentado, adaptando exclusivamente la guarda de destino para el nombre desechable y retirando el bloqueo fijo NO-GO **en las copias del ensayo**. Cada diferencia y hash está registrado en `rehearsaldraftpatch/`.

Los originales en `reports/e1-sql/` siguen intactos. No se ejecutaron contra `heliumdb`.

| Ejecución normal | Resultado | Duración total | Desde S08 adquirido hasta COMMIT confirmado |
|---|---|---:|---:|
| Migración | **27/27, COMMIT confirmado** | **321.519 ms** | **300.927 ms** |
| Reversión condicionada | **28/28, COMMIT confirmado** | **23.049 ms** | **16.090 ms** |

La adquisición del bloqueo S08 tardó **0.355 ms** en la migración y **0.243 ms** en la reversión. El índice parcial S14 se construyó en **2.832 ms**.

Son tiempos medidos con reloj monotónico desde el cliente, incluidos viajes de consulta/respuesta. La duración total incluye cerrar el cliente. El intervalo S08→COMMIT comienza cuando se recibe la confirmación del bloqueo y termina al recibir la de COMMIT; es una medición del cliente, no instrumentación interna exacta del servidor.

**No son una garantía de tiempo en operación:** el clon conserva el volumen lógico actual de tres movimientos, pero el estado de caché, almacenamiento y concurrencia puede diferir. Se hizo una ejecución normal de cada script, no un promedio ni un percentil.

### Conservación y reversión comprobadas

- Después de la migración había **66 tablas y 23 triggers no internos**: exclusivamente los objetos adicionales esperados.
- Las tres tablas E1 nuevas estaban vacías.
- Los tres movimientos anteriores conservaron todos sus campos previos; las siete columnas E1 nuevas quedaron NULL.
- Las filas, conteos y huellas de las 63 tablas anteriores coincidieron, junto con sus restricciones, índices, funciones, triggers y secuencias.
- Después de las **28 sentencias de reversión**, el clon volvió a **63 tablas y 17 triggers** y al esquema lógico anterior.
- Coincidieron también triggers internos, vistas, tipos y valores completos de secuencias.
- La única exclusión del comparador de columnas fue `ordinal_position`/`attnum`; el tamaño físico se conservó como telemetría, no como criterio de igualdad lógica.

Huella semántica completa del clon antes y después de revertir:

```text
06aee606e72b54f287e75b61c048aac04b1131c87484701c6e7f695d906d0987
```

Las duraciones de **cada sentencia** y los resultados detallados están en `ensayo.md` y `ensayo.json`.

### Incidencias de preparación, conservadas

Hubo dos intentos de conexión fallidos antes del ensayo válido: el servidor desechable no había quedado accesible entre llamadas. Ambos informes tienen **cero sentencias numeradas ejecutadas** y se conservaron como `primer-intento-sin-conexion-*` y `segundo-intento-sin-conexion-*`.

Se arrancó explícitamente el servidor desechable persistente con el socket privado y sin escucha TCP. Antes del ensayo válido, el ejecutor comprobó nombre de base desechable, versión, ruta real de datos y aislamiento Unix. No se modificó el SQL para ocultar un fallo de migración.

## 6. Qué sucede si la transacción se alarga

**Sí: el acceso al libro de crédito queda detenido mientras se mantiene ACCESS EXCLUSIVE.** Las lecturas y escrituras que necesitan esa tabla esperan hasta COMMIT o ROLLBACK, o fallan antes si alcanzan su propio tiempo de espera. Las FK también pueden detener escrituras sobre las tablas referenciadas durante la misma transacción.

Por eso la operación propuesta conserva la **API pausada**: no se expone al cajero a solicitudes que parezcan colgadas mientras corre el DDL.

### Plazo total propuesto y mecanismo ensayado

- Se mantienen **2 segundos por espera de bloqueo**, **15 segundos por sentencia** y **5 segundos de inactividad en transacción**.
- Se añade supervisión del ejecutor con un **presupuesto total de 30 segundos**, no uno nuevo por sentencia.
- La conexión de control se abre **antes** de empezar la transacción.
- Al vencer el plazo, se deja de enviar SQL y se solicita desde esa conexión `pg_terminate_backend(pid, 5000)`. Terminar el backend revierte su transacción aún no confirmada y libera sus bloqueos.
- Se comprueba la desaparición del backend y el resultado; no se considera suficiente un aviso de timeout del cliente.
- PostgreSQL 16 no aporta `transaction_timeout`. La supervisión externa está medida, pero **30 segundos es el umbral de interrupción, no una garantía de liberación exactamente en el milisegundo 30,000**. Hay latencia de cancelación y comprobación. La llamada de terminación espera hasta 5 segundos y el cliente de control tiene timeout de 7 segundos; un fallo de control deja el estado bloqueado para revisión, no produce un PASS.

**Si ya se envió COMMIT y se pierde su respuesta, no se puede asumir que hubo rollback.** Se debe comprobar el resultado real desde otra conexión y conservar la API detenida. No se repite la migración a ciegas. El ensayo de cancelación siguiente prueba el caso anterior al envío de COMMIT, no esa incertidumbre posterior.

### Prueba de cancelación real, separada de la medición normal

Se ejecutó otra transacción E1 únicamente en el clon; antes de COMMIT se agregó deliberadamente `SELECT pg_sleep(10)` y se redujo el plazo total del mismo mecanismo a **1,000 ms**:

| Comprobación | Resultado |
|---|---|
| Disparo del supervisor | **1,001.053 ms** desde el inicio medido |
| Total hasta finalizar la ronda cancelada | **1,103.604 ms** |
| Terminación confirmada por PostgreSQL | Sí |
| Backend desaparecido | Sí |
| COMMIT enviado | **No** |
| Esquema y datos iguales a la referencia anterior | **PASS** |
| Lectura posterior del libro | **3 movimientos**, respondió en **0.360 ms** |

Esto demuestra que el mecanismo interrumpió una transacción real, revirtió el DDL y liberó el libro. Los 1.104 segundos de esta prueba no son el tiempo de la migración normal; incluyen la espera sintética.

## 7. Comprobación final del origen

Después del ensayo se abrió una comprobación independiente **READ ONLY**, sin reiniciar la API:

- Identidad exacta nuevamente igual a la acreditada desde el pool.
- Cero otros clientes de la base.
- Coincidieron las **63 tablas**, conteos y huellas, **634 columnas**, **310 restricciones**, **227 índices**, **50 funciones**, **17 triggers** y **47 secuencias y estados** con el snapshot del respaldo.
- **Objetos E1 en el origen: 0.**
- Escrituras de esta comprobación: **0**.

Evidencia: `source-final-preservation.json`.

## 8. SQL operativo que se presenta para autorización

Se presentan dos archivos nuevos en `operativo-propuesto/`:

- `01.sql`: las **27 sentencias** de migración.
- `02.sql`: las **28 sentencias** de reversión condicionada.

Sus cuerpos DDL son iguales a los del ensayo. En S07, en vez de permitir el clon, se exige `heliumdb` y se agrega la identidad actual de instancia: OID, rol, versión, inicio de PostgreSQL y conexión Unix. También se actualizaron los comentarios para distinguir esta propuesta de los borradores anteriores. Los archivos **no se han ejecutado en la base operativa**.

Si se reinicia PostgreSQL o cambia esa identidad, la guarda rechazará la ejecución: debe reconfirmarse el destino y presentarse la revisión correspondiente. Antes del DDL debe repetirse también la comprobación de conservación contra el respaldo y la pausa de escritores.

La autorización futura debe identificar `operativo-propuesto/01.sql` por su hash y permitir únicamente la migración descrita. El segundo archivo se presenta como salida condicionada y no recibe autorización automática de ejecución.

### Límite de disponibilidad posterior

**El ensayo no demuestra que la aplicación ya esté adaptada a E1.** Al instalar el trigger, los productores actuales que omitan origen, naturaleza o clave de operación serán rechazados. El fin del bloqueo DDL no elimina esa incompatibilidad.

No se debe reiniciar la API como si E1 estuviera listo para operar. La adaptación coordinada de productores, permisos, reintentos y captura no se ejecutó en esta entrega; tampoco E2–E12. No se activa dinero retenido ni se atribuyen los tres históricos.

## 9. Alcance de lo verificado

- Dos diagnósticos de identidad desde el pool: el primero confirmó datos, pero los timestamps Date no se serializaron correctamente; el segundo los obtuvo como texto y constituye la evidencia completa.
- Un respaldo nuevo y una restauración completa verificada.
- Una subida a Drive y una descarga comprobada por tamaño/SHA-256 y permisos.
- Una migración normal desechable de 27 sentencias, una reversión normal de 28 y una prueba adicional de terminación antes de COMMIT.
- Una comprobación final de conservación en el origen.
- TypeScript revisado para las herramientas nuevas/adaptadas. No se ejecutó la suite completa de la aplicación.
- **0 semillas, usuarios o sesiones de aplicación creados como fixtures; 0 suites de creación de usuarios; 0 escrituras operativas de datos o DDL; 0 reinicios de API.**

No se probaron aquí los siete productores ni las validaciones de futuras inserciones con datos E1: el ensayo de esquema no equivale a esas pruebas funcionales. Tampoco se ensayó la reversión después de crear evidencia E1, caso que el SQL debe rechazar y cuya salida no es borrar datos.

**Estado final: respaldo y ensayo PASS; API pausada; esperando autorización textual antes de cualquier migración operativa.**