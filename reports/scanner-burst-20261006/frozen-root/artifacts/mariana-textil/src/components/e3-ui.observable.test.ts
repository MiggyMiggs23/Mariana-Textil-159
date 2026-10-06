import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { withBrowserFixture } from "../observable-test/browser";

const receipt = {
  version: 1, folio: "E3-2-00000001", movimientoId: 71, clienteId: 41,
  clienteNombre: "Comercializadora de textiles y confecciones de nombres extensos Hernández López",
  clienteTelefono: "5551234567", clienteRfc: "XAXX010101000",
  sitioNombre: "Mariana Centro", actorNombre: "Nombre congelado del receptor",
  recibidoEn: "2026-09-17T12:00:00Z", registradoEn: "2026-09-17T12:00:00Z",
  sitioId: 2, sesionCajaId: 8, formaPago: "EFECTIVO", cuentaDestino: "CAJA_FISICA",
  importeCentavos: 10000, origen: "CAJA", motivo: null, asignaciones: [],
  remanenteCentavos: 10000, saldoAFavorCentavos: 10000, deudaCentavos: 0,
};
// Process-only module substitution. Never mutate watched source or generated deps.
const mutations: Record<string, [string, string, string]> = {
  "print-resize": ["pages/caja/recibo-e3.tsx", "if (root.getClientRects().length === 0) return;", ""],
  geometry: ["pages/caja/recibo-e3.tsx", "used + rowHeight > available", "false"],
  advance: ["pages/caja/recibo-e3.tsx", "Anticipo sin aplicación a notas.", "Recibido, pendiente de aplicación."],
  audit: ["pages/caja/recibo-e3.tsx", "      window.print();", "      window.print();"],
  off: ["pages/caja/recibo-e3.tsx", 'E3_ENABLED && user?.rol === "ADMIN"', 'user?.rol === "ADMIN"'],
  catalog: ["lib/permisos.ts", "E3_ENABLED || !E3_PERMISSION_MODULES.includes(module)", "true"],
  caja: ["hooks/use-e3.ts", "mutation.mutateAsync({ data }),", "mutation.mutateAsync({ data: { data } }),"],
  recapture: ["components/cliente-e3-recaptura-dialog.tsx", "        sesionCajaId: null,", "        sesionCajaId: 8,"],
};

async function fixture(caseName: string, entry: string, check: Parameters<typeof withBrowserFixture>[1], options: { enabled?: boolean; rows?: number } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "e3-ui-proof-"));
  const frozen = { ...receipt, asignaciones: Array.from({ length: options.rows ?? 0 }, (_, i) => ({
    movimientoVentaId: 100 + i, ticketId: i + 1, folio: i + 123456,
    saldoAntesCentavos: 10000, aplicadoCentavos: 100, saldoDespuesCentavos: 9900,
  })) };
  const aliases: Record<string, string> = {};
  async function alias(name: string, source: string) {
    const file = join(dir, `module-${Object.keys(aliases).length}.tsx`);
    await writeFile(file, source); aliases[name] = file;
  }
  await alias("@/lib/e3-feature-flags", `export const E3_ENABLED = ${options.enabled !== false};`);
  await alias("@/components/layout/app-layout", `export const AppLayout=({children})=><main>{children}</main>;`);
  await alias("@/lib/location-scope", `export const useLocationScope=()=>({selectedLocationId:2});`);
  await alias("@/hooks/use-toast", `export const useToast=()=>({toast:x=>{ window.lastToast=x; }});`);
  const keys = ["getGetClienteQueryKey", "getGetClientePagosQueryKey", "getGetClienteEstadoCuentaQueryKey", "getGetClienteCreditoQueryKey", "getObtenerSesionCajaActualQueryKey", "getGetReciboAbonoE3QueryKey", "getListClienteRecibosE3QueryKey", "getGetCajaAbonoE3ContextQueryKey", "getListLocationsQueryKey"];
  await alias("@workspace/api-client-react", `
    import {useMutation} from "@tanstack/react-query";
    export const snapshot=${JSON.stringify(frozen)};
    window.requests=[]; window.printCount=0; window.print=()=>{window.printCount++};
    ${keys.map(key => `export const ${key}=(id)=>["/${key}",id];`).join("\n")}
    export const getGetCurrentUserQueryKey=()=>["/api/auth/me"];
    export const useGetCurrentUser=()=>({data:{id:1,rol:"ADMIN"}});
    export const useListLocations=()=>({data:[]});
    export const useObtenerSesionCajaActual=()=>{throw Error("Broad session endpoint forbidden")};
    export const useGetCajaAbonoE3Context=()=>({data:{sitios:[{id:2,nombre:"Mariana",sesiones:[{id:8,ubicacionId:2,fechaOperativa:"2026-09-21"}]}],clientes:[]}});
    export const useGetReciboAbonoE3=(_folio,options)=>{window.receiptEnabled=options.query.enabled;return {data:options.query.enabled?snapshot:undefined,isLoading:false}};
    export const useListClienteRecibosE3=()=>({data:[]});
    export const useListCajaRecibosE3=()=>({data:[]});
    const preview=input=>({previewToken:"a".repeat(64),clienteId:41,importeCentavos:10000,asignaciones:[],remanenteCentavos:10000,saldoAFavorCentavos:10000,deudaCentavos:0,origen:input.id?"RECAPTURA":"CAJA"});
    export const usePreviewCajaAbonoE3=()=>useMutation({mutationFn:async input=>{window.requests.push({kind:"preview",input});return preview(input)}});
    export const usePreviewClienteRecapturaE3=usePreviewCajaAbonoE3;
    export const useConfirmCajaAbonoE3=()=>useMutation({mutationFn:async input=>{
      window.requests.push({kind:"confirm",input});
      if(window.rejectConfirm){window.rejectConfirm=false;throw Error("Respuesta perdida")}
      return {recibo:snapshot,replay:false};
    }});
    export const useConfirmClienteRecapturaE3=useConfirmCajaAbonoE3;
    export const useRecordReciboE3Print=()=>useMutation({mutationFn:async input=>{
      window.requests.push({kind:"print",input});
      await new Promise(r=>setTimeout(r,70));
      if(window.rejectPrint)throw Error("Auditoría no disponible");
      return {registrado:true};
    }});
    const legacy=()=>useMutation({mutationFn:async()=>{throw Error("Legacy endpoint forbidden")}});
    export const useCreateClientePago=legacy;
    export const useCreateSolicitudPagoDirigido=legacy;
    export const usePreviewClientePago=legacy;
  `);
  // The offline runner deliberately strips environment variables. Pass the
  // mutation selector as a harmless extra regex alternative in its name filter.
  const mutationName = caseName === "off" && process.execArgv.some(arg => arg.includes("MUTANT_catalog")) ? "catalog" : caseName;
  if (process.execArgv.some(arg => arg.includes(`MUTANT_${mutationName}`))) {
    const [file, from, to] = mutations[mutationName];
    let source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    if (caseName === "audit") {
      const statement = 'await audit.mutateAsync({ folio: recibo.folio, motivo: "Solicitud de reimpresión desde otro equipo; no acredita impresión física" });';
      assert.ok(source.includes(statement), "audit mutant anchor");
      source = source.replace(statement, "window.print(); " + statement);
    } else {
      assert.ok(source.includes(from), `${caseName} mutant anchor`);
      source = source.replace(from, to);
    }
    await alias(`@/${file.replace(/\.tsx?$/, "")}`, source);
  }
  try {
    await withBrowserFixture({
      entrySource: `
        import React from "react"; import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
        import {Router,Route} from "wouter"; import {memoryLocation} from "wouter/memory-location";
        import ReciboE3 from "@/pages/caja/recibo-e3";
        import {ClientePagoDialog} from "@/components/cliente-pago-dialog";
        import {ClienteE3RecapturaDialog} from "@/components/cliente-e3-recaptura-dialog";
        import {ACTIVE_MODULES,Modules} from "@/lib/permisos";
        window.activePermissionModules=ACTIVE_MODULES;
        window.e3PermissionIdentifiers=[Modules.CAJA_ABONOS,Modules.CLIENTES_RECAPTURAS];
        const query=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
        const location=memoryLocation({path:"/recibos-e3/E3-2-00000001"});
        export default function Fixture(){
          // Match the application's actual mount: receipt print isolation
          // intentionally removes every body child other than #root.
          React.useLayoutEffect(()=>{document.getElementById("observable-test-root")?.setAttribute("id","root");},[]);
          const [revision,setRevision]=React.useState(0);window.remount=()=>setRevision(x=>x+1);return <QueryClientProvider client={query}><Router hook={location.hook}><Route path="/recibos-e3/:folio"><React.Fragment key={revision}>${entry}</React.Fragment></Route></Router></QueryClientProvider>;
        }
      `, moduleAliases: aliases,
    }, check);
  } finally { await rm(dir, { recursive: true, force: true }); }
}

test("E3 UI geometry: measured long-note pagination preserves two A5 copies and signatures", async () => {
  await fixture("geometry", "<ReciboE3/>", async page => {
    await page.waitFor('document.querySelector("#e3-pages")?.dataset.ready === "true"');
    const metrics = await page.evaluate<{ width: number; height: number; rows: number; safe: boolean }[]>(`Array.from(document.querySelectorAll(".print-page")).map(p=>{
      const rect=p.getBoundingClientRect(), foot=p.querySelector(".e3-footer").getBoundingClientRect(), table=p.querySelector("table").getBoundingClientRect();
      return {width:rect.width,height:rect.height,rows:p.querySelectorAll("tbody tr").length,safe:foot.bottom<=rect.bottom-18 && table.bottom<=foot.top+1};
    })`);
    assert.ok(metrics.length > 2 && metrics.length % 2 === 0, "E3_GEOMETRY: paginate both copies");
    assert.ok(metrics.every(p => Math.abs(p.width - 210 * 96 / 25.4) < 1 && Math.abs(p.height - 148 * 96 / 25.4) < 1 && p.safe), "E3_GEOMETRY: A5 bounds/footer safe");
    assert.equal(metrics.reduce((sum, p) => sum + p.rows, 0), 100, "E3_GEOMETRY: all notes twice");
    const pdf = (await page.printPdf()).toString("latin1");
    const pageCount = [...pdf.matchAll(/\/Type\s*\/Page\b/g)].length;
    const sizes = [...pdf.matchAll(/\/MediaBox\s*\[([\d.\s]+)\]/g)].map(match => match[1].trim().split(/\s+/).map(Number));
    assert.equal(pageCount, metrics.length, "E3_GEOMETRY: printed page count matches pagination, no blank pages");
    assert.ok(sizes.length > 0 && sizes.every(size => Math.abs(size[2] - 210 * 72 / 25.4) < 2 && Math.abs(size[3] - 148 * 72 / 25.4) < 2), "E3_GEOMETRY: actual PDF A5 landscape");
    console.log(JSON.stringify({ measurement: "E3_A5", rows: 50, copies: 2, pages: pageCount, points: sizes[0] }));
  }, { rows: 50 });
});

test("E3 UI print resize: a hidden print probe preserves measured receipt pages", async () => {
  await fixture("print-resize", "<ReciboE3/>", async page => {
    await page.waitFor('document.querySelector("#e3-pages")?.dataset.ready === "true"');
    await page.evaluate(`document.querySelector(".e3-probe").style.display="none";
      window.dispatchEvent(new Event("resize"));`);
    // Wait for the React update that used to clear both pages as false overflow.
    await page.evaluate("new Promise(resolve => setTimeout(resolve, 50))");
    assert.equal(await page.evaluate('document.querySelectorAll("#e3-pages .e3-sheet").length'), 2);
    assert.equal(await page.evaluate('document.querySelector("#e3-pages").dataset.ready'), "true");
    assert.equal(await page.evaluate('document.querySelector("[role=alert]") === null'), true);
    await page.evaluate(`document.querySelector(".e3-probe").style.display="";
      window.dispatchEvent(new Event("resize"));`);
    await page.waitFor('document.querySelector("#e3-pages")?.dataset.ready === "true"');
    assert.equal(await page.evaluate('document.querySelectorAll("#e3-pages .e3-sheet").length'), 2);
  });
});

test("E3 UI advance: immutable human names and actual favor, never pending directed", async () => {
  await fixture("advance", "<ReciboE3/>", async page => {
    await page.waitFor('document.querySelectorAll(".print-page").length === 2');
    const text = await page.evaluate<string>('document.querySelector("#e3-pages").textContent');
    assert.ok(text.includes("Anticipo sin aplicación a notas.") && !text.includes("pendiente de aplicación"), "E3_ADVANCE: ordinary advance is not retained");
    assert.ok(text.includes(receipt.actorNombre) && text.includes(receipt.sitioNombre), "E3_ADVANCE: frozen human identities");
  });
});

test("E3 UI audit: failed request never prints; retry audits before print", async () => {
  await fixture("audit", "<ReciboE3/>", async page => {
    await page.waitFor('document.querySelector("#e3-pages")?.dataset.ready === "true"');
    await page.evaluate('window.rejectPrint=true');
    await page.click('[data-testid="button-print-receipt"]');
    await page.waitFor('document.querySelector("[role=alert]")');
    assert.equal(await page.evaluate("window.printCount"), 0, "E3_AUDIT: failed audit cannot print");
    await page.evaluate("window.rejectPrint=false");
    await page.click('[data-testid="button-print-receipt"]');
    await page.waitFor("window.printCount === 1");
    assert.equal(await page.evaluate("window.requests.filter(r=>r.kind==='print').length"), 2);
  });
});

test("E3 UI off: direct receipt URL remains closed and query disabled", async () => {
  await fixture("off", "<ReciboE3/>", async page => {
    await page.waitFor("typeof window.receiptEnabled === 'boolean'");
    assert.equal(await page.evaluate('document.querySelector(".print-page") === null && document.body.textContent.includes("E3 cerrado")'), true, "E3_OFF: no receipt surface");
    assert.equal(await page.evaluate("window.receiptEnabled"), false, "E3_OFF: disabled query");
    assert.deepEqual(await page.evaluate("window.activePermissionModules"), [
      "dashboard", "pos", "entradas", "salidas", "movimientos", "etiquetas",
      "inventario", "auditoria_inventario", "productos", "ajustes", "clientes",
      "clientes_credito", "clientes_precios", "clientes_finanzas", "proveedores",
      "proveedores_finanzas", "contenedores", "ubicaciones", "usuarios", "permisos",
      "resumen_caja", "cortes", "cobros_pagos", "reportes", "conciliacion", "auditoria",
      "precios", "camionetas", "choferes", "viajes", "salidas_venta", "equipos",
    ], "E3_CATALOG: OFF preserves exact existing 32-module catalog and order");
    assert.deepEqual(await page.evaluate("window.e3PermissionIdentifiers"), ["caja_abonos", "clientes_recapturas"]);
  }, { enabled: false });
});

test("E3 UI caja: real form uses scoped session and flat contract; retry preserves intent", async () => {
  await fixture("caja", '<ClientePagoDialog open clienteId={41} origen="CAJA" onOpenChange={()=>{}}/>', async page => {
    await page.waitFor('document.querySelector("[data-testid=e3-payment-method]")');
    await page.press("[data-testid=e3-payment-method]", "ArrowDown");
    await page.waitFor('document.querySelector("[role=option]")');
    await page.evaluate(`Array.from(document.querySelectorAll("[role=option]")).find(el=>el.textContent==="Efectivo").click()`);
    await page.fill('[data-testid=cliente-payment-amount]', "100.00");
    await page.evaluate('document.querySelector("[data-testid=cliente-payment-amount]").blur()');
    await page.waitFor('!document.querySelector("[data-testid=e3-preview]").disabled');
    await page.evaluate('document.querySelector("[data-testid=e3-preview]").click()');
    await page.waitFor("window.requests.some(r=>r.kind==='preview')");
    await page.waitFor('document.body.textContent.includes("Vista previa de abono ordinario")');
    assert.equal(await page.evaluate('document.body.textContent.includes("Naturaleza del movimiento") || document.body.textContent.includes("pendiente de aplicación")'), false);
    await page.evaluate("window.rejectConfirm=true");
    await page.evaluate('document.querySelector("[data-testid=e3-confirm]").click()');
    await page.waitFor("window.lastToast?.title === 'Error al confirmar'");
    await page.evaluate("window.remount()");
    await page.waitFor('document.querySelector("[role=status]")?.textContent.includes("Confirmación sin respuesta")');
    await page.evaluate('document.querySelector("[data-testid=e3-confirm]").click()');
    await page.waitFor('document.body.textContent.includes("Folio Recibo: E3-2-00000001")');
    const requests = await page.evaluate<{ kind: string; input: { data: Record<string, unknown> } }[]>("window.requests");
    const preview = requests.find(r => r.kind === "preview")!.input.data;
    const confirms = requests.filter(r => r.kind === "confirm").map(r => r.input.data);
    assert.equal(confirms[0].importeCentavos, 10000, "E3_CAJA: flat generated request, no double data");
    assert.equal(confirms[0].sesionCajaId, 8);
    assert.equal(confirms[0].cuentaDestino, "CAJA_FISICA");
    assert.equal(confirms[0].operacionClave, preview.operacionClave);
    assert.equal(confirms[1].operacionClave, preview.operacionClave, "E3_CAJA: lost-response retry key stable");
    assert.equal(await page.evaluate("window.printCount"), 0);
  });
});

test("E3 UI recapture: real form requires reason and records no Caja session", async () => {
  await fixture("recapture", '<ClienteE3RecapturaDialog clienteId={41} sitios={[{id:2,nombre:"Mariana"}]}/>', async page => {
    await page.waitFor('document.querySelector("[data-testid=button-recaptura-historica]")');
    await page.click("[data-testid=button-recaptura-historica]");
    await page.fill("[data-testid=input-recaptura-importe]", "10000");
    await page.fill("[data-testid=input-recaptura-fecha]", "2026-09-15T12:00");
    await page.evaluate('document.querySelector("form").requestSubmit()');
    await page.waitFor('document.body.textContent.includes("El motivo es obligatorio")');
    assert.equal(await page.evaluate("window.requests.length"), 0);
    await page.fill("[data-testid=input-recaptura-motivo]", "Pago previo documentado");
    await page.evaluate('document.querySelector("form").requestSubmit()');
    await page.waitFor('document.querySelector("[data-testid=button-recaptura-confirm]")');
    await page.evaluate("window.rejectConfirm=true");
    await page.evaluate('document.querySelector("[data-testid=button-recaptura-confirm]").click()');
    await page.waitFor("window.requests.some(r=>r.kind==='confirm')");
    await page.waitFor("window.lastToast?.title === 'Error'");
    await page.evaluate("window.remount()");
    await page.waitFor('document.querySelector("[data-testid=button-recaptura-historica]")');
    await page.evaluate('document.querySelector("[data-testid=button-recaptura-historica]").click()');
    await page.waitFor('document.querySelector("[data-testid=button-recaptura-confirm]")');
    await page.evaluate('document.querySelector("[data-testid=button-recaptura-confirm]").click()');
    await page.waitFor("window.requests.filter(r=>r.kind==='confirm').length === 2");
    const data = await page.evaluate<Record<string, unknown>>("window.requests.find(r=>r.kind==='confirm').input.data");
    assert.equal(data.sesionCajaId, null, "E3_RECAPTURE: never enters Caja");
    assert.equal(data.motivo, "Pago previo documentado");
    assert.equal(data.fechaRecepcion, "2026-09-15T18:00:00.000Z");
    assert.equal(await page.evaluate("window.requests.filter(r=>r.kind==='confirm')[0].input.data.operacionClave === window.requests.filter(r=>r.kind==='confirm')[1].input.data.operacionClave"), true);
    assert.equal(await page.evaluate("window.printCount"), 0);
  });
});