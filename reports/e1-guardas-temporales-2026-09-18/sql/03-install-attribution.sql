-- Fragment: run ONLY inside the reviewed identity-checked transaction.
CREATE FUNCTION public.e1_guard_historical_attribution_closed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $gate_attribution$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'E1A01',
    MESSAGE = 'E1: la atribución histórica de crédito está deshabilitada.';
  RETURN NULL;
END;
$gate_attribution$;

CREATE TRIGGER zz_e1_historical_attribution_closed
AFTER INSERT ON public.atribuciones_credito_e1
FOR EACH STATEMENT EXECUTE FUNCTION public.e1_guard_historical_attribution_closed();