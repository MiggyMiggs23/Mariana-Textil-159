import { sql } from "drizzle-orm";
import { readE9FrozenCut, type E9Sql, type E9CutSession } from "./e9-cut";
import { E9_ENABLED } from "./e9-feature";
import { E9Error, e9Scope, e9View, e9FundKey, type E9Repository, type E9Detail, type E9Actor, type E9Operation } from "./e9";
import { e12FondoExecutor } from "./e12-fondo-executor";
import { crearMovimientoFondoEnTransaccion } from "./fondo";

/** The caller owns the transaction. No pool, connect, begin, commit or nested tx. */
export function e9Repository(tx: E9Sql): E9Repository {
  return {
    async lockKey(key) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'E9:' + key},0))`);
    },
    async replay(key) {
      const result = await tx.execute(sql`SELECT actor_id AS "actorId", content, response AS result FROM e9_operaciones WHERE clave=${key}::uuid`);
      return result.rows[0] as E9Operation | undefined;
    },
    async cut(id, actor) {
      const result = await tx.execute(sql`SELECT s.id,s.ubicacion_id AS "ubicacionId",s.estado,
        s.fecha_operativa AS "fechaOperativa",
        s.cerrada_at AS "cerradaAt",s.efectivo_contado AS "efectivoContado",u.nombre AS "ubicacionNombre"
        FROM sesiones_caja s JOIN ubicaciones u ON u.id=s.ubicacion_id
        WHERE s.id=${id} AND u.tipo='TIENDA' AND u.activa=true
        AND (${actor.rol === "ADMIN"} OR s.ubicacion_id=${actor.ubicacionId}) FOR UPDATE OF s`);
      const row = result.rows[0];
      if (!row) throw new E9Error("E9_NOT_FOUND", "Entrega o corte no encontrado.", 404);
      e9Scope(actor, Number(row.ubicacionId));
      const frozen = await readE9FrozenCut(tx, row as E9CutSession, true);
      return frozen ? { ...frozen, ubicacionId: Number(row.ubicacionId), ubicacionNombre: String(row.ubicacionNombre) } : undefined;
    },
    async sent(cut) {
      const result = await tx.execute(sql`SELECT 1 FROM e9_entregas WHERE corte_id=${cut}`);
      return result.rows.length > 0;
    },
    async load(id) {
      const result = await tx.execute(sql`SELECT revision,detail FROM e9_entregas WHERE id=${id}::uuid FOR UPDATE`);
      return result.rows[0] as { revision: number; detail: E9Detail } | undefined;
    },
    async save(detail, revision) {
      if (revision === null) {
        await tx.execute(sql`INSERT INTO e9_entregas (id,corte_id,ubicacion_id,revision,detail)
          VALUES (${detail.id}::uuid,${detail.corteId},${detail.ubicacionId},1,${JSON.stringify(detail)}::jsonb)`);
      } else {
        const result = await tx.execute(sql`UPDATE e9_entregas SET detail=${JSON.stringify(detail)}::jsonb,revision=revision+1
          WHERE id=${detail.id}::uuid AND revision=${revision} RETURNING id`);
        if (result.rows.length !== 1) throw new E9Error("E9_STATE_CONFLICT", "La entrega cambió concurrentemente.");
      }
    },
    async income(detail, amount, key, actor) {
      const result = await crearMovimientoFondoEnTransaccion(e12FondoExecutor(tx), actor, {
        idempotencyKey: e9FundKey(key), categoria: "OTRO_INGRESO", importe: amount,
        motivo: `Recepción E9 ${detail.id}; corte ${detail.corteId}; tienda ${detail.ubicacionId}`,
      });
      // Never attach an unrelated prior movement to a new authorization.
      if (result.replay) throw new E9Error("E9_STATE_CONFLICT", "Ingreso Fondo ya existente sin operación E9 coincidente.");
      return result.value.id;
    },
    async operation(key, action, content, detail, actor) {
      await tx.execute(sql`INSERT INTO e9_operaciones (clave,entrega_id,revision,actor_id,accion,content,response)
        SELECT ${key}::uuid,id,revision,${actor.id},${action},${content},${JSON.stringify(detail)}::jsonb
        FROM e9_entregas WHERE id=${detail.id}::uuid`);
      await tx.execute(sql`INSERT INTO auditoria (usuario_id,modulo,accion,entidad,entidad_id,datos_despues,ip)
        VALUES (${actor.id},'FONDO',${'E9_' + action},'e9_entregas',${detail.id},
          ${JSON.stringify(detail)}::jsonb,${actor.ip})`);
    },
  };
}
export async function readE9Detail(database: E9Sql, id: string, actor: E9Actor, enabled = E9_ENABLED) {
  if (!enabled) throw new E9Error("E9_DISABLED", "E9 todavía no está habilitado.", 403);
  const result = await database.execute(sql`SELECT detail FROM e9_entregas WHERE id=${id}::uuid
    AND (${actor.rol === "ADMIN"} OR ubicacion_id=${actor.ubicacionId})`);
  if (!result.rows[0]) throw new E9Error("E9_NOT_FOUND", "Entrega no encontrada.", 404);
  return e9View(result.rows[0].detail as E9Detail, actor);
}
export async function listE9(database: E9Sql, actor: E9Actor,
  query: { ubicacionId: number; estado?: string; cursor?: string; limit: number }, enabled = E9_ENABLED) {
  if (!enabled) throw new E9Error("E9_DISABLED", "E9 todavía no está habilitado.", 403);
  e9Scope(actor, query.ubicacionId);
  const result = await database.execute(sql`SELECT id,detail FROM e9_entregas WHERE ubicacion_id=${query.ubicacionId}
    ${query.estado ? sql`AND detail->>'estado'=${query.estado}` : sql``}
    ${query.cursor ? sql`AND id>${query.cursor}::uuid` : sql``} ORDER BY id LIMIT ${query.limit + 1}`);
  const rows = result.rows.slice(0, query.limit);
  return { items: rows.map(row => e9View(row.detail as E9Detail, actor)),
    ...(result.rows.length > query.limit ? { nextCursor: String(rows.at(-1)!.id) } : {}) };
}