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