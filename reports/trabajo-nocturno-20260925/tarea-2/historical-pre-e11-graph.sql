CREATE OR REPLACE FUNCTION public.e5_graph_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE r record; c record; a record; p jsonb; x jsonb; m record;
  total numeric; returned numeric; d record; o record; prev jsonb; v record; k text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.e5_operaciones o JOIN public.e5_impresiones i USING(clave))
  THEN RAISE EXCEPTION 'E5: clave global operación/impresión duplicada'; END IF;
  FOR r IN SELECT * FROM public.e5_recepciones LOOP
    SELECT * INTO c FROM public.e5_cobros WHERE id=r.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'E5: recepción sin agregado'; END IF;
    IF c.cliente_id<>r.cliente_id OR c.ubicacion_id<>r.ubicacion_id
      OR (r.snapshot->>'importeRecibido')::numeric IS DISTINCT FROM r.importe
      OR (r.snapshot->>'fechaRecepcion')::timestamptz IS DISTINCT FROM r.fecha_recepcion
      OR (r.snapshot#>>'{receptor,id}')::integer IS DISTINCT FROM r.actor_id
      OR r.snapshot->>'formaPago' IS DISTINCT FROM r.medio
      OR r.snapshot->>'cuentaDestino' IS DISTINCT FROM r.cuenta_destino
      OR (r.snapshot->>'sesionCajaId')::integer IS DISTINCT FROM r.sesion_caja_id
    THEN RAISE EXCEPTION 'E5: columnas y fuente snapshot divergentes'; END IF;
    FOREACH k IN ARRAY ARRAY['id','clienteId','clienteNombre','ubicacionId','ubicacionNombre',
      'importeRecibido','fechaRecepcion','formaPago','cuentaDestino','sesionCajaId','sesionOperativaId',
      'receptor','notasIndicadas','evidenciaRecepcion','reciboId'] LOOP
      IF c.detail->k IS DISTINCT FROM r.snapshot->k
      THEN RAISE EXCEPTION 'E5: agregado difiere de fuente original (%)',k; END IF;
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.cobros_credito_pendientes_e1 s
      JOIN public.e5_nacimientos b ON b.tabla='cobros_credito_pendientes_e1'
        AND b.clave=s.operacion_clave::text AND b.birth_xid=r.birth_xid
      WHERE s.operacion_productor='COBRO_PENDIENTE' AND s.operacion_clave=r.id
        AND s.cliente_id=r.cliente_id AND s.importe=r.importe AND s.fecha_real=r.fecha_recepcion
        AND s.sitio_origen_id=r.ubicacion_id AND s.medio::text=r.medio
        AND s.cuenta_destino=r.cuenta_destino AND s.sesion_caja_id IS NOT DISTINCT FROM r.sesion_caja_id
        AND s.usuario_id=r.actor_id)
    THEN RAISE EXCEPTION 'E5: fuente E1 exacta/inserción propia requerida'; END IF;
    IF EXISTS (SELECT 1 FROM public.movimientos_credito
      WHERE operacion_productor='COBRO_PENDIENTE' AND operacion_clave=r.id)
    THEN RAISE EXCEPTION 'E5: recepción fuera del ledger'; END IF;
    SELECT coalesce(sum(importe),0) INTO total FROM public.e5_aplicaciones WHERE cobro_id=r.id;
    SELECT coalesce(sum(importe),0) INTO returned FROM public.e5_devoluciones WHERE cobro_id=r.id;
    IF total+returned>r.importe OR (total>0 AND returned>0)
      OR (returned>0 AND returned<>r.importe)
      OR (c.detail->>'importeRecibido')::numeric IS DISTINCT FROM r.importe
      OR (c.detail->>'importeAplicado')::numeric IS DISTINCT FROM total
      OR (c.detail->>'importeDevuelto')::numeric IS DISTINCT FROM returned
      OR (c.detail->>'importePendiente')::numeric IS DISTINCT FROM r.importe-total-returned
      OR (c.detail->>'algunaVezAplicado')::boolean IS DISTINCT FROM (total>0)
      OR c.detail->>'estado' IS DISTINCT FROM
        (CASE WHEN returned>0 THEN 'DEVUELTO' WHEN total=0 THEN 'PENDIENTE'
          WHEN total=r.importe THEN 'APLICADO' ELSE 'PARCIAL' END)
    THEN RAISE EXCEPTION 'E5: conservación/estado/irreversibilidad'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.e5_documentos doc
      WHERE doc.id=(c.detail->>'reciboId')::uuid AND doc.cobro_id=r.id AND doc.tipo='RECIBO'
        AND doc.birth_xid=r.birth_xid AND doc.snapshot->'asignaciones'='[]'::jsonb
        AND (doc.snapshot->>'importeDocumento')::numeric=r.importe
        AND (doc.snapshot->>'pendienteEnEmision')::numeric=r.importe
        AND (doc.snapshot->>'importeFavorGenerado')::numeric=0)
    THEN RAISE EXCEPTION 'E5: recibo inmediato inmutable requerido'; END IF;
    IF (SELECT count(*) FROM public.e5_operaciones WHERE cobro_id=r.id)<>c.revision
      OR NOT EXISTS (SELECT 1 FROM public.e5_operaciones
        WHERE cobro_id=r.id AND revision=c.revision AND response=c.detail)
    THEN RAISE EXCEPTION 'E5: historia/revisión completa requerida'; END IF;
    FOR x IN SELECT value FROM jsonb_array_elements(c.detail->'aplicaciones') LOOP
      IF NOT EXISTS (SELECT 1 FROM public.e5_aplicaciones WHERE cobro_id=r.id
        AND grupo_id=(x->>'id')::uuid AND snapshot=x)
      THEN RAISE EXCEPTION 'E5: aplicación JSON sin consumo'; END IF;
    END LOOP;
    IF (c.detail ? 'devolucion') IS DISTINCT FROM (returned>0)
    THEN RAISE EXCEPTION 'E5: devolución JSON sin efecto'; END IF;
  END LOOP;
  FOR a IN SELECT * FROM public.e5_aplicaciones LOOP
    SELECT * INTO c FROM public.e5_cobros WHERE id=a.cobro_id;
    SELECT value INTO p FROM jsonb_array_elements(c.detail->'propuestas')
      WHERE value->>'id'=a.propuesta_id::text;
    SELECT * INTO r FROM public.e5_recepciones WHERE id=a.cobro_id;
    IF p IS NULL OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(c.detail->'aplicaciones')
      WHERE value=a.snapshot) OR a.snapshot->>'id' IS DISTINCT FROM a.grupo_id::text
      OR a.snapshot->>'propuestaId' IS DISTINCT FROM a.propuesta_id::text
      OR (a.snapshot#>>'{actor,id}')::integer IS DISTINCT FROM a.actor_id
      OR (a.snapshot->>'fechaAplicacion')::timestamptz IS DISTINCT FROM a.fecha_aplicacion
      OR a.fecha_aplicacion<r.fecha_recepcion
      OR EXISTS (SELECT 1 FROM public.e5_aplicaciones b WHERE b.propuesta_id=a.propuesta_id
        AND (b.grupo_id<>a.grupo_id OR b.cobro_id<>a.cobro_id OR b.snapshot<>a.snapshot))
    THEN RAISE EXCEPTION 'E5: aprobación ADMIN/versión única'; END IF;
    SELECT coalesce(sum(importe),0) INTO total FROM public.e5_aplicaciones WHERE grupo_id=a.grupo_id;
    IF jsonb_typeof(a.snapshot->'asignaciones') IS DISTINCT FROM 'array'
      OR (SELECT count(*) FROM jsonb_array_elements(a.snapshot->'asignaciones')) <>
        (SELECT count(DISTINCT value->>'movimientoVentaId') FROM jsonb_array_elements(a.snapshot->'asignaciones'))
    THEN RAISE EXCEPTION 'E5: aprobación duplica movimiento exacto'; END IF;
    FOR x IN SELECT value FROM jsonb_array_elements(a.snapshot->'asignaciones') LOOP
      IF coalesce(x->>'importe','') !~ '^(0|[1-9][0-9]*)\.[0-9]{2}$'
        OR (x->>'importe')::numeric<=0 OR NOT EXISTS (SELECT 1 FROM public.e5_aplicaciones b
          WHERE b.grupo_id=a.grupo_id AND NOT b.favor
            AND b.movimiento_venta_id=(x->>'movimientoVentaId')::integer AND b.importe=(x->>'importe')::numeric)
      THEN RAISE EXCEPTION 'E5: asignación autorizada sin consumo exacto'; END IF;
    END LOOP;
    IF total IS DISTINCT FROM (a.snapshot->>'importe')::numeric
      OR total IS DISTINCT FROM (SELECT coalesce(sum((value->>'importe')::numeric),0)
        FROM jsonb_array_elements(a.snapshot->'asignaciones'))
        + coalesce((a.snapshot->>'importeFavorGenerado')::numeric,0)
    THEN RAISE EXCEPTION 'E5: consumo exacto de aprobación'; END IF;
    IF a.favor THEN
      IF a.importe IS DISTINCT FROM (a.snapshot->>'importeFavorGenerado')::numeric
        OR a.importe>coalesce((p->>'importeFavorPropuesto')::numeric,0)
      THEN RAISE EXCEPTION 'E5: favor no autorizado'; END IF;
    ELSE
      SELECT * INTO m FROM public.movimientos_credito WHERE id=a.movimiento_venta_id;
      IF m.cliente_id IS DISTINCT FROM r.cliente_id OR m.tipo::text IS DISTINCT FROM 'VENTA_CREDITO'
        OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(a.snapshot->'asignaciones') q(value)
          JOIN jsonb_array_elements(p->'asignaciones') s(value)
            ON q.value->>'movimientoVentaId'=s.value->>'movimientoVentaId' AND q.value->>'notaId'=s.value->>'notaId'
          WHERE (q.value->>'movimientoVentaId')::integer=a.movimiento_venta_id
            AND (q.value->>'notaId')::integer=m.ticket_id AND (q.value->>'importe')::numeric=a.importe
            AND a.importe<=(s.value->>'importe')::numeric)
      THEN RAISE EXCEPTION 'E5: destino exacto/subconjunto de propuesta'; END IF;
    END IF;
    SELECT mc.* INTO m FROM public.e5_vinculos_credito v
      JOIN public.movimientos_credito mc ON mc.id=v.movimiento_id
      WHERE v.aplicacion_id=a.id AND v.birth_xid=a.birth_xid;
    IF NOT FOUND OR m.operacion_productor IS DISTINCT FROM 'E5_APLICACION_RETENIDA'
      OR m.operacion_clave IS DISTINCT FROM a.id OR m.tipo::text IS DISTINCT FROM 'ABONO'
      OR m.naturaleza::text IS DISTINCT FROM 'OPERACION_CREDITO_SIN_DINERO'
      OR m.importe IS DISTINCT FROM -a.importe OR m.cliente_id IS DISTINCT FROM r.cliente_id
      OR m.usuario_id IS DISTINCT FROM a.actor_id OR m.created_at IS DISTINCT FROM a.fecha_aplicacion
      OR m.sitio_origen_id IS DISTINCT FROM r.ubicacion_id OR m.forma_pago IS NOT NULL
      OR m.cuenta_destino IS NOT NULL OR m.sesion_caja_id IS NOT NULL
      OR NOT EXISTS (SELECT 1 FROM public.e5_nacimientos WHERE tabla='movimientos_credito'
        AND clave=m.id::text AND birth_xid=a.birth_xid)
    THEN RAISE EXCEPTION 'E5: vínculo único crédito sin segundo ingreso'; END IF;
    IF EXISTS (SELECT 1 FROM public.movimientos_credito WHERE movimiento_origen_id=m.id)
    THEN RAISE EXCEPTION 'E5: reverso independiente de crédito aplicado prohibido'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.operaciones_credito_e1 op
      JOIN public.e5_nacimientos b ON b.tabla='operaciones_credito_e1'
        AND b.clave=op.productor||':'||op.clave::text AND b.birth_xid=a.birth_xid
      WHERE op.productor='E5_APLICACION_RETENIDA' AND op.clave=a.id
        AND op.naturaleza::text='OPERACION_CREDITO_SIN_DINERO' AND op.usuario_id=a.actor_id)
    THEN RAISE EXCEPTION 'E5: operación E1 propia exacta requerida'; END IF;
    IF a.favor THEN
      -- La emisión no paga destinos; FIFO futuro sí puede consumir este abono.
      -- Se compara procedencia persistida de cada INSERT, no el XID actual del
      -- validador ni xmin: forzar IMMEDIATE y escribir después no borra prueba.
      IF EXISTS (SELECT 1 FROM public.aplicaciones_credito ac
        LEFT JOIN public.e5_nacimientos b ON b.tabla='aplicaciones_credito' AND b.clave=ac.id::text
        WHERE ac.abono_movimiento_id=m.id AND
          (b.birth_xid IS NULL OR b.birth_xid=a.birth_xid))
        OR EXISTS (SELECT 1 FROM public.solicitudes_pago_dirigido WHERE movimiento_id=m.id)
      THEN RAISE EXCEPTION 'E5: emisión de favor sin aplicación ni marcador dirigido'; END IF;
      IF (SELECT coalesce(sum(importe),0) FROM public.aplicaciones_credito
        WHERE abono_movimiento_id=m.id)>a.importe OR EXISTS (
        SELECT 1 FROM public.aplicaciones_credito ac
        JOIN public.movimientos_credito sale ON sale.id=ac.venta_movimiento_id
        WHERE ac.abono_movimiento_id=m.id AND
          (ac.importe<=0 OR ac.importe>='Infinity'::numeric
          OR sale.tipo::text<>'VENTA_CREDITO' OR sale.cliente_id<>m.cliente_id))
      THEN RAISE EXCEPTION 'E5: evidencia FIFO futura excede fuente o cambia cliente'; END IF;
      -- Sin SUM por destino ni saldo dinámico. No reescribir aplicaciones
      -- históricas si la proyección canónica cambia por fecha efectiva.
    ELSE
      IF (SELECT count(*) FROM public.aplicaciones_credito WHERE abono_movimiento_id=m.id)<>1
        OR NOT EXISTS (SELECT 1 FROM public.aplicaciones_credito WHERE abono_movimiento_id=m.id
          AND venta_movimiento_id=a.movimiento_venta_id AND importe=a.importe)
        OR (SELECT count(*) FROM public.solicitudes_pago_dirigido WHERE movimiento_id=m.id)<>1
        OR NOT EXISTS (SELECT 1 FROM public.solicitudes_pago_dirigido WHERE movimiento_id=m.id
          AND tipo='CLIENTE' AND entidad_id=r.cliente_id AND documento_movimiento_id=a.movimiento_venta_id
          AND importe=a.importe AND estado='APROBADA' AND autorizador_id=a.actor_id
          AND forma_pago='APLICACION_SIN_DINERO' AND cuenta_destino IS NULL)
      THEN RAISE EXCEPTION 'E5: asignación/marker exacto una sola vez'; END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.e5_documentos WHERE cobro_id=a.cobro_id
      AND id=(a.snapshot->>'constanciaId')::uuid AND tipo='CONSTANCIA' AND birth_xid=a.birth_xid
      AND snapshot->'asignaciones'=a.snapshot->'asignaciones'
      AND (snapshot->>'importeDocumento')::numeric=total)
    THEN RAISE EXCEPTION 'E5: constancia propia requerida'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.e5_operaciones op WHERE op.cobro_id=a.cobro_id
      AND op.accion IN ('RECIBIR','AUTORIZAR') AND op.actor_id=a.actor_id
      AND op.birth_xid=a.birth_xid
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(op.response->'aplicaciones') WHERE value=a.snapshot)
      AND NOT EXISTS (SELECT 1 FROM public.e5_operaciones prevop,
        LATERAL jsonb_array_elements(prevop.response->'aplicaciones') history(value)
        WHERE prevop.cobro_id=op.cobro_id AND prevop.revision=op.revision-1 AND history.value=a.snapshot))
    THEN RAISE EXCEPTION 'E5: consumo sólo por autorización nueva/idempotente'; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.operaciones_credito_e1 op
    WHERE op.productor='E5_APLICACION_RETENIDA' AND NOT EXISTS (
      SELECT 1 FROM public.e5_aplicaciones a WHERE a.id=op.clave AND a.actor_id=op.usuario_id
        AND op.naturaleza::text='OPERACION_CREDITO_SIN_DINERO'))
  THEN RAISE EXCEPTION 'E5: operación E1 sin fuente propia'; END IF;
  IF EXISTS (SELECT 1 FROM public.movimientos_credito m
    WHERE m.operacion_productor='E5_APLICACION_RETENIDA' AND NOT EXISTS (
      SELECT 1 FROM public.e5_vinculos_credito v JOIN public.e5_aplicaciones a ON a.id=v.aplicacion_id
      WHERE v.movimiento_id=m.id AND a.id=m.operacion_clave))
  THEN RAISE EXCEPTION 'E5: crédito huérfano'; END IF;
  FOR d IN SELECT * FROM public.e5_devoluciones LOOP
    SELECT * INTO r FROM public.e5_recepciones WHERE id=d.cobro_id;
    SELECT * INTO c FROM public.e5_cobros WHERE id=d.cobro_id;
    IF d.importe<>r.importe OR EXISTS (SELECT 1 FROM public.e5_aplicaciones WHERE cobro_id=d.cobro_id)
      OR (c.detail#>>'{devolucion,importe}')::numeric IS DISTINCT FROM d.importe
      OR (c.detail#>>'{devolucion,actor,id}')::integer IS DISTINCT FROM d.actor_id
      OR (c.detail#>>'{devolucion,salidaId}')::integer IS DISTINCT FROM d.salida_id
      OR (c.detail#>>'{devolucion,movimientoFondoId}')::uuid IS DISTINCT FROM d.movimiento_fondo_id
      OR c.detail#>'{devolucion,fuente}' IS DISTINCT FROM d.fuente
      OR c.detail#>'{devolucion,evidencia}' IS DISTINCT FROM d.evidencia
      OR c.detail#>>'{devolucion,peticionCliente}' IS DISTINCT FROM d.peticion
    THEN RAISE EXCEPTION 'E5: devolución total ADMIN nunca aplicada'; END IF;
    IF d.fuente->>'tipo'='CAJA' THEN
      IF NOT EXISTS (SELECT 1 FROM public.salidas_dinero_caja s
        JOIN public.sesiones_caja sc ON sc.id=s.sesion_caja_id
        JOIN public.e5_nacimientos b ON b.tabla='salidas_dinero_caja' AND b.clave=s.id::text
        WHERE s.id=d.salida_id AND s.monto=d.importe AND s.creado_por_id=d.actor_id
          AND s.cuenta_origen='CAJA_FISICA' AND s.sesion_caja_id=(d.fuente->>'sesionCajaId')::integer
          AND sc.ubicacion_id=(d.fuente->>'ubicacionId')::integer AND b.birth_xid=d.birth_xid)
      THEN RAISE EXCEPTION 'E5: salida caja propia exacta requerida'; END IF;
    ELSIF d.fuente->>'tipo'='CUENTA' THEN
      IF NOT EXISTS (SELECT 1 FROM public.e5_salidas_bancarias s WHERE s.clave=d.clave
        AND s.cobro_id=d.cobro_id AND s.importe=d.importe AND s.actor_id=d.actor_id
        AND s.cuenta_origen=d.fuente->>'cuentaOrigen'
        AND s.ubicacion_id=(d.fuente->>'ubicacionId')::integer AND s.evidencia=d.evidencia
        AND jsonb_array_length(s.evidencia->'referencias')>0 AND s.birth_xid=d.birth_xid)
      THEN RAISE EXCEPTION 'E5: transferencia documentada propia requerida'; END IF;
    ELSE
      IF NOT EXISTS (SELECT 1 FROM public.fondo_movimientos f
        JOIN public.fondo_mariana fm ON fm.id=f.fondo_id
        JOIN public.ubicaciones u ON u.id=fm.ubicacion_id
        JOIN public.e5_nacimientos b ON b.tabla='fondo_movimientos' AND b.clave=f.id::text
        WHERE f.id=d.movimiento_fondo_id AND f.naturaleza='RETIRO' AND f.categoria='RETIRO'
          AND f.original_id IS NULL AND f.importe_centavos=d.importe*100 AND f.autor_id=d.actor_id
          AND f.idempotency_producer='FONDO_API_MOVIMIENTO_V1' AND f.conciliacion_inicial IS NULL
          AND upper(btrim(u.nombre))='MARIANA' AND u.tipo::text='TIENDA'
          AND fm.ubicacion_id=(d.fuente->>'ubicacionId')::integer AND b.birth_xid=d.birth_xid)
        OR EXISTS (SELECT 1 FROM public.fondo_movimientos WHERE original_id=d.movimiento_fondo_id)
      THEN RAISE EXCEPTION 'E5: retiro propio sin inverso ni remesa'; END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.e5_operaciones WHERE clave=d.clave AND cobro_id=d.cobro_id
      AND accion='DEVOLVER' AND actor_id=d.actor_id AND birth_xid=d.birth_xid)
    THEN RAISE EXCEPTION 'E5: devolución sin operación idempotente'; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.e5_salidas_bancarias s WHERE NOT EXISTS (
    SELECT 1 FROM public.e5_devoluciones d WHERE d.clave=s.clave AND d.fuente->>'tipo'='CUENTA'))
  THEN RAISE EXCEPTION 'E5: salida bancaria huérfana'; END IF;
  FOR v IN SELECT * FROM public.e5_documentos LOOP
    SELECT * INTO r FROM public.e5_recepciones WHERE id=v.cobro_id;
    FOREACH k IN ARRAY ARRAY['clienteNombre','ubicacionNombre','receptor','formaPago',
      'cuentaDestino','fechaRecepcion','importeRecibido','reciboId'] LOOP
      IF v.snapshot->k IS DISTINCT FROM r.snapshot->k
      THEN RAISE EXCEPTION 'E5: documento difiere de recepción (%)',k; END IF;
    END LOOP;
    IF v.tipo='CONSTANCIA' AND NOT EXISTS (SELECT 1 FROM public.e5_aplicaciones a
      WHERE a.cobro_id=v.cobro_id AND a.snapshot->>'constanciaId'=v.id::text
        AND v.snapshot->'autorizador'=a.snapshot->'actor'
        AND v.snapshot->'fechaAplicacion'=a.snapshot->'fechaAplicacion'
        AND v.snapshot->'evidencia'=a.snapshot->'evidencia'
        AND (v.snapshot->>'importeFavorGenerado')::numeric=
          coalesce((a.snapshot->>'importeFavorGenerado')::numeric,0))
    THEN RAISE EXCEPTION 'E5: constancia huérfana o alterada'; END IF;
  END LOOP;
  FOR o IN SELECT * FROM public.e5_operaciones ORDER BY cobro_id,revision LOOP
    SELECT * INTO r FROM public.e5_recepciones WHERE id=o.cobro_id;
    IF o.response->>'id' IS DISTINCT FROM o.cobro_id::text
      OR (o.response->>'revision')::integer IS DISTINCT FROM o.revision
    THEN RAISE EXCEPTION 'E5: respuesta idempotente no corresponde'; END IF;
    FOREACH k IN ARRAY ARRAY['clienteId','clienteNombre','ubicacionId','ubicacionNombre',
      'importeRecibido','fechaRecepcion','formaPago','cuentaDestino','sesionCajaId','sesionOperativaId',
      'receptor','notasIndicadas','evidenciaRecepcion','reciboId'] LOOP
      IF o.response->k IS DISTINCT FROM r.snapshot->k
      THEN RAISE EXCEPTION 'E5: respuesta histórica difiere de fuente (%)',k; END IF;
    END LOOP;
    SELECT coalesce(sum((value->>'importe')::numeric),0) INTO total
      FROM jsonb_array_elements(o.response->'aplicaciones');
    returned := coalesce((o.response#>>'{devolucion,importe}')::numeric,0);
    IF (o.response->>'importeAplicado')::numeric IS DISTINCT FROM total
      OR (o.response->>'importeDevuelto')::numeric IS DISTINCT FROM returned
      OR (o.response->>'importePendiente')::numeric IS DISTINCT FROM r.importe-total-returned
      OR (o.response->>'algunaVezAplicado')::boolean IS DISTINCT FROM (total>0)
      OR total+returned>r.importe OR (total>0 AND returned>0)
    THEN RAISE EXCEPTION 'E5: respuesta histórica viola conservación'; END IF;
    IF o.revision=1 THEN
      IF o.accion<>'RECIBIR' OR o.clave<>o.cobro_id
        OR o.actor_id<>r.actor_id OR o.birth_xid<>r.birth_xid
        OR jsonb_array_length(o.response->'rechazos')<>0 OR returned<>0
        OR jsonb_array_length(o.response->'propuestas')>1
        OR jsonb_array_length(o.response->'aplicaciones')>1
      THEN RAISE EXCEPTION 'E5: primera operación es recepción'; END IF;
    ELSE
      SELECT response INTO prev FROM public.e5_operaciones
        WHERE cobro_id=o.cobro_id AND revision=o.revision-1;
      IF prev IS NULL THEN RAISE EXCEPTION 'E5: historia sin predecesor'; END IF;
      IF (prev->>'importePendiente')::numeric<=0
        OR jsonb_array_length(o.response->'propuestas') <>
          jsonb_array_length(prev->'propuestas')+(CASE WHEN o.accion='PROPONER' THEN 1 ELSE 0 END)
        OR jsonb_array_length(o.response->'aplicaciones') <>
          jsonb_array_length(prev->'aplicaciones')+(CASE WHEN o.accion='AUTORIZAR' THEN 1 ELSE 0 END)
        OR jsonb_array_length(o.response->'rechazos') <>
          jsonb_array_length(prev->'rechazos')+(CASE WHEN o.accion='RECHAZAR' THEN 1 ELSE 0 END)
        OR (o.accion<>'DEVOLVER' AND o.response->'devolucion' IS DISTINCT FROM prev->'devolucion')
      THEN RAISE EXCEPTION 'E5: evento no corresponde a transición de historia'; END IF;
      FOREACH k IN ARRAY ARRAY['propuestas','aplicaciones','rechazos'] LOOP
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(prev->k) WITH ORDINALITY h(value,i)
          WHERE o.response->k->(h.i::integer-1) IS DISTINCT FROM h.value)
        THEN RAISE EXCEPTION 'E5: operación reescribe historia'; END IF;
      END LOOP;
      IF o.accion IN ('PROPONER','RECHAZAR') AND
        (o.response->'importeAplicado' IS DISTINCT FROM prev->'importeAplicado'
        OR o.response->'importePendiente' IS DISTINCT FROM prev->'importePendiente'
        OR o.response->'importeDevuelto' IS DISTINCT FROM prev->'importeDevuelto')
      THEN RAISE EXCEPTION 'E5: proponer/rechazar no mueve dinero'; END IF;
      IF o.accion='PROPONER' THEN
        x := o.response->'propuestas'->-1;
        IF o.response->>'propuestaVigenteId' IS DISTINCT FROM x->>'id'
          OR (x#>>'{actor,id}')::integer IS DISTINCT FROM o.actor_id
        THEN RAISE EXCEPTION 'E5: propuesta vigente/actor'; END IF;
      ELSIF o.accion IN ('AUTORIZAR','RECHAZAR','DEVOLVER') THEN
        IF o.response ? 'propuestaVigenteId'
        THEN RAISE EXCEPTION 'E5: propuesta resuelta no puede reutilizarse'; END IF;
        IF o.accion='RECHAZAR' THEN
          x := o.response->'rechazos'->-1;
          IF x->>'propuestaId' IS DISTINCT FROM prev->>'propuestaVigenteId'
            OR x->>'propuestaId' IS NULL OR nullif(btrim(x->>'motivo'),'') IS NULL
            OR (x#>>'{actor,id}')::integer IS DISTINCT FROM o.actor_id
          THEN RAISE EXCEPTION 'E5: rechazo sin propuesta vigente/evidencia'; END IF;
        END IF;
      ELSE
        RAISE EXCEPTION 'E5: recepción no repetible';
      END IF;
      IF o.accion='AUTORIZAR' AND NOT EXISTS (
        SELECT 1 FROM public.e5_aplicaciones a
        WHERE a.cobro_id=o.cobro_id AND a.birth_xid=o.birth_xid
          AND a.propuesta_id::text=prev->>'propuestaVigenteId' AND a.actor_id=o.actor_id)
      THEN RAISE EXCEPTION 'E5: autorización de propuesta vigente requerida'; END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END $function$
