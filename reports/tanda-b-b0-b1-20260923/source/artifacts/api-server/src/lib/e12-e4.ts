import { sql } from "drizzle-orm";
import type { Tx } from "./inventario";
import type { E4Repository } from "./e4-cash-out";
import { E12_SUPPLIER_CASH_ENABLED, e12CashGuard, type E12Override } from "./e12-supplier-cash";
import { e12CashBalance } from "./e12-supplier-cash-repository";
/** Attached only to the real E4 capture producer; review never authorizes money. */
export function e12E4Hooks(tx: Tx) {
  let override: E12Override | null = null;
  let ip = "";
  return {
    async beforeInsert(input: Parameters<E4Repository["insert"]>[0], actor: Parameters<E4Repository["insert"]>[1]) {
      if (!E12_SUPPLIER_CASH_ENABLED || input.cuentaOrigen !== "CAJA_FISICA") return;
      ip = input.ip;
      override = e12CashGuard(await e12CashBalance(tx, input.sesionCajaId), input.monto, actor, input.desbloqueoCajaE12);
    },
    async afterInsert(id: number) {
      if (!override) return;
      await tx.execute(sql`INSERT INTO caja_desbloqueos_e12 (salida_id,evidencia) VALUES (${id},${JSON.stringify(override)}::jsonb)`);
      await tx.execute(sql`INSERT INTO auditoria (usuario_id,accion,entidad,entidad_id,datos_despues,ip)
        VALUES (${override.usuarioId},'DESBLOQUEAR_CAJA_E12','salidas_dinero_caja',${String(id)},${JSON.stringify(override)}::jsonb,${ip})`);
    },
  };
}