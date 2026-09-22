--
-- PostgreSQL database dump
--

\restrict TpGW4C4muAHKD6A6SjCrZcpbkFszpZ2eOUdoxu5h65CreAddLvTBKyHf3UzGAEy

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: alcance_consulta; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.alcance_consulta AS ENUM (
    'PROPIA',
    'TODAS'
);


ALTER TYPE public.alcance_consulta OWNER TO postgres;

--
-- Name: estado_rollo; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.estado_rollo AS ENUM (
    'PROGRAMADO',
    'DISPONIBLE',
    'EN_TRANSITO',
    'MOSTRADOR',
    'VENDIDO',
    'BAJA'
);


ALTER TYPE public.estado_rollo OWNER TO postgres;

--
-- Name: estado_salida; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.estado_salida AS ENUM (
    'ARMANDO',
    'EN_TRANSITO',
    'RECIBIDA',
    'ENTREGADA',
    'CANCELADA'
);


ALTER TYPE public.estado_salida OWNER TO postgres;

--
-- Name: estado_sesion_caja; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.estado_sesion_caja AS ENUM (
    'ABIERTA',
    'CERRADA'
);


ALTER TYPE public.estado_sesion_caja OWNER TO postgres;

--
-- Name: estado_solicitud_pago_dirigido; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.estado_solicitud_pago_dirigido AS ENUM (
    'PENDIENTE',
    'APROBADA',
    'RECHAZADA'
);


ALTER TYPE public.estado_solicitud_pago_dirigido OWNER TO postgres;

--
-- Name: estado_ticket; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.estado_ticket AS ENUM (
    'VENDIDO',
    'CANCELADO'
);


ALTER TYPE public.estado_ticket OWNER TO postgres;

--
-- Name: forma_pago_cuenta; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.forma_pago_cuenta AS ENUM (
    'EFECTIVO',
    'TRANSFERENCIA',
    'FACTURADO',
    'CHEQUE',
    'OTRO',
    'CREDITO'
);


ALTER TYPE public.forma_pago_cuenta OWNER TO postgres;

--
-- Name: forma_pago_proveedor; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.forma_pago_proveedor AS ENUM (
    'EFECTIVO',
    'TRANSFERENCIA',
    'CHEQUE',
    'OTRO',
    'FACTURADO'
);


ALTER TYPE public.forma_pago_proveedor OWNER TO postgres;

--
-- Name: forma_pago_ticket; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.forma_pago_ticket AS ENUM (
    'EFECTIVO',
    'TRANSFERENCIA',
    'CREDITO',
    'FACTURADO'
);


ALTER TYPE public.forma_pago_ticket OWNER TO postgres;

--
-- Name: moneda; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.moneda AS ENUM (
    'MXN',
    'USD'
);


ALTER TYPE public.moneda OWNER TO postgres;

--
-- Name: motivo_salida_extraordinaria; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.motivo_salida_extraordinaria AS ENUM (
    'MERMA',
    'ROBO',
    'MUESTRA'
);


ALTER TYPE public.motivo_salida_extraordinaria OWNER TO postgres;

--
-- Name: naturaleza_credito_e1; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.naturaleza_credito_e1 AS ENUM (
    'INGRESO_FISICO',
    'DEVOLUCION_FISICA',
    'CORRECCION_CONTABLE',
    'OPERACION_CREDITO_SIN_DINERO'
);


ALTER TYPE public.naturaleza_credito_e1 OWNER TO postgres;

--
-- Name: precio_modo; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.precio_modo AS ENUM (
    'ROLLO',
    'MAYOREO',
    'MENUDEO'
);


ALTER TYPE public.precio_modo OWNER TO postgres;

--
-- Name: rol_usuario; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.rol_usuario AS ENUM (
    'ADMIN',
    'TERMINAL',
    'CAJA',
    'SUPERVISOR',
    'BODEGA',
    'SISTEMAS',
    'CONTADOR'
);


ALTER TYPE public.rol_usuario OWNER TO postgres;

--
-- Name: tipo_movimiento; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tipo_movimiento AS ENUM (
    'ALTA',
    'RECEPCION',
    'VENTA',
    'DEVOLUCION',
    'TRANSFERENCIA_SALIDA',
    'TRANSFERENCIA_ENTRADA',
    'SALIDA_MOSTRADOR',
    'AJUSTE_POSITIVO',
    'AJUSTE_NEGATIVO',
    'CANCELACION',
    'REACTIVACION_FALTANTE'
);


ALTER TYPE public.tipo_movimiento OWNER TO postgres;

--
-- Name: tipo_movimiento_credito; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tipo_movimiento_credito AS ENUM (
    'VENTA_CREDITO',
    'ABONO',
    'REVERSO',
    'AJUSTE'
);


ALTER TYPE public.tipo_movimiento_credito OWNER TO postgres;

--
-- Name: tipo_pago_proveedor; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tipo_pago_proveedor AS ENUM (
    'COMPRA',
    'PAGO',
    'AJUSTE',
    'REVERSO'
);


ALTER TYPE public.tipo_pago_proveedor OWNER TO postgres;

--
-- Name: tipo_proveedor; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tipo_proveedor AS ENUM (
    'NACIONAL',
    'IMPORTACION'
);


ALTER TYPE public.tipo_proveedor OWNER TO postgres;

--
-- Name: tipo_solicitud_pago_dirigido; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tipo_solicitud_pago_dirigido AS ENUM (
    'CLIENTE',
    'PROVEEDOR'
);


ALTER TYPE public.tipo_solicitud_pago_dirigido OWNER TO postgres;

--
-- Name: tipo_ticket; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tipo_ticket AS ENUM (
    'NORMAL',
    'METREADO'
);


ALTER TYPE public.tipo_ticket OWNER TO postgres;

--
-- Name: tipo_ubicacion; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tipo_ubicacion AS ENUM (
    'TIENDA',
    'BODEGA',
    'TRANSITO',
    'EXTERNO'
);


ALTER TYPE public.tipo_ubicacion OWNER TO postgres;

--
-- Name: unidad_producto; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.unidad_producto AS ENUM (
    'METRO',
    'KILO',
    'BOLSA',
    'PIEZA'
);


ALTER TYPE public.unidad_producto OWNER TO postgres;

--
-- Name: bloquear_mutacion_reimpresion_etiqueta(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bloquear_mutacion_reimpresion_etiqueta() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        IF current_setting('app.etiquetas_cleanup', true) = 'on' THEN
          IF TG_OP = 'DELETE' THEN
            RETURN OLD;
          END IF;
          RETURN NEW;
        END IF;
        RAISE EXCEPTION 'reimpresiones_etiqueta es un registro inmutable';
      END;
      $$;


ALTER FUNCTION public.bloquear_mutacion_reimpresion_etiqueta() OWNER TO postgres;

--
-- Name: bloquear_mutacion_revision_etiqueta(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bloquear_mutacion_revision_etiqueta() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        RAISE EXCEPTION 'revisiones_etiqueta es un historial append-only';
      END;
      $$;


ALTER FUNCTION public.bloquear_mutacion_revision_etiqueta() OWNER TO postgres;

--
-- Name: credit_fifo_aging(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.credit_fifo_aging(p_cliente_id integer) RETURNS TABLE(movimiento_id integer, ticket_id integer, created_at timestamp with time zone, due_at date, original numeric, pendiente numeric)
    LANGUAGE sql STABLE
    AS $$
        WITH fifo_negatives AS (
          SELECT COALESCE(SUM(-importe), 0) AS total
          FROM movimientos_credito
          WHERE cliente_id = p_cliente_id AND (
            (tipo = 'ABONO' AND NOT EXISTS (
              SELECT 1 FROM movimientos_credito reversal
              WHERE reversal.tipo='REVERSO'
                AND reversal.movimiento_origen_id=movimientos_credito.id
            )) OR
            (tipo = 'AJUSTE' AND importe < 0)
          )
        ), cargos AS (
          SELECT m.id, m.ticket_id, m.created_at,
            GREATEST(0, m.importe - CASE
              WHEN m.tipo = 'VENTA_CREDITO' THEN COALESCE((
                SELECT SUM(-r.importe) FROM movimientos_credito r
                WHERE r.cliente_id=m.cliente_id AND r.tipo='REVERSO'
                  AND r.ticket_id=m.ticket_id
              ),0)
              ELSE 0
            END) AS neto,
            m.fecha_vencimiento
          FROM movimientos_credito m
          WHERE m.cliente_id=p_cliente_id AND (
            m.tipo='VENTA_CREDITO' OR (m.tipo='AJUSTE' AND m.importe > 0)
          )
        ), ordenadas AS (
          SELECT v.*,
            COALESCE(SUM(v.neto) OVER (
              ORDER BY v.created_at, v.id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ), 0) AS antes
          FROM cargos v
        )
        SELECT v.id, v.ticket_id, v.created_at,
          v.fecha_vencimiento, v.neto,
          GREATEST(0, v.neto - GREATEST(0, n.total - v.antes))
        FROM ordenadas v CROSS JOIN fifo_negatives n
        WHERE GREATEST(0, v.neto - GREATEST(0, n.total - v.antes)) > 0
      $$;


ALTER FUNCTION public.credit_fifo_aging(p_cliente_id integer) OWNER TO postgres;

--
-- Name: e1_guard_cash_capture_closed(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.e1_guard_cash_capture_closed() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF NEW.forma_pago::text = 'EFECTIVO'
     AND NEW.naturaleza::text IN ('INGRESO_FISICO', 'DEVOLUCION_FISICA') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'E1C01',
      MESSAGE = 'E1: la captura física de efectivo de crédito está deshabilitada.';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.e1_guard_cash_capture_closed() OWNER TO postgres;

--
-- Name: e1_guard_historical_attribution_closed(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.e1_guard_historical_attribution_closed() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'E1A01',
    MESSAGE = 'E1: la atribución histórica de crédito está deshabilitada.';
  RETURN NULL;
END;
$$;


ALTER FUNCTION public.e1_guard_historical_attribution_closed() OWNER TO postgres;

--
-- Name: e1_guard_pending_receipts_closed(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.e1_guard_pending_receipts_closed() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'E1P01',
    MESSAGE = 'E1: el cobro retenido de crédito está deshabilitado.';
  RETURN NULL;
END;
$$;


ALTER FUNCTION public.e1_guard_pending_receipts_closed() OWNER TO postgres;

--
-- Name: e2_attest_new_retained(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.e2_attest_new_retained(p_clave uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  INSERT INTO public.evidencia_no_aplicada_e2(fuente, cobro_productor, cobro_clave, cliente_id, importe)
    SELECT 'COBRO_RETENIDO:' || operacion_clave::text,
           operacion_productor, operacion_clave, cliente_id, importe
    FROM public.cobros_credito_pendientes_e1
    WHERE operacion_productor = 'COBRO_PENDIENTE' AND operacion_clave = p_clave;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E2: retained receipt not found';
  END IF;
END;
$$;


ALTER FUNCTION public.e2_attest_new_retained(p_clave uuid) OWNER TO postgres;

--
-- Name: e2_finalize_new_abono(integer, text, text, bigint, jsonb, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.e2_finalize_new_abono(p_abono_id integer, p_productor text, p_resultado text, p_aplicado_cents bigint, p_evaluacion jsonb, p_contrato_revision text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  inserted public.finalizaciones_abono_e2%ROWTYPE;
BEGIN
  INSERT INTO public.finalizaciones_abono_e2(
    abono_id, operacion_productor, operacion_clave, cliente_id,
    importe, resultado, aplicado, evaluacion, contrato_revision
  )
  SELECT m.id, m.operacion_productor, m.operacion_clave, m.cliente_id,
         -m.importe, p_resultado, p_aplicado_cents::numeric / 100,
         p_evaluacion, p_contrato_revision
    FROM public.movimientos_credito AS m
   WHERE m.id = p_abono_id
     AND m.operacion_productor = p_productor
     AND m.tipo = 'ABONO'
     AND m.naturaleza = 'INGRESO_FISICO'
     AND m.forma_pago = 'EFECTIVO'
     AND m.cuenta_destino = 'CAJA_FISICA'
  RETURNING * INTO inserted;

  IF inserted.abono_id IS NULL THEN
    RAISE EXCEPTION 'E2: physical ABONO not found for finalization';
  END IF;
  IF inserted.resultado = 'UNUSED' THEN
    INSERT INTO public.evidencia_no_aplicada_e2(fuente, abono_id, cliente_id, importe)
    VALUES ('ABONO:' || inserted.abono_id::text, inserted.abono_id,
            inserted.cliente_id, inserted.importe);
  END IF;
END;
$$;


ALTER FUNCTION public.e2_finalize_new_abono(p_abono_id integer, p_productor text, p_resultado text, p_aplicado_cents bigint, p_evaluacion jsonb, p_contrato_revision text) OWNER TO postgres;

--
-- Name: e2_guard_finalized_capture_application(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.e2_guard_finalized_capture_application() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  source_xid xid8;
BEGIN
  SELECT e2_insert_xid INTO source_xid FROM public.movimientos_credito
    WHERE id = NEW.abono_movimiento_id FOR SHARE;
  IF source_xid = pg_current_xact_id()
     AND EXISTS (SELECT 1 FROM public.finalizaciones_abono_e2
                 WHERE abono_id = NEW.abono_movimiento_id) THEN
    RAISE EXCEPTION 'E2: capture applications must precede finalization';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.e2_guard_finalized_capture_application() OWNER TO postgres;

--
-- Name: e2_reject_evidence_mutation(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.e2_reject_evidence_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  RAISE EXCEPTION 'E2: evidence/finalization is immutable';
END;
$$;


ALTER FUNCTION public.e2_reject_evidence_mutation() OWNER TO postgres;

--
-- Name: e2_require_abono_finalization(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.e2_require_abono_finalization() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  final_result text;
  final_evaluation jsonb;
  proof_exists boolean;
BEGIN
  IF NEW.tipo = 'ABONO'
     AND NEW.naturaleza = 'INGRESO_FISICO'
     AND NEW.forma_pago = 'EFECTIVO'
     AND NEW.cuenta_destino = 'CAJA_FISICA'
     AND NEW.operacion_productor IN ('ABONO_ORDINARIO','ABONO_DIRIGIDO') THEN
    SELECT resultado, evaluacion INTO final_result, final_evaluation
      FROM public.finalizaciones_abono_e2
     WHERE abono_id = NEW.id;
    IF final_result IS NULL THEN
      RAISE EXCEPTION 'E2: physical ABONO cannot commit without finalization';
    END IF;
    -- Recheck at commit: catches application inserted AFTER finalization.
    IF EXISTS (
      WITH persisted AS (
        SELECT venta_movimiento_id AS target, sum(importe * 100) AS cents
        FROM public.aplicaciones_credito WHERE abono_movimiento_id = NEW.id
        GROUP BY venta_movimiento_id
      ), declared AS (
        SELECT (item->>'targetId')::integer AS target,
               sum((item->>'appliedCents')::numeric) AS cents
        FROM jsonb_array_elements(final_evaluation->'allocations') AS item
        GROUP BY (item->>'targetId')::integer
      )
      (SELECT * FROM persisted EXCEPT SELECT * FROM declared)
      UNION ALL
      (SELECT * FROM declared EXCEPT SELECT * FROM persisted)
    ) OR EXISTS (
      SELECT 1 FROM public.movimientos_credito
      WHERE movimiento_origen_id = NEW.id AND tipo = 'REVERSO'
    ) THEN
      RAISE EXCEPTION 'E2: committed finalization does not match persisted applications';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.evidencia_no_aplicada_e2
       WHERE abono_id = NEW.id
    ) INTO proof_exists;
    IF (final_result = 'UNUSED') IS DISTINCT FROM proof_exists THEN
      RAISE EXCEPTION 'E2: UNUSED proof completeness mismatch';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION public.e2_require_abono_finalization() OWNER TO postgres;

--
-- Name: e2_stamp_insert_transaction(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.e2_stamp_insert_transaction() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.e2_insert_xid := pg_current_xact_id();
  ELSE
    -- UPDATE creates a tuple version, not a new receipt. Ignore supplied stamps.
    NEW.e2_insert_xid := OLD.e2_insert_xid;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.e2_stamp_insert_transaction() OWNER TO postgres;

--
-- Name: e2_validate_abono_finalization(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.e2_validate_abono_finalization() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  source_xid xid8;
  source_client integer;
  source_amount numeric;
  source_producer text;
  source_key uuid;
  allocation_count integer;
  allocation_sum bigint;
BEGIN
  SELECT m.e2_insert_xid, m.cliente_id, -m.importe,
         m.operacion_productor, m.operacion_clave
    INTO source_xid, source_client, source_amount, source_producer, source_key
    FROM public.movimientos_credito AS m
   WHERE m.id = NEW.abono_id
     AND m.tipo = 'ABONO'
     AND m.naturaleza = 'INGRESO_FISICO'
     AND m.forma_pago = 'EFECTIVO'
     AND m.cuenta_destino = 'CAJA_FISICA'
     AND m.sitio_origen_id IS NOT NULL
     AND m.sesion_caja_id IS NOT NULL
     AND m.operacion_productor IN ('ABONO_ORDINARIO','ABONO_DIRIGIDO')
   FOR SHARE;

  IF source_xid IS NULL
     OR source_xid IS DISTINCT FROM pg_current_xact_id()
     OR source_client IS DISTINCT FROM NEW.cliente_id
     OR source_amount IS DISTINCT FROM NEW.importe
     OR source_producer IS DISTINCT FROM NEW.operacion_productor
     OR source_key IS DISTINCT FROM NEW.operacion_clave THEN
    RAISE EXCEPTION 'E2: finalization requires its new physical ABONO in this transaction';
  END IF;
  IF NEW.evaluacion->>'contractRevision' IS DISTINCT FROM NEW.contrato_revision
     OR NEW.evaluacion->>'projector' IS DISTINCT FROM
        (CASE source_producer WHEN 'ABONO_DIRIGIDO' THEN 'directedApplication'
          ELSE 'projectCreditLedger' END)
     OR (source_producer = 'ABONO_DIRIGIDO'
         AND (NEW.resultado IS DISTINCT FROM 'FULL'
              OR NEW.aplicado IS DISTINCT FROM source_amount))
     OR (NEW.evaluacion->>'receiptCents')::bigint IS DISTINCT FROM round(NEW.importe * 100)::bigint
     OR (NEW.evaluacion->>'appliedCents')::bigint IS DISTINCT FROM round(NEW.aplicado * 100)::bigint
     OR jsonb_typeof(NEW.evaluacion->'allocations') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'E2: finalization evaluation contract mismatch';
  END IF;
  SELECT count(*), COALESCE(sum((item->>'appliedCents')::bigint), 0)
    INTO allocation_count, allocation_sum
    FROM jsonb_array_elements(NEW.evaluacion->'allocations') AS item
   WHERE jsonb_typeof(item) = 'object'
     AND jsonb_typeof(item->'targetId') = 'number'
     AND jsonb_typeof(item->'appliedCents') = 'number'
     AND (item->>'targetId')::numeric > 0
     AND (item->>'targetId')::numeric = trunc((item->>'targetId')::numeric)
     AND (item->>'appliedCents')::numeric > 0
     AND (item->>'appliedCents')::numeric = trunc((item->>'appliedCents')::numeric);
  IF allocation_count <> jsonb_array_length(NEW.evaluacion->'allocations')
     OR allocation_sum IS DISTINCT FROM round(NEW.aplicado * 100)::bigint THEN
    RAISE EXCEPTION 'E2: finalization allocation summary mismatch';
  END IF;
  -- Attest persisted destinations/amounts, never recompute FIFO in SQL.
  IF EXISTS (
    WITH persisted AS (
      SELECT venta_movimiento_id AS target, sum(importe * 100) AS cents
      FROM public.aplicaciones_credito WHERE abono_movimiento_id = NEW.abono_id
      GROUP BY venta_movimiento_id
    ), declared AS (
      SELECT (item->>'targetId')::integer AS target,
             sum((item->>'appliedCents')::numeric) AS cents
      FROM jsonb_array_elements(NEW.evaluacion->'allocations') AS item
      GROUP BY (item->>'targetId')::integer
    )
    (SELECT * FROM persisted EXCEPT SELECT * FROM declared)
    UNION ALL
    (SELECT * FROM declared EXCEPT SELECT * FROM persisted)
  ) OR EXISTS (
    SELECT 1 FROM public.movimientos_credito
    WHERE movimiento_origen_id = NEW.abono_id AND tipo = 'REVERSO'
  ) THEN
    RAISE EXCEPTION 'E2: finalization does not match persisted applications';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.e2_validate_abono_finalization() OWNER TO postgres;

--
-- Name: e2_validate_unused_proof(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.e2_validate_unused_proof() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  final_row public.finalizaciones_abono_e2%ROWTYPE;
  retained_xid xid8;
  retained_customer integer;
  retained_amount numeric;
BEGIN
  IF NEW.abono_id IS NULL THEN
    SELECT e2_insert_xid, cliente_id, importe
      INTO retained_xid, retained_customer, retained_amount
      FROM public.cobros_credito_pendientes_e1
      WHERE operacion_productor = NEW.cobro_productor
        AND operacion_productor = 'COBRO_PENDIENTE'
        AND operacion_clave = NEW.cobro_clave
        AND naturaleza = 'INGRESO_FISICO' AND medio = 'EFECTIVO'
        AND cuenta_destino = 'CAJA_FISICA' AND sesion_caja_id IS NOT NULL
      FOR SHARE;
    IF retained_xid IS NULL
       OR retained_xid IS DISTINCT FROM pg_current_xact_id()
       OR retained_customer IS DISTINCT FROM NEW.cliente_id
       OR retained_amount IS DISTINCT FROM NEW.importe THEN
      RAISE EXCEPTION 'E2: retained proof requires its new physical receipt in this transaction';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO final_row
    FROM public.finalizaciones_abono_e2
   WHERE abono_id = NEW.abono_id
   FOR SHARE;
  IF final_row.abono_id IS NULL
     OR final_row.resultado <> 'UNUSED'
     OR final_row.cliente_id IS DISTINCT FROM NEW.cliente_id
     OR final_row.importe IS DISTINCT FROM NEW.importe THEN
    RAISE EXCEPTION 'E2: positive proof requires a matching UNUSED finalization';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.e2_validate_unused_proof() OWNER TO postgres;

--
-- Name: enriquecer_auditoria(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.enriquecer_auditoria() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      DECLARE
        usuario_nombre text;
        usuario_rol text;
        usuario_sitio integer;
        sitio_nombre text;
      BEGIN
        IF NEW.usuario_id IS NOT NULL THEN
          SELECT usuario, rol::text, ubicacion_id
            INTO usuario_nombre, usuario_rol, usuario_sitio
            FROM usuarios WHERE id = NEW.usuario_id;
          NEW.usuario_snapshot := COALESCE(NEW.usuario_snapshot, usuario_nombre);
          NEW.rol_snapshot := COALESCE(NEW.rol_snapshot, usuario_rol);
          -- Catalog records have no affected operational site. Keep their
          -- explicit null instead of inheriting the editor's assigned site.
          IF NEW.entidad NOT IN ('camionetas', 'choferes') THEN
            NEW.sitio_id := COALESCE(NEW.sitio_id, usuario_sitio);
          END IF;
        END IF;
        IF NEW.sitio_id IS NOT NULL AND NEW.sitio_snapshot IS NULL THEN
          SELECT nombre INTO sitio_nombre FROM ubicaciones WHERE id = NEW.sitio_id;
          NEW.sitio_snapshot := sitio_nombre;
        END IF;
        NEW.modulo := COALESCE(NEW.modulo,
          CASE
            WHEN NEW.accion LIKE 'LOGIN_%' OR NEW.accion = 'LOGOUT' OR NEW.entidad = 'sesiones' THEN 'auth'
            WHEN NEW.entidad IN ('usuarios', 'permisos_usuario', 'permisos_rol') THEN 'usuarios'
            WHEN NEW.entidad IN ('ubicaciones') THEN 'ubicaciones'
            WHEN NEW.entidad IN ('productos', 'precios_producto') THEN 'productos'
            WHEN NEW.entidad IN ('proveedores', 'compras', 'pagos_proveedor') THEN 'proveedores'
            WHEN NEW.entidad LIKE 'cliente%' OR NEW.entidad = 'movimientos_credito' THEN 'clientes'
            WHEN NEW.entidad IN ('tickets', 'ticket_pagos') THEN 'pos'
            WHEN NEW.entidad = 'sesiones_caja' THEN 'caja'
            WHEN NEW.entidad IN ('salidas', 'salida_rollos') THEN 'salidas'
            WHEN NEW.entidad IN ('reimpresiones_etiqueta') THEN 'etiquetas'
            WHEN NEW.entidad IN ('rollos', 'entradas', 'movimientos', 'existencias') THEN 'inventario'
            WHEN NEW.entidad LIKE 'contenedor%' THEN 'contenedores'
            ELSE NEW.entidad
          END);
        RETURN NEW;
      END;
      $$;


ALTER FUNCTION public.enriquecer_auditoria() OWNER TO postgres;

--
-- Name: fondo_assert_fixed_mariana(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fondo_assert_fixed_mariana() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE valid_location boolean;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'FONDO_IMMUTABLE: fixed identity cannot be changed or deleted';
  END IF;
  SELECT activa IS TRUE AND tipo::text='TIENDA' AND upper(btrim(nombre))='MARIANA'
    INTO valid_location FROM ubicaciones WHERE id=NEW.ubicacion_id;
  IF valid_location IS DISTINCT FROM TRUE OR NEW.nombre <> 'Fondo de Mariana' THEN
    RAISE EXCEPTION 'FONDO_MARIANA_IDENTITY_INVALID';
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION public.fondo_assert_fixed_mariana() OWNER TO postgres;

--
-- Name: fondo_reject_mutation(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fondo_reject_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'FONDO_IMMUTABLE: % is append-only', TG_TABLE_NAME;
END $$;


ALTER FUNCTION public.fondo_reject_mutation() OWNER TO postgres;

--
-- Name: fondo_validate_audit(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fondo_validate_audit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE fixed_fondo uuid; actual_balance bigint; actual_version uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(4600112);
  SELECT id INTO STRICT fixed_fondo FROM fondo_mariana;
  IF NEW.fondo_id <> fixed_fondo THEN RAISE EXCEPTION 'FONDO_MARIANA_IDENTITY_INVALID'; END IF;
  SELECT COALESCE(sum(CASE WHEN naturaleza='INGRESO' THEN importe_centavos ELSE -importe_centavos END),0),
         (array_agg(id ORDER BY ordinal DESC))[1]
    INTO actual_balance,actual_version FROM fondo_movimientos WHERE fondo_id=NEW.fondo_id;
  IF NEW.saldo_sistema_centavos <> actual_balance
     OR NEW.version_saldo IS DISTINCT FROM actual_version THEN
    RAISE EXCEPTION 'FONDO_VERSION_SALDO_OBSOLETA';
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION public.fondo_validate_audit() OWNER TO postgres;

--
-- Name: fondo_validate_movement(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fondo_validate_movement() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
  current_balance bigint;
  movement_count bigint;
  original fondo_movimientos%ROWTYPE;
  fixed_fondo uuid;
  declared_count bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(4600112);
  IF NEW.ordinal IS NOT NULL THEN RAISE EXCEPTION 'FONDO_ORDINAL_SERVER_ONLY'; END IF;
  NEW.ordinal := nextval('fondo_movimientos_ordinal_seq');
  SELECT id INTO STRICT fixed_fondo FROM fondo_mariana;
  IF NEW.fondo_id <> fixed_fondo THEN RAISE EXCEPTION 'FONDO_MARIANA_IDENTITY_INVALID'; END IF;
  SELECT count(*),
         COALESCE(sum(CASE WHEN naturaleza='INGRESO' THEN importe_centavos ELSE -importe_centavos END),0)
    INTO movement_count,current_balance FROM fondo_movimientos WHERE fondo_id=NEW.fondo_id;

  IF NEW.original_id IS NULL THEN
    IF movement_count = 0 AND NEW.categoria <> 'SALDO_INICIAL' THEN
      RAISE EXCEPTION 'FONDO_SALDO_INICIAL_INVALIDO';
    END IF;
    IF NEW.categoria='SALDO_INICIAL' THEN
      IF movement_count <> 0 OR NEW.naturaleza <> 'INGRESO' OR NEW.motivo <> 'saldo inicial'
         OR jsonb_typeof(NEW.conciliacion_inicial) IS DISTINCT FROM 'object'
         OR jsonb_typeof(NEW.conciliacion_inicial->'declaracionSinDuplicacion') IS DISTINCT FROM 'boolean'
         OR NEW.conciliacion_inicial->'declaracionSinDuplicacion' IS DISTINCT FROM 'true'::jsonb
         OR jsonb_typeof(NEW.conciliacion_inicial->'efectivoFisicoContado') IS DISTINCT FROM 'string'
         OR coalesce(NEW.conciliacion_inicial->>'efectivoFisicoContado','') !~ '^(0|[1-9][0-9]*)\.[0-9]{2}$'
         OR jsonb_typeof(NEW.conciliacion_inicial->'evidencia') IS DISTINCT FROM 'string'
         OR nullif(btrim(coalesce(NEW.conciliacion_inicial->>'evidencia','')),'') IS NULL
         OR char_length(NEW.conciliacion_inicial->>'evidencia') > 1000 THEN
        RAISE EXCEPTION 'FONDO_SALDO_INICIAL_INVALIDO';
      END IF;
      declared_count :=
        split_part(NEW.conciliacion_inicial->>'efectivoFisicoContado','.',1)::bigint * 100
        + split_part(NEW.conciliacion_inicial->>'efectivoFisicoContado','.',2)::bigint;
      IF declared_count IS DISTINCT FROM NEW.importe_centavos THEN RAISE EXCEPTION 'FONDO_SALDO_INICIAL_INVALIDO'; END IF;
    ELSE
      IF NEW.categoria='RETIRO' AND NEW.naturaleza <> 'RETIRO'
         OR NEW.categoria IN ('CAPITAL','OTRO_INGRESO') AND NEW.naturaleza <> 'INGRESO'
         OR NEW.conciliacion_inicial IS NOT NULL THEN
        RAISE EXCEPTION 'FONDO_MOVIMIENTO_INVALIDO';
      END IF;
    END IF;
  ELSE
    SELECT * INTO STRICT original FROM fondo_movimientos WHERE id=NEW.original_id FOR UPDATE;
    IF original.fondo_id <> NEW.fondo_id OR original.original_id IS NOT NULL
       OR NEW.importe_centavos <> original.importe_centavos
       OR NEW.categoria <> original.categoria
       OR NEW.naturaleza = original.naturaleza
       OR NEW.conciliacion_inicial IS NOT NULL THEN
      RAISE EXCEPTION 'FONDO_INVERSO_INVALIDO';
    END IF;
  END IF;
  IF NEW.original_id IS NULL AND NEW.naturaleza='RETIRO'
     AND current_balance < NEW.importe_centavos THEN
    RAISE EXCEPTION 'FONDO_SALDO_INSUFICIENTE';
  END IF;
  RETURN NEW;
END $_$;


ALTER FUNCTION public.fondo_validate_movement() OWNER TO postgres;

--
-- Name: impedir_mutacion_credito_e1(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.impedir_mutacion_credito_e1() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  RAISE EXCEPTION 'E1: % sobre % está prohibido; evidencia inmutable', TG_OP, TG_TABLE_NAME;
END;
$$;


ALTER FUNCTION public.impedir_mutacion_credito_e1() OWNER TO postgres;

--
-- Name: prevent_financial_record_mutation(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_financial_record_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        RAISE EXCEPTION 'Los pagos y movimientos financieros son inmutables; registre un reverso o ajuste.';
      END $$;


ALTER FUNCTION public.prevent_financial_record_mutation() OWNER TO postgres;

--
-- Name: prevent_pago_proveedor_mutation(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_pago_proveedor_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'Los pagos a proveedor son inmutables; registre un reverso o ajuste.';
    END $$;


ALTER FUNCTION public.prevent_pago_proveedor_mutation() OWNER TO postgres;

--
-- Name: proteger_aplicaciones_pago_proveedor(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.proteger_aplicaciones_pago_proveedor() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        RAISE EXCEPTION 'aplicaciones_pago_proveedor es append-only';
      END;
      $$;


ALTER FUNCTION public.proteger_aplicaciones_pago_proveedor() OWNER TO postgres;

--
-- Name: proteger_auditoria_append_only(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.proteger_auditoria_append_only() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
       BEGIN
         RAISE EXCEPTION 'auditoria es append-only';
       END;
       $$;


ALTER FUNCTION public.proteger_auditoria_append_only() OWNER TO postgres;

--
-- Name: proteger_auditoria_resolucion_append_only(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.proteger_auditoria_resolucion_append_only() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
        BEGIN
          RAISE EXCEPTION 'La evidencia y las decisiones de auditoría son append-only; registre un hecho nuevo.';
        END;
      $$;


ALTER FUNCTION public.proteger_auditoria_resolucion_append_only() OWNER TO postgres;

--
-- Name: ticket_linea_consumos_guard(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ticket_linea_consumos_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  original ticket_linea_consumos%ROWTYPE;
  movement movimientos%ROWTYPE;
  reversal_quantity BIGINT;
  reversal_revenue BIGINT;
  reversal_cost BIGINT;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION 'ticket_linea_consumos is append-only';
  END IF;

  IF NEW.movimiento_id IS NULL THEN
    RAISE EXCEPTION 'ticket_linea_consumos requires a movement';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM ticket_lineas
     WHERE id = NEW.ticket_linea_id
       AND ticket_id = NEW.ticket_id
  ) THEN
    RAISE EXCEPTION 'allocation line does not belong to its ticket';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM rollos r
      JOIN entradas e ON e.id = r.recepcion_id
     WHERE r.id = NEW.rollo_id
       AND r.recepcion_id = NEW.entrada_id
       AND e.proveedor_id = NEW.proveedor_id
  ) THEN
    RAISE EXCEPTION 'allocation source does not match roll entry supplier';
  END IF;

  SELECT *
    INTO movement
    FROM movimientos
   WHERE id = NEW.movimiento_id;
  IF NOT FOUND OR movement.rollo_id <> NEW.rollo_id
     OR movement.tipo NOT IN ('VENTA', 'CANCELACION')
     OR movement.documento_id IS DISTINCT FROM NEW.ticket_id::text THEN
    RAISE EXCEPTION 'allocation movement does not match its ticket and roll';
  END IF;

  IF NEW.tipo = 'CONSUMO' THEN
    IF NEW.reversa_de_id IS NOT NULL
       OR movement.tipo <> 'VENTA' THEN
      RAISE EXCEPTION 'CONSUMO must reference a VENTA movement and no reversal';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.tipo <> 'REVERSA' OR NEW.reversa_de_id IS NULL
     OR movement.tipo <> 'CANCELACION' THEN
    RAISE EXCEPTION 'REVERSA must reference a cancellation movement and source';
  END IF;

  SELECT *
    INTO original
    FROM ticket_linea_consumos
   WHERE id = NEW.reversa_de_id
     AND tipo = 'CONSUMO'
   FOR UPDATE;
  IF NOT FOUND
     OR original.ticket_id <> NEW.ticket_id
     OR original.ticket_linea_id <> NEW.ticket_linea_id
     OR original.rollo_id <> NEW.rollo_id
     OR original.entrada_id <> NEW.entrada_id
     OR original.proveedor_id <> NEW.proveedor_id
     OR original.movimiento_id IS DISTINCT FROM movement.movimiento_origen_id
     OR (original.costo_centavos IS NULL) <> (NEW.costo_centavos IS NULL) THEN
    RAISE EXCEPTION 'REVERSA source identity does not match its CONSUMO';
  END IF;

  SELECT COALESCE(SUM(cantidad_milesimas), 0),
         COALESCE(SUM(ingreso_centavos), 0),
         COALESCE(SUM(costo_centavos), 0)
    INTO reversal_quantity, reversal_revenue, reversal_cost
    FROM ticket_linea_consumos
   WHERE reversa_de_id = original.id
     AND tipo = 'REVERSA';
  IF NEW.cantidad_milesimas > original.cantidad_milesimas - reversal_quantity
     OR NEW.ingreso_centavos > original.ingreso_centavos - reversal_revenue
     OR NEW.costo_centavos IS NOT NULL
        AND NEW.costo_centavos > original.costo_centavos - reversal_cost THEN
    RAISE EXCEPTION 'REVERSA exceeds the remaining CONSUMO allocation';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.ticket_linea_consumos_guard() OWNER TO postgres;

--
-- Name: validar_aplicacion_pago_proveedor(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validar_aplicacion_pago_proveedor() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      DECLARE pago pagos_proveedor%ROWTYPE; compra pagos_proveedor%ROWTYPE;
      BEGIN
        SELECT * INTO pago FROM pagos_proveedor
          WHERE id = NEW.pago_proveedor_id FOR UPDATE;
        SELECT * INTO compra FROM pagos_proveedor
          WHERE id = NEW.compra_proveedor_id FOR UPDATE;
        IF pago.id IS NULL OR compra.id IS NULL OR pago.tipo <> 'PAGO'
          OR compra.tipo <> 'COMPRA' OR pago.proveedor_id <> compra.proveedor_id THEN
          RAISE EXCEPTION 'Aplicación proveedor inválida: pago PAGO y compra COMPRA del mismo proveedor requeridos';
        END IF;
        IF EXISTS (
          SELECT 1 FROM pagos_proveedor r
          WHERE r.tipo = 'REVERSO' AND r.movimiento_origen_id = pago.id
        ) THEN
          RAISE EXCEPTION 'No se puede aplicar un pago proveedor revertido';
        END IF;
        IF NEW.importe <= 0
          OR NEW.importe > -pago.importe - COALESCE((
            SELECT SUM(a.importe)
            FROM aplicaciones_pago_proveedor a
            WHERE a.pago_proveedor_id = pago.id
              AND NOT EXISTS (
                SELECT 1 FROM pagos_proveedor r
                WHERE r.tipo = 'REVERSO'
                  AND r.movimiento_origen_id = a.pago_proveedor_id
              )
          ), 0)
          OR NEW.importe > compra.importe - COALESCE((
            SELECT SUM(a.importe)
            FROM aplicaciones_pago_proveedor a
            WHERE a.compra_proveedor_id = compra.id
              AND NOT EXISTS (
                SELECT 1 FROM pagos_proveedor r
                WHERE r.tipo = 'REVERSO'
                  AND r.movimiento_origen_id = a.pago_proveedor_id
              )
          ), 0) THEN
          RAISE EXCEPTION 'Aplicación proveedor excede el saldo disponible';
        END IF;
        RETURN NEW;
      END;
      $$;


ALTER FUNCTION public.validar_aplicacion_pago_proveedor() OWNER TO postgres;

--
-- Name: validar_atribucion_credito_e1(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validar_atribucion_credito_e1() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION public.validar_atribucion_credito_e1() OWNER TO postgres;

--
-- Name: validar_cobro_pendiente_e1(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validar_cobro_pendiente_e1() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION public.validar_cobro_pendiente_e1() OWNER TO postgres;

--
-- Name: validar_contexto_credito_e1(integer, integer, public.naturaleza_credito_e1, public.forma_pago_cuenta, text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validar_contexto_credito_e1(p_usuario integer, p_sitio integer, p_naturaleza public.naturaleza_credito_e1, p_medio public.forma_pago_cuenta, p_cuenta text, p_sesion integer) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION public.validar_contexto_credito_e1(p_usuario integer, p_sitio integer, p_naturaleza public.naturaleza_credito_e1, p_medio public.forma_pago_cuenta, p_cuenta text, p_sesion integer) OWNER TO postgres;

--
-- Name: validar_movimiento_credito_e1(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validar_movimiento_credito_e1() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION public.validar_movimiento_credito_e1() OWNER TO postgres;

--
-- Name: validar_revision_etiqueta_reimpresion(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validar_revision_etiqueta_reimpresion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM reimpresiones_etiqueta re
          WHERE re.id = NEW.reimpresion_id
            AND re.rollo_id = NEW.rollo_id
        ) THEN
          RAISE EXCEPTION 'La revisión no corresponde a la última reimpresión del rollo';
        END IF;
        RETURN NEW;
      END;
      $$;


ALTER FUNCTION public.validar_revision_etiqueta_reimpresion() OWNER TO postgres;

--
-- Name: validate_credit_application(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_credit_application() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
       DECLARE abono movimientos_credito%ROWTYPE;
       DECLARE venta movimientos_credito%ROWTYPE;
       DECLARE cliente_bloqueo integer;
       BEGIN
         SELECT cliente_id INTO cliente_bloqueo
           FROM movimientos_credito WHERE id = NEW.abono_movimiento_id;
         IF cliente_bloqueo IS NOT NULL THEN
           PERFORM 1 FROM clientes
             WHERE id = cliente_bloqueo FOR UPDATE;
         END IF;
         SELECT * INTO abono FROM movimientos_credito
           WHERE id = NEW.abono_movimiento_id FOR UPDATE;
         SELECT * INTO venta FROM movimientos_credito
           WHERE id = NEW.venta_movimiento_id FOR UPDATE;
         IF abono.id IS NULL OR venta.id IS NULL
           OR abono.tipo <> 'ABONO' OR venta.tipo <> 'VENTA_CREDITO'
           OR abono.cliente_id IS DISTINCT FROM venta.cliente_id THEN
           RAISE EXCEPTION 'Una aplicación debe enlazar un ABONO y una VENTA_CREDITO del mismo cliente.';
         END IF;
         IF EXISTS (
           SELECT 1 FROM movimientos_credito r
           WHERE r.tipo = 'REVERSO' AND r.movimiento_origen_id = abono.id
         ) THEN
           RAISE EXCEPTION 'No se puede aplicar un ABONO revertido.';
         END IF;
         IF NEW.importe <= 0
           OR NEW.importe > -abono.importe - COALESCE((
             SELECT SUM(a.importe) FROM aplicaciones_credito a
             WHERE a.abono_movimiento_id = abono.id
               AND NOT EXISTS (
                 SELECT 1 FROM movimientos_credito r
                 WHERE r.tipo = 'REVERSO'
                   AND r.movimiento_origen_id = a.abono_movimiento_id
               )
           ), 0) THEN
           RAISE EXCEPTION 'La aplicación de crédito excede el saldo disponible.';
         END IF;
         RETURN NEW;
       END $$;


ALTER FUNCTION public.validate_credit_application() OWNER TO postgres;

--
-- Name: validate_credit_reversal(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_credit_reversal() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
       DECLARE origen movimientos_credito%ROWTYPE;
       BEGIN
         IF NEW.tipo <> 'REVERSO' THEN RETURN NEW; END IF;
         IF NEW.movimiento_origen_id IS NULL THEN
           RAISE EXCEPTION 'El reverso debe referenciar su movimiento de origen.';
         END IF;
          SELECT * INTO origen FROM movimientos_credito WHERE id=NEW.movimiento_origen_id;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'El reverso de crédito debe tener un origen compatible, del mismo cliente y por el importe exacto.';
          END IF;
          IF origen.tipo = 'ABONO'
            AND origen.cliente_id = NEW.cliente_id
            AND origen.importe < 0
            AND NEW.importe = -origen.importe THEN
            RETURN NEW;
          END IF;
          IF origen.tipo = 'VENTA_CREDITO'
            AND origen.cliente_id = NEW.cliente_id
            AND origen.importe > 0
            AND NEW.importe = -origen.importe
            AND NEW.ticket_id IS NOT DISTINCT FROM origen.ticket_id THEN
            RETURN NEW;
          END IF;
          RAISE EXCEPTION 'El reverso de crédito debe tener un origen compatible, del mismo cliente y por el importe exacto.';
       END $$;


ALTER FUNCTION public.validate_credit_reversal() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: aplicaciones_credito; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.aplicaciones_credito (
    id integer NOT NULL,
    abono_movimiento_id integer NOT NULL,
    venta_movimiento_id integer NOT NULL,
    importe numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT aplicaciones_credito_importe_check CHECK ((importe > (0)::numeric))
);


ALTER TABLE public.aplicaciones_credito OWNER TO postgres;

--
-- Name: aplicaciones_credito_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.aplicaciones_credito_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.aplicaciones_credito_id_seq OWNER TO postgres;

--
-- Name: aplicaciones_credito_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.aplicaciones_credito_id_seq OWNED BY public.aplicaciones_credito.id;


--
-- Name: aplicaciones_pago_proveedor; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.aplicaciones_pago_proveedor (
    id integer NOT NULL,
    pago_proveedor_id integer NOT NULL,
    compra_proveedor_id integer NOT NULL,
    importe numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT aplicaciones_pago_proveedor_importe_check CHECK ((importe > (0)::numeric))
);


ALTER TABLE public.aplicaciones_pago_proveedor OWNER TO postgres;

--
-- Name: aplicaciones_pago_proveedor_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.aplicaciones_pago_proveedor_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.aplicaciones_pago_proveedor_id_seq OWNER TO postgres;

--
-- Name: aplicaciones_pago_proveedor_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.aplicaciones_pago_proveedor_id_seq OWNED BY public.aplicaciones_pago_proveedor.id;


--
-- Name: atribuciones_credito_e1; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.atribuciones_credito_e1 (
    id uuid NOT NULL,
    movimiento_id integer NOT NULL,
    movimiento_created_at timestamp with time zone NOT NULL,
    identidad_snapshot jsonb NOT NULL,
    sitio_origen_id integer NOT NULL,
    evidencia text NOT NULL,
    motivo text NOT NULL,
    usuario_id integer NOT NULL,
    anterior_id uuid,
    created_at timestamp with time zone DEFAULT transaction_timestamp() NOT NULL,
    CONSTRAINT atribuciones_anterior_ck_e1 CHECK (((anterior_id IS NULL) OR (anterior_id <> id))),
    CONSTRAINT atribuciones_evidencia_ck_e1 CHECK (((btrim(evidencia) <> ''::text) AND (btrim(motivo) <> ''::text))),
    CONSTRAINT atribuciones_fecha_ck_e1 CHECK ((isfinite(movimiento_created_at) AND isfinite(created_at))),
    CONSTRAINT atribuciones_json_ck_e1 CHECK ((jsonb_typeof(identidad_snapshot) = 'object'::text))
);


ALTER TABLE public.atribuciones_credito_e1 OWNER TO postgres;

--
-- Name: auditoria; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auditoria (
    id bigint NOT NULL,
    usuario_id integer,
    accion text NOT NULL,
    entidad text NOT NULL,
    entidad_id text,
    datos_antes jsonb,
    datos_despues jsonb,
    ip text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    usuario_snapshot text,
    rol_snapshot text,
    sitio_id integer,
    sitio_snapshot text,
    modulo text
);


ALTER TABLE public.auditoria OWNER TO postgres;

--
-- Name: auditoria_faltante_reactivaciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auditoria_faltante_reactivaciones (
    id integer NOT NULL,
    rollo_id integer NOT NULL,
    auditoria_origen_id integer NOT NULL,
    movimiento_baja_id bigint NOT NULL,
    movimiento_reactivacion_id bigint NOT NULL,
    ubicacion_aparicion_id integer NOT NULL,
    piso_aparicion_id integer,
    cantidad_restaurada numeric(10,3) NOT NULL,
    usuario_id integer NOT NULL,
    motivo text NOT NULL,
    origen text NOT NULL,
    uuid_cliente uuid NOT NULL,
    auditorias_posteriores jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT auditoria_faltante_reactivaciones_cantidad_restaurada_check CHECK ((cantidad_restaurada > (0)::numeric)),
    CONSTRAINT auditoria_faltante_reactivaciones_motivo_check CHECK ((length(TRIM(BOTH FROM motivo)) >= 10)),
    CONSTRAINT auditoria_faltante_reactivaciones_origen_check CHECK ((origen = ANY (ARRAY['AUDITORIA'::text, 'ROLLO'::text])))
);


ALTER TABLE public.auditoria_faltante_reactivaciones OWNER TO postgres;

--
-- Name: auditoria_faltante_reactivaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.auditoria_faltante_reactivaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.auditoria_faltante_reactivaciones_id_seq OWNER TO postgres;

--
-- Name: auditoria_faltante_reactivaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.auditoria_faltante_reactivaciones_id_seq OWNED BY public.auditoria_faltante_reactivaciones.id;


--
-- Name: auditoria_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.auditoria_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.auditoria_id_seq OWNER TO postgres;

--
-- Name: auditoria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.auditoria_id_seq OWNED BY public.auditoria.id;


--
-- Name: auditoria_inventario_escaneos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auditoria_inventario_escaneos (
    auditoria_id integer NOT NULL,
    serie text NOT NULL,
    rollo_id integer,
    usuario_id integer NOT NULL,
    escaneado_at timestamp with time zone DEFAULT now() NOT NULL,
    cantidad_cierre numeric(10,3),
    unidad_cierre text,
    estado_cierre text,
    ubicacion_cierre_id integer,
    ubicacion_cierre text,
    resolucion text DEFAULT 'PENDIENTE'::text NOT NULL,
    sku_cierre text,
    tela_cierre text,
    color_cierre text,
    piso_real_id integer,
    piso_real text
);


ALTER TABLE public.auditoria_inventario_escaneos OWNER TO postgres;

--
-- Name: auditoria_inventario_folio; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auditoria_inventario_folio (
    ubicacion_id integer NOT NULL,
    ultimo_folio integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.auditoria_inventario_folio OWNER TO postgres;

--
-- Name: auditoria_inventario_participantes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auditoria_inventario_participantes (
    auditoria_id integer NOT NULL,
    usuario_id integer NOT NULL,
    escaneos integer DEFAULT 0 NOT NULL,
    primero_at timestamp with time zone DEFAULT now() NOT NULL,
    ultimo_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.auditoria_inventario_participantes OWNER TO postgres;

--
-- Name: auditoria_inventario_snapshot; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auditoria_inventario_snapshot (
    auditoria_id integer NOT NULL,
    rollo_id integer NOT NULL,
    serie text NOT NULL,
    cantidad_snapshot numeric(10,3) NOT NULL,
    resolucion text DEFAULT 'PENDIENTE'::text NOT NULL,
    sku_snapshot text NOT NULL,
    tela_snapshot text NOT NULL,
    color_snapshot text NOT NULL,
    unidad_snapshot text NOT NULL,
    ubicacion_snapshot_id integer NOT NULL,
    ubicacion_snapshot text NOT NULL,
    estado_snapshot text NOT NULL,
    piso_snapshot_id integer,
    piso_snapshot text
);


ALTER TABLE public.auditoria_inventario_snapshot OWNER TO postgres;

--
-- Name: auditoria_sobrante_contextos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auditoria_sobrante_contextos (
    auditoria_id integer NOT NULL,
    serie text NOT NULL,
    contexto jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.auditoria_sobrante_contextos OWNER TO postgres;

--
-- Name: auditoria_sobrante_decisiones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auditoria_sobrante_decisiones (
    id integer NOT NULL,
    auditoria_id integer NOT NULL,
    serie text NOT NULL,
    rollo_id integer,
    decision text NOT NULL,
    motivo text NOT NULL,
    usuario_id integer NOT NULL,
    salida_id integer,
    uuid_cliente uuid NOT NULL,
    contexto jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT auditoria_sobrante_decisiones_decision_check CHECK ((decision = ANY (ARRAY['DEJAR'::text, 'REGRESAR'::text, 'INVESTIGAR'::text]))),
    CONSTRAINT auditoria_sobrante_decisiones_motivo_check CHECK ((length(TRIM(BOTH FROM motivo)) >= 10))
);


ALTER TABLE public.auditoria_sobrante_decisiones OWNER TO postgres;

--
-- Name: auditoria_sobrante_decisiones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.auditoria_sobrante_decisiones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.auditoria_sobrante_decisiones_id_seq OWNER TO postgres;

--
-- Name: auditoria_sobrante_decisiones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.auditoria_sobrante_decisiones_id_seq OWNED BY public.auditoria_sobrante_decisiones.id;


--
-- Name: auditorias_inventario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auditorias_inventario (
    id integer NOT NULL,
    folio integer NOT NULL,
    ubicacion_id integer NOT NULL,
    estado text DEFAULT 'ABIERTA'::text NOT NULL,
    creada_por_id integer NOT NULL,
    cerrada_por_id integer,
    confirmada_por_id integer,
    cancelada_por_id integer,
    motivo_cancelacion text,
    abierta_at timestamp with time zone DEFAULT now() NOT NULL,
    cerrada_at timestamp with time zone,
    confirmada_at timestamp with time zone,
    cancelada_at timestamp with time zone,
    CONSTRAINT auditorias_inventario_estado_check CHECK ((estado = ANY (ARRAY['ABIERTA'::text, 'CERRADA'::text, 'CANCELADA'::text, 'CONFIRMADA'::text])))
);


ALTER TABLE public.auditorias_inventario OWNER TO postgres;

--
-- Name: auditorias_inventario_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.auditorias_inventario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.auditorias_inventario_id_seq OWNER TO postgres;

--
-- Name: auditorias_inventario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.auditorias_inventario_id_seq OWNED BY public.auditorias_inventario.id;


--
-- Name: autorizaciones_nota; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.autorizaciones_nota (
    id integer NOT NULL,
    ticket_id integer NOT NULL,
    sesion_caja_id integer NOT NULL,
    usuario_id integer NOT NULL,
    movimiento_credito_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.autorizaciones_nota OWNER TO postgres;

--
-- Name: autorizaciones_nota_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.autorizaciones_nota_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.autorizaciones_nota_id_seq OWNER TO postgres;

--
-- Name: autorizaciones_nota_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.autorizaciones_nota_id_seq OWNED BY public.autorizaciones_nota.id;


--
-- Name: camionetas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.camionetas (
    id integer NOT NULL,
    nombre text NOT NULL,
    placas text NOT NULL,
    marca text,
    modelo text,
    tipo text NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT camionetas_tipo_check CHECK ((tipo = ANY (ARRAY['PROPIA'::text, 'CONTRATADA'::text])))
);


ALTER TABLE public.camionetas OWNER TO postgres;

--
-- Name: camionetas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.camionetas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.camionetas_id_seq OWNER TO postgres;

--
-- Name: camionetas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.camionetas_id_seq OWNED BY public.camionetas.id;


--
-- Name: choferes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.choferes (
    id integer NOT NULL,
    nombre_completo text NOT NULL,
    telefono text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.choferes OWNER TO postgres;

--
-- Name: choferes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.choferes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.choferes_id_seq OWNER TO postgres;

--
-- Name: choferes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.choferes_id_seq OWNED BY public.choferes.id;


--
-- Name: cliente_documentos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cliente_documentos (
    id integer NOT NULL,
    public_id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id integer NOT NULL,
    tipo text DEFAULT 'INE'::text NOT NULL,
    lado text NOT NULL,
    nombre_archivo text NOT NULL,
    ruta_archivo text NOT NULL,
    mime_type text NOT NULL,
    tamano_bytes integer NOT NULL,
    subido_por integer NOT NULL,
    subido_at timestamp with time zone DEFAULT now() NOT NULL,
    vigente boolean DEFAULT true NOT NULL,
    reemplaza_id integer,
    CONSTRAINT cliente_documentos_lado_check CHECK ((lado = ANY (ARRAY['FRENTE'::text, 'REVERSO'::text]))),
    CONSTRAINT cliente_documentos_tamano_check CHECK (((tamano_bytes > 0) AND (tamano_bytes <= 5242880))),
    CONSTRAINT cliente_documentos_tipo_check CHECK ((tipo = 'INE'::text))
);


ALTER TABLE public.cliente_documentos OWNER TO postgres;

--
-- Name: cliente_documentos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cliente_documentos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cliente_documentos_id_seq OWNER TO postgres;

--
-- Name: cliente_documentos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cliente_documentos_id_seq OWNED BY public.cliente_documentos.id;


--
-- Name: clientes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clientes (
    id integer NOT NULL,
    nombre text NOT NULL,
    telefono text,
    correo text,
    direccion_particular text,
    rfc text,
    notas text,
    activo boolean DEFAULT true NOT NULL,
    limite_credito numeric(14,2) DEFAULT 0.00 NOT NULL,
    saldo_credito numeric(14,2) DEFAULT 0.00 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    es_sistema boolean DEFAULT false NOT NULL,
    contacto_nombre text,
    dias_credito integer DEFAULT 0 NOT NULL,
    direccion_entrega text,
    recibe_nota_sin_precios boolean DEFAULT false NOT NULL
);


ALTER TABLE public.clientes OWNER TO postgres;

--
-- Name: clientes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.clientes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clientes_id_seq OWNER TO postgres;

--
-- Name: clientes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.clientes_id_seq OWNED BY public.clientes.id;


--
-- Name: cobros_credito_pendientes_e1; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cobros_credito_pendientes_e1 (
    operacion_productor text NOT NULL,
    operacion_clave uuid NOT NULL,
    naturaleza public.naturaleza_credito_e1 NOT NULL,
    cliente_id integer NOT NULL,
    importe numeric(12,2) NOT NULL,
    fecha_real timestamp with time zone NOT NULL,
    sitio_origen_id integer NOT NULL,
    medio public.forma_pago_cuenta NOT NULL,
    cuenta_destino text NOT NULL,
    sesion_caja_id integer,
    motivo text,
    referencia text,
    usuario_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT transaction_timestamp() NOT NULL,
    e2_insert_xid xid8,
    CONSTRAINT cobros_evidencia_ck_e1 CHECK (((NULLIF(btrim(motivo), ''::text) IS NOT NULL) OR (NULLIF(btrim(referencia), ''::text) IS NOT NULL))),
    CONSTRAINT cobros_fecha_ck_e1 CHECK ((isfinite(fecha_real) AND isfinite(created_at))),
    CONSTRAINT cobros_importe_ck_e1 CHECK (((importe > (0)::numeric) AND (importe <> ALL (ARRAY['NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric])))),
    CONSTRAINT cobros_medio_cuenta_ck_e1 CHECK ((((medio = 'EFECTIVO'::public.forma_pago_cuenta) AND (cuenta_destino = 'CAJA_FISICA'::text) AND (sesion_caja_id IS NOT NULL)) OR ((medio = ANY (ARRAY['TRANSFERENCIA'::public.forma_pago_cuenta, 'FACTURADO'::public.forma_pago_cuenta])) AND (cuenta_destino = ANY (ARRAY['CUENTA_FISCAL'::text, 'CUENTA_NO_FISCAL'::text])) AND (sesion_caja_id IS NULL)))),
    CONSTRAINT cobros_productor_ck_e1 CHECK (((operacion_productor = 'COBRO_PENDIENTE'::text) AND (naturaleza = 'INGRESO_FISICO'::public.naturaleza_credito_e1)))
);


ALTER TABLE public.cobros_credito_pendientes_e1 OWNER TO postgres;

--
-- Name: contenedor_lineas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contenedor_lineas (
    id integer NOT NULL,
    contenedor_id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad_esperada numeric(10,3) NOT NULL,
    rollos_esperados integer,
    nota text,
    CONSTRAINT contenedor_lineas_cantidad_check CHECK ((cantidad_esperada > (0)::numeric)),
    CONSTRAINT contenedor_lineas_rollos_check CHECK (((rollos_esperados IS NULL) OR (rollos_esperados > 0)))
);


ALTER TABLE public.contenedor_lineas OWNER TO postgres;

--
-- Name: contenedor_lineas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.contenedor_lineas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contenedor_lineas_id_seq OWNER TO postgres;

--
-- Name: contenedor_lineas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.contenedor_lineas_id_seq OWNED BY public.contenedor_lineas.id;


--
-- Name: contenedores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contenedores (
    id integer NOT NULL,
    folio integer NOT NULL,
    proveedor_id integer NOT NULL,
    referencia text,
    fecha_pedido date,
    fecha_estimada_llegada date NOT NULL,
    fecha_real_llegada date,
    sitio_destino_id integer NOT NULL,
    entrada_id integer,
    estado text DEFAULT 'EN_TRANSITO'::text NOT NULL,
    notas text,
    motivo_cancelacion text,
    usuario_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contenedores_cancelacion_check CHECK (((estado <> 'CANCELADO'::text) OR (char_length(motivo_cancelacion) >= 10))),
    CONSTRAINT contenedores_estado_check CHECK ((estado = ANY (ARRAY['EN_TRANSITO'::text, 'RECIBIDO'::text, 'CANCELADO'::text]))),
    CONSTRAINT contenedores_recepcion_check CHECK (((estado <> 'RECIBIDO'::text) OR ((entrada_id IS NOT NULL) AND (fecha_real_llegada IS NOT NULL))))
);


ALTER TABLE public.contenedores OWNER TO postgres;

--
-- Name: contenedores_folio_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.contenedores_folio_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contenedores_folio_seq OWNER TO postgres;

--
-- Name: contenedores_folio_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.contenedores_folio_seq OWNED BY public.contenedores.folio;


--
-- Name: contenedores_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.contenedores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contenedores_id_seq OWNER TO postgres;

--
-- Name: contenedores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.contenedores_id_seq OWNED BY public.contenedores.id;


--
-- Name: cuadre_fiscal_registros; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cuadre_fiscal_registros (
    id integer NOT NULL,
    tipo text NOT NULL,
    desde date NOT NULL,
    hasta date NOT NULL,
    ubicacion_id integer,
    facturado_congelado numeric(12,2) NOT NULL,
    actor_id integer NOT NULL,
    direccion text,
    monto numeric(12,2),
    descripcion text,
    estado text NOT NULL,
    nota_resolucion text,
    resuelto_por_id integer,
    resuelto_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cuadre_fiscal_registros_check CHECK ((((tipo = 'CONFIRMACION'::text) AND (estado = 'CONFIRMADA'::text)) OR (tipo = 'DIFERENCIA'::text))),
    CONSTRAINT cuadre_fiscal_registros_check1 CHECK ((((tipo = 'DIFERENCIA'::text) AND (monto > (0)::numeric) AND (char_length(descripcion) >= 20) AND (direccion IS NOT NULL)) OR (tipo = 'CONFIRMACION'::text))),
    CONSTRAINT cuadre_fiscal_registros_direccion_check CHECK ((direccion = ANY (ARRAY['MAS'::text, 'MENOS'::text]))),
    CONSTRAINT cuadre_fiscal_registros_estado_check CHECK ((estado = ANY (ARRAY['CONFIRMADA'::text, 'PENDIENTE'::text, 'RESUELTA'::text]))),
    CONSTRAINT cuadre_fiscal_registros_tipo_check CHECK ((tipo = ANY (ARRAY['CONFIRMACION'::text, 'DIFERENCIA'::text])))
);


ALTER TABLE public.cuadre_fiscal_registros OWNER TO postgres;

--
-- Name: cuadre_fiscal_registros_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cuadre_fiscal_registros_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cuadre_fiscal_registros_id_seq OWNER TO postgres;

--
-- Name: cuadre_fiscal_registros_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cuadre_fiscal_registros_id_seq OWNED BY public.cuadre_fiscal_registros.id;


--
-- Name: entrada_folio; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entrada_folio (
    ultimo_folio integer DEFAULT 0 NOT NULL,
    ubicacion_id integer NOT NULL
);


ALTER TABLE public.entrada_folio OWNER TO postgres;

--
-- Name: entradas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entradas (
    id integer NOT NULL,
    folio integer NOT NULL,
    ubicacion_id integer NOT NULL,
    proveedor_id integer,
    usuario_id integer NOT NULL,
    fecha timestamp with time zone NOT NULL,
    observaciones text,
    total_rollos integer NOT NULL,
    total_costo numeric(12,2),
    uuid_cliente uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.entradas OWNER TO postgres;

--
-- Name: entradas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.entradas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.entradas_id_seq OWNER TO postgres;

--
-- Name: entradas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.entradas_id_seq OWNED BY public.entradas.id;


--
-- Name: equipos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.equipos (
    id integer NOT NULL,
    ubicacion_id integer NOT NULL,
    tipo text NOT NULL,
    identificador text NOT NULL,
    marca text NOT NULL,
    modelo text NOT NULL,
    numero_serie text,
    notas text,
    creado_por integer NOT NULL,
    actualizado_por integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipos_tipo_check CHECK ((tipo = ANY (ARRAY['COMPUTADORA_POS'::text, 'IMPRESORA_ENTRADAS'::text, 'IMPRESORA_SALIDAS_NOTAS'::text, 'IMPRESORA_ETIQUETAS'::text, 'IMPRESORA_TICKETS'::text, 'PISTOLA_ESCANER'::text, 'SMARTPHONE_ESCANER'::text])))
);


ALTER TABLE public.equipos OWNER TO postgres;

--
-- Name: equipos_checklist; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.equipos_checklist (
    equipo_id integer NOT NULL,
    item_key text NOT NULL,
    checked_por integer NOT NULL,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipos_checklist_item_key_check CHECK ((item_key = ANY (ARRAY['PAPEL_NAVEGADOR_80MM'::text, 'MARGENES_NINGUNO'::text, 'ESCALA_REAL'::text, 'IMPRESORA_PREDETERMINADA'::text, 'ENTRADA_REAL'::text, 'PAPEL_NAVEGADOR_CARTA'::text, 'SALIDA_REAL'::text, 'NOTA_REAL'::text, 'PAPEL_NAVEGADOR_A5'::text, 'PAPEL_COLOR_SITIO_BANDEJA'::text, 'ETIQUETA_REAL'::text, 'MEDIDA_100X70'::text, 'TICKET_REAL'::text, 'PAPEL_80MM'::text, 'TECLADO_ESPANOL'::text, 'QR_ROLLO'::text, 'SESION_CAMARA'::text])))
);


ALTER TABLE public.equipos_checklist OWNER TO postgres;

--
-- Name: equipos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.equipos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.equipos_id_seq OWNER TO postgres;

--
-- Name: equipos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.equipos_id_seq OWNED BY public.equipos.id;


--
-- Name: evidencia_no_aplicada_e2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evidencia_no_aplicada_e2 (
    fuente text NOT NULL,
    abono_id integer,
    cobro_productor text,
    cobro_clave uuid,
    cliente_id integer NOT NULL,
    importe numeric(12,2) NOT NULL,
    forma_pago text DEFAULT 'EFECTIVO'::text NOT NULL,
    naturaleza text DEFAULT 'INGRESO_FISICO'::text NOT NULL,
    created_at timestamp with time zone DEFAULT transaction_timestamp() NOT NULL,
    CONSTRAINT evidencia_no_aplicada_e2_check CHECK ((((abono_id IS NOT NULL) AND (cobro_productor IS NULL) AND (cobro_clave IS NULL) AND (fuente = ('ABONO:'::text || (abono_id)::text))) OR ((abono_id IS NULL) AND (cobro_productor IS NOT NULL) AND (cobro_clave IS NOT NULL) AND (cobro_productor = 'COBRO_PENDIENTE'::text) AND (fuente = ('COBRO_RETENIDO:'::text || (cobro_clave)::text))))),
    CONSTRAINT evidencia_no_aplicada_e2_forma_pago_check CHECK ((forma_pago = 'EFECTIVO'::text)),
    CONSTRAINT evidencia_no_aplicada_e2_importe_check CHECK (((importe > (0)::numeric) AND (importe < 'Infinity'::numeric))),
    CONSTRAINT evidencia_no_aplicada_e2_naturaleza_check CHECK ((naturaleza = 'INGRESO_FISICO'::text))
);


ALTER TABLE public.evidencia_no_aplicada_e2 OWNER TO postgres;

--
-- Name: existencias; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.existencias (
    producto_id integer NOT NULL,
    ubicacion_id integer NOT NULL,
    cantidad_total numeric(10,3) DEFAULT '0'::numeric NOT NULL,
    rollos_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.existencias OWNER TO postgres;

--
-- Name: finalizaciones_abono_e2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finalizaciones_abono_e2 (
    abono_id integer NOT NULL,
    operacion_productor text NOT NULL,
    operacion_clave uuid NOT NULL,
    cliente_id integer NOT NULL,
    importe numeric(12,2) NOT NULL,
    resultado text NOT NULL,
    aplicado numeric(12,2) NOT NULL,
    evaluacion jsonb NOT NULL,
    contrato_revision text NOT NULL,
    created_at timestamp with time zone DEFAULT transaction_timestamp() NOT NULL,
    CONSTRAINT finalizaciones_abono_e2_check CHECK (((aplicado >= (0)::numeric) AND (aplicado <= importe))),
    CONSTRAINT finalizaciones_abono_e2_check1 CHECK ((((resultado = 'UNUSED'::text) AND (aplicado = (0)::numeric)) OR ((resultado = 'PARTIAL'::text) AND (aplicado > (0)::numeric) AND (aplicado < importe)) OR ((resultado = 'FULL'::text) AND (aplicado = importe)))),
    CONSTRAINT finalizaciones_abono_e2_contrato_revision_check CHECK ((contrato_revision = 'e2-abono-evidence-v1'::text)),
    CONSTRAINT finalizaciones_abono_e2_evaluacion_check CHECK ((jsonb_typeof(evaluacion) = 'object'::text)),
    CONSTRAINT finalizaciones_abono_e2_importe_check CHECK (((importe > (0)::numeric) AND (importe < 'Infinity'::numeric))),
    CONSTRAINT finalizaciones_abono_e2_operacion_productor_check CHECK ((operacion_productor = ANY (ARRAY['ABONO_ORDINARIO'::text, 'ABONO_DIRIGIDO'::text]))),
    CONSTRAINT finalizaciones_abono_e2_resultado_check CHECK ((resultado = ANY (ARRAY['UNUSED'::text, 'PARTIAL'::text, 'FULL'::text])))
);


ALTER TABLE public.finalizaciones_abono_e2 OWNER TO postgres;

--
-- Name: fondo_arqueos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fondo_arqueos (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    fondo_id uuid NOT NULL,
    saldo_sistema_centavos bigint NOT NULL,
    efectivo_contado_centavos bigint NOT NULL,
    diferencia_centavos bigint NOT NULL,
    version_saldo uuid,
    motivo text NOT NULL,
    autor_id integer NOT NULL,
    idempotency_key uuid NOT NULL,
    idempotency_producer text NOT NULL,
    payload_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT fondo_arqueos_diferencia_check CHECK ((diferencia_centavos = (efectivo_contado_centavos - saldo_sistema_centavos))),
    CONSTRAINT fondo_arqueos_efectivo_check CHECK ((efectivo_contado_centavos >= 0)),
    CONSTRAINT fondo_arqueos_hash_check CHECK ((payload_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT fondo_arqueos_motivo_check CHECK (((char_length(btrim(motivo)) >= 1) AND (char_length(btrim(motivo)) <= 500))),
    CONSTRAINT fondo_arqueos_productor_check CHECK ((idempotency_producer = 'FONDO_API_ARQUEO_V1'::text))
);


ALTER TABLE public.fondo_arqueos OWNER TO postgres;

--
-- Name: fondo_mariana; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fondo_mariana (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    ubicacion_id integer NOT NULL,
    nombre text DEFAULT 'Fondo de Mariana'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fondo_mariana_nombre_check CHECK ((nombre = 'Fondo de Mariana'::text))
);


ALTER TABLE public.fondo_mariana OWNER TO postgres;

--
-- Name: fondo_movimientos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fondo_movimientos (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    ordinal bigint NOT NULL,
    fondo_id uuid NOT NULL,
    naturaleza text NOT NULL,
    categoria text NOT NULL,
    importe_centavos bigint NOT NULL,
    motivo text NOT NULL,
    autor_id integer NOT NULL,
    original_id uuid,
    idempotency_key uuid NOT NULL,
    idempotency_producer text NOT NULL,
    payload_hash text NOT NULL,
    conciliacion_inicial jsonb,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT fondo_movimientos_categoria_check CHECK ((categoria = ANY (ARRAY['SALDO_INICIAL'::text, 'CAPITAL'::text, 'OTRO_INGRESO'::text, 'RETIRO'::text]))),
    CONSTRAINT fondo_movimientos_hash_check CHECK ((payload_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT fondo_movimientos_importe_check CHECK (((importe_centavos >= 0) AND ((importe_centavos > 0) OR (categoria = 'SALDO_INICIAL'::text)))),
    CONSTRAINT fondo_movimientos_motivo_check CHECK (((char_length(btrim(motivo)) >= 1) AND (char_length(btrim(motivo)) <= 500))),
    CONSTRAINT fondo_movimientos_naturaleza_check CHECK ((naturaleza = ANY (ARRAY['INGRESO'::text, 'RETIRO'::text]))),
    CONSTRAINT fondo_movimientos_productor_check CHECK ((idempotency_producer = ANY (ARRAY['FONDO_API_MOVIMIENTO_V1'::text, 'FONDO_API_INVERSO_V1'::text])))
);


ALTER TABLE public.fondo_movimientos OWNER TO postgres;

--
-- Name: fondo_movimientos_ordinal_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.fondo_movimientos_ordinal_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.fondo_movimientos_ordinal_seq OWNER TO postgres;

--
-- Name: fondo_movimientos_ordinal_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.fondo_movimientos_ordinal_seq OWNED BY public.fondo_movimientos.ordinal;


--
-- Name: movimientos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.movimientos (
    id bigint NOT NULL,
    rollo_id integer NOT NULL,
    producto_id integer NOT NULL,
    ubicacion_id integer NOT NULL,
    tipo public.tipo_movimiento NOT NULL,
    cantidad numeric(10,3) NOT NULL,
    saldo_posterior numeric(10,3) NOT NULL,
    documento_tipo text,
    documento_id text,
    movimiento_origen_id integer,
    usuario_id integer NOT NULL,
    justificacion text,
    revisado boolean DEFAULT true NOT NULL,
    revisado_por integer,
    revisado_at timestamp with time zone,
    uuid_cliente uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    motivo_salida_extraordinaria public.motivo_salida_extraordinaria,
    salida_id integer
);


ALTER TABLE public.movimientos OWNER TO postgres;

--
-- Name: movimientos_credito; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.movimientos_credito (
    id integer NOT NULL,
    cliente_id integer NOT NULL,
    ticket_id integer,
    tipo public.tipo_movimiento_credito NOT NULL,
    importe numeric(12,2) NOT NULL,
    usuario_id integer NOT NULL,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    forma_pago public.forma_pago_cuenta,
    referencia text,
    metadata text,
    dias_plazo integer,
    fecha_vencimiento date,
    es_incobrable boolean DEFAULT false NOT NULL,
    motivo_incobrable text,
    autorizado_por integer,
    cuenta_destino text,
    movimiento_origen_id integer,
    sitio_origen_id integer,
    sesion_caja_id integer,
    naturaleza public.naturaleza_credito_e1,
    operacion_productor text,
    operacion_clave uuid,
    nota_origen_id integer,
    origen_justificacion text,
    e2_insert_xid xid8,
    CONSTRAINT movimientos_credito_cuenta_destino_check CHECK (((cuenta_destino IS NULL) OR (cuenta_destino = ANY (ARRAY['CAJA_FISICA'::text, 'CUENTA_FISCAL'::text, 'CUENTA_NO_FISCAL'::text])))),
    CONSTRAINT movimientos_credito_importe_tipo_check CHECK ((((tipo = 'VENTA_CREDITO'::public.tipo_movimiento_credito) AND (importe > (0)::numeric)) OR ((tipo = 'ABONO'::public.tipo_movimiento_credito) AND (importe < (0)::numeric)) OR ((tipo = 'REVERSO'::public.tipo_movimiento_credito) AND (importe <> (0)::numeric)) OR ((tipo = 'AJUSTE'::public.tipo_movimiento_credito) AND (importe <> (0)::numeric)))),
    CONSTRAINT movimientos_credito_plazo_check CHECK ((((dias_plazo IS NULL) AND (fecha_vencimiento IS NULL)) OR ((dias_plazo = ANY (ARRAY[7, 15, 30, 60])) AND (fecha_vencimiento IS NOT NULL))))
);


ALTER TABLE public.movimientos_credito OWNER TO postgres;

--
-- Name: movimientos_credito_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.movimientos_credito_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.movimientos_credito_id_seq OWNER TO postgres;

--
-- Name: movimientos_credito_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.movimientos_credito_id_seq OWNED BY public.movimientos_credito.id;


--
-- Name: movimientos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.movimientos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.movimientos_id_seq OWNER TO postgres;

--
-- Name: movimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.movimientos_id_seq OWNED BY public.movimientos.id;


--
-- Name: notificaciones_credito; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notificaciones_credito (
    id integer NOT NULL,
    ticket_id integer NOT NULL,
    cliente_id integer NOT NULL,
    cliente_nombre text NOT NULL,
    folio integer NOT NULL,
    importe numeric(12,2) NOT NULL,
    dias_plazo integer NOT NULL,
    fecha_vencimiento date NOT NULL,
    cajero_id integer NOT NULL,
    cajero_nombre text NOT NULL,
    tienda_id integer NOT NULL,
    tienda_nombre text NOT NULL,
    urgente boolean DEFAULT false NOT NULL,
    leida_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notificaciones_credito OWNER TO postgres;

--
-- Name: notificaciones_credito_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notificaciones_credito_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notificaciones_credito_id_seq OWNER TO postgres;

--
-- Name: notificaciones_credito_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notificaciones_credito_id_seq OWNED BY public.notificaciones_credito.id;


--
-- Name: notificaciones_sistema; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notificaciones_sistema (
    id integer NOT NULL,
    tipo text NOT NULL,
    titulo text NOT NULL,
    mensaje text NOT NULL,
    entidad text NOT NULL,
    entidad_id text NOT NULL,
    leida_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    destinatario_usuario_id integer,
    prioridad text DEFAULT 'NORMAL'::text NOT NULL
);


ALTER TABLE public.notificaciones_sistema OWNER TO postgres;

--
-- Name: notificaciones_sistema_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notificaciones_sistema_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notificaciones_sistema_id_seq OWNER TO postgres;

--
-- Name: notificaciones_sistema_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notificaciones_sistema_id_seq OWNED BY public.notificaciones_sistema.id;


--
-- Name: operaciones_credito_e1; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.operaciones_credito_e1 (
    productor text NOT NULL,
    clave uuid NOT NULL,
    naturaleza public.naturaleza_credito_e1 NOT NULL,
    usuario_id integer NOT NULL,
    solicitud_canonica jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT transaction_timestamp() NOT NULL,
    CONSTRAINT operaciones_fecha_ck_e1 CHECK (isfinite(created_at)),
    CONSTRAINT operaciones_json_ck_e1 CHECK (((jsonb_typeof(solicitud_canonica) = 'object'::text) AND (solicitud_canonica <> '{}'::jsonb))),
    CONSTRAINT operaciones_productor_naturaleza_ck_e1 CHECK ((((productor = ANY (ARRAY['VENTA_CREDITO'::text, 'CANCELACION_VENTA_CREDITO'::text])) AND (naturaleza = 'OPERACION_CREDITO_SIN_DINERO'::public.naturaleza_credito_e1)) OR ((productor = ANY (ARRAY['AJUSTE_MANUAL'::text, 'BAJA_INCOBRABLE'::text])) AND (naturaleza = 'CORRECCION_CONTABLE'::public.naturaleza_credito_e1)) OR ((productor = ANY (ARRAY['ABONO_ORDINARIO'::text, 'ABONO_DIRIGIDO'::text])) AND (naturaleza = ANY (ARRAY['INGRESO_FISICO'::public.naturaleza_credito_e1, 'CORRECCION_CONTABLE'::public.naturaleza_credito_e1]))) OR ((productor = 'REVERSO_ABONO'::text) AND (naturaleza = ANY (ARRAY['DEVOLUCION_FISICA'::public.naturaleza_credito_e1, 'CORRECCION_CONTABLE'::public.naturaleza_credito_e1]))) OR ((productor = 'COBRO_PENDIENTE'::text) AND (naturaleza = 'INGRESO_FISICO'::public.naturaleza_credito_e1))))
);


ALTER TABLE public.operaciones_credito_e1 OWNER TO postgres;

--
-- Name: pagos_proveedor; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pagos_proveedor (
    id integer NOT NULL,
    proveedor_id integer NOT NULL,
    entrada_id integer,
    importe numeric(12,2) NOT NULL,
    tipo public.tipo_pago_proveedor NOT NULL,
    forma_pago public.forma_pago_proveedor,
    referencia text,
    fecha timestamp with time zone NOT NULL,
    usuario_id integer NOT NULL,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    movimiento_origen_id integer
);


ALTER TABLE public.pagos_proveedor OWNER TO postgres;

--
-- Name: pagos_proveedor_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pagos_proveedor_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pagos_proveedor_id_seq OWNER TO postgres;

--
-- Name: pagos_proveedor_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pagos_proveedor_id_seq OWNED BY public.pagos_proveedor.id;


--
-- Name: permisos_rol; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permisos_rol (
    id integer NOT NULL,
    rol public.rol_usuario NOT NULL,
    modulo text NOT NULL,
    puede_ver boolean DEFAULT false NOT NULL,
    puede_crear boolean DEFAULT false NOT NULL,
    puede_editar boolean DEFAULT false NOT NULL,
    puede_autorizar boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_por integer
);


ALTER TABLE public.permisos_rol OWNER TO postgres;

--
-- Name: permisos_rol_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.permisos_rol_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.permisos_rol_id_seq OWNER TO postgres;

--
-- Name: permisos_rol_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.permisos_rol_id_seq OWNED BY public.permisos_rol.id;


--
-- Name: permisos_ubicacion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permisos_ubicacion (
    id integer NOT NULL,
    ubicacion_id integer NOT NULL,
    rol public.rol_usuario NOT NULL,
    modulo text NOT NULL,
    puede_ver boolean DEFAULT false NOT NULL,
    puede_crear boolean DEFAULT false NOT NULL,
    puede_editar boolean DEFAULT false NOT NULL,
    puede_autorizar boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_por integer
);


ALTER TABLE public.permisos_ubicacion OWNER TO postgres;

--
-- Name: permisos_ubicacion_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.permisos_ubicacion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.permisos_ubicacion_id_seq OWNER TO postgres;

--
-- Name: permisos_ubicacion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.permisos_ubicacion_id_seq OWNED BY public.permisos_ubicacion.id;


--
-- Name: permisos_usuario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permisos_usuario (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    modulo text NOT NULL,
    puede_ver boolean,
    puede_crear boolean,
    puede_editar boolean,
    puede_autorizar boolean,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_por integer
);


ALTER TABLE public.permisos_usuario OWNER TO postgres;

--
-- Name: permisos_usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.permisos_usuario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.permisos_usuario_id_seq OWNER TO postgres;

--
-- Name: permisos_usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.permisos_usuario_id_seq OWNED BY public.permisos_usuario.id;


--
-- Name: pisos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pisos (
    id integer NOT NULL,
    ubicacion_id integer NOT NULL,
    nombre text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pisos_nombre_no_vacio CHECK ((length(btrim(nombre)) > 0))
);


ALTER TABLE public.pisos OWNER TO postgres;

--
-- Name: pisos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pisos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pisos_id_seq OWNER TO postgres;

--
-- Name: pisos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pisos_id_seq OWNED BY public.pisos.id;


--
-- Name: precio_historial; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.precio_historial (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    precio_lista_anterior numeric(12,2),
    precio_lista_nuevo numeric(12,2) NOT NULL,
    costo_unitario_ponderado numeric(12,2),
    margen_pesos_unidad numeric(12,2),
    margen_porcentaje_subtotal numeric(7,4),
    motivo text NOT NULL,
    advertencia_bajo_costo boolean DEFAULT false NOT NULL,
    usuario_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    modo_precio public.precio_modo DEFAULT 'ROLLO'::public.precio_modo NOT NULL
);


ALTER TABLE public.precio_historial OWNER TO postgres;

--
-- Name: precio_historial_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.precio_historial_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.precio_historial_id_seq OWNER TO postgres;

--
-- Name: precio_historial_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.precio_historial_id_seq OWNED BY public.precio_historial.id;


--
-- Name: productos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.productos (
    id integer NOT NULL,
    sku text NOT NULL,
    tela text NOT NULL,
    color text NOT NULL,
    unidad public.unidad_producto NOT NULL,
    precio_sugerido numeric(12,2),
    notas text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    se_vende_por_metro boolean DEFAULT false NOT NULL,
    precio_mayoreo numeric(12,2),
    precio_menudeo numeric(12,2),
    color_hex text,
    ancho_cm numeric(10,2),
    composicion text,
    gramaje_gm2 numeric(10,2),
    CONSTRAINT productos_color_hex_check CHECK (((color_hex IS NULL) OR (color_hex ~ '^#[0-9A-F]{6}$'::text))),
    CONSTRAINT productos_kilo_no_venta_metro_check CHECK (((unidad <> ALL (ARRAY['KILO'::public.unidad_producto, 'PIEZA'::public.unidad_producto])) OR (se_vende_por_metro = false)))
);


ALTER TABLE public.productos OWNER TO postgres;

--
-- Name: productos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.productos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.productos_id_seq OWNER TO postgres;

--
-- Name: productos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.productos_id_seq OWNED BY public.productos.id;


--
-- Name: proveedores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.proveedores (
    id integer NOT NULL,
    nombre text NOT NULL,
    tipo public.tipo_proveedor NOT NULL,
    moneda_default public.moneda DEFAULT 'MXN'::public.moneda NOT NULL,
    contacto_nombre text,
    telefono text,
    correo text,
    pais text,
    notas text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.proveedores OWNER TO postgres;

--
-- Name: proveedores_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.proveedores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.proveedores_id_seq OWNER TO postgres;

--
-- Name: proveedores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.proveedores_id_seq OWNED BY public.proveedores.id;


--
-- Name: reimpresiones_etiqueta; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reimpresiones_etiqueta (
    id integer NOT NULL,
    rollo_id integer NOT NULL,
    usuario_id integer NOT NULL,
    autorizado_por integer,
    motivo text NOT NULL,
    sitio_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    serie_snapshot text NOT NULL,
    sku_snapshot text NOT NULL,
    producto_snapshot text NOT NULL,
    tela_snapshot text NOT NULL,
    color_snapshot text NOT NULL,
    solicitante_nombre_snapshot text NOT NULL,
    solicitante_usuario_snapshot text NOT NULL,
    autorizador_nombre_snapshot text,
    autorizador_usuario_snapshot text,
    sitio_nombre_snapshot text NOT NULL
);


ALTER TABLE public.reimpresiones_etiqueta OWNER TO postgres;

--
-- Name: reimpresiones_etiqueta_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reimpresiones_etiqueta_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reimpresiones_etiqueta_id_seq OWNER TO postgres;

--
-- Name: reimpresiones_etiqueta_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reimpresiones_etiqueta_id_seq OWNED BY public.reimpresiones_etiqueta.id;


--
-- Name: revisiones_etiqueta; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.revisiones_etiqueta (
    id integer NOT NULL,
    rollo_id integer NOT NULL,
    reimpresion_id integer NOT NULL,
    usuario_id integer NOT NULL,
    revisor_nombre_snapshot text NOT NULL,
    revisor_usuario_snapshot text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.revisiones_etiqueta OWNER TO postgres;

--
-- Name: revisiones_etiqueta_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.revisiones_etiqueta_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.revisiones_etiqueta_id_seq OWNER TO postgres;

--
-- Name: revisiones_etiqueta_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.revisiones_etiqueta_id_seq OWNED BY public.revisiones_etiqueta.id;


--
-- Name: rollos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rollos (
    id integer NOT NULL,
    serie text NOT NULL,
    producto_id integer NOT NULL,
    ubicacion_id integer NOT NULL,
    proveedor_id integer,
    recepcion_id integer,
    rollo_origen_id integer,
    estado public.estado_rollo DEFAULT 'PROGRAMADO'::public.estado_rollo NOT NULL,
    cantidad_inicial numeric(10,3) NOT NULL,
    cantidad_actual numeric(10,3) NOT NULL,
    costo_unitario numeric(12,2),
    costo_total numeric(12,2),
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    piso_id integer
);


ALTER TABLE public.rollos OWNER TO postgres;

--
-- Name: rollos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rollos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rollos_id_seq OWNER TO postgres;

--
-- Name: rollos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rollos_id_seq OWNED BY public.rollos.id;


--
-- Name: saldos_cobros_credito_e1; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.saldos_cobros_credito_e1 AS
 SELECT DISTINCT operacion_productor,
    operacion_clave,
    naturaleza,
    cliente_id,
    importe,
    fecha_real,
    sitio_origen_id,
    medio,
    cuenta_destino,
    sesion_caja_id,
    motivo,
    referencia,
    usuario_id,
    created_at,
    importe AS saldo_pendiente
   FROM public.cobros_credito_pendientes_e1 c;


ALTER VIEW public.saldos_cobros_credito_e1 OWNER TO postgres;

--
-- Name: salida_folio; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.salida_folio (
    ultimo_folio integer DEFAULT 0 NOT NULL,
    ubicacion_id integer NOT NULL
);


ALTER TABLE public.salida_folio OWNER TO postgres;

--
-- Name: salida_lineas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.salida_lineas (
    id integer NOT NULL,
    salida_id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad_solicitada numeric(10,3) NOT NULL,
    cantidad_enviada numeric(10,3) DEFAULT 0 NOT NULL,
    cantidad_recibida numeric(10,3) DEFAULT 0 NOT NULL,
    rollos_solicitados integer,
    nota text
);


ALTER TABLE public.salida_lineas OWNER TO postgres;

--
-- Name: salida_lineas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.salida_lineas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.salida_lineas_id_seq OWNER TO postgres;

--
-- Name: salida_lineas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.salida_lineas_id_seq OWNED BY public.salida_lineas.id;


--
-- Name: salida_rollos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.salida_rollos (
    id integer NOT NULL,
    salida_id integer NOT NULL,
    linea_id integer NOT NULL,
    rollo_id integer NOT NULL,
    cantidad_enviada numeric(10,3) NOT NULL,
    cantidad_recibida numeric(10,3),
    recibido boolean DEFAULT false NOT NULL,
    nota_diferencia text
);


ALTER TABLE public.salida_rollos OWNER TO postgres;

--
-- Name: salida_rollos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.salida_rollos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.salida_rollos_id_seq OWNER TO postgres;

--
-- Name: salida_rollos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.salida_rollos_id_seq OWNED BY public.salida_rollos.id;


--
-- Name: salidas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.salidas (
    id integer NOT NULL,
    folio integer NOT NULL,
    origen_id integer NOT NULL,
    destino_id integer,
    estado public.estado_salida DEFAULT 'ARMANDO'::public.estado_salida NOT NULL,
    usuario_solicita_id integer,
    usuario_acepta_id integer,
    usuario_prepara_id integer,
    usuario_envia_id integer,
    usuario_recibe_id integer,
    usuario_cierra_id integer,
    solicitada_at timestamp with time zone,
    aceptada_at timestamp with time zone,
    preparada_at timestamp with time zone,
    enviada_at timestamp with time zone,
    recibida_at timestamp with time zone,
    cerrada_at timestamp with time zone,
    motivo_rechazo text,
    motivo_cancelacion text,
    nota_solicitud text,
    nota_envio text,
    nota_recepcion text,
    transportista text,
    uuid_cliente uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    usuario_cancela_id integer,
    cancelada_at timestamp with time zone,
    autorizado_por_id integer,
    actividad_at timestamp with time zone DEFAULT now() NOT NULL,
    modalidad text DEFAULT 'TRASLADO'::text NOT NULL,
    cliente_id integer,
    ticket_id integer,
    usuario_entrega_id integer,
    entregada_at timestamp with time zone,
    CONSTRAINT salidas_modalidad_check CHECK ((modalidad = ANY (ARRAY['TRASLADO'::text, 'MOSTRADOR'::text, 'VENTA_CLIENTE'::text]))),
    CONSTRAINT salidas_venta_cliente_shape_check CHECK (((modalidad <> 'VENTA_CLIENTE'::text) OR ((cliente_id IS NOT NULL) AND (destino_id IS NULL))))
);


ALTER TABLE public.salidas OWNER TO postgres;

--
-- Name: salidas_dinero_caja; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.salidas_dinero_caja (
    id integer NOT NULL,
    sesion_caja_id integer NOT NULL,
    monto numeric(12,2) NOT NULL,
    motivo text NOT NULL,
    proveedor_id integer,
    cuenta_origen text NOT NULL,
    creado_por_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT salidas_dinero_caja_cuenta_origen_check CHECK ((cuenta_origen = ANY (ARRAY['CAJA_FISICA'::text, 'CUENTA_NO_FISCAL'::text, 'CUENTA_FISCAL'::text]))),
    CONSTRAINT salidas_dinero_caja_monto_check CHECK ((monto > (0)::numeric)),
    CONSTRAINT salidas_dinero_caja_motivo_check CHECK (((char_length(TRIM(BOTH FROM motivo)) >= 1) AND (char_length(TRIM(BOTH FROM motivo)) <= 500)))
);


ALTER TABLE public.salidas_dinero_caja OWNER TO postgres;

--
-- Name: salidas_dinero_caja_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.salidas_dinero_caja_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.salidas_dinero_caja_id_seq OWNER TO postgres;

--
-- Name: salidas_dinero_caja_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.salidas_dinero_caja_id_seq OWNED BY public.salidas_dinero_caja.id;


--
-- Name: salidas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.salidas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.salidas_id_seq OWNER TO postgres;

--
-- Name: salidas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.salidas_id_seq OWNED BY public.salidas.id;


--
-- Name: series_consecutivo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.series_consecutivo (
    id integer DEFAULT 1 NOT NULL,
    ultimo_numero integer DEFAULT 10000000 NOT NULL
);


ALTER TABLE public.series_consecutivo OWNER TO postgres;

--
-- Name: sesiones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sesiones (
    id uuid NOT NULL,
    usuario_id integer NOT NULL,
    expira_at timestamp with time zone NOT NULL,
    ip text NOT NULL,
    user_agent text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sesiones OWNER TO postgres;

--
-- Name: sesiones_caja; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sesiones_caja (
    id integer NOT NULL,
    ubicacion_id integer NOT NULL,
    usuario_id integer NOT NULL,
    abierta_at timestamp with time zone DEFAULT now() NOT NULL,
    cerrada_at timestamp with time zone,
    fondo_inicial numeric(12,2) NOT NULL,
    efectivo_contado numeric(12,2),
    estado public.estado_sesion_caja DEFAULT 'ABIERTA'::public.estado_sesion_caja NOT NULL,
    fecha_operativa date NOT NULL,
    cerrada_por_id integer
);


ALTER TABLE public.sesiones_caja OWNER TO postgres;

--
-- Name: sesiones_caja_dias; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sesiones_caja_dias (
    ubicacion_id integer NOT NULL,
    fecha_operativa date NOT NULL,
    sesion_caja_id integer
);


ALTER TABLE public.sesiones_caja_dias OWNER TO postgres;

--
-- Name: sesiones_caja_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sesiones_caja_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sesiones_caja_id_seq OWNER TO postgres;

--
-- Name: sesiones_caja_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sesiones_caja_id_seq OWNED BY public.sesiones_caja.id;


--
-- Name: solicitudes_pago_dirigido; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.solicitudes_pago_dirigido (
    id integer NOT NULL,
    tipo public.tipo_solicitud_pago_dirigido NOT NULL,
    entidad_id integer NOT NULL,
    documento_movimiento_id integer NOT NULL,
    importe numeric(12,2) NOT NULL,
    forma_pago text NOT NULL,
    cuenta_destino text,
    fecha_efectiva timestamp with time zone,
    referencia text,
    notas text,
    motivo text NOT NULL,
    motivo_rechazo text,
    solicitante_id integer NOT NULL,
    solicitante_nombre text DEFAULT ''::text NOT NULL,
    autorizador_id integer,
    autorizador_nombre text,
    contraparte_nombre text DEFAULT ''::text NOT NULL,
    documento_folio text DEFAULT ''::text NOT NULL,
    movimiento_id integer,
    estado public.estado_solicitud_pago_dirigido DEFAULT 'PENDIENTE'::public.estado_solicitud_pago_dirigido NOT NULL,
    resuelta_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    ubicacion_id integer,
    ubicacion_nombre text,
    CONSTRAINT solicitudes_pago_dirigido_importe_check CHECK ((importe > (0)::numeric)),
    CONSTRAINT solicitudes_pago_dirigido_motivo_check CHECK ((char_length(TRIM(BOTH FROM motivo)) >= 10)),
    CONSTRAINT solicitudes_pago_dirigido_motivo_rechazo_check CHECK (((motivo_rechazo IS NULL) OR (char_length(TRIM(BOTH FROM motivo_rechazo)) >= 10))),
    CONSTRAINT solicitudes_pago_dirigido_resolved_check CHECK ((((estado = 'PENDIENTE'::public.estado_solicitud_pago_dirigido) AND (autorizador_id IS NULL) AND (resuelta_at IS NULL)) OR ((estado = 'APROBADA'::public.estado_solicitud_pago_dirigido) AND (autorizador_id IS NOT NULL) AND (movimiento_id IS NOT NULL) AND (resuelta_at IS NOT NULL)) OR ((estado = 'RECHAZADA'::public.estado_solicitud_pago_dirigido) AND (autorizador_id IS NOT NULL) AND (motivo_rechazo IS NOT NULL) AND (resuelta_at IS NOT NULL))))
);


ALTER TABLE public.solicitudes_pago_dirigido OWNER TO postgres;

--
-- Name: solicitudes_pago_dirigido_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.solicitudes_pago_dirigido_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.solicitudes_pago_dirigido_id_seq OWNER TO postgres;

--
-- Name: solicitudes_pago_dirigido_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.solicitudes_pago_dirigido_id_seq OWNED BY public.solicitudes_pago_dirigido.id;


--
-- Name: stock_minimo_episodios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_minimo_episodios (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    ubicacion_id integer NOT NULL,
    minimo numeric(18,3) NOT NULL,
    existencia numeric(18,3) NOT NULL,
    diferencia numeric(18,3) NOT NULL,
    abierto_at timestamp with time zone DEFAULT now() NOT NULL,
    cerrado_at timestamp with time zone,
    movimiento_id bigint,
    causa text DEFAULT 'SNAPSHOT'::text NOT NULL,
    CONSTRAINT stock_minimo_episodios_causa_check CHECK ((causa = ANY (ARRAY['MOVIMIENTO'::text, 'CONFIGURACION'::text, 'SNAPSHOT'::text]))),
    CONSTRAINT stock_minimo_episodios_diferencia_check CHECK ((diferencia >= (0)::numeric)),
    CONSTRAINT stock_minimo_episodios_existencia_check CHECK ((existencia >= (0)::numeric)),
    CONSTRAINT stock_minimo_episodios_minimo_check CHECK ((minimo >= (0)::numeric))
);


ALTER TABLE public.stock_minimo_episodios OWNER TO postgres;

--
-- Name: stock_minimo_episodios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stock_minimo_episodios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_minimo_episodios_id_seq OWNER TO postgres;

--
-- Name: stock_minimo_episodios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stock_minimo_episodios_id_seq OWNED BY public.stock_minimo_episodios.id;


--
-- Name: stock_minimo_sitios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_minimo_sitios (
    ubicacion_id integer NOT NULL,
    habilitado boolean DEFAULT false NOT NULL,
    updated_by integer,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.stock_minimo_sitios OWNER TO postgres;

--
-- Name: stock_minimos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_minimos (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    ubicacion_id integer NOT NULL,
    cantidad numeric(18,3) NOT NULL,
    updated_by integer,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_minimos_cantidad_nonnegative_check CHECK ((cantidad >= (0)::numeric))
);


ALTER TABLE public.stock_minimos OWNER TO postgres;

--
-- Name: stock_minimos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stock_minimos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_minimos_id_seq OWNER TO postgres;

--
-- Name: stock_minimos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stock_minimos_id_seq OWNED BY public.stock_minimos.id;


--
-- Name: ticket_folio; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ticket_folio (
    id integer DEFAULT 1 NOT NULL,
    ultimo_folio integer DEFAULT 999 NOT NULL
);


ALTER TABLE public.ticket_folio OWNER TO postgres;

--
-- Name: ticket_linea_consumos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ticket_linea_consumos (
    id bigint NOT NULL,
    ticket_id integer NOT NULL,
    ticket_linea_id integer NOT NULL,
    movimiento_id bigint NOT NULL,
    rollo_id integer NOT NULL,
    entrada_id integer NOT NULL,
    proveedor_id integer NOT NULL,
    cantidad_milesimas bigint NOT NULL,
    ingreso_centavos bigint NOT NULL,
    costo_centavos bigint,
    tipo text NOT NULL,
    reversa_de_id bigint,
    idempotencia text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ticket_linea_consumos_cantidad_milesimas_check CHECK ((cantidad_milesimas > 0)),
    CONSTRAINT ticket_linea_consumos_costo_centavos_check CHECK (((costo_centavos IS NULL) OR (costo_centavos >= 0))),
    CONSTRAINT ticket_linea_consumos_ingreso_centavos_check CHECK ((ingreso_centavos >= 0)),
    CONSTRAINT ticket_linea_consumos_tipo_reversa_check CHECK ((((tipo = 'CONSUMO'::text) AND (reversa_de_id IS NULL)) OR ((tipo = 'REVERSA'::text) AND (reversa_de_id IS NOT NULL))))
);


ALTER TABLE public.ticket_linea_consumos OWNER TO postgres;

--
-- Name: TABLE ticket_linea_consumos; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ticket_linea_consumos IS 'Immutable physical roll allocations for accounted supplier utility; empty for historical records without evidence.';


--
-- Name: COLUMN ticket_linea_consumos.cantidad_milesimas; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ticket_linea_consumos.cantidad_milesimas IS 'Positive physical quantity in thousandths.';


--
-- Name: COLUMN ticket_linea_consumos.ingreso_centavos; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ticket_linea_consumos.ingreso_centavos IS 'Positive revenue allocation in integer cents, assigned with deterministic largest remainder.';


--
-- Name: COLUMN ticket_linea_consumos.costo_centavos; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ticket_linea_consumos.costo_centavos IS 'Frozen physical cost in integer cents; NULL means utility unavailable.';


--
-- Name: ticket_linea_consumos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ticket_linea_consumos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ticket_linea_consumos_id_seq OWNER TO postgres;

--
-- Name: ticket_linea_consumos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ticket_linea_consumos_id_seq OWNED BY public.ticket_linea_consumos.id;


--
-- Name: ticket_lineas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ticket_lineas (
    id integer NOT NULL,
    ticket_id integer NOT NULL,
    rollo_id integer,
    producto_id integer NOT NULL,
    cantidad numeric(10,3) NOT NULL,
    precio_unitario numeric(12,2) NOT NULL,
    precio_sugerido numeric(12,2) NOT NULL,
    importe numeric(12,2) NOT NULL,
    costo_unitario_congelado numeric(12,2),
    costo_total_congelado numeric(12,2),
    tipo public.tipo_ticket NOT NULL,
    costo_referencia_estado text,
    CONSTRAINT ticket_lineas_tipo_rollo_costos_check CHECK ((((tipo = 'NORMAL'::public.tipo_ticket) AND (rollo_id IS NOT NULL) AND (costo_unitario_congelado IS NOT NULL) AND (costo_total_congelado IS NOT NULL) AND (costo_referencia_estado IS NULL)) OR ((tipo = 'METREADO'::public.tipo_ticket) AND (rollo_id IS NULL) AND (((costo_unitario_congelado IS NULL) AND (costo_total_congelado IS NULL) AND ((costo_referencia_estado IS NULL) OR (costo_referencia_estado = 'NO_COST'::text))) OR ((costo_unitario_congelado IS NOT NULL) AND (costo_total_congelado IS NOT NULL) AND ((costo_referencia_estado IS NULL) OR (costo_referencia_estado = ANY (ARRAY['AVERAGE_12_MONTHS'::text, 'STALE_LAST_KNOWN'::text]))))))))
);


ALTER TABLE public.ticket_lineas OWNER TO postgres;

--
-- Name: ticket_lineas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ticket_lineas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ticket_lineas_id_seq OWNER TO postgres;

--
-- Name: ticket_lineas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ticket_lineas_id_seq OWNED BY public.ticket_lineas.id;


--
-- Name: ticket_pagos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ticket_pagos (
    id integer NOT NULL,
    ticket_id integer NOT NULL,
    forma_pago public.forma_pago_ticket NOT NULL,
    importe numeric(12,2) NOT NULL,
    referencia text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    usuario_id integer NOT NULL
);


ALTER TABLE public.ticket_pagos OWNER TO postgres;

--
-- Name: ticket_pagos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ticket_pagos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ticket_pagos_id_seq OWNER TO postgres;

--
-- Name: ticket_pagos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ticket_pagos_id_seq OWNED BY public.ticket_pagos.id;


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tickets (
    id integer NOT NULL,
    folio integer NOT NULL,
    ubicacion_id integer NOT NULL,
    usuario_terminal_id integer NOT NULL,
    cliente_id integer NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    total numeric(12,2) NOT NULL,
    estado public.estado_ticket DEFAULT 'VENDIDO'::public.estado_ticket NOT NULL,
    cobrado boolean DEFAULT false NOT NULL,
    cobrado_at timestamp with time zone,
    usuario_caja_id integer,
    facturado boolean DEFAULT false NOT NULL,
    sesion_caja_id integer,
    uuid_cliente uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cancelado_at timestamp with time zone,
    cancelado_por integer,
    motivo_cancelacion text,
    autorizado_por integer,
    iva numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    tasa_iva numeric(5,4) DEFAULT 0.1600 NOT NULL,
    documento_tipo text DEFAULT 'TICKET'::text NOT NULL,
    nombre_destinatario text,
    direccion_entrega_snapshot text,
    nota_sin_precios boolean DEFAULT false NOT NULL,
    credito boolean DEFAULT false NOT NULL,
    dias_plazo integer,
    fecha_vencimiento date,
    autorizado_at timestamp with time zone,
    autorizacion_estado text DEFAULT 'NO_APLICA'::text NOT NULL,
    CONSTRAINT tickets_credito_plazo_check CHECK ((((credito = false) AND (dias_plazo IS NULL) AND (fecha_vencimiento IS NULL)) OR ((credito = true) AND (dias_plazo = ANY (ARRAY[7, 15, 30, 60])) AND (fecha_vencimiento IS NOT NULL))))
);


ALTER TABLE public.tickets OWNER TO postgres;

--
-- Name: tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tickets_id_seq OWNER TO postgres;

--
-- Name: tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tickets_id_seq OWNED BY public.tickets.id;


--
-- Name: ubicaciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ubicaciones (
    id integer NOT NULL,
    nombre text NOT NULL,
    tipo public.tipo_ubicacion NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    iniciales text NOT NULL,
    CONSTRAINT ubicaciones_iniciales_formato_check CHECK ((iniciales ~ '^[A-Z]{2,3}$'::text))
);


ALTER TABLE public.ubicaciones OWNER TO postgres;

--
-- Name: ubicaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ubicaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ubicaciones_id_seq OWNER TO postgres;

--
-- Name: ubicaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ubicaciones_id_seq OWNED BY public.ubicaciones.id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    nombre text NOT NULL,
    usuario text NOT NULL,
    password_hash text NOT NULL,
    rol public.rol_usuario NOT NULL,
    ubicacion_id integer,
    activo boolean DEFAULT true NOT NULL,
    ultimo_acceso timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    alcance_consulta public.alcance_consulta DEFAULT 'TODAS'::public.alcance_consulta NOT NULL
);


ALTER TABLE public.usuarios OWNER TO postgres;

--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuarios_id_seq OWNER TO postgres;

--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: viaje_folio; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.viaje_folio (
    ubicacion_id integer NOT NULL,
    ultimo_folio integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.viaje_folio OWNER TO postgres;

--
-- Name: viaje_salidas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.viaje_salidas (
    viaje_id integer NOT NULL,
    salida_id integer NOT NULL
);


ALTER TABLE public.viaje_salidas OWNER TO postgres;

--
-- Name: viaje_tickets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.viaje_tickets (
    viaje_id integer NOT NULL,
    ticket_id integer NOT NULL
);


ALTER TABLE public.viaje_tickets OWNER TO postgres;

--
-- Name: viajes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.viajes (
    id integer NOT NULL,
    folio integer NOT NULL,
    origen_id integer NOT NULL,
    camioneta_id integer NOT NULL,
    chofer_id integer NOT NULL,
    salida_at timestamp with time zone NOT NULL,
    observaciones text,
    creado_por_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.viajes OWNER TO postgres;

--
-- Name: viajes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.viajes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.viajes_id_seq OWNER TO postgres;

--
-- Name: viajes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.viajes_id_seq OWNED BY public.viajes.id;


--
-- Name: aplicaciones_credito id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aplicaciones_credito ALTER COLUMN id SET DEFAULT nextval('public.aplicaciones_credito_id_seq'::regclass);


--
-- Name: aplicaciones_pago_proveedor id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aplicaciones_pago_proveedor ALTER COLUMN id SET DEFAULT nextval('public.aplicaciones_pago_proveedor_id_seq'::regclass);


--
-- Name: auditoria id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria ALTER COLUMN id SET DEFAULT nextval('public.auditoria_id_seq'::regclass);


--
-- Name: auditoria_faltante_reactivaciones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_faltante_reactivaciones ALTER COLUMN id SET DEFAULT nextval('public.auditoria_faltante_reactivaciones_id_seq'::regclass);


--
-- Name: auditoria_sobrante_decisiones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_sobrante_decisiones ALTER COLUMN id SET DEFAULT nextval('public.auditoria_sobrante_decisiones_id_seq'::regclass);


--
-- Name: auditorias_inventario id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditorias_inventario ALTER COLUMN id SET DEFAULT nextval('public.auditorias_inventario_id_seq'::regclass);


--
-- Name: autorizaciones_nota id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.autorizaciones_nota ALTER COLUMN id SET DEFAULT nextval('public.autorizaciones_nota_id_seq'::regclass);


--
-- Name: camionetas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.camionetas ALTER COLUMN id SET DEFAULT nextval('public.camionetas_id_seq'::regclass);


--
-- Name: choferes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.choferes ALTER COLUMN id SET DEFAULT nextval('public.choferes_id_seq'::regclass);


--
-- Name: cliente_documentos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cliente_documentos ALTER COLUMN id SET DEFAULT nextval('public.cliente_documentos_id_seq'::regclass);


--
-- Name: clientes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes ALTER COLUMN id SET DEFAULT nextval('public.clientes_id_seq'::regclass);


--
-- Name: contenedor_lineas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contenedor_lineas ALTER COLUMN id SET DEFAULT nextval('public.contenedor_lineas_id_seq'::regclass);


--
-- Name: contenedores id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contenedores ALTER COLUMN id SET DEFAULT nextval('public.contenedores_id_seq'::regclass);


--
-- Name: contenedores folio; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contenedores ALTER COLUMN folio SET DEFAULT nextval('public.contenedores_folio_seq'::regclass);


--
-- Name: cuadre_fiscal_registros id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuadre_fiscal_registros ALTER COLUMN id SET DEFAULT nextval('public.cuadre_fiscal_registros_id_seq'::regclass);


--
-- Name: entradas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entradas ALTER COLUMN id SET DEFAULT nextval('public.entradas_id_seq'::regclass);


--
-- Name: equipos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos ALTER COLUMN id SET DEFAULT nextval('public.equipos_id_seq'::regclass);


--
-- Name: movimientos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos ALTER COLUMN id SET DEFAULT nextval('public.movimientos_id_seq'::regclass);


--
-- Name: movimientos_credito id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_credito ALTER COLUMN id SET DEFAULT nextval('public.movimientos_credito_id_seq'::regclass);


--
-- Name: notificaciones_credito id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificaciones_credito ALTER COLUMN id SET DEFAULT nextval('public.notificaciones_credito_id_seq'::regclass);


--
-- Name: notificaciones_sistema id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificaciones_sistema ALTER COLUMN id SET DEFAULT nextval('public.notificaciones_sistema_id_seq'::regclass);


--
-- Name: pagos_proveedor id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos_proveedor ALTER COLUMN id SET DEFAULT nextval('public.pagos_proveedor_id_seq'::regclass);


--
-- Name: permisos_rol id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos_rol ALTER COLUMN id SET DEFAULT nextval('public.permisos_rol_id_seq'::regclass);


--
-- Name: permisos_ubicacion id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos_ubicacion ALTER COLUMN id SET DEFAULT nextval('public.permisos_ubicacion_id_seq'::regclass);


--
-- Name: permisos_usuario id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos_usuario ALTER COLUMN id SET DEFAULT nextval('public.permisos_usuario_id_seq'::regclass);


--
-- Name: pisos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pisos ALTER COLUMN id SET DEFAULT nextval('public.pisos_id_seq'::regclass);


--
-- Name: precio_historial id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.precio_historial ALTER COLUMN id SET DEFAULT nextval('public.precio_historial_id_seq'::regclass);


--
-- Name: productos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.productos ALTER COLUMN id SET DEFAULT nextval('public.productos_id_seq'::regclass);


--
-- Name: proveedores id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proveedores ALTER COLUMN id SET DEFAULT nextval('public.proveedores_id_seq'::regclass);


--
-- Name: reimpresiones_etiqueta id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reimpresiones_etiqueta ALTER COLUMN id SET DEFAULT nextval('public.reimpresiones_etiqueta_id_seq'::regclass);


--
-- Name: revisiones_etiqueta id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.revisiones_etiqueta ALTER COLUMN id SET DEFAULT nextval('public.revisiones_etiqueta_id_seq'::regclass);


--
-- Name: rollos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rollos ALTER COLUMN id SET DEFAULT nextval('public.rollos_id_seq'::regclass);


--
-- Name: salida_lineas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salida_lineas ALTER COLUMN id SET DEFAULT nextval('public.salida_lineas_id_seq'::regclass);


--
-- Name: salida_rollos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salida_rollos ALTER COLUMN id SET DEFAULT nextval('public.salida_rollos_id_seq'::regclass);


--
-- Name: salidas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salidas ALTER COLUMN id SET DEFAULT nextval('public.salidas_id_seq'::regclass);


--
-- Name: salidas_dinero_caja id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salidas_dinero_caja ALTER COLUMN id SET DEFAULT nextval('public.salidas_dinero_caja_id_seq'::regclass);


--
-- Name: sesiones_caja id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sesiones_caja ALTER COLUMN id SET DEFAULT nextval('public.sesiones_caja_id_seq'::regclass);


--
-- Name: solicitudes_pago_dirigido id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitudes_pago_dirigido ALTER COLUMN id SET DEFAULT nextval('public.solicitudes_pago_dirigido_id_seq'::regclass);


--
-- Name: stock_minimo_episodios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_minimo_episodios ALTER COLUMN id SET DEFAULT nextval('public.stock_minimo_episodios_id_seq'::regclass);


--
-- Name: stock_minimos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_minimos ALTER COLUMN id SET DEFAULT nextval('public.stock_minimos_id_seq'::regclass);


--
-- Name: ticket_linea_consumos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_linea_consumos ALTER COLUMN id SET DEFAULT nextval('public.ticket_linea_consumos_id_seq'::regclass);


--
-- Name: ticket_lineas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_lineas ALTER COLUMN id SET DEFAULT nextval('public.ticket_lineas_id_seq'::regclass);


--
-- Name: ticket_pagos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_pagos ALTER COLUMN id SET DEFAULT nextval('public.ticket_pagos_id_seq'::regclass);


--
-- Name: tickets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets ALTER COLUMN id SET DEFAULT nextval('public.tickets_id_seq'::regclass);


--
-- Name: ubicaciones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ubicaciones ALTER COLUMN id SET DEFAULT nextval('public.ubicaciones_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Name: viajes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viajes ALTER COLUMN id SET DEFAULT nextval('public.viajes_id_seq'::regclass);


--
-- Name: aplicaciones_credito aplicaciones_credito_abono_venta_uidx; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aplicaciones_credito
    ADD CONSTRAINT aplicaciones_credito_abono_venta_uidx UNIQUE (abono_movimiento_id, venta_movimiento_id);


--
-- Name: aplicaciones_credito aplicaciones_credito_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aplicaciones_credito
    ADD CONSTRAINT aplicaciones_credito_pkey PRIMARY KEY (id);


--
-- Name: aplicaciones_pago_proveedor aplicaciones_pago_proveedor_pago_compra_uidx; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aplicaciones_pago_proveedor
    ADD CONSTRAINT aplicaciones_pago_proveedor_pago_compra_uidx UNIQUE (pago_proveedor_id, compra_proveedor_id);


--
-- Name: aplicaciones_pago_proveedor aplicaciones_pago_proveedor_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aplicaciones_pago_proveedor
    ADD CONSTRAINT aplicaciones_pago_proveedor_pkey PRIMARY KEY (id);


--
-- Name: atribuciones_credito_e1 atribuciones_cadena_uq_e1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.atribuciones_credito_e1
    ADD CONSTRAINT atribuciones_cadena_uq_e1 UNIQUE NULLS NOT DISTINCT (movimiento_id, anterior_id);


--
-- Name: atribuciones_credito_e1 atribuciones_pk_e1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.atribuciones_credito_e1
    ADD CONSTRAINT atribuciones_pk_e1 PRIMARY KEY (id);


--
-- Name: auditoria_faltante_reactivaciones auditoria_faltante_reactivacione_movimiento_reactivacion_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_faltante_reactivaciones
    ADD CONSTRAINT auditoria_faltante_reactivacione_movimiento_reactivacion_id_key UNIQUE (movimiento_reactivacion_id);


--
-- Name: auditoria_faltante_reactivaciones auditoria_faltante_reactivaciones_movimiento_baja_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_faltante_reactivaciones
    ADD CONSTRAINT auditoria_faltante_reactivaciones_movimiento_baja_id_key UNIQUE (movimiento_baja_id);


--
-- Name: auditoria_faltante_reactivaciones auditoria_faltante_reactivaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_faltante_reactivaciones
    ADD CONSTRAINT auditoria_faltante_reactivaciones_pkey PRIMARY KEY (id);


--
-- Name: auditoria_faltante_reactivaciones auditoria_faltante_reactivaciones_uuid_cliente_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_faltante_reactivaciones
    ADD CONSTRAINT auditoria_faltante_reactivaciones_uuid_cliente_key UNIQUE (uuid_cliente);


--
-- Name: auditoria_inventario_escaneos auditoria_inventario_escaneos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_inventario_escaneos
    ADD CONSTRAINT auditoria_inventario_escaneos_pkey PRIMARY KEY (auditoria_id, serie);


--
-- Name: auditoria_inventario_folio auditoria_inventario_folio_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_inventario_folio
    ADD CONSTRAINT auditoria_inventario_folio_pkey PRIMARY KEY (ubicacion_id);


--
-- Name: auditoria_inventario_participantes auditoria_inventario_participantes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_inventario_participantes
    ADD CONSTRAINT auditoria_inventario_participantes_pkey PRIMARY KEY (auditoria_id, usuario_id);


--
-- Name: auditoria_inventario_snapshot auditoria_inventario_snapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_inventario_snapshot
    ADD CONSTRAINT auditoria_inventario_snapshot_pkey PRIMARY KEY (auditoria_id, serie);


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id);


--
-- Name: auditoria_sobrante_contextos auditoria_sobrante_contextos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_sobrante_contextos
    ADD CONSTRAINT auditoria_sobrante_contextos_pkey PRIMARY KEY (auditoria_id, serie);


--
-- Name: auditoria_sobrante_decisiones auditoria_sobrante_decisiones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_sobrante_decisiones
    ADD CONSTRAINT auditoria_sobrante_decisiones_pkey PRIMARY KEY (id);


--
-- Name: auditoria_sobrante_decisiones auditoria_sobrante_decisiones_uuid_cliente_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_sobrante_decisiones
    ADD CONSTRAINT auditoria_sobrante_decisiones_uuid_cliente_key UNIQUE (uuid_cliente);


--
-- Name: auditorias_inventario auditorias_inventario_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditorias_inventario
    ADD CONSTRAINT auditorias_inventario_pkey PRIMARY KEY (id);


--
-- Name: auditorias_inventario auditorias_inventario_ubicacion_id_folio_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditorias_inventario
    ADD CONSTRAINT auditorias_inventario_ubicacion_id_folio_key UNIQUE (ubicacion_id, folio);


--
-- Name: autorizaciones_nota autorizaciones_nota_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.autorizaciones_nota
    ADD CONSTRAINT autorizaciones_nota_pkey PRIMARY KEY (id);


--
-- Name: autorizaciones_nota autorizaciones_nota_ticket_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.autorizaciones_nota
    ADD CONSTRAINT autorizaciones_nota_ticket_id_key UNIQUE (ticket_id);


--
-- Name: camionetas camionetas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.camionetas
    ADD CONSTRAINT camionetas_pkey PRIMARY KEY (id);


--
-- Name: choferes choferes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.choferes
    ADD CONSTRAINT choferes_pkey PRIMARY KEY (id);


--
-- Name: cliente_documentos cliente_documentos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cliente_documentos
    ADD CONSTRAINT cliente_documentos_pkey PRIMARY KEY (id);


--
-- Name: cliente_documentos cliente_documentos_public_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cliente_documentos
    ADD CONSTRAINT cliente_documentos_public_id_unique UNIQUE (public_id);


--
-- Name: cliente_documentos cliente_documentos_ruta_archivo_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cliente_documentos
    ADD CONSTRAINT cliente_documentos_ruta_archivo_unique UNIQUE (ruta_archivo);


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);


--
-- Name: cobros_credito_pendientes_e1 cobros_pk_e1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cobros_credito_pendientes_e1
    ADD CONSTRAINT cobros_pk_e1 PRIMARY KEY (operacion_productor, operacion_clave);


--
-- Name: contenedor_lineas contenedor_lineas_contenedor_producto_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contenedor_lineas
    ADD CONSTRAINT contenedor_lineas_contenedor_producto_unique UNIQUE (contenedor_id, producto_id);


--
-- Name: contenedor_lineas contenedor_lineas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contenedor_lineas
    ADD CONSTRAINT contenedor_lineas_pkey PRIMARY KEY (id);


--
-- Name: contenedores contenedores_entrada_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contenedores
    ADD CONSTRAINT contenedores_entrada_unique UNIQUE (entrada_id);


--
-- Name: contenedores contenedores_folio_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contenedores
    ADD CONSTRAINT contenedores_folio_unique UNIQUE (folio);


--
-- Name: contenedores contenedores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contenedores
    ADD CONSTRAINT contenedores_pkey PRIMARY KEY (id);


--
-- Name: cuadre_fiscal_registros cuadre_fiscal_registros_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuadre_fiscal_registros
    ADD CONSTRAINT cuadre_fiscal_registros_pkey PRIMARY KEY (id);


--
-- Name: entrada_folio entrada_folio_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entrada_folio
    ADD CONSTRAINT entrada_folio_pkey PRIMARY KEY (ubicacion_id);


--
-- Name: entradas entradas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entradas
    ADD CONSTRAINT entradas_pkey PRIMARY KEY (id);


--
-- Name: entradas entradas_uuid_cliente_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entradas
    ADD CONSTRAINT entradas_uuid_cliente_unique UNIQUE (uuid_cliente);


--
-- Name: equipos equipos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_pkey PRIMARY KEY (id);


--
-- Name: evidencia_no_aplicada_e2 evidencia_no_aplicada_e2_abono_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidencia_no_aplicada_e2
    ADD CONSTRAINT evidencia_no_aplicada_e2_abono_id_key UNIQUE (abono_id);


--
-- Name: evidencia_no_aplicada_e2 evidencia_no_aplicada_e2_cobro_clave_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidencia_no_aplicada_e2
    ADD CONSTRAINT evidencia_no_aplicada_e2_cobro_clave_key UNIQUE (cobro_clave);


--
-- Name: evidencia_no_aplicada_e2 evidencia_no_aplicada_e2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidencia_no_aplicada_e2
    ADD CONSTRAINT evidencia_no_aplicada_e2_pkey PRIMARY KEY (fuente);


--
-- Name: existencias existencias_producto_id_ubicacion_id_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.existencias
    ADD CONSTRAINT existencias_producto_id_ubicacion_id_pk PRIMARY KEY (producto_id, ubicacion_id);


--
-- Name: finalizaciones_abono_e2 finalizaciones_abono_e2_operacion_productor_operacion_clave_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finalizaciones_abono_e2
    ADD CONSTRAINT finalizaciones_abono_e2_operacion_productor_operacion_clave_key UNIQUE (operacion_productor, operacion_clave);


--
-- Name: finalizaciones_abono_e2 finalizaciones_abono_e2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finalizaciones_abono_e2
    ADD CONSTRAINT finalizaciones_abono_e2_pkey PRIMARY KEY (abono_id);


--
-- Name: fondo_arqueos fondo_arqueos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fondo_arqueos
    ADD CONSTRAINT fondo_arqueos_pkey PRIMARY KEY (id);


--
-- Name: fondo_mariana fondo_mariana_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fondo_mariana
    ADD CONSTRAINT fondo_mariana_pkey PRIMARY KEY (id);


--
-- Name: fondo_movimientos fondo_movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fondo_movimientos
    ADD CONSTRAINT fondo_movimientos_pkey PRIMARY KEY (id);


--
-- Name: movimientos_credito movimientos_credito_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_credito
    ADD CONSTRAINT movimientos_credito_pkey PRIMARY KEY (id);


--
-- Name: movimientos movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos
    ADD CONSTRAINT movimientos_pkey PRIMARY KEY (id);


--
-- Name: movimientos movimientos_uuid_cliente_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos
    ADD CONSTRAINT movimientos_uuid_cliente_unique UNIQUE (uuid_cliente);


--
-- Name: notificaciones_credito notificaciones_credito_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificaciones_credito
    ADD CONSTRAINT notificaciones_credito_pkey PRIMARY KEY (id);


--
-- Name: notificaciones_credito notificaciones_credito_ticket_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificaciones_credito
    ADD CONSTRAINT notificaciones_credito_ticket_id_unique UNIQUE (ticket_id);


--
-- Name: notificaciones_sistema notificaciones_sistema_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificaciones_sistema
    ADD CONSTRAINT notificaciones_sistema_pkey PRIMARY KEY (id);


--
-- Name: operaciones_credito_e1 operaciones_pk_e1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operaciones_credito_e1
    ADD CONSTRAINT operaciones_pk_e1 PRIMARY KEY (productor, clave);


--
-- Name: pagos_proveedor pagos_proveedor_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos_proveedor
    ADD CONSTRAINT pagos_proveedor_pkey PRIMARY KEY (id);


--
-- Name: permisos_rol permisos_rol_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos_rol
    ADD CONSTRAINT permisos_rol_pkey PRIMARY KEY (id);


--
-- Name: permisos_rol permisos_rol_rol_modulo_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos_rol
    ADD CONSTRAINT permisos_rol_rol_modulo_unique UNIQUE (rol, modulo);


--
-- Name: permisos_ubicacion permisos_ubicacion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos_ubicacion
    ADD CONSTRAINT permisos_ubicacion_pkey PRIMARY KEY (id);


--
-- Name: permisos_ubicacion permisos_ubicacion_ubicacion_rol_modulo_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos_ubicacion
    ADD CONSTRAINT permisos_ubicacion_ubicacion_rol_modulo_unique UNIQUE (ubicacion_id, rol, modulo);


--
-- Name: permisos_usuario permisos_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos_usuario
    ADD CONSTRAINT permisos_usuario_pkey PRIMARY KEY (id);


--
-- Name: permisos_usuario permisos_usuario_usuario_modulo_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos_usuario
    ADD CONSTRAINT permisos_usuario_usuario_modulo_unique UNIQUE (usuario_id, modulo);


--
-- Name: pisos pisos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pisos
    ADD CONSTRAINT pisos_pkey PRIMARY KEY (id);


--
-- Name: precio_historial precio_historial_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.precio_historial
    ADD CONSTRAINT precio_historial_pkey PRIMARY KEY (id);


--
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id);


--
-- Name: productos productos_sku_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_sku_unique UNIQUE (sku);


--
-- Name: productos productos_tela_color_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_tela_color_unique UNIQUE (tela, color);


--
-- Name: proveedores proveedores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT proveedores_pkey PRIMARY KEY (id);


--
-- Name: reimpresiones_etiqueta reimpresiones_etiqueta_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reimpresiones_etiqueta
    ADD CONSTRAINT reimpresiones_etiqueta_pkey PRIMARY KEY (id);


--
-- Name: revisiones_etiqueta revisiones_etiqueta_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.revisiones_etiqueta
    ADD CONSTRAINT revisiones_etiqueta_pkey PRIMARY KEY (id);


--
-- Name: rollos rollos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rollos
    ADD CONSTRAINT rollos_pkey PRIMARY KEY (id);


--
-- Name: rollos rollos_serie_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rollos
    ADD CONSTRAINT rollos_serie_unique UNIQUE (serie);


--
-- Name: salida_folio salida_folio_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salida_folio
    ADD CONSTRAINT salida_folio_pkey PRIMARY KEY (ubicacion_id);


--
-- Name: salida_lineas salida_lineas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salida_lineas
    ADD CONSTRAINT salida_lineas_pkey PRIMARY KEY (id);


--
-- Name: salida_rollos salida_rollos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salida_rollos
    ADD CONSTRAINT salida_rollos_pkey PRIMARY KEY (id);


--
-- Name: salidas_dinero_caja salidas_dinero_caja_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salidas_dinero_caja
    ADD CONSTRAINT salidas_dinero_caja_pkey PRIMARY KEY (id);


--
-- Name: salidas salidas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_pkey PRIMARY KEY (id);


--
-- Name: salidas salidas_uuid_cliente_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_uuid_cliente_unique UNIQUE (uuid_cliente);


--
-- Name: series_consecutivo series_consecutivo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.series_consecutivo
    ADD CONSTRAINT series_consecutivo_pkey PRIMARY KEY (id);


--
-- Name: sesiones_caja_dias sesiones_caja_dias_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sesiones_caja_dias
    ADD CONSTRAINT sesiones_caja_dias_pkey PRIMARY KEY (ubicacion_id, fecha_operativa);


--
-- Name: sesiones_caja sesiones_caja_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sesiones_caja
    ADD CONSTRAINT sesiones_caja_pkey PRIMARY KEY (id);


--
-- Name: sesiones sesiones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sesiones
    ADD CONSTRAINT sesiones_pkey PRIMARY KEY (id);


--
-- Name: solicitudes_pago_dirigido solicitudes_pago_dirigido_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitudes_pago_dirigido
    ADD CONSTRAINT solicitudes_pago_dirigido_pkey PRIMARY KEY (id);


--
-- Name: stock_minimo_episodios stock_minimo_episodios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_minimo_episodios
    ADD CONSTRAINT stock_minimo_episodios_pkey PRIMARY KEY (id);


--
-- Name: stock_minimo_sitios stock_minimo_sitios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_minimo_sitios
    ADD CONSTRAINT stock_minimo_sitios_pkey PRIMARY KEY (ubicacion_id);


--
-- Name: stock_minimos stock_minimos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_minimos
    ADD CONSTRAINT stock_minimos_pkey PRIMARY KEY (id);


--
-- Name: stock_minimos stock_minimos_producto_ubicacion_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_minimos
    ADD CONSTRAINT stock_minimos_producto_ubicacion_unique UNIQUE (producto_id, ubicacion_id);


--
-- Name: ticket_folio ticket_folio_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_folio
    ADD CONSTRAINT ticket_folio_pkey PRIMARY KEY (id);


--
-- Name: ticket_linea_consumos ticket_linea_consumos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_linea_consumos
    ADD CONSTRAINT ticket_linea_consumos_pkey PRIMARY KEY (id);


--
-- Name: ticket_lineas ticket_lineas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_lineas
    ADD CONSTRAINT ticket_lineas_pkey PRIMARY KEY (id);


--
-- Name: ticket_pagos ticket_pagos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_pagos
    ADD CONSTRAINT ticket_pagos_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_folio_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_folio_unique UNIQUE (folio);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_uuid_cliente_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_uuid_cliente_unique UNIQUE (uuid_cliente);


--
-- Name: ubicaciones ubicaciones_nombre_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ubicaciones
    ADD CONSTRAINT ubicaciones_nombre_unique UNIQUE (nombre);


--
-- Name: ubicaciones ubicaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ubicaciones
    ADD CONSTRAINT ubicaciones_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_usuario_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_usuario_unique UNIQUE (usuario);


--
-- Name: viaje_folio viaje_folio_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viaje_folio
    ADD CONSTRAINT viaje_folio_pkey PRIMARY KEY (ubicacion_id);


--
-- Name: viaje_salidas viaje_salidas_salida_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viaje_salidas
    ADD CONSTRAINT viaje_salidas_salida_unique UNIQUE (salida_id);


--
-- Name: viaje_tickets viaje_tickets_ticket_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viaje_tickets
    ADD CONSTRAINT viaje_tickets_ticket_unique UNIQUE (ticket_id);


--
-- Name: viajes viajes_origen_folio_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viajes
    ADD CONSTRAINT viajes_origen_folio_unique UNIQUE (origen_id, folio);


--
-- Name: viajes viajes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viajes
    ADD CONSTRAINT viajes_pkey PRIMARY KEY (id);


--
-- Name: aplicaciones_credito_venta_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX aplicaciones_credito_venta_idx ON public.aplicaciones_credito USING btree (venta_movimiento_id);


--
-- Name: aplicaciones_pago_proveedor_compra_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX aplicaciones_pago_proveedor_compra_idx ON public.aplicaciones_pago_proveedor USING btree (compra_proveedor_id);


--
-- Name: auditoria_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_created_idx ON public.auditoria USING btree (created_at DESC, id DESC);


--
-- Name: auditoria_entidad_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_entidad_idx ON public.auditoria USING btree (entidad, entidad_id);


--
-- Name: auditoria_inventario_escaneos_usuario_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_inventario_escaneos_usuario_idx ON public.auditoria_inventario_escaneos USING btree (usuario_id);


--
-- Name: auditoria_inventario_snapshot_rollo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_inventario_snapshot_rollo_idx ON public.auditoria_inventario_snapshot USING btree (rollo_id);


--
-- Name: auditoria_modulo_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_modulo_created_idx ON public.auditoria USING btree (modulo, created_at DESC);


--
-- Name: auditoria_sitio_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_sitio_created_idx ON public.auditoria USING btree (sitio_id, created_at DESC);


--
-- Name: auditoria_sobrante_decisiones_audit_serie_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_sobrante_decisiones_audit_serie_idx ON public.auditoria_sobrante_decisiones USING btree (auditoria_id, serie, id);


--
-- Name: auditoria_usuario_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_usuario_created_idx ON public.auditoria USING btree (usuario_id, created_at);


--
-- Name: auditorias_inventario_ubicacion_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditorias_inventario_ubicacion_idx ON public.auditorias_inventario USING btree (ubicacion_id);


--
-- Name: auditorias_inventario_una_abierta_por_sitio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX auditorias_inventario_una_abierta_por_sitio ON public.auditorias_inventario USING btree (ubicacion_id) WHERE (estado = 'ABIERTA'::text);


--
-- Name: autorizaciones_nota_sesion_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX autorizaciones_nota_sesion_idx ON public.autorizaciones_nota USING btree (sesion_caja_id, created_at);


--
-- Name: camionetas_activa_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX camionetas_activa_idx ON public.camionetas USING btree (activa);


--
-- Name: camionetas_placas_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX camionetas_placas_unique ON public.camionetas USING btree (placas);


--
-- Name: choferes_activo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX choferes_activo_idx ON public.choferes USING btree (activo);


--
-- Name: choferes_nombre_completo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX choferes_nombre_completo_idx ON public.choferes USING btree (nombre_completo);


--
-- Name: cliente_documentos_cliente_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cliente_documentos_cliente_idx ON public.cliente_documentos USING btree (cliente_id);


--
-- Name: cliente_documentos_slot_vigente_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX cliente_documentos_slot_vigente_uidx ON public.cliente_documentos USING btree (cliente_id, lado) WHERE vigente;


--
-- Name: clientes_activos_no_sistema_nombre_normalizado_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX clientes_activos_no_sistema_nombre_normalizado_uidx ON public.clientes USING btree (lower(btrim(nombre))) WHERE (activo AND (NOT es_sistema));


--
-- Name: contenedor_lineas_contenedor_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contenedor_lineas_contenedor_idx ON public.contenedor_lineas USING btree (contenedor_id);


--
-- Name: contenedor_lineas_producto_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contenedor_lineas_producto_idx ON public.contenedor_lineas USING btree (producto_id);


--
-- Name: contenedores_estado_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contenedores_estado_idx ON public.contenedores USING btree (estado);


--
-- Name: contenedores_fecha_estimada_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contenedores_fecha_estimada_idx ON public.contenedores USING btree (fecha_estimada_llegada);


--
-- Name: contenedores_proveedor_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contenedores_proveedor_idx ON public.contenedores USING btree (proveedor_id);


--
-- Name: contenedores_sitio_estado_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contenedores_sitio_estado_idx ON public.contenedores USING btree (sitio_destino_id, estado);


--
-- Name: cuadre_fiscal_registros_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cuadre_fiscal_registros_created_idx ON public.cuadre_fiscal_registros USING btree (created_at DESC);


--
-- Name: entradas_fecha_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entradas_fecha_id_idx ON public.entradas USING btree (fecha, id);


--
-- Name: entradas_fecha_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entradas_fecha_idx ON public.entradas USING btree (fecha);


--
-- Name: entradas_folio_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entradas_folio_idx ON public.entradas USING btree (folio);


--
-- Name: entradas_proveedor_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entradas_proveedor_idx ON public.entradas USING btree (proveedor_id);


--
-- Name: entradas_ubicacion_folio_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX entradas_ubicacion_folio_uidx ON public.entradas USING btree (ubicacion_id, folio);


--
-- Name: entradas_ubicacion_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entradas_ubicacion_idx ON public.entradas USING btree (ubicacion_id);


--
-- Name: entradas_uuid_cliente_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entradas_uuid_cliente_idx ON public.entradas USING btree (uuid_cliente);


--
-- Name: equipos_checklist_equipo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX equipos_checklist_equipo_idx ON public.equipos_checklist USING btree (equipo_id);


--
-- Name: equipos_checklist_equipo_item_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX equipos_checklist_equipo_item_unique ON public.equipos_checklist USING btree (equipo_id, item_key);


--
-- Name: equipos_ubicacion_identificador_ci_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX equipos_ubicacion_identificador_ci_unique ON public.equipos USING btree (ubicacion_id, lower(identificador));


--
-- Name: equipos_ubicacion_tipo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX equipos_ubicacion_tipo_idx ON public.equipos USING btree (ubicacion_id, tipo);


--
-- Name: existencias_producto_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX existencias_producto_idx ON public.existencias USING btree (producto_id);


--
-- Name: existencias_ubicacion_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX existencias_ubicacion_idx ON public.existencias USING btree (ubicacion_id);


--
-- Name: fondo_arqueos_fondo_fecha_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX fondo_arqueos_fondo_fecha_idx ON public.fondo_arqueos USING btree (fondo_id, created_at DESC, id DESC);


--
-- Name: fondo_arqueos_productor_idempotencia_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX fondo_arqueos_productor_idempotencia_uidx ON public.fondo_arqueos USING btree (idempotency_producer, idempotency_key);


--
-- Name: fondo_mariana_singleton_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX fondo_mariana_singleton_uidx ON public.fondo_mariana USING btree ((true));


--
-- Name: fondo_mariana_ubicacion_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX fondo_mariana_ubicacion_uidx ON public.fondo_mariana USING btree (ubicacion_id);


--
-- Name: fondo_movimientos_fondo_ordinal_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX fondo_movimientos_fondo_ordinal_idx ON public.fondo_movimientos USING btree (fondo_id, ordinal DESC);


--
-- Name: fondo_movimientos_ordinal_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX fondo_movimientos_ordinal_uidx ON public.fondo_movimientos USING btree (ordinal);


--
-- Name: fondo_movimientos_original_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX fondo_movimientos_original_uidx ON public.fondo_movimientos USING btree (original_id) WHERE (original_id IS NOT NULL);


--
-- Name: fondo_movimientos_productor_idempotencia_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX fondo_movimientos_productor_idempotencia_uidx ON public.fondo_movimientos USING btree (idempotency_producer, idempotency_key);


--
-- Name: movimientos_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX movimientos_created_idx ON public.movimientos USING btree (created_at);


--
-- Name: movimientos_credito_cliente_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX movimientos_credito_cliente_created_at_idx ON public.movimientos_credito USING btree (cliente_id, created_at);


--
-- Name: movimientos_credito_reverso_origen_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX movimientos_credito_reverso_origen_uidx ON public.movimientos_credito USING btree (movimiento_origen_id) WHERE ((tipo = 'REVERSO'::public.tipo_movimiento_credito) AND (movimiento_origen_id IS NOT NULL));


--
-- Name: movimientos_credito_ticket_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX movimientos_credito_ticket_idx ON public.movimientos_credito USING btree (ticket_id);


--
-- Name: movimientos_motivo_salida_extraordinaria_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX movimientos_motivo_salida_extraordinaria_idx ON public.movimientos USING btree (motivo_salida_extraordinaria);


--
-- Name: movimientos_operacion_uq_e1; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX movimientos_operacion_uq_e1 ON public.movimientos_credito USING btree (operacion_productor, operacion_clave) WHERE (operacion_productor IS NOT NULL);


--
-- Name: movimientos_producto_ubicacion_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX movimientos_producto_ubicacion_idx ON public.movimientos USING btree (producto_id, ubicacion_id);


--
-- Name: movimientos_revisado_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX movimientos_revisado_idx ON public.movimientos USING btree (revisado);


--
-- Name: movimientos_rollo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX movimientos_rollo_idx ON public.movimientos USING btree (rollo_id);


--
-- Name: movimientos_salida_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX movimientos_salida_idx ON public.movimientos USING btree (salida_id);


--
-- Name: movimientos_tipo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX movimientos_tipo_idx ON public.movimientos USING btree (tipo);


--
-- Name: movimientos_ubicacion_created_reportes_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX movimientos_ubicacion_created_reportes_idx ON public.movimientos USING btree (ubicacion_id, created_at);


--
-- Name: movimientos_uuid_cliente_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX movimientos_uuid_cliente_idx ON public.movimientos USING btree (uuid_cliente);


--
-- Name: notificaciones_auditoria_cerrada_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX notificaciones_auditoria_cerrada_uidx ON public.notificaciones_sistema USING btree (entidad, entidad_id) WHERE (tipo = 'AUDITORIA_INVENTARIO_CERRADA'::text);


--
-- Name: notificaciones_credito_cliente_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notificaciones_credito_cliente_idx ON public.notificaciones_credito USING btree (cliente_id);


--
-- Name: notificaciones_credito_leida_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notificaciones_credito_leida_created_idx ON public.notificaciones_credito USING btree (leida_at, created_at);


--
-- Name: notificaciones_sistema_destinatario_leida_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notificaciones_sistema_destinatario_leida_idx ON public.notificaciones_sistema USING btree (destinatario_usuario_id, leida_at, created_at);


--
-- Name: notificaciones_sistema_leida_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notificaciones_sistema_leida_created_idx ON public.notificaciones_sistema USING btree (leida_at, created_at);


--
-- Name: notificaciones_sistema_pago_dirigido_resuelto_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX notificaciones_sistema_pago_dirigido_resuelto_uidx ON public.notificaciones_sistema USING btree (entidad, entidad_id, destinatario_usuario_id) WHERE (tipo = 'PAGO_DIRIGIDO_RESUELTO'::text);


--
-- Name: notificaciones_sistema_stock_minimo_episode_recipient_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX notificaciones_sistema_stock_minimo_episode_recipient_uidx ON public.notificaciones_sistema USING btree (entidad, entidad_id, destinatario_usuario_id) WHERE (tipo = 'STOCK_MINIMO'::text);


--
-- Name: pagos_proveedor_entrada_compra_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX pagos_proveedor_entrada_compra_idx ON public.pagos_proveedor USING btree (entrada_id) WHERE ((tipo = 'COMPRA'::public.tipo_pago_proveedor) AND (entrada_id IS NOT NULL));


--
-- Name: pagos_proveedor_proveedor_fecha_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX pagos_proveedor_proveedor_fecha_idx ON public.pagos_proveedor USING btree (proveedor_id, fecha);


--
-- Name: pagos_proveedor_reverso_origen_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX pagos_proveedor_reverso_origen_uidx ON public.pagos_proveedor USING btree (movimiento_origen_id) WHERE ((tipo = 'REVERSO'::public.tipo_pago_proveedor) AND (movimiento_origen_id IS NOT NULL));


--
-- Name: pisos_ubicacion_nombre_ci_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX pisos_ubicacion_nombre_ci_unique ON public.pisos USING btree (ubicacion_id, lower(nombre));


--
-- Name: precio_historial_producto_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX precio_historial_producto_created_idx ON public.precio_historial USING btree (producto_id, created_at);


--
-- Name: precio_historial_producto_modo_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX precio_historial_producto_modo_created_idx ON public.precio_historial USING btree (producto_id, modo_precio, created_at);


--
-- Name: productos_sku_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX productos_sku_idx ON public.productos USING btree (sku);


--
-- Name: productos_tela_color_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX productos_tela_color_idx ON public.productos USING btree (tela, color);


--
-- Name: reimpresiones_etiqueta_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX reimpresiones_etiqueta_created_at_idx ON public.reimpresiones_etiqueta USING btree (created_at);


--
-- Name: reimpresiones_etiqueta_rollo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX reimpresiones_etiqueta_rollo_idx ON public.reimpresiones_etiqueta USING btree (rollo_id);


--
-- Name: reimpresiones_etiqueta_usuario_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX reimpresiones_etiqueta_usuario_idx ON public.reimpresiones_etiqueta USING btree (usuario_id);


--
-- Name: revisiones_etiqueta_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX revisiones_etiqueta_created_at_idx ON public.revisiones_etiqueta USING btree (created_at);


--
-- Name: revisiones_etiqueta_rollo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX revisiones_etiqueta_rollo_idx ON public.revisiones_etiqueta USING btree (rollo_id);


--
-- Name: revisiones_etiqueta_rollo_reimpresion_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX revisiones_etiqueta_rollo_reimpresion_uidx ON public.revisiones_etiqueta USING btree (rollo_id, reimpresion_id);


--
-- Name: revisiones_etiqueta_usuario_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX revisiones_etiqueta_usuario_idx ON public.revisiones_etiqueta USING btree (usuario_id);


--
-- Name: rollos_estado_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX rollos_estado_idx ON public.rollos USING btree (estado);


--
-- Name: rollos_piso_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX rollos_piso_idx ON public.rollos USING btree (piso_id);


--
-- Name: rollos_producto_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX rollos_producto_idx ON public.rollos USING btree (producto_id);


--
-- Name: rollos_recepcion_producto_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX rollos_recepcion_producto_idx ON public.rollos USING btree (recepcion_id, producto_id);


--
-- Name: rollos_serie_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX rollos_serie_idx ON public.rollos USING btree (serie);


--
-- Name: rollos_ubicacion_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX rollos_ubicacion_idx ON public.rollos USING btree (ubicacion_id);


--
-- Name: rollos_ubicacion_producto_reportes_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX rollos_ubicacion_producto_reportes_idx ON public.rollos USING btree (ubicacion_id, producto_id);


--
-- Name: salida_lineas_producto_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX salida_lineas_producto_idx ON public.salida_lineas USING btree (producto_id);


--
-- Name: salida_lineas_salida_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX salida_lineas_salida_idx ON public.salida_lineas USING btree (salida_id);


--
-- Name: salida_rollos_linea_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX salida_rollos_linea_idx ON public.salida_rollos USING btree (linea_id);


--
-- Name: salida_rollos_rollo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX salida_rollos_rollo_idx ON public.salida_rollos USING btree (rollo_id);


--
-- Name: salida_rollos_rollo_salida_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX salida_rollos_rollo_salida_idx ON public.salida_rollos USING btree (rollo_id, salida_id);


--
-- Name: salida_rollos_salida_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX salida_rollos_salida_idx ON public.salida_rollos USING btree (salida_id);


--
-- Name: salidas_borrador_usuario_origen_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX salidas_borrador_usuario_origen_uidx ON public.salidas USING btree (usuario_solicita_id, origen_id) WHERE ((estado = 'ARMANDO'::public.estado_salida) AND (modalidad = 'TRASLADO'::text) AND (usuario_solicita_id IS NOT NULL));


--
-- Name: salidas_cliente_estado_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX salidas_cliente_estado_idx ON public.salidas USING btree (cliente_id, estado);


--
-- Name: salidas_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX salidas_created_at_idx ON public.salidas USING btree (created_at);


--
-- Name: salidas_destino_estado_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX salidas_destino_estado_idx ON public.salidas USING btree (destino_id, estado);


--
-- Name: salidas_dinero_caja_proveedor_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX salidas_dinero_caja_proveedor_idx ON public.salidas_dinero_caja USING btree (proveedor_id);


--
-- Name: salidas_dinero_caja_sesion_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX salidas_dinero_caja_sesion_created_idx ON public.salidas_dinero_caja USING btree (sesion_caja_id, created_at);


--
-- Name: salidas_estado_actividad_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX salidas_estado_actividad_idx ON public.salidas USING btree (estado, actividad_at);


--
-- Name: salidas_estado_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX salidas_estado_idx ON public.salidas USING btree (estado);


--
-- Name: salidas_folio_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX salidas_folio_idx ON public.salidas USING btree (folio);


--
-- Name: salidas_origen_estado_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX salidas_origen_estado_idx ON public.salidas USING btree (origen_id, estado);


--
-- Name: salidas_origen_folio_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX salidas_origen_folio_uidx ON public.salidas USING btree (origen_id, folio);


--
-- Name: salidas_ticket_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX salidas_ticket_idx ON public.salidas USING btree (ticket_id);


--
-- Name: sesiones_caja_cerrada_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sesiones_caja_cerrada_at_idx ON public.sesiones_caja USING btree (cerrada_at) WHERE (estado = 'CERRADA'::public.estado_sesion_caja);


--
-- Name: sesiones_caja_ubicacion_estado_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sesiones_caja_ubicacion_estado_idx ON public.sesiones_caja USING btree (ubicacion_id, estado);


--
-- Name: sesiones_caja_una_abierta_ubicacion_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX sesiones_caja_una_abierta_ubicacion_idx ON public.sesiones_caja USING btree (ubicacion_id) WHERE (estado = 'ABIERTA'::public.estado_sesion_caja);


--
-- Name: solicitudes_pago_dirigido_entidad_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX solicitudes_pago_dirigido_entidad_idx ON public.solicitudes_pago_dirigido USING btree (tipo, entidad_id);


--
-- Name: solicitudes_pago_dirigido_estado_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX solicitudes_pago_dirigido_estado_idx ON public.solicitudes_pago_dirigido USING btree (estado, created_at);


--
-- Name: stock_minimo_episodios_activo_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX stock_minimo_episodios_activo_uidx ON public.stock_minimo_episodios USING btree (producto_id, ubicacion_id) WHERE (cerrado_at IS NULL);


--
-- Name: stock_minimo_episodios_ubicacion_abierto_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_minimo_episodios_ubicacion_abierto_idx ON public.stock_minimo_episodios USING btree (ubicacion_id, cerrado_at);


--
-- Name: stock_minimos_producto_ubicacion_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX stock_minimos_producto_ubicacion_uidx ON public.stock_minimos USING btree (producto_id, ubicacion_id);


--
-- Name: stock_minimos_ubicacion_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_minimos_ubicacion_idx ON public.stock_minimos USING btree (ubicacion_id);


--
-- Name: ticket_linea_consumos_idempotencia_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ticket_linea_consumos_idempotencia_uidx ON public.ticket_linea_consumos USING btree (idempotencia);


--
-- Name: ticket_linea_consumos_movimiento_consumo_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ticket_linea_consumos_movimiento_consumo_uidx ON public.ticket_linea_consumos USING btree (movimiento_id) WHERE (tipo = 'CONSUMO'::text);


--
-- Name: ticket_linea_consumos_proveedor_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ticket_linea_consumos_proveedor_idx ON public.ticket_linea_consumos USING btree (proveedor_id);


--
-- Name: ticket_linea_consumos_reversa_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ticket_linea_consumos_reversa_uidx ON public.ticket_linea_consumos USING btree (reversa_de_id) WHERE (tipo = 'REVERSA'::text);


--
-- Name: ticket_linea_consumos_rollo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ticket_linea_consumos_rollo_idx ON public.ticket_linea_consumos USING btree (rollo_id);


--
-- Name: ticket_linea_consumos_ticket_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ticket_linea_consumos_ticket_idx ON public.ticket_linea_consumos USING btree (ticket_id);


--
-- Name: ticket_linea_consumos_ticket_linea_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ticket_linea_consumos_ticket_linea_idx ON public.ticket_linea_consumos USING btree (ticket_linea_id);


--
-- Name: ticket_lineas_producto_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ticket_lineas_producto_idx ON public.ticket_lineas USING btree (producto_id);


--
-- Name: ticket_lineas_producto_ticket_reportes_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ticket_lineas_producto_ticket_reportes_idx ON public.ticket_lineas USING btree (producto_id, ticket_id);


--
-- Name: ticket_lineas_rollo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ticket_lineas_rollo_idx ON public.ticket_lineas USING btree (rollo_id);


--
-- Name: ticket_lineas_ticket_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ticket_lineas_ticket_idx ON public.ticket_lineas USING btree (ticket_id);


--
-- Name: ticket_lineas_tipo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ticket_lineas_tipo_idx ON public.ticket_lineas USING btree (tipo);


--
-- Name: ticket_pagos_ticket_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ticket_pagos_ticket_idx ON public.ticket_pagos USING btree (ticket_id);


--
-- Name: tickets_cliente_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tickets_cliente_created_at_idx ON public.tickets USING btree (cliente_id, created_at);


--
-- Name: tickets_cobrado_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tickets_cobrado_created_at_idx ON public.tickets USING btree (created_at, ubicacion_id) WHERE (cobrado = true);


--
-- Name: tickets_cobrado_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tickets_cobrado_idx ON public.tickets USING btree (cobrado);


--
-- Name: tickets_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tickets_created_at_idx ON public.tickets USING btree (created_at);


--
-- Name: tickets_estado_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tickets_estado_idx ON public.tickets USING btree (estado);


--
-- Name: tickets_folio_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tickets_folio_idx ON public.tickets USING btree (folio);


--
-- Name: tickets_sesion_estado_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tickets_sesion_estado_idx ON public.tickets USING btree (sesion_caja_id, estado);


--
-- Name: tickets_ubicacion_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tickets_ubicacion_created_at_idx ON public.tickets USING btree (ubicacion_id, created_at);


--
-- Name: tickets_uuid_cliente_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tickets_uuid_cliente_idx ON public.tickets USING btree (uuid_cliente);


--
-- Name: ubicaciones_iniciales_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ubicaciones_iniciales_uidx ON public.ubicaciones USING btree (iniciales);


--
-- Name: viaje_salidas_viaje_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX viaje_salidas_viaje_idx ON public.viaje_salidas USING btree (viaje_id);


--
-- Name: viaje_tickets_viaje_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX viaje_tickets_viaje_idx ON public.viaje_tickets USING btree (viaje_id);


--
-- Name: viajes_camioneta_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX viajes_camioneta_idx ON public.viajes USING btree (camioneta_id);


--
-- Name: viajes_chofer_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX viajes_chofer_idx ON public.viajes USING btree (chofer_id);


--
-- Name: viajes_salida_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX viajes_salida_at_idx ON public.viajes USING btree (salida_at);


--
-- Name: aplicaciones_credito aplicaciones_credito_inmutables; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER aplicaciones_credito_inmutables BEFORE DELETE OR UPDATE ON public.aplicaciones_credito FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_record_mutation();


--
-- Name: aplicaciones_credito aplicaciones_credito_validas; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER aplicaciones_credito_validas BEFORE INSERT ON public.aplicaciones_credito FOR EACH ROW EXECUTE FUNCTION public.validate_credit_application();


--
-- Name: aplicaciones_pago_proveedor aplicaciones_pago_proveedor_append_only; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER aplicaciones_pago_proveedor_append_only BEFORE DELETE OR UPDATE ON public.aplicaciones_pago_proveedor FOR EACH ROW EXECUTE FUNCTION public.proteger_aplicaciones_pago_proveedor();


--
-- Name: aplicaciones_pago_proveedor aplicaciones_pago_proveedor_validar_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER aplicaciones_pago_proveedor_validar_insert BEFORE INSERT ON public.aplicaciones_pago_proveedor FOR EACH ROW EXECUTE FUNCTION public.validar_aplicacion_pago_proveedor();


--
-- Name: atribuciones_credito_e1 atribuciones_inmutables_e1; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER atribuciones_inmutables_e1 BEFORE DELETE OR UPDATE OR TRUNCATE ON public.atribuciones_credito_e1 FOR EACH STATEMENT EXECUTE FUNCTION public.impedir_mutacion_credito_e1();


--
-- Name: atribuciones_credito_e1 atribuciones_validas_e1; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER atribuciones_validas_e1 BEFORE INSERT ON public.atribuciones_credito_e1 FOR EACH ROW EXECUTE FUNCTION public.validar_atribucion_credito_e1();


--
-- Name: auditoria auditoria_append_only; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER auditoria_append_only BEFORE DELETE OR UPDATE ON public.auditoria FOR EACH ROW EXECUTE FUNCTION public.proteger_auditoria_append_only();


--
-- Name: auditoria auditoria_enriquecer_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER auditoria_enriquecer_insert BEFORE INSERT ON public.auditoria FOR EACH ROW EXECUTE FUNCTION public.enriquecer_auditoria();


--
-- Name: auditoria_faltante_reactivaciones auditoria_faltante_reactivaciones_append_only; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER auditoria_faltante_reactivaciones_append_only BEFORE DELETE OR UPDATE ON public.auditoria_faltante_reactivaciones FOR EACH ROW EXECUTE FUNCTION public.proteger_auditoria_resolucion_append_only();


--
-- Name: auditoria_sobrante_contextos auditoria_sobrante_contextos_append_only; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER auditoria_sobrante_contextos_append_only BEFORE DELETE OR UPDATE ON public.auditoria_sobrante_contextos FOR EACH ROW EXECUTE FUNCTION public.proteger_auditoria_resolucion_append_only();


--
-- Name: auditoria_sobrante_decisiones auditoria_sobrante_decisiones_append_only; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER auditoria_sobrante_decisiones_append_only BEFORE DELETE OR UPDATE ON public.auditoria_sobrante_decisiones FOR EACH ROW EXECUTE FUNCTION public.proteger_auditoria_resolucion_append_only();


--
-- Name: cobros_credito_pendientes_e1 cobros_inmutables_e1; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER cobros_inmutables_e1 BEFORE DELETE OR UPDATE OR TRUNCATE ON public.cobros_credito_pendientes_e1 FOR EACH STATEMENT EXECUTE FUNCTION public.impedir_mutacion_credito_e1();


--
-- Name: cobros_credito_pendientes_e1 cobros_validos_e1; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER cobros_validos_e1 AFTER INSERT ON public.cobros_credito_pendientes_e1 FOR EACH ROW EXECUTE FUNCTION public.validar_cobro_pendiente_e1();


--
-- Name: movimientos_credito e2_abono_finalization_complete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE CONSTRAINT TRIGGER e2_abono_finalization_complete AFTER INSERT ON public.movimientos_credito DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e2_require_abono_finalization();


--
-- Name: aplicaciones_credito e2_capture_application_order; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER e2_capture_application_order BEFORE INSERT ON public.aplicaciones_credito FOR EACH ROW EXECUTE FUNCTION public.e2_guard_finalized_capture_application();


--
-- Name: finalizaciones_abono_e2 e2_finalization_immutable; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER e2_finalization_immutable BEFORE DELETE OR UPDATE OR TRUNCATE ON public.finalizaciones_abono_e2 FOR EACH STATEMENT EXECUTE FUNCTION public.e2_reject_evidence_mutation();


--
-- Name: evidencia_no_aplicada_e2 e2_proof_immutable; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER e2_proof_immutable BEFORE DELETE OR UPDATE OR TRUNCATE ON public.evidencia_no_aplicada_e2 FOR EACH STATEMENT EXECUTE FUNCTION public.e2_reject_evidence_mutation();


--
-- Name: cobros_credito_pendientes_e1 e2_retained_insert_transaction; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER e2_retained_insert_transaction BEFORE INSERT OR UPDATE ON public.cobros_credito_pendientes_e1 FOR EACH ROW EXECUTE FUNCTION public.e2_stamp_insert_transaction();


--
-- Name: movimientos_credito e2_source_insert_transaction; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER e2_source_insert_transaction BEFORE INSERT OR UPDATE ON public.movimientos_credito FOR EACH ROW EXECUTE FUNCTION public.e2_stamp_insert_transaction();


--
-- Name: finalizaciones_abono_e2 e2_validate_abono_finalization; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER e2_validate_abono_finalization BEFORE INSERT ON public.finalizaciones_abono_e2 FOR EACH ROW EXECUTE FUNCTION public.e2_validate_abono_finalization();


--
-- Name: evidencia_no_aplicada_e2 e2_validate_unused_proof; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER e2_validate_unused_proof BEFORE INSERT ON public.evidencia_no_aplicada_e2 FOR EACH ROW EXECUTE FUNCTION public.e2_validate_unused_proof();


--
-- Name: fondo_arqueos fondo_arqueos_immutable_before_mutation; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER fondo_arqueos_immutable_before_mutation BEFORE DELETE OR UPDATE ON public.fondo_arqueos FOR EACH ROW EXECUTE FUNCTION public.fondo_reject_mutation();


--
-- Name: fondo_arqueos fondo_arqueos_immutable_before_truncate; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER fondo_arqueos_immutable_before_truncate BEFORE TRUNCATE ON public.fondo_arqueos FOR EACH STATEMENT EXECUTE FUNCTION public.fondo_reject_mutation();


--
-- Name: fondo_arqueos fondo_arqueos_validate_before_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER fondo_arqueos_validate_before_insert BEFORE INSERT ON public.fondo_arqueos FOR EACH ROW EXECUTE FUNCTION public.fondo_validate_audit();


--
-- Name: fondo_mariana fondo_mariana_fixed_before_mutation; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER fondo_mariana_fixed_before_mutation BEFORE INSERT OR DELETE OR UPDATE ON public.fondo_mariana FOR EACH ROW EXECUTE FUNCTION public.fondo_assert_fixed_mariana();


--
-- Name: fondo_mariana fondo_mariana_immutable_before_truncate; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER fondo_mariana_immutable_before_truncate BEFORE TRUNCATE ON public.fondo_mariana FOR EACH STATEMENT EXECUTE FUNCTION public.fondo_reject_mutation();


--
-- Name: fondo_movimientos fondo_movimientos_immutable_before_mutation; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER fondo_movimientos_immutable_before_mutation BEFORE DELETE OR UPDATE ON public.fondo_movimientos FOR EACH ROW EXECUTE FUNCTION public.fondo_reject_mutation();


--
-- Name: fondo_movimientos fondo_movimientos_immutable_before_truncate; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER fondo_movimientos_immutable_before_truncate BEFORE TRUNCATE ON public.fondo_movimientos FOR EACH STATEMENT EXECUTE FUNCTION public.fondo_reject_mutation();


--
-- Name: fondo_movimientos fondo_movimientos_validate_before_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER fondo_movimientos_validate_before_insert BEFORE INSERT ON public.fondo_movimientos FOR EACH ROW EXECUTE FUNCTION public.fondo_validate_movement();


--
-- Name: movimientos_credito movimientos_credito_inmutables; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER movimientos_credito_inmutables BEFORE DELETE OR UPDATE ON public.movimientos_credito FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_record_mutation();


--
-- Name: movimientos_credito movimientos_credito_reversos_validos; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER movimientos_credito_reversos_validos BEFORE INSERT ON public.movimientos_credito FOR EACH ROW EXECUTE FUNCTION public.validate_credit_reversal();


--
-- Name: movimientos_credito movimientos_validos_e1; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER movimientos_validos_e1 AFTER INSERT ON public.movimientos_credito FOR EACH ROW EXECUTE FUNCTION public.validar_movimiento_credito_e1();


--
-- Name: operaciones_credito_e1 operaciones_inmutables_e1; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER operaciones_inmutables_e1 BEFORE DELETE OR UPDATE OR TRUNCATE ON public.operaciones_credito_e1 FOR EACH STATEMENT EXECUTE FUNCTION public.impedir_mutacion_credito_e1();


--
-- Name: pagos_proveedor pagos_proveedor_inmutables; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER pagos_proveedor_inmutables BEFORE DELETE OR UPDATE ON public.pagos_proveedor FOR EACH ROW EXECUTE FUNCTION public.prevent_pago_proveedor_mutation();


--
-- Name: reimpresiones_etiqueta reimpresiones_etiqueta_inmutable; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER reimpresiones_etiqueta_inmutable BEFORE DELETE OR UPDATE ON public.reimpresiones_etiqueta FOR EACH ROW EXECUTE FUNCTION public.bloquear_mutacion_reimpresion_etiqueta();


--
-- Name: revisiones_etiqueta revisiones_etiqueta_inmutable; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER revisiones_etiqueta_inmutable BEFORE DELETE OR UPDATE ON public.revisiones_etiqueta FOR EACH ROW EXECUTE FUNCTION public.bloquear_mutacion_revision_etiqueta();


--
-- Name: revisiones_etiqueta revisiones_etiqueta_reimpresion_fk_check; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER revisiones_etiqueta_reimpresion_fk_check BEFORE INSERT OR UPDATE ON public.revisiones_etiqueta FOR EACH ROW EXECUTE FUNCTION public.validar_revision_etiqueta_reimpresion();


--
-- Name: ticket_linea_consumos ticket_linea_consumos_append_only; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER ticket_linea_consumos_append_only BEFORE INSERT OR DELETE OR UPDATE ON public.ticket_linea_consumos FOR EACH ROW EXECUTE FUNCTION public.ticket_linea_consumos_guard();

ALTER TABLE public.ticket_linea_consumos ENABLE ALWAYS TRIGGER ticket_linea_consumos_append_only;


--
-- Name: ticket_pagos ticket_pagos_inmutables; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER ticket_pagos_inmutables BEFORE DELETE OR UPDATE ON public.ticket_pagos FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_record_mutation();


--
-- Name: movimientos_credito zz_e1_cash_capture_closed; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER zz_e1_cash_capture_closed AFTER INSERT ON public.movimientos_credito FOR EACH ROW EXECUTE FUNCTION public.e1_guard_cash_capture_closed();


--
-- Name: atribuciones_credito_e1 zz_e1_historical_attribution_closed; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER zz_e1_historical_attribution_closed AFTER INSERT ON public.atribuciones_credito_e1 FOR EACH STATEMENT EXECUTE FUNCTION public.e1_guard_historical_attribution_closed();


--
-- Name: cobros_credito_pendientes_e1 zz_e1_pending_receipts_closed; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER zz_e1_pending_receipts_closed AFTER INSERT ON public.cobros_credito_pendientes_e1 FOR EACH STATEMENT EXECUTE FUNCTION public.e1_guard_pending_receipts_closed();


--
-- Name: aplicaciones_credito aplicaciones_credito_abono_movimiento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aplicaciones_credito
    ADD CONSTRAINT aplicaciones_credito_abono_movimiento_id_fkey FOREIGN KEY (abono_movimiento_id) REFERENCES public.movimientos_credito(id);


--
-- Name: aplicaciones_credito aplicaciones_credito_venta_movimiento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aplicaciones_credito
    ADD CONSTRAINT aplicaciones_credito_venta_movimiento_id_fkey FOREIGN KEY (venta_movimiento_id) REFERENCES public.movimientos_credito(id);


--
-- Name: aplicaciones_pago_proveedor aplicaciones_pago_proveedor_compra_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aplicaciones_pago_proveedor
    ADD CONSTRAINT aplicaciones_pago_proveedor_compra_proveedor_id_fkey FOREIGN KEY (compra_proveedor_id) REFERENCES public.pagos_proveedor(id);


--
-- Name: aplicaciones_pago_proveedor aplicaciones_pago_proveedor_pago_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aplicaciones_pago_proveedor
    ADD CONSTRAINT aplicaciones_pago_proveedor_pago_proveedor_id_fkey FOREIGN KEY (pago_proveedor_id) REFERENCES public.pagos_proveedor(id);


--
-- Name: atribuciones_credito_e1 atribuciones_actor_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.atribuciones_credito_e1
    ADD CONSTRAINT atribuciones_actor_fk_e1 FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: atribuciones_credito_e1 atribuciones_anterior_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.atribuciones_credito_e1
    ADD CONSTRAINT atribuciones_anterior_fk_e1 FOREIGN KEY (anterior_id) REFERENCES public.atribuciones_credito_e1(id);


--
-- Name: atribuciones_credito_e1 atribuciones_movimiento_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.atribuciones_credito_e1
    ADD CONSTRAINT atribuciones_movimiento_fk_e1 FOREIGN KEY (movimiento_id) REFERENCES public.movimientos_credito(id);


--
-- Name: atribuciones_credito_e1 atribuciones_sitio_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.atribuciones_credito_e1
    ADD CONSTRAINT atribuciones_sitio_fk_e1 FOREIGN KEY (sitio_origen_id) REFERENCES public.ubicaciones(id);


--
-- Name: auditoria_faltante_reactivaciones auditoria_faltante_reactivacion_movimiento_reactivacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_faltante_reactivaciones
    ADD CONSTRAINT auditoria_faltante_reactivacion_movimiento_reactivacion_id_fkey FOREIGN KEY (movimiento_reactivacion_id) REFERENCES public.movimientos(id);


--
-- Name: auditoria_faltante_reactivaciones auditoria_faltante_reactivaciones_auditoria_origen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_faltante_reactivaciones
    ADD CONSTRAINT auditoria_faltante_reactivaciones_auditoria_origen_id_fkey FOREIGN KEY (auditoria_origen_id) REFERENCES public.auditorias_inventario(id);


--
-- Name: auditoria_faltante_reactivaciones auditoria_faltante_reactivaciones_movimiento_baja_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_faltante_reactivaciones
    ADD CONSTRAINT auditoria_faltante_reactivaciones_movimiento_baja_id_fkey FOREIGN KEY (movimiento_baja_id) REFERENCES public.movimientos(id);


--
-- Name: auditoria_faltante_reactivaciones auditoria_faltante_reactivaciones_piso_aparicion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_faltante_reactivaciones
    ADD CONSTRAINT auditoria_faltante_reactivaciones_piso_aparicion_id_fkey FOREIGN KEY (piso_aparicion_id) REFERENCES public.pisos(id);


--
-- Name: auditoria_faltante_reactivaciones auditoria_faltante_reactivaciones_rollo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_faltante_reactivaciones
    ADD CONSTRAINT auditoria_faltante_reactivaciones_rollo_id_fkey FOREIGN KEY (rollo_id) REFERENCES public.rollos(id);


--
-- Name: auditoria_faltante_reactivaciones auditoria_faltante_reactivaciones_ubicacion_aparicion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_faltante_reactivaciones
    ADD CONSTRAINT auditoria_faltante_reactivaciones_ubicacion_aparicion_id_fkey FOREIGN KEY (ubicacion_aparicion_id) REFERENCES public.ubicaciones(id);


--
-- Name: auditoria_faltante_reactivaciones auditoria_faltante_reactivaciones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_faltante_reactivaciones
    ADD CONSTRAINT auditoria_faltante_reactivaciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: auditoria_inventario_escaneos auditoria_inventario_escaneos_auditoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_inventario_escaneos
    ADD CONSTRAINT auditoria_inventario_escaneos_auditoria_id_fkey FOREIGN KEY (auditoria_id) REFERENCES public.auditorias_inventario(id);


--
-- Name: auditoria_inventario_escaneos auditoria_inventario_escaneos_piso_real_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_inventario_escaneos
    ADD CONSTRAINT auditoria_inventario_escaneos_piso_real_id_fkey FOREIGN KEY (piso_real_id) REFERENCES public.pisos(id);


--
-- Name: auditoria_inventario_escaneos auditoria_inventario_escaneos_rollo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_inventario_escaneos
    ADD CONSTRAINT auditoria_inventario_escaneos_rollo_id_fkey FOREIGN KEY (rollo_id) REFERENCES public.rollos(id);


--
-- Name: auditoria_inventario_escaneos auditoria_inventario_escaneos_ubicacion_cierre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_inventario_escaneos
    ADD CONSTRAINT auditoria_inventario_escaneos_ubicacion_cierre_id_fkey FOREIGN KEY (ubicacion_cierre_id) REFERENCES public.ubicaciones(id);


--
-- Name: auditoria_inventario_escaneos auditoria_inventario_escaneos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_inventario_escaneos
    ADD CONSTRAINT auditoria_inventario_escaneos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: auditoria_inventario_folio auditoria_inventario_folio_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_inventario_folio
    ADD CONSTRAINT auditoria_inventario_folio_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: auditoria_inventario_participantes auditoria_inventario_participantes_auditoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_inventario_participantes
    ADD CONSTRAINT auditoria_inventario_participantes_auditoria_id_fkey FOREIGN KEY (auditoria_id) REFERENCES public.auditorias_inventario(id);


--
-- Name: auditoria_inventario_participantes auditoria_inventario_participantes_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_inventario_participantes
    ADD CONSTRAINT auditoria_inventario_participantes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: auditoria_inventario_snapshot auditoria_inventario_snapshot_auditoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_inventario_snapshot
    ADD CONSTRAINT auditoria_inventario_snapshot_auditoria_id_fkey FOREIGN KEY (auditoria_id) REFERENCES public.auditorias_inventario(id);


--
-- Name: auditoria_inventario_snapshot auditoria_inventario_snapshot_piso_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_inventario_snapshot
    ADD CONSTRAINT auditoria_inventario_snapshot_piso_snapshot_id_fkey FOREIGN KEY (piso_snapshot_id) REFERENCES public.pisos(id);


--
-- Name: auditoria_inventario_snapshot auditoria_inventario_snapshot_rollo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_inventario_snapshot
    ADD CONSTRAINT auditoria_inventario_snapshot_rollo_id_fkey FOREIGN KEY (rollo_id) REFERENCES public.rollos(id);


--
-- Name: auditoria_inventario_snapshot auditoria_inventario_snapshot_ubicacion_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_inventario_snapshot
    ADD CONSTRAINT auditoria_inventario_snapshot_ubicacion_snapshot_id_fkey FOREIGN KEY (ubicacion_snapshot_id) REFERENCES public.ubicaciones(id);


--
-- Name: auditoria auditoria_sitio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_sitio_id_fkey FOREIGN KEY (sitio_id) REFERENCES public.ubicaciones(id);


--
-- Name: auditoria_sobrante_contextos auditoria_sobrante_contextos_auditoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_sobrante_contextos
    ADD CONSTRAINT auditoria_sobrante_contextos_auditoria_id_fkey FOREIGN KEY (auditoria_id) REFERENCES public.auditorias_inventario(id);


--
-- Name: auditoria_sobrante_decisiones auditoria_sobrante_decisiones_auditoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_sobrante_decisiones
    ADD CONSTRAINT auditoria_sobrante_decisiones_auditoria_id_fkey FOREIGN KEY (auditoria_id) REFERENCES public.auditorias_inventario(id);


--
-- Name: auditoria_sobrante_decisiones auditoria_sobrante_decisiones_rollo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_sobrante_decisiones
    ADD CONSTRAINT auditoria_sobrante_decisiones_rollo_id_fkey FOREIGN KEY (rollo_id) REFERENCES public.rollos(id);


--
-- Name: auditoria_sobrante_decisiones auditoria_sobrante_decisiones_salida_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_sobrante_decisiones
    ADD CONSTRAINT auditoria_sobrante_decisiones_salida_id_fkey FOREIGN KEY (salida_id) REFERENCES public.salidas(id);


--
-- Name: auditoria_sobrante_decisiones auditoria_sobrante_decisiones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_sobrante_decisiones
    ADD CONSTRAINT auditoria_sobrante_decisiones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: auditoria auditoria_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: auditorias_inventario auditorias_inventario_cancelada_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditorias_inventario
    ADD CONSTRAINT auditorias_inventario_cancelada_por_id_fkey FOREIGN KEY (cancelada_por_id) REFERENCES public.usuarios(id);


--
-- Name: auditorias_inventario auditorias_inventario_cerrada_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditorias_inventario
    ADD CONSTRAINT auditorias_inventario_cerrada_por_id_fkey FOREIGN KEY (cerrada_por_id) REFERENCES public.usuarios(id);


--
-- Name: auditorias_inventario auditorias_inventario_confirmada_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditorias_inventario
    ADD CONSTRAINT auditorias_inventario_confirmada_por_id_fkey FOREIGN KEY (confirmada_por_id) REFERENCES public.usuarios(id);


--
-- Name: auditorias_inventario auditorias_inventario_creada_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditorias_inventario
    ADD CONSTRAINT auditorias_inventario_creada_por_id_fkey FOREIGN KEY (creada_por_id) REFERENCES public.usuarios(id);


--
-- Name: auditorias_inventario auditorias_inventario_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditorias_inventario
    ADD CONSTRAINT auditorias_inventario_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: autorizaciones_nota autorizaciones_nota_movimiento_credito_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.autorizaciones_nota
    ADD CONSTRAINT autorizaciones_nota_movimiento_credito_id_fkey FOREIGN KEY (movimiento_credito_id) REFERENCES public.movimientos_credito(id);


--
-- Name: autorizaciones_nota autorizaciones_nota_sesion_caja_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.autorizaciones_nota
    ADD CONSTRAINT autorizaciones_nota_sesion_caja_id_fkey FOREIGN KEY (sesion_caja_id) REFERENCES public.sesiones_caja(id);


--
-- Name: autorizaciones_nota autorizaciones_nota_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.autorizaciones_nota
    ADD CONSTRAINT autorizaciones_nota_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: autorizaciones_nota autorizaciones_nota_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.autorizaciones_nota
    ADD CONSTRAINT autorizaciones_nota_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: cliente_documentos cliente_documentos_cliente_id_clientes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cliente_documentos
    ADD CONSTRAINT cliente_documentos_cliente_id_clientes_id_fk FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: cliente_documentos cliente_documentos_subido_por_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cliente_documentos
    ADD CONSTRAINT cliente_documentos_subido_por_usuarios_id_fk FOREIGN KEY (subido_por) REFERENCES public.usuarios(id);


--
-- Name: cobros_credito_pendientes_e1 cobros_actor_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cobros_credito_pendientes_e1
    ADD CONSTRAINT cobros_actor_fk_e1 FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: cobros_credito_pendientes_e1 cobros_cliente_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cobros_credito_pendientes_e1
    ADD CONSTRAINT cobros_cliente_fk_e1 FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: cobros_credito_pendientes_e1 cobros_operacion_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cobros_credito_pendientes_e1
    ADD CONSTRAINT cobros_operacion_fk_e1 FOREIGN KEY (operacion_productor, operacion_clave) REFERENCES public.operaciones_credito_e1(productor, clave) MATCH FULL;


--
-- Name: cobros_credito_pendientes_e1 cobros_sesion_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cobros_credito_pendientes_e1
    ADD CONSTRAINT cobros_sesion_fk_e1 FOREIGN KEY (sesion_caja_id) REFERENCES public.sesiones_caja(id);


--
-- Name: cobros_credito_pendientes_e1 cobros_sitio_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cobros_credito_pendientes_e1
    ADD CONSTRAINT cobros_sitio_fk_e1 FOREIGN KEY (sitio_origen_id) REFERENCES public.ubicaciones(id);


--
-- Name: contenedor_lineas contenedor_lineas_contenedor_id_contenedores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contenedor_lineas
    ADD CONSTRAINT contenedor_lineas_contenedor_id_contenedores_id_fk FOREIGN KEY (contenedor_id) REFERENCES public.contenedores(id) ON DELETE CASCADE;


--
-- Name: contenedor_lineas contenedor_lineas_producto_id_productos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contenedor_lineas
    ADD CONSTRAINT contenedor_lineas_producto_id_productos_id_fk FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: contenedores contenedores_entrada_id_entradas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contenedores
    ADD CONSTRAINT contenedores_entrada_id_entradas_id_fk FOREIGN KEY (entrada_id) REFERENCES public.entradas(id);


--
-- Name: contenedores contenedores_proveedor_id_proveedores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contenedores
    ADD CONSTRAINT contenedores_proveedor_id_proveedores_id_fk FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);


--
-- Name: contenedores contenedores_sitio_destino_id_ubicaciones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contenedores
    ADD CONSTRAINT contenedores_sitio_destino_id_ubicaciones_id_fk FOREIGN KEY (sitio_destino_id) REFERENCES public.ubicaciones(id);


--
-- Name: contenedores contenedores_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contenedores
    ADD CONSTRAINT contenedores_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: cuadre_fiscal_registros cuadre_fiscal_registros_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuadre_fiscal_registros
    ADD CONSTRAINT cuadre_fiscal_registros_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.usuarios(id);


--
-- Name: cuadre_fiscal_registros cuadre_fiscal_registros_resuelto_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuadre_fiscal_registros
    ADD CONSTRAINT cuadre_fiscal_registros_resuelto_por_id_fkey FOREIGN KEY (resuelto_por_id) REFERENCES public.usuarios(id);


--
-- Name: cuadre_fiscal_registros cuadre_fiscal_registros_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuadre_fiscal_registros
    ADD CONSTRAINT cuadre_fiscal_registros_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: entrada_folio entrada_folio_ubicacion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entrada_folio
    ADD CONSTRAINT entrada_folio_ubicacion_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: entradas entradas_proveedor_id_proveedores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entradas
    ADD CONSTRAINT entradas_proveedor_id_proveedores_id_fk FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);


--
-- Name: entradas entradas_ubicacion_id_ubicaciones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entradas
    ADD CONSTRAINT entradas_ubicacion_id_ubicaciones_id_fk FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: entradas entradas_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entradas
    ADD CONSTRAINT entradas_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: equipos equipos_actualizado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_actualizado_por_fkey FOREIGN KEY (actualizado_por) REFERENCES public.usuarios(id);


--
-- Name: equipos_checklist equipos_checklist_checked_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_checklist
    ADD CONSTRAINT equipos_checklist_checked_por_fkey FOREIGN KEY (checked_por) REFERENCES public.usuarios(id);


--
-- Name: equipos_checklist equipos_checklist_equipo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_checklist
    ADD CONSTRAINT equipos_checklist_equipo_id_fkey FOREIGN KEY (equipo_id) REFERENCES public.equipos(id) ON DELETE CASCADE;


--
-- Name: equipos equipos_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios(id);


--
-- Name: equipos equipos_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: evidencia_no_aplicada_e2 evidencia_no_aplicada_e2_abono_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidencia_no_aplicada_e2
    ADD CONSTRAINT evidencia_no_aplicada_e2_abono_id_fkey FOREIGN KEY (abono_id) REFERENCES public.finalizaciones_abono_e2(abono_id);


--
-- Name: evidencia_no_aplicada_e2 evidencia_no_aplicada_e2_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidencia_no_aplicada_e2
    ADD CONSTRAINT evidencia_no_aplicada_e2_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: evidencia_no_aplicada_e2 evidencia_no_aplicada_e2_cobro_productor_cobro_clave_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidencia_no_aplicada_e2
    ADD CONSTRAINT evidencia_no_aplicada_e2_cobro_productor_cobro_clave_fkey FOREIGN KEY (cobro_productor, cobro_clave) REFERENCES public.cobros_credito_pendientes_e1(operacion_productor, operacion_clave);


--
-- Name: existencias existencias_producto_id_productos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.existencias
    ADD CONSTRAINT existencias_producto_id_productos_id_fk FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: existencias existencias_ubicacion_id_ubicaciones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.existencias
    ADD CONSTRAINT existencias_ubicacion_id_ubicaciones_id_fk FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: finalizaciones_abono_e2 finalizaciones_abono_e2_abono_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finalizaciones_abono_e2
    ADD CONSTRAINT finalizaciones_abono_e2_abono_id_fkey FOREIGN KEY (abono_id) REFERENCES public.movimientos_credito(id);


--
-- Name: finalizaciones_abono_e2 finalizaciones_abono_e2_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finalizaciones_abono_e2
    ADD CONSTRAINT finalizaciones_abono_e2_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: fondo_arqueos fondo_arqueos_autor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fondo_arqueos
    ADD CONSTRAINT fondo_arqueos_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES public.usuarios(id);


--
-- Name: fondo_arqueos fondo_arqueos_fondo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fondo_arqueos
    ADD CONSTRAINT fondo_arqueos_fondo_id_fkey FOREIGN KEY (fondo_id) REFERENCES public.fondo_mariana(id);


--
-- Name: fondo_arqueos fondo_arqueos_version_saldo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fondo_arqueos
    ADD CONSTRAINT fondo_arqueos_version_saldo_fkey FOREIGN KEY (version_saldo) REFERENCES public.fondo_movimientos(id);


--
-- Name: fondo_mariana fondo_mariana_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fondo_mariana
    ADD CONSTRAINT fondo_mariana_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: fondo_movimientos fondo_movimientos_autor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fondo_movimientos
    ADD CONSTRAINT fondo_movimientos_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES public.usuarios(id);


--
-- Name: fondo_movimientos fondo_movimientos_fondo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fondo_movimientos
    ADD CONSTRAINT fondo_movimientos_fondo_id_fkey FOREIGN KEY (fondo_id) REFERENCES public.fondo_mariana(id);


--
-- Name: fondo_movimientos fondo_movimientos_original_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fondo_movimientos
    ADD CONSTRAINT fondo_movimientos_original_id_fkey FOREIGN KEY (original_id) REFERENCES public.fondo_movimientos(id);


--
-- Name: movimientos_credito movimientos_credito_autorizado_por_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_credito
    ADD CONSTRAINT movimientos_credito_autorizado_por_usuarios_id_fk FOREIGN KEY (autorizado_por) REFERENCES public.usuarios(id);


--
-- Name: movimientos_credito movimientos_credito_cliente_id_clientes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_credito
    ADD CONSTRAINT movimientos_credito_cliente_id_clientes_id_fk FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: movimientos_credito movimientos_credito_movimiento_origen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_credito
    ADD CONSTRAINT movimientos_credito_movimiento_origen_id_fkey FOREIGN KEY (movimiento_origen_id) REFERENCES public.movimientos_credito(id);


--
-- Name: movimientos_credito movimientos_credito_ticket_id_tickets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_credito
    ADD CONSTRAINT movimientos_credito_ticket_id_tickets_id_fk FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: movimientos_credito movimientos_credito_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_credito
    ADD CONSTRAINT movimientos_credito_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: movimientos_credito movimientos_nota_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_credito
    ADD CONSTRAINT movimientos_nota_fk_e1 FOREIGN KEY (nota_origen_id) REFERENCES public.tickets(id) NOT VALID;


--
-- Name: movimientos_credito movimientos_operacion_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_credito
    ADD CONSTRAINT movimientos_operacion_fk_e1 FOREIGN KEY (operacion_productor, operacion_clave) REFERENCES public.operaciones_credito_e1(productor, clave) MATCH FULL NOT VALID;


--
-- Name: movimientos movimientos_producto_id_productos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos
    ADD CONSTRAINT movimientos_producto_id_productos_id_fk FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: movimientos movimientos_revisado_por_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos
    ADD CONSTRAINT movimientos_revisado_por_usuarios_id_fk FOREIGN KEY (revisado_por) REFERENCES public.usuarios(id);


--
-- Name: movimientos movimientos_rollo_id_rollos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos
    ADD CONSTRAINT movimientos_rollo_id_rollos_id_fk FOREIGN KEY (rollo_id) REFERENCES public.rollos(id);


--
-- Name: movimientos movimientos_salida_id_salidas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos
    ADD CONSTRAINT movimientos_salida_id_salidas_id_fk FOREIGN KEY (salida_id) REFERENCES public.salidas(id);


--
-- Name: movimientos_credito movimientos_sesion_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_credito
    ADD CONSTRAINT movimientos_sesion_fk_e1 FOREIGN KEY (sesion_caja_id) REFERENCES public.sesiones_caja(id) NOT VALID;


--
-- Name: movimientos_credito movimientos_sitio_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_credito
    ADD CONSTRAINT movimientos_sitio_fk_e1 FOREIGN KEY (sitio_origen_id) REFERENCES public.ubicaciones(id) NOT VALID;


--
-- Name: movimientos movimientos_ubicacion_id_ubicaciones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos
    ADD CONSTRAINT movimientos_ubicacion_id_ubicaciones_id_fk FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: movimientos movimientos_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos
    ADD CONSTRAINT movimientos_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: notificaciones_credito notificaciones_credito_cajero_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificaciones_credito
    ADD CONSTRAINT notificaciones_credito_cajero_id_usuarios_id_fk FOREIGN KEY (cajero_id) REFERENCES public.usuarios(id);


--
-- Name: notificaciones_credito notificaciones_credito_cliente_id_clientes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificaciones_credito
    ADD CONSTRAINT notificaciones_credito_cliente_id_clientes_id_fk FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: notificaciones_credito notificaciones_credito_ticket_id_tickets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificaciones_credito
    ADD CONSTRAINT notificaciones_credito_ticket_id_tickets_id_fk FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: notificaciones_credito notificaciones_credito_tienda_id_ubicaciones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificaciones_credito
    ADD CONSTRAINT notificaciones_credito_tienda_id_ubicaciones_id_fk FOREIGN KEY (tienda_id) REFERENCES public.ubicaciones(id);


--
-- Name: notificaciones_sistema notificaciones_sistema_destinatario_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificaciones_sistema
    ADD CONSTRAINT notificaciones_sistema_destinatario_usuario_id_fkey FOREIGN KEY (destinatario_usuario_id) REFERENCES public.usuarios(id);


--
-- Name: operaciones_credito_e1 operaciones_actor_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operaciones_credito_e1
    ADD CONSTRAINT operaciones_actor_fk_e1 FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: pagos_proveedor pagos_proveedor_entrada_id_entradas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos_proveedor
    ADD CONSTRAINT pagos_proveedor_entrada_id_entradas_id_fk FOREIGN KEY (entrada_id) REFERENCES public.entradas(id);


--
-- Name: pagos_proveedor pagos_proveedor_movimiento_origen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos_proveedor
    ADD CONSTRAINT pagos_proveedor_movimiento_origen_id_fkey FOREIGN KEY (movimiento_origen_id) REFERENCES public.pagos_proveedor(id);


--
-- Name: pagos_proveedor pagos_proveedor_proveedor_id_proveedores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos_proveedor
    ADD CONSTRAINT pagos_proveedor_proveedor_id_proveedores_id_fk FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);


--
-- Name: pagos_proveedor pagos_proveedor_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos_proveedor
    ADD CONSTRAINT pagos_proveedor_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: permisos_rol permisos_rol_updated_por_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos_rol
    ADD CONSTRAINT permisos_rol_updated_por_usuarios_id_fk FOREIGN KEY (updated_por) REFERENCES public.usuarios(id);


--
-- Name: permisos_ubicacion permisos_ubicacion_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos_ubicacion
    ADD CONSTRAINT permisos_ubicacion_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: permisos_ubicacion permisos_ubicacion_updated_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos_ubicacion
    ADD CONSTRAINT permisos_ubicacion_updated_por_fkey FOREIGN KEY (updated_por) REFERENCES public.usuarios(id);


--
-- Name: permisos_usuario permisos_usuario_updated_por_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos_usuario
    ADD CONSTRAINT permisos_usuario_updated_por_usuarios_id_fk FOREIGN KEY (updated_por) REFERENCES public.usuarios(id);


--
-- Name: permisos_usuario permisos_usuario_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos_usuario
    ADD CONSTRAINT permisos_usuario_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: pisos pisos_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pisos
    ADD CONSTRAINT pisos_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: precio_historial precio_historial_producto_id_productos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.precio_historial
    ADD CONSTRAINT precio_historial_producto_id_productos_id_fk FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: precio_historial precio_historial_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.precio_historial
    ADD CONSTRAINT precio_historial_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: reimpresiones_etiqueta reimpresiones_etiqueta_autorizado_por_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reimpresiones_etiqueta
    ADD CONSTRAINT reimpresiones_etiqueta_autorizado_por_usuarios_id_fk FOREIGN KEY (autorizado_por) REFERENCES public.usuarios(id);


--
-- Name: reimpresiones_etiqueta reimpresiones_etiqueta_rollo_id_rollos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reimpresiones_etiqueta
    ADD CONSTRAINT reimpresiones_etiqueta_rollo_id_rollos_id_fk FOREIGN KEY (rollo_id) REFERENCES public.rollos(id);


--
-- Name: reimpresiones_etiqueta reimpresiones_etiqueta_sitio_id_ubicaciones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reimpresiones_etiqueta
    ADD CONSTRAINT reimpresiones_etiqueta_sitio_id_ubicaciones_id_fk FOREIGN KEY (sitio_id) REFERENCES public.ubicaciones(id);


--
-- Name: reimpresiones_etiqueta reimpresiones_etiqueta_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reimpresiones_etiqueta
    ADD CONSTRAINT reimpresiones_etiqueta_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: revisiones_etiqueta revisiones_etiqueta_reimpresion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.revisiones_etiqueta
    ADD CONSTRAINT revisiones_etiqueta_reimpresion_id_fkey FOREIGN KEY (reimpresion_id) REFERENCES public.reimpresiones_etiqueta(id);


--
-- Name: revisiones_etiqueta revisiones_etiqueta_rollo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.revisiones_etiqueta
    ADD CONSTRAINT revisiones_etiqueta_rollo_id_fkey FOREIGN KEY (rollo_id) REFERENCES public.rollos(id);


--
-- Name: revisiones_etiqueta revisiones_etiqueta_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.revisiones_etiqueta
    ADD CONSTRAINT revisiones_etiqueta_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: rollos rollos_piso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rollos
    ADD CONSTRAINT rollos_piso_id_fkey FOREIGN KEY (piso_id) REFERENCES public.pisos(id);


--
-- Name: rollos rollos_producto_id_productos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rollos
    ADD CONSTRAINT rollos_producto_id_productos_id_fk FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: rollos rollos_proveedor_id_proveedores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rollos
    ADD CONSTRAINT rollos_proveedor_id_proveedores_id_fk FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);


--
-- Name: rollos rollos_ubicacion_id_ubicaciones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rollos
    ADD CONSTRAINT rollos_ubicacion_id_ubicaciones_id_fk FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: salida_folio salida_folio_ubicacion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salida_folio
    ADD CONSTRAINT salida_folio_ubicacion_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: salida_lineas salida_lineas_producto_id_productos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salida_lineas
    ADD CONSTRAINT salida_lineas_producto_id_productos_id_fk FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: salida_lineas salida_lineas_salida_id_salidas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salida_lineas
    ADD CONSTRAINT salida_lineas_salida_id_salidas_id_fk FOREIGN KEY (salida_id) REFERENCES public.salidas(id);


--
-- Name: salida_rollos salida_rollos_linea_id_salida_lineas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salida_rollos
    ADD CONSTRAINT salida_rollos_linea_id_salida_lineas_id_fk FOREIGN KEY (linea_id) REFERENCES public.salida_lineas(id);


--
-- Name: salida_rollos salida_rollos_rollo_id_rollos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salida_rollos
    ADD CONSTRAINT salida_rollos_rollo_id_rollos_id_fk FOREIGN KEY (rollo_id) REFERENCES public.rollos(id);


--
-- Name: salida_rollos salida_rollos_salida_id_salidas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salida_rollos
    ADD CONSTRAINT salida_rollos_salida_id_salidas_id_fk FOREIGN KEY (salida_id) REFERENCES public.salidas(id);


--
-- Name: salidas salidas_autorizado_por_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_autorizado_por_id_usuarios_id_fk FOREIGN KEY (autorizado_por_id) REFERENCES public.usuarios(id);


--
-- Name: salidas salidas_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: salidas salidas_destino_id_ubicaciones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_destino_id_ubicaciones_id_fk FOREIGN KEY (destino_id) REFERENCES public.ubicaciones(id);


--
-- Name: salidas_dinero_caja salidas_dinero_caja_creado_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salidas_dinero_caja
    ADD CONSTRAINT salidas_dinero_caja_creado_por_id_fkey FOREIGN KEY (creado_por_id) REFERENCES public.usuarios(id);


--
-- Name: salidas_dinero_caja salidas_dinero_caja_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salidas_dinero_caja
    ADD CONSTRAINT salidas_dinero_caja_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);


--
-- Name: salidas_dinero_caja salidas_dinero_caja_sesion_caja_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salidas_dinero_caja
    ADD CONSTRAINT salidas_dinero_caja_sesion_caja_id_fkey FOREIGN KEY (sesion_caja_id) REFERENCES public.sesiones_caja(id);


--
-- Name: salidas salidas_origen_id_ubicaciones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_origen_id_ubicaciones_id_fk FOREIGN KEY (origen_id) REFERENCES public.ubicaciones(id);


--
-- Name: salidas salidas_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: salidas salidas_usuario_acepta_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_usuario_acepta_id_usuarios_id_fk FOREIGN KEY (usuario_acepta_id) REFERENCES public.usuarios(id);


--
-- Name: salidas salidas_usuario_cancela_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_usuario_cancela_id_usuarios_id_fk FOREIGN KEY (usuario_cancela_id) REFERENCES public.usuarios(id);


--
-- Name: salidas salidas_usuario_cierra_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_usuario_cierra_id_usuarios_id_fk FOREIGN KEY (usuario_cierra_id) REFERENCES public.usuarios(id);


--
-- Name: salidas salidas_usuario_entrega_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_usuario_entrega_id_fkey FOREIGN KEY (usuario_entrega_id) REFERENCES public.usuarios(id);


--
-- Name: salidas salidas_usuario_envia_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_usuario_envia_id_usuarios_id_fk FOREIGN KEY (usuario_envia_id) REFERENCES public.usuarios(id);


--
-- Name: salidas salidas_usuario_prepara_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_usuario_prepara_id_usuarios_id_fk FOREIGN KEY (usuario_prepara_id) REFERENCES public.usuarios(id);


--
-- Name: salidas salidas_usuario_recibe_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_usuario_recibe_id_usuarios_id_fk FOREIGN KEY (usuario_recibe_id) REFERENCES public.usuarios(id);


--
-- Name: salidas salidas_usuario_solicita_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_usuario_solicita_id_usuarios_id_fk FOREIGN KEY (usuario_solicita_id) REFERENCES public.usuarios(id);


--
-- Name: sesiones_caja sesiones_caja_cerrada_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sesiones_caja
    ADD CONSTRAINT sesiones_caja_cerrada_por_id_fkey FOREIGN KEY (cerrada_por_id) REFERENCES public.usuarios(id);


--
-- Name: sesiones_caja_dias sesiones_caja_dias_sesion_caja_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sesiones_caja_dias
    ADD CONSTRAINT sesiones_caja_dias_sesion_caja_id_fkey FOREIGN KEY (sesion_caja_id) REFERENCES public.sesiones_caja(id);


--
-- Name: sesiones_caja_dias sesiones_caja_dias_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sesiones_caja_dias
    ADD CONSTRAINT sesiones_caja_dias_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: sesiones_caja sesiones_caja_ubicacion_id_ubicaciones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sesiones_caja
    ADD CONSTRAINT sesiones_caja_ubicacion_id_ubicaciones_id_fk FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: sesiones_caja sesiones_caja_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sesiones_caja
    ADD CONSTRAINT sesiones_caja_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: sesiones sesiones_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sesiones
    ADD CONSTRAINT sesiones_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: solicitudes_pago_dirigido solicitudes_pago_dirigido_autorizador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitudes_pago_dirigido
    ADD CONSTRAINT solicitudes_pago_dirigido_autorizador_id_fkey FOREIGN KEY (autorizador_id) REFERENCES public.usuarios(id);


--
-- Name: solicitudes_pago_dirigido solicitudes_pago_dirigido_solicitante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitudes_pago_dirigido
    ADD CONSTRAINT solicitudes_pago_dirigido_solicitante_id_fkey FOREIGN KEY (solicitante_id) REFERENCES public.usuarios(id);


--
-- Name: solicitudes_pago_dirigido solicitudes_pago_dirigido_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitudes_pago_dirigido
    ADD CONSTRAINT solicitudes_pago_dirigido_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: stock_minimo_episodios stock_minimo_episodios_movimiento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_minimo_episodios
    ADD CONSTRAINT stock_minimo_episodios_movimiento_id_fkey FOREIGN KEY (movimiento_id) REFERENCES public.movimientos(id);


--
-- Name: stock_minimo_episodios stock_minimo_episodios_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_minimo_episodios
    ADD CONSTRAINT stock_minimo_episodios_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: stock_minimo_episodios stock_minimo_episodios_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_minimo_episodios
    ADD CONSTRAINT stock_minimo_episodios_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: stock_minimo_sitios stock_minimo_sitios_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_minimo_sitios
    ADD CONSTRAINT stock_minimo_sitios_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: stock_minimo_sitios stock_minimo_sitios_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_minimo_sitios
    ADD CONSTRAINT stock_minimo_sitios_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.usuarios(id);


--
-- Name: stock_minimos stock_minimos_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_minimos
    ADD CONSTRAINT stock_minimos_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: stock_minimos stock_minimos_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_minimos
    ADD CONSTRAINT stock_minimos_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: stock_minimos stock_minimos_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_minimos
    ADD CONSTRAINT stock_minimos_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.usuarios(id);


--
-- Name: ticket_linea_consumos ticket_linea_consumos_entrada_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_linea_consumos
    ADD CONSTRAINT ticket_linea_consumos_entrada_id_fkey FOREIGN KEY (entrada_id) REFERENCES public.entradas(id);


--
-- Name: ticket_linea_consumos ticket_linea_consumos_movimiento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_linea_consumos
    ADD CONSTRAINT ticket_linea_consumos_movimiento_id_fkey FOREIGN KEY (movimiento_id) REFERENCES public.movimientos(id);


--
-- Name: ticket_linea_consumos ticket_linea_consumos_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_linea_consumos
    ADD CONSTRAINT ticket_linea_consumos_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);


--
-- Name: ticket_linea_consumos ticket_linea_consumos_reversa_de_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_linea_consumos
    ADD CONSTRAINT ticket_linea_consumos_reversa_de_id_fkey FOREIGN KEY (reversa_de_id) REFERENCES public.ticket_linea_consumos(id);


--
-- Name: ticket_linea_consumos ticket_linea_consumos_rollo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_linea_consumos
    ADD CONSTRAINT ticket_linea_consumos_rollo_id_fkey FOREIGN KEY (rollo_id) REFERENCES public.rollos(id);


--
-- Name: ticket_linea_consumos ticket_linea_consumos_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_linea_consumos
    ADD CONSTRAINT ticket_linea_consumos_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: ticket_linea_consumos ticket_linea_consumos_ticket_linea_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_linea_consumos
    ADD CONSTRAINT ticket_linea_consumos_ticket_linea_id_fkey FOREIGN KEY (ticket_linea_id) REFERENCES public.ticket_lineas(id);


--
-- Name: ticket_lineas ticket_lineas_producto_id_productos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_lineas
    ADD CONSTRAINT ticket_lineas_producto_id_productos_id_fk FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: ticket_lineas ticket_lineas_rollo_id_rollos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_lineas
    ADD CONSTRAINT ticket_lineas_rollo_id_rollos_id_fk FOREIGN KEY (rollo_id) REFERENCES public.rollos(id);


--
-- Name: ticket_lineas ticket_lineas_ticket_id_tickets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_lineas
    ADD CONSTRAINT ticket_lineas_ticket_id_tickets_id_fk FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: ticket_pagos ticket_pagos_ticket_id_tickets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_pagos
    ADD CONSTRAINT ticket_pagos_ticket_id_tickets_id_fk FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: ticket_pagos ticket_pagos_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_pagos
    ADD CONSTRAINT ticket_pagos_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: tickets tickets_autorizado_por_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_autorizado_por_usuarios_id_fk FOREIGN KEY (autorizado_por) REFERENCES public.usuarios(id);


--
-- Name: tickets tickets_cancelado_por_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_cancelado_por_usuarios_id_fk FOREIGN KEY (cancelado_por) REFERENCES public.usuarios(id);


--
-- Name: tickets tickets_cliente_id_clientes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_cliente_id_clientes_id_fk FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: tickets tickets_sesion_caja_id_sesiones_caja_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_sesion_caja_id_sesiones_caja_id_fk FOREIGN KEY (sesion_caja_id) REFERENCES public.sesiones_caja(id);


--
-- Name: tickets tickets_ubicacion_id_ubicaciones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_ubicacion_id_ubicaciones_id_fk FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: tickets tickets_usuario_caja_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_usuario_caja_id_usuarios_id_fk FOREIGN KEY (usuario_caja_id) REFERENCES public.usuarios(id);


--
-- Name: tickets tickets_usuario_terminal_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_usuario_terminal_id_usuarios_id_fk FOREIGN KEY (usuario_terminal_id) REFERENCES public.usuarios(id);


--
-- Name: usuarios usuarios_ubicacion_id_ubicaciones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_ubicacion_id_ubicaciones_id_fk FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: viaje_folio viaje_folio_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viaje_folio
    ADD CONSTRAINT viaje_folio_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: viaje_salidas viaje_salidas_salida_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viaje_salidas
    ADD CONSTRAINT viaje_salidas_salida_id_fkey FOREIGN KEY (salida_id) REFERENCES public.salidas(id);


--
-- Name: viaje_salidas viaje_salidas_viaje_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viaje_salidas
    ADD CONSTRAINT viaje_salidas_viaje_id_fkey FOREIGN KEY (viaje_id) REFERENCES public.viajes(id);


--
-- Name: viaje_tickets viaje_tickets_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viaje_tickets
    ADD CONSTRAINT viaje_tickets_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: viaje_tickets viaje_tickets_viaje_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viaje_tickets
    ADD CONSTRAINT viaje_tickets_viaje_id_fkey FOREIGN KEY (viaje_id) REFERENCES public.viajes(id);


--
-- Name: viajes viajes_camioneta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viajes
    ADD CONSTRAINT viajes_camioneta_id_fkey FOREIGN KEY (camioneta_id) REFERENCES public.camionetas(id);


--
-- Name: viajes viajes_chofer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viajes
    ADD CONSTRAINT viajes_chofer_id_fkey FOREIGN KEY (chofer_id) REFERENCES public.choferes(id);


--
-- Name: viajes viajes_creado_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viajes
    ADD CONSTRAINT viajes_creado_por_id_fkey FOREIGN KEY (creado_por_id) REFERENCES public.usuarios(id);


--
-- Name: viajes viajes_origen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viajes
    ADD CONSTRAINT viajes_origen_id_fkey FOREIGN KEY (origen_id) REFERENCES public.ubicaciones(id);


--
-- PostgreSQL database dump complete
--

\unrestrict TpGW4C4muAHKD6A6SjCrZcpbkFszpZ2eOUdoxu5h65CreAddLvTBKyHf3UzGAEy

