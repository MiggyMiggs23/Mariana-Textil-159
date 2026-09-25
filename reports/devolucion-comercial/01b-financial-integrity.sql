-- Install AFTER 01-schema.sql, while CLOSED. No session/GUC bypass.
-- Exact SQL mirror of projectCreditLedgerCore; amounts are integer cents.
BEGIN;
SET LOCAL search_path = pg_catalog, public;

CREATE FUNCTION public.commercial_return_projection(p_client integer, p_through integer)
RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog AS $f$
DECLARE
  ledger jsonb; charges jsonb := '[]'; sources jsonb := '[]';
  balances jsonb := '{}'; reductions jsonb := '{}'; reserved jsonb := '{}';
  ordinary jsonb := '[]'; explicit_trace jsonb := '[]';
  reversed_ids integer[]; m jsonb; s jsonb; t jsonb; a jsonb; target jsonb;
  k text; amount numeric; pending numeric; applied numeric; remaining numeric;
  favor numeric := 0; debt numeric := 0; normal_phase boolean;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',m.id,'ticket',m.ticket_id,'kind',m.tipo::text,'amount',m.importe*100,
    'at',floor(extract(epoch FROM m.created_at)*1000),'origin',m.movimiento_origen_id,
    'directed',d.id,'marked',COALESCE(m.metadata LIKE '%"preventImplicitFavor":true%',false),
    'applications',COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'target',a.venta_movimiento_id,'amount',a.importe*100) ORDER BY a.id)
      FROM public.aplicaciones_credito a JOIN public.movimientos_credito sale ON sale.id=a.venta_movimiento_id
      WHERE a.abono_movimiento_id=m.id AND sale.metadata LIKE '%"preventImplicitFavor":true%'), '[]'::jsonb)
  ) ORDER BY floor(extract(epoch FROM m.created_at)*1000),m.id),'[]'::jsonb)
  INTO ledger
  FROM public.movimientos_credito m
  LEFT JOIN public.solicitudes_pago_dirigido q ON q.tipo='CLIENTE' AND q.estado='APROBADA' AND q.movimiento_id=m.id
  LEFT JOIN public.movimientos_credito d ON d.id=q.documento_movimiento_id
    AND d.tipo='VENTA_CREDITO' AND d.cliente_id=m.cliente_id
  WHERE m.cliente_id=p_client AND m.id<=p_through;
  IF (SELECT count(*)<>count(DISTINCT value->>'id') FROM jsonb_array_elements(ledger)) THEN
    RAISE EXCEPTION 'DEVOLUCION_PROYECCION_IDENTIDAD_DUPLICADA';
  END IF;
  SELECT COALESCE(array_agg((value->>'origin')::integer),'{}'::integer[]) INTO reversed_ids
    FROM jsonb_array_elements(ledger)
    WHERE value->>'kind'='REVERSO' AND (value->>'amount')::numeric>0 AND value->>'origin' IS NOT NULL;
  FOR m IN SELECT value FROM jsonb_array_elements(ledger) LOOP
    amount := (m->>'amount')::numeric;
    IF amount='NaN'::numeric OR amount<>trunc(amount) THEN RAISE EXCEPTION 'DEVOLUCION_CENTAVOS_INVALIDOS'; END IF;
    IF m->>'kind'='REVERSO' AND m->>'ticket' IS NOT NULL AND amount<0 THEN
      k := m->>'ticket';
      reductions := jsonb_set(reductions,ARRAY[k],to_jsonb(COALESCE((reductions->>k)::numeric,0)-amount));
    END IF;
    IF m->>'kind'='DEVOLUCION_COMERCIAL'
      OR (m->>'kind'='ABONO' AND NOT (m->>'id')::integer=ANY(reversed_ids))
      OR (m->>'kind'='AJUSTE' AND amount<0) THEN sources := sources || jsonb_build_array(m); END IF;
    IF m->>'kind'='VENTA_CREDITO' OR (m->>'kind'='AJUSTE' AND amount>0) THEN
      charges := charges || jsonb_build_array(m);
    END IF;
  END LOOP;
  FOR m IN SELECT value FROM jsonb_array_elements(charges) LOOP
    pending := greatest(0,(m->>'amount')::numeric -
      CASE WHEN m->>'kind'='VENTA_CREDITO' THEN COALESCE((reductions->>(m->>'ticket'))::numeric,0) ELSE 0 END);
    balances := jsonb_set(balances,ARRAY[m->>'id'],to_jsonb(pending));
  END LOOP;
  FOR s IN SELECT value FROM jsonb_array_elements(sources) WHERE value->>'kind'='ABONO' AND value->>'directed' IS NOT NULL LOOP
    k := s->>'directed'; pending := COALESCE((balances->>k)::numeric,0);
    applied := least(pending,greatest(0,-(s->>'amount')::numeric));
    IF applied>0 THEN
      balances := jsonb_set(balances,ARRAY[k],to_jsonb(pending-applied));
      reserved := jsonb_set(reserved,ARRAY[s->>'id'],to_jsonb(applied));
    END IF;
  END LOOP;
  FOR s IN SELECT value FROM jsonb_array_elements(sources) LOOP
    IF s->>'kind'='DEVOLUCION_COMERCIAL' THEN
      k := s->>'origin';
      SELECT value INTO target FROM jsonb_array_elements(charges) WHERE value->>'id'=k;
      pending := (balances->>k)::numeric; amount := -(s->>'amount')::numeric;
      IF target IS NULL OR target->>'kind'<>'VENTA_CREDITO' OR target->>'ticket' IS DISTINCT FROM s->>'ticket'
        OR ((target->>'at')::numeric,(target->>'id')::integer)>=((s->>'at')::numeric,(s->>'id')::integer)
        OR pending IS NULL OR amount<0 OR amount>pending THEN RAISE EXCEPTION 'DEVOLUCION_PROYECCION_DEUDA_INVALIDA'; END IF;
      balances := jsonb_set(balances,ARRAY[k],to_jsonb(pending-amount));
      CONTINUE;
    END IF;
    remaining := greatest(0,-(s->>'amount')::numeric-COALESCE((reserved->>(s->>'id'))::numeric,0));
    -- Each explicit legacy application first settles older eligible charges.
    -- A final null sentinel performs the ordinary FIFO remainder.
    FOR a IN SELECT value FROM jsonb_array_elements(
      CASE WHEN s->>'kind'='ABONO' THEN s->'applications' ELSE '[]'::jsonb END || '[null]'::jsonb
    ) LOOP
      normal_phase := a='null'::jsonb;
      target := NULL;
      IF NOT normal_phase THEN
        IF (a->>'amount')::numeric<=0 THEN CONTINUE; END IF;
        SELECT value INTO target FROM jsonb_array_elements(charges) WHERE value->>'id'=a->>'target';
        IF target IS NULL THEN CONTINUE; END IF;
      END IF;
      FOR t IN SELECT value FROM jsonb_array_elements(charges) LOOP
        EXIT WHEN remaining<=0;
        IF NOT normal_phase AND ((t->>'at')::numeric,(t->>'id')::integer)>=
          ((target->>'at')::numeric,(target->>'id')::integer) THEN CONTINUE; END IF;
        IF (t->>'marked')::boolean AND ((t->>'at')::numeric,(t->>'id')::integer)>=
          ((s->>'at')::numeric,(s->>'id')::integer) THEN CONTINUE; END IF;
        k := t->>'id'; pending := (balances->>k)::numeric;
        applied := least(remaining,pending);
        IF applied<=0 THEN CONTINUE; END IF;
        balances := jsonb_set(balances,ARRAY[k],to_jsonb(pending-applied)); remaining := remaining-applied;
        ordinary := ordinary || jsonb_build_array(jsonb_build_object(
          'source',s->'id','target',t->'id','amount',applied,'before',pending,'after',pending-applied));
      END LOOP;
      IF NOT normal_phase AND remaining>0 THEN
        k := target->>'id'; pending := (balances->>k)::numeric;
        applied := least(remaining,pending,(a->>'amount')::numeric);
        IF applied>0 THEN
          balances := jsonb_set(balances,ARRAY[k],to_jsonb(pending-applied)); remaining := remaining-applied;
          explicit_trace := explicit_trace || jsonb_build_array(jsonb_build_object(
            'source',s->'id','target',target->'id','amount',applied,'before',pending,'after',pending-applied));
        END IF;
      END IF;
    END LOOP;
    favor := favor+remaining;
  END LOOP;
  SELECT COALESCE(sum(value::numeric),0) INTO debt FROM jsonb_each_text(balances);
  RETURN jsonb_build_object('ledger',ledger,'charges',charges,'balances',balances,
    'allocations',ordinary || explicit_trace,'favor',favor,'debt',debt);
END $f$;

CREATE FUNCTION public.commercial_return_assert_financial(p_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $f$
DECLARE
  r public.devoluciones_comerciales%ROWTYPE; sale public.tickets%ROWTYPE;
  before_p jsonb; after_p jsonb; current_p jsonb; charge jsonb; charge_count integer;
  source_ids integer[]; paid numeric; pending numeric; remaining numeric;
  prior_refund numeric; prior_gross numeric;
BEGIN
  SELECT * INTO STRICT r FROM public.devoluciones_comerciales WHERE id=p_id;
  SELECT * INTO STRICT sale FROM public.tickets WHERE id=r.ticket_id;
  IF sale.estado<>'VENDIDO' OR sale.documento_tipo<>'NOTA' OR sale.autorizacion_estado<>'AUTORIZADA'
    OR sale.total<>sale.subtotal+sale.iva OR sale.subtotal<=0
    OR sale.subtotal IS DISTINCT FROM (SELECT sum(importe) FROM public.ticket_lineas WHERE ticket_id=r.ticket_id)
    OR EXISTS (SELECT 1 FROM public.ticket_lineas WHERE ticket_id=r.ticket_id AND (tipo<>'NORMAL' OR rollo_id IS NULL))
    OR NOT EXISTS (SELECT 1 FROM public.ticket_lineas l WHERE l.id=r.linea_id
      AND l.ticket_id=r.ticket_id AND l.rollo_id=r.rollo_id AND l.tipo='NORMAL' AND l.cantidad=r.cantidad
      AND r.importe_rollo*sale.subtotal=l.importe*sale.total)
    OR NOT EXISTS (SELECT 1 FROM public.operaciones_credito_e1 o
      WHERE o.productor='DEVOLUCION_COMERCIAL' AND o.clave=r.id
      AND o.naturaleza='OPERACION_CREDITO_SIN_DINERO' AND o.usuario_id=r.actor_id
      AND o.solicitud_canonica=r.request)
  THEN RAISE EXCEPTION 'DEVOLUCION_DOCUMENTO_ORIGEN_ALTERADO'; END IF;
  before_p := public.commercial_return_projection(sale.cliente_id,r.movimiento_credito_id-1);
  after_p := public.commercial_return_projection(sale.cliente_id,r.movimiento_credito_id);
  current_p := public.commercial_return_projection(sale.cliente_id,2147483647);
  SELECT count(*) INTO charge_count FROM jsonb_array_elements(before_p->'charges')
    WHERE value->>'kind'='VENTA_CREDITO' AND (value->>'ticket')::integer=r.ticket_id;
  SELECT value INTO charge FROM jsonb_array_elements(before_p->'charges')
    WHERE value->>'kind'='VENTA_CREDITO' AND (value->>'ticket')::integer=r.ticket_id LIMIT 1;
  IF charge_count<>1 OR (charge->>'amount')::numeric<>sale.total*100 OR EXISTS (
    SELECT 1 FROM public.movimientos_credito m
    WHERE m.tipo='REVERSO' AND (m.ticket_id=r.ticket_id OR m.movimiento_origen_id=ANY(r.fuentes_pago))
  ) THEN RAISE EXCEPTION 'DEVOLUCION_HISTORIA_NO_CONCILIADA'; END IF;
  SELECT COALESCE(sum((value->>'amount')::numeric),0) INTO paid
    FROM jsonb_array_elements(before_p->'allocations') WHERE value->>'target'=charge->>'id';
  paid := paid + (SELECT COALESCE(sum(-(value->>'amount')::numeric),0)
    FROM jsonb_array_elements(before_p->'ledger')
    WHERE value->>'kind'='ABONO' AND value->>'directed'=charge->>'id');
  SELECT COALESCE(array_agg(id ORDER BY id),'{}'::integer[]) INTO source_ids FROM (
    SELECT (value->>'source')::integer AS id FROM jsonb_array_elements(before_p->'allocations')
      WHERE value->>'target'=charge->>'id'
    UNION SELECT (value->>'id')::integer FROM jsonb_array_elements(before_p->'ledger')
      WHERE value->>'kind'='ABONO' AND value->>'directed'=charge->>'id'
  ) ids;
  IF source_ids IS DISTINCT FROM (SELECT COALESCE(array_agg(id ORDER BY id),'{}'::integer[]) FROM unnest(r.fuentes_pago) f(id))
    OR EXISTS (SELECT 1 FROM public.movimientos_credito m WHERE m.id=ANY(source_ids)
      AND (m.tipo<>'ABONO' OR m.naturaleza IS DISTINCT FROM 'INGRESO_FISICO'::public.naturaleza_credito_e1
        OR NOT EXISTS (SELECT 1 FROM public.operaciones_credito_e1 o
          WHERE o.productor=m.operacion_productor AND o.clave=m.operacion_clave
            AND o.naturaleza=m.naturaleza AND o.usuario_id=m.usuario_id)))
  THEN RAISE EXCEPTION 'DEVOLUCION_FUENTES_NO_CANONICAS'; END IF;
  SELECT COALESCE(sum(efectivo_devuelto),0)*100,COALESCE(sum(importe_rollo),0)*100
    INTO prior_refund,prior_gross FROM public.devoluciones_comerciales
    WHERE ticket_id=r.ticket_id AND movimiento_credito_id<r.movimiento_credito_id;
  remaining := sale.total*100-prior_gross; paid := paid-prior_refund;
  pending := (before_p->'balances'->>(charge->>'id'))::numeric;
  IF remaining<=0 OR paid<0 OR pending<0 OR paid+pending<>remaining
    OR r.deuda_cancelada*100*remaining<>pending*r.importe_rollo*100
    OR r.efectivo_devuelto*100*remaining<>paid*r.importe_rollo*100
    OR after_p->'allocations' IS DISTINCT FROM before_p->'allocations'
    OR after_p->'favor' IS DISTINCT FROM before_p->'favor'
    OR (after_p->>'debt')::numeric<>(before_p->>'debt')::numeric-r.deuda_cancelada*100
  THEN RAISE EXCEPTION 'DEVOLUCION_REPARTO_NO_CANONICO'; END IF;
  -- New receipts may settle the remaining debt, but later reversals/directed
  -- applications must not reassign the old money that funded this return.
  IF EXISTS (
    WITH old_allocations AS (
      SELECT (value->>'source')::integer AS source,sum((value->>'amount')::numeric) AS amount
      FROM jsonb_array_elements(before_p->'allocations')
      WHERE value->>'target'=charge->>'id' GROUP BY 1
    ), live_allocations AS (
      SELECT (value->>'source')::integer AS source,sum((value->>'amount')::numeric) AS amount
      FROM jsonb_array_elements(current_p->'allocations')
      WHERE value->>'target'=charge->>'id' AND (value->>'source')::integer<r.movimiento_credito_id GROUP BY 1
    ) SELECT 1 FROM old_allocations o FULL JOIN live_allocations l USING(source)
      WHERE o.amount IS DISTINCT FROM l.amount
  ) THEN RAISE EXCEPTION 'DEVOLUCION_APLICACION_HISTORICA_ALTERADA'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.movimientos_credito m WHERE m.id=r.movimiento_credito_id
    AND m.tipo::text='DEVOLUCION_COMERCIAL' AND m.ticket_id=r.ticket_id AND m.cliente_id=sale.cliente_id
    AND m.movimiento_origen_id=(charge->>'id')::integer AND m.importe=-r.deuda_cancelada
    AND m.usuario_id=r.actor_id AND m.operacion_productor='DEVOLUCION_COMERCIAL' AND m.operacion_clave=r.id
    AND m.naturaleza='OPERACION_CREDITO_SIN_DINERO' AND m.sitio_origen_id=r.ubicacion_recepcion_id
    AND m.sesion_caja_id IS NULL AND m.forma_pago IS NULL AND m.cuenta_destino IS NULL
    AND NOT m.es_incobrable AND m.origen_justificacion=r.motivo AND m.created_at=r.created_at
    AND m.metadata::jsonb @> jsonb_build_object('commercialReturnId',r.id,
      'importeRollo',r.importe_rollo::text,'efectivoDevuelto',r.efectivo_devuelto::text))
  THEN RAISE EXCEPTION 'DEVOLUCION_EVENTO_FINANCIERO_ALTERADO'; END IF;
  IF NOT (r.request @> jsonb_build_object('uuidCliente',r.uuid_cliente,'ticketId',r.ticket_id,'lineaId',r.linea_id,
      'ubicacionRecepcionId',r.ubicacion_recepcion_id,'sesionCajaId',r.sesion_caja_id,'cantidad',r.cantidad::text,'motivo',r.motivo,
      'revision',jsonb_build_object('importeRollo',r.importe_rollo::text,'deudaCancelada',r.deuda_cancelada::text,'efectivoDevuelto',r.efectivo_devuelto::text)))
    OR NOT (r.response @> jsonb_build_object('id',r.id,'ticketId',r.ticket_id,'lineaId',r.linea_id,'rolloId',r.rollo_id,
      'ubicacionRecepcionId',r.ubicacion_recepcion_id,'sesionCajaId',r.sesion_caja_id,'cantidad',r.cantidad::text,
      'motivo',r.motivo,'importeRollo',r.importe_rollo::text,'deudaCancelada',r.deuda_cancelada::text,'efectivoDevuelto',r.efectivo_devuelto::text))
    OR (r.response->>'createdAt')::timestamptz IS DISTINCT FROM r.created_at
    OR r.response->>'serie' IS DISTINCT FROM (SELECT serie FROM public.rollos WHERE id=r.rollo_id)
  THEN RAISE EXCEPTION 'DEVOLUCION_DOCUMENTO_ALTERADO'; END IF;
END $f$;

-- A real row-write fence, not a caller-controlled session flag. It also makes
-- stale REPEATABLE READ / SERIALIZABLE writers fail rather than certify an old
-- snapshot after waiting for another transaction.
CREATE TABLE public.commercial_return_customer_fence (
  cliente_id integer PRIMARY KEY REFERENCES public.clientes(id),
  generation bigint NOT NULL DEFAULT 0
);
CREATE FUNCTION public.commercial_return_lock_customer() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $f$
DECLARE old_row jsonb := CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  new_row jsonb := CASE WHEN TG_OP='DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  client integer;
BEGIN
  FOR client IN
    SELECT DISTINCT id FROM (
      SELECT (old_row->>'cliente_id')::integer AS id UNION SELECT (new_row->>'cliente_id')::integer
      UNION SELECT m.cliente_id FROM public.movimientos_credito m
        WHERE m.id IN ((old_row->>'abono_movimiento_id')::integer,(new_row->>'abono_movimiento_id')::integer,
          (old_row->>'venta_movimiento_id')::integer,(new_row->>'venta_movimiento_id')::integer,
          (old_row->>'movimiento_id')::integer,(new_row->>'movimiento_id')::integer,
          (old_row->>'documento_movimiento_id')::integer,(new_row->>'documento_movimiento_id')::integer)
      UNION SELECT t.cliente_id FROM public.tickets t
        WHERE t.id IN ((old_row->>'ticket_id')::integer,(new_row->>'ticket_id')::integer)
      UNION SELECT m.cliente_id FROM public.movimientos_credito m
        WHERE m.operacion_productor IN (old_row->>'productor',new_row->>'productor')
          AND m.operacion_clave IN ((old_row->>'clave')::uuid,(new_row->>'clave')::uuid)
      UNION SELECT t.cliente_id FROM public.ticket_lineas l JOIN public.tickets t ON t.id=l.ticket_id
        WHERE l.rollo_id IN ((old_row->>'rollo_id')::integer,(new_row->>'rollo_id')::integer,
          CASE WHEN TG_TABLE_NAME='rollos' THEN (old_row->>'id')::integer END,
          CASE WHEN TG_TABLE_NAME='rollos' THEN (new_row->>'id')::integer END)
    ) clients WHERE id IS NOT NULL ORDER BY id
  LOOP
    PERFORM pg_advisory_xact_lock(650006,client);
    INSERT INTO public.commercial_return_customer_fence VALUES (client,1)
      ON CONFLICT (cliente_id) DO UPDATE SET generation=public.commercial_return_customer_fence.generation+1;
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $f$;
CREATE FUNCTION public.commercial_return_recheck_finances() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $f$
DECLARE r record;
BEGIN
  -- Recheck historical prefixes, never today's physical roll/session state.
  -- Later legitimate receipts/resales/cash closes remain possible.
  FOR r IN SELECT id FROM public.devoluciones_comerciales ORDER BY movimiento_credito_id LOOP
    PERFORM public.commercial_return_assert_financial(r.id);
  END LOOP;
  RETURN NULL;
END $f$;
DO $f$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['movimientos_credito','aplicaciones_credito','solicitudes_pago_dirigido',
    'devoluciones_comerciales','tickets','ticket_lineas','operaciones_credito_e1','movimientos','rollos'] LOOP
    EXECUTE format('CREATE TRIGGER commercial_return_lock BEFORE INSERT OR UPDATE OR DELETE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.commercial_return_lock_customer()',table_name);
    EXECUTE format('CREATE CONSTRAINT TRIGGER commercial_return_financial_final AFTER INSERT OR UPDATE OR DELETE ON public.%I
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.commercial_return_recheck_finances()',table_name);
  END LOOP;
END $f$;

CREATE FUNCTION public.commercial_return_protect_linked_rows() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $f$
DECLARE old_row jsonb := to_jsonb(OLD); new_row jsonb := CASE WHEN TG_OP='DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
BEGIN
  IF TG_TABLE_NAME='movimientos' AND EXISTS (
    SELECT 1 FROM public.devoluciones_comerciales r WHERE r.movimiento_inventario_id=OLD.id
      OR (old_row->>'tipo'='VENTA' AND (old_row->>'rollo_id')::integer=r.rollo_id AND old_row->>'documento_id'=r.ticket_id::text)
  ) THEN RAISE EXCEPTION 'DEVOLUCION_INVENTARIO_HISTORICO_INMUTABLE'; END IF;
  IF TG_TABLE_NAME='movimientos_credito' AND EXISTS (
    SELECT 1 FROM public.devoluciones_comerciales r JOIN public.tickets t ON t.id=r.ticket_id
    WHERE t.cliente_id=(old_row->>'cliente_id')::integer AND OLD.id<=r.movimiento_credito_id
  ) THEN RAISE EXCEPTION 'DEVOLUCION_LEDGER_HISTORICO_INMUTABLE'; END IF;
  IF TG_TABLE_NAME='rollos' AND EXISTS (SELECT 1 FROM public.devoluciones_comerciales WHERE rollo_id=OLD.id)
    AND (TG_OP='DELETE' OR old_row->'serie' IS DISTINCT FROM new_row->'serie'
      OR old_row->'producto_id' IS DISTINCT FROM new_row->'producto_id') THEN
    RAISE EXCEPTION 'DEVOLUCION_IDENTIDAD_ROLLO_INMUTABLE';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $f$;
CREATE TRIGGER commercial_return_linked_history BEFORE UPDATE OR DELETE ON public.movimientos
FOR EACH ROW EXECUTE FUNCTION public.commercial_return_protect_linked_rows();
CREATE TRIGGER commercial_return_linked_history BEFORE UPDATE OR DELETE ON public.movimientos_credito
FOR EACH ROW EXECUTE FUNCTION public.commercial_return_protect_linked_rows();
CREATE TRIGGER commercial_return_linked_history BEFORE UPDATE OR DELETE ON public.rollos
FOR EACH ROW EXECUTE FUNCTION public.commercial_return_protect_linked_rows();
CREATE CONSTRAINT TRIGGER commercial_return_inventory_history_final AFTER INSERT ON public.movimientos
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.commercial_return_protect_history();
-- Also catch mutation-before-capture in the SAME transaction. BEFORE-only
-- existence tests are insufficient when evidence is appended later.
DO $f$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['movimientos','movimientos_credito','rollos'] LOOP
    EXECUTE format('CREATE CONSTRAINT TRIGGER commercial_return_linked_history_final AFTER UPDATE OR DELETE ON public.%I
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.commercial_return_protect_linked_rows()',table_name);
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['tickets','ticket_lineas','salidas_dinero_caja'] LOOP
    EXECUTE format('CREATE CONSTRAINT TRIGGER commercial_return_document_history_final AFTER UPDATE OR DELETE ON public.%I
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.commercial_return_protect_history()',table_name);
  END LOOP;
END $f$;

CREATE TABLE public.commercial_return_cash_fence (sesion_id integer PRIMARY KEY, generation bigint NOT NULL);
CREATE FUNCTION public.commercial_return_lock_cash() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $f$
DECLARE old_row jsonb := CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  new_row jsonb := CASE WHEN TG_OP='DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  session_id integer; site_id integer;
BEGIN
  FOR session_id IN SELECT DISTINCT id FROM (
    SELECT (old_row->>'sesion_caja_id')::integer AS id UNION SELECT (new_row->>'sesion_caja_id')::integer
    UNION SELECT (old_row->>'id')::integer WHERE TG_TABLE_NAME='sesiones_caja'
    UNION SELECT (new_row->>'id')::integer WHERE TG_TABLE_NAME='sesiones_caja'
    UNION SELECT sesion_caja_id FROM public.tickets
      WHERE id IN ((old_row->>'ticket_id')::integer,(new_row->>'ticket_id')::integer)
  ) sessions WHERE id IS NOT NULL ORDER BY id LOOP
    SELECT ubicacion_id INTO site_id FROM public.sesiones_caja WHERE id=session_id;
    IF site_id IS NOT NULL THEN PERFORM pg_advisory_xact_lock(650005,site_id); END IF;
    INSERT INTO public.commercial_return_cash_fence VALUES (session_id,1)
      ON CONFLICT (sesion_id) DO UPDATE SET generation=public.commercial_return_cash_fence.generation+1;
  END LOOP;
  IF TG_TABLE_NAME='sesiones_caja' AND TG_OP='UPDATE'
    AND old_row->'ubicacion_id' IS DISTINCT FROM new_row->'ubicacion_id'
    AND EXISTS (SELECT 1 FROM public.devoluciones_comerciales WHERE sesion_caja_id=(old_row->>'id')::integer)
  THEN RAISE EXCEPTION 'DEVOLUCION_CAJA_SITIO_INMUTABLE'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $f$;
DO $f$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['sesiones_caja','ticket_pagos','tickets','movimientos_credito',
    'cobros_credito_pendientes_e1','salidas_dinero_caja','devoluciones_comerciales'] LOOP
    EXECUTE format('CREATE TRIGGER zz_commercial_return_cash_lock BEFORE INSERT OR UPDATE OR DELETE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.commercial_return_lock_cash()',table_name);
  END LOOP;
END $f$;
CREATE FUNCTION public.commercial_return_cash_final() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $f$
DECLARE expected numeric; invalid boolean;
BEGIN
  -- Matches readOpenCash while E12_SUPPLIER_CASH_ENABLED=false. No E5 mirror,
  -- applications, transfers or accounting cancellations are physical income.
  WITH documents AS (
    SELECT 'FONDO:'||id AS identity,fondo_inicial AS amount,1 AS sign FROM public.sesiones_caja WHERE id=NEW.sesion_caja_id
    UNION ALL SELECT 'TICKET:'||p.id,p.importe,1 FROM public.ticket_pagos p JOIN public.tickets t ON t.id=p.ticket_id
      WHERE t.sesion_caja_id=NEW.sesion_caja_id AND t.estado='VENDIDO' AND p.forma_pago='EFECTIVO'
    UNION ALL SELECT 'RECEIPT:'||m.operacion_productor||':'||m.operacion_clave,-m.importe,1 FROM public.movimientos_credito m
      WHERE m.sesion_caja_id=NEW.sesion_caja_id AND m.naturaleza='INGRESO_FISICO'
        AND m.forma_pago='EFECTIVO' AND m.cuenta_destino='CAJA_FISICA'
    UNION ALL SELECT 'RECEIPT:'||c.operacion_productor||':'||c.operacion_clave,c.importe,1 FROM public.cobros_credito_pendientes_e1 c
      WHERE c.sesion_caja_id=NEW.sesion_caja_id AND c.naturaleza='INGRESO_FISICO'
        AND c.medio='EFECTIVO' AND c.cuenta_destino='CAJA_FISICA'
    UNION ALL SELECT 'SALIDA:'||id,monto,-1 FROM public.salidas_dinero_caja
      WHERE sesion_caja_id=NEW.sesion_caja_id AND cuenta_origen='CAJA_FISICA'
  ) SELECT COALESCE(sum(amount*sign),0),
    count(*)<>count(DISTINCT identity) OR COALESCE(bool_or(amount<0 OR amount='NaN'::numeric OR amount*100<>trunc(amount*100)),false)
    INTO expected,invalid FROM documents;
  IF invalid OR expected<0 OR EXISTS (
    SELECT 1 FROM public.movimientos_credito WHERE sesion_caja_id=NEW.sesion_caja_id
      AND naturaleza='INGRESO_FISICO' AND forma_pago='EFECTIVO' AND cuenta_destino='CAJA_FISICA'
      AND (tipo<>'ABONO' OR operacion_productor NOT IN ('ABONO_ORDINARIO','ABONO_DIRIGIDO') OR operacion_clave IS NULL OR importe>=0)
  ) OR EXISTS (
    SELECT 1 FROM public.cobros_credito_pendientes_e1 WHERE sesion_caja_id=NEW.sesion_caja_id
      AND naturaleza='INGRESO_FISICO' AND medio='EFECTIVO' AND cuenta_destino='CAJA_FISICA'
      AND (operacion_productor<>'COBRO_PENDIENTE' OR operacion_clave IS NULL)
  ) THEN RAISE EXCEPTION 'DEVOLUCION_EFECTIVO_NO_CONCILIADO'; END IF;
  RETURN NULL;
END $f$;
CREATE CONSTRAINT TRIGGER commercial_return_cash_final AFTER INSERT ON public.devoluciones_comerciales
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.commercial_return_cash_final();

-- No endpoint, setting, current_user label or claimed ADMIN may disable these
-- invariants. As with all PostgreSQL constraints, runtime roles MUST NOT own
-- tables/functions, be superusers or be able to SET ROLE to the DDL owner.
REVOKE ALL ON FUNCTION public.commercial_return_projection(integer,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commercial_return_assert_financial(uuid) FROM PUBLIC;
ALTER TABLE public.commercial_return_gate DROP CONSTRAINT commercial_return_integrity_uninstalled;
COMMIT;