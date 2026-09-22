-- PREPARADO / NO EJECUTADO. Nunca borra historia ni revierte dinero.
BEGIN;
SET LOCAL lock_timeout='5s';
LOCK TABLE e9_entregas,e9_operaciones IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM e9_entregas) OR EXISTS (SELECT 1 FROM e9_operaciones)
    OR EXISTS (SELECT 1 FROM auditoria WHERE accion LIKE 'E9_%')
    OR EXISTS (SELECT 1 FROM fondo_movimientos WHERE motivo LIKE 'Recepción E9 %')
  THEN RAISE EXCEPTION 'E9: hay evidencia; reversión DDL prohibida'; END IF;
END; $$;
DROP TRIGGER e9_fondo_receipt ON fondo_movimientos;
DROP TABLE e9_operaciones;
DROP TABLE e9_entregas;
DROP FUNCTION e9_fondo_guard();
DROP FUNCTION e9_operation_guard();
DROP FUNCTION e9_event_guard();
DROP FUNCTION e9_validate_detail();
DROP FUNCTION e9_evidence_valid(jsonb);
DROP FUNCTION e9_immutable();
COMMIT;