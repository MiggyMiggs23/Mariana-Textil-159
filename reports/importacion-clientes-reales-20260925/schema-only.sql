--
-- PostgreSQL database dump
--

\restrict nfP2FyBya7lfwiF7nK0UdjTzpL0ngQ9lS81k2aGaJl6nkAsK89uSrQIkRgnmzgs

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
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: alcance_consulta; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.alcance_consulta AS ENUM (
    'PROPIA',
    'TODAS'
);


--
-- Name: estado_rollo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_rollo AS ENUM (
    'PROGRAMADO',
    'DISPONIBLE',
    'EN_TRANSITO',
    'MOSTRADOR',
    'VENDIDO',
    'BAJA'
);


--
-- Name: estado_salida; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_salida AS ENUM (
    'ARMANDO',
    'EN_TRANSITO',
    'RECIBIDA',
    'ENTREGADA',
    'CANCELADA'
);


--
-- Name: estado_sesion_caja; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_sesion_caja AS ENUM (
    'ABIERTA',
    'CERRADA'
);


--
-- Name: estado_solicitud_pago_dirigido; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_solicitud_pago_dirigido AS ENUM (
    'PENDIENTE',
    'APROBADA',
    'RECHAZADA'
);


--
-- Name: estado_ticket; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_ticket AS ENUM (
    'VENDIDO',
    'CANCELADO'
);


--
-- Name: forma_pago_cuenta; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.forma_pago_cuenta AS ENUM (
    'EFECTIVO',
    'TRANSFERENCIA',
    'FACTURADO',
    'CHEQUE',
    'OTRO',
    'CREDITO'
);


--
-- Name: forma_pago_proveedor; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.forma_pago_proveedor AS ENUM (
    'EFECTIVO',
    'TRANSFERENCIA',
    'CHEQUE',
    'OTRO',
    'FACTURADO'
);


--
-- Name: forma_pago_ticket; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.forma_pago_ticket AS ENUM (
    'EFECTIVO',
    'TRANSFERENCIA',
    'CREDITO',
    'FACTURADO'
);


--
-- Name: moneda; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.moneda AS ENUM (
    'MXN',
    'USD'
);


--
-- Name: motivo_salida_extraordinaria; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.motivo_salida_extraordinaria AS ENUM (
    'MERMA',
    'ROBO',
    'MUESTRA'
);


--
-- Name: naturaleza_credito_e1; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.naturaleza_credito_e1 AS ENUM (
    'INGRESO_FISICO',
    'DEVOLUCION_FISICA',
    'CORRECCION_CONTABLE',
    'OPERACION_CREDITO_SIN_DINERO'
);


--
-- Name: precio_modo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.precio_modo AS ENUM (
    'ROLLO',
    'MAYOREO',
    'MENUDEO'
);


--
-- Name: rol_usuario; Type: TYPE; Schema: public; Owner: -
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


--
-- Name: tipo_movimiento; Type: TYPE; Schema: public; Owner: -
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


--
-- Name: tipo_movimiento_credito; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_movimiento_credito AS ENUM (
    'VENTA_CREDITO',
    'ABONO',
    'REVERSO',
    'AJUSTE'
);


--
-- Name: tipo_pago_proveedor; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_pago_proveedor AS ENUM (
    'COMPRA',
    'PAGO',
    'AJUSTE',
    'REVERSO'
);


--
-- Name: tipo_proveedor; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_proveedor AS ENUM (
    'NACIONAL',
    'IMPORTACION'
);


--
-- Name: tipo_solicitud_pago_dirigido; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_solicitud_pago_dirigido AS ENUM (
    'CLIENTE',
    'PROVEEDOR'
);


--
-- Name: tipo_ticket; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_ticket AS ENUM (
    'NORMAL',
    'METREADO'
);


--
-- Name: tipo_ubicacion; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_ubicacion AS ENUM (
    'TIENDA',
    'BODEGA',
    'TRANSITO',
    'EXTERNO'
);


--
-- Name: unidad_producto; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.unidad_producto AS ENUM (
    'METRO',
    'KILO',
    'BOLSA',
    'PIEZA'
);


--
-- Name: bloquear_mutacion_reimpresion_etiqueta(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: bloquear_mutacion_revision_etiqueta(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bloquear_mutacion_revision_etiqueta() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        RAISE EXCEPTION 'revisiones_etiqueta es un historial append-only';
      END;
      $$;


--
-- Name: caja_salidas_e4_expense_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.caja_salidas_e4_expense_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM caja_salidas_e4 WHERE salida_id = OLD.id) THEN
    RAISE EXCEPTION 'E4: el egreso físico no se modifica ni se elimina por revisión';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;


--
-- Name: caja_salidas_e4_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.caja_salidas_e4_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE expense record; next_event jsonb; v integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'E4: no se elimina evidencia de egreso';
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT s.*, c.ubicacion_id, c.estado AS sesion_estado, u.tipo AS sitio_tipo, u.activa AS sitio_activo
      INTO STRICT expense FROM salidas_dinero_caja s
      JOIN sesiones_caja c ON c.id = s.sesion_caja_id
      JOIN ubicaciones u ON u.id = c.ubicacion_id WHERE s.id = NEW.salida_id;
    IF expense.sesion_estado <> 'ABIERTA' OR expense.sitio_tipo <> 'TIENDA' OR NOT expense.sitio_activo THEN
      RAISE EXCEPTION 'E4: sesión abierta de tienda requerida';
    END IF;
    IF (NEW.revision->>'version')::integer <> 0
      OR jsonb_array_length(NEW.revision->'historial') <> 0 THEN
      RAISE EXCEPTION 'E4: revisión inicial inválida';
    END IF;
    IF NEW.revision->>'tipo' = 'EXTRAORDINARIA' THEN
      IF expense.cuenta_origen <> 'CAJA_FISICA' OR expense.proveedor_id IS NOT NULL
        OR NEW.revision->>'estado' <> 'PENDIENTE' THEN
        RAISE EXCEPTION 'E4: extraordinaria exige caja física sin proveedor';
      END IF;
    ELSIF NEW.revision->>'tipo' = 'PROVEEDOR' THEN
      -- MARIANA_LOCATION_ID = 1, también en lib/pos.ts y e4-cash-out.ts.
      IF expense.ubicacion_id <> 1 OR expense.proveedor_id IS NULL
        OR NOT EXISTS (SELECT 1 FROM proveedores WHERE id = expense.proveedor_id AND activo) THEN
        RAISE EXCEPTION 'E4: proveedor activo exclusivamente en Mariana';
      END IF;
    END IF;
  ELSE
    v := (OLD.revision->>'version')::integer;
    IF NEW.salida_id <> OLD.salida_id
      OR NEW.revision->>'tipo' IS DISTINCT FROM OLD.revision->>'tipo'
      OR NEW.revision->>'claveOperacion' IS DISTINCT FROM OLD.revision->>'claveOperacion'
      OR OLD.revision->>'tipo' <> 'EXTRAORDINARIA'
      OR (NEW.revision->>'version')::integer <> v + 1
      OR (NEW.revision->'historial') - v IS DISTINCT FROM OLD.revision->'historial' THEN
      RAISE EXCEPTION 'E4: identidad/historial de egreso inmutable';
    END IF;
    next_event := NEW.revision->'historial'->v;
    IF (next_event->>'version')::integer IS DISTINCT FROM v + 1 THEN
      RAISE EXCEPTION 'E4: versión de evento inválida';
    END IF;
    IF NOT (
      (OLD.revision->>'estado' IN ('PENDIENTE','RESPONDIDA')
        AND ((next_event->>'accion' = 'ACEPTAR' AND NEW.revision->>'estado' = 'ACEPTADA')
          OR (next_event->>'accion' = 'RECLAMAR' AND NEW.revision->>'estado' = 'RECLAMADA')))
      OR (OLD.revision->>'estado' = 'RECLAMADA' AND next_event->>'accion' = 'RESPONDER'
        AND NEW.revision->>'estado' = 'RESPONDIDA')
    ) IS TRUE THEN
      RAISE EXCEPTION 'E4: transición inválida';
    END IF;
    IF next_event->>'accion' IN ('RECLAMAR','RESPONDER')
      AND NOT (length(trim(next_event->>'explicacion')) BETWEEN 1 AND 2000) IS TRUE THEN
      RAISE EXCEPTION 'E4: explicación obligatoria';
    END IF;
  END IF;
  RETURN NEW;
END $$;


--
-- Name: caja_salidas_e4_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.caja_salidas_e4_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'E4: operación idempotente inmutable';
END $$;


--
-- Name: credit_fifo_aging(integer); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: e11_actor(integer, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e11_actor(actor integer, wanted text, ver integer DEFAULT NULL::integer) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE u record; p record;
BEGIN
  SELECT rol,activo INTO u FROM public.usuarios WHERE id=actor FOR SHARE;
  IF NOT FOUND OR NOT u.activo THEN RAISE EXCEPTION 'E11: actor no vigente'; END IF;
  IF wanted='ADMIN' THEN
    IF u.rol::text<>'ADMIN' THEN RAISE EXCEPTION 'E11: ADMIN real requerido'; END IF;
  ELSE
    SELECT perfil,version INTO p FROM public.e11_perfiles WHERE usuario_id=actor FOR SHARE;
    IF u.rol::text<>'CONTADOR' OR coalesce(p.perfil,'F')<>wanted
      OR (ver IS NOT NULL AND coalesce(p.version,0)<>ver)
    THEN RAISE EXCEPTION 'E11: perfil/version vigente requerido'; END IF;
  END IF;
END $$;


--
-- Name: e11_before(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e11_before() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE parent_xid xid8; exclusive_lock boolean;
BEGIN
  exclusive_lock:=TG_TABLE_NAME IN ('e11_perfiles','e11_perfil_eventos');
  IF exclusive_lock THEN
    IF NOT pg_try_advisory_xact_lock(hashtextextended('E11:security',0))
    THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='E11: seguridad ocupada, abortar unidad'; END IF;
  ELSE
    IF NOT pg_try_advisory_xact_lock_shared(hashtextextended('E11:security',0))
    THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='E11: seguridad ocupada, abortar unidad'; END IF;
  END IF;
  NEW.birth_xid:=pg_current_xact_id();
  IF TG_TABLE_NAME='e11_perfiles' THEN
    PERFORM public.e11_actor(NEW.actor_id,'ADMIN');
    IF TG_OP='UPDATE' THEN
      IF NEW.usuario_id<>OLD.usuario_id OR NEW.version<>OLD.version+1
      THEN RAISE EXCEPTION 'E11: CAS perfil/version'; END IF;
    ELSIF NEW.version<>1 AND NOT EXISTS (
      SELECT 1 FROM public.e11_perfiles WHERE usuario_id=NEW.usuario_id)
    THEN RAISE EXCEPTION 'E11: versión inicial debe ser 1'; END IF;
    -- BEFORE INSERT también corre en UPSERT sobre fila existente: UPDATE
    -- posterior impone old+1. No exigir perfil/rol final antes de UPDATE usuarios.
  ELSIF TG_TABLE_NAME='e11_perfil_eventos' THEN
    PERFORM public.e11_actor(NEW.actor_id,'ADMIN');
    IF NEW.datos->>'posterior'='A' AND NOT EXISTS(SELECT 1 FROM public.usuarios u
      WHERE u.id=NEW.usuario_id AND u.activo AND u.rol::text='CONTADOR')
    THEN RAISE EXCEPTION 'E11: A sólo para CONTADOR activo al emitir'; END IF;
  ELSIF TG_TABLE_NAME IN ('e11_conciliaciones','e11_decisiones') THEN
    PERFORM public.e11_actor(NEW.actor_id,'F',NEW.perfil_version);
    IF current_setting('transaction_isolation')<>'serializable'
    THEN RAISE EXCEPTION 'E11: snapshot/decisión requiere SERIALIZABLE'; END IF;
  ELSIF TG_TABLE_NAME='e11_conciliacion_ventas' THEN
    SELECT birth_xid INTO parent_xid FROM public.e11_conciliaciones WHERE id=NEW.conciliacion_id;
    IF parent_xid IS DISTINCT FROM pg_current_xact_id()
    THEN RAISE EXCEPTION 'E11: no adjuntar ventas a snapshot histórico'; END IF;
  ELSIF TG_TABLE_NAME='e11_avisos' THEN
    SELECT birth_xid INTO parent_xid FROM public.e11_decisiones WHERE id=NEW.decision_id;
    IF parent_xid IS DISTINCT FROM pg_current_xact_id()
    THEN RAISE EXCEPTION 'E11: aviso debe nacer con decisión'; END IF;
  ELSIF TG_TABLE_NAME='e11_operaciones' THEN
    IF NEW.estado='CONFIRMADA' THEN
      PERFORM public.e11_actor(NEW.actor_id,CASE NEW.operacion WHEN 'PERFIL' THEN 'ADMIN'
        WHEN 'PREPARACION' THEN 'A' ELSE 'F' END);
    END IF;
  ELSIF TG_TABLE_NAME='e11_resoluciones' THEN
    PERFORM public.e11_actor(NEW.admin_id,'ADMIN');
  END IF;
  RETURN NEW;
END $$;


--
-- Name: e11_canonical(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e11_canonical(j jsonb) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE result text; number_value numeric;
BEGIN
  IF jsonb_typeof(j)='object' THEN
    SELECT '{'||coalesce(string_agg(to_jsonb(key)::text||':'||public.e11_canonical(value),','
      ORDER BY key COLLATE "C"),'')||'}' INTO result FROM jsonb_each(j);
  ELSIF jsonb_typeof(j)='array' THEN
    SELECT '['||coalesce(string_agg(public.e11_canonical(value),',' ORDER BY n),'')||']'
      INTO result FROM jsonb_array_elements(j) WITH ORDINALITY a(value,n);
  ELSIF jsonb_typeof(j)='number' THEN
    number_value:=(j::text)::numeric;
    IF number_value<>trunc(number_value) OR number_value< -2147483648 OR number_value>2147483647
    THEN RAISE EXCEPTION 'E11: hash sólo admite números enteros contractuales int32'; END IF;
    result:=(number_value::integer)::text;
  ELSE result:=j::text;
  END IF;
  RETURN result;
END $$;


--
-- Name: e11_closed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e11_closed() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN RAISE EXCEPTION 'E11_DISABLED: construcción OFF, escritura nueva cerrada'; END $$;


--
-- Name: e11_e5_a_validate(jsonb, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e11_e5_a_validate(j jsonb, at_insert boolean) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $_$
DECLARE body jsonb; proposal jsonb; previous jsonb; r record; part jsonb; note jsonb;
  v integer; total numeric:=0; key_value uuid; actor integer; source_id uuid;
BEGIN
  body:=(j->>'content')::jsonb; key_value:=(j->>'clave')::uuid;
  actor:=(j->>'actor_id')::integer; source_id:=(j->>'cobro_id')::uuid;
  proposal:=j->'response'->'propuestas'->-1;
  IF j->>'accion' IS DISTINCT FROM 'PROPONER'
    OR j->>'content' IS DISTINCT FROM public.e11_canonical(body)
    OR NOT public.e11_keys(body,ARRAY['action','id','input'])
    OR NOT public.e11_keys(body->'input',ARRAY['claveOperacion','revisionEsperada','versionContexto','asignaciones','evidencia'])
    OR body->>'action' IS DISTINCT FROM 'PROPONER' OR body->>'id' IS DISTINCT FROM source_id::text
    OR body#>>'{input,claveOperacion}' IS DISTINCT FROM key_value::text
    OR body#>>'{input,evidencia,descripcion}' IS DISTINCT FROM
      'Preparación E11 por perfil A explícito; no aplicación.'
    OR NOT public.e11_keys(body#>'{input,evidencia}',ARRAY['descripcion','referencias'])
    OR jsonb_typeof(body#>'{input,evidencia,referencias}') IS DISTINCT FROM 'array'
    OR jsonb_array_length(body#>'{input,evidencia,referencias}')<>1
    OR coalesce(body#>>'{input,evidencia,referencias,0}','') !~
      '^E11:[0-9a-fA-F-]{36}:perfil:[1-9][0-9]*$'
  THEN RAISE EXCEPTION 'E11/E5: sólo cuerpo real de preparación A, sin favor ni facultades dinero'; END IF;
  IF split_part(body#>>'{input,evidencia,referencias,0}',':',2)::uuid IS DISTINCT FROM key_value
  THEN RAISE EXCEPTION 'E11/E5: referencia debe nombrar la misma intención'; END IF;
  v:=split_part(body#>>'{input,evidencia,referencias,0}',':',4)::integer;
  SELECT * INTO r FROM public.e5_recepciones WHERE id=source_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'E11/E5: recepción real requerida'; END IF;
  SELECT response INTO previous FROM public.e5_operaciones
    WHERE cobro_id=source_id AND revision=(j->>'revision')::integer-1;
  IF previous IS NULL OR (body#>>'{input,revisionEsperada}')::integer IS DISTINCT FROM
      (j->>'revision')::integer-1
    OR j->'response'->>'id' IS DISTINCT FROM source_id::text
    OR (j->'response'->>'clienteId')::integer IS DISTINCT FROM r.cliente_id
    OR (j->'response'->>'ubicacionId')::integer IS DISTINCT FROM r.ubicacion_id
    OR (j->'response'->>'importePendiente')::numeric<=0
    OR j->'response'->>'estado' NOT IN ('PENDIENTE','PARCIAL')
    OR ((j->'response')-ARRAY['revision','propuestas','propuestaVigenteId'])
      IS DISTINCT FROM (previous-ARRAY['revision','propuestas','propuestaVigenteId'])
    OR jsonb_array_length(j->'response'->'propuestas')<>jsonb_array_length(previous->'propuestas')+1
    OR ((j->'response'->'propuestas')-(jsonb_array_length(j->'response'->'propuestas')-1))
      IS DISTINCT FROM previous->'propuestas'
    OR j->'response'->>'propuestaVigenteId' IS DISTINCT FROM proposal->>'id'
    OR (proposal#>>'{actor,id}')::integer IS DISTINCT FROM actor
    OR (proposal->>'importeFavorPropuesto')::numeric IS DISTINCT FROM 0::numeric
    OR proposal->'asignaciones' IS DISTINCT FROM body#>'{input,asignaciones}'
    OR proposal->'evidencia' IS DISTINCT FROM body#>'{input,evidencia}'
    OR jsonb_typeof(proposal->'asignaciones') IS DISTINCT FROM 'array'
    OR jsonb_array_length(proposal->'asignaciones')=0
    OR jsonb_typeof(proposal->'notas') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'E11/E5: propuesta/cobro/cliente/CAS/conservación incompatibles'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(proposal->'asignaciones'))<>
    (SELECT count(DISTINCT value->>'notaId') FROM jsonb_array_elements(proposal->'asignaciones'))
    OR (SELECT count(*) FROM jsonb_array_elements(proposal->'asignaciones'))<>
    (SELECT count(DISTINCT value->>'movimientoVentaId') FROM jsonb_array_elements(proposal->'asignaciones'))
  THEN RAISE EXCEPTION 'E11/E5: nota o movimiento duplicado'; END IF;
  FOR part IN SELECT value FROM jsonb_array_elements(proposal->'asignaciones') LOOP
    IF NOT public.e11_keys(part,ARRAY['notaId','movimientoVentaId','importe'])
      OR coalesce(part->>'importe','') !~ '^(0|[1-9][0-9]*)\.[0-9]{2}$'
      OR (part->>'importe')::numeric<=0
    THEN RAISE EXCEPTION 'E11/E5: asignación positiva exacta requerida'; END IF;
    SELECT value INTO note FROM jsonb_array_elements(proposal->'notas')
      WHERE value->>'movimientoVentaId'=part->>'movimientoVentaId'
        AND value->>'notaId'=part->>'notaId';
    IF note IS NULL OR coalesce(note->>'saldoPendiente','') !~ '^(0|[1-9][0-9]*)\.[0-9]{2}$'
      OR (part->>'importe')::numeric>(note->>'saldoPendiente')::numeric
    THEN RAISE EXCEPTION 'E11/E5: asignación excede contexto canónico congelado'; END IF;
    total:=total+(part->>'importe')::numeric;
    IF (j->>'birth_xid')::xid8=pg_current_xact_id() AND NOT EXISTS (SELECT 1 FROM public.movimientos_credito m
      JOIN public.tickets t ON t.id=m.ticket_id
      WHERE m.id=(part->>'movimientoVentaId')::integer AND m.ticket_id=(part->>'notaId')::integer
        AND m.cliente_id=r.cliente_id AND m.tipo::text='VENTA_CREDITO' AND NOT m.es_incobrable
        AND t.cliente_id=r.cliente_id AND t.documento_tipo='NOTA'
        AND t.estado='VENDIDO' AND t.autorizacion_estado='AUTORIZADA')
    THEN RAISE EXCEPTION 'E11/E5: destino financiero ajeno/no autorizado'; END IF;
  END LOOP;
  IF total>(j->'response'->>'importePendiente')::numeric
  THEN RAISE EXCEPTION 'E11/E5: propuesta excede retenido'; END IF;
  IF at_insert THEN
    PERFORM public.e11_replay_lock(actor,'PREPARACION',key_value);
    IF (j->>'birth_xid')::xid8 IS DISTINCT FROM pg_current_xact_id()
    THEN RAISE EXCEPTION 'E11/E5: operación requiere INSERT propio'; END IF;
    IF NOT pg_try_advisory_xact_lock_shared(hashtextextended('E11:security',0))
    THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='E11/E5: seguridad ocupada, abortar unidad'; END IF;
    PERFORM public.e11_actor(actor,'A',v);
    IF current_setting('transaction_isolation')<>'serializable'
    THEN RAISE EXCEPTION 'E11/E5: preparación requiere SERIALIZABLE'; END IF;
  END IF;
  IF (j->>'birth_xid')::xid8=pg_current_xact_id() THEN
    IF NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=r.cliente_id AND activo AND NOT es_sistema)
      OR NOT EXISTS(SELECT 1 FROM public.ubicaciones WHERE id=r.ubicacion_id AND activa AND tipo='TIENDA')
      OR NOT EXISTS(SELECT 1 FROM public.e5_cobros WHERE id=source_id AND detail=j->'response')
    THEN RAISE EXCEPTION 'E11/E5: alcance financiero/aggregate real requerido'; END IF;
    -- La revalidación de saldos/versionContexto la hace el proyector canónico
    -- E5 bajo CUSTOMER_CREDIT; no reconstruir FIFO con evidencia histórica.
    -- Esta unidad de preparación no puede insertar ledger antes NI después
    -- del sello IMMEDIATE para ese cliente; reencola también movimientos.
    IF EXISTS(SELECT 1 FROM public.movimientos_credito m JOIN public.e5_nacimientos b
      ON b.tabla='movimientos_credito' AND b.clave=m.id::text
      WHERE m.cliente_id=r.cliente_id AND b.birth_xid=pg_current_xact_id())
    THEN RAISE EXCEPTION 'E11/E5: preparación no admite escritura monetaria en su unidad'; END IF;
  END IF;
END $_$;


--
-- Name: e11_e5_capture(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e11_e5_capture() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE version_value integer;
BEGIN
  IF NEW.accion='PROPONER' AND EXISTS(SELECT 1 FROM public.usuarios
    WHERE id=NEW.actor_id AND rol::text='CONTADOR') THEN
    PERFORM public.e11_e5_a_validate(to_jsonb(NEW),true);
    version_value:=split_part((NEW.content::jsonb)#>>'{input,evidencia,referencias,0}',':',4)::integer;
    INSERT INTO public.e11_e5_preparaciones VALUES
      (NEW.clave,NEW.actor_id,NEW.cobro_id,version_value,pg_current_xact_id());
  END IF;
  RETURN NEW;
END $$;


--
-- Name: e11_fin(text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e11_fin(tipo text, inicio date) RETURNS date
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'pg_catalog'
    AS $$
  SELECT CASE tipo WHEN 'DIA' THEN inicio+1 WHEN 'SEMANA' THEN inicio+7
    WHEN 'MES' THEN (inicio+interval '1 month')::date END
$$;


--
-- Name: e11_fuente(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e11_fuente(inicio date, fin date) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'pg_catalog'
    AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'facturaId',t.id,'ventaId',t.id,'folioFactura',t.folio::text,
   'cliente',jsonb_build_object('clienteId',c.id,'nombre',c.nombre),
   'fechaFacturacion',public.e11_iso(CASE WHEN t.documento_tipo='TICKET' THEN t.cobrado_at ELSE t.autorizado_at END),
   'totalFacturado',t.total::text,'moneda','MXN','estado','VIGENTE') ORDER BY t.id),'[]'::jsonb)
 FROM public.tickets t JOIN public.clientes c ON c.id=t.cliente_id
 WHERE t.facturado=true AND t.estado='VENDIDO' AND
   ((t.documento_tipo='TICKET' AND t.cobrado=true) OR
    (t.documento_tipo='NOTA' AND t.autorizacion_estado='AUTORIZADA'))
   AND (CASE WHEN t.documento_tipo='TICKET' THEN t.cobrado_at ELSE t.autorizado_at END)
     >=inicio::timestamp AT TIME ZONE 'America/Mexico_City'
   AND (CASE WHEN t.documento_tipo='TICKET' THEN t.cobrado_at ELSE t.autorizado_at END)
     <fin::timestamp AT TIME ZONE 'America/Mexico_City'
$$;


--
-- Name: e11_graph(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e11_graph() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $_$
DECLARE p record; e record; s record; d record; a record; o record; prev record;
  j jsonb; rows_json jsonb; actual jsonb; end_date date; total numeric; n bigint; linked boolean;
BEGIN
  PERFORM public.e11_recovery_check();
  FOR p IN SELECT * FROM public.e11_perfiles LOOP
    SELECT * INTO e FROM public.e11_perfil_eventos WHERE usuario_id=p.usuario_id AND revision=p.version;
    IF NOT FOUND OR e.actor_id<>p.actor_id OR e.birth_xid<>p.birth_xid
      OR e.datos->>'posterior' IS DISTINCT FROM p.perfil
      OR (e.datos->>'creadoEn')::timestamptz IS DISTINCT FROM p.updated_at
      OR (SELECT count(*) FROM public.e11_perfil_eventos WHERE usuario_id=p.usuario_id)<>p.version
    THEN RAISE EXCEPTION 'E11: perfil sin cadena de eventos/CAS'; END IF;
    IF EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id=p.usuario_id AND
      (((u.rol::text<>'CONTADOR' OR NOT u.activo) AND p.perfil IS NOT NULL)
      OR (u.rol::text='CONTADOR' AND u.activo AND p.perfil IS NULL)))
    THEN RAISE EXCEPTION 'E11: perfil debe revocarse al salir/desactivar'; END IF;
  END LOOP;
  FOR e IN SELECT * FROM public.e11_perfil_eventos LOOP
    j:=e.datos;
    IF NOT public.e11_keys(j,ARRAY['id','uuid','usuarioId','actorId','anterior','posterior','revision','motivo','creadoEn'])
      OR (j->>'id')::uuid IS DISTINCT FROM e.id OR (j->>'uuid')::uuid IS DISTINCT FROM e.uuid
      OR (j->>'usuarioId')::integer IS DISTINCT FROM e.usuario_id
      OR (j->>'actorId')::integer IS DISTINCT FROM e.actor_id
      OR (j->>'revision')::integer IS DISTINCT FROM e.revision
      OR nullif(btrim(j->>'motivo'),'') IS NULL
      OR NOT isfinite((j->>'creadoEn')::timestamptz)
      OR coalesce(j->>'posterior','F') NOT IN ('A','F')
      OR NOT EXISTS (SELECT 1 FROM public.e11_perfiles WHERE usuario_id=e.usuario_id AND version>=e.revision)
    THEN RAISE EXCEPTION 'E11: evento perfil inválido'; END IF;
    IF e.revision>1 THEN
      SELECT * INTO prev FROM public.e11_perfil_eventos WHERE usuario_id=e.usuario_id AND revision=e.revision-1;
      -- Adapter usa F al normalizar null de un perfil CONTADOR; sólo tolerar
      -- esa normalización en reactivación real registrada, nunca para resucitar A.
      IF NOT FOUND OR (j->'anterior' IS DISTINCT FROM prev.datos->'posterior'
        AND NOT (prev.datos->'posterior'='null'::jsonb AND j->>'anterior'='F'
          AND EXISTS (SELECT 1 FROM public.e11_cambios_usuario c
            WHERE c.usuario_id=e.usuario_id AND c.birth_xid=e.birth_xid
              AND c.rol_anterior='CONTADOR')))
      THEN RAISE EXCEPTION 'E11: anterior no corresponde a historia'; END IF;
    ELSIF j->'anterior' NOT IN ('"F"'::jsonb,'null'::jsonb) THEN
      RAISE EXCEPTION 'E11: primer evento parte de F virtual o rol no contador';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.e11_operaciones op WHERE op.operacion='PERFIL'
      AND op.actor_id=e.actor_id AND op.uuid=e.uuid AND op.respuesta=e.datos AND op.birth_xid=e.birth_xid)
      AND NOT EXISTS (SELECT 1 FROM public.e11_cambios_usuario c
        WHERE c.usuario_id=e.usuario_id AND c.birth_xid=e.birth_xid
          AND j->>'posterior' IS NOT DISTINCT FROM
            CASE WHEN c.rol_posterior='CONTADOR' AND c.activo_posterior THEN 'F' ELSE NULL END)
    THEN RAISE EXCEPTION 'E11: evento sin asignación ADMIN/revocación real'; END IF;
    IF e.revision=1 AND EXISTS (SELECT 1 FROM public.e11_operaciones op
      WHERE op.operacion='PERFIL' AND op.actor_id=e.actor_id AND op.uuid=e.uuid)
      AND j->'anterior' IS DISTINCT FROM '"F"'::jsonb
    THEN RAISE EXCEPTION 'E11: primera asignación parte del default F virtual'; END IF;
  END LOOP;
  FOR a IN SELECT * FROM public.e11_cambios_usuario LOOP
    IF NOT EXISTS (SELECT 1 FROM public.e11_perfil_eventos profile_event WHERE profile_event.usuario_id=a.usuario_id
      AND profile_event.birth_xid=a.birth_xid AND profile_event.datos->>'posterior' IS NOT DISTINCT FROM
        CASE WHEN a.rol_posterior='CONTADOR' AND a.activo_posterior THEN 'F' ELSE NULL END)
    THEN RAISE EXCEPTION 'E11: cambio usuario sin revocación/version nueva'; END IF;
  END LOOP;
  FOR s IN SELECT * FROM public.e11_conciliaciones LOOP
    j:=s.datos; end_date:=public.e11_fin(s.tipo,s.inicio);
    IF NOT public.e11_keys(j,ARRAY['id','uuid','periodo','revision','anteriorId','fuenteRevision',
      'vigente','congeladoEn','actorId','totalFacturado','cantidadVentas','evidenciaHash','decisiones'])
      OR NOT public.e11_keys(j->'periodo',ARRAY['tipo','inicio','finExclusivo','zona','obligatorio','estado','ultimaConciliacionId'])
      OR j->>'id' IS DISTINCT FROM s.id::text OR (j->>'revision')::integer IS DISTINCT FROM s.revision
      OR (j->>'actorId')::integer IS DISTINCT FROM s.actor_id
      OR j->>'anteriorId' IS DISTINCT FROM s.anterior_id::text
      OR j#>>'{periodo,tipo}' IS DISTINCT FROM s.tipo
      OR j#>>'{periodo,inicio}' IS DISTINCT FROM to_char(s.inicio,'YYYY-MM-DD')
      OR j#>>'{periodo,finExclusivo}' IS DISTINCT FROM to_char(end_date,'YYYY-MM-DD')
      OR j#>>'{periodo,zona}' IS DISTINCT FROM 'America/Mexico_City'
      OR (j#>>'{periodo,obligatorio}')::boolean IS DISTINCT FROM (s.tipo<>'DIA')
      OR j#>>'{periodo,estado}' IS DISTINCT FROM 'CONGELADO'
      OR j#>>'{periodo,ultimaConciliacionId}' IS DISTINCT FROM s.id::text
      OR j->'decisiones' IS DISTINCT FROM '[]'::jsonb OR j->'vigente' IS DISTINCT FROM 'true'::jsonb
      OR (s.tipo='SEMANA' AND extract(isodow FROM s.inicio)<>1)
      OR (s.tipo='MES' AND extract(day FROM s.inicio)<>1)
      OR end_date::timestamp AT TIME ZONE 'America/Mexico_City'>(j->>'congeladoEn')::timestamptz
      OR coalesce(j->>'evidenciaHash','') !~ '^[0-9a-f]{64}$'
      OR j->>'fuenteRevision' IS DISTINCT FROM j->>'evidenciaHash'
      OR NOT isfinite((j->>'congeladoEn')::timestamptz)
    THEN RAISE EXCEPTION 'E11: snapshot/calendario/whitelist inválido'; END IF;
    IF s.revision>1 AND NOT EXISTS (SELECT 1 FROM public.e11_conciliaciones parent
      WHERE parent.id=s.anterior_id AND parent.tipo=s.tipo AND parent.inicio=s.inicio AND parent.revision=s.revision-1)
    THEN RAISE EXCEPTION 'E11: revisión sin predecesor exacto'; END IF;
    SELECT coalesce(jsonb_agg(datos ORDER BY venta_id),'[]'::jsonb),count(*),
      coalesce(sum((datos->>'totalFacturado')::numeric),0) INTO rows_json,n,total
      FROM public.e11_conciliacion_ventas WHERE conciliacion_id=s.id;
    IF n IS DISTINCT FROM (j->>'cantidadVentas')::bigint
      OR total IS DISTINCT FROM (j->>'totalFacturado')::numeric
      OR public.e11_hash(rows_json) IS DISTINCT FROM j->>'evidenciaHash'
      OR EXISTS (SELECT 1 FROM public.e11_conciliacion_ventas
        WHERE conciliacion_id=s.id AND birth_xid<>s.birth_xid)
    THEN RAISE EXCEPTION 'E11: snapshot requiere conjunto completo congelado'; END IF;
    IF s.birth_xid=pg_current_xact_id() THEN
      IF end_date::timestamp AT TIME ZONE 'America/Mexico_City'>clock_timestamp()
        OR rows_json IS DISTINCT FROM public.e11_fuente(s.inicio,end_date)
      THEN RAISE EXCEPTION 'E11: periodo abierto/fuente modificada al congelar'; END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.e11_operaciones op WHERE op.actor_id=s.actor_id
      AND op.operacion='SNAPSHOT' AND op.uuid=(j->>'uuid')::uuid AND op.respuesta=j AND op.birth_xid=s.birth_xid)
    THEN RAISE EXCEPTION 'E11: snapshot sin replay propio'; END IF;
  END LOOP;
  FOR a IN SELECT * FROM public.e11_conciliacion_ventas LOOP
    j:=a.datos;
    IF NOT public.e11_keys(j,ARRAY['facturaId','ventaId','folioFactura','cliente','fechaFacturacion','totalFacturado','moneda','estado'])
      OR NOT public.e11_keys(j->'cliente',ARRAY['clienteId','nombre'])
      OR (j->>'ventaId')::integer IS DISTINCT FROM a.venta_id
      OR (j->>'facturaId')::integer IS DISTINCT FROM a.venta_id
      OR j->>'moneda' IS DISTINCT FROM 'MXN' OR j->>'estado' IS DISTINCT FROM 'VIGENTE'
      OR coalesce(j->>'totalFacturado','') !~ '^[0-9]+\.[0-9]{2}$'
    THEN RAISE EXCEPTION 'E11: venta congelada fuera de whitelist'; END IF;
  END LOOP;
  FOR d IN SELECT * FROM public.e11_decisiones LOOP
    SELECT * INTO s FROM public.e11_conciliaciones WHERE id=d.conciliacion_id;
    j:=d.datos;
    IF NOT public.e11_keys(j,ARRAY['id','uuid','actorId','creadoEn','resultado','totalExterno','referenciaExterna','observacion','avisoAdminId'])
      OR (j->>'id')::uuid IS DISTINCT FROM d.id OR (j->>'uuid')::uuid IS DISTINCT FROM d.uuid
      OR (j->>'actorId')::integer IS DISTINCT FROM d.actor_id
      OR coalesce(j->>'resultado','') NOT IN ('ACEPTADA','NO_CUADRA')
      OR coalesce(j->>'totalExterno','') !~ '^[0-9]+\.[0-9]{2}$'
      OR nullif(btrim(j->>'referenciaExterna'),'') IS NULL
      OR (j->>'creadoEn')::timestamptz<(s.datos->>'congeladoEn')::timestamptz
    THEN RAISE EXCEPTION 'E11: decisión inválida'; END IF;
    IF j->>'resultado'='ACEPTADA' THEN
      IF (j->>'totalExterno')::numeric<>(s.datos->>'totalFacturado')::numeric
        OR j->'avisoAdminId' IS DISTINCT FROM 'null'::jsonb
        OR EXISTS(SELECT 1 FROM public.e11_avisos WHERE decision_id=d.id)
      THEN RAISE EXCEPTION 'E11: aceptación no coincide/aviso impropio'; END IF;
    ELSE
      IF nullif(btrim(j->>'observacion'),'') IS NULL OR NOT EXISTS(
        SELECT 1 FROM public.e11_avisos aviso WHERE aviso.id=(j->>'avisoAdminId')::uuid
          AND aviso.decision_id=d.id AND aviso.conciliacion_id=d.conciliacion_id AND aviso.birth_xid=d.birth_xid)
      THEN RAISE EXCEPTION 'E11: discrepancia requiere aviso ADMIN atómico'; END IF;
    END IF;
    IF d.birth_xid=pg_current_xact_id() THEN
      IF EXISTS(SELECT 1 FROM public.e11_conciliaciones later
        WHERE later.tipo=s.tipo AND later.inicio=s.inicio AND later.revision>s.revision)
        OR public.e11_hash(public.e11_fuente(s.inicio,public.e11_fin(s.tipo,s.inicio)))<>s.datos->>'fuenteRevision'
      THEN RAISE EXCEPTION 'E11: decisión obsoleta/FUENTE_CAMBIADA'; END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.e11_operaciones op WHERE op.operacion='DECISION'
      AND op.actor_id=d.actor_id AND op.uuid=d.uuid AND op.birth_xid=d.birth_xid
      AND op.respuesta=jsonb_set(jsonb_set(s.datos,'{decisiones}',jsonb_build_array(d.datos)),
        '{periodo,estado}',d.datos->'resultado'))
    THEN RAISE EXCEPTION 'E11: decisión sin replay propio'; END IF;
  END LOOP;
  FOR a IN SELECT * FROM public.e11_avisos LOOP
    IF NOT EXISTS (SELECT 1 FROM public.e11_decisiones decision_row WHERE decision_row.id=a.decision_id
      AND decision_row.conciliacion_id=a.conciliacion_id AND decision_row.datos->>'resultado'='NO_CUADRA'
      AND decision_row.datos->>'avisoAdminId'=a.id::text AND decision_row.birth_xid=a.birth_xid)
      OR NOT EXISTS (SELECT 1 FROM public.notificaciones_sistema n
        JOIN public.e11_notificacion_origen b ON b.notificacion_id=n.id
        WHERE n.tipo='E11_NO_CUADRA' AND n.entidad='e11_conciliaciones'
          AND n.entidad_id=a.conciliacion_id::text AND n.destinatario_usuario_id IS NULL
          AND n.prioridad='ALTA' AND n.titulo='Conciliación facturada no cuadra'
          AND n.mensaje='Revisar /contabilidad/conciliaciones/'||a.conciliacion_id::text
          AND b.birth_xid=a.birth_xid)
    THEN RAISE EXCEPTION 'E11: aviso/decisión/notificación no coherentes'; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.notificaciones_sistema n WHERE n.tipo='E11_NO_CUADRA'
    AND NOT EXISTS(SELECT 1 FROM public.e11_avisos aviso WHERE aviso.conciliacion_id::text=n.entidad_id))
  THEN RAISE EXCEPTION 'E11: notificación huérfana'; END IF;
  FOR o IN SELECT * FROM public.e11_operaciones LOOP
    IF o.estado='CERRADA_SIN_EFECTO' THEN CONTINUE; END IF;
    IF o.operacion='PERFIL' AND NOT EXISTS(SELECT 1 FROM public.e11_perfil_eventos profile_event
      WHERE profile_event.actor_id=o.actor_id AND profile_event.uuid=o.uuid AND profile_event.datos=o.respuesta AND profile_event.birth_xid=o.birth_xid)
      OR o.operacion='SNAPSHOT' AND NOT EXISTS(SELECT 1 FROM public.e11_conciliaciones snapshot_row
        WHERE snapshot_row.actor_id=o.actor_id AND snapshot_row.datos=o.respuesta AND snapshot_row.birth_xid=o.birth_xid
          AND (snapshot_row.datos->>'uuid')::uuid=o.uuid)
      OR o.operacion='DECISION' AND NOT EXISTS(SELECT 1 FROM public.e11_decisiones decision_row
        WHERE decision_row.actor_id=o.actor_id AND decision_row.uuid=o.uuid AND decision_row.birth_xid=o.birth_xid
          AND o.respuesta->>'id'=decision_row.conciliacion_id::text
          AND o.respuesta->'decisiones'=jsonb_build_array(decision_row.datos))
    THEN RAISE EXCEPTION 'E11: replay sin efecto correspondiente'; END IF;
    IF o.operacion='PREPARACION' THEN
      IF NOT public.e11_keys(o.respuesta,ARRAY['cobroId','clienteId','revision','fuenteRevision','retenido','notas','propuestaId'])
        OR jsonb_typeof(o.respuesta->'notas') IS DISTINCT FROM 'array'
        OR coalesce(o.respuesta->>'retenido','') !~ '^[0-9]+\.[0-9]{2}$'
        OR to_regclass('public.e5_operaciones') IS NULL
      THEN RAISE EXCEPTION 'E11: preparación sin whitelist/dependencia E5'; END IF;
      FOR j IN SELECT value FROM jsonb_array_elements(o.respuesta->'notas') LOOP
        IF NOT public.e11_keys(j,ARRAY['notaId','movimientoVentaId','folio','clienteId','fecha','facturada','total','saldo'])
        THEN RAISE EXCEPTION 'E11: nota de preparación fuera de whitelist'; END IF;
      END LOOP;
      -- Nombres constantes y parámetros USING; E5 alineado es prerrequisito
      -- explícito de esta versión preparada con extensión A.
      EXECUTE $query$
        SELECT EXISTS(SELECT 1 FROM public.e5_operaciones p
          WHERE p.clave=$1 AND p.actor_id=$2 AND p.accion='PROPONER'
            AND p.cobro_id::text=$3->>'cobroId'
            AND p.response->>'clienteId'=$3->>'clienteId'
            AND p.response->>'revision'=$3->>'revision'
            AND p.response->>'importePendiente'=$3->>'retenido'
            AND p.response->>'propuestaVigenteId'=$3->>'propuestaId'
            AND coalesce((p.response->'propuestas'->-1->>'importeFavorPropuesto')::numeric,0)=0
            AND p.birth_xid=$4)
      $query$ INTO linked USING o.uuid,o.actor_id,o.respuesta,o.birth_xid;
      IF NOT linked THEN RAISE EXCEPTION 'E11: replay sin propuesta real E5 propia, sin favor'; END IF;
      IF NOT EXISTS(SELECT 1 FROM public.e11_e5_preparaciones w
        WHERE w.clave=o.uuid AND w.actor_id=o.actor_id AND w.birth_xid=o.birth_xid)
      THEN RAISE EXCEPTION 'E11: preparación sin testigo de actor A al INSERT'; END IF;
    END IF;
  END LOOP;
  FOR a IN SELECT * FROM public.e11_e5_preparaciones LOOP
    SELECT to_jsonb(operation_row) INTO actual FROM public.e5_operaciones operation_row WHERE operation_row.clave=a.clave;
    IF actual IS NULL OR (actual->>'actor_id')::integer IS DISTINCT FROM a.actor_id
      OR (actual->>'cobro_id')::uuid IS DISTINCT FROM a.cobro_id
      OR (actual->>'birth_xid')::xid8 IS DISTINCT FROM a.birth_xid
    THEN RAISE EXCEPTION 'E11/E5: testigo sin operación propia'; END IF;
    -- Probar la historia, NO volver a exigir que el autor siga siendo A.
    -- Autoridad se exigió en e5_insert_authority y e11_e5_capture.
    PERFORM public.e11_e5_a_validate(actual,false);
    j:=(actual->>'content')::jsonb;
    IF split_part(j#>>'{input,evidencia,referencias,0}',':',4)::integer<>a.perfil_version
      OR NOT EXISTS(SELECT 1 FROM public.e11_operaciones op
        WHERE op.operacion='PREPARACION' AND op.actor_id=a.actor_id AND op.uuid=a.clave
          AND op.birth_xid=a.birth_xid
          AND op.respuesta->>'fuenteRevision'=j#>>'{input,versionContexto}'
          AND op.solicitud_hash=public.e11_hash(jsonb_build_object('id',a.cobro_id::text,
            'input',jsonb_build_object('uuid',split_part(j#>>'{input,evidencia,referencias,0}',':',2),'perfilVersion',a.perfil_version,
              'revisionEsperada',(j#>>'{input,revisionEsperada}')::integer,
              'fuenteRevision',j#>>'{input,versionContexto}','asignaciones',j#>'{input,asignaciones}'))))
    THEN RAISE EXCEPTION 'E11/E5: replay propio/versión/cuerpo real no coinciden'; END IF;
  END LOOP;
  RETURN NULL;
END $_$;


--
-- Name: e11_hash(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e11_hash(j jsonb) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'pg_catalog'
    AS $$
  SELECT encode(sha256(convert_to(public.e11_canonical(j),'UTF8')),'hex')
$$;


--
-- Name: e11_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e11_immutable() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN RAISE EXCEPTION 'E11: evidencia inmutable, sin edición/borrado/truncate'; END $$;


--
-- Name: e11_iso(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e11_iso(value timestamp with time zone) RETURNS text
    LANGUAGE plpgsql STABLE
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN
  IF value IS NULL OR NOT isfinite(value)
    OR value<'0001-01-01T00:00:00Z'::timestamptz
    OR value>='10000-01-01T00:00:00Z'::timestamptz
  THEN RAISE EXCEPTION 'E11: instante fuera de serialización ISO contractual'; END IF;
  RETURN to_char(value AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
END $$;


--
-- Name: e11_keys(jsonb, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e11_keys(j jsonb, expected text[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'pg_catalog'
    AS $$
  SELECT coalesce(jsonb_typeof(j)='object' AND
    (SELECT array_agg(key ORDER BY key COLLATE "C") FROM jsonb_object_keys(j) k(key))=
    (SELECT array_agg(v ORDER BY v COLLATE "C") FROM unnest(expected) a(v)),false)
$$;


--
-- Name: e11_notification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e11_notification() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.tipo='E11_NO_CUADRA' THEN
      INSERT INTO public.e11_notificacion_origen VALUES(NEW.id,pg_current_xact_id());
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.tipo='E11_NO_CUADRA' OR (TG_OP='UPDATE' AND NEW.tipo='E11_NO_CUADRA') THEN
    IF TG_OP='DELETE' OR (to_jsonb(OLD)-'leida_at') IS DISTINCT FROM (to_jsonb(NEW)-'leida_at')
    THEN RAISE EXCEPTION 'E11: notificación inmutable salvo marca de lectura'; END IF;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;


--
-- Name: e11_recovery_before(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e11_recovery_before() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN
  IF TG_TABLE_NAME='e11_resoluciones' THEN
    IF NOT pg_try_advisory_xact_lock(hashtextextended(
      'E11:resolution:'||NEW.admin_id::text||':'||NEW.uuid_resolutor::text,0))
    THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='E11: replay resolutor concurrente'; END IF;
    PERFORM public.e11_replay_lock(NEW.actor_original_id,NEW.accion,NEW.uuid_original,false);
  ELSIF TG_TABLE_NAME='e11_operaciones' THEN
    PERFORM public.e11_replay_lock(NEW.actor_id,NEW.operacion,NEW.uuid,NEW.estado='CONFIRMADA');
  ELSIF TG_TABLE_NAME='e11_perfil_eventos' THEN
    PERFORM public.e11_replay_lock(NEW.actor_id,'PERFIL',NEW.uuid);
  ELSIF TG_TABLE_NAME='e11_conciliaciones' THEN
    PERFORM public.e11_replay_lock(NEW.actor_id,'SNAPSHOT',(NEW.datos->>'uuid')::uuid);
  ELSIF TG_TABLE_NAME='e11_decisiones' THEN
    PERFORM public.e11_replay_lock(NEW.actor_id,'DECISION',NEW.uuid);
  END IF;
  IF TG_TABLE_NAME='e11_resoluciones' OR
    (TG_TABLE_NAME='e11_operaciones' AND to_jsonb(NEW)->>'estado'='CERRADA_SIN_EFECTO') THEN
    IF current_setting('transaction_isolation')<>'serializable'
    THEN RAISE EXCEPTION 'E11: recuperación requiere SERIALIZABLE'; END IF;
  END IF;
  RETURN NEW;
END $$;


--
-- Name: e11_recovery_check(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e11_recovery_check() RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE r record; o record; metadata jsonb; target jsonb; previous jsonb; expected jsonb;
BEGIN
  FOR o IN SELECT * FROM public.e11_operaciones WHERE estado='CERRADA_SIN_EFECTO' LOOP
    IF NOT EXISTS(SELECT 1 FROM public.e11_resoluciones r
      WHERE r.actor_original_id=o.actor_id AND r.accion=o.operacion AND r.uuid_original=o.uuid
        AND r.estado=o.estado AND r.birth_xid=o.birth_xid
        AND r.solicitud_hash=o.solicitud_hash AND r.respuesta=o.respuesta)
    THEN RAISE EXCEPTION 'E11: tombstone sin resolución ADMIN propia'; END IF;
    IF (o.operacion='PERFIL' AND EXISTS(SELECT 1 FROM public.e11_perfil_eventos
          WHERE actor_id=o.actor_id AND uuid=o.uuid))
      OR (o.operacion='SNAPSHOT' AND EXISTS(SELECT 1 FROM public.e11_conciliaciones
          WHERE actor_id=o.actor_id AND (datos->>'uuid')::uuid=o.uuid))
      OR (o.operacion='DECISION' AND EXISTS(SELECT 1 FROM public.e11_decisiones
          WHERE actor_id=o.actor_id AND uuid=o.uuid))
      OR (o.operacion='PREPARACION' AND EXISTS(SELECT 1 FROM public.e5_operaciones
          WHERE actor_id=o.actor_id AND clave=o.uuid AND accion='PROPONER'))
      OR (o.operacion='PREPARACION' AND EXISTS(SELECT 1 FROM public.e11_e5_preparaciones
          WHERE actor_id=o.actor_id AND clave=o.uuid))
    THEN RAISE EXCEPTION 'E11: tombstone incompatible con efecto; conservar evidencia'; END IF;
  END LOOP;
  FOR r IN SELECT * FROM public.e11_resoluciones LOOP
    SELECT * INTO o FROM public.e11_operaciones
      WHERE actor_id=r.actor_original_id AND operacion=r.accion AND uuid=r.uuid_original;
    IF NOT FOUND OR o.estado<>r.estado
    THEN RAISE EXCEPTION 'E11: resolución sin operación terminal compatible'; END IF;
    target:=jsonb_build_object('actorId',r.actor_original_id,'accion',r.accion,'uuidOriginal',r.uuid_original::text);
    metadata:=target||jsonb_build_object('estado',r.estado,'resolucionId',r.id::text,
      'resueltoEn',public.e11_iso(r.created_at));
    expected:=metadata||jsonb_build_object('revision',public.e11_hash(metadata));
    previous:=target||jsonb_build_object('estado',CASE WHEN r.estado='CONFIRMADA'
      THEN 'CONFIRMADA' ELSE 'PENDIENTE' END,'resolucionId',NULL,'resueltoEn',NULL);
    IF r.respuesta IS DISTINCT FROM expected OR r.revision_anterior<>public.e11_hash(previous)
      OR r.solicitud_hash<>public.e11_hash(jsonb_build_object('target',target,'input',
        jsonb_build_object('uuid',r.uuid_resolutor::text,'revisionEsperada',r.revision_anterior,
          'identidadVersion',r.identidad_version,'motivo',r.motivo)))
    THEN RAISE EXCEPTION 'E11: resolución metadata/CAS/hash no contractual'; END IF;
    -- identidad_version es el hash opaco entregado por backend; no inventar
    -- sesión ni derivación alternativa en SQL. ADMIN real se exige al INSERT.
    -- No reautorizar ese ADMIN histórico después de revocarlo.
  END LOOP;
END $$;


--
-- Name: e11_replay_lock(integer, text, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e11_replay_lock(actor integer, action text, intention uuid, deny_closed boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtextextended('E11:'||actor::text||':'||action||':'||intention::text,0))
  THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='E11: intención concurrente; abortar unidad'; END IF;
  IF deny_closed AND EXISTS(SELECT 1 FROM public.e11_operaciones
    WHERE actor_id=actor AND operacion=action AND uuid=intention AND estado='CERRADA_SIN_EFECTO')
  THEN RAISE EXCEPTION 'E11: OPERACION_CERRADA_SIN_EFECTO'; END IF;
END $$;


--
-- Name: e11_technical_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e11_technical_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN
  IF pg_trigger_depth()<>2 THEN RAISE EXCEPTION 'E11: procedencia no suministrable'; END IF;
  NEW.birth_xid:=pg_current_xact_id(); RETURN NEW;
END $$;


--
-- Name: e11_user_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e11_user_change() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN
  IF (NEW.rol IS DISTINCT FROM OLD.rol OR NEW.activo IS DISTINCT FROM OLD.activo)
    AND (OLD.rol::text='CONTADOR' OR NEW.rol::text='CONTADOR')
    AND EXISTS (SELECT 1 FROM public.e11_perfiles WHERE usuario_id=NEW.id)
  THEN
    IF NOT pg_try_advisory_xact_lock(hashtextextended('E11:security',0))
    THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='E11: revocación concurrente'; END IF;
    INSERT INTO public.e11_cambios_usuario VALUES
      (NEW.id,pg_current_xact_id(),OLD.rol::text,OLD.activo,NEW.rol::text,NEW.activo);
  END IF;
  RETURN NEW;
END $$;


--
-- Name: e12_cash_return_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e12_cash_return_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM proveedor_efectivo_e12
    WHERE pago_proveedor_id=NEW.pago_proveedor_id AND ingreso_caja_id=NEW.id)
  THEN RAISE EXCEPTION 'E12: ingreso caja sin retorno proveedor completo'; END IF;
  RETURN NEW;
END $$;


--
-- Name: e12_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e12_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN RAISE EXCEPTION 'E12: evidencia inmutable; no se borra ni reescribe'; END $$;


--
-- Name: e12_inverse_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e12_inverse_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE linked record;
BEGIN
  IF TG_TABLE_NAME='pagos_proveedor' THEN
    IF NEW.tipo='REVERSO' THEN
      SELECT * INTO linked FROM proveedor_efectivo_e12 WHERE pago_proveedor_id=NEW.movimiento_origen_id;
      IF FOUND AND (linked.retorno->>'reversoProveedorId')::integer IS DISTINCT FROM NEW.id
        THEN RAISE EXCEPTION 'E12: reverso exige retorno completo atómico'; END IF;
    END IF;
  ELSIF NEW.original_id IS NOT NULL THEN
    SELECT * INTO linked FROM proveedor_efectivo_e12
      WHERE movimiento_fondo_id=NEW.original_id OR retorno_fondo_id=NEW.original_id;
    IF FOUND AND (linked.retorno_fondo_id IS DISTINCT FROM NEW.id OR linked.movimiento_fondo_id<>NEW.original_id)
      THEN RAISE EXCEPTION 'E12: use retorno proveedor, no inverso Fondo independiente'; END IF;
  END IF;
  RETURN NEW;
END $$;


--
-- Name: e12_override_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e12_override_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM usuarios u JOIN salidas_dinero_caja s ON s.id=NEW.salida_id
    WHERE u.id=(NEW.evidencia->>'usuarioId')::integer AND u.rol='ADMIN'
      AND s.creado_por_id=u.id AND s.cuenta_origen='CAJA_FISICA' AND s.monto=(NEW.evidencia->>'egreso')::numeric)
  THEN RAISE EXCEPTION 'E12: desbloqueo ADMIN motivado de esta salida requerido'; END IF;
  RETURN NEW;
END $$;


--
-- Name: e12_pago_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e12_pago_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE payment record; expense record; fund record; recovered record;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'E12: no borrar pago/fuentes'; END IF;
  IF TG_OP='UPDATE' AND (
    NEW.pago_proveedor_id<>OLD.pago_proveedor_id OR NEW.detail<>OLD.detail OR
    NEW.salida_caja_id IS DISTINCT FROM OLD.salida_caja_id OR
    NEW.movimiento_fondo_id IS DISTINCT FROM OLD.movimiento_fondo_id OR
    OLD.retorno IS NOT NULL OR NEW.retorno IS NULL
  ) THEN RAISE EXCEPTION 'E12: solo se añade un retorno completo único'; END IF;
  SELECT * INTO STRICT payment FROM pagos_proveedor WHERE id=NEW.pago_proveedor_id;
  IF payment.tipo<>'PAGO' OR payment.forma_pago<>'EFECTIVO'
    OR -payment.importe<>(NEW.detail->>'total')::numeric THEN RAISE EXCEPTION 'E12: pago financiero incoherente'; END IF;
  IF NEW.salida_caja_id IS NOT NULL THEN
    SELECT s.*,c.ubicacion_id INTO STRICT expense FROM salidas_dinero_caja s
      JOIN sesiones_caja c ON c.id=s.sesion_caja_id WHERE s.id=NEW.salida_caja_id;
    IF expense.monto<>(NEW.detail->>'caja')::numeric OR expense.cuenta_origen<>'CAJA_FISICA'
      OR expense.proveedor_id<>payment.proveedor_id OR expense.ubicacion_id<>1
      OR expense.sesion_caja_id<>(NEW.detail->>'sesionCajaId')::integer
      THEN RAISE EXCEPTION 'E12: tramo caja incoherente'; END IF;
  END IF;
  IF NEW.movimiento_fondo_id IS NOT NULL THEN
    SELECT * INTO STRICT fund FROM fondo_movimientos WHERE id=NEW.movimiento_fondo_id;
    IF fund.naturaleza<>'RETIRO' OR fund.original_id IS NOT NULL
      OR fund.importe_centavos<>100*(NEW.detail->>'fondo')::numeric
      THEN RAISE EXCEPTION 'E12: retiro Fondo incoherente'; END IF;
    IF TG_OP='INSERT' AND NOT EXISTS (SELECT 1 FROM usuarios WHERE id=payment.usuario_id AND rol='ADMIN')
      THEN RAISE EXCEPTION 'E12: Fondo exclusivo ADMIN'; END IF;
  END IF;
  IF NEW.retorno IS NOT NULL THEN
    SELECT * INTO STRICT recovered FROM pagos_proveedor WHERE id=(NEW.retorno->>'reversoProveedorId')::integer;
    IF recovered.tipo<>'REVERSO' OR recovered.movimiento_origen_id<>payment.id
      OR recovered.importe<>-payment.importe THEN RAISE EXCEPTION 'E12: reverso proveedor incoherente'; END IF;
    IF NEW.salida_caja_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM caja_retornos_proveedor_e12 r JOIN sesiones_caja c ON c.id=r.sesion_caja_id
      WHERE r.id=(NEW.retorno->>'ingresoCajaId')::integer AND r.pago_proveedor_id=payment.id
        AND r.importe=(NEW.detail->>'caja')::numeric AND c.ubicacion_id=1 AND c.estado='ABIERTA'
        AND r.naturaleza=NEW.retorno->>'naturaleza'
        AND r.sesion_caja_id=(NEW.retorno->>'sesionCajaId')::integer
    ) THEN RAISE EXCEPTION 'E12: retorno caja exacto en sesión Mariana abierta requerido'; END IF;
    IF NEW.movimiento_fondo_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM fondo_movimientos f JOIN usuarios u ON u.id=f.autor_id
      WHERE f.id=(NEW.retorno->>'movimientoFondoId')::uuid AND f.naturaleza='INGRESO'
        AND f.importe_centavos=100*(NEW.detail->>'fondo')::numeric AND u.rol='ADMIN'
        AND ((NEW.retorno->>'naturaleza'='CORRECCION_CAPTURA' AND f.original_id=NEW.movimiento_fondo_id)
          OR (NEW.retorno->>'naturaleza'='RECUPERACION_EFECTIVO' AND f.original_id IS NULL AND f.categoria='OTRO_INGRESO'))
    ) THEN RAISE EXCEPTION 'E12: retorno Fondo exacto requerido'; END IF;
  END IF;
  RETURN NEW;
END $$;


--
-- Name: e1_guard_cash_capture_closed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e1_guard_cash_capture_closed() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF NEW.forma_pago::text='EFECTIVO'
    AND NEW.naturaleza::text IN ('INGRESO_FISICO','DEVOLUCION_FISICA')
    AND NOT COALESCE((NEW.naturaleza::text='INGRESO_FISICO' AND NEW.tipo::text='ABONO'
      AND NEW.operacion_productor='ABONO_ORDINARIO'),false) THEN
    RAISE EXCEPTION USING ERRCODE='E1C01',
      MESSAGE='E1: captura física fuera del abono ordinario E3 permanece cerrada.';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: e1_guard_historical_attribution_closed(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: e1_guard_pending_receipts_closed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e1_guard_pending_receipts_closed() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN
  -- Transition relation (no tabla persistente/search_path de usuario).
  -- No variable de sesión, señal global ni bypass administrativo.
  -- Orden contrastado e5-repository.ts:110-122:
  -- e5_recepciones -> operaciones_credito_e1 -> cobros_credito_pendientes_e1.
  -- En AFTER STATEMENT ya existen la recepción inmutable, la raíz E1 y sus
  -- marcas xid8 (BEFORE de recepción / AFTER ROW de operación y pending).
  -- NO depende de e5_cobros, e5_operaciones ni documento: se insertan después.
  -- El grafo completo sigue DEFERRABLE INITIALLY DEFERRED. Forzarlo IMMEDIATE
  -- antes de completar toda la unidad puede rechazarla: no es modo del adapter.
  -- Cardinalidad singular: 0 rechaza; 1 exige toda atestación; >1 rechaza
  -- incluso si cada fila tuviera una fuente válida. No lote de recepciones.
  IF (SELECT count(*) FROM e5_pending_rows)<>1 OR EXISTS (
    SELECT 1 FROM e5_pending_rows n WHERE NOT EXISTS (
      SELECT 1 FROM public.e5_recepciones r
      JOIN public.operaciones_credito_e1 op ON op.productor=n.operacion_productor AND op.clave=r.id
      JOIN public.e5_nacimientos b ON b.tabla='operaciones_credito_e1'
        AND b.clave=op.productor||':'||op.clave::text AND b.birth_xid=r.birth_xid
      JOIN public.e5_nacimientos receipt_birth ON receipt_birth.tabla='cobros_credito_pendientes_e1'
        AND receipt_birth.clave=r.id::text AND receipt_birth.birth_xid=r.birth_xid
      WHERE r.id=n.operacion_clave AND r.birth_xid=pg_current_xact_id()
        AND n.operacion_productor='COBRO_PENDIENTE' AND n.naturaleza::text='INGRESO_FISICO'
        AND op.naturaleza::text='INGRESO_FISICO' AND op.usuario_id=r.actor_id
        AND op.solicitud_canonica->>'productor'='E5'
        AND (op.solicitud_canonica#>>'{actor,id}')::integer=r.actor_id
        AND op.solicitud_canonica#>>'{input,claveOperacion}'=r.id::text
        AND n.usuario_id=r.actor_id AND n.cliente_id=r.cliente_id AND n.importe=r.importe
        AND n.fecha_real=r.fecha_recepcion AND n.sitio_origen_id=r.ubicacion_id
        AND n.medio::text=r.medio AND n.cuenta_destino=r.cuenta_destino
        AND n.sesion_caja_id IS NOT DISTINCT FROM r.sesion_caja_id
    ))
  THEN RAISE EXCEPTION USING ERRCODE='E1P01',
    MESSAGE='E1: cobro genérico/lote cerrado; exactamente una fila con fuente E5 propia';
  END IF;
  RETURN NULL;
END $$;


--
-- Name: e2_attest_new_retained(uuid); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: e2_finalize_new_abono(integer, text, text, bigint, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: e2_guard_finalized_capture_application(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: e2_reject_evidence_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e2_reject_evidence_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  RAISE EXCEPTION 'E2: evidence/finalization is immutable';
END;
$$;


--
-- Name: e2_require_abono_finalization(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: e2_stamp_insert_transaction(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: e2_validate_abono_finalization(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: e2_validate_unused_proof(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: e3_receipt_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e3_receipt_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN RAISE EXCEPTION 'E3: evidencia inmutable; no editar, borrar ni truncar'; END $$;


--
-- Name: e5_birth(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e5_birth() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN NEW.birth_xid := pg_current_xact_id(); RETURN NEW; END $$;


--
-- Name: e5_birth_private(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e5_birth_private() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN
  IF pg_trigger_depth() <> 2 THEN RAISE EXCEPTION 'E5: procedencia sólo por trigger INSERT de origen'; END IF;
  NEW.birth_xid := pg_current_xact_id();
  RETURN NEW;
END $$;


--
-- Name: e5_capture_birth(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e5_capture_birth() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE k text;
BEGIN
  k := CASE WHEN TG_TABLE_NAME='cobros_credito_pendientes_e1'
    THEN to_jsonb(NEW)->>'operacion_clave'
    WHEN TG_TABLE_NAME='operaciones_credito_e1'
    THEN (to_jsonb(NEW)->>'productor')||':'||(to_jsonb(NEW)->>'clave')
    ELSE to_jsonb(NEW)->>'id' END;
  INSERT INTO public.e5_nacimientos(tabla,clave,birth_xid)
    VALUES (TG_TABLE_NAME,k,pg_current_xact_id());
  RETURN NEW;
END $$;


--
-- Name: e5_closed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e5_closed() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN RAISE EXCEPTION 'E5_DISABLED: construcción OFF; DML E5 cerrado'; END $$;


--
-- Name: e5_detail_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e5_detail_guard() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $_$
DECLARE k text; prior jsonb; d jsonb := NEW.detail; item jsonb; n integer; row_value jsonb;
BEGIN
  IF d->>'id' IS DISTINCT FROM NEW.id::text
    OR (d->>'clienteId')::integer IS DISTINCT FROM NEW.cliente_id
    OR (d->>'ubicacionId')::integer IS DISTINCT FROM NEW.ubicacion_id
    OR (d->>'revision')::integer IS DISTINCT FROM NEW.revision
  THEN RAISE EXCEPTION 'E5: identidad/revisión del agregado'; END IF;
  FOREACH k IN ARRAY ARRAY['propuestas','aplicaciones','rechazos'] LOOP
    IF jsonb_typeof(d->k) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'E5: historia requerida'; END IF;
    IF TG_OP='UPDATE' THEN
      prior := OLD.detail->k;
      IF jsonb_array_length(d->k)<jsonb_array_length(prior) OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(prior) WITH ORDINALITY x(v,i)
        WHERE d->k->(x.i::integer-1) IS DISTINCT FROM x.v)
      THEN RAISE EXCEPTION 'E5: historia append-only'; END IF;
    END IF;
  END LOOP;
  n := 0;
  FOR item IN SELECT value FROM jsonb_array_elements(d->'propuestas') LOOP
    n := n+1;
    IF (item->>'version')::integer IS DISTINCT FROM n OR item->>'id' IS NULL
      OR jsonb_typeof(item->'asignaciones') IS DISTINCT FROM 'array'
    THEN RAISE EXCEPTION 'E5: versión de propuesta inválida'; END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(item->'asignaciones')) <>
      (SELECT count(DISTINCT value->>'movimientoVentaId') FROM jsonb_array_elements(item->'asignaciones'))
    THEN RAISE EXCEPTION 'E5: propuesta duplica movimiento exacto'; END IF;
    FOR row_value IN SELECT value FROM jsonb_array_elements(item->'asignaciones') LOOP
      IF coalesce(row_value->>'importe','') !~ '^(0|[1-9][0-9]*)\.[0-9]{2}$'
        OR (row_value->>'importe')::numeric<=0 OR (row_value->>'notaId')::integer IS NULL
        OR (row_value->>'movimientoVentaId')::integer IS NULL
      THEN RAISE EXCEPTION 'E5: importe/destino propuesto inválido'; END IF;
    END LOOP;
  END LOOP;
  IF (SELECT count(*) FROM jsonb_array_elements(d->'propuestas')) <>
    (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(d->'propuestas'))
  THEN RAISE EXCEPTION 'E5: UUID de propuesta reciclado'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(d->'aplicaciones')) <>
    (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(d->'aplicaciones'))
  THEN RAISE EXCEPTION 'E5: aplicación repetida en historia'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.revision<>1 THEN RAISE EXCEPTION 'E5: revisión inicial'; END IF;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
      OR NEW.ubicacion_id IS DISTINCT FROM OLD.ubicacion_id OR NEW.revision<>OLD.revision+1
      OR (OLD.detail->>'algunaVezAplicado'='true' AND d->>'algunaVezAplicado' IS DISTINCT FROM 'true')
      OR (OLD.detail ? 'devolucion' AND d->'devolucion' IS DISTINCT FROM OLD.detail->'devolucion')
    THEN RAISE EXCEPTION 'E5: transición irreversible'; END IF;
    FOREACH k IN ARRAY ARRAY['id','clienteId','clienteNombre','ubicacionId','ubicacionNombre',
      'importeRecibido','fechaRecepcion','formaPago','cuentaDestino','sesionCajaId',
      'receptor','notasIndicadas','evidenciaRecepcion','reciboId'] LOOP
      IF d->k IS DISTINCT FROM OLD.detail->k THEN RAISE EXCEPTION 'E5: recepción inmutable (%)',k; END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $_$;


--
-- Name: e5_external_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e5_external_guard() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE j jsonb := to_jsonb(OLD); nextj jsonb := to_jsonb(NEW); linked boolean := false;
BEGIN
  IF TG_TABLE_NAME='movimientos_credito' THEN
    SELECT EXISTS (SELECT 1 FROM public.e5_vinculos_credito WHERE movimiento_id=(j->>'id')::integer)
      OR EXISTS (SELECT 1 FROM public.e5_aplicaciones WHERE movimiento_venta_id=(j->>'id')::integer) INTO linked;
  ELSIF TG_TABLE_NAME IN ('aplicaciones_credito','solicitudes_pago_dirigido') THEN
    SELECT EXISTS (SELECT 1 FROM public.e5_vinculos_credito
      WHERE movimiento_id=coalesce((j->>'abono_movimiento_id')::integer,(j->>'movimiento_id')::integer)
        OR (TG_OP='UPDATE' AND movimiento_id=
          coalesce((nextj->>'abono_movimiento_id')::integer,(nextj->>'movimiento_id')::integer))) INTO linked;
    -- También antes de que exista e5_vinculos_credito, insertado al final:
    -- no trasplantar una fila histórica para simular INSERT FIFO posterior.
    linked := linked OR EXISTS (SELECT 1 FROM public.movimientos_credito mc
      WHERE mc.operacion_productor='E5_APLICACION_RETENIDA' AND
        (mc.id=coalesce((j->>'abono_movimiento_id')::integer,(j->>'movimiento_id')::integer)
        OR (TG_OP='UPDATE' AND mc.id=
          coalesce((nextj->>'abono_movimiento_id')::integer,(nextj->>'movimiento_id')::integer))));
  ELSIF TG_TABLE_NAME='salidas_dinero_caja' THEN
    SELECT EXISTS (SELECT 1 FROM public.e5_devoluciones WHERE salida_id=(j->>'id')::integer) INTO linked;
  ELSIF TG_TABLE_NAME='fondo_movimientos' THEN
    SELECT EXISTS (SELECT 1 FROM public.e5_devoluciones WHERE movimiento_fondo_id=(j->>'id')::uuid) INTO linked;
  ELSIF TG_TABLE_NAME='cobros_credito_pendientes_e1' THEN
    SELECT EXISTS (SELECT 1 FROM public.e5_recepciones WHERE id=(j->>'operacion_clave')::uuid) INTO linked;
  ELSIF TG_TABLE_NAME='operaciones_credito_e1' THEN
    linked := j->>'productor'='E5_APLICACION_RETENIDA' OR
      (j->>'productor'='COBRO_PENDIENTE' AND EXISTS
        (SELECT 1 FROM public.e5_recepciones WHERE id=(j->>'clave')::uuid));
  END IF;
  IF linked THEN RAISE EXCEPTION 'E5: fuente/efecto relacionado inmutable'; END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;


--
-- Name: e5_favor_initial_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e5_favor_initial_guard() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.movimientos_credito m
    JOIN public.e5_aplicaciones a ON a.id=m.operacion_clave
    WHERE m.id=NEW.abono_movimiento_id AND m.operacion_productor='E5_APLICACION_RETENIDA'
      AND a.favor AND a.birth_xid=pg_current_xact_id())
  THEN RAISE EXCEPTION 'E5: emisión inicial de favor no admite aplicación, incluso tras IMMEDIATE'; END IF;
  RETURN NEW;
END $$;


--
-- Name: e5_graph_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e5_graph_guard() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $_$
DECLARE r record; c record; a record; p jsonb; x jsonb; m record;
  total numeric; returned numeric; d record; o record; prev jsonb; v record; k text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.e5_operaciones o JOIN public.e5_impresiones i USING(clave))
  THEN RAISE EXCEPTION 'E5: clave global operación/impresión duplicada'; END IF;
  FOR r IN SELECT * FROM public.e5_recepciones LOOP
    SELECT * INTO c FROM public.e5_cobros WHERE id=r.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'E5: recepción sin agregado'; END IF;
    IF c.cliente_id<>r.cliente_id OR c.ubicacion_id<>r.ubicacion_id
      OR (r.snapshot->>'importeRecibido')::numeric IS DISTINCT FROM r.importe
      OR (r.snapshot->>'fechaRecepcion')::timestamptz IS DISTINCT FROM r.fecha_recepcion
      OR (r.snapshot#>>'{receptor,id}')::integer IS DISTINCT FROM r.actor_id
      OR r.snapshot->>'formaPago' IS DISTINCT FROM r.medio
      OR r.snapshot->>'cuentaDestino' IS DISTINCT FROM r.cuenta_destino
      OR (r.snapshot->>'sesionCajaId')::integer IS DISTINCT FROM r.sesion_caja_id
    THEN RAISE EXCEPTION 'E5: columnas y fuente snapshot divergentes'; END IF;
    FOREACH k IN ARRAY ARRAY['id','clienteId','clienteNombre','ubicacionId','ubicacionNombre',
      'importeRecibido','fechaRecepcion','formaPago','cuentaDestino','sesionCajaId','sesionOperativaId',
      'receptor','notasIndicadas','evidenciaRecepcion','reciboId'] LOOP
      IF c.detail->k IS DISTINCT FROM r.snapshot->k
      THEN RAISE EXCEPTION 'E5: agregado difiere de fuente original (%)',k; END IF;
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.cobros_credito_pendientes_e1 s
      JOIN public.e5_nacimientos b ON b.tabla='cobros_credito_pendientes_e1'
        AND b.clave=s.operacion_clave::text AND b.birth_xid=r.birth_xid
      WHERE s.operacion_productor='COBRO_PENDIENTE' AND s.operacion_clave=r.id
        AND s.cliente_id=r.cliente_id AND s.importe=r.importe AND s.fecha_real=r.fecha_recepcion
        AND s.sitio_origen_id=r.ubicacion_id AND s.medio::text=r.medio
        AND s.cuenta_destino=r.cuenta_destino AND s.sesion_caja_id IS NOT DISTINCT FROM r.sesion_caja_id
        AND s.usuario_id=r.actor_id)
    THEN RAISE EXCEPTION 'E5: fuente E1 exacta/inserción propia requerida'; END IF;
    IF EXISTS (SELECT 1 FROM public.movimientos_credito
      WHERE operacion_productor='COBRO_PENDIENTE' AND operacion_clave=r.id)
    THEN RAISE EXCEPTION 'E5: recepción fuera del ledger'; END IF;
    SELECT coalesce(sum(importe),0) INTO total FROM public.e5_aplicaciones WHERE cobro_id=r.id;
    SELECT coalesce(sum(importe),0) INTO returned FROM public.e5_devoluciones WHERE cobro_id=r.id;
    IF total+returned>r.importe OR (total>0 AND returned>0)
      OR (returned>0 AND returned<>r.importe)
      OR (c.detail->>'importeRecibido')::numeric IS DISTINCT FROM r.importe
      OR (c.detail->>'importeAplicado')::numeric IS DISTINCT FROM total
      OR (c.detail->>'importeDevuelto')::numeric IS DISTINCT FROM returned
      OR (c.detail->>'importePendiente')::numeric IS DISTINCT FROM r.importe-total-returned
      OR (c.detail->>'algunaVezAplicado')::boolean IS DISTINCT FROM (total>0)
      OR c.detail->>'estado' IS DISTINCT FROM
        (CASE WHEN returned>0 THEN 'DEVUELTO' WHEN total=0 THEN 'PENDIENTE'
          WHEN total=r.importe THEN 'APLICADO' ELSE 'PARCIAL' END)
    THEN RAISE EXCEPTION 'E5: conservación/estado/irreversibilidad'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.e5_documentos doc
      WHERE doc.id=(c.detail->>'reciboId')::uuid AND doc.cobro_id=r.id AND doc.tipo='RECIBO'
        AND doc.birth_xid=r.birth_xid AND doc.snapshot->'asignaciones'='[]'::jsonb
        AND (doc.snapshot->>'importeDocumento')::numeric=r.importe
        AND (doc.snapshot->>'pendienteEnEmision')::numeric=r.importe
        AND (doc.snapshot->>'importeFavorGenerado')::numeric=0)
    THEN RAISE EXCEPTION 'E5: recibo inmediato inmutable requerido'; END IF;
    IF (SELECT count(*) FROM public.e5_operaciones WHERE cobro_id=r.id)<>c.revision
      OR NOT EXISTS (SELECT 1 FROM public.e5_operaciones
        WHERE cobro_id=r.id AND revision=c.revision AND response=c.detail)
    THEN RAISE EXCEPTION 'E5: historia/revisión completa requerida'; END IF;
    FOR x IN SELECT value FROM jsonb_array_elements(c.detail->'aplicaciones') LOOP
      IF NOT EXISTS (SELECT 1 FROM public.e5_aplicaciones WHERE cobro_id=r.id
        AND grupo_id=(x->>'id')::uuid AND snapshot=x)
      THEN RAISE EXCEPTION 'E5: aplicación JSON sin consumo'; END IF;
    END LOOP;
    IF (c.detail ? 'devolucion') IS DISTINCT FROM (returned>0)
    THEN RAISE EXCEPTION 'E5: devolución JSON sin efecto'; END IF;
  END LOOP;
  FOR a IN SELECT * FROM public.e5_aplicaciones LOOP
    SELECT * INTO c FROM public.e5_cobros WHERE id=a.cobro_id;
    SELECT value INTO p FROM jsonb_array_elements(c.detail->'propuestas')
      WHERE value->>'id'=a.propuesta_id::text;
    SELECT * INTO r FROM public.e5_recepciones WHERE id=a.cobro_id;
    IF p IS NULL OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(c.detail->'aplicaciones')
      WHERE value=a.snapshot) OR a.snapshot->>'id' IS DISTINCT FROM a.grupo_id::text
      OR a.snapshot->>'propuestaId' IS DISTINCT FROM a.propuesta_id::text
      OR (a.snapshot#>>'{actor,id}')::integer IS DISTINCT FROM a.actor_id
      OR (a.snapshot->>'fechaAplicacion')::timestamptz IS DISTINCT FROM a.fecha_aplicacion
      OR a.fecha_aplicacion<r.fecha_recepcion
      OR EXISTS (SELECT 1 FROM public.e5_aplicaciones b WHERE b.propuesta_id=a.propuesta_id
        AND (b.grupo_id<>a.grupo_id OR b.cobro_id<>a.cobro_id OR b.snapshot<>a.snapshot))
    THEN RAISE EXCEPTION 'E5: aprobación ADMIN/versión única'; END IF;
    SELECT coalesce(sum(importe),0) INTO total FROM public.e5_aplicaciones WHERE grupo_id=a.grupo_id;
    IF jsonb_typeof(a.snapshot->'asignaciones') IS DISTINCT FROM 'array'
      OR (SELECT count(*) FROM jsonb_array_elements(a.snapshot->'asignaciones')) <>
        (SELECT count(DISTINCT value->>'movimientoVentaId') FROM jsonb_array_elements(a.snapshot->'asignaciones'))
    THEN RAISE EXCEPTION 'E5: aprobación duplica movimiento exacto'; END IF;
    FOR x IN SELECT value FROM jsonb_array_elements(a.snapshot->'asignaciones') LOOP
      IF coalesce(x->>'importe','') !~ '^(0|[1-9][0-9]*)\.[0-9]{2}$'
        OR (x->>'importe')::numeric<=0 OR NOT EXISTS (SELECT 1 FROM public.e5_aplicaciones b
          WHERE b.grupo_id=a.grupo_id AND NOT b.favor
            AND b.movimiento_venta_id=(x->>'movimientoVentaId')::integer AND b.importe=(x->>'importe')::numeric)
      THEN RAISE EXCEPTION 'E5: asignación autorizada sin consumo exacto'; END IF;
    END LOOP;
    IF total IS DISTINCT FROM (a.snapshot->>'importe')::numeric
      OR total IS DISTINCT FROM (SELECT coalesce(sum((value->>'importe')::numeric),0)
        FROM jsonb_array_elements(a.snapshot->'asignaciones'))
        + coalesce((a.snapshot->>'importeFavorGenerado')::numeric,0)
    THEN RAISE EXCEPTION 'E5: consumo exacto de aprobación'; END IF;
    IF a.favor THEN
      IF a.importe IS DISTINCT FROM (a.snapshot->>'importeFavorGenerado')::numeric
        OR a.importe>coalesce((p->>'importeFavorPropuesto')::numeric,0)
      THEN RAISE EXCEPTION 'E5: favor no autorizado'; END IF;
    ELSE
      SELECT * INTO m FROM public.movimientos_credito WHERE id=a.movimiento_venta_id;
      IF m.cliente_id IS DISTINCT FROM r.cliente_id OR m.tipo::text IS DISTINCT FROM 'VENTA_CREDITO'
        OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(a.snapshot->'asignaciones') q(value)
          JOIN jsonb_array_elements(p->'asignaciones') s(value)
            ON q.value->>'movimientoVentaId'=s.value->>'movimientoVentaId' AND q.value->>'notaId'=s.value->>'notaId'
          WHERE (q.value->>'movimientoVentaId')::integer=a.movimiento_venta_id
            AND (q.value->>'notaId')::integer=m.ticket_id AND (q.value->>'importe')::numeric=a.importe
            AND a.importe<=(s.value->>'importe')::numeric)
      THEN RAISE EXCEPTION 'E5: destino exacto/subconjunto de propuesta'; END IF;
    END IF;
    SELECT mc.* INTO m FROM public.e5_vinculos_credito application_link
      JOIN public.movimientos_credito mc ON mc.id=application_link.movimiento_id
      WHERE application_link.aplicacion_id=a.id
        AND application_link.birth_xid=a.birth_xid;
    IF NOT FOUND OR m.operacion_productor IS DISTINCT FROM 'E5_APLICACION_RETENIDA'
      OR m.operacion_clave IS DISTINCT FROM a.id OR m.tipo::text IS DISTINCT FROM 'ABONO'
      OR m.naturaleza::text IS DISTINCT FROM 'OPERACION_CREDITO_SIN_DINERO'
      OR m.importe IS DISTINCT FROM -a.importe OR m.cliente_id IS DISTINCT FROM r.cliente_id
      OR m.usuario_id IS DISTINCT FROM a.actor_id OR m.created_at IS DISTINCT FROM a.fecha_aplicacion
      OR m.sitio_origen_id IS DISTINCT FROM r.ubicacion_id OR m.forma_pago IS NOT NULL
      OR m.cuenta_destino IS NOT NULL OR m.sesion_caja_id IS NOT NULL
      OR NOT EXISTS (SELECT 1 FROM public.e5_nacimientos WHERE tabla='movimientos_credito'
        AND clave=m.id::text AND birth_xid=a.birth_xid)
    THEN RAISE EXCEPTION 'E5: vínculo único crédito sin segundo ingreso'; END IF;
    IF EXISTS (SELECT 1 FROM public.movimientos_credito WHERE movimiento_origen_id=m.id)
    THEN RAISE EXCEPTION 'E5: reverso independiente de crédito aplicado prohibido'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.operaciones_credito_e1 op
      JOIN public.e5_nacimientos b ON b.tabla='operaciones_credito_e1'
        AND b.clave=op.productor||':'||op.clave::text AND b.birth_xid=a.birth_xid
      WHERE op.productor='E5_APLICACION_RETENIDA' AND op.clave=a.id
        AND op.naturaleza::text='OPERACION_CREDITO_SIN_DINERO' AND op.usuario_id=a.actor_id)
    THEN RAISE EXCEPTION 'E5: operación E1 propia exacta requerida'; END IF;
    IF a.favor THEN
      -- La emisión no paga destinos; FIFO futuro sí puede consumir este abono.
      -- Se compara procedencia persistida de cada INSERT, no el XID actual del
      -- validador ni xmin: forzar IMMEDIATE y escribir después no borra prueba.
      IF EXISTS (SELECT 1 FROM public.aplicaciones_credito ac
        LEFT JOIN public.e5_nacimientos b ON b.tabla='aplicaciones_credito' AND b.clave=ac.id::text
        WHERE ac.abono_movimiento_id=m.id AND
          (b.birth_xid IS NULL OR b.birth_xid=a.birth_xid))
        OR EXISTS (SELECT 1 FROM public.solicitudes_pago_dirigido WHERE movimiento_id=m.id)
      THEN RAISE EXCEPTION 'E5: emisión de favor sin aplicación ni marcador dirigido'; END IF;
      IF (SELECT coalesce(sum(importe),0) FROM public.aplicaciones_credito
        WHERE abono_movimiento_id=m.id)>a.importe OR EXISTS (
        SELECT 1 FROM public.aplicaciones_credito ac
        JOIN public.movimientos_credito sale ON sale.id=ac.venta_movimiento_id
        WHERE ac.abono_movimiento_id=m.id AND
          (ac.importe<=0 OR ac.importe>='Infinity'::numeric
          OR sale.tipo::text<>'VENTA_CREDITO' OR sale.cliente_id<>m.cliente_id))
      THEN RAISE EXCEPTION 'E5: evidencia FIFO futura excede fuente o cambia cliente'; END IF;
      -- Sin SUM por destino ni saldo dinámico. No reescribir aplicaciones
      -- históricas si la proyección canónica cambia por fecha efectiva.
    ELSE
      IF (SELECT count(*) FROM public.aplicaciones_credito WHERE abono_movimiento_id=m.id)<>1
        OR NOT EXISTS (SELECT 1 FROM public.aplicaciones_credito WHERE abono_movimiento_id=m.id
          AND venta_movimiento_id=a.movimiento_venta_id AND importe=a.importe)
        OR (SELECT count(*) FROM public.solicitudes_pago_dirigido WHERE movimiento_id=m.id)<>1
        OR NOT EXISTS (SELECT 1 FROM public.solicitudes_pago_dirigido WHERE movimiento_id=m.id
          AND tipo='CLIENTE' AND entidad_id=r.cliente_id AND documento_movimiento_id=a.movimiento_venta_id
          AND importe=a.importe AND estado='APROBADA' AND autorizador_id=a.actor_id
          AND forma_pago='APLICACION_SIN_DINERO' AND cuenta_destino IS NULL)
      THEN RAISE EXCEPTION 'E5: asignación/marker exacto una sola vez'; END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.e5_documentos WHERE cobro_id=a.cobro_id
      AND id=(a.snapshot->>'constanciaId')::uuid AND tipo='CONSTANCIA' AND birth_xid=a.birth_xid
      AND snapshot->'asignaciones'=a.snapshot->'asignaciones'
      AND (snapshot->>'importeDocumento')::numeric=total)
    THEN RAISE EXCEPTION 'E5: constancia propia requerida'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.e5_operaciones op WHERE op.cobro_id=a.cobro_id
      AND op.accion IN ('RECIBIR','AUTORIZAR') AND op.actor_id=a.actor_id
      AND op.birth_xid=a.birth_xid
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(op.response->'aplicaciones') WHERE value=a.snapshot)
      AND NOT EXISTS (SELECT 1 FROM public.e5_operaciones prevop,
        LATERAL jsonb_array_elements(prevop.response->'aplicaciones') history(value)
        WHERE prevop.cobro_id=op.cobro_id AND prevop.revision=op.revision-1 AND history.value=a.snapshot))
    THEN RAISE EXCEPTION 'E5: consumo sólo por autorización nueva/idempotente'; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.operaciones_credito_e1 op
    WHERE op.productor='E5_APLICACION_RETENIDA' AND NOT EXISTS (
      SELECT 1 FROM public.e5_aplicaciones app_source
      WHERE app_source.id=op.clave AND app_source.actor_id=op.usuario_id
        AND op.naturaleza::text='OPERACION_CREDITO_SIN_DINERO'))
  THEN RAISE EXCEPTION 'E5: operación E1 sin fuente propia'; END IF;
  IF EXISTS (SELECT 1 FROM public.movimientos_credito credit_source
    WHERE credit_source.operacion_productor='E5_APLICACION_RETENIDA' AND NOT EXISTS (
      SELECT 1 FROM public.e5_vinculos_credito credit_link
      JOIN public.e5_aplicaciones linked_application ON linked_application.id=credit_link.aplicacion_id
      WHERE credit_link.movimiento_id=credit_source.id
        AND linked_application.id=credit_source.operacion_clave))
  THEN RAISE EXCEPTION 'E5: crédito huérfano'; END IF;
  FOR d IN SELECT * FROM public.e5_devoluciones LOOP
    SELECT * INTO r FROM public.e5_recepciones WHERE id=d.cobro_id;
    SELECT * INTO c FROM public.e5_cobros WHERE id=d.cobro_id;
    IF d.importe<>r.importe OR EXISTS (SELECT 1 FROM public.e5_aplicaciones WHERE cobro_id=d.cobro_id)
      OR (c.detail#>>'{devolucion,importe}')::numeric IS DISTINCT FROM d.importe
      OR (c.detail#>>'{devolucion,actor,id}')::integer IS DISTINCT FROM d.actor_id
      OR (c.detail#>>'{devolucion,salidaId}')::integer IS DISTINCT FROM d.salida_id
      OR (c.detail#>>'{devolucion,movimientoFondoId}')::uuid IS DISTINCT FROM d.movimiento_fondo_id
      OR c.detail#>'{devolucion,fuente}' IS DISTINCT FROM d.fuente
      OR c.detail#>'{devolucion,evidencia}' IS DISTINCT FROM d.evidencia
      OR c.detail#>>'{devolucion,peticionCliente}' IS DISTINCT FROM d.peticion
    THEN RAISE EXCEPTION 'E5: devolución total ADMIN nunca aplicada'; END IF;
    IF d.fuente->>'tipo'='CAJA' THEN
      IF NOT EXISTS (SELECT 1 FROM public.salidas_dinero_caja s
        JOIN public.sesiones_caja sc ON sc.id=s.sesion_caja_id
        JOIN public.e5_nacimientos b ON b.tabla='salidas_dinero_caja' AND b.clave=s.id::text
        WHERE s.id=d.salida_id AND s.monto=d.importe AND s.creado_por_id=d.actor_id
          AND s.cuenta_origen='CAJA_FISICA' AND s.sesion_caja_id=(d.fuente->>'sesionCajaId')::integer
          AND sc.ubicacion_id=(d.fuente->>'ubicacionId')::integer AND b.birth_xid=d.birth_xid)
      THEN RAISE EXCEPTION 'E5: salida caja propia exacta requerida'; END IF;
    ELSIF d.fuente->>'tipo'='CUENTA' THEN
      IF NOT EXISTS (SELECT 1 FROM public.e5_salidas_bancarias s WHERE s.clave=d.clave
        AND s.cobro_id=d.cobro_id AND s.importe=d.importe AND s.actor_id=d.actor_id
        AND s.cuenta_origen=d.fuente->>'cuentaOrigen'
        AND s.ubicacion_id=(d.fuente->>'ubicacionId')::integer AND s.evidencia=d.evidencia
        AND jsonb_array_length(s.evidencia->'referencias')>0 AND s.birth_xid=d.birth_xid)
      THEN RAISE EXCEPTION 'E5: transferencia documentada propia requerida'; END IF;
    ELSE
      IF NOT EXISTS (SELECT 1 FROM public.fondo_movimientos f
        JOIN public.fondo_mariana fm ON fm.id=f.fondo_id
        JOIN public.ubicaciones u ON u.id=fm.ubicacion_id
        JOIN public.e5_nacimientos b ON b.tabla='fondo_movimientos' AND b.clave=f.id::text
        WHERE f.id=d.movimiento_fondo_id AND f.naturaleza='RETIRO' AND f.categoria='RETIRO'
          AND f.original_id IS NULL AND f.importe_centavos=d.importe*100 AND f.autor_id=d.actor_id
          AND f.idempotency_producer='FONDO_API_MOVIMIENTO_V1' AND f.conciliacion_inicial IS NULL
          AND upper(btrim(u.nombre))='MARIANA' AND u.tipo::text='TIENDA'
          AND fm.ubicacion_id=(d.fuente->>'ubicacionId')::integer AND b.birth_xid=d.birth_xid)
        OR EXISTS (SELECT 1 FROM public.fondo_movimientos WHERE original_id=d.movimiento_fondo_id)
      THEN RAISE EXCEPTION 'E5: retiro propio sin inverso ni remesa'; END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.e5_operaciones WHERE clave=d.clave AND cobro_id=d.cobro_id
      AND accion='DEVOLVER' AND actor_id=d.actor_id AND birth_xid=d.birth_xid)
    THEN RAISE EXCEPTION 'E5: devolución sin operación idempotente'; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.e5_salidas_bancarias s WHERE NOT EXISTS (
    SELECT 1 FROM public.e5_devoluciones bank_refund
    WHERE bank_refund.clave=s.clave AND bank_refund.fuente->>'tipo'='CUENTA'))
  THEN RAISE EXCEPTION 'E5: salida bancaria huérfana'; END IF;
  FOR v IN SELECT * FROM public.e5_documentos LOOP
    SELECT * INTO r FROM public.e5_recepciones WHERE id=v.cobro_id;
    FOREACH k IN ARRAY ARRAY['clienteNombre','ubicacionNombre','receptor','formaPago',
      'cuentaDestino','fechaRecepcion','importeRecibido','reciboId'] LOOP
      IF v.snapshot->k IS DISTINCT FROM r.snapshot->k
      THEN RAISE EXCEPTION 'E5: documento difiere de recepción (%)',k; END IF;
    END LOOP;
    IF v.tipo='CONSTANCIA' AND NOT EXISTS (SELECT 1 FROM public.e5_aplicaciones document_application
      WHERE document_application.cobro_id=v.cobro_id
        AND document_application.snapshot->>'constanciaId'=v.id::text
        AND v.snapshot->'autorizador'=document_application.snapshot->'actor'
        AND v.snapshot->'fechaAplicacion'=document_application.snapshot->'fechaAplicacion'
        AND v.snapshot->'evidencia'=document_application.snapshot->'evidencia'
        AND (v.snapshot->>'importeFavorGenerado')::numeric=
          coalesce((document_application.snapshot->>'importeFavorGenerado')::numeric,0))
    THEN RAISE EXCEPTION 'E5: constancia huérfana o alterada'; END IF;
  END LOOP;
  FOR o IN SELECT * FROM public.e5_operaciones ORDER BY cobro_id,revision LOOP
    SELECT * INTO r FROM public.e5_recepciones WHERE id=o.cobro_id;
    IF o.response->>'id' IS DISTINCT FROM o.cobro_id::text
      OR (o.response->>'revision')::integer IS DISTINCT FROM o.revision
    THEN RAISE EXCEPTION 'E5: respuesta idempotente no corresponde'; END IF;
    FOREACH k IN ARRAY ARRAY['clienteId','clienteNombre','ubicacionId','ubicacionNombre',
      'importeRecibido','fechaRecepcion','formaPago','cuentaDestino','sesionCajaId','sesionOperativaId',
      'receptor','notasIndicadas','evidenciaRecepcion','reciboId'] LOOP
      IF o.response->k IS DISTINCT FROM r.snapshot->k
      THEN RAISE EXCEPTION 'E5: respuesta histórica difiere de fuente (%)',k; END IF;
    END LOOP;
    SELECT coalesce(sum((value->>'importe')::numeric),0) INTO total
      FROM jsonb_array_elements(o.response->'aplicaciones');
    returned := coalesce((o.response#>>'{devolucion,importe}')::numeric,0);
    IF (o.response->>'importeAplicado')::numeric IS DISTINCT FROM total
      OR (o.response->>'importeDevuelto')::numeric IS DISTINCT FROM returned
      OR (o.response->>'importePendiente')::numeric IS DISTINCT FROM r.importe-total-returned
      OR (o.response->>'algunaVezAplicado')::boolean IS DISTINCT FROM (total>0)
      OR total+returned>r.importe OR (total>0 AND returned>0)
    THEN RAISE EXCEPTION 'E5: respuesta histórica viola conservación'; END IF;
    IF o.revision=1 THEN
      IF o.accion<>'RECIBIR' OR o.clave<>o.cobro_id
        OR o.actor_id<>r.actor_id OR o.birth_xid<>r.birth_xid
        OR jsonb_array_length(o.response->'rechazos')<>0 OR returned<>0
        OR jsonb_array_length(o.response->'propuestas')>1
        OR jsonb_array_length(o.response->'aplicaciones')>1
      THEN RAISE EXCEPTION 'E5: primera operación es recepción'; END IF;
    ELSE
      SELECT response INTO prev FROM public.e5_operaciones
        WHERE cobro_id=o.cobro_id AND revision=o.revision-1;
      IF prev IS NULL THEN RAISE EXCEPTION 'E5: historia sin predecesor'; END IF;
      IF (prev->>'importePendiente')::numeric<=0
        OR jsonb_array_length(o.response->'propuestas') <>
          jsonb_array_length(prev->'propuestas')+(CASE WHEN o.accion='PROPONER' THEN 1 ELSE 0 END)
        OR jsonb_array_length(o.response->'aplicaciones') <>
          jsonb_array_length(prev->'aplicaciones')+(CASE WHEN o.accion='AUTORIZAR' THEN 1 ELSE 0 END)
        OR jsonb_array_length(o.response->'rechazos') <>
          jsonb_array_length(prev->'rechazos')+(CASE WHEN o.accion='RECHAZAR' THEN 1 ELSE 0 END)
        OR (o.accion<>'DEVOLVER' AND o.response->'devolucion' IS DISTINCT FROM prev->'devolucion')
      THEN RAISE EXCEPTION 'E5: evento no corresponde a transición de historia'; END IF;
      FOREACH k IN ARRAY ARRAY['propuestas','aplicaciones','rechazos'] LOOP
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(prev->k) WITH ORDINALITY h(value,i)
          WHERE o.response->k->(h.i::integer-1) IS DISTINCT FROM h.value)
        THEN RAISE EXCEPTION 'E5: operación reescribe historia'; END IF;
      END LOOP;
      IF o.accion IN ('PROPONER','RECHAZAR') AND
        (o.response->'importeAplicado' IS DISTINCT FROM prev->'importeAplicado'
        OR o.response->'importePendiente' IS DISTINCT FROM prev->'importePendiente'
        OR o.response->'importeDevuelto' IS DISTINCT FROM prev->'importeDevuelto')
      THEN RAISE EXCEPTION 'E5: proponer/rechazar no mueve dinero'; END IF;
      IF o.accion='PROPONER' THEN
        x := o.response->'propuestas'->-1;
        IF o.response->>'propuestaVigenteId' IS DISTINCT FROM x->>'id'
          OR (x#>>'{actor,id}')::integer IS DISTINCT FROM o.actor_id
        THEN RAISE EXCEPTION 'E5: propuesta vigente/actor'; END IF;
      ELSIF o.accion IN ('AUTORIZAR','RECHAZAR','DEVOLVER') THEN
        IF o.response ? 'propuestaVigenteId'
        THEN RAISE EXCEPTION 'E5: propuesta resuelta no puede reutilizarse'; END IF;
        IF o.accion='RECHAZAR' THEN
          x := o.response->'rechazos'->-1;
          IF x->>'propuestaId' IS DISTINCT FROM prev->>'propuestaVigenteId'
            OR x->>'propuestaId' IS NULL OR nullif(btrim(x->>'motivo'),'') IS NULL
            OR (x#>>'{actor,id}')::integer IS DISTINCT FROM o.actor_id
          THEN RAISE EXCEPTION 'E5: rechazo sin propuesta vigente/evidencia'; END IF;
        END IF;
      ELSE
        RAISE EXCEPTION 'E5: recepción no repetible';
      END IF;
      IF o.accion='AUTORIZAR' AND NOT EXISTS (
        SELECT 1 FROM public.e5_aplicaciones authorized_application
        WHERE authorized_application.cobro_id=o.cobro_id
          AND authorized_application.birth_xid=o.birth_xid
          AND authorized_application.propuesta_id::text=prev->>'propuestaVigenteId'
          AND authorized_application.actor_id=o.actor_id)
      THEN RAISE EXCEPTION 'E5: autorización de propuesta vigente requerida'; END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END $_$;


--
-- Name: e5_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e5_immutable() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN RAISE EXCEPTION 'E5: evidencia inmutable; no UPDATE/DELETE/TRUNCATE'; END $$;


--
-- Name: e5_insert_authority(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e5_insert_authority() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE j jsonb := to_jsonb(NEW); s integer; site integer;
BEGIN
  IF TG_TABLE_NAME IN ('e5_aplicaciones','e5_devoluciones','e5_salidas_bancarias','e5_impresiones')
    OR (TG_TABLE_NAME='e5_operaciones' AND j->>'accion'<>'RECIBIR')
  THEN
    PERFORM 1 FROM public.usuarios WHERE id=(j->>'actor_id')::integer AND activo AND rol::text='ADMIN' FOR SHARE;
    IF NOT FOUND THEN
      IF TG_TABLE_NAME='e5_operaciones' AND j->>'accion'='PROPONER' THEN
        PERFORM public.e11_e5_a_validate(j,true);
      ELSE RAISE EXCEPTION 'E5: autoridad ADMIN actual requerida';
      END IF;
    END IF;
  END IF;
  IF TG_TABLE_NAME='e5_recepciones' AND j->>'medio'='EFECTIVO' THEN
    s := (j->>'sesion_caja_id')::integer; site := (j->>'ubicacion_id')::integer;
  ELSIF TG_TABLE_NAME='e5_devoluciones' AND j#>>'{fuente,tipo}'='CAJA' THEN
    s := (j#>>'{fuente,sesionCajaId}')::integer; site := (j#>>'{fuente,ubicacionId}')::integer;
  END IF;
  IF s IS NOT NULL THEN
    PERFORM 1 FROM public.sesiones_caja WHERE id=s AND ubicacion_id=site
      AND estado='ABIERTA' AND cerrada_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'E5: sesión física actual abierta requerida'; END IF;
  END IF;
  RETURN NEW;
END $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: movimientos_credito; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: e5_owned_credit_source(public.movimientos_credito); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e5_owned_credit_source(m public.movimientos_credito) RETURNS boolean
    LANGUAGE sql
    SET search_path TO 'pg_catalog'
    AS $$
  SELECT coalesce(
    m.operacion_productor='E5_APLICACION_RETENIDA' AND m.tipo::text='ABONO'
    AND m.importe<0 AND m.naturaleza::text='OPERACION_CREDITO_SIN_DINERO'
    AND m.forma_pago IS NULL AND m.cuenta_destino IS NULL AND m.sesion_caja_id IS NULL
    AND m.es_incobrable=false AND m.movimiento_origen_id IS NULL
    AND m.ticket_id IS NULL AND m.nota_origen_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.e5_aplicaciones a
      JOIN public.e5_recepciones r ON r.id=a.cobro_id
      JOIN public.usuarios u ON u.id=a.actor_id
      JOIN public.operaciones_credito_e1 op ON op.productor=m.operacion_productor AND op.clave=a.id
      JOIN public.e5_nacimientos b ON b.tabla='operaciones_credito_e1'
        AND b.clave=op.productor||':'||op.clave::text AND b.birth_xid=a.birth_xid
      WHERE a.id=m.operacion_clave AND a.birth_xid=pg_current_xact_id()
        AND a.actor_id=m.usuario_id AND u.activo AND u.rol::text='ADMIN'
        AND a.importe=-m.importe AND r.cliente_id=m.cliente_id AND r.ubicacion_id=m.sitio_origen_id
        AND m.created_at=a.fecha_aplicacion AND a.fecha_aplicacion>=r.fecha_recepcion
        AND op.usuario_id=a.actor_id AND op.naturaleza::text='OPERACION_CREDITO_SIN_DINERO'
        AND op.solicitud_canonica->>'cobroId'=r.id::text
        AND op.solicitud_canonica->'application'=a.snapshot
        AND op.solicitud_canonica#>>'{proposal,id}'=a.propuesta_id::text
        AND (op.solicitud_canonica#>>'{piece,importe}')::numeric=a.importe
        AND (op.solicitud_canonica#>>'{piece,favor}')::boolean=a.favor
        AND NOT EXISTS (SELECT 1 FROM public.e5_devoluciones WHERE cobro_id=a.cobro_id)
    ),false)
$$;


--
-- Name: e5_serialize(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e5_serialize() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN
  -- El adapter ya puede tener CUSTOMER_CREDIT/sesión/Fondo/aggregate antes
  -- del primer DML. NUNCA esperar este lock global detrás de ellos: otro
  -- escritor puede tenerlo y necesitar esos mismos locks en validadores.
  -- NOWAIT lógico: conflicto aborta la sentencia con serialization_failure.
  -- El llamador debe abortar/reintentar la transacción completa, nunca continuar
  -- sólo la sentencia; adapter transaccional propaga el error, no hace retry SQL.
  IF NOT pg_try_advisory_xact_lock(650005,5) THEN
    RAISE EXCEPTION USING ERRCODE='40001',
      MESSAGE='E5: grafo ocupado; abortar transacción completa, sin espera global';
  END IF;
  RETURN NULL;
END $$;


--
-- Name: e9_event_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e9_event_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM e9_operaciones WHERE entrega_id=NEW.id AND revision=NEW.revision AND response=NEW.detail)
  THEN RAISE EXCEPTION 'E9: falta operación inmutable de esta revisión'; END IF;
  RETURN NEW;
END; $$;


--
-- Name: e9_evidence_valid(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e9_evidence_valid(value jsonb) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT coalesce(jsonb_typeof(value)='object'
    AND jsonb_typeof(value->'descripcion')='string'
    AND length(btrim(value->>'descripcion')) BETWEEN 1 AND 2000
    AND jsonb_typeof(value->'referencias')='array',false)
$$;


--
-- Name: e9_fondo_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e9_fondo_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.original_id IS NOT NULL AND EXISTS (SELECT 1 FROM e9_entregas WHERE movimiento_fondo_id=NEW.original_id)
  THEN RAISE EXCEPTION 'E9: recepción inmutable; inverso independiente prohibido'; END IF;
  IF NEW.original_id IS NULL AND NEW.motivo LIKE 'Recepción E9 %'
    AND NOT EXISTS (SELECT 1 FROM e9_entregas WHERE movimiento_fondo_id=NEW.id)
  THEN RAISE EXCEPTION 'E9: ingreso huérfano sin recepción autorizada'; END IF;
  RETURN NEW;
END; $$;


--
-- Name: e9_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e9_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN RAISE EXCEPTION 'E9: evidencia inmutable; prohibido borrar, truncar o editar historial'; END; $$;


--
-- Name: e9_operation_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e9_operation_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM e9_entregas WHERE id=NEW.entrega_id AND revision=NEW.revision AND detail=NEW.response)
    OR NOT EXISTS (SELECT 1 FROM usuarios WHERE id=NEW.actor_id AND
      (rol::text='ADMIN' OR (rol::text='SUPERVISOR' AND NEW.accion='ENVIAR' AND ubicacion_id=(NEW.response->>'ubicacionId')::integer)))
    OR NEW.content::jsonb->>'action' IS DISTINCT FROM NEW.accion
    OR NOT coalesce(CASE NEW.accion
      WHEN 'ENVIAR' THEN NEW.revision=1 AND NEW.response->>'estado'='ENVIADA'
        AND (NEW.response#>>'{enviadoPor,id}')::integer=NEW.actor_id
      WHEN 'CONTAR' THEN NEW.response->>'estado'='CONTADA'
        AND (NEW.response->'conteos'->(jsonb_array_length(NEW.response->'conteos')-1)#>>'{actor,id}')::integer=NEW.actor_id
      WHEN 'AUTORIZAR' THEN NEW.response->>'estado'='AUTORIZADA'
        AND (NEW.response#>>'{autorizacion,actor,id}')::integer=NEW.actor_id
      WHEN 'CERRAR' THEN NEW.response#>>'{investigacion,estado}'='CERRADA_DOCUMENTAL'
        AND (NEW.response#>>'{investigacion,cierre,actor,id}')::integer=NEW.actor_id
      ELSE false END,false)
  THEN RAISE EXCEPTION 'E9: operación no corresponde a revisión y actor autorizado'; END IF;
  RETURN NEW;
END; $$;


--
-- Name: e9_validate_detail(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e9_validate_detail() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
  d jsonb := NEW.detail;
  oldd jsonb;
  n integer;
  c jsonb;
  s sesiones_caja%ROWTYPE;
  snapshots integer;
  counted numeric;
  role_value text;
  site integer;
BEGIN
  IF d ? 'fondo' THEN
    RAISE EXCEPTION 'E9: el ingreso al Fondo permanece cerrado';
  END IF;
  IF d->>'id' IS DISTINCT FROM NEW.id::text OR (d->>'corteId')::integer IS DISTINCT FROM NEW.corte_id
    OR (d->>'ubicacionId')::integer IS DISTINCT FROM NEW.ubicacion_id
    OR coalesce(d->>'importeEnviado','') !~ '^(0|[1-9][0-9]*)\.[0-9]{2}$'
    OR (d->>'importeEnviado')::numeric<=0
    OR jsonb_typeof(d->'conteos') IS DISTINCT FROM 'array'
    OR coalesce(d->>'estado','') NOT IN ('ENVIADA','CONTADA','AUTORIZADA')
    OR NOT e9_evidence_valid(d->'evidenciaEnvio')
  THEN RAISE EXCEPTION 'E9: estructura inválida'; END IF;
  n := jsonb_array_length(d->'conteos');
  IF TG_OP='INSERT' THEN
    SELECT * INTO STRICT s FROM sesiones_caja WHERE id=NEW.corte_id FOR UPDATE;
    IF s.estado::text<>'CERRADA' OR s.cerrada_at IS NULL OR s.ubicacion_id<>NEW.ubicacion_id
      OR NOT EXISTS (SELECT 1 FROM ubicaciones WHERE id=s.ubicacion_id AND tipo::text='TIENDA' AND activa)
    THEN RAISE EXCEPTION 'E9: cierre de tienda requerido'; END IF;
    SELECT count(*),min((datos_despues#>>'{cashSnapshot,efectivoContado}')::numeric)
      INTO snapshots,counted FROM auditoria WHERE accion='CERRAR_CAJA' AND entidad='sesiones_caja'
      AND entidad_id=s.id::text AND datos_despues ? 'cashSnapshot';
    IF snapshots<>1 OR counted IS DISTINCT FROM s.efectivo_contado OR counted IS DISTINCT FROM (d->>'importeEnviado')::numeric
      OR NOT EXISTS (SELECT 1 FROM auditoria WHERE accion='CERRAR_CAJA' AND entidad='sesiones_caja'
        AND entidad_id=s.id::text AND datos_despues#>>'{cashSnapshot,version}'='E2'
        AND (datos_despues#>>'{cashSnapshot,sesionId}')::integer=s.id)
      OR coalesce(d->>'versionCorte','') !~ '^e9:v1:[0-9a-f]{64}$'
      OR (d->>'fechaCorte')::timestamptz IS DISTINCT FROM s.cerrada_at
      OR d->>'fechaOperativa' IS DISTINCT FROM s.fecha_operativa::text
    THEN RAISE EXCEPTION 'E9: falta evidencia congelada canónica'; END IF;
    SELECT rol::text,ubicacion_id INTO role_value,site FROM usuarios WHERE id=(d#>>'{enviadoPor,id}')::integer;
    IF role_value IS NULL OR role_value NOT IN ('ADMIN','SUPERVISOR')
      OR (role_value='SUPERVISOR' AND site IS DISTINCT FROM NEW.ubicacion_id)
      OR NEW.revision<>1 OR n<>0 OR d->>'estado'<>'ENVIADA'
      OR d ?| ARRAY['autorizacion','fondo','investigacion','conteoVigenteId']
    THEN RAISE EXCEPTION 'E9: envío completo inicial inválido'; END IF;
    RETURN NEW;
  END IF;
  oldd := OLD.detail;
  IF NEW.id<>OLD.id OR NEW.corte_id<>OLD.corte_id OR NEW.ubicacion_id<>OLD.ubicacion_id
    OR NEW.created_at<>OLD.created_at OR NEW.revision<>OLD.revision+1
    OR (d-ARRAY['conteos','conteoVigenteId','estado','autorizacion','fondo','investigacion'])
      IS DISTINCT FROM (oldd-ARRAY['conteos','conteoVigenteId','estado','autorizacion','fondo','investigacion'])
  THEN RAISE EXCEPTION 'E9: origen e importe enviados son inmutables'; END IF;
  IF d->>'estado'='CONTADA' AND oldd->>'estado' IN ('ENVIADA','CONTADA') THEN
    IF n<>jsonb_array_length(oldd->'conteos')+1
      OR ((d->'conteos')-(n-1)) IS DISTINCT FROM oldd->'conteos'
      OR d ?| ARRAY['fondo','autorizacion']
    THEN RAISE EXCEPTION 'E9: conteos anteriores inmutables'; END IF;
    c := d->'conteos'->(n-1);
    IF NOT e9_evidence_valid(c->'evidencia') OR d->>'conteoVigenteId' IS DISTINCT FROM c->>'id'
      OR coalesce(c->>'importeRecibido','') !~ '^(0|[1-9][0-9]*)\.[0-9]{2}$'
      OR (c->>'diferencia')::numeric IS DISTINCT FROM ((c->>'importeRecibido')::numeric-(d->>'importeEnviado')::numeric)
      OR NOT EXISTS (SELECT 1 FROM usuarios WHERE id=(c#>>'{actor,id}')::integer AND rol::text='ADMIN')
      OR (oldd ? 'investigacion' AND d->'investigacion' IS DISTINCT FROM oldd->'investigacion')
      OR ((c->>'diferencia')::numeric<>0 AND coalesce(d#>>'{investigacion,estado}','')<>'ABIERTA')
    THEN RAISE EXCEPTION 'E9: conteo o investigación inválidos'; END IF;
  ELSIF d->>'estado'='AUTORIZADA' AND oldd->>'estado'='CONTADA' THEN
    IF d->'conteos' IS DISTINCT FROM oldd->'conteos'
      OR d->'conteoVigenteId' IS DISTINCT FROM oldd->'conteoVigenteId'
      OR d->'investigacion' IS DISTINCT FROM oldd->'investigacion'
      OR d#>>'{autorizacion,conteoId}' IS DISTINCT FROM oldd->>'conteoVigenteId'
      OR d ? 'fondo'
    THEN RAISE EXCEPTION 'E9: autorización requiere conteo vigente sin alterar historia'; END IF;
    c := oldd->'conteos'->(n-1);
    IF (c->>'importeRecibido')::numeric<=0
      OR d#>>'{autorizacion,importeRecibido}' IS DISTINCT FROM c->>'importeRecibido'
      OR NOT EXISTS (SELECT 1 FROM usuarios WHERE id=(d#>>'{autorizacion,actor,id}')::integer AND rol::text='ADMIN')
      OR ((c->>'diferencia')::numeric<>0 AND nullif(btrim(d#>>'{autorizacion,motivo}'),'') IS NULL)
    THEN RAISE EXCEPTION 'E9: recepción positiva ADMIN y motivada requerida'; END IF;
  ELSIF oldd->>'estado'='AUTORIZADA' AND d->>'estado'='AUTORIZADA' THEN
    IF (d-'investigacion') IS DISTINCT FROM (oldd-'investigacion')
      OR coalesce(oldd#>>'{investigacion,estado}','')<>'ABIERTA'
      OR coalesce(d#>>'{investigacion,estado}','')<>'CERRADA_DOCUMENTAL'
      -- Parentheses are required: without them PostgreSQL resolves the key
      -- literal `investigacion` as the jsonb operand of jsonb - text[].
      OR ((d->'investigacion')-ARRAY['estado','cierre']) IS DISTINCT FROM ((oldd->'investigacion')-ARRAY['estado','cierre'])
      OR nullif(btrim(d#>>'{investigacion,cierre,conclusion}'),'') IS NULL
      OR NOT e9_evidence_valid(d#>'{investigacion,cierre,evidencia}')
      OR NOT EXISTS (SELECT 1 FROM usuarios WHERE id=(d#>>'{investigacion,cierre,actor,id}')::integer AND rol::text='ADMIN')
    THEN RAISE EXCEPTION 'E9: cierre documental sin cambios financieros requerido'; END IF;
  ELSE RAISE EXCEPTION 'E9: transición no permitida'; END IF;
  RETURN NEW;
END; $_$;


--
-- Name: enriquecer_auditoria(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: fondo_assert_fixed_mariana(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: fondo_reject_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fondo_reject_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'FONDO_IMMUTABLE: % is append-only', TG_TABLE_NAME;
END $$;


--
-- Name: fondo_validate_audit(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: fondo_validate_movement(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: impedir_mutacion_credito_e1(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.impedir_mutacion_credito_e1() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  RAISE EXCEPTION 'E1: % sobre % está prohibido; evidencia inmutable', TG_OP, TG_TABLE_NAME;
END;
$$;


--
-- Name: prevent_financial_record_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_financial_record_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        RAISE EXCEPTION 'Los pagos y movimientos financieros son inmutables; registre un reverso o ajuste.';
      END $$;


--
-- Name: prevent_pago_proveedor_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_pago_proveedor_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'Los pagos a proveedor son inmutables; registre un reverso o ajuste.';
    END $$;


--
-- Name: proteger_aplicaciones_pago_proveedor(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.proteger_aplicaciones_pago_proveedor() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        RAISE EXCEPTION 'aplicaciones_pago_proveedor es append-only';
      END;
      $$;


--
-- Name: proteger_auditoria_append_only(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.proteger_auditoria_append_only() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
       BEGIN
         RAISE EXCEPTION 'auditoria es append-only';
       END;
       $$;


--
-- Name: proteger_auditoria_resolucion_append_only(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.proteger_auditoria_resolucion_append_only() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
        BEGIN
          RAISE EXCEPTION 'La evidencia y las decisiones de auditoría son append-only; registre un hecho nuevo.';
        END;
      $$;


--
-- Name: test_reset_history_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.test_reset_history_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
      RAISE EXCEPTION 'El historial de reinicios no admite borrado ni modificación';
    END $$;


--
-- Name: ticket_linea_consumos_guard(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: validar_aplicacion_pago_proveedor(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: validar_atribucion_credito_e1(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: validar_cobro_pendiente_e1(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: validar_contexto_credito_e1(integer, integer, public.naturaleza_credito_e1, public.forma_pago_cuenta, text, integer); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: validar_movimiento_credito_e1(); Type: FUNCTION; Schema: public; Owner: -
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
    OR (NEW.operacion_productor = 'E5_APLICACION_RETENIDA'
      AND public.e5_owned_credit_source(NEW))
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


--
-- Name: validar_revision_etiqueta_reimpresion(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: validate_credit_application(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: validate_credit_reversal(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: aplicaciones_credito; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aplicaciones_credito (
    id integer NOT NULL,
    abono_movimiento_id integer NOT NULL,
    venta_movimiento_id integer NOT NULL,
    importe numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT aplicaciones_credito_importe_check CHECK ((importe > (0)::numeric))
);


--
-- Name: aplicaciones_credito_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.aplicaciones_credito_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: aplicaciones_credito_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.aplicaciones_credito_id_seq OWNED BY public.aplicaciones_credito.id;


--
-- Name: aplicaciones_pago_proveedor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aplicaciones_pago_proveedor (
    id integer NOT NULL,
    pago_proveedor_id integer NOT NULL,
    compra_proveedor_id integer NOT NULL,
    importe numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT aplicaciones_pago_proveedor_importe_check CHECK ((importe > (0)::numeric))
);


--
-- Name: aplicaciones_pago_proveedor_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.aplicaciones_pago_proveedor_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: aplicaciones_pago_proveedor_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.aplicaciones_pago_proveedor_id_seq OWNED BY public.aplicaciones_pago_proveedor.id;


--
-- Name: atribuciones_credito_e1; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: auditoria; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: auditoria_faltante_reactivaciones; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: auditoria_faltante_reactivaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auditoria_faltante_reactivaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditoria_faltante_reactivaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auditoria_faltante_reactivaciones_id_seq OWNED BY public.auditoria_faltante_reactivaciones.id;


--
-- Name: auditoria_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auditoria_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditoria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auditoria_id_seq OWNED BY public.auditoria.id;


--
-- Name: auditoria_inventario_escaneos; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: auditoria_inventario_folio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria_inventario_folio (
    ubicacion_id integer NOT NULL,
    ultimo_folio integer DEFAULT 0 NOT NULL
);


--
-- Name: auditoria_inventario_participantes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria_inventario_participantes (
    auditoria_id integer NOT NULL,
    usuario_id integer NOT NULL,
    escaneos integer DEFAULT 0 NOT NULL,
    primero_at timestamp with time zone DEFAULT now() NOT NULL,
    ultimo_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auditoria_inventario_snapshot; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: auditoria_sobrante_contextos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria_sobrante_contextos (
    auditoria_id integer NOT NULL,
    serie text NOT NULL,
    contexto jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auditoria_sobrante_decisiones; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: auditoria_sobrante_decisiones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auditoria_sobrante_decisiones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditoria_sobrante_decisiones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auditoria_sobrante_decisiones_id_seq OWNED BY public.auditoria_sobrante_decisiones.id;


--
-- Name: auditorias_inventario; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: auditorias_inventario_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auditorias_inventario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditorias_inventario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auditorias_inventario_id_seq OWNED BY public.auditorias_inventario.id;


--
-- Name: autorizaciones_nota; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.autorizaciones_nota (
    id integer NOT NULL,
    ticket_id integer NOT NULL,
    sesion_caja_id integer NOT NULL,
    usuario_id integer NOT NULL,
    movimiento_credito_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: autorizaciones_nota_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.autorizaciones_nota_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: autorizaciones_nota_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.autorizaciones_nota_id_seq OWNED BY public.autorizaciones_nota.id;


--
-- Name: caja_desbloqueos_e12; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caja_desbloqueos_e12 (
    salida_id integer NOT NULL,
    evidencia jsonb NOT NULL,
    CONSTRAINT caja_desbloqueos_e12_evidencia_check CHECK ((((jsonb_typeof(evidencia) = 'object'::text) AND (evidencia ?& ARRAY['motivo'::text, 'usuarioId'::text, 'createdAt'::text, 'saldoAntes'::text, 'egreso'::text]) AND ((char_length(btrim((evidencia ->> 'motivo'::text))) >= 1) AND (char_length(btrim((evidencia ->> 'motivo'::text))) <= 1000)) AND (((evidencia ->> 'saldoAntes'::text))::numeric < ((evidencia ->> 'egreso'::text))::numeric)) IS TRUE))
);


--
-- Name: caja_retornos_proveedor_e12; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caja_retornos_proveedor_e12 (
    id integer NOT NULL,
    sesion_caja_id integer NOT NULL,
    pago_proveedor_id integer NOT NULL,
    importe numeric(12,2) NOT NULL,
    naturaleza text NOT NULL,
    usuario_id integer NOT NULL,
    motivo text NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT caja_retornos_proveedor_e12_importe_check CHECK ((importe > (0)::numeric)),
    CONSTRAINT caja_retornos_proveedor_e12_motivo_check CHECK (((char_length(btrim(motivo)) >= 1) AND (char_length(btrim(motivo)) <= 1000))),
    CONSTRAINT caja_retornos_proveedor_e12_naturaleza_check CHECK ((naturaleza = ANY (ARRAY['CORRECCION_CAPTURA'::text, 'RECUPERACION_EFECTIVO'::text])))
);


--
-- Name: caja_retornos_proveedor_e12_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.caja_retornos_proveedor_e12_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: caja_retornos_proveedor_e12_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.caja_retornos_proveedor_e12_id_seq OWNED BY public.caja_retornos_proveedor_e12.id;


--
-- Name: caja_salidas_e4; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caja_salidas_e4 (
    salida_id integer NOT NULL,
    revision jsonb NOT NULL,
    CONSTRAINT caja_salidas_e4_shape CHECK ((((jsonb_typeof(revision) = 'object'::text) AND (revision ?& ARRAY['tipo'::text, 'estado'::text, 'version'::text, 'claveOperacion'::text, 'historial'::text]) AND ((revision ->> 'tipo'::text) = ANY (ARRAY['EXTRAORDINARIA'::text, 'PROVEEDOR'::text])) AND ((revision ->> 'estado'::text) = ANY (ARRAY['PENDIENTE'::text, 'RECLAMADA'::text, 'RESPONDIDA'::text, 'ACEPTADA'::text, 'NO_APLICA'::text])) AND (jsonb_typeof((revision -> 'version'::text)) = 'number'::text) AND (((revision ->> 'version'::text))::integer >= 0) AND (jsonb_typeof((revision -> 'historial'::text)) = 'array'::text) AND (jsonb_array_length((revision -> 'historial'::text)) = ((revision ->> 'version'::text))::integer) AND ((revision ->> 'claveOperacion'::text) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'::text) AND ((((revision ->> 'tipo'::text) = 'PROVEEDOR'::text) AND ((revision ->> 'estado'::text) = 'NO_APLICA'::text) AND (((revision ->> 'version'::text))::integer = 0)) OR (((revision ->> 'tipo'::text) = 'EXTRAORDINARIA'::text) AND ((revision ->> 'estado'::text) <> 'NO_APLICA'::text)))) IS TRUE))
);


--
-- Name: caja_salidas_e4_operaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caja_salidas_e4_operaciones (
    clave uuid NOT NULL,
    salida_id integer NOT NULL,
    actor_id integer NOT NULL,
    request text NOT NULL,
    response jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT caja_salidas_e4_operaciones_request_check CHECK ((length(request) > 0)),
    CONSTRAINT caja_salidas_e4_operaciones_response_check CHECK ((jsonb_typeof(response) = 'object'::text))
);


--
-- Name: camionetas; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: camionetas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.camionetas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: camionetas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.camionetas_id_seq OWNED BY public.camionetas.id;


--
-- Name: choferes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.choferes (
    id integer NOT NULL,
    nombre_completo text NOT NULL,
    telefono text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: choferes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.choferes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: choferes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.choferes_id_seq OWNED BY public.choferes.id;


--
-- Name: cliente_documentos; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: cliente_documentos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cliente_documentos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cliente_documentos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cliente_documentos_id_seq OWNED BY public.cliente_documentos.id;


--
-- Name: clientes; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: clientes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clientes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clientes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clientes_id_seq OWNED BY public.clientes.id;


--
-- Name: cobros_credito_pendientes_e1; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: contenedor_lineas; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: contenedor_lineas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contenedor_lineas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contenedor_lineas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contenedor_lineas_id_seq OWNED BY public.contenedor_lineas.id;


--
-- Name: contenedores; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: contenedores_folio_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contenedores_folio_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contenedores_folio_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contenedores_folio_seq OWNED BY public.contenedores.folio;


--
-- Name: contenedores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contenedores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contenedores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contenedores_id_seq OWNED BY public.contenedores.id;


--
-- Name: cuadre_fiscal_registros; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: cuadre_fiscal_registros_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cuadre_fiscal_registros_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cuadre_fiscal_registros_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cuadre_fiscal_registros_id_seq OWNED BY public.cuadre_fiscal_registros.id;


--
-- Name: e11_avisos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e11_avisos (
    id uuid NOT NULL,
    conciliacion_id uuid NOT NULL,
    decision_id uuid NOT NULL,
    birth_xid xid8 NOT NULL
);


--
-- Name: e11_cambios_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e11_cambios_usuario (
    usuario_id integer NOT NULL,
    birth_xid xid8 NOT NULL,
    rol_anterior text NOT NULL,
    activo_anterior boolean NOT NULL,
    rol_posterior text NOT NULL,
    activo_posterior boolean NOT NULL
);


--
-- Name: e11_conciliacion_ventas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e11_conciliacion_ventas (
    conciliacion_id uuid NOT NULL,
    venta_id integer NOT NULL,
    datos jsonb NOT NULL,
    birth_xid xid8 NOT NULL,
    CONSTRAINT e11_conciliacion_ventas_datos_check CHECK ((jsonb_typeof(datos) = 'object'::text))
);


--
-- Name: e11_conciliaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e11_conciliaciones (
    id uuid NOT NULL,
    tipo text NOT NULL,
    inicio date NOT NULL,
    revision integer NOT NULL,
    anterior_id uuid,
    actor_id integer NOT NULL,
    perfil_version integer NOT NULL,
    datos jsonb NOT NULL,
    birth_xid xid8 NOT NULL,
    CONSTRAINT e11_conciliaciones_check CHECK (((revision = 1) = (anterior_id IS NULL))),
    CONSTRAINT e11_conciliaciones_datos_check CHECK ((jsonb_typeof(datos) = 'object'::text)),
    CONSTRAINT e11_conciliaciones_inicio_check CHECK (isfinite(inicio)),
    CONSTRAINT e11_conciliaciones_perfil_version_check CHECK ((perfil_version >= 0)),
    CONSTRAINT e11_conciliaciones_revision_check CHECK ((revision >= 1)),
    CONSTRAINT e11_conciliaciones_tipo_check CHECK ((tipo = ANY (ARRAY['DIA'::text, 'SEMANA'::text, 'MES'::text])))
);


--
-- Name: e11_decisiones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e11_decisiones (
    id uuid NOT NULL,
    conciliacion_id uuid NOT NULL,
    actor_id integer NOT NULL,
    perfil_version integer NOT NULL,
    uuid uuid NOT NULL,
    datos jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    birth_xid xid8 NOT NULL,
    CONSTRAINT e11_decisiones_created_at_check CHECK (isfinite(created_at)),
    CONSTRAINT e11_decisiones_datos_check CHECK ((jsonb_typeof(datos) = 'object'::text)),
    CONSTRAINT e11_decisiones_perfil_version_check CHECK ((perfil_version >= 0))
);


--
-- Name: e11_e5_definiciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e11_e5_definiciones (
    firma text NOT NULL,
    definicion text NOT NULL,
    hash_original text NOT NULL,
    hash_instalado text NOT NULL,
    CONSTRAINT e11_e5_definiciones_hash_instalado_check CHECK ((hash_instalado ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT e11_e5_definiciones_hash_original_check CHECK ((hash_original ~ '^[0-9a-f]{64}$'::text))
);


--
-- Name: e11_e5_preparaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e11_e5_preparaciones (
    clave uuid NOT NULL,
    actor_id integer NOT NULL,
    cobro_id uuid NOT NULL,
    perfil_version integer NOT NULL,
    birth_xid xid8 NOT NULL,
    CONSTRAINT e11_e5_preparaciones_perfil_version_check CHECK ((perfil_version >= 1))
);


--
-- Name: e11_notificacion_origen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e11_notificacion_origen (
    notificacion_id integer NOT NULL,
    birth_xid xid8 NOT NULL
);


--
-- Name: e11_operaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e11_operaciones (
    actor_id integer NOT NULL,
    operacion text NOT NULL,
    uuid uuid NOT NULL,
    solicitud_hash text NOT NULL,
    respuesta jsonb NOT NULL,
    birth_xid xid8 NOT NULL,
    estado text DEFAULT 'CONFIRMADA'::text NOT NULL,
    CONSTRAINT e11_operaciones_estado_check CHECK ((estado = ANY (ARRAY['CONFIRMADA'::text, 'CERRADA_SIN_EFECTO'::text]))),
    CONSTRAINT e11_operaciones_operacion_check CHECK ((operacion = ANY (ARRAY['PERFIL'::text, 'SNAPSHOT'::text, 'DECISION'::text, 'PREPARACION'::text]))),
    CONSTRAINT e11_operaciones_respuesta_check CHECK ((jsonb_typeof(respuesta) = 'object'::text)),
    CONSTRAINT e11_operaciones_solicitud_hash_check CHECK ((solicitud_hash ~ '^[0-9a-f]{64}$'::text))
);


--
-- Name: e11_perfil_eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e11_perfil_eventos (
    id uuid NOT NULL,
    usuario_id integer NOT NULL,
    actor_id integer NOT NULL,
    revision integer NOT NULL,
    uuid uuid NOT NULL,
    datos jsonb NOT NULL,
    birth_xid xid8 NOT NULL,
    CONSTRAINT e11_perfil_eventos_datos_check CHECK ((jsonb_typeof(datos) = 'object'::text)),
    CONSTRAINT e11_perfil_eventos_revision_check CHECK ((revision >= 1))
);


--
-- Name: e11_perfiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e11_perfiles (
    usuario_id integer NOT NULL,
    perfil text,
    version integer NOT NULL,
    actor_id integer NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    birth_xid xid8 NOT NULL,
    CONSTRAINT e11_perfiles_perfil_check CHECK ((perfil = ANY (ARRAY['A'::text, 'F'::text]))),
    CONSTRAINT e11_perfiles_updated_at_check CHECK (isfinite(updated_at)),
    CONSTRAINT e11_perfiles_version_check CHECK ((version >= 1))
);


--
-- Name: e11_resoluciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e11_resoluciones (
    id uuid NOT NULL,
    actor_original_id integer NOT NULL,
    accion text NOT NULL,
    uuid_original uuid NOT NULL,
    admin_id integer NOT NULL,
    uuid_resolutor uuid NOT NULL,
    solicitud_hash text NOT NULL,
    revision_anterior text NOT NULL,
    identidad_version text NOT NULL,
    motivo text NOT NULL,
    estado text NOT NULL,
    respuesta jsonb NOT NULL,
    created_at timestamp with time zone NOT NULL,
    birth_xid xid8 NOT NULL,
    CONSTRAINT e11_resoluciones_accion_check CHECK ((accion = ANY (ARRAY['PERFIL'::text, 'SNAPSHOT'::text, 'DECISION'::text, 'PREPARACION'::text]))),
    CONSTRAINT e11_resoluciones_created_at_check CHECK (isfinite(created_at)),
    CONSTRAINT e11_resoluciones_estado_check CHECK ((estado = ANY (ARRAY['CONFIRMADA'::text, 'CERRADA_SIN_EFECTO'::text]))),
    CONSTRAINT e11_resoluciones_identidad_version_check CHECK ((identidad_version ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT e11_resoluciones_motivo_check CHECK (((motivo = btrim(motivo)) AND ((length(motivo) >= 1) AND (length(motivo) <= 500)))),
    CONSTRAINT e11_resoluciones_respuesta_check CHECK ((jsonb_typeof(respuesta) = 'object'::text)),
    CONSTRAINT e11_resoluciones_revision_anterior_check CHECK ((revision_anterior ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT e11_resoluciones_solicitud_hash_check CHECK ((solicitud_hash ~ '^[0-9a-f]{64}$'::text))
);


--
-- Name: e5_aplicaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e5_aplicaciones (
    id uuid NOT NULL,
    cobro_id uuid NOT NULL,
    grupo_id uuid NOT NULL,
    propuesta_id uuid NOT NULL,
    movimiento_venta_id integer,
    importe numeric(12,2) NOT NULL,
    favor boolean NOT NULL,
    actor_id integer NOT NULL,
    fecha_aplicacion timestamp with time zone NOT NULL,
    snapshot jsonb NOT NULL,
    birth_xid xid8 NOT NULL,
    CONSTRAINT e5_aplicaciones_check CHECK ((favor = (movimiento_venta_id IS NULL))),
    CONSTRAINT e5_aplicaciones_fecha_aplicacion_check CHECK (isfinite(fecha_aplicacion)),
    CONSTRAINT e5_aplicaciones_importe_check CHECK (((importe > (0)::numeric) AND (importe < 'Infinity'::numeric))),
    CONSTRAINT e5_aplicaciones_snapshot_check CHECK ((jsonb_typeof(snapshot) = 'object'::text))
);


--
-- Name: e5_cobros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e5_cobros (
    id uuid NOT NULL,
    cliente_id integer NOT NULL,
    ubicacion_id integer NOT NULL,
    revision integer NOT NULL,
    detail jsonb NOT NULL,
    CONSTRAINT e5_cobros_detail_check CHECK ((jsonb_typeof(detail) = 'object'::text)),
    CONSTRAINT e5_cobros_revision_check CHECK ((revision > 0))
);


--
-- Name: e5_ddl_originales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e5_ddl_originales (
    objeto text NOT NULL,
    definicion text NOT NULL,
    CONSTRAINT e5_ddl_originales_definicion_check CHECK ((length(definicion) > 0))
);


--
-- Name: e5_devoluciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e5_devoluciones (
    clave uuid NOT NULL,
    cobro_id uuid NOT NULL,
    actor_id integer NOT NULL,
    fuente jsonb NOT NULL,
    importe numeric(12,2) NOT NULL,
    peticion text NOT NULL,
    evidencia jsonb NOT NULL,
    salida_id integer,
    movimiento_fondo_id uuid,
    birth_xid xid8 NOT NULL,
    CONSTRAINT e5_devoluciones_check CHECK (COALESCE(((((fuente ->> 'tipo'::text) = 'CAJA'::text) AND (salida_id IS NOT NULL) AND (movimiento_fondo_id IS NULL) AND ((fuente ->> 'cuentaOrigen'::text) = 'CAJA_FISICA'::text) AND (fuente ? 'sesionCajaId'::text) AND (NOT (fuente ? 'sesionOperativaId'::text))) OR (((fuente ->> 'tipo'::text) = 'CUENTA'::text) AND (salida_id IS NULL) AND (movimiento_fondo_id IS NULL) AND ((fuente ->> 'cuentaOrigen'::text) = ANY (ARRAY['CUENTA_FISCAL'::text, 'CUENTA_NO_FISCAL'::text])) AND (NOT (fuente ?| ARRAY['sesionCajaId'::text, 'sesionOperativaId'::text]))) OR (((fuente ->> 'tipo'::text) = 'FONDO'::text) AND (salida_id IS NULL) AND (movimiento_fondo_id IS NOT NULL) AND (NOT (fuente ?| ARRAY['sesionCajaId'::text, 'sesionOperativaId'::text, 'cuentaOrigen'::text])))), false)),
    CONSTRAINT e5_devoluciones_evidencia_check CHECK ((jsonb_typeof(evidencia) = 'object'::text)),
    CONSTRAINT e5_devoluciones_fuente_check CHECK ((jsonb_typeof(fuente) = 'object'::text)),
    CONSTRAINT e5_devoluciones_importe_check CHECK (((importe > (0)::numeric) AND (importe < 'Infinity'::numeric))),
    CONSTRAINT e5_devoluciones_peticion_check CHECK (((length(btrim(peticion)) >= 1) AND (length(btrim(peticion)) <= 2000)))
);


--
-- Name: e5_documentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e5_documentos (
    id uuid NOT NULL,
    cobro_id uuid NOT NULL,
    tipo text NOT NULL,
    snapshot jsonb NOT NULL,
    birth_xid xid8 NOT NULL,
    CONSTRAINT e5_documentos_check CHECK (((NOT ((snapshot ->> 'id'::text) IS DISTINCT FROM (id)::text)) AND (NOT ((snapshot ->> 'cobroId'::text) IS DISTINCT FROM (cobro_id)::text)) AND (NOT ((snapshot ->> 'tipo'::text) IS DISTINCT FROM tipo)))),
    CONSTRAINT e5_documentos_snapshot_check CHECK ((jsonb_typeof(snapshot) = 'object'::text)),
    CONSTRAINT e5_documentos_tipo_check CHECK ((tipo = ANY (ARRAY['RECIBO'::text, 'CONSTANCIA'::text])))
);


--
-- Name: e5_impresiones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e5_impresiones (
    clave uuid NOT NULL,
    documento_id uuid NOT NULL,
    actor_id integer NOT NULL,
    content text NOT NULL,
    motivo text NOT NULL,
    birth_xid xid8 NOT NULL,
    CONSTRAINT e5_impresiones_content_check CHECK ((length(content) > 0)),
    CONSTRAINT e5_impresiones_motivo_check CHECK (((length(btrim(motivo)) >= 1) AND (length(btrim(motivo)) <= 500)))
);


--
-- Name: e5_nacimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e5_nacimientos (
    tabla text NOT NULL,
    clave text NOT NULL,
    birth_xid xid8 NOT NULL
);


--
-- Name: e5_operaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e5_operaciones (
    clave uuid NOT NULL,
    cobro_id uuid NOT NULL,
    revision integer NOT NULL,
    accion text NOT NULL,
    actor_id integer NOT NULL,
    content text NOT NULL,
    response jsonb NOT NULL,
    birth_xid xid8 NOT NULL,
    CONSTRAINT e5_operaciones_accion_check CHECK ((accion = ANY (ARRAY['RECIBIR'::text, 'PROPONER'::text, 'AUTORIZAR'::text, 'RECHAZAR'::text, 'DEVOLVER'::text]))),
    CONSTRAINT e5_operaciones_content_check CHECK ((length(content) > 0)),
    CONSTRAINT e5_operaciones_response_check CHECK ((jsonb_typeof(response) = 'object'::text)),
    CONSTRAINT e5_operaciones_revision_check CHECK ((revision > 0))
);


--
-- Name: e5_recepciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e5_recepciones (
    id uuid NOT NULL,
    cliente_id integer NOT NULL,
    ubicacion_id integer NOT NULL,
    importe numeric(12,2) NOT NULL,
    fecha_recepcion timestamp with time zone NOT NULL,
    medio text NOT NULL,
    cuenta_destino text NOT NULL,
    sesion_caja_id integer,
    actor_id integer NOT NULL,
    snapshot jsonb NOT NULL,
    birth_xid xid8 NOT NULL,
    CONSTRAINT e5_recepciones_check CHECK ((((medio = 'EFECTIVO'::text) AND (cuenta_destino = 'CAJA_FISICA'::text) AND (sesion_caja_id IS NOT NULL)) OR ((medio = 'TRANSFERENCIA'::text) AND (cuenta_destino = ANY (ARRAY['CUENTA_FISCAL'::text, 'CUENTA_NO_FISCAL'::text])) AND (sesion_caja_id IS NULL)))),
    CONSTRAINT e5_recepciones_fecha_recepcion_check CHECK (isfinite(fecha_recepcion)),
    CONSTRAINT e5_recepciones_importe_check CHECK (((importe > (0)::numeric) AND (importe < 'Infinity'::numeric))),
    CONSTRAINT e5_recepciones_medio_check CHECK ((medio = ANY (ARRAY['EFECTIVO'::text, 'TRANSFERENCIA'::text]))),
    CONSTRAINT e5_recepciones_snapshot_check CHECK ((jsonb_typeof(snapshot) = 'object'::text))
);


--
-- Name: e5_salidas_bancarias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e5_salidas_bancarias (
    clave uuid NOT NULL,
    cobro_id uuid NOT NULL,
    ubicacion_id integer NOT NULL,
    cuenta_origen text NOT NULL,
    importe numeric(12,2) NOT NULL,
    actor_id integer NOT NULL,
    evidencia jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT transaction_timestamp() NOT NULL,
    birth_xid xid8 NOT NULL,
    CONSTRAINT e5_salidas_bancarias_cuenta_origen_check CHECK ((cuenta_origen = ANY (ARRAY['CUENTA_FISCAL'::text, 'CUENTA_NO_FISCAL'::text]))),
    CONSTRAINT e5_salidas_bancarias_evidencia_check CHECK ((jsonb_typeof(evidencia) = 'object'::text)),
    CONSTRAINT e5_salidas_bancarias_importe_check CHECK (((importe > (0)::numeric) AND (importe < 'Infinity'::numeric)))
);


--
-- Name: e5_vinculos_credito; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e5_vinculos_credito (
    aplicacion_id uuid NOT NULL,
    movimiento_id integer NOT NULL,
    birth_xid xid8 NOT NULL
);


--
-- Name: e9_entregas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e9_entregas (
    id uuid NOT NULL,
    corte_id integer NOT NULL,
    ubicacion_id integer NOT NULL,
    revision integer NOT NULL,
    detail jsonb NOT NULL,
    movimiento_fondo_id uuid GENERATED ALWAYS AS (((detail #>> '{fondo,movimientoId}'::text[]))::uuid) STORED,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT e9_entregas_detail_check CHECK ((jsonb_typeof(detail) = 'object'::text)),
    CONSTRAINT e9_entregas_revision_check CHECK ((revision > 0))
);


--
-- Name: e9_operaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.e9_operaciones (
    clave uuid NOT NULL,
    entrega_id uuid NOT NULL,
    revision integer NOT NULL,
    actor_id integer NOT NULL,
    accion text NOT NULL,
    content text NOT NULL,
    response jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT e9_operaciones_accion_check CHECK ((accion = ANY (ARRAY['ENVIAR'::text, 'CONTAR'::text, 'AUTORIZAR'::text, 'CERRAR'::text]))),
    CONSTRAINT e9_operaciones_revision_check CHECK ((revision > 0))
);


--
-- Name: entrada_folio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entrada_folio (
    ultimo_folio integer DEFAULT 0 NOT NULL,
    ubicacion_id integer NOT NULL
);


--
-- Name: entradas; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: entradas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.entradas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: entradas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.entradas_id_seq OWNED BY public.entradas.id;


--
-- Name: equipos; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: equipos_checklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipos_checklist (
    equipo_id integer NOT NULL,
    item_key text NOT NULL,
    checked_por integer NOT NULL,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipos_checklist_item_key_check CHECK ((item_key = ANY (ARRAY['PAPEL_NAVEGADOR_80MM'::text, 'MARGENES_NINGUNO'::text, 'ESCALA_REAL'::text, 'IMPRESORA_PREDETERMINADA'::text, 'ENTRADA_REAL'::text, 'PAPEL_NAVEGADOR_CARTA'::text, 'SALIDA_REAL'::text, 'NOTA_REAL'::text, 'PAPEL_NAVEGADOR_A5'::text, 'PAPEL_COLOR_SITIO_BANDEJA'::text, 'ETIQUETA_REAL'::text, 'MEDIDA_100X70'::text, 'TICKET_REAL'::text, 'PAPEL_80MM'::text, 'TECLADO_ESPANOL'::text, 'QR_ROLLO'::text, 'SESION_CAMARA'::text])))
);


--
-- Name: equipos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.equipos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: equipos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.equipos_id_seq OWNED BY public.equipos.id;


--
-- Name: evidencia_no_aplicada_e2; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: existencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.existencias (
    producto_id integer NOT NULL,
    ubicacion_id integer NOT NULL,
    cantidad_total numeric(10,3) DEFAULT '0'::numeric NOT NULL,
    rollos_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: finalizaciones_abono_e2; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: fondo_arqueos; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: fondo_mariana; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fondo_mariana (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    ubicacion_id integer NOT NULL,
    nombre text DEFAULT 'Fondo de Mariana'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fondo_mariana_nombre_check CHECK ((nombre = 'Fondo de Mariana'::text))
);


--
-- Name: fondo_movimientos; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: fondo_movimientos_ordinal_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fondo_movimientos_ordinal_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fondo_movimientos_ordinal_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fondo_movimientos_ordinal_seq OWNED BY public.fondo_movimientos.ordinal;


--
-- Name: movimientos; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: movimientos_credito_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.movimientos_credito_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: movimientos_credito_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.movimientos_credito_id_seq OWNED BY public.movimientos_credito.id;


--
-- Name: movimientos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.movimientos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: movimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.movimientos_id_seq OWNED BY public.movimientos.id;


--
-- Name: notificaciones_credito; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: notificaciones_credito_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notificaciones_credito_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notificaciones_credito_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notificaciones_credito_id_seq OWNED BY public.notificaciones_credito.id;


--
-- Name: notificaciones_sistema; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: notificaciones_sistema_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notificaciones_sistema_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notificaciones_sistema_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notificaciones_sistema_id_seq OWNED BY public.notificaciones_sistema.id;


--
-- Name: operaciones_credito_e1; Type: TABLE; Schema: public; Owner: -
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
    CONSTRAINT operaciones_productor_naturaleza_ck_e1 CHECK ((((productor = ANY (ARRAY['VENTA_CREDITO'::text, 'CANCELACION_VENTA_CREDITO'::text])) AND (naturaleza = 'OPERACION_CREDITO_SIN_DINERO'::public.naturaleza_credito_e1)) OR ((productor = ANY (ARRAY['AJUSTE_MANUAL'::text, 'BAJA_INCOBRABLE'::text])) AND (naturaleza = 'CORRECCION_CONTABLE'::public.naturaleza_credito_e1)) OR ((productor = ANY (ARRAY['ABONO_ORDINARIO'::text, 'ABONO_DIRIGIDO'::text])) AND (naturaleza = ANY (ARRAY['INGRESO_FISICO'::public.naturaleza_credito_e1, 'CORRECCION_CONTABLE'::public.naturaleza_credito_e1]))) OR ((productor = 'REVERSO_ABONO'::text) AND (naturaleza = ANY (ARRAY['DEVOLUCION_FISICA'::public.naturaleza_credito_e1, 'CORRECCION_CONTABLE'::public.naturaleza_credito_e1]))) OR ((productor = 'COBRO_PENDIENTE'::text) AND (naturaleza = 'INGRESO_FISICO'::public.naturaleza_credito_e1)) OR ((productor = 'E5_APLICACION_RETENIDA'::text) AND (naturaleza = 'OPERACION_CREDITO_SIN_DINERO'::public.naturaleza_credito_e1))))
);


--
-- Name: pagos_proveedor; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: pagos_proveedor_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pagos_proveedor_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pagos_proveedor_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pagos_proveedor_id_seq OWNED BY public.pagos_proveedor.id;


--
-- Name: permisos_rol; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: permisos_rol_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permisos_rol_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permisos_rol_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permisos_rol_id_seq OWNED BY public.permisos_rol.id;


--
-- Name: permisos_ubicacion; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: permisos_ubicacion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permisos_ubicacion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permisos_ubicacion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permisos_ubicacion_id_seq OWNED BY public.permisos_ubicacion.id;


--
-- Name: permisos_usuario; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: permisos_usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permisos_usuario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permisos_usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permisos_usuario_id_seq OWNED BY public.permisos_usuario.id;


--
-- Name: pisos; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: pisos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pisos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pisos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pisos_id_seq OWNED BY public.pisos.id;


--
-- Name: precio_historial; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: precio_historial_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.precio_historial_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: precio_historial_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.precio_historial_id_seq OWNED BY public.precio_historial.id;


--
-- Name: productos; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: productos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.productos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.productos_id_seq OWNED BY public.productos.id;


--
-- Name: proveedor_efectivo_e12; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proveedor_efectivo_e12 (
    pago_proveedor_id integer NOT NULL,
    salida_caja_id integer,
    movimiento_fondo_id uuid,
    detail jsonb NOT NULL,
    retorno jsonb,
    reverso_proveedor_id integer GENERATED ALWAYS AS (((retorno ->> 'reversoProveedorId'::text))::integer) STORED,
    ingreso_caja_id integer GENERATED ALWAYS AS (((retorno ->> 'ingresoCajaId'::text))::integer) STORED,
    retorno_fondo_id uuid GENERATED ALWAYS AS (((retorno ->> 'movimientoFondoId'::text))::uuid) STORED,
    CONSTRAINT proveedor_efectivo_e12_retorno CHECK (((retorno IS NULL) OR (((jsonb_typeof(retorno) = 'object'::text) AND (retorno ?& ARRAY['claveOperacion'::text, 'naturaleza'::text, 'motivo'::text, 'reversoProveedorId'::text, 'caja'::text, 'fondo'::text, 'sesionCajaId'::text, 'ingresoCajaId'::text, 'movimientoFondoId'::text, 'createdAt'::text]) AND ((retorno ->> 'naturaleza'::text) = ANY (ARRAY['CORRECCION_CAPTURA'::text, 'RECUPERACION_EFECTIVO'::text])) AND ((char_length(btrim((retorno ->> 'motivo'::text))) >= 1) AND (char_length(btrim((retorno ->> 'motivo'::text))) <= 1000)) AND ((retorno ->> 'caja'::text) = (detail ->> 'caja'::text)) AND ((retorno ->> 'fondo'::text) = (detail ->> 'fondo'::text)) AND ((((detail ->> 'caja'::text))::numeric > (0)::numeric) = ((retorno ->> 'ingresoCajaId'::text) IS NOT NULL)) AND ((((detail ->> 'fondo'::text))::numeric > (0)::numeric) = ((retorno ->> 'movimientoFondoId'::text) IS NOT NULL)) AND (((retorno ->> 'reversoProveedorId'::text))::integer > 0)) IS TRUE))),
    CONSTRAINT proveedor_efectivo_e12_shape CHECK ((((jsonb_typeof(detail) = 'object'::text) AND (detail ?& ARRAY['claveOperacion'::text, 'pagoProveedorId'::text, 'total'::text, 'caja'::text, 'fondo'::text, 'sesionCajaId'::text, 'salidaCajaId'::text, 'movimientoFondoId'::text, 'createdAt'::text, 'desbloqueoCaja'::text, 'retorno'::text]) AND (((detail ->> 'pagoProveedorId'::text))::integer = pago_proveedor_id) AND (((detail ->> 'total'::text))::numeric > (0)::numeric) AND (((detail ->> 'caja'::text))::numeric >= (0)::numeric) AND (((detail ->> 'fondo'::text))::numeric >= (0)::numeric) AND ((((detail ->> 'caja'::text))::numeric + ((detail ->> 'fondo'::text))::numeric) = ((detail ->> 'total'::text))::numeric) AND ((((detail ->> 'caja'::text))::numeric > (0)::numeric) = (salida_caja_id IS NOT NULL)) AND ((((detail ->> 'fondo'::text))::numeric > (0)::numeric) = (movimiento_fondo_id IS NOT NULL)) AND (NOT (((detail ->> 'salidaCajaId'::text))::integer IS DISTINCT FROM salida_caja_id)) AND (NOT (((detail ->> 'movimientoFondoId'::text))::uuid IS DISTINCT FROM movimiento_fondo_id)) AND ((detail -> 'retorno'::text) = 'null'::jsonb)) IS TRUE))
);


--
-- Name: proveedor_operaciones_e12; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proveedor_operaciones_e12 (
    clave uuid NOT NULL,
    actor_id integer NOT NULL,
    contenido text NOT NULL,
    resultado jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT proveedor_operaciones_e12_contenido_check CHECK ((length(contenido) > 0)),
    CONSTRAINT proveedor_operaciones_e12_resultado_check CHECK ((jsonb_typeof(resultado) = 'object'::text))
);


--
-- Name: proveedor_solicitudes_e12; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proveedor_solicitudes_e12 (
    solicitud_id integer NOT NULL,
    clave uuid NOT NULL,
    actor_id integer NOT NULL,
    contenido text NOT NULL,
    origen jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT proveedor_solicitudes_e12_contenido_check CHECK ((length(contenido) > 0)),
    CONSTRAINT proveedor_solicitudes_e12_origen_check CHECK ((((jsonb_typeof(origen) = 'object'::text) AND (origen ?& ARRAY['claveOperacion'::text, 'caja'::text])) IS TRUE))
);


--
-- Name: proveedores; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: proveedores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.proveedores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: proveedores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.proveedores_id_seq OWNED BY public.proveedores.id;


--
-- Name: recibo_folio_e3; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recibo_folio_e3 (
    sitio_id integer NOT NULL,
    ultimo_folio integer DEFAULT 0 NOT NULL,
    CONSTRAINT recibo_folio_e3_ultimo_folio_check CHECK ((ultimo_folio >= 0))
);


--
-- Name: recibos_abono_e3; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recibos_abono_e3 (
    operacion_clave uuid NOT NULL,
    intent_hash text NOT NULL,
    folio text NOT NULL,
    movimiento_id integer NOT NULL,
    cliente_id integer NOT NULL,
    sesion_operativa_id integer,
    origen text NOT NULL,
    snapshot jsonb NOT NULL,
    CONSTRAINT recibos_abono_e3_check CHECK ((((origen = 'CAJA'::text) AND (sesion_operativa_id IS NOT NULL)) OR ((origen = 'RECAPTURA'::text) AND (sesion_operativa_id IS NULL)))),
    CONSTRAINT recibos_abono_e3_check1 CHECK ((((snapshot ->> 'folio'::text) = folio) AND (((snapshot ->> 'movimientoId'::text))::integer = movimiento_id) AND (((snapshot ->> 'clienteId'::text))::integer = cliente_id) AND ((snapshot ->> 'origen'::text) = origen))),
    CONSTRAINT recibos_abono_e3_intent_hash_check CHECK ((intent_hash ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT recibos_abono_e3_origen_check CHECK ((origen = ANY (ARRAY['CAJA'::text, 'RECAPTURA'::text]))),
    CONSTRAINT recibos_abono_e3_snapshot_check CHECK (((jsonb_typeof(snapshot) = 'object'::text) AND ((snapshot ->> 'version'::text) = '1'::text) AND (snapshot ?& ARRAY['folio'::text, 'movimientoId'::text, 'clienteId'::text, 'clienteNombre'::text, 'importeCentavos'::text, 'formaPago'::text, 'cuentaDestino'::text, 'sitioId'::text, 'sesionCajaId'::text, 'recibidoEn'::text, 'registradoEn'::text, 'actorId'::text, 'origen'::text, 'motivo'::text, 'asignaciones'::text, 'remanenteCentavos'::text, 'saldoAFavorCentavos'::text, 'deudaCentavos'::text, 'clienteTelefono'::text, 'clienteRfc'::text, 'sitioNombre'::text, 'actorNombre'::text])))
);


--
-- Name: reimpresiones_etiqueta; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: reimpresiones_etiqueta_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reimpresiones_etiqueta_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reimpresiones_etiqueta_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reimpresiones_etiqueta_id_seq OWNED BY public.reimpresiones_etiqueta.id;


--
-- Name: revisiones_etiqueta; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: revisiones_etiqueta_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.revisiones_etiqueta_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: revisiones_etiqueta_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.revisiones_etiqueta_id_seq OWNED BY public.revisiones_etiqueta.id;


--
-- Name: rollos; Type: TABLE; Schema: public; Owner: -
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
    piso_id integer,
    CONSTRAINT rollos_physical_quantity_nonnegative_check CHECK (((cantidad_actual >= (0)::numeric) AND (cantidad_actual <> 'NaN'::numeric)))
);


--
-- Name: rollos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rollos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rollos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rollos_id_seq OWNED BY public.rollos.id;


--
-- Name: saldos_cobros_credito_e1; Type: VIEW; Schema: public; Owner: -
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


--
-- Name: salida_folio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salida_folio (
    ultimo_folio integer DEFAULT 0 NOT NULL,
    ubicacion_id integer NOT NULL
);


--
-- Name: salida_lineas; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: salida_lineas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.salida_lineas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: salida_lineas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.salida_lineas_id_seq OWNED BY public.salida_lineas.id;


--
-- Name: salida_rollos; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: salida_rollos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.salida_rollos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: salida_rollos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.salida_rollos_id_seq OWNED BY public.salida_rollos.id;


--
-- Name: salidas; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: salidas_dinero_caja; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: salidas_dinero_caja_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.salidas_dinero_caja_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: salidas_dinero_caja_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.salidas_dinero_caja_id_seq OWNED BY public.salidas_dinero_caja.id;


--
-- Name: salidas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.salidas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: salidas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.salidas_id_seq OWNED BY public.salidas.id;


--
-- Name: series_consecutivo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.series_consecutivo (
    id integer DEFAULT 1 NOT NULL,
    ultimo_numero integer DEFAULT 10000000 NOT NULL
);


--
-- Name: sesiones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sesiones (
    id uuid NOT NULL,
    usuario_id integer NOT NULL,
    expira_at timestamp with time zone NOT NULL,
    ip text NOT NULL,
    user_agent text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sesiones_caja; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: sesiones_caja_dias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sesiones_caja_dias (
    ubicacion_id integer NOT NULL,
    fecha_operativa date NOT NULL,
    sesion_caja_id integer
);


--
-- Name: sesiones_caja_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sesiones_caja_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sesiones_caja_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sesiones_caja_id_seq OWNED BY public.sesiones_caja.id;


--
-- Name: solicitudes_pago_dirigido; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: solicitudes_pago_dirigido_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.solicitudes_pago_dirigido_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitudes_pago_dirigido_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.solicitudes_pago_dirigido_id_seq OWNED BY public.solicitudes_pago_dirigido.id;


--
-- Name: stock_minimo_episodios; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: stock_minimo_episodios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_minimo_episodios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_minimo_episodios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_minimo_episodios_id_seq OWNED BY public.stock_minimo_episodios.id;


--
-- Name: stock_minimo_sitios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_minimo_sitios (
    ubicacion_id integer NOT NULL,
    habilitado boolean DEFAULT false NOT NULL,
    updated_by integer,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_minimos; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: stock_minimos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_minimos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_minimos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_minimos_id_seq OWNED BY public.stock_minimos.id;


--
-- Name: tarea4_rollo_remate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tarea4_rollo_remate (
    rollo_id integer NOT NULL,
    motivo text NOT NULL,
    usuario_id integer NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tarea4_rollo_remate_motivo_check CHECK ((length(btrim(motivo)) > 0))
);


--
-- Name: test_reset_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.test_reset_history (
    id bigint NOT NULL,
    actor_id integer NOT NULL,
    actor_usuario text NOT NULL,
    executed_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    protected_customers boolean NOT NULL,
    cleared_tables jsonb NOT NULL
);


--
-- Name: test_reset_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.test_reset_history ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.test_reset_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ticket_folio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_folio (
    id integer DEFAULT 1 NOT NULL,
    ultimo_folio integer DEFAULT 999 NOT NULL
);


--
-- Name: ticket_linea_consumos; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: TABLE ticket_linea_consumos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ticket_linea_consumos IS 'Immutable physical roll allocations for accounted supplier utility; empty for historical records without evidence.';


--
-- Name: COLUMN ticket_linea_consumos.cantidad_milesimas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ticket_linea_consumos.cantidad_milesimas IS 'Positive physical quantity in thousandths.';


--
-- Name: COLUMN ticket_linea_consumos.ingreso_centavos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ticket_linea_consumos.ingreso_centavos IS 'Positive revenue allocation in integer cents, assigned with deterministic largest remainder.';


--
-- Name: COLUMN ticket_linea_consumos.costo_centavos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ticket_linea_consumos.costo_centavos IS 'Frozen physical cost in integer cents; NULL means utility unavailable.';


--
-- Name: ticket_linea_consumos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_linea_consumos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_linea_consumos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_linea_consumos_id_seq OWNED BY public.ticket_linea_consumos.id;


--
-- Name: ticket_lineas; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: ticket_lineas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_lineas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_lineas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_lineas_id_seq OWNED BY public.ticket_lineas.id;


--
-- Name: ticket_pagos; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: ticket_pagos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_pagos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_pagos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_pagos_id_seq OWNED BY public.ticket_pagos.id;


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tickets_id_seq OWNED BY public.tickets.id;


--
-- Name: ubicaciones; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: ubicaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ubicaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ubicaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ubicaciones_id_seq OWNED BY public.ubicaciones.id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: viaje_folio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.viaje_folio (
    ubicacion_id integer NOT NULL,
    ultimo_folio integer DEFAULT 0 NOT NULL
);


--
-- Name: viaje_salidas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.viaje_salidas (
    viaje_id integer NOT NULL,
    salida_id integer NOT NULL
);


--
-- Name: viaje_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.viaje_tickets (
    viaje_id integer NOT NULL,
    ticket_id integer NOT NULL
);


--
-- Name: viajes; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: viajes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.viajes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: viajes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.viajes_id_seq OWNED BY public.viajes.id;


--
-- Name: vistas_abono_e3; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vistas_abono_e3 (
    operacion_clave uuid NOT NULL,
    token text NOT NULL,
    intent_hash text NOT NULL,
    actor_id integer NOT NULL,
    emitida_at timestamp with time zone NOT NULL,
    CONSTRAINT vistas_abono_e3_intent_hash_check CHECK ((intent_hash ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT vistas_abono_e3_token_check CHECK ((token ~ '^[a-f0-9]{64}$'::text))
);


--
-- Name: aplicaciones_credito id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_credito ALTER COLUMN id SET DEFAULT nextval('public.aplicaciones_credito_id_seq'::regclass);


--
-- Name: aplicaciones_pago_proveedor id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_pago_proveedor ALTER COLUMN id SET DEFAULT nextval('public.aplicaciones_pago_proveedor_id_seq'::regclass);


--
-- Name: auditoria id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria ALTER COLUMN id SET DEFAULT nextval('public.auditoria_id_seq'::regclass);


--
-- Name: auditoria_faltante_reactivaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_faltante_reactivaciones ALTER COLUMN id SET DEFAULT nextval('public.auditoria_faltante_reactivaciones_id_seq'::regclass);


--
-- Name: auditoria_sobrante_decisiones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_sobrante_decisiones ALTER COLUMN id SET DEFAULT nextval('public.auditoria_sobrante_decisiones_id_seq'::regclass);


--
-- Name: auditorias_inventario id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditorias_inventario ALTER COLUMN id SET DEFAULT nextval('public.auditorias_inventario_id_seq'::regclass);


--
-- Name: autorizaciones_nota id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_nota ALTER COLUMN id SET DEFAULT nextval('public.autorizaciones_nota_id_seq'::regclass);


--
-- Name: caja_retornos_proveedor_e12 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caja_retornos_proveedor_e12 ALTER COLUMN id SET DEFAULT nextval('public.caja_retornos_proveedor_e12_id_seq'::regclass);


--
-- Name: camionetas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camionetas ALTER COLUMN id SET DEFAULT nextval('public.camionetas_id_seq'::regclass);


--
-- Name: choferes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.choferes ALTER COLUMN id SET DEFAULT nextval('public.choferes_id_seq'::regclass);


--
-- Name: cliente_documentos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_documentos ALTER COLUMN id SET DEFAULT nextval('public.cliente_documentos_id_seq'::regclass);


--
-- Name: clientes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes ALTER COLUMN id SET DEFAULT nextval('public.clientes_id_seq'::regclass);


--
-- Name: contenedor_lineas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contenedor_lineas ALTER COLUMN id SET DEFAULT nextval('public.contenedor_lineas_id_seq'::regclass);


--
-- Name: contenedores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contenedores ALTER COLUMN id SET DEFAULT nextval('public.contenedores_id_seq'::regclass);


--
-- Name: contenedores folio; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contenedores ALTER COLUMN folio SET DEFAULT nextval('public.contenedores_folio_seq'::regclass);


--
-- Name: cuadre_fiscal_registros id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuadre_fiscal_registros ALTER COLUMN id SET DEFAULT nextval('public.cuadre_fiscal_registros_id_seq'::regclass);


--
-- Name: entradas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entradas ALTER COLUMN id SET DEFAULT nextval('public.entradas_id_seq'::regclass);


--
-- Name: equipos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipos ALTER COLUMN id SET DEFAULT nextval('public.equipos_id_seq'::regclass);


--
-- Name: movimientos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos ALTER COLUMN id SET DEFAULT nextval('public.movimientos_id_seq'::regclass);


--
-- Name: movimientos_credito id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_credito ALTER COLUMN id SET DEFAULT nextval('public.movimientos_credito_id_seq'::regclass);


--
-- Name: notificaciones_credito id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones_credito ALTER COLUMN id SET DEFAULT nextval('public.notificaciones_credito_id_seq'::regclass);


--
-- Name: notificaciones_sistema id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones_sistema ALTER COLUMN id SET DEFAULT nextval('public.notificaciones_sistema_id_seq'::regclass);


--
-- Name: pagos_proveedor id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_proveedor ALTER COLUMN id SET DEFAULT nextval('public.pagos_proveedor_id_seq'::regclass);


--
-- Name: permisos_rol id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_rol ALTER COLUMN id SET DEFAULT nextval('public.permisos_rol_id_seq'::regclass);


--
-- Name: permisos_ubicacion id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_ubicacion ALTER COLUMN id SET DEFAULT nextval('public.permisos_ubicacion_id_seq'::regclass);


--
-- Name: permisos_usuario id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_usuario ALTER COLUMN id SET DEFAULT nextval('public.permisos_usuario_id_seq'::regclass);


--
-- Name: pisos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pisos ALTER COLUMN id SET DEFAULT nextval('public.pisos_id_seq'::regclass);


--
-- Name: precio_historial id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precio_historial ALTER COLUMN id SET DEFAULT nextval('public.precio_historial_id_seq'::regclass);


--
-- Name: productos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos ALTER COLUMN id SET DEFAULT nextval('public.productos_id_seq'::regclass);


--
-- Name: proveedores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedores ALTER COLUMN id SET DEFAULT nextval('public.proveedores_id_seq'::regclass);


--
-- Name: reimpresiones_etiqueta id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reimpresiones_etiqueta ALTER COLUMN id SET DEFAULT nextval('public.reimpresiones_etiqueta_id_seq'::regclass);


--
-- Name: revisiones_etiqueta id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revisiones_etiqueta ALTER COLUMN id SET DEFAULT nextval('public.revisiones_etiqueta_id_seq'::regclass);


--
-- Name: rollos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rollos ALTER COLUMN id SET DEFAULT nextval('public.rollos_id_seq'::regclass);


--
-- Name: salida_lineas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salida_lineas ALTER COLUMN id SET DEFAULT nextval('public.salida_lineas_id_seq'::regclass);


--
-- Name: salida_rollos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salida_rollos ALTER COLUMN id SET DEFAULT nextval('public.salida_rollos_id_seq'::regclass);


--
-- Name: salidas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas ALTER COLUMN id SET DEFAULT nextval('public.salidas_id_seq'::regclass);


--
-- Name: salidas_dinero_caja id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas_dinero_caja ALTER COLUMN id SET DEFAULT nextval('public.salidas_dinero_caja_id_seq'::regclass);


--
-- Name: sesiones_caja id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones_caja ALTER COLUMN id SET DEFAULT nextval('public.sesiones_caja_id_seq'::regclass);


--
-- Name: solicitudes_pago_dirigido id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_pago_dirigido ALTER COLUMN id SET DEFAULT nextval('public.solicitudes_pago_dirigido_id_seq'::regclass);


--
-- Name: stock_minimo_episodios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_minimo_episodios ALTER COLUMN id SET DEFAULT nextval('public.stock_minimo_episodios_id_seq'::regclass);


--
-- Name: stock_minimos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_minimos ALTER COLUMN id SET DEFAULT nextval('public.stock_minimos_id_seq'::regclass);


--
-- Name: ticket_linea_consumos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_linea_consumos ALTER COLUMN id SET DEFAULT nextval('public.ticket_linea_consumos_id_seq'::regclass);


--
-- Name: ticket_lineas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_lineas ALTER COLUMN id SET DEFAULT nextval('public.ticket_lineas_id_seq'::regclass);


--
-- Name: ticket_pagos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_pagos ALTER COLUMN id SET DEFAULT nextval('public.ticket_pagos_id_seq'::regclass);


--
-- Name: tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets ALTER COLUMN id SET DEFAULT nextval('public.tickets_id_seq'::regclass);


--
-- Name: ubicaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ubicaciones ALTER COLUMN id SET DEFAULT nextval('public.ubicaciones_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Name: viajes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.viajes ALTER COLUMN id SET DEFAULT nextval('public.viajes_id_seq'::regclass);


--
-- Name: aplicaciones_credito aplicaciones_credito_abono_venta_uidx; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_credito
    ADD CONSTRAINT aplicaciones_credito_abono_venta_uidx UNIQUE (abono_movimiento_id, venta_movimiento_id);


--
-- Name: aplicaciones_credito aplicaciones_credito_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_credito
    ADD CONSTRAINT aplicaciones_credito_pkey PRIMARY KEY (id);


--
-- Name: aplicaciones_pago_proveedor aplicaciones_pago_proveedor_pago_compra_uidx; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_pago_proveedor
    ADD CONSTRAINT aplicaciones_pago_proveedor_pago_compra_uidx UNIQUE (pago_proveedor_id, compra_proveedor_id);


--
-- Name: aplicaciones_pago_proveedor aplicaciones_pago_proveedor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_pago_proveedor
    ADD CONSTRAINT aplicaciones_pago_proveedor_pkey PRIMARY KEY (id);


--
-- Name: atribuciones_credito_e1 atribuciones_cadena_uq_e1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atribuciones_credito_e1
    ADD CONSTRAINT atribuciones_cadena_uq_e1 UNIQUE NULLS NOT DISTINCT (movimiento_id, anterior_id);


--
-- Name: atribuciones_credito_e1 atribuciones_pk_e1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atribuciones_credito_e1
    ADD CONSTRAINT atribuciones_pk_e1 PRIMARY KEY (id);


--
-- Name: auditoria_faltante_reactivaciones auditoria_faltante_reactivacione_movimiento_reactivacion_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_faltante_reactivaciones
    ADD CONSTRAINT auditoria_faltante_reactivacione_movimiento_reactivacion_id_key UNIQUE (movimiento_reactivacion_id);


--
-- Name: auditoria_faltante_reactivaciones auditoria_faltante_reactivaciones_movimiento_baja_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_faltante_reactivaciones
    ADD CONSTRAINT auditoria_faltante_reactivaciones_movimiento_baja_id_key UNIQUE (movimiento_baja_id);


--
-- Name: auditoria_faltante_reactivaciones auditoria_faltante_reactivaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_faltante_reactivaciones
    ADD CONSTRAINT auditoria_faltante_reactivaciones_pkey PRIMARY KEY (id);


--
-- Name: auditoria_faltante_reactivaciones auditoria_faltante_reactivaciones_uuid_cliente_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_faltante_reactivaciones
    ADD CONSTRAINT auditoria_faltante_reactivaciones_uuid_cliente_key UNIQUE (uuid_cliente);


--
-- Name: auditoria_inventario_escaneos auditoria_inventario_escaneos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_inventario_escaneos
    ADD CONSTRAINT auditoria_inventario_escaneos_pkey PRIMARY KEY (auditoria_id, serie);


--
-- Name: auditoria_inventario_folio auditoria_inventario_folio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_inventario_folio
    ADD CONSTRAINT auditoria_inventario_folio_pkey PRIMARY KEY (ubicacion_id);


--
-- Name: auditoria_inventario_participantes auditoria_inventario_participantes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_inventario_participantes
    ADD CONSTRAINT auditoria_inventario_participantes_pkey PRIMARY KEY (auditoria_id, usuario_id);


--
-- Name: auditoria_inventario_snapshot auditoria_inventario_snapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_inventario_snapshot
    ADD CONSTRAINT auditoria_inventario_snapshot_pkey PRIMARY KEY (auditoria_id, serie);


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id);


--
-- Name: auditoria_sobrante_contextos auditoria_sobrante_contextos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_sobrante_contextos
    ADD CONSTRAINT auditoria_sobrante_contextos_pkey PRIMARY KEY (auditoria_id, serie);


--
-- Name: auditoria_sobrante_decisiones auditoria_sobrante_decisiones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_sobrante_decisiones
    ADD CONSTRAINT auditoria_sobrante_decisiones_pkey PRIMARY KEY (id);


--
-- Name: auditoria_sobrante_decisiones auditoria_sobrante_decisiones_uuid_cliente_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_sobrante_decisiones
    ADD CONSTRAINT auditoria_sobrante_decisiones_uuid_cliente_key UNIQUE (uuid_cliente);


--
-- Name: auditorias_inventario auditorias_inventario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditorias_inventario
    ADD CONSTRAINT auditorias_inventario_pkey PRIMARY KEY (id);


--
-- Name: auditorias_inventario auditorias_inventario_ubicacion_id_folio_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditorias_inventario
    ADD CONSTRAINT auditorias_inventario_ubicacion_id_folio_key UNIQUE (ubicacion_id, folio);


--
-- Name: autorizaciones_nota autorizaciones_nota_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_nota
    ADD CONSTRAINT autorizaciones_nota_pkey PRIMARY KEY (id);


--
-- Name: autorizaciones_nota autorizaciones_nota_ticket_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_nota
    ADD CONSTRAINT autorizaciones_nota_ticket_id_key UNIQUE (ticket_id);


--
-- Name: caja_desbloqueos_e12 caja_desbloqueos_e12_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caja_desbloqueos_e12
    ADD CONSTRAINT caja_desbloqueos_e12_pkey PRIMARY KEY (salida_id);


--
-- Name: caja_retornos_proveedor_e12 caja_retornos_proveedor_e12_pago_proveedor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caja_retornos_proveedor_e12
    ADD CONSTRAINT caja_retornos_proveedor_e12_pago_proveedor_id_key UNIQUE (pago_proveedor_id);


--
-- Name: caja_retornos_proveedor_e12 caja_retornos_proveedor_e12_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caja_retornos_proveedor_e12
    ADD CONSTRAINT caja_retornos_proveedor_e12_pkey PRIMARY KEY (id);


--
-- Name: caja_salidas_e4_operaciones caja_salidas_e4_operaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caja_salidas_e4_operaciones
    ADD CONSTRAINT caja_salidas_e4_operaciones_pkey PRIMARY KEY (clave);


--
-- Name: caja_salidas_e4 caja_salidas_e4_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caja_salidas_e4
    ADD CONSTRAINT caja_salidas_e4_pkey PRIMARY KEY (salida_id);


--
-- Name: camionetas camionetas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camionetas
    ADD CONSTRAINT camionetas_pkey PRIMARY KEY (id);


--
-- Name: choferes choferes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.choferes
    ADD CONSTRAINT choferes_pkey PRIMARY KEY (id);


--
-- Name: cliente_documentos cliente_documentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_documentos
    ADD CONSTRAINT cliente_documentos_pkey PRIMARY KEY (id);


--
-- Name: cliente_documentos cliente_documentos_public_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_documentos
    ADD CONSTRAINT cliente_documentos_public_id_unique UNIQUE (public_id);


--
-- Name: cliente_documentos cliente_documentos_ruta_archivo_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_documentos
    ADD CONSTRAINT cliente_documentos_ruta_archivo_unique UNIQUE (ruta_archivo);


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);


--
-- Name: cobros_credito_pendientes_e1 cobros_pk_e1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobros_credito_pendientes_e1
    ADD CONSTRAINT cobros_pk_e1 PRIMARY KEY (operacion_productor, operacion_clave);


--
-- Name: contenedor_lineas contenedor_lineas_contenedor_producto_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contenedor_lineas
    ADD CONSTRAINT contenedor_lineas_contenedor_producto_unique UNIQUE (contenedor_id, producto_id);


--
-- Name: contenedor_lineas contenedor_lineas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contenedor_lineas
    ADD CONSTRAINT contenedor_lineas_pkey PRIMARY KEY (id);


--
-- Name: contenedores contenedores_entrada_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contenedores
    ADD CONSTRAINT contenedores_entrada_unique UNIQUE (entrada_id);


--
-- Name: contenedores contenedores_folio_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contenedores
    ADD CONSTRAINT contenedores_folio_unique UNIQUE (folio);


--
-- Name: contenedores contenedores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contenedores
    ADD CONSTRAINT contenedores_pkey PRIMARY KEY (id);


--
-- Name: cuadre_fiscal_registros cuadre_fiscal_registros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuadre_fiscal_registros
    ADD CONSTRAINT cuadre_fiscal_registros_pkey PRIMARY KEY (id);


--
-- Name: e11_avisos e11_avisos_decision_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_avisos
    ADD CONSTRAINT e11_avisos_decision_id_key UNIQUE (decision_id);


--
-- Name: e11_avisos e11_avisos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_avisos
    ADD CONSTRAINT e11_avisos_pkey PRIMARY KEY (id);


--
-- Name: e11_cambios_usuario e11_cambios_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_cambios_usuario
    ADD CONSTRAINT e11_cambios_usuario_pkey PRIMARY KEY (usuario_id, birth_xid);


--
-- Name: e11_conciliacion_ventas e11_conciliacion_ventas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_conciliacion_ventas
    ADD CONSTRAINT e11_conciliacion_ventas_pkey PRIMARY KEY (conciliacion_id, venta_id);


--
-- Name: e11_conciliaciones e11_conciliaciones_anterior_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_conciliaciones
    ADD CONSTRAINT e11_conciliaciones_anterior_id_key UNIQUE (anterior_id);


--
-- Name: e11_conciliaciones e11_conciliaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_conciliaciones
    ADD CONSTRAINT e11_conciliaciones_pkey PRIMARY KEY (id);


--
-- Name: e11_conciliaciones e11_conciliaciones_tipo_inicio_revision_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_conciliaciones
    ADD CONSTRAINT e11_conciliaciones_tipo_inicio_revision_key UNIQUE (tipo, inicio, revision);


--
-- Name: e11_decisiones e11_decisiones_actor_id_uuid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_decisiones
    ADD CONSTRAINT e11_decisiones_actor_id_uuid_key UNIQUE (actor_id, uuid);


--
-- Name: e11_decisiones e11_decisiones_conciliacion_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_decisiones
    ADD CONSTRAINT e11_decisiones_conciliacion_id_key UNIQUE (conciliacion_id);


--
-- Name: e11_decisiones e11_decisiones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_decisiones
    ADD CONSTRAINT e11_decisiones_pkey PRIMARY KEY (id);


--
-- Name: e11_e5_definiciones e11_e5_definiciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_e5_definiciones
    ADD CONSTRAINT e11_e5_definiciones_pkey PRIMARY KEY (firma);


--
-- Name: e11_e5_preparaciones e11_e5_preparaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_e5_preparaciones
    ADD CONSTRAINT e11_e5_preparaciones_pkey PRIMARY KEY (clave);


--
-- Name: e11_notificacion_origen e11_notificacion_origen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_notificacion_origen
    ADD CONSTRAINT e11_notificacion_origen_pkey PRIMARY KEY (notificacion_id);


--
-- Name: e11_operaciones e11_operaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_operaciones
    ADD CONSTRAINT e11_operaciones_pkey PRIMARY KEY (actor_id, operacion, uuid);


--
-- Name: e11_perfil_eventos e11_perfil_eventos_actor_id_uuid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_perfil_eventos
    ADD CONSTRAINT e11_perfil_eventos_actor_id_uuid_key UNIQUE (actor_id, uuid);


--
-- Name: e11_perfil_eventos e11_perfil_eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_perfil_eventos
    ADD CONSTRAINT e11_perfil_eventos_pkey PRIMARY KEY (id);


--
-- Name: e11_perfil_eventos e11_perfil_eventos_usuario_id_revision_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_perfil_eventos
    ADD CONSTRAINT e11_perfil_eventos_usuario_id_revision_key UNIQUE (usuario_id, revision);


--
-- Name: e11_perfiles e11_perfiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_perfiles
    ADD CONSTRAINT e11_perfiles_pkey PRIMARY KEY (usuario_id);


--
-- Name: e11_resoluciones e11_resoluciones_actor_original_id_accion_uuid_original_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_resoluciones
    ADD CONSTRAINT e11_resoluciones_actor_original_id_accion_uuid_original_key UNIQUE (actor_original_id, accion, uuid_original);


--
-- Name: e11_resoluciones e11_resoluciones_admin_id_uuid_resolutor_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_resoluciones
    ADD CONSTRAINT e11_resoluciones_admin_id_uuid_resolutor_key UNIQUE (admin_id, uuid_resolutor);


--
-- Name: e11_resoluciones e11_resoluciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_resoluciones
    ADD CONSTRAINT e11_resoluciones_pkey PRIMARY KEY (id);


--
-- Name: e5_aplicaciones e5_aplicaciones_grupo_id_movimiento_venta_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_aplicaciones
    ADD CONSTRAINT e5_aplicaciones_grupo_id_movimiento_venta_id_key UNIQUE (grupo_id, movimiento_venta_id);


--
-- Name: e5_aplicaciones e5_aplicaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_aplicaciones
    ADD CONSTRAINT e5_aplicaciones_pkey PRIMARY KEY (id);


--
-- Name: e5_cobros e5_cobros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_cobros
    ADD CONSTRAINT e5_cobros_pkey PRIMARY KEY (id);


--
-- Name: e5_ddl_originales e5_ddl_originales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_ddl_originales
    ADD CONSTRAINT e5_ddl_originales_pkey PRIMARY KEY (objeto);


--
-- Name: e5_devoluciones e5_devoluciones_cobro_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_devoluciones
    ADD CONSTRAINT e5_devoluciones_cobro_id_key UNIQUE (cobro_id);


--
-- Name: e5_devoluciones e5_devoluciones_movimiento_fondo_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_devoluciones
    ADD CONSTRAINT e5_devoluciones_movimiento_fondo_id_key UNIQUE (movimiento_fondo_id);


--
-- Name: e5_devoluciones e5_devoluciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_devoluciones
    ADD CONSTRAINT e5_devoluciones_pkey PRIMARY KEY (clave);


--
-- Name: e5_devoluciones e5_devoluciones_salida_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_devoluciones
    ADD CONSTRAINT e5_devoluciones_salida_id_key UNIQUE (salida_id);


--
-- Name: e5_documentos e5_documentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_documentos
    ADD CONSTRAINT e5_documentos_pkey PRIMARY KEY (id);


--
-- Name: e5_impresiones e5_impresiones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_impresiones
    ADD CONSTRAINT e5_impresiones_pkey PRIMARY KEY (clave);


--
-- Name: e5_nacimientos e5_nacimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_nacimientos
    ADD CONSTRAINT e5_nacimientos_pkey PRIMARY KEY (tabla, clave);


--
-- Name: e5_operaciones e5_operaciones_cobro_id_revision_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_operaciones
    ADD CONSTRAINT e5_operaciones_cobro_id_revision_key UNIQUE (cobro_id, revision);


--
-- Name: e5_operaciones e5_operaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_operaciones
    ADD CONSTRAINT e5_operaciones_pkey PRIMARY KEY (clave);


--
-- Name: e5_recepciones e5_recepciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_recepciones
    ADD CONSTRAINT e5_recepciones_pkey PRIMARY KEY (id);


--
-- Name: e5_salidas_bancarias e5_salidas_bancarias_cobro_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_salidas_bancarias
    ADD CONSTRAINT e5_salidas_bancarias_cobro_id_key UNIQUE (cobro_id);


--
-- Name: e5_salidas_bancarias e5_salidas_bancarias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_salidas_bancarias
    ADD CONSTRAINT e5_salidas_bancarias_pkey PRIMARY KEY (clave);


--
-- Name: e5_vinculos_credito e5_vinculos_credito_movimiento_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_vinculos_credito
    ADD CONSTRAINT e5_vinculos_credito_movimiento_id_key UNIQUE (movimiento_id);


--
-- Name: e5_vinculos_credito e5_vinculos_credito_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_vinculos_credito
    ADD CONSTRAINT e5_vinculos_credito_pkey PRIMARY KEY (aplicacion_id);


--
-- Name: e9_entregas e9_entregas_corte_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e9_entregas
    ADD CONSTRAINT e9_entregas_corte_id_key UNIQUE (corte_id);


--
-- Name: e9_entregas e9_entregas_movimiento_fondo_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e9_entregas
    ADD CONSTRAINT e9_entregas_movimiento_fondo_id_key UNIQUE (movimiento_fondo_id);


--
-- Name: e9_entregas e9_entregas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e9_entregas
    ADD CONSTRAINT e9_entregas_pkey PRIMARY KEY (id);


--
-- Name: e9_operaciones e9_operaciones_entrega_id_revision_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e9_operaciones
    ADD CONSTRAINT e9_operaciones_entrega_id_revision_key UNIQUE (entrega_id, revision);


--
-- Name: e9_operaciones e9_operaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e9_operaciones
    ADD CONSTRAINT e9_operaciones_pkey PRIMARY KEY (clave);


--
-- Name: entrada_folio entrada_folio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entrada_folio
    ADD CONSTRAINT entrada_folio_pkey PRIMARY KEY (ubicacion_id);


--
-- Name: entradas entradas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entradas
    ADD CONSTRAINT entradas_pkey PRIMARY KEY (id);


--
-- Name: entradas entradas_uuid_cliente_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entradas
    ADD CONSTRAINT entradas_uuid_cliente_unique UNIQUE (uuid_cliente);


--
-- Name: equipos equipos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_pkey PRIMARY KEY (id);


--
-- Name: evidencia_no_aplicada_e2 evidencia_no_aplicada_e2_abono_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidencia_no_aplicada_e2
    ADD CONSTRAINT evidencia_no_aplicada_e2_abono_id_key UNIQUE (abono_id);


--
-- Name: evidencia_no_aplicada_e2 evidencia_no_aplicada_e2_cobro_clave_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidencia_no_aplicada_e2
    ADD CONSTRAINT evidencia_no_aplicada_e2_cobro_clave_key UNIQUE (cobro_clave);


--
-- Name: evidencia_no_aplicada_e2 evidencia_no_aplicada_e2_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidencia_no_aplicada_e2
    ADD CONSTRAINT evidencia_no_aplicada_e2_pkey PRIMARY KEY (fuente);


--
-- Name: existencias existencias_producto_id_ubicacion_id_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.existencias
    ADD CONSTRAINT existencias_producto_id_ubicacion_id_pk PRIMARY KEY (producto_id, ubicacion_id);


--
-- Name: finalizaciones_abono_e2 finalizaciones_abono_e2_operacion_productor_operacion_clave_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finalizaciones_abono_e2
    ADD CONSTRAINT finalizaciones_abono_e2_operacion_productor_operacion_clave_key UNIQUE (operacion_productor, operacion_clave);


--
-- Name: finalizaciones_abono_e2 finalizaciones_abono_e2_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finalizaciones_abono_e2
    ADD CONSTRAINT finalizaciones_abono_e2_pkey PRIMARY KEY (abono_id);


--
-- Name: fondo_arqueos fondo_arqueos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fondo_arqueos
    ADD CONSTRAINT fondo_arqueos_pkey PRIMARY KEY (id);


--
-- Name: fondo_mariana fondo_mariana_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fondo_mariana
    ADD CONSTRAINT fondo_mariana_pkey PRIMARY KEY (id);


--
-- Name: fondo_movimientos fondo_movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fondo_movimientos
    ADD CONSTRAINT fondo_movimientos_pkey PRIMARY KEY (id);


--
-- Name: movimientos_credito movimientos_credito_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_credito
    ADD CONSTRAINT movimientos_credito_pkey PRIMARY KEY (id);


--
-- Name: movimientos movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos
    ADD CONSTRAINT movimientos_pkey PRIMARY KEY (id);


--
-- Name: movimientos movimientos_uuid_cliente_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos
    ADD CONSTRAINT movimientos_uuid_cliente_unique UNIQUE (uuid_cliente);


--
-- Name: notificaciones_credito notificaciones_credito_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones_credito
    ADD CONSTRAINT notificaciones_credito_pkey PRIMARY KEY (id);


--
-- Name: notificaciones_credito notificaciones_credito_ticket_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones_credito
    ADD CONSTRAINT notificaciones_credito_ticket_id_unique UNIQUE (ticket_id);


--
-- Name: notificaciones_sistema notificaciones_sistema_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones_sistema
    ADD CONSTRAINT notificaciones_sistema_pkey PRIMARY KEY (id);


--
-- Name: operaciones_credito_e1 operaciones_pk_e1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operaciones_credito_e1
    ADD CONSTRAINT operaciones_pk_e1 PRIMARY KEY (productor, clave);


--
-- Name: pagos_proveedor pagos_proveedor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_proveedor
    ADD CONSTRAINT pagos_proveedor_pkey PRIMARY KEY (id);


--
-- Name: permisos_rol permisos_rol_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_rol
    ADD CONSTRAINT permisos_rol_pkey PRIMARY KEY (id);


--
-- Name: permisos_rol permisos_rol_rol_modulo_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_rol
    ADD CONSTRAINT permisos_rol_rol_modulo_unique UNIQUE (rol, modulo);


--
-- Name: permisos_ubicacion permisos_ubicacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_ubicacion
    ADD CONSTRAINT permisos_ubicacion_pkey PRIMARY KEY (id);


--
-- Name: permisos_ubicacion permisos_ubicacion_ubicacion_rol_modulo_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_ubicacion
    ADD CONSTRAINT permisos_ubicacion_ubicacion_rol_modulo_unique UNIQUE (ubicacion_id, rol, modulo);


--
-- Name: permisos_usuario permisos_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_usuario
    ADD CONSTRAINT permisos_usuario_pkey PRIMARY KEY (id);


--
-- Name: permisos_usuario permisos_usuario_usuario_modulo_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_usuario
    ADD CONSTRAINT permisos_usuario_usuario_modulo_unique UNIQUE (usuario_id, modulo);


--
-- Name: pisos pisos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pisos
    ADD CONSTRAINT pisos_pkey PRIMARY KEY (id);


--
-- Name: precio_historial precio_historial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precio_historial
    ADD CONSTRAINT precio_historial_pkey PRIMARY KEY (id);


--
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id);


--
-- Name: productos productos_sku_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_sku_unique UNIQUE (sku);


--
-- Name: productos productos_tela_color_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_tela_color_unique UNIQUE (tela, color);


--
-- Name: proveedor_efectivo_e12 proveedor_efectivo_e12_ingreso_caja_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor_efectivo_e12
    ADD CONSTRAINT proveedor_efectivo_e12_ingreso_caja_id_key UNIQUE (ingreso_caja_id);


--
-- Name: proveedor_efectivo_e12 proveedor_efectivo_e12_movimiento_fondo_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor_efectivo_e12
    ADD CONSTRAINT proveedor_efectivo_e12_movimiento_fondo_id_key UNIQUE (movimiento_fondo_id);


--
-- Name: proveedor_efectivo_e12 proveedor_efectivo_e12_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor_efectivo_e12
    ADD CONSTRAINT proveedor_efectivo_e12_pkey PRIMARY KEY (pago_proveedor_id);


--
-- Name: proveedor_efectivo_e12 proveedor_efectivo_e12_retorno_fondo_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor_efectivo_e12
    ADD CONSTRAINT proveedor_efectivo_e12_retorno_fondo_id_key UNIQUE (retorno_fondo_id);


--
-- Name: proveedor_efectivo_e12 proveedor_efectivo_e12_reverso_proveedor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor_efectivo_e12
    ADD CONSTRAINT proveedor_efectivo_e12_reverso_proveedor_id_key UNIQUE (reverso_proveedor_id);


--
-- Name: proveedor_efectivo_e12 proveedor_efectivo_e12_salida_caja_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor_efectivo_e12
    ADD CONSTRAINT proveedor_efectivo_e12_salida_caja_id_key UNIQUE (salida_caja_id);


--
-- Name: proveedor_operaciones_e12 proveedor_operaciones_e12_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor_operaciones_e12
    ADD CONSTRAINT proveedor_operaciones_e12_pkey PRIMARY KEY (clave);


--
-- Name: proveedor_solicitudes_e12 proveedor_solicitudes_e12_clave_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor_solicitudes_e12
    ADD CONSTRAINT proveedor_solicitudes_e12_clave_key UNIQUE (clave);


--
-- Name: proveedor_solicitudes_e12 proveedor_solicitudes_e12_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor_solicitudes_e12
    ADD CONSTRAINT proveedor_solicitudes_e12_pkey PRIMARY KEY (solicitud_id);


--
-- Name: proveedores proveedores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT proveedores_pkey PRIMARY KEY (id);


--
-- Name: recibo_folio_e3 recibo_folio_e3_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recibo_folio_e3
    ADD CONSTRAINT recibo_folio_e3_pkey PRIMARY KEY (sitio_id);


--
-- Name: recibos_abono_e3 recibos_abono_e3_folio_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recibos_abono_e3
    ADD CONSTRAINT recibos_abono_e3_folio_key UNIQUE (folio);


--
-- Name: recibos_abono_e3 recibos_abono_e3_movimiento_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recibos_abono_e3
    ADD CONSTRAINT recibos_abono_e3_movimiento_id_key UNIQUE (movimiento_id);


--
-- Name: recibos_abono_e3 recibos_abono_e3_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recibos_abono_e3
    ADD CONSTRAINT recibos_abono_e3_pkey PRIMARY KEY (operacion_clave);


--
-- Name: reimpresiones_etiqueta reimpresiones_etiqueta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reimpresiones_etiqueta
    ADD CONSTRAINT reimpresiones_etiqueta_pkey PRIMARY KEY (id);


--
-- Name: revisiones_etiqueta revisiones_etiqueta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revisiones_etiqueta
    ADD CONSTRAINT revisiones_etiqueta_pkey PRIMARY KEY (id);


--
-- Name: rollos rollos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rollos
    ADD CONSTRAINT rollos_pkey PRIMARY KEY (id);


--
-- Name: rollos rollos_serie_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rollos
    ADD CONSTRAINT rollos_serie_unique UNIQUE (serie);


--
-- Name: salida_folio salida_folio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salida_folio
    ADD CONSTRAINT salida_folio_pkey PRIMARY KEY (ubicacion_id);


--
-- Name: salida_lineas salida_lineas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salida_lineas
    ADD CONSTRAINT salida_lineas_pkey PRIMARY KEY (id);


--
-- Name: salida_rollos salida_rollos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salida_rollos
    ADD CONSTRAINT salida_rollos_pkey PRIMARY KEY (id);


--
-- Name: salidas_dinero_caja salidas_dinero_caja_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas_dinero_caja
    ADD CONSTRAINT salidas_dinero_caja_pkey PRIMARY KEY (id);


--
-- Name: salidas salidas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_pkey PRIMARY KEY (id);


--
-- Name: salidas salidas_uuid_cliente_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_uuid_cliente_unique UNIQUE (uuid_cliente);


--
-- Name: series_consecutivo series_consecutivo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_consecutivo
    ADD CONSTRAINT series_consecutivo_pkey PRIMARY KEY (id);


--
-- Name: sesiones_caja_dias sesiones_caja_dias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones_caja_dias
    ADD CONSTRAINT sesiones_caja_dias_pkey PRIMARY KEY (ubicacion_id, fecha_operativa);


--
-- Name: sesiones_caja sesiones_caja_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones_caja
    ADD CONSTRAINT sesiones_caja_pkey PRIMARY KEY (id);


--
-- Name: sesiones sesiones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones
    ADD CONSTRAINT sesiones_pkey PRIMARY KEY (id);


--
-- Name: solicitudes_pago_dirigido solicitudes_pago_dirigido_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_pago_dirigido
    ADD CONSTRAINT solicitudes_pago_dirigido_pkey PRIMARY KEY (id);


--
-- Name: stock_minimo_episodios stock_minimo_episodios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_minimo_episodios
    ADD CONSTRAINT stock_minimo_episodios_pkey PRIMARY KEY (id);


--
-- Name: stock_minimo_sitios stock_minimo_sitios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_minimo_sitios
    ADD CONSTRAINT stock_minimo_sitios_pkey PRIMARY KEY (ubicacion_id);


--
-- Name: stock_minimos stock_minimos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_minimos
    ADD CONSTRAINT stock_minimos_pkey PRIMARY KEY (id);


--
-- Name: stock_minimos stock_minimos_producto_ubicacion_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_minimos
    ADD CONSTRAINT stock_minimos_producto_ubicacion_unique UNIQUE (producto_id, ubicacion_id);


--
-- Name: tarea4_rollo_remate tarea4_rollo_remate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarea4_rollo_remate
    ADD CONSTRAINT tarea4_rollo_remate_pkey PRIMARY KEY (rollo_id);


--
-- Name: test_reset_history test_reset_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_reset_history
    ADD CONSTRAINT test_reset_history_pkey PRIMARY KEY (id);


--
-- Name: ticket_folio ticket_folio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_folio
    ADD CONSTRAINT ticket_folio_pkey PRIMARY KEY (id);


--
-- Name: ticket_linea_consumos ticket_linea_consumos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_linea_consumos
    ADD CONSTRAINT ticket_linea_consumos_pkey PRIMARY KEY (id);


--
-- Name: ticket_lineas ticket_lineas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_lineas
    ADD CONSTRAINT ticket_lineas_pkey PRIMARY KEY (id);


--
-- Name: ticket_pagos ticket_pagos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_pagos
    ADD CONSTRAINT ticket_pagos_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_folio_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_folio_unique UNIQUE (folio);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_uuid_cliente_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_uuid_cliente_unique UNIQUE (uuid_cliente);


--
-- Name: ubicaciones ubicaciones_nombre_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ubicaciones
    ADD CONSTRAINT ubicaciones_nombre_unique UNIQUE (nombre);


--
-- Name: ubicaciones ubicaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ubicaciones
    ADD CONSTRAINT ubicaciones_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_usuario_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_usuario_unique UNIQUE (usuario);


--
-- Name: viaje_folio viaje_folio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.viaje_folio
    ADD CONSTRAINT viaje_folio_pkey PRIMARY KEY (ubicacion_id);


--
-- Name: viaje_salidas viaje_salidas_salida_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.viaje_salidas
    ADD CONSTRAINT viaje_salidas_salida_unique UNIQUE (salida_id);


--
-- Name: viaje_tickets viaje_tickets_ticket_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.viaje_tickets
    ADD CONSTRAINT viaje_tickets_ticket_unique UNIQUE (ticket_id);


--
-- Name: viajes viajes_origen_folio_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.viajes
    ADD CONSTRAINT viajes_origen_folio_unique UNIQUE (origen_id, folio);


--
-- Name: viajes viajes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.viajes
    ADD CONSTRAINT viajes_pkey PRIMARY KEY (id);


--
-- Name: vistas_abono_e3 vistas_abono_e3_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vistas_abono_e3
    ADD CONSTRAINT vistas_abono_e3_pkey PRIMARY KEY (operacion_clave);


--
-- Name: aplicaciones_credito_venta_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aplicaciones_credito_venta_idx ON public.aplicaciones_credito USING btree (venta_movimiento_id);


--
-- Name: aplicaciones_pago_proveedor_compra_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aplicaciones_pago_proveedor_compra_idx ON public.aplicaciones_pago_proveedor USING btree (compra_proveedor_id);


--
-- Name: auditoria_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auditoria_created_idx ON public.auditoria USING btree (created_at DESC, id DESC);


--
-- Name: auditoria_entidad_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auditoria_entidad_idx ON public.auditoria USING btree (entidad, entidad_id);


--
-- Name: auditoria_inventario_escaneos_usuario_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auditoria_inventario_escaneos_usuario_idx ON public.auditoria_inventario_escaneos USING btree (usuario_id);


--
-- Name: auditoria_inventario_snapshot_rollo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auditoria_inventario_snapshot_rollo_idx ON public.auditoria_inventario_snapshot USING btree (rollo_id);


--
-- Name: auditoria_modulo_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auditoria_modulo_created_idx ON public.auditoria USING btree (modulo, created_at DESC);


--
-- Name: auditoria_sitio_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auditoria_sitio_created_idx ON public.auditoria USING btree (sitio_id, created_at DESC);


--
-- Name: auditoria_sobrante_decisiones_audit_serie_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auditoria_sobrante_decisiones_audit_serie_idx ON public.auditoria_sobrante_decisiones USING btree (auditoria_id, serie, id);


--
-- Name: auditoria_usuario_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auditoria_usuario_created_idx ON public.auditoria USING btree (usuario_id, created_at);


--
-- Name: auditorias_inventario_ubicacion_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auditorias_inventario_ubicacion_idx ON public.auditorias_inventario USING btree (ubicacion_id);


--
-- Name: auditorias_inventario_una_abierta_por_sitio; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX auditorias_inventario_una_abierta_por_sitio ON public.auditorias_inventario USING btree (ubicacion_id) WHERE (estado = 'ABIERTA'::text);


--
-- Name: autorizaciones_nota_sesion_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX autorizaciones_nota_sesion_idx ON public.autorizaciones_nota USING btree (sesion_caja_id, created_at);


--
-- Name: caja_retornos_proveedor_e12_sesion_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX caja_retornos_proveedor_e12_sesion_idx ON public.caja_retornos_proveedor_e12 USING btree (sesion_caja_id);


--
-- Name: caja_salidas_e4_clave_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX caja_salidas_e4_clave_idx ON public.caja_salidas_e4 USING btree (((revision ->> 'claveOperacion'::text)));


--
-- Name: caja_salidas_e4_operaciones_salida_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX caja_salidas_e4_operaciones_salida_idx ON public.caja_salidas_e4_operaciones USING btree (salida_id);


--
-- Name: camionetas_activa_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX camionetas_activa_idx ON public.camionetas USING btree (activa);


--
-- Name: camionetas_placas_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX camionetas_placas_unique ON public.camionetas USING btree (placas);


--
-- Name: choferes_activo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX choferes_activo_idx ON public.choferes USING btree (activo);


--
-- Name: choferes_nombre_completo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX choferes_nombre_completo_idx ON public.choferes USING btree (nombre_completo);


--
-- Name: cliente_documentos_cliente_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cliente_documentos_cliente_idx ON public.cliente_documentos USING btree (cliente_id);


--
-- Name: cliente_documentos_slot_vigente_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cliente_documentos_slot_vigente_uidx ON public.cliente_documentos USING btree (cliente_id, lado) WHERE vigente;


--
-- Name: clientes_activos_no_sistema_nombre_normalizado_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX clientes_activos_no_sistema_nombre_normalizado_uidx ON public.clientes USING btree (lower(btrim(nombre))) WHERE (activo AND (NOT es_sistema));


--
-- Name: contenedor_lineas_contenedor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contenedor_lineas_contenedor_idx ON public.contenedor_lineas USING btree (contenedor_id);


--
-- Name: contenedor_lineas_producto_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contenedor_lineas_producto_idx ON public.contenedor_lineas USING btree (producto_id);


--
-- Name: contenedores_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contenedores_estado_idx ON public.contenedores USING btree (estado);


--
-- Name: contenedores_fecha_estimada_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contenedores_fecha_estimada_idx ON public.contenedores USING btree (fecha_estimada_llegada);


--
-- Name: contenedores_proveedor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contenedores_proveedor_idx ON public.contenedores USING btree (proveedor_id);


--
-- Name: contenedores_sitio_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contenedores_sitio_estado_idx ON public.contenedores USING btree (sitio_destino_id, estado);


--
-- Name: cuadre_fiscal_registros_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cuadre_fiscal_registros_created_idx ON public.cuadre_fiscal_registros USING btree (created_at DESC);


--
-- Name: e11_notificacion_unica; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX e11_notificacion_unica ON public.notificaciones_sistema USING btree (entidad_id) WHERE (tipo = 'E11_NO_CUADRA'::text);


--
-- Name: e5_cobros_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX e5_cobros_scope ON public.e5_cobros USING btree (ubicacion_id, cliente_id, id);


--
-- Name: e5_un_favor_grupo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX e5_un_favor_grupo ON public.e5_aplicaciones USING btree (grupo_id) WHERE favor;


--
-- Name: e5_un_recibo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX e5_un_recibo ON public.e5_documentos USING btree (cobro_id) WHERE (tipo = 'RECIBO'::text);


--
-- Name: e9_ubicacion_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX e9_ubicacion_idx ON public.e9_entregas USING btree (ubicacion_id, id);


--
-- Name: entradas_fecha_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entradas_fecha_id_idx ON public.entradas USING btree (fecha, id);


--
-- Name: entradas_fecha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entradas_fecha_idx ON public.entradas USING btree (fecha);


--
-- Name: entradas_folio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entradas_folio_idx ON public.entradas USING btree (folio);


--
-- Name: entradas_proveedor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entradas_proveedor_idx ON public.entradas USING btree (proveedor_id);


--
-- Name: entradas_ubicacion_folio_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX entradas_ubicacion_folio_uidx ON public.entradas USING btree (ubicacion_id, folio);


--
-- Name: entradas_ubicacion_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entradas_ubicacion_idx ON public.entradas USING btree (ubicacion_id);


--
-- Name: entradas_uuid_cliente_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entradas_uuid_cliente_idx ON public.entradas USING btree (uuid_cliente);


--
-- Name: equipos_checklist_equipo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX equipos_checklist_equipo_idx ON public.equipos_checklist USING btree (equipo_id);


--
-- Name: equipos_checklist_equipo_item_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX equipos_checklist_equipo_item_unique ON public.equipos_checklist USING btree (equipo_id, item_key);


--
-- Name: equipos_ubicacion_identificador_ci_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX equipos_ubicacion_identificador_ci_unique ON public.equipos USING btree (ubicacion_id, lower(identificador));


--
-- Name: equipos_ubicacion_tipo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX equipos_ubicacion_tipo_idx ON public.equipos USING btree (ubicacion_id, tipo);


--
-- Name: existencias_producto_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX existencias_producto_idx ON public.existencias USING btree (producto_id);


--
-- Name: existencias_ubicacion_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX existencias_ubicacion_idx ON public.existencias USING btree (ubicacion_id);


--
-- Name: fondo_arqueos_fondo_fecha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fondo_arqueos_fondo_fecha_idx ON public.fondo_arqueos USING btree (fondo_id, created_at DESC, id DESC);


--
-- Name: fondo_arqueos_productor_idempotencia_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fondo_arqueos_productor_idempotencia_uidx ON public.fondo_arqueos USING btree (idempotency_producer, idempotency_key);


--
-- Name: fondo_mariana_singleton_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fondo_mariana_singleton_uidx ON public.fondo_mariana USING btree ((true));


--
-- Name: fondo_mariana_ubicacion_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fondo_mariana_ubicacion_uidx ON public.fondo_mariana USING btree (ubicacion_id);


--
-- Name: fondo_movimientos_fondo_ordinal_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fondo_movimientos_fondo_ordinal_idx ON public.fondo_movimientos USING btree (fondo_id, ordinal DESC);


--
-- Name: fondo_movimientos_ordinal_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fondo_movimientos_ordinal_uidx ON public.fondo_movimientos USING btree (ordinal);


--
-- Name: fondo_movimientos_original_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fondo_movimientos_original_uidx ON public.fondo_movimientos USING btree (original_id) WHERE (original_id IS NOT NULL);


--
-- Name: fondo_movimientos_productor_idempotencia_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fondo_movimientos_productor_idempotencia_uidx ON public.fondo_movimientos USING btree (idempotency_producer, idempotency_key);


--
-- Name: movimientos_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX movimientos_created_idx ON public.movimientos USING btree (created_at);


--
-- Name: movimientos_credito_cliente_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX movimientos_credito_cliente_created_at_idx ON public.movimientos_credito USING btree (cliente_id, created_at);


--
-- Name: movimientos_credito_reverso_origen_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX movimientos_credito_reverso_origen_uidx ON public.movimientos_credito USING btree (movimiento_origen_id) WHERE ((tipo = 'REVERSO'::public.tipo_movimiento_credito) AND (movimiento_origen_id IS NOT NULL));


--
-- Name: movimientos_credito_ticket_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX movimientos_credito_ticket_idx ON public.movimientos_credito USING btree (ticket_id);


--
-- Name: movimientos_motivo_salida_extraordinaria_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX movimientos_motivo_salida_extraordinaria_idx ON public.movimientos USING btree (motivo_salida_extraordinaria);


--
-- Name: movimientos_operacion_uq_e1; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX movimientos_operacion_uq_e1 ON public.movimientos_credito USING btree (operacion_productor, operacion_clave) WHERE (operacion_productor IS NOT NULL);


--
-- Name: movimientos_producto_ubicacion_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX movimientos_producto_ubicacion_idx ON public.movimientos USING btree (producto_id, ubicacion_id);


--
-- Name: movimientos_revisado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX movimientos_revisado_idx ON public.movimientos USING btree (revisado);


--
-- Name: movimientos_rollo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX movimientos_rollo_idx ON public.movimientos USING btree (rollo_id);


--
-- Name: movimientos_salida_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX movimientos_salida_idx ON public.movimientos USING btree (salida_id);


--
-- Name: movimientos_tipo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX movimientos_tipo_idx ON public.movimientos USING btree (tipo);


--
-- Name: movimientos_ubicacion_created_reportes_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX movimientos_ubicacion_created_reportes_idx ON public.movimientos USING btree (ubicacion_id, created_at);


--
-- Name: movimientos_uuid_cliente_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX movimientos_uuid_cliente_idx ON public.movimientos USING btree (uuid_cliente);


--
-- Name: notificaciones_auditoria_cerrada_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notificaciones_auditoria_cerrada_uidx ON public.notificaciones_sistema USING btree (entidad, entidad_id) WHERE (tipo = 'AUDITORIA_INVENTARIO_CERRADA'::text);


--
-- Name: notificaciones_credito_cliente_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notificaciones_credito_cliente_idx ON public.notificaciones_credito USING btree (cliente_id);


--
-- Name: notificaciones_credito_leida_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notificaciones_credito_leida_created_idx ON public.notificaciones_credito USING btree (leida_at, created_at);


--
-- Name: notificaciones_sistema_destinatario_leida_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notificaciones_sistema_destinatario_leida_idx ON public.notificaciones_sistema USING btree (destinatario_usuario_id, leida_at, created_at);


--
-- Name: notificaciones_sistema_leida_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notificaciones_sistema_leida_created_idx ON public.notificaciones_sistema USING btree (leida_at, created_at);


--
-- Name: notificaciones_sistema_pago_dirigido_resuelto_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notificaciones_sistema_pago_dirigido_resuelto_uidx ON public.notificaciones_sistema USING btree (entidad, entidad_id, destinatario_usuario_id) WHERE (tipo = 'PAGO_DIRIGIDO_RESUELTO'::text);


--
-- Name: notificaciones_sistema_stock_minimo_episode_recipient_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notificaciones_sistema_stock_minimo_episode_recipient_uidx ON public.notificaciones_sistema USING btree (entidad, entidad_id, destinatario_usuario_id) WHERE (tipo = 'STOCK_MINIMO'::text);


--
-- Name: pagos_proveedor_entrada_compra_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pagos_proveedor_entrada_compra_idx ON public.pagos_proveedor USING btree (entrada_id) WHERE ((tipo = 'COMPRA'::public.tipo_pago_proveedor) AND (entrada_id IS NOT NULL));


--
-- Name: pagos_proveedor_proveedor_fecha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pagos_proveedor_proveedor_fecha_idx ON public.pagos_proveedor USING btree (proveedor_id, fecha);


--
-- Name: pagos_proveedor_reverso_origen_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pagos_proveedor_reverso_origen_uidx ON public.pagos_proveedor USING btree (movimiento_origen_id) WHERE ((tipo = 'REVERSO'::public.tipo_pago_proveedor) AND (movimiento_origen_id IS NOT NULL));


--
-- Name: pisos_ubicacion_nombre_ci_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pisos_ubicacion_nombre_ci_unique ON public.pisos USING btree (ubicacion_id, lower(nombre));


--
-- Name: precio_historial_producto_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX precio_historial_producto_created_idx ON public.precio_historial USING btree (producto_id, created_at);


--
-- Name: precio_historial_producto_modo_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX precio_historial_producto_modo_created_idx ON public.precio_historial USING btree (producto_id, modo_precio, created_at);


--
-- Name: productos_sku_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX productos_sku_idx ON public.productos USING btree (sku);


--
-- Name: productos_tela_color_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX productos_tela_color_idx ON public.productos USING btree (tela, color);


--
-- Name: recibos_abono_e3_cliente_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recibos_abono_e3_cliente_idx ON public.recibos_abono_e3 USING btree (cliente_id, movimiento_id);


--
-- Name: recibos_abono_e3_sesion_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recibos_abono_e3_sesion_idx ON public.recibos_abono_e3 USING btree (sesion_operativa_id, movimiento_id);


--
-- Name: reimpresiones_etiqueta_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reimpresiones_etiqueta_created_at_idx ON public.reimpresiones_etiqueta USING btree (created_at);


--
-- Name: reimpresiones_etiqueta_rollo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reimpresiones_etiqueta_rollo_idx ON public.reimpresiones_etiqueta USING btree (rollo_id);


--
-- Name: reimpresiones_etiqueta_usuario_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reimpresiones_etiqueta_usuario_idx ON public.reimpresiones_etiqueta USING btree (usuario_id);


--
-- Name: revisiones_etiqueta_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX revisiones_etiqueta_created_at_idx ON public.revisiones_etiqueta USING btree (created_at);


--
-- Name: revisiones_etiqueta_rollo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX revisiones_etiqueta_rollo_idx ON public.revisiones_etiqueta USING btree (rollo_id);


--
-- Name: revisiones_etiqueta_rollo_reimpresion_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX revisiones_etiqueta_rollo_reimpresion_uidx ON public.revisiones_etiqueta USING btree (rollo_id, reimpresion_id);


--
-- Name: revisiones_etiqueta_usuario_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX revisiones_etiqueta_usuario_idx ON public.revisiones_etiqueta USING btree (usuario_id);


--
-- Name: rollos_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rollos_estado_idx ON public.rollos USING btree (estado);


--
-- Name: rollos_piso_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rollos_piso_idx ON public.rollos USING btree (piso_id);


--
-- Name: rollos_producto_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rollos_producto_idx ON public.rollos USING btree (producto_id);


--
-- Name: rollos_recepcion_producto_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rollos_recepcion_producto_idx ON public.rollos USING btree (recepcion_id, producto_id);


--
-- Name: rollos_serie_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rollos_serie_idx ON public.rollos USING btree (serie);


--
-- Name: rollos_ubicacion_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rollos_ubicacion_idx ON public.rollos USING btree (ubicacion_id);


--
-- Name: rollos_ubicacion_producto_reportes_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rollos_ubicacion_producto_reportes_idx ON public.rollos USING btree (ubicacion_id, producto_id);


--
-- Name: salida_lineas_producto_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX salida_lineas_producto_idx ON public.salida_lineas USING btree (producto_id);


--
-- Name: salida_lineas_salida_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX salida_lineas_salida_idx ON public.salida_lineas USING btree (salida_id);


--
-- Name: salida_rollos_linea_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX salida_rollos_linea_idx ON public.salida_rollos USING btree (linea_id);


--
-- Name: salida_rollos_rollo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX salida_rollos_rollo_idx ON public.salida_rollos USING btree (rollo_id);


--
-- Name: salida_rollos_rollo_salida_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX salida_rollos_rollo_salida_idx ON public.salida_rollos USING btree (rollo_id, salida_id);


--
-- Name: salida_rollos_salida_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX salida_rollos_salida_idx ON public.salida_rollos USING btree (salida_id);


--
-- Name: salidas_borrador_usuario_origen_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX salidas_borrador_usuario_origen_uidx ON public.salidas USING btree (usuario_solicita_id, origen_id) WHERE ((estado = 'ARMANDO'::public.estado_salida) AND (modalidad = 'TRASLADO'::text) AND (usuario_solicita_id IS NOT NULL));


--
-- Name: salidas_cliente_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX salidas_cliente_estado_idx ON public.salidas USING btree (cliente_id, estado);


--
-- Name: salidas_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX salidas_created_at_idx ON public.salidas USING btree (created_at);


--
-- Name: salidas_destino_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX salidas_destino_estado_idx ON public.salidas USING btree (destino_id, estado);


--
-- Name: salidas_dinero_caja_proveedor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX salidas_dinero_caja_proveedor_idx ON public.salidas_dinero_caja USING btree (proveedor_id);


--
-- Name: salidas_dinero_caja_sesion_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX salidas_dinero_caja_sesion_created_idx ON public.salidas_dinero_caja USING btree (sesion_caja_id, created_at);


--
-- Name: salidas_estado_actividad_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX salidas_estado_actividad_idx ON public.salidas USING btree (estado, actividad_at);


--
-- Name: salidas_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX salidas_estado_idx ON public.salidas USING btree (estado);


--
-- Name: salidas_folio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX salidas_folio_idx ON public.salidas USING btree (folio);


--
-- Name: salidas_origen_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX salidas_origen_estado_idx ON public.salidas USING btree (origen_id, estado);


--
-- Name: salidas_origen_folio_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX salidas_origen_folio_uidx ON public.salidas USING btree (origen_id, folio);


--
-- Name: salidas_ticket_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX salidas_ticket_idx ON public.salidas USING btree (ticket_id);


--
-- Name: sesiones_caja_cerrada_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sesiones_caja_cerrada_at_idx ON public.sesiones_caja USING btree (cerrada_at) WHERE (estado = 'CERRADA'::public.estado_sesion_caja);


--
-- Name: sesiones_caja_ubicacion_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sesiones_caja_ubicacion_estado_idx ON public.sesiones_caja USING btree (ubicacion_id, estado);


--
-- Name: sesiones_caja_una_abierta_ubicacion_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sesiones_caja_una_abierta_ubicacion_idx ON public.sesiones_caja USING btree (ubicacion_id) WHERE (estado = 'ABIERTA'::public.estado_sesion_caja);


--
-- Name: solicitudes_pago_dirigido_entidad_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX solicitudes_pago_dirigido_entidad_idx ON public.solicitudes_pago_dirigido USING btree (tipo, entidad_id);


--
-- Name: solicitudes_pago_dirigido_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX solicitudes_pago_dirigido_estado_idx ON public.solicitudes_pago_dirigido USING btree (estado, created_at);


--
-- Name: stock_minimo_episodios_activo_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX stock_minimo_episodios_activo_uidx ON public.stock_minimo_episodios USING btree (producto_id, ubicacion_id) WHERE (cerrado_at IS NULL);


--
-- Name: stock_minimo_episodios_ubicacion_abierto_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_minimo_episodios_ubicacion_abierto_idx ON public.stock_minimo_episodios USING btree (ubicacion_id, cerrado_at);


--
-- Name: stock_minimos_producto_ubicacion_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX stock_minimos_producto_ubicacion_uidx ON public.stock_minimos USING btree (producto_id, ubicacion_id);


--
-- Name: stock_minimos_ubicacion_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_minimos_ubicacion_idx ON public.stock_minimos USING btree (ubicacion_id);


--
-- Name: ticket_linea_consumos_idempotencia_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ticket_linea_consumos_idempotencia_uidx ON public.ticket_linea_consumos USING btree (idempotencia);


--
-- Name: ticket_linea_consumos_movimiento_consumo_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ticket_linea_consumos_movimiento_consumo_uidx ON public.ticket_linea_consumos USING btree (movimiento_id) WHERE (tipo = 'CONSUMO'::text);


--
-- Name: ticket_linea_consumos_proveedor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_linea_consumos_proveedor_idx ON public.ticket_linea_consumos USING btree (proveedor_id);


--
-- Name: ticket_linea_consumos_reversa_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ticket_linea_consumos_reversa_uidx ON public.ticket_linea_consumos USING btree (reversa_de_id) WHERE (tipo = 'REVERSA'::text);


--
-- Name: ticket_linea_consumos_rollo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_linea_consumos_rollo_idx ON public.ticket_linea_consumos USING btree (rollo_id);


--
-- Name: ticket_linea_consumos_ticket_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_linea_consumos_ticket_idx ON public.ticket_linea_consumos USING btree (ticket_id);


--
-- Name: ticket_linea_consumos_ticket_linea_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_linea_consumos_ticket_linea_idx ON public.ticket_linea_consumos USING btree (ticket_linea_id);


--
-- Name: ticket_lineas_producto_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_lineas_producto_idx ON public.ticket_lineas USING btree (producto_id);


--
-- Name: ticket_lineas_producto_ticket_reportes_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_lineas_producto_ticket_reportes_idx ON public.ticket_lineas USING btree (producto_id, ticket_id);


--
-- Name: ticket_lineas_rollo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_lineas_rollo_idx ON public.ticket_lineas USING btree (rollo_id);


--
-- Name: ticket_lineas_ticket_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_lineas_ticket_idx ON public.ticket_lineas USING btree (ticket_id);


--
-- Name: ticket_lineas_tipo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_lineas_tipo_idx ON public.ticket_lineas USING btree (tipo);


--
-- Name: ticket_pagos_ticket_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_pagos_ticket_idx ON public.ticket_pagos USING btree (ticket_id);


--
-- Name: tickets_cliente_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_cliente_created_at_idx ON public.tickets USING btree (cliente_id, created_at);


--
-- Name: tickets_cobrado_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_cobrado_created_at_idx ON public.tickets USING btree (created_at, ubicacion_id) WHERE (cobrado = true);


--
-- Name: tickets_cobrado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_cobrado_idx ON public.tickets USING btree (cobrado);


--
-- Name: tickets_contabilizados_sitio_fecha_ga_candidate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_contabilizados_sitio_fecha_ga_candidate ON public.tickets USING btree (ubicacion_id, (
CASE
    WHEN (documento_tipo = 'TICKET'::text) THEN cobrado_at
    ELSE autorizado_at
END)) WHERE ((estado = 'VENDIDO'::public.estado_ticket) AND (((documento_tipo = 'TICKET'::text) AND (cobrado = true)) OR ((documento_tipo = 'NOTA'::text) AND (autorizacion_estado = 'AUTORIZADA'::text))));


--
-- Name: tickets_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_created_at_idx ON public.tickets USING btree (created_at);


--
-- Name: tickets_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_estado_idx ON public.tickets USING btree (estado);


--
-- Name: tickets_folio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_folio_idx ON public.tickets USING btree (folio);


--
-- Name: tickets_pendientes_corte_ga_candidate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_pendientes_corte_ga_candidate ON public.tickets USING btree (ubicacion_id, created_at, id) WHERE ((estado = 'VENDIDO'::public.estado_ticket) AND (((documento_tipo = 'TICKET'::text) AND (cobrado = false)) OR ((documento_tipo = 'NOTA'::text) AND (autorizacion_estado = 'PENDIENTE'::text))));


--
-- Name: tickets_sesion_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_sesion_estado_idx ON public.tickets USING btree (sesion_caja_id, estado);


--
-- Name: tickets_ubicacion_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_ubicacion_created_at_idx ON public.tickets USING btree (ubicacion_id, created_at);


--
-- Name: tickets_uuid_cliente_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_uuid_cliente_idx ON public.tickets USING btree (uuid_cliente);


--
-- Name: ubicaciones_iniciales_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ubicaciones_iniciales_uidx ON public.ubicaciones USING btree (iniciales);


--
-- Name: viaje_salidas_viaje_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX viaje_salidas_viaje_idx ON public.viaje_salidas USING btree (viaje_id);


--
-- Name: viaje_tickets_viaje_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX viaje_tickets_viaje_idx ON public.viaje_tickets USING btree (viaje_id);


--
-- Name: viajes_camioneta_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX viajes_camioneta_idx ON public.viajes USING btree (camioneta_id);


--
-- Name: viajes_chofer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX viajes_chofer_idx ON public.viajes USING btree (chofer_id);


--
-- Name: viajes_salida_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX viajes_salida_at_idx ON public.viajes USING btree (salida_at);


--
-- Name: aplicaciones_credito aplicaciones_credito_inmutables; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER aplicaciones_credito_inmutables BEFORE DELETE OR UPDATE ON public.aplicaciones_credito FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_record_mutation();


--
-- Name: aplicaciones_credito aplicaciones_credito_validas; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER aplicaciones_credito_validas BEFORE INSERT ON public.aplicaciones_credito FOR EACH ROW EXECUTE FUNCTION public.validate_credit_application();


--
-- Name: aplicaciones_pago_proveedor aplicaciones_pago_proveedor_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER aplicaciones_pago_proveedor_append_only BEFORE DELETE OR UPDATE ON public.aplicaciones_pago_proveedor FOR EACH ROW EXECUTE FUNCTION public.proteger_aplicaciones_pago_proveedor();


--
-- Name: aplicaciones_pago_proveedor aplicaciones_pago_proveedor_validar_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER aplicaciones_pago_proveedor_validar_insert BEFORE INSERT ON public.aplicaciones_pago_proveedor FOR EACH ROW EXECUTE FUNCTION public.validar_aplicacion_pago_proveedor();


--
-- Name: atribuciones_credito_e1 atribuciones_inmutables_e1; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atribuciones_inmutables_e1 BEFORE DELETE OR UPDATE OR TRUNCATE ON public.atribuciones_credito_e1 FOR EACH STATEMENT EXECUTE FUNCTION public.impedir_mutacion_credito_e1();


--
-- Name: atribuciones_credito_e1 atribuciones_validas_e1; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atribuciones_validas_e1 BEFORE INSERT ON public.atribuciones_credito_e1 FOR EACH ROW EXECUTE FUNCTION public.validar_atribucion_credito_e1();


--
-- Name: auditoria auditoria_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auditoria_append_only BEFORE DELETE OR UPDATE ON public.auditoria FOR EACH ROW EXECUTE FUNCTION public.proteger_auditoria_append_only();


--
-- Name: auditoria auditoria_enriquecer_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auditoria_enriquecer_insert BEFORE INSERT ON public.auditoria FOR EACH ROW EXECUTE FUNCTION public.enriquecer_auditoria();


--
-- Name: auditoria_faltante_reactivaciones auditoria_faltante_reactivaciones_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auditoria_faltante_reactivaciones_append_only BEFORE DELETE OR UPDATE ON public.auditoria_faltante_reactivaciones FOR EACH ROW EXECUTE FUNCTION public.proteger_auditoria_resolucion_append_only();


--
-- Name: auditoria_sobrante_contextos auditoria_sobrante_contextos_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auditoria_sobrante_contextos_append_only BEFORE DELETE OR UPDATE ON public.auditoria_sobrante_contextos FOR EACH ROW EXECUTE FUNCTION public.proteger_auditoria_resolucion_append_only();


--
-- Name: auditoria_sobrante_decisiones auditoria_sobrante_decisiones_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auditoria_sobrante_decisiones_append_only BEFORE DELETE OR UPDATE ON public.auditoria_sobrante_decisiones FOR EACH ROW EXECUTE FUNCTION public.proteger_auditoria_resolucion_append_only();


--
-- Name: caja_desbloqueos_e12 caja_desbloqueos_e12_actor; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER caja_desbloqueos_e12_actor BEFORE INSERT ON public.caja_desbloqueos_e12 FOR EACH ROW EXECUTE FUNCTION public.e12_override_guard();


--
-- Name: caja_desbloqueos_e12 caja_desbloqueos_e12_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER caja_desbloqueos_e12_immutable BEFORE DELETE OR UPDATE ON public.caja_desbloqueos_e12 FOR EACH ROW EXECUTE FUNCTION public.e12_immutable();


--
-- Name: caja_desbloqueos_e12 caja_desbloqueos_e12_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER caja_desbloqueos_e12_no_truncate BEFORE TRUNCATE ON public.caja_desbloqueos_e12 FOR EACH STATEMENT EXECUTE FUNCTION public.e12_immutable();


--
-- Name: caja_retornos_proveedor_e12 caja_retornos_proveedor_e12_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER caja_retornos_proveedor_e12_immutable BEFORE DELETE OR UPDATE ON public.caja_retornos_proveedor_e12 FOR EACH ROW EXECUTE FUNCTION public.e12_immutable();


--
-- Name: caja_retornos_proveedor_e12 caja_retornos_proveedor_e12_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER caja_retornos_proveedor_e12_no_truncate BEFORE TRUNCATE ON public.caja_retornos_proveedor_e12 FOR EACH STATEMENT EXECUTE FUNCTION public.e12_immutable();


--
-- Name: salidas_dinero_caja caja_salidas_e4_expense_guard_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER caja_salidas_e4_expense_guard_trg BEFORE DELETE OR UPDATE ON public.salidas_dinero_caja FOR EACH ROW EXECUTE FUNCTION public.caja_salidas_e4_expense_guard();


--
-- Name: caja_salidas_e4 caja_salidas_e4_guard_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER caja_salidas_e4_guard_trg BEFORE INSERT OR DELETE OR UPDATE ON public.caja_salidas_e4 FOR EACH ROW EXECUTE FUNCTION public.caja_salidas_e4_guard();


--
-- Name: caja_salidas_e4_operaciones caja_salidas_e4_operaciones_immutable_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER caja_salidas_e4_operaciones_immutable_trg BEFORE DELETE OR UPDATE ON public.caja_salidas_e4_operaciones FOR EACH ROW EXECUTE FUNCTION public.caja_salidas_e4_immutable();


--
-- Name: cobros_credito_pendientes_e1 cobros_inmutables_e1; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cobros_inmutables_e1 BEFORE DELETE OR UPDATE OR TRUNCATE ON public.cobros_credito_pendientes_e1 FOR EACH STATEMENT EXECUTE FUNCTION public.impedir_mutacion_credito_e1();


--
-- Name: cobros_credito_pendientes_e1 cobros_validos_e1; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cobros_validos_e1 AFTER INSERT ON public.cobros_credito_pendientes_e1 FOR EACH ROW EXECUTE FUNCTION public.validar_cobro_pendiente_e1();


--
-- Name: e11_avisos e11_before; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_before BEFORE INSERT OR UPDATE ON public.e11_avisos FOR EACH ROW EXECUTE FUNCTION public.e11_before();


--
-- Name: e11_conciliacion_ventas e11_before; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_before BEFORE INSERT OR UPDATE ON public.e11_conciliacion_ventas FOR EACH ROW EXECUTE FUNCTION public.e11_before();


--
-- Name: e11_conciliaciones e11_before; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_before BEFORE INSERT OR UPDATE ON public.e11_conciliaciones FOR EACH ROW EXECUTE FUNCTION public.e11_before();


--
-- Name: e11_decisiones e11_before; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_before BEFORE INSERT OR UPDATE ON public.e11_decisiones FOR EACH ROW EXECUTE FUNCTION public.e11_before();


--
-- Name: e11_operaciones e11_before; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_before BEFORE INSERT OR UPDATE ON public.e11_operaciones FOR EACH ROW EXECUTE FUNCTION public.e11_before();


--
-- Name: e11_perfil_eventos e11_before; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_before BEFORE INSERT OR UPDATE ON public.e11_perfil_eventos FOR EACH ROW EXECUTE FUNCTION public.e11_before();


--
-- Name: e11_perfiles e11_before; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_before BEFORE INSERT OR UPDATE ON public.e11_perfiles FOR EACH ROW EXECUTE FUNCTION public.e11_before();


--
-- Name: e11_resoluciones e11_before; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_before BEFORE INSERT OR UPDATE ON public.e11_resoluciones FOR EACH ROW EXECUTE FUNCTION public.e11_before();


--
-- Name: e11_e5_definiciones e11_ddl_no_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_ddl_no_insert BEFORE INSERT ON public.e11_e5_definiciones FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e11_e5_definiciones e11_ddl_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_ddl_no_truncate BEFORE TRUNCATE ON public.e11_e5_definiciones FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e5_operaciones e11_e5_capture; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_e5_capture AFTER INSERT ON public.e5_operaciones FOR EACH ROW EXECUTE FUNCTION public.e11_e5_capture();


--
-- Name: clientes e11_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e11_graph AFTER INSERT OR DELETE OR UPDATE ON public.clientes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e11_graph();


--
-- Name: e11_avisos e11_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e11_graph AFTER INSERT OR DELETE OR UPDATE ON public.e11_avisos DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e11_graph();


--
-- Name: e11_cambios_usuario e11_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e11_graph AFTER INSERT OR DELETE OR UPDATE ON public.e11_cambios_usuario DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e11_graph();


--
-- Name: e11_conciliacion_ventas e11_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e11_graph AFTER INSERT OR DELETE OR UPDATE ON public.e11_conciliacion_ventas DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e11_graph();


--
-- Name: e11_conciliaciones e11_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e11_graph AFTER INSERT OR DELETE OR UPDATE ON public.e11_conciliaciones DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e11_graph();


--
-- Name: e11_decisiones e11_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e11_graph AFTER INSERT OR DELETE OR UPDATE ON public.e11_decisiones DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e11_graph();


--
-- Name: e11_e5_preparaciones e11_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e11_graph AFTER INSERT OR DELETE OR UPDATE ON public.e11_e5_preparaciones DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e11_graph();


--
-- Name: e11_notificacion_origen e11_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e11_graph AFTER INSERT OR DELETE OR UPDATE ON public.e11_notificacion_origen DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e11_graph();


--
-- Name: e11_operaciones e11_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e11_graph AFTER INSERT OR DELETE OR UPDATE ON public.e11_operaciones DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e11_graph();


--
-- Name: e11_perfil_eventos e11_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e11_graph AFTER INSERT OR DELETE OR UPDATE ON public.e11_perfil_eventos DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e11_graph();


--
-- Name: e11_perfiles e11_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e11_graph AFTER INSERT OR DELETE OR UPDATE ON public.e11_perfiles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e11_graph();


--
-- Name: e11_resoluciones e11_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e11_graph AFTER INSERT OR DELETE OR UPDATE ON public.e11_resoluciones DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e11_graph();


--
-- Name: e5_cobros e11_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e11_graph AFTER INSERT OR DELETE OR UPDATE ON public.e5_cobros DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e11_graph();


--
-- Name: e5_nacimientos e11_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e11_graph AFTER INSERT OR DELETE OR UPDATE ON public.e5_nacimientos DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e11_graph();


--
-- Name: e5_operaciones e11_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e11_graph AFTER INSERT OR DELETE OR UPDATE ON public.e5_operaciones DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e11_graph();


--
-- Name: movimientos_credito e11_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e11_graph AFTER INSERT OR DELETE OR UPDATE ON public.movimientos_credito DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e11_graph();


--
-- Name: notificaciones_sistema e11_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e11_graph AFTER INSERT OR DELETE OR UPDATE ON public.notificaciones_sistema DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e11_graph();


--
-- Name: tickets e11_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e11_graph AFTER INSERT OR DELETE OR UPDATE ON public.tickets DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e11_graph();


--
-- Name: ubicaciones e11_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e11_graph AFTER INSERT OR DELETE OR UPDATE ON public.ubicaciones DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e11_graph();


--
-- Name: usuarios e11_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e11_graph AFTER INSERT OR DELETE OR UPDATE ON public.usuarios DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e11_graph();


--
-- Name: e11_avisos e11_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_immutable BEFORE DELETE OR UPDATE ON public.e11_avisos FOR EACH ROW EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e11_cambios_usuario e11_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_immutable BEFORE DELETE OR UPDATE ON public.e11_cambios_usuario FOR EACH ROW EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e11_conciliacion_ventas e11_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_immutable BEFORE DELETE OR UPDATE ON public.e11_conciliacion_ventas FOR EACH ROW EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e11_conciliaciones e11_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_immutable BEFORE DELETE OR UPDATE ON public.e11_conciliaciones FOR EACH ROW EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e11_decisiones e11_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_immutable BEFORE DELETE OR UPDATE ON public.e11_decisiones FOR EACH ROW EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e11_e5_definiciones e11_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_immutable BEFORE DELETE OR UPDATE ON public.e11_e5_definiciones FOR EACH ROW EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e11_e5_preparaciones e11_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_immutable BEFORE DELETE OR UPDATE ON public.e11_e5_preparaciones FOR EACH ROW EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e11_notificacion_origen e11_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_immutable BEFORE DELETE OR UPDATE ON public.e11_notificacion_origen FOR EACH ROW EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e11_operaciones e11_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_immutable BEFORE DELETE OR UPDATE ON public.e11_operaciones FOR EACH ROW EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e11_perfil_eventos e11_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_immutable BEFORE DELETE OR UPDATE ON public.e11_perfil_eventos FOR EACH ROW EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e11_resoluciones e11_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_immutable BEFORE DELETE OR UPDATE ON public.e11_resoluciones FOR EACH ROW EXECUTE FUNCTION public.e11_immutable();


--
-- Name: clientes e11_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_no_truncate BEFORE TRUNCATE ON public.clientes FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e11_avisos e11_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_no_truncate BEFORE TRUNCATE ON public.e11_avisos FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e11_cambios_usuario e11_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_no_truncate BEFORE TRUNCATE ON public.e11_cambios_usuario FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e11_conciliacion_ventas e11_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_no_truncate BEFORE TRUNCATE ON public.e11_conciliacion_ventas FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e11_conciliaciones e11_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_no_truncate BEFORE TRUNCATE ON public.e11_conciliaciones FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e11_decisiones e11_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_no_truncate BEFORE TRUNCATE ON public.e11_decisiones FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e11_e5_preparaciones e11_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_no_truncate BEFORE TRUNCATE ON public.e11_e5_preparaciones FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e11_notificacion_origen e11_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_no_truncate BEFORE TRUNCATE ON public.e11_notificacion_origen FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e11_operaciones e11_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_no_truncate BEFORE TRUNCATE ON public.e11_operaciones FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e11_perfil_eventos e11_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_no_truncate BEFORE TRUNCATE ON public.e11_perfil_eventos FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e11_perfiles e11_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_no_truncate BEFORE TRUNCATE ON public.e11_perfiles FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e11_resoluciones e11_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_no_truncate BEFORE TRUNCATE ON public.e11_resoluciones FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e5_cobros e11_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_no_truncate BEFORE TRUNCATE ON public.e5_cobros FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e5_nacimientos e11_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_no_truncate BEFORE TRUNCATE ON public.e5_nacimientos FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e5_operaciones e11_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_no_truncate BEFORE TRUNCATE ON public.e5_operaciones FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable();


--
-- Name: movimientos_credito e11_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_no_truncate BEFORE TRUNCATE ON public.movimientos_credito FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable();


--
-- Name: notificaciones_sistema e11_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_no_truncate BEFORE TRUNCATE ON public.notificaciones_sistema FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable();


--
-- Name: tickets e11_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_no_truncate BEFORE TRUNCATE ON public.tickets FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable();


--
-- Name: ubicaciones e11_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_no_truncate BEFORE TRUNCATE ON public.ubicaciones FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable();


--
-- Name: usuarios e11_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_no_truncate BEFORE TRUNCATE ON public.usuarios FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable();


--
-- Name: notificaciones_sistema e11_notification_birth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_notification_birth AFTER INSERT ON public.notificaciones_sistema FOR EACH ROW EXECUTE FUNCTION public.e11_notification();


--
-- Name: notificaciones_sistema e11_notification_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_notification_immutable BEFORE DELETE OR UPDATE ON public.notificaciones_sistema FOR EACH ROW EXECUTE FUNCTION public.e11_notification();


--
-- Name: e11_perfiles e11_profile_no_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_profile_no_delete BEFORE DELETE ON public.e11_perfiles FOR EACH ROW EXECUTE FUNCTION public.e11_immutable();


--
-- Name: e11_conciliaciones e11_recovery_before; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_recovery_before BEFORE INSERT ON public.e11_conciliaciones FOR EACH ROW EXECUTE FUNCTION public.e11_recovery_before();


--
-- Name: e11_decisiones e11_recovery_before; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_recovery_before BEFORE INSERT ON public.e11_decisiones FOR EACH ROW EXECUTE FUNCTION public.e11_recovery_before();


--
-- Name: e11_operaciones e11_recovery_before; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_recovery_before BEFORE INSERT ON public.e11_operaciones FOR EACH ROW EXECUTE FUNCTION public.e11_recovery_before();


--
-- Name: e11_perfil_eventos e11_recovery_before; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_recovery_before BEFORE INSERT ON public.e11_perfil_eventos FOR EACH ROW EXECUTE FUNCTION public.e11_recovery_before();


--
-- Name: e11_resoluciones e11_recovery_before; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_recovery_before BEFORE INSERT ON public.e11_resoluciones FOR EACH ROW EXECUTE FUNCTION public.e11_recovery_before();


--
-- Name: e11_cambios_usuario e11_technical_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_technical_insert BEFORE INSERT ON public.e11_cambios_usuario FOR EACH ROW EXECUTE FUNCTION public.e11_technical_insert();


--
-- Name: e11_e5_preparaciones e11_technical_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_technical_insert BEFORE INSERT ON public.e11_e5_preparaciones FOR EACH ROW EXECUTE FUNCTION public.e11_technical_insert();


--
-- Name: e11_notificacion_origen e11_technical_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_technical_insert BEFORE INSERT ON public.e11_notificacion_origen FOR EACH ROW EXECUTE FUNCTION public.e11_technical_insert();


--
-- Name: usuarios e11_user_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e11_user_change AFTER UPDATE OF rol, activo ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.e11_user_change();


--
-- Name: caja_retornos_proveedor_e12 e12_cash_return; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e12_cash_return AFTER INSERT ON public.caja_retornos_proveedor_e12 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e12_cash_return_guard();


--
-- Name: fondo_movimientos e12_fund_inverse; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e12_fund_inverse AFTER INSERT ON public.fondo_movimientos DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e12_inverse_guard();


--
-- Name: pagos_proveedor e12_supplier_inverse; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e12_supplier_inverse AFTER INSERT ON public.pagos_proveedor DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e12_inverse_guard();


--
-- Name: movimientos_credito e2_abono_finalization_complete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e2_abono_finalization_complete AFTER INSERT ON public.movimientos_credito DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e2_require_abono_finalization();


--
-- Name: aplicaciones_credito e2_capture_application_order; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e2_capture_application_order BEFORE INSERT ON public.aplicaciones_credito FOR EACH ROW EXECUTE FUNCTION public.e2_guard_finalized_capture_application();


--
-- Name: finalizaciones_abono_e2 e2_finalization_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e2_finalization_immutable BEFORE DELETE OR UPDATE OR TRUNCATE ON public.finalizaciones_abono_e2 FOR EACH STATEMENT EXECUTE FUNCTION public.e2_reject_evidence_mutation();


--
-- Name: evidencia_no_aplicada_e2 e2_proof_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e2_proof_immutable BEFORE DELETE OR UPDATE OR TRUNCATE ON public.evidencia_no_aplicada_e2 FOR EACH STATEMENT EXECUTE FUNCTION public.e2_reject_evidence_mutation();


--
-- Name: cobros_credito_pendientes_e1 e2_retained_insert_transaction; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e2_retained_insert_transaction BEFORE INSERT OR UPDATE ON public.cobros_credito_pendientes_e1 FOR EACH ROW EXECUTE FUNCTION public.e2_stamp_insert_transaction();


--
-- Name: movimientos_credito e2_source_insert_transaction; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e2_source_insert_transaction BEFORE INSERT OR UPDATE ON public.movimientos_credito FOR EACH ROW EXECUTE FUNCTION public.e2_stamp_insert_transaction();


--
-- Name: finalizaciones_abono_e2 e2_validate_abono_finalization; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e2_validate_abono_finalization BEFORE INSERT ON public.finalizaciones_abono_e2 FOR EACH ROW EXECUTE FUNCTION public.e2_validate_abono_finalization();


--
-- Name: evidencia_no_aplicada_e2 e2_validate_unused_proof; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e2_validate_unused_proof BEFORE INSERT ON public.evidencia_no_aplicada_e2 FOR EACH ROW EXECUTE FUNCTION public.e2_validate_unused_proof();


--
-- Name: recibos_abono_e3 e3_receipt_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e3_receipt_immutable BEFORE DELETE OR UPDATE ON public.recibos_abono_e3 FOR EACH ROW EXECUTE FUNCTION public.e3_receipt_immutable();


--
-- Name: recibos_abono_e3 e3_receipt_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e3_receipt_no_truncate BEFORE TRUNCATE ON public.recibos_abono_e3 FOR EACH STATEMENT EXECUTE FUNCTION public.e3_receipt_immutable();


--
-- Name: e5_aplicaciones e5_birth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_birth BEFORE INSERT ON public.e5_aplicaciones FOR EACH ROW EXECUTE FUNCTION public.e5_birth();


--
-- Name: e5_devoluciones e5_birth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_birth BEFORE INSERT ON public.e5_devoluciones FOR EACH ROW EXECUTE FUNCTION public.e5_birth();


--
-- Name: e5_documentos e5_birth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_birth BEFORE INSERT ON public.e5_documentos FOR EACH ROW EXECUTE FUNCTION public.e5_birth();


--
-- Name: e5_impresiones e5_birth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_birth BEFORE INSERT ON public.e5_impresiones FOR EACH ROW EXECUTE FUNCTION public.e5_birth();


--
-- Name: e5_operaciones e5_birth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_birth BEFORE INSERT ON public.e5_operaciones FOR EACH ROW EXECUTE FUNCTION public.e5_birth();


--
-- Name: e5_recepciones e5_birth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_birth BEFORE INSERT ON public.e5_recepciones FOR EACH ROW EXECUTE FUNCTION public.e5_birth();


--
-- Name: e5_salidas_bancarias e5_birth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_birth BEFORE INSERT ON public.e5_salidas_bancarias FOR EACH ROW EXECUTE FUNCTION public.e5_birth();


--
-- Name: e5_vinculos_credito e5_birth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_birth BEFORE INSERT ON public.e5_vinculos_credito FOR EACH ROW EXECUTE FUNCTION public.e5_birth();


--
-- Name: e5_nacimientos e5_birth_private; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_birth_private BEFORE INSERT ON public.e5_nacimientos FOR EACH ROW EXECUTE FUNCTION public.e5_birth_private();


--
-- Name: aplicaciones_credito e5_capture_birth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_capture_birth AFTER INSERT ON public.aplicaciones_credito FOR EACH ROW EXECUTE FUNCTION public.e5_capture_birth();


--
-- Name: cobros_credito_pendientes_e1 e5_capture_birth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_capture_birth AFTER INSERT ON public.cobros_credito_pendientes_e1 FOR EACH ROW EXECUTE FUNCTION public.e5_capture_birth();


--
-- Name: fondo_movimientos e5_capture_birth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_capture_birth AFTER INSERT ON public.fondo_movimientos FOR EACH ROW EXECUTE FUNCTION public.e5_capture_birth();


--
-- Name: movimientos_credito e5_capture_birth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_capture_birth AFTER INSERT ON public.movimientos_credito FOR EACH ROW EXECUTE FUNCTION public.e5_capture_birth();


--
-- Name: operaciones_credito_e1 e5_capture_birth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_capture_birth AFTER INSERT ON public.operaciones_credito_e1 FOR EACH ROW EXECUTE FUNCTION public.e5_capture_birth();


--
-- Name: salidas_dinero_caja e5_capture_birth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_capture_birth AFTER INSERT ON public.salidas_dinero_caja FOR EACH ROW EXECUTE FUNCTION public.e5_capture_birth();


--
-- Name: e5_devoluciones e5_closed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_closed BEFORE INSERT OR DELETE OR UPDATE ON public.e5_devoluciones FOR EACH STATEMENT EXECUTE FUNCTION public.e5_closed();


--
-- Name: e5_salidas_bancarias e5_closed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_closed BEFORE INSERT OR DELETE OR UPDATE ON public.e5_salidas_bancarias FOR EACH STATEMENT EXECUTE FUNCTION public.e5_closed();


--
-- Name: e5_ddl_originales e5_ddl_no_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_ddl_no_change BEFORE DELETE OR UPDATE ON public.e5_ddl_originales FOR EACH ROW EXECUTE FUNCTION public.e5_immutable();


--
-- Name: e5_ddl_originales e5_ddl_no_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_ddl_no_insert BEFORE INSERT ON public.e5_ddl_originales FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();


--
-- Name: e5_ddl_originales e5_ddl_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_ddl_no_truncate BEFORE TRUNCATE ON public.e5_ddl_originales FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();


--
-- Name: e5_cobros e5_detail_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_detail_guard BEFORE INSERT OR UPDATE ON public.e5_cobros FOR EACH ROW EXECUTE FUNCTION public.e5_detail_guard();


--
-- Name: aplicaciones_credito e5_external_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_external_guard BEFORE DELETE OR UPDATE ON public.aplicaciones_credito FOR EACH ROW EXECUTE FUNCTION public.e5_external_guard();


--
-- Name: cobros_credito_pendientes_e1 e5_external_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_external_guard BEFORE DELETE OR UPDATE ON public.cobros_credito_pendientes_e1 FOR EACH ROW EXECUTE FUNCTION public.e5_external_guard();


--
-- Name: fondo_movimientos e5_external_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_external_guard BEFORE DELETE OR UPDATE ON public.fondo_movimientos FOR EACH ROW EXECUTE FUNCTION public.e5_external_guard();


--
-- Name: movimientos_credito e5_external_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_external_guard BEFORE DELETE OR UPDATE ON public.movimientos_credito FOR EACH ROW EXECUTE FUNCTION public.e5_external_guard();


--
-- Name: operaciones_credito_e1 e5_external_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_external_guard BEFORE DELETE OR UPDATE ON public.operaciones_credito_e1 FOR EACH ROW EXECUTE FUNCTION public.e5_external_guard();


--
-- Name: salidas_dinero_caja e5_external_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_external_guard BEFORE DELETE OR UPDATE ON public.salidas_dinero_caja FOR EACH ROW EXECUTE FUNCTION public.e5_external_guard();


--
-- Name: solicitudes_pago_dirigido e5_external_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_external_guard BEFORE DELETE OR UPDATE ON public.solicitudes_pago_dirigido FOR EACH ROW EXECUTE FUNCTION public.e5_external_guard();


--
-- Name: aplicaciones_credito e5_favor_initial_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_favor_initial_guard BEFORE INSERT ON public.aplicaciones_credito FOR EACH ROW EXECUTE FUNCTION public.e5_favor_initial_guard();


--
-- Name: aplicaciones_credito e5_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e5_graph AFTER INSERT OR DELETE OR UPDATE ON public.aplicaciones_credito DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e5_graph_guard();


--
-- Name: cobros_credito_pendientes_e1 e5_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e5_graph AFTER INSERT OR DELETE OR UPDATE ON public.cobros_credito_pendientes_e1 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e5_graph_guard();


--
-- Name: e5_aplicaciones e5_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e5_graph AFTER INSERT OR DELETE OR UPDATE ON public.e5_aplicaciones DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e5_graph_guard();


--
-- Name: e5_cobros e5_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e5_graph AFTER INSERT OR DELETE OR UPDATE ON public.e5_cobros DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e5_graph_guard();


--
-- Name: e5_devoluciones e5_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e5_graph AFTER INSERT OR DELETE OR UPDATE ON public.e5_devoluciones DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e5_graph_guard();


--
-- Name: e5_documentos e5_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e5_graph AFTER INSERT OR DELETE OR UPDATE ON public.e5_documentos DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e5_graph_guard();


--
-- Name: e5_impresiones e5_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e5_graph AFTER INSERT OR DELETE OR UPDATE ON public.e5_impresiones DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e5_graph_guard();


--
-- Name: e5_nacimientos e5_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e5_graph AFTER INSERT OR DELETE OR UPDATE ON public.e5_nacimientos DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e5_graph_guard();


--
-- Name: e5_operaciones e5_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e5_graph AFTER INSERT OR DELETE OR UPDATE ON public.e5_operaciones DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e5_graph_guard();


--
-- Name: e5_recepciones e5_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e5_graph AFTER INSERT OR DELETE OR UPDATE ON public.e5_recepciones DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e5_graph_guard();


--
-- Name: e5_salidas_bancarias e5_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e5_graph AFTER INSERT OR DELETE OR UPDATE ON public.e5_salidas_bancarias DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e5_graph_guard();


--
-- Name: e5_vinculos_credito e5_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e5_graph AFTER INSERT OR DELETE OR UPDATE ON public.e5_vinculos_credito DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e5_graph_guard();


--
-- Name: fondo_mariana e5_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e5_graph AFTER INSERT OR DELETE OR UPDATE ON public.fondo_mariana DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e5_graph_guard();


--
-- Name: fondo_movimientos e5_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e5_graph AFTER INSERT OR DELETE OR UPDATE ON public.fondo_movimientos DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e5_graph_guard();


--
-- Name: movimientos_credito e5_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e5_graph AFTER INSERT OR DELETE OR UPDATE ON public.movimientos_credito DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e5_graph_guard();


--
-- Name: operaciones_credito_e1 e5_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e5_graph AFTER INSERT OR DELETE OR UPDATE ON public.operaciones_credito_e1 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e5_graph_guard();


--
-- Name: salidas_dinero_caja e5_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e5_graph AFTER INSERT OR DELETE OR UPDATE ON public.salidas_dinero_caja DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e5_graph_guard();


--
-- Name: sesiones_caja e5_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e5_graph AFTER INSERT OR DELETE OR UPDATE ON public.sesiones_caja DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e5_graph_guard();


--
-- Name: solicitudes_pago_dirigido e5_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e5_graph AFTER INSERT OR DELETE OR UPDATE ON public.solicitudes_pago_dirigido DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e5_graph_guard();


--
-- Name: tickets e5_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e5_graph AFTER INSERT OR DELETE OR UPDATE ON public.tickets DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e5_graph_guard();


--
-- Name: ubicaciones e5_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e5_graph AFTER INSERT OR DELETE OR UPDATE ON public.ubicaciones DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e5_graph_guard();


--
-- Name: usuarios e5_graph; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e5_graph AFTER INSERT OR DELETE OR UPDATE ON public.usuarios DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e5_graph_guard();


--
-- Name: e5_aplicaciones e5_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_immutable BEFORE DELETE OR UPDATE ON public.e5_aplicaciones FOR EACH ROW EXECUTE FUNCTION public.e5_immutable();


--
-- Name: e5_devoluciones e5_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_immutable BEFORE DELETE OR UPDATE ON public.e5_devoluciones FOR EACH ROW EXECUTE FUNCTION public.e5_immutable();


--
-- Name: e5_documentos e5_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_immutable BEFORE DELETE OR UPDATE ON public.e5_documentos FOR EACH ROW EXECUTE FUNCTION public.e5_immutable();


--
-- Name: e5_impresiones e5_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_immutable BEFORE DELETE OR UPDATE ON public.e5_impresiones FOR EACH ROW EXECUTE FUNCTION public.e5_immutable();


--
-- Name: e5_nacimientos e5_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_immutable BEFORE DELETE OR UPDATE ON public.e5_nacimientos FOR EACH ROW EXECUTE FUNCTION public.e5_immutable();


--
-- Name: e5_operaciones e5_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_immutable BEFORE DELETE OR UPDATE ON public.e5_operaciones FOR EACH ROW EXECUTE FUNCTION public.e5_immutable();


--
-- Name: e5_recepciones e5_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_immutable BEFORE DELETE OR UPDATE ON public.e5_recepciones FOR EACH ROW EXECUTE FUNCTION public.e5_immutable();


--
-- Name: e5_salidas_bancarias e5_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_immutable BEFORE DELETE OR UPDATE ON public.e5_salidas_bancarias FOR EACH ROW EXECUTE FUNCTION public.e5_immutable();


--
-- Name: e5_vinculos_credito e5_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_immutable BEFORE DELETE OR UPDATE ON public.e5_vinculos_credito FOR EACH ROW EXECUTE FUNCTION public.e5_immutable();


--
-- Name: e5_aplicaciones e5_insert_authority; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_insert_authority BEFORE INSERT ON public.e5_aplicaciones FOR EACH ROW EXECUTE FUNCTION public.e5_insert_authority();


--
-- Name: e5_devoluciones e5_insert_authority; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_insert_authority BEFORE INSERT ON public.e5_devoluciones FOR EACH ROW EXECUTE FUNCTION public.e5_insert_authority();


--
-- Name: e5_impresiones e5_insert_authority; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_insert_authority BEFORE INSERT ON public.e5_impresiones FOR EACH ROW EXECUTE FUNCTION public.e5_insert_authority();


--
-- Name: e5_operaciones e5_insert_authority; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_insert_authority BEFORE INSERT ON public.e5_operaciones FOR EACH ROW EXECUTE FUNCTION public.e5_insert_authority();


--
-- Name: e5_recepciones e5_insert_authority; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_insert_authority BEFORE INSERT ON public.e5_recepciones FOR EACH ROW EXECUTE FUNCTION public.e5_insert_authority();


--
-- Name: e5_salidas_bancarias e5_insert_authority; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_insert_authority BEFORE INSERT ON public.e5_salidas_bancarias FOR EACH ROW EXECUTE FUNCTION public.e5_insert_authority();


--
-- Name: e5_cobros e5_no_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_no_delete BEFORE DELETE ON public.e5_cobros FOR EACH ROW EXECUTE FUNCTION public.e5_immutable();


--
-- Name: aplicaciones_credito e5_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_no_truncate BEFORE TRUNCATE ON public.aplicaciones_credito FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();


--
-- Name: cobros_credito_pendientes_e1 e5_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_no_truncate BEFORE TRUNCATE ON public.cobros_credito_pendientes_e1 FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();


--
-- Name: e5_aplicaciones e5_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_no_truncate BEFORE TRUNCATE ON public.e5_aplicaciones FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();


--
-- Name: e5_cobros e5_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_no_truncate BEFORE TRUNCATE ON public.e5_cobros FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();


--
-- Name: e5_devoluciones e5_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_no_truncate BEFORE TRUNCATE ON public.e5_devoluciones FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();


--
-- Name: e5_documentos e5_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_no_truncate BEFORE TRUNCATE ON public.e5_documentos FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();


--
-- Name: e5_impresiones e5_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_no_truncate BEFORE TRUNCATE ON public.e5_impresiones FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();


--
-- Name: e5_nacimientos e5_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_no_truncate BEFORE TRUNCATE ON public.e5_nacimientos FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();


--
-- Name: e5_operaciones e5_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_no_truncate BEFORE TRUNCATE ON public.e5_operaciones FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();


--
-- Name: e5_recepciones e5_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_no_truncate BEFORE TRUNCATE ON public.e5_recepciones FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();


--
-- Name: e5_salidas_bancarias e5_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_no_truncate BEFORE TRUNCATE ON public.e5_salidas_bancarias FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();


--
-- Name: e5_vinculos_credito e5_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_no_truncate BEFORE TRUNCATE ON public.e5_vinculos_credito FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();


--
-- Name: fondo_mariana e5_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_no_truncate BEFORE TRUNCATE ON public.fondo_mariana FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();


--
-- Name: fondo_movimientos e5_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_no_truncate BEFORE TRUNCATE ON public.fondo_movimientos FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();


--
-- Name: movimientos_credito e5_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_no_truncate BEFORE TRUNCATE ON public.movimientos_credito FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();


--
-- Name: operaciones_credito_e1 e5_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_no_truncate BEFORE TRUNCATE ON public.operaciones_credito_e1 FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();


--
-- Name: salidas_dinero_caja e5_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_no_truncate BEFORE TRUNCATE ON public.salidas_dinero_caja FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();


--
-- Name: sesiones_caja e5_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_no_truncate BEFORE TRUNCATE ON public.sesiones_caja FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();


--
-- Name: solicitudes_pago_dirigido e5_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_no_truncate BEFORE TRUNCATE ON public.solicitudes_pago_dirigido FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();


--
-- Name: tickets e5_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_no_truncate BEFORE TRUNCATE ON public.tickets FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();


--
-- Name: ubicaciones e5_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_no_truncate BEFORE TRUNCATE ON public.ubicaciones FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();


--
-- Name: usuarios e5_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_no_truncate BEFORE TRUNCATE ON public.usuarios FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();


--
-- Name: aplicaciones_credito e5_serialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_serialize BEFORE INSERT OR DELETE OR UPDATE ON public.aplicaciones_credito FOR EACH STATEMENT EXECUTE FUNCTION public.e5_serialize();


--
-- Name: cobros_credito_pendientes_e1 e5_serialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_serialize BEFORE INSERT OR DELETE OR UPDATE ON public.cobros_credito_pendientes_e1 FOR EACH STATEMENT EXECUTE FUNCTION public.e5_serialize();


--
-- Name: e5_aplicaciones e5_serialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_serialize BEFORE INSERT OR DELETE OR UPDATE ON public.e5_aplicaciones FOR EACH STATEMENT EXECUTE FUNCTION public.e5_serialize();


--
-- Name: e5_cobros e5_serialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_serialize BEFORE INSERT OR DELETE OR UPDATE ON public.e5_cobros FOR EACH STATEMENT EXECUTE FUNCTION public.e5_serialize();


--
-- Name: e5_devoluciones e5_serialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_serialize BEFORE INSERT OR DELETE OR UPDATE ON public.e5_devoluciones FOR EACH STATEMENT EXECUTE FUNCTION public.e5_serialize();


--
-- Name: e5_documentos e5_serialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_serialize BEFORE INSERT OR DELETE OR UPDATE ON public.e5_documentos FOR EACH STATEMENT EXECUTE FUNCTION public.e5_serialize();


--
-- Name: e5_impresiones e5_serialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_serialize BEFORE INSERT OR DELETE OR UPDATE ON public.e5_impresiones FOR EACH STATEMENT EXECUTE FUNCTION public.e5_serialize();


--
-- Name: e5_nacimientos e5_serialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_serialize BEFORE INSERT OR DELETE OR UPDATE ON public.e5_nacimientos FOR EACH STATEMENT EXECUTE FUNCTION public.e5_serialize();


--
-- Name: e5_operaciones e5_serialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_serialize BEFORE INSERT OR DELETE OR UPDATE ON public.e5_operaciones FOR EACH STATEMENT EXECUTE FUNCTION public.e5_serialize();


--
-- Name: e5_recepciones e5_serialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_serialize BEFORE INSERT OR DELETE OR UPDATE ON public.e5_recepciones FOR EACH STATEMENT EXECUTE FUNCTION public.e5_serialize();


--
-- Name: e5_salidas_bancarias e5_serialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_serialize BEFORE INSERT OR DELETE OR UPDATE ON public.e5_salidas_bancarias FOR EACH STATEMENT EXECUTE FUNCTION public.e5_serialize();


--
-- Name: e5_vinculos_credito e5_serialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_serialize BEFORE INSERT OR DELETE OR UPDATE ON public.e5_vinculos_credito FOR EACH STATEMENT EXECUTE FUNCTION public.e5_serialize();


--
-- Name: fondo_mariana e5_serialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_serialize BEFORE INSERT OR DELETE OR UPDATE ON public.fondo_mariana FOR EACH STATEMENT EXECUTE FUNCTION public.e5_serialize();


--
-- Name: fondo_movimientos e5_serialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_serialize BEFORE INSERT OR DELETE OR UPDATE ON public.fondo_movimientos FOR EACH STATEMENT EXECUTE FUNCTION public.e5_serialize();


--
-- Name: movimientos_credito e5_serialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_serialize BEFORE INSERT OR DELETE OR UPDATE ON public.movimientos_credito FOR EACH STATEMENT EXECUTE FUNCTION public.e5_serialize();


--
-- Name: operaciones_credito_e1 e5_serialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_serialize BEFORE INSERT OR DELETE OR UPDATE ON public.operaciones_credito_e1 FOR EACH STATEMENT EXECUTE FUNCTION public.e5_serialize();


--
-- Name: salidas_dinero_caja e5_serialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_serialize BEFORE INSERT OR DELETE OR UPDATE ON public.salidas_dinero_caja FOR EACH STATEMENT EXECUTE FUNCTION public.e5_serialize();


--
-- Name: sesiones_caja e5_serialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_serialize BEFORE INSERT OR DELETE OR UPDATE ON public.sesiones_caja FOR EACH STATEMENT EXECUTE FUNCTION public.e5_serialize();


--
-- Name: solicitudes_pago_dirigido e5_serialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_serialize BEFORE INSERT OR DELETE OR UPDATE ON public.solicitudes_pago_dirigido FOR EACH STATEMENT EXECUTE FUNCTION public.e5_serialize();


--
-- Name: tickets e5_serialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_serialize BEFORE INSERT OR DELETE OR UPDATE ON public.tickets FOR EACH STATEMENT EXECUTE FUNCTION public.e5_serialize();


--
-- Name: ubicaciones e5_serialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_serialize BEFORE INSERT OR DELETE OR UPDATE ON public.ubicaciones FOR EACH STATEMENT EXECUTE FUNCTION public.e5_serialize();


--
-- Name: usuarios e5_serialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e5_serialize BEFORE INSERT OR DELETE OR UPDATE ON public.usuarios FOR EACH STATEMENT EXECUTE FUNCTION public.e5_serialize();


--
-- Name: e9_entregas e9_detail_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e9_detail_guard BEFORE INSERT OR UPDATE ON public.e9_entregas FOR EACH ROW EXECUTE FUNCTION public.e9_validate_detail();


--
-- Name: e9_entregas e9_event_required; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e9_event_required AFTER INSERT OR UPDATE ON public.e9_entregas DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e9_event_guard();


--
-- Name: fondo_movimientos e9_fondo_receipt; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER e9_fondo_receipt AFTER INSERT ON public.fondo_movimientos DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e9_fondo_guard();


--
-- Name: e9_entregas e9_no_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e9_no_delete BEFORE DELETE ON public.e9_entregas FOR EACH ROW EXECUTE FUNCTION public.e9_immutable();


--
-- Name: e9_entregas e9_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e9_no_truncate BEFORE TRUNCATE ON public.e9_entregas FOR EACH STATEMENT EXECUTE FUNCTION public.e9_immutable();


--
-- Name: e9_operaciones e9_operation_valid; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e9_operation_valid BEFORE INSERT ON public.e9_operaciones FOR EACH ROW EXECUTE FUNCTION public.e9_operation_guard();


--
-- Name: e9_operaciones e9_operations_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e9_operations_immutable BEFORE DELETE OR UPDATE ON public.e9_operaciones FOR EACH ROW EXECUTE FUNCTION public.e9_immutable();


--
-- Name: e9_operaciones e9_operations_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER e9_operations_no_truncate BEFORE TRUNCATE ON public.e9_operaciones FOR EACH STATEMENT EXECUTE FUNCTION public.e9_immutable();


--
-- Name: fondo_arqueos fondo_arqueos_immutable_before_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER fondo_arqueos_immutable_before_mutation BEFORE DELETE OR UPDATE ON public.fondo_arqueos FOR EACH ROW EXECUTE FUNCTION public.fondo_reject_mutation();


--
-- Name: fondo_arqueos fondo_arqueos_immutable_before_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER fondo_arqueos_immutable_before_truncate BEFORE TRUNCATE ON public.fondo_arqueos FOR EACH STATEMENT EXECUTE FUNCTION public.fondo_reject_mutation();


--
-- Name: fondo_arqueos fondo_arqueos_validate_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER fondo_arqueos_validate_before_insert BEFORE INSERT ON public.fondo_arqueos FOR EACH ROW EXECUTE FUNCTION public.fondo_validate_audit();


--
-- Name: fondo_mariana fondo_mariana_fixed_before_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER fondo_mariana_fixed_before_mutation BEFORE INSERT OR DELETE OR UPDATE ON public.fondo_mariana FOR EACH ROW EXECUTE FUNCTION public.fondo_assert_fixed_mariana();


--
-- Name: fondo_mariana fondo_mariana_immutable_before_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER fondo_mariana_immutable_before_truncate BEFORE TRUNCATE ON public.fondo_mariana FOR EACH STATEMENT EXECUTE FUNCTION public.fondo_reject_mutation();


--
-- Name: fondo_movimientos fondo_movimientos_immutable_before_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER fondo_movimientos_immutable_before_mutation BEFORE DELETE OR UPDATE ON public.fondo_movimientos FOR EACH ROW EXECUTE FUNCTION public.fondo_reject_mutation();


--
-- Name: fondo_movimientos fondo_movimientos_immutable_before_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER fondo_movimientos_immutable_before_truncate BEFORE TRUNCATE ON public.fondo_movimientos FOR EACH STATEMENT EXECUTE FUNCTION public.fondo_reject_mutation();


--
-- Name: fondo_movimientos fondo_movimientos_validate_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER fondo_movimientos_validate_before_insert BEFORE INSERT ON public.fondo_movimientos FOR EACH ROW EXECUTE FUNCTION public.fondo_validate_movement();


--
-- Name: movimientos_credito movimientos_credito_inmutables; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER movimientos_credito_inmutables BEFORE DELETE OR UPDATE ON public.movimientos_credito FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_record_mutation();


--
-- Name: movimientos_credito movimientos_credito_reversos_validos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER movimientos_credito_reversos_validos BEFORE INSERT ON public.movimientos_credito FOR EACH ROW EXECUTE FUNCTION public.validate_credit_reversal();


--
-- Name: movimientos_credito movimientos_validos_e1; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER movimientos_validos_e1 AFTER INSERT ON public.movimientos_credito FOR EACH ROW EXECUTE FUNCTION public.validar_movimiento_credito_e1();


--
-- Name: operaciones_credito_e1 operaciones_inmutables_e1; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER operaciones_inmutables_e1 BEFORE DELETE OR UPDATE OR TRUNCATE ON public.operaciones_credito_e1 FOR EACH STATEMENT EXECUTE FUNCTION public.impedir_mutacion_credito_e1();


--
-- Name: pagos_proveedor pagos_proveedor_inmutables; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pagos_proveedor_inmutables BEFORE DELETE OR UPDATE ON public.pagos_proveedor FOR EACH ROW EXECUTE FUNCTION public.prevent_pago_proveedor_mutation();


--
-- Name: proveedor_efectivo_e12 proveedor_efectivo_e12_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER proveedor_efectivo_e12_guard BEFORE INSERT OR DELETE OR UPDATE ON public.proveedor_efectivo_e12 FOR EACH ROW EXECUTE FUNCTION public.e12_pago_guard();


--
-- Name: proveedor_efectivo_e12 proveedor_efectivo_e12_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER proveedor_efectivo_e12_no_truncate BEFORE TRUNCATE ON public.proveedor_efectivo_e12 FOR EACH STATEMENT EXECUTE FUNCTION public.e12_immutable();


--
-- Name: proveedor_operaciones_e12 proveedor_operaciones_e12_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER proveedor_operaciones_e12_immutable BEFORE DELETE OR UPDATE ON public.proveedor_operaciones_e12 FOR EACH ROW EXECUTE FUNCTION public.e12_immutable();


--
-- Name: proveedor_operaciones_e12 proveedor_operaciones_e12_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER proveedor_operaciones_e12_no_truncate BEFORE TRUNCATE ON public.proveedor_operaciones_e12 FOR EACH STATEMENT EXECUTE FUNCTION public.e12_immutable();


--
-- Name: proveedor_solicitudes_e12 proveedor_solicitudes_e12_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER proveedor_solicitudes_e12_immutable BEFORE DELETE OR UPDATE ON public.proveedor_solicitudes_e12 FOR EACH ROW EXECUTE FUNCTION public.e12_immutable();


--
-- Name: proveedor_solicitudes_e12 proveedor_solicitudes_e12_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER proveedor_solicitudes_e12_no_truncate BEFORE TRUNCATE ON public.proveedor_solicitudes_e12 FOR EACH STATEMENT EXECUTE FUNCTION public.e12_immutable();


--
-- Name: reimpresiones_etiqueta reimpresiones_etiqueta_inmutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER reimpresiones_etiqueta_inmutable BEFORE DELETE OR UPDATE ON public.reimpresiones_etiqueta FOR EACH ROW EXECUTE FUNCTION public.bloquear_mutacion_reimpresion_etiqueta();


--
-- Name: revisiones_etiqueta revisiones_etiqueta_inmutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER revisiones_etiqueta_inmutable BEFORE DELETE OR UPDATE ON public.revisiones_etiqueta FOR EACH ROW EXECUTE FUNCTION public.bloquear_mutacion_revision_etiqueta();


--
-- Name: revisiones_etiqueta revisiones_etiqueta_reimpresion_fk_check; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER revisiones_etiqueta_reimpresion_fk_check BEFORE INSERT OR UPDATE ON public.revisiones_etiqueta FOR EACH ROW EXECUTE FUNCTION public.validar_revision_etiqueta_reimpresion();


--
-- Name: test_reset_history test_reset_history_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER test_reset_history_immutable BEFORE DELETE OR UPDATE OR TRUNCATE ON public.test_reset_history FOR EACH STATEMENT EXECUTE FUNCTION public.test_reset_history_immutable();


--
-- Name: ticket_linea_consumos ticket_linea_consumos_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ticket_linea_consumos_append_only BEFORE INSERT OR DELETE OR UPDATE ON public.ticket_linea_consumos FOR EACH ROW EXECUTE FUNCTION public.ticket_linea_consumos_guard();

ALTER TABLE public.ticket_linea_consumos ENABLE ALWAYS TRIGGER ticket_linea_consumos_append_only;


--
-- Name: ticket_pagos ticket_pagos_inmutables; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ticket_pagos_inmutables BEFORE DELETE OR UPDATE ON public.ticket_pagos FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_record_mutation();


--
-- Name: movimientos_credito zz_e1_cash_capture_closed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER zz_e1_cash_capture_closed AFTER INSERT ON public.movimientos_credito FOR EACH ROW EXECUTE FUNCTION public.e1_guard_cash_capture_closed();


--
-- Name: atribuciones_credito_e1 zz_e1_historical_attribution_closed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER zz_e1_historical_attribution_closed AFTER INSERT ON public.atribuciones_credito_e1 FOR EACH STATEMENT EXECUTE FUNCTION public.e1_guard_historical_attribution_closed();


--
-- Name: cobros_credito_pendientes_e1 zz_e1_pending_receipts_closed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER zz_e1_pending_receipts_closed AFTER INSERT ON public.cobros_credito_pendientes_e1 REFERENCING NEW TABLE AS e5_pending_rows FOR EACH STATEMENT EXECUTE FUNCTION public.e1_guard_pending_receipts_closed();


--
-- Name: aplicaciones_credito aplicaciones_credito_abono_movimiento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_credito
    ADD CONSTRAINT aplicaciones_credito_abono_movimiento_id_fkey FOREIGN KEY (abono_movimiento_id) REFERENCES public.movimientos_credito(id);


--
-- Name: aplicaciones_credito aplicaciones_credito_venta_movimiento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_credito
    ADD CONSTRAINT aplicaciones_credito_venta_movimiento_id_fkey FOREIGN KEY (venta_movimiento_id) REFERENCES public.movimientos_credito(id);


--
-- Name: aplicaciones_pago_proveedor aplicaciones_pago_proveedor_compra_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_pago_proveedor
    ADD CONSTRAINT aplicaciones_pago_proveedor_compra_proveedor_id_fkey FOREIGN KEY (compra_proveedor_id) REFERENCES public.pagos_proveedor(id);


--
-- Name: aplicaciones_pago_proveedor aplicaciones_pago_proveedor_pago_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_pago_proveedor
    ADD CONSTRAINT aplicaciones_pago_proveedor_pago_proveedor_id_fkey FOREIGN KEY (pago_proveedor_id) REFERENCES public.pagos_proveedor(id);


--
-- Name: atribuciones_credito_e1 atribuciones_actor_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atribuciones_credito_e1
    ADD CONSTRAINT atribuciones_actor_fk_e1 FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: atribuciones_credito_e1 atribuciones_anterior_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atribuciones_credito_e1
    ADD CONSTRAINT atribuciones_anterior_fk_e1 FOREIGN KEY (anterior_id) REFERENCES public.atribuciones_credito_e1(id);


--
-- Name: atribuciones_credito_e1 atribuciones_movimiento_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atribuciones_credito_e1
    ADD CONSTRAINT atribuciones_movimiento_fk_e1 FOREIGN KEY (movimiento_id) REFERENCES public.movimientos_credito(id);


--
-- Name: atribuciones_credito_e1 atribuciones_sitio_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atribuciones_credito_e1
    ADD CONSTRAINT atribuciones_sitio_fk_e1 FOREIGN KEY (sitio_origen_id) REFERENCES public.ubicaciones(id);


--
-- Name: auditoria_faltante_reactivaciones auditoria_faltante_reactivacion_movimiento_reactivacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_faltante_reactivaciones
    ADD CONSTRAINT auditoria_faltante_reactivacion_movimiento_reactivacion_id_fkey FOREIGN KEY (movimiento_reactivacion_id) REFERENCES public.movimientos(id);


--
-- Name: auditoria_faltante_reactivaciones auditoria_faltante_reactivaciones_auditoria_origen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_faltante_reactivaciones
    ADD CONSTRAINT auditoria_faltante_reactivaciones_auditoria_origen_id_fkey FOREIGN KEY (auditoria_origen_id) REFERENCES public.auditorias_inventario(id);


--
-- Name: auditoria_faltante_reactivaciones auditoria_faltante_reactivaciones_movimiento_baja_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_faltante_reactivaciones
    ADD CONSTRAINT auditoria_faltante_reactivaciones_movimiento_baja_id_fkey FOREIGN KEY (movimiento_baja_id) REFERENCES public.movimientos(id);


--
-- Name: auditoria_faltante_reactivaciones auditoria_faltante_reactivaciones_piso_aparicion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_faltante_reactivaciones
    ADD CONSTRAINT auditoria_faltante_reactivaciones_piso_aparicion_id_fkey FOREIGN KEY (piso_aparicion_id) REFERENCES public.pisos(id);


--
-- Name: auditoria_faltante_reactivaciones auditoria_faltante_reactivaciones_rollo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_faltante_reactivaciones
    ADD CONSTRAINT auditoria_faltante_reactivaciones_rollo_id_fkey FOREIGN KEY (rollo_id) REFERENCES public.rollos(id);


--
-- Name: auditoria_faltante_reactivaciones auditoria_faltante_reactivaciones_ubicacion_aparicion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_faltante_reactivaciones
    ADD CONSTRAINT auditoria_faltante_reactivaciones_ubicacion_aparicion_id_fkey FOREIGN KEY (ubicacion_aparicion_id) REFERENCES public.ubicaciones(id);


--
-- Name: auditoria_faltante_reactivaciones auditoria_faltante_reactivaciones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_faltante_reactivaciones
    ADD CONSTRAINT auditoria_faltante_reactivaciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: auditoria_inventario_escaneos auditoria_inventario_escaneos_auditoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_inventario_escaneos
    ADD CONSTRAINT auditoria_inventario_escaneos_auditoria_id_fkey FOREIGN KEY (auditoria_id) REFERENCES public.auditorias_inventario(id);


--
-- Name: auditoria_inventario_escaneos auditoria_inventario_escaneos_piso_real_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_inventario_escaneos
    ADD CONSTRAINT auditoria_inventario_escaneos_piso_real_id_fkey FOREIGN KEY (piso_real_id) REFERENCES public.pisos(id);


--
-- Name: auditoria_inventario_escaneos auditoria_inventario_escaneos_rollo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_inventario_escaneos
    ADD CONSTRAINT auditoria_inventario_escaneos_rollo_id_fkey FOREIGN KEY (rollo_id) REFERENCES public.rollos(id);


--
-- Name: auditoria_inventario_escaneos auditoria_inventario_escaneos_ubicacion_cierre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_inventario_escaneos
    ADD CONSTRAINT auditoria_inventario_escaneos_ubicacion_cierre_id_fkey FOREIGN KEY (ubicacion_cierre_id) REFERENCES public.ubicaciones(id);


--
-- Name: auditoria_inventario_escaneos auditoria_inventario_escaneos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_inventario_escaneos
    ADD CONSTRAINT auditoria_inventario_escaneos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: auditoria_inventario_folio auditoria_inventario_folio_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_inventario_folio
    ADD CONSTRAINT auditoria_inventario_folio_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: auditoria_inventario_participantes auditoria_inventario_participantes_auditoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_inventario_participantes
    ADD CONSTRAINT auditoria_inventario_participantes_auditoria_id_fkey FOREIGN KEY (auditoria_id) REFERENCES public.auditorias_inventario(id);


--
-- Name: auditoria_inventario_participantes auditoria_inventario_participantes_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_inventario_participantes
    ADD CONSTRAINT auditoria_inventario_participantes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: auditoria_inventario_snapshot auditoria_inventario_snapshot_auditoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_inventario_snapshot
    ADD CONSTRAINT auditoria_inventario_snapshot_auditoria_id_fkey FOREIGN KEY (auditoria_id) REFERENCES public.auditorias_inventario(id);


--
-- Name: auditoria_inventario_snapshot auditoria_inventario_snapshot_piso_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_inventario_snapshot
    ADD CONSTRAINT auditoria_inventario_snapshot_piso_snapshot_id_fkey FOREIGN KEY (piso_snapshot_id) REFERENCES public.pisos(id);


--
-- Name: auditoria_inventario_snapshot auditoria_inventario_snapshot_rollo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_inventario_snapshot
    ADD CONSTRAINT auditoria_inventario_snapshot_rollo_id_fkey FOREIGN KEY (rollo_id) REFERENCES public.rollos(id);


--
-- Name: auditoria_inventario_snapshot auditoria_inventario_snapshot_ubicacion_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_inventario_snapshot
    ADD CONSTRAINT auditoria_inventario_snapshot_ubicacion_snapshot_id_fkey FOREIGN KEY (ubicacion_snapshot_id) REFERENCES public.ubicaciones(id);


--
-- Name: auditoria auditoria_sitio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_sitio_id_fkey FOREIGN KEY (sitio_id) REFERENCES public.ubicaciones(id);


--
-- Name: auditoria_sobrante_contextos auditoria_sobrante_contextos_auditoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_sobrante_contextos
    ADD CONSTRAINT auditoria_sobrante_contextos_auditoria_id_fkey FOREIGN KEY (auditoria_id) REFERENCES public.auditorias_inventario(id);


--
-- Name: auditoria_sobrante_decisiones auditoria_sobrante_decisiones_auditoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_sobrante_decisiones
    ADD CONSTRAINT auditoria_sobrante_decisiones_auditoria_id_fkey FOREIGN KEY (auditoria_id) REFERENCES public.auditorias_inventario(id);


--
-- Name: auditoria_sobrante_decisiones auditoria_sobrante_decisiones_rollo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_sobrante_decisiones
    ADD CONSTRAINT auditoria_sobrante_decisiones_rollo_id_fkey FOREIGN KEY (rollo_id) REFERENCES public.rollos(id);


--
-- Name: auditoria_sobrante_decisiones auditoria_sobrante_decisiones_salida_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_sobrante_decisiones
    ADD CONSTRAINT auditoria_sobrante_decisiones_salida_id_fkey FOREIGN KEY (salida_id) REFERENCES public.salidas(id);


--
-- Name: auditoria_sobrante_decisiones auditoria_sobrante_decisiones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_sobrante_decisiones
    ADD CONSTRAINT auditoria_sobrante_decisiones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: auditoria auditoria_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: auditorias_inventario auditorias_inventario_cancelada_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditorias_inventario
    ADD CONSTRAINT auditorias_inventario_cancelada_por_id_fkey FOREIGN KEY (cancelada_por_id) REFERENCES public.usuarios(id);


--
-- Name: auditorias_inventario auditorias_inventario_cerrada_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditorias_inventario
    ADD CONSTRAINT auditorias_inventario_cerrada_por_id_fkey FOREIGN KEY (cerrada_por_id) REFERENCES public.usuarios(id);


--
-- Name: auditorias_inventario auditorias_inventario_confirmada_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditorias_inventario
    ADD CONSTRAINT auditorias_inventario_confirmada_por_id_fkey FOREIGN KEY (confirmada_por_id) REFERENCES public.usuarios(id);


--
-- Name: auditorias_inventario auditorias_inventario_creada_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditorias_inventario
    ADD CONSTRAINT auditorias_inventario_creada_por_id_fkey FOREIGN KEY (creada_por_id) REFERENCES public.usuarios(id);


--
-- Name: auditorias_inventario auditorias_inventario_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditorias_inventario
    ADD CONSTRAINT auditorias_inventario_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: autorizaciones_nota autorizaciones_nota_movimiento_credito_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_nota
    ADD CONSTRAINT autorizaciones_nota_movimiento_credito_id_fkey FOREIGN KEY (movimiento_credito_id) REFERENCES public.movimientos_credito(id);


--
-- Name: autorizaciones_nota autorizaciones_nota_sesion_caja_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_nota
    ADD CONSTRAINT autorizaciones_nota_sesion_caja_id_fkey FOREIGN KEY (sesion_caja_id) REFERENCES public.sesiones_caja(id);


--
-- Name: autorizaciones_nota autorizaciones_nota_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_nota
    ADD CONSTRAINT autorizaciones_nota_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: autorizaciones_nota autorizaciones_nota_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_nota
    ADD CONSTRAINT autorizaciones_nota_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: caja_desbloqueos_e12 caja_desbloqueos_e12_salida_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caja_desbloqueos_e12
    ADD CONSTRAINT caja_desbloqueos_e12_salida_id_fkey FOREIGN KEY (salida_id) REFERENCES public.salidas_dinero_caja(id);


--
-- Name: caja_retornos_proveedor_e12 caja_retornos_proveedor_e12_pago_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caja_retornos_proveedor_e12
    ADD CONSTRAINT caja_retornos_proveedor_e12_pago_proveedor_id_fkey FOREIGN KEY (pago_proveedor_id) REFERENCES public.pagos_proveedor(id);


--
-- Name: caja_retornos_proveedor_e12 caja_retornos_proveedor_e12_sesion_caja_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caja_retornos_proveedor_e12
    ADD CONSTRAINT caja_retornos_proveedor_e12_sesion_caja_id_fkey FOREIGN KEY (sesion_caja_id) REFERENCES public.sesiones_caja(id);


--
-- Name: caja_retornos_proveedor_e12 caja_retornos_proveedor_e12_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caja_retornos_proveedor_e12
    ADD CONSTRAINT caja_retornos_proveedor_e12_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: caja_salidas_e4_operaciones caja_salidas_e4_operaciones_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caja_salidas_e4_operaciones
    ADD CONSTRAINT caja_salidas_e4_operaciones_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.usuarios(id);


--
-- Name: caja_salidas_e4_operaciones caja_salidas_e4_operaciones_salida_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caja_salidas_e4_operaciones
    ADD CONSTRAINT caja_salidas_e4_operaciones_salida_id_fkey FOREIGN KEY (salida_id) REFERENCES public.caja_salidas_e4(salida_id);


--
-- Name: caja_salidas_e4 caja_salidas_e4_salida_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caja_salidas_e4
    ADD CONSTRAINT caja_salidas_e4_salida_id_fkey FOREIGN KEY (salida_id) REFERENCES public.salidas_dinero_caja(id);


--
-- Name: cliente_documentos cliente_documentos_cliente_id_clientes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_documentos
    ADD CONSTRAINT cliente_documentos_cliente_id_clientes_id_fk FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: cliente_documentos cliente_documentos_subido_por_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_documentos
    ADD CONSTRAINT cliente_documentos_subido_por_usuarios_id_fk FOREIGN KEY (subido_por) REFERENCES public.usuarios(id);


--
-- Name: cobros_credito_pendientes_e1 cobros_actor_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobros_credito_pendientes_e1
    ADD CONSTRAINT cobros_actor_fk_e1 FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: cobros_credito_pendientes_e1 cobros_cliente_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobros_credito_pendientes_e1
    ADD CONSTRAINT cobros_cliente_fk_e1 FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: cobros_credito_pendientes_e1 cobros_operacion_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobros_credito_pendientes_e1
    ADD CONSTRAINT cobros_operacion_fk_e1 FOREIGN KEY (operacion_productor, operacion_clave) REFERENCES public.operaciones_credito_e1(productor, clave) MATCH FULL;


--
-- Name: cobros_credito_pendientes_e1 cobros_sesion_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobros_credito_pendientes_e1
    ADD CONSTRAINT cobros_sesion_fk_e1 FOREIGN KEY (sesion_caja_id) REFERENCES public.sesiones_caja(id);


--
-- Name: cobros_credito_pendientes_e1 cobros_sitio_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobros_credito_pendientes_e1
    ADD CONSTRAINT cobros_sitio_fk_e1 FOREIGN KEY (sitio_origen_id) REFERENCES public.ubicaciones(id);


--
-- Name: contenedor_lineas contenedor_lineas_contenedor_id_contenedores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contenedor_lineas
    ADD CONSTRAINT contenedor_lineas_contenedor_id_contenedores_id_fk FOREIGN KEY (contenedor_id) REFERENCES public.contenedores(id) ON DELETE CASCADE;


--
-- Name: contenedor_lineas contenedor_lineas_producto_id_productos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contenedor_lineas
    ADD CONSTRAINT contenedor_lineas_producto_id_productos_id_fk FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: contenedores contenedores_entrada_id_entradas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contenedores
    ADD CONSTRAINT contenedores_entrada_id_entradas_id_fk FOREIGN KEY (entrada_id) REFERENCES public.entradas(id);


--
-- Name: contenedores contenedores_proveedor_id_proveedores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contenedores
    ADD CONSTRAINT contenedores_proveedor_id_proveedores_id_fk FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);


--
-- Name: contenedores contenedores_sitio_destino_id_ubicaciones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contenedores
    ADD CONSTRAINT contenedores_sitio_destino_id_ubicaciones_id_fk FOREIGN KEY (sitio_destino_id) REFERENCES public.ubicaciones(id);


--
-- Name: contenedores contenedores_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contenedores
    ADD CONSTRAINT contenedores_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: cuadre_fiscal_registros cuadre_fiscal_registros_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuadre_fiscal_registros
    ADD CONSTRAINT cuadre_fiscal_registros_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.usuarios(id);


--
-- Name: cuadre_fiscal_registros cuadre_fiscal_registros_resuelto_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuadre_fiscal_registros
    ADD CONSTRAINT cuadre_fiscal_registros_resuelto_por_id_fkey FOREIGN KEY (resuelto_por_id) REFERENCES public.usuarios(id);


--
-- Name: cuadre_fiscal_registros cuadre_fiscal_registros_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuadre_fiscal_registros
    ADD CONSTRAINT cuadre_fiscal_registros_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: e11_avisos e11_avisos_conciliacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_avisos
    ADD CONSTRAINT e11_avisos_conciliacion_id_fkey FOREIGN KEY (conciliacion_id) REFERENCES public.e11_conciliaciones(id);


--
-- Name: e11_avisos e11_avisos_decision_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_avisos
    ADD CONSTRAINT e11_avisos_decision_id_fkey FOREIGN KEY (decision_id) REFERENCES public.e11_decisiones(id);


--
-- Name: e11_cambios_usuario e11_cambios_usuario_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_cambios_usuario
    ADD CONSTRAINT e11_cambios_usuario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: e11_conciliacion_ventas e11_conciliacion_ventas_conciliacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_conciliacion_ventas
    ADD CONSTRAINT e11_conciliacion_ventas_conciliacion_id_fkey FOREIGN KEY (conciliacion_id) REFERENCES public.e11_conciliaciones(id);


--
-- Name: e11_conciliacion_ventas e11_conciliacion_ventas_venta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_conciliacion_ventas
    ADD CONSTRAINT e11_conciliacion_ventas_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.tickets(id);


--
-- Name: e11_conciliaciones e11_conciliaciones_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_conciliaciones
    ADD CONSTRAINT e11_conciliaciones_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.usuarios(id);


--
-- Name: e11_conciliaciones e11_conciliaciones_anterior_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_conciliaciones
    ADD CONSTRAINT e11_conciliaciones_anterior_id_fkey FOREIGN KEY (anterior_id) REFERENCES public.e11_conciliaciones(id);


--
-- Name: e11_decisiones e11_decisiones_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_decisiones
    ADD CONSTRAINT e11_decisiones_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.usuarios(id);


--
-- Name: e11_decisiones e11_decisiones_conciliacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_decisiones
    ADD CONSTRAINT e11_decisiones_conciliacion_id_fkey FOREIGN KEY (conciliacion_id) REFERENCES public.e11_conciliaciones(id);


--
-- Name: e11_e5_preparaciones e11_e5_preparaciones_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_e5_preparaciones
    ADD CONSTRAINT e11_e5_preparaciones_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.usuarios(id);


--
-- Name: e11_e5_preparaciones e11_e5_preparaciones_clave_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_e5_preparaciones
    ADD CONSTRAINT e11_e5_preparaciones_clave_fkey FOREIGN KEY (clave) REFERENCES public.e5_operaciones(clave);


--
-- Name: e11_e5_preparaciones e11_e5_preparaciones_cobro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_e5_preparaciones
    ADD CONSTRAINT e11_e5_preparaciones_cobro_id_fkey FOREIGN KEY (cobro_id) REFERENCES public.e5_recepciones(id);


--
-- Name: e11_notificacion_origen e11_notificacion_origen_notificacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_notificacion_origen
    ADD CONSTRAINT e11_notificacion_origen_notificacion_id_fkey FOREIGN KEY (notificacion_id) REFERENCES public.notificaciones_sistema(id);


--
-- Name: e11_operaciones e11_operaciones_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_operaciones
    ADD CONSTRAINT e11_operaciones_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.usuarios(id);


--
-- Name: e11_perfil_eventos e11_perfil_eventos_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_perfil_eventos
    ADD CONSTRAINT e11_perfil_eventos_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.usuarios(id);


--
-- Name: e11_perfil_eventos e11_perfil_eventos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_perfil_eventos
    ADD CONSTRAINT e11_perfil_eventos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: e11_perfiles e11_perfiles_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_perfiles
    ADD CONSTRAINT e11_perfiles_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.usuarios(id);


--
-- Name: e11_perfiles e11_perfiles_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_perfiles
    ADD CONSTRAINT e11_perfiles_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: e11_resoluciones e11_resoluciones_actor_original_id_accion_uuid_original_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_resoluciones
    ADD CONSTRAINT e11_resoluciones_actor_original_id_accion_uuid_original_fkey FOREIGN KEY (actor_original_id, accion, uuid_original) REFERENCES public.e11_operaciones(actor_id, operacion, uuid) ON DELETE RESTRICT;


--
-- Name: e11_resoluciones e11_resoluciones_actor_original_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_resoluciones
    ADD CONSTRAINT e11_resoluciones_actor_original_id_fkey FOREIGN KEY (actor_original_id) REFERENCES public.usuarios(id) ON DELETE RESTRICT;


--
-- Name: e11_resoluciones e11_resoluciones_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e11_resoluciones
    ADD CONSTRAINT e11_resoluciones_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.usuarios(id) ON DELETE RESTRICT;


--
-- Name: e5_aplicaciones e5_aplicaciones_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_aplicaciones
    ADD CONSTRAINT e5_aplicaciones_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.usuarios(id);


--
-- Name: e5_aplicaciones e5_aplicaciones_cobro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_aplicaciones
    ADD CONSTRAINT e5_aplicaciones_cobro_id_fkey FOREIGN KEY (cobro_id) REFERENCES public.e5_recepciones(id);


--
-- Name: e5_aplicaciones e5_aplicaciones_movimiento_venta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_aplicaciones
    ADD CONSTRAINT e5_aplicaciones_movimiento_venta_id_fkey FOREIGN KEY (movimiento_venta_id) REFERENCES public.movimientos_credito(id);


--
-- Name: e5_cobros e5_cobros_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_cobros
    ADD CONSTRAINT e5_cobros_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: e5_cobros e5_cobros_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_cobros
    ADD CONSTRAINT e5_cobros_id_fkey FOREIGN KEY (id) REFERENCES public.e5_recepciones(id);


--
-- Name: e5_cobros e5_cobros_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_cobros
    ADD CONSTRAINT e5_cobros_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: e5_devoluciones e5_devoluciones_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_devoluciones
    ADD CONSTRAINT e5_devoluciones_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.usuarios(id);


--
-- Name: e5_devoluciones e5_devoluciones_cobro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_devoluciones
    ADD CONSTRAINT e5_devoluciones_cobro_id_fkey FOREIGN KEY (cobro_id) REFERENCES public.e5_recepciones(id);


--
-- Name: e5_devoluciones e5_devoluciones_movimiento_fondo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_devoluciones
    ADD CONSTRAINT e5_devoluciones_movimiento_fondo_id_fkey FOREIGN KEY (movimiento_fondo_id) REFERENCES public.fondo_movimientos(id);


--
-- Name: e5_devoluciones e5_devoluciones_salida_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_devoluciones
    ADD CONSTRAINT e5_devoluciones_salida_id_fkey FOREIGN KEY (salida_id) REFERENCES public.salidas_dinero_caja(id);


--
-- Name: e5_documentos e5_documentos_cobro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_documentos
    ADD CONSTRAINT e5_documentos_cobro_id_fkey FOREIGN KEY (cobro_id) REFERENCES public.e5_recepciones(id);


--
-- Name: e5_impresiones e5_impresiones_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_impresiones
    ADD CONSTRAINT e5_impresiones_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.usuarios(id);


--
-- Name: e5_impresiones e5_impresiones_documento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_impresiones
    ADD CONSTRAINT e5_impresiones_documento_id_fkey FOREIGN KEY (documento_id) REFERENCES public.e5_documentos(id);


--
-- Name: e5_operaciones e5_operaciones_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_operaciones
    ADD CONSTRAINT e5_operaciones_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.usuarios(id);


--
-- Name: e5_operaciones e5_operaciones_cobro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_operaciones
    ADD CONSTRAINT e5_operaciones_cobro_id_fkey FOREIGN KEY (cobro_id) REFERENCES public.e5_recepciones(id);


--
-- Name: e5_recepciones e5_recepciones_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_recepciones
    ADD CONSTRAINT e5_recepciones_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.usuarios(id);


--
-- Name: e5_recepciones e5_recepciones_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_recepciones
    ADD CONSTRAINT e5_recepciones_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: e5_recepciones e5_recepciones_sesion_caja_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_recepciones
    ADD CONSTRAINT e5_recepciones_sesion_caja_id_fkey FOREIGN KEY (sesion_caja_id) REFERENCES public.sesiones_caja(id);


--
-- Name: e5_recepciones e5_recepciones_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_recepciones
    ADD CONSTRAINT e5_recepciones_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: e5_salidas_bancarias e5_salidas_bancarias_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_salidas_bancarias
    ADD CONSTRAINT e5_salidas_bancarias_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.usuarios(id);


--
-- Name: e5_salidas_bancarias e5_salidas_bancarias_cobro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_salidas_bancarias
    ADD CONSTRAINT e5_salidas_bancarias_cobro_id_fkey FOREIGN KEY (cobro_id) REFERENCES public.e5_recepciones(id);


--
-- Name: e5_salidas_bancarias e5_salidas_bancarias_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_salidas_bancarias
    ADD CONSTRAINT e5_salidas_bancarias_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: e5_vinculos_credito e5_vinculos_credito_aplicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_vinculos_credito
    ADD CONSTRAINT e5_vinculos_credito_aplicacion_id_fkey FOREIGN KEY (aplicacion_id) REFERENCES public.e5_aplicaciones(id);


--
-- Name: e5_vinculos_credito e5_vinculos_credito_movimiento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e5_vinculos_credito
    ADD CONSTRAINT e5_vinculos_credito_movimiento_id_fkey FOREIGN KEY (movimiento_id) REFERENCES public.movimientos_credito(id);


--
-- Name: e9_entregas e9_entregas_corte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e9_entregas
    ADD CONSTRAINT e9_entregas_corte_id_fkey FOREIGN KEY (corte_id) REFERENCES public.sesiones_caja(id);


--
-- Name: e9_entregas e9_entregas_movimiento_fondo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e9_entregas
    ADD CONSTRAINT e9_entregas_movimiento_fondo_id_fkey FOREIGN KEY (movimiento_fondo_id) REFERENCES public.fondo_movimientos(id);


--
-- Name: e9_entregas e9_entregas_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e9_entregas
    ADD CONSTRAINT e9_entregas_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: e9_operaciones e9_operaciones_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e9_operaciones
    ADD CONSTRAINT e9_operaciones_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.usuarios(id);


--
-- Name: e9_operaciones e9_operaciones_entrega_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.e9_operaciones
    ADD CONSTRAINT e9_operaciones_entrega_id_fkey FOREIGN KEY (entrega_id) REFERENCES public.e9_entregas(id);


--
-- Name: entrada_folio entrada_folio_ubicacion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entrada_folio
    ADD CONSTRAINT entrada_folio_ubicacion_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: entradas entradas_proveedor_id_proveedores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entradas
    ADD CONSTRAINT entradas_proveedor_id_proveedores_id_fk FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);


--
-- Name: entradas entradas_ubicacion_id_ubicaciones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entradas
    ADD CONSTRAINT entradas_ubicacion_id_ubicaciones_id_fk FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: entradas entradas_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entradas
    ADD CONSTRAINT entradas_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: equipos equipos_actualizado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_actualizado_por_fkey FOREIGN KEY (actualizado_por) REFERENCES public.usuarios(id);


--
-- Name: equipos_checklist equipos_checklist_checked_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipos_checklist
    ADD CONSTRAINT equipos_checklist_checked_por_fkey FOREIGN KEY (checked_por) REFERENCES public.usuarios(id);


--
-- Name: equipos_checklist equipos_checklist_equipo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipos_checklist
    ADD CONSTRAINT equipos_checklist_equipo_id_fkey FOREIGN KEY (equipo_id) REFERENCES public.equipos(id) ON DELETE CASCADE;


--
-- Name: equipos equipos_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios(id);


--
-- Name: equipos equipos_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: evidencia_no_aplicada_e2 evidencia_no_aplicada_e2_abono_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidencia_no_aplicada_e2
    ADD CONSTRAINT evidencia_no_aplicada_e2_abono_id_fkey FOREIGN KEY (abono_id) REFERENCES public.finalizaciones_abono_e2(abono_id);


--
-- Name: evidencia_no_aplicada_e2 evidencia_no_aplicada_e2_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidencia_no_aplicada_e2
    ADD CONSTRAINT evidencia_no_aplicada_e2_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: evidencia_no_aplicada_e2 evidencia_no_aplicada_e2_cobro_productor_cobro_clave_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidencia_no_aplicada_e2
    ADD CONSTRAINT evidencia_no_aplicada_e2_cobro_productor_cobro_clave_fkey FOREIGN KEY (cobro_productor, cobro_clave) REFERENCES public.cobros_credito_pendientes_e1(operacion_productor, operacion_clave);


--
-- Name: existencias existencias_producto_id_productos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.existencias
    ADD CONSTRAINT existencias_producto_id_productos_id_fk FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: existencias existencias_ubicacion_id_ubicaciones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.existencias
    ADD CONSTRAINT existencias_ubicacion_id_ubicaciones_id_fk FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: finalizaciones_abono_e2 finalizaciones_abono_e2_abono_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finalizaciones_abono_e2
    ADD CONSTRAINT finalizaciones_abono_e2_abono_id_fkey FOREIGN KEY (abono_id) REFERENCES public.movimientos_credito(id);


--
-- Name: finalizaciones_abono_e2 finalizaciones_abono_e2_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finalizaciones_abono_e2
    ADD CONSTRAINT finalizaciones_abono_e2_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: fondo_arqueos fondo_arqueos_autor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fondo_arqueos
    ADD CONSTRAINT fondo_arqueos_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES public.usuarios(id);


--
-- Name: fondo_arqueos fondo_arqueos_fondo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fondo_arqueos
    ADD CONSTRAINT fondo_arqueos_fondo_id_fkey FOREIGN KEY (fondo_id) REFERENCES public.fondo_mariana(id);


--
-- Name: fondo_arqueos fondo_arqueos_version_saldo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fondo_arqueos
    ADD CONSTRAINT fondo_arqueos_version_saldo_fkey FOREIGN KEY (version_saldo) REFERENCES public.fondo_movimientos(id);


--
-- Name: fondo_mariana fondo_mariana_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fondo_mariana
    ADD CONSTRAINT fondo_mariana_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: fondo_movimientos fondo_movimientos_autor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fondo_movimientos
    ADD CONSTRAINT fondo_movimientos_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES public.usuarios(id);


--
-- Name: fondo_movimientos fondo_movimientos_fondo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fondo_movimientos
    ADD CONSTRAINT fondo_movimientos_fondo_id_fkey FOREIGN KEY (fondo_id) REFERENCES public.fondo_mariana(id);


--
-- Name: fondo_movimientos fondo_movimientos_original_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fondo_movimientos
    ADD CONSTRAINT fondo_movimientos_original_id_fkey FOREIGN KEY (original_id) REFERENCES public.fondo_movimientos(id);


--
-- Name: movimientos_credito movimientos_credito_autorizado_por_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_credito
    ADD CONSTRAINT movimientos_credito_autorizado_por_usuarios_id_fk FOREIGN KEY (autorizado_por) REFERENCES public.usuarios(id);


--
-- Name: movimientos_credito movimientos_credito_cliente_id_clientes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_credito
    ADD CONSTRAINT movimientos_credito_cliente_id_clientes_id_fk FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: movimientos_credito movimientos_credito_movimiento_origen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_credito
    ADD CONSTRAINT movimientos_credito_movimiento_origen_id_fkey FOREIGN KEY (movimiento_origen_id) REFERENCES public.movimientos_credito(id);


--
-- Name: movimientos_credito movimientos_credito_ticket_id_tickets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_credito
    ADD CONSTRAINT movimientos_credito_ticket_id_tickets_id_fk FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: movimientos_credito movimientos_credito_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_credito
    ADD CONSTRAINT movimientos_credito_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: movimientos_credito movimientos_nota_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_credito
    ADD CONSTRAINT movimientos_nota_fk_e1 FOREIGN KEY (nota_origen_id) REFERENCES public.tickets(id) NOT VALID;


--
-- Name: movimientos_credito movimientos_operacion_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_credito
    ADD CONSTRAINT movimientos_operacion_fk_e1 FOREIGN KEY (operacion_productor, operacion_clave) REFERENCES public.operaciones_credito_e1(productor, clave) MATCH FULL NOT VALID;


--
-- Name: movimientos movimientos_producto_id_productos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos
    ADD CONSTRAINT movimientos_producto_id_productos_id_fk FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: movimientos movimientos_revisado_por_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos
    ADD CONSTRAINT movimientos_revisado_por_usuarios_id_fk FOREIGN KEY (revisado_por) REFERENCES public.usuarios(id);


--
-- Name: movimientos movimientos_rollo_id_rollos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos
    ADD CONSTRAINT movimientos_rollo_id_rollos_id_fk FOREIGN KEY (rollo_id) REFERENCES public.rollos(id);


--
-- Name: movimientos movimientos_salida_id_salidas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos
    ADD CONSTRAINT movimientos_salida_id_salidas_id_fk FOREIGN KEY (salida_id) REFERENCES public.salidas(id);


--
-- Name: movimientos_credito movimientos_sesion_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_credito
    ADD CONSTRAINT movimientos_sesion_fk_e1 FOREIGN KEY (sesion_caja_id) REFERENCES public.sesiones_caja(id) NOT VALID;


--
-- Name: movimientos_credito movimientos_sitio_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_credito
    ADD CONSTRAINT movimientos_sitio_fk_e1 FOREIGN KEY (sitio_origen_id) REFERENCES public.ubicaciones(id) NOT VALID;


--
-- Name: movimientos movimientos_ubicacion_id_ubicaciones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos
    ADD CONSTRAINT movimientos_ubicacion_id_ubicaciones_id_fk FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: movimientos movimientos_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos
    ADD CONSTRAINT movimientos_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: notificaciones_credito notificaciones_credito_cajero_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones_credito
    ADD CONSTRAINT notificaciones_credito_cajero_id_usuarios_id_fk FOREIGN KEY (cajero_id) REFERENCES public.usuarios(id);


--
-- Name: notificaciones_credito notificaciones_credito_cliente_id_clientes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones_credito
    ADD CONSTRAINT notificaciones_credito_cliente_id_clientes_id_fk FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: notificaciones_credito notificaciones_credito_ticket_id_tickets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones_credito
    ADD CONSTRAINT notificaciones_credito_ticket_id_tickets_id_fk FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: notificaciones_credito notificaciones_credito_tienda_id_ubicaciones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones_credito
    ADD CONSTRAINT notificaciones_credito_tienda_id_ubicaciones_id_fk FOREIGN KEY (tienda_id) REFERENCES public.ubicaciones(id);


--
-- Name: notificaciones_sistema notificaciones_sistema_destinatario_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones_sistema
    ADD CONSTRAINT notificaciones_sistema_destinatario_usuario_id_fkey FOREIGN KEY (destinatario_usuario_id) REFERENCES public.usuarios(id);


--
-- Name: operaciones_credito_e1 operaciones_actor_fk_e1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operaciones_credito_e1
    ADD CONSTRAINT operaciones_actor_fk_e1 FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: pagos_proveedor pagos_proveedor_entrada_id_entradas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_proveedor
    ADD CONSTRAINT pagos_proveedor_entrada_id_entradas_id_fk FOREIGN KEY (entrada_id) REFERENCES public.entradas(id);


--
-- Name: pagos_proveedor pagos_proveedor_movimiento_origen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_proveedor
    ADD CONSTRAINT pagos_proveedor_movimiento_origen_id_fkey FOREIGN KEY (movimiento_origen_id) REFERENCES public.pagos_proveedor(id);


--
-- Name: pagos_proveedor pagos_proveedor_proveedor_id_proveedores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_proveedor
    ADD CONSTRAINT pagos_proveedor_proveedor_id_proveedores_id_fk FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);


--
-- Name: pagos_proveedor pagos_proveedor_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_proveedor
    ADD CONSTRAINT pagos_proveedor_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: permisos_rol permisos_rol_updated_por_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_rol
    ADD CONSTRAINT permisos_rol_updated_por_usuarios_id_fk FOREIGN KEY (updated_por) REFERENCES public.usuarios(id);


--
-- Name: permisos_ubicacion permisos_ubicacion_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_ubicacion
    ADD CONSTRAINT permisos_ubicacion_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: permisos_ubicacion permisos_ubicacion_updated_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_ubicacion
    ADD CONSTRAINT permisos_ubicacion_updated_por_fkey FOREIGN KEY (updated_por) REFERENCES public.usuarios(id);


--
-- Name: permisos_usuario permisos_usuario_updated_por_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_usuario
    ADD CONSTRAINT permisos_usuario_updated_por_usuarios_id_fk FOREIGN KEY (updated_por) REFERENCES public.usuarios(id);


--
-- Name: permisos_usuario permisos_usuario_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_usuario
    ADD CONSTRAINT permisos_usuario_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: pisos pisos_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pisos
    ADD CONSTRAINT pisos_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: precio_historial precio_historial_producto_id_productos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precio_historial
    ADD CONSTRAINT precio_historial_producto_id_productos_id_fk FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: precio_historial precio_historial_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precio_historial
    ADD CONSTRAINT precio_historial_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: proveedor_efectivo_e12 proveedor_efectivo_e12_ingreso_caja_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor_efectivo_e12
    ADD CONSTRAINT proveedor_efectivo_e12_ingreso_caja_id_fkey FOREIGN KEY (ingreso_caja_id) REFERENCES public.caja_retornos_proveedor_e12(id);


--
-- Name: proveedor_efectivo_e12 proveedor_efectivo_e12_movimiento_fondo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor_efectivo_e12
    ADD CONSTRAINT proveedor_efectivo_e12_movimiento_fondo_id_fkey FOREIGN KEY (movimiento_fondo_id) REFERENCES public.fondo_movimientos(id);


--
-- Name: proveedor_efectivo_e12 proveedor_efectivo_e12_pago_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor_efectivo_e12
    ADD CONSTRAINT proveedor_efectivo_e12_pago_proveedor_id_fkey FOREIGN KEY (pago_proveedor_id) REFERENCES public.pagos_proveedor(id);


--
-- Name: proveedor_efectivo_e12 proveedor_efectivo_e12_retorno_fondo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor_efectivo_e12
    ADD CONSTRAINT proveedor_efectivo_e12_retorno_fondo_id_fkey FOREIGN KEY (retorno_fondo_id) REFERENCES public.fondo_movimientos(id);


--
-- Name: proveedor_efectivo_e12 proveedor_efectivo_e12_reverso_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor_efectivo_e12
    ADD CONSTRAINT proveedor_efectivo_e12_reverso_proveedor_id_fkey FOREIGN KEY (reverso_proveedor_id) REFERENCES public.pagos_proveedor(id);


--
-- Name: proveedor_efectivo_e12 proveedor_efectivo_e12_salida_caja_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor_efectivo_e12
    ADD CONSTRAINT proveedor_efectivo_e12_salida_caja_id_fkey FOREIGN KEY (salida_caja_id) REFERENCES public.salidas_dinero_caja(id);


--
-- Name: proveedor_operaciones_e12 proveedor_operaciones_e12_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor_operaciones_e12
    ADD CONSTRAINT proveedor_operaciones_e12_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.usuarios(id);


--
-- Name: proveedor_solicitudes_e12 proveedor_solicitudes_e12_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor_solicitudes_e12
    ADD CONSTRAINT proveedor_solicitudes_e12_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.usuarios(id);


--
-- Name: proveedor_solicitudes_e12 proveedor_solicitudes_e12_solicitud_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor_solicitudes_e12
    ADD CONSTRAINT proveedor_solicitudes_e12_solicitud_id_fkey FOREIGN KEY (solicitud_id) REFERENCES public.solicitudes_pago_dirigido(id);


--
-- Name: recibo_folio_e3 recibo_folio_e3_sitio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recibo_folio_e3
    ADD CONSTRAINT recibo_folio_e3_sitio_id_fkey FOREIGN KEY (sitio_id) REFERENCES public.ubicaciones(id);


--
-- Name: recibos_abono_e3 recibos_abono_e3_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recibos_abono_e3
    ADD CONSTRAINT recibos_abono_e3_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: recibos_abono_e3 recibos_abono_e3_movimiento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recibos_abono_e3
    ADD CONSTRAINT recibos_abono_e3_movimiento_id_fkey FOREIGN KEY (movimiento_id) REFERENCES public.movimientos_credito(id);


--
-- Name: recibos_abono_e3 recibos_abono_e3_sesion_operativa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recibos_abono_e3
    ADD CONSTRAINT recibos_abono_e3_sesion_operativa_id_fkey FOREIGN KEY (sesion_operativa_id) REFERENCES public.sesiones_caja(id);


--
-- Name: reimpresiones_etiqueta reimpresiones_etiqueta_autorizado_por_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reimpresiones_etiqueta
    ADD CONSTRAINT reimpresiones_etiqueta_autorizado_por_usuarios_id_fk FOREIGN KEY (autorizado_por) REFERENCES public.usuarios(id);


--
-- Name: reimpresiones_etiqueta reimpresiones_etiqueta_rollo_id_rollos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reimpresiones_etiqueta
    ADD CONSTRAINT reimpresiones_etiqueta_rollo_id_rollos_id_fk FOREIGN KEY (rollo_id) REFERENCES public.rollos(id);


--
-- Name: reimpresiones_etiqueta reimpresiones_etiqueta_sitio_id_ubicaciones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reimpresiones_etiqueta
    ADD CONSTRAINT reimpresiones_etiqueta_sitio_id_ubicaciones_id_fk FOREIGN KEY (sitio_id) REFERENCES public.ubicaciones(id);


--
-- Name: reimpresiones_etiqueta reimpresiones_etiqueta_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reimpresiones_etiqueta
    ADD CONSTRAINT reimpresiones_etiqueta_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: revisiones_etiqueta revisiones_etiqueta_reimpresion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revisiones_etiqueta
    ADD CONSTRAINT revisiones_etiqueta_reimpresion_id_fkey FOREIGN KEY (reimpresion_id) REFERENCES public.reimpresiones_etiqueta(id);


--
-- Name: revisiones_etiqueta revisiones_etiqueta_rollo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revisiones_etiqueta
    ADD CONSTRAINT revisiones_etiqueta_rollo_id_fkey FOREIGN KEY (rollo_id) REFERENCES public.rollos(id);


--
-- Name: revisiones_etiqueta revisiones_etiqueta_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revisiones_etiqueta
    ADD CONSTRAINT revisiones_etiqueta_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: rollos rollos_piso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rollos
    ADD CONSTRAINT rollos_piso_id_fkey FOREIGN KEY (piso_id) REFERENCES public.pisos(id);


--
-- Name: rollos rollos_producto_id_productos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rollos
    ADD CONSTRAINT rollos_producto_id_productos_id_fk FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: rollos rollos_proveedor_id_proveedores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rollos
    ADD CONSTRAINT rollos_proveedor_id_proveedores_id_fk FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);


--
-- Name: rollos rollos_ubicacion_id_ubicaciones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rollos
    ADD CONSTRAINT rollos_ubicacion_id_ubicaciones_id_fk FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: salida_folio salida_folio_ubicacion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salida_folio
    ADD CONSTRAINT salida_folio_ubicacion_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: salida_lineas salida_lineas_producto_id_productos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salida_lineas
    ADD CONSTRAINT salida_lineas_producto_id_productos_id_fk FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: salida_lineas salida_lineas_salida_id_salidas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salida_lineas
    ADD CONSTRAINT salida_lineas_salida_id_salidas_id_fk FOREIGN KEY (salida_id) REFERENCES public.salidas(id);


--
-- Name: salida_rollos salida_rollos_linea_id_salida_lineas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salida_rollos
    ADD CONSTRAINT salida_rollos_linea_id_salida_lineas_id_fk FOREIGN KEY (linea_id) REFERENCES public.salida_lineas(id);


--
-- Name: salida_rollos salida_rollos_rollo_id_rollos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salida_rollos
    ADD CONSTRAINT salida_rollos_rollo_id_rollos_id_fk FOREIGN KEY (rollo_id) REFERENCES public.rollos(id);


--
-- Name: salida_rollos salida_rollos_salida_id_salidas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salida_rollos
    ADD CONSTRAINT salida_rollos_salida_id_salidas_id_fk FOREIGN KEY (salida_id) REFERENCES public.salidas(id);


--
-- Name: salidas salidas_autorizado_por_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_autorizado_por_id_usuarios_id_fk FOREIGN KEY (autorizado_por_id) REFERENCES public.usuarios(id);


--
-- Name: salidas salidas_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: salidas salidas_destino_id_ubicaciones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_destino_id_ubicaciones_id_fk FOREIGN KEY (destino_id) REFERENCES public.ubicaciones(id);


--
-- Name: salidas_dinero_caja salidas_dinero_caja_creado_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas_dinero_caja
    ADD CONSTRAINT salidas_dinero_caja_creado_por_id_fkey FOREIGN KEY (creado_por_id) REFERENCES public.usuarios(id);


--
-- Name: salidas_dinero_caja salidas_dinero_caja_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas_dinero_caja
    ADD CONSTRAINT salidas_dinero_caja_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);


--
-- Name: salidas_dinero_caja salidas_dinero_caja_sesion_caja_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas_dinero_caja
    ADD CONSTRAINT salidas_dinero_caja_sesion_caja_id_fkey FOREIGN KEY (sesion_caja_id) REFERENCES public.sesiones_caja(id);


--
-- Name: salidas salidas_origen_id_ubicaciones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_origen_id_ubicaciones_id_fk FOREIGN KEY (origen_id) REFERENCES public.ubicaciones(id);


--
-- Name: salidas salidas_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: salidas salidas_usuario_acepta_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_usuario_acepta_id_usuarios_id_fk FOREIGN KEY (usuario_acepta_id) REFERENCES public.usuarios(id);


--
-- Name: salidas salidas_usuario_cancela_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_usuario_cancela_id_usuarios_id_fk FOREIGN KEY (usuario_cancela_id) REFERENCES public.usuarios(id);


--
-- Name: salidas salidas_usuario_cierra_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_usuario_cierra_id_usuarios_id_fk FOREIGN KEY (usuario_cierra_id) REFERENCES public.usuarios(id);


--
-- Name: salidas salidas_usuario_entrega_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_usuario_entrega_id_fkey FOREIGN KEY (usuario_entrega_id) REFERENCES public.usuarios(id);


--
-- Name: salidas salidas_usuario_envia_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_usuario_envia_id_usuarios_id_fk FOREIGN KEY (usuario_envia_id) REFERENCES public.usuarios(id);


--
-- Name: salidas salidas_usuario_prepara_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_usuario_prepara_id_usuarios_id_fk FOREIGN KEY (usuario_prepara_id) REFERENCES public.usuarios(id);


--
-- Name: salidas salidas_usuario_recibe_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_usuario_recibe_id_usuarios_id_fk FOREIGN KEY (usuario_recibe_id) REFERENCES public.usuarios(id);


--
-- Name: salidas salidas_usuario_solicita_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salidas
    ADD CONSTRAINT salidas_usuario_solicita_id_usuarios_id_fk FOREIGN KEY (usuario_solicita_id) REFERENCES public.usuarios(id);


--
-- Name: sesiones_caja sesiones_caja_cerrada_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones_caja
    ADD CONSTRAINT sesiones_caja_cerrada_por_id_fkey FOREIGN KEY (cerrada_por_id) REFERENCES public.usuarios(id);


--
-- Name: sesiones_caja_dias sesiones_caja_dias_sesion_caja_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones_caja_dias
    ADD CONSTRAINT sesiones_caja_dias_sesion_caja_id_fkey FOREIGN KEY (sesion_caja_id) REFERENCES public.sesiones_caja(id);


--
-- Name: sesiones_caja_dias sesiones_caja_dias_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones_caja_dias
    ADD CONSTRAINT sesiones_caja_dias_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: sesiones_caja sesiones_caja_ubicacion_id_ubicaciones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones_caja
    ADD CONSTRAINT sesiones_caja_ubicacion_id_ubicaciones_id_fk FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: sesiones_caja sesiones_caja_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones_caja
    ADD CONSTRAINT sesiones_caja_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: sesiones sesiones_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones
    ADD CONSTRAINT sesiones_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: solicitudes_pago_dirigido solicitudes_pago_dirigido_autorizador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_pago_dirigido
    ADD CONSTRAINT solicitudes_pago_dirigido_autorizador_id_fkey FOREIGN KEY (autorizador_id) REFERENCES public.usuarios(id);


--
-- Name: solicitudes_pago_dirigido solicitudes_pago_dirigido_solicitante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_pago_dirigido
    ADD CONSTRAINT solicitudes_pago_dirigido_solicitante_id_fkey FOREIGN KEY (solicitante_id) REFERENCES public.usuarios(id);


--
-- Name: solicitudes_pago_dirigido solicitudes_pago_dirigido_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_pago_dirigido
    ADD CONSTRAINT solicitudes_pago_dirigido_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: stock_minimo_episodios stock_minimo_episodios_movimiento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_minimo_episodios
    ADD CONSTRAINT stock_minimo_episodios_movimiento_id_fkey FOREIGN KEY (movimiento_id) REFERENCES public.movimientos(id);


--
-- Name: stock_minimo_episodios stock_minimo_episodios_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_minimo_episodios
    ADD CONSTRAINT stock_minimo_episodios_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: stock_minimo_episodios stock_minimo_episodios_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_minimo_episodios
    ADD CONSTRAINT stock_minimo_episodios_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: stock_minimo_sitios stock_minimo_sitios_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_minimo_sitios
    ADD CONSTRAINT stock_minimo_sitios_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: stock_minimo_sitios stock_minimo_sitios_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_minimo_sitios
    ADD CONSTRAINT stock_minimo_sitios_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.usuarios(id);


--
-- Name: stock_minimos stock_minimos_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_minimos
    ADD CONSTRAINT stock_minimos_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: stock_minimos stock_minimos_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_minimos
    ADD CONSTRAINT stock_minimos_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: stock_minimos stock_minimos_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_minimos
    ADD CONSTRAINT stock_minimos_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.usuarios(id);


--
-- Name: tarea4_rollo_remate tarea4_rollo_remate_rollo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarea4_rollo_remate
    ADD CONSTRAINT tarea4_rollo_remate_rollo_id_fkey FOREIGN KEY (rollo_id) REFERENCES public.rollos(id);


--
-- Name: tarea4_rollo_remate tarea4_rollo_remate_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarea4_rollo_remate
    ADD CONSTRAINT tarea4_rollo_remate_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: test_reset_history test_reset_history_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_reset_history
    ADD CONSTRAINT test_reset_history_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.usuarios(id);


--
-- Name: ticket_linea_consumos ticket_linea_consumos_entrada_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_linea_consumos
    ADD CONSTRAINT ticket_linea_consumos_entrada_id_fkey FOREIGN KEY (entrada_id) REFERENCES public.entradas(id);


--
-- Name: ticket_linea_consumos ticket_linea_consumos_movimiento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_linea_consumos
    ADD CONSTRAINT ticket_linea_consumos_movimiento_id_fkey FOREIGN KEY (movimiento_id) REFERENCES public.movimientos(id);


--
-- Name: ticket_linea_consumos ticket_linea_consumos_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_linea_consumos
    ADD CONSTRAINT ticket_linea_consumos_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);


--
-- Name: ticket_linea_consumos ticket_linea_consumos_reversa_de_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_linea_consumos
    ADD CONSTRAINT ticket_linea_consumos_reversa_de_id_fkey FOREIGN KEY (reversa_de_id) REFERENCES public.ticket_linea_consumos(id);


--
-- Name: ticket_linea_consumos ticket_linea_consumos_rollo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_linea_consumos
    ADD CONSTRAINT ticket_linea_consumos_rollo_id_fkey FOREIGN KEY (rollo_id) REFERENCES public.rollos(id);


--
-- Name: ticket_linea_consumos ticket_linea_consumos_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_linea_consumos
    ADD CONSTRAINT ticket_linea_consumos_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: ticket_linea_consumos ticket_linea_consumos_ticket_linea_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_linea_consumos
    ADD CONSTRAINT ticket_linea_consumos_ticket_linea_id_fkey FOREIGN KEY (ticket_linea_id) REFERENCES public.ticket_lineas(id);


--
-- Name: ticket_lineas ticket_lineas_producto_id_productos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_lineas
    ADD CONSTRAINT ticket_lineas_producto_id_productos_id_fk FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: ticket_lineas ticket_lineas_rollo_id_rollos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_lineas
    ADD CONSTRAINT ticket_lineas_rollo_id_rollos_id_fk FOREIGN KEY (rollo_id) REFERENCES public.rollos(id);


--
-- Name: ticket_lineas ticket_lineas_ticket_id_tickets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_lineas
    ADD CONSTRAINT ticket_lineas_ticket_id_tickets_id_fk FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: ticket_pagos ticket_pagos_ticket_id_tickets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_pagos
    ADD CONSTRAINT ticket_pagos_ticket_id_tickets_id_fk FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: ticket_pagos ticket_pagos_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_pagos
    ADD CONSTRAINT ticket_pagos_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: tickets tickets_autorizado_por_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_autorizado_por_usuarios_id_fk FOREIGN KEY (autorizado_por) REFERENCES public.usuarios(id);


--
-- Name: tickets tickets_cancelado_por_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_cancelado_por_usuarios_id_fk FOREIGN KEY (cancelado_por) REFERENCES public.usuarios(id);


--
-- Name: tickets tickets_cliente_id_clientes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_cliente_id_clientes_id_fk FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: tickets tickets_sesion_caja_id_sesiones_caja_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_sesion_caja_id_sesiones_caja_id_fk FOREIGN KEY (sesion_caja_id) REFERENCES public.sesiones_caja(id);


--
-- Name: tickets tickets_ubicacion_id_ubicaciones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_ubicacion_id_ubicaciones_id_fk FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: tickets tickets_usuario_caja_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_usuario_caja_id_usuarios_id_fk FOREIGN KEY (usuario_caja_id) REFERENCES public.usuarios(id);


--
-- Name: tickets tickets_usuario_terminal_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_usuario_terminal_id_usuarios_id_fk FOREIGN KEY (usuario_terminal_id) REFERENCES public.usuarios(id);


--
-- Name: usuarios usuarios_ubicacion_id_ubicaciones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_ubicacion_id_ubicaciones_id_fk FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: viaje_folio viaje_folio_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.viaje_folio
    ADD CONSTRAINT viaje_folio_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id);


--
-- Name: viaje_salidas viaje_salidas_salida_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.viaje_salidas
    ADD CONSTRAINT viaje_salidas_salida_id_fkey FOREIGN KEY (salida_id) REFERENCES public.salidas(id);


--
-- Name: viaje_salidas viaje_salidas_viaje_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.viaje_salidas
    ADD CONSTRAINT viaje_salidas_viaje_id_fkey FOREIGN KEY (viaje_id) REFERENCES public.viajes(id);


--
-- Name: viaje_tickets viaje_tickets_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.viaje_tickets
    ADD CONSTRAINT viaje_tickets_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: viaje_tickets viaje_tickets_viaje_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.viaje_tickets
    ADD CONSTRAINT viaje_tickets_viaje_id_fkey FOREIGN KEY (viaje_id) REFERENCES public.viajes(id);


--
-- Name: viajes viajes_camioneta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.viajes
    ADD CONSTRAINT viajes_camioneta_id_fkey FOREIGN KEY (camioneta_id) REFERENCES public.camionetas(id);


--
-- Name: viajes viajes_chofer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.viajes
    ADD CONSTRAINT viajes_chofer_id_fkey FOREIGN KEY (chofer_id) REFERENCES public.choferes(id);


--
-- Name: viajes viajes_creado_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.viajes
    ADD CONSTRAINT viajes_creado_por_id_fkey FOREIGN KEY (creado_por_id) REFERENCES public.usuarios(id);


--
-- Name: viajes viajes_origen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.viajes
    ADD CONSTRAINT viajes_origen_id_fkey FOREIGN KEY (origen_id) REFERENCES public.ubicaciones(id);


--
-- Name: vistas_abono_e3 vistas_abono_e3_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vistas_abono_e3
    ADD CONSTRAINT vistas_abono_e3_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.usuarios(id);


--
-- PostgreSQL database dump complete
--

\unrestrict nfP2FyBya7lfwiF7nK0UdjTzpL0ngQ9lS81k2aGaJl6nkAsK89uSrQIkRgnmzgs

