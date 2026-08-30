import type { Express, RequestHandler } from "express";
import type { Server } from "node:http";
import {
  ADVISORY_LOCK_NAMESPACES,
  releaseSessionAdvisoryLock,
  sessionAdvisoryLock,
} from "@workspace/db/advisory-locks";

type Pool = { end(): Promise<void> };
type Log = {
  info(bindings: object, message: string): void;
  warn(bindings: object, message: string): void;
  error(bindings: object, message: string): void;
};

type StartupLockClient = {
  query(query: string | object, values?: readonly unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  release(): void;
};

/** Runs all startup DDL while one session-level lock connection is retained. */
export async function withSchemaStartupLock(
  pool: { connect(): Promise<StartupLockClient> },
  operation: () => Promise<void>,
): Promise<void> {
  const client = await pool.connect();
  let locked = false;
  try {
    await sessionAdvisoryLock(client, ADVISORY_LOCK_NAMESPACES.SCHEMA_STARTUP);
    locked = true;
    await operation();
  } finally {
    try {
      if (locked) {
        await releaseSessionAdvisoryLock(client, ADVISORY_LOCK_NAMESPACES.SCHEMA_STARTUP);
      }
    } finally {
      client.release();
    }
  }
}

export type RequestDrain = {
  middleware: RequestHandler;
  stopAccepting(): void;
  waitForDrain(): Promise<void>;
  readonly inFlight: number;
};

/** Tracks requests independently of HTTP keep-alive sockets. */
export function createRequestDrain(): RequestDrain {
  let accepting = true;
  let inFlight = 0;
  const waiters = new Set<() => void>();
  const notify = () => {
    if (inFlight === 0) {
      for (const resolve of waiters) resolve();
      waiters.clear();
    }
  };

  return {
    middleware(req, res, next) {
      if (!accepting) {
        res.status(503).set("Connection", "close").json({
          error: "El servidor se está apagando. Intenta nuevamente en unos minutos.",
          code: "SERVER_SHUTTING_DOWN",
        });
        return;
      }
      inFlight += 1;
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        inFlight -= 1;
        notify();
      };
      res.once("finish", done);
      res.once("close", done);
      next();
    },
    stopAccepting() {
      accepting = false;
      notify();
    },
    waitForDrain() {
      return inFlight === 0
        ? Promise.resolve()
        : new Promise<void>((resolve) => waiters.add(resolve));
    },
    get inFlight() {
      return inFlight;
    },
  };
}

function waitWithTimeout(task: Promise<void>, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    void task.then(
      () => {
        clearTimeout(timer);
        resolve(true);
      },
      () => {
        clearTimeout(timer);
        resolve(true);
      },
    );
  });
}

export function installGracefulShutdown(opts: {
  app: Express;
  server: Server;
  pool: Pool;
  drain: RequestDrain;
  backfill: { promise: Promise<unknown>; abort(): void } | null;
  logger: Log;
  timeoutMs?: number;
}): { shutdown: (signal?: NodeJS.Signals) => Promise<void>; dispose(): void } {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  let shutdownPromise: Promise<void> | undefined;

  const shutdown = (signal?: NodeJS.Signals): Promise<void> => {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      opts.drain.stopAccepting();
      opts.backfill?.abort();
      const closed = new Promise<void>((resolve) => opts.server.close(() => resolve()));
      const drained = await waitWithTimeout(
        Promise.all([
          opts.drain.waitForDrain(),
          closed,
          opts.backfill?.promise.then(() => undefined, () => undefined) ?? Promise.resolve(),
        ]).then(() => undefined),
        timeoutMs,
      );
      if (!drained) {
        opts.logger.warn({ signal, inFlight: opts.drain.inFlight, timeoutMs }, "Graceful shutdown timed out");
        (opts.server as Server & { closeAllConnections?: () => void }).closeAllConnections?.();
      }
      await opts.pool.end();
      opts.logger.info({ signal }, "Server shutdown complete");
    })();
    return shutdownPromise;
  };
  const onSigterm = () => void shutdown("SIGTERM");
  const onSigint = () => void shutdown("SIGINT");
  process.on("SIGTERM", onSigterm);
  process.on("SIGINT", onSigint);
  return {
    shutdown,
    dispose() {
      process.removeListener("SIGTERM", onSigterm);
      process.removeListener("SIGINT", onSigint);
    },
  };
}