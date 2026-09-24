-- Operator-only allowlist, COPY first. Do not run through schema push.
-- Exact two statements selected from tanda-g-ampliada/tarea-4/proposed-indexes.sql.
-- No cashier, ledger, stock, or roll-constraint changes.
CREATE INDEX CONCURRENTLY tickets_pendientes_corte_ga_candidate
ON public.tickets (ubicacion_id, created_at, id)
WHERE estado = 'VENDIDO'
  AND ((documento_tipo = 'TICKET' AND cobrado = false)
    OR (documento_tipo = 'NOTA' AND autorizacion_estado = 'PENDIENTE'));

CREATE INDEX CONCURRENTLY tickets_contabilizados_sitio_fecha_ga_candidate
ON public.tickets
  (ubicacion_id, (CASE WHEN documento_tipo = 'TICKET' THEN cobrado_at ELSE autorizado_at END))
WHERE estado = 'VENDIDO'
  AND ((documento_tipo = 'TICKET' AND cobrado = true)
    OR (documento_tipo = 'NOTA' AND autorizacion_estado = 'AUTORIZADA'));