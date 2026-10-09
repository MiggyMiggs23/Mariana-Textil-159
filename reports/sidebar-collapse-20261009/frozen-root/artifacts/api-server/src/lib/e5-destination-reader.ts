import { E5_ENABLED } from "./e5-feature";

/**
 * Additive rows for the existing destination cash-flow CTE ($1/$2 dates, $3 site).
 * Document identity is CLIENTE; e5CobroId is the actual immutable receipt UUID.
 * No application row is money. Fondo is deliberately absent from account flows.
 */
export function e5DestinationRows(enabled = E5_ENABLED): string {
  if (!enabled) return "";
  return `
    UNION ALL
    SELECT r.cliente_id, r.fecha_recepcion, r.importe, r.medio::text, r.cuenta_destino::text,
      r.cliente_id, NULL::bigint, r.cliente_id, NULL::bigint, r.ubicacion_id,
      r.actor_id, false, 'E5_RECEPCION'::text, r.id::text
    FROM e5_recepciones r
    WHERE ($1::timestamptz IS NULL OR r.fecha_recepcion >= $1)
      AND ($2::timestamptz IS NULL OR r.fecha_recepcion <= $2)
      AND ($3::int IS NULL OR r.ubicacion_id=$3)
    UNION ALL
    SELECT r.cliente_id, s.created_at, -d.importe, 'EFECTIVO'::text, 'CAJA_FISICA'::text,
      r.cliente_id, NULL::bigint, r.cliente_id, NULL::bigint,
      (d.fuente->>'ubicacionId')::int, d.actor_id, false, 'E5_DEVOLUCION'::text, r.id::text
    FROM e5_devoluciones d JOIN e5_recepciones r ON r.id=d.cobro_id
    JOIN salidas_dinero_caja s ON s.id=d.salida_id
    WHERE d.fuente->>'tipo'='CAJA'
      AND ($1::timestamptz IS NULL OR s.created_at >= $1)
      AND ($2::timestamptz IS NULL OR s.created_at <= $2)
      AND ($3::int IS NULL OR (d.fuente->>'ubicacionId')::int=$3)
    UNION ALL
    SELECT r.cliente_id, b.created_at, -b.importe, 'TRANSFERENCIA'::text, b.cuenta_origen::text,
      r.cliente_id, NULL::bigint, r.cliente_id, NULL::bigint, b.ubicacion_id,
      b.actor_id, false, 'E5_DEVOLUCION'::text, r.id::text
    FROM e5_salidas_bancarias b JOIN e5_recepciones r ON r.id=b.cobro_id
    JOIN e5_devoluciones d ON d.clave=b.clave AND d.cobro_id=b.cobro_id
    WHERE d.fuente->>'tipo'='CUENTA'
      AND ($1::timestamptz IS NULL OR b.created_at >= $1)
      AND ($2::timestamptz IS NULL OR b.created_at <= $2)
      AND ($3::int IS NULL OR b.ubicacion_id=$3)`;
}