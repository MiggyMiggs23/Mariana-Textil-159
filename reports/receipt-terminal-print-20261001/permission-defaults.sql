-- Prepared only. Do not execute on the live database without separate authorization.
-- Only this module; retain every explicit role customization and all user/site overrides.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
INSERT INTO permisos_rol
  (rol, modulo, puede_ver, puede_crear, puede_editar, puede_autorizar)
SELECT rol, 'recibos_abonos', rol IN ('ADMIN','TERMINAL'), false, false, false
FROM unnest(enum_range(NULL::rol_usuario)) AS rol
ON CONFLICT (rol, modulo) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver, puede_crear = false,
  puede_editar = false, puede_autorizar = false, updated_at = NOW()
WHERE permisos_rol.updated_por IS NULL;
COMMIT;