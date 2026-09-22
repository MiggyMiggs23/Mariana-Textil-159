-- PREPARADO, NO EJECUTADO. Solo revierte DDL E12 si NUNCA hubo evidencia.
-- Nunca eliminar pagos, egresos, Fondo, auditorías ni aplicaciones financieras.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE proveedor_operaciones_e12,proveedor_solicitudes_e12,caja_retornos_proveedor_e12,
  caja_desbloqueos_e12,proveedor_efectivo_e12 IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM proveedor_operaciones_e12) OR EXISTS (SELECT 1 FROM proveedor_solicitudes_e12)
    OR EXISTS (SELECT 1 FROM caja_retornos_proveedor_e12) OR EXISTS (SELECT 1 FROM caja_desbloqueos_e12)
    OR EXISTS (SELECT 1 FROM proveedor_efectivo_e12)
  THEN RAISE EXCEPTION 'E12: existe evidencia; no se revierte DDL ni se borra histórico'; END IF;
END $$;
DROP TRIGGER e12_supplier_inverse ON pagos_proveedor;
DROP TRIGGER e12_fund_inverse ON fondo_movimientos;
DROP TABLE proveedor_efectivo_e12;
DROP TABLE caja_desbloqueos_e12;
DROP TABLE caja_retornos_proveedor_e12;
DROP TABLE proveedor_solicitudes_e12;
DROP TABLE proveedor_operaciones_e12;
DROP FUNCTION e12_inverse_guard();
DROP FUNCTION e12_cash_return_guard();
DROP FUNCTION e12_pago_guard();
DROP FUNCTION e12_override_guard();
DROP FUNCTION e12_immutable();
COMMIT;