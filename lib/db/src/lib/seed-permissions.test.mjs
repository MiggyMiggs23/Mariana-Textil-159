import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MATRIX,
  MODULOS,
  N,
  ROLES,
  V,
  VC,
  VCE,
  VE,
  assertSeedPermissionMatrix,
} from "./seed-permissions.mjs";

test("la matriz cubre los 30 módulos con seis roles", () => {
  assert.equal(MODULOS.length, 30);
  assert.deepEqual(ROLES, [
    "TERMINAL",
    "CAJA",
    "SUPERVISOR",
    "BODEGA",
    "SISTEMAS",
    "CONTADOR",
  ]);
  assert.doesNotThrow(() => assertSeedPermissionMatrix());
  for (const row of Object.values(MATRIX)) assert.equal(row.length, 6);
});

test("rechaza filas cortas, tuplas copiadas y módulos faltantes o extra", () => {
  assert.throws(
    () =>
      assertSeedPermissionMatrix(
        {
          dashboard: [N],
          extra: [N],
        },
        ["dashboard", "pos"],
        ["SISTEMAS", "CONTADOR"],
      ),
    /exactamente 2 celdas[\s\S]*falta el módulo "pos"[\s\S]*"extra" no existe|falta el módulo "pos"[\s\S]*"extra" no existe[\s\S]*exactamente 2 celdas/,
  );
  assert.throws(
    () =>
      assertSeedPermissionMatrix(
        { dashboard: [[false, false, false, false]] },
        ["dashboard"],
        ["SISTEMAS"],
      ),
    /no usa una tupla de permisos válida/,
  );
});

test("SISTEMAS y CONTADOR conservan los permisos financieros definidos", () => {
  const sistemas = [
    V, N, VCE, VCE, VCE, VC, V, VCE, VCE, VCE,
    VC, VCE, V, V, V, VCE, V, VCE, VCE, VCE,
    VE, N, N, N, V, VC, V, VCE, VCE, VCE,
  ];
  const contador = [
    V, N, V, V, V, N, V, N, V, V,
    N, V, V, V, V, V, VCE, V, N, N,
    N, V, V, VC, V, V, N, N, N, V,
  ];

  assert.deepEqual(MODULOS.map((module) => MATRIX[module][4]), sistemas);
  assert.deepEqual(MODULOS.map((module) => MATRIX[module][5]), contador);
});

test("CAJA solo hereda ver y crear en cobros_pagos", () => {
  for (const modulo of MODULOS) {
    assert.deepEqual(
      MATRIX[modulo][1],
      modulo === "cobros_pagos" ? VC : N,
      modulo,
    );
  }
});

test("el upsert conserva filas personalizadas explícitamente", async () => {
  const seed = await readFile(new URL("../seed.mjs", import.meta.url), "utf8");
  assert.match(
    seed,
    /ON CONFLICT \(rol, modulo\) DO UPDATE SET[\s\S]*WHERE permisos_rol\.updated_por IS NULL/,
  );
});