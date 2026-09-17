import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import {
  installBehaviorStatusCancelWindow,
  loadBehaviorStatusCancelPage,
} from "./behavior-status-cancel-test-support";
import {
  canCancelSalidaDetail,
  type SalidaCancellationActor,
  type SalidaCancellationFacts,
} from "../lib/salida-cancelacion";

test("structured roll and delivery errors retain safe clickable ownership links", async () => {
  const errors = await readFile(new URL("../lib/api-error.ts", import.meta.url), "utf8");

  assert.match(errors, /data\.code === "ROLLO_BLOQUEADO"/);
  assert.match(errors, /data\.code === "SERIE_ENTREGA_INVALIDA"/);
  assert.match(errors, /item\.serieEscaneada/);
  assert.match(errors, /item\.razon/);
  assert.match(errors, /item\.documentoVenta/);
  assert.match(errors, /Abrir salida propietaria/);
  assert.match(errors, /Abrir documento/);
  assert.match(errors, /value\.startsWith\("\/api"\)/);
  assert.match(errors, /`\/salidas\/\$\{salidaId\}`/);
  assert.match(errors, /`\/tickets\/\$\{documentoId\}`/);
});

test("POS and salida scan/creation workflows render structured API details", async () => {
  const paths = [
    "./pos.tsx",
    "./salida-nueva.tsx",
    "../components/salida-venta-cliente-nueva.tsx",
    "../components/salida-mostrador.tsx",
    "../components/salidas-extraordinarias.tsx",
    "../components/recepcion-salidas.tsx",
    "../components/salidas-pendientes-cobro.tsx",
  ];
  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /ApiErrorDetails/, `${path} must preserve structured errors`);
  }
});

test("ENTREGADA stays printable while the real detail omits cancellation for every actor matrix branch", async () => {
  const modalities = ["VENTA_CLIENTE", "TRASLADO"] as const;
  const actorRoles = ["ADMIN", "BODEGA", "CAJA"] as const;
  const siteIds = [10, 20, 999] as const;
  const authorizationOptions = [true, false] as const;
  const cancellationFacts = (
    overrides: Partial<SalidaCancellationFacts> = {},
  ): SalidaCancellationFacts => ({
    estado: "ARMANDO",
    modalidad: "VENTA_CLIENTE",
    origenId: 10,
    destinoId: 20,
    ...overrides,
  });
  const actor = (
    rol: (typeof actorRoles)[number],
    siteId: (typeof siteIds)[number],
    authorized: boolean,
  ): SalidaCancellationActor => ({
    rol,
    ubicacion: {
      id: siteId,
      nombre: `Sitio ${siteId}`,
      iniciales: "ST",
      tipo: "BODEGA",
      activa: true,
      esSistema: false,
    },
    permisos: authorized
      ? [{
          modulo: "salidas",
          puedeVer: true,
          puedeCrear: false,
          puedeEditar: false,
          puedeAutorizar: true,
        }]
      : [],
  });

  for (const modalidad of modalities) {
    for (const rol of actorRoles) {
      for (const siteId of siteIds) {
        for (const authorized of authorizationOptions) {
          assert.equal(
            canCancelSalidaDetail(
              cancellationFacts({ estado: "ENTREGADA", modalidad }),
              actor(rol, siteId, authorized),
            ),
            false,
            `ENTREGADA is closed for ${modalidad}/${rol}/site-${siteId}/authorized-${authorized}`,
          );
        }
      }
    }
  }

  // Positive controls document the still-cancellable workflow branches instead
  // of letting the closed-state assertion pass only because permission is absent.
  assert.equal(
    canCancelSalidaDetail(cancellationFacts(), actor("ADMIN", 999, true)),
    true,
  );
  assert.equal(
    canCancelSalidaDetail(cancellationFacts(), actor("BODEGA", 10, true)),
    true,
  );
  assert.equal(
    canCancelSalidaDetail(
      cancellationFacts({ modalidad: "TRASLADO" }),
      actor("BODEGA", 20, true),
    ),
    true,
  );

  const fixture = {
    actor: actor("ADMIN", 10, true),
    salida: {
      ...cancellationFacts({ estado: "ENTREGADA" }),
      id: 425,
      folioFormateado: "S-00425",
      nombreOrigen: "Bodega origen",
      nombreDestino: "Cliente",
      nombreCliente: "Cliente Entregado",
      clienteId: 8,
      createdAt: "2026-04-15T12:00:00.000Z",
      nombreArmadoPor: "Operadora",
      documentoVenta: { id: 61, folio: 9001, documentoTipo: "TICKET", href: "/tickets/61" },
      autorizada: true,
      rollos: [],
      lineas: [],
      totalRollos: 0,
      totalMetros: "0",
      totalKilos: "0",
      totalBolsas: "0",
      transportista: null,
      viaje: null,
      observaciones: null,
      notaEnvio: null,
      motivoCancelacion: null,
      nombreCanceladoPor: null,
    },
  };
  const pageModule = await loadBehaviorStatusCancelPage("detail", fixture);
  const restoreWindow = installBehaviorStatusCancelWindow({ width: 1440, height: 900 });
  try {
    const html = renderToStaticMarkup(
      React.createElement(
        Router,
        { ssrPath: "/salidas/425" },
        React.createElement(pageModule.Page),
      ),
    );
    const observed = pageModule.takeObservedBadgeProps();

    assert.equal(html.includes("Entregada"), true);
    assert.equal(html.includes('data-testid="btn-print-salida"'), true);
    assert.equal(html.includes('data-testid="btn-action-cancel"'), false);
    assert.equal(
      observed.some((props: Record<string, unknown>) =>
        props.estado === "ENTREGADA" &&
        props.modalidad === "VENTA_CLIENTE" &&
        props.autorizada === true,
      ),
      true,
      "the mounted detail delegates the delivered state to the real badge",
    );
  } finally {
    restoreWindow();
  }
});

test("linked cancellation explicitly invokes generated salida cancellation atomically", async () => {
  const dialog = await readFile(
    new URL("../components/salida-cancel-dialog.tsx", import.meta.url),
    "utf8",
  );
  const detail = await readFile(new URL("./salida-detail.tsx", import.meta.url), "utf8");

  assert.match(dialog, /useCancelarSalida\(\)/);
  assert.match(dialog, /cancelMutation\.mutate\([\s\S]*id: freshSalida\.id/);
  assert.match(dialog, /operación es atómica/);
  assert.match(dialog, /todas las salidas agrupadas vinculadas, no únicamente esta salida/);
  assert.match(dialog, /Cancelar documento y todas sus salidas/);
  assert.match(detail, /<SalidaCancelDialog/);
});