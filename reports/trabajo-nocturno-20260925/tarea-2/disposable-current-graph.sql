CREATE OR REPLACE FUNCTION public.e11_graph() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog AS $$
DECLARE p record; e record; s record; d record; a record; o record; prev record;
  j jsonb; rows_json jsonb; actual jsonb; end_date date; total numeric; n bigint; linked boolean;
BEGIN
  PERFORM public.e11_recovery_check();
  FOR p IN SELECT * FROM public.e11_perfiles LOOP
    SELECT * INTO e FROM public.e11_perfil_eventos WHERE usuario_id=p.usuario_id AND revision=p.version;
    IF NOT FOUND OR e.actor_id<>p.actor_id OR e.birth_xid<>p.birth_xid
      OR e.datos->>'posterior' IS DISTINCT FROM p.perfil
      OR (e.datos->>'creadoEn')::timestamptz IS DISTINCT FROM p.updated_at
      OR (SELECT count(*) FROM public.e11_perfil_eventos WHERE usuario_id=p.usuario_id)<>p.version
    THEN RAISE EXCEPTION 'E11: perfil sin cadena de eventos/CAS'; END IF;
    IF EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id=p.usuario_id AND
      (((u.rol::text<>'CONTADOR' OR NOT u.activo) AND p.perfil IS NOT NULL)
      OR (u.rol::text='CONTADOR' AND u.activo AND p.perfil IS NULL)))
    THEN RAISE EXCEPTION 'E11: perfil debe revocarse al salir/desactivar'; END IF;
  END LOOP;
  FOR e IN SELECT * FROM public.e11_perfil_eventos LOOP
    j:=e.datos;
    IF NOT public.e11_keys(j,ARRAY['id','uuid','usuarioId','actorId','anterior','posterior','revision','motivo','creadoEn'])
      OR (j->>'id')::uuid IS DISTINCT FROM e.id OR (j->>'uuid')::uuid IS DISTINCT FROM e.uuid
      OR (j->>'usuarioId')::integer IS DISTINCT FROM e.usuario_id
      OR (j->>'actorId')::integer IS DISTINCT FROM e.actor_id
      OR (j->>'revision')::integer IS DISTINCT FROM e.revision
      OR nullif(btrim(j->>'motivo'),'') IS NULL
      OR NOT isfinite((j->>'creadoEn')::timestamptz)
      OR coalesce(j->>'posterior','F') NOT IN ('A','F')
      OR NOT EXISTS (SELECT 1 FROM public.e11_perfiles WHERE usuario_id=e.usuario_id AND version>=e.revision)
    THEN RAISE EXCEPTION 'E11: evento perfil inválido'; END IF;
    IF e.revision>1 THEN
      SELECT * INTO prev FROM public.e11_perfil_eventos WHERE usuario_id=e.usuario_id AND revision=e.revision-1;
      -- Adapter usa F al normalizar null de un perfil CONTADOR; sólo tolerar
      -- esa normalización en reactivación real registrada, nunca para resucitar A.
      IF NOT FOUND OR (j->'anterior' IS DISTINCT FROM prev.datos->'posterior'
        AND NOT (prev.datos->'posterior'='null'::jsonb AND j->>'anterior'='F'
          AND EXISTS (SELECT 1 FROM public.e11_cambios_usuario c
            WHERE c.usuario_id=e.usuario_id AND c.birth_xid=e.birth_xid
              AND c.rol_anterior='CONTADOR')))
      THEN RAISE EXCEPTION 'E11: anterior no corresponde a historia'; END IF;
    ELSIF j->'anterior' NOT IN ('"F"'::jsonb,'null'::jsonb) THEN
      RAISE EXCEPTION 'E11: primer evento parte de F virtual o rol no contador';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.e11_operaciones op WHERE op.operacion='PERFIL'
      AND op.actor_id=e.actor_id AND op.uuid=e.uuid AND op.respuesta=e.datos AND op.birth_xid=e.birth_xid)
      AND NOT EXISTS (SELECT 1 FROM public.e11_cambios_usuario c
        WHERE c.usuario_id=e.usuario_id AND c.birth_xid=e.birth_xid
          AND j->>'posterior' IS NOT DISTINCT FROM
            CASE WHEN c.rol_posterior='CONTADOR' AND c.activo_posterior THEN 'F' ELSE NULL END)
    THEN RAISE EXCEPTION 'E11: evento sin asignación ADMIN/revocación real'; END IF;
    IF e.revision=1 AND EXISTS (SELECT 1 FROM public.e11_operaciones op
      WHERE op.operacion='PERFIL' AND op.actor_id=e.actor_id AND op.uuid=e.uuid)
      AND j->'anterior' IS DISTINCT FROM '"F"'::jsonb
    THEN RAISE EXCEPTION 'E11: primera asignación parte del default F virtual'; END IF;
  END LOOP;
  FOR a IN SELECT * FROM public.e11_cambios_usuario LOOP
    IF NOT EXISTS (SELECT 1 FROM public.e11_perfil_eventos profile_event WHERE profile_event.usuario_id=a.usuario_id
      AND profile_event.birth_xid=a.birth_xid AND profile_event.datos->>'posterior' IS NOT DISTINCT FROM
        CASE WHEN a.rol_posterior='CONTADOR' AND a.activo_posterior THEN 'F' ELSE NULL END)
    THEN RAISE EXCEPTION 'E11: cambio usuario sin revocación/version nueva'; END IF;
  END LOOP;
  FOR s IN SELECT * FROM public.e11_conciliaciones LOOP
    j:=s.datos; end_date:=public.e11_fin(s.tipo,s.inicio);
    IF NOT public.e11_keys(j,ARRAY['id','uuid','periodo','revision','anteriorId','fuenteRevision',
      'vigente','congeladoEn','actorId','totalFacturado','cantidadVentas','evidenciaHash','decisiones'])
      OR NOT public.e11_keys(j->'periodo',ARRAY['tipo','inicio','finExclusivo','zona','obligatorio','estado','ultimaConciliacionId'])
      OR j->>'id' IS DISTINCT FROM s.id::text OR (j->>'revision')::integer IS DISTINCT FROM s.revision
      OR (j->>'actorId')::integer IS DISTINCT FROM s.actor_id
      OR j->>'anteriorId' IS DISTINCT FROM s.anterior_id::text
      OR j#>>'{periodo,tipo}' IS DISTINCT FROM s.tipo
      OR j#>>'{periodo,inicio}' IS DISTINCT FROM to_char(s.inicio,'YYYY-MM-DD')
      OR j#>>'{periodo,finExclusivo}' IS DISTINCT FROM to_char(end_date,'YYYY-MM-DD')
      OR j#>>'{periodo,zona}' IS DISTINCT FROM 'America/Mexico_City'
      OR (j#>>'{periodo,obligatorio}')::boolean IS DISTINCT FROM (s.tipo<>'DIA')
      OR j#>>'{periodo,estado}' IS DISTINCT FROM 'CONGELADO'
      OR j#>>'{periodo,ultimaConciliacionId}' IS DISTINCT FROM s.id::text
      OR j->'decisiones' IS DISTINCT FROM '[]'::jsonb OR j->'vigente' IS DISTINCT FROM 'true'::jsonb
      OR (s.tipo='SEMANA' AND extract(isodow FROM s.inicio)<>1)
      OR (s.tipo='MES' AND extract(day FROM s.inicio)<>1)
      OR end_date::timestamp AT TIME ZONE 'America/Mexico_City'>(j->>'congeladoEn')::timestamptz
      OR coalesce(j->>'evidenciaHash','') !~ '^[0-9a-f]{64}$'
      OR j->>'fuenteRevision' IS DISTINCT FROM j->>'evidenciaHash'
      OR NOT isfinite((j->>'congeladoEn')::timestamptz)
    THEN RAISE EXCEPTION 'E11: snapshot/calendario/whitelist inválido'; END IF;
    IF s.revision>1 AND NOT EXISTS (SELECT 1 FROM public.e11_conciliaciones parent
      WHERE parent.id=s.anterior_id AND parent.tipo=s.tipo AND parent.inicio=s.inicio AND parent.revision=s.revision-1)
    THEN RAISE EXCEPTION 'E11: revisión sin predecesor exacto'; END IF;
    SELECT coalesce(jsonb_agg(datos ORDER BY venta_id),'[]'::jsonb),count(*),
      coalesce(sum((datos->>'totalFacturado')::numeric),0) INTO rows_json,n,total
      FROM public.e11_conciliacion_ventas WHERE conciliacion_id=s.id;
    IF n IS DISTINCT FROM (j->>'cantidadVentas')::bigint
      OR total IS DISTINCT FROM (j->>'totalFacturado')::numeric
      OR public.e11_hash(rows_json) IS DISTINCT FROM j->>'evidenciaHash'
      OR EXISTS (SELECT 1 FROM public.e11_conciliacion_ventas
        WHERE conciliacion_id=s.id AND birth_xid<>s.birth_xid)
    THEN RAISE EXCEPTION 'E11: snapshot requiere conjunto completo congelado'; END IF;
    IF s.birth_xid=pg_current_xact_id() THEN
      IF end_date::timestamp AT TIME ZONE 'America/Mexico_City'>clock_timestamp()
        OR rows_json IS DISTINCT FROM public.e11_fuente(s.inicio,end_date)
      THEN RAISE EXCEPTION 'E11: periodo abierto/fuente modificada al congelar'; END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.e11_operaciones op WHERE op.actor_id=s.actor_id
      AND op.operacion='SNAPSHOT' AND op.uuid=(j->>'uuid')::uuid AND op.respuesta=j AND op.birth_xid=s.birth_xid)
    THEN RAISE EXCEPTION 'E11: snapshot sin replay propio'; END IF;
  END LOOP;
  FOR a IN SELECT * FROM public.e11_conciliacion_ventas LOOP
    j:=a.datos;
    IF NOT public.e11_keys(j,ARRAY['facturaId','ventaId','folioFactura','cliente','fechaFacturacion','totalFacturado','moneda','estado'])
      OR NOT public.e11_keys(j->'cliente',ARRAY['clienteId','nombre'])
      OR (j->>'ventaId')::integer IS DISTINCT FROM a.venta_id
      OR (j->>'facturaId')::integer IS DISTINCT FROM a.venta_id
      OR j->>'moneda' IS DISTINCT FROM 'MXN' OR j->>'estado' IS DISTINCT FROM 'VIGENTE'
      OR coalesce(j->>'totalFacturado','') !~ '^[0-9]+\.[0-9]{2}$'
    THEN RAISE EXCEPTION 'E11: venta congelada fuera de whitelist'; END IF;
  END LOOP;
  FOR d IN SELECT * FROM public.e11_decisiones LOOP
    SELECT * INTO s FROM public.e11_conciliaciones WHERE id=d.conciliacion_id;
    j:=d.datos;
    IF NOT public.e11_keys(j,ARRAY['id','uuid','actorId','creadoEn','resultado','totalExterno','referenciaExterna','observacion','avisoAdminId'])
      OR (j->>'id')::uuid IS DISTINCT FROM d.id OR (j->>'uuid')::uuid IS DISTINCT FROM d.uuid
      OR (j->>'actorId')::integer IS DISTINCT FROM d.actor_id
      OR coalesce(j->>'resultado','') NOT IN ('ACEPTADA','NO_CUADRA')
      OR coalesce(j->>'totalExterno','') !~ '^[0-9]+\.[0-9]{2}$'
      OR nullif(btrim(j->>'referenciaExterna'),'') IS NULL
      OR (j->>'creadoEn')::timestamptz<(s.datos->>'congeladoEn')::timestamptz
    THEN RAISE EXCEPTION 'E11: decisión inválida'; END IF;
    IF j->>'resultado'='ACEPTADA' THEN
      IF (j->>'totalExterno')::numeric<>(s.datos->>'totalFacturado')::numeric
        OR j->'avisoAdminId' IS DISTINCT FROM 'null'::jsonb
        OR EXISTS(SELECT 1 FROM public.e11_avisos WHERE decision_id=d.id)
      THEN RAISE EXCEPTION 'E11: aceptación no coincide/aviso impropio'; END IF;
    ELSE
      IF nullif(btrim(j->>'observacion'),'') IS NULL OR NOT EXISTS(
        SELECT 1 FROM public.e11_avisos aviso WHERE aviso.id=(j->>'avisoAdminId')::uuid
          AND aviso.decision_id=d.id AND aviso.conciliacion_id=d.conciliacion_id AND aviso.birth_xid=d.birth_xid)
      THEN RAISE EXCEPTION 'E11: discrepancia requiere aviso ADMIN atómico'; END IF;
    END IF;
    IF d.birth_xid=pg_current_xact_id() THEN
      IF EXISTS(SELECT 1 FROM public.e11_conciliaciones later
        WHERE later.tipo=s.tipo AND later.inicio=s.inicio AND later.revision>s.revision)
        OR public.e11_hash(public.e11_fuente(s.inicio,public.e11_fin(s.tipo,s.inicio)))<>s.datos->>'fuenteRevision'
      THEN RAISE EXCEPTION 'E11: decisión obsoleta/FUENTE_CAMBIADA'; END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.e11_operaciones op WHERE op.operacion='DECISION'
      AND op.actor_id=d.actor_id AND op.uuid=d.uuid AND op.birth_xid=d.birth_xid
      AND op.respuesta=jsonb_set(jsonb_set(s.datos,'{decisiones}',jsonb_build_array(d.datos)),
        '{periodo,estado}',d.datos->'resultado'))
    THEN RAISE EXCEPTION 'E11: decisión sin replay propio'; END IF;
  END LOOP;
  FOR a IN SELECT * FROM public.e11_avisos LOOP
    IF NOT EXISTS (SELECT 1 FROM public.e11_decisiones decision_row WHERE decision_row.id=a.decision_id
      AND decision_row.conciliacion_id=a.conciliacion_id AND decision_row.datos->>'resultado'='NO_CUADRA'
      AND decision_row.datos->>'avisoAdminId'=a.id::text AND decision_row.birth_xid=a.birth_xid)
      OR NOT EXISTS (SELECT 1 FROM public.notificaciones_sistema n
        JOIN public.e11_notificacion_origen b ON b.notificacion_id=n.id
        WHERE n.tipo='E11_NO_CUADRA' AND n.entidad='e11_conciliaciones'
          AND n.entidad_id=a.conciliacion_id::text AND n.destinatario_usuario_id IS NULL
          AND n.prioridad='ALTA' AND n.titulo='Conciliación facturada no cuadra'
          AND n.mensaje='Revisar /contabilidad/conciliaciones/'||a.conciliacion_id::text
          AND b.birth_xid=a.birth_xid)
    THEN RAISE EXCEPTION 'E11: aviso/decisión/notificación no coherentes'; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.notificaciones_sistema n WHERE n.tipo='E11_NO_CUADRA'
    AND NOT EXISTS(SELECT 1 FROM public.e11_avisos aviso WHERE aviso.conciliacion_id::text=n.entidad_id))
  THEN RAISE EXCEPTION 'E11: notificación huérfana'; END IF;
  FOR o IN SELECT * FROM public.e11_operaciones LOOP
    IF o.estado='CERRADA_SIN_EFECTO' THEN CONTINUE; END IF;
    IF o.operacion='PERFIL' AND NOT EXISTS(SELECT 1 FROM public.e11_perfil_eventos profile_event
      WHERE profile_event.actor_id=o.actor_id AND profile_event.uuid=o.uuid AND profile_event.datos=o.respuesta AND profile_event.birth_xid=o.birth_xid)
      OR o.operacion='SNAPSHOT' AND NOT EXISTS(SELECT 1 FROM public.e11_conciliaciones snapshot_row
        WHERE snapshot_row.actor_id=o.actor_id AND snapshot_row.datos=o.respuesta AND snapshot_row.birth_xid=o.birth_xid
          AND (snapshot_row.datos->>'uuid')::uuid=o.uuid)
      OR o.operacion='DECISION' AND NOT EXISTS(SELECT 1 FROM public.e11_decisiones decision_row
        WHERE decision_row.actor_id=o.actor_id AND decision_row.uuid=o.uuid AND decision_row.birth_xid=o.birth_xid
          AND o.respuesta->>'id'=decision_row.conciliacion_id::text
          AND o.respuesta->'decisiones'=jsonb_build_array(decision_row.datos))
    THEN RAISE EXCEPTION 'E11: replay sin efecto correspondiente'; END IF;
    IF o.operacion='PREPARACION' THEN
      IF NOT public.e11_keys(o.respuesta,ARRAY['cobroId','clienteId','revision','fuenteRevision','retenido','notas','propuestaId'])
        OR jsonb_typeof(o.respuesta->'notas') IS DISTINCT FROM 'array'
        OR coalesce(o.respuesta->>'retenido','') !~ '^[0-9]+\.[0-9]{2}$'
        OR to_regclass('public.e5_operaciones') IS NULL
      THEN RAISE EXCEPTION 'E11: preparación sin whitelist/dependencia E5'; END IF;
      FOR j IN SELECT value FROM jsonb_array_elements(o.respuesta->'notas') LOOP
        IF NOT public.e11_keys(j,ARRAY['notaId','movimientoVentaId','folio','clienteId','fecha','facturada','total','saldo'])
        THEN RAISE EXCEPTION 'E11: nota de preparación fuera de whitelist'; END IF;
      END LOOP;
      -- Nombres constantes y parámetros USING; E5 alineado es prerrequisito
      -- explícito de esta versión preparada con extensión A.
      EXECUTE $query$
        SELECT EXISTS(SELECT 1 FROM public.e5_operaciones p
          WHERE p.clave=$1 AND p.actor_id=$2 AND p.accion='PROPONER'
            AND p.cobro_id::text=$3->>'cobroId'
            AND p.response->>'clienteId'=$3->>'clienteId'
            AND p.response->>'revision'=$3->>'revision'
            AND p.response->>'importePendiente'=$3->>'retenido'
            AND p.response->>'propuestaVigenteId'=$3->>'propuestaId'
            AND coalesce((p.response->'propuestas'->-1->>'importeFavorPropuesto')::numeric,0)=0
            AND p.birth_xid=$4)
      $query$ INTO linked USING o.uuid,o.actor_id,o.respuesta,o.birth_xid;
      IF NOT linked THEN RAISE EXCEPTION 'E11: replay sin propuesta real E5 propia, sin favor'; END IF;
      IF NOT EXISTS(SELECT 1 FROM public.e11_e5_preparaciones w
        WHERE w.clave=o.uuid AND w.actor_id=o.actor_id AND w.birth_xid=o.birth_xid)
      THEN RAISE EXCEPTION 'E11: preparación sin testigo de actor A al INSERT'; END IF;
    END IF;
  END LOOP;
  FOR a IN SELECT * FROM public.e11_e5_preparaciones LOOP
    SELECT to_jsonb(operation_row) INTO actual FROM public.e5_operaciones operation_row WHERE operation_row.clave=a.clave;
    IF actual IS NULL OR (actual->>'actor_id')::integer IS DISTINCT FROM a.actor_id
      OR (actual->>'cobro_id')::uuid IS DISTINCT FROM a.cobro_id
      OR (actual->>'birth_xid')::xid8 IS DISTINCT FROM a.birth_xid
    THEN RAISE EXCEPTION 'E11/E5: testigo sin operación propia'; END IF;
    -- Probar la historia, NO volver a exigir que el autor siga siendo A.
    -- Autoridad se exigió en e5_insert_authority y e11_e5_capture.
    PERFORM public.e11_e5_a_validate(actual,false);
    j:=(actual->>'content')::jsonb;
    IF split_part(j#>>'{input,evidencia,referencias,0}',':',4)::integer<>a.perfil_version
      OR NOT EXISTS(SELECT 1 FROM public.e11_operaciones op
        WHERE op.operacion='PREPARACION' AND op.actor_id=a.actor_id AND op.uuid=a.clave
          AND op.birth_xid=a.birth_xid
          AND op.respuesta->>'fuenteRevision'=j#>>'{input,versionContexto}'
          AND op.solicitud_hash=public.e11_hash(jsonb_build_object('id',a.cobro_id::text,
            'input',jsonb_build_object('uuid',split_part(j#>>'{input,evidencia,referencias,0}',':',2),'perfilVersion',a.perfil_version,
              'revisionEsperada',(j#>>'{input,revisionEsperada}')::integer,
              'fuenteRevision',j#>>'{input,versionContexto}','asignaciones',j#>'{input,asignaciones}'))))
    THEN RAISE EXCEPTION 'E11/E5: replay propio/versión/cuerpo real no coinciden'; END IF;
  END LOOP;
  RETURN NULL;
END $$;