-- E11 PREPARADO / NO EJECUTADO / DML CERRADO. No autoriza instalación/operación.
-- Contraste: backend-storage-contract.md handoff y e11-repository.ts.
-- 8 tablas de adapter + 4 técnicas = 12 tablas E11. Sin ALTER usuarios/seed.
-- Recuperación 9656: e11_operaciones comparte PK entre CONFIRMADA y tombstone;
-- NO tabla paralela de cancelaciones. Backend bloquea E11:actor:acción:uuid
-- lowercase ANTES de work; SQL usa mismo namespace con try-lock (40001 al
-- contender después de locks de filas). PK arbitra snapshots SERIALIZABLE viejos:
-- el perdedor revierte TODO. UPSERT perfil aún no lleva UUID; evento posterior
-- y grafo impiden confirmar ese cambio si hay tombstone. No se afirma ausencia
-- de trabajo transitorio previo al rollback por SQL aislado del adapter.
-- Resolución: tombstone opcional -> auditoría, validación diferida; ADMIN fresco
-- al INSERT auditoría, nunca exigir al actor original privilegios actuales.
-- Hash body original no se lowercasa; sólo UUIDs de recovery ya normalizados por
-- E11RecoveryTarget/Input. GET/autorización de sesión y entrega siguen backend.
-- Cotejo MANUAL (sin PG): e11-repository e11Replay lee estado antes de work;
-- recoveryState toma el mismo lock y no lee respuesta privada; e11Resolve
-- usa lock E11:resolution:admin:uuid y hash {target,input}, luego escribe
-- operaciones(estado) opcional y las 13 columnas contractuales de resoluciones.
-- SQL añade sólo birth_xid técnico a esas 13. OpenAPI E11OperacionRecuperacion
-- enumera siete campos: el grafo reconstruye exactamente esos siete, incluidos
-- revision/resolucionId/resueltoEn; nunca trata CONFIRMADA sin auditoría como
-- resolución liberadora. CREATE es preparado de instalación vacía, no migración
-- sobre esquema existente; no rehashea ni reescribe ninguna evidencia previa.
-- Tablas técnicas: procedencia de notificación, cambios reales de usuario,
-- testigo de preparación A y archivo de definiciones E5 (no negocio).
-- F sin sidecar = versión 0, virtual: no inventar evento/ADMIN de default.
-- No edita artefactos E1/E5 ni dinero/FIFO/permisos/69 vetos. Extensión estrecha
-- de función E5 preparada aquí, nunca aplicada; reversión restaura original.
-- Privacidad HTTP/lectores fiscales y financieros depende de whitelist/deny
-- servidor: estas restricciones de escritura no son autorización SQL de lectura.
--
-- Orden REAL: UPSERT perfil -> evento -> replay; revocación -> evento -> UPDATE
-- usuarios (sin replay); snapshot -> ventas -> replay; decisión -> aviso UUID ->
-- notificación local -> replay. Hijos/replay se verifican DIFERIDOS, no al primer
-- INSERT. Cada tabla relacionada vuelve a encolar el grafo incluso después de
-- SET CONSTRAINTS IMMEDIATE; sellos BEFORE evitan adjuntar hijos históricos.
-- No xmin: birth_xid superior impuesto en INSERT, incluso bajo SAVEPOINT.
-- Precondiciones: PostgreSQL >=13, tablas usuarios/tickets/clientes/
-- notificaciones_sistema; columnas y predicado accounted-document.ts vigentes.
-- Hash SHA256 usa pg_catalog.sha256 sobre UTF8, igual createHash("sha256").
-- e11Canonical JS NO hashea JSON.stringify(objeto) sin ordenar: ordena claves
-- con localeCompare y concatena sin espacios. Aquí se reconstruyen objetos/
-- arrays recursivamente: nunca jsonb::text para contenedores (añadiría espacios).
-- Claves de whitelist son ASCII, case/camel sin pares de orden conflictivo:
-- COLLATE "C" y localeCompare coinciden en este conjunto cerrado, NO en JSON
-- arbitrario con claves Unicode. Arrays conservan orden, ventas ORDER BY id.
-- Importe es STRING (total::text preserva 2 decimales), no número JS/float;
-- únicos números hasheados son IDs/revisiones enteros acotados: no exponentes,
-- fracciones, NaN/Infinity o magnitud 1e21 donde JSONB y JS serializan distinto.
-- Se normaliza número JSONB integral 1.0 -> "1" como JSON.stringify(Number);
-- se rechaza dominio fraccionario/fuera de int32 en vez de simular ECMAScript.
-- Strings escalares jsonb::text escapan comillas/backslash/control como JS;
-- Unicode válido se conserva sin normalización. NUL/surrogates aislados que
-- JSONB UTF8 no admite fallan, no se sustituyen ni se fabrica hash equivalente.
-- UTC: to_char MS TRUNCA microsegundos a milisegundos, como Date.toISOString;
-- exactamente YYYY-MM-DDTHH:mm:ss.sssZ. e11_iso rechaza infinito/eras/años fuera
-- 0001..9999, no confunde BC o años extendidos JS. TZ IANA igual mexico-date.ts.
-- Esto resuelve diferencias visibles de espacios/orden/decimales/fechas.
-- UUID de body E11 NO se normaliza en generated Zod; DB uuid sí. Comparar por
-- tipo uuid, conservar case original del body al reconstruir solicitud_hash
-- (viene de la referencia REAL E11:<uuid>:perfil:<version>). E5 sí normaliza
-- input.claveOperacion: no inferir de ella la representación original E11.
-- Inspección estática NO prueba equivalencia completa JS/PG/ICU/tzdata.
-- Transacciones HTTP E11 SERIALIZABLE; legacy users usa transacción propia y
-- lock exclusivo E11:security antes de filas. No imponer SERIALIZABLE al legacy.
-- Try-locks de seguridad no esperan después de locks de fila; 40001 aborta unidad,
-- no reintentar sólo sentencia. No se afirma ausencia global de deadlocks.
-- Extensión E5 incluida sólo EN ESTE preparado E11: una rama PROPONER A.
-- No se edita el paquete E5 sellado. Requiere esquema E5 preparado previo,
-- hashes prosrc/anclas únicas revisadas y cierres incondicionales intactos.
-- No introduce estampa cliente: usa evidencia REAL del adapter
-- E11:<uuid>:perfil:<version>, content canónico E5 y replay E11 posterior.
-- Testigo técnico registra lo observado al INSERT, nunca otorga autorización.
-- Autoridad temporal: BEFORE exige ADMIN/F/A vigente en cada INSERT propio.
-- El grafo NO vuelve a autorizar autores históricos al cambiar usuarios/perfil,
-- ni siquiera para una revocación legal posterior en esa misma unidad. E5 A se
-- comprueba al INSERT real y al capturarlo, no al recorrer propuestas antiguas.
-- El grafo conserva comprobaciones de integridad/fuente de la unidad naciente,
-- NO vigencia perpetua del emisor. ADMIN puede aprobar una propuesta A histórica.
-- Tampoco invalida evento emitido por ADMIN después de su baja/autodemoción.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.notificaciones_sistema WHERE tipo='E11_NO_CUADRA')
  THEN RAISE EXCEPTION 'E11: evidencia previa sin paquete alineado, no instalar encima'; END IF;
  IF to_regclass('public.e5_operaciones') IS NULL OR to_regclass('public.e5_nacimientos') IS NULL
  THEN RAISE EXCEPTION 'E11: requiere E5 preparado alineado y cerrado, no inventar dependencia'; END IF;
END $$;

CREATE TABLE public.e11_perfiles (
  usuario_id integer PRIMARY KEY REFERENCES public.usuarios(id),
  perfil text CHECK (perfil IN ('A','F')),
  version integer NOT NULL CHECK(version>=1),
  actor_id integer NOT NULL REFERENCES public.usuarios(id),
  updated_at timestamptz NOT NULL CHECK(isfinite(updated_at)),
  birth_xid xid8 NOT NULL
);
CREATE TABLE public.e11_perfil_eventos (
  id uuid PRIMARY KEY, usuario_id integer NOT NULL REFERENCES public.usuarios(id),
  actor_id integer NOT NULL REFERENCES public.usuarios(id),
  revision integer NOT NULL CHECK(revision>=1), uuid uuid NOT NULL,
  datos jsonb NOT NULL CHECK(jsonb_typeof(datos)='object'),
  birth_xid xid8 NOT NULL,
  UNIQUE(usuario_id,revision), UNIQUE(actor_id,uuid)
);
CREATE TABLE public.e11_operaciones (
  actor_id integer NOT NULL REFERENCES public.usuarios(id),
  operacion text NOT NULL CHECK(operacion IN ('PERFIL','SNAPSHOT','DECISION','PREPARACION')),
  uuid uuid NOT NULL, solicitud_hash text NOT NULL CHECK(solicitud_hash ~ '^[0-9a-f]{64}$'),
  respuesta jsonb NOT NULL CHECK(jsonb_typeof(respuesta)='object'), birth_xid xid8 NOT NULL,
  estado text NOT NULL DEFAULT 'CONFIRMADA' CHECK(estado IN ('CONFIRMADA','CERRADA_SIN_EFECTO')),
  PRIMARY KEY(actor_id,operacion,uuid)
);
CREATE TABLE public.e11_resoluciones (
  id uuid PRIMARY KEY,
  actor_original_id integer NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  accion text NOT NULL CHECK(accion IN ('PERFIL','SNAPSHOT','DECISION','PREPARACION')),
  uuid_original uuid NOT NULL,
  admin_id integer NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  uuid_resolutor uuid NOT NULL,
  solicitud_hash text NOT NULL CHECK(solicitud_hash ~ '^[0-9a-f]{64}$'),
  revision_anterior text NOT NULL CHECK(revision_anterior ~ '^[0-9a-f]{64}$'),
  identidad_version text NOT NULL CHECK(identidad_version ~ '^[0-9a-f]{64}$'),
  motivo text NOT NULL CHECK(motivo=btrim(motivo) AND length(motivo) BETWEEN 1 AND 500),
  estado text NOT NULL CHECK(estado IN ('CONFIRMADA','CERRADA_SIN_EFECTO')),
  respuesta jsonb NOT NULL CHECK(jsonb_typeof(respuesta)='object'),
  created_at timestamptz NOT NULL CHECK(isfinite(created_at)), birth_xid xid8 NOT NULL,
  UNIQUE(actor_original_id,accion,uuid_original), UNIQUE(admin_id,uuid_resolutor),
  FOREIGN KEY(actor_original_id,accion,uuid_original)
    REFERENCES public.e11_operaciones(actor_id,operacion,uuid) ON DELETE RESTRICT
);
CREATE TABLE public.e11_conciliaciones (
  id uuid PRIMARY KEY, tipo text NOT NULL CHECK(tipo IN ('DIA','SEMANA','MES')),
  inicio date NOT NULL CHECK(isfinite(inicio)), revision integer NOT NULL CHECK(revision>=1),
  anterior_id uuid UNIQUE REFERENCES public.e11_conciliaciones(id),
  actor_id integer NOT NULL REFERENCES public.usuarios(id),
  perfil_version integer NOT NULL CHECK(perfil_version>=0),
  datos jsonb NOT NULL CHECK(jsonb_typeof(datos)='object'),
  birth_xid xid8 NOT NULL, UNIQUE(tipo,inicio,revision),
  CHECK((revision=1)=(anterior_id IS NULL))
);
CREATE TABLE public.e11_conciliacion_ventas (
  conciliacion_id uuid NOT NULL REFERENCES public.e11_conciliaciones(id),
  venta_id integer NOT NULL REFERENCES public.tickets(id),
  datos jsonb NOT NULL CHECK(jsonb_typeof(datos)='object'),
  birth_xid xid8 NOT NULL, PRIMARY KEY(conciliacion_id,venta_id)
);
CREATE TABLE public.e11_decisiones (
  id uuid PRIMARY KEY,
  conciliacion_id uuid NOT NULL UNIQUE REFERENCES public.e11_conciliaciones(id),
  actor_id integer NOT NULL REFERENCES public.usuarios(id),
  perfil_version integer NOT NULL CHECK(perfil_version>=0), uuid uuid NOT NULL,
  datos jsonb NOT NULL CHECK(jsonb_typeof(datos)='object'),
  created_at timestamptz NOT NULL DEFAULT now() CHECK(isfinite(created_at)),
  birth_xid xid8 NOT NULL, UNIQUE(actor_id,uuid)
);
CREATE TABLE public.e11_avisos (
  id uuid PRIMARY KEY, conciliacion_id uuid NOT NULL REFERENCES public.e11_conciliaciones(id),
  decision_id uuid NOT NULL UNIQUE REFERENCES public.e11_decisiones(id),
  birth_xid xid8 NOT NULL
);
CREATE TABLE public.e11_notificacion_origen (
  notificacion_id integer PRIMARY KEY REFERENCES public.notificaciones_sistema(id),
  birth_xid xid8 NOT NULL
);
CREATE TABLE public.e11_cambios_usuario (
  usuario_id integer NOT NULL REFERENCES public.usuarios(id), birth_xid xid8 NOT NULL,
  rol_anterior text NOT NULL, activo_anterior boolean NOT NULL,
  rol_posterior text NOT NULL, activo_posterior boolean NOT NULL,
  PRIMARY KEY(usuario_id,birth_xid)
);
CREATE TABLE public.e11_e5_preparaciones (
  clave uuid PRIMARY KEY REFERENCES public.e5_operaciones(clave),
  actor_id integer NOT NULL REFERENCES public.usuarios(id),
  cobro_id uuid NOT NULL REFERENCES public.e5_recepciones(id),
  perfil_version integer NOT NULL CHECK(perfil_version>=1),
  birth_xid xid8 NOT NULL
);
CREATE TABLE public.e11_e5_definiciones (
  firma text PRIMARY KEY, definicion text NOT NULL,
  hash_original text NOT NULL CHECK(hash_original ~ '^[0-9a-f]{64}$'),
  hash_instalado text NOT NULL CHECK(hash_instalado ~ '^[0-9a-f]{64}$')
);
-- Una alerta física por snapshot. No afecta los demás tipos de notificación.
CREATE UNIQUE INDEX e11_notificacion_unica ON public.notificaciones_sistema(entidad_id)
  WHERE tipo='E11_NO_CUADRA';

CREATE FUNCTION public.e11_closed() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'E11_DISABLED: construcción OFF, escritura nueva cerrada'; END $$;
CREATE FUNCTION public.e11_immutable() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'E11: evidencia inmutable, sin edición/borrado/truncate'; END $$;
CREATE FUNCTION public.e11_keys(j jsonb, expected text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
  SELECT coalesce(jsonb_typeof(j)='object' AND
    (SELECT array_agg(key ORDER BY key COLLATE "C") FROM jsonb_object_keys(j) k(key))=
    (SELECT array_agg(v ORDER BY v COLLATE "C") FROM unnest(expected) a(v)),false)
$$;
CREATE FUNCTION public.e11_canonical(j jsonb) RETURNS text LANGUAGE plpgsql
IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE result text; number_value numeric;
BEGIN
  IF jsonb_typeof(j)='object' THEN
    SELECT '{'||coalesce(string_agg(to_jsonb(key)::text||':'||public.e11_canonical(value),','
      ORDER BY key COLLATE "C"),'')||'}' INTO result FROM jsonb_each(j);
  ELSIF jsonb_typeof(j)='array' THEN
    SELECT '['||coalesce(string_agg(public.e11_canonical(value),',' ORDER BY n),'')||']'
      INTO result FROM jsonb_array_elements(j) WITH ORDINALITY a(value,n);
  ELSIF jsonb_typeof(j)='number' THEN
    number_value:=(j::text)::numeric;
    IF number_value<>trunc(number_value) OR number_value< -2147483648 OR number_value>2147483647
    THEN RAISE EXCEPTION 'E11: hash sólo admite números enteros contractuales int32'; END IF;
    result:=(number_value::integer)::text;
  ELSE result:=j::text;
  END IF;
  RETURN result;
END $$;
CREATE FUNCTION public.e11_hash(j jsonb) RETURNS text LANGUAGE sql IMMUTABLE
SET search_path=pg_catalog AS $$
  SELECT encode(sha256(convert_to(public.e11_canonical(j),'UTF8')),'hex')
$$;
CREATE FUNCTION public.e11_fin(tipo text, inicio date) RETURNS date LANGUAGE sql IMMUTABLE
SET search_path=pg_catalog AS $$
  SELECT CASE tipo WHEN 'DIA' THEN inicio+1 WHEN 'SEMANA' THEN inicio+7
    WHEN 'MES' THEN (inicio+interval '1 month')::date END
$$;
CREATE FUNCTION public.e11_iso(value timestamptz) RETURNS text LANGUAGE plpgsql STABLE
SET search_path=pg_catalog AS $$
BEGIN
  IF value IS NULL OR NOT isfinite(value)
    OR value<'0001-01-01T00:00:00Z'::timestamptz
    OR value>='10000-01-01T00:00:00Z'::timestamptz
  THEN RAISE EXCEPTION 'E11: instante fuera de serialización ISO contractual'; END IF;
  RETURN to_char(value AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
END $$;
-- Fuente fiscal whitelist, mismo predicado/fecha/ORDER BY del adapter.
-- Sólo se compara al congelar/decidir en esa transacción, NUNCA reescribe historia.
CREATE FUNCTION public.e11_fuente(inicio date, fin date) RETURNS jsonb LANGUAGE sql STABLE
SET search_path=pg_catalog AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'facturaId',t.id,'ventaId',t.id,'folioFactura',t.folio,
   'cliente',jsonb_build_object('clienteId',c.id,'nombre',c.nombre),
   'fechaFacturacion',public.e11_iso(CASE WHEN t.documento_tipo='TICKET' THEN t.cobrado_at ELSE t.autorizado_at END),
   'totalFacturado',t.total::text,'moneda','MXN','estado','VIGENTE') ORDER BY t.id),'[]'::jsonb)
 FROM public.tickets t JOIN public.clientes c ON c.id=t.cliente_id
 WHERE t.facturado=true AND t.estado='VENDIDO' AND
   ((t.documento_tipo='TICKET' AND t.cobrado=true) OR
    (t.documento_tipo='NOTA' AND t.autorizacion_estado='AUTORIZADA'))
   AND (CASE WHEN t.documento_tipo='TICKET' THEN t.cobrado_at ELSE t.autorizado_at END)
     >=inicio::timestamp AT TIME ZONE 'America/Mexico_City'
   AND (CASE WHEN t.documento_tipo='TICKET' THEN t.cobrado_at ELSE t.autorizado_at END)
     <fin::timestamp AT TIME ZONE 'America/Mexico_City'
$$;
CREATE FUNCTION public.e11_actor(actor integer, wanted text, ver integer DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE u record; p record;
BEGIN
  SELECT rol,activo INTO u FROM public.usuarios WHERE id=actor FOR SHARE;
  IF NOT FOUND OR NOT u.activo THEN RAISE EXCEPTION 'E11: actor no vigente'; END IF;
  IF wanted='ADMIN' THEN
    IF u.rol::text<>'ADMIN' THEN RAISE EXCEPTION 'E11: ADMIN real requerido'; END IF;
  ELSE
    SELECT perfil,version INTO p FROM public.e11_perfiles WHERE usuario_id=actor FOR SHARE;
    IF u.rol::text<>'CONTADOR' OR coalesce(p.perfil,'F')<>wanted
      OR (ver IS NOT NULL AND coalesce(p.version,0)<>ver)
    THEN RAISE EXCEPTION 'E11: perfil/version vigente requerido'; END IF;
  END IF;
END $$;
CREATE FUNCTION public.e11_before() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog AS $$
DECLARE parent_xid xid8; exclusive_lock boolean;
BEGIN
  exclusive_lock:=TG_TABLE_NAME IN ('e11_perfiles','e11_perfil_eventos');
  IF exclusive_lock THEN
    IF NOT pg_try_advisory_xact_lock(hashtextextended('E11:security',0))
    THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='E11: seguridad ocupada, abortar unidad'; END IF;
  ELSE
    IF NOT pg_try_advisory_xact_lock_shared(hashtextextended('E11:security',0))
    THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='E11: seguridad ocupada, abortar unidad'; END IF;
  END IF;
  NEW.birth_xid:=pg_current_xact_id();
  IF TG_TABLE_NAME='e11_perfiles' THEN
    PERFORM public.e11_actor(NEW.actor_id,'ADMIN');
    IF TG_OP='UPDATE' THEN
      IF NEW.usuario_id<>OLD.usuario_id OR NEW.version<>OLD.version+1
      THEN RAISE EXCEPTION 'E11: CAS perfil/version'; END IF;
    ELSIF NEW.version<>1 AND NOT EXISTS (
      SELECT 1 FROM public.e11_perfiles WHERE usuario_id=NEW.usuario_id)
    THEN RAISE EXCEPTION 'E11: versión inicial debe ser 1'; END IF;
    -- BEFORE INSERT también corre en UPSERT sobre fila existente: UPDATE
    -- posterior impone old+1. No exigir perfil/rol final antes de UPDATE usuarios.
  ELSIF TG_TABLE_NAME='e11_perfil_eventos' THEN
    PERFORM public.e11_actor(NEW.actor_id,'ADMIN');
    IF NEW.datos->>'posterior'='A' AND NOT EXISTS(SELECT 1 FROM public.usuarios u
      WHERE u.id=NEW.usuario_id AND u.activo AND u.rol::text='CONTADOR')
    THEN RAISE EXCEPTION 'E11: A sólo para CONTADOR activo al emitir'; END IF;
  ELSIF TG_TABLE_NAME IN ('e11_conciliaciones','e11_decisiones') THEN
    PERFORM public.e11_actor(NEW.actor_id,'F',NEW.perfil_version);
    IF current_setting('transaction_isolation')<>'serializable'
    THEN RAISE EXCEPTION 'E11: snapshot/decisión requiere SERIALIZABLE'; END IF;
  ELSIF TG_TABLE_NAME='e11_conciliacion_ventas' THEN
    SELECT birth_xid INTO parent_xid FROM public.e11_conciliaciones WHERE id=NEW.conciliacion_id;
    IF parent_xid IS DISTINCT FROM pg_current_xact_id()
    THEN RAISE EXCEPTION 'E11: no adjuntar ventas a snapshot histórico'; END IF;
  ELSIF TG_TABLE_NAME='e11_avisos' THEN
    SELECT birth_xid INTO parent_xid FROM public.e11_decisiones WHERE id=NEW.decision_id;
    IF parent_xid IS DISTINCT FROM pg_current_xact_id()
    THEN RAISE EXCEPTION 'E11: aviso debe nacer con decisión'; END IF;
  ELSIF TG_TABLE_NAME='e11_operaciones' THEN
    IF NEW.estado='CONFIRMADA' THEN
      PERFORM public.e11_actor(NEW.actor_id,CASE NEW.operacion WHEN 'PERFIL' THEN 'ADMIN'
        WHEN 'PREPARACION' THEN 'A' ELSE 'F' END);
    END IF;
  ELSIF TG_TABLE_NAME='e11_resoluciones' THEN
    PERFORM public.e11_actor(NEW.admin_id,'ADMIN');
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.e11_replay_lock(actor integer, action text, intention uuid, deny_closed boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtextextended('E11:'||actor::text||':'||action||':'||intention::text,0))
  THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='E11: intención concurrente; abortar unidad'; END IF;
  IF deny_closed AND EXISTS(SELECT 1 FROM public.e11_operaciones
    WHERE actor_id=actor AND operacion=action AND uuid=intention AND estado='CERRADA_SIN_EFECTO')
  THEN RAISE EXCEPTION 'E11: OPERACION_CERRADA_SIN_EFECTO'; END IF;
END $$;
CREATE FUNCTION public.e11_recovery_before() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog AS $$
BEGIN
  IF TG_TABLE_NAME='e11_resoluciones' THEN
    IF NOT pg_try_advisory_xact_lock(hashtextextended(
      'E11:resolution:'||NEW.admin_id::text||':'||NEW.uuid_resolutor::text,0))
    THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='E11: replay resolutor concurrente'; END IF;
    PERFORM public.e11_replay_lock(NEW.actor_original_id,NEW.accion,NEW.uuid_original,false);
  ELSIF TG_TABLE_NAME='e11_operaciones' THEN
    PERFORM public.e11_replay_lock(NEW.actor_id,NEW.operacion,NEW.uuid,NEW.estado='CONFIRMADA');
  ELSIF TG_TABLE_NAME='e11_perfil_eventos' THEN
    PERFORM public.e11_replay_lock(NEW.actor_id,'PERFIL',NEW.uuid);
  ELSIF TG_TABLE_NAME='e11_conciliaciones' THEN
    PERFORM public.e11_replay_lock(NEW.actor_id,'SNAPSHOT',(NEW.datos->>'uuid')::uuid);
  ELSIF TG_TABLE_NAME='e11_decisiones' THEN
    PERFORM public.e11_replay_lock(NEW.actor_id,'DECISION',NEW.uuid);
  END IF;
  IF TG_TABLE_NAME='e11_resoluciones' OR
    (TG_TABLE_NAME='e11_operaciones' AND to_jsonb(NEW)->>'estado'='CERRADA_SIN_EFECTO') THEN
    IF current_setting('transaction_isolation')<>'serializable'
    THEN RAISE EXCEPTION 'E11: recuperación requiere SERIALIZABLE'; END IF;
  END IF;
  RETURN NEW;
END $$;

-- No decisión basada sólo en ausencia. Tombstone debe tener auditoría ADMIN de
-- esta misma unidad; la PK impide coexistencia con CONFIRMADA y el grafo excluye
-- también efectos sin replay (incluida operación E5 externa). Nunca leer/copiar
-- respuesta privada original al DTO de resolución.
CREATE FUNCTION public.e11_recovery_check() RETURNS void LANGUAGE plpgsql
SET search_path=pg_catalog AS $$
DECLARE r record; o record; metadata jsonb; target jsonb; previous jsonb; expected jsonb;
BEGIN
  FOR o IN SELECT * FROM public.e11_operaciones WHERE estado='CERRADA_SIN_EFECTO' LOOP
    IF NOT EXISTS(SELECT 1 FROM public.e11_resoluciones r
      WHERE r.actor_original_id=o.actor_id AND r.accion=o.operacion AND r.uuid_original=o.uuid
        AND r.estado=o.estado AND r.birth_xid=o.birth_xid
        AND r.solicitud_hash=o.solicitud_hash AND r.respuesta=o.respuesta)
    THEN RAISE EXCEPTION 'E11: tombstone sin resolución ADMIN propia'; END IF;
    IF (o.operacion='PERFIL' AND EXISTS(SELECT 1 FROM public.e11_perfil_eventos
          WHERE actor_id=o.actor_id AND uuid=o.uuid))
      OR (o.operacion='SNAPSHOT' AND EXISTS(SELECT 1 FROM public.e11_conciliaciones
          WHERE actor_id=o.actor_id AND (datos->>'uuid')::uuid=o.uuid))
      OR (o.operacion='DECISION' AND EXISTS(SELECT 1 FROM public.e11_decisiones
          WHERE actor_id=o.actor_id AND uuid=o.uuid))
      OR (o.operacion='PREPARACION' AND EXISTS(SELECT 1 FROM public.e5_operaciones
          WHERE actor_id=o.actor_id AND clave=o.uuid AND accion='PROPONER'))
      OR (o.operacion='PREPARACION' AND EXISTS(SELECT 1 FROM public.e11_e5_preparaciones
          WHERE actor_id=o.actor_id AND clave=o.uuid))
    THEN RAISE EXCEPTION 'E11: tombstone incompatible con efecto; conservar evidencia'; END IF;
  END LOOP;
  FOR r IN SELECT * FROM public.e11_resoluciones LOOP
    SELECT * INTO o FROM public.e11_operaciones
      WHERE actor_id=r.actor_original_id AND operacion=r.accion AND uuid=r.uuid_original;
    IF NOT FOUND OR o.estado<>r.estado
    THEN RAISE EXCEPTION 'E11: resolución sin operación terminal compatible'; END IF;
    target:=jsonb_build_object('actorId',r.actor_original_id,'accion',r.accion,'uuidOriginal',r.uuid_original::text);
    metadata:=target||jsonb_build_object('estado',r.estado,'resolucionId',r.id::text,
      'resueltoEn',public.e11_iso(r.created_at));
    expected:=metadata||jsonb_build_object('revision',public.e11_hash(metadata));
    previous:=target||jsonb_build_object('estado',CASE WHEN r.estado='CONFIRMADA'
      THEN 'CONFIRMADA' ELSE 'PENDIENTE' END,'resolucionId',NULL,'resueltoEn',NULL);
    IF r.respuesta IS DISTINCT FROM expected OR r.revision_anterior<>public.e11_hash(previous)
      OR r.solicitud_hash<>public.e11_hash(jsonb_build_object('target',target,'input',
        jsonb_build_object('uuid',r.uuid_resolutor::text,'revisionEsperada',r.revision_anterior,
          'identidadVersion',r.identidad_version,'motivo',r.motivo)))
    THEN RAISE EXCEPTION 'E11: resolución metadata/CAS/hash no contractual'; END IF;
    -- identidad_version es el hash opaco entregado por backend; no inventar
    -- sesión ni derivación alternativa en SQL. ADMIN real se exige al INSERT.
    -- No reautorizar ese ADMIN histórico después de revocarlo.
  END LOOP;
END $$;

-- Sólo eventos originados por triggers de tablas reales pueden dar procedencia.
CREATE FUNCTION public.e11_technical_insert() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog AS $$
BEGIN
  IF pg_trigger_depth()<>2 THEN RAISE EXCEPTION 'E11: procedencia no suministrable'; END IF;
  NEW.birth_xid:=pg_current_xact_id(); RETURN NEW;
END $$;
CREATE FUNCTION public.e11_user_change() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog AS $$
BEGIN
  IF (NEW.rol IS DISTINCT FROM OLD.rol OR NEW.activo IS DISTINCT FROM OLD.activo)
    AND (OLD.rol::text='CONTADOR' OR NEW.rol::text='CONTADOR')
    AND EXISTS (SELECT 1 FROM public.e11_perfiles WHERE usuario_id=NEW.id)
  THEN
    IF NOT pg_try_advisory_xact_lock(hashtextextended('E11:security',0))
    THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='E11: revocación concurrente'; END IF;
    INSERT INTO public.e11_cambios_usuario VALUES
      (NEW.id,pg_current_xact_id(),OLD.rol::text,OLD.activo,NEW.rol::text,NEW.activo);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER e11_user_change AFTER UPDATE OF rol,activo ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.e11_user_change();
CREATE FUNCTION public.e11_notification() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.tipo='E11_NO_CUADRA' THEN
      INSERT INTO public.e11_notificacion_origen VALUES(NEW.id,pg_current_xact_id());
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.tipo='E11_NO_CUADRA' OR (TG_OP='UPDATE' AND NEW.tipo='E11_NO_CUADRA') THEN
    IF TG_OP='DELETE' OR (to_jsonb(OLD)-'leida_at') IS DISTINCT FROM (to_jsonb(NEW)-'leida_at')
    THEN RAISE EXCEPTION 'E11: notificación inmutable salvo marca de lectura'; END IF;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER e11_notification_birth AFTER INSERT ON public.notificaciones_sistema
FOR EACH ROW EXECUTE FUNCTION public.e11_notification();
CREATE TRIGGER e11_notification_immutable BEFORE UPDATE OR DELETE ON public.notificaciones_sistema
FOR EACH ROW EXECUTE FUNCTION public.e11_notification();

-- Early gate: E5 guarda agregado ANTES de INSERT operación; replay E11 llega
-- DESPUÉS. Aquí NO exigir ese replay todavía. El grafo lo exige al finalizar.
-- j es to_jsonb(NEW) de la operación real, no body HTTP ni sesión/GUC.
CREATE FUNCTION public.e11_e5_a_validate(j jsonb, at_insert boolean) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE body jsonb; proposal jsonb; previous jsonb; r record; part jsonb; note jsonb;
  v integer; total numeric:=0; key_value uuid; actor integer; source_id uuid;
BEGIN
  body:=(j->>'content')::jsonb; key_value:=(j->>'clave')::uuid;
  actor:=(j->>'actor_id')::integer; source_id:=(j->>'cobro_id')::uuid;
  proposal:=j->'response'->'propuestas'->-1;
  IF j->>'accion' IS DISTINCT FROM 'PROPONER'
    OR j->>'content' IS DISTINCT FROM public.e11_canonical(body)
    OR NOT public.e11_keys(body,ARRAY['action','id','input'])
    OR NOT public.e11_keys(body->'input',ARRAY['claveOperacion','revisionEsperada','versionContexto','asignaciones','evidencia'])
    OR body->>'action' IS DISTINCT FROM 'PROPONER' OR body->>'id' IS DISTINCT FROM source_id::text
    OR body#>>'{input,claveOperacion}' IS DISTINCT FROM key_value::text
    OR body#>>'{input,evidencia,descripcion}' IS DISTINCT FROM
      'Preparación E11 por perfil A explícito; no aplicación.'
    OR NOT public.e11_keys(body#>'{input,evidencia}',ARRAY['descripcion','referencias'])
    OR jsonb_typeof(body#>'{input,evidencia,referencias}') IS DISTINCT FROM 'array'
    OR jsonb_array_length(body#>'{input,evidencia,referencias}')<>1
    OR coalesce(body#>>'{input,evidencia,referencias,0}','') !~
      '^E11:[0-9a-fA-F-]{36}:perfil:[1-9][0-9]*$'
  THEN RAISE EXCEPTION 'E11/E5: sólo cuerpo real de preparación A, sin favor ni facultades dinero'; END IF;
  IF split_part(body#>>'{input,evidencia,referencias,0}',':',2)::uuid IS DISTINCT FROM key_value
  THEN RAISE EXCEPTION 'E11/E5: referencia debe nombrar la misma intención'; END IF;
  v:=split_part(body#>>'{input,evidencia,referencias,0}',':',4)::integer;
  SELECT * INTO r FROM public.e5_recepciones WHERE id=source_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'E11/E5: recepción real requerida'; END IF;
  SELECT response INTO previous FROM public.e5_operaciones
    WHERE cobro_id=source_id AND revision=(j->>'revision')::integer-1;
  IF previous IS NULL OR (body#>>'{input,revisionEsperada}')::integer IS DISTINCT FROM
      (j->>'revision')::integer-1
    OR j->'response'->>'id' IS DISTINCT FROM source_id::text
    OR (j->'response'->>'clienteId')::integer IS DISTINCT FROM r.cliente_id
    OR (j->'response'->>'ubicacionId')::integer IS DISTINCT FROM r.ubicacion_id
    OR (j->'response'->>'importePendiente')::numeric<=0
    OR j->'response'->>'estado' NOT IN ('PENDIENTE','PARCIAL')
    OR ((j->'response')-ARRAY['revision','propuestas','propuestaVigenteId'])
      IS DISTINCT FROM (previous-ARRAY['revision','propuestas','propuestaVigenteId'])
    OR jsonb_array_length(j->'response'->'propuestas')<>jsonb_array_length(previous->'propuestas')+1
    OR ((j->'response'->'propuestas')-(jsonb_array_length(j->'response'->'propuestas')-1))
      IS DISTINCT FROM previous->'propuestas'
    OR j->'response'->>'propuestaVigenteId' IS DISTINCT FROM proposal->>'id'
    OR (proposal#>>'{actor,id}')::integer IS DISTINCT FROM actor
    OR (proposal->>'importeFavorPropuesto')::numeric IS DISTINCT FROM 0::numeric
    OR proposal->'asignaciones' IS DISTINCT FROM body#>'{input,asignaciones}'
    OR proposal->'evidencia' IS DISTINCT FROM body#>'{input,evidencia}'
    OR jsonb_typeof(proposal->'asignaciones') IS DISTINCT FROM 'array'
    OR jsonb_array_length(proposal->'asignaciones')=0
    OR jsonb_typeof(proposal->'notas') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'E11/E5: propuesta/cobro/cliente/CAS/conservación incompatibles'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(proposal->'asignaciones'))<>
    (SELECT count(DISTINCT value->>'notaId') FROM jsonb_array_elements(proposal->'asignaciones'))
    OR (SELECT count(*) FROM jsonb_array_elements(proposal->'asignaciones'))<>
    (SELECT count(DISTINCT value->>'movimientoVentaId') FROM jsonb_array_elements(proposal->'asignaciones'))
  THEN RAISE EXCEPTION 'E11/E5: nota o movimiento duplicado'; END IF;
  FOR part IN SELECT value FROM jsonb_array_elements(proposal->'asignaciones') LOOP
    IF NOT public.e11_keys(part,ARRAY['notaId','movimientoVentaId','importe'])
      OR coalesce(part->>'importe','') !~ '^(0|[1-9][0-9]*)\.[0-9]{2}$'
      OR (part->>'importe')::numeric<=0
    THEN RAISE EXCEPTION 'E11/E5: asignación positiva exacta requerida'; END IF;
    SELECT value INTO note FROM jsonb_array_elements(proposal->'notas')
      WHERE value->>'movimientoVentaId'=part->>'movimientoVentaId'
        AND value->>'notaId'=part->>'notaId';
    IF note IS NULL OR coalesce(note->>'saldoPendiente','') !~ '^(0|[1-9][0-9]*)\.[0-9]{2}$'
      OR (part->>'importe')::numeric>(note->>'saldoPendiente')::numeric
    THEN RAISE EXCEPTION 'E11/E5: asignación excede contexto canónico congelado'; END IF;
    total:=total+(part->>'importe')::numeric;
    IF (j->>'birth_xid')::xid8=pg_current_xact_id() AND NOT EXISTS (SELECT 1 FROM public.movimientos_credito m
      JOIN public.tickets t ON t.id=m.ticket_id
      WHERE m.id=(part->>'movimientoVentaId')::integer AND m.ticket_id=(part->>'notaId')::integer
        AND m.cliente_id=r.cliente_id AND m.tipo::text='VENTA_CREDITO' AND NOT m.es_incobrable
        AND t.cliente_id=r.cliente_id AND t.documento_tipo='NOTA'
        AND t.estado='VENDIDO' AND t.autorizacion_estado='AUTORIZADA')
    THEN RAISE EXCEPTION 'E11/E5: destino financiero ajeno/no autorizado'; END IF;
  END LOOP;
  IF total>(j->'response'->>'importePendiente')::numeric
  THEN RAISE EXCEPTION 'E11/E5: propuesta excede retenido'; END IF;
  IF at_insert THEN
    PERFORM public.e11_replay_lock(actor,'PREPARACION',key_value);
    IF (j->>'birth_xid')::xid8 IS DISTINCT FROM pg_current_xact_id()
    THEN RAISE EXCEPTION 'E11/E5: operación requiere INSERT propio'; END IF;
    IF NOT pg_try_advisory_xact_lock_shared(hashtextextended('E11:security',0))
    THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='E11/E5: seguridad ocupada, abortar unidad'; END IF;
    PERFORM public.e11_actor(actor,'A',v);
    IF current_setting('transaction_isolation')<>'serializable'
    THEN RAISE EXCEPTION 'E11/E5: preparación requiere SERIALIZABLE'; END IF;
  END IF;
  IF (j->>'birth_xid')::xid8=pg_current_xact_id() THEN
    IF NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=r.cliente_id AND activo AND NOT es_sistema)
      OR NOT EXISTS(SELECT 1 FROM public.ubicaciones WHERE id=r.ubicacion_id AND activa AND tipo='TIENDA')
      OR NOT EXISTS(SELECT 1 FROM public.e5_cobros WHERE id=source_id AND detail=j->'response')
    THEN RAISE EXCEPTION 'E11/E5: alcance financiero/aggregate real requerido'; END IF;
    -- La revalidación de saldos/versionContexto la hace el proyector canónico
    -- E5 bajo CUSTOMER_CREDIT; no reconstruir FIFO con evidencia histórica.
    -- Esta unidad de preparación no puede insertar ledger antes NI después
    -- del sello IMMEDIATE para ese cliente; reencola también movimientos.
    IF EXISTS(SELECT 1 FROM public.movimientos_credito m JOIN public.e5_nacimientos b
      ON b.tabla='movimientos_credito' AND b.clave=m.id::text
      WHERE m.cliente_id=r.cliente_id AND b.birth_xid=pg_current_xact_id())
    THEN RAISE EXCEPTION 'E11/E5: preparación no admite escritura monetaria en su unidad'; END IF;
  END IF;
END $$;
CREATE FUNCTION public.e11_e5_capture() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog AS $$
DECLARE version_value integer;
BEGIN
  IF NEW.accion='PROPONER' AND EXISTS(SELECT 1 FROM public.usuarios
    WHERE id=NEW.actor_id AND rol::text='CONTADOR') THEN
    PERFORM public.e11_e5_a_validate(to_jsonb(NEW),true);
    version_value:=split_part((NEW.content::jsonb)#>>'{input,evidencia,referencias,0}',':',4)::integer;
    INSERT INTO public.e11_e5_preparaciones VALUES
      (NEW.clave,NEW.actor_id,NEW.cobro_id,version_value,pg_current_xact_id());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER e11_e5_capture AFTER INSERT ON public.e5_operaciones
FOR EACH ROW EXECUTE FUNCTION public.e11_e5_capture();

CREATE FUNCTION public.e11_graph() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog AS $$
DECLARE p record; e record; s record; d record; a record; o record; prev record;
  j jsonb; rows_json jsonb; actual jsonb; end_date date; total numeric; n bigint; linked boolean;
BEGIN
  PERFORM public.e11_recovery_check();
  FOR p IN SELECT * FROM public.e11_perfiles LOOP
    SELECT * INTO e FROM public.e11_perfil_eventos WHERE usuario_id=p.usuario_id AND revision=p.version;
    IF NOT FOUND OR e.actor_id<>p.actor_id OR e.birth_xid<>p.birth_xid
      OR e.datos->>'posterior' IS DISTINCT FROM p.perfil
      OR (e.datos->>'creadoEn')::timestamptz IS DISTINCT FROM p.updated_at
      OR (SELECT count(*) FROM public.e11_perfil_eventos WHERE usuario_id=p.usuario_id)<>p.version
    THEN RAISE EXCEPTION 'E11: perfil sin cadena de eventos/CAS'; END IF;
    IF EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id=p.usuario_id AND
      (((u.rol::text<>'CONTADOR' OR NOT u.activo) AND p.perfil IS NOT NULL)
      OR (u.rol::text='CONTADOR' AND u.activo AND p.perfil IS NULL)))
    THEN RAISE EXCEPTION 'E11: perfil debe revocarse al salir/desactivar'; END IF;
  END LOOP;
  FOR e IN SELECT * FROM public.e11_perfil_eventos LOOP
    j:=e.datos;
    IF NOT public.e11_keys(j,ARRAY['id','uuid','usuarioId','actorId','anterior','posterior','revision','motivo','creadoEn'])
      OR (j->>'id')::uuid IS DISTINCT FROM e.id OR (j->>'uuid')::uuid IS DISTINCT FROM e.uuid
      OR (j->>'usuarioId')::integer IS DISTINCT FROM e.usuario_id
      OR (j->>'actorId')::integer IS DISTINCT FROM e.actor_id
      OR (j->>'revision')::integer IS DISTINCT FROM e.revision
      OR nullif(btrim(j->>'motivo'),'') IS NULL
      OR NOT isfinite((j->>'creadoEn')::timestamptz)
      OR coalesce(j->>'posterior','F') NOT IN ('A','F')
      OR NOT EXISTS (SELECT 1 FROM public.e11_perfiles WHERE usuario_id=e.usuario_id AND version>=e.revision)
    THEN RAISE EXCEPTION 'E11: evento perfil inválido'; END IF;
    IF e.revision>1 THEN
      SELECT * INTO prev FROM public.e11_perfil_eventos WHERE usuario_id=e.usuario_id AND revision=e.revision-1;
      -- Adapter usa F al normalizar null de un perfil CONTADOR; sólo tolerar
      -- esa normalización en reactivación real registrada, nunca para resucitar A.
      IF NOT FOUND OR (j->'anterior' IS DISTINCT FROM prev.datos->'posterior'
        AND NOT (prev.datos->'posterior'='null'::jsonb AND j->>'anterior'='F'
          AND EXISTS (SELECT 1 FROM public.e11_cambios_usuario c
            WHERE c.usuario_id=e.usuario_id AND c.birth_xid=e.birth_xid
              AND c.rol_anterior='CONTADOR')))
      THEN RAISE EXCEPTION 'E11: anterior no corresponde a historia'; END IF;
    ELSIF j->'anterior' NOT IN ('"F"'::jsonb,'null'::jsonb) THEN
      RAISE EXCEPTION 'E11: primer evento parte de F virtual o rol no contador';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.e11_operaciones op WHERE op.operacion='PERFIL'
      AND op.actor_id=e.actor_id AND op.uuid=e.uuid AND op.respuesta=e.datos AND op.birth_xid=e.birth_xid)
      AND NOT EXISTS (SELECT 1 FROM public.e11_cambios_usuario c
        WHERE c.usuario_id=e.usuario_id AND c.birth_xid=e.birth_xid
          AND j->>'posterior' IS NOT DISTINCT FROM
            CASE WHEN c.rol_posterior='CONTADOR' AND c.activo_posterior THEN 'F' ELSE NULL END)
    THEN RAISE EXCEPTION 'E11: evento sin asignación ADMIN/revocación real'; END IF;
    IF e.revision=1 AND EXISTS (SELECT 1 FROM public.e11_operaciones op
      WHERE op.operacion='PERFIL' AND op.actor_id=e.actor_id AND op.uuid=e.uuid)
      AND j->'anterior' IS DISTINCT FROM '"F"'::jsonb
    THEN RAISE EXCEPTION 'E11: primera asignación parte del default F virtual'; END IF;
  END LOOP;
  FOR a IN SELECT * FROM public.e11_cambios_usuario LOOP
    IF NOT EXISTS (SELECT 1 FROM public.e11_perfil_eventos e WHERE e.usuario_id=a.usuario_id
      AND e.birth_xid=a.birth_xid AND e.datos->>'posterior' IS NOT DISTINCT FROM
        CASE WHEN a.rol_posterior='CONTADOR' AND a.activo_posterior THEN 'F' ELSE NULL END)
    THEN RAISE EXCEPTION 'E11: cambio usuario sin revocación/version nueva'; END IF;
  END LOOP;
  FOR s IN SELECT * FROM public.e11_conciliaciones LOOP
    j:=s.datos; end_date:=public.e11_fin(s.tipo,s.inicio);
    IF NOT public.e11_keys(j,ARRAY['id','uuid','periodo','revision','anteriorId','fuenteRevision',
      'vigente','congeladoEn','actorId','totalFacturado','cantidadVentas','evidenciaHash','decisiones'])
      OR NOT public.e11_keys(j->'periodo',ARRAY['tipo','inicio','finExclusivo','zona','obligatorio','estado','ultimaConciliacionId'])
      OR j->>'id' IS DISTINCT FROM s.id::text OR (j->>'revision')::integer IS DISTINCT FROM s.revision
      OR (j->>'actorId')::integer IS DISTINCT FROM s.actor_id
      OR j->>'anteriorId' IS DISTINCT FROM s.anterior_id::text
      OR j#>>'{periodo,tipo}' IS DISTINCT FROM s.tipo
      OR j#>>'{periodo,inicio}' IS DISTINCT FROM to_char(s.inicio,'YYYY-MM-DD')
      OR j#>>'{periodo,finExclusivo}' IS DISTINCT FROM to_char(end_date,'YYYY-MM-DD')
      OR j#>>'{periodo,zona}' IS DISTINCT FROM 'America/Mexico_City'
      OR (j#>>'{periodo,obligatorio}')::boolean IS DISTINCT FROM (s.tipo<>'DIA')
      OR j#>>'{periodo,estado}' IS DISTINCT FROM 'CONGELADO'
      OR j#>>'{periodo,ultimaConciliacionId}' IS DISTINCT FROM s.id::text
      OR j->'decisiones' IS DISTINCT FROM '[]'::jsonb OR j->'vigente' IS DISTINCT FROM 'true'::jsonb
      OR (s.tipo='SEMANA' AND extract(isodow FROM s.inicio)<>1)
      OR (s.tipo='MES' AND extract(day FROM s.inicio)<>1)
      OR end_date::timestamp AT TIME ZONE 'America/Mexico_City'>(j->>'congeladoEn')::timestamptz
      OR coalesce(j->>'evidenciaHash','') !~ '^[0-9a-f]{64}$'
      OR j->>'fuenteRevision' IS DISTINCT FROM j->>'evidenciaHash'
      OR NOT isfinite((j->>'congeladoEn')::timestamptz)
    THEN RAISE EXCEPTION 'E11: snapshot/calendario/whitelist inválido'; END IF;
    IF s.revision>1 AND NOT EXISTS (SELECT 1 FROM public.e11_conciliaciones parent
      WHERE parent.id=s.anterior_id AND parent.tipo=s.tipo AND parent.inicio=s.inicio AND parent.revision=s.revision-1)
    THEN RAISE EXCEPTION 'E11: revisión sin predecesor exacto'; END IF;
    SELECT coalesce(jsonb_agg(datos ORDER BY venta_id),'[]'::jsonb),count(*),
      coalesce(sum((datos->>'totalFacturado')::numeric),0) INTO rows_json,n,total
      FROM public.e11_conciliacion_ventas WHERE conciliacion_id=s.id;
    IF n IS DISTINCT FROM (j->>'cantidadVentas')::bigint
      OR total IS DISTINCT FROM (j->>'totalFacturado')::numeric
      OR public.e11_hash(rows_json) IS DISTINCT FROM j->>'evidenciaHash'
      OR EXISTS (SELECT 1 FROM public.e11_conciliacion_ventas
        WHERE conciliacion_id=s.id AND birth_xid<>s.birth_xid)
    THEN RAISE EXCEPTION 'E11: snapshot requiere conjunto completo congelado'; END IF;
    IF s.birth_xid=pg_current_xact_id() THEN
      IF end_date::timestamp AT TIME ZONE 'America/Mexico_City'>clock_timestamp()
        OR rows_json IS DISTINCT FROM public.e11_fuente(s.inicio,end_date)
      THEN RAISE EXCEPTION 'E11: periodo abierto/fuente modificada al congelar'; END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.e11_operaciones op WHERE op.actor_id=s.actor_id
      AND op.operacion='SNAPSHOT' AND op.uuid=(j->>'uuid')::uuid AND op.respuesta=j AND op.birth_xid=s.birth_xid)
    THEN RAISE EXCEPTION 'E11: snapshot sin replay propio'; END IF;
  END LOOP;
  FOR a IN SELECT * FROM public.e11_conciliacion_ventas LOOP
    j:=a.datos;
    IF NOT public.e11_keys(j,ARRAY['facturaId','ventaId','folioFactura','cliente','fechaFacturacion','totalFacturado','moneda','estado'])
      OR NOT public.e11_keys(j->'cliente',ARRAY['clienteId','nombre'])
      OR (j->>'ventaId')::integer IS DISTINCT FROM a.venta_id
      OR (j->>'facturaId')::integer IS DISTINCT FROM a.venta_id
      OR j->>'moneda' IS DISTINCT FROM 'MXN' OR j->>'estado' IS DISTINCT FROM 'VIGENTE'
      OR coalesce(j->>'totalFacturado','') !~ '^[0-9]+\.[0-9]{2}$'
    THEN RAISE EXCEPTION 'E11: venta congelada fuera de whitelist'; END IF;
  END LOOP;
  FOR d IN SELECT * FROM public.e11_decisiones LOOP
    SELECT * INTO s FROM public.e11_conciliaciones WHERE id=d.conciliacion_id;
    j:=d.datos;
    IF NOT public.e11_keys(j,ARRAY['id','uuid','actorId','creadoEn','resultado','totalExterno','referenciaExterna','observacion','avisoAdminId'])
      OR (j->>'id')::uuid IS DISTINCT FROM d.id OR (j->>'uuid')::uuid IS DISTINCT FROM d.uuid
      OR (j->>'actorId')::integer IS DISTINCT FROM d.actor_id
      OR coalesce(j->>'resultado','') NOT IN ('ACEPTADA','NO_CUADRA')
      OR coalesce(j->>'totalExterno','') !~ '^[0-9]+\.[0-9]{2}$'
      OR nullif(btrim(j->>'referenciaExterna'),'') IS NULL
      OR (j->>'creadoEn')::timestamptz<(s.datos->>'congeladoEn')::timestamptz
    THEN RAISE EXCEPTION 'E11: decisión inválida'; END IF;
    IF j->>'resultado'='ACEPTADA' THEN
      IF (j->>'totalExterno')::numeric<>(s.datos->>'totalFacturado')::numeric
        OR j->'avisoAdminId' IS DISTINCT FROM 'null'::jsonb
        OR EXISTS(SELECT 1 FROM public.e11_avisos WHERE decision_id=d.id)
      THEN RAISE EXCEPTION 'E11: aceptación no coincide/aviso impropio'; END IF;
    ELSE
      IF nullif(btrim(j->>'observacion'),'') IS NULL OR NOT EXISTS(
        SELECT 1 FROM public.e11_avisos a WHERE a.id=(j->>'avisoAdminId')::uuid
          AND a.decision_id=d.id AND a.conciliacion_id=d.conciliacion_id AND a.birth_xid=d.birth_xid)
      THEN RAISE EXCEPTION 'E11: discrepancia requiere aviso ADMIN atómico'; END IF;
    END IF;
    IF d.birth_xid=pg_current_xact_id() THEN
      IF EXISTS(SELECT 1 FROM public.e11_conciliaciones later
        WHERE later.tipo=s.tipo AND later.inicio=s.inicio AND later.revision>s.revision)
        OR public.e11_hash(public.e11_fuente(s.inicio,public.e11_fin(s.tipo,s.inicio)))<>s.datos->>'fuenteRevision'
      THEN RAISE EXCEPTION 'E11: decisión obsoleta/FUENTE_CAMBIADA'; END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.e11_operaciones op WHERE op.operacion='DECISION'
      AND op.actor_id=d.actor_id AND op.uuid=d.uuid AND op.birth_xid=d.birth_xid
      AND op.respuesta=jsonb_set(jsonb_set(s.datos,'{decisiones}',jsonb_build_array(d.datos)),
        '{periodo,estado}',d.datos->'resultado'))
    THEN RAISE EXCEPTION 'E11: decisión sin replay propio'; END IF;
  END LOOP;
  FOR a IN SELECT * FROM public.e11_avisos LOOP
    IF NOT EXISTS (SELECT 1 FROM public.e11_decisiones d WHERE d.id=a.decision_id
      AND d.conciliacion_id=a.conciliacion_id AND d.datos->>'resultado'='NO_CUADRA'
      AND d.datos->>'avisoAdminId'=a.id::text AND d.birth_xid=a.birth_xid)
      OR NOT EXISTS (SELECT 1 FROM public.notificaciones_sistema n
        JOIN public.e11_notificacion_origen b ON b.notificacion_id=n.id
        WHERE n.tipo='E11_NO_CUADRA' AND n.entidad='e11_conciliaciones'
          AND n.entidad_id=a.conciliacion_id::text AND n.destinatario_usuario_id IS NULL
          AND n.prioridad='ALTA' AND n.titulo='Conciliación facturada no cuadra'
          AND n.mensaje='Revisar /contabilidad/conciliaciones/'||a.conciliacion_id::text
          AND b.birth_xid=a.birth_xid)
    THEN RAISE EXCEPTION 'E11: aviso/decisión/notificación no coherentes'; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.notificaciones_sistema n WHERE n.tipo='E11_NO_CUADRA'
    AND NOT EXISTS(SELECT 1 FROM public.e11_avisos a WHERE a.conciliacion_id::text=n.entidad_id))
  THEN RAISE EXCEPTION 'E11: notificación huérfana'; END IF;
  FOR o IN SELECT * FROM public.e11_operaciones LOOP
    IF o.estado='CERRADA_SIN_EFECTO' THEN CONTINUE; END IF;
    IF o.operacion='PERFIL' AND NOT EXISTS(SELECT 1 FROM public.e11_perfil_eventos e
      WHERE e.actor_id=o.actor_id AND e.uuid=o.uuid AND e.datos=o.respuesta AND e.birth_xid=o.birth_xid)
      OR o.operacion='SNAPSHOT' AND NOT EXISTS(SELECT 1 FROM public.e11_conciliaciones s
        WHERE s.actor_id=o.actor_id AND s.datos=o.respuesta AND s.birth_xid=o.birth_xid
          AND (s.datos->>'uuid')::uuid=o.uuid)
      OR o.operacion='DECISION' AND NOT EXISTS(SELECT 1 FROM public.e11_decisiones d
        WHERE d.actor_id=o.actor_id AND d.uuid=o.uuid AND d.birth_xid=o.birth_xid
          AND o.respuesta->>'id'=d.conciliacion_id::text
          AND o.respuesta->'decisiones'=jsonb_build_array(d.datos))
    THEN RAISE EXCEPTION 'E11: replay sin efecto correspondiente'; END IF;
    IF o.operacion='PREPARACION' THEN
      IF NOT public.e11_keys(o.respuesta,ARRAY['cobroId','clienteId','revision','fuenteRevision','retenido','notas','propuestaId'])
        OR jsonb_typeof(o.respuesta->'notas') IS DISTINCT FROM 'array'
        OR coalesce(o.respuesta->>'retenido','') !~ '^[0-9]+\.[0-9]{2}$'
        OR to_regclass('public.e5_operaciones') IS NULL
      THEN RAISE EXCEPTION 'E11: preparación sin whitelist/dependencia E5'; END IF;
      FOR j IN SELECT value FROM jsonb_array_elements(o.respuesta->'notas') LOOP
        IF NOT public.e11_keys(j,ARRAY['notaId','movimientoVentaId','folio','clienteId','fecha','facturada','total','saldo'])
        THEN RAISE EXCEPTION 'E11: nota de preparación fuera de whitelist'; END IF;
      END LOOP;
      -- Nombres constantes y parámetros USING; E5 alineado es prerrequisito
      -- explícito de esta versión preparada con extensión A.
      EXECUTE $query$
        SELECT EXISTS(SELECT 1 FROM public.e5_operaciones p
          WHERE p.clave=$1 AND p.actor_id=$2 AND p.accion='PROPONER'
            AND p.cobro_id::text=$3->>'cobroId'
            AND p.response->>'clienteId'=$3->>'clienteId'
            AND p.response->>'revision'=$3->>'revision'
            AND p.response->>'importePendiente'=$3->>'retenido'
            AND p.response->>'propuestaVigenteId'=$3->>'propuestaId'
            AND coalesce((p.response->'propuestas'->-1->>'importeFavorPropuesto')::numeric,0)=0
            AND p.birth_xid=$4)
      $query$ INTO linked USING o.uuid,o.actor_id,o.respuesta,o.birth_xid;
      IF NOT linked THEN RAISE EXCEPTION 'E11: replay sin propuesta real E5 propia, sin favor'; END IF;
      IF NOT EXISTS(SELECT 1 FROM public.e11_e5_preparaciones w
        WHERE w.clave=o.uuid AND w.actor_id=o.actor_id AND w.birth_xid=o.birth_xid)
      THEN RAISE EXCEPTION 'E11: preparación sin testigo de actor A al INSERT'; END IF;
    END IF;
  END LOOP;
  FOR a IN SELECT * FROM public.e11_e5_preparaciones LOOP
    SELECT to_jsonb(p) INTO actual FROM public.e5_operaciones p WHERE p.clave=a.clave;
    IF actual IS NULL OR (actual->>'actor_id')::integer IS DISTINCT FROM a.actor_id
      OR (actual->>'cobro_id')::uuid IS DISTINCT FROM a.cobro_id
      OR (actual->>'birth_xid')::xid8 IS DISTINCT FROM a.birth_xid
    THEN RAISE EXCEPTION 'E11/E5: testigo sin operación propia'; END IF;
    -- Probar la historia, NO volver a exigir que el autor siga siendo A.
    -- Autoridad se exigió en e5_insert_authority y e11_e5_capture.
    PERFORM public.e11_e5_a_validate(actual,false);
    j:=(actual->>'content')::jsonb;
    IF split_part(j#>>'{input,evidencia,referencias,0}',':',4)::integer<>a.perfil_version
      OR NOT EXISTS(SELECT 1 FROM public.e11_operaciones op
        WHERE op.operacion='PREPARACION' AND op.actor_id=a.actor_id AND op.uuid=a.clave
          AND op.birth_xid=a.birth_xid
          AND op.respuesta->>'fuenteRevision'=j#>>'{input,versionContexto}'
          AND op.solicitud_hash=public.e11_hash(jsonb_build_object('id',a.cobro_id::text,
            'input',jsonb_build_object('uuid',split_part(j#>>'{input,evidencia,referencias,0}',':',2),'perfilVersion',a.perfil_version,
              'revisionEsperada',(j#>>'{input,revisionEsperada}')::integer,
              'fuenteRevision',j#>>'{input,versionContexto}','asignaciones',j#>'{input,asignaciones}'))))
    THEN RAISE EXCEPTION 'E11/E5: replay propio/versión/cuerpo real no coinciden'; END IF;
  END LOOP;
  RETURN NULL;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['e11_perfiles','e11_perfil_eventos','e11_operaciones','e11_conciliaciones',
    'e11_conciliacion_ventas','e11_decisiones','e11_avisos','e11_resoluciones'] LOOP
    EXECUTE format('CREATE TRIGGER e11_closed BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.e11_closed()',t);
    EXECUTE format('CREATE TRIGGER e11_before BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.e11_before()',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['e11_operaciones','e11_resoluciones','e11_perfil_eventos',
    'e11_conciliaciones','e11_decisiones'] LOOP
    EXECUTE format('CREATE TRIGGER e11_recovery_before BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.e11_recovery_before()',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['e11_notificacion_origen','e11_cambios_usuario','e11_e5_preparaciones'] LOOP
    EXECUTE format('CREATE TRIGGER e11_technical_insert BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.e11_technical_insert()',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['e11_perfil_eventos','e11_operaciones','e11_conciliaciones',
    'e11_conciliacion_ventas','e11_decisiones','e11_avisos','e11_notificacion_origen','e11_cambios_usuario',
    'e11_e5_preparaciones','e11_e5_definiciones','e11_resoluciones'] LOOP
    EXECUTE format('CREATE TRIGGER e11_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.e11_immutable()',t);
  END LOOP;
  CREATE TRIGGER e11_profile_no_delete BEFORE DELETE ON public.e11_perfiles FOR EACH ROW EXECUTE FUNCTION public.e11_immutable();
  FOREACH t IN ARRAY ARRAY['e11_perfiles','e11_perfil_eventos','e11_operaciones','e11_conciliaciones',
    'e11_conciliacion_ventas','e11_decisiones','e11_avisos','e11_notificacion_origen','e11_cambios_usuario','e11_e5_preparaciones','e11_resoluciones',
    'usuarios','tickets','clientes','ubicaciones','notificaciones_sistema','movimientos_credito',
    'e5_operaciones','e5_cobros','e5_nacimientos'] LOOP
    EXECUTE format('CREATE CONSTRAINT TRIGGER e11_graph AFTER INSERT OR UPDATE OR DELETE ON public.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.e11_graph()',t);
    EXECUTE format('CREATE TRIGGER e11_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable()',t);
  END LOOP;
END $$;
CREATE TRIGGER e11_ddl_no_truncate BEFORE TRUNCATE ON public.e11_e5_definiciones
FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable();

-- Revisión exhaustiva de checks E5 que alcanzan PROPONER:
-- e5_detail_guard: historia/versiones/subconjunto, no exige ADMIN.
-- e5_graph_guard: PROPONER conserva dinero y actor de propuesta; ADMIN de
-- aplicaciones/devoluciones no se amplía. e5_owned_credit_source exige ADMIN
-- para crear ABONO: se deja idéntica. e5_insert_authority es el único bloqueo
-- de rol PROPONER. e5_closed permanece idéntica y unida a las nueve tablas.
-- Hashes SHA256 de prosrc UTF8 extraídos ESTÁTICAMENTE del paquete E5 cerrado;
-- no hashes de pg_get_functiondef (normaliza CREATE OR REPLACE). No ejecutado PG.
DO $$
DECLARE expected record; original text; src text; anchor text; new_branch text;
  patched text; t text;
BEGIN
  LOCK TABLE public.e5_operaciones,public.e5_cobros IN ACCESS EXCLUSIVE MODE;
  FOR expected IN SELECT * FROM (VALUES
    ('public.e5_insert_authority()','124271a0007f135354a031abc7ee33ec74c6e6eafb255dd8341a9525c904e6f5'),
    ('public.e5_graph_guard()','303366993fe3529b329a2a0c980a4efcda37eef1c1bf0a1e9bd43bb52ca73267'),
    ('public.e5_detail_guard()','460b84a67964bbe42c66adf643d966f48731f030917ffcc083b1feaa9845a027'),
    ('public.e5_closed()','76bb2925cae2f65d1bffae17408fc49efc41271304e8c6778047cd3eaa5ae4c6'),
    ('public.e5_owned_credit_source(public.movimientos_credito)','9cbe5d2eeb339394878cf1e4d41de19d1225af5cdcdb6b572a4388c172795d9c')
  ) v(firma,hash) LOOP
    SELECT p.prosrc,pg_get_functiondef(p.oid) INTO src,original
      FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(expected.firma)
        AND NOT p.prosecdef AND p.proconfig=ARRAY['search_path=pg_catalog'];
    IF src IS NULL OR encode(sha256(convert_to(src,'UTF8')),'hex')<>expected.hash
    THEN RAISE EXCEPTION 'E11: drift E5 (%) hash/config, no instalar',expected.firma; END IF;
    patched:=src;
    IF expected.firma='public.e5_insert_authority()' THEN
      anchor:='    IF NOT FOUND THEN RAISE EXCEPTION ''E5: autoridad ADMIN actual requerida''; END IF;';
      IF (length(src)-length(replace(src,anchor,'')))<>length(anchor)
      THEN RAISE EXCEPTION 'E11: ancla E5 no única, no reemplazar'; END IF;
      new_branch:=E'    IF NOT FOUND THEN\n'
        ||E'      IF TG_TABLE_NAME=''e5_operaciones'' AND j->>''accion''=''PROPONER'' THEN\n'
        ||E'        PERFORM public.e11_e5_a_validate(j,true);\n'
        ||E'      ELSE RAISE EXCEPTION ''E5: autoridad ADMIN actual requerida'';\n'
        ||E'      END IF;\n    END IF;';
      patched:=replace(src,anchor,new_branch);
      EXECUTE replace(original,anchor,new_branch);
    END IF;
    INSERT INTO public.e11_e5_definiciones VALUES
      (expected.firma,original,expected.hash,encode(sha256(convert_to(patched,'UTF8')),'hex'));
  END LOOP;
  FOREACH t IN ARRAY ARRAY['e5_recepciones','e5_cobros','e5_aplicaciones','e5_vinculos_credito',
    'e5_salidas_bancarias','e5_devoluciones','e5_documentos','e5_operaciones','e5_impresiones'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger
      WHERE tgrelid=to_regclass('public.'||t) AND tgname='e5_closed' AND tgenabled='O'
        AND tgfoid='public.e5_closed()'::regprocedure AND tgtype=30)
    THEN RAISE EXCEPTION 'E11: cierre E5 ausente/divergente en %',t; END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.e5_operaciones'::regclass
    AND tgname='e5_insert_authority' AND tgenabled='O'
    AND tgfoid='public.e5_insert_authority()'::regprocedure AND tgtype=7)
  THEN RAISE EXCEPTION 'E11: autoridad E5 no conectada al INSERT'; END IF;
END $$;
CREATE TRIGGER e11_ddl_no_insert BEFORE INSERT ON public.e11_e5_definiciones
FOR EACH STATEMENT EXECUTE FUNCTION public.e11_immutable();
-- Sin privilegios nuevos. Las tablas no autorizan lectores HTTP/roles contadores.
REVOKE ALL ON public.e11_perfiles,public.e11_perfil_eventos,public.e11_operaciones,
  public.e11_conciliaciones,public.e11_conciliacion_ventas,public.e11_decisiones,
  public.e11_avisos,public.e11_notificacion_origen,public.e11_cambios_usuario,
  public.e11_e5_preparaciones,public.e11_e5_definiciones,public.e11_resoluciones FROM PUBLIC;
REVOKE ALL ON FUNCTION public.e11_closed(),public.e11_immutable(),public.e11_keys(jsonb,text[]),
  public.e11_canonical(jsonb),public.e11_hash(jsonb),public.e11_fin(text,date),
  public.e11_fuente(date,date),public.e11_iso(timestamptz),public.e11_actor(integer,text,integer),public.e11_before(),
  public.e11_technical_insert(),public.e11_user_change(),public.e11_notification(),
  public.e11_graph(),public.e11_e5_a_validate(jsonb,boolean),public.e11_e5_capture(),
  public.e11_replay_lock(integer,text,uuid,boolean),public.e11_recovery_before(),
  public.e11_recovery_check() FROM PUBLIC;
COMMIT;