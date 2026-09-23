import type { RequestHandler } from "express";
import { REMATE_RELEASED } from "./tarea4-gates";

export type RemateActor = { id: number; rol: string };
export type RemateMark = { rolloId: number; motivo: string; usuarioId: number };
export type RemateTransaction = {
  /** Same permission resolver as matrix, including user/site overrides. */
  allowed(actor: RemateActor): Promise<boolean>;
  /** Lock rollo and validate actor's existing site scope; never trust body. */
  lockAccessibleRoll(actor: RemateActor, rolloId: number): Promise<boolean>;
  markExists(rolloId: number): Promise<boolean>;
  insertMark(mark: RemateMark): Promise<void>;
  removeMark(rolloId: number): Promise<void>;
  audit(mark: RemateMark, removed?: boolean): Promise<void>;
};
export type RemateStore = {
  transaction<T>(work: (tx: RemateTransaction) => Promise<T>): Promise<T>;
};

/** Mark is matrix-authorized; removal is ADMIN-only. Both require a reason. */
export function createMarkRemateHandler(store: RemateStore, remove = false): RequestHandler {
  return async (req, res, next) => {
    if (!REMATE_RELEASED) {
      res.status(404).json({ error: "Entrega no habilitada." });
      return;
    }
    const actor = req.auth?.user;
    if (!actor) {
      res.status(401).json({ error: "Sesión requerida." });
      return;
    }
    const rolloId = Number(req.params.id);
    const motivo = typeof req.body?.motivo === "string" ? req.body.motivo.trim() : "";
    if (!Number.isSafeInteger(rolloId) || rolloId <= 0 || !motivo ||
        Object.keys(req.body ?? {}).some(key => key !== "motivo")) {
      res.status(400).json({ error: "Rollo y motivo obligatorio; no se aceptan otros campos." });
      return;
    }
    try {
      const status = await store.transaction(async tx => {
        if (remove && actor.rol !== "ADMIN") return 403;
        // ADMIN is immutable full access; every other role is configurable.
        if (actor.rol !== "ADMIN" && !await tx.allowed(actor)) return 403;
        if (!await tx.lockAccessibleRoll(actor, rolloId)) return 404;
        // Never rewrite the original author/reason or silently replay a mutation.
        if (await tx.markExists(rolloId) === !remove) return 409;
        const mark = { rolloId, motivo, usuarioId: actor.id };
        if (remove) await tx.removeMark(rolloId);
        else await tx.insertMark(mark);
        await tx.audit(mark, remove);
        return 201;
      });
      res.status(status).json(status === 201 ? { rolloId, remate: !remove } : {
        error: status === 403 ? "Sin permiso Marcar remate." :
          status === 404 ? "Rollo no accesible." : "La marca ya está en el estado solicitado.",
      });
    } catch (error) {
      next(error);
    }
  };
}