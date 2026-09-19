-- PREPARADO SOLAMENTE. Reversión admitida solo antes de uso.
-- No destruye una marca/auditoría operativa; con datos requiere otra decisión.
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM tarea4_rollo_remate) THEN
    RAISE EXCEPTION 'Reversión detenida: existen marcas de remate';
  END IF;
  IF EXISTS (SELECT 1 FROM permisos_rol WHERE modulo = 'marcar_remate')
     OR EXISTS (SELECT 1 FROM permisos_usuario WHERE modulo = 'marcar_remate')
     OR EXISTS (SELECT 1 FROM permisos_ubicacion WHERE modulo = 'marcar_remate') THEN
    RAISE EXCEPTION 'Reversión detenida: existen permisos configurados';
  END IF;
END $$;
DROP TABLE tarea4_rollo_remate;
COMMIT;