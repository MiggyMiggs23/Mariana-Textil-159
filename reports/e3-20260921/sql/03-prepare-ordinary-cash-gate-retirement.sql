\set ON_ERROR_STOP on
-- PREPARED ONLY; requires owner release + fresh approved identity/catalog + verified
-- backup/restore + E2 A+C evidence installed and tested. Does NOT activate source gates.
-- This is NOT the broad E1 removal: refunds, directed cash and other producers stay CLOSED.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.e1_guard_cash_capture_closed()'))
       IS DISTINCT FROM 'ee8cdfa224759ce2df6d7ccd354f38c8'
    OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.movimientos_credito'::regclass
      AND tgname='zz_e1_cash_capture_closed' AND tgenabled='O'
      AND tgfoid=to_regprocedure('public.e1_guard_cash_capture_closed()')) THEN
    RAISE EXCEPTION 'E3: guarda previa distinta o ausente; detener sin reparación';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.e1_guard_cash_capture_closed()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $e3_cash$
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
$e3_cash$;
-- Permanent E1 classification, bank-no-session, adjustment-no-session and E2
-- deferred finalization validation remain untouched. Pending/attribution/refund gates unchanged.
COMMIT;