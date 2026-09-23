-- Ejecutar sólo en una base desechable vacía, desde la raíz del repositorio.
\set ON_ERROR_STOP on

CREATE TABLE public.e11_avisos (
  id uuid PRIMARY KEY,
  decision_id uuid NOT NULL,
  conciliacion_id uuid NOT NULL,
  birth_xid xid8 NOT NULL
);
CREATE TABLE public.e11_decisiones (
  id uuid PRIMARY KEY,
  conciliacion_id uuid NOT NULL,
  birth_xid xid8 NOT NULL
);
CREATE TABLE public.notificaciones_sistema (
  tipo text NOT NULL,
  entidad_id text NOT NULL
);
CREATE TABLE public.e11_alias_probe (id integer PRIMARY KEY);

INSERT INTO public.e11_decisiones
VALUES (
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '1'::xid8
);
INSERT INTO public.e11_avisos
VALUES (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '1'::xid8
);

CREATE OR REPLACE FUNCTION public.e11_graph()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog'
AS $function$
DECLARE a record; d record; j jsonb;
BEGIN
  SELECT * INTO d FROM public.e11_decisiones LIMIT 1;
  SELECT * INTO a FROM public.e11_avisos LIMIT 1;
  j:=jsonb_build_object('avisoAdminId','30000000-0000-0000-0000-000000000001');
  IF NEW.id < 0 THEN
    IF NOT EXISTS(
      SELECT 1 FROM public.e11_avisos a WHERE a.id=(j->>'avisoAdminId')::uuid
          AND a.decision_id=d.id AND a.conciliacion_id=d.conciliacion_id AND a.birth_xid=d.birth_xid)
    THEN RAISE EXCEPTION 'fixture incoherente'; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.notificaciones_sistema n WHERE n.tipo='E11_NO_CUADRA'
    AND NOT EXISTS(SELECT 1 FROM public.e11_avisos a WHERE a.conciliacion_id::text=n.entidad_id))
  THEN RAISE EXCEPTION 'E11: notificación huérfana'; END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER e11_alias_probe
BEFORE INSERT ON public.e11_alias_probe
FOR EACH ROW EXECUTE FUNCTION public.e11_graph();

-- Negativo: la definición instalada real es inválida al compilar la sentencia.
DO $test$
BEGIN
  BEGIN
    INSERT INTO public.e11_alias_probe VALUES (1);
    RAISE EXCEPTION 'la definición ambigua fue aceptada';
  EXCEPTION
    WHEN ambiguous_column THEN
      IF SQLERRM NOT LIKE '%a.conciliacion_id%is ambiguous%' THEN
        RAISE;
      END IF;
  END;
END
$test$;

\ir 01-corregir-e11-graph-alias.sql

-- Positivo: ambas subconsultas del mismo grafo coherente ya se evalúan.
INSERT INTO public.e11_alias_probe VALUES (-1);
INSERT INTO public.e11_alias_probe VALUES (1);

-- Negativo semántico: el arreglo no relaja la detección de una huérfana.
INSERT INTO public.notificaciones_sistema
VALUES ('E11_NO_CUADRA','20000000-0000-0000-0000-000000000099');
DO $test$
BEGIN
  BEGIN
    INSERT INTO public.e11_alias_probe VALUES (2);
    RAISE EXCEPTION 'la notificación huérfana fue aceptada';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'E11: notificación huérfana' THEN
        RAISE;
      END IF;
  END;
END
$test$;

DO $test$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid='public.e11_graph()'::regprocedure
      AND EXISTS (
        SELECT 1 FROM unnest(coalesce(proconfig,ARRAY[]::text[])) setting
        WHERE setting LIKE 'plpgsql.variable_conflict=%'
      )
  ) THEN
    RAISE EXCEPTION 'variable_conflict fue relajado';
  END IF;
END
$test$;