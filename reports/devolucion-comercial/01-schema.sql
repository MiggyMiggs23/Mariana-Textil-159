-- CLOSED candidate. No runtime initializer or automatic migration may run this.
BEGIN;
SET LOCAL search_path = pg_catalog, public;
CREATE TABLE public.commercial_return_gate (
  id integer PRIMARY KEY CHECK (id=1),
  enabled boolean NOT NULL DEFAULT false,
  CONSTRAINT commercial_return_integrity_uninstalled CHECK (NOT enabled)
);
INSERT INTO public.commercial_return_gate VALUES (1,false);
CREATE TABLE public.devoluciones_comerciales (
  id uuid PRIMARY KEY,
  uuid_cliente uuid NOT NULL UNIQUE,
  ticket_id integer NOT NULL REFERENCES public.tickets(id),
  linea_id integer NOT NULL UNIQUE REFERENCES public.ticket_lineas(id),
  rollo_id integer NOT NULL REFERENCES public.rollos(id),
  ubicacion_recepcion_id integer NOT NULL REFERENCES public.ubicaciones(id),
  sesion_caja_id integer NOT NULL REFERENCES public.sesiones_caja(id),
  actor_id integer NOT NULL REFERENCES public.usuarios(id),
  cantidad numeric(10,3) NOT NULL CHECK (cantidad>0 AND cantidad<>'NaN'::numeric),
  importe_rollo numeric(12,2) NOT NULL CHECK (importe_rollo>0 AND importe_rollo<>'NaN'::numeric),
  deuda_cancelada numeric(12,2) NOT NULL CHECK (deuda_cancelada>=0),
  efectivo_devuelto numeric(12,2) NOT NULL CHECK (efectivo_devuelto>=0),
  motivo text NOT NULL CHECK (length(btrim(motivo)) BETWEEN 1 AND 400),
  movimiento_inventario_id bigint NOT NULL UNIQUE REFERENCES public.movimientos(id),
  movimiento_credito_id integer NOT NULL UNIQUE REFERENCES public.movimientos_credito(id),
  salida_caja_id integer UNIQUE REFERENCES public.salidas_dinero_caja(id),
  request jsonb NOT NULL CHECK (jsonb_typeof(request)='object'),
  response jsonb NOT NULL CHECK (jsonb_typeof(response)='object'),
  fuentes_pago integer[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(created_at)),
  CHECK (importe_rollo=deuda_cancelada+efectivo_devuelto),
  CHECK ((efectivo_devuelto>0)=(salida_caja_id IS NOT NULL))
);
CREATE INDEX devoluciones_comerciales_ticket_idx ON public.devoluciones_comerciales(ticket_id,created_at);
CREATE INDEX devoluciones_comerciales_sesion_idx ON public.devoluciones_comerciales(sesion_caja_id,created_at);

CREATE FUNCTION public.commercial_return_closed_or_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $f$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'DEVOLUCION_COMERCIAL_INMUTABLE';
  END IF;
  IF NOT COALESCE((SELECT enabled FROM public.commercial_return_gate WHERE id=1),false) THEN
    RAISE EXCEPTION 'DEVOLUCION_COMERCIAL_CERRADA';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id=NEW.actor_id AND activo AND rol='ADMIN') THEN
    RAISE EXCEPTION 'DEVOLUCION_COMERCIAL_ADMIN_REQUERIDO';
  END IF;
  RETURN NEW;
END $f$;
CREATE TRIGGER commercial_return_capture BEFORE INSERT OR UPDATE OR DELETE ON public.devoluciones_comerciales
FOR EACH ROW EXECUTE FUNCTION public.commercial_return_closed_or_immutable();

-- Extend existing constraints without discarding previously accepted producers.
DO $f$
DECLARE expression text;
BEGIN
  SELECT pg_get_expr(conbin,conrelid) INTO STRICT expression FROM pg_constraint
    WHERE conrelid='public.operaciones_credito_e1'::regclass AND conname='operaciones_productor_naturaleza_ck_e1';
  EXECUTE 'ALTER TABLE public.operaciones_credito_e1 DROP CONSTRAINT operaciones_productor_naturaleza_ck_e1';
  EXECUTE 'ALTER TABLE public.operaciones_credito_e1 ADD CONSTRAINT operaciones_productor_naturaleza_ck_e1 CHECK (('
    || expression || ') OR (productor=''DEVOLUCION_COMERCIAL'' AND naturaleza=''OPERACION_CREDITO_SIN_DINERO''))';
  SELECT pg_get_expr(conbin,conrelid) INTO STRICT expression FROM pg_constraint
    WHERE conrelid='public.movimientos_credito'::regclass AND conname='movimientos_credito_importe_tipo_check';
  EXECUTE 'ALTER TABLE public.movimientos_credito DROP CONSTRAINT movimientos_credito_importe_tipo_check';
  EXECUTE 'ALTER TABLE public.movimientos_credito ADD CONSTRAINT movimientos_credito_importe_tipo_check CHECK (('
    || expression || ') OR (tipo=''DEVOLUCION_COMERCIAL'' AND importe<=0))';
END $f$;

-- Narrow early branch; keep the deployed E1 validator byte-for-byte otherwise.
-- This also preserves any previously installed E5/E11 validation branches.
DO $install$
DECLARE definition text; branch text;
BEGIN
  SELECT pg_get_functiondef('public.validar_movimiento_credito_e1()'::regprocedure) INTO definition;
  IF definition NOT LIKE '%BEGIN%' OR definition LIKE '%commercial_return_gate%' THEN
    RAISE EXCEPTION 'Unexpected E1 validator identity; STOP';
  END IF;
  branch := $branch$
BEGIN
  IF NEW.tipo::text='DEVOLUCION_COMERCIAL' OR NEW.operacion_productor='DEVOLUCION_COMERCIAL' THEN
    IF NOT COALESCE((SELECT enabled FROM public.commercial_return_gate WHERE id=1),false) THEN
      RAISE EXCEPTION 'DEVOLUCION_COMERCIAL_CERRADA';
    END IF;
    IF NEW.tipo::text<>'DEVOLUCION_COMERCIAL' OR NEW.operacion_productor<>'DEVOLUCION_COMERCIAL'
      OR NEW.naturaleza IS DISTINCT FROM 'OPERACION_CREDITO_SIN_DINERO'::public.naturaleza_credito_e1
      OR NEW.importe>0 OR NEW.importe='NaN'::numeric OR NEW.sesion_caja_id IS NOT NULL
      OR NEW.forma_pago IS NOT NULL OR NEW.cuenta_destino IS NOT NULL
      OR NEW.es_incobrable OR NULLIF(btrim(NEW.origen_justificacion),'') IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id=NEW.usuario_id AND activo AND rol='ADMIN')
      OR NOT EXISTS (SELECT 1 FROM public.ubicaciones WHERE id=NEW.sitio_origen_id AND activa AND tipo='TIENDA')
      OR NOT EXISTS (SELECT 1 FROM public.movimientos_credito m WHERE m.id=NEW.movimiento_origen_id
        AND m.tipo='VENTA_CREDITO' AND m.ticket_id=NEW.ticket_id AND m.cliente_id=NEW.cliente_id)
      OR NOT EXISTS (SELECT 1 FROM public.operaciones_credito_e1 o
        WHERE o.productor=NEW.operacion_productor AND o.clave=NEW.operacion_clave
        AND o.usuario_id=NEW.usuario_id AND o.naturaleza=NEW.naturaleza) THEN
      RAISE EXCEPTION 'DEVOLUCION_COMERCIAL_EVENTO_INVALIDO';
    END IF;
    RETURN NEW;
  END IF;
$branch$;
  definition := regexp_replace(definition, '\mBEGIN\M', branch);
  EXECUTE definition;
END $install$;

CREATE FUNCTION public.commercial_return_evidence() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $f$
DECLARE r public.devoluciones_comerciales%ROWTYPE; ticket public.tickets%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME='devoluciones_comerciales' THEN
    SELECT * INTO STRICT r FROM public.devoluciones_comerciales WHERE id=NEW.id;
  ELSE
    IF NEW.tipo::text<>'DEVOLUCION_COMERCIAL' THEN RETURN NULL; END IF;
    SELECT * INTO r FROM public.devoluciones_comerciales WHERE movimiento_credito_id=NEW.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'DEVOLUCION_COMERCIAL_SIN_EVIDENCIA'; END IF;
  END IF;
  SELECT * INTO STRICT ticket FROM public.tickets WHERE id=r.ticket_id;
  IF ticket.estado<>'VENDIDO' OR ticket.documento_tipo<>'NOTA' OR ticket.autorizacion_estado<>'AUTORIZADA'
    OR ticket.total<>ticket.subtotal+ticket.iva OR ticket.subtotal<=0
    OR ticket.subtotal<>(SELECT SUM(importe) FROM public.ticket_lineas WHERE ticket_id=r.ticket_id)
    OR EXISTS (SELECT 1 FROM public.ticket_lineas WHERE ticket_id=r.ticket_id AND (tipo<>'NORMAL' OR rollo_id IS NULL))
    OR NOT EXISTS (SELECT 1 FROM public.ticket_lineas l WHERE l.id=r.linea_id
      AND r.importe_rollo*ticket.subtotal=l.importe*ticket.total)
    OR NOT EXISTS (SELECT 1 FROM public.rollos p WHERE p.id=r.rollo_id
      AND p.estado='DISPONIBLE' AND p.cantidad_actual=r.cantidad AND p.ubicacion_id=r.ubicacion_recepcion_id)
    OR NOT EXISTS (SELECT 1 FROM public.ticket_lineas l WHERE l.id=r.linea_id
      AND l.ticket_id=r.ticket_id AND l.rollo_id=r.rollo_id AND l.tipo='NORMAL' AND l.cantidad=r.cantidad)
    OR NOT EXISTS (SELECT 1 FROM public.sesiones_caja s JOIN public.ubicaciones u ON u.id=s.ubicacion_id
      WHERE s.id=r.sesion_caja_id AND s.ubicacion_id=r.ubicacion_recepcion_id
      AND s.estado='ABIERTA' AND s.cerrada_at IS NULL AND u.activa AND u.tipo='TIENDA'
      AND s.fecha_operativa=(r.created_at AT TIME ZONE 'America/Mexico_City')::date
      AND s.fecha_operativa=(clock_timestamp() AT TIME ZONE 'America/Mexico_City')::date)
    OR NOT EXISTS (SELECT 1 FROM public.movimientos m WHERE m.id=r.movimiento_inventario_id
      AND m.rollo_id=r.rollo_id AND m.ubicacion_id=r.ubicacion_recepcion_id
      AND m.tipo='DEVOLUCION' AND m.cantidad=r.cantidad AND m.documento_tipo='DEVOLUCION_COMERCIAL'
      AND m.documento_id=r.id::text AND m.movimiento_origen_id IS NULL AND m.usuario_id=r.actor_id)
    OR NOT EXISTS (SELECT 1 FROM public.movimientos m WHERE m.id=(
        SELECT max(id) FROM public.movimientos WHERE rollo_id=r.rollo_id AND id<r.movimiento_inventario_id)
      AND m.tipo='VENTA' AND m.cantidad=-r.cantidad AND m.documento_id=r.ticket_id::text
      AND m.documento_tipo IN ('TICKET','TICKET_BOLSA_NORMAL','TICKET_PIEZA_NORMAL'))
    OR (NOT EXISTS (SELECT 1 FROM public.movimientos_credito m
      WHERE m.id=r.movimiento_credito_id AND m.tipo::text='DEVOLUCION_COMERCIAL'
      AND m.importe=-r.deuda_cancelada AND m.ticket_id=r.ticket_id AND m.cliente_id=ticket.cliente_id
      AND m.usuario_id=r.actor_id AND m.operacion_clave=r.id))
    OR (r.efectivo_devuelto>0 AND NOT EXISTS (SELECT 1 FROM public.salidas_dinero_caja s
      WHERE s.id=r.salida_caja_id AND s.sesion_caja_id=r.sesion_caja_id AND s.monto=r.efectivo_devuelto
      AND s.cuenta_origen='CAJA_FISICA' AND s.proveedor_id IS NULL AND s.creado_por_id=r.actor_id)) THEN
    RAISE EXCEPTION 'DEVOLUCION_COMERCIAL_EVIDENCIA_INCONSISTENTE';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(r.fuentes_pago) f(id)
    LEFT JOIN public.movimientos_credito m ON m.id=f.id
    WHERE m.id IS NULL OR m.cliente_id<>ticket.cliente_id OR m.tipo<>'ABONO'
      OR m.naturaleza IS DISTINCT FROM 'INGRESO_FISICO'::public.naturaleza_credito_e1) THEN
    RAISE EXCEPTION 'DEVOLUCION_COMERCIAL_LIQUIDACION_NO_MONETARIA';
  END IF;
  RETURN NULL;
END $f$;
CREATE CONSTRAINT TRIGGER commercial_return_evidence_final AFTER INSERT ON public.devoluciones_comerciales
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.commercial_return_evidence();
CREATE CONSTRAINT TRIGGER commercial_return_credit_final AFTER INSERT ON public.movimientos_credito
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.commercial_return_evidence();

CREATE FUNCTION public.commercial_return_protect_history() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $f$
BEGIN
  IF TG_TABLE_NAME='movimientos_credito' THEN
    IF EXISTS (SELECT 1 FROM public.devoluciones_comerciales r JOIN public.tickets t ON t.id=r.ticket_id
      WHERE t.cliente_id=NEW.cliente_id AND NEW.created_at<r.created_at) THEN
      RAISE EXCEPTION 'DEVOLUCION_COMERCIAL_NO_ADMITE_REPARTO_RETROACTIVO';
    END IF;
    IF NEW.tipo='REVERSO' AND EXISTS (
      SELECT 1 FROM public.devoluciones_comerciales r
      WHERE NEW.movimiento_origen_id=ANY(r.fuentes_pago) OR NEW.ticket_id=r.ticket_id
    ) THEN RAISE EXCEPTION 'DEVOLUCION_COMERCIAL_HISTORIA_PROTEGIDA'; END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME='movimientos' THEN
    IF NEW.movimiento_origen_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.devoluciones_comerciales r
      LEFT JOIN public.movimientos original ON original.id=NEW.movimiento_origen_id
      WHERE r.movimiento_inventario_id=NEW.movimiento_origen_id
        OR (original.tipo='VENTA' AND original.rollo_id=r.rollo_id AND original.documento_id=r.ticket_id::text)) THEN
      RAISE EXCEPTION 'DEVOLUCION_COMERCIAL_NO_ES_REVERSABLE';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME='tickets' THEN
    IF EXISTS (SELECT 1 FROM public.devoluciones_comerciales WHERE ticket_id=OLD.id) THEN
      RAISE EXCEPTION 'DEVOLUCION_COMERCIAL_HISTORIA_PROTEGIDA'; END IF;
  ELSIF TG_TABLE_NAME='ticket_lineas' THEN
    IF EXISTS (SELECT 1 FROM public.devoluciones_comerciales WHERE ticket_id=OLD.ticket_id) THEN
      RAISE EXCEPTION 'DEVOLUCION_COMERCIAL_HISTORIA_PROTEGIDA'; END IF;
  ELSIF TG_TABLE_NAME='salidas_dinero_caja' THEN
    IF EXISTS (SELECT 1 FROM public.devoluciones_comerciales WHERE salida_caja_id=OLD.id) THEN
      RAISE EXCEPTION 'DEVOLUCION_COMERCIAL_HISTORIA_PROTEGIDA'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $f$;
CREATE TRIGGER commercial_return_protect_credit BEFORE INSERT ON public.movimientos_credito
FOR EACH ROW EXECUTE FUNCTION public.commercial_return_protect_history();
CREATE TRIGGER commercial_return_protect_inventory BEFORE INSERT ON public.movimientos
FOR EACH ROW EXECUTE FUNCTION public.commercial_return_protect_history();
CREATE TRIGGER commercial_return_protect_ticket BEFORE UPDATE OR DELETE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.commercial_return_protect_history();
CREATE TRIGGER commercial_return_protect_line BEFORE UPDATE OR DELETE ON public.ticket_lineas
FOR EACH ROW EXECUTE FUNCTION public.commercial_return_protect_history();
CREATE TRIGGER commercial_return_protect_outflow BEFORE UPDATE OR DELETE ON public.salidas_dinero_caja
FOR EACH ROW EXECUTE FUNCTION public.commercial_return_protect_history();
COMMIT;