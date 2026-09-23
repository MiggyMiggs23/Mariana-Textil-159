BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='2s';
SELECT json_build_object(
 'database',current_database(),
 'databaseOid',(SELECT oid::text FROM pg_database WHERE datname=current_database()),
 'schema',current_schema(),'role',current_user,
 'serverVersionNum',current_setting('server_version_num'),
 'readOnly',current_setting('transaction_read_only'),
 'enabledEventTriggers',(SELECT count(*) FROM pg_event_trigger WHERE evtenabled<>'D'),
 'schemaRows',(SELECT coalesce(json_agg(row_to_json(q)),'[]'::json) FROM (
  SELECT kind,schema_name,object_name,parent_name,definition FROM (
   SELECT 'table' kind,n.nspname schema_name,c.relname object_name,'' parent_name,
    concat(c.relkind,':',pg_get_userbyid(c.relowner),':',coalesce(c.relacl::text,'')) definition
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p')
   UNION ALL SELECT 'column',n.nspname,c.relname,a.attname,
    concat(format_type(a.atttypid,a.atttypmod),':',a.attnotnull,':',coalesce(pg_get_expr(d.adbin,d.adrelid),''))
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attnum>0 AND NOT a.attisdropped AND c.relkind IN ('r','p')
   UNION ALL SELECT 'constraint',n.nspname,con.conname,c.relname,pg_get_constraintdef(con.oid,true)
    FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   UNION ALL SELECT 'index',n.nspname,i.relname,t.relname,pg_get_indexdef(i.oid)
    FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_class t ON t.oid=x.indrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
   UNION ALL SELECT 'function',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),pg_get_functiondef(p.oid)
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   UNION ALL SELECT 'trigger',n.nspname,t.tgname,c.relname,pg_get_triggerdef(t.oid,true)
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE NOT t.tgisinternal
   UNION ALL SELECT 'sequence',schemaname,sequencename,'',
    concat(data_type,':',start_value,':',min_value,':',max_value,':',increment_by,':',cycle,':',cache_size)
    FROM pg_sequences
  ) inventory WHERE schema_name NOT IN ('pg_catalog','information_schema')
    AND schema_name !~ '^pg_(toast|temp)'
  ORDER BY kind,schema_name,object_name,parent_name,definition
 ) q),
 'attributes',(SELECT coalesce(json_agg(row_to_json(q)),'[]'::json) FROM (
  SELECT 'trigger' kind,c.relname parent,t.tgname name,
   concat(t.tgenabled,':',t.tgtype,':',t.tgdeferrable,':',t.tginitdeferred,':',t.tgisinternal) definition
   FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND NOT t.tgisinternal
  UNION ALL SELECT 'function',pg_get_function_identity_arguments(p.oid),p.proname,
   concat(pg_get_userbyid(p.proowner),':',p.prokind,':',p.provolatile,':',p.proparallel,':',p.prosecdef,':',
    p.proleakproof,':',p.proisstrict,':',p.proretset,':',coalesce(p.proacl::text,''),':',coalesce(p.proconfig::text,''))
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
  UNION ALL SELECT 'index',c.relname,i.relname,concat(x.indisvalid,':',x.indisready,':',x.indisunique)
   FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_class c ON c.oid=x.indrelid
   JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
  UNION ALL SELECT 'constraint',c.relname,t.conname,concat(t.convalidated,':',t.condeferrable,':',t.condeferred)
   FROM pg_constraint t JOIN pg_class c ON c.oid=t.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public'
  UNION ALL SELECT 'table',c.relname,'security',concat(c.relrowsecurity,':',c.relforcerowsecurity,':',c.relreplident)
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')
  UNION ALL SELECT 'enum',t.typname,e.enumlabel,e.enumsortorder::text
   FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'
  ORDER BY kind,parent,name,definition
 ) q)
);
ROLLBACK;