import type { RequestHandler } from "express";
import { TestResetError } from "./service";
import { resetProcessLeaseLost } from "./process-lease";

// One API process owns this application. Stop new requests and drain completed
// responses before resetting so an already-authorized writer cannot resume later.
let resetting = false;
let active = 0;
const waiters = new Set<() => void>();
export const testResetBarrier: RequestHandler = (req, res, next) => {
  if (resetProcessLeaseLost()) {
    res.status(503).json({ error: "La API perdió su exclusividad. No se admiten operaciones; solicita revisión al administrador." });
    return;
  }
  if (req.path.replace(/\/+$/, "") === "/admin/test-reset") { next(); return; }
  if (resetting) {
    res.status(503).json({ error: "Reinicio de pruebas en curso. Espera y vuelve a iniciar sesión." });
    return;
  }
  active++;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    active--;
    if (active === 0) for (const waiter of waiters) waiter();
  };
  res.once("finish", release);
  // An aborted write can still be executing SQL. Do not mistake socket close
  // for completion: fail closed instead of clearing underneath that writer.
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") res.once("close", release);
  next();
};

export async function withResetBarrier<T>(operation: () => Promise<T>): Promise<T> {
  if (resetting) throw new TestResetError("Ya hay un reinicio de pruebas en curso.");
  resetting = true;
  try {
    if (active > 0) await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        waiters.delete(done);
        reject(new TestResetError("Hay solicitudes pendientes. No se borró nada; espera a que terminen antes de reiniciar."));
      }, 15_000);
      const done = () => { clearTimeout(timer); waiters.delete(done); resolve(); };
      waiters.add(done);
    });
    return await operation();
  } finally { resetting = false; }
}