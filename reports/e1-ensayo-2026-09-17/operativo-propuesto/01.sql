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