-- PREPARED OFFLINE ONLY. DO NOT EXECUTE WITHOUT SEPARATE DB AUTHORIZATION.
-- No backfill, no capture/refund activation, no initializer registration.
BEGIN;

CREATE TABLE public.finalizaciones_abono_e2 (
  abono_id integer PRIMARY KEY REFERENCES public.movimientos_credito(id),
  operacion_productor text NOT NULL,
  operacion_clave uuid NOT NULL,
  cliente_id integer NOT NULL REFERENCES public.clientes(id),
  importe numeric(12,2) NOT NULL CHECK (importe > 0 AND importe < 'Infinity'::numeric),
  resultado text NOT NULL CHECK (resultado IN ('UNUSED','PARTIAL','FULL')),
  aplicado numeric(12,2) NOT NULL CHECK (aplicado >= 0 AND aplicado <= importe),
  evaluacion jsonb NOT NULL CHECK (jsonb_typeof(evaluacion) = 'object'),
  contrato_revision text NOT NULL CHECK (contrato_revision = 'e2-abono-evidence-v1'),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (operacion_productor, operacion_clave),
  CHECK (
    (resultado = 'UNUSED' AND aplicado = 0)
    OR (resultado = 'PARTIAL' AND aplicado > 0 AND aplicado < importe)
    OR (resultado = 'FULL' AND aplicado = importe)
  ),
  CHECK (operacion_productor IN ('ABONO_ORDINARIO','ABONO_DIRIGIDO'))
);

CREATE TABLE public.evidencia_no_aplicada_e2 (
  fuente text PRIMARY KEY,
  abono_id integer UNIQUE
    REFERENCES public.finalizaciones_abono_e2(abono_id),
  cobro_productor text,
  cobro_clave uuid UNIQUE,
  cliente_id integer NOT NULL REFERENCES public.clientes(id),
  importe numeric(12,2) NOT NULL CHECK (importe > 0 AND importe < 'Infinity'::numeric),
  forma_pago text NOT NULL DEFAULT 'EFECTIVO' CHECK (forma_pago = 'EFECTIVO'),
  naturaleza text NOT NULL DEFAULT 'INGRESO_FISICO' CHECK (naturaleza = 'INGRESO_FISICO'),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  FOREIGN KEY (cobro_productor, cobro_clave)
    REFERENCES public.cobros_credito_pendientes_e1(operacion_productor, operacion_clave),
  CHECK (
    (abono_id IS NOT NULL AND cobro_productor IS NULL AND cobro_clave IS NULL
      AND fuente = 'ABONO:' || abono_id::text)
    OR (abono_id IS NULL AND cobro_productor IS NOT NULL AND cobro_clave IS NOT NULL
      AND cobro_productor = 'COBRO_PENDIENTE'
      AND fuente = 'COBRO_RETENIDO:' || cobro_clave::text)
  )
);

CREATE FUNCTION public.e2_reject_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'E2: evidence/finalization is immutable';
END;
$function$;

CREATE TRIGGER e2_finalization_immutable
BEFORE UPDATE OR DELETE OR TRUNCATE ON public.finalizaciones_abono_e2
FOR EACH STATEMENT EXECUTE FUNCTION public.e2_reject_evidence_mutation();

CREATE TRIGGER e2_proof_immutable
BEFORE UPDATE OR DELETE OR TRUNCATE ON public.evidencia_no_aplicada_e2
FOR EACH STATEMENT EXECUTE FUNCTION public.e2_reject_evidence_mutation();

CREATE FUNCTION public.e2_validate_abono_finalization()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  source_xid text;
  source_client integer;
  source_amount numeric;
  source_producer text;
  source_key uuid;
  allocation_count integer;
  allocation_sum bigint;
BEGIN
  SELECT m.xmin::text, m.cliente_id, -m.importe,
         m.operacion_productor, m.operacion_clave
    INTO source_xid, source_client, source_amount, source_producer, source_key
    FROM public.movimientos_credito AS m
   WHERE m.id = NEW.abono_id
     AND m.tipo = 'ABONO'
     AND m.naturaleza = 'INGRESO_FISICO'
     AND m.forma_pago = 'EFECTIVO'
     AND m.cuenta_destino = 'CAJA_FISICA'
     AND m.sitio_origen_id IS NOT NULL
     AND m.sesion_caja_id IS NOT NULL
     AND m.operacion_productor IN ('ABONO_ORDINARIO','ABONO_DIRIGIDO')
   FOR SHARE;

  IF source_xid IS NULL
     OR source_xid::bigint <> (txid_current() % 4294967296)
     OR source_client IS DISTINCT FROM NEW.cliente_id
     OR source_amount IS DISTINCT FROM NEW.importe
     OR source_producer IS DISTINCT FROM NEW.operacion_productor
     OR source_key IS DISTINCT FROM NEW.operacion_clave THEN
    RAISE EXCEPTION 'E2: finalization requires its new physical ABONO in this transaction';
  END IF;
  IF NEW.evaluacion->>'contractRevision' IS DISTINCT FROM NEW.contrato_revision
     OR NEW.evaluacion->>'projector' IS DISTINCT FROM
        (CASE source_producer WHEN 'ABONO_DIRIGIDO' THEN 'directedApplication'
          ELSE 'projectCreditLedger' END)
     OR (source_producer = 'ABONO_DIRIGIDO'
         AND (NEW.resultado IS DISTINCT FROM 'FULL'
              OR NEW.aplicado IS DISTINCT FROM source_amount))
     OR (NEW.evaluacion->>'receiptCents')::bigint IS DISTINCT FROM round(NEW.importe * 100)::bigint
     OR (NEW.evaluacion->>'appliedCents')::bigint IS DISTINCT FROM round(NEW.aplicado * 100)::bigint
     OR jsonb_typeof(NEW.evaluacion->'allocations') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'E2: finalization evaluation contract mismatch';
  END IF;
  SELECT count(*), COALESCE(sum((item->>'appliedCents')::bigint), 0)
    INTO allocation_count, allocation_sum
    FROM jsonb_array_elements(NEW.evaluacion->'allocations') AS item
   WHERE jsonb_typeof(item) = 'object'
     AND jsonb_typeof(item->'targetId') = 'number'
     AND jsonb_typeof(item->'appliedCents') = 'number'
     AND (item->>'targetId')::numeric > 0
     AND (item->>'targetId')::numeric = trunc((item->>'targetId')::numeric)
     AND (item->>'appliedCents')::numeric > 0
     AND (item->>'appliedCents')::numeric = trunc((item->>'appliedCents')::numeric);
  IF allocation_count <> jsonb_array_length(NEW.evaluacion->'allocations')
     OR allocation_sum IS DISTINCT FROM round(NEW.aplicado * 100)::bigint THEN
    RAISE EXCEPTION 'E2: finalization allocation summary mismatch';
  END IF;
  -- Attest persisted destinations/amounts, never recompute FIFO in SQL.
  IF EXISTS (
    WITH persisted AS (
      SELECT venta_movimiento_id AS target, sum(importe * 100) AS cents
      FROM public.aplicaciones_credito WHERE abono_movimiento_id = NEW.abono_id
      GROUP BY venta_movimiento_id
    ), declared AS (
      SELECT (item->>'targetId')::integer AS target,
             sum((item->>'appliedCents')::numeric) AS cents
      FROM jsonb_array_elements(NEW.evaluacion->'allocations') AS item
      GROUP BY (item->>'targetId')::integer
    )
    (SELECT * FROM persisted EXCEPT SELECT * FROM declared)
    UNION ALL
    (SELECT * FROM declared EXCEPT SELECT * FROM persisted)
  ) OR EXISTS (
    SELECT 1 FROM public.movimientos_credito
    WHERE movimiento_origen_id = NEW.abono_id AND tipo = 'REVERSO'
  ) THEN
    RAISE EXCEPTION 'E2: finalization does not match persisted applications';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER e2_validate_abono_finalization
BEFORE INSERT ON public.finalizaciones_abono_e2
FOR EACH ROW EXECUTE FUNCTION public.e2_validate_abono_finalization();

CREATE FUNCTION public.e2_validate_unused_proof()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  final_row public.finalizaciones_abono_e2%ROWTYPE;
  retained_xid text;
  retained_customer integer;
  retained_amount numeric;
BEGIN
  IF NEW.abono_id IS NULL THEN
    SELECT xmin::text, cliente_id, importe
      INTO retained_xid, retained_customer, retained_amount
      FROM public.cobros_credito_pendientes_e1
      WHERE operacion_productor = NEW.cobro_productor
        AND operacion_productor = 'COBRO_PENDIENTE'
        AND operacion_clave = NEW.cobro_clave
        AND naturaleza = 'INGRESO_FISICO' AND medio = 'EFECTIVO'
        AND cuenta_destino = 'CAJA_FISICA' AND sesion_caja_id IS NOT NULL
      FOR SHARE;
    IF retained_xid IS NULL
       OR retained_xid::bigint <> (txid_current() % 4294967296)
       OR retained_customer IS DISTINCT FROM NEW.cliente_id
       OR retained_amount IS DISTINCT FROM NEW.importe THEN
      RAISE EXCEPTION 'E2: retained proof requires its new physical receipt in this transaction';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO final_row
    FROM public.finalizaciones_abono_e2
   WHERE abono_id = NEW.abono_id
   FOR SHARE;
  IF final_row.abono_id IS NULL
     OR final_row.resultado <> 'UNUSED'
     OR final_row.cliente_id IS DISTINCT FROM NEW.cliente_id
     OR final_row.importe IS DISTINCT FROM NEW.importe THEN
    RAISE EXCEPTION 'E2: positive proof requires a matching UNUSED finalization';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER e2_validate_unused_proof
BEFORE INSERT ON public.evidencia_no_aplicada_e2
FOR EACH ROW EXECUTE FUNCTION public.e2_validate_unused_proof();

-- Unattached future attester; pending receipts remain closed by E1P01.
CREATE FUNCTION public.e2_attest_new_retained(p_clave uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  INSERT INTO public.evidencia_no_aplicada_e2(fuente, cobro_productor, cobro_clave, cliente_id, importe)
    SELECT 'COBRO_RETENIDO:' || operacion_clave::text,
           operacion_productor, operacion_clave, cliente_id, importe
    FROM public.cobros_credito_pendientes_e1
    WHERE operacion_productor = 'COBRO_PENDIENTE' AND operacion_clave = p_clave;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E2: retained receipt not found';
  END IF;
END;
$function$;

CREATE FUNCTION public.e2_finalize_new_abono(
  p_abono_id integer,
  p_productor text,
  p_resultado text,
  p_aplicado_cents bigint,
  p_evaluacion jsonb,
  p_contrato_revision text
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  inserted public.finalizaciones_abono_e2%ROWTYPE;
BEGIN
  INSERT INTO public.finalizaciones_abono_e2(
    abono_id, operacion_productor, operacion_clave, cliente_id,
    importe, resultado, aplicado, evaluacion, contrato_revision
  )
  SELECT m.id, m.operacion_productor, m.operacion_clave, m.cliente_id,
         -m.importe, p_resultado, p_aplicado_cents::numeric / 100,
         p_evaluacion, p_contrato_revision
    FROM public.movimientos_credito AS m
   WHERE m.id = p_abono_id
     AND m.operacion_productor = p_productor
     AND m.tipo = 'ABONO'
     AND m.naturaleza = 'INGRESO_FISICO'
     AND m.forma_pago = 'EFECTIVO'
     AND m.cuenta_destino = 'CAJA_FISICA'
  RETURNING * INTO inserted;

  IF inserted.abono_id IS NULL THEN
    RAISE EXCEPTION 'E2: physical ABONO not found for finalization';
  END IF;
  IF inserted.resultado = 'UNUSED' THEN
    INSERT INTO public.evidencia_no_aplicada_e2(fuente, abono_id, cliente_id, importe)
    VALUES ('ABONO:' || inserted.abono_id::text, inserted.abono_id,
            inserted.cliente_id, inserted.importe);
  END IF;
END;
$function$;

CREATE FUNCTION public.e2_require_abono_finalization()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  final_result text;
  final_evaluation jsonb;
  proof_exists boolean;
BEGIN
  IF NEW.tipo = 'ABONO'
     AND NEW.naturaleza = 'INGRESO_FISICO'
     AND NEW.forma_pago = 'EFECTIVO'
     AND NEW.cuenta_destino = 'CAJA_FISICA'
     AND NEW.operacion_productor IN ('ABONO_ORDINARIO','ABONO_DIRIGIDO') THEN
    SELECT resultado, evaluacion INTO final_result, final_evaluation
      FROM public.finalizaciones_abono_e2
     WHERE abono_id = NEW.id;
    IF final_result IS NULL THEN
      RAISE EXCEPTION 'E2: physical ABONO cannot commit without finalization';
    END IF;
    -- Recheck at commit: catches application inserted AFTER finalization.
    IF EXISTS (
      WITH persisted AS (
        SELECT venta_movimiento_id AS target, sum(importe * 100) AS cents
        FROM public.aplicaciones_credito WHERE abono_movimiento_id = NEW.id
        GROUP BY venta_movimiento_id
      ), declared AS (
        SELECT (item->>'targetId')::integer AS target,
               sum((item->>'appliedCents')::numeric) AS cents
        FROM jsonb_array_elements(final_evaluation->'allocations') AS item
        GROUP BY (item->>'targetId')::integer
      )
      (SELECT * FROM persisted EXCEPT SELECT * FROM declared)
      UNION ALL
      (SELECT * FROM declared EXCEPT SELECT * FROM persisted)
    ) OR EXISTS (
      SELECT 1 FROM public.movimientos_credito
      WHERE movimiento_origen_id = NEW.id AND tipo = 'REVERSO'
    ) THEN
      RAISE EXCEPTION 'E2: committed finalization does not match persisted applications';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.evidencia_no_aplicada_e2
       WHERE abono_id = NEW.id
    ) INTO proof_exists;
    IF (final_result = 'UNUSED') IS DISTINCT FROM proof_exists THEN
      RAISE EXCEPTION 'E2: UNUSED proof completeness mismatch';
    END IF;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE CONSTRAINT TRIGGER e2_abono_finalization_complete
AFTER INSERT ON public.movimientos_credito
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.e2_require_abono_finalization();

-- INSERTing an application after SET CONSTRAINTS IMMEDIATE must not invalidate
-- an already checked capture. Later transactions may legitimately allocate it.
CREATE FUNCTION public.e2_guard_finalized_capture_application()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  source_xid text;
BEGIN
  SELECT xmin::text INTO source_xid FROM public.movimientos_credito
    WHERE id = NEW.abono_movimiento_id FOR SHARE;
  IF source_xid::bigint = (txid_current() % 4294967296)
     AND EXISTS (SELECT 1 FROM public.finalizaciones_abono_e2
                 WHERE abono_id = NEW.abono_movimiento_id) THEN
    RAISE EXCEPTION 'E2: capture applications must precede finalization';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER e2_capture_application_order
BEFORE INSERT ON public.aplicaciones_credito
FOR EACH ROW EXECUTE FUNCTION public.e2_guard_finalized_capture_application();

COMMIT;