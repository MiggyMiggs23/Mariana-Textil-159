import { sql } from "drizzle-orm";
import { db, type RolUsuario } from "@workspace/db";
import { resolvePermiso } from "./permisos";
import type { RemateActor, RemateStore } from "./tarea4-remate";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Transactional adapter. Scope is supplied by the inventory route's
 * canonical site authorizer; it must use this transaction, not a stale preflight.
 * No call and no schema registration occur during startup.
 */
export function createRemateStore(
  accessible: (tx: Tx, actor: RemateActor, roll: { id: number; ubicacion_id: number }) => Promise<boolean>,
  ip: string,
): RemateStore {
  return {
    transaction: work => db.transaction(tx => work({
      allowed: async actor => Boolean((await resolvePermiso(
        actor.id, actor.rol as RolUsuario, "marcar_remate", tx,
      ))?.puedeAutorizar),
      lockAccessibleRoll: async (actor, id) => {
        const result = await tx.execute(sql`SELECT id, ubicacion_id FROM rollos WHERE id = ${id} FOR UPDATE`);
        const roll = result.rows[0] as { id: number; ubicacion_id: number } | undefined;
        return Boolean(roll && await accessible(tx, actor, roll));
      },
      markExists: async id => (await tx.execute(
        sql`SELECT rollo_id FROM tarea4_rollo_remate WHERE rollo_id = ${id}`,
      )).rows.length > 0,
      insertMark: async mark => {
        await tx.execute(sql`INSERT INTO tarea4_rollo_remate (rollo_id, motivo, usuario_id)
          VALUES (${mark.rolloId}, ${mark.motivo}, ${mark.usuarioId})`);
      },
      removeMark: async id => {
        await tx.execute(sql`DELETE FROM tarea4_rollo_remate WHERE rollo_id = ${id}`);
      },
      audit: async (mark, removed) => {
        await tx.execute(sql`INSERT INTO auditoria
          (usuario_id, accion, entidad, entidad_id, datos_despues, ip)
          VALUES (${mark.usuarioId}, ${removed ? "RETIRAR_REMATE" : "MARCAR_REMATE"}, 'rollos', ${String(mark.rolloId)},
            ${JSON.stringify(mark)}::jsonb, ${ip})`);
      },
    })),
  };
}