-- E12 PREPARADO, NO EJECUTADO. Requiere autorización posterior independiente.
-- Dependencias DDL: E1/E2 cash evidence/snapshot + ledger proveedor y aplicaciones
-- vigentes, reports/tanda-b-20260922/e4/01-preparado.sql, E10 operativo YA preparado/
-- instalado según su evidencia (NO repetirlo). No modifica gates ni filas previas.
-- Toda escritura de pago, fuentes, aplicación y auditoría pertenece a UNA tx API.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE dependency text;
BEGIN
  FOREACH dependency IN ARRAY ARRAY['pagos_proveedor','aplicaciones_pago_proveedor',
    'sesiones_caja','salidas_dinero_caja','caja_salidas_e4','fondo_movimientos',
    'fondo_mariana','solicitudes_pago_dirigido','auditoria','usuarios']
  LOOP
    IF to_regclass(dependency) IS NULL THEN RAISE EXCEPTION 'E12 dependencia ausente: %',dependency; END IF;
  END LOOP;
END $$;

CREATE TABLE proveedor_operaciones_e12 (
  clave uuid PRIMARY KEY,
  actor_id integer NOT NULL REFERENCES usuarios(id),
  contenido text NOT NULL CHECK (length(contenido)>0),
  resultado jsonb NOT NULL CHECK (jsonb_typeof(resultado)='object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE proveedor_solicitudes_e12 (
  solicitud_id integer PRIMARY KEY REFERENCES solicitudes_pago_dirigido(id),
  clave uuid NOT NULL UNIQUE,
  actor_id integer NOT NULL REFERENCES usuarios(id),
  contenido text NOT NULL CHECK (length(contenido)>0),
  origen jsonb NOT NULL CHECK ((jsonb_typeof(origen)='object'
    AND origen ?& ARRAY['claveOperacion','caja']) IS TRUE),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE caja_retornos_proveedor_e12 (
  id serial PRIMARY KEY,
  sesion_caja_id integer NOT NULL REFERENCES sesiones_caja(id),
  pago_proveedor_id integer NOT NULL UNIQUE REFERENCES pagos_proveedor(id),
  importe numeric(12,2) NOT NULL CHECK (importe>0),
  naturaleza text NOT NULL CHECK (naturaleza IN ('CORRECCION_CAPTURA','RECUPERACION_EFECTIVO')),
  usuario_id integer NOT NULL REFERENCES usuarios(id),
  motivo text NOT NULL CHECK (char_length(btrim(motivo)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX caja_retornos_proveedor_e12_sesion_idx ON caja_retornos_proveedor_e12(sesion_caja_id);
CREATE TABLE proveedor_efectivo_e12 (
  pago_proveedor_id integer PRIMARY KEY REFERENCES pagos_proveedor(id),
  salida_caja_id integer UNIQUE REFERENCES salidas_dinero_caja(id),
  movimiento_fondo_id uuid UNIQUE REFERENCES fondo_movimientos(id),
  detail jsonb NOT NULL,
  retorno jsonb,
  reverso_proveedor_id integer GENERATED ALWAYS AS ((retorno->>'reversoProveedorId')::integer) STORED UNIQUE REFERENCES pagos_proveedor(id),
  ingreso_caja_id integer GENERATED ALWAYS AS ((retorno->>'ingresoCajaId')::integer) STORED UNIQUE REFERENCES caja_retornos_proveedor_e12(id),
  retorno_fondo_id uuid GENERATED ALWAYS AS ((retorno->>'movimientoFondoId')::uuid) STORED UNIQUE REFERENCES fondo_movimientos(id),
  CONSTRAINT proveedor_efectivo_e12_shape CHECK ((
    jsonb_typeof(detail)='object'
    AND detail ?& ARRAY['claveOperacion','pagoProveedorId','total','caja','fondo','sesionCajaId','salidaCajaId','movimientoFondoId','createdAt','desbloqueoCaja','retorno']
    AND (detail->>'pagoProveedorId')::integer=pago_proveedor_id
    AND (detail->>'total')::numeric>0
    AND (detail->>'caja')::numeric>=0 AND (detail->>'fondo')::numeric>=0
    AND (detail->>'caja')::numeric+(detail->>'fondo')::numeric=(detail->>'total')::numeric
    AND (((detail->>'caja')::numeric>0)=(salida_caja_id IS NOT NULL))
    AND (((detail->>'fondo')::numeric>0)=(movimiento_fondo_id IS NOT NULL))
    AND (detail->>'salidaCajaId')::integer IS NOT DISTINCT FROM salida_caja_id
    AND (detail->>'movimientoFondoId')::uuid IS NOT DISTINCT FROM movimiento_fondo_id
    AND detail->'retorno'='null'::jsonb
  ) IS TRUE),
  CONSTRAINT proveedor_efectivo_e12_retorno CHECK (retorno IS NULL OR (
    jsonb_typeof(retorno)='object'
    AND retorno ?& ARRAY['claveOperacion','naturaleza','motivo','reversoProveedorId','caja','fondo','sesionCajaId','ingresoCajaId','movimientoFondoId','createdAt']
    AND retorno->>'naturaleza' IN ('CORRECCION_CAPTURA','RECUPERACION_EFECTIVO')
    AND char_length(btrim(retorno->>'motivo')) BETWEEN 1 AND 1000
    AND retorno->>'caja'=detail->>'caja' AND retorno->>'fondo'=detail->>'fondo'
    AND (((detail->>'caja')::numeric>0)=((retorno->>'ingresoCajaId') IS NOT NULL))
    AND (((detail->>'fondo')::numeric>0)=((retorno->>'movimientoFondoId') IS NOT NULL))
    AND (retorno->>'reversoProveedorId')::integer>0
  ) IS TRUE)
);
CREATE TABLE caja_desbloqueos_e12 (
  salida_id integer PRIMARY KEY REFERENCES salidas_dinero_caja(id),
  evidencia jsonb NOT NULL CHECK ((
    jsonb_typeof(evidencia)='object'
    AND evidencia ?& ARRAY['motivo','usuarioId','createdAt','saldoAntes','egreso']
    AND char_length(btrim(evidencia->>'motivo')) BETWEEN 1 AND 1000
    AND (evidencia->>'saldoAntes')::numeric<(evidencia->>'egreso')::numeric
  ) IS TRUE)
);

CREATE FUNCTION e12_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'E12: evidencia inmutable; no se borra ni reescribe'; END $$;
CREATE FUNCTION e12_pago_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE payment record; expense record; fund record; recovered record;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'E12: no borrar pago/fuentes'; END IF;
  IF TG_OP='UPDATE' AND (
    NEW.pago_proveedor_id<>OLD.pago_proveedor_id OR NEW.detail<>OLD.detail OR
    NEW.salida_caja_id IS DISTINCT FROM OLD.salida_caja_id OR
    NEW.movimiento_fondo_id IS DISTINCT FROM OLD.movimiento_fondo_id OR
    OLD.retorno IS NOT NULL OR NEW.retorno IS NULL
  ) THEN RAISE EXCEPTION 'E12: solo se añade un retorno completo único'; END IF;
  SELECT * INTO STRICT payment FROM pagos_proveedor WHERE id=NEW.pago_proveedor_id;
  IF payment.tipo<>'PAGO' OR payment.forma_pago<>'EFECTIVO'
    OR -payment.importe<>(NEW.detail->>'total')::numeric THEN RAISE EXCEPTION 'E12: pago financiero incoherente'; END IF;
  IF NEW.salida_caja_id IS NOT NULL THEN
    SELECT s.*,c.ubicacion_id INTO STRICT expense FROM salidas_dinero_caja s
      JOIN sesiones_caja c ON c.id=s.sesion_caja_id WHERE s.id=NEW.salida_caja_id;
    IF expense.monto<>(NEW.detail->>'caja')::numeric OR expense.cuenta_origen<>'CAJA_FISICA'
      OR expense.proveedor_id<>payment.proveedor_id OR expense.ubicacion_id<>1
      OR expense.sesion_caja_id<>(NEW.detail->>'sesionCajaId')::integer
      THEN RAISE EXCEPTION 'E12: tramo caja incoherente'; END IF;
  END IF;
  IF NEW.movimiento_fondo_id IS NOT NULL THEN
    SELECT * INTO STRICT fund FROM fondo_movimientos WHERE id=NEW.movimiento_fondo_id;
    IF fund.naturaleza<>'RETIRO' OR fund.original_id IS NOT NULL
      OR fund.importe_centavos<>100*(NEW.detail->>'fondo')::numeric
      THEN RAISE EXCEPTION 'E12: retiro Fondo incoherente'; END IF;
    IF TG_OP='INSERT' AND NOT EXISTS (SELECT 1 FROM usuarios WHERE id=payment.usuario_id AND rol='ADMIN')
      THEN RAISE EXCEPTION 'E12: Fondo exclusivo ADMIN'; END IF;
  END IF;
  IF NEW.retorno IS NOT NULL THEN
    SELECT * INTO STRICT recovered FROM pagos_proveedor WHERE id=(NEW.retorno->>'reversoProveedorId')::integer;
    IF recovered.tipo<>'REVERSO' OR recovered.movimiento_origen_id<>payment.id
      OR recovered.importe<>-payment.importe THEN RAISE EXCEPTION 'E12: reverso proveedor incoherente'; END IF;
    IF NEW.salida_caja_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM caja_retornos_proveedor_e12 r JOIN sesiones_caja c ON c.id=r.sesion_caja_id
      WHERE r.id=(NEW.retorno->>'ingresoCajaId')::integer AND r.pago_proveedor_id=payment.id
        AND r.importe=(NEW.detail->>'caja')::numeric AND c.ubicacion_id=1 AND c.estado='ABIERTA'
        AND r.naturaleza=NEW.retorno->>'naturaleza'
        AND r.sesion_caja_id=(NEW.retorno->>'sesionCajaId')::integer
    ) THEN RAISE EXCEPTION 'E12: retorno caja exacto en sesión Mariana abierta requerido'; END IF;
    IF NEW.movimiento_fondo_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM fondo_movimientos f JOIN usuarios u ON u.id=f.autor_id
      WHERE f.id=(NEW.retorno->>'movimientoFondoId')::uuid AND f.naturaleza='INGRESO'
        AND f.importe_centavos=100*(NEW.detail->>'fondo')::numeric AND u.rol='ADMIN'
        AND ((NEW.retorno->>'naturaleza'='CORRECCION_CAPTURA' AND f.original_id=NEW.movimiento_fondo_id)
          OR (NEW.retorno->>'naturaleza'='RECUPERACION_EFECTIVO' AND f.original_id IS NULL AND f.categoria='OTRO_INGRESO'))
    ) THEN RAISE EXCEPTION 'E12: retorno Fondo exacto requerido'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER proveedor_efectivo_e12_guard BEFORE INSERT OR UPDATE OR DELETE
  ON proveedor_efectivo_e12 FOR EACH ROW EXECUTE FUNCTION e12_pago_guard();

CREATE FUNCTION e12_override_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM usuarios u JOIN salidas_dinero_caja s ON s.id=NEW.salida_id
    WHERE u.id=(NEW.evidencia->>'usuarioId')::integer AND u.rol='ADMIN'
      AND s.creado_por_id=u.id AND s.cuenta_origen='CAJA_FISICA' AND s.monto=(NEW.evidencia->>'egreso')::numeric)
  THEN RAISE EXCEPTION 'E12: desbloqueo ADMIN motivado de esta salida requerido'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER caja_desbloqueos_e12_actor BEFORE INSERT ON caja_desbloqueos_e12
  FOR EACH ROW EXECUTE FUNCTION e12_override_guard();

-- Defensa diferida: ni la ruta legacy de reverso ni el inverso genérico E10
-- pueden devolver solo un ledger de un pago integrado, incluso al apagar UI.
CREATE FUNCTION e12_inverse_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE linked record;
BEGIN
  IF TG_TABLE_NAME='pagos_proveedor' THEN
    IF NEW.tipo='REVERSO' THEN
      SELECT * INTO linked FROM proveedor_efectivo_e12 WHERE pago_proveedor_id=NEW.movimiento_origen_id;
      IF FOUND AND (linked.retorno->>'reversoProveedorId')::integer IS DISTINCT FROM NEW.id
        THEN RAISE EXCEPTION 'E12: reverso exige retorno completo atómico'; END IF;
    END IF;
  ELSIF NEW.original_id IS NOT NULL THEN
    SELECT * INTO linked FROM proveedor_efectivo_e12
      WHERE movimiento_fondo_id=NEW.original_id OR retorno_fondo_id=NEW.original_id;
    IF FOUND AND (linked.retorno_fondo_id IS DISTINCT FROM NEW.id OR linked.movimiento_fondo_id<>NEW.original_id)
      THEN RAISE EXCEPTION 'E12: use retorno proveedor, no inverso Fondo independiente'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER e12_supplier_inverse AFTER INSERT ON pagos_proveedor
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION e12_inverse_guard();
CREATE CONSTRAINT TRIGGER e12_fund_inverse AFTER INSERT ON fondo_movimientos
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION e12_inverse_guard();
CREATE FUNCTION e12_cash_return_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM proveedor_efectivo_e12
    WHERE pago_proveedor_id=NEW.pago_proveedor_id AND ingreso_caja_id=NEW.id)
  THEN RAISE EXCEPTION 'E12: ingreso caja sin retorno proveedor completo'; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER e12_cash_return AFTER INSERT ON caja_retornos_proveedor_e12
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION e12_cash_return_guard();
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['proveedor_operaciones_e12','proveedor_solicitudes_e12','caja_retornos_proveedor_e12','caja_desbloqueos_e12'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION e12_immutable()',t||'_immutable',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['proveedor_operaciones_e12','proveedor_solicitudes_e12','caja_retornos_proveedor_e12','caja_desbloqueos_e12','proveedor_efectivo_e12'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION e12_immutable()',t||'_no_truncate',t);
  END LOOP;
END $$;
COMMIT;