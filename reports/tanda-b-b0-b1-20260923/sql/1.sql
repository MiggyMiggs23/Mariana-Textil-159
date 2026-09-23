-- E4 PREPARADO. NO EJECUTADO. Aplicar únicamente con autorización posterior.
-- No cambia datos históricos, permisos, productores E2/E3, Fondo ni enum existente.
BEGIN;
CREATE TABLE caja_salidas_e4 (
  salida_id integer PRIMARY KEY REFERENCES salidas_dinero_caja(id),
  revision jsonb NOT NULL,
  CONSTRAINT caja_salidas_e4_shape CHECK ((
    jsonb_typeof(revision) = 'object'
    AND revision ?& ARRAY['tipo','estado','version','claveOperacion','historial']
    AND revision->>'tipo' IN ('EXTRAORDINARIA','PROVEEDOR')
    AND revision->>'estado' IN ('PENDIENTE','RECLAMADA','RESPONDIDA','ACEPTADA','NO_APLICA')
    AND jsonb_typeof(revision->'version') = 'number'
    AND (revision->>'version')::integer >= 0
    AND jsonb_typeof(revision->'historial') = 'array'
    AND jsonb_array_length(revision->'historial') = (revision->>'version')::integer
    AND revision->>'claveOperacion' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND ((revision->>'tipo' = 'PROVEEDOR' AND revision->>'estado' = 'NO_APLICA'
      AND (revision->>'version')::integer = 0)
      OR (revision->>'tipo' = 'EXTRAORDINARIA' AND revision->>'estado' <> 'NO_APLICA'))
  ) IS TRUE)
);
CREATE UNIQUE INDEX caja_salidas_e4_clave_idx ON caja_salidas_e4 ((revision->>'claveOperacion'));
CREATE TABLE caja_salidas_e4_operaciones (
  clave uuid PRIMARY KEY,
  salida_id integer NOT NULL REFERENCES caja_salidas_e4(salida_id),
  actor_id integer NOT NULL REFERENCES usuarios(id),
  request text NOT NULL CHECK (length(request) > 0),
  response jsonb NOT NULL CHECK (jsonb_typeof(response) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX caja_salidas_e4_operaciones_salida_idx ON caja_salidas_e4_operaciones(salida_id);

CREATE FUNCTION caja_salidas_e4_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expense record; next_event jsonb; v integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'E4: no se elimina evidencia de egreso';
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT s.*, c.ubicacion_id, c.estado AS sesion_estado, u.tipo AS sitio_tipo, u.activa AS sitio_activo
      INTO STRICT expense FROM salidas_dinero_caja s
      JOIN sesiones_caja c ON c.id = s.sesion_caja_id
      JOIN ubicaciones u ON u.id = c.ubicacion_id WHERE s.id = NEW.salida_id;
    IF expense.sesion_estado <> 'ABIERTA' OR expense.sitio_tipo <> 'TIENDA' OR NOT expense.sitio_activo THEN
      RAISE EXCEPTION 'E4: sesión abierta de tienda requerida';
    END IF;
    IF (NEW.revision->>'version')::integer <> 0
      OR jsonb_array_length(NEW.revision->'historial') <> 0 THEN
      RAISE EXCEPTION 'E4: revisión inicial inválida';
    END IF;
    IF NEW.revision->>'tipo' = 'EXTRAORDINARIA' THEN
      IF expense.cuenta_origen <> 'CAJA_FISICA' OR expense.proveedor_id IS NOT NULL
        OR NEW.revision->>'estado' <> 'PENDIENTE' THEN
        RAISE EXCEPTION 'E4: extraordinaria exige caja física sin proveedor';
      END IF;
    ELSIF NEW.revision->>'tipo' = 'PROVEEDOR' THEN
      -- MARIANA_LOCATION_ID = 1, también en lib/pos.ts y e4-cash-out.ts.
      IF expense.ubicacion_id <> 1 OR expense.proveedor_id IS NULL
        OR NOT EXISTS (SELECT 1 FROM proveedores WHERE id = expense.proveedor_id AND activo) THEN
        RAISE EXCEPTION 'E4: proveedor activo exclusivamente en Mariana';
      END IF;
    END IF;
  ELSE
    v := (OLD.revision->>'version')::integer;
    IF NEW.salida_id <> OLD.salida_id
      OR NEW.revision->>'tipo' IS DISTINCT FROM OLD.revision->>'tipo'
      OR NEW.revision->>'claveOperacion' IS DISTINCT FROM OLD.revision->>'claveOperacion'
      OR OLD.revision->>'tipo' <> 'EXTRAORDINARIA'
      OR (NEW.revision->>'version')::integer <> v + 1
      OR (NEW.revision->'historial') - v IS DISTINCT FROM OLD.revision->'historial' THEN
      RAISE EXCEPTION 'E4: identidad/historial de egreso inmutable';
    END IF;
    next_event := NEW.revision->'historial'->v;
    IF (next_event->>'version')::integer IS DISTINCT FROM v + 1 THEN
      RAISE EXCEPTION 'E4: versión de evento inválida';
    END IF;
    IF NOT (
      (OLD.revision->>'estado' IN ('PENDIENTE','RESPONDIDA')
        AND ((next_event->>'accion' = 'ACEPTAR' AND NEW.revision->>'estado' = 'ACEPTADA')
          OR (next_event->>'accion' = 'RECLAMAR' AND NEW.revision->>'estado' = 'RECLAMADA')))
      OR (OLD.revision->>'estado' = 'RECLAMADA' AND next_event->>'accion' = 'RESPONDER'
        AND NEW.revision->>'estado' = 'RESPONDIDA')
    ) IS TRUE THEN
      RAISE EXCEPTION 'E4: transición inválida';
    END IF;
    IF next_event->>'accion' IN ('RECLAMAR','RESPONDER')
      AND NOT (length(trim(next_event->>'explicacion')) BETWEEN 1 AND 2000) IS TRUE THEN
      RAISE EXCEPTION 'E4: explicación obligatoria';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER caja_salidas_e4_guard_trg BEFORE INSERT OR UPDATE OR DELETE ON caja_salidas_e4
  FOR EACH ROW EXECUTE FUNCTION caja_salidas_e4_guard();

CREATE FUNCTION caja_salidas_e4_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'E4: operación idempotente inmutable';
END $$;
CREATE TRIGGER caja_salidas_e4_operaciones_immutable_trg
  BEFORE UPDATE OR DELETE ON caja_salidas_e4_operaciones
  FOR EACH ROW EXECUTE FUNCTION caja_salidas_e4_immutable();

CREATE FUNCTION caja_salidas_e4_expense_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM caja_salidas_e4 WHERE salida_id = OLD.id) THEN
    RAISE EXCEPTION 'E4: el egreso físico no se modifica ni se elimina por revisión';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER caja_salidas_e4_expense_guard_trg BEFORE UPDATE OR DELETE ON salidas_dinero_caja
  FOR EACH ROW EXECUTE FUNCTION caja_salidas_e4_expense_guard();
COMMIT;