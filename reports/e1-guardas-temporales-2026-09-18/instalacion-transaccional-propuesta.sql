-- PROPUESTA: NO AUTORIZADA PARA LA BASE OPERATIVA.
-- Requiere envoltura externa de identidad, preflight y supervisor de 30 segundos.
-- Mismas seis sentencias DDL y orden transaccional ensayados en el clon.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
SET LOCAL idle_in_transaction_session_timeout='5s';
LOCK TABLE public."atribuciones_credito_e1", public."cobros_credito_pendientes_e1", public."movimientos_credito" IN SHARE ROW EXCLUSIVE MODE;

-- Fragment: run ONLY inside the reviewed identity-checked transaction.
-- Additive removable gate. Existing permanent E1 integrity remains unchanged.
CREATE FUNCTION public.e1_guard_cash_capture_closed()
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

-- AFTER checks the final inserted row after all BEFORE INSERT transformations.
CREATE TRIGGER zz_e1_cash_capture_closed
AFTER INSERT ON public.movimientos_credito
FOR EACH ROW EXECUTE FUNCTION public.e1_guard_cash_capture_closed();

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

COMMIT;
