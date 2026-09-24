-- Operator-only; NEVER loaded by application startup.
-- Preconditions: operator has independently verified target database identity,
-- rollback point, deployment window, and approval. Repeats quantity/catalog
-- preflight under lock. Expected effect: one validated CHECK on public.rollos;
-- no row writes, no ledger changes, no repairs, no NOT VALID intermediate state.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog;
LOCK TABLE public.rollos IN ACCESS EXCLUSIVE MODE;
DO $operator$
DECLARE
  existing record;
  quantity_attnum smallint;
BEGIN
  SELECT attnum INTO quantity_attnum
  FROM pg_catalog.pg_attribute
  WHERE attrelid = 'public.rollos'::regclass AND attname = 'cantidad_actual'
    AND NOT attisdropped AND attnotnull
    AND atttypid = 'numeric'::regtype AND atttypmod = 655367;
  IF quantity_attnum IS NULL THEN
    RAISE EXCEPTION 'Physical quantity type drift: expected NOT NULL numeric(10,3)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.rollos
    WHERE cantidad_actual IS NULL OR cantidad_actual < 0
       OR cantidad_actual IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  ) THEN
    RAISE EXCEPTION 'Invalid existing physical quantities; operator review required; no automatic repair';
  END IF;
  SELECT c.*, pg_catalog.pg_get_constraintdef(c.oid, false) AS definition
  INTO existing FROM pg_catalog.pg_constraint c
  WHERE c.conrelid = 'public.rollos'::regclass
    AND c.conname = 'rollos_physical_quantity_nonnegative_check';
  IF FOUND THEN
    IF existing.contype <> 'c' OR NOT existing.convalidated
       OR existing.connoinherit OR existing.conkey <> ARRAY[quantity_attnum]
       OR existing.definition <> 'CHECK (((cantidad_actual >= (0)::numeric) AND (cantidad_actual <> ''NaN''::numeric)))'
    THEN
      RAISE EXCEPTION 'Physical quantity CHECK catalog drift; refusing to replace existing object';
    END IF;
  ELSE
    ALTER TABLE public.rollos
      ADD CONSTRAINT rollos_physical_quantity_nonnegative_check
      CHECK (cantidad_actual >= 0 AND cantidad_actual <> 'NaN'::numeric);
  END IF;
END
$operator$;
COMMIT;