-- MAIN only, disposable DB after 00 + 01. Never connect the application DB.
\set ON_ERROR_STOP on
BEGIN;
DO $f$
BEGIN
  IF current_database() !~ '^(test_|disposable_|continuation_)' THEN
    RAISE EXCEPTION 'Disposable database name required';
  END IF;
  IF (SELECT enabled FROM public.commercial_return_gate WHERE id=1) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Candidate SQL gate must be CLOSED';
  END IF;
  BEGIN
    INSERT INTO public.devoluciones_comerciales(id)
      VALUES ('96cd5942-b32a-4a23-acaf-032e777f9a3c');
    RAISE EXCEPTION 'Closed direct capture was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%DEVOLUCION_COMERCIAL_CERRADA%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'commercial-return CLOSED direct capture: PASS';
END $f$;
ROLLBACK;