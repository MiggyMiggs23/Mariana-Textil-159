-- E5 / PREPARADO EXCLUSIVAMENTE / NO EJECUTADO / CONSTRUCCION OFF.
-- No concede permiso de instalación ni operación. Gates E1/E3/E5/E9/E12 intactos.
-- Integridad: recepción fuera del ledger; consumo positivo una sola vez; crédito
-- negativo SIN DINERO; devolución total nunca aplicada; historia append-only.
-- Contrato adapter: propuestas/versiones/rechazos viven en detail y response,
-- NO inventar una tabla e5_propuestas que el adapter no escribe.
--
-- PRERREQUISITOS / DISCREPANCIAS PARA MAIN (no resueltas abriendo productores):
-- PostgreSQL >= 13 (xid8/pg_current_xact_id), E1/E2 y esquemas canónicos existentes.
-- Extensión E1 estrecha preparada al final: se archivan definiciones originales
-- exactas, se conserva cada check original y se exige fuente E5 propia.
-- zz_e1_pending_receipts_closed sólo admite UNA fila íntegramente atestada;
-- e5_closed impide construir esa fuente. Cardinalidad 0 o >1 y genérico OFF.
-- Adapter escribe APLICACION_SIN_DINERO como texto de solicitud; revisar
-- guardas del destino canónico. backend-storage-contract.md leído (33 líneas).
-- CUENTA: e5_salidas_bancarias documenta transferencia externa, NO verifica
-- existencia/saldo de una cuenta bancaria física ni comprobante con un banco.
-- FONDO: identidad fija de fondo_mariana/sitio MARIANA según productor
-- canónico, con actor ADMIN. No usar desbloqueo E12 ni inverso E9.
-- Adapter refund usa e12FondoExecutor sólo como puente de parámetros sobre tx;
-- crearMovimientoFondoEnTransaccion emite FONDO_API_MOVIMIENTO_V1/RETIRO
-- antes de e5_devoluciones. No emite operación E1, ni usa inversor/proveedor.
-- Requiere guardas canónicas E10 de ordinal/identidad/saldo inicial/suficiencia;
-- no reemplazarlas ni poblar el ordinal desde E5. ACL del rol ejecutor frente
-- al owner de funciones/tablas debe cotejarse: aquí no hay GRANT operativo.
-- Frescura/deuda global/FIFO/saldo caja dependen del productor y locks canónicos;
-- estos checks NO sustituyen reproyección ni acreditan esos saldos en PostgreSQL.
-- Todo DML E5 permanece rechazado por e5_closed, incluso propietario normal.
-- No se incluye mecanismo/variable de bypass ni instrucciones de apertura.
--
-- Revisión cruzada obligatoria: contratos frontend/backend vigentes, columnas
-- de adapter, E1 tipo/signo/naturaleza, directed marker exacto, E2 no doble uso,
-- Fondo/caja propios, autorización/alcance, P4-P7, instantánea documental.
-- Cobertura: PK/FK/UNIQUE/CHECK + inmutabilidad + grafo diferido en TODAS las
-- tablas relacionadas. Una escritura posterior a SET CONSTRAINTS IMMEDIATE
-- vuelve a validar; no sólo el evento de origen. Guardas BEFORE sellan cambios.
-- Procedencia: xid8 superior asignado en INSERT, sin xmin ni backfill histórico.
-- LIMITES: revisión estática, sin SQL/DB/API/apps/tests; NO prueba PostgreSQL.
-- No defensa contra superusuario/owner que altere DDL o deshabilite triggers.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';

CREATE TABLE public.e5_recepciones (
  id uuid PRIMARY KEY,
  cliente_id integer NOT NULL REFERENCES public.clientes(id),
  ubicacion_id integer NOT NULL REFERENCES public.ubicaciones(id),
  importe numeric(12,2) NOT NULL CHECK (importe > 0 AND importe < 'Infinity'::numeric),
  fecha_recepcion timestamptz NOT NULL CHECK (isfinite(fecha_recepcion)),
  medio text NOT NULL CHECK (medio IN ('EFECTIVO','TRANSFERENCIA')),
  cuenta_destino text NOT NULL,
  sesion_caja_id integer REFERENCES public.sesiones_caja(id),
  actor_id integer NOT NULL REFERENCES public.usuarios(id),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot)='object'),
  birth_xid xid8 NOT NULL,
  CHECK ((medio='EFECTIVO' AND cuenta_destino='CAJA_FISICA' AND sesion_caja_id IS NOT NULL)
    OR (medio='TRANSFERENCIA' AND cuenta_destino IN ('CUENTA_FISCAL','CUENTA_NO_FISCAL') AND sesion_caja_id IS NULL))
);
CREATE TABLE public.e5_cobros (
  id uuid PRIMARY KEY REFERENCES public.e5_recepciones(id),
  cliente_id integer NOT NULL REFERENCES public.clientes(id),
  ubicacion_id integer NOT NULL REFERENCES public.ubicaciones(id),
  revision integer NOT NULL CHECK (revision>0),
  detail jsonb NOT NULL CHECK (jsonb_typeof(detail)='object')
);
CREATE INDEX e5_cobros_scope ON public.e5_cobros(ubicacion_id,cliente_id,id);
CREATE TABLE public.e5_aplicaciones (
  id uuid PRIMARY KEY,
  cobro_id uuid NOT NULL REFERENCES public.e5_recepciones(id),
  grupo_id uuid NOT NULL,
  propuesta_id uuid NOT NULL,
  movimiento_venta_id integer REFERENCES public.movimientos_credito(id),
  importe numeric(12,2) NOT NULL CHECK (importe>0 AND importe<'Infinity'::numeric),
  favor boolean NOT NULL,
  actor_id integer NOT NULL REFERENCES public.usuarios(id),
  fecha_aplicacion timestamptz NOT NULL CHECK (isfinite(fecha_aplicacion)),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot)='object'),
  birth_xid xid8 NOT NULL,
  CHECK (favor = (movimiento_venta_id IS NULL)),
  UNIQUE(grupo_id,movimiento_venta_id)
);
CREATE UNIQUE INDEX e5_un_favor_grupo ON public.e5_aplicaciones(grupo_id) WHERE favor;
CREATE TABLE public.e5_vinculos_credito (
  aplicacion_id uuid PRIMARY KEY REFERENCES public.e5_aplicaciones(id),
  movimiento_id integer NOT NULL UNIQUE REFERENCES public.movimientos_credito(id),
  birth_xid xid8 NOT NULL
);
CREATE TABLE public.e5_salidas_bancarias (
  clave uuid PRIMARY KEY,
  cobro_id uuid NOT NULL UNIQUE REFERENCES public.e5_recepciones(id),
  ubicacion_id integer NOT NULL REFERENCES public.ubicaciones(id),
  cuenta_origen text NOT NULL CHECK (cuenta_origen IN ('CUENTA_FISCAL','CUENTA_NO_FISCAL')),
  importe numeric(12,2) NOT NULL CHECK (importe>0 AND importe<'Infinity'::numeric),
  actor_id integer NOT NULL REFERENCES public.usuarios(id),
  evidencia jsonb NOT NULL CHECK (jsonb_typeof(evidencia)='object'),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  birth_xid xid8 NOT NULL
);
CREATE TABLE public.e5_devoluciones (
  clave uuid PRIMARY KEY,
  cobro_id uuid NOT NULL UNIQUE REFERENCES public.e5_recepciones(id),
  actor_id integer NOT NULL REFERENCES public.usuarios(id),
  fuente jsonb NOT NULL CHECK (jsonb_typeof(fuente)='object'),
  importe numeric(12,2) NOT NULL CHECK (importe>0 AND importe<'Infinity'::numeric),
  peticion text NOT NULL CHECK (length(btrim(peticion)) BETWEEN 1 AND 2000),
  evidencia jsonb NOT NULL CHECK (jsonb_typeof(evidencia)='object'),
  salida_id integer UNIQUE REFERENCES public.salidas_dinero_caja(id),
  movimiento_fondo_id uuid UNIQUE REFERENCES public.fondo_movimientos(id),
  birth_xid xid8 NOT NULL,
  CHECK (coalesce(
    (fuente->>'tipo'='CAJA' AND salida_id IS NOT NULL AND movimiento_fondo_id IS NULL
      AND fuente->>'cuentaOrigen'='CAJA_FISICA' AND fuente ? 'sesionCajaId'
      AND NOT fuente ? 'sesionOperativaId')
    OR (fuente->>'tipo'='CUENTA' AND salida_id IS NULL AND movimiento_fondo_id IS NULL
      AND fuente->>'cuentaOrigen' IN ('CUENTA_FISCAL','CUENTA_NO_FISCAL')
      AND NOT fuente ?| ARRAY['sesionCajaId','sesionOperativaId'])
    OR (fuente->>'tipo'='FONDO' AND salida_id IS NULL AND movimiento_fondo_id IS NOT NULL
      AND NOT fuente ?| ARRAY['sesionCajaId','sesionOperativaId','cuentaOrigen']),false))
);
CREATE TABLE public.e5_documentos (
  id uuid PRIMARY KEY,
  cobro_id uuid NOT NULL REFERENCES public.e5_recepciones(id),
  tipo text NOT NULL CHECK (tipo IN ('RECIBO','CONSTANCIA')),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot)='object'),
  birth_xid xid8 NOT NULL,
  CHECK (snapshot->>'id' IS NOT DISTINCT FROM id::text
    AND snapshot->>'cobroId' IS NOT DISTINCT FROM cobro_id::text
    AND snapshot->>'tipo' IS NOT DISTINCT FROM tipo)
);
CREATE UNIQUE INDEX e5_un_recibo ON public.e5_documentos(cobro_id) WHERE tipo='RECIBO';
CREATE TABLE public.e5_operaciones (
  clave uuid PRIMARY KEY,
  cobro_id uuid NOT NULL REFERENCES public.e5_recepciones(id),
  revision integer NOT NULL CHECK (revision>0),
  accion text NOT NULL CHECK (accion IN ('RECIBIR','PROPONER','AUTORIZAR','RECHAZAR','DEVOLVER')),
  actor_id integer NOT NULL REFERENCES public.usuarios(id),
  content text NOT NULL CHECK (length(content)>0),
  response jsonb NOT NULL CHECK (jsonb_typeof(response)='object'),
  birth_xid xid8 NOT NULL,
  UNIQUE(cobro_id,revision)
);
CREATE TABLE public.e5_impresiones (
  clave uuid PRIMARY KEY,
  documento_id uuid NOT NULL REFERENCES public.e5_documentos(id),
  actor_id integer NOT NULL REFERENCES public.usuarios(id),
  content text NOT NULL CHECK (length(content)>0),
  motivo text NOT NULL CHECK (length(btrim(motivo)) BETWEEN 1 AND 500),
  birth_xid xid8 NOT NULL
);
-- Sidecar de procedencia. No se pobla con filas históricas. Sólo AFTER INSERT
-- del origen puede escribir; no se rejuvenece mediante UPDATE/SAVEPOINT.
CREATE TABLE public.e5_nacimientos (
  tabla text NOT NULL,
  clave text NOT NULL,
  birth_xid xid8 NOT NULL,
  PRIMARY KEY(tabla,clave)
);
REVOKE ALL ON public.e5_nacimientos FROM PUBLIC;

CREATE FUNCTION public.e5_closed() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog AS $$
BEGIN RAISE EXCEPTION 'E5_DISABLED: construcción OFF; DML E5 cerrado'; END $$;
CREATE FUNCTION public.e5_immutable() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog AS $$
BEGIN RAISE EXCEPTION 'E5: evidencia inmutable; no UPDATE/DELETE/TRUNCATE'; END $$;
CREATE FUNCTION public.e5_birth() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog AS $$
BEGIN NEW.birth_xid := pg_current_xact_id(); RETURN NEW; END $$;
CREATE FUNCTION public.e5_capture_birth() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog AS $$
DECLARE k text;
BEGIN
  k := CASE WHEN TG_TABLE_NAME='cobros_credito_pendientes_e1'
    THEN to_jsonb(NEW)->>'operacion_clave'
    WHEN TG_TABLE_NAME='operaciones_credito_e1'
    THEN (to_jsonb(NEW)->>'productor')||':'||(to_jsonb(NEW)->>'clave')
    ELSE to_jsonb(NEW)->>'id' END;
  INSERT INTO public.e5_nacimientos(tabla,clave,birth_xid)
    VALUES (TG_TABLE_NAME,k,pg_current_xact_id());
  RETURN NEW;
END $$;
CREATE FUNCTION public.e5_birth_private() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog AS $$
BEGIN
  IF pg_trigger_depth() <> 2 THEN RAISE EXCEPTION 'E5: procedencia sólo por trigger INSERT de origen'; END IF;
  NEW.birth_xid := pg_current_xact_id();
  RETURN NEW;
END $$;
CREATE TRIGGER e5_birth_private BEFORE INSERT ON public.e5_nacimientos
FOR EACH ROW EXECUTE FUNCTION public.e5_birth_private();

-- Autoridad y disponibilidad al INSERT, no volver a exigir que un actor histórico
-- mantenga su rol o que una caja histórica continúe abierta años después.
CREATE FUNCTION public.e5_insert_authority() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog AS $$
DECLARE j jsonb := to_jsonb(NEW); s integer; site integer;
BEGIN
  IF TG_TABLE_NAME IN ('e5_aplicaciones','e5_devoluciones','e5_salidas_bancarias','e5_impresiones')
    OR (TG_TABLE_NAME='e5_operaciones' AND j->>'accion'<>'RECIBIR')
  THEN
    PERFORM 1 FROM public.usuarios WHERE id=(j->>'actor_id')::integer AND activo AND rol::text='ADMIN' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'E5: autoridad ADMIN actual requerida'; END IF;
  END IF;
  IF TG_TABLE_NAME='e5_recepciones' AND j->>'medio'='EFECTIVO' THEN
    s := (j->>'sesion_caja_id')::integer; site := (j->>'ubicacion_id')::integer;
  ELSIF TG_TABLE_NAME='e5_devoluciones' AND j#>>'{fuente,tipo}'='CAJA' THEN
    s := (j#>>'{fuente,sesionCajaId}')::integer; site := (j#>>'{fuente,ubicacionId}')::integer;
  END IF;
  IF s IS NOT NULL THEN
    PERFORM 1 FROM public.sesiones_caja WHERE id=s AND ubicacion_id=site
      AND estado='ABIERTA' AND cerrada_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'E5: sesión física actual abierta requerida'; END IF;
  END IF;
  RETURN NEW;
END $$;

-- Exclusión global por try-lock SIN ESPERA: no añade arco de espera invertido
-- frente a CUSTOMER_CREDIT/caja/Fondo previamente adquiridos por el adapter.
-- No cambia esos locks ni establece orden nuevo entre ellos. Contención implica
-- fallo 40001 de toda la unidad, no éxito/fallback. Coste/aislamiento/reintentos
-- quedan pendientes de ensayo autorizado. No se afirma concurrencia probada.
CREATE FUNCTION public.e5_serialize() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog AS $$
BEGIN
  -- El adapter ya puede tener CUSTOMER_CREDIT/sesión/Fondo/aggregate antes
  -- del primer DML. NUNCA esperar este lock global detrás de ellos: otro
  -- escritor puede tenerlo y necesitar esos mismos locks en validadores.
  -- NOWAIT lógico: conflicto aborta la sentencia con serialization_failure.
  -- El llamador debe abortar/reintentar la transacción completa, nunca continuar
  -- sólo la sentencia; adapter transaccional propaga el error, no hace retry SQL.
  IF NOT pg_try_advisory_xact_lock(650005,5) THEN
    RAISE EXCEPTION USING ERRCODE='40001',
      MESSAGE='E5: grafo ocupado; abortar transacción completa, sin espera global';
  END IF;
  RETURN NULL;
END $$;

CREATE FUNCTION public.e5_detail_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog AS $$
DECLARE k text; prior jsonb; d jsonb := NEW.detail; item jsonb; n integer; row_value jsonb;
BEGIN
  IF d->>'id' IS DISTINCT FROM NEW.id::text
    OR (d->>'clienteId')::integer IS DISTINCT FROM NEW.cliente_id
    OR (d->>'ubicacionId')::integer IS DISTINCT FROM NEW.ubicacion_id
    OR (d->>'revision')::integer IS DISTINCT FROM NEW.revision
  THEN RAISE EXCEPTION 'E5: identidad/revisión del agregado'; END IF;
  FOREACH k IN ARRAY ARRAY['propuestas','aplicaciones','rechazos'] LOOP
    IF jsonb_typeof(d->k) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'E5: historia requerida'; END IF;
    IF TG_OP='UPDATE' THEN
      prior := OLD.detail->k;
      IF jsonb_array_length(d->k)<jsonb_array_length(prior) OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(prior) WITH ORDINALITY x(v,i)
        WHERE d->k->(x.i::integer-1) IS DISTINCT FROM x.v)
      THEN RAISE EXCEPTION 'E5: historia append-only'; END IF;
    END IF;
  END LOOP;
  n := 0;
  FOR item IN SELECT value FROM jsonb_array_elements(d->'propuestas') LOOP
    n := n+1;
    IF (item->>'version')::integer IS DISTINCT FROM n OR item->>'id' IS NULL
      OR jsonb_typeof(item->'asignaciones') IS DISTINCT FROM 'array'
    THEN RAISE EXCEPTION 'E5: versión de propuesta inválida'; END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(item->'asignaciones')) <>
      (SELECT count(DISTINCT value->>'movimientoVentaId') FROM jsonb_array_elements(item->'asignaciones'))
    THEN RAISE EXCEPTION 'E5: propuesta duplica movimiento exacto'; END IF;
    FOR row_value IN SELECT value FROM jsonb_array_elements(item->'asignaciones') LOOP
      IF coalesce(row_value->>'importe','') !~ '^(0|[1-9][0-9]*)\.[0-9]{2}$'
        OR (row_value->>'importe')::numeric<=0 OR (row_value->>'notaId')::integer IS NULL
        OR (row_value->>'movimientoVentaId')::integer IS NULL
      THEN RAISE EXCEPTION 'E5: importe/destino propuesto inválido'; END IF;
    END LOOP;
  END LOOP;
  IF (SELECT count(*) FROM jsonb_array_elements(d->'propuestas')) <>
    (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(d->'propuestas'))
  THEN RAISE EXCEPTION 'E5: UUID de propuesta reciclado'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(d->'aplicaciones')) <>
    (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(d->'aplicaciones'))
  THEN RAISE EXCEPTION 'E5: aplicación repetida en historia'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.revision<>1 THEN RAISE EXCEPTION 'E5: revisión inicial'; END IF;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
      OR NEW.ubicacion_id IS DISTINCT FROM OLD.ubicacion_id OR NEW.revision<>OLD.revision+1
      OR (OLD.detail->>'algunaVezAplicado'='true' AND d->>'algunaVezAplicado' IS DISTINCT FROM 'true')
      OR (OLD.detail ? 'devolucion' AND d->'devolucion' IS DISTINCT FROM OLD.detail->'devolucion')
    THEN RAISE EXCEPTION 'E5: transición irreversible'; END IF;
    FOREACH k IN ARRAY ARRAY['id','clienteId','clienteNombre','ubicacionId','ubicacionNombre',
      'importeRecibido','fechaRecepcion','formaPago','cuentaDestino','sesionCajaId',
      'receptor','notasIndicadas','evidenciaRecepcion','reciboId'] LOOP
      IF d->k IS DISTINCT FROM OLD.detail->k THEN RAISE EXCEPTION 'E5: recepción inmutable (%)',k; END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER e5_detail_guard BEFORE INSERT OR UPDATE ON public.e5_cobros
FOR EACH ROW EXECUTE FUNCTION public.e5_detail_guard();

-- Grafo bidireccional: no basta validar aplicación o recepción al insertarlas.
-- Todos los INSERT/UPDATE/DELETE relacionados reencolan esta comprobación.
CREATE FUNCTION public.e5_graph_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog AS $$
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
    SELECT mc.* INTO m FROM public.e5_vinculos_credito application_link
      JOIN public.movimientos_credito mc ON mc.id=application_link.movimiento_id
      WHERE application_link.aplicacion_id=a.id
        AND application_link.birth_xid=a.birth_xid;
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
      SELECT 1 FROM public.e5_aplicaciones app_source
      WHERE app_source.id=op.clave AND app_source.actor_id=op.usuario_id
        AND op.naturaleza::text='OPERACION_CREDITO_SIN_DINERO'))
  THEN RAISE EXCEPTION 'E5: operación E1 sin fuente propia'; END IF;
  IF EXISTS (SELECT 1 FROM public.movimientos_credito credit_source
    WHERE credit_source.operacion_productor='E5_APLICACION_RETENIDA' AND NOT EXISTS (
      SELECT 1 FROM public.e5_vinculos_credito credit_link
      JOIN public.e5_aplicaciones linked_application ON linked_application.id=credit_link.aplicacion_id
      WHERE credit_link.movimiento_id=credit_source.id
        AND linked_application.id=credit_source.operacion_clave))
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
    SELECT 1 FROM public.e5_devoluciones bank_refund
    WHERE bank_refund.clave=s.clave AND bank_refund.fuente->>'tipo'='CUENTA'))
  THEN RAISE EXCEPTION 'E5: salida bancaria huérfana'; END IF;
  FOR v IN SELECT * FROM public.e5_documentos LOOP
    SELECT * INTO r FROM public.e5_recepciones WHERE id=v.cobro_id;
    FOREACH k IN ARRAY ARRAY['clienteNombre','ubicacionNombre','receptor','formaPago',
      'cuentaDestino','fechaRecepcion','importeRecibido','reciboId'] LOOP
      IF v.snapshot->k IS DISTINCT FROM r.snapshot->k
      THEN RAISE EXCEPTION 'E5: documento difiere de recepción (%)',k; END IF;
    END LOOP;
    IF v.tipo='CONSTANCIA' AND NOT EXISTS (SELECT 1 FROM public.e5_aplicaciones document_application
      WHERE document_application.cobro_id=v.cobro_id
        AND document_application.snapshot->>'constanciaId'=v.id::text
        AND v.snapshot->'autorizador'=document_application.snapshot->'actor'
        AND v.snapshot->'fechaAplicacion'=document_application.snapshot->'fechaAplicacion'
        AND v.snapshot->'evidencia'=document_application.snapshot->'evidencia'
        AND (v.snapshot->>'importeFavorGenerado')::numeric=
          coalesce((document_application.snapshot->>'importeFavorGenerado')::numeric,0))
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
        SELECT 1 FROM public.e5_aplicaciones authorized_application
        WHERE authorized_application.cobro_id=o.cobro_id
          AND authorized_application.birth_xid=o.birth_xid
          AND authorized_application.propuesta_id::text=prev->>'propuestaVigenteId'
          AND authorized_application.actor_id=o.actor_id)
      THEN RAISE EXCEPTION 'E5: autorización de propuesta vigente requerida'; END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END $$;

-- Sellar UPDATE/DELETE de evidencia externa vinculada, incluso en misma tx.
-- INSERT tardío sigue pasando por graph_guard (incluidas aplicaciones derivadas).
CREATE FUNCTION public.e5_external_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog AS $$
DECLARE j jsonb := to_jsonb(OLD); nextj jsonb := to_jsonb(NEW); linked boolean := false;
BEGIN
  IF TG_TABLE_NAME='movimientos_credito' THEN
    SELECT EXISTS (SELECT 1 FROM public.e5_vinculos_credito WHERE movimiento_id=(j->>'id')::integer)
      OR EXISTS (SELECT 1 FROM public.e5_aplicaciones WHERE movimiento_venta_id=(j->>'id')::integer) INTO linked;
  ELSIF TG_TABLE_NAME IN ('aplicaciones_credito','solicitudes_pago_dirigido') THEN
    SELECT EXISTS (SELECT 1 FROM public.e5_vinculos_credito
      WHERE movimiento_id=coalesce((j->>'abono_movimiento_id')::integer,(j->>'movimiento_id')::integer)
        OR (TG_OP='UPDATE' AND movimiento_id=
          coalesce((nextj->>'abono_movimiento_id')::integer,(nextj->>'movimiento_id')::integer))) INTO linked;
    -- También antes de que exista e5_vinculos_credito, insertado al final:
    -- no trasplantar una fila histórica para simular INSERT FIFO posterior.
    linked := linked OR EXISTS (SELECT 1 FROM public.movimientos_credito mc
      WHERE mc.operacion_productor='E5_APLICACION_RETENIDA' AND
        (mc.id=coalesce((j->>'abono_movimiento_id')::integer,(j->>'movimiento_id')::integer)
        OR (TG_OP='UPDATE' AND mc.id=
          coalesce((nextj->>'abono_movimiento_id')::integer,(nextj->>'movimiento_id')::integer))));
  ELSIF TG_TABLE_NAME='salidas_dinero_caja' THEN
    SELECT EXISTS (SELECT 1 FROM public.e5_devoluciones WHERE salida_id=(j->>'id')::integer) INTO linked;
  ELSIF TG_TABLE_NAME='fondo_movimientos' THEN
    SELECT EXISTS (SELECT 1 FROM public.e5_devoluciones WHERE movimiento_fondo_id=(j->>'id')::uuid) INTO linked;
  ELSIF TG_TABLE_NAME='cobros_credito_pendientes_e1' THEN
    SELECT EXISTS (SELECT 1 FROM public.e5_recepciones WHERE id=(j->>'operacion_clave')::uuid) INTO linked;
  ELSIF TG_TABLE_NAME='operaciones_credito_e1' THEN
    linked := j->>'productor'='E5_APLICACION_RETENIDA' OR
      (j->>'productor'='COBRO_PENDIENTE' AND EXISTS
        (SELECT 1 FROM public.e5_recepciones WHERE id=(j->>'clave')::uuid));
  END IF;
  IF linked THEN RAISE EXCEPTION 'E5: fuente/efecto relacionado inmutable'; END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE FUNCTION public.e5_favor_initial_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.movimientos_credito m
    JOIN public.e5_aplicaciones a ON a.id=m.operacion_clave
    WHERE m.id=NEW.abono_movimiento_id AND m.operacion_productor='E5_APLICACION_RETENIDA'
      AND a.favor AND a.birth_xid=pg_current_xact_id())
  THEN RAISE EXCEPTION 'E5: emisión inicial de favor no admite aplicación, incluso tras IMMEDIATE'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER e5_favor_initial_guard BEFORE INSERT ON public.aplicaciones_credito
FOR EACH ROW EXECUTE FUNCTION public.e5_favor_initial_guard();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['e5_recepciones','e5_aplicaciones','e5_vinculos_credito',
    'e5_salidas_bancarias','e5_devoluciones','e5_documentos','e5_operaciones','e5_impresiones','e5_nacimientos'] LOOP
    EXECUTE format('CREATE TRIGGER e5_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.e5_immutable()',t);
    IF t<>'e5_nacimientos' THEN
      EXECUTE format('CREATE TRIGGER e5_birth BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.e5_birth()',t);
    END IF;
  END LOOP;
  CREATE TRIGGER e5_no_delete BEFORE DELETE ON public.e5_cobros FOR EACH ROW EXECUTE FUNCTION public.e5_immutable();
  FOREACH t IN ARRAY ARRAY['e5_recepciones','e5_cobros','e5_aplicaciones','e5_vinculos_credito',
    'e5_salidas_bancarias','e5_devoluciones','e5_documentos','e5_operaciones','e5_impresiones'] LOOP
    EXECUTE format('CREATE TRIGGER e5_closed BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.e5_closed()',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['e5_recepciones','e5_aplicaciones','e5_devoluciones',
    'e5_salidas_bancarias','e5_impresiones','e5_operaciones'] LOOP
    EXECUTE format('CREATE TRIGGER e5_insert_authority BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.e5_insert_authority()',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['operaciones_credito_e1','cobros_credito_pendientes_e1','aplicaciones_credito',
    'movimientos_credito','salidas_dinero_caja','fondo_movimientos'] LOOP
    EXECUTE format('CREATE TRIGGER e5_capture_birth AFTER INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.e5_capture_birth()',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['e5_recepciones','e5_cobros','e5_aplicaciones','e5_vinculos_credito',
    'e5_salidas_bancarias','e5_devoluciones','e5_documentos','e5_operaciones','e5_impresiones',
    'e5_nacimientos','operaciones_credito_e1','cobros_credito_pendientes_e1','movimientos_credito',
    'aplicaciones_credito','solicitudes_pago_dirigido','salidas_dinero_caja','fondo_movimientos',
    'sesiones_caja','fondo_mariana','tickets','usuarios','ubicaciones'] LOOP
    EXECUTE format('CREATE TRIGGER e5_serialize BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.e5_serialize()',t);
    EXECUTE format('CREATE CONSTRAINT TRIGGER e5_graph AFTER INSERT OR UPDATE OR DELETE ON public.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e5_graph_guard()',t);
    EXECUTE format('CREATE TRIGGER e5_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable()',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['operaciones_credito_e1','cobros_credito_pendientes_e1',
    'movimientos_credito','aplicaciones_credito','solicitudes_pago_dirigido','salidas_dinero_caja','fondo_movimientos'] LOOP
    EXECUTE format('CREATE TRIGGER e5_external_guard BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.e5_external_guard()',t);
  END LOOP;
END $$;

-- Extensiones E1 PREPARADAS, no aplicadas. Archivo de definiciones exactas de la
-- instalación destinataria: no sobreescribir con copias antiguas al revertir.
-- Metadato DDL, NO evento de negocio ni autorización. Un esquema divergente
-- aborta todo BEGIN; nunca se adivina un validador distinto.
CREATE TABLE public.e5_ddl_originales (
  objeto text PRIMARY KEY,
  definicion text NOT NULL CHECK (length(definicion)>0)
);
REVOKE ALL ON public.e5_ddl_originales FROM PUBLIC;
CREATE TRIGGER e5_ddl_no_change BEFORE UPDATE OR DELETE ON public.e5_ddl_originales
FOR EACH ROW EXECUTE FUNCTION public.e5_immutable();
CREATE TRIGGER e5_ddl_no_truncate BEFORE TRUNCATE ON public.e5_ddl_originales
FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();

CREATE FUNCTION public.e5_owned_credit_source(m public.movimientos_credito)
RETURNS boolean LANGUAGE sql VOLATILE
SET search_path = pg_catalog AS $$
  SELECT coalesce(
    m.operacion_productor='E5_APLICACION_RETENIDA' AND m.tipo::text='ABONO'
    AND m.importe<0 AND m.naturaleza::text='OPERACION_CREDITO_SIN_DINERO'
    AND m.forma_pago IS NULL AND m.cuenta_destino IS NULL AND m.sesion_caja_id IS NULL
    AND m.es_incobrable=false AND m.movimiento_origen_id IS NULL
    AND m.ticket_id IS NULL AND m.nota_origen_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.e5_aplicaciones a
      JOIN public.e5_recepciones r ON r.id=a.cobro_id
      JOIN public.usuarios u ON u.id=a.actor_id
      JOIN public.operaciones_credito_e1 op ON op.productor=m.operacion_productor AND op.clave=a.id
      JOIN public.e5_nacimientos b ON b.tabla='operaciones_credito_e1'
        AND b.clave=op.productor||':'||op.clave::text AND b.birth_xid=a.birth_xid
      WHERE a.id=m.operacion_clave AND a.birth_xid=pg_current_xact_id()
        AND a.actor_id=m.usuario_id AND u.activo AND u.rol::text='ADMIN'
        AND a.importe=-m.importe AND r.cliente_id=m.cliente_id AND r.ubicacion_id=m.sitio_origen_id
        AND m.created_at=a.fecha_aplicacion AND a.fecha_aplicacion>=r.fecha_recepcion
        AND op.usuario_id=a.actor_id AND op.naturaleza::text='OPERACION_CREDITO_SIN_DINERO'
        AND op.solicitud_canonica->>'cobroId'=r.id::text
        AND op.solicitud_canonica->'application'=a.snapshot
        AND op.solicitud_canonica#>>'{proposal,id}'=a.propuesta_id::text
        AND (op.solicitud_canonica#>>'{piece,importe}')::numeric=a.importe
        AND (op.solicitud_canonica#>>'{piece,favor}')::boolean=a.favor
        AND NOT EXISTS (SELECT 1 FROM public.e5_devoluciones WHERE cobro_id=a.cobro_id)
    ),false)
$$;

DO $$
DECLARE original text; expr text; anchor text; replacement text; trigger_def text;
BEGIN
  -- ACCESS EXCLUSIVE también impide INSERT concurrente entre archivo/reemplazo.
  LOCK TABLE public.operaciones_credito_e1, public.movimientos_credito,
    public.cobros_credito_pendientes_e1 IN ACCESS EXCLUSIVE MODE;
  SELECT pg_get_constraintdef(oid),pg_get_expr(conbin,conrelid) INTO original,expr
    FROM pg_catalog.pg_constraint
    WHERE conrelid='public.operaciones_credito_e1'::regclass
      AND conname='operaciones_productor_naturaleza_ck_e1' AND contype='c' AND convalidated;
  IF original IS NULL OR strpos(original,'E5_APLICACION_RETENIDA')>0
  THEN RAISE EXCEPTION 'E5: constraint E1 ausente/divergente; revisión MAIN requerida'; END IF;
  INSERT INTO public.e5_ddl_originales VALUES ('constraint_operaciones',original);
  SELECT pg_get_functiondef('public.validar_movimiento_credito_e1()'::regprocedure) INTO original;
  anchor := E'    OR (NEW.operacion_productor = ''BAJA_INCOBRABLE''\n      AND NEW.tipo = ''AJUSTE'' AND NEW.es_incobrable AND NEW.importe < 0)';
  IF strpos(original,anchor)=0 OR
    (length(original)-length(replace(original,anchor,'')))<>length(anchor)
    OR strpos(original,'E5_APLICACION_RETENIDA')>0
  THEN RAISE EXCEPTION 'E5: cuerpo E1 no coincide con ancla revisada; no reemplazar'; END IF;
  INSERT INTO public.e5_ddl_originales VALUES ('funcion_movimiento',original);
  replacement := anchor||E'\n    OR (NEW.operacion_productor = ''E5_APLICACION_RETENIDA''\n      AND public.e5_owned_credit_source(NEW))';
  -- El resto del cuerpo original, incluidos contexto, signos y reversos,
  -- permanece byte por byte. No se reimplementan ni omiten checks de E1.
  EXECUTE replace(original,anchor,replacement);
  EXECUTE 'ALTER TABLE public.operaciones_credito_e1 DROP CONSTRAINT operaciones_productor_naturaleza_ck_e1';
  EXECUTE 'ALTER TABLE public.operaciones_credito_e1 ADD CONSTRAINT operaciones_productor_naturaleza_ck_e1 CHECK (('
    ||expr||') OR (productor=''E5_APLICACION_RETENIDA'' AND naturaleza=''OPERACION_CREDITO_SIN_DINERO''))';
  SELECT pg_get_functiondef('public.e1_guard_pending_receipts_closed()'::regprocedure) INTO original;
  IF strpos(original,E'BEGIN\n  RAISE EXCEPTION USING\n    ERRCODE = ''E1P01'',\n    MESSAGE = ''E1: el cobro retenido de crédito está deshabilitado.'';\n  RETURN NULL;\nEND;')=0
  THEN RAISE EXCEPTION 'E5: cierre pending original distinto del revisado; revisión MAIN requerida'; END IF;
  INSERT INTO public.e5_ddl_originales VALUES ('funcion_pending',original);
  SELECT pg_get_triggerdef(t.oid) INTO trigger_def FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid='public.cobros_credito_pendientes_e1'::regclass
      AND t.tgname='zz_e1_pending_receipts_closed' AND NOT t.tgisinternal
      AND t.tgtype=4 AND t.tgenabled='O'
      AND t.tgfoid='public.e1_guard_pending_receipts_closed()'::regprocedure;
  IF trigger_def IS NULL THEN RAISE EXCEPTION 'E5: pending statement guard ausente/divergente'; END IF;
  INSERT INTO public.e5_ddl_originales VALUES ('trigger_pending',trigger_def);
END $$;

CREATE OR REPLACE FUNCTION public.e1_guard_pending_receipts_closed()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  -- Transition relation (no tabla persistente/search_path de usuario).
  -- No variable de sesión, señal global ni bypass administrativo.
  -- Orden contrastado e5-repository.ts:110-122:
  -- e5_recepciones -> operaciones_credito_e1 -> cobros_credito_pendientes_e1.
  -- En AFTER STATEMENT ya existen la recepción inmutable, la raíz E1 y sus
  -- marcas xid8 (BEFORE de recepción / AFTER ROW de operación y pending).
  -- NO depende de e5_cobros, e5_operaciones ni documento: se insertan después.
  -- El grafo completo sigue DEFERRABLE INITIALLY DEFERRED. Forzarlo IMMEDIATE
  -- antes de completar toda la unidad puede rechazarla: no es modo del adapter.
  -- Cardinalidad singular: 0 rechaza; 1 exige toda atestación; >1 rechaza
  -- incluso si cada fila tuviera una fuente válida. No lote de recepciones.
  IF (SELECT count(*) FROM e5_pending_rows)<>1 OR EXISTS (
    SELECT 1 FROM e5_pending_rows n WHERE NOT EXISTS (
      SELECT 1 FROM public.e5_recepciones r
      JOIN public.operaciones_credito_e1 op ON op.productor=n.operacion_productor AND op.clave=r.id
      JOIN public.e5_nacimientos b ON b.tabla='operaciones_credito_e1'
        AND b.clave=op.productor||':'||op.clave::text AND b.birth_xid=r.birth_xid
      JOIN public.e5_nacimientos receipt_birth ON receipt_birth.tabla='cobros_credito_pendientes_e1'
        AND receipt_birth.clave=r.id::text AND receipt_birth.birth_xid=r.birth_xid
      WHERE r.id=n.operacion_clave AND r.birth_xid=pg_current_xact_id()
        AND n.operacion_productor='COBRO_PENDIENTE' AND n.naturaleza::text='INGRESO_FISICO'
        AND op.naturaleza::text='INGRESO_FISICO' AND op.usuario_id=r.actor_id
        AND op.solicitud_canonica->>'productor'='E5'
        AND (op.solicitud_canonica#>>'{actor,id}')::integer=r.actor_id
        AND op.solicitud_canonica#>>'{input,claveOperacion}'=r.id::text
        AND n.usuario_id=r.actor_id AND n.cliente_id=r.cliente_id AND n.importe=r.importe
        AND n.fecha_real=r.fecha_recepcion AND n.sitio_origen_id=r.ubicacion_id
        AND n.medio::text=r.medio AND n.cuenta_destino=r.cuenta_destino
        AND n.sesion_caja_id IS NOT DISTINCT FROM r.sesion_caja_id
    ))
  THEN RAISE EXCEPTION USING ERRCODE='E1P01',
    MESSAGE='E1: cobro genérico/lote cerrado; exactamente una fila con fuente E5 propia';
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER zz_e1_pending_receipts_closed ON public.cobros_credito_pendientes_e1;
CREATE TRIGGER zz_e1_pending_receipts_closed AFTER INSERT ON public.cobros_credito_pendientes_e1
REFERENCING NEW TABLE AS e5_pending_rows FOR EACH STATEMENT
EXECUTE FUNCTION public.e1_guard_pending_receipts_closed();
-- Archivar sólo durante preparación; no admitir metadatos adicionales después.
CREATE TRIGGER e5_ddl_no_insert BEFORE INSERT ON public.e5_ddl_originales
FOR EACH STATEMENT EXECUTE FUNCTION public.e5_immutable();
REVOKE ALL ON FUNCTION public.e5_owned_credit_source(public.movimientos_credito) FROM PUBLIC;
-- Ningún GRANT de operación. Cierre E5 y puertas E2/E3/E9/E12 intactos.
REVOKE ALL ON FUNCTION public.e5_closed(), public.e5_immutable(), public.e5_birth(),
  public.e5_capture_birth(), public.e5_birth_private(), public.e5_serialize(),
  public.e5_detail_guard(), public.e5_graph_guard(), public.e5_external_guard(),
  public.e5_insert_authority(), public.e5_favor_initial_guard() FROM PUBLIC;
COMMIT;