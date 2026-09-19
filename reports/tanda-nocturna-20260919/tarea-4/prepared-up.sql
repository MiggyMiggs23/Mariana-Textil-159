-- PREPARADO SOLAMENTE. Sin registro de migración/startup; NO ejecutar.
-- No modifica SELECT * de esquemas Drizzle existentes.
BEGIN;
CREATE TABLE tarea4_rollo_remate (
  rollo_id integer PRIMARY KEY REFERENCES rollos(id),
  motivo text NOT NULL CHECK (length(btrim(motivo)) > 0),
  usuario_id integer NOT NULL REFERENCES usuarios(id),
  creado_en timestamptz NOT NULL DEFAULT now()
);
-- Sin filas para otros roles => denegación por defecto. ADMIN mantiene bypass.
-- El módulo marcar_remate / autorizar usa la matriz existente sin nuevos enums.
-- Sin backfill, sin usuarios/sesiones, sin cambios a datos operativos.
COMMIT;