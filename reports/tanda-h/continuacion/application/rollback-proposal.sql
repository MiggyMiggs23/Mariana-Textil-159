-- PROPOSAL ONLY. NOT EXECUTED. Requires fresh authorization and catalog review.
-- No data restore: these are additive indexes, not a row-changing migration.
-- Drop only an index confirmed newly created by this operator, never an idempotent skip.
SET lock_timeout = '3s';
SET statement_timeout = '60s';
DROP INDEX CONCURRENTLY public.tickets_contabilizados_sitio_fecha_ga_candidate;
DROP INDEX CONCURRENTLY public.tickets_pendientes_corte_ga_candidate;