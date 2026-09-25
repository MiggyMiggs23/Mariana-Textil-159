-- MAIN only, same pinned disposable cluster. Run after 01b with:
-- psql -X "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -v runtime_role="$COMMERCIAL_RETURN_RUNTIME_ROLE" -f this-file
\set ON_ERROR_STOP on
\if :{?runtime_role}
\else
  \echo 'runtime_role parameter required'
  \quit 1
\endif
SELECT
  current_database() !~ '^(test_|disposable_|continuation_)'
  OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=:'runtime_role')
  OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname=:'runtime_role'
    AND (rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls))
  OR has_schema_privilege(:'runtime_role','public','CREATE')
  OR has_parameter_privilege(:'runtime_role','session_replication_role','SET')
  OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND (pg_has_role(:'runtime_role',c.relowner,'MEMBER')
        OR has_table_privilege(:'runtime_role',c.oid,'TRUNCATE,TRIGGER')))
  OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'commercial_return_%'
      AND pg_has_role(:'runtime_role',p.proowner,'MEMBER'))
  OR has_table_privilege(:'runtime_role','public.commercial_return_customer_fence','INSERT,UPDATE,DELETE,TRUNCATE')
  OR has_table_privilege(:'runtime_role','public.commercial_return_cash_fence','INSERT,UPDATE,DELETE,TRUNCATE')
  OR has_table_privilege(:'runtime_role','public.commercial_return_gate','INSERT,UPDATE,DELETE,TRUNCATE')
  OR has_function_privilege(:'runtime_role','public.commercial_return_projection(integer,integer)','EXECUTE')
  OR has_function_privilege(:'runtime_role','public.commercial_return_assert_financial(uuid)','EXECUTE')
  AS unsafe_runtime \gset
\if :unsafe_runtime
  \echo 'FAIL: runtime can bypass or alter protected objects. No activation.'
  \quit 1
\endif
\echo 'Runtime role least-privilege metadata: PASS (direct-write probes under SET ROLE still required)'