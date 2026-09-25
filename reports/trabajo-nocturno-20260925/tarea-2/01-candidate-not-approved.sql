-- CANDIDATE ONLY: documentary E11 activation; MAIN review and rehearsal required.
-- E11 base DDL is already installed. No user/profile assignment is performed.
-- CONTADOR without an explicit A resolves to F in the canonical identity reader.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$
BEGIN
  IF md5(pg_get_functiondef('public.e11_closed()'::regprocedure)) <> '55dedd9891e653136d5f69aec3c7112c'
    THEN RAISE EXCEPTION 'E11 closure definition differs'; END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE tgname='e11_closed' AND tgenabled='O'
    AND tgfoid='public.e11_closed()'::regprocedure AND NOT tgisinternal) <> 8
    THEN RAISE EXCEPTION 'E11 closure inventory differs'; END IF;
  IF EXISTS (SELECT 1 FROM public.e11_perfiles)
    THEN RAISE EXCEPTION 'Profile state differs from reviewed empty state; review required'; END IF;
END $preflight$;
DROP TRIGGER e11_closed ON public.e11_perfiles;
DROP TRIGGER e11_closed ON public.e11_perfil_eventos;
DROP TRIGGER e11_closed ON public.e11_operaciones;
DROP TRIGGER e11_closed ON public.e11_conciliaciones;
DROP TRIGGER e11_closed ON public.e11_conciliacion_ventas;
DROP TRIGGER e11_closed ON public.e11_decisiones;
DROP TRIGGER e11_closed ON public.e11_resoluciones;
DROP TRIGGER e11_closed ON public.e11_avisos;
-- All role, identity, graph, immutability and audit triggers remain untouched.
COMMIT;