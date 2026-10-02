import { Router, type IRouter } from "express";
import { ResetTestSystemBody } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { clearSessionCookie, requireRole, requireSession } from "../middlewares/auth";
import { inspectResetSchema, resetTestData, TestResetError } from "../lib/test-reset/service";
import { CLEARED_TABLES, PRESERVED_TABLES, PROTECT_CUSTOMERS, TEST_RESET_ENABLED } from "../lib/test-reset/manifest";
import { withResetBarrier } from "../lib/test-reset/barrier";
import { assertExclusiveResetProcess } from "../lib/test-reset/process-lease";

export function createTestResetRouter(enabled = TEST_RESET_ENABLED): IRouter {
const router: IRouter = Router();
// Deleting this registration and the test-reset directory retires the exception.
router.use("/admin/test-reset", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (!enabled) { res.status(404).json({ error: "Reinicio de pruebas deshabilitado." }); return; }
  try { assertExclusiveResetProcess(); }
  catch (error) {
    res.status(503).json({ error: (error as Error).message }); return;
  }
  next();
}, requireSession, requireRole("ADMIN"));
router.get("/admin/test-reset", async (_req, res) => {
  try {
    const names = await inspectResetSchema(pool);
    res.json({ enabled: true, protectCustomers: PROTECT_CUSTOMERS, confirmation: "BORRAR",
      preserves: [...PRESERVED_TABLES, ...(PROTECT_CUSTOMERS ? ["clientes", "cliente_documentos"] : [])].filter(name => names.includes(name)),
      clears: CLEARED_TABLES.filter(name => names.includes(name) && !(PROTECT_CUSTOMERS && name === "cliente_documentos")) });
  } catch (error) {
    if (error instanceof TestResetError) { res.status(error.status).json({ error: error.message }); return; }
    throw error;
  }
});
router.post("/admin/test-reset", async (req, res) => {
  const body = ResetTestSystemBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Escribe exactamente BORRAR para confirmar." }); return; }
  try {
    const result = await withResetBarrier(() => resetTestData(pool, {
      actorId: req.auth!.user.id, sessionId: req.auth!.sessionId, confirmation: body.data.confirmation,
    }, { enabled }));
    // Auth uses explicit DB sessions, not express-session: no response middleware
    // re-saves the deleted session. Deliver success AFTER commit, never a new 401.
    clearSessionCookie(res);
    res.json(result);
  } catch (error) {
    if (error instanceof TestResetError) { res.status(error.status).json({ error: error.message }); return; }
    throw error;
  }
});
return router;
}
export default createTestResetRouter();