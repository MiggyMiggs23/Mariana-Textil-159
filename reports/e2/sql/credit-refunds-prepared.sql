-- PREPARED ONLY. NOT AUTHORIZED TO EXECUTE. No startup registration.
-- Requires existing E1 schema/guards and explicit reviewed DDL authorization.
-- No backfill. No capture endpoint. No E5 conversion implementation.
BEGIN;
CREATE TABLE public.evidencia_no_aplicada_e2 (
  fuente text PRIMARY KEY,
  abono_id integer UNIQUE REFERENCES public.movimientos_credito(id),
  cobro_productor text,
  cobro_clave uuid UNIQUE,
  cliente_id integer NOT NULL REFERENCES public.clientes(id),
  importe numeric(12,2) NOT NULL CHECK (importe > 0 AND importe < 'Infinity'::numeric),
  forma_pago text NOT NULL DEFAULT 'EFECTIVO' CHECK (forma_pago = 'EFECTIVO'),
  naturaleza text NOT NULL DEFAULT 'INGRESO_FISICO' CHECK (naturaleza = 'INGRESO_FISICO'),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  FOREIGN KEY(cobro_productor,cobro_clave) REFERENCES public.cobros_credito_pendientes_e1(operacion_productor,operacion_clave),
  CHECK ((abono_id IS NOT NULL AND cobro_clave IS NULL AND cobro_productor IS NULL AND fuente='ABONO:'||abono_id::text)
    OR (abono_id IS NULL AND cobro_clave IS NOT NULL AND cobro_productor='COBRO_PENDIENTE' AND fuente='COBRO_RETENIDO:'||cobro_clave::text))
);
-- Disjoint source ownership. Any FUTURE E5 conversion must atomically claim this
-- same PK under the customer credit lock; extend destino only in authorized E5.
-- E2 does not implement conversion or write a fake ledger ABONO/REVERSO for it.
CREATE TABLE public.disposiciones_credito_e2 (
  fuente text PRIMARY KEY REFERENCES public.evidencia_no_aplicada_e2(fuente),
  clave uuid NOT NULL UNIQUE,
  destino text NOT NULL CHECK (destino='DEVOLUCION'),
  UNIQUE(fuente,clave)
);
CREATE TABLE public.devoluciones_credito_e2 (
  clave uuid PRIMARY KEY,
  fuente text NOT NULL UNIQUE,
  actor_id integer NOT NULL REFERENCES public.usuarios(id),
  contenido jsonb NOT NULL,
  respuesta jsonb NOT NULL,
  salida_id integer NOT NULL UNIQUE REFERENCES public.salidas_dinero_caja(id),
  reverso_id integer UNIQUE REFERENCES public.movimientos_credito(id),
  forma_pago text NOT NULL DEFAULT 'EFECTIVO' CHECK (forma_pago='EFECTIVO'),
  naturaleza text NOT NULL DEFAULT 'DEVOLUCION_FISICA' CHECK (naturaleza='DEVOLUCION_FISICA'),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  FOREIGN KEY(fuente,clave) REFERENCES public.disposiciones_credito_e2(fuente,clave),
  CHECK ((fuente LIKE 'ABONO:%' AND reverso_id IS NOT NULL)
      OR (fuente LIKE 'COBRO_RETENIDO:%' AND reverso_id IS NULL))
);
-- A source claim cannot commit without its complete refund response/outflow.
ALTER TABLE public.disposiciones_credito_e2 ADD CONSTRAINT e2_disposition_complete
  FOREIGN KEY(clave) REFERENCES public.devoluciones_credito_e2(clave) DEFERRABLE INITIALLY DEFERRED;
-- Exact original E1 guard function, unchanged: neither new table escapes it.
CREATE TRIGGER zz_e1_cash_capture_closed AFTER INSERT ON public.evidencia_no_aplicada_e2
  FOR EACH ROW EXECUTE FUNCTION public.e1_guard_cash_capture_closed();
CREATE TRIGGER zz_e1_cash_capture_closed AFTER INSERT ON public.devoluciones_credito_e2
  FOR EACH ROW EXECUTE FUNCTION public.e1_guard_cash_capture_closed();

CREATE FUNCTION public.e2_validate_new_source_proof() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public AS $$
DECLARE source_xid text; source_amount numeric; source_customer integer;
BEGIN
  IF NEW.abono_id IS NOT NULL THEN
    SELECT xmin::text, -importe, cliente_id INTO source_xid,source_amount,source_customer
      FROM public.movimientos_credito WHERE id=NEW.abono_id AND tipo='ABONO'
      AND naturaleza='INGRESO_FISICO' AND forma_pago='EFECTIVO'
      AND cuenta_destino='CAJA_FISICA' AND sesion_caja_id IS NOT NULL FOR SHARE;
    IF EXISTS (SELECT 1 FROM public.aplicaciones_credito WHERE abono_movimiento_id=NEW.abono_id)
       OR EXISTS (SELECT 1 FROM public.movimientos_credito WHERE movimiento_origen_id=NEW.abono_id AND tipo='REVERSO') THEN
      RAISE EXCEPTION 'E2: source already applied/reversed';
    END IF;
  ELSE
    SELECT xmin::text,importe,cliente_id INTO source_xid,source_amount,source_customer
      FROM public.cobros_credito_pendientes_e1 WHERE operacion_productor='COBRO_PENDIENTE'
      AND operacion_clave=NEW.cobro_clave AND naturaleza='INGRESO_FISICO'
      AND medio='EFECTIVO' AND cuenta_destino='CAJA_FISICA' AND sesion_caja_id IS NOT NULL FOR SHARE;
  END IF;
  -- Proof can only be created with its immutable receipt, not for old unknown history.
  IF source_xid IS NULL OR source_xid::bigint <> (txid_current() % 4294967296)
      OR source_amount IS DISTINCT FROM NEW.importe OR source_customer IS DISTINCT FROM NEW.cliente_id THEN
    RAISE EXCEPTION 'E2: proof requires a new physical source in this transaction';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER e2_source_proof BEFORE INSERT ON public.evidencia_no_aplicada_e2
  FOR EACH ROW EXECUTE FUNCTION public.e2_validate_new_source_proof();

CREATE FUNCTION public.e2_attest_new_retained(p_clave uuid) RETURNS void LANGUAGE plpgsql
SET search_path=pg_catalog,public AS $$
BEGIN
  INSERT INTO public.evidencia_no_aplicada_e2(fuente,cobro_productor,cobro_clave,cliente_id,importe)
    SELECT 'COBRO_RETENIDO:'||operacion_clave::text,operacion_productor,operacion_clave,cliente_id,importe
    FROM public.cobros_credito_pendientes_e1 WHERE operacion_productor='COBRO_PENDIENTE' AND operacion_clave=p_clave;
  IF NOT FOUND THEN RAISE EXCEPTION 'E2: retained receipt not found'; END IF;
END $$;
CREATE FUNCTION public.e2_attest_new_abono(p_id integer) RETURNS void LANGUAGE plpgsql
SET search_path=pg_catalog,public AS $$
BEGIN
  INSERT INTO public.evidencia_no_aplicada_e2(fuente,abono_id,cliente_id,importe)
    SELECT 'ABONO:'||id::text,id,cliente_id,-importe FROM public.movimientos_credito WHERE id=p_id AND tipo='ABONO';
  IF NOT FOUND THEN RAISE EXCEPTION 'E2: ABONO not found'; END IF;
END $$;
CREATE FUNCTION public.e2_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'E2: immutable evidence'; END $$;
CREATE TRIGGER e2_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.evidencia_no_aplicada_e2
  FOR EACH STATEMENT EXECUTE FUNCTION public.e2_immutable();
CREATE TRIGGER e2_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.disposiciones_credito_e2
  FOR EACH STATEMENT EXECUTE FUNCTION public.e2_immutable();
CREATE TRIGGER e2_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.devoluciones_credito_e2
  FOR EACH STATEMENT EXECUTE FUNCTION public.e2_immutable();
COMMIT;