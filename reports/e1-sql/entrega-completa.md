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

### Huellas de los archivos presentados

```text
15148edc4555b90a0007dba4536c0a60ecb9904f5885b457ade99b2fe72d931a  reports/e1-sql/01-propuesta.sql
d2324e980e128f264ea64187df932f48ae8386e1a830c2b958675d1bb3b9b7e7  reports/e1-sql/02-reversion-condicionada.sql
```

### Anexo A — 01-propuesta.sql (S01–S27)

```sql
-- UNEXECUTED DRAFT / BORRADOR NO EJECUTADO. No constituye permiso de ejecución.
-- CANDIDATO: heliumdb/public, PostgreSQL 16, según informe anterior;
-- NO confirmado actualmente mediante API ni mediante consulta al catálogo vivo.
-- Fuentes inspeccionadas: schema/{pos,users,locations,clientes,enums}.ts y
-- lib/clientes-schema.ts. Las guardas verifican expectativas, no certifican
-- que el catálogo actual ya haya sido inspeccionado.
-- Ejecutar únicamente tras autorización separada, como un único script y
-- deteniendo el cliente ante el primer error. No ejecutar por fragmentos.
-- No contiene DML, backfill, fixtures, grants, extensiones ni inicializador.
-- Los productores existentes fallarán al insertar sin el contrato E1 completo:
-- su adaptación/despliegue coordinado corresponde al servicio, no a este SQL.
-- El servicio debe autenticar al actor, autorizar el scope explícito solicitado
-- y construir/comparar una solicitud JSONB canónica completa. La PK sólo evita
-- duplicados; NO implementa la comparación de payload, respuesta ni retry.
-- En E1 no hay aplicaciones de cobros pendientes, FIFO ni estados de aprobación.
-- Las filas históricas quedan con todas las columnas nuevas NULL, sin DEFAULT.
-- Un índice parcial de unicidad requiere leer el ledger durante su creación;
-- los límites de tiempo abortan la transacción, nunca autorizan un bypass.
-- BLOQUEO FIJO NO-GO en S07: este archivo aborta antes del primer DDL.
-- La identidad efectiva de la API sigue sin confirmar. Quitar ese bloqueo
-- requerirá nueva presentación del archivo exacto y autorización posterior.

-- S01
BEGIN;
-- S02
SET LOCAL lock_timeout = '2s';
-- S03
SET LOCAL statement_timeout = '15s';
-- S04
SET LOCAL idle_in_transaction_session_timeout = '5s';
-- S05
SET LOCAL TIME ZONE 'UTC';
-- S06
SET LOCAL search_path = pg_catalog, public;

-- S07: identidad, dependencias y reserva estricta de nombres E1, antes del DDL.
DO $guard$
DECLARE
  r record;
BEGIN
  RAISE EXCEPTION 'E1_NO_GO: identidad actual del pool de la API no confirmada; este borrador no puede ejecutarse';
  IF current_database() <> 'heliumdb' THEN
    RAISE EXCEPTION 'Destino incorrecto: se requiere heliumdb; recibido %', current_database();
  END IF;
  IF current_setting('server_version_num')::integer NOT BETWEEN 160000 AND 169999 THEN
    RAISE EXCEPTION 'Este borrador requiere PostgreSQL 16';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'public') THEN
    RAISE EXCEPTION 'Falta el esquema public';
  END IF;
  IF current_setting('session_replication_role') <> 'origin' THEN
    RAISE EXCEPTION 'Se requiere session_replication_role=origin';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtenabled <> 'D') THEN
    RAISE EXCEPTION 'E1: hay event triggers DDL activos; revisar efectos antes de autorizar';
  END IF;
  FOR r IN SELECT unnest(ARRAY[
    'movimientos_credito', 'usuarios', 'ubicaciones', 'clientes',
    'sesiones_caja', 'tickets', 'ticket_pagos', 'aplicaciones_credito'
  ]) AS nombre LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = r.nombre AND c.relkind = 'r'
    ) THEN
      RAISE EXCEPTION 'Falta tabla ordinaria esperada public.%', r.nombre;
    END IF;
  END LOOP;
  -- Se reserva conservadoramente todo nombre con sufijo _e1 en public,
  -- incluyendo índices/PK/tipos compuestos y nombres de arrays implícitos.
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND right(c.relname, 3) = '_e1'
  ) OR EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND right(t.typname, 3) = '_e1'
  ) OR EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND right(p.proname, 3) = '_e1'
  ) OR EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public' AND right(c.conname, 3) = '_e1'
  ) OR EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND right(t.tgname, 3) = '_e1'
  ) THEN
    RAISE EXCEPTION 'Colisión de objetos E1: no se admite ejecución parcial ni repetida';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.movimientos_credito'::regclass
      AND NOT attisdropped AND attname = ANY (ARRAY[
        'sitio_origen_id', 'sesion_caja_id', 'naturaleza',
        'operacion_productor', 'operacion_clave', 'nota_origen_id',
        'origen_justificacion'
      ])
  ) THEN
    RAISE EXCEPTION 'Colisión de columnas E1 en movimientos_credito';
  END IF;
  FOR r IN SELECT * FROM (VALUES
    ('movimientos_credito', 'movimientos_credito_inmutables', 'prevent_financial_record_mutation', 27),
    ('ticket_pagos', 'ticket_pagos_inmutables', 'prevent_financial_record_mutation', 27),
    ('aplicaciones_credito', 'aplicaciones_credito_inmutables', 'prevent_financial_record_mutation', 27),
    ('aplicaciones_credito', 'aplicaciones_credito_validas', 'validate_credit_application', 7),
    ('movimientos_credito', 'movimientos_credito_reversos_validos', 'validate_credit_reversal', 7)
  ) AS x(tabla, disparador, funcion, bits) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_proc p ON p.oid = t.tgfoid
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE t.tgrelid = to_regclass('public.' || r.tabla)
        AND t.tgname = r.disparador AND NOT t.tgisinternal
        AND t.tgenabled IN ('O', 'A') AND t.tgtype = r.bits
        AND n.nspname = 'public' AND p.proname = r.funcion
        AND p.pronargs = 0
    ) THEN
      RAISE EXCEPTION 'Guarda de trigger existente falló: %.%', r.tabla, r.disparador;
    END IF;
  END LOOP;
END;
$guard$;

-- S08: estabiliza el ledger hasta COMMIT; no deshabilita sus triggers.
LOCK TABLE public.movimientos_credito IN ACCESS EXCLUSIVE MODE;

-- S09
CREATE TYPE public.naturaleza_credito_e1 AS ENUM (
  'INGRESO_FISICO',
  'DEVOLUCION_FISICA',
  'CORRECCION_CONTABLE',
  'OPERACION_CREDITO_SIN_DINERO'
);

-- S10: siete productores del ledger y un productor exclusivo de cobro pendiente.
CREATE TABLE public.operaciones_credito_e1 (
  productor text NOT NULL,
  clave uuid NOT NULL,
  naturaleza public.naturaleza_credito_e1 NOT NULL,
  usuario_id integer NOT NULL,
  solicitud_canonica jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT operaciones_pk_e1 PRIMARY KEY (productor, clave),
  CONSTRAINT operaciones_actor_fk_e1 FOREIGN KEY (usuario_id)
    REFERENCES public.usuarios(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT operaciones_json_ck_e1 CHECK (
    jsonb_typeof(solicitud_canonica) = 'object' AND solicitud_canonica <> '{}'::jsonb
  ),
  CONSTRAINT operaciones_fecha_ck_e1 CHECK (isfinite(created_at)),
  CONSTRAINT operaciones_productor_naturaleza_ck_e1 CHECK (
    (productor IN ('VENTA_CREDITO', 'CANCELACION_VENTA_CREDITO')
      AND naturaleza = 'OPERACION_CREDITO_SIN_DINERO')
    OR (productor IN ('AJUSTE_MANUAL', 'BAJA_INCOBRABLE')
      AND naturaleza = 'CORRECCION_CONTABLE')
    OR (productor IN ('ABONO_ORDINARIO', 'ABONO_DIRIGIDO')
      AND naturaleza IN ('INGRESO_FISICO', 'CORRECCION_CONTABLE'))
    OR (productor = 'REVERSO_ABONO'
      AND naturaleza IN ('DEVOLUCION_FISICA', 'CORRECCION_CONTABLE'))
    OR (productor = 'COBRO_PENDIENTE' AND naturaleza = 'INGRESO_FISICO')
  )
);

-- S11: recibo real e inmutable, no abono del ledger ni aplicación.
CREATE TABLE public.cobros_credito_pendientes_e1 (
  operacion_productor text NOT NULL,
  operacion_clave uuid NOT NULL,
  naturaleza public.naturaleza_credito_e1 NOT NULL,
  cliente_id integer NOT NULL,
  importe numeric(12,2) NOT NULL,
  fecha_real timestamptz NOT NULL,
  sitio_origen_id integer NOT NULL,
  medio public.forma_pago_cuenta NOT NULL,
  cuenta_destino text NOT NULL,
  sesion_caja_id integer,
  motivo text,
  referencia text,
  usuario_id integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT cobros_pk_e1 PRIMARY KEY (operacion_productor, operacion_clave),
  CONSTRAINT cobros_operacion_fk_e1 FOREIGN KEY (operacion_productor, operacion_clave)
    REFERENCES public.operaciones_credito_e1(productor, clave) MATCH FULL
    ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT cobros_cliente_fk_e1 FOREIGN KEY (cliente_id)
    REFERENCES public.clientes(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT cobros_sitio_fk_e1 FOREIGN KEY (sitio_origen_id)
    REFERENCES public.ubicaciones(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT cobros_sesion_fk_e1 FOREIGN KEY (sesion_caja_id)
    REFERENCES public.sesiones_caja(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT cobros_actor_fk_e1 FOREIGN KEY (usuario_id)
    REFERENCES public.usuarios(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT cobros_productor_ck_e1 CHECK (
    operacion_productor = 'COBRO_PENDIENTE' AND naturaleza = 'INGRESO_FISICO'
  ),
  CONSTRAINT cobros_importe_ck_e1 CHECK (
    importe > 0 AND importe NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  ),
  CONSTRAINT cobros_fecha_ck_e1 CHECK (isfinite(fecha_real) AND isfinite(created_at)),
  CONSTRAINT cobros_evidencia_ck_e1 CHECK (
    NULLIF(btrim(motivo), '') IS NOT NULL OR NULLIF(btrim(referencia), '') IS NOT NULL
  ),
  CONSTRAINT cobros_medio_cuenta_ck_e1 CHECK (
    (medio = 'EFECTIVO' AND cuenta_destino = 'CAJA_FISICA' AND sesion_caja_id IS NOT NULL)
    OR (medio IN ('TRANSFERENCIA', 'FACTURADO')
      AND cuenta_destino IN ('CUENTA_FISCAL', 'CUENTA_NO_FISCAL') AND sesion_caja_id IS NULL)
  )
);

-- S12: snapshot mínimo canónico comprobado contra el movimiento original.
-- Una raíz por movimiento; cada predecesor sólo puede tener un sucesor.
-- La rectificación inserta una nueva atribución; no altera original ni predecesor.
CREATE TABLE public.atribuciones_credito_e1 (
  id uuid NOT NULL,
  movimiento_id integer NOT NULL,
  movimiento_created_at timestamptz NOT NULL,
  identidad_snapshot jsonb NOT NULL,
  sitio_origen_id integer NOT NULL,
  evidencia text NOT NULL,
  motivo text NOT NULL,
  usuario_id integer NOT NULL,
  anterior_id uuid,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT atribuciones_pk_e1 PRIMARY KEY (id),
  CONSTRAINT atribuciones_movimiento_fk_e1 FOREIGN KEY (movimiento_id)
    REFERENCES public.movimientos_credito(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT atribuciones_sitio_fk_e1 FOREIGN KEY (sitio_origen_id)
    REFERENCES public.ubicaciones(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT atribuciones_actor_fk_e1 FOREIGN KEY (usuario_id)
    REFERENCES public.usuarios(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT atribuciones_anterior_fk_e1 FOREIGN KEY (anterior_id)
    REFERENCES public.atribuciones_credito_e1(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT atribuciones_cadena_uq_e1 UNIQUE NULLS NOT DISTINCT (movimiento_id, anterior_id),
  CONSTRAINT atribuciones_anterior_ck_e1 CHECK (anterior_id IS NULL OR anterior_id <> id),
  CONSTRAINT atribuciones_evidencia_ck_e1 CHECK (
    btrim(evidencia) <> '' AND btrim(motivo) <> ''
  ),
  CONSTRAINT atribuciones_json_ck_e1 CHECK (jsonb_typeof(identidad_snapshot) = 'object'),
  CONSTRAINT atribuciones_fecha_ck_e1 CHECK (
    isfinite(movimiento_created_at) AND isfinite(created_at)
  )
);

-- S13: nullable, sin DEFAULT; NOT VALID evita escaneos de validación histórica.
-- Las FK NOT VALID sí se exigen para nuevas escrituras; MATCH FULL evita pares parciales.
ALTER TABLE public.movimientos_credito
  ADD COLUMN sitio_origen_id integer,
  ADD COLUMN sesion_caja_id integer,
  ADD COLUMN naturaleza public.naturaleza_credito_e1,
  ADD COLUMN operacion_productor text,
  ADD COLUMN operacion_clave uuid,
  ADD COLUMN nota_origen_id integer,
  ADD COLUMN origen_justificacion text,
  ADD CONSTRAINT movimientos_sitio_fk_e1 FOREIGN KEY (sitio_origen_id)
    REFERENCES public.ubicaciones(id) ON UPDATE NO ACTION ON DELETE NO ACTION NOT VALID,
  ADD CONSTRAINT movimientos_sesion_fk_e1 FOREIGN KEY (sesion_caja_id)
    REFERENCES public.sesiones_caja(id) ON UPDATE NO ACTION ON DELETE NO ACTION NOT VALID,
  ADD CONSTRAINT movimientos_nota_fk_e1 FOREIGN KEY (nota_origen_id)
    REFERENCES public.tickets(id) ON UPDATE NO ACTION ON DELETE NO ACTION NOT VALID,
  ADD CONSTRAINT movimientos_operacion_fk_e1 FOREIGN KEY (operacion_productor, operacion_clave)
    REFERENCES public.operaciones_credito_e1(productor, clave) MATCH FULL
    ON UPDATE NO ACTION ON DELETE NO ACTION NOT VALID;

-- S14: como máximo una fila del ledger por clave de operación, sin indexar filas antiguas.
CREATE UNIQUE INDEX movimientos_operacion_uq_e1
  ON public.movimientos_credito (operacion_productor, operacion_clave)
  WHERE operacion_productor IS NOT NULL;

-- S15: DISTINCT impide que esta vista sea automáticamente actualizable.
-- E5 sustituirá la derivación; E1 no almacena un saldo editable.
CREATE VIEW public.saldos_cobros_credito_e1 AS
SELECT DISTINCT c.*, c.importe AS saldo_pendiente
FROM public.cobros_credito_pendientes_e1 AS c;

-- S16: función NUEVA; nunca sustituye prevent_financial_record_mutation.
CREATE FUNCTION public.impedir_mutacion_credito_e1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  RAISE EXCEPTION 'E1: % sobre % está prohibido; evidencia inmutable', TG_OP, TG_TABLE_NAME;
END;
$function$;

-- S17: valida contexto físico sin inferirlo a partir de un medio heredado.
-- FOR SHARE evita que sitio/actor/sesión cambien durante la transacción de inserción.
-- TRANSFERENCIA y FACTURADO admiten las dos cuentas bancarias, nunca CAJA_FISICA.
-- CHEQUE, OTRO y CREDITO se preservan en el enum, pero se rechazan para dinero real.
CREATE FUNCTION public.validar_contexto_credito_e1(
  p_usuario integer,
  p_sitio integer,
  p_naturaleza public.naturaleza_credito_e1,
  p_medio public.forma_pago_cuenta,
  p_cuenta text,
  p_sesion integer
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  PERFORM 1 FROM public.usuarios
    WHERE id = p_usuario AND activo FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E1: actor inexistente o inactivo';
  END IF;
  PERFORM 1 FROM public.ubicaciones
    WHERE id = p_sitio AND activa AND tipo = 'TIENDA' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E1: se requiere sitio de origen real, activo y TIENDA';
  END IF;
  IF p_naturaleza IS NULL THEN
    RAISE EXCEPTION 'E1: naturaleza obligatoria';
  END IF;
  IF p_naturaleza IN ('INGRESO_FISICO', 'DEVOLUCION_FISICA') THEN
    IF p_medio = 'EFECTIVO' THEN
      IF p_cuenta IS DISTINCT FROM 'CAJA_FISICA' OR p_sesion IS NULL THEN
        RAISE EXCEPTION 'E1: efectivo requiere CAJA_FISICA y sesión explícita';
      END IF;
      PERFORM 1 FROM public.sesiones_caja
        WHERE id = p_sesion AND ubicacion_id = p_sitio
          AND estado = 'ABIERTA' AND cerrada_at IS NULL FOR SHARE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'E1: la sesión debe estar abierta y pertenecer al mismo sitio';
      END IF;
    ELSIF p_medio IN ('TRANSFERENCIA', 'FACTURADO') THEN
      IF p_cuenta IS NULL OR p_cuenta NOT IN ('CUENTA_FISCAL', 'CUENTA_NO_FISCAL')
        OR p_sesion IS NOT NULL THEN
        RAISE EXCEPTION 'E1: transferencia/facturado requiere cuenta bancaria y ninguna sesión';
      END IF;
    ELSE
      RAISE EXCEPTION 'E1: medio físico no soportado: %', p_medio;
    END IF;
  ELSIF p_sesion IS NOT NULL THEN
    RAISE EXCEPTION 'E1: una operación sin dinero real no puede imputar sesión de caja';
  END IF;
END;
$function$;

-- S18
CREATE FUNCTION public.validar_movimiento_credito_e1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  op public.operaciones_credito_e1%ROWTYPE;
  origen public.movimientos_credito%ROWTYPE;
BEGIN
  -- Sin corte de fecha: aplica a TODO INSERT, aunque created_at sea histórico.
  IF NEW.sitio_origen_id IS NULL OR NEW.naturaleza IS NULL
    OR NEW.operacion_productor IS NULL OR NEW.operacion_clave IS NULL THEN
    RAISE EXCEPTION 'E1: todo INSERT requiere sitio, naturaleza y clave/productor explícitos';
  END IF;
  SELECT * INTO op FROM public.operaciones_credito_e1
    WHERE productor = NEW.operacion_productor AND clave = NEW.operacion_clave;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E1: registre primero la operación en esta misma unidad transaccional';
  END IF;
  IF op.usuario_id IS DISTINCT FROM NEW.usuario_id
    OR op.naturaleza IS DISTINCT FROM NEW.naturaleza THEN
    RAISE EXCEPTION 'E1: actor/naturaleza no coinciden con la operación';
  END IF;
  IF NEW.importe IS NULL OR NEW.importe = 0
    OR NEW.importe IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric) THEN
    RAISE EXCEPTION 'E1: importe finito distinto de cero obligatorio';
  END IF;
  IF NOT (
    (NEW.operacion_productor = 'VENTA_CREDITO' AND NEW.tipo = 'VENTA_CREDITO' AND NEW.importe > 0)
    OR (NEW.operacion_productor IN ('ABONO_ORDINARIO', 'ABONO_DIRIGIDO')
      AND NEW.tipo = 'ABONO' AND NEW.importe < 0)
    OR (NEW.operacion_productor = 'REVERSO_ABONO' AND NEW.tipo = 'REVERSO' AND NEW.importe > 0)
    OR (NEW.operacion_productor = 'CANCELACION_VENTA_CREDITO'
      AND NEW.tipo = 'REVERSO' AND NEW.importe < 0)
    OR (NEW.operacion_productor = 'AJUSTE_MANUAL' AND NEW.tipo = 'AJUSTE' AND NOT NEW.es_incobrable)
    OR (NEW.operacion_productor = 'BAJA_INCOBRABLE'
      AND NEW.tipo = 'AJUSTE' AND NEW.es_incobrable AND NEW.importe < 0)
  ) THEN
    RAISE EXCEPTION 'E1: productor incompatible con tipo/signo/incobrable; COBRO_PENDIENTE no entra al ledger';
  END IF;
  IF NEW.tipo = 'REVERSO' THEN
    SELECT * INTO origen FROM public.movimientos_credito WHERE id = NEW.movimiento_origen_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E1: falta movimiento de origen del reverso';
    END IF;
    IF (NEW.operacion_productor = 'REVERSO_ABONO' AND origen.tipo <> 'ABONO')
      OR (NEW.operacion_productor = 'CANCELACION_VENTA_CREDITO' AND origen.tipo <> 'VENTA_CREDITO') THEN
      RAISE EXCEPTION 'E1: productor de reverso incompatible con el origen';
    END IF;
    -- El trigger previo validate_credit_reversal conserva la comprobación
    -- del importe exacto, cliente y ticket. No se sustituye ni se deshabilita.
  END IF;
  PERFORM public.validar_contexto_credito_e1(
    NEW.usuario_id, NEW.sitio_origen_id, NEW.naturaleza,
    NEW.forma_pago, NEW.cuenta_destino, NEW.sesion_caja_id
  );
  IF NEW.nota_origen_id IS NOT NULL THEN
    PERFORM 1 FROM public.tickets
      WHERE id = NEW.nota_origen_id AND documento_tipo = 'NOTA'
        AND cliente_id = NEW.cliente_id AND ubicacion_id = NEW.sitio_origen_id FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E1: nota de origen debe ser NOTA del mismo cliente y sitio atribuido';
    END IF;
  END IF;
  IF NEW.tipo = 'AJUSTE' AND NEW.nota_origen_id IS NULL
    AND NULLIF(btrim(NEW.origen_justificacion), '') IS NULL THEN
    RAISE EXCEPTION 'E1: ajuste sin nota identificada exige justificación de origen';
  END IF;
  IF NEW.naturaleza = 'CORRECCION_CONTABLE'
    AND NULLIF(btrim(NEW.origen_justificacion), '') IS NULL THEN
    RAISE EXCEPTION 'E1: corrección/recaptura exige justificación explícita; el medio histórico no prueba efectivo';
  END IF;
  IF NEW.operacion_productor = 'BAJA_INCOBRABLE'
    AND NULLIF(btrim(NEW.motivo_incobrable), '') IS NULL THEN
    RAISE EXCEPTION 'E1: baja incobrable exige motivo';
  END IF;
  RETURN NEW;
END;
$function$;

-- S19
CREATE FUNCTION public.validar_cobro_pendiente_e1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  op public.operaciones_credito_e1%ROWTYPE;
BEGIN
  SELECT * INTO op FROM public.operaciones_credito_e1
    WHERE productor = NEW.operacion_productor AND clave = NEW.operacion_clave;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E1: cobro pendiente requiere una operación previamente insertada';
  END IF;
  IF op.productor <> 'COBRO_PENDIENTE' OR op.naturaleza <> 'INGRESO_FISICO'
    OR op.naturaleza IS DISTINCT FROM NEW.naturaleza
    OR op.usuario_id IS DISTINCT FROM NEW.usuario_id THEN
    RAISE EXCEPTION 'E1: cobro pendiente exige productor exclusivo, ingreso físico y mismo actor';
  END IF;
  PERFORM public.validar_contexto_credito_e1(
    NEW.usuario_id, NEW.sitio_origen_id, NEW.naturaleza,
    NEW.medio, NEW.cuenta_destino, NEW.sesion_caja_id
  );
  RETURN NEW;
END;
$function$;

-- S20
CREATE FUNCTION public.validar_atribucion_credito_e1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  original public.movimientos_credito%ROWTYPE;
  anterior public.atribuciones_credito_e1%ROWTYPE;
  actor public.usuarios%ROWTYPE;
  esperado jsonb;
BEGIN
  SELECT * INTO actor FROM public.usuarios WHERE id = NEW.usuario_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E1: actor de atribución inexistente';
  END IF;
  IF NOT actor.activo OR actor.rol NOT IN ('ADMIN', 'SUPERVISOR') THEN
    RAISE EXCEPTION 'E1: atribución sólo por ADMIN/SUPERVISOR activo';
  END IF;
  IF actor.rol = 'SUPERVISOR' AND actor.ubicacion_id IS DISTINCT FROM NEW.sitio_origen_id THEN
    RAISE EXCEPTION 'E1: supervisor sólo puede atribuir a su propio sitio asignado';
  END IF;
  PERFORM 1 FROM public.ubicaciones
    WHERE id = NEW.sitio_origen_id AND activa AND tipo = 'TIENDA' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E1: sitio de atribución debe ser TIENDA activa';
  END IF;
  SELECT * INTO original FROM public.movimientos_credito
    WHERE id = NEW.movimiento_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E1: movimiento original inexistente';
  END IF;
  IF original.sitio_origen_id IS NOT NULL THEN
    RAISE EXCEPTION 'E1: atribución histórica sólo para movimientos sin sitio E1';
  END IF;
  IF NEW.movimiento_created_at IS DISTINCT FROM original.created_at THEN
    RAISE EXCEPTION 'E1: created_at no coincide exactamente con el movimiento original';
  END IF;
  esperado := jsonb_build_object(
    'cliente_id', original.cliente_id,
    'tipo', original.tipo::text,
    'importe', original.importe,
    'ticket_id', original.ticket_id,
    'movimiento_origen_id', original.movimiento_origen_id
  );
  IF NEW.identidad_snapshot IS DISTINCT FROM esperado THEN
    RAISE EXCEPTION 'E1: snapshot canónico no coincide con identidad del movimiento original';
  END IF;
  IF NEW.anterior_id IS NOT NULL THEN
    SELECT * INTO anterior FROM public.atribuciones_credito_e1 WHERE id = NEW.anterior_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E1: predecesor debe existir antes de insertar la rectificación';
    END IF;
    IF anterior.movimiento_id IS DISTINCT FROM NEW.movimiento_id
      OR anterior.movimiento_created_at IS DISTINCT FROM NEW.movimiento_created_at
      OR anterior.identidad_snapshot IS DISTINCT FROM NEW.identidad_snapshot THEN
      RAISE EXCEPTION 'E1: rectificación debe conservar movimiento y snapshot de su predecesor';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- S21: AFTER valida la fila definitiva, incluso si otros BEFORE INSERT la modifican.
CREATE TRIGGER movimientos_validos_e1
  AFTER INSERT ON public.movimientos_credito
  FOR EACH ROW EXECUTE FUNCTION public.validar_movimiento_credito_e1();
-- S22
CREATE TRIGGER cobros_validos_e1
  AFTER INSERT ON public.cobros_credito_pendientes_e1
  FOR EACH ROW EXECUTE FUNCTION public.validar_cobro_pendiente_e1();
-- S23: BEFORE impide referencias a sí mismo y ciclos dentro de un INSERT múltiple.
CREATE TRIGGER atribuciones_validas_e1
  BEFORE INSERT ON public.atribuciones_credito_e1
  FOR EACH ROW EXECUTE FUNCTION public.validar_atribucion_credito_e1();
-- S24: triggers de sentencia también rechazan intentos que afectarían cero filas.
CREATE TRIGGER operaciones_inmutables_e1
  BEFORE UPDATE OR DELETE OR TRUNCATE ON public.operaciones_credito_e1
  FOR EACH STATEMENT EXECUTE FUNCTION public.impedir_mutacion_credito_e1();
-- S25
CREATE TRIGGER cobros_inmutables_e1
  BEFORE UPDATE OR DELETE OR TRUNCATE ON public.cobros_credito_pendientes_e1
  FOR EACH STATEMENT EXECUTE FUNCTION public.impedir_mutacion_credito_e1();
-- S26
CREATE TRIGGER atribuciones_inmutables_e1
  BEFORE UPDATE OR DELETE OR TRUNCATE ON public.atribuciones_credito_e1
  FOR EACH STATEMENT EXECUTE FUNCTION public.impedir_mutacion_credito_e1();

-- S27
COMMIT;
```

### Anexo B — 02-reversion-condicionada.sql (S01–S28)

```sql
-- UNEXECUTED DRAFT / BORRADOR NO EJECUTADO. No constituye permiso de ejecución.
-- CANDIDATO heliumdb/public, PostgreSQL 16; NO confirmado actualmente por API.
-- Reversión exclusiva de 01-propuesta.sql, sólo tras autorización separada.
-- Una transacción; detener el cliente ante el primer error. Sin CASCADE,
-- sin borrar datos, sin reemplazar/deshabilitar triggers financieros existentes.
-- Falla si falta cualquier objeto que se intenta retirar, si hay dependencias
-- externas, si alguna tabla E1 contiene datos o si cualquier columna E1 del
-- ledger tiene un valor. Un cobro/operación/atribución ya escrito hace esta
-- reversión inadmisible; nunca se vacían tablas para habilitarla.
-- La reserva de nombres de la propuesta no prueba propiedad del catálogo:
-- antes de autorizar, verificar que éstos son exactamente los objetos desplegados.
-- No restaura ni altera columnas, filas, secuencias o triggers anteriores.
-- BLOQUEO FIJO NO-GO en S07: tampoco se autoriza ni habilita esta reversión.

-- S01
BEGIN;
-- S02
SET LOCAL lock_timeout = '2s';
-- S03
SET LOCAL statement_timeout = '15s';
-- S04
SET LOCAL idle_in_transaction_session_timeout = '5s';
-- S05
SET LOCAL TIME ZONE 'UTC';
-- S06
SET LOCAL search_path = pg_catalog, public;

-- S07
DO $guard$
DECLARE
  r record;
BEGIN
  RAISE EXCEPTION 'E1_NO_GO: identidad actual y propiedad de objetos no confirmadas; reversión no habilitada';
  IF current_database() <> 'heliumdb' THEN
    RAISE EXCEPTION 'Destino incorrecto: se requiere heliumdb; recibido %', current_database();
  END IF;
  IF current_setting('server_version_num')::integer NOT BETWEEN 160000 AND 169999 THEN
    RAISE EXCEPTION 'Este borrador requiere PostgreSQL 16';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'public') THEN
    RAISE EXCEPTION 'Falta el esquema public';
  END IF;
  IF current_setting('session_replication_role') <> 'origin' THEN
    RAISE EXCEPTION 'Se requiere session_replication_role=origin';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtenabled <> 'D') THEN
    RAISE EXCEPTION 'E1: hay event triggers DDL activos; revisar efectos antes de autorizar';
  END IF;
  FOR r IN SELECT unnest(ARRAY[
    'movimientos_credito', 'operaciones_credito_e1',
    'cobros_credito_pendientes_e1', 'atribuciones_credito_e1'
  ]) AS nombre LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = r.nombre AND c.relkind = 'r'
    ) THEN
      RAISE EXCEPTION 'Falta tabla esperada public.%: reversión no aplicable', r.nombre;
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM (VALUES
    ('movimientos_credito', 'movimientos_credito_inmutables', 'prevent_financial_record_mutation', 27),
    ('ticket_pagos', 'ticket_pagos_inmutables', 'prevent_financial_record_mutation', 27),
    ('aplicaciones_credito', 'aplicaciones_credito_inmutables', 'prevent_financial_record_mutation', 27),
    ('aplicaciones_credito', 'aplicaciones_credito_validas', 'validate_credit_application', 7),
    ('movimientos_credito', 'movimientos_credito_reversos_validos', 'validate_credit_reversal', 7)
  ) AS x(tabla, disparador, funcion, bits) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_proc p ON p.oid = t.tgfoid
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE t.tgrelid = to_regclass('public.' || r.tabla)
        AND t.tgname = r.disparador AND NOT t.tgisinternal
        AND t.tgenabled IN ('O', 'A') AND t.tgtype = r.bits
        AND n.nspname = 'public' AND p.proname = r.funcion AND p.pronargs = 0
    ) THEN
      RAISE EXCEPTION 'Guarda de trigger existente falló: %.%', r.tabla, r.disparador;
    END IF;
  END LOOP;
END;
$guard$;

-- S08: impide escrituras concurrentes entre las guardas de datos y el DROP.
LOCK TABLE public.movimientos_credito,
  public.operaciones_credito_e1,
  public.cobros_credito_pendientes_e1,
  public.atribuciones_credito_e1 IN ACCESS EXCLUSIVE MODE;

-- S09: comprobaciones obligatorias; ningún DELETE/TRUNCATE para hacerlas pasar.
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.operaciones_credito_e1)
    OR EXISTS (SELECT 1 FROM public.cobros_credito_pendientes_e1)
    OR EXISTS (SELECT 1 FROM public.atribuciones_credito_e1) THEN
    RAISE EXCEPTION 'Reversión prohibida: ya existe evidencia en una tabla E1';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.movimientos_credito
    WHERE sitio_origen_id IS NOT NULL OR sesion_caja_id IS NOT NULL
      OR naturaleza IS NOT NULL OR operacion_productor IS NOT NULL
      OR operacion_clave IS NOT NULL OR nota_origen_id IS NOT NULL
      OR origen_justificacion IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Reversión prohibida: hay al menos una columna E1 poblada en el ledger';
  END IF;
END;
$guard$;

-- S10: orden inverso exacto de los triggers NUEVOS.
DROP TRIGGER atribuciones_inmutables_e1 ON public.atribuciones_credito_e1;
-- S11
DROP TRIGGER cobros_inmutables_e1 ON public.cobros_credito_pendientes_e1;
-- S12
DROP TRIGGER operaciones_inmutables_e1 ON public.operaciones_credito_e1;
-- S13
DROP TRIGGER atribuciones_validas_e1 ON public.atribuciones_credito_e1;
-- S14
DROP TRIGGER cobros_validos_e1 ON public.cobros_credito_pendientes_e1;
-- S15
DROP TRIGGER movimientos_validos_e1 ON public.movimientos_credito;

-- S16
DROP FUNCTION public.validar_atribucion_credito_e1();
-- S17
DROP FUNCTION public.validar_cobro_pendiente_e1();
-- S18
DROP FUNCTION public.validar_movimiento_credito_e1();
-- S19
DROP FUNCTION public.validar_contexto_credito_e1(
  integer, integer, public.naturaleza_credito_e1, public.forma_pago_cuenta, text, integer
);
-- S20
DROP FUNCTION public.impedir_mutacion_credito_e1();
-- S21
DROP VIEW public.saldos_cobros_credito_e1;
-- S22
DROP INDEX public.movimientos_operacion_uq_e1;

-- S23: únicamente las FK y columnas añadidas por E1.
ALTER TABLE public.movimientos_credito
  DROP CONSTRAINT movimientos_operacion_fk_e1,
  DROP CONSTRAINT movimientos_nota_fk_e1,
  DROP CONSTRAINT movimientos_sesion_fk_e1,
  DROP CONSTRAINT movimientos_sitio_fk_e1,
  DROP COLUMN origen_justificacion,
  DROP COLUMN nota_origen_id,
  DROP COLUMN operacion_clave,
  DROP COLUMN operacion_productor,
  DROP COLUMN naturaleza,
  DROP COLUMN sesion_caja_id,
  DROP COLUMN sitio_origen_id;

-- S24
DROP TABLE public.atribuciones_credito_e1;
-- S25
DROP TABLE public.cobros_credito_pendientes_e1;
-- S26
DROP TABLE public.operaciones_credito_e1;
-- S27
DROP TYPE public.naturaleza_credito_e1;
-- S28
COMMIT;
```
