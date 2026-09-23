-- PREPARADO / NO EJECUTADO.
-- Cambio mínimo posterior a la instalación de Tanda B:
-- E9 autoriza custodia documental sin crear ingreso en Fondo.
BEGIN;
SET LOCAL lock_timeout='5s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM e9_entregas WHERE detail ? 'fondo') THEN
    RAISE EXCEPTION 'E9: existen recepciones históricas ligadas a Fondo; detener y revisar';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION e9_validate_detail() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  d jsonb := NEW.detail;
  oldd jsonb;
  n integer;
  c jsonb;
  s sesiones_caja%ROWTYPE;
  snapshots integer;
  counted numeric;
  role_value text;
  site integer;
BEGIN
  IF d ? 'fondo' THEN
    RAISE EXCEPTION 'E9: el ingreso al Fondo permanece cerrado';
  END IF;
  IF d->>'id' IS DISTINCT FROM NEW.id::text OR (d->>'corteId')::integer IS DISTINCT FROM NEW.corte_id
    OR (d->>'ubicacionId')::integer IS DISTINCT FROM NEW.ubicacion_id
    OR coalesce(d->>'importeEnviado','') !~ '^(0|[1-9][0-9]*)\.[0-9]{2}$'
    OR (d->>'importeEnviado')::numeric<=0
    OR jsonb_typeof(d->'conteos') IS DISTINCT FROM 'array'
    OR coalesce(d->>'estado','') NOT IN ('ENVIADA','CONTADA','AUTORIZADA')
    OR NOT e9_evidence_valid(d->'evidenciaEnvio')
  THEN RAISE EXCEPTION 'E9: estructura inválida'; END IF;
  n := jsonb_array_length(d->'conteos');
  IF TG_OP='INSERT' THEN
    SELECT * INTO STRICT s FROM sesiones_caja WHERE id=NEW.corte_id FOR UPDATE;
    IF s.estado::text<>'CERRADA' OR s.cerrada_at IS NULL OR s.ubicacion_id<>NEW.ubicacion_id
      OR NOT EXISTS (SELECT 1 FROM ubicaciones WHERE id=s.ubicacion_id AND tipo::text='TIENDA' AND activa)
    THEN RAISE EXCEPTION 'E9: cierre de tienda requerido'; END IF;
    SELECT count(*),min((datos_despues#>>'{cashSnapshot,efectivoContado}')::numeric)
      INTO snapshots,counted FROM auditoria WHERE accion='CERRAR_CAJA' AND entidad='sesiones_caja'
      AND entidad_id=s.id::text AND datos_despues ? 'cashSnapshot';
    IF snapshots<>1 OR counted IS DISTINCT FROM s.efectivo_contado OR counted IS DISTINCT FROM (d->>'importeEnviado')::numeric
      OR NOT EXISTS (SELECT 1 FROM auditoria WHERE accion='CERRAR_CAJA' AND entidad='sesiones_caja'
        AND entidad_id=s.id::text AND datos_despues#>>'{cashSnapshot,version}'='E2'
        AND (datos_despues#>>'{cashSnapshot,sesionId}')::integer=s.id)
      OR coalesce(d->>'versionCorte','') !~ '^e9:v1:[0-9a-f]{64}$'
      OR (d->>'fechaCorte')::timestamptz IS DISTINCT FROM s.cerrada_at
      OR d->>'fechaOperativa' IS DISTINCT FROM s.fecha_operativa::text
    THEN RAISE EXCEPTION 'E9: falta evidencia congelada canónica'; END IF;
    SELECT rol::text,ubicacion_id INTO role_value,site FROM usuarios WHERE id=(d#>>'{enviadoPor,id}')::integer;
    IF role_value IS NULL OR role_value NOT IN ('ADMIN','SUPERVISOR')
      OR (role_value='SUPERVISOR' AND site IS DISTINCT FROM NEW.ubicacion_id)
      OR NEW.revision<>1 OR n<>0 OR d->>'estado'<>'ENVIADA'
      OR d ?| ARRAY['autorizacion','fondo','investigacion','conteoVigenteId']
    THEN RAISE EXCEPTION 'E9: envío completo inicial inválido'; END IF;
    RETURN NEW;
  END IF;
  oldd := OLD.detail;
  IF NEW.id<>OLD.id OR NEW.corte_id<>OLD.corte_id OR NEW.ubicacion_id<>OLD.ubicacion_id
    OR NEW.created_at<>OLD.created_at OR NEW.revision<>OLD.revision+1
    OR (d-ARRAY['conteos','conteoVigenteId','estado','autorizacion','fondo','investigacion'])
      IS DISTINCT FROM (oldd-ARRAY['conteos','conteoVigenteId','estado','autorizacion','fondo','investigacion'])
  THEN RAISE EXCEPTION 'E9: origen e importe enviados son inmutables'; END IF;
  IF d->>'estado'='CONTADA' AND oldd->>'estado' IN ('ENVIADA','CONTADA') THEN
    IF n<>jsonb_array_length(oldd->'conteos')+1
      OR ((d->'conteos')-(n-1)) IS DISTINCT FROM oldd->'conteos'
      OR d ?| ARRAY['fondo','autorizacion']
    THEN RAISE EXCEPTION 'E9: conteos anteriores inmutables'; END IF;
    c := d->'conteos'->(n-1);
    IF NOT e9_evidence_valid(c->'evidencia') OR d->>'conteoVigenteId' IS DISTINCT FROM c->>'id'
      OR coalesce(c->>'importeRecibido','') !~ '^(0|[1-9][0-9]*)\.[0-9]{2}$'
      OR (c->>'diferencia')::numeric IS DISTINCT FROM ((c->>'importeRecibido')::numeric-(d->>'importeEnviado')::numeric)
      OR NOT EXISTS (SELECT 1 FROM usuarios WHERE id=(c#>>'{actor,id}')::integer AND rol::text='ADMIN')
      OR (oldd ? 'investigacion' AND d->'investigacion' IS DISTINCT FROM oldd->'investigacion')
      OR ((c->>'diferencia')::numeric<>0 AND coalesce(d#>>'{investigacion,estado}','')<>'ABIERTA')
    THEN RAISE EXCEPTION 'E9: conteo o investigación inválidos'; END IF;
  ELSIF d->>'estado'='AUTORIZADA' AND oldd->>'estado'='CONTADA' THEN
    IF d->'conteos' IS DISTINCT FROM oldd->'conteos'
      OR d->'conteoVigenteId' IS DISTINCT FROM oldd->'conteoVigenteId'
      OR d->'investigacion' IS DISTINCT FROM oldd->'investigacion'
      OR d#>>'{autorizacion,conteoId}' IS DISTINCT FROM oldd->>'conteoVigenteId'
      OR d ? 'fondo'
    THEN RAISE EXCEPTION 'E9: autorización requiere conteo vigente sin alterar historia'; END IF;
    c := oldd->'conteos'->(n-1);
    IF (c->>'importeRecibido')::numeric<=0
      OR d#>>'{autorizacion,importeRecibido}' IS DISTINCT FROM c->>'importeRecibido'
      OR NOT EXISTS (SELECT 1 FROM usuarios WHERE id=(d#>>'{autorizacion,actor,id}')::integer AND rol::text='ADMIN')
      OR ((c->>'diferencia')::numeric<>0 AND nullif(btrim(d#>>'{autorizacion,motivo}'),'') IS NULL)
    THEN RAISE EXCEPTION 'E9: recepción positiva ADMIN y motivada requerida'; END IF;
  ELSIF oldd->>'estado'='AUTORIZADA' AND d->>'estado'='AUTORIZADA' THEN
    IF (d-'investigacion') IS DISTINCT FROM (oldd-'investigacion')
      OR coalesce(oldd#>>'{investigacion,estado}','')<>'ABIERTA'
      OR coalesce(d#>>'{investigacion,estado}','')<>'CERRADA_DOCUMENTAL'
      -- Parentheses are required: without them PostgreSQL resolves the key
      -- literal `investigacion` as the jsonb operand of jsonb - text[].
      OR ((d->'investigacion')-ARRAY['estado','cierre']) IS DISTINCT FROM ((oldd->'investigacion')-ARRAY['estado','cierre'])
      OR nullif(btrim(d#>>'{investigacion,cierre,conclusion}'),'') IS NULL
      OR NOT e9_evidence_valid(d#>'{investigacion,cierre,evidencia}')
      OR NOT EXISTS (SELECT 1 FROM usuarios WHERE id=(d#>>'{investigacion,cierre,actor,id}')::integer AND rol::text='ADMIN')
    THEN RAISE EXCEPTION 'E9: cierre documental sin cambios financieros requerido'; END IF;
  ELSE RAISE EXCEPTION 'E9: transición no permitida'; END IF;
  RETURN NEW;
END; $$;

COMMIT;