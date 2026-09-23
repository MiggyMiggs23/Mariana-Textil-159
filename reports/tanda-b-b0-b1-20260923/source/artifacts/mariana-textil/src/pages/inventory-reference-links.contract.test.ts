import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GetCurrentUserResponse, GetKardexGroupedResponse } from "@workspace/api-zod";
import { withBrowserFixture } from "../observable-test/browser";

const root = new URL("../../../../", import.meta.url);
const grupo1KardexUser = GetCurrentUserResponse.parse({
  id: 51,
  nombre: "Contabilidad",
  usuario: "contabilidad",
  rol: "CONTADOR",
  ubicacion: { id: 1, nombre: "Mariana", iniciales: "MA", tipo: "TIENDA", activa: true, esSistema: false },
  alcanceConsulta: "PROPIA",
  permisos: [],
});
const grupo1Kardex = GetKardexGroupedResponse.parse({
  grupos: [
    {
      groupId: "resolved-document",
      createdAt: "2026-10-02T15:00:00.000Z",
      fechaMin: "2026-10-02T15:00:00.000Z",
      fechaMax: "2026-10-02T15:00:00.000Z",
      latestDate: "2026-10-02T15:00:00.000Z",
      latestMovementId: 817,
      tipo: "RECEPCION",
      ubicacionId: 1,
      nombreUbicacion: "Mariana",
      ubicacionActiva: true,
      distinctRolloCount: 1,
      partialitiesMerged: 0,
      totalesPorUnidad: [{ unidad: "METRO", cantidad: "10.00" }],
      productos: [{ productoId: 8, skuProducto: "TEL-8", telaProducto: "Gabardina", colorProducto: "Azul", unidadProducto: "METRO" }],
      usuarios: [{ usuarioId: 51, nombreUsuario: "Contabilidad", username: "contabilidad" }],
      documentoTipo: "ENTRADA",
      documentoId: "817",
      documentoEtiqueta: "Entrada 817",
      documentoRuta: "/entradas/440/documento",
      ticketId: null,
      destinoEtiqueta: null,
      justificacion: null,
      rollos: [{ movementId: 817, rolloId: 99, serie: "R-99", cantidad: "10.00", unidad: "METRO", createdAt: "2026-10-02T15:00:00.000Z", saldoPosterior: "10.00", referenciaRolloRuta: "/inventario/rollos/99" }],
    },
    {
      groupId: "unresolved-document",
      createdAt: "2026-10-02T16:00:00.000Z",
      fechaMin: "2026-10-02T16:00:00.000Z",
      fechaMax: "2026-10-02T16:00:00.000Z",
      latestDate: "2026-10-02T16:00:00.000Z",
      latestMovementId: 818,
      tipo: "AJUSTE_POSITIVO",
      ubicacionId: 1,
      nombreUbicacion: "Mariana",
      ubicacionActiva: true,
      distinctRolloCount: 1,
      partialitiesMerged: 0,
      totalesPorUnidad: [{ unidad: "METRO", cantidad: "2.00" }],
      productos: [{ productoId: 8, skuProducto: "TEL-8", telaProducto: "Gabardina", colorProducto: "Azul", unidadProducto: "METRO" }],
      usuarios: [{ usuarioId: 51, nombreUsuario: "Contabilidad", username: "contabilidad" }],
      documentoTipo: "NOTA",
      documentoId: "818",
      documentoEtiqueta: "Nota 818",
      documentoRuta: null,
      ticketId: null,
      destinoEtiqueta: null,
      justificacion: null,
      rollos: [{ movementId: 818, rolloId: 100, serie: "R-100", cantidad: "2.00", unidad: "METRO", createdAt: "2026-10-02T16:00:00.000Z", saldoPosterior: "2.00", referenciaRolloRuta: "/inventario/rollos/100" }],
    },
  ],
  total: 2,
  page: 1,
  pageSize: 100,
  totalPages: 1,
  resumen: { totalMetros: "12.00", totalKilos: "0.00", totalBolsas: "0.00", totalPiezas: "0.00" },
});

test("adjustment series links use the roll primary id", async () => {
  const source = await readFile(
    new URL("artifacts/mariana-textil/src/pages/ajustes.tsx", root),
    "utf8",
  );

  assert.match(source, /href=\{`\/inventario\/rollos\/\$\{mov\.rolloId\}`\}/);
  assert.doesNotMatch(source, /href=\{`\/inventario\/rollos\/\$\{mov\.serie\}`\}/);
});

test("conciliation product links use the product primary id", async () => {
  const source = await readFile(
    new URL("artifacts/mariana-textil/src/pages/conciliacion.tsx", root),
    "utf8",
  );

  assert.match(source, /href=\{`\/productos\/\$\{row\.productoId\}`\}/);
  assert.doesNotMatch(source, /href=\{`\/productos\/\$\{row\.skuProducto\}`\}/);
});

test("kardex document cells keep desktop and mobile resolved-route branches", async () => {
  const movimientosPath = new URL("./movimientos.tsx", import.meta.url).pathname;
  await withBrowserFixture({
    entrySource: `
      import React from "react";
      import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
      import { LocationScopeProvider } from ${JSON.stringify(new URL("../lib/location-scope.tsx", import.meta.url).pathname)};
      import Movimientos from ${JSON.stringify(movimientosPath)};
      import { getGetCurrentUserQueryKey, getGetKardexGroupedQueryKey, getListKardexFiltersQueryKey } from "@workspace/api-client-react";
      const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
      client.setQueryData(getGetCurrentUserQueryKey(), ${JSON.stringify(grupo1KardexUser)});
      client.setQueryData(getListKardexFiltersQueryKey({}), { productos: [], usuarios: [], ubicaciones: [], tipos: [] });
      client.setQueryData(getGetKardexGroupedQueryKey({ page: 1, pageSize: 100 }), ${JSON.stringify(grupo1Kardex)});
      export default function Fixture() {
        return <QueryClientProvider client={client}><LocationScopeProvider><Movimientos /></LocationScopeProvider></QueryClientProvider>;
      }
    `,
    viewport: { width: 1280, height: 800 },
  }, async (page) => {
    const observedDocumentCells = async () => page.evaluate<{
      resolvedRoutes: string[];
      unresolvedText: string[];
      inventedRoutes: string[];
    }>(`(() => ({
      resolvedRoutes: Array.from(document.querySelectorAll('a[href="/entradas/440/documento"]')).filter((link) => link.checkVisibility()).map((link) => link.getAttribute("href") ?? ""),
      unresolvedText: Array.from(document.querySelectorAll("span")).filter((node) => node.checkVisibility()).map((node) => node.textContent?.trim() ?? "").filter((text) => text.includes("Nota 818") && text.includes("Referencia no resuelta")),
      inventedRoutes: Array.from(document.querySelectorAll("a")).filter((link) => link.checkVisibility()).map((link) => link.getAttribute("href") ?? "").filter((href) => href.includes("818")),
    }))()`);

    await page.waitFor(`document.body?.textContent?.includes("Entrada 817") && document.body?.textContent?.includes("Nota 818")`);
    const desktop = await observedDocumentCells();
    assert.deepEqual(desktop.resolvedRoutes, ["/entradas/440/documento"], "desktop opens the API-resolved document route");
    assert.deepEqual(desktop.unresolvedText, ["Nota 818 — Referencia no resuelta"], "desktop does not manufacture a destination for an unresolved reference");
    assert.deepEqual(desktop.inventedRoutes, [], "desktop never rebuilds a route from documentoId");

    await page.viewport(390, 844);
    await page.waitFor(`document.body?.textContent?.includes("Entrada 817") && document.body?.textContent?.includes("Nota 818")`);
    const mobile = await observedDocumentCells();
    assert.deepEqual(mobile.resolvedRoutes, ["/entradas/440/documento"], "mobile uses the same real MovimientoDocumento route");
    assert.deepEqual(mobile.unresolvedText, ["Nota 818 — Referencia no resuelta"], "mobile keeps the unresolved document unlinked");
    assert.deepEqual(mobile.inventedRoutes, [], "mobile never creates a guessed document destination");
  });
});