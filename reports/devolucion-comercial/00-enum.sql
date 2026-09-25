-- Candidate only. MAIN rehearses first. No BEGIN: enum label must commit before
-- 01-schema.sql references it. This does not enable any producer.
ALTER TYPE public.tipo_movimiento_credito ADD VALUE IF NOT EXISTS 'DEVOLUCION_COMERCIAL';