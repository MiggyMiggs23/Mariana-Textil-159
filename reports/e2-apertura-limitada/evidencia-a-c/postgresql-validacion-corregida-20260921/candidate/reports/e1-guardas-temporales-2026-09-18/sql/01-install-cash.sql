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