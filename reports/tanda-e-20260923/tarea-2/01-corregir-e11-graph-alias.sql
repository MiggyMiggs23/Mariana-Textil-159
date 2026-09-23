-- Preparado, no aplicado a la base de la API.
-- Corrige únicamente los dos aliases SQL que colisionan con `a record`.
\set ON_ERROR_STOP on

BEGIN;

DO $do$
DECLARE
  function_oid oid := to_regprocedure('public.e11_graph()');
  definition text;
  first_original constant text := $fragment$SELECT 1 FROM public.e11_avisos a WHERE a.id=(j->>'avisoAdminId')::uuid
          AND a.decision_id=d.id AND a.conciliacion_id=d.conciliacion_id AND a.birth_xid=d.birth_xid$fragment$;
  first_corrected constant text := $fragment$SELECT 1 FROM public.e11_avisos aviso WHERE aviso.id=(j->>'avisoAdminId')::uuid
          AND aviso.decision_id=d.id AND aviso.conciliacion_id=d.conciliacion_id AND aviso.birth_xid=d.birth_xid$fragment$;
  second_original constant text := $fragment$SELECT 1 FROM public.e11_avisos a WHERE a.conciliacion_id::text=n.entidad_id$fragment$;
  second_corrected constant text := $fragment$SELECT 1 FROM public.e11_avisos aviso WHERE aviso.conciliacion_id::text=n.entidad_id$fragment$;
BEGIN
  IF function_oid IS NULL THEN
    RAISE EXCEPTION 'E11 alias fix: public.e11_graph() no existe';
  END IF;

  SELECT pg_get_functiondef(function_oid) INTO STRICT definition;

  IF (length(definition)-length(replace(definition,first_original,'')))/length(first_original) <> 1
    OR (length(definition)-length(replace(definition,second_original,'')))/length(second_original) <> 1
  THEN
    RAISE EXCEPTION 'E11 alias fix: definición inesperada; no se modificó';
  END IF;

  definition := replace(definition,first_original,first_corrected);
  definition := replace(definition,second_original,second_corrected);
  EXECUTE definition;

  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid='public.e11_graph()'::regprocedure
      AND EXISTS (
        SELECT 1 FROM unnest(coalesce(proconfig,ARRAY[]::text[])) setting
        WHERE setting LIKE 'plpgsql.variable_conflict=%'
      )
  ) THEN
    RAISE EXCEPTION 'E11 alias fix: se detectó una relajación variable_conflict';
  END IF;
END
$do$;

COMMIT;