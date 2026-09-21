\set ON_ERROR_STOP on
-- PREPARED ONLY. Refuses rollback after first snapshot; never deletes financial evidence.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='60s';
LOCK TABLE public.recibos_abono_e3 IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.recibos_abono_e3) THEN
    RAISE EXCEPTION 'E3: existen recibos; conservar lector compatible y evidencia';
  END IF;
END $$;
DROP TABLE public.recibos_abono_e3;
DROP TABLE public.vistas_abono_e3;
DROP TABLE public.recibo_folio_e3;
DROP FUNCTION public.e3_receipt_immutable();
-- Permission rows intentionally retained (deny/customization); no blanket deletion.
COMMIT;