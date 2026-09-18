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

## Anexo A — Huellas de los SQL operativos propuestos

```text
680f8f4d339d20775dabeb540c43d4945391652f1eabd6e0162f3a1ca48ce57f  reports/e1-ensayo-2026-09-17/operativo-propuesto/01.sql
1fb7c3a837700ef2c9e53fecf0bec629192bbbb4651d472842b442652eed3fac  reports/e1-ensayo-2026-09-17/operativo-propuesto/02.sql
```

Comprobación automática: los bloques numerados son idénticos a los ensayados salvo S07 (guarda de identidad). Evidencia: operational-sql-equivalence.json.

## Anexo B — Migración operativa propuesta, no ejecutada

```sql
-- E1: PROPUESTA OPERATIVA NO EJECUTADA. Requiere autorización textual separada.
-- Destino confirmado desde pool API PID 306: heliumdb/public PostgreSQL 16.10.
-- Observado: 2026-09-17 22:46:46.894065+00. Fuente: ../api-pool-identity.json.
-- Respaldo y ensayo: ../resultado.md. No ejecutar a mano ni por fragmentos.
-- Ejecutar sólo con API pausada, comparación previa contra el respaldo y
-- watchdog de 30s por conexión de control; antes de COMMIT, terminar revierte.
-- Si COMMIT ya fue enviado y se pierde respuesta, verificar el resultado; no asumir rollback.
-- DDL idéntico al ensayado; S07 agrega la huella de la instancia operativa.
-- Los productores antiguos sin contrato E1 se rechazarán después del COMMIT.
-- Este SQL no activa capturas ni adapta productores; no reanudar API sin coordinación.
-- La reversión exige cero datos E1 y autorización separada. No usa CASCADE.

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
  IF (SELECT oid::bigint FROM pg_database WHERE datname = current_database()) <> 16384
    OR pg_postmaster_start_time() <> TIMESTAMPTZ '2026-09-17 21:43:07.917935+00'
    OR current_user::text <> 'postgres'
    OR current_setting('server_version') <> '16.10'
    OR inet_server_addr() IS NOT NULL OR inet_server_port() IS NOT NULL THEN
    RAISE EXCEPTION 'E1: instancia/rol distintos de la identidad confirmada; detener y reconfirmar';
  END IF;
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

## Anexo C — Reversión operativa condicionada, no ejecutada

```sql
-- E1: PROPUESTA OPERATIVA NO EJECUTADA. Requiere autorización textual separada.
-- Destino confirmado desde pool API PID 306: heliumdb/public PostgreSQL 16.10.
-- Observado: 2026-09-17 22:46:46.894065+00. Fuente: ../api-pool-identity.json.
-- Respaldo y ensayo: ../resultado.md. No ejecutar a mano ni por fragmentos.
-- Ejecutar sólo con API pausada, comparación previa contra el respaldo y
-- watchdog de 30s por conexión de control; antes de COMMIT, terminar revierte.
-- Si COMMIT ya fue enviado y se pierde respuesta, verificar el resultado; no asumir rollback.
-- DDL idéntico al ensayado; S07 agrega la huella de la instancia operativa.
-- Los productores antiguos sin contrato E1 se rechazarán después del COMMIT.
-- Este SQL no activa capturas ni adapta productores; no reanudar API sin coordinación.
-- La reversión exige cero datos E1 y autorización separada. No usa CASCADE.

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
  IF (SELECT oid::bigint FROM pg_database WHERE datname = current_database()) <> 16384
    OR pg_postmaster_start_time() <> TIMESTAMPTZ '2026-09-17 21:43:07.917935+00'
    OR current_user::text <> 'postgres'
    OR current_setting('server_version') <> '16.10'
    OR inet_server_addr() IS NOT NULL OR inet_server_port() IS NOT NULL THEN
    RAISE EXCEPTION 'E1: instancia/rol distintos de la identidad confirmada; detener y reconfirmar';
  END IF;
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

## Anexo D — Medición de cada sentencia y verificaciones del clon

# E1 — ensayo exclusivo en clon desechable

Estado: **PASS**

No se conectó al origen, no se ejecutaron inicializadores/DML/seeds ni se crearon usuarios o sesiones de aplicación.
Los SQL originales permanecen sin cambios; las únicas transformaciones están documentadas en rehearsaldraftpatch.
Las duraciones son mediciones hrtime del cliente (incluyen ida/vuelta), no estimaciones ni garantías de producción.
S08→COMMIT comienza al finalizar la adquisición del bloqueo; no incluye su espera previa. Total incluye cierre del cliente.
Comparación semántica: sólo se omite ordinal_position/attnum de columnas; tamaño físico de base se registra como telemetría.
No se normalizan cuerpos de funciones, índices, restricciones, hashes, estados de triggers o secuencias.
La prueba adicional de cancelación usa pg_sleep(10) antes de COMMIT y watchdog global de 1000 ms; NO mide DDL normal.

Tablas/triggers no internos al baseline: 63/17 (esperados 63/17).

## normal-migration-27

COMMIT confirmado: true. Total: 321.519 ms.
S08 final → COMMIT: 300.927 ms.
Watchdog: {"fired":false}.

| Sentencia | Sintética | Estado | ms |
|---|---|---|---:|
| S01 | false | PASS | 0.289 |
| S02 | false | PASS | 0.384 |
| S03 | false | PASS | 0.160 |
| S04 | false | PASS | 0.130 |
| S05 | false | PASS | 2.669 |
| S06 | false | PASS | 0.190 |
| S07 | false | PASS | 13.482 |
| S08 | false | PASS | 0.355 |
| S09 | false | PASS | 1.332 |
| S10 | false | PASS | 10.571 |
| S11 | false | PASS | 8.336 |
| S12 | false | PASS | 266.674 |
| S13 | false | PASS | 1.723 |
| S14 | false | PASS | 2.832 |
| S15 | false | PASS | 1.141 |
| S16 | false | PASS | 0.324 |
| S17 | false | PASS | 0.390 |
| S18 | false | PASS | 0.507 |
| S19 | false | PASS | 0.238 |
| S20 | false | PASS | 0.281 |
| S21 | false | PASS | 0.135 |
| S22 | false | PASS | 0.304 |
| S23 | false | PASS | 0.123 |
| S24 | false | PASS | 0.200 |
| S25 | false | PASS | 0.119 |
| S26 | false | PASS | 0.115 |
| S27 | false | PASS | 5.481 |

## normal-conditional-reversal-28

COMMIT confirmado: true. Total: 23.049 ms.
S08 final → COMMIT: 16.090 ms.
Watchdog: {"fired":false}.

| Sentencia | Sintética | Estado | ms |
|---|---|---|---:|
| S01 | false | PASS | 0.107 |
| S02 | false | PASS | 0.112 |
| S03 | false | PASS | 0.096 |
| S04 | false | PASS | 0.078 |
| S05 | false | PASS | 0.066 |
| S06 | false | PASS | 0.082 |
| S07 | false | PASS | 4.093 |
| S08 | false | PASS | 0.243 |
| S09 | false | PASS | 1.439 |
| S10 | false | PASS | 2.143 |
| S11 | false | PASS | 0.224 |
| S12 | false | PASS | 0.120 |
| S13 | false | PASS | 0.268 |
| S14 | false | PASS | 0.168 |
| S15 | false | PASS | 0.114 |
| S16 | false | PASS | 0.107 |
| S17 | false | PASS | 0.124 |
| S18 | false | PASS | 0.087 |
| S19 | false | PASS | 0.105 |
| S20 | false | PASS | 0.088 |
| S21 | false | PASS | 0.354 |
| S22 | false | PASS | 0.149 |
| S23 | false | PASS | 1.858 |
| S24 | false | PASS | 1.291 |
| S25 | false | PASS | 1.671 |
| S26 | false | PASS | 0.762 |
| S27 | false | PASS | 0.142 |
| S28 | false | PASS | 4.840 |

## extra-synthetic-cancellation

COMMIT confirmado: false. Total: 1103.604 ms.
S08 final → COMMIT: no hubo COMMIT confirmado.
Watchdog: {"fired":true,"firedAfterBeginMs":1001.052635,"terminateReturned":true,"backendAbsent":true}.

| Sentencia | Sintética | Estado | ms |
|---|---|---|---:|
| S01 | false | PASS | 0.117 |
| S02 | false | PASS | 0.126 |
| S03 | false | PASS | 0.112 |
| S04 | false | PASS | 0.072 |
| S05 | false | PASS | 0.061 |
| S06 | false | PASS | 0.062 |
| S07 | false | PASS | 8.522 |
| S08 | false | PASS | 0.133 |
| S09 | false | PASS | 0.559 |
| S10 | false | PASS | 9.302 |
| S11 | false | PASS | 10.388 |
| S12 | false | PASS | 137.070 |
| S13 | false | PASS | 1.996 |
| S14 | false | PASS | 2.694 |
| S15 | false | PASS | 1.122 |
| S16 | false | PASS | 0.408 |
| S17 | false | PASS | 0.273 |
| S18 | false | PASS | 0.388 |
| S19 | false | PASS | 0.163 |
| S20 | false | PASS | 0.359 |
| S21 | false | PASS | 0.164 |
| S22 | false | PASS | 0.139 |
| S23 | false | PASS | 0.219 |
| S24 | false | PASS | 0.121 |
| S25 | false | PASS | 0.105 |
| S26 | false | PASS | 0.099 |
| SYNTHETIC_BEFORE_COMMIT | true | FAIL | 827.857 |

## Verificaciones

- migrationVerification: {"status":"PASS","categories":{"tables":true,"tableEvidence":true,"constraints":true,"indexes":true,"functions":true,"triggers":true,"sequences":true,"columns":true,"database":true,"sequenceState":true,"internalTriggers":true,"views":true,"types":true,"sequenceValues":true},"beforeSemanticSha256":"06aee606e72b54f287e75b61c048aac04b1131c87484701c6e7f695d906d0987","afterSemanticSha256":"06aee606e72b54f287e75b61c048aac04b1131c87484701c6e7f695d906d0987","tableCount":63,"noninternalTriggerCount":17,"columnComparisonOnlyExclusion":"ordinal_position (physical attnum)","physicalDatabaseSizeTelemetry":{"before":"17019363","after":"17183203"},"actualMigratedTableCount":66,"actualMigratedNoninternalTriggerCount":23,"newTables":[{"schema":"public","table":"atribuciones_credito_e1","relkind":"r","count":"0","orderedCanonicalRowHash":"d41d8cd98f00b204e9800998ecf8427e"},{"schema":"public","table":"cobros_credito_pendientes_e1","relkind":"r","count":"0","orderedCanonicalRowHash":"d41d8cd98f00b204e9800998ecf8427e"},{"schema":"public","table":"operaciones_credito_e1","relkind":"r","count":"0","orderedCanonicalRowHash":"d41d8cd98f00b204e9800998ecf8427e"}],"newColumnsAllNull":true,"ledgerExcludedColumns":["sitio_origen_id","sesion_caja_id","naturaleza","operacion_productor","operacion_clave","nota_origen_id","origen_justificacion"],"projectedLedgerHash":{"count":"3","hash":"ba02f7b3e028d90d22d8094d3b716ae1"},"allowedChanges":{"newTables":["operaciones_credito_e1","cobros_credito_pendientes_e1","atribuciones_credito_e1"],"newFunctions":["impedir_mutacion_credito_e1","validar_contexto_credito_e1","validar_movimiento_credito_e1","validar_cobro_pendiente_e1","validar_atribucion_credito_e1"],"newTriggers":["movimientos_credito.movimientos_validos_e1","cobros_credito_pendientes_e1.cobros_validos_e1","atribuciones_credito_e1.atribuciones_validas_e1","operaciones_credito_e1.operaciones_inmutables_e1","cobros_credito_pendientes_e1.cobros_inmutables_e1","atribuciones_credito_e1.atribuciones_inmutables_e1"],"ledgerForeignKeys":["movimientos_sitio_fk_e1","movimientos_sesion_fk_e1","movimientos_nota_fk_e1","movimientos_operacion_fk_e1"],"ledgerIndex":"movimientos_operacion_uq_e1","internalTriggers":"Only FK triggers belonging to the three new tables or four added ledger FKs","view":"saldos_cobros_credito_e1","enum":"naturaleza_credito_e1"}}
- rollbackVerification: {"status":"PASS","categories":{"tables":true,"tableEvidence":true,"constraints":true,"indexes":true,"functions":true,"triggers":true,"sequences":true,"columns":true,"database":true,"sequenceState":true,"internalTriggers":true,"views":true,"types":true,"sequenceValues":true},"beforeSemanticSha256":"06aee606e72b54f287e75b61c048aac04b1131c87484701c6e7f695d906d0987","afterSemanticSha256":"06aee606e72b54f287e75b61c048aac04b1131c87484701c6e7f695d906d0987","tableCount":63,"noninternalTriggerCount":17,"columnComparisonOnlyExclusion":"ordinal_position (physical attnum)","physicalDatabaseSizeTelemetry":{"before":"17019363","after":"17117667"}}
- cancellationVerification: {"status":"PASS","actualTermination":{"fired":true,"firedAfterBeginMs":1001.052635,"terminateReturned":true,"backendAbsent":true},"syntheticSleepReached":true,"syntheticSleepError":{"message":"terminating connection due to administrator command","code":"57P01"},"commitAttempted":false,"baselineComparison":{"status":"PASS","categories":{"tables":true,"tableEvidence":true,"constraints":true,"indexes":true,"functions":true,"triggers":true,"sequences":true,"columns":true,"database":true,"sequenceState":true,"internalTriggers":true,"views":true,"types":true,"sequenceValues":true},"beforeSemanticSha256":"06aee606e72b54f287e75b61c048aac04b1131c87484701c6e7f695d906d0987","afterSemanticSha256":"06aee606e72b54f287e75b61c048aac04b1131c87484701c6e7f695d906d0987","tableCount":63,"noninternalTriggerCount":17,"columnComparisonOnlyExclusion":"ordinal_position (physical attnum)","physicalDatabaseSizeTelemetry":{"before":"17019363","after":"17248739"}},"normalDdlTiming":false}
- ledgerUnblocked: {"status":"PASS","elapsedMs":0.359968,"count":"3","queryTimeoutMs":2500}
- originalsUnchanged: {"status":"PASS","files":[{"file":"01-propuesta.sql","sha256":"15148edc4555b90a0007dba4536c0a60ecb9904f5885b457ade99b2fe72d931a","expectedSha256":"15148edc4555b90a0007dba4536c0a60ecb9904f5885b457ade99b2fe72d931a"},{"file":"02-reversion-condicionada.sql","sha256":"d2324e980e128f264ea64187df932f48ae8386e1a830c2b958675d1bb3b9b7e7","expectedSha256":"d2324e980e128f264ea64187df932f48ae8386e1a830c2b958675d1bb3b9b7e7"}]}

Evidencia completa y resultados reales: ensayo.json y snapshots privados baseline/migrated/restored/cancelled.
