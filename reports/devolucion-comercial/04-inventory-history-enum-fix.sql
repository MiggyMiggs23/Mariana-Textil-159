-- MAIN-only correction for a 01-schema.sql already installed before this fix.
-- Inventory reversals use origin linkage, not the CREDIT enum label REVERSO.
\set ON_ERROR_STOP on
BEGIN;
DO $f$
DECLARE definition text; fixed text;
BEGIN
  IF current_database()<>'continuation_return_test' THEN
    RAISE EXCEPTION 'This rehearsal correction is restricted to continuation_return_test';
  END IF;
  SELECT pg_get_functiondef('public.commercial_return_protect_history()'::regprocedure) INTO definition;
  fixed := replace(definition,
    'IF NEW.tipo=''REVERSO'' AND EXISTS (SELECT 1 FROM public.devoluciones_comerciales r',
    'IF NEW.movimiento_origen_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.devoluciones_comerciales r');
  IF fixed=definition AND position('IF NEW.movimiento_origen_id IS NOT NULL AND EXISTS' IN definition)=0 THEN
    RAISE EXCEPTION 'Unexpected inventory history function: MAIN review required';
  END IF;
  IF fixed<>definition THEN EXECUTE fixed; END IF;
END $f$;
COMMIT;