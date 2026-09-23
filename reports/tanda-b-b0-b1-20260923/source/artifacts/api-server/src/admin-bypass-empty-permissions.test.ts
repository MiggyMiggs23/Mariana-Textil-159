import assert from "node:assert/strict";
import { count, eq } from "drizzle-orm";
import {
  db,
  permisosRolTable,
  permisosUsuarioTable,
  usuariosTable,
} from "@workspace/db";
import {
  buildPermissionMatrix,
  MODULOS,
  resolvePermiso,
} from "./lib/permisos";

class RollbackAfterVerification extends Error {}

const [admin] = await db
  .select({ id: usuariosTable.id })
  .from(usuariosTable)
  .where(eq(usuariosTable.rol, "ADMIN"))
  .limit(1);
const [beforeRoleCount] = await db
  .select({ value: count() })
  .from(permisosRolTable);
const [beforeUserCount] = await db
  .select({ value: count() })
  .from(permisosUsuarioTable);

assert.ok(admin, "Debe existir al menos un usuario ADMIN para ejecutar la prueba.");
let verified = false;

process.stdout.write(
  `Estado inicial: permisos_rol=${beforeRoleCount.value}, permisos_usuario=${beforeUserCount.value}\n`,
);

try {
  await db.transaction(async (tx) => {
    await tx.delete(permisosUsuarioTable);
    await tx.delete(permisosRolTable);

    const [roleCount] = await tx
      .select({ value: count() })
      .from(permisosRolTable);
    const [userCount] = await tx
      .select({ value: count() })
      .from(permisosUsuarioTable);

    process.stdout.write(
      `Tablas vacías: permisos_rol=${roleCount.value}, permisos_usuario=${userCount.value}\n`,
    );
    assert.equal(roleCount.value, 0, "permisos_rol debe estar completamente vacía.");
    assert.equal(
      userCount.value,
      0,
      "permisos_usuario debe estar completamente vacía.",
    );

    const transactionReader = tx as unknown as typeof db;
    for (const modulo of MODULOS) {
      const permission = await resolvePermiso(
        admin.id,
        "ADMIN",
        modulo,
        transactionReader,
      );
      assert.deepEqual(permission, {
        modulo,
        puedeVer: true,
        puedeCrear: true,
        puedeEditar: true,
        puedeAutorizar: true,
      });
      process.stdout.write(`  ✓ ${modulo}: acceso total\n`);
    }

    const matrix = await buildPermissionMatrix(
      admin.id,
      "ADMIN",
      transactionReader,
    );
    assert.equal(Object.keys(matrix).length, MODULOS.length);
    for (const modulo of MODULOS) {
      assert.deepEqual(matrix[modulo], {
        modulo,
        puedeVer: true,
        puedeCrear: true,
        puedeEditar: true,
        puedeAutorizar: true,
      });
    }

    verified = true;
    process.stdout.write(
      `RESULTADO: ADMIN conserva acceso total a ${MODULOS.length}/${MODULOS.length} módulos con ambas tablas vacías.\n`,
    );

    throw new RollbackAfterVerification();
  });
} catch (error) {
  if (!(error instanceof RollbackAfterVerification)) {
    throw error;
  }
}

assert.ok(verified, "La verificación de ADMIN no llegó a completarse.");

const [afterRoleCount] = await db
  .select({ value: count() })
  .from(permisosRolTable);
const [afterUserCount] = await db
  .select({ value: count() })
  .from(permisosUsuarioTable);

assert.equal(afterRoleCount.value, beforeRoleCount.value);
assert.equal(afterUserCount.value, beforeUserCount.value);
process.stdout.write(
  `Restauración por rollback: permisos_rol=${afterRoleCount.value}, permisos_usuario=${afterUserCount.value}\n`,
);