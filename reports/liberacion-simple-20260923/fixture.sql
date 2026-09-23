SET search_path=public,pg_catalog;
CREATE TYPE public."alcance_consulta" AS ENUM ('PROPIA','TODAS');
CREATE TYPE public."estado_sesion_caja" AS ENUM ('ABIERTA','CERRADA');
CREATE TYPE public."estado_solicitud_pago_dirigido" AS ENUM ('PENDIENTE','APROBADA','RECHAZADA');
CREATE TYPE public."estado_ticket" AS ENUM ('VENDIDO','CANCELADO');
CREATE TYPE public."forma_pago_cuenta" AS ENUM ('EFECTIVO','TRANSFERENCIA','FACTURADO','CHEQUE','OTRO','CREDITO');
CREATE TYPE public."forma_pago_proveedor" AS ENUM ('EFECTIVO','TRANSFERENCIA','CHEQUE','OTRO','FACTURADO');
CREATE TYPE public."naturaleza_credito_e1" AS ENUM ('INGRESO_FISICO','DEVOLUCION_FISICA','CORRECCION_CONTABLE','OPERACION_CREDITO_SIN_DINERO');
CREATE TYPE public."rol_usuario" AS ENUM ('ADMIN','TERMINAL','CAJA','SUPERVISOR','BODEGA','SISTEMAS','CONTADOR');
CREATE TYPE public."tipo_movimiento_credito" AS ENUM ('VENTA_CREDITO','ABONO','REVERSO','AJUSTE');
CREATE TYPE public."tipo_pago_proveedor" AS ENUM ('COMPRA','PAGO','AJUSTE','REVERSO');
CREATE TYPE public."tipo_solicitud_pago_dirigido" AS ENUM ('CLIENTE','PROVEEDOR');
CREATE TYPE public."tipo_ubicacion" AS ENUM ('TIENDA','BODEGA','TRANSITO','EXTERNO');
CREATE TABLE public."usuarios" ("activo" boolean,"alcance_consulta" alcance_consulta,"created_at" timestamp with time zone,"id" integer,"nombre" text,"password_hash" text,"rol" rol_usuario,"ubicacion_id" integer,"ultimo_acceso" timestamp with time zone,"usuario" text);
ALTER TABLE public."usuarios" ADD CONSTRAINT "usuarios_pkey" PRIMARY KEY (id);
ALTER TABLE public."usuarios" ADD CONSTRAINT "usuarios_usuario_unique" UNIQUE (usuario);
CREATE TABLE public."clientes" ("activo" boolean,"contacto_nombre" text,"correo" text,"created_at" timestamp with time zone,"dias_credito" integer,"direccion_entrega" text,"direccion_particular" text,"es_sistema" boolean,"id" integer,"limite_credito" numeric(14,2),"nombre" text,"notas" text,"recibe_nota_sin_precios" boolean,"rfc" text,"saldo_credito" numeric(14,2),"telefono" text,"updated_at" timestamp with time zone);
ALTER TABLE public."clientes" ADD CONSTRAINT "clientes_pkey" PRIMARY KEY (id);
CREATE TABLE public."ubicaciones" ("activa" boolean,"created_at" timestamp with time zone,"id" integer,"iniciales" text,"nombre" text,"tipo" tipo_ubicacion);
ALTER TABLE public."ubicaciones" ADD CONSTRAINT "ubicaciones_nombre_unique" UNIQUE (nombre);
ALTER TABLE public."ubicaciones" ADD CONSTRAINT "ubicaciones_pkey" PRIMARY KEY (id);
CREATE TABLE public."sesiones_caja" ("abierta_at" timestamp with time zone,"cerrada_at" timestamp with time zone,"cerrada_por_id" integer,"efectivo_contado" numeric(12,2),"estado" estado_sesion_caja,"fecha_operativa" date,"fondo_inicial" numeric(12,2),"id" integer,"ubicacion_id" integer,"usuario_id" integer);
ALTER TABLE public."sesiones_caja" ADD CONSTRAINT "sesiones_caja_pkey" PRIMARY KEY (id);
CREATE TABLE public."salidas_dinero_caja" ("creado_por_id" integer,"created_at" timestamp with time zone,"cuenta_origen" text,"id" integer,"monto" numeric(12,2),"motivo" text,"proveedor_id" integer,"sesion_caja_id" integer);
ALTER TABLE public."salidas_dinero_caja" ADD CONSTRAINT "salidas_dinero_caja_pkey" PRIMARY KEY (id);
CREATE TABLE public."fondo_movimientos" ("autor_id" integer,"categoria" text,"conciliacion_inicial" jsonb,"created_at" timestamp with time zone,"fondo_id" uuid,"id" uuid,"idempotency_key" uuid,"idempotency_producer" text,"importe_centavos" bigint,"motivo" text,"naturaleza" text,"ordinal" bigint,"original_id" uuid,"payload_hash" text);
ALTER TABLE public."fondo_movimientos" ADD CONSTRAINT "fondo_movimientos_pkey" PRIMARY KEY (id);
CREATE TABLE public."fondo_mariana" ("created_at" timestamp with time zone,"id" uuid,"nombre" text,"ubicacion_id" integer);
ALTER TABLE public."fondo_mariana" ADD CONSTRAINT "fondo_mariana_pkey" PRIMARY KEY (id);
CREATE TABLE public."pagos_proveedor" ("created_at" timestamp with time zone,"entrada_id" integer,"fecha" timestamp with time zone,"forma_pago" forma_pago_proveedor,"id" integer,"importe" numeric(12,2),"movimiento_origen_id" integer,"notas" text,"proveedor_id" integer,"referencia" text,"tipo" tipo_pago_proveedor,"usuario_id" integer);
ALTER TABLE public."pagos_proveedor" ADD CONSTRAINT "pagos_proveedor_pkey" PRIMARY KEY (id);
CREATE TABLE public."aplicaciones_pago_proveedor" ("compra_proveedor_id" integer,"created_at" timestamp with time zone,"id" integer,"importe" numeric(12,2),"pago_proveedor_id" integer);
ALTER TABLE public."aplicaciones_pago_proveedor" ADD CONSTRAINT "aplicaciones_pago_proveedor_pago_compra_uidx" UNIQUE (pago_proveedor_id, compra_proveedor_id);
ALTER TABLE public."aplicaciones_pago_proveedor" ADD CONSTRAINT "aplicaciones_pago_proveedor_pkey" PRIMARY KEY (id);
CREATE TABLE public."solicitudes_pago_dirigido" ("autorizador_id" integer,"autorizador_nombre" text,"contraparte_nombre" text,"created_at" timestamp with time zone,"cuenta_destino" text,"documento_folio" text,"documento_movimiento_id" integer,"entidad_id" integer,"estado" estado_solicitud_pago_dirigido,"fecha_efectiva" timestamp with time zone,"forma_pago" text,"id" integer,"importe" numeric(12,2),"motivo" text,"motivo_rechazo" text,"movimiento_id" integer,"notas" text,"referencia" text,"resuelta_at" timestamp with time zone,"solicitante_id" integer,"solicitante_nombre" text,"tipo" tipo_solicitud_pago_dirigido,"ubicacion_id" integer,"ubicacion_nombre" text);
ALTER TABLE public."solicitudes_pago_dirigido" ADD CONSTRAINT "solicitudes_pago_dirigido_pkey" PRIMARY KEY (id);
CREATE TABLE public."auditoria" ("accion" text,"created_at" timestamp with time zone,"datos_antes" jsonb,"datos_despues" jsonb,"entidad" text,"entidad_id" text,"id" bigint,"ip" text,"modulo" text,"rol_snapshot" text,"sitio_id" integer,"sitio_snapshot" text,"usuario_id" integer,"usuario_snapshot" text);
ALTER TABLE public."auditoria" ADD CONSTRAINT "auditoria_pkey" PRIMARY KEY (id);
CREATE TABLE public."movimientos_credito" ("autorizado_por" integer,"cliente_id" integer,"created_at" timestamp with time zone,"cuenta_destino" text,"dias_plazo" integer,"e2_insert_xid" xid8,"es_incobrable" boolean,"fecha_vencimiento" date,"forma_pago" forma_pago_cuenta,"id" integer,"importe" numeric(12,2),"metadata" text,"motivo_incobrable" text,"movimiento_origen_id" integer,"naturaleza" naturaleza_credito_e1,"nota_origen_id" integer,"notas" text,"operacion_clave" uuid,"operacion_productor" text,"origen_justificacion" text,"referencia" text,"sesion_caja_id" integer,"sitio_origen_id" integer,"ticket_id" integer,"tipo" tipo_movimiento_credito,"usuario_id" integer);
ALTER TABLE public."movimientos_credito" ADD CONSTRAINT "movimientos_credito_pkey" PRIMARY KEY (id);
CREATE TABLE public."operaciones_credito_e1" ("clave" uuid,"created_at" timestamp with time zone,"naturaleza" naturaleza_credito_e1,"productor" text,"solicitud_canonica" jsonb,"usuario_id" integer);
ALTER TABLE public."operaciones_credito_e1" ADD CONSTRAINT "operaciones_pk_e1" PRIMARY KEY (productor, clave);
ALTER TABLE public."operaciones_credito_e1" ADD CONSTRAINT "operaciones_productor_naturaleza_ck_e1" CHECK ((productor = ANY (ARRAY['VENTA_CREDITO'::text, 'CANCELACION_VENTA_CREDITO'::text])) AND naturaleza = 'OPERACION_CREDITO_SIN_DINERO'::naturaleza_credito_e1 OR (productor = ANY (ARRAY['AJUSTE_MANUAL'::text, 'BAJA_INCOBRABLE'::text])) AND naturaleza = 'CORRECCION_CONTABLE'::naturaleza_credito_e1 OR (productor = ANY (ARRAY['ABONO_ORDINARIO'::text, 'ABONO_DIRIGIDO'::text])) AND (naturaleza = ANY (ARRAY['INGRESO_FISICO'::naturaleza_credito_e1, 'CORRECCION_CONTABLE'::naturaleza_credito_e1])) OR productor = 'REVERSO_ABONO'::text AND (naturaleza = ANY (ARRAY['DEVOLUCION_FISICA'::naturaleza_credito_e1, 'CORRECCION_CONTABLE'::naturaleza_credito_e1])) OR productor = 'COBRO_PENDIENTE'::text AND naturaleza = 'INGRESO_FISICO'::naturaleza_credito_e1);
CREATE TABLE public."cobros_credito_pendientes_e1" ("cliente_id" integer,"created_at" timestamp with time zone,"cuenta_destino" text,"e2_insert_xid" xid8,"fecha_real" timestamp with time zone,"importe" numeric(12,2),"medio" forma_pago_cuenta,"motivo" text,"naturaleza" naturaleza_credito_e1,"operacion_clave" uuid,"operacion_productor" text,"referencia" text,"sesion_caja_id" integer,"sitio_origen_id" integer,"usuario_id" integer);
ALTER TABLE public."cobros_credito_pendientes_e1" ADD CONSTRAINT "cobros_pk_e1" PRIMARY KEY (operacion_productor, operacion_clave);
CREATE TABLE public."aplicaciones_credito" ("abono_movimiento_id" integer,"created_at" timestamp with time zone,"id" integer,"importe" numeric(12,2),"venta_movimiento_id" integer);
ALTER TABLE public."aplicaciones_credito" ADD CONSTRAINT "aplicaciones_credito_abono_venta_uidx" UNIQUE (abono_movimiento_id, venta_movimiento_id);
ALTER TABLE public."aplicaciones_credito" ADD CONSTRAINT "aplicaciones_credito_pkey" PRIMARY KEY (id);
CREATE TABLE public."tickets" ("autorizacion_estado" text,"autorizado_at" timestamp with time zone,"autorizado_por" integer,"cancelado_at" timestamp with time zone,"cancelado_por" integer,"cliente_id" integer,"cobrado" boolean,"cobrado_at" timestamp with time zone,"created_at" timestamp with time zone,"credito" boolean,"dias_plazo" integer,"direccion_entrega_snapshot" text,"documento_tipo" text,"estado" estado_ticket,"facturado" boolean,"fecha_vencimiento" date,"folio" integer,"id" integer,"iva" numeric(12,2),"motivo_cancelacion" text,"nombre_destinatario" text,"nota_sin_precios" boolean,"sesion_caja_id" integer,"subtotal" numeric(12,2),"tasa_iva" numeric(5,4),"total" numeric(12,2),"ubicacion_id" integer,"usuario_caja_id" integer,"usuario_terminal_id" integer,"uuid_cliente" uuid);
ALTER TABLE public."tickets" ADD CONSTRAINT "tickets_folio_unique" UNIQUE (folio);
ALTER TABLE public."tickets" ADD CONSTRAINT "tickets_pkey" PRIMARY KEY (id);
ALTER TABLE public."tickets" ADD CONSTRAINT "tickets_uuid_cliente_unique" UNIQUE (uuid_cliente);
CREATE TABLE public."notificaciones_sistema" ("created_at" timestamp with time zone,"destinatario_usuario_id" integer,"entidad" text,"entidad_id" text,"id" integer,"leida_at" timestamp with time zone,"mensaje" text,"prioridad" text,"tipo" text,"titulo" text);
ALTER TABLE public."notificaciones_sistema" ADD CONSTRAINT "notificaciones_sistema_pkey" PRIMARY KEY (id);
CREATE OR REPLACE FUNCTION public.validar_movimiento_credito_e1()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  op public.operaciones_credito_e1%ROWTYPE;
  origen public.movimientos_credito%ROWTYPE;
BEGIN
  -- Sin corte de fecha: aplica a TODO INSERT, aunque created_at sea histórico.
  IF NEW.sitio_origen_id IS NULL OR NEW.naturaleza IS NULL
    OR NEW.operacion_productor IS NULL OR NEW.operacion_clave IS NULL THEN
    RAISE EXCEPTION 'E1: todo INSERT requiere sitio, naturaleza y clave/productor explícitos';
  END IF;
  SELECT * INTO op FROM public.operaciones_credito_e1
    WHERE productor = NEW.operacion_productor AND clave = NEW.operacion_clave;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E1: registre primero la operación en esta misma unidad transaccional';
  END IF;
  IF op.usuario_id IS DISTINCT FROM NEW.usuario_id
    OR op.naturaleza IS DISTINCT FROM NEW.naturaleza THEN
    RAISE EXCEPTION 'E1: actor/naturaleza no coinciden con la operación';
  END IF;
  IF NEW.importe IS NULL OR NEW.importe = 0
    OR NEW.importe IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric) THEN
    RAISE EXCEPTION 'E1: importe finito distinto de cero obligatorio';
  END IF;
  IF NOT (
    (NEW.operacion_productor = 'VENTA_CREDITO' AND NEW.tipo = 'VENTA_CREDITO' AND NEW.importe > 0)
    OR (NEW.operacion_productor IN ('ABONO_ORDINARIO', 'ABONO_DIRIGIDO')
      AND NEW.tipo = 'ABONO' AND NEW.importe < 0)
    OR (NEW.operacion_productor = 'REVERSO_ABONO' AND NEW.tipo = 'REVERSO' AND NEW.importe > 0)
    OR (NEW.operacion_productor = 'CANCELACION_VENTA_CREDITO'
      AND NEW.tipo = 'REVERSO' AND NEW.importe < 0)
    OR (NEW.operacion_productor = 'AJUSTE_MANUAL' AND NEW.tipo = 'AJUSTE' AND NOT NEW.es_incobrable)
    OR (NEW.operacion_productor = 'BAJA_INCOBRABLE'
      AND NEW.tipo = 'AJUSTE' AND NEW.es_incobrable AND NEW.importe < 0)
  ) THEN
    RAISE EXCEPTION 'E1: productor incompatible con tipo/signo/incobrable; COBRO_PENDIENTE no entra al ledger';
  END IF;
  IF NEW.tipo = 'REVERSO' THEN
    SELECT * INTO origen FROM public.movimientos_credito WHERE id = NEW.movimiento_origen_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E1: falta movimiento de origen del reverso';
    END IF;
    IF (NEW.operacion_productor = 'REVERSO_ABONO' AND origen.tipo <> 'ABONO')
      OR (NEW.operacion_productor = 'CANCELACION_VENTA_CREDITO' AND origen.tipo <> 'VENTA_CREDITO') THEN
      RAISE EXCEPTION 'E1: productor de reverso incompatible con el origen';
    END IF;
    -- El trigger previo validate_credit_reversal conserva la comprobación
    -- del importe exacto, cliente y ticket. No se sustituye ni se deshabilita.
  END IF;
  PERFORM public.validar_contexto_credito_e1(
    NEW.usuario_id, NEW.sitio_origen_id, NEW.naturaleza,
    NEW.forma_pago, NEW.cuenta_destino, NEW.sesion_caja_id
  );
  IF NEW.nota_origen_id IS NOT NULL THEN
    PERFORM 1 FROM public.tickets
      WHERE id = NEW.nota_origen_id AND documento_tipo = 'NOTA'
        AND cliente_id = NEW.cliente_id AND ubicacion_id = NEW.sitio_origen_id FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E1: nota de origen debe ser NOTA del mismo cliente y sitio atribuido';
    END IF;
  END IF;
  IF NEW.tipo = 'AJUSTE' AND NEW.nota_origen_id IS NULL
    AND NULLIF(btrim(NEW.origen_justificacion), '') IS NULL THEN
    RAISE EXCEPTION 'E1: ajuste sin nota identificada exige justificación de origen';
  END IF;
  IF NEW.naturaleza = 'CORRECCION_CONTABLE'
    AND NULLIF(btrim(NEW.origen_justificacion), '') IS NULL THEN
    RAISE EXCEPTION 'E1: corrección/recaptura exige justificación explícita; el medio histórico no prueba efectivo';
  END IF;
  IF NEW.operacion_productor = 'BAJA_INCOBRABLE'
    AND NULLIF(btrim(NEW.motivo_incobrable), '') IS NULL THEN
    RAISE EXCEPTION 'E1: baja incobrable exige motivo';
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.e1_guard_pending_receipts_closed()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'E1P01',
    MESSAGE = 'E1: el cobro retenido de crédito está deshabilitado.';
  RETURN NULL;
END;
$function$
;
CREATE TRIGGER zz_e1_pending_receipts_closed AFTER INSERT ON cobros_credito_pendientes_e1 FOR EACH STATEMENT EXECUTE FUNCTION e1_guard_pending_receipts_closed();
CREATE TABLE public.tanda_b_probe(id bigserial PRIMARY KEY, value text NOT NULL); INSERT INTO public.tanda_b_probe(value) VALUES ('disposable-only');
CREATE TABLE public."permisos_rol" ("id" integer,"modulo" text,"puede_autorizar" boolean,"puede_crear" boolean,"puede_editar" boolean,"puede_ver" boolean,"rol" rol_usuario,"updated_at" timestamp with time zone,"updated_por" integer);
ALTER TABLE public."permisos_rol" ADD CONSTRAINT "permisos_rol_pkey" PRIMARY KEY (id);
ALTER TABLE public."permisos_rol" ADD CONSTRAINT "permisos_rol_rol_modulo_unique" UNIQUE (rol, modulo);

CREATE TABLE public."atribuciones_credito_e1" ("anterior_id" uuid,"created_at" timestamp with time zone,"evidencia" text,"id" uuid,"identidad_snapshot" jsonb,"motivo" text,"movimiento_created_at" timestamp with time zone,"movimiento_id" integer,"sitio_origen_id" integer,"usuario_id" integer);
ALTER TABLE public."atribuciones_credito_e1" ADD CONSTRAINT "atribuciones_cadena_uq_e1" UNIQUE NULLS NOT DISTINCT (movimiento_id, anterior_id);
ALTER TABLE public."atribuciones_credito_e1" ADD CONSTRAINT "atribuciones_pk_e1" PRIMARY KEY (id);

CREATE TABLE public."finalizaciones_abono_e2" ("abono_id" integer,"aplicado" numeric(12,2),"cliente_id" integer,"contrato_revision" text,"created_at" timestamp with time zone,"evaluacion" jsonb,"importe" numeric(12,2),"operacion_clave" uuid,"operacion_productor" text,"resultado" text);
ALTER TABLE public."finalizaciones_abono_e2" ADD CONSTRAINT "finalizaciones_abono_e2_operacion_productor_operacion_clave_key" UNIQUE (operacion_productor, operacion_clave);
ALTER TABLE public."finalizaciones_abono_e2" ADD CONSTRAINT "finalizaciones_abono_e2_pkey" PRIMARY KEY (abono_id);

CREATE TABLE public."evidencia_no_aplicada_e2" ("abono_id" integer,"cliente_id" integer,"cobro_clave" uuid,"cobro_productor" text,"created_at" timestamp with time zone,"forma_pago" text,"fuente" text,"importe" numeric(12,2),"naturaleza" text);
ALTER TABLE public."evidencia_no_aplicada_e2" ADD CONSTRAINT "evidencia_no_aplicada_e2_abono_id_key" UNIQUE (abono_id);
ALTER TABLE public."evidencia_no_aplicada_e2" ADD CONSTRAINT "evidencia_no_aplicada_e2_cobro_clave_key" UNIQUE (cobro_clave);
ALTER TABLE public."evidencia_no_aplicada_e2" ADD CONSTRAINT "evidencia_no_aplicada_e2_pkey" PRIMARY KEY (fuente);
CREATE SEQUENCE public.permisos_rol_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER TABLE ONLY public.permisos_rol ALTER COLUMN id SET DEFAULT nextval('public.permisos_rol_id_seq'::regclass);
CREATE OR REPLACE FUNCTION public.e1_guard_cash_capture_closed()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF NEW.forma_pago::text = 'EFECTIVO'
     AND NEW.naturaleza::text IN ('INGRESO_FISICO', 'DEVOLUCION_FISICA') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'E1C01',
      MESSAGE = 'E1: la captura física de efectivo de crédito está deshabilitada.';
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.e1_guard_historical_attribution_closed()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'E1A01',
    MESSAGE = 'E1: la atribución histórica de crédito está deshabilitada.';
  RETURN NULL;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.e2_attest_new_retained(p_clave uuid)
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
$function$
;
CREATE OR REPLACE FUNCTION public.e2_finalize_new_abono(p_abono_id integer, p_productor text, p_resultado text, p_aplicado_cents bigint, p_evaluacion jsonb, p_contrato_revision text)
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
$function$
;
CREATE OR REPLACE FUNCTION public.e2_guard_finalized_capture_application()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  source_xid xid8;
BEGIN
  SELECT e2_insert_xid INTO source_xid FROM public.movimientos_credito
    WHERE id = NEW.abono_movimiento_id FOR SHARE;
  IF source_xid = pg_current_xact_id()
     AND EXISTS (SELECT 1 FROM public.finalizaciones_abono_e2
                 WHERE abono_id = NEW.abono_movimiento_id) THEN
    RAISE EXCEPTION 'E2: capture applications must precede finalization';
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.e2_reject_evidence_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'E2: evidence/finalization is immutable';
END;
$function$
;
CREATE OR REPLACE FUNCTION public.e2_require_abono_finalization()
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
$function$
;
CREATE OR REPLACE FUNCTION public.e2_stamp_insert_transaction()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.e2_insert_xid := pg_current_xact_id();
  ELSE
    -- UPDATE creates a tuple version, not a new receipt. Ignore supplied stamps.
    NEW.e2_insert_xid := OLD.e2_insert_xid;
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.e2_validate_abono_finalization()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  source_xid xid8;
  source_client integer;
  source_amount numeric;
  source_producer text;
  source_key uuid;
  allocation_count integer;
  allocation_sum bigint;
BEGIN
  SELECT m.e2_insert_xid, m.cliente_id, -m.importe,
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
     OR source_xid IS DISTINCT FROM pg_current_xact_id()
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
$function$
;
CREATE OR REPLACE FUNCTION public.e2_validate_unused_proof()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  final_row public.finalizaciones_abono_e2%ROWTYPE;
  retained_xid xid8;
  retained_customer integer;
  retained_amount numeric;
BEGIN
  IF NEW.abono_id IS NULL THEN
    SELECT e2_insert_xid, cliente_id, importe
      INTO retained_xid, retained_customer, retained_amount
      FROM public.cobros_credito_pendientes_e1
      WHERE operacion_productor = NEW.cobro_productor
        AND operacion_productor = 'COBRO_PENDIENTE'
        AND operacion_clave = NEW.cobro_clave
        AND naturaleza = 'INGRESO_FISICO' AND medio = 'EFECTIVO'
        AND cuenta_destino = 'CAJA_FISICA' AND sesion_caja_id IS NOT NULL
      FOR SHARE;
    IF retained_xid IS NULL
       OR retained_xid IS DISTINCT FROM pg_current_xact_id()
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
$function$
;
CREATE OR REPLACE FUNCTION public.impedir_mutacion_credito_e1()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'E1: % sobre % está prohibido; evidencia inmutable', TG_OP, TG_TABLE_NAME;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.validar_atribucion_credito_e1()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  original public.movimientos_credito%ROWTYPE;
  anterior public.atribuciones_credito_e1%ROWTYPE;
  actor public.usuarios%ROWTYPE;
  esperado jsonb;
BEGIN
  SELECT * INTO actor FROM public.usuarios WHERE id = NEW.usuario_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E1: actor de atribución inexistente';
  END IF;
  IF NOT actor.activo OR actor.rol NOT IN ('ADMIN', 'SUPERVISOR') THEN
    RAISE EXCEPTION 'E1: atribución sólo por ADMIN/SUPERVISOR activo';
  END IF;
  IF actor.rol = 'SUPERVISOR' AND actor.ubicacion_id IS DISTINCT FROM NEW.sitio_origen_id THEN
    RAISE EXCEPTION 'E1: supervisor sólo puede atribuir a su propio sitio asignado';
  END IF;
  PERFORM 1 FROM public.ubicaciones
    WHERE id = NEW.sitio_origen_id AND activa AND tipo = 'TIENDA' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E1: sitio de atribución debe ser TIENDA activa';
  END IF;
  SELECT * INTO original FROM public.movimientos_credito
    WHERE id = NEW.movimiento_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E1: movimiento original inexistente';
  END IF;
  IF original.sitio_origen_id IS NOT NULL THEN
    RAISE EXCEPTION 'E1: atribución histórica sólo para movimientos sin sitio E1';
  END IF;
  IF NEW.movimiento_created_at IS DISTINCT FROM original.created_at THEN
    RAISE EXCEPTION 'E1: created_at no coincide exactamente con el movimiento original';
  END IF;
  esperado := jsonb_build_object(
    'cliente_id', original.cliente_id,
    'tipo', original.tipo::text,
    'importe', original.importe,
    'ticket_id', original.ticket_id,
    'movimiento_origen_id', original.movimiento_origen_id
  );
  IF NEW.identidad_snapshot IS DISTINCT FROM esperado THEN
    RAISE EXCEPTION 'E1: snapshot canónico no coincide con identidad del movimiento original';
  END IF;
  IF NEW.anterior_id IS NOT NULL THEN
    SELECT * INTO anterior FROM public.atribuciones_credito_e1 WHERE id = NEW.anterior_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E1: predecesor debe existir antes de insertar la rectificación';
    END IF;
    IF anterior.movimiento_id IS DISTINCT FROM NEW.movimiento_id
      OR anterior.movimiento_created_at IS DISTINCT FROM NEW.movimiento_created_at
      OR anterior.identidad_snapshot IS DISTINCT FROM NEW.identidad_snapshot THEN
      RAISE EXCEPTION 'E1: rectificación debe conservar movimiento y snapshot de su predecesor';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.validar_cobro_pendiente_e1()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  op public.operaciones_credito_e1%ROWTYPE;
BEGIN
  SELECT * INTO op FROM public.operaciones_credito_e1
    WHERE productor = NEW.operacion_productor AND clave = NEW.operacion_clave;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E1: cobro pendiente requiere una operación previamente insertada';
  END IF;
  IF op.productor <> 'COBRO_PENDIENTE' OR op.naturaleza <> 'INGRESO_FISICO'
    OR op.naturaleza IS DISTINCT FROM NEW.naturaleza
    OR op.usuario_id IS DISTINCT FROM NEW.usuario_id THEN
    RAISE EXCEPTION 'E1: cobro pendiente exige productor exclusivo, ingreso físico y mismo actor';
  END IF;
  PERFORM public.validar_contexto_credito_e1(
    NEW.usuario_id, NEW.sitio_origen_id, NEW.naturaleza,
    NEW.medio, NEW.cuenta_destino, NEW.sesion_caja_id
  );
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.validar_contexto_credito_e1(p_usuario integer, p_sitio integer, p_naturaleza naturaleza_credito_e1, p_medio forma_pago_cuenta, p_cuenta text, p_sesion integer)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  PERFORM 1 FROM public.usuarios
    WHERE id = p_usuario AND activo FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E1: actor inexistente o inactivo';
  END IF;
  PERFORM 1 FROM public.ubicaciones
    WHERE id = p_sitio AND activa AND tipo = 'TIENDA' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E1: se requiere sitio de origen real, activo y TIENDA';
  END IF;
  IF p_naturaleza IS NULL THEN
    RAISE EXCEPTION 'E1: naturaleza obligatoria';
  END IF;
  IF p_naturaleza IN ('INGRESO_FISICO', 'DEVOLUCION_FISICA') THEN
    IF p_medio = 'EFECTIVO' THEN
      IF p_cuenta IS DISTINCT FROM 'CAJA_FISICA' OR p_sesion IS NULL THEN
        RAISE EXCEPTION 'E1: efectivo requiere CAJA_FISICA y sesión explícita';
      END IF;
      PERFORM 1 FROM public.sesiones_caja
        WHERE id = p_sesion AND ubicacion_id = p_sitio
          AND estado = 'ABIERTA' AND cerrada_at IS NULL FOR SHARE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'E1: la sesión debe estar abierta y pertenecer al mismo sitio';
      END IF;
    ELSIF p_medio IN ('TRANSFERENCIA', 'FACTURADO') THEN
      IF p_cuenta IS NULL OR p_cuenta NOT IN ('CUENTA_FISCAL', 'CUENTA_NO_FISCAL')
        OR p_sesion IS NOT NULL THEN
        RAISE EXCEPTION 'E1: transferencia/facturado requiere cuenta bancaria y ninguna sesión';
      END IF;
    ELSE
      RAISE EXCEPTION 'E1: medio físico no soportado: %', p_medio;
    END IF;
  ELSIF p_sesion IS NOT NULL THEN
    RAISE EXCEPTION 'E1: una operación sin dinero real no puede imputar sesión de caja';
  END IF;
END;
$function$
;
CREATE TRIGGER atribuciones_inmutables_e1 BEFORE DELETE OR UPDATE OR TRUNCATE ON atribuciones_credito_e1 FOR EACH STATEMENT EXECUTE FUNCTION impedir_mutacion_credito_e1();
CREATE TRIGGER atribuciones_validas_e1 BEFORE INSERT ON atribuciones_credito_e1 FOR EACH ROW EXECUTE FUNCTION validar_atribucion_credito_e1();
CREATE TRIGGER cobros_inmutables_e1 BEFORE DELETE OR UPDATE OR TRUNCATE ON cobros_credito_pendientes_e1 FOR EACH STATEMENT EXECUTE FUNCTION impedir_mutacion_credito_e1();
CREATE TRIGGER cobros_validos_e1 AFTER INSERT ON cobros_credito_pendientes_e1 FOR EACH ROW EXECUTE FUNCTION validar_cobro_pendiente_e1();
CREATE CONSTRAINT TRIGGER e2_abono_finalization_complete AFTER INSERT ON movimientos_credito DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION e2_require_abono_finalization();
CREATE TRIGGER e2_capture_application_order BEFORE INSERT ON aplicaciones_credito FOR EACH ROW EXECUTE FUNCTION e2_guard_finalized_capture_application();
CREATE TRIGGER e2_finalization_immutable BEFORE DELETE OR UPDATE OR TRUNCATE ON finalizaciones_abono_e2 FOR EACH STATEMENT EXECUTE FUNCTION e2_reject_evidence_mutation();
CREATE TRIGGER e2_proof_immutable BEFORE DELETE OR UPDATE OR TRUNCATE ON evidencia_no_aplicada_e2 FOR EACH STATEMENT EXECUTE FUNCTION e2_reject_evidence_mutation();
CREATE TRIGGER e2_retained_insert_transaction BEFORE INSERT OR UPDATE ON cobros_credito_pendientes_e1 FOR EACH ROW EXECUTE FUNCTION e2_stamp_insert_transaction();
CREATE TRIGGER e2_source_insert_transaction BEFORE INSERT OR UPDATE ON movimientos_credito FOR EACH ROW EXECUTE FUNCTION e2_stamp_insert_transaction();
CREATE TRIGGER e2_validate_abono_finalization BEFORE INSERT ON finalizaciones_abono_e2 FOR EACH ROW EXECUTE FUNCTION e2_validate_abono_finalization();
CREATE TRIGGER e2_validate_unused_proof BEFORE INSERT ON evidencia_no_aplicada_e2 FOR EACH ROW EXECUTE FUNCTION e2_validate_unused_proof();
CREATE TRIGGER movimientos_validos_e1 AFTER INSERT ON movimientos_credito FOR EACH ROW EXECUTE FUNCTION validar_movimiento_credito_e1();
CREATE TRIGGER operaciones_inmutables_e1 BEFORE DELETE OR UPDATE OR TRUNCATE ON operaciones_credito_e1 FOR EACH STATEMENT EXECUTE FUNCTION impedir_mutacion_credito_e1();
CREATE TRIGGER zz_e1_cash_capture_closed AFTER INSERT ON movimientos_credito FOR EACH ROW EXECUTE FUNCTION e1_guard_cash_capture_closed();
CREATE TRIGGER zz_e1_historical_attribution_closed AFTER INSERT ON atribuciones_credito_e1 FOR EACH STATEMENT EXECUTE FUNCTION e1_guard_historical_attribution_closed();
