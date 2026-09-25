-- MAIN review required. Align SQL JSON type with E11 DTO's string folioFactura.
-- No monetary writes, row rewrites, filter changes or historical reconstruction.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $fix$
DECLARE definition text;
BEGIN
  definition := pg_get_functiondef('public.e11_fuente(date,date)'::regprocedure);
  IF md5(definition) <> '1bc4ce76198842b37802ab29a8a4d013'
    OR position($old$'facturaId',t.id,'ventaId',t.id,'folioFactura',t.folio,$old$ in definition)=0
  THEN RAISE EXCEPTION 'E11 fiscal source differs from reviewed current definition'; END IF;
  definition := replace(definition,
    $old$'facturaId',t.id,'ventaId',t.id,'folioFactura',t.folio,$old$,
    $new$'facturaId',t.id,'ventaId',t.id,'folioFactura',t.folio::text,$new$);
  EXECUTE definition;
END $fix$;
COMMIT;