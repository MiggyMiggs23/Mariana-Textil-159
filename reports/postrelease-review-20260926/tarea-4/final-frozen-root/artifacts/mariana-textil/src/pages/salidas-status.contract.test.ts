import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import {
  getSalidaEstadoPresentation,
  SALIDA_ESTADO_LABELS,
} from "@workspace/api-zod";
import {
  installBehaviorStatusCancelWindow,
  loadBehaviorStatusCancelPage,
} from "./behavior-status-cancel-test-support";

const behaviorStatusCancelLifecycleLabels = [
  "Armando",
  "En tránsito",
  "Recibida",
  "Entregada",
  "Cancelada",
  "En curso",
  "Por autorizar",
  "Autorizada",
];

function behaviorStatusCancelCountText(html: string, text: string) {
  let count = 0;
  let position = html.indexOf(text);
  while (position !== -1) {
    count += 1;
    position = html.indexOf(text, position + text.length);
  }
  return count;
}

function behaviorStatusCancelSpyBodies(html: string) {
  const marker = 'data-testid="behavior-status-cancel-badge-spy"';
  const bodies: string[] = [];
  let markerPosition = html.indexOf(marker);

  while (markerPosition !== -1) {
    const start = html.lastIndexOf("<span", markerPosition);
    assert.notEqual(start, -1, "the badge observer has a span root");
    let cursor = html.indexOf(">", markerPosition) + 1;
    let depth = 1;
    while (depth > 0 && cursor < html.length) {
      const nextOpening = html.indexOf("<span", cursor);
      const nextClosing = html.indexOf("</span>", cursor);
      assert.notEqual(nextClosing, -1, "the badge observer span closes");
      if (nextOpening !== -1 && nextOpening < nextClosing) {
        depth += 1;
        cursor = html.indexOf(">", nextOpening) + 1;
      } else {
        depth -= 1;
        cursor = nextClosing + "</span>".length;
      }
    }
    bodies.push(html.slice(start, cursor));
    markerPosition = html.indexOf(marker, cursor);
  }

  return bodies;
}

test("salida status presentation contains exactly the five lifecycle labels", async () => {
  const status = await readFile(
    new URL("../../../../lib/api-zod/src/salida-estado-presentation.ts", import.meta.url),
    "utf8",
  );
  assert.match(status, /export const SALIDA_ESTADO_LABELS/);
  assert.deepEqual(SALIDA_ESTADO_LABELS, {
    ARMANDO: "Armando",
    EN_TRANSITO: "En tránsito",
    RECIBIDA: "Recibida",
    ENTREGADA: "Entregada",
    CANCELADA: "Cancelada",
  });
  assert.doesNotMatch(status, /\bENVIADA\b/);
});

test("customer-sale presentation derives the history labels without changing EstadoSalida", () => {
  const linkedDocument = { id: 12, folio: 34, documentoTipo: "TICKET", href: "/tickets/12" };

  assert.equal(
    getSalidaEstadoPresentation({ estado: "EN_TRANSITO", modalidad: "VENTA_CLIENTE" }).label,
    "En curso",
  );
  assert.equal(
    getSalidaEstadoPresentation({
      estado: "RECIBIDA",
      modalidad: "VENTA_CLIENTE",
      documentoVenta: linkedDocument,
      autorizada: false,
    }).label,
    "Por autorizar",
  );
  assert.equal(
    getSalidaEstadoPresentation({
      estado: "RECIBIDA",
      modalidad: "VENTA_CLIENTE",
      documentoVenta: linkedDocument,
      autorizada: true,
    }).label,
    "Autorizada",
  );
  assert.equal(
    getSalidaEstadoPresentation({
      estado: "ENTREGADA",
      modalidad: "VENTA_CLIENTE",
      documentoVenta: linkedDocument,
      autorizada: true,
    }).label,
    "Entregada",
  );
  assert.equal(
    getSalidaEstadoPresentation({
      estado: "CANCELADA",
      modalidad: "VENTA_CLIENTE",
      documentoVenta: linkedDocument,
      autorizada: false,
    }).label,
    "Cancelada",
  );
  assert.equal(
    getSalidaEstadoPresentation({ estado: "EN_TRANSITO", modalidad: "TRASLADO" }).label,
    "En tránsito",
  );
});

test("desktop and mobile salida rows mount the production status badge with their fixture state", async () => {
  const fixture = {
    actor: {
      id: 1,
      nombre: "Consulta de historial",
      rol: "BODEGA",
      alcanceConsulta: "PROPIA",
      ubicacion: {
        id: 10,
        nombre: "Bodega origen",
        iniciales: "BO",
        tipo: "BODEGA",
        activa: true,
        esSistema: false,
      },
      permisos: [],
    },
    salida: {
      id: 424,
      folioFormateado: "S-00424",
      estado: "EN_TRANSITO",
      modalidad: "TRASLADO",
      origenId: 10,
      destinoId: 20,
      nombreOrigen: "Bodega origen",
      nombreDestino: "Tienda destino",
      createdAt: "2026-04-15T12:00:00.000Z",
      totalCantidadSolicitada: "12",
      totalCantidadEnviada: "12",
      documentoVenta: null,
      autorizada: false,
    },
  };
  const pageModule = await loadBehaviorStatusCancelPage("list", fixture);

  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const restoreWindow = installBehaviorStatusCancelWindow(viewport);
    try {
      const html = renderToStaticMarkup(
        React.createElement(
          Router,
          { ssrPath: "/salidas" },
          React.createElement(pageModule.Page),
        ),
      );
      const observed = pageModule.takeObservedBadgeProps();
      const badgeBodies = behaviorStatusCancelSpyBodies(html);

      assert.equal(
        html.includes('data-testid="row-salida-424"'),
        true,
        `${viewport.name} renders the responsive row`,
      );
      assert.equal(
        html.includes('data-testid="behavior-status-cancel-badge-spy"'),
        true,
        `${viewport.name} mounts the observing wrapper around the real badge`,
      );
      assert.equal(
        badgeBodies.length >= 1,
        true,
        `${viewport.name} renders at least one observed status representative`,
      );
      assert.equal(
        badgeBodies.length,
        observed.length,
        `${viewport.name} has one observing wrapper for every badge invocation`,
      );
      assert.equal(
        badgeBodies.every((body) => body.includes("En tránsito")),
        true,
        `${viewport.name} renders the production badge label for every status representative`,
      );
      assert.equal(
        observed.every((props: Record<string, unknown>) =>
          props.estado === fixture.salida.estado &&
          props.modalidad === fixture.salida.modalidad &&
          props.documentoVenta === fixture.salida.documentoVenta &&
          props.autorizada === fixture.salida.autorizada,
        ),
        true,
        `${viewport.name} passes every rendered status representative its row facts`,
      );
      for (const label of behaviorStatusCancelLifecycleLabels) {
        assert.equal(
          behaviorStatusCancelCountText(html, label),
          badgeBodies.reduce(
            (count, body) => count + behaviorStatusCancelCountText(body, label),
            0,
          ),
          `${viewport.name} has no ${label} label outside an observed real badge, including hidden markup`,
        );
      }
    } finally {
      restoreWindow();
    }
  }
});

test("salida list, detail, and delivery dialog have cross-session freshness and lifecycle invalidations", async () => {
  const list = await readFile(new URL("./salidas.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("./salida-detail.tsx", import.meta.url), "utf8");
  const cancelDialog = await readFile(
    new URL("../components/salida-cancel-dialog.tsx", import.meta.url),
    "utf8",
  );
  const delivery = await readFile(
    new URL("../components/salida-venta-entrega.tsx", import.meta.url),
    "utf8",
  );
  const reception = await readFile(
    new URL("../components/recepcion-salidas.tsx", import.meta.url),
    "utf8",
  );
  const ticket = await readFile(new URL("./ticket-detail.tsx", import.meta.url), "utf8");

  for (const source of [list, detail, delivery]) {
    assert.match(source, /refetchInterval: 30_000/);
    assert.match(source, /refetchOnWindowFocus: true/);
  }
  assert.match(cancelDialog, /getGetSalidaQueryKey\(cancelled\.id\)[\s\S]*getListSalidasQueryKey\(\)/);
  assert.match(delivery, /invalidateQueries[\s\S]*Salida entregada/);
  assert.match(delivery, /getGetSalidaQueryKey\(salidaId\)[\s\S]*getListSalidasQueryKey\(\)/);
  assert.match(reception, /getListSalidasRecepcionQueryKey\(\)[\s\S]*getGetSalidaRecepcionQueryKey\(received\.id\)[\s\S]*getListSalidasQueryKey\(\)[\s\S]*getGetSalidaQueryKey\(received\.id\)/);
  assert.match(ticket, /getListSalidasQueryKey\(\)/);
  assert.match(ticket, /getGetSalidaQueryKey\(salida\.id\)/);
});