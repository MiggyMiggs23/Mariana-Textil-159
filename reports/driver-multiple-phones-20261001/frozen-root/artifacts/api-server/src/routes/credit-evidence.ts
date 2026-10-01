import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireRole, requireSession } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { resolveReadScope } from "./inventario";
import {
  appendCreditAttribution,
  assertHistoricalAttributionGate,
  assertHistoricalPreparationAccess,
  CreditAttributionError,
  loadCreditEvidence,
  readAttributionInput,
  type EvidenceDatabase,
} from "../lib/credit-evidence-read";

const router: IRouter = Router();

function parseId(value: unknown, name: string): number {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(Number(value))) {
    throw new CreditAttributionError(400, `${name} debe ser un entero positivo.`);
  }
  return Number(value);
}

router.get(
  "/clientes/:clienteId/evidencia-credito",
  requireSession,
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const clienteId = parseId(req.params.clienteId, "clienteId");
      const requestedSite = req.query.ubicacionId === undefined
        ? undefined : parseId(req.query.ubicacionId, "ubicacionId");
      if (req.query.ubicacionIds !== undefined) {
        throw new CreditAttributionError(400, "Usa un único ubicacionId para evidencia de crédito.");
      }
      const preparation = req.query.prepararAtribucion;
      if (preparation !== undefined && preparation !== "true" && preparation !== "false") {
        throw new CreditAttributionError(400, "prepararAtribucion debe ser true o false.");
      }
      // Dedicated privileged unknown-history exposure, not a global ledger exemption.
      if (preparation === "true") {
        assertHistoricalPreparationAccess(req.auth!.user, true); // permission middleware already passed
      }
      const scope = resolveReadScope(req.auth!, requestedSite);
      if (scope.scopeError || scope.ubicacionId === null ||
        (requestedSite !== undefined && scope.ubicacionId !== requestedSite)) {
        throw new CreditAttributionError(403, scope.scopeError ?? "El sitio está fuera de tu alcance.");
      }
      const database: EvidenceDatabase = {
        query<T extends Record<string, unknown>>(text: string, values?: readonly unknown[]) {
          return pool.query<T>(text, values ? [...values] : undefined);
        },
      };
      const result = await loadCreditEvidence(database, clienteId, {
        sitioIds: scope.ubicacionId === undefined ? null : [scope.ubicacionId],
        incluirHistoricosSinSitio: preparation === "true",
      });
      res.json(result);
    } catch (error) {
      if (error instanceof CreditAttributionError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      next(error);
    }
  },
);

router.post(
  "/clientes/:clienteId/atribuciones-credito",
  requireSession,
  requireRole("ADMIN", "SUPERVISOR"),
  requierePermiso("clientes_finanzas", "ver"),
  requierePermiso("clientes_finanzas", "autorizar"),
  async (req, res, next): Promise<void> => {
    try {
      // Closed before parsing payload, acquiring a connection or any write.
      assertHistoricalAttributionGate(req.auth!.user);
      const clienteId = parseId(req.params.clienteId, "clienteId");
      const input = readAttributionInput(req.body);
      const connection = await pool.connect();
      try {
        await connection.query("BEGIN");
        // Stable text representation between GET and POST, retaining all microseconds.
        await connection.query("SET LOCAL TIME ZONE 'UTC'");
        const database: EvidenceDatabase = {
          query<T extends Record<string, unknown>>(text: string, values?: readonly unknown[]) {
            return connection.query<T>(text, values ? [...values] : undefined);
          },
        };
        const result = await appendCreditAttribution(database, req.auth!.user, clienteId, input);
        await connection.query("COMMIT");
        res.status(result.replay ? 200 : 201).json(result);
      } catch (error) {
        await connection.query("ROLLBACK");
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      if (error instanceof CreditAttributionError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      if (typeof error === "object" && error !== null && "code" in error &&
        error.code === "23505") {
        res.status(409).json({ error: "La atribución o su cadena cambió; consulta la evidencia otra vez." });
        return;
      }
      next(error);
    }
  },
);

export default router;