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

test("transfer detail and history eligibility cover every lifecycle state, role, and site", () => {
  const roles = [
    "ADMIN",
    "TERMINAL",
    "CAJA",
    "SUPERVISOR",
    "BODEGA",
    "SISTEMAS",
    "CONTADOR",
  ] as const;
  const sites = [10, 20, 999] as const;
  const states = ["ARMANDO", "EN_TRANSITO", "RECIBIDA", "ENTREGADA", "CANCELADA"] as const;

  for (const estado of states) {
    for (const rol of roles) {
      for (const siteId of sites) {
        const expectedDetail =
          (estado === "ARMANDO" || estado === "EN_TRANSITO") &&
          (rol === "ADMIN" || siteId === 10 || siteId === 20);
        const transfer = salida({ estado });
        const scopedActor = actor({
          rol,
          ubicacion: { ...actor().ubicacion!, id: siteId },
        });

        assert.equal(
          canCancelSalidaDetail(transfer, scopedActor),
          expectedDetail,
          `detail eligibility for ${rol}/${siteId}/${estado}`,
        );
        assert.equal(
          canCancelSalidaHistory(transfer, scopedActor),
          expectedDetail && rol !== "CAJA",
          `history eligibility for ${rol}/${siteId}/${estado}`,
        );
      }
    }
  }

  for (const estado of states) {
    assert.equal(
      canCancelSalidaDetail(salida({ estado }), actor({ permisos: [] })),
      false,
      `detail requires authorization for ${estado}`,
    );
    assert.equal(
      canCancelSalidaHistory(salida({ estado }), actor({ permisos: [] })),
      false,
      `history requires authorization for ${estado}`,
    );
  }
});

test("customer-sale eligibility remains origin-only and pre-delivery", () => {
  const states = ["ARMANDO", "EN_TRANSITO", "RECIBIDA", "ENTREGADA", "CANCELADA"] as const;
  const roles = ["ADMIN", "BODEGA"] as const;

  for (const estado of states) {
    for (const rol of roles) {
      const isPreDelivery = estado !== "ENTREGADA" && estado !== "CANCELADA";
      const isAdmin = rol === "ADMIN";
      assert.equal(
        canCancelSalidaDetail(
          salida({ modalidad: "VENTA_CLIENTE", estado }),
          actor({ rol }),
        ),
        isPreDelivery,
        `customer-sale detail origin eligibility for ${rol}/${estado}`,
      );
      assert.equal(
        canCancelSalidaDetail(
          salida({ modalidad: "VENTA_CLIENTE", estado }),
          actor({
            rol,
            ubicacion: { ...actor().ubicacion!, id: 20 },
          }),
        ),
        isAdmin && isPreDelivery,
        `customer-sale detail destination eligibility for ${rol}/${estado}`,
      );
      assert.equal(
        canCancelSalidaHistory(
          salida({ modalidad: "VENTA_CLIENTE", estado }),
          actor({ rol }),
        ),
        isPreDelivery,
        `customer-sale history origin eligibility for ${rol}/${estado}`,
      );
    }
  }
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