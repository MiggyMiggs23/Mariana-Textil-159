\set ON_ERROR_STOP on
-- PREPARED ONLY. No E1/E2 gate is removed by this installation.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='60s';
CREATE TABLE public.vistas_abono_e3 (
  operacion_clave uuid PRIMARY KEY,
  token text NOT NULL CHECK (token ~ '^[a-f0-9]{64}$'),
  intent_hash text NOT NULL CHECK (intent_hash ~ '^[a-f0-9]{64}$'),
  actor_id integer NOT NULL REFERENCES public.usuarios(id),
  emitida_at timestamptz NOT NULL
);
CREATE TABLE public.recibo_folio_e3 (
  sitio_id integer PRIMARY KEY REFERENCES public.ubicaciones(id),
  ultimo_folio integer NOT NULL DEFAULT 0 CHECK (ultimo_folio >= 0)
);
CREATE TABLE public.recibos_abono_e3 (
  operacion_clave uuid PRIMARY KEY,
  intent_hash text NOT NULL CHECK (intent_hash ~ '^[a-f0-9]{64}$'),
  folio text NOT NULL UNIQUE,
  movimiento_id integer NOT NULL UNIQUE REFERENCES public.movimientos_credito(id),
  cliente_id integer NOT NULL REFERENCES public.clientes(id),
  sesion_operativa_id integer REFERENCES public.sesiones_caja(id),
  origen text NOT NULL CHECK (origen IN ('CAJA','RECAPTURA')),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot)='object' AND snapshot->>'version'='1'
    AND snapshot ?& ARRAY['folio','movimientoId','clienteId','clienteNombre','importeCentavos',
      'formaPago','cuentaDestino','sitioId','sesionCajaId','recibidoEn','registradoEn','actorId',
      'origen','motivo','asignaciones','remanenteCentavos','saldoAFavorCentavos','deudaCentavos',
      'clienteTelefono','clienteRfc','sitioNombre','actorNombre']),
  CHECK ((origen='CAJA' AND sesion_operativa_id IS NOT NULL)
      OR (origen='RECAPTURA' AND sesion_operativa_id IS NULL)),
  CHECK (snapshot->>'folio'=folio AND (snapshot->>'movimientoId')::integer=movimiento_id
    AND (snapshot->>'clienteId')::integer=cliente_id AND snapshot->>'origen'=origen)
);
CREATE INDEX recibos_abono_e3_cliente_idx ON public.recibos_abono_e3(cliente_id,movimiento_id);
CREATE INDEX recibos_abono_e3_sesion_idx ON public.recibos_abono_e3(sesion_operativa_id,movimiento_id);
CREATE FUNCTION public.e3_receipt_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'E3: evidencia inmutable; no editar, borrar ni truncar'; END $$;
CREATE TRIGGER e3_receipt_immutable BEFORE UPDATE OR DELETE ON public.recibos_abono_e3
FOR EACH ROW EXECUTE FUNCTION public.e3_receipt_immutable();
CREATE TRIGGER e3_receipt_no_truncate BEFORE TRUNCATE ON public.recibos_abono_e3
FOR EACH STATEMENT EXECUTE FUNCTION public.e3_receipt_immutable();
-- New capabilities default DENY for all non-ADMIN roles; ADMIN resolution is existing matrix policy.
-- No existing customized permission is overwritten. E3 source gate stays OFF.
INSERT INTO public.permisos_rol(rol,modulo,puede_ver,puede_crear,puede_editar,puede_autorizar)
SELECT rol::rol_usuario,modulo,false,false,false,false
FROM unnest(enum_range(NULL::rol_usuario)) rol
CROSS JOIN (VALUES ('caja_abonos'),('clientes_recapturas')) modules(modulo)
WHERE rol::text <> 'ADMIN'
ON CONFLICT (rol,modulo) DO NOTHING;
COMMIT;