import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

// Fail closed before importing the DB module. This suite must never fall back to
// development even when invoked manually.
const testUrl = process.env.TEST_DATABASE_URL;
const applicationUrl = process.env.DATABASE_URL;
if (process.env.NODE_ENV !== "test") throw new Error("Task 58 requiere NODE_ENV=test.");
if (!testUrl) throw new Error("Task 58 requiere TEST_DATABASE_URL explícita.");
if (testUrl === applicationUrl) throw new Error("TEST_DATABASE_URL debe ser distinta de DATABASE_URL.");
const expectedDatabase = decodeURIComponent(new URL(testUrl).pathname).replace(/^\/+/, "");
if (!expectedDatabase || expectedDatabase.includes("/")) throw new Error("TEST_DATABASE_URL debe nombrar una sola base.");

test("Task 58: pisos son físicos y no participan en kardex ni existencias", async () => {
  const { pool, ensurePisosSchema, createTestDatabaseGuard } = await import("@workspace/db");
  const { assertIsolated } = await createTestDatabaseGuard(pool, testUrl, applicationUrl);
  await assertIsolated();
  const current = (await pool.query<{ database: string }>("SELECT current_database() database")).rows[0]?.database;
  assert.equal(current, expectedDatabase);
  await ensurePisosSchema(pool);
  const tag = `T58-${randomUUID()}`;
  const seed = randomUUID().replaceAll("-", "");
  const initials = `${String.fromCharCode(65 + (Number.parseInt(seed.slice(0, 2), 16) % 26))}${String.fromCharCode(65 + (Number.parseInt(seed.slice(2, 4), 16) % 26))}`;
  const otherInitials = `${initials[0]}${String.fromCharCode(65 + ((initials.charCodeAt(1) - 64) % 26))}`;
  const ids: number[] = [];
  try {
    // current_database is asserted again immediately before every mutation.
    const mutate = async <T extends Record<string, unknown>>(query: string, values: unknown[] = []) => {
      assert.equal((await pool.query<{ database: string }>("SELECT current_database() database")).rows[0]?.database, expectedDatabase);
      return (await pool.query<T>(query, values)).rows;
    };
    const [site] = await mutate<{ id: number }>(
      "INSERT INTO ubicaciones(nombre,iniciales,tipo,activa) VALUES($1,$2,'BODEGA',true) RETURNING id",
      [`${tag} sitio`, initials],
    );
    ids.push(site!.id);
    const [other] = await mutate<{ id: number }>(
      "INSERT INTO ubicaciones(nombre,iniciales,tipo,activa) VALUES($1,$2,'BODEGA',true) RETURNING id",
      [`${tag} otro`, otherInitials],
    );
    ids.push(other!.id);
    const [floor] = await mutate<{ id: number }>(
      "INSERT INTO pisos(ubicacion_id,nombre,activo) VALUES($1,' Planta Baja ',true) RETURNING id", [site!.id],
    );
    await assert.rejects(
      () => mutate("INSERT INTO pisos(ubicacion_id,nombre,activo) VALUES($1,'planta baja',true)", [site!.id]),
      /unique|duplicate/i,
      "nombre de piso es único case-insensitive por sitio",
    );
    const cols = await pool.query<{ table_name: string; column_name: string }>(`
      SELECT table_name,column_name FROM information_schema.columns
      WHERE table_name IN ('movimientos','existencias') AND column_name='piso_id'`);
    assert.equal(cols.rows.length, 0, "piso_id no debe existir en kardex/cache");
    const rollCols = await pool.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name='rollos' AND column_name='piso_id'",
    );
    assert.equal(rollCols.rows.length, 1);
    assert.ok(floor!.id);
  } finally {
    if (ids.length) {
      await pool.query("DELETE FROM pisos WHERE ubicacion_id = ANY($1::int[])", [ids]);
      await pool.query("DELETE FROM ubicaciones WHERE id = ANY($1::int[])", [ids]);
    }
  }
});