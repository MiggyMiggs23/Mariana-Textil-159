-- Read-only. Operator must inspect valid existing key-prefix AND predicate
-- coverage before applying approved-indexes.sql; names alone do not prove absence.
SELECT current_database() AS database, current_user AS actor,
       inet_server_port() AS port;
SELECT n.nspname AS schema, t.relname AS relation, i.relname AS index,
       x.indisvalid, x.indisready, x.indisunique, x.indnkeyatts,
       pg_get_indexdef(i.oid) AS definition,
       pg_get_expr(x.indpred, x.indrelid) AS predicate,
       ARRAY(SELECT pg_get_indexdef(i.oid, k, true)
             FROM generate_series(1, x.indnkeyatts) k) AS keys
FROM pg_index x
JOIN pg_class i ON i.oid = x.indexrelid
JOIN pg_class t ON t.oid = x.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public' AND t.relname = 'tickets'
ORDER BY i.relname;