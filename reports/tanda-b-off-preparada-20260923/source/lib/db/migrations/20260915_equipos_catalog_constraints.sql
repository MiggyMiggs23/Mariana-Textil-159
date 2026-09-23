-- Equipos catalog constraint update.
--
-- Review and apply explicitly with the deployment migration process. This file
-- is intentionally not imported by application startup and must not be
-- replaced with drizzle-kit push.
--
-- The transaction changes only the two catalog-backed CHECK constraints. It
-- does not write equipment or checklist rows.

BEGIN;

ALTER TABLE equipos
  DROP CONSTRAINT IF EXISTS equipos_tipo_check;
ALTER TABLE equipos
  ADD CONSTRAINT equipos_tipo_check
  CHECK (
    tipo IN (
      'COMPUTADORA_POS',
      'IMPRESORA_ENTRADAS',
      'IMPRESORA_SALIDAS_NOTAS',
      'IMPRESORA_ETIQUETAS',
      'IMPRESORA_TICKETS',
      'PISTOLA_ESCANER',
      'SMARTPHONE_ESCANER'
    )
  );

ALTER TABLE equipos_checklist
  DROP CONSTRAINT IF EXISTS equipos_checklist_item_key_check;
ALTER TABLE equipos_checklist
  ADD CONSTRAINT equipos_checklist_item_key_check
  CHECK (
    item_key IN (
      'PAPEL_NAVEGADOR_80MM',
      'MARGENES_NINGUNO',
      'ESCALA_REAL',
      'IMPRESORA_PREDETERMINADA',
      'ENTRADA_REAL',
      'PAPEL_NAVEGADOR_CARTA',
      'SALIDA_REAL',
      'NOTA_REAL',
      'PAPEL_NAVEGADOR_A5',
      'PAPEL_COLOR_SITIO_BANDEJA',
      'ETIQUETA_REAL',
      'MEDIDA_100X70',
      'TICKET_REAL',
      'PAPEL_80MM',
      'TECLADO_ESPANOL',
      'QR_ROLLO',
      'SESION_CAMARA'
    )
  );

COMMIT;