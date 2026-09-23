-- PREPARADO / NO EJECUTADO. Requiere E1/E2 y E10 instalados.
-- No modifica sesiones, snapshots, salidas, clientes ni saldo inicial Fondo.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE e9_entregas (
  id uuid PRIMARY KEY,
  corte_id integer NOT NULL UNIQUE REFERENCES sesiones_caja(id),
  ubicacion_id integer NOT NULL REFERENCES ubicaciones(id),
  revision integer NOT NULL CHECK (revision>0),
  detail jsonb NOT NULL CHECK (jsonb_typeof(detail)='object'),
  movimiento_fondo_id uuid GENERATED ALWAYS AS ((detail#>>'{fondo,movimientoId}')::uuid) STORED UNIQUE REFERENCES fondo_movimientos(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE e9_operaciones (
  clave uuid PRIMARY KEY,
  entrega_id uuid NOT NULL REFERENCES e9_entregas(id),
  revision integer NOT NULL CHECK (revision>0),
  actor_id integer NOT NULL REFERENCES usuarios(id),
  accion text NOT NULL CHECK (accion IN ('ENVIAR','CONTAR','AUTORIZAR','CERRAR')),
  content text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entrega_id,revision)
);
CREATE INDEX e9_ubicacion_idx ON e9_entregas(ubicacion_id,id);
CREATE FUNCTION e9_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'E9: evidencia inmutable; prohibido borrar, truncar o editar historial'; END; $$;
CREATE TRIGGER e9_no_delete BEFORE DELETE ON e9_entregas FOR EACH ROW EXECUTE FUNCTION e9_immutable();
CREATE TRIGGER e9_no_truncate BEFORE TRUNCATE ON e9_entregas FOR EACH STATEMENT EXECUTE FUNCTION e9_immutable();
CREATE TRIGGER e9_operations_immutable BEFORE UPDATE OR DELETE ON e9_operaciones FOR EACH ROW EXECUTE FUNCTION e9_immutable();
CREATE TRIGGER e9_operations_no_truncate BEFORE TRUNCATE ON e9_operaciones FOR EACH STATEMENT EXECUTE FUNCTION e9_immutable();
CREATE FUNCTION e9_evidence_valid(value jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(jsonb_typeof(value)='object'
    AND jsonb_typeof(value->'descripcion')='string'
    AND length(btrim(value->>'descripcion')) BETWEEN 1 AND 2000
    AND jsonb_typeof(value->'referencias')='array',false)
$$;
CREATE FUNCTION e9_validate_detail() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  d jsonb := NEW.detail;
  oldd jsonb;
  n integer;
  c jsonb;
  s sesiones_caja%ROWTYPE;
  f fondo_movimientos%ROWTYPE;
  snapshots integer;
  counted numeric;
  role_value text;
  site integer;
BEGIN
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
    THEN RAISE EXCEPTION 'E9: autorización requiere conteo vigente sin alterar historia'; END IF;
    c := oldd->'conteos'->(n-1);
    IF (c->>'importeRecibido')::numeric<=0
      OR d#>>'{autorizacion,importeRecibido}' IS DISTINCT FROM c->>'importeRecibido'
      OR NOT EXISTS (SELECT 1 FROM usuarios WHERE id=(d#>>'{autorizacion,actor,id}')::integer AND rol::text='ADMIN')
      OR ((c->>'diferencia')::numeric<>0 AND nullif(btrim(d#>>'{autorizacion,motivo}'),'') IS NULL)
    THEN RAISE EXCEPTION 'E9: recepción positiva ADMIN y motivada requerida'; END IF;
    SELECT * INTO STRICT f FROM fondo_movimientos WHERE id=(d#>>'{fondo,movimientoId}')::uuid;
    IF f.naturaleza<>'INGRESO' OR f.categoria<>'OTRO_INGRESO' OR f.original_id IS NOT NULL
      OR f.importe_centavos IS DISTINCT FROM ((c->>'importeRecibido')::numeric*100)::bigint
      OR f.autor_id IS DISTINCT FROM (d#>>'{autorizacion,actor,id}')::integer
      OR f.motivo IS DISTINCT FROM format('Recepción E9 %s; corte %s; tienda %s',NEW.id,NEW.corte_id,NEW.ubicacion_id)
    THEN RAISE EXCEPTION 'E9: ingreso único exacto y ligado al origen requerido'; END IF;
  ELSIF oldd->>'estado'='AUTORIZADA' AND d->>'estado'='AUTORIZADA' THEN
    IF (d-'investigacion') IS DISTINCT FROM (oldd-'investigacion')
      OR coalesce(oldd#>>'{investigacion,estado}','')<>'ABIERTA'
      OR coalesce(d#>>'{investigacion,estado}','')<>'CERRADA_DOCUMENTAL'
      OR (d->'investigacion'-ARRAY['estado','cierre']) IS DISTINCT FROM (oldd->'investigacion'-ARRAY['estado','cierre'])
      OR nullif(btrim(d#>>'{investigacion,cierre,conclusion}'),'') IS NULL
      OR NOT e9_evidence_valid(d#>'{investigacion,cierre,evidencia}')
      OR NOT EXISTS (SELECT 1 FROM usuarios WHERE id=(d#>>'{investigacion,cierre,actor,id}')::integer AND rol::text='ADMIN')
    THEN RAISE EXCEPTION 'E9: cierre documental sin cambios financieros requerido'; END IF;
  ELSE RAISE EXCEPTION 'E9: transición no permitida'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER e9_detail_guard BEFORE INSERT OR UPDATE ON e9_entregas FOR EACH ROW EXECUTE FUNCTION e9_validate_detail();
CREATE FUNCTION e9_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM e9_operaciones WHERE entrega_id=NEW.id AND revision=NEW.revision AND response=NEW.detail)
  THEN RAISE EXCEPTION 'E9: falta operación inmutable de esta revisión'; END IF;
  RETURN NEW;
END; $$;
CREATE CONSTRAINT TRIGGER e9_event_required AFTER INSERT OR UPDATE ON e9_entregas
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION e9_event_guard();
CREATE FUNCTION e9_operation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM e9_entregas WHERE id=NEW.entrega_id AND revision=NEW.revision AND detail=NEW.response)
    OR NOT EXISTS (SELECT 1 FROM usuarios WHERE id=NEW.actor_id AND
      (rol::text='ADMIN' OR (rol::text='SUPERVISOR' AND NEW.accion='ENVIAR' AND ubicacion_id=(NEW.response->>'ubicacionId')::integer)))
    OR NEW.content::jsonb->>'action' IS DISTINCT FROM NEW.accion
    OR NOT coalesce(CASE NEW.accion
      WHEN 'ENVIAR' THEN NEW.revision=1 AND NEW.response->>'estado'='ENVIADA'
        AND (NEW.response#>>'{enviadoPor,id}')::integer=NEW.actor_id
      WHEN 'CONTAR' THEN NEW.response->>'estado'='CONTADA'
        AND (NEW.response->'conteos'->(jsonb_array_length(NEW.response->'conteos')-1)#>>'{actor,id}')::integer=NEW.actor_id
      WHEN 'AUTORIZAR' THEN NEW.response->>'estado'='AUTORIZADA'
        AND (NEW.response#>>'{autorizacion,actor,id}')::integer=NEW.actor_id
      WHEN 'CERRAR' THEN NEW.response#>>'{investigacion,estado}'='CERRADA_DOCUMENTAL'
        AND (NEW.response#>>'{investigacion,cierre,actor,id}')::integer=NEW.actor_id
      ELSE false END,false)
  THEN RAISE EXCEPTION 'E9: operación no corresponde a revisión y actor autorizado'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER e9_operation_valid BEFORE INSERT ON e9_operaciones FOR EACH ROW EXECUTE FUNCTION e9_operation_guard();
CREATE FUNCTION e9_fondo_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.original_id IS NOT NULL AND EXISTS (SELECT 1 FROM e9_entregas WHERE movimiento_fondo_id=NEW.original_id)
  THEN RAISE EXCEPTION 'E9: recepción inmutable; inverso independiente prohibido'; END IF;
  IF NEW.original_id IS NULL AND NEW.motivo LIKE 'Recepción E9 %'
    AND NOT EXISTS (SELECT 1 FROM e9_entregas WHERE movimiento_fondo_id=NEW.id)
  THEN RAISE EXCEPTION 'E9: ingreso huérfano sin recepción autorizada'; END IF;
  RETURN NEW;
END; $$;
CREATE CONSTRAINT TRIGGER e9_fondo_receipt AFTER INSERT ON fondo_movimientos
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION e9_fondo_guard();
COMMIT;