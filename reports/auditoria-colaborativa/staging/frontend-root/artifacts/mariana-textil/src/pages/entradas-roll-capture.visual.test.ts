import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { UnidadProducto } from "../../../../lib/api-client-react/src/generated/api.schemas";
import {
  GetCatalogosEntradaResponse,
  ListPisosLocationResponse,
} from "../../../../lib/api-zod/src/generated/api";
import { withBrowserFixture } from "../observable-test/browser";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const workspaceRoot = resolve(appRoot, "../..");
const schemasPath = resolve(workspaceRoot, "lib/api-client-react/src/generated/api.schemas.ts");
const evidenceDirectory = resolve(workspaceRoot, "reports/captura-rollos-2026-09-18");
const frozenRevision = "7cb77f8";
const frozenPath = resolve(evidenceDirectory, `entradas.before.${frozenRevision}.tsx`);
const currentPath = resolve(appRoot, "src/pages/entradas.tsx");
type Bounds = { left: number; right: number; top: number; bottom: number; width: number; height: number };

const catalogos = GetCatalogosEntradaResponse.parse({
  productos: [{
    id: 71,
    sku: "MTR-71",
    tela: "Metro de prueba",
    color: "Azul",
    unidad: UnidadProducto.METRO,
    activo: true,
  }],
  proveedores: [],
});

const pisos = ListPisosLocationResponse.parse([
  { id: 1, ubicacionId: 2, nombre: "Planta Baja", activo: true, createdAt: "2026-09-18T12:00:00Z", updatedAt: "2026-09-18T12:00:00Z" },
  { id: 2, ubicacionId: 2, nombre: "Primer Piso", activo: true, createdAt: "2026-09-18T12:00:00Z", updatedAt: "2026-09-18T12:00:00Z" },
  {
    id: 9001,
    ubicacionId: 2,
    nombre: "Planta superior — almacenamiento y preparación de mercancía",
    activo: true,
    createdAt: "2026-09-18T12:00:00Z",
    updatedAt: "2026-09-18T12:00:00Z",
  },
]);

async function fixtureAliases(directory: string) {
  const apiStub = join(directory, "api-client-react.ts");
  const layoutStub = join(directory, "app-layout.tsx");
  const historyStub = join(directory, "entrada-history.tsx");
  await Promise.all([
    writeFile(apiStub, `
      export { Role } from ${JSON.stringify(schemasPath)};
      const result = (data) => ({ data, isError: false, isLoading: false });
      const user = {
        id: 7, nombre: "Bodega de prueba", usuario: "bodega-fixture",
        rol: "BODEGA", alcanceConsulta: "PROPIA",
        ubicacion: { id: 2, nombre: "Mariana", iniciales: "MA", tipo: "BODEGA", activa: true, esSistema: false },
        permisos: [{ modulo: "entradas", puedeVer: true, puedeCrear: true, puedeEditar: false, puedeAutorizar: false }],
      };
      const catalogos = ${JSON.stringify(catalogos)};
      const pisos = ${JSON.stringify(pisos)};
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
      export const useGetFechaServidor = () => result({ fecha: "2026-09-18T12:00:00.000Z", zonaHoraria: "America/Mexico_City" });
      export const useListPisosLocation = () => result(pisos);
      export const useListContenedoresDisponiblesEntrada = () => ({ ...result([]), refetch: async () => result([]) });
      export const useCrearEntrada = () => ({ mutate() { throw new Error("La fixture no permite escrituras"); }, isPending: false });
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
  return {
    "@workspace/api-client-react": apiStub,
    "@/components/layout/app-layout": layoutStub,
    "@/components/entrada-history": historyStub,
  };
}

type FixturePage = Parameters<Parameters<typeof withBrowserFixture>[1]>[0];

async function selectFloor(page: FixturePage, triggerSelector: string, floorName: string, activation: "keyboard" | "pointer") {
  await page.evaluate(`new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 300))))`);
  const activate = activation === "keyboard"
    ? () => page.press(triggerSelector, "Enter")
    : () => page.click(triggerSelector);
  await activate();
  await page.evaluate(`new Promise((resolve) => setTimeout(resolve, 300))`);
  let opened = await page.evaluate<boolean>(`Boolean(document.querySelector('[role="listbox"]'))`);
  if (!opened) {
    await page.evaluate(`document.querySelector(${JSON.stringify(triggerSelector)})?.scrollIntoView({ block: "center" })`);
    await activate();
    await page.evaluate(`new Promise((resolve) => setTimeout(resolve, 300))`);
    opened = await page.evaluate<boolean>(`Boolean(document.querySelector('[role="listbox"]'))`);
  }
  if (!opened) {
    const diagnostics = await page.evaluate<string>(`(() => {
      const trigger = document.querySelector(${JSON.stringify(triggerSelector)});
      return JSON.stringify({
        text: trigger?.textContent,
        expanded: trigger?.getAttribute("aria-expanded"),
        disabled: trigger?.hasAttribute("disabled"),
        active: document.activeElement === trigger,
      });
    })()`);
    throw new Error("El selector de piso no abrió: " + diagnostics);
  }
  await page.waitFor(`document.activeElement?.getAttribute("role") === "option"`);
  await page.evaluate(`(() => {
    const option = [...document.querySelectorAll('[role="option"]')]
      .find((element) => element.textContent.includes(${JSON.stringify(floorName)}));
    if (!(option instanceof HTMLElement)) throw new Error("No apareció el piso esperado");
    option.dataset.testFixtureFloorOption = "true";
    option.focus();
  })()`);
  await page.press('[data-test-fixture-floor-option="true"]', "Enter");
  await page.waitFor(`document.querySelector(${JSON.stringify(triggerSelector)})?.textContent.includes(${JSON.stringify(floorName)})`);
  await page.waitFor(`!document.querySelector('[role="listbox"]')`);
  await page.evaluate(`new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 250))))`);
}

async function openCapture(
  page: FixturePage,
  count: number,
  floorName: string | null = "Primer Piso",
  activation: "keyboard" | "pointer" = "keyboard",
) {
  await page.waitFor(`document.querySelector('[data-testid="btn-create-entrada"]')`);
  await page.click('[data-testid="btn-create-entrada"]');
  await page.click('[data-testid="input-entrada-producto"]');
  await page.fill('[data-testid="input-entrada-producto"]', "Metro de prueba");
  await page.waitFor(`document.querySelector('[data-testid="input-entrada-producto"]').getAttribute("aria-expanded") === "true"`);
  await page.press('[data-testid="input-entrada-producto"]', "Enter");
  await page.fill('[data-testid="input-declared"]', String(count));
  await page.click('[data-testid="btn-add-line"]');
  await page.waitFor(`document.querySelector('[data-testid="input-capture-qty"]')`);
  if (floorName) {
    await page.evaluate(`(() => {
      const trigger = document.querySelector('[data-testid="trigger-bulk-floor"]') ||
        [...document.querySelectorAll('button[role="combobox"]')]
          .find((element) => element.textContent.includes("Sin piso (elegir individualmente)"));
      if (!(trigger instanceof HTMLElement)) throw new Error("No apareció el control de piso general");
      trigger.dataset.testFixtureBulkFloor = "true";
    })()`);
    await selectFloor(page, '[data-test-fixture-bulk-floor="true"]', floorName, activation);
  }
}

async function runMatrix(sourcePath: string, prefix: "before" | "after") {
  const directory = await mkdtemp(join(tmpdir(), `entradas-${prefix}-`));
  try {
    const aliases = await fixtureAliases(directory);
    for (const viewport of [{ name: "desktop-1280", width: 1280, height: 800 }, { name: "mobile-402", width: 402, height: 874 }]) {
      for (const count of [1, 20]) {
        await withBrowserFixture({
          entrySource: `
            import React from "react";
            import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
            import Entradas from ${JSON.stringify(sourcePath)};
            Object.defineProperty(navigator, "mediaDevices", {
              configurable: true,
              value: {
                enumerateDevices: async () => [{ kind: "videoinput" }],
                getUserMedia: async () => { throw new Error("La fixture no abre hardware de cámara"); },
              },
            });
            const client = new QueryClient();
            export default function Fixture() {
              return React.createElement(QueryClientProvider, { client }, React.createElement(Entradas));
            }
          `,
          moduleAliases: aliases,
          viewport,
          tailwindSourceFiles: [sourcePath],
        }, async (page) => {
          await openCapture(page, count, "Primer Piso", "keyboard");
          const state = await page.evaluate<{ floor: string; rows: number }>(`(() => {
            const surface = document.querySelector('[role="dialog"]');
            if (!(surface instanceof HTMLElement)) throw new Error("No apareció el diálogo real");
            return {
              floor: [...surface.querySelectorAll('button[role="combobox"]')].map((e) => e.textContent.trim()).find((text) => text.includes("Primer Piso")) || "",
              rows: surface.querySelectorAll('[data-testid^="row-captured-roll-"]').length,
            };
          })()`);
          assert.match(state.floor, /Primer Piso/);
          assert.equal(state.rows, 0, "antes de aplicar no hay filas capturadas visibles");
          if (prefix === "after") {
            const geometry = await page.evaluate<{
              horizontalOverflow: boolean;
              fullFloor: boolean;
              quantityLabel: string;
              floorLabel: string;
              quantity: Bounds;
              floor: Bounds;
              next: Bounds;
            }>(`(() => {
              const dialog = document.querySelector('[role="dialog"]');
              const quantity = document.querySelector('[data-testid="input-capture-qty"]');
              const floor = document.querySelector('[data-testid="trigger-single-floor"]');
              const next = document.querySelector('[data-testid="button-add-captured-roll"]');
              if (!(dialog instanceof HTMLElement) || !quantity || !floor || !next) throw new Error("Faltan controles");
              const bounds = (element) => {
                const rect = element.getBoundingClientRect();
                return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
              };
              return {
                horizontalOverflow: dialog.scrollWidth > dialog.clientWidth,
                fullFloor: document.querySelector('[data-testid="trigger-bulk-floor"]')?.textContent?.trim() === "Primer Piso",
                quantityLabel: document.querySelector('label[for="roll-current-quantity"]')?.textContent?.trim() || "",
                floorLabel: document.querySelector('label[for="roll-current-floor"]')?.textContent?.trim() || "",
                quantity: bounds(quantity), floor: bounds(floor), next: bounds(next),
              };
            })()`);
            assert.equal(geometry.horizontalOverflow, false);
            assert.equal(geometry.fullFloor, true);
            assert.equal(geometry.quantityLabel, "Cantidad de este rollo");
            assert.equal(geometry.floorLabel, "Piso de este rollo");
            assert.equal(geometry.quantity.bottom <= geometry.floor.top, true, "cantidad queda antes del piso");
            assert.equal(geometry.floor.bottom <= geometry.next.top, true, "Siguiente rollo es el último campo");
            assert.equal(geometry.next.width >= geometry.floor.width - 1, true, "Siguiente rollo ocupa su fila");
          }
          await page.screenshot(join(evidenceDirectory, `${prefix}-${viewport.name}-${count}-rollos.png`));
        });
      }
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("captura la matriz BEFORE desde Entradas real congelado en git", async () => {
  await runMatrix(frozenPath, "before");
});

test("captura la matriz AFTER desde Entradas real actualizado", async () => {
  await runMatrix(currentPath, "after");
});

test("captura individual exige piso y permite editar, vaciar y recapturar", async () => {
  const directory = await mkdtemp(join(tmpdir(), "entradas-mechanics-"));
  try {
    const aliases = await fixtureAliases(directory);
    await withBrowserFixture({
      entrySource: `
        import React from "react";
        import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
        import Entradas from ${JSON.stringify(currentPath)};
        Object.defineProperty(navigator, "mediaDevices", {
          configurable: true,
          value: { enumerateDevices: async () => [{ kind: "videoinput" }], getUserMedia: async () => { throw new Error("Sin hardware"); } },
        });
        window.__fixtureConfirm = true;
        window.confirm = () => window.__fixtureConfirm;
        const client = new QueryClient();
        export default function Fixture() {
          return React.createElement(QueryClientProvider, { client }, React.createElement(Entradas));
        }
      `,
      moduleAliases: aliases,
      viewport: { width: 402, height: 874 },
      tailwindSourceFiles: [currentPath],
    }, async (page) => {
      await openCapture(page, 2, null);
      await page.fill('[data-testid="input-capture-qty"]', "9");
      assert.equal(await page.evaluate(`document.querySelector('[data-testid="button-add-captured-roll"]').disabled`), true);
      assert.equal(
        await page.evaluate(`Boolean(document.querySelector('[data-testid="trigger-single-floor"]'))`),
        true,
        "la captura individual expone su control de piso separado",
      );

      await selectFloor(page, '[data-testid="trigger-single-floor"]', pisos[2]!.nombre, "keyboard");
      await page.click('[data-testid="button-add-captured-roll"]');
      await page.waitFor(`document.querySelector('[data-testid="row-captured-roll-0"]')?.textContent.includes("9")`);
      const firstCapture = await page.evaluate<{ text: string; counter: string; fullFloor: boolean; overflow: boolean }>(`(() => {
        const row = document.querySelector('[data-testid="row-captured-roll-0"]');
        const trigger = document.querySelector('[data-testid="trigger-single-floor"]');
        const dialog = document.querySelector('[role="dialog"]');
        return {
          text: row?.textContent || "",
          counter: [...document.querySelectorAll('[role="dialog"] *')].map((e) => e.textContent?.trim()).find((text) => text === "Rollo 2 de 2") || "",
          fullFloor: trigger?.textContent?.trim() === ${JSON.stringify(pisos[2]!.nombre)},
          overflow: dialog instanceof HTMLElement && dialog.scrollWidth > dialog.clientWidth,
        };
      })()`);
      assert.match(firstCapture.text, /9/);
      assert.match(firstCapture.text, new RegExp(pisos[2]!.nombre));
      assert.equal(firstCapture.counter, "Rollo 2 de 2");
      assert.equal(firstCapture.fullFloor, true, "el piso de estrés se lee completo");
      assert.equal(firstCapture.overflow, false, "el diálogo no tiene desbordamiento horizontal");

      await page.click('[data-testid="btn-edit-roll-0"]');
      await page.fill('[data-testid="input-edit-roll-0"]', "11");
      await page.click('[data-testid="btn-save-roll-0"]');
      await page.waitFor(`document.querySelector('[data-testid="row-captured-roll-0"]')?.textContent.includes("11")`);
      await page.click('[data-testid="btn-delete-roll-0"]');
      await page.waitFor(`!document.querySelector('[data-testid="row-captured-roll-0"]')`);
      assert.match(await page.evaluate<string>(`document.querySelector('[role="dialog"]')?.textContent || ""`), /Rollo 1 de 2/);

      await page.fill('[data-testid="input-capture-qty"]', "12");
      await page.click('[data-testid="button-add-captured-roll"]');
      await page.waitFor(`document.querySelector('[data-testid="row-captured-roll-0"]')?.textContent.includes("12")`);
      const recaptured = await page.evaluate<string>(`document.querySelector('[data-testid="row-captured-roll-0"]')?.textContent || ""`);
      assert.match(recaptured, /12 Mts\./);
      assert.doesNotMatch(recaptured, /11 Mts\./);
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("lote asigna piso a todos, Aplicar conserva ajustes y sobrescribir confirma", async () => {
  const directory = await mkdtemp(join(tmpdir(), "entradas-bulk-"));
  try {
    const aliases = await fixtureAliases(directory);
    await withBrowserFixture({
      entrySource: `
        import React from "react";
        import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
        import Entradas from ${JSON.stringify(currentPath)};
        Object.defineProperty(navigator, "mediaDevices", {
          configurable: true,
          value: { enumerateDevices: async () => [{ kind: "videoinput" }], getUserMedia: async () => { throw new Error("Sin hardware"); } },
        });
        window.__fixtureConfirm = false;
        window.__fixtureConfirmCalls = [];
        window.confirm = (message) => { window.__fixtureConfirmCalls.push(message); return window.__fixtureConfirm; };
        const client = new QueryClient();
        export default function Fixture() {
          return React.createElement(QueryClientProvider, { client }, React.createElement(Entradas));
        }
      `,
      moduleAliases: aliases,
      viewport: { width: 1280, height: 800 },
      tailwindSourceFiles: [currentPath],
    }, async (page) => {
      await openCapture(page, 3);
      await page.fill('[data-testid="input-uniform-qty"]', "10");
      await page.click('[data-testid="button-apply-uniform"]');
      await page.waitFor(`document.querySelectorAll('[data-testid^="row-captured-roll-"]').length === 3`);
      const bulk = await page.evaluate<{ floors: number; uniform: string; blank: string }>(`(() => ({
        floors: [...document.querySelectorAll('[data-testid^="row-captured-roll-"]')].filter((row) => row.textContent.includes("Primer Piso")).length,
        uniform: document.querySelector('[data-testid="count-uniform-rolls"]')?.textContent || "",
        blank: document.querySelector('[data-testid="count-blank-rolls"]')?.textContent || "",
      }))()`);
      assert.equal(bulk.floors, 3, "un solo control de piso actualiza los tres rollos");
      assert.match(bulk.uniform, /3/);
      assert.match(bulk.blank, /0/);

      await page.click('[data-testid="btn-edit-roll-1"]');
      await page.fill('[data-testid="input-edit-roll-1"]', "11");
      await page.click('[data-testid="btn-save-roll-1"]');
      assert.match(
        await page.evaluate<string>(`document.querySelector('[data-testid="count-adjusted-rolls"]')?.textContent || ""`),
        /1/,
      );
      await page.click('[data-testid="btn-delete-roll-2"]');
      await page.fill('[data-testid="input-uniform-qty"]', "20");
      await page.click('[data-testid="button-apply-uniform"]');
      await page.waitFor(`document.querySelector('[data-testid="row-captured-roll-2"]')?.textContent.includes("20")`);
      assert.match(await page.evaluate<string>(`document.querySelector('[data-testid="row-captured-roll-1"]')?.textContent || ""`), /11/);

      await page.fill('[data-testid="input-uniform-qty"]', "30");
      await page.click('[data-testid="button-overwrite-uniform"]');
      assert.match(await page.evaluate<string>(`window.__fixtureConfirmCalls.at(-1) || ""`), /reemplazarán|reemplazarán/i);
      assert.match(await page.evaluate<string>(`document.querySelector('[data-testid="row-captured-roll-1"]')?.textContent || ""`), /11/);
      await page.evaluate(`window.__fixtureConfirm = true`);
      await page.click('[data-testid="button-overwrite-uniform"]');
      await page.waitFor(`[...document.querySelectorAll('[data-testid^="row-captured-roll-"]')].every((row) => row.textContent.includes("30"))`);
      assert.match(await page.evaluate<string>(`document.querySelector('[data-testid="count-uniform-rolls"]')?.textContent || ""`), /3/);
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
