-- Fragment: run ONLY inside the reviewed identity-checked transaction.
CREATE FUNCTION public.e1_guard_pending_receipts_closed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $gate_pending$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'E1P01',
    MESSAGE = 'E1: el cobro retenido de crédito está deshabilitado.';
  RETURN NULL;
END;
$gate_pending$;

-- Permanent row integrity checks run first; zero-row INSERT is also rejected.
CREATE TRIGGER zz_e1_pending_receipts_closed
AFTER INSERT ON public.cobros_credito_pendientes_e1
FOR EACH STATEMENT EXECUTE FUNCTION public.e1_guard_pending_receipts_closed();