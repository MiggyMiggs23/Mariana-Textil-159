# E1 — SQL concreto para revisión, bloqueos y respaldo

**17 de septiembre de 2026 · NO EJECUTADO · NO-GO para ejecución**

Se preparan las sentencias, no se implementa la aplicación. No se ha recibido autorización para ejecutarlas. La instrucción «Ya hay creditos vas» se interpreta como continuar la preparación solicitada, no como autorización de un SQL que aún no se había presentado.

## 1. Resultado y límite de esta entrega

- Propuesta: **27 sentencias**, identificadas S01–S27, en `reports/e1-sql/01-propuesta.sql`.
- Reversión condicionada: **28 sentencias**, S01–S28, en `reports/e1-sql/02-reversion-condicionada.sql`.
- Los dos archivos están reproducidos completos al final de este documento, con las funciones y triggers incluidos: no se omiten cuerpos ni se dejan instrucciones «por implementar».
- **Falta confirmar la identidad actual desde el pool del proceso de la API.** No se cumple todavía ese requisito del propietario. No se pide autorización para ejecutar este borrador incompleto en cuanto a su destino.
- Los dos scripts tienen un **bloqueo fijo en S07**, dentro de la transacción y antes del primer DDL. Abortarían aunque se intentaran ejecutar. Retirarlo exige completar la identidad, revisar el catálogo vivo y volver a presentar el archivo exacto para aprobación; no es una bandera que se deba desactivar por conveniencia.

Se añadió al plan U el requisito de E3: comprobar que el cajero comprende la pregunta sobre naturaleza, especialmente la diferencia entre dinero nuevo y recaptura contable. **No se diseñó la pantalla ni su redacción.**

## 2. Base objetivo: antecedente confirmado, confirmación actual pendiente

| Evidencia | Resultado y alcance |
|---|---|
| Identidad previa obtenida dentro del pool de la API | `heliumdb`, esquema `public`, PostgreSQL `16.10`, el **15/09/2026 a las 21:08:34.332, hora de México**. Fuente: `reports/prompt-h/api-pool-identity-2026-09-15.md`. |
| Respaldo previo a la desactivación del catálogo | Confirma `heliumdb` y PostgreSQL 16.10 para aquel respaldo, no para el proceso actual. |
| Workflow actual | El estado consultado devuelve `running`, puerto 8080. El GET sin autenticación a `/api/healthz` respondió 200. Ese endpoint **no consulta la identidad de la base**. |
| Proceso actual en logs | La API registra PID 306; los procesos visibles desde las herramientas de shell de esta sesión no incluyen ese proceso. |
| Inspector | No hay inspector escuchando en `127.0.0.1:9229`. No se abrió uno, no se enviaron señales a procesos ni se reinició la API. |
| Resultado actual | **Identidad del pool actual NO CONFIRMADA.** `heliumdb/public` es solamente el destino candidato del borrador. Un nombre de base, un puerto HTTP o un conector instalado no bastan para identificar la instancia. |

No se consultó una base diferente para hacer pasar esa comprobación. No se leyeron cadenas de conexión, credenciales ni valores de entorno. Tampoco se creó una ruta de diagnóstico.

### Consulta exacta de identidad pendiente

Debe ejecutarse **desde el pool ya usado por la API**, no desde otro pool creado con una URL supuestamente equivalente:

```sql
SELECT
  current_database() AS database_name,
  (SELECT oid FROM pg_database WHERE datname = current_database()) AS database_oid,
  current_schema() AS schema_name,
  current_user AS database_role,
  current_setting('server_version') AS server_version,
  inet_server_addr() AS server_address,
  inet_server_port() AS server_port,
  pg_backend_pid() AS backend_pid,
  pg_postmaster_start_time() AS server_started_at,
  current_setting('application_name') AS application_name,
  clock_timestamp() AS observed_at
;
```

**No se ejecutó esa consulta en esta entrega.** Su resultado deberá acompañarse de la evidencia de qué proceso y objeto pool la emitieron. Los identificadores deben compararse también con la conexión que ejecutaría la migración. La guarda actual de nombre/versión es una defensa adicional, no reemplaza esta comprobación.

El procedimiento histórico usó un inspector temporal y privado del proceso existente. En esta sesión no está disponible el acceso local a ese proceso; arrancar una API nueva o reutilizar el informe viejo no demostraría la conexión del proceso actual. El arranque normal ejecuta inicializadores y no se usará como atajo.

## 3. Qué cambia el SQL

### Tabla existente alterada: `public.movimientos_credito`

Agrega **siete columnas**, todas sin valor por defecto:

| Columna | Tipo | Uso |
|---|---|---|
| `sitio_origen_id` | integer | Sitio explícito del hecho, sin inferir la recepción desde una nota. |
| `sesion_caja_id` | integer | Sesión del efectivo real, no de una transferencia ni corrección. |
| `naturaleza` | enum nuevo | Exactamente una de las cuatro categorías aprobadas en cada inserción nueva. |
| `operacion_productor` | text | Espacio de identidad del productor. |
| `operacion_clave` | uuid | Clave estable de reintento dentro de ese productor. |
| `nota_origen_id` | integer | Evidencia de nota de origen cuando sea identificable. No es la nota elegida para aplicar un cobro. |
| `origen_justificacion` | text | Justificación del ajuste sin nota identificable y de la corrección/recaptura. |

Se agregan cuatro claves foráneas, un índice único parcial de operación y un trigger que valida **cada INSERT**, incluso con fecha histórica. Las columnas aceptan NULL a nivel de almacenamiento para conservar los históricos; el trigger no lo admite para origen, naturaleza y operación de una fila nueva.

Las FK se declaran `NOT VALID`: no se escanean registros anteriores para validarlas, pero sí se exigen a nuevas escrituras. No se interpreta ese nombre como «desactivadas». No se agrega una excepción por fecha, por ID ni por tipo de cliente.

### Tablas nuevas, inicialmente vacías

1. **`operaciones_credito_e1`**: identidad `(productor, clave)`, naturaleza, actor y contenido canónico de la petición. Siete productores de crédito y un productor exclusivo para recepción pendiente. Es inmutable.
2. **`cobros_credito_pendientes_e1`**: recepción real separada del libro de crédito, con cliente, importe, fecha real, sitio, medio/cuenta, sesión cuando corresponda, motivo o referencia, autor y operación. No crea un ABONO ni una aplicación.
3. **`atribuciones_credito_e1`**: constancia histórica inmutable, movimiento original, fecha exacta, snapshot de identidad, sitio, evidencia, motivo y autor. La cadena de rectificaciones permite una sola raíz y un solo sucesor por constancia; no se edita el original.

### Otros objetos nuevos

- Enum `naturaleza_credito_e1`, con los cuatro valores aprobados.
- Vista `saldos_cobros_credito_e1`: en E1 muestra el importe íntegro como pendiente, sin saldo editable. E5 deberá sustituir la derivación al incorporar aplicaciones; **esa aplicación no se construye aquí**.
- Cinco funciones de validación/inmutabilidad y seis triggers nuevos.
- Las claves primarias, unicidad y restricciones declaradas en las tablas nuevas. Los identificadores son UUID; no se crean ni avanzan secuencias operativas existentes.

### Tablas existentes referenciadas, sin modificar sus filas

`usuarios`, `ubicaciones`, `clientes`, `sesiones_caja` y `tickets` reciben referencias de las FK nuevas; ello implica objetos internos de integridad y bloqueos de esquema, **no modificaciones de sus registros**.

Se comprueban las protecciones existentes de `movimientos_credito`, `ticket_pagos` y `aplicaciones_credito`. No se reemplazan sus funciones ni se quitan sus triggers. La propuesta no altera la tabla `auditoria` ni crea usuarios, sesiones o atribuciones.

## 4. Restricciones y alcance funcional

- Naturaleza obligatoria y compatible con productor/tipo de movimiento. Venta y cancelación sin dinero usan la cuarta categoría; baja incobrable usa corrección contable.
- Recepción pendiente prohibida dentro del libro de crédito por el validador de productor.
- Operaciones y sus movimientos deben coincidir en actor y naturaleza.
- Clave única por productor; una misma clave del mismo productor con distinta naturaleza no puede reservar otra operación. **El SQL no devuelve por sí solo una respuesta idempotente:** la API deberá comparar el contenido canónico y recuperar o rechazar el resultado correspondiente.
- Efectivo real exige `CAJA_FISICA` y sesión abierta del mismo sitio; transferencia no exige ni registra sesión de caja. Los medios históricos del enum no se borran.
- Corrección contable no se convierte en efectivo por conservar un medio de pago histórico.
- Sitio activo de tipo TIENDA; nota de origen, cuando se indica, debe corresponder al cliente y sitio atribuido.
- Ajuste sin nota identificable exige justificación, no una nota inventada.
- Atribución solo por ADMIN/SUPERVISOR activo; el supervisor queda restringido a su sitio asignado. El servicio deberá autenticar el actor desde la sesión real y aplicar su autorización, no confiar en un ID escrito por el cliente.
- Inmutabilidad de las tres tablas nuevas: rechazo de UPDATE, DELETE y TRUNCATE, incluso cuando el intento no afectaría filas.

**El script no debe desplegarse por adelantado sobre los productores actuales.** Al instalar el trigger, sus INSERT sin datos E1 fallarían. Hace falta la adaptación coordinada de los siete productores y el rechazo claro de clientes antiguos; no habrá etapa permisiva que siga escribiendo filas incompletas. Preparar este SQL no activa la captura nueva, la atribución ni la recepción pendiente. No se implementan E2–E12.

## 5. Qué pasa con los movimientos y demás registros existentes

- No hay UPDATE, DELETE, TRUNCATE, recaptura, atribución ni backfill de datos existentes.
- Las siete columnas nuevas se observan como NULL en los registros anteriores. No se asigna un sitio ficticio ni una naturaleza histórica por defecto.
- Todos sus campos anteriores, identificadores, importes, fechas y relaciones deben permanecer iguales. Agregar columnas cambia el esquema y la forma de un `SELECT *`, no los valores anteriores.
- Los tres históricos del antecedente siguen sin sitio determinado. **No se confirmó aquí su conteo actual.**
- No cambia FIFO, la proyección, el límite, las aplicaciones ni las fórmulas de deuda, saldo a favor, Ventas o cobranza.
- Los objetos de catálogo PostgreSQL sí cambiarían: eso es precisamente el DDL cuya autorización falta.

Antes de una ejecución autorizada se deberá capturar una referencia consistente; después, comparar todas las filas y columnas previas, las aplicaciones, auditoría, secuencias y cifras. Para el ledger, la comparación debe excluir únicamente las siete columnas nuevas de la forma JSON posterior, no excluir registros ni campos monetarios antiguos. **Estas comparaciones no se han ejecutado.**

## 6. Sentencias, bloqueos y duración

Los archivos SQL contienen cada sentencia literal bajo su número. Este cuadro describe su efecto:

| Propuesta | Sentencia/efecto | Bloqueo relevante |
|---|---|---|
| S01–S06 | BEGIN y configuración local de tiempos, zona y búsqueda | No bloquean tablas operativas. |
| S07 | Guarda NO-GO, identidad candidata, colisiones y protecciones | En este borrador aborta antes de DDL. Una versión futura validaría además catálogo y ausencia de event triggers DDL activos no revisados. |
| S08 | LOCK de `movimientos_credito` | **ACCESS EXCLUSIVE**: bloquea lecturas y escrituras de esa tabla hasta COMMIT/ROLLBACK. |
| S09 | CREATE TYPE | Objetos de catálogo nuevos. |
| S10 | CREATE TABLE operaciones y FK a usuarios | Las FK pueden tomar **SHARE ROW EXCLUSIVE** en la tabla referenciada, impidiendo escrituras mientras se conserva el bloqueo. |
| S11 | CREATE TABLE recepciones y FK | Afecta por referencias a clientes, usuarios, ubicaciones y sesiones; las filas no se cambian. |
| S12 | CREATE TABLE atribuciones y FK | Referencias al ledger, usuarios y ubicaciones; el ledger ya está bloqueado por S08. |
| S13 | ALTER TABLE: columnas y FK | ACCESS EXCLUSIVE sobre ledger, ya adquirido; bloqueos de FK en ubicaciones, sesiones y tickets. |
| S14 | CREATE UNIQUE INDEX parcial | **Escanea el ledger completo** para construirlo, aunque los históricos no generen entradas por tener productor NULL. No es CONCURRENTLY y sigue vigente S08. |
| S15 | CREATE VIEW | Vista sobre una tabla nueva y vacía. |
| S16–S20 | CREATE FUNCTION | Nuevas funciones; no se ejecutan sus validadores durante la creación. No se sustituyen funciones existentes. |
| S21–S26 | CREATE TRIGGER | Bloqueos de esquema en sus tablas; sobre ledger ya existe el más fuerte de S08. No recorre ni reclasifica históricos. |
| S27 | COMMIT | Confirmaría todos los cambios juntos y liberaría bloqueos. En el borrador NO-GO no puede confirmar DDL. |

### ¿Por cuánto tiempo?

**No hay una duración medida ni una promesa de “no bloquea”.** Se propone una ventana controlada sin escritores. Los bloqueos se retienen hasta que termine la transacción, no solamente durante cada sentencia.

- `lock_timeout = '2s'`: máximo de espera por cada adquisición de bloqueo; no limita cuánto dura un bloqueo ya adquirido.
- `statement_timeout = '15s'`: límite por sentencia, incluido el escaneo del índice; no es un límite de 15 segundos para toda la transacción.
- `idle_in_transaction_session_timeout = '5s'`: evita dejar una transacción abierta sin actividad.
- PostgreSQL 16 no tiene el parámetro `transaction_timeout` de versiones posteriores. No se inventa ese límite en el SQL.
- Para una ejecución futura recomiendo además un **plazo total operativo de 30 segundos** en el ejecutor, con cancelación y ROLLBACK al excederse. Ese ejecutor no se ha construido ni probado en esta entrega; no se presenta como una garantía ya instalada. La liberación efectiva deberá comprobarse, también si hay desconexión o error.

Si los tiempos no bastan, se aborta. No se amplían en silencio ni se continúa por fragmentos. La elección de un índice normal mantiene transacción y reversión atómicas; usar CONCURRENTLY cambiaría el procedimiento y se presentaría de nuevo, no sería un ajuste improvisado.

La reversión S08 toma ACCESS EXCLUSIVE en el ledger y las tres tablas E1 para que no se inserte evidencia entre comprobarlas y retirar la estructura. Sus guardas y DROP también se mantienen en una única transacción.

## 7. Reversibilidad

### Antes de COMMIT

Un error aborta la transacción. El ejecutor debe parar al primer error y emitir `ROLLBACK` o cerrar la conexión, sin reintentos de fragmentos. El DDL de esta propuesta es transaccional y no incluye operaciones CONCURRENTLY.

### Después de COMMIT, sin ningún uso de E1

El segundo archivo retira únicamente los triggers, funciones, vista, índice, FK, columnas, tablas vacías y enum nuevos. **No usa CASCADE.** Primero bloquea y exige:

1. Las tres tablas E1 están vacías.
2. Ninguna de las siete columnas nuevas del ledger contiene un valor.
3. Los objetos son exactamente los instalados por esta migración, con definiciones verificadas antes de autorizar.
4. Las protecciones financieras anteriores continúan presentes.

Si hay cualquier dato E1, **la reversión se bloquea**. No se borra evidencia para hacerla pasar. En ese caso corresponde una corrección hacia adelante o un plan de recuperación expresamente autorizado. Retirar columnas tampoco restaura orden físico interno de atributos ni permite afirmar que el catálogo quedó idéntico byte a byte; conserva el esquema lógico previo y sus datos bajo las condiciones señaladas.

La reversión no reactiva deliberadamente productores antiguos en servicio: requiere parada coordinada y decisión de qué versión quedaría funcionando. El SQL de reversión también tiene bloqueo NO-GO y necesitaría autorización separada.

## 8. Respaldo: recomiendo uno nuevo, antes del DDL

**Sí, conviene y lo recomiendo como condición previa.**

El respaldo anterior se capturó el **17/09/2026 a las 00:17:15.548, hora de México** (`06:17:15.548Z`). La desactivación se confirmó a las **00:29:15.421** (`06:29:15.421Z`). Según los reportes:

- Se desactivaron 12 productos.
- Se agregaron 12 registros de auditoría.
- El respaldo anterior no contiene esos cambios.

Aunque desde entonces no hayas capturado más datos, restaurar ese respaldo completo reactivaría esos productos y perdería esa evidencia posterior. Además, no se puede deducir ausencia de escrituras automáticas de la ausencia de capturas manuales: hoy la API está activa.

Referencias: `reports/base-catalog-2026-09-17/block2-restore.md` y `reports/base-catalog-2026-09-17/resultado.md`. El respaldo anterior se conserva; no se sobrescribe.

El respaldo nuevo debería incluir datos, esquema, restricciones, triggers y secuencias, con hash de archivo y evidencia del instante capturado. Para que sea la referencia exacta del cambio, mantener controlados los escritores desde su captura hasta la operación; no reiniciar la API entre ambos porque sus inicializadores pueden escribir.

**No hice el respaldo ni restauré una copia.** La restauración de verificación requiere escrituras en una base desechable y deberá autorizarse de forma expresa, sin asumir excepción a la prohibición de usuarios/sesiones de prueba ni ejecutar las 28 suites pendientes.

## 9. Autorización y comprobaciones pendientes

Antes de la primera escritura deberán quedar en `reports/`:

1. Identidad actual demostrada desde el pool de la API y comparación con el ejecutor.
2. Inspección READ ONLY del catálogo efectivo, incluyendo objetos que puedan producir efectos ante DDL.
3. Archivos SQL finales, sus hashes, alcance, ventana de bloqueo y plan de recuperación.
4. Referencia del respaldo nuevo y las verificaciones autorizadas realmente realizadas.
5. **Autorización textual original del propietario**, con la base y las operaciones concretas que permite; aprobación del diseño no equivale a esta autorización.

No se solicita un “sí” genérico sobre este borrador con identidad pendiente. Completarla y retirar el bloqueo fijo cambiará el archivo, por lo que se presentará otra vez antes de pedir autorización de ejecución.

### Lo efectivamente hecho

- Revisión estática del esquema/código y reportes anteriores.
- Consulta del estado del workflow y lectura de logs.
- GET de salud sin autenticación: 200; comprobación de inspector: sin escucha.
- Escrituras **documentales**: requisito E3, memoria de esa decisión y esta propuesta SQL.
- **0 consultas SQL a la base. 0 sentencias de migración ejecutadas. 0 respaldos/restauraciones. 0 pruebas/suites/typechecks. 0 usuarios o sesiones creados. 0 reinicios.**

La sintaxis y los efectos no se han validado ejecutando PostgreSQL; son una revisión estática, no una suite aprobada ni una migración ensayada. La falta de identidad actual impide completar la entrega como paquete listo para autorización.

## Anexos — SQL literal, sentencia por sentencia

Los anexos siguientes reproducen los archivos indicados, sin ejecutar sus sentencias.