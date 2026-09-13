import assert from "node:assert/strict";
import test from "node:test";
import {
  canCancelSalidaDetail,
  canCancelSalidaHistory,
  type SalidaCancellationActor,
  type SalidaCancellationFacts,
} from "./salida-cancelacion";

const salida = (
  overrides: Partial<SalidaCancellationFacts> = {},
): SalidaCancellationFacts => ({
  estado: "ARMANDO",
  modalidad: "TRASLADO",
  origenId: 10,
  destinoId: 20,
  ...overrides,
});

const actor = (
  overrides: Partial<SalidaCancellationActor> = {},
): SalidaCancellationActor => ({
  rol: "BODEGA",
  ubicacion: {
    id: 10,
    nombre: "Origen",
    iniciales: "OR",
    tipo: "BODEGA",
    activa: true,
    esSistema: false,
  },
  permisos: [
    {
      modulo: "salidas",
      puedeVer: true,
      puedeCrear: false,
      puedeEditar: false,
      puedeAutorizar: true,
    },
  ],
  ...overrides,
});

test("history eligibility preserves state and site boundaries", () => {
  assert.equal(canCancelSalidaHistory(salida(), actor()), true);
  assert.equal(
    canCancelSalidaHistory(salida({ estado: "RECIBIDA" }), actor()),
    false,
    "a transfer received at destination is not cancellable",
  );
  assert.equal(
    canCancelSalidaHistory(
      salida({ modalidad: "VENTA_CLIENTE", estado: "RECIBIDA" }),
      actor(),
    ),
    true,
    "a customer sale received at origin remains pre-delivery and cancellable",
  );
  assert.equal(
    canCancelSalidaHistory(salida(), actor({ ubicacion: { ...actor().ubicacion!, id: 999 } })),
    false,
  );
  assert.equal(
    canCancelSalidaHistory(salida({ estado: "ENTREGADA" }), actor({ rol: "ADMIN" })),
    false,
  );
  assert.equal(
    canCancelSalidaHistory(salida({ estado: "CANCELADA" }), actor({ rol: "ADMIN" })),
    false,
  );
});

test("history eligibility requires authorization, including zero-permission users", () => {
  assert.equal(
    canCancelSalidaHistory(
      salida(),
      actor({
        permisos: [
          {
            modulo: "salidas",
            puedeVer: true,
            puedeCrear: true,
            puedeEditar: true,
            puedeAutorizar: false,
          },
        ],
      }),
    ),
    false,
  );
  assert.equal(
    canCancelSalidaHistory(
      salida(),
      actor({
        permisos: [],
      }),
    ),
    false,
  );
  assert.equal(
    canCancelSalidaHistory(
      salida(),
      actor({
        rol: "CAJA",
        permisos: [
          {
            modulo: "salidas",
            puedeVer: true,
            puedeCrear: true,
            puedeEditar: true,
            puedeAutorizar: true,
          },
        ],
      }),
    ),
    false,
    "the history action is never visible to CAJA",
  );
  assert.equal(
    canCancelSalidaHistory(
      salida({ modalidad: "VENTA_CLIENTE", estado: "RECIBIDA" }),
      actor({
        permisos: [],
      }),
    ),
    false,
  );
});

test("detail keeps the legacy CAJA transfer branch separate from history", () => {
  const cajaWithLegacyPermission = actor({
    rol: "CAJA",
    permisos: [
      {
        modulo: "salidas",
        puedeVer: true,
        puedeCrear: false,
        puedeEditar: false,
        puedeAutorizar: true,
      },
    ],
  });
  assert.equal(
    canCancelSalidaDetail(salida(), cajaWithLegacyPermission),
    true,
  );
  assert.equal(
    canCancelSalidaHistory(salida(), cajaWithLegacyPermission),
    false,
  );
});