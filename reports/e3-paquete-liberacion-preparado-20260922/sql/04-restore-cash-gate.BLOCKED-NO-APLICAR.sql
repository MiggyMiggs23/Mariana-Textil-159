\set ON_ERROR_STOP on
-- PREPARED ONLY. Re-closes future captures without editing financial evidence.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.e1_guard_cash_capture_closed()'))
      IS DISTINCT FROM 'f186c8df73f6b02e8b04c6a483111cbc' THEN
    RAISE EXCEPTION 'E3: guarda ausente o distinta; detener sin reparación';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.e1_guard_cash_capture_closed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $gate_cash$
BEGIN
  IF NEW.forma_pago::text = 'EFECTIVO'
     AND NEW.naturaleza::text IN ('INGRESO_FISICO', 'DEVOLUCION_FISICA') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'E1C01',
      MESSAGE = 'E1: la captura física de efectivo de crédito está deshabilitada.';
  END IF;
  RETURN NEW;
END;
$gate_cash$;
COMMIT;