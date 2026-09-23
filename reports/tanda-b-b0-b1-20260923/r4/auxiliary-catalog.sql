BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='2s';
WITH ri AS (
 SELECT n.nspname schema_name,c.relname parent,k.conname constraint_name,k.conrelid::regclass::text constraint_table,
   t.tgtype,t.tgenabled,t.tgdeferrable,t.tginitdeferred,
   p.oid::regprocedure::text function_signature,
   rn.nspname referenced_schema,rc.relname referenced_table,
   pg_get_constraintdef(k.oid,true) constraint_definition
 FROM pg_trigger t JOIN pg_constraint k ON k.oid=t.tgconstraint AND k.contype='f'
 JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_proc p ON p.oid=t.tgfoid
 JOIN pg_class rc ON rc.oid=t.tgconstrrelid JOIN pg_namespace rn ON rn.oid=rc.relnamespace
 WHERE t.tgisinternal AND n.nspname='public'
), edges AS (
 SELECT d.deptype,
   CASE WHEN st.tgisinternal THEN
     jsonb_build_object('kind','RI_TRIGGER','schema',sn.nspname,'parent',sc.relname,
       'name',sk.conname,'constraint_table',sk.conrelid::regclass::text,'type',st.tgtype,'function',sp.oid::regprocedure::text)
   ELSE jsonb_build_object('kind',s.type,'schema',s.schema,'name',s.name,'identity',s.identity) END source,
   CASE WHEN rt.tgisinternal THEN
     jsonb_build_object('kind','RI_TRIGGER','schema',rn.nspname,'parent',rc.relname,
       'name',rk.conname,'constraint_table',rk.conrelid::regclass::text,'type',rt.tgtype,'function',rp.oid::regprocedure::text)
   ELSE jsonb_build_object('kind',r.type,'schema',r.schema,'name',r.name,'identity',r.identity) END target
 FROM pg_depend d
 CROSS JOIN LATERAL pg_identify_object(d.classid,d.objid,d.objsubid) s
 CROSS JOIN LATERAL pg_identify_object(d.refclassid,d.refobjid,d.refobjsubid) r
 LEFT JOIN pg_trigger st ON d.classid='pg_trigger'::regclass AND st.oid=d.objid
 LEFT JOIN pg_constraint source_constraint ON d.classid='pg_constraint'::regclass AND source_constraint.oid=d.objid
 LEFT JOIN pg_namespace source_constraint_ns ON source_constraint_ns.oid=source_constraint.connamespace
 LEFT JOIN pg_attrdef source_default ON d.classid='pg_attrdef'::regclass AND source_default.oid=d.objid
 LEFT JOIN pg_class source_default_table ON source_default_table.oid=source_default.adrelid
 LEFT JOIN pg_namespace source_default_ns ON source_default_ns.oid=source_default_table.relnamespace
 LEFT JOIN pg_constraint sk ON sk.oid=st.tgconstraint
 LEFT JOIN pg_class sc ON sc.oid=st.tgrelid LEFT JOIN pg_namespace sn ON sn.oid=sc.relnamespace
 LEFT JOIN pg_proc sp ON sp.oid=st.tgfoid
 LEFT JOIN pg_trigger rt ON d.refclassid='pg_trigger'::regclass AND rt.oid=d.refobjid
 LEFT JOIN pg_constraint rk ON rk.oid=rt.tgconstraint
 LEFT JOIN pg_class rc ON rc.oid=rt.tgrelid LEFT JOIN pg_namespace rn ON rn.oid=rc.relnamespace
 LEFT JOIN pg_proc rp ON rp.oid=rt.tgfoid
 WHERE (s.schema='public' OR sn.nspname='public' OR source_constraint_ns.nspname='public' OR source_default_ns.nspname='public')
   AND (NOT coalesce(st.tgisinternal,false) OR sk.contype='f')
   AND (NOT coalesce(rt.tgisinternal,false) OR rk.contype='f')
   AND coalesce(r.schema,'') !~ '^pg_toast'
)
SELECT json_build_object('readOnly',current_setting('transaction_read_only'),
 'riTriggers',(SELECT coalesce(json_agg(q ORDER BY row_to_json(q)::text),'[]'::json) FROM ri q),
 'dependencies',(SELECT coalesce(json_agg(q ORDER BY row_to_json(q)::text),'[]'::json) FROM edges q));
ROLLBACK;