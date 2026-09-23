-- MAIN únicamente: aplicar antes del build ON. Sin datos operativos/backfill.
BEGIN;
CREATE TABLE tarea4_rollo_remate (
  rollo_id integer PRIMARY KEY REFERENCES rollos(id),
  motivo text NOT NULL CHECK (length(btrim(motivo)) > 0),
  usuario_id integer NOT NULL REFERENCES usuarios(id),
  creado_en timestamptz NOT NULL DEFAULT now()
);
-- No insertar/actualizar permisos: ADMIN conserva acceso completo y la ausencia
-- de filas deniega al resto. Toda personalización existente permanece intacta.
COMMIT;