-- PREPARED OFFLINE ONLY. Restores the exact installed CLOSED function body.
-- psql variables required: expected_identity_sha256, expected_plan_sha256.
\set ON_ERROR_STOP on
\if :{?expected_identity_sha256}
\else
  \echo 'REFUSED: expected_identity_sha256 is mandatory'
  \quit 3
\endif
\if :{?expected_plan_sha256}
\else
  \echo 'REFUSED: expected_plan_sha256 is mandatory'
  \quit 3
\endif

BEGIN;
LOCK TABLE public.movimientos_credito,
                  public.cobros_credito_pendientes_e1,
                  public.atribuciones_credito_e1,
                  public.finalizaciones_abono_e2,
                  public.evidencia_no_aplicada_e2,
                  public.aplicaciones_credito,
                  public.auditoria
  IN SHARE ROW EXCLUSIVE MODE;

SELECT pg_catalog.encode(
         pg_catalog.sha256(
           pg_catalog.convert_to(
             'E2_APERTURA_LIMITADA_PLAN_V3|' || :'expected_identity_sha256'
             || '|LIMITED|59dd73520c3d11cc65b3f2fac25f46a4560ca45700c5c981c21e17dfe80988fd'
             || '|982aa15dcce33633ccf42ae5a79f03858bd2ff0eee26724da8858f1216accb05'
             || '|9e7e5b8de15d7079105c3d29416142e6f2825c8cd1828f85f8b67a1e4e842099'
             || '|dd99574f022b4d325a73238bf0d1e348e015003d2dad3ebc9de00ede8b094cbd'
             || '|522f8bac6d8b78e2eee158e47249aac8e8fac264cabd64546b00b6f3bf7ae4bc'
             || '|1bb36ac4eddd07d54e28686b83a3ded3d98b115e4190fbce6e97a11c7576587d'
             || '|f5870c20276001bd2c8269e534b2ef696217e13087a27cd350127ce8dfa9b5d2',
             'UTF8'
           )
         ),
         'hex'
       ) AS calculated_plan_sha256
\gset
SELECT :'calculated_plan_sha256' = :'expected_plan_sha256'
       AS supplied_plan_digest_ok
\gset
\if :supplied_plan_digest_ok
\else
  \echo 'REFUSED: plan digest does not match planned LIMITED-mode target'
  \quit 3
\endif

WITH identity AS (
  SELECT pg_catalog.encode(
           pg_catalog.sha256(
             pg_catalog.convert_to(
               pg_catalog.concat_ws(
                 '|',
                 pg_catalog.current_database(),
                 d.oid::text,
                 current_user,
                 COALESCE(pg_catalog.inet_server_addr()::text, '<local>'),
                 COALESCE(pg_catalog.inet_server_port()::text, '<local>'),
                 pg_catalog.current_setting('server_version_num')
               ),
               'UTF8'
             )
           ),
           'hex'
         ) AS sha256
    FROM pg_catalog.pg_database AS d
   WHERE d.datname = pg_catalog.current_database()
),
target AS (
  SELECT p.oid, p.prosrc, p.prokind, p.provolatile, p.proparallel, p.prosecdef,
         p.proleakproof, p.proisstrict, p.proretset, p.proacl, p.proconfig,
         l.lanname, r.rolname AS owner_name,
         pg_catalog.pg_get_function_result(p.oid) AS result_type,
         EXISTS (
           SELECT 1 FROM pg_catalog.aclexplode(
             COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
           ) AS acl
           WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE' AND NOT acl.is_grantable
         ) AS public_execute
    FROM pg_catalog.pg_proc AS p
    JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
    JOIN pg_catalog.pg_language AS l ON l.oid = p.prolang
    JOIN pg_catalog.pg_roles AS r ON r.oid = p.proowner
   WHERE n.nspname = 'public'
     AND p.proname = 'e1_guard_cash_capture_closed'
     AND pg_catalog.pg_get_function_identity_arguments(p.oid) = ''
),
other_guards AS (
  SELECT p.proname, p.prosrc, p.prokind, p.provolatile, p.proparallel,
         p.prosecdef, p.proleakproof, p.proisstrict, p.proretset,
         p.proacl, p.proconfig, l.lanname, r.rolname AS owner_name,
         pg_catalog.pg_get_function_result(p.oid) AS result_type,
         EXISTS (
           SELECT 1 FROM pg_catalog.aclexplode(
             COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
           ) AS acl
           WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE' AND NOT acl.is_grantable
         ) AS public_execute
    FROM pg_catalog.pg_proc AS p
    JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
    JOIN pg_catalog.pg_language AS l ON l.oid = p.prolang
    JOIN pg_catalog.pg_roles AS r ON r.oid = p.proowner
   WHERE n.nspname = 'public'
     AND p.proname IN ('e1_guard_pending_receipts_closed', 'e1_guard_historical_attribution_closed')
     AND pg_catalog.pg_get_function_identity_arguments(p.oid) = ''
),
audit_function_check AS (
  SELECT pg_catalog.count(*) = 1
         AND pg_catalog.bool_and(
           p.prosrc = E'\n       BEGIN\n         RAISE EXCEPTION ''auditoria es append-only'';\n       END;\n       '
           AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc, 'UTF8')), 'hex')
             = '9e7e5b8de15d7079105c3d29416142e6f2825c8cd1828f85f8b67a1e4e842099'
           AND p.prokind = 'f' AND p.provolatile = 'v' AND p.proparallel = 'u'
           AND NOT p.prosecdef AND NOT p.proleakproof AND NOT p.proisstrict AND NOT p.proretset
           AND p.proacl IS NULL AND p.proconfig IS NULL
           AND l.lanname = 'plpgsql' AND r.rolname = 'postgres'
           AND pg_catalog.pg_get_function_result(p.oid) = 'trigger'
           AND EXISTS (
             SELECT 1 FROM pg_catalog.aclexplode(pg_catalog.acldefault('f', p.proowner)) AS acl
              WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE' AND NOT acl.is_grantable
           )
         ) AS ok
    FROM pg_catalog.pg_proc AS p
    JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
    JOIN pg_catalog.pg_language AS l ON l.oid = p.prolang
    JOIN pg_catalog.pg_roles AS r ON r.oid = p.proowner
   WHERE n.nspname = 'public'
     AND p.proname = 'proteger_auditoria_append_only'
     AND pg_catalog.pg_get_function_identity_arguments(p.oid) = ''
),
expected_triggers(table_name, trigger_name, enabled, trigger_type, function_schema, function_name, function_owner, function_language, function_security_definer, args_length, trigger_attr, has_constraint, has_parent, has_qual) AS (
  VALUES
    ('movimientos_credito', 'movimientos_credito_inmutables', 'O', 27::smallint, 'public', 'prevent_financial_record_mutation', 'postgres', 'plpgsql', false, 0, '', false, false, false),
    ('movimientos_credito', 'movimientos_credito_reversos_validos', 'O', 7::smallint, 'public', 'validate_credit_reversal', 'postgres', 'plpgsql', false, 0, '', false, false, false),
    ('movimientos_credito', 'movimientos_validos_e1', 'O', 5::smallint, 'public', 'validar_movimiento_credito_e1', 'postgres', 'plpgsql', false, 0, '', false, false, false),
    ('movimientos_credito', 'zz_e1_cash_capture_closed', 'O', 5::smallint, 'public', 'e1_guard_cash_capture_closed', 'postgres', 'plpgsql', false, 0, '', false, false, false),
    ('movimientos_credito', 'e2_abono_finalization_complete', 'O', 5::smallint, 'public', 'e2_require_abono_finalization', 'postgres', 'plpgsql', false, 0, '', true, false, false),
    ('aplicaciones_credito', 'e2_capture_application_order', 'O', 7::smallint, 'public', 'e2_guard_finalized_capture_application', 'postgres', 'plpgsql', false, 0, '', false, false, false),
    ('finalizaciones_abono_e2', 'e2_finalization_immutable', 'O', 58::smallint, 'public', 'e2_reject_evidence_mutation', 'postgres', 'plpgsql', false, 0, '', false, false, false),
    ('finalizaciones_abono_e2', 'e2_validate_abono_finalization', 'O', 7::smallint, 'public', 'e2_validate_abono_finalization', 'postgres', 'plpgsql', false, 0, '', false, false, false),
    ('evidencia_no_aplicada_e2', 'e2_proof_immutable', 'O', 58::smallint, 'public', 'e2_reject_evidence_mutation', 'postgres', 'plpgsql', false, 0, '', false, false, false),
    ('evidencia_no_aplicada_e2', 'e2_validate_unused_proof', 'O', 7::smallint, 'public', 'e2_validate_unused_proof', 'postgres', 'plpgsql', false, 0, '', false, false, false),
    ('cobros_credito_pendientes_e1', 'cobros_inmutables_e1', 'O', 58::smallint, 'public', 'impedir_mutacion_credito_e1', 'postgres', 'plpgsql', false, 0, '', false, false, false),
    ('cobros_credito_pendientes_e1', 'cobros_validos_e1', 'O', 5::smallint, 'public', 'validar_cobro_pendiente_e1', 'postgres', 'plpgsql', false, 0, '', false, false, false),
    ('cobros_credito_pendientes_e1', 'zz_e1_pending_receipts_closed', 'O', 4::smallint, 'public', 'e1_guard_pending_receipts_closed', 'postgres', 'plpgsql', false, 0, '', false, false, false),
    ('atribuciones_credito_e1', 'atribuciones_inmutables_e1', 'O', 58::smallint, 'public', 'impedir_mutacion_credito_e1', 'postgres', 'plpgsql', false, 0, '', false, false, false),
    ('atribuciones_credito_e1', 'atribuciones_validas_e1', 'O', 7::smallint, 'public', 'validar_atribucion_credito_e1', 'postgres', 'plpgsql', false, 0, '', false, false, false),
    ('atribuciones_credito_e1', 'zz_e1_historical_attribution_closed', 'O', 4::smallint, 'public', 'e1_guard_historical_attribution_closed', 'postgres', 'plpgsql', false, 0, '', false, false, false),
    ('auditoria', 'auditoria_append_only', 'O', 27::smallint, 'public', 'proteger_auditoria_append_only', 'postgres', 'plpgsql', false, 0, '', false, false, false)
),
actual_triggers AS (
  SELECT c.relname::text AS table_name,
         t.tgname::text AS trigger_name,
         t.tgenabled::text AS enabled,
         t.tgtype AS trigger_type,
         fn.nspname::text AS function_schema,
         p.proname::text AS function_name,
         fr.rolname::text AS function_owner,
         fl.lanname::text AS function_language,
         p.prosecdef AS function_security_definer,
         pg_catalog.octet_length(t.tgargs) AS args_length,
         t.tgattr::text AS trigger_attr,
         t.tgconstraint <> 0 AS has_constraint,
         t.tgparentid <> 0 AS has_parent,
         t.tgqual IS NOT NULL AS has_qual
    FROM pg_catalog.pg_trigger AS t
    JOIN pg_catalog.pg_class AS c ON c.oid = t.tgrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_proc AS p ON p.oid = t.tgfoid
    JOIN pg_catalog.pg_namespace AS fn ON fn.oid = p.pronamespace
    JOIN pg_catalog.pg_roles AS fr ON fr.oid = p.proowner
    JOIN pg_catalog.pg_language AS fl ON fl.oid = p.prolang
   WHERE n.nspname = 'public'
     AND (c.relname IN ('movimientos_credito', 'cobros_credito_pendientes_e1', 'atribuciones_credito_e1', 'auditoria', 'finalizaciones_abono_e2', 'evidencia_no_aplicada_e2')
       OR (c.relname = 'aplicaciones_credito' AND t.tgname = 'e2_capture_application_order'))
     AND (t.tgname <> 'e2_abono_finalization_complete' OR (t.tgdeferrable AND t.tginitdeferred))
     AND NOT t.tgisinternal
),
evidence_functions(name, source_hash, result_type, identity_arguments) AS (
  VALUES
    ('e2_reject_evidence_mutation', '4e4d98bf9efa299671f666d86e8285a76438cdf492ef529bd8f7f0cf359da25a', 'trigger', ''),
    ('e2_validate_abono_finalization', '73a3e2b84fb480448080addfd4af98fed85cbff459caddebce5c64d9ad1bb2cc', 'trigger', ''),
    ('e2_validate_unused_proof', '09e2b1ebaf7ef4cf20ccdfea376d90a6e161a6bc67d4d4f4c50960a70e1bee67', 'trigger', ''),
    ('e2_attest_new_retained', '3498c293a24f45a9782c7cc550d8194eaefbbdfe83e5c7d9451506195a9fb69c', 'void', 'p_clave uuid'),
    ('e2_guard_finalized_capture_application', '904d1e0c0735f95e930ea7a6654561986f475ca9f0b0d1a00b9bf22ab501bb51', 'trigger', ''),
    ('e2_finalize_new_abono', 'a8ff080835bd6873e6ae2ec0c88a92ba4bf74b1d9e131a886fb20df7368bf32f', 'void', 'p_abono_id integer, p_productor text, p_resultado text, p_aplicado_cents bigint, p_evaluacion jsonb, p_contrato_revision text'),
    ('e2_require_abono_finalization', 'b706f7a06badbe932d6f08f276ff7ebe3c780b47416e4b58c012f084d7151ad7', 'trigger', '')
),
evidence_function_check AS (
  SELECT count(*) = 7 AND bool_and(
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc, 'UTF8')), 'hex') = e.source_hash
    AND p.prokind = 'f' AND p.provolatile = 'v' AND p.proparallel = 'u'
    AND NOT p.prosecdef AND NOT p.proleakproof AND NOT p.proisstrict AND NOT p.proretset
    AND p.proacl IS NULL AND p.proconfig = ARRAY['search_path=pg_catalog, public']
    AND l.lanname = 'plpgsql' AND r.rolname = 'postgres'
    AND pg_catalog.pg_get_function_result(p.oid) = e.result_type
    AND pg_catalog.pg_get_function_identity_arguments(p.oid) = e.identity_arguments
  ) AS ok
  FROM evidence_functions e
  JOIN pg_catalog.pg_proc p ON p.proname = e.name
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
  JOIN pg_catalog.pg_language l ON l.oid = p.prolang
  JOIN pg_catalog.pg_roles r ON r.oid = p.proowner
),
trigger_diff AS (
  (SELECT * FROM expected_triggers EXCEPT SELECT * FROM actual_triggers)
  UNION ALL
  (SELECT * FROM actual_triggers EXCEPT SELECT * FROM expected_triggers)
)
SELECT (
  (SELECT sha256 = :'expected_identity_sha256' FROM identity)
  AND (SELECT pg_catalog.count(*) = 1 FROM target)
  AND (SELECT prosrc = E'\nBEGIN\n  IF NEW.forma_pago::text = ''EFECTIVO''\n     AND NEW.naturaleza::text IN (''INGRESO_FISICO'', ''DEVOLUCION_FISICA'')\n     AND (\n       NEW.naturaleza::text = ''DEVOLUCION_FISICA''\n       OR NEW.tipo::text IS DISTINCT FROM ''ABONO''\n     ) THEN\n    RAISE EXCEPTION USING\n      ERRCODE = ''E1C01'',\n      MESSAGE = ''E1: la captura física de efectivo de crédito está deshabilitada.'';\n  END IF;\n  RETURN NEW;\nEND;\n'
          AND prokind = 'f' AND provolatile = 'v' AND proparallel = 'u'
          AND NOT prosecdef AND NOT proleakproof AND NOT proisstrict AND NOT proretset
          AND proacl IS NULL AND proconfig = ARRAY['search_path=pg_catalog, public']
          AND lanname = 'plpgsql' AND owner_name = 'postgres'
          AND result_type = 'trigger' AND public_execute
       FROM target)
  AND (SELECT pg_catalog.count(*) = 2 FROM other_guards)
  AND (SELECT pg_catalog.bool_and(
         prokind = 'f' AND provolatile = 'v' AND proparallel = 'u'
         AND NOT prosecdef AND NOT proleakproof AND NOT proisstrict AND NOT proretset
         AND proacl IS NULL AND proconfig = ARRAY['search_path=pg_catalog, public']
         AND lanname = 'plpgsql' AND owner_name = 'postgres'
         AND result_type = 'trigger' AND public_execute
         AND CASE proname
           WHEN 'e1_guard_pending_receipts_closed' THEN prosrc = E'\nBEGIN\n  RAISE EXCEPTION USING\n    ERRCODE = ''E1P01'',\n    MESSAGE = ''E1: el cobro retenido de crédito está deshabilitado.'';\n  RETURN NULL;\nEND;\n'
           WHEN 'e1_guard_historical_attribution_closed' THEN prosrc = E'\nBEGIN\n  RAISE EXCEPTION USING\n    ERRCODE = ''E1A01'',\n    MESSAGE = ''E1: la atribución histórica de crédito está deshabilitada.'';\n  RETURN NULL;\nEND;\n'
           ELSE false
         END
       ) FROM other_guards)
  AND (SELECT ok FROM audit_function_check)
  AND NOT EXISTS (SELECT 1 FROM trigger_diff)
  AND (SELECT ok FROM evidence_function_check)
) AS preflight_ok
\gset
\if :preflight_ok
\else
  \echo 'REFUSED: identity or exact LIMITED E1 catalog baseline drifted'
  \quit 3
\endif

\ir ../evidencia-a-c/03-preflight-schema-prepared.sql

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
$function$;

SELECT p.prosrc = E'\nBEGIN\n  IF NEW.forma_pago::text = ''EFECTIVO''\n     AND NEW.naturaleza::text IN (''INGRESO_FISICO'', ''DEVOLUCION_FISICA'') THEN\n    RAISE EXCEPTION USING\n      ERRCODE = ''E1C01'',\n      MESSAGE = ''E1: la captura física de efectivo de crédito está deshabilitada.'';\n  END IF;\n  RETURN NEW;\nEND;\n'
       AND p.proconfig = ARRAY['search_path=pg_catalog, public']
       AND NOT p.prosecdef AND p.proacl IS NULL
       AND r.rolname = 'postgres'
       AND EXISTS (
         SELECT 1 FROM pg_catalog.aclexplode(
           COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
         ) AS acl
         WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE' AND NOT acl.is_grantable
       )
       AS postflight_ok
  FROM pg_catalog.pg_proc AS p
  JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
  JOIN pg_catalog.pg_roles AS r ON r.oid = p.proowner
 WHERE n.nspname = 'public'
   AND p.proname = 'e1_guard_cash_capture_closed'
   AND pg_catalog.pg_get_function_identity_arguments(p.oid) = ''
\gset
\if :postflight_ok
\else
  \echo 'REFUSED: postflight mismatch; transaction will roll back'
  \quit 3
\endif
COMMIT;