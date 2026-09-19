-- PREPARED ONLY. NOT AUTHORIZED TO EXECUTE. No startup registration.
-- Requires E1 guards AND evidencia-a-c/01-install-evidence-prepared.sql.
-- A+C is the SOLE owner/producer of evidencia_no_aplicada_e2.
-- ABONO and COBRO_RETENIDO retain disjoint canonical proof types.
-- No backfill. No capture/refund activation. No E5 implementation.
BEGIN;
-- Fail closed if the canonical A+C dependency has not been installed.
LOCK TABLE public.finalizaciones_abono_e2, public.evidencia_no_aplicada_e2
  IN SHARE ROW EXCLUSIVE MODE;

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
ALTER TABLE public.disposiciones_credito_e2 ADD CONSTRAINT e2_disposition_complete
  FOREIGN KEY(clave) REFERENCES public.devoluciones_credito_e2(clave) DEFERRABLE INITIALLY DEFERRED;

-- Independent unconditional refund closure: a future LIMITED cash guard must
-- not accidentally authorize a claim or refund. Permanent validation stays.
CREATE FUNCTION public.e2_refund_capture_closed() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE='E2R01',
    MESSAGE='E2: physical refunds remain disabled';
END $$;
CREATE TRIGGER zz_e2_refund_capture_closed BEFORE INSERT ON public.disposiciones_credito_e2
  FOR EACH STATEMENT EXECUTE FUNCTION public.e2_refund_capture_closed();
CREATE TRIGGER zz_e2_refund_capture_closed BEFORE INSERT ON public.devoluciones_credito_e2
  FOR EACH STATEMENT EXECUTE FUNCTION public.e2_refund_capture_closed();

CREATE FUNCTION public.e2_immutable() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public AS $$
BEGIN RAISE EXCEPTION 'E2: immutable refund'; END $$;
CREATE TRIGGER e2_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.disposiciones_credito_e2
  FOR EACH STATEMENT EXECUTE FUNCTION public.e2_immutable();
CREATE TRIGGER e2_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.devoluciones_credito_e2
  FOR EACH STATEMENT EXECUTE FUNCTION public.e2_immutable();
COMMIT;