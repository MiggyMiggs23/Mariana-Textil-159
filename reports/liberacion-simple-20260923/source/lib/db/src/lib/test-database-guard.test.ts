import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPreparedTestDatabase,
  PREPARED_TEST_DATABASE_TABLES,
} from "./test-database-guard";

function clientWithReadiness(input: {
  missingTables?: string[];
  hasCanonicalAdmin?: boolean;
  hasSalidaForeignKey?: boolean;
  hasSalidaIndex?: boolean;
}): Parameters<typeof assertPreparedTestDatabase>[0] {
  return {
    async query<T extends Record<string, unknown>>(
      text: string,
    ): Promise<{ rows: T[] }> {
      if (text.includes("to_regclass")) {
        return {
          rows: (input.missingTables ?? []).map((table_name) => ({
            table_name,
          })) as unknown as T[],
        };
      }
      if (text.includes("FROM public.usuarios")) {
        return {
          rows: [
            { present: input.hasCanonicalAdmin ?? true },
          ] as unknown as T[],
        };
      }
      if (text.includes("has_salida_foreign_key")) {
        return {
          rows: [
            {
              has_salida_foreign_key: input.hasSalidaForeignKey ?? true,
              has_salida_index: input.hasSalidaIndex ?? true,
            },
          ] as unknown as T[],
        };
      }
      throw new Error(`Consulta inesperada: ${text}`);
    },
  };
}

test("prepared database accepts all expected tables and the canonical ADMIN", async () => {
  await assert.doesNotReject(
    assertPreparedTestDatabase(
      clientWithReadiness({ hasCanonicalAdmin: true }),
    ),
  );
});

test("prepared database reports every missing table by name", async () => {
  await assert.rejects(
    assertPreparedTestDatabase(
      clientWithReadiness({
        missingTables: ["movimientos", "salidas"],
        hasCanonicalAdmin: true,
      }),
    ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(
        error.message,
        /faltan tablas esperadas: movimientos, salidas/,
      );
      assert.match(error.message, /schema, seed e inicializadores/);
      return true;
    },
  );
});

test("prepared database reports the missing canonical ADMIN without foreign-key noise", async () => {
  await assert.rejects(
    assertPreparedTestDatabase(
      clientWithReadiness({ hasCanonicalAdmin: false }),
    ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(
        error.message,
        /falta el ADMIN canónico activo \(usuarios\.usuario='admin', rol='ADMIN'\)/,
      );
      assert.doesNotMatch(error.message, /foreign key|23503/i);
      return true;
    },
  );
});

test("prepared database reports missing Salidas runtime structures by name", async () => {
  await assert.rejects(
    assertPreparedTestDatabase(
      clientWithReadiness({
        hasSalidaForeignKey: false,
        hasSalidaIndex: false,
      }),
    ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(
        error.message,
        /falta la FK movimientos\.salida_id → salidas\.id/,
      );
      assert.match(
        error.message,
        /falta un índice válido sobre movimientos\(salida_id\)/,
      );
      return true;
    },
  );
});

test("readiness contract includes the inventory and customer-sale tables", () => {
  for (const table of [
    "usuarios",
    "movimientos",
    "salidas",
    "salida_lineas",
    "salida_rollos",
    "permisos_ubicacion",
  ]) {
    assert.ok(PREPARED_TEST_DATABASE_TABLES.includes(table as never));
  }
});