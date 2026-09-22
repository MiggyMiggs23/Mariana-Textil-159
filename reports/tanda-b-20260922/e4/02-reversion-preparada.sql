-- E4 PREPARADO. NO EJECUTADO.
-- Primero volver gate fuente OFF. Si hay evidencia, conservar esquema y egresos:
-- este rollback aborta deliberadamente; no purga ni inventa devoluciones.
BEGIN;
LOCK TABLE caja_salidas_e4, caja_salidas_e4_operaciones IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM caja_salidas_e4) OR EXISTS (SELECT 1 FROM caja_salidas_e4_operaciones) THEN
    RAISE EXCEPTION 'E4 tiene evidencia: conservar esquema; solo reversión de código OFF';
  END IF;
END $$;
DROP TRIGGER caja_salidas_e4_expense_guard_trg ON salidas_dinero_caja;
DROP FUNCTION caja_salidas_e4_expense_guard();
DROP TABLE caja_salidas_e4_operaciones;
DROP TABLE caja_salidas_e4;
DROP FUNCTION caja_salidas_e4_immutable();
DROP FUNCTION caja_salidas_e4_guard();
COMMIT;