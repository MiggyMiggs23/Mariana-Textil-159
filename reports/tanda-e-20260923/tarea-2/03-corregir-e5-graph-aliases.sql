-- Preparado para el objeto ya instalado; no cambia predicados ni puertas.
-- Renombra sólo aliases SQL que colisionan con variables record de la función.
\set ON_ERROR_STOP on

BEGIN;

DO $do$
DECLARE
  function_oid oid := to_regprocedure('public.e5_graph_guard()');
  definition text;
  original text;
  corrected text;
  replacements integer := 0;
BEGIN
  IF function_oid IS NULL THEN
    RAISE EXCEPTION 'E5 alias fix: public.e5_graph_guard() no existe';
  END IF;

  SELECT pg_get_functiondef(function_oid) INTO STRICT definition;

  FOR original,corrected IN
    SELECT *
    FROM (VALUES
      ($old$SELECT mc.* INTO m FROM public.e5_vinculos_credito v
      JOIN public.movimientos_credito mc ON mc.id=v.movimiento_id
      WHERE v.aplicacion_id=a.id AND v.birth_xid=a.birth_xid$old$,
       $new$SELECT mc.* INTO m FROM public.e5_vinculos_credito application_link
      JOIN public.movimientos_credito mc ON mc.id=application_link.movimiento_id
      WHERE application_link.aplicacion_id=a.id
        AND application_link.birth_xid=a.birth_xid$new$),
      ($old$SELECT 1 FROM public.e5_aplicaciones a WHERE a.id=op.clave AND a.actor_id=op.usuario_id$old$,
       $new$SELECT 1 FROM public.e5_aplicaciones app_source
      WHERE app_source.id=op.clave AND app_source.actor_id=op.usuario_id$new$),
      ($old$SELECT 1 FROM public.movimientos_credito m
    WHERE m.operacion_productor='E5_APLICACION_RETENIDA' AND NOT EXISTS (
      SELECT 1 FROM public.e5_vinculos_credito v JOIN public.e5_aplicaciones a ON a.id=v.aplicacion_id
      WHERE v.movimiento_id=m.id AND a.id=m.operacion_clave)$old$,
       $new$SELECT 1 FROM public.movimientos_credito credit_source
    WHERE credit_source.operacion_productor='E5_APLICACION_RETENIDA' AND NOT EXISTS (
      SELECT 1 FROM public.e5_vinculos_credito credit_link
      JOIN public.e5_aplicaciones linked_application ON linked_application.id=credit_link.aplicacion_id
      WHERE credit_link.movimiento_id=credit_source.id
        AND linked_application.id=credit_source.operacion_clave)$new$),
      ($old$SELECT 1 FROM public.e5_devoluciones d WHERE d.clave=s.clave AND d.fuente->>'tipo'='CUENTA'$old$,
       $new$SELECT 1 FROM public.e5_devoluciones bank_refund
    WHERE bank_refund.clave=s.clave AND bank_refund.fuente->>'tipo'='CUENTA'$new$),
      ($old$SELECT 1 FROM public.e5_aplicaciones a
      WHERE a.cobro_id=v.cobro_id AND a.snapshot->>'constanciaId'=v.id::text
        AND v.snapshot->'autorizador'=a.snapshot->'actor'
        AND v.snapshot->'fechaAplicacion'=a.snapshot->'fechaAplicacion'
        AND v.snapshot->'evidencia'=a.snapshot->'evidencia'
        AND (v.snapshot->>'importeFavorGenerado')::numeric=
          coalesce((a.snapshot->>'importeFavorGenerado')::numeric,0)$old$,
       $new$SELECT 1 FROM public.e5_aplicaciones document_application
      WHERE document_application.cobro_id=v.cobro_id
        AND document_application.snapshot->>'constanciaId'=v.id::text
        AND v.snapshot->'autorizador'=document_application.snapshot->'actor'
        AND v.snapshot->'fechaAplicacion'=document_application.snapshot->'fechaAplicacion'
        AND v.snapshot->'evidencia'=document_application.snapshot->'evidencia'
        AND (v.snapshot->>'importeFavorGenerado')::numeric=
          coalesce((document_application.snapshot->>'importeFavorGenerado')::numeric,0)$new$),
      ($old$SELECT 1 FROM public.e5_aplicaciones a
        WHERE a.cobro_id=o.cobro_id AND a.birth_xid=o.birth_xid
          AND a.propuesta_id::text=prev->>'propuestaVigenteId' AND a.actor_id=o.actor_id$old$,
       $new$SELECT 1 FROM public.e5_aplicaciones authorized_application
        WHERE authorized_application.cobro_id=o.cobro_id
          AND authorized_application.birth_xid=o.birth_xid
          AND authorized_application.propuesta_id::text=prev->>'propuestaVigenteId'
          AND authorized_application.actor_id=o.actor_id$new$)
    ) fragments(original,corrected)
  LOOP
    IF (length(definition)-length(replace(definition,original,'')))/length(original) <> 1 THEN
      RAISE EXCEPTION 'E5 alias fix: definición inesperada en fragmento %; no se modificó',
        replacements+1;
    END IF;
    definition := replace(definition,original,corrected);
    replacements := replacements+1;
  END LOOP;

  IF replacements <> 6 THEN
    RAISE EXCEPTION 'E5 alias fix: reemplazos incompletos';
  END IF;

  EXECUTE definition;

  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid='public.e5_graph_guard()'::regprocedure
      AND EXISTS (
        SELECT 1 FROM unnest(coalesce(proconfig,ARRAY[]::text[])) setting
        WHERE setting LIKE 'plpgsql.variable_conflict=%'
      )
  ) THEN
    RAISE EXCEPTION 'E5 alias fix: se detectó una relajación variable_conflict';
  END IF;
END
$do$;

COMMIT;