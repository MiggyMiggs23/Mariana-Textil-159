BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TEMP TABLE reviewed_target (
  database_name text NOT NULL,
  schema_name text NOT NULL CHECK (schema_name = 'public')
) ON COMMIT DROP;
INSERT INTO reviewed_target VALUES ('heliumdb', 'public');

CREATE TEMP TABLE reviewed_floor_levels (
  id integer PRIMARY KEY,
  ubicacion_id integer NOT NULL,
  nombre text NOT NULL,
  activo boolean NOT NULL,
  nivel integer NOT NULL
) ON COMMIT DROP;
-- Insert the FULL freshly verified catalog here, by exact ID/site/name/active
-- snapshot and reviewed numeric rank. Names verify identity, NEVER derive rank.
INSERT INTO reviewed_floor_levels VALUES (1,2,'Planta Baja',true,0),
(2,2,'Planta Alta',true,1),
(3,1,'Planta Baja',true,0),
(4,1,'Planta Alta',true,1),
(5,3,'Planta Baja',true,0),
(6,3,'Planta Alta',true,1),
(7,4,'Primer Piso',true,1),
(8,4,'Segundo Piso',true,2),
(9,4,'Tercer Piso',true,3),
(10,5,'Planta Baja',true,0),
(11,5,'Primer Piso',true,1),
(12,5,'Segundo Piso',true,2),
(13,5,'Tercer Piso',true,3);
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

LOCK TABLE public.ubicaciones IN SHARE MODE;
CREATE TEMP TABLE reviewed_sites(id integer primary key,nombre text,activa boolean) ON COMMIT DROP;
INSERT INTO reviewed_sites VALUES (1,'Mariana',true),
(2,'Cruces',true),
(3,'Coco',true),
(4,'Tomás',true),
(5,'Don Nacho',true),
(6,'Lucas Alamán',false),
(7,'Bodega Cruces',false),
(8,'En tránsito',true),
(9,'Externo',true),
(458,'UbSAT SA1787447615051_6',false),
(531,'UbSAT SA1787447882698_6',false);
DO $guard$ BEGIN
 IF (SELECT count(*) FROM public.pisos) <> 13 OR (SELECT count(*) FROM public.ubicaciones) <> 11
 OR EXISTS(SELECT 1 FROM public.ubicaciones u FULL JOIN reviewed_sites r USING(id)
 WHERE u.id IS NULL OR r.id IS NULL OR u.nombre IS DISTINCT FROM r.nombre OR u.activa IS DISTINCT FROM r.activa)
 THEN RAISE EXCEPTION 'Site/catalog count or identity mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.pisos'::regclass AND NOT tgisinternal)
 THEN RAISE EXCEPTION 'Unexpected floor trigger'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pisos' AND column_name='nivel')
 THEN RAISE EXCEPTION 'Expected additive migration; nivel already exists'; END IF;
END $guard$;
CREATE TEMP TABLE preserved_floors ON COMMIT DROP AS SELECT to_jsonb(p) AS row FROM public.pisos p;
CREATE TEMP TABLE preserved_sites ON COMMIT DROP AS SELECT to_jsonb(u) AS row FROM public.ubicaciones u;

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


DO $preserve$ BEGIN
 IF EXISTS((SELECT to_jsonb(p)-'nivel' FROM public.pisos p EXCEPT SELECT row FROM preserved_floors)
 UNION ALL (SELECT row FROM preserved_floors EXCEPT SELECT to_jsonb(p)-'nivel' FROM public.pisos p))
 THEN RAISE EXCEPTION 'Existing floor values changed'; END IF;
 IF EXISTS((SELECT to_jsonb(u) FROM public.ubicaciones u EXCEPT SELECT row FROM preserved_sites)
 UNION ALL (SELECT row FROM preserved_sites EXCEPT SELECT to_jsonb(u) FROM public.ubicaciones u))
 THEN RAISE EXCEPTION 'Existing site values changed'; END IF;
 IF EXISTS(SELECT 1 FROM public.pisos p JOIN reviewed_floor_levels r USING(id) WHERE p.nivel IS DISTINCT FROM r.nivel)
 THEN RAISE EXCEPTION 'Mapping mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pisos'
 AND column_name='nivel' AND data_type='integer' AND is_nullable='YES' AND column_default IS NULL)
 THEN RAISE EXCEPTION 'Unexpected column definition'; END IF;
 IF EXISTS(SELECT 1 FROM pg_stat_xact_user_tables WHERE schemaname='public' AND relname<>'pisos'
 AND (n_tup_ins<>0 OR n_tup_upd<>0 OR n_tup_del<>0))
 THEN RAISE EXCEPTION 'Non-floor write in migration transaction'; END IF;
END $preserve$;

COMMIT;
