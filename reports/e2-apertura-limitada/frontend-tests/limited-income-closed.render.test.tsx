import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { withBrowserFixture } from "../observable-test/browser";

async function files() {
  const dir=await mkdtemp(join(tmpdir(),"limited-income-closed-")); const api=join(dir,"api.ts"),scope=join(dir,"scope.ts");
  await writeFile(scope,'export const useLocationScope=()=>({selectedLocationId:2,setSelectedLocationId(){}});');
  await writeFile(api,`
    export const getObtenerSesionCajaActualQueryKey=p=>["session",p]; export const getListLocationsQueryKey=()=>["locations"];
    export const useGetCurrentUser=()=>({data:{rol:"CAJA",ubicacion:{id:2,nombre:"Caja B",activa:true,tipo:"TIENDA"}}}); export const useListLocations=()=>({data:[],error:null});
    export const useObtenerSesionCajaActual=(p,o)=>{window.__sessionEnabled=o?.query?.enabled;return {data:{sesion:null,resumen:null},isLoading:false,isFetching:false,isError:false,refetch:async()=>({data:{sesion:null},isError:false})}};
    export const usePreviewClientePago=()=>({isPending:false,mutate(){window.__previews++}}); export const useCreateClientePago=()=>({isPending:false,mutate(){window.__creates++}}); export const useCreateSolicitudPagoDirigido=()=>({isPending:false,mutate(){window.__creates++}});
    export const getGetCreditRefundOptionsQueryKey=id=>["refund",id]; export const useGetCreditRefundOptions=()=>({data:{enabled:false,motivoInactivo:"Devolución inactiva",advertencia:"Sólo referencia",candidatas:[{origen:"ABONO",abonoId:72,cobroClave:null,folio:7,referencia:"R",importe:"10.00",sitioOrigenId:1,sitioNombre:"A"}],sesiones:[{id:88,sitioOrigenId:2,sitioNombre:"B",abiertaAt:"2026-09-18T13:00:00Z"}]},isLoading:false,isError:false,error:null});
    export const useDevolverCreditoFisico=()=>({mutate(){window.__refunds++}});
  `); return {dir,api,scope};
}

test("unapplied candidate preserves Transferencia and keeps cash option and session query closed",async()=>{const f=await files();try{await withBrowserFixture({entrySource:`
 import React from "react"; import {QueryClient,QueryClientProvider} from "@tanstack/react-query"; import {ClientePagoDialog} from "__CLOSED_APP_ROOT__/artifacts/mariana-textil/src/components/cliente-pago-dialog.tsx"; window.fetch=async()=>{throw new Error("NETWORK_BLOCKED")};window.__creates=0;window.__previews=0;const q=new QueryClient();export default()=> <QueryClientProvider client={q}><ClientePagoDialog open onOpenChange={()=>{}} clienteId={9}/></QueryClientProvider>`,moduleAliases:{"@workspace/api-client-react":f.api,"@/lib/location-scope":f.scope}},async page=>{
 await page.waitFor(`document.querySelector('[data-testid="cliente-payment-method"]') !== null`); const o=await page.evaluate<Record<string, any>>(`(()=>{const s=document.querySelector('[data-testid="cliente-payment-method"]');return {value:s.value,cashDisabled:s.querySelector('option[value="EFECTIVO"]').disabled,session:window.__sessionEnabled,creates:window.__creates,previews:window.__previews}})()`);
 assert.equal(o.value,"TRANSFERENCIA");assert.equal(o.cashDisabled,true);assert.equal(o.session,false);assert.equal(o.creates,0);assert.equal(o.previews,0);
 });}finally{await rm(f.dir,{recursive:true,force:true})}});

test("refund remains hard-closed even under programmatic submit",async()=>{const f=await files();try{await withBrowserFixture({entrySource:`
 import React from "react"; import {DevolucionCreditoInactivaDialog} from "__CLOSED_APP_ROOT__/artifacts/mariana-textil/src/components/devolucion-credito-inactiva-dialog.tsx";window.fetch=async()=>{throw new Error("NETWORK_BLOCKED")};window.__refunds=0;export default()=> <DevolucionCreditoInactivaDialog open onOpenChange={()=>{}} clienteId={9} clienteNombre="Cliente" isAdmin/>`,moduleAliases:{"@workspace/api-client-react":f.api}},async page=>{
 await page.waitFor(`document.querySelector('[data-testid="refund-source-select"]') !== null`);await page.evaluate(`(()=>{for(const id of ['refund-source-select','refund-session-select']){const s=document.querySelector('[data-testid="'+id+'"]');if(!s)continue;s.value=s.options[1].value;s.dispatchEvent(new Event('change',{bubbles:true}))}})()`);await page.waitFor(`document.querySelector('#devolucion-motivo') !== null`);await page.fill('#devolucion-motivo','Motivo documental completo');await page.waitFor(`document.querySelector('[data-testid="refund-review-button"]')?.disabled === false`);await page.evaluate(`document.querySelector('[data-testid="refund-review-button"]')?.click()`);await page.waitFor(`document.querySelector('[data-testid="devolucion-revision"]') !== null`);await page.evaluate(`document.querySelector('form')?.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);await page.waitFor(`document.body.textContent?.includes('No se envió nada') || window.__refunds > 0`);assert.equal(await page.evaluate('window.__refunds'),0,"refund client gate blocks mutate");
 });}finally{await rm(f.dir,{recursive:true,force:true})}});
