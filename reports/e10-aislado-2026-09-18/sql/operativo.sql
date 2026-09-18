-- E10 Fondo de Mariana.
-- Authorized only for the already pinned isolated-copy rehearsal described in
-- reports/e10-autorizacion-fase-aislada-2026-09-18.md.
-- REVIEW ONLY for the OPERATIVE database: applying there requires a separate,
-- later textual authorization. This file never selects a target or opens a connection.
BEGIN;
SET LOCAL search_path = public, pg_catalog;

DO $preflight$
DECLARE
  mariana_count integer;
BEGIN
  IF to_regclass('public.fondo_mariana') IS NOT NULL
     OR to_regclass('public.fondo_movimientos') IS NOT NULL
     OR to_regclass('public.fondo_arqueos') IS NOT NULL THEN
    RAISE EXCEPTION 'E10_PREFLIGHT: one or more Fondo tables already exist';
  END IF;
  IF to_regprocedure('gen_random_uuid()') IS NULL THEN
    RAISE EXCEPTION 'E10_PREFLIGHT: required gen_random_uuid() is absent';
  END IF;
  IF to_regclass('public.ubicaciones') IS NULL
     OR to_regclass('public.usuarios') IS NULL
     OR to_regclass('public.auditoria') IS NULL THEN
    RAISE EXCEPTION 'E10_PREFLIGHT: required existing catalog/audit tables are absent';
  END IF;
  SELECT count(*) INTO mariana_count
    FROM ubicaciones
   WHERE activa IS TRUE AND tipo::text = 'TIENDA'
     AND upper(btrim(nombre)) = 'MARIANA';
  IF mariana_count <> 1 THEN
    RAISE EXCEPTION 'E10_PREFLIGHT: expected exactly one active TIENDA Mariana, found %', mariana_count;
  END IF;
END
$preflight$;

CREATE TABLE fondo_mariana (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ubicacion_id integer NOT NULL REFERENCES ubicaciones(id),
  nombre text NOT NULL DEFAULT 'Fondo de Mariana',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fondo_mariana_nombre_check CHECK (nombre = 'Fondo de Mariana')
);
CREATE UNIQUE INDEX fondo_mariana_singleton_uidx ON fondo_mariana ((true));
CREATE UNIQUE INDEX fondo_mariana_ubicacion_uidx ON fondo_mariana (ubicacion_id);

INSERT INTO fondo_mariana (ubicacion_id)
SELECT id FROM ubicaciones
 WHERE activa IS TRUE AND tipo::text = 'TIENDA'
   AND upper(btrim(nombre)) = 'MARIANA';

CREATE SEQUENCE fondo_movimientos_ordinal_seq AS bigint;
CREATE TABLE fondo_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordinal bigint NOT NULL,
  fondo_id uuid NOT NULL REFERENCES fondo_mariana(id),
  naturaleza text NOT NULL,
  categoria text NOT NULL,
  importe_centavos bigint NOT NULL,
  motivo text NOT NULL,
  autor_id integer NOT NULL REFERENCES usuarios(id),
  original_id uuid REFERENCES fondo_movimientos(id),
  idempotency_key uuid NOT NULL,
  idempotency_producer text NOT NULL,
  payload_hash text NOT NULL,
  conciliacion_inicial jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT fondo_movimientos_naturaleza_check CHECK (naturaleza IN ('INGRESO','RETIRO')),
  CONSTRAINT fondo_movimientos_categoria_check CHECK (categoria IN ('SALDO_INICIAL','CAPITAL','OTRO_INGRESO','RETIRO')),
  CONSTRAINT fondo_movimientos_importe_check CHECK (importe_centavos >= 0 AND (importe_centavos > 0 OR categoria='SALDO_INICIAL')),
  CONSTRAINT fondo_movimientos_motivo_check CHECK (char_length(btrim(motivo)) BETWEEN 1 AND 500),
  CONSTRAINT fondo_movimientos_productor_check CHECK (idempotency_producer IN ('FONDO_API_MOVIMIENTO_V1','FONDO_API_INVERSO_V1')),
  CONSTRAINT fondo_movimientos_hash_check CHECK (payload_hash ~ '^[0-9a-f]{64}$')
);
ALTER SEQUENCE fondo_movimientos_ordinal_seq OWNED BY fondo_movimientos.ordinal;
CREATE UNIQUE INDEX fondo_movimientos_productor_idempotencia_uidx
  ON fondo_movimientos (idempotency_producer,idempotency_key);
CREATE UNIQUE INDEX fondo_movimientos_original_uidx
  ON fondo_movimientos (original_id) WHERE original_id IS NOT NULL;
CREATE UNIQUE INDEX fondo_movimientos_ordinal_uidx ON fondo_movimientos (ordinal);
CREATE INDEX fondo_movimientos_fondo_ordinal_idx
  ON fondo_movimientos (fondo_id,ordinal DESC);

CREATE TABLE fondo_arqueos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fondo_id uuid NOT NULL REFERENCES fondo_mariana(id),
  saldo_sistema_centavos bigint NOT NULL,
  efectivo_contado_centavos bigint NOT NULL,
  diferencia_centavos bigint NOT NULL,
  version_saldo uuid REFERENCES fondo_movimientos(id),
  motivo text NOT NULL,
  autor_id integer NOT NULL REFERENCES usuarios(id),
  idempotency_key uuid NOT NULL,
  idempotency_producer text NOT NULL,
  payload_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT fondo_arqueos_efectivo_check CHECK (efectivo_contado_centavos >= 0),
  CONSTRAINT fondo_arqueos_diferencia_check CHECK (diferencia_centavos = efectivo_contado_centavos - saldo_sistema_centavos),
  CONSTRAINT fondo_arqueos_motivo_check CHECK (char_length(btrim(motivo)) BETWEEN 1 AND 500),
  CONSTRAINT fondo_arqueos_productor_check CHECK (idempotency_producer = 'FONDO_API_ARQUEO_V1'),
  CONSTRAINT fondo_arqueos_hash_check CHECK (payload_hash ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX fondo_arqueos_productor_idempotencia_uidx
  ON fondo_arqueos (idempotency_producer,idempotency_key);
CREATE INDEX fondo_arqueos_fondo_fecha_idx
  ON fondo_arqueos (fondo_id,created_at DESC,id DESC);

CREATE FUNCTION fondo_assert_fixed_mariana() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE valid_location boolean;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'FONDO_IMMUTABLE: fixed identity cannot be changed or deleted';
  END IF;
  SELECT activa IS TRUE AND tipo::text='TIENDA' AND upper(btrim(nombre))='MARIANA'
    INTO valid_location FROM ubicaciones WHERE id=NEW.ubicacion_id;
  IF valid_location IS DISTINCT FROM TRUE OR NEW.nombre <> 'Fondo de Mariana' THEN
    RAISE EXCEPTION 'FONDO_MARIANA_IDENTITY_INVALID';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION fondo_reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'FONDO_IMMUTABLE: % is append-only', TG_TABLE_NAME;
END $$;

CREATE FUNCTION fondo_validate_movement() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  current_balance bigint;
  movement_count bigint;
  original fondo_movimientos%ROWTYPE;
  fixed_fondo uuid;
  declared_count bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(4600112);
  IF NEW.ordinal IS NOT NULL THEN RAISE EXCEPTION 'FONDO_ORDINAL_SERVER_ONLY'; END IF;
  NEW.ordinal := nextval('fondo_movimientos_ordinal_seq');
  SELECT id INTO STRICT fixed_fondo FROM fondo_mariana;
  IF NEW.fondo_id <> fixed_fondo THEN RAISE EXCEPTION 'FONDO_MARIANA_IDENTITY_INVALID'; END IF;
  SELECT count(*),
         COALESCE(sum(CASE WHEN naturaleza='INGRESO' THEN importe_centavos ELSE -importe_centavos END),0)
    INTO movement_count,current_balance FROM fondo_movimientos WHERE fondo_id=NEW.fondo_id;

  IF NEW.original_id IS NULL THEN
    IF movement_count = 0 AND NEW.categoria <> 'SALDO_INICIAL' THEN
      RAISE EXCEPTION 'FONDO_SALDO_INICIAL_INVALIDO';
    END IF;
    IF NEW.categoria='SALDO_INICIAL' THEN
      IF movement_count <> 0 OR NEW.naturaleza <> 'INGRESO' OR NEW.motivo <> 'saldo inicial'
         OR jsonb_typeof(NEW.conciliacion_inicial) IS DISTINCT FROM 'object'
         OR jsonb_typeof(NEW.conciliacion_inicial->'declaracionSinDuplicacion') IS DISTINCT FROM 'boolean'
         OR NEW.conciliacion_inicial->'declaracionSinDuplicacion' IS DISTINCT FROM 'true'::jsonb
         OR jsonb_typeof(NEW.conciliacion_inicial->'efectivoFisicoContado') IS DISTINCT FROM 'string'
         OR coalesce(NEW.conciliacion_inicial->>'efectivoFisicoContado','') !~ '^(0|[1-9][0-9]*)\.[0-9]{2}$'
         OR jsonb_typeof(NEW.conciliacion_inicial->'evidencia') IS DISTINCT FROM 'string'
         OR nullif(btrim(coalesce(NEW.conciliacion_inicial->>'evidencia','')),'') IS NULL
         OR char_length(NEW.conciliacion_inicial->>'evidencia') > 1000 THEN
        RAISE EXCEPTION 'FONDO_SALDO_INICIAL_INVALIDO';
      END IF;
      declared_count :=
        split_part(NEW.conciliacion_inicial->>'efectivoFisicoContado','.',1)::bigint * 100
        + split_part(NEW.conciliacion_inicial->>'efectivoFisicoContado','.',2)::bigint;
      IF declared_count IS DISTINCT FROM NEW.importe_centavos THEN RAISE EXCEPTION 'FONDO_SALDO_INICIAL_INVALIDO'; END IF;
    ELSE
      IF NEW.categoria='RETIRO' AND NEW.naturaleza <> 'RETIRO'
         OR NEW.categoria IN ('CAPITAL','OTRO_INGRESO') AND NEW.naturaleza <> 'INGRESO'
         OR NEW.conciliacion_inicial IS NOT NULL THEN
        RAISE EXCEPTION 'FONDO_MOVIMIENTO_INVALIDO';
      END IF;
    END IF;
  ELSE
    SELECT * INTO STRICT original FROM fondo_movimientos WHERE id=NEW.original_id FOR UPDATE;
    IF original.fondo_id <> NEW.fondo_id OR original.original_id IS NOT NULL
       OR NEW.importe_centavos <> original.importe_centavos
       OR NEW.categoria <> original.categoria
       OR NEW.naturaleza = original.naturaleza
       OR NEW.conciliacion_inicial IS NOT NULL THEN
      RAISE EXCEPTION 'FONDO_INVERSO_INVALIDO';
    END IF;
  END IF;
  IF NEW.original_id IS NULL AND NEW.naturaleza='RETIRO'
     AND current_balance < NEW.importe_centavos THEN
    RAISE EXCEPTION 'FONDO_SALDO_INSUFICIENTE';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION fondo_validate_audit() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE fixed_fondo uuid; actual_balance bigint; actual_version uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(4600112);
  SELECT id INTO STRICT fixed_fondo FROM fondo_mariana;
  IF NEW.fondo_id <> fixed_fondo THEN RAISE EXCEPTION 'FONDO_MARIANA_IDENTITY_INVALID'; END IF;
  SELECT COALESCE(sum(CASE WHEN naturaleza='INGRESO' THEN importe_centavos ELSE -importe_centavos END),0),
         (array_agg(id ORDER BY ordinal DESC))[1]
    INTO actual_balance,actual_version FROM fondo_movimientos WHERE fondo_id=NEW.fondo_id;
  IF NEW.saldo_sistema_centavos <> actual_balance
     OR NEW.version_saldo IS DISTINCT FROM actual_version THEN
    RAISE EXCEPTION 'FONDO_VERSION_SALDO_OBSOLETA';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER fondo_mariana_fixed_before_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON fondo_mariana
  FOR EACH ROW EXECUTE FUNCTION fondo_assert_fixed_mariana();
CREATE TRIGGER fondo_mariana_immutable_before_truncate
  BEFORE TRUNCATE ON fondo_mariana
  FOR EACH STATEMENT EXECUTE FUNCTION fondo_reject_mutation();
CREATE TRIGGER fondo_movimientos_validate_before_insert
  BEFORE INSERT ON fondo_movimientos
  FOR EACH ROW EXECUTE FUNCTION fondo_validate_movement();
CREATE TRIGGER fondo_movimientos_immutable_before_mutation
  BEFORE UPDATE OR DELETE ON fondo_movimientos
  FOR EACH ROW EXECUTE FUNCTION fondo_reject_mutation();
CREATE TRIGGER fondo_movimientos_immutable_before_truncate
  BEFORE TRUNCATE ON fondo_movimientos
  FOR EACH STATEMENT EXECUTE FUNCTION fondo_reject_mutation();
CREATE TRIGGER fondo_arqueos_validate_before_insert
  BEFORE INSERT ON fondo_arqueos
  FOR EACH ROW EXECUTE FUNCTION fondo_validate_audit();
CREATE TRIGGER fondo_arqueos_immutable_before_mutation
  BEFORE UPDATE OR DELETE ON fondo_arqueos
  FOR EACH ROW EXECUTE FUNCTION fondo_reject_mutation();
CREATE TRIGGER fondo_arqueos_immutable_before_truncate
  BEFORE TRUNCATE ON fondo_arqueos
  FOR EACH STATEMENT EXECUTE FUNCTION fondo_reject_mutation();

COMMIT;