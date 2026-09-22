-- EMPTY TEST FIXTURE ONLY. No domain rows or credentials.
BEGIN;
CREATE TYPE public."alcance_consulta" AS ENUM ('PROPIA','TODAS');
CREATE TYPE public."estado_rollo" AS ENUM ('PROGRAMADO','DISPONIBLE','EN_TRANSITO','MOSTRADOR','VENDIDO','BAJA');
CREATE TYPE public."estado_salida" AS ENUM ('ARMANDO','EN_TRANSITO','RECIBIDA','ENTREGADA','CANCELADA');
CREATE TYPE public."estado_sesion_caja" AS ENUM ('ABIERTA','CERRADA');
CREATE TYPE public."estado_solicitud_pago_dirigido" AS ENUM ('PENDIENTE','APROBADA','RECHAZADA');
CREATE TYPE public."estado_ticket" AS ENUM ('VENDIDO','CANCELADO');
CREATE TYPE public."forma_pago_cuenta" AS ENUM ('EFECTIVO','TRANSFERENCIA','FACTURADO','CHEQUE','OTRO','CREDITO');
CREATE TYPE public."forma_pago_proveedor" AS ENUM ('EFECTIVO','TRANSFERENCIA','CHEQUE','OTRO','FACTURADO');
CREATE TYPE public."forma_pago_ticket" AS ENUM ('EFECTIVO','TRANSFERENCIA','CREDITO','FACTURADO');
CREATE TYPE public."moneda" AS ENUM ('MXN','USD');
CREATE TYPE public."motivo_salida_extraordinaria" AS ENUM ('MERMA','ROBO','MUESTRA');
CREATE TYPE public."naturaleza_credito_e1" AS ENUM ('INGRESO_FISICO','DEVOLUCION_FISICA','CORRECCION_CONTABLE','OPERACION_CREDITO_SIN_DINERO');
CREATE TYPE public."precio_modo" AS ENUM ('ROLLO','MAYOREO','MENUDEO');
CREATE TYPE public."rol_usuario" AS ENUM ('ADMIN','CAJA','SUPERVISOR','BODEGA','SISTEMAS','CONTADOR');
ALTER TYPE public."rol_usuario" ADD VALUE 'TERMINAL' AFTER 'ADMIN';
CREATE TYPE public."tipo_movimiento_credito" AS ENUM ('VENTA_CREDITO','ABONO','REVERSO','AJUSTE');
CREATE TYPE public."tipo_movimiento" AS ENUM ('ALTA','RECEPCION','VENTA','DEVOLUCION','TRANSFERENCIA_SALIDA','TRANSFERENCIA_ENTRADA','SALIDA_MOSTRADOR','AJUSTE_POSITIVO','AJUSTE_NEGATIVO','CANCELACION','REACTIVACION_FALTANTE');
CREATE TYPE public."tipo_pago_proveedor" AS ENUM ('COMPRA','PAGO','AJUSTE','REVERSO');
CREATE TYPE public."tipo_proveedor" AS ENUM ('NACIONAL','IMPORTACION');
CREATE TYPE public."tipo_solicitud_pago_dirigido" AS ENUM ('CLIENTE','PROVEEDOR');
CREATE TYPE public."tipo_ticket" AS ENUM ('NORMAL','METREADO');
CREATE TYPE public."tipo_ubicacion" AS ENUM ('TIENDA','BODEGA','TRANSITO','EXTERNO');
CREATE TYPE public."unidad_producto" AS ENUM ('METRO','KILO','BOLSA','PIEZA');
CREATE SEQUENCE public."aplicaciones_credito_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."aplicaciones_pago_proveedor_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."auditoria_faltante_reactivaciones_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."auditoria_id_seq" AS bigint INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."auditoria_sobrante_decisiones_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."auditorias_inventario_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."autorizaciones_nota_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."camionetas_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."choferes_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."cliente_documentos_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."clientes_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."contenedor_lineas_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."contenedores_folio_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."contenedores_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."cuadre_fiscal_registros_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."entradas_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."equipos_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."fondo_movimientos_ordinal_seq" AS bigint INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."movimientos_credito_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."movimientos_id_seq" AS bigint INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."notificaciones_credito_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."notificaciones_sistema_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."pagos_proveedor_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."permisos_rol_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."permisos_ubicacion_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."permisos_usuario_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."pisos_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."precio_historial_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."productos_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."proveedores_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."reimpresiones_etiqueta_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."revisiones_etiqueta_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."rollos_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."salida_lineas_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."salida_rollos_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."salidas_dinero_caja_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."salidas_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."sesiones_caja_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."solicitudes_pago_dirigido_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."stock_minimo_episodios_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."stock_minimos_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."ticket_linea_consumos_id_seq" AS bigint INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."ticket_lineas_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."ticket_pagos_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."tickets_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."ubicaciones_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."usuarios_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public."viajes_id_seq" AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE OR REPLACE FUNCTION public.armor(bytea)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_armor$function$
;
CREATE OR REPLACE FUNCTION public.armor(bytea, text[], text[])
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_armor$function$
;
CREATE OR REPLACE FUNCTION public.crypt(text, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_crypt$function$
;
CREATE OR REPLACE FUNCTION public.dearmor(text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_dearmor$function$
;
CREATE OR REPLACE FUNCTION public.decrypt(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_decrypt$function$
;
CREATE OR REPLACE FUNCTION public.decrypt_iv(bytea, bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_decrypt_iv$function$
;
CREATE OR REPLACE FUNCTION public.digest(bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_digest$function$
;
CREATE OR REPLACE FUNCTION public.digest(text, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_digest$function$
;
CREATE OR REPLACE FUNCTION public.encrypt(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_encrypt$function$
;
CREATE OR REPLACE FUNCTION public.encrypt_iv(bytea, bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_encrypt_iv$function$
;
CREATE OR REPLACE FUNCTION public.gen_random_bytes(integer)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_random_bytes$function$
;
CREATE OR REPLACE FUNCTION public.gen_random_uuid()
 RETURNS uuid
 LANGUAGE c
 PARALLEL SAFE
AS '$libdir/pgcrypto', $function$pg_random_uuid$function$
;
CREATE OR REPLACE FUNCTION public.gen_salt(text)
 RETURNS text
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_gen_salt$function$
;
CREATE OR REPLACE FUNCTION public.gen_salt(text, integer)
 RETURNS text
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_gen_salt_rounds$function$
;
CREATE OR REPLACE FUNCTION public.hmac(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_hmac$function$
;
CREATE OR REPLACE FUNCTION public.hmac(text, text, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_hmac$function$
;
CREATE OR REPLACE FUNCTION public.pgp_armor_headers(text, OUT key text, OUT value text)
 RETURNS SETOF record
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_armor_headers$function$
;
CREATE OR REPLACE FUNCTION public.pgp_key_id(bytea)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_key_id_w$function$
;
CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt(bytea, bytea)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_text$function$
;
CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt(bytea, bytea, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_text$function$
;
CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt(bytea, bytea, text, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_text$function$
;
CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_bytea$function$
;
CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_bytea$function$
;
CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea, text, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_bytea$function$
;
CREATE OR REPLACE FUNCTION public.pgp_pub_encrypt(text, bytea)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_encrypt_text$function$
;
CREATE OR REPLACE FUNCTION public.pgp_pub_encrypt(text, bytea, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_encrypt_text$function$
;
CREATE OR REPLACE FUNCTION public.pgp_pub_encrypt_bytea(bytea, bytea)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_encrypt_bytea$function$
;
CREATE OR REPLACE FUNCTION public.pgp_pub_encrypt_bytea(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_encrypt_bytea$function$
;
CREATE OR REPLACE FUNCTION public.pgp_sym_decrypt(bytea, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_decrypt_text$function$
;
CREATE OR REPLACE FUNCTION public.pgp_sym_decrypt(bytea, text, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_decrypt_text$function$
;
CREATE OR REPLACE FUNCTION public.pgp_sym_decrypt_bytea(bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_decrypt_bytea$function$
;
CREATE OR REPLACE FUNCTION public.pgp_sym_decrypt_bytea(bytea, text, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_decrypt_bytea$function$
;
CREATE OR REPLACE FUNCTION public.pgp_sym_encrypt(text, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_encrypt_text$function$
;
CREATE OR REPLACE FUNCTION public.pgp_sym_encrypt(text, text, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_encrypt_text$function$
;
CREATE OR REPLACE FUNCTION public.pgp_sym_encrypt_bytea(bytea, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_encrypt_bytea$function$
;
CREATE OR REPLACE FUNCTION public.pgp_sym_encrypt_bytea(bytea, text, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_encrypt_bytea$function$
;
CREATE TABLE public."aplicaciones_credito" ("abono_movimiento_id" integer NOT NULL,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"id" integer NOT NULL DEFAULT nextval('aplicaciones_credito_id_seq'::regclass),"importe" numeric(12,2) NOT NULL,"venta_movimiento_id" integer NOT NULL);
CREATE TABLE public."aplicaciones_pago_proveedor" ("compra_proveedor_id" integer NOT NULL,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"id" integer NOT NULL DEFAULT nextval('aplicaciones_pago_proveedor_id_seq'::regclass),"importe" numeric(12,2) NOT NULL,"pago_proveedor_id" integer NOT NULL);
CREATE TABLE public."atribuciones_credito_e1" ("anterior_id" uuid,"created_at" timestamp with time zone NOT NULL DEFAULT transaction_timestamp(),"evidencia" text NOT NULL,"id" uuid NOT NULL,"identidad_snapshot" jsonb NOT NULL,"motivo" text NOT NULL,"movimiento_created_at" timestamp with time zone NOT NULL,"movimiento_id" integer NOT NULL,"sitio_origen_id" integer NOT NULL,"usuario_id" integer NOT NULL);
CREATE TABLE public."auditoria" ("accion" text NOT NULL,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"datos_antes" jsonb,"datos_despues" jsonb,"entidad" text NOT NULL,"entidad_id" text,"id" bigint NOT NULL DEFAULT nextval('auditoria_id_seq'::regclass),"ip" text NOT NULL,"modulo" text,"rol_snapshot" text,"sitio_id" integer,"sitio_snapshot" text,"usuario_id" integer,"usuario_snapshot" text);
CREATE TABLE public."auditoria_faltante_reactivaciones" ("auditoria_origen_id" integer NOT NULL,"auditorias_posteriores" jsonb NOT NULL,"cantidad_restaurada" numeric(10,3) NOT NULL,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"id" integer NOT NULL DEFAULT nextval('auditoria_faltante_reactivaciones_id_seq'::regclass),"motivo" text NOT NULL,"movimiento_baja_id" bigint NOT NULL,"movimiento_reactivacion_id" bigint NOT NULL,"origen" text NOT NULL,"piso_aparicion_id" integer,"rollo_id" integer NOT NULL,"ubicacion_aparicion_id" integer NOT NULL,"usuario_id" integer NOT NULL,"uuid_cliente" uuid NOT NULL);
CREATE TABLE public."auditoria_inventario_escaneos" ("auditoria_id" integer NOT NULL,"cantidad_cierre" numeric(10,3),"color_cierre" text,"escaneado_at" timestamp with time zone NOT NULL DEFAULT now(),"estado_cierre" text,"piso_real" text,"piso_real_id" integer,"resolucion" text NOT NULL DEFAULT 'PENDIENTE'::text,"rollo_id" integer,"serie" text NOT NULL,"sku_cierre" text,"tela_cierre" text,"ubicacion_cierre" text,"ubicacion_cierre_id" integer,"unidad_cierre" text,"usuario_id" integer NOT NULL);
CREATE TABLE public."auditoria_inventario_folio" ("ubicacion_id" integer NOT NULL,"ultimo_folio" integer NOT NULL DEFAULT 0);
CREATE TABLE public."auditoria_inventario_participantes" ("auditoria_id" integer NOT NULL,"escaneos" integer NOT NULL DEFAULT 0,"primero_at" timestamp with time zone NOT NULL DEFAULT now(),"ultimo_at" timestamp with time zone NOT NULL DEFAULT now(),"usuario_id" integer NOT NULL);
CREATE TABLE public."auditoria_inventario_snapshot" ("auditoria_id" integer NOT NULL,"cantidad_snapshot" numeric(10,3) NOT NULL,"color_snapshot" text NOT NULL,"estado_snapshot" text NOT NULL,"piso_snapshot" text,"piso_snapshot_id" integer,"resolucion" text NOT NULL DEFAULT 'PENDIENTE'::text,"rollo_id" integer NOT NULL,"serie" text NOT NULL,"sku_snapshot" text NOT NULL,"tela_snapshot" text NOT NULL,"ubicacion_snapshot" text NOT NULL,"ubicacion_snapshot_id" integer NOT NULL,"unidad_snapshot" text NOT NULL);
CREATE TABLE public."auditoria_sobrante_contextos" ("auditoria_id" integer NOT NULL,"contexto" jsonb NOT NULL,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"serie" text NOT NULL);
CREATE TABLE public."auditoria_sobrante_decisiones" ("auditoria_id" integer NOT NULL,"contexto" jsonb NOT NULL,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"decision" text NOT NULL,"id" integer NOT NULL DEFAULT nextval('auditoria_sobrante_decisiones_id_seq'::regclass),"motivo" text NOT NULL,"rollo_id" integer,"salida_id" integer,"serie" text NOT NULL,"usuario_id" integer NOT NULL,"uuid_cliente" uuid NOT NULL);
CREATE TABLE public."auditorias_inventario" ("abierta_at" timestamp with time zone NOT NULL DEFAULT now(),"cancelada_at" timestamp with time zone,"cancelada_por_id" integer,"cerrada_at" timestamp with time zone,"cerrada_por_id" integer,"confirmada_at" timestamp with time zone,"confirmada_por_id" integer,"creada_por_id" integer NOT NULL,"estado" text NOT NULL DEFAULT 'ABIERTA'::text,"folio" integer NOT NULL,"id" integer NOT NULL DEFAULT nextval('auditorias_inventario_id_seq'::regclass),"motivo_cancelacion" text,"ubicacion_id" integer NOT NULL);
CREATE TABLE public."autorizaciones_nota" ("created_at" timestamp with time zone NOT NULL DEFAULT now(),"id" integer NOT NULL DEFAULT nextval('autorizaciones_nota_id_seq'::regclass),"movimiento_credito_id" integer NOT NULL,"sesion_caja_id" integer NOT NULL,"ticket_id" integer NOT NULL,"usuario_id" integer NOT NULL);
CREATE TABLE public."camionetas" ("activa" boolean NOT NULL DEFAULT true,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"id" integer NOT NULL DEFAULT nextval('camionetas_id_seq'::regclass),"marca" text,"modelo" text,"nombre" text NOT NULL,"placas" text NOT NULL,"tipo" text NOT NULL,"updated_at" timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE public."choferes" ("activo" boolean NOT NULL DEFAULT true,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"id" integer NOT NULL DEFAULT nextval('choferes_id_seq'::regclass),"nombre_completo" text NOT NULL,"telefono" text NOT NULL,"updated_at" timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE public."cliente_documentos" ("cliente_id" integer NOT NULL,"id" integer NOT NULL DEFAULT nextval('cliente_documentos_id_seq'::regclass),"lado" text NOT NULL,"mime_type" text NOT NULL,"nombre_archivo" text NOT NULL,"public_id" uuid NOT NULL DEFAULT gen_random_uuid(),"reemplaza_id" integer,"ruta_archivo" text NOT NULL,"subido_at" timestamp with time zone NOT NULL DEFAULT now(),"subido_por" integer NOT NULL,"tamano_bytes" integer NOT NULL,"tipo" text NOT NULL DEFAULT 'INE'::text,"vigente" boolean NOT NULL DEFAULT true);
CREATE TABLE public."clientes" ("activo" boolean NOT NULL DEFAULT true,"contacto_nombre" text,"correo" text,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"dias_credito" integer NOT NULL DEFAULT 0,"direccion_entrega" text,"direccion_particular" text,"es_sistema" boolean NOT NULL DEFAULT false,"id" integer NOT NULL DEFAULT nextval('clientes_id_seq'::regclass),"limite_credito" numeric(14,2) NOT NULL DEFAULT 0.00,"nombre" text NOT NULL,"notas" text,"recibe_nota_sin_precios" boolean NOT NULL DEFAULT false,"rfc" text,"saldo_credito" numeric(14,2) NOT NULL DEFAULT 0.00,"telefono" text,"updated_at" timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE public."cobros_credito_pendientes_e1" ("cliente_id" integer NOT NULL,"created_at" timestamp with time zone NOT NULL DEFAULT transaction_timestamp(),"cuenta_destino" text NOT NULL,"fecha_real" timestamp with time zone NOT NULL,"importe" numeric(12,2) NOT NULL,"medio" forma_pago_cuenta NOT NULL,"motivo" text,"naturaleza" naturaleza_credito_e1 NOT NULL,"operacion_clave" uuid NOT NULL,"operacion_productor" text NOT NULL,"referencia" text,"sesion_caja_id" integer,"sitio_origen_id" integer NOT NULL,"usuario_id" integer NOT NULL);
CREATE TABLE public."contenedor_lineas" ("cantidad_esperada" numeric(10,3) NOT NULL,"contenedor_id" integer NOT NULL,"id" integer NOT NULL DEFAULT nextval('contenedor_lineas_id_seq'::regclass),"nota" text,"producto_id" integer NOT NULL,"rollos_esperados" integer);
CREATE TABLE public."contenedores" ("created_at" timestamp with time zone NOT NULL DEFAULT now(),"entrada_id" integer,"estado" text NOT NULL DEFAULT 'EN_TRANSITO'::text,"fecha_estimada_llegada" date NOT NULL,"fecha_pedido" date,"fecha_real_llegada" date,"folio" integer NOT NULL DEFAULT nextval('contenedores_folio_seq'::regclass),"id" integer NOT NULL DEFAULT nextval('contenedores_id_seq'::regclass),"motivo_cancelacion" text,"notas" text,"proveedor_id" integer NOT NULL,"referencia" text,"sitio_destino_id" integer NOT NULL,"updated_at" timestamp with time zone NOT NULL DEFAULT now(),"usuario_id" integer NOT NULL);
CREATE TABLE public."cuadre_fiscal_registros" ("actor_id" integer NOT NULL,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"descripcion" text,"desde" date NOT NULL,"direccion" text,"estado" text NOT NULL,"facturado_congelado" numeric(12,2) NOT NULL,"hasta" date NOT NULL,"id" integer NOT NULL DEFAULT nextval('cuadre_fiscal_registros_id_seq'::regclass),"monto" numeric(12,2),"nota_resolucion" text,"resuelto_at" timestamp with time zone,"resuelto_por_id" integer,"tipo" text NOT NULL,"ubicacion_id" integer);
CREATE TABLE public."entrada_folio" ("ubicacion_id" integer NOT NULL,"ultimo_folio" integer NOT NULL DEFAULT 0);
CREATE TABLE public."entradas" ("created_at" timestamp with time zone NOT NULL DEFAULT now(),"fecha" timestamp with time zone NOT NULL,"folio" integer NOT NULL,"id" integer NOT NULL DEFAULT nextval('entradas_id_seq'::regclass),"observaciones" text,"proveedor_id" integer,"total_costo" numeric(12,2),"total_rollos" integer NOT NULL,"ubicacion_id" integer NOT NULL,"usuario_id" integer NOT NULL,"uuid_cliente" uuid NOT NULL);
CREATE TABLE public."equipos" ("actualizado_por" integer NOT NULL,"creado_por" integer NOT NULL,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"id" integer NOT NULL DEFAULT nextval('equipos_id_seq'::regclass),"identificador" text NOT NULL,"marca" text NOT NULL,"modelo" text NOT NULL,"notas" text,"numero_serie" text,"tipo" text NOT NULL,"ubicacion_id" integer NOT NULL,"updated_at" timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE public."equipos_checklist" ("checked_at" timestamp with time zone NOT NULL DEFAULT now(),"checked_por" integer NOT NULL,"equipo_id" integer NOT NULL,"item_key" text NOT NULL);
CREATE TABLE public."existencias" ("cantidad_total" numeric(10,3) NOT NULL DEFAULT '0'::numeric,"producto_id" integer NOT NULL,"rollos_count" integer NOT NULL DEFAULT 0,"ubicacion_id" integer NOT NULL,"updated_at" timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE public."fondo_arqueos" ("autor_id" integer NOT NULL,"created_at" timestamp with time zone NOT NULL DEFAULT clock_timestamp(),"diferencia_centavos" bigint NOT NULL,"efectivo_contado_centavos" bigint NOT NULL,"fondo_id" uuid NOT NULL,"id" uuid NOT NULL DEFAULT public.gen_random_uuid(),"idempotency_key" uuid NOT NULL,"idempotency_producer" text NOT NULL,"motivo" text NOT NULL,"payload_hash" text NOT NULL,"saldo_sistema_centavos" bigint NOT NULL,"version_saldo" uuid);
CREATE TABLE public."fondo_mariana" ("created_at" timestamp with time zone NOT NULL DEFAULT now(),"id" uuid NOT NULL DEFAULT public.gen_random_uuid(),"nombre" text NOT NULL DEFAULT 'Fondo de Mariana'::text,"ubicacion_id" integer NOT NULL);
CREATE TABLE public."fondo_movimientos" ("autor_id" integer NOT NULL,"categoria" text NOT NULL,"conciliacion_inicial" jsonb,"created_at" timestamp with time zone NOT NULL DEFAULT clock_timestamp(),"fondo_id" uuid NOT NULL,"id" uuid NOT NULL DEFAULT public.gen_random_uuid(),"idempotency_key" uuid NOT NULL,"idempotency_producer" text NOT NULL,"importe_centavos" bigint NOT NULL,"motivo" text NOT NULL,"naturaleza" text NOT NULL,"ordinal" bigint NOT NULL,"original_id" uuid,"payload_hash" text NOT NULL);
CREATE TABLE public."movimientos" ("cantidad" numeric(10,3) NOT NULL,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"documento_id" text,"documento_tipo" text,"id" bigint NOT NULL DEFAULT nextval('movimientos_id_seq'::regclass),"justificacion" text,"motivo_salida_extraordinaria" motivo_salida_extraordinaria,"movimiento_origen_id" integer,"producto_id" integer NOT NULL,"revisado" boolean NOT NULL DEFAULT true,"revisado_at" timestamp with time zone,"revisado_por" integer,"rollo_id" integer NOT NULL,"saldo_posterior" numeric(10,3) NOT NULL,"salida_id" integer,"tipo" tipo_movimiento NOT NULL,"ubicacion_id" integer NOT NULL,"usuario_id" integer NOT NULL,"uuid_cliente" uuid);
CREATE TABLE public."movimientos_credito" ("autorizado_por" integer,"cliente_id" integer NOT NULL,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"cuenta_destino" text,"dias_plazo" integer,"es_incobrable" boolean NOT NULL DEFAULT false,"fecha_vencimiento" date,"forma_pago" forma_pago_cuenta,"id" integer NOT NULL DEFAULT nextval('movimientos_credito_id_seq'::regclass),"importe" numeric(12,2) NOT NULL,"metadata" text,"motivo_incobrable" text,"movimiento_origen_id" integer,"naturaleza" naturaleza_credito_e1,"nota_origen_id" integer,"notas" text,"operacion_clave" uuid,"operacion_productor" text,"origen_justificacion" text,"referencia" text,"sesion_caja_id" integer,"sitio_origen_id" integer,"ticket_id" integer,"tipo" tipo_movimiento_credito NOT NULL,"usuario_id" integer NOT NULL);
CREATE TABLE public."notificaciones_credito" ("cajero_id" integer NOT NULL,"cajero_nombre" text NOT NULL,"cliente_id" integer NOT NULL,"cliente_nombre" text NOT NULL,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"dias_plazo" integer NOT NULL,"fecha_vencimiento" date NOT NULL,"folio" integer NOT NULL,"id" integer NOT NULL DEFAULT nextval('notificaciones_credito_id_seq'::regclass),"importe" numeric(12,2) NOT NULL,"leida_at" timestamp with time zone,"ticket_id" integer NOT NULL,"tienda_id" integer NOT NULL,"tienda_nombre" text NOT NULL,"urgente" boolean NOT NULL DEFAULT false);
CREATE TABLE public."notificaciones_sistema" ("created_at" timestamp with time zone NOT NULL DEFAULT now(),"destinatario_usuario_id" integer,"entidad" text NOT NULL,"entidad_id" text NOT NULL,"id" integer NOT NULL DEFAULT nextval('notificaciones_sistema_id_seq'::regclass),"leida_at" timestamp with time zone,"mensaje" text NOT NULL,"prioridad" text NOT NULL DEFAULT 'NORMAL'::text,"tipo" text NOT NULL,"titulo" text NOT NULL);
CREATE TABLE public."operaciones_credito_e1" ("clave" uuid NOT NULL,"created_at" timestamp with time zone NOT NULL DEFAULT transaction_timestamp(),"naturaleza" naturaleza_credito_e1 NOT NULL,"productor" text NOT NULL,"solicitud_canonica" jsonb NOT NULL,"usuario_id" integer NOT NULL);
CREATE TABLE public."pagos_proveedor" ("created_at" timestamp with time zone NOT NULL DEFAULT now(),"entrada_id" integer,"fecha" timestamp with time zone NOT NULL,"forma_pago" forma_pago_proveedor,"id" integer NOT NULL DEFAULT nextval('pagos_proveedor_id_seq'::regclass),"importe" numeric(12,2) NOT NULL,"movimiento_origen_id" integer,"notas" text,"proveedor_id" integer NOT NULL,"referencia" text,"tipo" tipo_pago_proveedor NOT NULL,"usuario_id" integer NOT NULL);
CREATE TABLE public."permisos_rol" ("id" integer NOT NULL DEFAULT nextval('permisos_rol_id_seq'::regclass),"modulo" text NOT NULL,"puede_autorizar" boolean NOT NULL DEFAULT false,"puede_crear" boolean NOT NULL DEFAULT false,"puede_editar" boolean NOT NULL DEFAULT false,"puede_ver" boolean NOT NULL DEFAULT false,"rol" rol_usuario NOT NULL,"updated_at" timestamp with time zone NOT NULL DEFAULT now(),"updated_por" integer);
CREATE TABLE public."permisos_ubicacion" ("id" integer NOT NULL DEFAULT nextval('permisos_ubicacion_id_seq'::regclass),"modulo" text NOT NULL,"puede_autorizar" boolean NOT NULL DEFAULT false,"puede_crear" boolean NOT NULL DEFAULT false,"puede_editar" boolean NOT NULL DEFAULT false,"puede_ver" boolean NOT NULL DEFAULT false,"rol" rol_usuario NOT NULL,"ubicacion_id" integer NOT NULL,"updated_at" timestamp with time zone NOT NULL DEFAULT now(),"updated_por" integer);
CREATE TABLE public."permisos_usuario" ("id" integer NOT NULL DEFAULT nextval('permisos_usuario_id_seq'::regclass),"modulo" text NOT NULL,"puede_autorizar" boolean,"puede_crear" boolean,"puede_editar" boolean,"puede_ver" boolean,"updated_at" timestamp with time zone NOT NULL DEFAULT now(),"updated_por" integer,"usuario_id" integer NOT NULL);
CREATE TABLE public."pisos" ("activo" boolean NOT NULL DEFAULT true,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"id" integer NOT NULL DEFAULT nextval('pisos_id_seq'::regclass),"nombre" text NOT NULL,"ubicacion_id" integer NOT NULL,"updated_at" timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE public."precio_historial" ("advertencia_bajo_costo" boolean NOT NULL DEFAULT false,"costo_unitario_ponderado" numeric(12,2),"created_at" timestamp with time zone NOT NULL DEFAULT now(),"id" integer NOT NULL DEFAULT nextval('precio_historial_id_seq'::regclass),"margen_pesos_unidad" numeric(12,2),"margen_porcentaje_subtotal" numeric(7,4),"modo_precio" precio_modo NOT NULL DEFAULT 'ROLLO'::precio_modo,"motivo" text NOT NULL,"precio_lista_anterior" numeric(12,2),"precio_lista_nuevo" numeric(12,2) NOT NULL,"producto_id" integer NOT NULL,"usuario_id" integer NOT NULL);
CREATE TABLE public."productos" ("activo" boolean NOT NULL DEFAULT true,"ancho_cm" numeric(10,2),"color" text NOT NULL,"color_hex" text,"composicion" text,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"gramaje_gm2" numeric(10,2),"id" integer NOT NULL DEFAULT nextval('productos_id_seq'::regclass),"notas" text,"precio_mayoreo" numeric(12,2),"precio_menudeo" numeric(12,2),"precio_sugerido" numeric(12,2),"se_vende_por_metro" boolean NOT NULL DEFAULT false,"sku" text NOT NULL,"tela" text NOT NULL,"unidad" unidad_producto NOT NULL,"updated_at" timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE public."proveedores" ("activo" boolean NOT NULL DEFAULT true,"contacto_nombre" text,"correo" text,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"id" integer NOT NULL DEFAULT nextval('proveedores_id_seq'::regclass),"moneda_default" moneda NOT NULL DEFAULT 'MXN'::moneda,"nombre" text NOT NULL,"notas" text,"pais" text,"telefono" text,"tipo" tipo_proveedor NOT NULL);
CREATE TABLE public."reimpresiones_etiqueta" ("autorizado_por" integer,"autorizador_nombre_snapshot" text,"autorizador_usuario_snapshot" text,"color_snapshot" text NOT NULL,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"id" integer NOT NULL DEFAULT nextval('reimpresiones_etiqueta_id_seq'::regclass),"motivo" text NOT NULL,"producto_snapshot" text NOT NULL,"rollo_id" integer NOT NULL,"serie_snapshot" text NOT NULL,"sitio_id" integer NOT NULL,"sitio_nombre_snapshot" text NOT NULL,"sku_snapshot" text NOT NULL,"solicitante_nombre_snapshot" text NOT NULL,"solicitante_usuario_snapshot" text NOT NULL,"tela_snapshot" text NOT NULL,"usuario_id" integer NOT NULL);
CREATE TABLE public."revisiones_etiqueta" ("created_at" timestamp with time zone NOT NULL DEFAULT now(),"id" integer NOT NULL DEFAULT nextval('revisiones_etiqueta_id_seq'::regclass),"reimpresion_id" integer NOT NULL,"revisor_nombre_snapshot" text NOT NULL,"revisor_usuario_snapshot" text NOT NULL,"rollo_id" integer NOT NULL,"usuario_id" integer NOT NULL);
CREATE TABLE public."rollos" ("cantidad_actual" numeric(10,3) NOT NULL,"cantidad_inicial" numeric(10,3) NOT NULL,"costo_total" numeric(12,2),"costo_unitario" numeric(12,2),"created_at" timestamp with time zone NOT NULL DEFAULT now(),"estado" estado_rollo NOT NULL DEFAULT 'PROGRAMADO'::estado_rollo,"id" integer NOT NULL DEFAULT nextval('rollos_id_seq'::regclass),"notas" text,"piso_id" integer,"producto_id" integer NOT NULL,"proveedor_id" integer,"recepcion_id" integer,"rollo_origen_id" integer,"serie" text NOT NULL,"ubicacion_id" integer NOT NULL,"updated_at" timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE public."salida_folio" ("ubicacion_id" integer NOT NULL,"ultimo_folio" integer NOT NULL DEFAULT 0);
CREATE TABLE public."salida_lineas" ("cantidad_enviada" numeric(10,3) NOT NULL DEFAULT 0,"cantidad_recibida" numeric(10,3) NOT NULL DEFAULT 0,"cantidad_solicitada" numeric(10,3) NOT NULL,"id" integer NOT NULL DEFAULT nextval('salida_lineas_id_seq'::regclass),"nota" text,"producto_id" integer NOT NULL,"rollos_solicitados" integer,"salida_id" integer NOT NULL);
CREATE TABLE public."salida_rollos" ("cantidad_enviada" numeric(10,3) NOT NULL,"cantidad_recibida" numeric(10,3),"id" integer NOT NULL DEFAULT nextval('salida_rollos_id_seq'::regclass),"linea_id" integer NOT NULL,"nota_diferencia" text,"recibido" boolean NOT NULL DEFAULT false,"rollo_id" integer NOT NULL,"salida_id" integer NOT NULL);
CREATE TABLE public."salidas" ("aceptada_at" timestamp with time zone,"actividad_at" timestamp with time zone NOT NULL DEFAULT now(),"autorizado_por_id" integer,"cancelada_at" timestamp with time zone,"cerrada_at" timestamp with time zone,"cliente_id" integer,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"destino_id" integer,"entregada_at" timestamp with time zone,"enviada_at" timestamp with time zone,"estado" estado_salida NOT NULL DEFAULT 'ARMANDO'::estado_salida,"folio" integer NOT NULL,"id" integer NOT NULL DEFAULT nextval('salidas_id_seq'::regclass),"modalidad" text NOT NULL DEFAULT 'TRASLADO'::text,"motivo_cancelacion" text,"motivo_rechazo" text,"nota_envio" text,"nota_recepcion" text,"nota_solicitud" text,"origen_id" integer NOT NULL,"preparada_at" timestamp with time zone,"recibida_at" timestamp with time zone,"solicitada_at" timestamp with time zone,"ticket_id" integer,"transportista" text,"usuario_acepta_id" integer,"usuario_cancela_id" integer,"usuario_cierra_id" integer,"usuario_entrega_id" integer,"usuario_envia_id" integer,"usuario_prepara_id" integer,"usuario_recibe_id" integer,"usuario_solicita_id" integer,"uuid_cliente" uuid NOT NULL);
CREATE TABLE public."salidas_dinero_caja" ("creado_por_id" integer NOT NULL,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"cuenta_origen" text NOT NULL,"id" integer NOT NULL DEFAULT nextval('salidas_dinero_caja_id_seq'::regclass),"monto" numeric(12,2) NOT NULL,"motivo" text NOT NULL,"proveedor_id" integer,"sesion_caja_id" integer NOT NULL);
CREATE TABLE public."series_consecutivo" ("id" integer NOT NULL DEFAULT 1,"ultimo_numero" integer NOT NULL DEFAULT 10000000);
CREATE TABLE public."sesiones" ("created_at" timestamp with time zone NOT NULL DEFAULT now(),"expira_at" timestamp with time zone NOT NULL,"id" uuid NOT NULL,"ip" text NOT NULL,"user_agent" text NOT NULL,"usuario_id" integer NOT NULL);
CREATE TABLE public."sesiones_caja" ("abierta_at" timestamp with time zone NOT NULL DEFAULT now(),"cerrada_at" timestamp with time zone,"cerrada_por_id" integer,"efectivo_contado" numeric(12,2),"estado" estado_sesion_caja NOT NULL DEFAULT 'ABIERTA'::estado_sesion_caja,"fecha_operativa" date NOT NULL,"fondo_inicial" numeric(12,2) NOT NULL,"id" integer NOT NULL DEFAULT nextval('sesiones_caja_id_seq'::regclass),"ubicacion_id" integer NOT NULL,"usuario_id" integer NOT NULL);
CREATE TABLE public."sesiones_caja_dias" ("fecha_operativa" date NOT NULL,"sesion_caja_id" integer,"ubicacion_id" integer NOT NULL);
CREATE TABLE public."solicitudes_pago_dirigido" ("autorizador_id" integer,"autorizador_nombre" text,"contraparte_nombre" text NOT NULL DEFAULT ''::text,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"cuenta_destino" text,"documento_folio" text NOT NULL DEFAULT ''::text,"documento_movimiento_id" integer NOT NULL,"entidad_id" integer NOT NULL,"estado" estado_solicitud_pago_dirigido NOT NULL DEFAULT 'PENDIENTE'::estado_solicitud_pago_dirigido,"fecha_efectiva" timestamp with time zone,"forma_pago" text NOT NULL,"id" integer NOT NULL DEFAULT nextval('solicitudes_pago_dirigido_id_seq'::regclass),"importe" numeric(12,2) NOT NULL,"motivo" text NOT NULL,"motivo_rechazo" text,"movimiento_id" integer,"notas" text,"referencia" text,"resuelta_at" timestamp with time zone,"solicitante_id" integer NOT NULL,"solicitante_nombre" text NOT NULL DEFAULT ''::text,"tipo" tipo_solicitud_pago_dirigido NOT NULL,"ubicacion_id" integer,"ubicacion_nombre" text);
CREATE TABLE public."stock_minimo_episodios" ("abierto_at" timestamp with time zone NOT NULL DEFAULT now(),"causa" text NOT NULL DEFAULT 'SNAPSHOT'::text,"cerrado_at" timestamp with time zone,"diferencia" numeric(18,3) NOT NULL,"existencia" numeric(18,3) NOT NULL,"id" integer NOT NULL DEFAULT nextval('stock_minimo_episodios_id_seq'::regclass),"minimo" numeric(18,3) NOT NULL,"movimiento_id" bigint,"producto_id" integer NOT NULL,"ubicacion_id" integer NOT NULL);
CREATE TABLE public."stock_minimo_sitios" ("habilitado" boolean NOT NULL DEFAULT false,"ubicacion_id" integer NOT NULL,"updated_at" timestamp with time zone NOT NULL DEFAULT now(),"updated_by" integer);
CREATE TABLE public."stock_minimos" ("cantidad" numeric(18,3) NOT NULL,"id" integer NOT NULL DEFAULT nextval('stock_minimos_id_seq'::regclass),"producto_id" integer NOT NULL,"ubicacion_id" integer NOT NULL,"updated_at" timestamp with time zone NOT NULL DEFAULT now(),"updated_by" integer);
CREATE TABLE public."ticket_folio" ("id" integer NOT NULL DEFAULT 1,"ultimo_folio" integer NOT NULL DEFAULT 999);
CREATE TABLE public."ticket_linea_consumos" ("cantidad_milesimas" bigint NOT NULL,"costo_centavos" bigint,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"entrada_id" integer NOT NULL,"id" bigint NOT NULL DEFAULT nextval('ticket_linea_consumos_id_seq'::regclass),"idempotencia" text NOT NULL,"ingreso_centavos" bigint NOT NULL,"movimiento_id" bigint NOT NULL,"proveedor_id" integer NOT NULL,"reversa_de_id" bigint,"rollo_id" integer NOT NULL,"ticket_id" integer NOT NULL,"ticket_linea_id" integer NOT NULL,"tipo" text NOT NULL);
CREATE TABLE public."ticket_lineas" ("cantidad" numeric(10,3) NOT NULL,"costo_referencia_estado" text,"costo_total_congelado" numeric(12,2),"costo_unitario_congelado" numeric(12,2),"id" integer NOT NULL DEFAULT nextval('ticket_lineas_id_seq'::regclass),"importe" numeric(12,2) NOT NULL,"precio_sugerido" numeric(12,2) NOT NULL,"precio_unitario" numeric(12,2) NOT NULL,"producto_id" integer NOT NULL,"rollo_id" integer,"ticket_id" integer NOT NULL,"tipo" tipo_ticket NOT NULL);
CREATE TABLE public."ticket_pagos" ("created_at" timestamp with time zone NOT NULL DEFAULT now(),"forma_pago" forma_pago_ticket NOT NULL,"id" integer NOT NULL DEFAULT nextval('ticket_pagos_id_seq'::regclass),"importe" numeric(12,2) NOT NULL,"referencia" text,"ticket_id" integer NOT NULL,"usuario_id" integer NOT NULL);
CREATE TABLE public."tickets" ("autorizacion_estado" text NOT NULL DEFAULT 'NO_APLICA'::text,"autorizado_at" timestamp with time zone,"autorizado_por" integer,"cancelado_at" timestamp with time zone,"cancelado_por" integer,"cliente_id" integer NOT NULL,"cobrado" boolean NOT NULL DEFAULT false,"cobrado_at" timestamp with time zone,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"credito" boolean NOT NULL DEFAULT false,"dias_plazo" integer,"direccion_entrega_snapshot" text,"documento_tipo" text NOT NULL DEFAULT 'TICKET'::text,"estado" estado_ticket NOT NULL DEFAULT 'VENDIDO'::estado_ticket,"facturado" boolean NOT NULL DEFAULT false,"fecha_vencimiento" date,"folio" integer NOT NULL,"id" integer NOT NULL DEFAULT nextval('tickets_id_seq'::regclass),"iva" numeric(12,2) NOT NULL DEFAULT '0'::numeric,"motivo_cancelacion" text,"nombre_destinatario" text,"nota_sin_precios" boolean NOT NULL DEFAULT false,"sesion_caja_id" integer,"subtotal" numeric(12,2) NOT NULL,"tasa_iva" numeric(5,4) NOT NULL DEFAULT 0.1600,"total" numeric(12,2) NOT NULL,"ubicacion_id" integer NOT NULL,"usuario_caja_id" integer,"usuario_terminal_id" integer NOT NULL,"uuid_cliente" uuid NOT NULL);
CREATE TABLE public."ubicaciones" ("activa" boolean NOT NULL DEFAULT true,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"id" integer NOT NULL DEFAULT nextval('ubicaciones_id_seq'::regclass),"iniciales" text NOT NULL,"nombre" text NOT NULL,"tipo" tipo_ubicacion NOT NULL);
CREATE TABLE public."usuarios" ("activo" boolean NOT NULL DEFAULT true,"alcance_consulta" alcance_consulta NOT NULL DEFAULT 'TODAS'::alcance_consulta,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"id" integer NOT NULL DEFAULT nextval('usuarios_id_seq'::regclass),"nombre" text NOT NULL,"password_hash" text NOT NULL,"rol" rol_usuario NOT NULL,"ubicacion_id" integer,"ultimo_acceso" timestamp with time zone,"usuario" text NOT NULL);
CREATE TABLE public."viaje_folio" ("ubicacion_id" integer NOT NULL,"ultimo_folio" integer NOT NULL DEFAULT 0);
CREATE TABLE public."viaje_salidas" ("salida_id" integer NOT NULL,"viaje_id" integer NOT NULL);
CREATE TABLE public."viaje_tickets" ("ticket_id" integer NOT NULL,"viaje_id" integer NOT NULL);
CREATE TABLE public."viajes" ("camioneta_id" integer NOT NULL,"chofer_id" integer NOT NULL,"creado_por_id" integer NOT NULL,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"folio" integer NOT NULL,"id" integer NOT NULL DEFAULT nextval('viajes_id_seq'::regclass),"observaciones" text,"origen_id" integer NOT NULL,"salida_at" timestamp with time zone NOT NULL,"updated_at" timestamp with time zone NOT NULL DEFAULT now());
CREATE OR REPLACE FUNCTION public.bloquear_mutacion_reimpresion_etiqueta()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
      BEGIN
        IF current_setting('app.etiquetas_cleanup', true) = 'on' THEN
          IF TG_OP = 'DELETE' THEN
            RETURN OLD;
          END IF;
          RETURN NEW;
        END IF;
        RAISE EXCEPTION 'reimpresiones_etiqueta es un registro inmutable';
      END;
      $function$
;
CREATE OR REPLACE FUNCTION public.bloquear_mutacion_revision_etiqueta()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
      BEGIN
        RAISE EXCEPTION 'revisiones_etiqueta es un historial append-only';
      END;
      $function$
;
CREATE OR REPLACE FUNCTION public.credit_fifo_aging(p_cliente_id integer)
 RETURNS TABLE(movimiento_id integer, ticket_id integer, created_at timestamp with time zone, due_at date, original numeric, pendiente numeric)
 LANGUAGE sql
 STABLE
AS $function$
        WITH fifo_negatives AS (
          SELECT COALESCE(SUM(-importe), 0) AS total
          FROM movimientos_credito
          WHERE cliente_id = p_cliente_id AND (
            (tipo = 'ABONO' AND NOT EXISTS (
              SELECT 1 FROM movimientos_credito reversal
              WHERE reversal.tipo='REVERSO'
                AND reversal.movimiento_origen_id=movimientos_credito.id
            )) OR
            (tipo = 'AJUSTE' AND importe < 0)
          )
        ), cargos AS (
          SELECT m.id, m.ticket_id, m.created_at,
            GREATEST(0, m.importe - CASE
              WHEN m.tipo = 'VENTA_CREDITO' THEN COALESCE((
                SELECT SUM(-r.importe) FROM movimientos_credito r
                WHERE r.cliente_id=m.cliente_id AND r.tipo='REVERSO'
                  AND r.ticket_id=m.ticket_id
              ),0)
              ELSE 0
            END) AS neto,
            m.fecha_vencimiento
          FROM movimientos_credito m
          WHERE m.cliente_id=p_cliente_id AND (
            m.tipo='VENTA_CREDITO' OR (m.tipo='AJUSTE' AND m.importe > 0)
          )
        ), ordenadas AS (
          SELECT v.*,
            COALESCE(SUM(v.neto) OVER (
              ORDER BY v.created_at, v.id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ), 0) AS antes
          FROM cargos v
        )
        SELECT v.id, v.ticket_id, v.created_at,
          v.fecha_vencimiento, v.neto,
          GREATEST(0, v.neto - GREATEST(0, n.total - v.antes))
        FROM ordenadas v CROSS JOIN fifo_negatives n
        WHERE GREATEST(0, v.neto - GREATEST(0, n.total - v.antes)) > 0
      $function$
;
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
CREATE OR REPLACE FUNCTION public.enriquecer_auditoria()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
      DECLARE
        usuario_nombre text;
        usuario_rol text;
        usuario_sitio integer;
        sitio_nombre text;
      BEGIN
        IF NEW.usuario_id IS NOT NULL THEN
          SELECT usuario, rol::text, ubicacion_id
            INTO usuario_nombre, usuario_rol, usuario_sitio
            FROM usuarios WHERE id = NEW.usuario_id;
          NEW.usuario_snapshot := COALESCE(NEW.usuario_snapshot, usuario_nombre);
          NEW.rol_snapshot := COALESCE(NEW.rol_snapshot, usuario_rol);
          -- Catalog records have no affected operational site. Keep their
          -- explicit null instead of inheriting the editor's assigned site.
          IF NEW.entidad NOT IN ('camionetas', 'choferes') THEN
            NEW.sitio_id := COALESCE(NEW.sitio_id, usuario_sitio);
          END IF;
        END IF;
        IF NEW.sitio_id IS NOT NULL AND NEW.sitio_snapshot IS NULL THEN
          SELECT nombre INTO sitio_nombre FROM ubicaciones WHERE id = NEW.sitio_id;
          NEW.sitio_snapshot := sitio_nombre;
        END IF;
        NEW.modulo := COALESCE(NEW.modulo,
          CASE
            WHEN NEW.accion LIKE 'LOGIN_%' OR NEW.accion = 'LOGOUT' OR NEW.entidad = 'sesiones' THEN 'auth'
            WHEN NEW.entidad IN ('usuarios', 'permisos_usuario', 'permisos_rol') THEN 'usuarios'
            WHEN NEW.entidad IN ('ubicaciones') THEN 'ubicaciones'
            WHEN NEW.entidad IN ('productos', 'precios_producto') THEN 'productos'
            WHEN NEW.entidad IN ('proveedores', 'compras', 'pagos_proveedor') THEN 'proveedores'
            WHEN NEW.entidad LIKE 'cliente%' OR NEW.entidad = 'movimientos_credito' THEN 'clientes'
            WHEN NEW.entidad IN ('tickets', 'ticket_pagos') THEN 'pos'
            WHEN NEW.entidad = 'sesiones_caja' THEN 'caja'
            WHEN NEW.entidad IN ('salidas', 'salida_rollos') THEN 'salidas'
            WHEN NEW.entidad IN ('reimpresiones_etiqueta') THEN 'etiquetas'
            WHEN NEW.entidad IN ('rollos', 'entradas', 'movimientos', 'existencias') THEN 'inventario'
            WHEN NEW.entidad LIKE 'contenedor%' THEN 'contenedores'
            ELSE NEW.entidad
          END);
        RETURN NEW;
      END;
      $function$
;
CREATE OR REPLACE FUNCTION public.fondo_assert_fixed_mariana()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE valid_location boolean;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'FONDO_IMMUTABLE: fixed identity cannot be changed or deleted';
  END IF;
  SELECT activa IS TRUE AND tipo::text='TIENDA' AND upper(btrim(nombre))='MARIANA'
    INTO valid_location FROM ubicaciones WHERE id=NEW.ubicacion_id;
  IF valid_location IS DISTINCT FROM TRUE OR NEW.nombre <> 'Fondo de Mariana' THEN
    RAISE EXCEPTION 'FONDO_MARIANA_IDENTITY_INVALID';
  END IF;
  RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.fondo_reject_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'FONDO_IMMUTABLE: % is append-only', TG_TABLE_NAME;
END $function$
;
CREATE OR REPLACE FUNCTION public.fondo_validate_audit()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE fixed_fondo uuid; actual_balance bigint; actual_version uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(4600112);
  SELECT id INTO STRICT fixed_fondo FROM fondo_mariana;
  IF NEW.fondo_id <> fixed_fondo THEN RAISE EXCEPTION 'FONDO_MARIANA_IDENTITY_INVALID'; END IF;
  SELECT COALESCE(sum(CASE WHEN naturaleza='INGRESO' THEN importe_centavos ELSE -importe_centavos END),0),
         (array_agg(id ORDER BY ordinal DESC))[1]
    INTO actual_balance,actual_version FROM fondo_movimientos WHERE fondo_id=NEW.fondo_id;
  IF NEW.saldo_sistema_centavos <> actual_balance
     OR NEW.version_saldo IS DISTINCT FROM actual_version THEN
    RAISE EXCEPTION 'FONDO_VERSION_SALDO_OBSOLETA';
  END IF;
  RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.fondo_validate_movement()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  current_balance bigint;
  movement_count bigint;
  original fondo_movimientos%ROWTYPE;
  fixed_fondo uuid;
  declared_count bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(4600112);
  IF NEW.ordinal IS NOT NULL THEN RAISE EXCEPTION 'FONDO_ORDINAL_SERVER_ONLY'; END IF;
  NEW.ordinal := nextval('fondo_movimientos_ordinal_seq');
  SELECT id INTO STRICT fixed_fondo FROM fondo_mariana;
  IF NEW.fondo_id <> fixed_fondo THEN RAISE EXCEPTION 'FONDO_MARIANA_IDENTITY_INVALID'; END IF;
  SELECT count(*),
         COALESCE(sum(CASE WHEN naturaleza='INGRESO' THEN importe_centavos ELSE -importe_centavos END),0)
    INTO movement_count,current_balance FROM fondo_movimientos WHERE fondo_id=NEW.fondo_id;

  IF NEW.original_id IS NULL THEN
    IF movement_count = 0 AND NEW.categoria <> 'SALDO_INICIAL' THEN
      RAISE EXCEPTION 'FONDO_SALDO_INICIAL_INVALIDO';
    END IF;
    IF NEW.categoria='SALDO_INICIAL' THEN
      IF movement_count <> 0 OR NEW.naturaleza <> 'INGRESO' OR NEW.motivo <> 'saldo inicial'
         OR jsonb_typeof(NEW.conciliacion_inicial) IS DISTINCT FROM 'object'
         OR jsonb_typeof(NEW.conciliacion_inicial->'declaracionSinDuplicacion') IS DISTINCT FROM 'boolean'
         OR NEW.conciliacion_inicial->'declaracionSinDuplicacion' IS DISTINCT FROM 'true'::jsonb
         OR jsonb_typeof(NEW.conciliacion_inicial->'efectivoFisicoContado') IS DISTINCT FROM 'string'
         OR coalesce(NEW.conciliacion_inicial->>'efectivoFisicoContado','') !~ '^(0|[1-9][0-9]*)\.[0-9]{2}$'
         OR jsonb_typeof(NEW.conciliacion_inicial->'evidencia') IS DISTINCT FROM 'string'
         OR nullif(btrim(coalesce(NEW.conciliacion_inicial->>'evidencia','')),'') IS NULL
         OR char_length(NEW.conciliacion_inicial->>'evidencia') > 1000 THEN
        RAISE EXCEPTION 'FONDO_SALDO_INICIAL_INVALIDO';
      END IF;
      declared_count :=
        split_part(NEW.conciliacion_inicial->>'efectivoFisicoContado','.',1)::bigint * 100
        + split_part(NEW.conciliacion_inicial->>'efectivoFisicoContado','.',2)::bigint;
      IF declared_count IS DISTINCT FROM NEW.importe_centavos THEN RAISE EXCEPTION 'FONDO_SALDO_INICIAL_INVALIDO'; END IF;
    ELSE
      IF NEW.categoria='RETIRO' AND NEW.naturaleza <> 'RETIRO'
         OR NEW.categoria IN ('CAPITAL','OTRO_INGRESO') AND NEW.naturaleza <> 'INGRESO'
         OR NEW.conciliacion_inicial IS NOT NULL THEN
        RAISE EXCEPTION 'FONDO_MOVIMIENTO_INVALIDO';
      END IF;
    END IF;
  ELSE
    SELECT * INTO STRICT original FROM fondo_movimientos WHERE id=NEW.original_id FOR UPDATE;
    IF original.fondo_id <> NEW.fondo_id OR original.original_id IS NOT NULL
       OR NEW.importe_centavos <> original.importe_centavos
       OR NEW.categoria <> original.categoria
       OR NEW.naturaleza = original.naturaleza
       OR NEW.conciliacion_inicial IS NOT NULL THEN
      RAISE EXCEPTION 'FONDO_INVERSO_INVALIDO';
    END IF;
  END IF;
  IF NEW.original_id IS NULL AND NEW.naturaleza='RETIRO'
     AND current_balance < NEW.importe_centavos THEN
    RAISE EXCEPTION 'FONDO_SALDO_INSUFICIENTE';
  END IF;
  RETURN NEW;
END $function$
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
CREATE OR REPLACE FUNCTION public.prevent_financial_record_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
      BEGIN
        RAISE EXCEPTION 'Los pagos y movimientos financieros son inmutables; registre un reverso o ajuste.';
      END $function$
;
CREATE OR REPLACE FUNCTION public.prevent_pago_proveedor_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
    BEGIN
      RAISE EXCEPTION 'Los pagos a proveedor son inmutables; registre un reverso o ajuste.';
    END $function$
;
CREATE OR REPLACE FUNCTION public.proteger_aplicaciones_pago_proveedor()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
      BEGIN
        RAISE EXCEPTION 'aplicaciones_pago_proveedor es append-only';
      END;
      $function$
;
CREATE OR REPLACE FUNCTION public.proteger_auditoria_append_only()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
       BEGIN
         RAISE EXCEPTION 'auditoria es append-only';
       END;
       $function$
;
CREATE OR REPLACE FUNCTION public.proteger_auditoria_resolucion_append_only()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
        BEGIN
          RAISE EXCEPTION 'La evidencia y las decisiones de auditoría son append-only; registre un hecho nuevo.';
        END;
      $function$
;
CREATE OR REPLACE FUNCTION public.ticket_linea_consumos_guard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  original ticket_linea_consumos%ROWTYPE;
  movement movimientos%ROWTYPE;
  reversal_quantity BIGINT;
  reversal_revenue BIGINT;
  reversal_cost BIGINT;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION 'ticket_linea_consumos is append-only';
  END IF;

  IF NEW.movimiento_id IS NULL THEN
    RAISE EXCEPTION 'ticket_linea_consumos requires a movement';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM ticket_lineas
     WHERE id = NEW.ticket_linea_id
       AND ticket_id = NEW.ticket_id
  ) THEN
    RAISE EXCEPTION 'allocation line does not belong to its ticket';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM rollos r
      JOIN entradas e ON e.id = r.recepcion_id
     WHERE r.id = NEW.rollo_id
       AND r.recepcion_id = NEW.entrada_id
       AND e.proveedor_id = NEW.proveedor_id
  ) THEN
    RAISE EXCEPTION 'allocation source does not match roll entry supplier';
  END IF;

  SELECT *
    INTO movement
    FROM movimientos
   WHERE id = NEW.movimiento_id;
  IF NOT FOUND OR movement.rollo_id <> NEW.rollo_id
     OR movement.tipo NOT IN ('VENTA', 'CANCELACION')
     OR movement.documento_id IS DISTINCT FROM NEW.ticket_id::text THEN
    RAISE EXCEPTION 'allocation movement does not match its ticket and roll';
  END IF;

  IF NEW.tipo = 'CONSUMO' THEN
    IF NEW.reversa_de_id IS NOT NULL
       OR movement.tipo <> 'VENTA' THEN
      RAISE EXCEPTION 'CONSUMO must reference a VENTA movement and no reversal';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.tipo <> 'REVERSA' OR NEW.reversa_de_id IS NULL
     OR movement.tipo <> 'CANCELACION' THEN
    RAISE EXCEPTION 'REVERSA must reference a cancellation movement and source';
  END IF;

  SELECT *
    INTO original
    FROM ticket_linea_consumos
   WHERE id = NEW.reversa_de_id
     AND tipo = 'CONSUMO'
   FOR UPDATE;
  IF NOT FOUND
     OR original.ticket_id <> NEW.ticket_id
     OR original.ticket_linea_id <> NEW.ticket_linea_id
     OR original.rollo_id <> NEW.rollo_id
     OR original.entrada_id <> NEW.entrada_id
     OR original.proveedor_id <> NEW.proveedor_id
     OR original.movimiento_id IS DISTINCT FROM movement.movimiento_origen_id
     OR (original.costo_centavos IS NULL) <> (NEW.costo_centavos IS NULL) THEN
    RAISE EXCEPTION 'REVERSA source identity does not match its CONSUMO';
  END IF;

  SELECT COALESCE(SUM(cantidad_milesimas), 0),
         COALESCE(SUM(ingreso_centavos), 0),
         COALESCE(SUM(costo_centavos), 0)
    INTO reversal_quantity, reversal_revenue, reversal_cost
    FROM ticket_linea_consumos
   WHERE reversa_de_id = original.id
     AND tipo = 'REVERSA';
  IF NEW.cantidad_milesimas > original.cantidad_milesimas - reversal_quantity
     OR NEW.ingreso_centavos > original.ingreso_centavos - reversal_revenue
     OR NEW.costo_centavos IS NOT NULL
        AND NEW.costo_centavos > original.costo_centavos - reversal_cost THEN
    RAISE EXCEPTION 'REVERSA exceeds the remaining CONSUMO allocation';
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.validar_aplicacion_pago_proveedor()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
      DECLARE pago pagos_proveedor%ROWTYPE; compra pagos_proveedor%ROWTYPE;
      BEGIN
        SELECT * INTO pago FROM pagos_proveedor
          WHERE id = NEW.pago_proveedor_id FOR UPDATE;
        SELECT * INTO compra FROM pagos_proveedor
          WHERE id = NEW.compra_proveedor_id FOR UPDATE;
        IF pago.id IS NULL OR compra.id IS NULL OR pago.tipo <> 'PAGO'
          OR compra.tipo <> 'COMPRA' OR pago.proveedor_id <> compra.proveedor_id THEN
          RAISE EXCEPTION 'Aplicación proveedor inválida: pago PAGO y compra COMPRA del mismo proveedor requeridos';
        END IF;
        IF EXISTS (
          SELECT 1 FROM pagos_proveedor r
          WHERE r.tipo = 'REVERSO' AND r.movimiento_origen_id = pago.id
        ) THEN
          RAISE EXCEPTION 'No se puede aplicar un pago proveedor revertido';
        END IF;
        IF NEW.importe <= 0
          OR NEW.importe > -pago.importe - COALESCE((
            SELECT SUM(a.importe)
            FROM aplicaciones_pago_proveedor a
            WHERE a.pago_proveedor_id = pago.id
              AND NOT EXISTS (
                SELECT 1 FROM pagos_proveedor r
                WHERE r.tipo = 'REVERSO'
                  AND r.movimiento_origen_id = a.pago_proveedor_id
              )
          ), 0)
          OR NEW.importe > compra.importe - COALESCE((
            SELECT SUM(a.importe)
            FROM aplicaciones_pago_proveedor a
            WHERE a.compra_proveedor_id = compra.id
              AND NOT EXISTS (
                SELECT 1 FROM pagos_proveedor r
                WHERE r.tipo = 'REVERSO'
                  AND r.movimiento_origen_id = a.pago_proveedor_id
              )
          ), 0) THEN
          RAISE EXCEPTION 'Aplicación proveedor excede el saldo disponible';
        END IF;
        RETURN NEW;
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
CREATE OR REPLACE FUNCTION public.validar_revision_etiqueta_reimpresion()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM reimpresiones_etiqueta re
          WHERE re.id = NEW.reimpresion_id
            AND re.rollo_id = NEW.rollo_id
        ) THEN
          RAISE EXCEPTION 'La revisión no corresponde a la última reimpresión del rollo';
        END IF;
        RETURN NEW;
      END;
      $function$
;
CREATE OR REPLACE FUNCTION public.validate_credit_application()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
       DECLARE abono movimientos_credito%ROWTYPE;
       DECLARE venta movimientos_credito%ROWTYPE;
       DECLARE cliente_bloqueo integer;
       BEGIN
         SELECT cliente_id INTO cliente_bloqueo
           FROM movimientos_credito WHERE id = NEW.abono_movimiento_id;
         IF cliente_bloqueo IS NOT NULL THEN
           PERFORM 1 FROM clientes
             WHERE id = cliente_bloqueo FOR UPDATE;
         END IF;
         SELECT * INTO abono FROM movimientos_credito
           WHERE id = NEW.abono_movimiento_id FOR UPDATE;
         SELECT * INTO venta FROM movimientos_credito
           WHERE id = NEW.venta_movimiento_id FOR UPDATE;
         IF abono.id IS NULL OR venta.id IS NULL
           OR abono.tipo <> 'ABONO' OR venta.tipo <> 'VENTA_CREDITO'
           OR abono.cliente_id IS DISTINCT FROM venta.cliente_id THEN
           RAISE EXCEPTION 'Una aplicación debe enlazar un ABONO y una VENTA_CREDITO del mismo cliente.';
         END IF;
         IF EXISTS (
           SELECT 1 FROM movimientos_credito r
           WHERE r.tipo = 'REVERSO' AND r.movimiento_origen_id = abono.id
         ) THEN
           RAISE EXCEPTION 'No se puede aplicar un ABONO revertido.';
         END IF;
         IF NEW.importe <= 0
           OR NEW.importe > -abono.importe - COALESCE((
             SELECT SUM(a.importe) FROM aplicaciones_credito a
             WHERE a.abono_movimiento_id = abono.id
               AND NOT EXISTS (
                 SELECT 1 FROM movimientos_credito r
                 WHERE r.tipo = 'REVERSO'
                   AND r.movimiento_origen_id = a.abono_movimiento_id
               )
           ), 0) THEN
           RAISE EXCEPTION 'La aplicación de crédito excede el saldo disponible.';
         END IF;
         RETURN NEW;
       END $function$
;
CREATE OR REPLACE FUNCTION public.validate_credit_reversal()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
       DECLARE origen movimientos_credito%ROWTYPE;
       BEGIN
         IF NEW.tipo <> 'REVERSO' THEN RETURN NEW; END IF;
         IF NEW.movimiento_origen_id IS NULL THEN
           RAISE EXCEPTION 'El reverso debe referenciar su movimiento de origen.';
         END IF;
          SELECT * INTO origen FROM movimientos_credito WHERE id=NEW.movimiento_origen_id;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'El reverso de crédito debe tener un origen compatible, del mismo cliente y por el importe exacto.';
          END IF;
          IF origen.tipo = 'ABONO'
            AND origen.cliente_id = NEW.cliente_id
            AND origen.importe < 0
            AND NEW.importe = -origen.importe THEN
            RETURN NEW;
          END IF;
          IF origen.tipo = 'VENTA_CREDITO'
            AND origen.cliente_id = NEW.cliente_id
            AND origen.importe > 0
            AND NEW.importe = -origen.importe
            AND NEW.ticket_id IS NOT DISTINCT FROM origen.ticket_id THEN
            RETURN NEW;
          END IF;
          RAISE EXCEPTION 'El reverso de crédito debe tener un origen compatible, del mismo cliente y por el importe exacto.';
       END $function$
;
ALTER TABLE public."aplicaciones_credito" ADD CONSTRAINT "aplicaciones_credito_abono_venta_uidx" UNIQUE (abono_movimiento_id, venta_movimiento_id);
ALTER TABLE public."aplicaciones_credito" ADD CONSTRAINT "aplicaciones_credito_importe_check" CHECK (importe > 0::numeric);
ALTER TABLE public."aplicaciones_credito" ADD CONSTRAINT "aplicaciones_credito_pkey" PRIMARY KEY (id);
ALTER TABLE public."aplicaciones_pago_proveedor" ADD CONSTRAINT "aplicaciones_pago_proveedor_importe_check" CHECK (importe > 0::numeric);
ALTER TABLE public."aplicaciones_pago_proveedor" ADD CONSTRAINT "aplicaciones_pago_proveedor_pago_compra_uidx" UNIQUE (pago_proveedor_id, compra_proveedor_id);
ALTER TABLE public."aplicaciones_pago_proveedor" ADD CONSTRAINT "aplicaciones_pago_proveedor_pkey" PRIMARY KEY (id);
ALTER TABLE public."atribuciones_credito_e1" ADD CONSTRAINT "atribuciones_anterior_ck_e1" CHECK (anterior_id IS NULL OR anterior_id <> id);
ALTER TABLE public."atribuciones_credito_e1" ADD CONSTRAINT "atribuciones_cadena_uq_e1" UNIQUE NULLS NOT DISTINCT (movimiento_id, anterior_id);
ALTER TABLE public."atribuciones_credito_e1" ADD CONSTRAINT "atribuciones_evidencia_ck_e1" CHECK (btrim(evidencia) <> ''::text AND btrim(motivo) <> ''::text);
ALTER TABLE public."atribuciones_credito_e1" ADD CONSTRAINT "atribuciones_fecha_ck_e1" CHECK (isfinite(movimiento_created_at) AND isfinite(created_at));
ALTER TABLE public."atribuciones_credito_e1" ADD CONSTRAINT "atribuciones_json_ck_e1" CHECK (jsonb_typeof(identidad_snapshot) = 'object'::text);
ALTER TABLE public."atribuciones_credito_e1" ADD CONSTRAINT "atribuciones_pk_e1" PRIMARY KEY (id);
ALTER TABLE public."auditoria_faltante_reactivaciones" ADD CONSTRAINT "auditoria_faltante_reactivacione_movimiento_reactivacion_id_key" UNIQUE (movimiento_reactivacion_id);
ALTER TABLE public."auditoria_faltante_reactivaciones" ADD CONSTRAINT "auditoria_faltante_reactivaciones_cantidad_restaurada_check" CHECK (cantidad_restaurada > 0::numeric);
ALTER TABLE public."auditoria_faltante_reactivaciones" ADD CONSTRAINT "auditoria_faltante_reactivaciones_motivo_check" CHECK (length(TRIM(BOTH FROM motivo)) >= 10);
ALTER TABLE public."auditoria_faltante_reactivaciones" ADD CONSTRAINT "auditoria_faltante_reactivaciones_movimiento_baja_id_key" UNIQUE (movimiento_baja_id);
ALTER TABLE public."auditoria_faltante_reactivaciones" ADD CONSTRAINT "auditoria_faltante_reactivaciones_origen_check" CHECK (origen = ANY (ARRAY['AUDITORIA'::text, 'ROLLO'::text]));
ALTER TABLE public."auditoria_faltante_reactivaciones" ADD CONSTRAINT "auditoria_faltante_reactivaciones_pkey" PRIMARY KEY (id);
ALTER TABLE public."auditoria_faltante_reactivaciones" ADD CONSTRAINT "auditoria_faltante_reactivaciones_uuid_cliente_key" UNIQUE (uuid_cliente);
ALTER TABLE public."auditoria_inventario_escaneos" ADD CONSTRAINT "auditoria_inventario_escaneos_pkey" PRIMARY KEY (auditoria_id, serie);
ALTER TABLE public."auditoria_inventario_folio" ADD CONSTRAINT "auditoria_inventario_folio_pkey" PRIMARY KEY (ubicacion_id);
ALTER TABLE public."auditoria_inventario_participantes" ADD CONSTRAINT "auditoria_inventario_participantes_pkey" PRIMARY KEY (auditoria_id, usuario_id);
ALTER TABLE public."auditoria_inventario_snapshot" ADD CONSTRAINT "auditoria_inventario_snapshot_pkey" PRIMARY KEY (auditoria_id, serie);
ALTER TABLE public."auditoria" ADD CONSTRAINT "auditoria_pkey" PRIMARY KEY (id);
ALTER TABLE public."auditoria_sobrante_contextos" ADD CONSTRAINT "auditoria_sobrante_contextos_pkey" PRIMARY KEY (auditoria_id, serie);
ALTER TABLE public."auditoria_sobrante_decisiones" ADD CONSTRAINT "auditoria_sobrante_decisiones_decision_check" CHECK (decision = ANY (ARRAY['DEJAR'::text, 'REGRESAR'::text, 'INVESTIGAR'::text]));
ALTER TABLE public."auditoria_sobrante_decisiones" ADD CONSTRAINT "auditoria_sobrante_decisiones_motivo_check" CHECK (length(TRIM(BOTH FROM motivo)) >= 10);
ALTER TABLE public."auditoria_sobrante_decisiones" ADD CONSTRAINT "auditoria_sobrante_decisiones_pkey" PRIMARY KEY (id);
ALTER TABLE public."auditoria_sobrante_decisiones" ADD CONSTRAINT "auditoria_sobrante_decisiones_uuid_cliente_key" UNIQUE (uuid_cliente);
ALTER TABLE public."auditorias_inventario" ADD CONSTRAINT "auditorias_inventario_estado_check" CHECK (estado = ANY (ARRAY['ABIERTA'::text, 'CERRADA'::text, 'CANCELADA'::text, 'CONFIRMADA'::text]));
ALTER TABLE public."auditorias_inventario" ADD CONSTRAINT "auditorias_inventario_pkey" PRIMARY KEY (id);
ALTER TABLE public."auditorias_inventario" ADD CONSTRAINT "auditorias_inventario_ubicacion_id_folio_key" UNIQUE (ubicacion_id, folio);
ALTER TABLE public."autorizaciones_nota" ADD CONSTRAINT "autorizaciones_nota_pkey" PRIMARY KEY (id);
ALTER TABLE public."autorizaciones_nota" ADD CONSTRAINT "autorizaciones_nota_ticket_id_key" UNIQUE (ticket_id);
ALTER TABLE public."camionetas" ADD CONSTRAINT "camionetas_pkey" PRIMARY KEY (id);
ALTER TABLE public."camionetas" ADD CONSTRAINT "camionetas_tipo_check" CHECK (tipo = ANY (ARRAY['PROPIA'::text, 'CONTRATADA'::text]));
ALTER TABLE public."choferes" ADD CONSTRAINT "choferes_pkey" PRIMARY KEY (id);
ALTER TABLE public."cliente_documentos" ADD CONSTRAINT "cliente_documentos_lado_check" CHECK (lado = ANY (ARRAY['FRENTE'::text, 'REVERSO'::text]));
ALTER TABLE public."cliente_documentos" ADD CONSTRAINT "cliente_documentos_pkey" PRIMARY KEY (id);
ALTER TABLE public."cliente_documentos" ADD CONSTRAINT "cliente_documentos_public_id_unique" UNIQUE (public_id);
ALTER TABLE public."cliente_documentos" ADD CONSTRAINT "cliente_documentos_ruta_archivo_unique" UNIQUE (ruta_archivo);
ALTER TABLE public."cliente_documentos" ADD CONSTRAINT "cliente_documentos_tamano_check" CHECK (tamano_bytes > 0 AND tamano_bytes <= 5242880);
ALTER TABLE public."cliente_documentos" ADD CONSTRAINT "cliente_documentos_tipo_check" CHECK (tipo = 'INE'::text);
ALTER TABLE public."clientes" ADD CONSTRAINT "clientes_pkey" PRIMARY KEY (id);
ALTER TABLE public."cobros_credito_pendientes_e1" ADD CONSTRAINT "cobros_evidencia_ck_e1" CHECK (NULLIF(btrim(motivo), ''::text) IS NOT NULL OR NULLIF(btrim(referencia), ''::text) IS NOT NULL);
ALTER TABLE public."cobros_credito_pendientes_e1" ADD CONSTRAINT "cobros_fecha_ck_e1" CHECK (isfinite(fecha_real) AND isfinite(created_at));
ALTER TABLE public."cobros_credito_pendientes_e1" ADD CONSTRAINT "cobros_importe_ck_e1" CHECK (importe > 0::numeric AND (importe <> ALL (ARRAY['NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric])));
ALTER TABLE public."cobros_credito_pendientes_e1" ADD CONSTRAINT "cobros_medio_cuenta_ck_e1" CHECK (medio = 'EFECTIVO'::forma_pago_cuenta AND cuenta_destino = 'CAJA_FISICA'::text AND sesion_caja_id IS NOT NULL OR (medio = ANY (ARRAY['TRANSFERENCIA'::forma_pago_cuenta, 'FACTURADO'::forma_pago_cuenta])) AND (cuenta_destino = ANY (ARRAY['CUENTA_FISCAL'::text, 'CUENTA_NO_FISCAL'::text])) AND sesion_caja_id IS NULL);
ALTER TABLE public."cobros_credito_pendientes_e1" ADD CONSTRAINT "cobros_pk_e1" PRIMARY KEY (operacion_productor, operacion_clave);
ALTER TABLE public."cobros_credito_pendientes_e1" ADD CONSTRAINT "cobros_productor_ck_e1" CHECK (operacion_productor = 'COBRO_PENDIENTE'::text AND naturaleza = 'INGRESO_FISICO'::naturaleza_credito_e1);
ALTER TABLE public."contenedor_lineas" ADD CONSTRAINT "contenedor_lineas_cantidad_check" CHECK (cantidad_esperada > 0::numeric);
ALTER TABLE public."contenedor_lineas" ADD CONSTRAINT "contenedor_lineas_contenedor_producto_unique" UNIQUE (contenedor_id, producto_id);
ALTER TABLE public."contenedor_lineas" ADD CONSTRAINT "contenedor_lineas_pkey" PRIMARY KEY (id);
ALTER TABLE public."contenedor_lineas" ADD CONSTRAINT "contenedor_lineas_rollos_check" CHECK (rollos_esperados IS NULL OR rollos_esperados > 0);
ALTER TABLE public."contenedores" ADD CONSTRAINT "contenedores_cancelacion_check" CHECK (estado <> 'CANCELADO'::text OR char_length(motivo_cancelacion) >= 10);
ALTER TABLE public."contenedores" ADD CONSTRAINT "contenedores_entrada_unique" UNIQUE (entrada_id);
ALTER TABLE public."contenedores" ADD CONSTRAINT "contenedores_estado_check" CHECK (estado = ANY (ARRAY['EN_TRANSITO'::text, 'RECIBIDO'::text, 'CANCELADO'::text]));
ALTER TABLE public."contenedores" ADD CONSTRAINT "contenedores_folio_unique" UNIQUE (folio);
ALTER TABLE public."contenedores" ADD CONSTRAINT "contenedores_pkey" PRIMARY KEY (id);
ALTER TABLE public."contenedores" ADD CONSTRAINT "contenedores_recepcion_check" CHECK (estado <> 'RECIBIDO'::text OR entrada_id IS NOT NULL AND fecha_real_llegada IS NOT NULL);
ALTER TABLE public."cuadre_fiscal_registros" ADD CONSTRAINT "cuadre_fiscal_registros_check" CHECK (tipo = 'CONFIRMACION'::text AND estado = 'CONFIRMADA'::text OR tipo = 'DIFERENCIA'::text);
ALTER TABLE public."cuadre_fiscal_registros" ADD CONSTRAINT "cuadre_fiscal_registros_check1" CHECK (tipo = 'DIFERENCIA'::text AND monto > 0::numeric AND char_length(descripcion) >= 20 AND direccion IS NOT NULL OR tipo = 'CONFIRMACION'::text);
ALTER TABLE public."cuadre_fiscal_registros" ADD CONSTRAINT "cuadre_fiscal_registros_direccion_check" CHECK (direccion = ANY (ARRAY['MAS'::text, 'MENOS'::text]));
ALTER TABLE public."cuadre_fiscal_registros" ADD CONSTRAINT "cuadre_fiscal_registros_estado_check" CHECK (estado = ANY (ARRAY['CONFIRMADA'::text, 'PENDIENTE'::text, 'RESUELTA'::text]));
ALTER TABLE public."cuadre_fiscal_registros" ADD CONSTRAINT "cuadre_fiscal_registros_pkey" PRIMARY KEY (id);
ALTER TABLE public."cuadre_fiscal_registros" ADD CONSTRAINT "cuadre_fiscal_registros_tipo_check" CHECK (tipo = ANY (ARRAY['CONFIRMACION'::text, 'DIFERENCIA'::text]));
ALTER TABLE public."entrada_folio" ADD CONSTRAINT "entrada_folio_pkey" PRIMARY KEY (ubicacion_id);
ALTER TABLE public."entradas" ADD CONSTRAINT "entradas_pkey" PRIMARY KEY (id);
ALTER TABLE public."entradas" ADD CONSTRAINT "entradas_uuid_cliente_unique" UNIQUE (uuid_cliente);
ALTER TABLE public."equipos_checklist" ADD CONSTRAINT "equipos_checklist_item_key_check" CHECK (item_key = ANY (ARRAY['PAPEL_NAVEGADOR_80MM'::text, 'MARGENES_NINGUNO'::text, 'ESCALA_REAL'::text, 'IMPRESORA_PREDETERMINADA'::text, 'ENTRADA_REAL'::text, 'PAPEL_NAVEGADOR_CARTA'::text, 'SALIDA_REAL'::text, 'NOTA_REAL'::text, 'PAPEL_NAVEGADOR_A5'::text, 'PAPEL_COLOR_SITIO_BANDEJA'::text, 'ETIQUETA_REAL'::text, 'MEDIDA_100X70'::text, 'TICKET_REAL'::text, 'PAPEL_80MM'::text, 'TECLADO_ESPANOL'::text, 'QR_ROLLO'::text, 'SESION_CAMARA'::text]));
ALTER TABLE public."equipos" ADD CONSTRAINT "equipos_pkey" PRIMARY KEY (id);
ALTER TABLE public."equipos" ADD CONSTRAINT "equipos_tipo_check" CHECK (tipo = ANY (ARRAY['COMPUTADORA_POS'::text, 'IMPRESORA_ENTRADAS'::text, 'IMPRESORA_SALIDAS_NOTAS'::text, 'IMPRESORA_ETIQUETAS'::text, 'IMPRESORA_TICKETS'::text, 'PISTOLA_ESCANER'::text, 'SMARTPHONE_ESCANER'::text]));
ALTER TABLE public."existencias" ADD CONSTRAINT "existencias_producto_id_ubicacion_id_pk" PRIMARY KEY (producto_id, ubicacion_id);
ALTER TABLE public."fondo_arqueos" ADD CONSTRAINT "fondo_arqueos_diferencia_check" CHECK (diferencia_centavos = (efectivo_contado_centavos - saldo_sistema_centavos));
ALTER TABLE public."fondo_arqueos" ADD CONSTRAINT "fondo_arqueos_efectivo_check" CHECK (efectivo_contado_centavos >= 0);
ALTER TABLE public."fondo_arqueos" ADD CONSTRAINT "fondo_arqueos_hash_check" CHECK (payload_hash ~ '^[0-9a-f]{64}$'::text);
ALTER TABLE public."fondo_arqueos" ADD CONSTRAINT "fondo_arqueos_motivo_check" CHECK (char_length(btrim(motivo)) >= 1 AND char_length(btrim(motivo)) <= 500);
ALTER TABLE public."fondo_arqueos" ADD CONSTRAINT "fondo_arqueos_pkey" PRIMARY KEY (id);
ALTER TABLE public."fondo_arqueos" ADD CONSTRAINT "fondo_arqueos_productor_check" CHECK (idempotency_producer = 'FONDO_API_ARQUEO_V1'::text);
ALTER TABLE public."fondo_mariana" ADD CONSTRAINT "fondo_mariana_nombre_check" CHECK (nombre = 'Fondo de Mariana'::text);
ALTER TABLE public."fondo_mariana" ADD CONSTRAINT "fondo_mariana_pkey" PRIMARY KEY (id);
ALTER TABLE public."fondo_movimientos" ADD CONSTRAINT "fondo_movimientos_categoria_check" CHECK (categoria = ANY (ARRAY['SALDO_INICIAL'::text, 'CAPITAL'::text, 'OTRO_INGRESO'::text, 'RETIRO'::text]));
ALTER TABLE public."fondo_movimientos" ADD CONSTRAINT "fondo_movimientos_hash_check" CHECK (payload_hash ~ '^[0-9a-f]{64}$'::text);
ALTER TABLE public."fondo_movimientos" ADD CONSTRAINT "fondo_movimientos_importe_check" CHECK (importe_centavos >= 0 AND (importe_centavos > 0 OR categoria = 'SALDO_INICIAL'::text));
ALTER TABLE public."fondo_movimientos" ADD CONSTRAINT "fondo_movimientos_motivo_check" CHECK (char_length(btrim(motivo)) >= 1 AND char_length(btrim(motivo)) <= 500);
ALTER TABLE public."fondo_movimientos" ADD CONSTRAINT "fondo_movimientos_naturaleza_check" CHECK (naturaleza = ANY (ARRAY['INGRESO'::text, 'RETIRO'::text]));
ALTER TABLE public."fondo_movimientos" ADD CONSTRAINT "fondo_movimientos_pkey" PRIMARY KEY (id);
ALTER TABLE public."fondo_movimientos" ADD CONSTRAINT "fondo_movimientos_productor_check" CHECK (idempotency_producer = ANY (ARRAY['FONDO_API_MOVIMIENTO_V1'::text, 'FONDO_API_INVERSO_V1'::text]));
ALTER TABLE public."movimientos_credito" ADD CONSTRAINT "movimientos_credito_cuenta_destino_check" CHECK (cuenta_destino IS NULL OR (cuenta_destino = ANY (ARRAY['CAJA_FISICA'::text, 'CUENTA_FISCAL'::text, 'CUENTA_NO_FISCAL'::text])));
ALTER TABLE public."movimientos_credito" ADD CONSTRAINT "movimientos_credito_importe_tipo_check" CHECK (tipo = 'VENTA_CREDITO'::tipo_movimiento_credito AND importe > 0::numeric OR tipo = 'ABONO'::tipo_movimiento_credito AND importe < 0::numeric OR tipo = 'REVERSO'::tipo_movimiento_credito AND importe <> 0::numeric OR tipo = 'AJUSTE'::tipo_movimiento_credito AND importe <> 0::numeric);
ALTER TABLE public."movimientos_credito" ADD CONSTRAINT "movimientos_credito_pkey" PRIMARY KEY (id);
ALTER TABLE public."movimientos_credito" ADD CONSTRAINT "movimientos_credito_plazo_check" CHECK (dias_plazo IS NULL AND fecha_vencimiento IS NULL OR (dias_plazo = ANY (ARRAY[7, 15, 30, 60])) AND fecha_vencimiento IS NOT NULL);
ALTER TABLE public."movimientos" ADD CONSTRAINT "movimientos_pkey" PRIMARY KEY (id);
ALTER TABLE public."movimientos" ADD CONSTRAINT "movimientos_uuid_cliente_unique" UNIQUE (uuid_cliente);
ALTER TABLE public."notificaciones_credito" ADD CONSTRAINT "notificaciones_credito_pkey" PRIMARY KEY (id);
ALTER TABLE public."notificaciones_credito" ADD CONSTRAINT "notificaciones_credito_ticket_id_unique" UNIQUE (ticket_id);
ALTER TABLE public."notificaciones_sistema" ADD CONSTRAINT "notificaciones_sistema_pkey" PRIMARY KEY (id);
ALTER TABLE public."operaciones_credito_e1" ADD CONSTRAINT "operaciones_fecha_ck_e1" CHECK (isfinite(created_at));
ALTER TABLE public."operaciones_credito_e1" ADD CONSTRAINT "operaciones_json_ck_e1" CHECK (jsonb_typeof(solicitud_canonica) = 'object'::text AND solicitud_canonica <> '{}'::jsonb);
ALTER TABLE public."operaciones_credito_e1" ADD CONSTRAINT "operaciones_pk_e1" PRIMARY KEY (productor, clave);
ALTER TABLE public."operaciones_credito_e1" ADD CONSTRAINT "operaciones_productor_naturaleza_ck_e1" CHECK ((productor = ANY (ARRAY['VENTA_CREDITO'::text, 'CANCELACION_VENTA_CREDITO'::text])) AND naturaleza = 'OPERACION_CREDITO_SIN_DINERO'::naturaleza_credito_e1 OR (productor = ANY (ARRAY['AJUSTE_MANUAL'::text, 'BAJA_INCOBRABLE'::text])) AND naturaleza = 'CORRECCION_CONTABLE'::naturaleza_credito_e1 OR (productor = ANY (ARRAY['ABONO_ORDINARIO'::text, 'ABONO_DIRIGIDO'::text])) AND (naturaleza = ANY (ARRAY['INGRESO_FISICO'::naturaleza_credito_e1, 'CORRECCION_CONTABLE'::naturaleza_credito_e1])) OR productor = 'REVERSO_ABONO'::text AND (naturaleza = ANY (ARRAY['DEVOLUCION_FISICA'::naturaleza_credito_e1, 'CORRECCION_CONTABLE'::naturaleza_credito_e1])) OR productor = 'COBRO_PENDIENTE'::text AND naturaleza = 'INGRESO_FISICO'::naturaleza_credito_e1);
ALTER TABLE public."pagos_proveedor" ADD CONSTRAINT "pagos_proveedor_pkey" PRIMARY KEY (id);
ALTER TABLE public."permisos_rol" ADD CONSTRAINT "permisos_rol_pkey" PRIMARY KEY (id);
ALTER TABLE public."permisos_rol" ADD CONSTRAINT "permisos_rol_rol_modulo_unique" UNIQUE (rol, modulo);
ALTER TABLE public."permisos_ubicacion" ADD CONSTRAINT "permisos_ubicacion_pkey" PRIMARY KEY (id);
ALTER TABLE public."permisos_ubicacion" ADD CONSTRAINT "permisos_ubicacion_ubicacion_rol_modulo_unique" UNIQUE (ubicacion_id, rol, modulo);
ALTER TABLE public."permisos_usuario" ADD CONSTRAINT "permisos_usuario_pkey" PRIMARY KEY (id);
ALTER TABLE public."permisos_usuario" ADD CONSTRAINT "permisos_usuario_usuario_modulo_unique" UNIQUE (usuario_id, modulo);
ALTER TABLE public."pisos" ADD CONSTRAINT "pisos_nombre_no_vacio" CHECK (length(btrim(nombre)) > 0);
ALTER TABLE public."pisos" ADD CONSTRAINT "pisos_pkey" PRIMARY KEY (id);
ALTER TABLE public."precio_historial" ADD CONSTRAINT "precio_historial_pkey" PRIMARY KEY (id);
ALTER TABLE public."productos" ADD CONSTRAINT "productos_color_hex_check" CHECK (color_hex IS NULL OR color_hex ~ '^#[0-9A-F]{6}$'::text);
ALTER TABLE public."productos" ADD CONSTRAINT "productos_kilo_no_venta_metro_check" CHECK ((unidad <> ALL (ARRAY['KILO'::unidad_producto, 'PIEZA'::unidad_producto])) OR se_vende_por_metro = false);
ALTER TABLE public."productos" ADD CONSTRAINT "productos_pkey" PRIMARY KEY (id);
ALTER TABLE public."productos" ADD CONSTRAINT "productos_sku_unique" UNIQUE (sku);
ALTER TABLE public."productos" ADD CONSTRAINT "productos_tela_color_unique" UNIQUE (tela, color);
ALTER TABLE public."proveedores" ADD CONSTRAINT "proveedores_pkey" PRIMARY KEY (id);
ALTER TABLE public."reimpresiones_etiqueta" ADD CONSTRAINT "reimpresiones_etiqueta_pkey" PRIMARY KEY (id);
ALTER TABLE public."revisiones_etiqueta" ADD CONSTRAINT "revisiones_etiqueta_pkey" PRIMARY KEY (id);
ALTER TABLE public."rollos" ADD CONSTRAINT "rollos_pkey" PRIMARY KEY (id);
ALTER TABLE public."rollos" ADD CONSTRAINT "rollos_serie_unique" UNIQUE (serie);
ALTER TABLE public."salida_folio" ADD CONSTRAINT "salida_folio_pkey" PRIMARY KEY (ubicacion_id);
ALTER TABLE public."salida_lineas" ADD CONSTRAINT "salida_lineas_pkey" PRIMARY KEY (id);
ALTER TABLE public."salida_rollos" ADD CONSTRAINT "salida_rollos_pkey" PRIMARY KEY (id);
ALTER TABLE public."salidas_dinero_caja" ADD CONSTRAINT "salidas_dinero_caja_cuenta_origen_check" CHECK (cuenta_origen = ANY (ARRAY['CAJA_FISICA'::text, 'CUENTA_NO_FISCAL'::text, 'CUENTA_FISCAL'::text]));
ALTER TABLE public."salidas_dinero_caja" ADD CONSTRAINT "salidas_dinero_caja_monto_check" CHECK (monto > 0::numeric);
ALTER TABLE public."salidas_dinero_caja" ADD CONSTRAINT "salidas_dinero_caja_motivo_check" CHECK (char_length(TRIM(BOTH FROM motivo)) >= 1 AND char_length(TRIM(BOTH FROM motivo)) <= 500);
ALTER TABLE public."salidas_dinero_caja" ADD CONSTRAINT "salidas_dinero_caja_pkey" PRIMARY KEY (id);
ALTER TABLE public."salidas" ADD CONSTRAINT "salidas_modalidad_check" CHECK (modalidad = ANY (ARRAY['TRASLADO'::text, 'MOSTRADOR'::text, 'VENTA_CLIENTE'::text]));
ALTER TABLE public."salidas" ADD CONSTRAINT "salidas_pkey" PRIMARY KEY (id);
ALTER TABLE public."salidas" ADD CONSTRAINT "salidas_uuid_cliente_unique" UNIQUE (uuid_cliente);
ALTER TABLE public."salidas" ADD CONSTRAINT "salidas_venta_cliente_shape_check" CHECK (modalidad <> 'VENTA_CLIENTE'::text OR cliente_id IS NOT NULL AND destino_id IS NULL);
ALTER TABLE public."series_consecutivo" ADD CONSTRAINT "series_consecutivo_pkey" PRIMARY KEY (id);
ALTER TABLE public."sesiones_caja_dias" ADD CONSTRAINT "sesiones_caja_dias_pkey" PRIMARY KEY (ubicacion_id, fecha_operativa);
ALTER TABLE public."sesiones_caja" ADD CONSTRAINT "sesiones_caja_pkey" PRIMARY KEY (id);
ALTER TABLE public."sesiones" ADD CONSTRAINT "sesiones_pkey" PRIMARY KEY (id);
ALTER TABLE public."solicitudes_pago_dirigido" ADD CONSTRAINT "solicitudes_pago_dirigido_importe_check" CHECK (importe > 0::numeric);
ALTER TABLE public."solicitudes_pago_dirigido" ADD CONSTRAINT "solicitudes_pago_dirigido_motivo_check" CHECK (char_length(TRIM(BOTH FROM motivo)) >= 10);
ALTER TABLE public."solicitudes_pago_dirigido" ADD CONSTRAINT "solicitudes_pago_dirigido_motivo_rechazo_check" CHECK (motivo_rechazo IS NULL OR char_length(TRIM(BOTH FROM motivo_rechazo)) >= 10);
ALTER TABLE public."solicitudes_pago_dirigido" ADD CONSTRAINT "solicitudes_pago_dirigido_pkey" PRIMARY KEY (id);
ALTER TABLE public."solicitudes_pago_dirigido" ADD CONSTRAINT "solicitudes_pago_dirigido_resolved_check" CHECK (estado = 'PENDIENTE'::estado_solicitud_pago_dirigido AND autorizador_id IS NULL AND resuelta_at IS NULL OR estado = 'APROBADA'::estado_solicitud_pago_dirigido AND autorizador_id IS NOT NULL AND movimiento_id IS NOT NULL AND resuelta_at IS NOT NULL OR estado = 'RECHAZADA'::estado_solicitud_pago_dirigido AND autorizador_id IS NOT NULL AND motivo_rechazo IS NOT NULL AND resuelta_at IS NOT NULL);
ALTER TABLE public."stock_minimo_episodios" ADD CONSTRAINT "stock_minimo_episodios_causa_check" CHECK (causa = ANY (ARRAY['MOVIMIENTO'::text, 'CONFIGURACION'::text, 'SNAPSHOT'::text]));
ALTER TABLE public."stock_minimo_episodios" ADD CONSTRAINT "stock_minimo_episodios_diferencia_check" CHECK (diferencia >= 0::numeric);
ALTER TABLE public."stock_minimo_episodios" ADD CONSTRAINT "stock_minimo_episodios_existencia_check" CHECK (existencia >= 0::numeric);
ALTER TABLE public."stock_minimo_episodios" ADD CONSTRAINT "stock_minimo_episodios_minimo_check" CHECK (minimo >= 0::numeric);
ALTER TABLE public."stock_minimo_episodios" ADD CONSTRAINT "stock_minimo_episodios_pkey" PRIMARY KEY (id);
ALTER TABLE public."stock_minimo_sitios" ADD CONSTRAINT "stock_minimo_sitios_pkey" PRIMARY KEY (ubicacion_id);
ALTER TABLE public."stock_minimos" ADD CONSTRAINT "stock_minimos_cantidad_nonnegative_check" CHECK (cantidad >= 0::numeric);
ALTER TABLE public."stock_minimos" ADD CONSTRAINT "stock_minimos_pkey" PRIMARY KEY (id);
ALTER TABLE public."stock_minimos" ADD CONSTRAINT "stock_minimos_producto_ubicacion_unique" UNIQUE (producto_id, ubicacion_id);
ALTER TABLE public."ticket_folio" ADD CONSTRAINT "ticket_folio_pkey" PRIMARY KEY (id);
ALTER TABLE public."ticket_linea_consumos" ADD CONSTRAINT "ticket_linea_consumos_cantidad_milesimas_check" CHECK (cantidad_milesimas > 0);
ALTER TABLE public."ticket_linea_consumos" ADD CONSTRAINT "ticket_linea_consumos_costo_centavos_check" CHECK (costo_centavos IS NULL OR costo_centavos >= 0);
ALTER TABLE public."ticket_linea_consumos" ADD CONSTRAINT "ticket_linea_consumos_ingreso_centavos_check" CHECK (ingreso_centavos >= 0);
ALTER TABLE public."ticket_linea_consumos" ADD CONSTRAINT "ticket_linea_consumos_pkey" PRIMARY KEY (id);
ALTER TABLE public."ticket_linea_consumos" ADD CONSTRAINT "ticket_linea_consumos_tipo_reversa_check" CHECK (tipo = 'CONSUMO'::text AND reversa_de_id IS NULL OR tipo = 'REVERSA'::text AND reversa_de_id IS NOT NULL);
ALTER TABLE public."ticket_lineas" ADD CONSTRAINT "ticket_lineas_pkey" PRIMARY KEY (id);
ALTER TABLE public."ticket_lineas" ADD CONSTRAINT "ticket_lineas_tipo_rollo_costos_check" CHECK (tipo = 'NORMAL'::tipo_ticket AND rollo_id IS NOT NULL AND costo_unitario_congelado IS NOT NULL AND costo_total_congelado IS NOT NULL AND costo_referencia_estado IS NULL OR tipo = 'METREADO'::tipo_ticket AND rollo_id IS NULL AND (costo_unitario_congelado IS NULL AND costo_total_congelado IS NULL AND (costo_referencia_estado IS NULL OR costo_referencia_estado = 'NO_COST'::text) OR costo_unitario_congelado IS NOT NULL AND costo_total_congelado IS NOT NULL AND (costo_referencia_estado IS NULL OR (costo_referencia_estado = ANY (ARRAY['AVERAGE_12_MONTHS'::text, 'STALE_LAST_KNOWN'::text])))));
ALTER TABLE public."ticket_pagos" ADD CONSTRAINT "ticket_pagos_pkey" PRIMARY KEY (id);
ALTER TABLE public."tickets" ADD CONSTRAINT "tickets_credito_plazo_check" CHECK (credito = false AND dias_plazo IS NULL AND fecha_vencimiento IS NULL OR credito = true AND (dias_plazo = ANY (ARRAY[7, 15, 30, 60])) AND fecha_vencimiento IS NOT NULL);
ALTER TABLE public."tickets" ADD CONSTRAINT "tickets_folio_unique" UNIQUE (folio);
ALTER TABLE public."tickets" ADD CONSTRAINT "tickets_pkey" PRIMARY KEY (id);
ALTER TABLE public."tickets" ADD CONSTRAINT "tickets_uuid_cliente_unique" UNIQUE (uuid_cliente);
ALTER TABLE public."ubicaciones" ADD CONSTRAINT "ubicaciones_iniciales_formato_check" CHECK (iniciales ~ '^[A-Z]{2,3}$'::text);
ALTER TABLE public."ubicaciones" ADD CONSTRAINT "ubicaciones_nombre_unique" UNIQUE (nombre);
ALTER TABLE public."ubicaciones" ADD CONSTRAINT "ubicaciones_pkey" PRIMARY KEY (id);
ALTER TABLE public."usuarios" ADD CONSTRAINT "usuarios_pkey" PRIMARY KEY (id);
ALTER TABLE public."usuarios" ADD CONSTRAINT "usuarios_usuario_unique" UNIQUE (usuario);
ALTER TABLE public."viaje_folio" ADD CONSTRAINT "viaje_folio_pkey" PRIMARY KEY (ubicacion_id);
ALTER TABLE public."viaje_salidas" ADD CONSTRAINT "viaje_salidas_salida_unique" UNIQUE (salida_id);
ALTER TABLE public."viaje_tickets" ADD CONSTRAINT "viaje_tickets_ticket_unique" UNIQUE (ticket_id);
ALTER TABLE public."viajes" ADD CONSTRAINT "viajes_origen_folio_unique" UNIQUE (origen_id, folio);
ALTER TABLE public."viajes" ADD CONSTRAINT "viajes_pkey" PRIMARY KEY (id);
ALTER TABLE public."aplicaciones_credito" ADD CONSTRAINT "aplicaciones_credito_abono_movimiento_id_fkey" FOREIGN KEY (abono_movimiento_id) REFERENCES movimientos_credito(id);
ALTER TABLE public."aplicaciones_credito" ADD CONSTRAINT "aplicaciones_credito_venta_movimiento_id_fkey" FOREIGN KEY (venta_movimiento_id) REFERENCES movimientos_credito(id);
ALTER TABLE public."aplicaciones_pago_proveedor" ADD CONSTRAINT "aplicaciones_pago_proveedor_compra_proveedor_id_fkey" FOREIGN KEY (compra_proveedor_id) REFERENCES pagos_proveedor(id);
ALTER TABLE public."aplicaciones_pago_proveedor" ADD CONSTRAINT "aplicaciones_pago_proveedor_pago_proveedor_id_fkey" FOREIGN KEY (pago_proveedor_id) REFERENCES pagos_proveedor(id);
ALTER TABLE public."atribuciones_credito_e1" ADD CONSTRAINT "atribuciones_actor_fk_e1" FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE public."atribuciones_credito_e1" ADD CONSTRAINT "atribuciones_anterior_fk_e1" FOREIGN KEY (anterior_id) REFERENCES atribuciones_credito_e1(id);
ALTER TABLE public."atribuciones_credito_e1" ADD CONSTRAINT "atribuciones_movimiento_fk_e1" FOREIGN KEY (movimiento_id) REFERENCES movimientos_credito(id);
ALTER TABLE public."atribuciones_credito_e1" ADD CONSTRAINT "atribuciones_sitio_fk_e1" FOREIGN KEY (sitio_origen_id) REFERENCES ubicaciones(id);
ALTER TABLE public."auditoria_faltante_reactivaciones" ADD CONSTRAINT "auditoria_faltante_reactivacion_movimiento_reactivacion_id_fkey" FOREIGN KEY (movimiento_reactivacion_id) REFERENCES movimientos(id);
ALTER TABLE public."auditoria_faltante_reactivaciones" ADD CONSTRAINT "auditoria_faltante_reactivaciones_auditoria_origen_id_fkey" FOREIGN KEY (auditoria_origen_id) REFERENCES auditorias_inventario(id);
ALTER TABLE public."auditoria_faltante_reactivaciones" ADD CONSTRAINT "auditoria_faltante_reactivaciones_movimiento_baja_id_fkey" FOREIGN KEY (movimiento_baja_id) REFERENCES movimientos(id);
ALTER TABLE public."auditoria_faltante_reactivaciones" ADD CONSTRAINT "auditoria_faltante_reactivaciones_piso_aparicion_id_fkey" FOREIGN KEY (piso_aparicion_id) REFERENCES pisos(id);
ALTER TABLE public."auditoria_faltante_reactivaciones" ADD CONSTRAINT "auditoria_faltante_reactivaciones_rollo_id_fkey" FOREIGN KEY (rollo_id) REFERENCES rollos(id);
ALTER TABLE public."auditoria_faltante_reactivaciones" ADD CONSTRAINT "auditoria_faltante_reactivaciones_ubicacion_aparicion_id_fkey" FOREIGN KEY (ubicacion_aparicion_id) REFERENCES ubicaciones(id);
ALTER TABLE public."auditoria_faltante_reactivaciones" ADD CONSTRAINT "auditoria_faltante_reactivaciones_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE public."auditoria_inventario_escaneos" ADD CONSTRAINT "auditoria_inventario_escaneos_auditoria_id_fkey" FOREIGN KEY (auditoria_id) REFERENCES auditorias_inventario(id);
ALTER TABLE public."auditoria_inventario_escaneos" ADD CONSTRAINT "auditoria_inventario_escaneos_piso_real_id_fkey" FOREIGN KEY (piso_real_id) REFERENCES pisos(id);
ALTER TABLE public."auditoria_inventario_escaneos" ADD CONSTRAINT "auditoria_inventario_escaneos_rollo_id_fkey" FOREIGN KEY (rollo_id) REFERENCES rollos(id);
ALTER TABLE public."auditoria_inventario_escaneos" ADD CONSTRAINT "auditoria_inventario_escaneos_ubicacion_cierre_id_fkey" FOREIGN KEY (ubicacion_cierre_id) REFERENCES ubicaciones(id);
ALTER TABLE public."auditoria_inventario_escaneos" ADD CONSTRAINT "auditoria_inventario_escaneos_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE public."auditoria_inventario_folio" ADD CONSTRAINT "auditoria_inventario_folio_ubicacion_id_fkey" FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
ALTER TABLE public."auditoria_inventario_participantes" ADD CONSTRAINT "auditoria_inventario_participantes_auditoria_id_fkey" FOREIGN KEY (auditoria_id) REFERENCES auditorias_inventario(id);
ALTER TABLE public."auditoria_inventario_participantes" ADD CONSTRAINT "auditoria_inventario_participantes_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE public."auditoria_inventario_snapshot" ADD CONSTRAINT "auditoria_inventario_snapshot_auditoria_id_fkey" FOREIGN KEY (auditoria_id) REFERENCES auditorias_inventario(id);
ALTER TABLE public."auditoria_inventario_snapshot" ADD CONSTRAINT "auditoria_inventario_snapshot_piso_snapshot_id_fkey" FOREIGN KEY (piso_snapshot_id) REFERENCES pisos(id);
ALTER TABLE public."auditoria_inventario_snapshot" ADD CONSTRAINT "auditoria_inventario_snapshot_rollo_id_fkey" FOREIGN KEY (rollo_id) REFERENCES rollos(id);
ALTER TABLE public."auditoria_inventario_snapshot" ADD CONSTRAINT "auditoria_inventario_snapshot_ubicacion_snapshot_id_fkey" FOREIGN KEY (ubicacion_snapshot_id) REFERENCES ubicaciones(id);
ALTER TABLE public."auditoria" ADD CONSTRAINT "auditoria_sitio_id_fkey" FOREIGN KEY (sitio_id) REFERENCES ubicaciones(id);
ALTER TABLE public."auditoria_sobrante_contextos" ADD CONSTRAINT "auditoria_sobrante_contextos_auditoria_id_fkey" FOREIGN KEY (auditoria_id) REFERENCES auditorias_inventario(id);
ALTER TABLE public."auditoria_sobrante_decisiones" ADD CONSTRAINT "auditoria_sobrante_decisiones_auditoria_id_fkey" FOREIGN KEY (auditoria_id) REFERENCES auditorias_inventario(id);
ALTER TABLE public."auditoria_sobrante_decisiones" ADD CONSTRAINT "auditoria_sobrante_decisiones_rollo_id_fkey" FOREIGN KEY (rollo_id) REFERENCES rollos(id);
ALTER TABLE public."auditoria_sobrante_decisiones" ADD CONSTRAINT "auditoria_sobrante_decisiones_salida_id_fkey" FOREIGN KEY (salida_id) REFERENCES salidas(id);
ALTER TABLE public."auditoria_sobrante_decisiones" ADD CONSTRAINT "auditoria_sobrante_decisiones_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE public."auditoria" ADD CONSTRAINT "auditoria_usuario_id_usuarios_id_fk" FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE public."auditorias_inventario" ADD CONSTRAINT "auditorias_inventario_cancelada_por_id_fkey" FOREIGN KEY (cancelada_por_id) REFERENCES usuarios(id);
ALTER TABLE public."auditorias_inventario" ADD CONSTRAINT "auditorias_inventario_cerrada_por_id_fkey" FOREIGN KEY (cerrada_por_id) REFERENCES usuarios(id);
ALTER TABLE public."auditorias_inventario" ADD CONSTRAINT "auditorias_inventario_confirmada_por_id_fkey" FOREIGN KEY (confirmada_por_id) REFERENCES usuarios(id);
ALTER TABLE public."auditorias_inventario" ADD CONSTRAINT "auditorias_inventario_creada_por_id_fkey" FOREIGN KEY (creada_por_id) REFERENCES usuarios(id);
ALTER TABLE public."auditorias_inventario" ADD CONSTRAINT "auditorias_inventario_ubicacion_id_fkey" FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
ALTER TABLE public."autorizaciones_nota" ADD CONSTRAINT "autorizaciones_nota_movimiento_credito_id_fkey" FOREIGN KEY (movimiento_credito_id) REFERENCES movimientos_credito(id);
ALTER TABLE public."autorizaciones_nota" ADD CONSTRAINT "autorizaciones_nota_sesion_caja_id_fkey" FOREIGN KEY (sesion_caja_id) REFERENCES sesiones_caja(id);
ALTER TABLE public."autorizaciones_nota" ADD CONSTRAINT "autorizaciones_nota_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES tickets(id);
ALTER TABLE public."autorizaciones_nota" ADD CONSTRAINT "autorizaciones_nota_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE public."cliente_documentos" ADD CONSTRAINT "cliente_documentos_cliente_id_clientes_id_fk" FOREIGN KEY (cliente_id) REFERENCES clientes(id);
ALTER TABLE public."cliente_documentos" ADD CONSTRAINT "cliente_documentos_subido_por_usuarios_id_fk" FOREIGN KEY (subido_por) REFERENCES usuarios(id);
ALTER TABLE public."cobros_credito_pendientes_e1" ADD CONSTRAINT "cobros_actor_fk_e1" FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE public."cobros_credito_pendientes_e1" ADD CONSTRAINT "cobros_cliente_fk_e1" FOREIGN KEY (cliente_id) REFERENCES clientes(id);
ALTER TABLE public."cobros_credito_pendientes_e1" ADD CONSTRAINT "cobros_operacion_fk_e1" FOREIGN KEY (operacion_productor, operacion_clave) REFERENCES operaciones_credito_e1(productor, clave) MATCH FULL;
ALTER TABLE public."cobros_credito_pendientes_e1" ADD CONSTRAINT "cobros_sesion_fk_e1" FOREIGN KEY (sesion_caja_id) REFERENCES sesiones_caja(id);
ALTER TABLE public."cobros_credito_pendientes_e1" ADD CONSTRAINT "cobros_sitio_fk_e1" FOREIGN KEY (sitio_origen_id) REFERENCES ubicaciones(id);
ALTER TABLE public."contenedor_lineas" ADD CONSTRAINT "contenedor_lineas_contenedor_id_contenedores_id_fk" FOREIGN KEY (contenedor_id) REFERENCES contenedores(id) ON DELETE CASCADE;
ALTER TABLE public."contenedor_lineas" ADD CONSTRAINT "contenedor_lineas_producto_id_productos_id_fk" FOREIGN KEY (producto_id) REFERENCES productos(id);
ALTER TABLE public."contenedores" ADD CONSTRAINT "contenedores_entrada_id_entradas_id_fk" FOREIGN KEY (entrada_id) REFERENCES entradas(id);
ALTER TABLE public."contenedores" ADD CONSTRAINT "contenedores_proveedor_id_proveedores_id_fk" FOREIGN KEY (proveedor_id) REFERENCES proveedores(id);
ALTER TABLE public."contenedores" ADD CONSTRAINT "contenedores_sitio_destino_id_ubicaciones_id_fk" FOREIGN KEY (sitio_destino_id) REFERENCES ubicaciones(id);
ALTER TABLE public."contenedores" ADD CONSTRAINT "contenedores_usuario_id_usuarios_id_fk" FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE public."cuadre_fiscal_registros" ADD CONSTRAINT "cuadre_fiscal_registros_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES usuarios(id);
ALTER TABLE public."cuadre_fiscal_registros" ADD CONSTRAINT "cuadre_fiscal_registros_resuelto_por_id_fkey" FOREIGN KEY (resuelto_por_id) REFERENCES usuarios(id);
ALTER TABLE public."cuadre_fiscal_registros" ADD CONSTRAINT "cuadre_fiscal_registros_ubicacion_id_fkey" FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
ALTER TABLE public."entrada_folio" ADD CONSTRAINT "entrada_folio_ubicacion_fkey" FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
ALTER TABLE public."entradas" ADD CONSTRAINT "entradas_proveedor_id_proveedores_id_fk" FOREIGN KEY (proveedor_id) REFERENCES proveedores(id);
ALTER TABLE public."entradas" ADD CONSTRAINT "entradas_ubicacion_id_ubicaciones_id_fk" FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
ALTER TABLE public."entradas" ADD CONSTRAINT "entradas_usuario_id_usuarios_id_fk" FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE public."equipos" ADD CONSTRAINT "equipos_actualizado_por_fkey" FOREIGN KEY (actualizado_por) REFERENCES usuarios(id);
ALTER TABLE public."equipos_checklist" ADD CONSTRAINT "equipos_checklist_checked_por_fkey" FOREIGN KEY (checked_por) REFERENCES usuarios(id);
ALTER TABLE public."equipos_checklist" ADD CONSTRAINT "equipos_checklist_equipo_id_fkey" FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE;
ALTER TABLE public."equipos" ADD CONSTRAINT "equipos_creado_por_fkey" FOREIGN KEY (creado_por) REFERENCES usuarios(id);
ALTER TABLE public."equipos" ADD CONSTRAINT "equipos_ubicacion_id_fkey" FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
ALTER TABLE public."existencias" ADD CONSTRAINT "existencias_producto_id_productos_id_fk" FOREIGN KEY (producto_id) REFERENCES productos(id);
ALTER TABLE public."existencias" ADD CONSTRAINT "existencias_ubicacion_id_ubicaciones_id_fk" FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
ALTER TABLE public."fondo_arqueos" ADD CONSTRAINT "fondo_arqueos_autor_id_fkey" FOREIGN KEY (autor_id) REFERENCES usuarios(id);
ALTER TABLE public."fondo_arqueos" ADD CONSTRAINT "fondo_arqueos_fondo_id_fkey" FOREIGN KEY (fondo_id) REFERENCES fondo_mariana(id);
ALTER TABLE public."fondo_arqueos" ADD CONSTRAINT "fondo_arqueos_version_saldo_fkey" FOREIGN KEY (version_saldo) REFERENCES fondo_movimientos(id);
ALTER TABLE public."fondo_mariana" ADD CONSTRAINT "fondo_mariana_ubicacion_id_fkey" FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
ALTER TABLE public."fondo_movimientos" ADD CONSTRAINT "fondo_movimientos_autor_id_fkey" FOREIGN KEY (autor_id) REFERENCES usuarios(id);
ALTER TABLE public."fondo_movimientos" ADD CONSTRAINT "fondo_movimientos_fondo_id_fkey" FOREIGN KEY (fondo_id) REFERENCES fondo_mariana(id);
ALTER TABLE public."fondo_movimientos" ADD CONSTRAINT "fondo_movimientos_original_id_fkey" FOREIGN KEY (original_id) REFERENCES fondo_movimientos(id);
ALTER TABLE public."movimientos_credito" ADD CONSTRAINT "movimientos_credito_autorizado_por_usuarios_id_fk" FOREIGN KEY (autorizado_por) REFERENCES usuarios(id);
ALTER TABLE public."movimientos_credito" ADD CONSTRAINT "movimientos_credito_cliente_id_clientes_id_fk" FOREIGN KEY (cliente_id) REFERENCES clientes(id);
ALTER TABLE public."movimientos_credito" ADD CONSTRAINT "movimientos_credito_movimiento_origen_id_fkey" FOREIGN KEY (movimiento_origen_id) REFERENCES movimientos_credito(id);
ALTER TABLE public."movimientos_credito" ADD CONSTRAINT "movimientos_credito_ticket_id_tickets_id_fk" FOREIGN KEY (ticket_id) REFERENCES tickets(id);
ALTER TABLE public."movimientos_credito" ADD CONSTRAINT "movimientos_credito_usuario_id_usuarios_id_fk" FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE public."movimientos_credito" ADD CONSTRAINT "movimientos_nota_fk_e1" FOREIGN KEY (nota_origen_id) REFERENCES tickets(id) NOT VALID;
ALTER TABLE public."movimientos_credito" ADD CONSTRAINT "movimientos_operacion_fk_e1" FOREIGN KEY (operacion_productor, operacion_clave) REFERENCES operaciones_credito_e1(productor, clave) MATCH FULL NOT VALID;
ALTER TABLE public."movimientos" ADD CONSTRAINT "movimientos_producto_id_productos_id_fk" FOREIGN KEY (producto_id) REFERENCES productos(id);
ALTER TABLE public."movimientos" ADD CONSTRAINT "movimientos_revisado_por_usuarios_id_fk" FOREIGN KEY (revisado_por) REFERENCES usuarios(id);
ALTER TABLE public."movimientos" ADD CONSTRAINT "movimientos_rollo_id_rollos_id_fk" FOREIGN KEY (rollo_id) REFERENCES rollos(id);
ALTER TABLE public."movimientos" ADD CONSTRAINT "movimientos_salida_id_salidas_id_fk" FOREIGN KEY (salida_id) REFERENCES salidas(id);
ALTER TABLE public."movimientos_credito" ADD CONSTRAINT "movimientos_sesion_fk_e1" FOREIGN KEY (sesion_caja_id) REFERENCES sesiones_caja(id) NOT VALID;
ALTER TABLE public."movimientos_credito" ADD CONSTRAINT "movimientos_sitio_fk_e1" FOREIGN KEY (sitio_origen_id) REFERENCES ubicaciones(id) NOT VALID;
ALTER TABLE public."movimientos" ADD CONSTRAINT "movimientos_ubicacion_id_ubicaciones_id_fk" FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
ALTER TABLE public."movimientos" ADD CONSTRAINT "movimientos_usuario_id_usuarios_id_fk" FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE public."notificaciones_credito" ADD CONSTRAINT "notificaciones_credito_cajero_id_usuarios_id_fk" FOREIGN KEY (cajero_id) REFERENCES usuarios(id);
ALTER TABLE public."notificaciones_credito" ADD CONSTRAINT "notificaciones_credito_cliente_id_clientes_id_fk" FOREIGN KEY (cliente_id) REFERENCES clientes(id);
ALTER TABLE public."notificaciones_credito" ADD CONSTRAINT "notificaciones_credito_ticket_id_tickets_id_fk" FOREIGN KEY (ticket_id) REFERENCES tickets(id);
ALTER TABLE public."notificaciones_credito" ADD CONSTRAINT "notificaciones_credito_tienda_id_ubicaciones_id_fk" FOREIGN KEY (tienda_id) REFERENCES ubicaciones(id);
ALTER TABLE public."notificaciones_sistema" ADD CONSTRAINT "notificaciones_sistema_destinatario_usuario_id_fkey" FOREIGN KEY (destinatario_usuario_id) REFERENCES usuarios(id);
ALTER TABLE public."operaciones_credito_e1" ADD CONSTRAINT "operaciones_actor_fk_e1" FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE public."pagos_proveedor" ADD CONSTRAINT "pagos_proveedor_entrada_id_entradas_id_fk" FOREIGN KEY (entrada_id) REFERENCES entradas(id);
ALTER TABLE public."pagos_proveedor" ADD CONSTRAINT "pagos_proveedor_movimiento_origen_id_fkey" FOREIGN KEY (movimiento_origen_id) REFERENCES pagos_proveedor(id);
ALTER TABLE public."pagos_proveedor" ADD CONSTRAINT "pagos_proveedor_proveedor_id_proveedores_id_fk" FOREIGN KEY (proveedor_id) REFERENCES proveedores(id);
ALTER TABLE public."pagos_proveedor" ADD CONSTRAINT "pagos_proveedor_usuario_id_usuarios_id_fk" FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE public."permisos_rol" ADD CONSTRAINT "permisos_rol_updated_por_usuarios_id_fk" FOREIGN KEY (updated_por) REFERENCES usuarios(id);
ALTER TABLE public."permisos_ubicacion" ADD CONSTRAINT "permisos_ubicacion_ubicacion_id_fkey" FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
ALTER TABLE public."permisos_ubicacion" ADD CONSTRAINT "permisos_ubicacion_updated_por_fkey" FOREIGN KEY (updated_por) REFERENCES usuarios(id);
ALTER TABLE public."permisos_usuario" ADD CONSTRAINT "permisos_usuario_updated_por_usuarios_id_fk" FOREIGN KEY (updated_por) REFERENCES usuarios(id);
ALTER TABLE public."permisos_usuario" ADD CONSTRAINT "permisos_usuario_usuario_id_usuarios_id_fk" FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE public."pisos" ADD CONSTRAINT "pisos_ubicacion_id_fkey" FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
ALTER TABLE public."precio_historial" ADD CONSTRAINT "precio_historial_producto_id_productos_id_fk" FOREIGN KEY (producto_id) REFERENCES productos(id);
ALTER TABLE public."precio_historial" ADD CONSTRAINT "precio_historial_usuario_id_usuarios_id_fk" FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE public."reimpresiones_etiqueta" ADD CONSTRAINT "reimpresiones_etiqueta_autorizado_por_usuarios_id_fk" FOREIGN KEY (autorizado_por) REFERENCES usuarios(id);
ALTER TABLE public."reimpresiones_etiqueta" ADD CONSTRAINT "reimpresiones_etiqueta_rollo_id_rollos_id_fk" FOREIGN KEY (rollo_id) REFERENCES rollos(id);
ALTER TABLE public."reimpresiones_etiqueta" ADD CONSTRAINT "reimpresiones_etiqueta_sitio_id_ubicaciones_id_fk" FOREIGN KEY (sitio_id) REFERENCES ubicaciones(id);
ALTER TABLE public."reimpresiones_etiqueta" ADD CONSTRAINT "reimpresiones_etiqueta_usuario_id_usuarios_id_fk" FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE public."revisiones_etiqueta" ADD CONSTRAINT "revisiones_etiqueta_reimpresion_id_fkey" FOREIGN KEY (reimpresion_id) REFERENCES reimpresiones_etiqueta(id);
ALTER TABLE public."revisiones_etiqueta" ADD CONSTRAINT "revisiones_etiqueta_rollo_id_fkey" FOREIGN KEY (rollo_id) REFERENCES rollos(id);
ALTER TABLE public."revisiones_etiqueta" ADD CONSTRAINT "revisiones_etiqueta_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE public."rollos" ADD CONSTRAINT "rollos_piso_id_fkey" FOREIGN KEY (piso_id) REFERENCES pisos(id);
ALTER TABLE public."rollos" ADD CONSTRAINT "rollos_producto_id_productos_id_fk" FOREIGN KEY (producto_id) REFERENCES productos(id);
ALTER TABLE public."rollos" ADD CONSTRAINT "rollos_proveedor_id_proveedores_id_fk" FOREIGN KEY (proveedor_id) REFERENCES proveedores(id);
ALTER TABLE public."rollos" ADD CONSTRAINT "rollos_ubicacion_id_ubicaciones_id_fk" FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
ALTER TABLE public."salida_folio" ADD CONSTRAINT "salida_folio_ubicacion_fkey" FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
ALTER TABLE public."salida_lineas" ADD CONSTRAINT "salida_lineas_producto_id_productos_id_fk" FOREIGN KEY (producto_id) REFERENCES productos(id);
ALTER TABLE public."salida_lineas" ADD CONSTRAINT "salida_lineas_salida_id_salidas_id_fk" FOREIGN KEY (salida_id) REFERENCES salidas(id);
ALTER TABLE public."salida_rollos" ADD CONSTRAINT "salida_rollos_linea_id_salida_lineas_id_fk" FOREIGN KEY (linea_id) REFERENCES salida_lineas(id);
ALTER TABLE public."salida_rollos" ADD CONSTRAINT "salida_rollos_rollo_id_rollos_id_fk" FOREIGN KEY (rollo_id) REFERENCES rollos(id);
ALTER TABLE public."salida_rollos" ADD CONSTRAINT "salida_rollos_salida_id_salidas_id_fk" FOREIGN KEY (salida_id) REFERENCES salidas(id);
ALTER TABLE public."salidas" ADD CONSTRAINT "salidas_autorizado_por_id_usuarios_id_fk" FOREIGN KEY (autorizado_por_id) REFERENCES usuarios(id);
ALTER TABLE public."salidas" ADD CONSTRAINT "salidas_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id);
ALTER TABLE public."salidas" ADD CONSTRAINT "salidas_destino_id_ubicaciones_id_fk" FOREIGN KEY (destino_id) REFERENCES ubicaciones(id);
ALTER TABLE public."salidas_dinero_caja" ADD CONSTRAINT "salidas_dinero_caja_creado_por_id_fkey" FOREIGN KEY (creado_por_id) REFERENCES usuarios(id);
ALTER TABLE public."salidas_dinero_caja" ADD CONSTRAINT "salidas_dinero_caja_proveedor_id_fkey" FOREIGN KEY (proveedor_id) REFERENCES proveedores(id);
ALTER TABLE public."salidas_dinero_caja" ADD CONSTRAINT "salidas_dinero_caja_sesion_caja_id_fkey" FOREIGN KEY (sesion_caja_id) REFERENCES sesiones_caja(id);
ALTER TABLE public."salidas" ADD CONSTRAINT "salidas_origen_id_ubicaciones_id_fk" FOREIGN KEY (origen_id) REFERENCES ubicaciones(id);
ALTER TABLE public."salidas" ADD CONSTRAINT "salidas_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES tickets(id);
ALTER TABLE public."salidas" ADD CONSTRAINT "salidas_usuario_acepta_id_usuarios_id_fk" FOREIGN KEY (usuario_acepta_id) REFERENCES usuarios(id);
ALTER TABLE public."salidas" ADD CONSTRAINT "salidas_usuario_cancela_id_usuarios_id_fk" FOREIGN KEY (usuario_cancela_id) REFERENCES usuarios(id);
ALTER TABLE public."salidas" ADD CONSTRAINT "salidas_usuario_cierra_id_usuarios_id_fk" FOREIGN KEY (usuario_cierra_id) REFERENCES usuarios(id);
ALTER TABLE public."salidas" ADD CONSTRAINT "salidas_usuario_entrega_id_fkey" FOREIGN KEY (usuario_entrega_id) REFERENCES usuarios(id);
ALTER TABLE public."salidas" ADD CONSTRAINT "salidas_usuario_envia_id_usuarios_id_fk" FOREIGN KEY (usuario_envia_id) REFERENCES usuarios(id);
ALTER TABLE public."salidas" ADD CONSTRAINT "salidas_usuario_prepara_id_usuarios_id_fk" FOREIGN KEY (usuario_prepara_id) REFERENCES usuarios(id);
ALTER TABLE public."salidas" ADD CONSTRAINT "salidas_usuario_recibe_id_usuarios_id_fk" FOREIGN KEY (usuario_recibe_id) REFERENCES usuarios(id);
ALTER TABLE public."salidas" ADD CONSTRAINT "salidas_usuario_solicita_id_usuarios_id_fk" FOREIGN KEY (usuario_solicita_id) REFERENCES usuarios(id);
ALTER TABLE public."sesiones_caja" ADD CONSTRAINT "sesiones_caja_cerrada_por_id_fkey" FOREIGN KEY (cerrada_por_id) REFERENCES usuarios(id);
ALTER TABLE public."sesiones_caja_dias" ADD CONSTRAINT "sesiones_caja_dias_sesion_caja_id_fkey" FOREIGN KEY (sesion_caja_id) REFERENCES sesiones_caja(id);
ALTER TABLE public."sesiones_caja_dias" ADD CONSTRAINT "sesiones_caja_dias_ubicacion_id_fkey" FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
ALTER TABLE public."sesiones_caja" ADD CONSTRAINT "sesiones_caja_ubicacion_id_ubicaciones_id_fk" FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
ALTER TABLE public."sesiones_caja" ADD CONSTRAINT "sesiones_caja_usuario_id_usuarios_id_fk" FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE public."sesiones" ADD CONSTRAINT "sesiones_usuario_id_usuarios_id_fk" FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE public."solicitudes_pago_dirigido" ADD CONSTRAINT "solicitudes_pago_dirigido_autorizador_id_fkey" FOREIGN KEY (autorizador_id) REFERENCES usuarios(id);
ALTER TABLE public."solicitudes_pago_dirigido" ADD CONSTRAINT "solicitudes_pago_dirigido_solicitante_id_fkey" FOREIGN KEY (solicitante_id) REFERENCES usuarios(id);
ALTER TABLE public."solicitudes_pago_dirigido" ADD CONSTRAINT "solicitudes_pago_dirigido_ubicacion_id_fkey" FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
ALTER TABLE public."stock_minimo_episodios" ADD CONSTRAINT "stock_minimo_episodios_movimiento_id_fkey" FOREIGN KEY (movimiento_id) REFERENCES movimientos(id);
ALTER TABLE public."stock_minimo_episodios" ADD CONSTRAINT "stock_minimo_episodios_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES productos(id);
ALTER TABLE public."stock_minimo_episodios" ADD CONSTRAINT "stock_minimo_episodios_ubicacion_id_fkey" FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
ALTER TABLE public."stock_minimo_sitios" ADD CONSTRAINT "stock_minimo_sitios_ubicacion_id_fkey" FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
ALTER TABLE public."stock_minimo_sitios" ADD CONSTRAINT "stock_minimo_sitios_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES usuarios(id);
ALTER TABLE public."stock_minimos" ADD CONSTRAINT "stock_minimos_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES productos(id);
ALTER TABLE public."stock_minimos" ADD CONSTRAINT "stock_minimos_ubicacion_id_fkey" FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
ALTER TABLE public."stock_minimos" ADD CONSTRAINT "stock_minimos_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES usuarios(id);
ALTER TABLE public."ticket_linea_consumos" ADD CONSTRAINT "ticket_linea_consumos_entrada_id_fkey" FOREIGN KEY (entrada_id) REFERENCES entradas(id);
ALTER TABLE public."ticket_linea_consumos" ADD CONSTRAINT "ticket_linea_consumos_movimiento_id_fkey" FOREIGN KEY (movimiento_id) REFERENCES movimientos(id);
ALTER TABLE public."ticket_linea_consumos" ADD CONSTRAINT "ticket_linea_consumos_proveedor_id_fkey" FOREIGN KEY (proveedor_id) REFERENCES proveedores(id);
ALTER TABLE public."ticket_linea_consumos" ADD CONSTRAINT "ticket_linea_consumos_reversa_de_id_fkey" FOREIGN KEY (reversa_de_id) REFERENCES ticket_linea_consumos(id);
ALTER TABLE public."ticket_linea_consumos" ADD CONSTRAINT "ticket_linea_consumos_rollo_id_fkey" FOREIGN KEY (rollo_id) REFERENCES rollos(id);
ALTER TABLE public."ticket_linea_consumos" ADD CONSTRAINT "ticket_linea_consumos_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES tickets(id);
ALTER TABLE public."ticket_linea_consumos" ADD CONSTRAINT "ticket_linea_consumos_ticket_linea_id_fkey" FOREIGN KEY (ticket_linea_id) REFERENCES ticket_lineas(id);
ALTER TABLE public."ticket_lineas" ADD CONSTRAINT "ticket_lineas_producto_id_productos_id_fk" FOREIGN KEY (producto_id) REFERENCES productos(id);
ALTER TABLE public."ticket_lineas" ADD CONSTRAINT "ticket_lineas_rollo_id_rollos_id_fk" FOREIGN KEY (rollo_id) REFERENCES rollos(id);
ALTER TABLE public."ticket_lineas" ADD CONSTRAINT "ticket_lineas_ticket_id_tickets_id_fk" FOREIGN KEY (ticket_id) REFERENCES tickets(id);
ALTER TABLE public."ticket_pagos" ADD CONSTRAINT "ticket_pagos_ticket_id_tickets_id_fk" FOREIGN KEY (ticket_id) REFERENCES tickets(id);
ALTER TABLE public."ticket_pagos" ADD CONSTRAINT "ticket_pagos_usuario_id_usuarios_id_fk" FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE public."tickets" ADD CONSTRAINT "tickets_autorizado_por_usuarios_id_fk" FOREIGN KEY (autorizado_por) REFERENCES usuarios(id);
ALTER TABLE public."tickets" ADD CONSTRAINT "tickets_cancelado_por_usuarios_id_fk" FOREIGN KEY (cancelado_por) REFERENCES usuarios(id);
ALTER TABLE public."tickets" ADD CONSTRAINT "tickets_cliente_id_clientes_id_fk" FOREIGN KEY (cliente_id) REFERENCES clientes(id);
ALTER TABLE public."tickets" ADD CONSTRAINT "tickets_sesion_caja_id_sesiones_caja_id_fk" FOREIGN KEY (sesion_caja_id) REFERENCES sesiones_caja(id);
ALTER TABLE public."tickets" ADD CONSTRAINT "tickets_ubicacion_id_ubicaciones_id_fk" FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
ALTER TABLE public."tickets" ADD CONSTRAINT "tickets_usuario_caja_id_usuarios_id_fk" FOREIGN KEY (usuario_caja_id) REFERENCES usuarios(id);
ALTER TABLE public."tickets" ADD CONSTRAINT "tickets_usuario_terminal_id_usuarios_id_fk" FOREIGN KEY (usuario_terminal_id) REFERENCES usuarios(id);
ALTER TABLE public."usuarios" ADD CONSTRAINT "usuarios_ubicacion_id_ubicaciones_id_fk" FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
ALTER TABLE public."viaje_folio" ADD CONSTRAINT "viaje_folio_ubicacion_id_fkey" FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
ALTER TABLE public."viaje_salidas" ADD CONSTRAINT "viaje_salidas_salida_id_fkey" FOREIGN KEY (salida_id) REFERENCES salidas(id);
ALTER TABLE public."viaje_salidas" ADD CONSTRAINT "viaje_salidas_viaje_id_fkey" FOREIGN KEY (viaje_id) REFERENCES viajes(id);
ALTER TABLE public."viaje_tickets" ADD CONSTRAINT "viaje_tickets_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES tickets(id);
ALTER TABLE public."viaje_tickets" ADD CONSTRAINT "viaje_tickets_viaje_id_fkey" FOREIGN KEY (viaje_id) REFERENCES viajes(id);
ALTER TABLE public."viajes" ADD CONSTRAINT "viajes_camioneta_id_fkey" FOREIGN KEY (camioneta_id) REFERENCES camionetas(id);
ALTER TABLE public."viajes" ADD CONSTRAINT "viajes_chofer_id_fkey" FOREIGN KEY (chofer_id) REFERENCES choferes(id);
ALTER TABLE public."viajes" ADD CONSTRAINT "viajes_creado_por_id_fkey" FOREIGN KEY (creado_por_id) REFERENCES usuarios(id);
ALTER TABLE public."viajes" ADD CONSTRAINT "viajes_origen_id_fkey" FOREIGN KEY (origen_id) REFERENCES ubicaciones(id);
CREATE INDEX aplicaciones_credito_venta_idx ON public.aplicaciones_credito USING btree (venta_movimiento_id);
CREATE INDEX aplicaciones_pago_proveedor_compra_idx ON public.aplicaciones_pago_proveedor USING btree (compra_proveedor_id);
CREATE INDEX auditoria_created_idx ON public.auditoria USING btree (created_at DESC, id DESC);
CREATE INDEX auditoria_entidad_idx ON public.auditoria USING btree (entidad, entidad_id);
CREATE INDEX auditoria_inventario_escaneos_usuario_idx ON public.auditoria_inventario_escaneos USING btree (usuario_id);
CREATE INDEX auditoria_inventario_snapshot_rollo_idx ON public.auditoria_inventario_snapshot USING btree (rollo_id);
CREATE INDEX auditoria_modulo_created_idx ON public.auditoria USING btree (modulo, created_at DESC);
CREATE INDEX auditoria_sitio_created_idx ON public.auditoria USING btree (sitio_id, created_at DESC);
CREATE INDEX auditoria_sobrante_decisiones_audit_serie_idx ON public.auditoria_sobrante_decisiones USING btree (auditoria_id, serie, id);
CREATE INDEX auditoria_usuario_created_idx ON public.auditoria USING btree (usuario_id, created_at);
CREATE INDEX auditorias_inventario_ubicacion_idx ON public.auditorias_inventario USING btree (ubicacion_id);
CREATE UNIQUE INDEX auditorias_inventario_una_abierta_por_sitio ON public.auditorias_inventario USING btree (ubicacion_id) WHERE (estado = 'ABIERTA'::text);
CREATE INDEX autorizaciones_nota_sesion_idx ON public.autorizaciones_nota USING btree (sesion_caja_id, created_at);
CREATE INDEX camionetas_activa_idx ON public.camionetas USING btree (activa);
CREATE UNIQUE INDEX camionetas_placas_unique ON public.camionetas USING btree (placas);
CREATE INDEX choferes_activo_idx ON public.choferes USING btree (activo);
CREATE INDEX choferes_nombre_completo_idx ON public.choferes USING btree (nombre_completo);
CREATE INDEX cliente_documentos_cliente_idx ON public.cliente_documentos USING btree (cliente_id);
CREATE UNIQUE INDEX cliente_documentos_slot_vigente_uidx ON public.cliente_documentos USING btree (cliente_id, lado) WHERE vigente;
CREATE UNIQUE INDEX clientes_activos_no_sistema_nombre_normalizado_uidx ON public.clientes USING btree (lower(btrim(nombre))) WHERE (activo AND (NOT es_sistema));
CREATE INDEX contenedor_lineas_contenedor_idx ON public.contenedor_lineas USING btree (contenedor_id);
CREATE INDEX contenedor_lineas_producto_idx ON public.contenedor_lineas USING btree (producto_id);
CREATE INDEX contenedores_estado_idx ON public.contenedores USING btree (estado);
CREATE INDEX contenedores_fecha_estimada_idx ON public.contenedores USING btree (fecha_estimada_llegada);
CREATE INDEX contenedores_proveedor_idx ON public.contenedores USING btree (proveedor_id);
CREATE INDEX contenedores_sitio_estado_idx ON public.contenedores USING btree (sitio_destino_id, estado);
CREATE INDEX cuadre_fiscal_registros_created_idx ON public.cuadre_fiscal_registros USING btree (created_at DESC);
CREATE INDEX entradas_fecha_id_idx ON public.entradas USING btree (fecha, id);
CREATE INDEX entradas_fecha_idx ON public.entradas USING btree (fecha);
CREATE INDEX entradas_folio_idx ON public.entradas USING btree (folio);
CREATE INDEX entradas_proveedor_idx ON public.entradas USING btree (proveedor_id);
CREATE UNIQUE INDEX entradas_ubicacion_folio_uidx ON public.entradas USING btree (ubicacion_id, folio);
CREATE INDEX entradas_ubicacion_idx ON public.entradas USING btree (ubicacion_id);
CREATE INDEX entradas_uuid_cliente_idx ON public.entradas USING btree (uuid_cliente);
CREATE INDEX equipos_checklist_equipo_idx ON public.equipos_checklist USING btree (equipo_id);
CREATE UNIQUE INDEX equipos_checklist_equipo_item_unique ON public.equipos_checklist USING btree (equipo_id, item_key);
CREATE UNIQUE INDEX equipos_ubicacion_identificador_ci_unique ON public.equipos USING btree (ubicacion_id, lower(identificador));
CREATE INDEX equipos_ubicacion_tipo_idx ON public.equipos USING btree (ubicacion_id, tipo);
CREATE INDEX existencias_producto_idx ON public.existencias USING btree (producto_id);
CREATE INDEX existencias_ubicacion_idx ON public.existencias USING btree (ubicacion_id);
CREATE INDEX fondo_arqueos_fondo_fecha_idx ON public.fondo_arqueos USING btree (fondo_id, created_at DESC, id DESC);
CREATE UNIQUE INDEX fondo_arqueos_productor_idempotencia_uidx ON public.fondo_arqueos USING btree (idempotency_producer, idempotency_key);
CREATE UNIQUE INDEX fondo_mariana_singleton_uidx ON public.fondo_mariana USING btree ((true));
CREATE UNIQUE INDEX fondo_mariana_ubicacion_uidx ON public.fondo_mariana USING btree (ubicacion_id);
CREATE INDEX fondo_movimientos_fondo_ordinal_idx ON public.fondo_movimientos USING btree (fondo_id, ordinal DESC);
CREATE UNIQUE INDEX fondo_movimientos_ordinal_uidx ON public.fondo_movimientos USING btree (ordinal);
CREATE UNIQUE INDEX fondo_movimientos_original_uidx ON public.fondo_movimientos USING btree (original_id) WHERE (original_id IS NOT NULL);
CREATE UNIQUE INDEX fondo_movimientos_productor_idempotencia_uidx ON public.fondo_movimientos USING btree (idempotency_producer, idempotency_key);
CREATE INDEX movimientos_created_idx ON public.movimientos USING btree (created_at);
CREATE INDEX movimientos_credito_cliente_created_at_idx ON public.movimientos_credito USING btree (cliente_id, created_at);
CREATE UNIQUE INDEX movimientos_credito_reverso_origen_uidx ON public.movimientos_credito USING btree (movimiento_origen_id) WHERE ((tipo = 'REVERSO'::tipo_movimiento_credito) AND (movimiento_origen_id IS NOT NULL));
CREATE INDEX movimientos_credito_ticket_idx ON public.movimientos_credito USING btree (ticket_id);
CREATE INDEX movimientos_motivo_salida_extraordinaria_idx ON public.movimientos USING btree (motivo_salida_extraordinaria);
CREATE UNIQUE INDEX movimientos_operacion_uq_e1 ON public.movimientos_credito USING btree (operacion_productor, operacion_clave) WHERE (operacion_productor IS NOT NULL);
CREATE INDEX movimientos_producto_ubicacion_idx ON public.movimientos USING btree (producto_id, ubicacion_id);
CREATE INDEX movimientos_revisado_idx ON public.movimientos USING btree (revisado);
CREATE INDEX movimientos_rollo_idx ON public.movimientos USING btree (rollo_id);
CREATE INDEX movimientos_salida_idx ON public.movimientos USING btree (salida_id);
CREATE INDEX movimientos_tipo_idx ON public.movimientos USING btree (tipo);
CREATE INDEX movimientos_ubicacion_created_reportes_idx ON public.movimientos USING btree (ubicacion_id, created_at);
CREATE INDEX movimientos_uuid_cliente_idx ON public.movimientos USING btree (uuid_cliente);
CREATE UNIQUE INDEX notificaciones_auditoria_cerrada_uidx ON public.notificaciones_sistema USING btree (entidad, entidad_id) WHERE (tipo = 'AUDITORIA_INVENTARIO_CERRADA'::text);
CREATE INDEX notificaciones_credito_cliente_idx ON public.notificaciones_credito USING btree (cliente_id);
CREATE INDEX notificaciones_credito_leida_created_idx ON public.notificaciones_credito USING btree (leida_at, created_at);
CREATE INDEX notificaciones_sistema_destinatario_leida_idx ON public.notificaciones_sistema USING btree (destinatario_usuario_id, leida_at, created_at);
CREATE INDEX notificaciones_sistema_leida_created_idx ON public.notificaciones_sistema USING btree (leida_at, created_at);
CREATE UNIQUE INDEX notificaciones_sistema_pago_dirigido_resuelto_uidx ON public.notificaciones_sistema USING btree (entidad, entidad_id, destinatario_usuario_id) WHERE (tipo = 'PAGO_DIRIGIDO_RESUELTO'::text);
CREATE UNIQUE INDEX notificaciones_sistema_stock_minimo_episode_recipient_uidx ON public.notificaciones_sistema USING btree (entidad, entidad_id, destinatario_usuario_id) WHERE (tipo = 'STOCK_MINIMO'::text);
CREATE UNIQUE INDEX pagos_proveedor_entrada_compra_idx ON public.pagos_proveedor USING btree (entrada_id) WHERE ((tipo = 'COMPRA'::tipo_pago_proveedor) AND (entrada_id IS NOT NULL));
CREATE INDEX pagos_proveedor_proveedor_fecha_idx ON public.pagos_proveedor USING btree (proveedor_id, fecha);
CREATE UNIQUE INDEX pagos_proveedor_reverso_origen_uidx ON public.pagos_proveedor USING btree (movimiento_origen_id) WHERE ((tipo = 'REVERSO'::tipo_pago_proveedor) AND (movimiento_origen_id IS NOT NULL));
CREATE UNIQUE INDEX pisos_ubicacion_nombre_ci_unique ON public.pisos USING btree (ubicacion_id, lower(nombre));
CREATE INDEX precio_historial_producto_created_idx ON public.precio_historial USING btree (producto_id, created_at);
CREATE INDEX precio_historial_producto_modo_created_idx ON public.precio_historial USING btree (producto_id, modo_precio, created_at);
CREATE INDEX productos_sku_idx ON public.productos USING btree (sku);
CREATE INDEX productos_tela_color_idx ON public.productos USING btree (tela, color);
CREATE INDEX reimpresiones_etiqueta_created_at_idx ON public.reimpresiones_etiqueta USING btree (created_at);
CREATE INDEX reimpresiones_etiqueta_rollo_idx ON public.reimpresiones_etiqueta USING btree (rollo_id);
CREATE INDEX reimpresiones_etiqueta_usuario_idx ON public.reimpresiones_etiqueta USING btree (usuario_id);
CREATE INDEX revisiones_etiqueta_created_at_idx ON public.revisiones_etiqueta USING btree (created_at);
CREATE INDEX revisiones_etiqueta_rollo_idx ON public.revisiones_etiqueta USING btree (rollo_id);
CREATE UNIQUE INDEX revisiones_etiqueta_rollo_reimpresion_uidx ON public.revisiones_etiqueta USING btree (rollo_id, reimpresion_id);
CREATE INDEX revisiones_etiqueta_usuario_idx ON public.revisiones_etiqueta USING btree (usuario_id);
CREATE INDEX rollos_estado_idx ON public.rollos USING btree (estado);
CREATE INDEX rollos_piso_idx ON public.rollos USING btree (piso_id);
CREATE INDEX rollos_producto_idx ON public.rollos USING btree (producto_id);
CREATE INDEX rollos_recepcion_producto_idx ON public.rollos USING btree (recepcion_id, producto_id);
CREATE INDEX rollos_serie_idx ON public.rollos USING btree (serie);
CREATE INDEX rollos_ubicacion_idx ON public.rollos USING btree (ubicacion_id);
CREATE INDEX rollos_ubicacion_producto_reportes_idx ON public.rollos USING btree (ubicacion_id, producto_id);
CREATE INDEX salida_lineas_producto_idx ON public.salida_lineas USING btree (producto_id);
CREATE INDEX salida_lineas_salida_idx ON public.salida_lineas USING btree (salida_id);
CREATE INDEX salida_rollos_linea_idx ON public.salida_rollos USING btree (linea_id);
CREATE INDEX salida_rollos_rollo_idx ON public.salida_rollos USING btree (rollo_id);
CREATE INDEX salida_rollos_rollo_salida_idx ON public.salida_rollos USING btree (rollo_id, salida_id);
CREATE INDEX salida_rollos_salida_idx ON public.salida_rollos USING btree (salida_id);
CREATE UNIQUE INDEX salidas_borrador_usuario_origen_uidx ON public.salidas USING btree (usuario_solicita_id, origen_id) WHERE ((estado = 'ARMANDO'::estado_salida) AND (modalidad = 'TRASLADO'::text) AND (usuario_solicita_id IS NOT NULL));
CREATE INDEX salidas_cliente_estado_idx ON public.salidas USING btree (cliente_id, estado);
CREATE INDEX salidas_created_at_idx ON public.salidas USING btree (created_at);
CREATE INDEX salidas_destino_estado_idx ON public.salidas USING btree (destino_id, estado);
CREATE INDEX salidas_dinero_caja_proveedor_idx ON public.salidas_dinero_caja USING btree (proveedor_id);
CREATE INDEX salidas_dinero_caja_sesion_created_idx ON public.salidas_dinero_caja USING btree (sesion_caja_id, created_at);
CREATE INDEX salidas_estado_actividad_idx ON public.salidas USING btree (estado, actividad_at);
CREATE INDEX salidas_estado_idx ON public.salidas USING btree (estado);
CREATE INDEX salidas_folio_idx ON public.salidas USING btree (folio);
CREATE INDEX salidas_origen_estado_idx ON public.salidas USING btree (origen_id, estado);
CREATE UNIQUE INDEX salidas_origen_folio_uidx ON public.salidas USING btree (origen_id, folio);
CREATE INDEX salidas_ticket_idx ON public.salidas USING btree (ticket_id);
CREATE INDEX sesiones_caja_cerrada_at_idx ON public.sesiones_caja USING btree (cerrada_at) WHERE (estado = 'CERRADA'::estado_sesion_caja);
CREATE INDEX sesiones_caja_ubicacion_estado_idx ON public.sesiones_caja USING btree (ubicacion_id, estado);
CREATE UNIQUE INDEX sesiones_caja_una_abierta_ubicacion_idx ON public.sesiones_caja USING btree (ubicacion_id) WHERE (estado = 'ABIERTA'::estado_sesion_caja);
CREATE INDEX solicitudes_pago_dirigido_entidad_idx ON public.solicitudes_pago_dirigido USING btree (tipo, entidad_id);
CREATE INDEX solicitudes_pago_dirigido_estado_idx ON public.solicitudes_pago_dirigido USING btree (estado, created_at);
CREATE UNIQUE INDEX stock_minimo_episodios_activo_uidx ON public.stock_minimo_episodios USING btree (producto_id, ubicacion_id) WHERE (cerrado_at IS NULL);
CREATE INDEX stock_minimo_episodios_ubicacion_abierto_idx ON public.stock_minimo_episodios USING btree (ubicacion_id, cerrado_at);
CREATE UNIQUE INDEX stock_minimos_producto_ubicacion_uidx ON public.stock_minimos USING btree (producto_id, ubicacion_id);
CREATE INDEX stock_minimos_ubicacion_idx ON public.stock_minimos USING btree (ubicacion_id);
CREATE UNIQUE INDEX ticket_linea_consumos_idempotencia_uidx ON public.ticket_linea_consumos USING btree (idempotencia);
CREATE UNIQUE INDEX ticket_linea_consumos_movimiento_consumo_uidx ON public.ticket_linea_consumos USING btree (movimiento_id) WHERE (tipo = 'CONSUMO'::text);
CREATE INDEX ticket_linea_consumos_proveedor_idx ON public.ticket_linea_consumos USING btree (proveedor_id);
CREATE UNIQUE INDEX ticket_linea_consumos_reversa_uidx ON public.ticket_linea_consumos USING btree (reversa_de_id) WHERE (tipo = 'REVERSA'::text);
CREATE INDEX ticket_linea_consumos_rollo_idx ON public.ticket_linea_consumos USING btree (rollo_id);
CREATE INDEX ticket_linea_consumos_ticket_idx ON public.ticket_linea_consumos USING btree (ticket_id);
CREATE INDEX ticket_linea_consumos_ticket_linea_idx ON public.ticket_linea_consumos USING btree (ticket_linea_id);
CREATE INDEX ticket_lineas_producto_idx ON public.ticket_lineas USING btree (producto_id);
CREATE INDEX ticket_lineas_producto_ticket_reportes_idx ON public.ticket_lineas USING btree (producto_id, ticket_id);
CREATE INDEX ticket_lineas_rollo_idx ON public.ticket_lineas USING btree (rollo_id);
CREATE INDEX ticket_lineas_ticket_idx ON public.ticket_lineas USING btree (ticket_id);
CREATE INDEX ticket_lineas_tipo_idx ON public.ticket_lineas USING btree (tipo);
CREATE INDEX ticket_pagos_ticket_idx ON public.ticket_pagos USING btree (ticket_id);
CREATE INDEX tickets_cliente_created_at_idx ON public.tickets USING btree (cliente_id, created_at);
CREATE INDEX tickets_cobrado_created_at_idx ON public.tickets USING btree (created_at, ubicacion_id) WHERE (cobrado = true);
CREATE INDEX tickets_cobrado_idx ON public.tickets USING btree (cobrado);
CREATE INDEX tickets_created_at_idx ON public.tickets USING btree (created_at);
CREATE INDEX tickets_estado_idx ON public.tickets USING btree (estado);
CREATE INDEX tickets_folio_idx ON public.tickets USING btree (folio);
CREATE INDEX tickets_sesion_estado_idx ON public.tickets USING btree (sesion_caja_id, estado);
CREATE INDEX tickets_ubicacion_created_at_idx ON public.tickets USING btree (ubicacion_id, created_at);
CREATE INDEX tickets_uuid_cliente_idx ON public.tickets USING btree (uuid_cliente);
CREATE UNIQUE INDEX ubicaciones_iniciales_uidx ON public.ubicaciones USING btree (iniciales);
CREATE INDEX viaje_salidas_viaje_idx ON public.viaje_salidas USING btree (viaje_id);
CREATE INDEX viaje_tickets_viaje_idx ON public.viaje_tickets USING btree (viaje_id);
CREATE INDEX viajes_camioneta_idx ON public.viajes USING btree (camioneta_id);
CREATE INDEX viajes_chofer_idx ON public.viajes USING btree (chofer_id);
CREATE INDEX viajes_salida_at_idx ON public.viajes USING btree (salida_at);
CREATE TRIGGER aplicaciones_credito_inmutables BEFORE DELETE OR UPDATE ON aplicaciones_credito FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation();
CREATE TRIGGER aplicaciones_credito_validas BEFORE INSERT ON aplicaciones_credito FOR EACH ROW EXECUTE FUNCTION validate_credit_application();
CREATE TRIGGER aplicaciones_pago_proveedor_append_only BEFORE DELETE OR UPDATE ON aplicaciones_pago_proveedor FOR EACH ROW EXECUTE FUNCTION proteger_aplicaciones_pago_proveedor();
CREATE TRIGGER aplicaciones_pago_proveedor_validar_insert BEFORE INSERT ON aplicaciones_pago_proveedor FOR EACH ROW EXECUTE FUNCTION validar_aplicacion_pago_proveedor();
CREATE TRIGGER atribuciones_inmutables_e1 BEFORE DELETE OR UPDATE OR TRUNCATE ON atribuciones_credito_e1 FOR EACH STATEMENT EXECUTE FUNCTION impedir_mutacion_credito_e1();
CREATE TRIGGER atribuciones_validas_e1 BEFORE INSERT ON atribuciones_credito_e1 FOR EACH ROW EXECUTE FUNCTION validar_atribucion_credito_e1();
CREATE TRIGGER auditoria_append_only BEFORE DELETE OR UPDATE ON auditoria FOR EACH ROW EXECUTE FUNCTION proteger_auditoria_append_only();
CREATE TRIGGER auditoria_enriquecer_insert BEFORE INSERT ON auditoria FOR EACH ROW EXECUTE FUNCTION enriquecer_auditoria();
CREATE TRIGGER auditoria_faltante_reactivaciones_append_only BEFORE DELETE OR UPDATE ON auditoria_faltante_reactivaciones FOR EACH ROW EXECUTE FUNCTION proteger_auditoria_resolucion_append_only();
CREATE TRIGGER auditoria_sobrante_contextos_append_only BEFORE DELETE OR UPDATE ON auditoria_sobrante_contextos FOR EACH ROW EXECUTE FUNCTION proteger_auditoria_resolucion_append_only();
CREATE TRIGGER auditoria_sobrante_decisiones_append_only BEFORE DELETE OR UPDATE ON auditoria_sobrante_decisiones FOR EACH ROW EXECUTE FUNCTION proteger_auditoria_resolucion_append_only();
CREATE TRIGGER cobros_inmutables_e1 BEFORE DELETE OR UPDATE OR TRUNCATE ON cobros_credito_pendientes_e1 FOR EACH STATEMENT EXECUTE FUNCTION impedir_mutacion_credito_e1();
CREATE TRIGGER cobros_validos_e1 AFTER INSERT ON cobros_credito_pendientes_e1 FOR EACH ROW EXECUTE FUNCTION validar_cobro_pendiente_e1();
CREATE TRIGGER fondo_arqueos_immutable_before_mutation BEFORE DELETE OR UPDATE ON fondo_arqueos FOR EACH ROW EXECUTE FUNCTION fondo_reject_mutation();
CREATE TRIGGER fondo_arqueos_immutable_before_truncate BEFORE TRUNCATE ON fondo_arqueos FOR EACH STATEMENT EXECUTE FUNCTION fondo_reject_mutation();
CREATE TRIGGER fondo_arqueos_validate_before_insert BEFORE INSERT ON fondo_arqueos FOR EACH ROW EXECUTE FUNCTION fondo_validate_audit();
CREATE TRIGGER fondo_mariana_fixed_before_mutation BEFORE INSERT OR DELETE OR UPDATE ON fondo_mariana FOR EACH ROW EXECUTE FUNCTION fondo_assert_fixed_mariana();
CREATE TRIGGER fondo_mariana_immutable_before_truncate BEFORE TRUNCATE ON fondo_mariana FOR EACH STATEMENT EXECUTE FUNCTION fondo_reject_mutation();
CREATE TRIGGER fondo_movimientos_immutable_before_mutation BEFORE DELETE OR UPDATE ON fondo_movimientos FOR EACH ROW EXECUTE FUNCTION fondo_reject_mutation();
CREATE TRIGGER fondo_movimientos_immutable_before_truncate BEFORE TRUNCATE ON fondo_movimientos FOR EACH STATEMENT EXECUTE FUNCTION fondo_reject_mutation();
CREATE TRIGGER fondo_movimientos_validate_before_insert BEFORE INSERT ON fondo_movimientos FOR EACH ROW EXECUTE FUNCTION fondo_validate_movement();
CREATE TRIGGER movimientos_credito_inmutables BEFORE DELETE OR UPDATE ON movimientos_credito FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation();
CREATE TRIGGER movimientos_credito_reversos_validos BEFORE INSERT ON movimientos_credito FOR EACH ROW EXECUTE FUNCTION validate_credit_reversal();
CREATE TRIGGER movimientos_validos_e1 AFTER INSERT ON movimientos_credito FOR EACH ROW EXECUTE FUNCTION validar_movimiento_credito_e1();
CREATE TRIGGER operaciones_inmutables_e1 BEFORE DELETE OR UPDATE OR TRUNCATE ON operaciones_credito_e1 FOR EACH STATEMENT EXECUTE FUNCTION impedir_mutacion_credito_e1();
CREATE TRIGGER pagos_proveedor_inmutables BEFORE DELETE OR UPDATE ON pagos_proveedor FOR EACH ROW EXECUTE FUNCTION prevent_pago_proveedor_mutation();
CREATE TRIGGER reimpresiones_etiqueta_inmutable BEFORE DELETE OR UPDATE ON reimpresiones_etiqueta FOR EACH ROW EXECUTE FUNCTION bloquear_mutacion_reimpresion_etiqueta();
CREATE TRIGGER revisiones_etiqueta_inmutable BEFORE DELETE OR UPDATE ON revisiones_etiqueta FOR EACH ROW EXECUTE FUNCTION bloquear_mutacion_revision_etiqueta();
CREATE TRIGGER revisiones_etiqueta_reimpresion_fk_check BEFORE INSERT OR UPDATE ON revisiones_etiqueta FOR EACH ROW EXECUTE FUNCTION validar_revision_etiqueta_reimpresion();
CREATE TRIGGER ticket_linea_consumos_append_only BEFORE INSERT OR DELETE OR UPDATE ON ticket_linea_consumos FOR EACH ROW EXECUTE FUNCTION ticket_linea_consumos_guard();
CREATE TRIGGER ticket_pagos_inmutables BEFORE DELETE OR UPDATE ON ticket_pagos FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation();
CREATE TRIGGER zz_e1_cash_capture_closed AFTER INSERT ON movimientos_credito FOR EACH ROW EXECUTE FUNCTION e1_guard_cash_capture_closed();
CREATE TRIGGER zz_e1_historical_attribution_closed AFTER INSERT ON atribuciones_credito_e1 FOR EACH STATEMENT EXECUTE FUNCTION e1_guard_historical_attribution_closed();
CREATE TRIGGER zz_e1_pending_receipts_closed AFTER INSERT ON cobros_credito_pendientes_e1 FOR EACH STATEMENT EXECUTE FUNCTION e1_guard_pending_receipts_closed();
ALTER TABLE public.ticket_linea_consumos ENABLE ALWAYS TRIGGER ticket_linea_consumos_append_only;
COMMIT;
