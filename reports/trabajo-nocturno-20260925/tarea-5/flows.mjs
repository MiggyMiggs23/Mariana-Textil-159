import fs from "node:fs";
import { chromium } from "../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
const root=process.cwd(),dir=root+"/reports/trabajo-nocturno-20260925/tarea-5",priv=root+"/private.local/night-t56",origin="http://127.0.0.1:43927";
const stage=process.argv[2]||"fixtures";
const result={stage,status:"RUNNING",steps:[],requests:[]};
const browser=await chromium.launch({headless:true,executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"],timeout:15000});
const context=await browser.newContext({viewport:{width:1360,height:1000},...(fs.existsSync(priv+"/admin-browser-state.json")?{storageState:priv+"/admin-browser-state.json"}:{})});
const p=await context.newPage();p.setDefaultTimeout(12000);
await p.route("**/*",r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
p.on("response",r=>{if(r.url().startsWith(origin+"/api/"))result.requests.push({path:new URL(r.url()).pathname,status:r.status(),method:r.request().method()});});
const snap=async(name)=>{await p.screenshot({path:`${dir}/${stage}-${name}.png`,fullPage:true});fs.writeFileSync(`${dir}/${stage}-${name}.txt`,await p.locator("body").innerText());};
const clickSave=async(testid,path)=>{
 const pending=p.waitForResponse(r=>new URL(r.url()).pathname===path&&r.request().method()==="POST");
 await p.getByTestId(testid).click();const r=await pending;const body=await r.json();
 result.steps.push({action:testid,status:r.status(),id:body.id});
 if(r.status()>=400)throw Error(`${testid}: ${r.status()} ${JSON.stringify(body)}`);
 return body;
};
try {
 const stored=fs.existsSync(priv+"/admin-browser-state.json")&&JSON.parse(fs.readFileSync(priv+"/admin-browser-state.json")).cookies.length>0;
 await p.goto(origin+(stored?"/":"/login"));
 if(!stored){
  const creds=JSON.parse(fs.readFileSync(priv+"/credentials.json")).admin;
  await p.getByLabel("Usuario",{exact:true}).fill(creds.username);await p.getByLabel("Contraseña",{exact:true}).fill(creds.password);
  const response=p.waitForResponse(r=>r.url().endsWith("/api/auth/login"));
  await p.getByRole("button",{name:"Ingresar",exact:true}).click();const r=await response;
  if(r.status()!==200)throw Error("Native login "+r.status());await p.waitForURL(u=>!u.pathname.includes("login"));
 }
 await context.storageState({path:priv+"/admin-browser-state.json"});fs.chmodSync(priv+"/admin-browser-state.json",0o600);
 if(stage==="fixtures"){
  await p.goto(origin+"/proveedores");await p.getByTestId("button-create-supplier").click();
  await p.getByTestId("input-create-supplier-nombre").fill("NOCTURNO56 PROVEEDOR");await snap("supplier-before");
  const supplier=await clickSave("button-save-supplier-create","/api/proveedores");await p.getByRole("dialog").waitFor({state:"hidden"});await snap("supplier-after");
  await p.goto(origin+"/productos");await p.getByTestId("button-create-product").click();
  await p.getByTestId("input-product-tela").fill("NOCTURNO56 ALGODON");await p.getByTestId("input-product-color").fill("AZUL");
  await p.getByTestId("input-product-precio").fill("100");await snap("product-before");
  const product=await clickSave("button-save-product","/api/productos");await p.getByRole("dialog").waitFor({state:"hidden"});await snap("product-after");
  fs.writeFileSync(priv+"/fixtures.json",JSON.stringify({supplier,product},null,2),{mode:0o600});
  await p.goto(origin+"/entradas");await p.getByTestId("btn-create-entrada").click();await snap("entry-form");
 } else if(stage==="inspect"){
  await p.goto(origin+(process.argv[3]||"/cobros"));await snap("page");
 } else if(stage==="remate-mark"){
  await p.goto(origin+"/inventario/rollos/"+(process.argv[3]||"4"));
  await p.locator("textarea").fill("ENSAYO56 remate autorizado ADMIN");
  await snap("before");
  const [r]=await Promise.all([p.waitForResponse(r=>r.request().method()==="POST"&&r.url().includes("/remate")),p.getByRole("button",{name:"Marcar remate",exact:true}).click()]);
  result.steps.push({status:r.status(),body:await r.json()});if(r.status()>=400)throw Error("Remate marking rejected");
  await p.getByRole("button",{name:"Retirar remate",exact:true}).waitFor();await snap("after");
 } else if(stage==="credit-terms"){
  await p.goto(origin+"/clientes/2");
  await p.getByRole("tab",{name:"Crédito",exact:true}).click();
  await p.getByRole("button",{name:"Editar términos",exact:true}).click();
  await p.getByRole("dialog").locator('input').fill("5000");
  await p.getByTestId("select-edit-client-credit-days").click();await p.getByRole("option",{name:"7 días",exact:true}).click();
  await snap("before");
  const [r]=await Promise.all([p.waitForResponse(r=>["PATCH","PUT"].includes(r.request().method())),p.getByRole("button",{name:"Guardar términos",exact:true}).click()]);
  result.steps.push({status:r.status(),body:await r.json()});if(r.status()>=400)throw Error("Credit terms rejected");await p.getByRole("dialog").waitFor({state:"hidden"});await snap("after");
 } else if(stage==="sale"||stage==="credit-sale"){
  await p.goto(origin+"/pos");
  await p.getByRole("combobox").first().click();await p.getByRole("option",{name:"Mariana",exact:true}).click();
  await context.storageState({path:priv+"/admin-browser-state.json"});
  await p.getByRole("button",{name:stage==="credit-sale"?"Notas (Crédito)":"Ticket (Contado)",exact:true}).click();
  const search=p.getByPlaceholder("Buscar por serie de rollo, SKU o tela...");
  await search.fill(process.argv[3]||"10000001");await search.press("Enter");
  await p.getByRole("button",{name:"Agregar",exact:true}).click();
  await p.getByTestId("pos-cart-line").waitFor();
  if(process.argv[4]==="remate"){await p.getByTestId("input-precio-1").fill("40");await p.getByTestId("input-precio-1").blur();}
  await p.getByTestId("button-select-client").click();await p.getByTestId(stage==="credit-sale"?"option-client-2":"option-client-1").click();
  if(process.argv[4]==="invoice")await p.getByLabel("Requiere Factura",{exact:true}).click();
  await snap("cart-before");
  const [response]=await Promise.all([p.waitForResponse(r=>r.request().method()==="POST"&&new URL(r.url()).pathname==="/api/tickets"),p.getByTestId("button-confirmar-venta").click()]);const body=await response.json();
  result.steps.push({action:"create-sale-native",status:response.status(),body});
  if(response.status()>=400)throw Error(JSON.stringify(body));
  await snap("created");
 } else if(stage==="authorize-credit"){
  await p.goto(origin+"/cobros");
  await p.getByRole("combobox").first().click();await p.getByRole("option",{name:"Mariana",exact:true}).click();
  await p.getByRole("button",{name:"Autorizar",exact:true}).first().click();await snap("before");
  const site=p.getByRole("combobox",{name:"Sitio operativo de origen"});if(await site.count()){await site.click();await p.getByRole("option",{name:"Mariana",exact:true}).click();}
  const [r]=await Promise.all([p.waitForResponse(r=>r.request().method()==="POST"&&r.url().includes("/autorizar")),p.getByRole("dialog").getByRole("button",{name:"Autorizar",exact:true}).click()]);
  const body=await r.json();result.steps.push({status:r.status(),body});if(r.status()>=400)throw Error("Credit authorization "+r.status()+" "+JSON.stringify(body));await p.getByRole("dialog").waitFor({state:"hidden"});await snap("after");
 } else if(stage==="abono"){
  await p.goto(origin+"/cobros");
  await p.getByRole("combobox").first().click();await p.getByRole("option",{name:"Mariana",exact:true}).click();
  await p.getByRole("button",{name:"Cartera / Estado de cuenta",exact:true}).click();
  await p.getByTestId("button-caja-registrar-abono").click();await p.getByTestId("button-cliente-context-combobox").click();
  await p.getByTestId("input-cliente-context-search").fill("Jesús");await p.getByRole("option").filter({hasText:"Jesús López"}).click();await snap("form");
  await p.getByTestId("cliente-payment-amount").fill("100");
  await p.getByTestId("e3-payment-method").click();await p.getByRole("option",{name:"Efectivo",exact:true}).click();
  await p.getByTestId("e3-preview").click();await p.getByTestId("e3-confirm").waitFor();await snap("preview");
  const [r]=await Promise.all([p.waitForResponse(r=>r.request().method()==="POST"&&new URL(r.url()).pathname==="/api/caja/abonos-e3"),p.getByTestId("e3-confirm").click()]);
  const body=await r.json();result.steps.push({action:"ordinary-abono-native",status:r.status(),body});if(r.status()>=400)throw Error("Abono "+r.status()+" "+JSON.stringify(body));
  await p.getByRole("link").filter({hasText:/^E3-/}).last().waitFor();
  await snap("success");
 } else if(stage==="receipt"){
  await p.goto(origin+"/recibos-e3/E3-1-00000001");await p.getByTestId("button-print-receipt").waitFor();await snap("before");
  for(let n=1;n<=2;n++){
   const [r]=await Promise.all([p.waitForResponse(r=>r.request().method()==="POST"),p.getByTestId("button-print-receipt").click()]);
   const body=await r.json();result.steps.push({action:n===1?"print":"reprint",status:r.status(),body});if(r.status()>=400)throw Error("Receipt print rejected");
  }
  await snap("after");
 } else if(stage==="pay-cash"||stage==="pay-transfer"){
  await p.goto(origin+"/cobros");
  await p.getByRole("combobox").first().click();await p.getByRole("option",{name:"Mariana",exact:true}).click();
  await p.getByRole("button",{name:"Cobrar",exact:true}).first().click();
  await p.getByRole("button",{name:stage==="pay-cash"?"Efectivo":"Transf.",exact:true}).click();
  if(stage==="pay-transfer")await p.getByPlaceholder("Número de rastreo o autorización").fill("ENSAYO56-TRANSFER");
  await snap("before");
  const [response]=await Promise.all([p.waitForResponse(r=>r.request().method()==="POST"&&r.url().includes("/cobrar")),p.getByRole("button",{name:"Confirmar Pago",exact:true}).click()]);
  const body=await response.json();result.steps.push({action:stage,status:response.status(),body});
  if(response.status()>=400)throw Error("Payment "+response.status()+" "+JSON.stringify(body));
  await p.getByText("Ticket cobrado exitosamente",{exact:true}).waitFor();await snap("after");
 } else if(stage==="e4-normal"){
  await p.goto(origin+"/cobros");await p.getByRole("combobox").first().click();await p.getByRole("option",{name:"Mariana",exact:true}).click();
  await p.locator("#salida-monto").fill("1");await p.locator("#salida-motivo").fill("ENSAYO56 gasto ordinario extraordinario con saldo suficiente");
  await snap("before");
  const [r]=await Promise.all([p.waitForResponse(r=>r.request().method()==="POST"&&r.url().includes("salidas-dinero")),p.getByRole("button",{name:"Registrar salida extraordinaria",exact:true}).click()]);
  const body=await r.json();result.steps.push({status:r.status(),body});if(r.status()>=400)throw Error("E4 sufficient rejected");await p.getByText("ENSAYO56 gasto ordinario extraordinario con saldo suficiente",{exact:true}).waitFor();await snap("after");
 } else if(stage==="close"){
  await p.goto(origin+"/cobros");await p.getByRole("combobox").first().click();await p.getByRole("option",{name:"Mariana",exact:true}).click();
  const [cut]=await Promise.all([p.waitForResponse(r=>r.request().method()==="GET"&&r.url().includes("/corte")),p.getByRole("button",{name:"Realizar Corte",exact:true}).click()]);
  result.cut=await cut.json();await p.getByRole("dialog").getByText("Efectivo Esperado:",{exact:true}).waitFor();
  await p.getByRole("dialog").getByPlaceholder("0.00").fill("2498");await snap("before");
  const [r]=await Promise.all([p.waitForResponse(r=>r.request().method()==="POST"&&r.url().includes("/cerrar")),p.getByRole("button",{name:"Confirmar Cierre",exact:true}).click()]);
  const body=await r.json();result.steps.push({status:r.status(),body});if(r.status()>=400)throw Error("Close rejected");await snap("after");
 } else if(stage==="e4-verify"){
  await p.goto(origin+"/cobros");
  await p.getByRole("combobox").first().click();await p.getByRole("option",{name:"Mariana",exact:true}).click();
  await p.getByText("ENSAYO56 salida extraordinaria",{exact:true}).waitFor();
  await snap("persisted");
  result.steps.push({action:"reload-native-ui-persisted-extraordinary-exit",status:"PASS"});
 } else if(stage==="e4"){
  await p.goto(origin+"/cobros");
  await p.getByRole("combobox").first().click();await p.getByRole("option",{name:"Mariana",exact:true}).click();
  await p.locator("#salida-monto").fill("1");
  const form=p.getByRole("form",{name:"Registrar salida de dinero"});
  await form.getByRole("button",{name:"Registrar salida extraordinaria",exact:true}).click();
  const invalid=await p.locator("#salida-motivo").evaluate(e=>e.validity.valueMissing);
  if(!invalid)throw Error("Missing-reason native form guard did not reject");
  result.steps.push({action:"missing-reason-native-submit",status:"PASS_HTML_VALIDATION"});await snap("missing-reason");
  await p.locator("#salida-motivo").fill("ENSAYO56 salida extraordinaria");
  await form.getByRole("button",{name:"Registrar salida extraordinaria",exact:true}).click();
  await p.getByText("Saldo de Caja insuficiente. Solo ADMIN puede autorizar una salida extraordinaria con motivo explícito.",{exact:true}).first().waitFor();
  result.steps.push({action:"insufficient-no-unlock",status:"PASS_REJECTED_UI"});await snap("insufficient");
  await p.locator("#salida-desbloqueo").fill("ENSAYO56 ADMIN autoriza insuficiencia desechable");
  await snap("unlock-before");
  const [response]=await Promise.all([p.waitForResponse(r=>r.request().method()==="POST"&&r.url().includes("salidas-dinero")),form.getByRole("button",{name:"Registrar salida extraordinaria",exact:true}).click()]);
  const body=await response.json();result.steps.push({action:"admin-unlock-native",status:response.status(),body});
  if(response.status()>=400)throw Error("E4 unlock "+response.status()+" "+JSON.stringify(body));
  await snap("unlock-after");
 } else if(stage==="cash-open"){
  await p.goto(origin+"/cobros");
  await p.getByRole("combobox").first().click();await p.getByRole("option",{name:"Mariana",exact:true}).click();
  await p.getByRole("heading",{name:"Apertura de Caja",exact:true}).waitFor();
  await p.locator('input[type="number"]').fill("0");await snap("before");
  const [response]=await Promise.all([p.waitForResponse(r=>r.request().method()==="POST"),p.getByRole("button",{name:"Abrir Turno",exact:true}).click()]);
  result.steps.push({action:"open-cash",status:response.status(),body:await response.json()});
  if(response.status()>=400)throw Error("Cash opening rejected");
  await p.getByRole("heading",{name:"Caja Operativa",exact:true}).waitFor();await snap("after");
 } else if(stage==="entry"){
  const f=JSON.parse(fs.readFileSync(priv+"/fixtures.json"));
  await p.goto(origin+"/entradas");await p.getByTestId("btn-create-entrada").click();
  await p.getByTestId("input-entrada-producto").fill("NOCTURNO56");await p.getByRole("option").filter({hasText:"NOCTURNO56"}).first().click();
  await p.getByTestId("input-declared").fill("5");await p.getByTestId("input-costo-unitario").fill("50");
  await p.getByTestId("select-entrada-ubicacion").click();await p.getByRole("option",{name:"Mariana",exact:true}).click();
  await p.getByTestId("select-entrada-proveedor").click();await p.getByRole("option",{name:"NOCTURNO56 PROVEEDOR",exact:true}).click();
  await p.getByTestId("btn-add-line").click();await p.getByTestId("input-uniform-qty").fill("10");await p.getByTestId("button-apply-uniform").click();
  await snap("capture");await p.getByTestId("button-confirm-line").click();await p.getByTestId("btn-save-entrada").click();await snap("review");
  f.entry=await clickSave("btn-confirm-entrada-review","/api/inventario/entradas");fs.writeFileSync(priv+"/fixtures.json",JSON.stringify(f,null,2),{mode:0o600});await snap("saved");
 }
 result.status="PASS";
}catch(e){result.status="BLOCKED";result.error=e.message;await snap("blocked").catch(()=>{});process.exitCode=1}
finally{fs.writeFileSync(`${dir}/${stage}-result.json`,JSON.stringify(result,null,2));await browser.close();}
console.log(JSON.stringify(result));