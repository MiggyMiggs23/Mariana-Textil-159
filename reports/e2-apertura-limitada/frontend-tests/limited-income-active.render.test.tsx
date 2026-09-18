import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { withBrowserFixture } from "../observable-test/browser";

async function fixture(scenario: "ok" | "empty" | "loading" | "stale", run: (page: any) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "limited-income-ui-"));
  const api = join(dir, "api.ts");
  const scope = join(dir, "scope.ts");
  const toast = join(dir, "toast.ts");
  try {
    await writeFile(scope, 'export const useLocationScope = () => ({ selectedLocationId: 2, setSelectedLocationId() {} });');
    await writeFile(toast, 'export const useToast = () => ({ toast(value) { window.__toast = value; } });');
    await writeFile(api, `
      const session = { id: 88, ubicacionId: 2, nombreUbicacion: "Caja B", usuarioId: 7, nombreUsuario: "Caja", abiertaAt: "2026-09-18T13:00:00.000Z", cerradaAt: null, fondoInicial: "100.00", efectivoContado: null, estado: "ABIERTA" };
      export const getObtenerSesionCajaActualQueryKey = (p) => ["/api/sesiones-caja/actual", p];
      export const getListLocationsQueryKey = () => ["/api/locations"];
      export const useGetCurrentUser = () => ({ data: { id: 7, rol: "CAJA", ubicacion: { id: 2, nombre: "Caja B", activa: true, tipo: "TIENDA" } } });
      export const useListLocations = () => ({ data: [], error: null });
      export const useObtenerSesionCajaActual = (params, options) => {
        window.__sessionParams = params; window.__sessionEnabled = options?.query?.enabled;
        const initial = window.__scenario === "empty" ? null : session;
        const refreshed = window.__scenario === "stale" ? { ...session, ubicacionId: 3 } : initial;
        return { data: { sesion: initial, resumen: null }, isLoading: window.__scenario === "loading", isFetching: false, isError: false,
          refetch: async () => ({ data: { sesion: refreshed, resumen: null }, isError: false }) };
      };
      export const usePreviewClientePago = () => ({ isPending: false, mutate(payload, callbacks) { window.__previews=(window.__previews||0)+1; window.__previewPayload=payload; callbacks?.onSuccess?.({ monto: String(payload.data.importe), asignaciones: [], saldoAFavor: "0.00", saldoAFavorGenerado: "0.00" }); } });
      export const useCreateClientePago = () => ({ isPending: false, mutate(payload) { window.__creates=(window.__creates||0)+1; window.__createdPayload=payload; } });
      export const useCreateSolicitudPagoDirigido = () => ({ isPending: false, mutate(payload) { window.__directed=(window.__directed||0)+1; window.__directedPayload=payload; } });
    `);
    await withBrowserFixture({
      entrySource: `
        import React from "react";
        import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
        import { ClientePagoDialog } from "__ACTIVE_APP_ROOT__/artifacts/mariana-textil/src/components/cliente-pago-dialog.tsx";
        window.fetch=async()=>{throw new Error("NETWORK_BLOCKED")}; window.__scenario=${JSON.stringify(scenario)}; window.__creates=0; window.__previews=0; window.__directed=0;
        const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
        export default function Fixture(){return <QueryClientProvider client={client}><ClientePagoDialog open onOpenChange={()=>{}} clienteId={9} saldoActual="300.00" /></QueryClientProvider>}
      `,
      moduleAliases: { "@workspace/api-client-react": api, "@/lib/location-scope": scope, "@/hooks/use-toast": toast },
    }, run);
  } finally { await rm(dir, { recursive: true, force: true }); }
}

async function selectFirst(page: any, selector: string) {
  await page.press(selector, "Enter");
  await page.waitFor('document.querySelector(\'[role="option"]\') !== null');
  await page.press('[role="option"]', "Enter");
  if (await page.evaluate('document.querySelector(\'[role="listbox"]\') !== null')) {
    await page.press('[role="option"]', "Escape");
  }
  await page.waitFor('document.querySelector(\'[role="listbox"]\') === null');
}

async function chooseNative(page: any, selector: string, value: string) {
  await page.evaluate(`(() => { const select = document.querySelector(${JSON.stringify(selector)}); select.value = ${JSON.stringify(value)}; select.dispatchEvent(new Event("change", { bubbles: true })); })()`);
}

async function prepareCash(page: any) {
  await page.waitFor(`document.querySelector('[aria-label="Naturaleza del movimiento"]') !== null`);
  await selectFirst(page, '[aria-label="Naturaleza del movimiento"]');
  await page.waitFor(`document.querySelector('[data-testid="cliente-payment-method"]') !== null`);
  await chooseNative(page, '[data-testid="cliente-payment-method"]', "EFECTIVO");
  await page.fill('[data-testid="cliente-payment-amount"]', "125.50");
}

test("activated candidate sends exact physical-cash context once after current-session revalidation", async () => {
  await fixture("ok", async page => {
    await page.waitFor('document.querySelector(\'[data-testid="cliente-payment-method"]\') !== null');
    const defaultText = await page.evaluate('document.querySelector(\'[data-testid="cliente-payment-method"]\')?.textContent || ""');
    assert.match(defaultText, /Transferencia/i, "default remains explicit transfer");
    await prepareCash(page);
    await page.waitFor('document.querySelector(\'[data-testid="cash-session-status"]\')?.textContent?.includes("Sesión #88 ABIERTA")');
    await page.waitFor('Array.from(document.querySelectorAll("button")).some(b=>b.textContent?.includes("Vista Previa")&&!b.disabled)');
    await page.evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent?.includes("Vista Previa"))?.click()');
    await page.waitFor('Array.from(document.querySelectorAll("button")).some(b=>b.textContent?.includes("Confirmar Abono"))');
    await page.evaluate('(()=>{const b=Array.from(document.querySelectorAll("button")).find(b=>b.textContent?.includes("Confirmar Abono"));b?.click();b?.click()})()');
    await page.waitFor('window.__creates > 0');
    const o=await page.evaluate('({payload:window.__createdPayload,creates:window.__creates,params:window.__sessionParams,enabled:window.__sessionEnabled})');
    assert.equal(o.creates,1,"double click lock allows one mutation"); assert.deepEqual(o.params,{ubicacionId:2}); assert.equal(o.enabled,true);
    assert.equal(o.payload.id,9); assert.equal(o.payload.data.formaPago,"EFECTIVO"); assert.equal(o.payload.data.cuentaDestino,"CAJA_FISICA");
    assert.equal(o.payload.data.naturaleza,"INGRESO_FISICO"); assert.equal(o.payload.data.sitioOrigenId,2); assert.equal(o.payload.data.sesionCajaId,88); assert.equal(o.payload.data.importe,125.5);
    assert.match(o.payload.data.operacionClave,/^[0-9a-f-]{36}$/i);
  });
});

test("cash loading or no current session blocks preview and mutation with explicit state", async () => {
  for (const scenario of ["loading","empty"] as const) await fixture(scenario, async page => {
    await prepareCash(page);
    const o=await page.evaluate('({text:document.body.textContent||"",previews:window.__previews,creates:window.__creates,disabled:Array.from(document.querySelectorAll("button")).find(b=>b.textContent?.includes("Vista Previa"))?.disabled})');
    assert.equal(o.disabled,true); assert.equal(o.previews,0); assert.equal(o.creates,0);
    assert.match(o.text, scenario === "loading" ? /Validando la sesión/ : /No hay una sesión de caja ABIERTA/);
  });
});

test("revalidation rejects a session that moved sites before send", async () => {
  await fixture("stale", async page => {
    await prepareCash(page);
    await page.waitFor('Array.from(document.querySelectorAll("button")).some(b=>b.textContent?.includes("Vista Previa")&&!b.disabled)');
    await page.evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent?.includes("Vista Previa"))?.click()');
    await page.waitFor('Array.from(document.querySelectorAll("button")).some(b=>b.textContent?.includes("Confirmar Abono"))');
    await page.evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent?.includes("Confirmar Abono"))?.click()');
    await page.waitFor('window.__toast?.description?.includes("No se envió el abono") || window.__creates > 0');
    const creates=await page.evaluate('window.__creates'); assert.equal(creates,0);
  });
});

test("transfer remains independent of cash-session availability", async () => {
  await fixture("empty", async page => {
    await page.waitFor('document.querySelector(\'[aria-label="Naturaleza del movimiento"]\') !== null');
    await selectFirst(page, '[aria-label="Naturaleza del movimiento"]');
    await chooseNative(page, '[data-testid="cliente-payment-destination"]', "CUENTA_NO_FISCAL");
    await page.fill('[data-testid="cliente-payment-amount"]', "75.00");
    await page.waitFor('Array.from(document.querySelectorAll("button")).some(b=>b.textContent?.includes("Vista Previa")&&!b.disabled)');
    await page.evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent?.includes("Vista Previa"))?.click()');
    await page.waitFor('Array.from(document.querySelectorAll("button")).some(b=>b.textContent?.includes("Confirmar Abono"))');
    await page.evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent?.includes("Confirmar Abono"))?.click()');
    await page.waitFor('window.__creates > 0');
    const o=await page.evaluate('({payload:window.__createdPayload,enabled:window.__sessionEnabled})');
    assert.equal(o.enabled,false); assert.equal(o.payload.data.formaPago,"TRANSFERENCIA"); assert.equal(o.payload.data.cuentaDestino,"CUENTA_NO_FISCAL"); assert.equal(o.payload.data.sesionCajaId,null);
  });
});
