CREATE OR REPLACE FUNCTION public.e11_recovery_check()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE r record; o record; metadata jsonb; target jsonb; previous jsonb; expected jsonb;
BEGIN
  FOR o IN SELECT * FROM public.e11_operaciones WHERE estado='CERRADA_SIN_EFECTO' LOOP
    IF NOT EXISTS(SELECT 1 FROM public.e11_resoluciones resolution_row
      WHERE resolution_row.actor_original_id=o.actor_id AND resolution_row.accion=o.operacion AND resolution_row.uuid_original=o.uuid
        AND resolution_row.estado=o.estado AND resolution_row.birth_xid=o.birth_xid
        AND resolution_row.solicitud_hash=o.solicitud_hash AND resolution_row.respuesta=o.respuesta)
    THEN RAISE EXCEPTION 'E11: tombstone sin resolución ADMIN propia'; END IF;
    IF (o.operacion='PERFIL' AND EXISTS(SELECT 1 FROM public.e11_perfil_eventos
          WHERE actor_id=o.actor_id AND uuid=o.uuid))
      OR (o.operacion='SNAPSHOT' AND EXISTS(SELECT 1 FROM public.e11_conciliaciones
          WHERE actor_id=o.actor_id AND (datos->>'uuid')::uuid=o.uuid))
      OR (o.operacion='DECISION' AND EXISTS(SELECT 1 FROM public.e11_decisiones
          WHERE actor_id=o.actor_id AND uuid=o.uuid))
      OR (o.operacion='PREPARACION' AND EXISTS(SELECT 1 FROM public.e5_operaciones
          WHERE actor_id=o.actor_id AND clave=o.uuid AND accion='PROPONER'))
      OR (o.operacion='PREPARACION' AND EXISTS(SELECT 1 FROM public.e11_e5_preparaciones
          WHERE actor_id=o.actor_id AND clave=o.uuid))
    THEN RAISE EXCEPTION 'E11: tombstone incompatible con efecto; conservar evidencia'; END IF;
  END LOOP;
  FOR r IN SELECT * FROM public.e11_resoluciones LOOP
    SELECT * INTO o FROM public.e11_operaciones
      WHERE actor_id=r.actor_original_id AND operacion=r.accion AND uuid=r.uuid_original;
    IF NOT FOUND OR o.estado<>r.estado
    THEN RAISE EXCEPTION 'E11: resolución sin operación terminal compatible'; END IF;
    target:=jsonb_build_object('actorId',r.actor_original_id,'accion',r.accion,'uuidOriginal',r.uuid_original::text);
    metadata:=target||jsonb_build_object('estado',r.estado,'resolucionId',r.id::text,
      'resueltoEn',public.e11_iso(r.created_at));
    expected:=metadata||jsonb_build_object('revision',public.e11_hash(metadata));
    previous:=target||jsonb_build_object('estado',CASE WHEN r.estado='CONFIRMADA'
      THEN 'CONFIRMADA' ELSE 'PENDIENTE' END,'resolucionId',NULL,'resueltoEn',NULL);
    IF r.respuesta IS DISTINCT FROM expected OR r.revision_anterior<>public.e11_hash(previous)
      OR r.solicitud_hash<>public.e11_hash(jsonb_build_object('target',target,'input',
        jsonb_build_object('uuid',r.uuid_resolutor::text,'revisionEsperada',r.revision_anterior,
          'identidadVersion',r.identidad_version,'motivo',r.motivo)))
    THEN RAISE EXCEPTION 'E11: resolución metadata/CAS/hash no contractual'; END IF;
    -- identidad_version es el hash opaco entregado por backend; no inventar
    -- sesión ni derivación alternativa en SQL. ADMIN real se exige al INSERT.
    -- No reautorizar ese ADMIN histórico después de revocarlo.
  END LOOP;
END $function$
