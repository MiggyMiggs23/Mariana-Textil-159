// Screen-placement capture. Uses the existing isolated browser harness and the
// existing schema-validated offline fixtures. Mock transport only: every figure
// shown is SYNTHETIC and is NOT operational data. No app DB, no auth, no writes.
import test from "node:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { withBrowserFixture } from "../../src/observable-test/browser";

// Phase comes from a sidecar file because the frontend test runner sanitizes env.
const phaseFile = new URL("./.phase", import.meta.url).pathname;
const phase = existsSync(phaseFile) && readFileSync(phaseFile, "utf8").trim() === "after" ? "after" : "before";
const require = createRequire(import.meta.url);
const src = (p: string) => new URL(`../../src/${p}`, import.meta.url).pathname;
const outDir = new URL(`./${phase}/`, import.meta.url).pathname;

const fixtureSource = ts.createSourceFile("f.ts", readFileSync(src("pages/caja/caja-tiempo-real-observable-test-support.ts"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
function existingFixture(name: string) {
  for (const s of fixtureSource.statements) {
    if (!ts.isVariableStatement(s)) continue;
    const d = s.declarationList.declarations.find(i => i.name.getText(fixtureSource) === name);
    if (d?.initializer) return JSON.parse(JSON.stringify(runInNewContext(d.initializer.getText(fixtureSource), { ...require("@workspace/api-zod"), emptyAccountRow: { importe: "0.00", cuentaDestino: null, formasPago: [] } })));
  }
  throw new Error(`missing fixture ${name}`);
}
const dashboard = existingFixture("dashboard");
const pending = existingFixture("pending");
// Complete synthetic Cuentas Destino payload with real account rows. It is
// validated against the generated response schema, and before and after use the same one.
// Cash 500.00 (320.00 invoiced) + no-fiscal 225.00 + fiscal 150.00 = collected 875.00;
// sales 850.00 cash-type + 150.00 credit = 1,000.00.
const acct = (importe: string, cuentaDestino: string | null) => ({ importe, cuentaDestino, formasPago: [] });
const cuentasDestino = require("@workspace/api-zod").GetAdminCuentasDestinoResponse.parse({
  ...existingFixture("cuentasDestino"),
  resumen: [
    { cuentaDestino: "CAJA_FISICA", formaPago: "EFECTIVO", importe: "500.00", importeAnterior: null, variacionPorcentaje: null, porcentaje: "57.14", operaciones: 14, cajaFisicaFacturado: "320.00" },
    { cuentaDestino: "CUENTA_NO_FISCAL", formaPago: "TRANSFERENCIA", importe: "225.00", importeAnterior: null, variacionPorcentaje: null, porcentaje: "25.71", operaciones: 4, cajaFisicaFacturado: "0.00" },
    { cuentaDestino: "CUENTA_FISCAL", formaPago: "TRANSFERENCIA", importe: "150.00", importeAnterior: null, variacionPorcentaje: null, porcentaje: "17.14", operaciones: 3, cajaFisicaFacturado: "0.00" },
    { cuentaDestino: "CUENTAS_POR_COBRAR", formaPago: "CREDITO", importe: "150.00", importeAnterior: null, variacionPorcentaje: null, porcentaje: "0.00", operaciones: 2, cajaFisicaFacturado: "0.00" },
  ],
  porTienda: [
    { ubicacionId: 1, nombreUbicacion: "Sucursal observable", cajaFisica: "320.00", cuentaFiscal: "150.00", cuentaNoFiscal: "125.00", cuentasPorCobrar: "90.00", cobrado: "595.00", porCobrar: "90.00", vendido: "660.00", total: "685.00" },
    { ubicacionId: 2, nombreUbicacion: "Sucursal sintética norte", cajaFisica: "180.00", cuentaFiscal: "0.00", cuentaNoFiscal: "100.00", cuentasPorCobrar: "60.00", cobrado: "280.00", porCobrar: "60.00", vendido: "340.00", total: "340.00" },
  ],
  matriz: {
    filas: [
      { facturado: true, efectivo: acct("320.00", "CAJA_FISICA"), transferencia: acct("150.00", "CUENTA_FISCAL"), porCobrar: acct("90.00", "CUENTAS_POR_COBRAR"), otras: acct("0.00", null), total: "560.00" },
      { facturado: false, efectivo: acct("155.00", "CAJA_FISICA"), transferencia: acct("225.00", "CUENTA_NO_FISCAL"), porCobrar: acct("60.00", "CUENTAS_POR_COBRAR"), otras: acct("0.00", null), total: "440.00" },
      { facturado: null, efectivo: acct("475.00", "CAJA_FISICA"), transferencia: acct("375.00", null), porCobrar: acct("150.00", "CUENTAS_POR_COBRAR"), otras: acct("0.00", null), total: "1000.00" },
    ],
    cierra: true,
  },
  ivaFacturado: { base: "482.76", iva: "77.24" },
  facturacion: { facturadoTotal: "470.00", noFacturadoTotal: "380.00", facturadoEfectivo: "320.00", facturadoTransferencia: "150.00", noFacturadoEfectivo: "155.00", noFacturadoTransferencia: "225.00" },
});

// Synthetic E7 attribution fixture matching the E7Atribucion contract.
const e7 = {
  alcance: { tipo: "GLOBAL", ubicaciones: [{ id: 1, nombre: "Sucursal observable" }], generadoEn: "2026-06-15T15:30:00.000Z", saldoAFavorDisponible: false },
  generadoEn: "2026-06-15T15:30:00.000Z",
  leyendas: [],
  cobranzaTotal: "875.00",
  recepcionesFisicas: "850.00",
  aplicacionesNotas: "25.00",
  movimientos: [
    { id: "m1", fecha: "2026-06-15", tipo: "VENTA_CONTADO", importe: "850.00", ubicacionId: 1, cuentaDestino: "EFECTIVO", folio: "5001", saldoPendiente: null, detailHref: null, documentHref: "/tickets/101" },
    { id: "m2", fecha: "2026-06-15", tipo: "APLICACION", importe: "25.00", ubicacionId: 1, cuentaDestino: null, folio: "5002", saldoPendiente: "125.00", detailHref: null, documentHref: null },
  ],
  puente: [{ tipo: "VENTA_CONTADO", cuentaDestino: "EFECTIVO", ubicacionId: 1, total: "850.00" }],
  retenidos: [],
  totalRetenido: "0.00",
};
const user = { id: 1, nombre: "Usuario sintético", username: "sintetico", rol: "ADMIN", permisos: [], ubicacionId: null };

const pageCss = ["pages/caja/cuentas-destino-layout.css", "pages/caja/tiempo-real-layout.css"].map(f => readFileSync(src(f), "utf8")).join("\n");
const pages = {
  "tiempo-real": { path: "pages/caja/tiempo-real.tsx", exportName: "default" },
  "cuentas-destino": { path: "pages/caja/cuentas-destino.tsx", exportName: "default" },
  ...(phase === "after" ? { "atribucion-e7": { path: "pages/caja/atribucion-e7.tsx", exportName: "default" } } : {}),
} as const;

test(`capture ${phase}`, { timeout: 600_000 }, async () => {
  await mkdir(outDir, { recursive: true });
  const dir = await mkdtemp(join(tmpdir(), "screen-placement-"));
  const realApi = require.resolve("@workspace/api-client-react", { paths: [src("..")] });
  const apiPath = join(dir, "api.ts"), layoutPath = join(dir, "layout.tsx"), scopePath = join(dir, "scope.ts");
  const q = (data: unknown) => `({ data: ${JSON.stringify(data)}, isLoading: false, isError: false, error: null, isFetchedAfterMount: true, dataUpdatedAt: 0, refetch() {} })`;
  await writeFile(apiPath, `export * from ${JSON.stringify(realApi)};
    export const useGetAdminRealtimeDashboard = () => ${q(dashboard)};
    export const useGetAdminRealtimePending = () => ${q(pending)};
    export const useGetAdminCuentasDestino = () => ${q(cuentasDestino)};
    export const useGetCurrentUser = () => ${q(user)};
    export const getCurrentUser = async () => (${JSON.stringify(user)});
    export const useGetE7Disponibilidad = () => ${q({ enabled: true, atribucion: true, clienteFinanzas: true })};
    export const useGetE7Atribucion = () => ${q(e7)};`);
  await writeFile(layoutPath, `export function AppLayout({ children }: { children: import("react").ReactNode }) { return <main className="p-4 md:p-8">{children}</main>; }`);
  await writeFile(scopePath, `export const useLocationScope = () => ({ selectedLocationId: null, setSelectedLocationId() {} });`);
  try {
    for (const [name, p] of Object.entries(pages)) {
      if (!existsSync(src(p.path))) continue;
      const entrySource = `
        import React from "react";
        import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
        import Page from ${JSON.stringify(src(p.path))};
        const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
        globalThis.fetch = async () => new Response("{}", { status: 404 });
        export default function Fixture() {
          return <QueryClientProvider client={client}>
            <div data-testid="synthetic-banner" style={{background:"#fde68a",color:"#3f2d00",padding:"6px 12px",fontWeight:700,fontSize:12}}>
              DATOS SINTÉTICOS · transporte simulado del arnés aislado · no son datos operativos
            </div>
            <Page />
          </QueryClientProvider>;
        }`;
      for (const [label, width] of [["desktop", 1440], ["mobile", 402]] as const) {
        await withBrowserFixture({
          entrySource,
          viewport: { width, height: 900 },
          moduleAliases: { "@workspace/api-client-react": apiPath, "@/components/layout/app-layout": layoutPath, "@/lib/location-scope": scopePath },
        }, async (page) => {
          await page.viewport(width, 900);
          await page.waitFor(`document.querySelector('[data-testid="synthetic-banner"]')`);
          // The harness compiles only index.css; page-scoped CSS imported by the real
          // components is injected verbatim so the capture matches the Vite build.
          await page.evaluate(`(() => { const st = document.createElement("style"); st.textContent = ${JSON.stringify(pageCss)}; document.head.appendChild(st); return true; })()`);
          await new Promise(r => setTimeout(r, 800));
          const h = await page.evaluate<number>("Math.min(3000, document.documentElement.scrollHeight)");
          await page.viewport(width, h);
          await new Promise(r => setTimeout(r, 400));
          await page.screenshot(join(outDir, `${name}-${label}.png`));
        });
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
