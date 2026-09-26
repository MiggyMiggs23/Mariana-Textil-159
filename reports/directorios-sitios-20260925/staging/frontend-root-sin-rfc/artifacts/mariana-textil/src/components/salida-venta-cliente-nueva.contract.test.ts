import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { withBrowserFixture } from "../observable-test/browser";

const salidaPath = new URL("./salida-venta-cliente-nueva.tsx", import.meta.url).pathname;
const schemasPath = new URL(
  "../../../../lib/api-client-react/src/generated/api.schemas.ts",
  import.meta.url,
).pathname;

test("customer-sale assembly keeps a visible circular roll counter in sync with scans", async () => {
  const fixtureDirectory = await mkdtemp(join(tmpdir(), "capture-sale-counter-"));
  const apiStub = join(fixtureDirectory, "api-client-react.ts");
  const layoutStub = join(fixtureDirectory, "app-layout.tsx");
  const clientStub = join(fixtureDirectory, "client-selector.tsx");
  const toastStub = join(fixtureDirectory, "use-toast.ts");
  try {
    await Promise.all([
      writeFile(apiStub, `
        import { Role } from ${JSON.stringify(schemasPath)};
        export { Role };
        export const useGetCurrentUser = () => ({ data: { rol: Role.ADMIN, ubicacion: null } });
        export const useGetUbicacionesSalida = () => ({ data: [] });
        export const useCrearEnviarSalidaVentaCliente = () => ({ mutate() {}, isPending: false });
        export const getListSalidasQueryKey = () => ["salidas"];
      `),
      writeFile(layoutStub, `
        import React from "react";
        export function AppLayout({ children }) {
          return React.createElement("main", { "data-testid": "sale-page" }, children);
        }
      `),
      writeFile(clientStub, `
        import React from "react";
        export function ClientSelector() {
          return React.createElement("input", { "aria-label": "Cliente" });
        }
      `),
      writeFile(toastStub, `export const useToast = () => ({ toast() {} });`),
    ]);
    await withBrowserFixture({
      entrySource: `
        import React from "react";
        import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
        import { SalidaVentaClienteNueva } from ${JSON.stringify(salidaPath)};
        const client = new QueryClient();
        export default function Fixture() {
          return React.createElement(QueryClientProvider, { client },
            React.createElement(SalidaVentaClienteNueva));
        }
      `,
      moduleAliases: {
        "@workspace/api-client-react": apiStub,
        "@/components/layout/app-layout": layoutStub,
        "@/components/client-selector": clientStub,
        "@/hooks/use-toast": toastStub,
      },
      viewport: { width: 1280, height: 800 },
    }, async (page) => {
      await page.waitFor(`document.querySelector('[data-testid="contador-rollos-capturados"]')`);
      const inspectCounter = () => page.evaluate<{
        visible: boolean; width: number; height: number; radius: string; value: string;
      }>(`(() => {
        const counter = document.querySelector('[data-testid="contador-rollos-capturados"]');
        if (!counter) throw new Error("No se mostró el contador de rollos");
        const rect = counter.getBoundingClientRect();
        const style = getComputedStyle(counter);
        return {
          visible: rect.width > 0 && rect.height > 0 && style.visibility !== "hidden",
          width: rect.width, height: rect.height, radius: style.borderRadius,
          value: counter.textContent.trim(),
        };
      })()`);
      const assertCircularCounter = async (viewport: string) => {
        const counter = await inspectCounter();
        assert.equal(counter.visible, true, `el contador debe ser visible en ${viewport}`);
        assert.equal(counter.width, counter.height, `el contador debe conservar una huella circular en ${viewport}`);
        assert.notEqual(counter.radius, "0px", `el contador debe tener borde circular en ${viewport}`);
        assert.equal(counter.value, "0", `el contador inicia sin series en ${viewport}`);
      };

      await assertCircularCounter("escritorio");
      await page.viewport(390, 844);
      await assertCircularCounter("móvil de 390 px");
      await page.viewport(402, 874);
      await assertCircularCounter("móvil de 402 px");

      const scanInput = '[placeholder="Escanea la serie identificada y presiona Enter"]';
      await page.fill(scanInput, "SERIE-001");
      await page.press(scanInput, "Enter");
      await page.evaluate(`new Promise((done) => setTimeout(done, 50))`);
      assert.equal(
        await page.evaluate<string>(`document.querySelector('[data-testid="contador-rollos-capturados"]').textContent.trim()`),
        "1",
        "la primera serie agregada debe actualizar el contador visible",
      );
      await page.fill(scanInput, "SERIE-002");
      await page.press(scanInput, "Enter");
      await page.evaluate(`new Promise((done) => setTimeout(done, 50))`);
      assert.equal(
        await page.evaluate<string>(`document.querySelector('[data-testid="contador-rollos-capturados"]').textContent.trim()`),
        "2",
        "cada serie agregada debe actualizar el contador visible",
      );

      await page.click('[aria-label="Quitar serie SERIE-001"]');
      await page.evaluate(`new Promise((done) => setTimeout(done, 50))`);
      assert.equal(
        await page.evaluate<string>(`document.querySelector('[data-testid="contador-rollos-capturados"]').textContent.trim()`),
        "1",
        "quitar una serie debe disminuir el mismo contador visible",
      );
      await page.click('[aria-label="Quitar serie SERIE-002"]');
      await page.evaluate(`new Promise((done) => setTimeout(done, 50))`);
      assert.equal(
        await page.evaluate<string>(`document.querySelector('[data-testid="contador-rollos-capturados"]').textContent.trim()`),
        "0",
        "quitar la última serie debe devolver el contador visible a cero",
      );
    });
  } finally {
    await rm(fixtureDirectory, { recursive: true, force: true });
  }
});