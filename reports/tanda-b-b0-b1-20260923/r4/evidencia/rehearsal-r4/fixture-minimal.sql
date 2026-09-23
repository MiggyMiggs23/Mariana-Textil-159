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