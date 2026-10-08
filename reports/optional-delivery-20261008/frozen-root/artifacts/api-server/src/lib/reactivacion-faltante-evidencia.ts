import { sql } from "drizzle-orm";
import type { Tx } from "./inventario";

type Row = Record<string, unknown>;
const numeric = (v: unknown) => v == null ? null : Number(v);
const text = (v: unknown) => v == null ? null : String(v);

/** Only an intact, latest whole-roll audit write-off is authoritative evidence. */
export function esBajaAuditoriaReactivable(input: {
  estado: string; cantidadActual: string; movimientoBajaId: number | null;
  ultimoMovimientoId: number | null; auditoriaConfirmada: boolean;
  cantidadAnterior: string | null; yaReactivada: boolean; yaRevertida: boolean;
}): boolean {
  return input.estado === "BAJA" && Number(input.cantidadActual) === 0 &&
    input.movimientoBajaId != null && input.ultimoMovimientoId === input.movimientoBajaId &&
    input.auditoriaConfirmada && input.cantidadAnterior != null &&
    Number(input.cantidadAnterior) > 0 && !input.yaReactivada && !input.yaRevertida;
}

export async function getReactivacionContexto(tx: Tx, rolloId: number) {
  const result = await tx.execute(sql`
    SELECT r.*, p.sku, p.tela, p.color, p.unidad, pr.nombre proveedor_nombre,
      e.folio entrada_folio, eu.iniciales entrada_iniciales,
      b.id movimiento_baja_id, b.cantidad cantidad_baja, b.ubicacion_id ubicacion_baja_id,
      bu.nombre ubicacion_baja, a.id auditoria_origen_id, a.estado auditoria_estado, a.cerrada_at,
      (SELECT max(m.id) FROM movimientos m WHERE m.rollo_id=r.id) ultimo_movimiento_id,
      EXISTS(SELECT 1 FROM auditoria_faltante_reactivaciones ar WHERE ar.movimiento_baja_id=b.id) ya_reactivada,
      EXISTS(SELECT 1 FROM movimientos mr WHERE mr.movimiento_origen_id=b.id) ya_revertida
    FROM rollos r JOIN productos p ON p.id=r.producto_id
    LEFT JOIN proveedores pr ON pr.id=r.proveedor_id
    LEFT JOIN entradas e ON e.id=r.recepcion_id
    LEFT JOIN ubicaciones eu ON eu.id=e.ubicacion_id
    LEFT JOIN LATERAL (
      SELECT m.* FROM movimientos m
      JOIN auditorias_inventario a0 ON m.documento_tipo='AUDITORIA_INVENTARIO' AND m.documento_id=a0.id::text
      JOIN auditoria_inventario_snapshot s ON s.auditoria_id=a0.id AND s.rollo_id=r.id AND s.resolucion='APLICADA'
      WHERE m.rollo_id=r.id AND m.tipo='AJUSTE_NEGATIVO' AND m.cantidad < 0
        AND NOT EXISTS(SELECT 1 FROM auditoria_inventario_escaneos es WHERE es.auditoria_id=a0.id AND es.serie=s.serie)
      ORDER BY m.id DESC LIMIT 1
    ) b ON true
    LEFT JOIN auditorias_inventario a ON a.id::text=b.documento_id
    LEFT JOIN ubicaciones bu ON bu.id=b.ubicacion_id
    WHERE r.id=${rolloId}
  `);
  const row = result.rows[0] as Row | undefined;
  if (!row) return null;
  // PostgreSQL numeric text is retained; sign stripping never measures or rounds.
  const cantidadAnterior = row.cantidad_baja == null ? null : String(row.cantidad_baja).replace(/^-/, "");
  const elegible = esBajaAuditoriaReactivable({
    estado: String(row.estado), cantidadActual: String(row.cantidad_actual),
    movimientoBajaId: numeric(row.movimiento_baja_id), ultimoMovimientoId: numeric(row.ultimo_movimiento_id),
    auditoriaConfirmada: row.auditoria_estado === "CONFIRMADA", cantidadAnterior,
    yaReactivada: row.ya_reactivada === true, yaRevertida: row.ya_revertida === true,
  });
  const posteriores = row.cerrada_at == null ? [] : (await tx.execute(sql`
    SELECT id, ubicacion_id, folio, cerrada_at FROM auditorias_inventario
    WHERE estado IN ('CERRADA','CONFIRMADA') AND cerrada_at > ${row.cerrada_at instanceof Date ? row.cerrada_at : new Date(String(row.cerrada_at))}
      AND id <> ${Number(row.auditoria_origen_id)}
    ORDER BY cerrada_at, id
  `)).rows as Row[];
  return {
    rolloId, serie: String(row.serie), elegible,
    bloqueo: elegible ? null : "Solo puede reactivarse una baja íntegra de faltante de auditoría, sin movimientos posteriores ni reverso previo.",
    auditoriaOrigenId: numeric(row.auditoria_origen_id), movimientoBajaId: numeric(row.movimiento_baja_id), cantidadAnterior,
    producto: `${row.sku} · ${row.tela} · ${row.color}`, unidad: String(row.unidad),
    costoUnitario: text(row.costo_unitario), recepcionId: numeric(row.recepcion_id),
    entradaFolio: row.entrada_folio == null ? null : `${row.entrada_iniciales}-${String(row.entrada_folio).padStart(6, "0")}`,
    proveedorId: numeric(row.proveedor_id), proveedorNombre: text(row.proveedor_nombre),
    ubicacionBajaId: numeric(row.ubicacion_baja_id), ubicacionBaja: text(row.ubicacion_baja),
    auditoriasPosteriores: posteriores.map((a) => ({ id: Number(a.id), ubicacionId: Number(a.ubicacion_id), folio: Number(a.folio), cerradaAt: new Date(String(a.cerrada_at)).toISOString() })),
  };
}