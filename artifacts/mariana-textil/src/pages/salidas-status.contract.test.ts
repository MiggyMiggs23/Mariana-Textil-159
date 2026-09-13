import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getSalidaEstadoPresentation,
  SALIDA_ESTADO_LABELS,
} from "@workspace/api-zod";

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

test("desktop and mobile salida rows render the same shared component from salida.estado", async () => {
  const list = await readFile(new URL("./salidas.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("./salida-detail.tsx", import.meta.url), "utf8");

  assert.equal(
    (list.match(/<SalidaEstadoBadge estado=\{salida\.estado\} modalidad=\{salida\.modalidad\} documentoVenta=\{salida\.documentoVenta\} autorizada=\{salida\.autorizada\} \/>/g) ?? []).length,
    2,
  );
  assert.match(detail, /<SalidaEstadoBadge estado=\{salida\.estado\} modalidad=\{salida\.modalidad\} documentoVenta=\{salida\.documentoVenta\} autorizada=\{salida\.autorizada\} \/>/);
  assert.doesNotMatch(list, /function EstadoBadge/);
  assert.doesNotMatch(detail, /function EstadoBadge/);
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