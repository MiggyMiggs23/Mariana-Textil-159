-- E10 isolated-copy supplement: statement-level TRUNCATE immutability.
-- Apply only after operativo.sql when its three tables already exist.
BEGIN;
SET LOCAL search_path TO public, pg_catalog;

CREATE TRIGGER fondo_mariana_immutable_before_truncate
  BEFORE TRUNCATE ON fondo_mariana
  FOR EACH STATEMENT EXECUTE FUNCTION fondo_reject_mutation();
CREATE TRIGGER fondo_movimientos_immutable_before_truncate
  BEFORE TRUNCATE ON fondo_movimientos
  FOR EACH STATEMENT EXECUTE FUNCTION fondo_reject_mutation();
CREATE TRIGGER fondo_arqueos_immutable_before_truncate
  BEFORE TRUNCATE ON fondo_arqueos
  FOR EACH STATEMENT EXECUTE FUNCTION fondo_reject_mutation();

COMMIT;