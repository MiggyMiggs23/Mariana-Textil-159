-- PROPOSALS ONLY. NOT EXECUTED, not a migration.
-- No measured workload exceeded 2 s; these are candidates for a separate
-- authorized A/B experiment, not demonstrated missing-index defects.
-- Avoid applying both pending-ticket alternatives without testing overlap.

-- Pending cashier list: site + pending subset + latest-first access.
CREATE INDEX CONCURRENTLY tickets_pendientes_sitio_fecha_ga_candidate
ON public.tickets (ubicacion_id, created_at DESC, id)
WHERE cobrado = false;

-- Cut: 17,338 rows removed after site bitmap lookup in measured plan.
CREATE INDEX CONCURRENTLY tickets_pendientes_corte_ga_candidate
ON public.tickets (ubicacion_id, created_at, id)
WHERE estado = 'VENDIDO'
  AND ((documento_tipo = 'TICKET' AND cobrado = false)
    OR (documento_tipo = 'NOTA' AND autorizacion_estado = 'PENDIENTE'));

-- Account ledger: extends existing (cliente_id, created_at) with stable ID.
-- Heavy customer covers nearly all ledger rows here, so planner may still
-- prefer sequential scan/hash join/sort. No guaranteed improvement.
CREATE INDEX CONCURRENTLY movimientos_credito_cliente_fecha_id_ga_candidate
ON public.movimientos_credito (cliente_id, created_at, id);

-- Available stock, especially one-site queries; existing site/product index
-- is not partial and does not cover quantity/id.
CREATE INDEX CONCURRENTLY rollos_disponibles_sitio_producto_ga_candidate
ON public.rollos (ubicacion_id, producto_id)
INCLUDE (id, cantidad_actual)
WHERE estado = 'DISPONIBLE';

-- Narrower date-window report candidate. Annual scan of almost all rows
-- will often remain the right plan; do not force an index.
CREATE INDEX CONCURRENTLY tickets_contabilizados_sitio_fecha_ga_candidate
ON public.tickets
  (ubicacion_id, (CASE WHEN documento_tipo = 'TICKET' THEN cobrado_at ELSE autorizado_at END))
WHERE estado = 'VENDIDO'
  AND ((documento_tipo = 'TICKET' AND cobrado = true)
    OR (documento_tipo = 'NOTA' AND autorizacion_estado = 'AUTORIZADA'));