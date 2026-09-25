-- CANDIDATE ONLY. MAIN review and disposable rehearsal required before application.
-- Existing E5/E11 schemas MUST NOT be reinstalled. Monetary refund closures remain.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$
BEGIN
  IF md5(pg_get_functiondef('public.e5_graph_guard()'::regprocedure)) <> '5333a5027dfadf8d459e057035ef76e7'
    THEN RAISE EXCEPTION 'E5 graph differs from readonly reviewed identity'; END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE tgname='e5_closed' AND tgenabled='O'
    AND tgfoid='public.e5_closed()'::regprocedure AND NOT tgisinternal) <> 9
    THEN RAISE EXCEPTION 'E5 closure inventory differs'; END IF;
END $preflight$;
-- The current installed graph body equals the prepared corrected graph exactly.
-- No function replacement is necessary.
DROP TRIGGER e5_closed ON public.e5_recepciones;
DROP TRIGGER e5_closed ON public.e5_cobros;
DROP TRIGGER e5_closed ON public.e5_aplicaciones;
DROP TRIGGER e5_closed ON public.e5_vinculos_credito;
DROP TRIGGER e5_closed ON public.e5_documentos;
DROP TRIGGER e5_closed ON public.e5_operaciones;
DROP TRIGGER e5_closed ON public.e5_impresiones;
DO $verify$
BEGIN
  IF (SELECT count(*) FROM pg_trigger WHERE tgname='e5_closed' AND tgenabled='O'
    AND tgrelid IN ('public.e5_devoluciones'::regclass,'public.e5_salidas_bancarias'::regclass)
    AND tgfoid='public.e5_closed()'::regprocedure AND NOT tgisinternal) <> 2
    THEN RAISE EXCEPTION 'Monetary refund closures must remain'; END IF;
END $verify$;
COMMIT;
