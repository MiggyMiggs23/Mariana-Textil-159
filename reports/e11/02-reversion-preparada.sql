-- E11 PREPARADO / NO EJECUTADO. Sólo desinstalación vacía, nunca borrado historia.
-- No CASCADE, DELETE, TRUNCATE ni monedas. Restaura exactamente funciones E5
-- pre-E11 archivadas, después de comprobar hashes de instalación; jamás abre
-- cierres ni altera E1/otros gates. Drift aborta toda la transacción.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s';
LOCK TABLE public.e11_perfiles,public.e11_perfil_eventos,public.e11_operaciones,
  public.e11_conciliaciones,public.e11_conciliacion_ventas,public.e11_decisiones,
  public.e11_avisos,public.e11_notificacion_origen,public.e11_cambios_usuario,
  public.e11_e5_preparaciones,public.e11_e5_definiciones,public.e11_resoluciones,
  public.usuarios,public.tickets,public.clientes,public.ubicaciones,public.notificaciones_sistema,
  public.movimientos_credito,public.e5_operaciones,public.e5_cobros,public.e5_nacimientos IN ACCESS EXCLUSIVE MODE;
DO $$
DECLARE t text; evidence boolean; archived record; current_hash text;
BEGIN
  -- Inventario real 9656: ocho tablas adapter + cuatro técnicas = doce.
  -- No ignorar una futura tabla de evidencia al desinstalar una versión vieja.
  IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND left(c.relname,4)='e11_' AND c.relkind IN ('r','p'))<>12
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND left(c.relname,4)='e11_' AND c.relkind IN ('r','p')
        AND c.relname NOT IN ('e11_perfiles','e11_perfil_eventos','e11_operaciones','e11_conciliaciones',
          'e11_conciliacion_ventas','e11_decisiones','e11_avisos','e11_resoluciones',
          'e11_notificacion_origen','e11_cambios_usuario','e11_e5_preparaciones','e11_e5_definiciones'))
  THEN RAISE EXCEPTION 'E11: drift inventario físico, no desinstalar'; END IF;
  FOREACH t IN ARRAY ARRAY['e11_perfiles','e11_perfil_eventos','e11_operaciones','e11_conciliaciones',
    'e11_conciliacion_ventas','e11_decisiones','e11_avisos','e11_resoluciones'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger
      WHERE tgrelid=to_regclass('public.'||t) AND tgname='e11_closed' AND tgenabled='O'
        AND tgfoid='public.e11_closed()'::regprocedure AND tgtype=30)
    THEN RAISE EXCEPTION 'E11: drift cierre incondicional en %, no revertir',t; END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['e11_perfiles','e11_perfil_eventos','e11_operaciones','e11_conciliaciones',
    'e11_conciliacion_ventas','e11_decisiones','e11_avisos','e11_notificacion_origen','e11_cambios_usuario',
    'e11_e5_preparaciones','e11_resoluciones'] LOOP
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I)',t) INTO evidence;
    IF evidence THEN RAISE EXCEPTION 'E11: reversión prohibida, conservar evidencia en %',t; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.notificaciones_sistema WHERE tipo='E11_NO_CUADRA')
  THEN RAISE EXCEPTION 'E11: evidencia externa, no revertir'; END IF;
  IF to_regclass('public.e5_operaciones') IS NOT NULL THEN
    EXECUTE 'LOCK TABLE public.e5_operaciones IN ACCESS EXCLUSIVE MODE';
    EXECUTE $query$
      SELECT EXISTS(SELECT 1 FROM public.e5_operaciones p,
        LATERAL jsonb_array_elements(p.response->'propuestas') proposal(value),
        LATERAL jsonb_array_elements_text(proposal.value->'evidencia'->'referencias') ref(value)
        WHERE p.accion='PROPONER' AND ref.value LIKE 'E11:%')
    $query$ INTO evidence;
    IF evidence THEN RAISE EXCEPTION 'E11: preparación E5 externa, conservar historia'; END IF;
    IF EXISTS(SELECT 1 FROM public.e5_operaciones p JOIN public.usuarios u ON u.id=p.actor_id
      WHERE u.rol::text='CONTADOR')
    THEN RAISE EXCEPTION 'E11: evidencia E5 atribuible a contador, no desinstalar'; END IF;
  END IF;
  IF (SELECT count(*) FROM public.e11_e5_definiciones)<>5 OR EXISTS(
    SELECT 1 FROM (VALUES ('public.e5_insert_authority()'),('public.e5_graph_guard()'),
      ('public.e5_detail_guard()'),('public.e5_closed()'),
      ('public.e5_owned_credit_source(public.movimientos_credito)')) expected(firma)
    WHERE NOT EXISTS(SELECT 1 FROM public.e11_e5_definiciones a WHERE a.firma=expected.firma))
  THEN RAISE EXCEPTION 'E11: archivo E5 incompleto, no adivinar restauración'; END IF;
  FOR archived IN SELECT * FROM public.e11_e5_definiciones LOOP
    SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') INTO current_hash
      FROM pg_catalog.pg_proc WHERE oid=to_regprocedure(archived.firma)
        AND NOT prosecdef AND proconfig=ARRAY['search_path=pg_catalog'];
    IF current_hash IS DISTINCT FROM archived.hash_instalado
    THEN RAISE EXCEPTION 'E11: drift posterior en %, conservar todo',archived.firma; END IF;
  END LOOP;
  FOR archived IN SELECT * FROM public.e11_e5_definiciones LOOP
    EXECUTE archived.definicion;
    SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') INTO current_hash
      FROM pg_catalog.pg_proc WHERE oid=to_regprocedure(archived.firma);
    IF current_hash IS DISTINCT FROM archived.hash_original
    THEN RAISE EXCEPTION 'E11: restauración E5 no coincide, rollback íntegro'; END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['usuarios','tickets','clientes','ubicaciones','notificaciones_sistema',
    'movimientos_credito','e5_operaciones','e5_cobros','e5_nacimientos'] LOOP
    EXECUTE format('DROP TRIGGER e11_graph ON public.%I',t);
    EXECUTE format('DROP TRIGGER e11_no_truncate ON public.%I',t);
  END LOOP;
END $$;
DROP TRIGGER e11_e5_capture ON public.e5_operaciones;
DROP TRIGGER e11_user_change ON public.usuarios;
DROP TRIGGER e11_notification_birth ON public.notificaciones_sistema;
DROP TRIGGER e11_notification_immutable ON public.notificaciones_sistema;
DROP INDEX public.e11_notificacion_unica;
DROP TABLE public.e11_resoluciones,public.e11_avisos,public.e11_decisiones,public.e11_conciliacion_ventas,
  public.e11_conciliaciones,public.e11_operaciones,public.e11_perfil_eventos,
  public.e11_perfiles,public.e11_notificacion_origen,public.e11_cambios_usuario,
  public.e11_e5_preparaciones,public.e11_e5_definiciones;
DROP FUNCTION public.e11_graph(),public.e11_notification(),public.e11_user_change(),
  public.e11_technical_insert(),public.e11_before(),public.e11_actor(integer,text,integer),
  public.e11_fuente(date,date),public.e11_iso(timestamptz),public.e11_fin(text,date),public.e11_hash(jsonb),
  public.e11_canonical(jsonb),public.e11_keys(jsonb,text[]),public.e11_immutable(),public.e11_closed(),
  public.e11_e5_a_validate(jsonb,boolean),public.e11_e5_capture(),
  public.e11_replay_lock(integer,text,uuid,boolean),public.e11_recovery_before(),
  public.e11_recovery_check();
COMMIT;