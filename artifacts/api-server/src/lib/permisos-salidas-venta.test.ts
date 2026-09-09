import assert from "node:assert/strict";
import test from "node:test";
import { mergePermissionValues } from "./permisos";

const deniedRole = {
  puedeVer: false,
  puedeCrear: false,
  puedeEditar: false,
  puedeAutorizar: false,
  updatedPor: null,
};

test("SALIDAS_VENTA site defaults enable Mariana TERMINAL only", () => {
  const marianaTerminal = mergePermissionValues(
    "salidas_venta",
    undefined,
    deniedRole,
    { puedeVer: true, puedeCrear: true, puedeEditar: false, puedeAutorizar: false },
  );
  const otherSiteTerminal = mergePermissionValues(
    "salidas_venta",
    undefined,
    deniedRole,
    { puedeVer: false, puedeCrear: false, puedeEditar: false, puedeAutorizar: false },
  );
  const marianaCaja = mergePermissionValues(
    "salidas_venta",
    undefined,
    deniedRole,
    undefined,
  );

  assert.equal(marianaTerminal.puedeVer, true);
  assert.equal(marianaTerminal.puedeCrear, true);
  assert.equal(otherSiteTerminal.puedeVer, false);
  assert.equal(marianaCaja.puedeVer, false);
});

test("explicit role and user overrides take precedence over site defaults", () => {
  const explicitRole = mergePermissionValues(
    "salidas_venta",
    undefined,
    { ...deniedRole, puedeVer: true, updatedPor: 42 },
    { puedeVer: false, puedeCrear: false, puedeEditar: false, puedeAutorizar: false },
  );
  const explicitUser = mergePermissionValues(
    "salidas_venta",
    { puedeVer: false, puedeCrear: null, puedeEditar: null, puedeAutorizar: null },
    { ...deniedRole, updatedPor: 42 },
    { puedeVer: true, puedeCrear: true, puedeEditar: false, puedeAutorizar: false },
  );

  assert.equal(explicitRole.puedeVer, true);
  assert.equal(explicitUser.puedeVer, false);
  assert.equal(explicitUser.puedeCrear, false);
});

test("site defaults do not grant unrelated modules", () => {
  const unrelated = mergePermissionValues(
    "cobros_pagos",
    undefined,
    deniedRole,
    undefined,
  );
  assert.deepEqual(unrelated, {
    modulo: "cobros_pagos",
    puedeVer: false,
    puedeCrear: false,
    puedeEditar: false,
    puedeAutorizar: false,
  });
});