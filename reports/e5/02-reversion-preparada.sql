-- E5 / REVERSIÓN PREPARADA / NO EJECUTADA. Sólo instalación enteramente vacía.
-- No DELETE/TRUNCATE de dinero, historia, snapshots ni procedencia.
-- Cualquier evidencia (incluso sidecar de otra operación) ABORTA íntegramente.
-- Sin CASCADE. Restaura exactamente constraint/funciones/trigger E1 archivados,
-- nunca abre productores; E2/E3/E9/E12 permanecen intactos.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';
-- Mismo conjunto de relaciones que origina/revalida evidencia: evita TOCTOU.
LOCK TABLE public.e5_recepciones, public.e5_cobros, public.e5_aplicaciones,
  public.e5_vinculos_credito, public.e5_salidas_bancarias, public.e5_devoluciones,
  public.e5_documentos, public.e5_operaciones, public.e5_impresiones,
  public.e5_nacimientos, public.e5_ddl_originales,
  public.operaciones_credito_e1, public.cobros_credito_pendientes_e1,
  public.movimientos_credito, public.aplicaciones_credito, public.solicitudes_pago_dirigido,
  public.salidas_dinero_caja, public.fondo_movimientos, public.sesiones_caja,
  public.fondo_mariana, public.tickets, public.usuarios, public.ubicaciones IN ACCESS EXCLUSIVE MODE;
DO $$
DECLARE t text; evidence boolean; original text;
BEGIN
  FOREACH t IN ARRAY ARRAY['e5_recepciones','e5_cobros','e5_aplicaciones','e5_vinculos_credito',
    'e5_salidas_bancarias','e5_devoluciones','e5_documentos','e5_operaciones','e5_impresiones','e5_nacimientos'] LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)',t) INTO evidence;
    IF evidence THEN RAISE EXCEPTION 'E5: reversión prohibida; evidencia en %; conservar todo',t; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.operaciones_credito_e1 WHERE productor='E5_APLICACION_RETENIDA'
    OR solicitud_canonica->>'productor'='E5')
    OR EXISTS (SELECT 1 FROM public.movimientos_credito WHERE operacion_productor='E5_APLICACION_RETENIDA')
  THEN RAISE EXCEPTION 'E5: reversión prohibida; evidencia monetaria externa'; END IF;
  IF (SELECT count(*) FROM public.e5_ddl_originales)<>4 OR EXISTS (
    SELECT 1 FROM (VALUES ('constraint_operaciones'),('funcion_movimiento'),
      ('funcion_pending'),('trigger_pending')) expected(objeto)
    WHERE NOT EXISTS (SELECT 1 FROM public.e5_ddl_originales d WHERE d.objeto=expected.objeto))
  THEN RAISE EXCEPTION 'E5: archivo de definiciones incompleto; no adivinar restauración'; END IF;
  -- Primero restaurar E1 mientras siguen vivos todos los objetos E5. Si una
  -- definición ya no encaja, el error revierte íntegramente esta transacción.
  SELECT definicion INTO original FROM public.e5_ddl_originales WHERE objeto='funcion_movimiento';
  EXECUTE original;
  SELECT definicion INTO original FROM public.e5_ddl_originales WHERE objeto='constraint_operaciones';
  EXECUTE 'ALTER TABLE public.operaciones_credito_e1 DROP CONSTRAINT operaciones_productor_naturaleza_ck_e1';
  EXECUTE 'ALTER TABLE public.operaciones_credito_e1 ADD CONSTRAINT operaciones_productor_naturaleza_ck_e1 '||original;
  DROP TRIGGER zz_e1_pending_receipts_closed ON public.cobros_credito_pendientes_e1;
  SELECT definicion INTO original FROM public.e5_ddl_originales WHERE objeto='funcion_pending';
  EXECUTE original;
  SELECT definicion INTO original FROM public.e5_ddl_originales WHERE objeto='trigger_pending';
  EXECUTE original;
  FOREACH t IN ARRAY ARRAY['operaciones_credito_e1','cobros_credito_pendientes_e1',
    'movimientos_credito','aplicaciones_credito','solicitudes_pago_dirigido','salidas_dinero_caja',
    'fondo_movimientos','sesiones_caja','fondo_mariana','tickets','usuarios','ubicaciones'] LOOP
    EXECUTE format('DROP TRIGGER e5_graph ON public.%I',t);
    EXECUTE format('DROP TRIGGER e5_serialize ON public.%I',t);
    EXECUTE format('DROP TRIGGER e5_no_truncate ON public.%I',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['operaciones_credito_e1','cobros_credito_pendientes_e1','aplicaciones_credito',
    'movimientos_credito','salidas_dinero_caja','fondo_movimientos'] LOOP
    EXECUTE format('DROP TRIGGER e5_capture_birth ON public.%I',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['operaciones_credito_e1','cobros_credito_pendientes_e1',
    'movimientos_credito','aplicaciones_credito','solicitudes_pago_dirigido','salidas_dinero_caja','fondo_movimientos'] LOOP
    EXECUTE format('DROP TRIGGER e5_external_guard ON public.%I',t);
  END LOOP;
END $$;
DROP TRIGGER e5_favor_initial_guard ON public.aplicaciones_credito;
DROP TABLE public.e5_impresiones, public.e5_operaciones, public.e5_documentos,
  public.e5_devoluciones, public.e5_salidas_bancarias, public.e5_vinculos_credito,
  public.e5_aplicaciones, public.e5_cobros, public.e5_recepciones, public.e5_nacimientos,
  public.e5_ddl_originales;
DROP FUNCTION public.e5_graph_guard(), public.e5_external_guard(), public.e5_detail_guard(),
  public.e5_serialize(), public.e5_capture_birth(), public.e5_birth_private(),
  public.e5_birth(), public.e5_immutable(), public.e5_closed(), public.e5_insert_authority(),
  public.e5_owned_credit_source(public.movimientos_credito), public.e5_favor_initial_guard();
COMMIT;