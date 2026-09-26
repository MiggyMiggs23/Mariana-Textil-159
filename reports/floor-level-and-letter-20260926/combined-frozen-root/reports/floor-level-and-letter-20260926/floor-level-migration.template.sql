-- REVIEW TEMPLATE ONLY. NOT APPLIED. Do not run against an unconfirmed connection.
-- First confirm endpoint/database/schema with the owner and capture an immutable
-- read-only snapshot of every site/floor (including inactive rows and empty sites).
-- Database name alone is NOT sufficient proof of endpoint identity.
-- This script intentionally fails until both review tables are populated.
-- Keep the API stopped/inspection-only until the reviewed migration is committed.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TEMP TABLE reviewed_target (
  database_name text NOT NULL,
  schema_name text NOT NULL CHECK (schema_name = 'public')
) ON COMMIT DROP;
-- INSERT INTO reviewed_target VALUES ('OWNER_CONFIRMED_DATABASE', 'public');

CREATE TEMP TABLE reviewed_floor_levels (
  id integer PRIMARY KEY,
  ubicacion_id integer NOT NULL,
  nombre text NOT NULL,
  activo boolean NOT NULL,
  nivel integer NOT NULL
) ON COMMIT DROP;
-- Insert the FULL freshly verified catalog here, by exact ID/site/name/active
-- snapshot and reviewed numeric rank. Names verify identity, NEVER derive rank.
-- INSERT INTO reviewed_floor_levels VALUES (...);
-- OBSERVATION ONLY, NOT AUTHORIZATION OR EXECUTABLE BACKFILL:
-- heliumdb snapshot ID=rank: 1=0,2=1,3=0,4=1,5=0,6=1,7=1,8=2,9=3,
-- 10=0,11=1,12=2,13=3. This is NOT the confirmed prior application DB.
-- Two inactive sites in that snapshot have no floors; do not fabricate floors.

DO $review$
BEGIN
  IF (SELECT count(*) FROM reviewed_target) <> 1
     OR NOT EXISTS (SELECT 1 FROM reviewed_target WHERE database_name = current_database()) THEN
    RAISE EXCEPTION 'Missing or mismatched independently confirmed target';
  END IF;
  IF to_regclass('public.pisos') IS NULL THEN
    RAISE EXCEPTION 'Expected floor catalog missing: stop, do not create/seed a replacement';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM reviewed_floor_levels) THEN
    RAISE EXCEPTION 'Explicit reviewed floor mapping required';
  END IF;
END $review$;

LOCK TABLE public.pisos IN ACCESS EXCLUSIVE MODE;
DO $review$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.pisos p FULL JOIN reviewed_floor_levels r USING (id)
    WHERE p.id IS NULL OR r.id IS NULL
       OR p.ubicacion_id IS DISTINCT FROM r.ubicacion_id
       OR p.nombre IS DISTINCT FROM r.nombre
       OR p.activo IS DISTINCT FROM r.activo
  ) THEN
    RAISE EXCEPTION 'Catalog differs from reviewed full snapshot; re-review';
  END IF;
END $review$;

ALTER TABLE public.pisos ADD COLUMN IF NOT EXISTS nivel integer;
DO $review$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.pisos p JOIN reviewed_floor_levels r USING (id)
    WHERE p.nivel IS NOT NULL AND p.nivel <> r.nivel
  ) THEN
    RAISE EXCEPTION 'Previously configured level differs; explicit re-review required';
  END IF;
END $review$;
UPDATE public.pisos p SET nivel = r.nivel
FROM reviewed_floor_levels r WHERE p.id = r.id AND p.nivel IS NULL;
SELECT id, ubicacion_id, nombre, activo, nivel
FROM public.pisos ORDER BY ubicacion_id, nivel, id;

-- Later, only after complete catalog backfill AND every writer/initializer/test
-- fixture supplies an explicit nivel, approve this separate constraint change:
-- ALTER TABLE public.pisos ALTER COLUMN nivel SET NOT NULL;
-- Equal levels remain permitted with id ASC tie-break. No per-site UNIQUE added.
-- No runtime default/backfill/name matching. Empty sites remain visibly blocked.
ROLLBACK;
-- Replace ROLLBACK with COMMIT only in the separately authorized reviewed copy.