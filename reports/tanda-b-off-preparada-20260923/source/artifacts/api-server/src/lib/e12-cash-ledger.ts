import { sql, type SQL } from "drizzle-orm";
import { E12_SUPPLIER_CASH_ENABLED, type E12ReturnKind } from "./e12-supplier-cash";
import type { CashDocument } from "./caja-cash-ledger";
export type E12Executor = { execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }> };
export async function readE12Returns(database: E12Executor, sessionId: number, enabled = E12_SUPPLIER_CASH_ENABLED): Promise<CashDocument[]> {
  if (!enabled) return [];
  const result = await database.execute(sql`SELECT r.*, p.proveedor_id
    FROM caja_retornos_proveedor_e12 r JOIN pagos_proveedor p ON p.id=r.pago_proveedor_id
    WHERE r.sesion_caja_id=${sessionId} ORDER BY r.id`);
  return result.rows.map(row => ({
    origen: "RETORNO_PROVEEDOR", id: String(row.id), folio: null, importe: String(row.importe), href: null,
    evidencia: { referencia: `Retorno proveedor / pago #${row.pago_proveedor_id}`,
      motivo: String(row.motivo), fecha: new Date(row.created_at as string).toISOString(),
      usuarioId: Number(row.usuario_id), proveedorId: Number(row.proveedor_id),
      naturalezaRetornoE12: row.naturaleza as E12ReturnKind },
  }));
}