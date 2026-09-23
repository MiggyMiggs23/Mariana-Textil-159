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
  audit(mark: RemateMark): Promise<void>;
};
export type RemateStore = {
  transaction<T>(work: (tx: RemateTransaction) => Promise<T>): Promise<T>;
};

/** Unmounted handler. No startup registration and no new public contract yet. */
export function createMarkRemateHandler(store: RemateStore): RequestHandler {
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
        // ADMIN is immutable full access; every other role is configurable.
        if (actor.rol !== "ADMIN" && !await tx.allowed(actor)) return 403;
        if (!await tx.lockAccessibleRoll(actor, rolloId)) return 404;
        // Editing/removing a mark is not authorized by the decision. Stop here,
        // rather than silently updating its reason or rewriting its author.
        if (await tx.markExists(rolloId)) return 409;
        const mark = { rolloId, motivo, usuarioId: actor.id };
        await tx.insertMark(mark);
        await tx.audit(mark);
        return 201;
      });
      res.status(status).json(status === 201 ? { rolloId, remate: true } : {
        error: status === 403 ? "Sin permiso Marcar remate." :
          status === 404 ? "Rollo no accesible." : "Rollo ya marcado; edición y retiro pendientes de decisión.",
      });
    } catch (error) {
      next(error);
    }
  };
}