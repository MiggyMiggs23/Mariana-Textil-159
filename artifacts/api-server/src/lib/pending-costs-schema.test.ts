import assert from "node:assert/strict";
import test from "node:test";
import {
  ensurePendingCostsSchema,
  ensureSalidasSchema,
  pool,
} from "@workspace/db";

if (process.env.NODE_ENV !== "test" || !process.env.TEST_DATABASE_URL) {
  throw new Error(
    "Esta prueba modifica el esquema y solo puede ejecutarse con TEST_DATABASE_URL.",
  );
}

await test("upgrade de costos pendientes es nullable y preserva permisos configurados", async () => {
  const backup = await pool.query(`
    SELECT rol, modulo, puede_ver, puede_crear, puede_editar, puede_autorizar,
           updated_at, updated_por
    FROM permisos_rol WHERE rol = 'BODEGA'
  `);
  const admin = await pool.query<{ id: number }>(
    "SELECT id FROM usuarios WHERE rol = 'ADMIN' ORDER BY id LIMIT 1",
  );
  assert.ok(admin.rows[0], "Se requiere un ADMIN fixture");

  try {
    await pool.query(
      `UPDATE permisos_rol
       SET puede_ver = false, puede_crear = false, puede_editar = true,
           puede_autorizar = true, updated_por = NULL
       WHERE rol = 'BODEGA' AND modulo = 'entradas'`,
    );
    await pool.query(
      `UPDATE permisos_rol
       SET puede_ver = true, puede_crear = true, puede_editar = true,
           puede_autorizar = true, updated_por = $1
       WHERE rol = 'BODEGA' AND modulo = 'reportes'`,
      [admin.rows[0]!.id],
    );
    await pool.query(
      `UPDATE permisos_rol
       SET puede_ver = false, puede_crear = false, puede_editar = true,
           puede_autorizar = true, updated_por = NULL
       WHERE rol = 'BODEGA' AND modulo = 'salidas'`,
    );

    // Production startup runs the legacy Salidas upgrade first. The pending
    // costs upgrade must safely establish the final BODEGA baseline afterward.
    await ensureSalidasSchema(pool);
    await ensurePendingCostsSchema(pool);
    await ensurePendingCostsSchema(pool);

    const columns = await pool.query<{
      table_name: string;
      column_name: string;
      is_nullable: string;
    }>(`
      SELECT table_name, column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND ((table_name = 'rollos' AND column_name IN ('costo_unitario','costo_total'))
          OR (table_name = 'entradas' AND column_name = 'total_costo'))
      ORDER BY table_name, column_name
    `);
    assert.equal(columns.rows.length, 3);
    assert.ok(columns.rows.every((column) => column.is_nullable === "YES"));

    const rows = await pool.query<{
      modulo: string;
      puede_ver: boolean;
      puede_crear: boolean;
      puede_editar: boolean;
      puede_autorizar: boolean;
      updated_por: number | null;
    }>(`
      SELECT modulo, puede_ver, puede_crear, puede_editar, puede_autorizar,
             updated_por
      FROM permisos_rol
      WHERE rol = 'BODEGA' AND modulo IN ('entradas','salidas','reportes')
      ORDER BY modulo
    `);
    const byModule = new Map(rows.rows.map((row) => [row.modulo, row]));
    assert.deepEqual(
      {
        ver: byModule.get("entradas")?.puede_ver,
        crear: byModule.get("entradas")?.puede_crear,
        editar: byModule.get("entradas")?.puede_editar,
        autorizar: byModule.get("entradas")?.puede_autorizar,
      },
      { ver: true, crear: true, editar: false, autorizar: false },
      "Una fila legacy sin updated_por recibe el nuevo default",
    );
    assert.deepEqual(
      {
        ver: byModule.get("salidas")?.puede_ver,
        crear: byModule.get("salidas")?.puede_crear,
        editar: byModule.get("salidas")?.puede_editar,
        autorizar: byModule.get("salidas")?.puede_autorizar,
      },
      { ver: true, crear: true, editar: false, autorizar: false },
      "El orden de startup deja el default final de Salidas",
    );
    assert.deepEqual(
      {
        ver: byModule.get("reportes")?.puede_ver,
        crear: byModule.get("reportes")?.puede_crear,
        editar: byModule.get("reportes")?.puede_editar,
        autorizar: byModule.get("reportes")?.puede_autorizar,
        updatedPor: byModule.get("reportes")?.updated_por,
      },
      {
        ver: true,
        crear: true,
        editar: true,
        autorizar: true,
        updatedPor: admin.rows[0]!.id,
      },
      "Una personalización administrativa se conserva intacta",
    );
  } finally {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM permisos_rol WHERE rol = 'BODEGA'");
      for (const row of backup.rows) {
        await client.query(
          `INSERT INTO permisos_rol
             (rol, modulo, puede_ver, puede_crear, puede_editar,
              puede_autorizar, updated_at, updated_por)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            row.rol,
            row.modulo,
            row.puede_ver,
            row.puede_crear,
            row.puede_editar,
            row.puede_autorizar,
            row.updated_at,
            row.updated_por,
          ],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
});