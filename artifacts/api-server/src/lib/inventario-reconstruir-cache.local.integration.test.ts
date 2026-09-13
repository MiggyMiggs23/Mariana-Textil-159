import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import type { Tx } from "./inventario";

const testUrl = process.env.TEST_DATABASE_URL;
const applicationUrl = process.env.DATABASE_URL;

if (process.env.NODE_ENV !== "test" || !testUrl || !applicationUrl) {
  throw new Error(
    "The local cache-rebuild regression requires NODE_ENV=test, DATABASE_URL, and TEST_DATABASE_URL.",
  );
}
if (testUrl === applicationUrl) {
  throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL.");
}

const parsedTestUrl = new URL(testUrl);
const expectedDatabase = decodeURIComponent(parsedTestUrl.pathname.slice(1));
const expectedUser = decodeURIComponent(parsedTestUrl.username);
const expectedSocket = decodeURIComponent(parsedTestUrl.hostname);
if (!expectedDatabase || !expectedUser || !expectedSocket.startsWith("/tmp/")) {
  throw new Error(
    "TEST_DATABASE_URL must identify the private socket of the disposable runner.",
  );
}

type PermissionRow = {
  id: number;
  rol: string;
  modulo: string;
  puede_ver: boolean;
  puede_crear: boolean;
  puede_editar: boolean;
  puede_autorizar: boolean;
  updated_at: string;
  updated_por: number | null;
};

type QueryResult = {
  rows: Array<Record<string, unknown>>;
};

type TxQuery = Parameters<Tx["execute"]>[0];

async function assertDisposableIdentity(client: {
  query<T extends Record<string, unknown>>(
    text: string,
  ): Promise<{ rows: T[] }>;
}): Promise<void> {
  const result = await client.query<{
    database: string;
    user: string;
    data_directory: string;
    unix_socket_directories: string;
    listen_addresses: string;
  }>(`
    SELECT
      current_database() AS database,
      current_user AS "user",
      current_setting('data_directory') AS data_directory,
      current_setting('unix_socket_directories') AS unix_socket_directories,
      current_setting('listen_addresses') AS listen_addresses
  `);
  const row = result.rows[0];
  assert.equal(row?.database, expectedDatabase);
  assert.equal(row?.user, expectedUser);
  assert.ok(
    String(row?.data_directory ?? "").match(
      /\/workspace-isolated-pg-[^/]+\/data$/,
    ),
    "the regression must use the disposable runner data directory",
  );
  assert.ok(
    String(row?.unix_socket_directories ?? "")
      .split(",")
      .map((value) => value.trim())
      .includes(expectedSocket),
    "the regression must use the disposable runner socket",
  );
  assert.equal(String(row?.listen_addresses ?? "").trim(), "");
}

async function readPermissions(client: {
  query<T extends Record<string, unknown>>(
    text: string,
  ): Promise<{ rows: T[] }>;
}): Promise<PermissionRow[]> {
  const result = await client.query<PermissionRow>(`
    SELECT
      id,
      rol::text AS rol,
      modulo,
      puede_ver,
      puede_crear,
      puede_editar,
      puede_autorizar,
      updated_at::text AS updated_at,
      updated_por
    FROM permisos_rol
    ORDER BY id
  `);
  return result.rows;
}

async function readInventoryPairCount(client: {
  query<T extends Record<string, unknown>>(
    text: string,
  ): Promise<{ rows: T[] }>;
}): Promise<number> {
  const result = await client.query<{ pair_count: number }>(`
    SELECT COUNT(*)::int AS pair_count
    FROM (
      SELECT producto_id, ubicacion_id FROM existencias
      UNION
      SELECT producto_id, ubicacion_id FROM movimientos
      UNION
      SELECT producto_id, ubicacion_id FROM rollos
    ) AS inventory_pairs
  `);
  return Number(result.rows[0]?.pair_count ?? 0);
}

function withFailureInjection(
  transaction: Tx,
  phase: "lock" | "rebuild",
  pairCount: number,
): Tx {
  let executeCount = 0;
  const failureExecuteNumber = phase === "lock" ? 2 : 2 + pairCount;
  return new Proxy(transaction, {
    get(target, property, receiver) {
      if (property !== "execute") {
        return Reflect.get(target, property, receiver);
      }
      return async (query: TxQuery): Promise<QueryResult> => {
        executeCount += 1;
        if (executeCount === failureExecuteNumber) {
          // This runs on the real transaction connection. It is intentionally
          // not a fake rejection, so PostgreSQL must abort the caller tx.
          return target.execute(sql`SELECT 1 / 0`);
        }
        const result = (await target.execute(query)) as unknown as QueryResult;
        if (executeCount === 1) {
          const rows = result.rows;
          const pairs = new Set(
            rows.map(
              (row) =>
                `${String(row.producto_id)}:${String(row.ubicacion_id)}`,
            ),
          );
          assert.equal(
            pairs.size,
            pairCount,
            "the injected executor must observe the function's unchanged pair query",
          );
        }
        return result;
      };
    },
  }) as Tx;
}

function isDivisionByZero(error: unknown): boolean {
  let current: unknown = error;
  while (current instanceof Error) {
    if (current.message.includes("division by zero")) return true;
    current = current.cause;
  }
  return false;
}

test("canonical seed permission delete rolls back around a real cache rebuild", async () => {
  const [{ db, pool }, { reconstruirCacheExistencias }] = await Promise.all([
    import("@workspace/db"),
    import("./inventario"),
  ]);
  try {
    const beforeClient = await pool.connect();
    let beforePermissions!: PermissionRow[];
    let pairCount!: number;
    try {
      await assertDisposableIdentity(beforeClient);
      beforePermissions = await readPermissions(beforeClient);
      assert.ok(
        beforePermissions.length > 0,
        "canonical seed must provide permisos_rol rows for the rollback proof",
      );
      pairCount = await readInventoryPairCount(beforeClient);
    } finally {
      beforeClient.release();
    }

    const rollbackSentinel = new Error("intentional local rollback");
    await assert.rejects(
      () =>
        db.transaction(async (tx) => {
          const deleted = await tx.execute(sql`
            DELETE FROM permisos_rol
            RETURNING
              id,
              rol,
              modulo,
              puede_ver,
              puede_crear,
              puede_editar,
              puede_autorizar,
              updated_at,
              updated_por
          `);
          assert.ok(
            deleted.rows.length > 0,
            "the rollback proof must delete existing canonical seed rows",
          );
          await reconstruirCacheExistencias(tx);
          throw rollbackSentinel;
        }),
      (error: unknown) => error === rollbackSentinel,
    );

    const afterClient = await pool.connect();
    try {
      await assertDisposableIdentity(afterClient);
      assert.deepEqual(
        await readPermissions(afterClient),
        beforePermissions,
        "the fresh connection must see every canonical permission restored",
      );
    } finally {
      afterClient.release();
    }

    if (pairCount === 0) {
      process.stdout.write(
        "real lock-failure injection: SKIPPED (canonical seed has no inventory pairs)\n",
      );
    } else {
      const lockFailure = db.transaction(async (tx) => {
        await reconstruirCacheExistencias(
          withFailureInjection(tx, "lock", pairCount),
        );
      });
      await assert.rejects(lockFailure, isDivisionByZero);
    }

    await assert.rejects(
      db.transaction(async (tx) => {
        await reconstruirCacheExistencias(
          withFailureInjection(tx, "rebuild", pairCount),
        );
      }),
      isDivisionByZero,
    );
  } finally {
    await pool.end();
  }
});