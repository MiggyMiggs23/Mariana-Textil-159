import assert from "node:assert/strict";
import test from "node:test";
import { ensureSalidasSchema, pool } from "@workspace/db";

if (process.env.NODE_ENV !== "test" || !process.env.TEST_DATABASE_URL) {
  throw new Error(
    "Esta prueba modifica el esquema y solo puede ejecutarse con TEST_DATABASE_URL.",
  );
}

await test("El upgrade de Salidas migra el alias transferencias sin perder su configuración", async () => {
  await ensureSalidasSchema(pool);
  const folioBefore = await pool.query<{ ultimo_folio: number }>(
    "SELECT ultimo_folio FROM salida_folio WHERE id = 1",
  );

  await pool.query(`
    DELETE FROM permisos_rol
    WHERE rol = 'ADMIN' AND modulo IN ('salidas', 'transferencias');

    INSERT INTO permisos_rol
      (rol, modulo, puede_ver, puede_crear, puede_editar, puede_autorizar)
    VALUES
      ('ADMIN', 'salidas', false, false, false, false),
      ('ADMIN', 'transferencias', true, true, false, true);
  `);

  await ensureSalidasSchema(pool);
  await pool.query(`
    UPDATE permisos_rol
    SET puede_autorizar = false
    WHERE rol = 'INVENTARIOS' AND modulo = 'salidas'
  `);
  await pool.query(`
    UPDATE permisos_rol
    SET puede_ver = false, puede_crear = false, puede_editar = false, puede_autorizar = false,
        updated_por = NULL
    WHERE rol = 'TERMINAL' AND modulo = 'salidas';

    UPDATE permisos_rol
    SET puede_ver = true, puede_crear = true, puede_editar = false, puede_autorizar = false,
        updated_por = (SELECT id FROM usuarios WHERE rol = 'ADMIN' ORDER BY id LIMIT 1)
    WHERE rol = 'CAJA' AND modulo = 'salidas';
  `);
  await ensureSalidasSchema(pool);

  const permission = await pool.query<{
    modulo: string;
    puede_ver: boolean;
    puede_crear: boolean;
    puede_editar: boolean;
    puede_autorizar: boolean;
  }>(`
    SELECT modulo, puede_ver, puede_crear, puede_editar, puede_autorizar
    FROM permisos_rol
    WHERE rol = 'ADMIN' AND modulo IN ('salidas', 'transferencias')
    ORDER BY modulo;
  `);
  assert.deepEqual(permission.rows, [
    {
      modulo: "salidas",
      puede_ver: true,
      puede_crear: true,
      puede_editar: false,
      puede_autorizar: true,
    },
  ]);

  const defaultInventoryPermission = await pool.query<{
    puede_ver: boolean;
    puede_crear: boolean;
    puede_editar: boolean;
    puede_autorizar: boolean;
  }>(`
    SELECT puede_ver, puede_crear, puede_editar, puede_autorizar
    FROM permisos_rol
    WHERE rol = 'INVENTARIOS' AND modulo = 'salidas';
  `);
  assert.deepEqual(defaultInventoryPermission.rows, [{
    puede_ver: true,
    puede_crear: true,
    puede_editar: true,
    puede_autorizar: false,
  }]);

  const upgradedRoleDefaults = await pool.query<{
    rol: string;
    puede_ver: boolean;
    puede_crear: boolean;
    puede_editar: boolean;
    puede_autorizar: boolean;
  }>(`
    SELECT rol, puede_ver, puede_crear, puede_editar, puede_autorizar
    FROM permisos_rol
    WHERE rol IN ('TERMINAL', 'CAJA') AND modulo = 'salidas'
    ORDER BY rol::text;
  `);
  assert.deepEqual(upgradedRoleDefaults.rows, [
    {
      rol: "CAJA",
      puede_ver: true,
      puede_crear: true,
      puede_editar: false,
      puede_autorizar: false,
    },
    {
      rol: "TERMINAL",
      puede_ver: true,
      puede_crear: false,
      puede_editar: false,
      puede_autorizar: false,
    },
  ]);

  const schema = await pool.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('salidas', 'salida_lineas', 'salida_rollos', 'salida_folio')
    ORDER BY table_name;
  `);
  assert.deepEqual(schema.rows.map((row) => row.table_name), [
    "salida_folio",
    "salida_lineas",
    "salida_rollos",
    "salidas",
  ]);
  const cancellationColumns = await pool.query<{ column_name: string }>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'salidas'
      AND column_name IN ('usuario_cancela_id', 'cancelada_at')
    ORDER BY column_name;
  `);
  assert.deepEqual(
    cancellationColumns.rows.map((row) => row.column_name),
    ["cancelada_at", "usuario_cancela_id"],
  );

  const folio = await pool.query<{ ultimo_folio: number }>(
    "SELECT ultimo_folio FROM salida_folio WHERE id = 1",
  );
  assert.equal(
    folio.rows[0]?.ultimo_folio,
    folioBefore.rows[0]?.ultimo_folio,
    "El upgrade idempotente no debe reiniciar ni retroceder el folio.",
  );

  await pool.query(
    "DELETE FROM permisos_rol WHERE rol = 'ADMIN' AND modulo = 'salidas'",
  );
});