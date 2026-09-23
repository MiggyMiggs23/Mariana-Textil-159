import assert from "node:assert/strict";
import test from "node:test";
import { ensureCajaPermissions } from "./caja-permissions-schema";

test("startup repairs only inherited CAJA role rows", async () => {
  const calls: Array<{ text: string; values: unknown[] | undefined }> = [];
  const pool = {
    query: async (text: string, values?: unknown[]) => {
      calls.push({ text, values });
      return { rows: [], rowCount: 0 };
    },
  };

  await ensureCajaPermissions(pool as never);
  await ensureCajaPermissions(pool as never);

  assert.equal(calls.length, 2, "initialization is idempotent");
  assert.match(calls[0].text, /modulo = 'cobros_pagos'/);
  assert.match(calls[0].text, /WHERE permisos_rol\.updated_por IS NULL/);
  assert.doesNotMatch(calls[0].text, /permisos_usuario/);
  assert.equal((calls[0].values?.[0] as string[]).length, 31);
});