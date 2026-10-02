import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { UnidadProducto } from "../../../../lib/api-client-react/src/generated/api.schemas";
import { GetCatalogosEntradaResponse } from "../../../../lib/api-zod/src/generated/api";
import { withBrowserFixture } from "../observable-test/browser";

const entradasPath = new URL("./entradas.tsx", import.meta.url).pathname;
const schemasPath = new URL(
  "../../../../lib/api-client-react/src/generated/api.schemas.ts",
  import.meta.url,
).pathname;
const catalogosEntrada = GetCatalogosEntradaResponse.parse({
  productos: [
    { id: 71, sku: "MTR-71", tela: "Metro de prueba", color: "Azul", unidad: UnidadProducto.METRO, activo: true },
    { id: 72, sku: "KIL-72", tela: "Kilo de prueba", color: "Verde", unidad: UnidadProducto.KILO, activo: true },
    { id: 73, sku: "BOL-73", tela: "Bolsa de prueba", color: "Rojo", unidad: UnidadProducto.BOLSA, activo: true },
    { id: 74, sku: "PZA-74", tela: "Pieza de prueba", color: "Amarillo", unidad: UnidadProducto.PIEZA, activo: true },
  ],
  proveedores: [],
});
const unitContracts = [
  { product: catalogosEntrada.productos[0]!, label: "Mts.", min: "0.01", step: "0.01", placeholder: "0.00" },
  { product: catalogosEntrada.productos[1]!, label: "Kg.", min: "0.01", step: "0.01", placeholder: "0.00" },
  { product: catalogosEntrada.productos[2]!, label: "Bolsas", min: "1", step: "1", placeholder: "0" },
  { product: catalogosEntrada.productos[3]!, label: "Pzas.", min: "0.01", step: "0.01", placeholder: "0.00" },
] as const;

type Bounds = { left: number; right: number; top: number; bottom: number; width: number; height: number };

function nonOverlapping(first: Bounds, second: Bounds) {
  return first.right <= second.left || second.right <= first.left ||
    first.bottom <= second.top || second.bottom <= first.top;
}

const source = await readFile(new URL("./entradas.tsx", import.meta.url), "utf8");

test("la aplicación uniforme no está disponible cuando no quedan rollos en blanco", () => {
  const applyButton = source.slice(
    source.indexOf('data-testid="button-apply-uniform"') - 250,
    source.indexOf('data-testid="button-apply-uniform"') + 350,
  );

  assert.match(applyButton, /disabled=\{!uniformQty \|\| blankRollCount === 0\}/);
  assert.match(applyButton, /Aplicar a todos/);
  assert.match(applyButton, /Aplicar a los \$\{blankRollCount\} rollos restantes/);
  assert.match(source, /if \(blankCount === 0\) \{\s*toast\.info\("No hay rollos en blanco por completar\."\);\s*return;/);
});

test("reserva espacios separados para cantidad, unidad y cámara en la captura", async () => {
  const fixtureDirectory = await mkdtemp(join(tmpdir(), "capture-entradas-layout-"));
  const apiStub = join(fixtureDirectory, "api-client-react.ts");
  const layoutStub = join(fixtureDirectory, "app-layout.tsx");
  const historyStub = join(fixtureDirectory, "entrada-history.tsx");
  try {
    await Promise.all([
      writeFile(apiStub, `
        export { Role } from ${JSON.stringify(schemasPath)};
        const result = (data) => ({ data, isError: false, isLoading: false });
        const user = {
          id: 7, nombre: "Bodega de prueba", usuario: "bodega-fixture",
          rol: "BODEGA", alcanceConsulta: "PROPIA",
          ubicacion: { id: 4, nombre: "Bodega Norte", iniciales: "BN", tipo: "BODEGA", activa: true, esSistema: false },
          permisos: [{ modulo: "entradas", puedeVer: true, puedeCrear: true, puedeEditar: false, puedeAutorizar: false }],
        };
        const catalogos = ${JSON.stringify(catalogosEntrada)};
        export const getGetCatalogosEntradaQueryKey = () => ["catalogos-entrada"];
        export const getListLocationsQueryKey = () => ["locations"];
        export const getGetCurrentUserQueryKey = () => ["current-user"];
        export const getListEntradasQueryKey = () => ["entradas"];
        export const getGetDashboardQueryKey = () => ["dashboard"];
        export const getListRollosQueryKey = () => ["rollos"];
        export const getGetExistenciasQueryKey = () => ["existencias"];
        export const getGetFechaServidorQueryKey = () => ["fecha"];
        export const getListEntradasPendientesCostoQueryKey = () => ["pendientes"];
        export const getCountEntradasPendientesCostoQueryKey = () => ["count-pendientes"];
        export const getListContenedoresDisponiblesEntradaQueryKey = () => ["contenedores"];
        export const getListContenedoresQueryKey = () => ["contenedores-list"];
        export const getGetResumenContenedoresQueryKey = () => ["resumen-contenedores"];
        export const getGetContenedorQueryKey = () => ["contenedor"];
        export const useGetCurrentUser = () => result(user);
        export const useGetCatalogosEntrada = () => result(catalogos);
        export const useListLocations = () => result([user.ubicacion]);
        export const useGetFechaServidor = () => result({ fecha: "2025-01-15T12:00:00.000Z", zonaHoraria: "America/Mexico_City" });
        export const useListPisosLocation = () => result([]);
        export const useListContenedoresDisponiblesEntrada = () => ({ ...result([]), refetch: async () => result([]) });
        export const useCrearEntrada = () => ({ mutate() {}, isPending: false });
        export const useListEntradasPendientesCosto = () => result({ items: [], total: 0, pageSize: 10 });
        export const useCountEntradasPendientesCosto = () => result({ count: 0 });
      `),
      writeFile(layoutStub, `
        import React from "react";
        export function AppLayout({ children }) {
          return React.createElement("main", { "data-testid": "entradas-page" }, children);
        }
      `),
      writeFile(historyStub, `
        import React from "react";
        export function EntradaHistory() {
          return React.createElement("section", { "data-testid": "fixture-entrada-history" });
        }
      `),
    ]);
    for (const contract of unitContracts) {
      await withBrowserFixture({
        entrySource: `
          import React from "react";
          import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
          import Entradas from ${JSON.stringify(entradasPath)};
          Object.defineProperty(navigator, "mediaDevices", {
            configurable: true,
            value: {
              enumerateDevices: async () => [{ kind: "videoinput" }],
              getUserMedia: async () => { throw new Error("La fixture no abre la cámara"); },
            },
          });
          const client = new QueryClient();
          export default function Fixture() {
            return React.createElement(QueryClientProvider, { client }, React.createElement(Entradas));
          }
        `,
        moduleAliases: {
          "@workspace/api-client-react": apiStub,
          "@/components/layout/app-layout": layoutStub,
          "@/components/entrada-history": historyStub,
        },
        viewport: { width: 1280, height: 800 },
      }, async (page) => {
        await page.waitFor(`document.querySelector('[data-testid="btn-create-entrada"]')`);
        await page.click('[data-testid="btn-create-entrada"]');
        await page.waitFor(`getComputedStyle(document.querySelector('[data-testid="entrada-capture-surface"]')).display !== "none"`);
        await page.click('[data-testid="input-entrada-producto"]');
        await page.fill('[data-testid="input-entrada-producto"]', contract.product.tela);
        await page.waitFor(`document.querySelector('[data-testid="input-entrada-producto"]').getAttribute("aria-expanded") === "true"`);
        await page.press('[data-testid="input-entrada-producto"]', "Enter");
        await page.fill('[data-testid="input-declared"]', "2");
        await page.click('[data-testid="btn-add-line"]');
        await page.waitFor(`document.querySelector('[data-testid="input-capture-qty"]')`);
        await page.waitFor(`document.querySelector('button[aria-label="Escanear con cámara"]')`);

        const measure = async () => page.evaluate<{
          amount: Bounds; unit: Bounds; camera: Bounds; uniformUnit: string; captureUnit: string;
          captureProps: { type: string; min: string | null; step: string | null; placeholder: string | null };
          uniformProps: { type: string; min: string | null; step: string | null; placeholder: string | null };
        }>(`(() => {
          const amount = document.querySelector('[data-testid="input-capture-qty"]');
          const unit = document.querySelector('[data-testid="capture-qty-unit"]');
          const camera = document.querySelector('button[aria-label="Escanear con cámara"]');
          const uniform = document.querySelector('[data-testid="input-uniform-qty"]');
          const uniformUnit = document.querySelector('[data-testid="uniform-qty-unit"]');
          if (!(amount instanceof HTMLInputElement) || !unit || !camera || !(uniform instanceof HTMLInputElement) || !uniformUnit) {
            throw new Error("La captura no mostró todos sus controles");
          }
          const bounds = (element) => {
            const rect = element.getBoundingClientRect();
            return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
          };
          const inputProps = (input) => ({
            type: input.type, min: input.getAttribute("min"), step: input.getAttribute("step"),
            placeholder: input.getAttribute("placeholder"),
          });
          return {
            amount: bounds(amount), unit: bounds(unit), camera: bounds(camera),
            uniformUnit: uniformUnit.textContent.trim(), captureUnit: unit.textContent.trim(),
            captureProps: inputProps(amount), uniformProps: inputProps(uniform),
          };
        })()`);

        const assertCaptureContract = (view: string, measured: Awaited<ReturnType<typeof measure>>) => {
          assert.equal(measured.uniformUnit, contract.label, `la aplicación uniforme muestra ${contract.label} para ${contract.product.unidad} en ${view}`);
          assert.equal(measured.captureUnit, contract.label, `la captura muestra ${contract.label} para ${contract.product.unidad} en ${view}`);
          assert.equal(measured.captureProps.type, "number", `la cantidad es numérica para ${contract.product.unidad}`);
          assert.equal(measured.captureProps.step, contract.step, `el paso de captura corresponde a ${contract.product.unidad}`);
          assert.equal(measured.captureProps.placeholder, contract.placeholder, `el placeholder de captura corresponde a ${contract.product.unidad}`);
          assert.equal(measured.uniformProps.type, "number", `la cantidad uniforme es numérica para ${contract.product.unidad}`);
          assert.equal(measured.uniformProps.min, contract.min, `el mínimo uniforme corresponde a ${contract.product.unidad}`);
          assert.equal(measured.uniformProps.step, contract.step, `el paso uniforme corresponde a ${contract.product.unidad}`);
          assert.equal(nonOverlapping(measured.amount, measured.unit), true, `cantidad y unidad no se superponen para ${contract.product.unidad} en ${view}`);
          assert.equal(nonOverlapping(measured.unit, measured.camera), true, `unidad y cámara no se superponen para ${contract.product.unidad} en ${view}`);
          assert.equal(measured.camera.width > 0 && measured.camera.height > 0, true, `la acción de cámara queda disponible para ${contract.product.unidad} en ${view}`);
        };

        assertCaptureContract("escritorio", await measure());
        await page.viewport(390, 844);
        assertCaptureContract("móvil", await measure());
      });
    }
  } finally {
    await rm(fixtureDirectory, { recursive: true, force: true });
  }
});