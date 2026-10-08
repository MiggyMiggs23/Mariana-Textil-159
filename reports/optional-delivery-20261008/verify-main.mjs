import fs from "node:fs";
import assert from "node:assert/strict";
import {login} from "../permission-nine-runtime-20261001/cases.mjs";
const dir="reports/optional-delivery-20261008";
const cred=JSON.parse(fs.readFileSync(dir+"/run-gm6ayx/credentials.json"));
const {chromium}=await import(cred.playwright);
const browser=await chromium.launch({headless:true,executablePath:"/repl/ctls/bvajdx8xxf05dqrzwxgrlaxv0ryigzix-chromium-unwrapped-152.0.7977.64/libexec/chromium/chromium",args:["--no-sandbox"]});
const timer=setTimeout(()=>{void browser.close();process.exitCode=1;},90000);
try{
 const {page,context,api}=await login(browser,cred.origin,cred.admin.username,cred.password);
 await context.addInitScript(()=>{window.print=()=>{};});
 const ticket=await api("GET","/api/tickets/12");
 assert.equal(ticket.status,200);
 fs.writeFileSync(dir+"/verified-empty.json",JSON.stringify(ticket.body,null,2));
 console.log("ticket",JSON.stringify(ticket.body));
 const rolls=await api("GET","/api/inventario/rollos?estado=DISPONIBLE&limit=100");
 fs.writeFileSync(dir+"/available-synthetic.json",JSON.stringify(rolls.body,null,2));
 await page.goto(cred.origin+"/tickets/12",{waitUntil:"domcontentloaded"});
 await page.waitForTimeout(1800);
 await page.screenshot({path:dir+"/screenshots/24-confirmed-empty-note.png",fullPage:true});
 const available=await api("GET","/api/viajes/elegibles?search=1000");
 console.log("trip",available.status,JSON.stringify(available.body).slice(0,900));
 console.log("providers",JSON.stringify((await api("GET","/api/proveedores")).body));
 console.log("stock",JSON.stringify(rolls.body).slice(0,1600));
 if(process.argv.includes("--finish")) {
   const confirmations=JSON.parse(fs.readFileSync(dir+"/main-confirmations.json"));
   for(const [id,file,filled] of [[12,"29-empty-note-print-verified",false],[confirmations.filled.id,"30-filled-note-print-verified",true]]){
     await page.goto(cred.origin+`/tickets/${id}`,{waitUntil:"domcontentloaded"});
     await page.getByRole("button",{name:"Imprimir Nota",exact:true}).waitFor();
     await page.waitForTimeout(1400);
     await page.getByRole("button",{name:"Imprimir Nota",exact:true}).click();
     await page.waitForTimeout(600);
     // Restore the app's actual print class after the nonblocking print stub.
     await page.evaluate(()=>document.body.classList.add("print-credito"));
     await page.emulateMedia({media:"print"});
     const sheet=page.locator(".credito-page-print").first();
     await sheet.waitFor({state:"visible"});
     const content=await sheet.innerText();
     assert.equal(content.includes("Destinatario de prueba"),filled);
     assert.equal(content.includes("Calle de prueba 123"),filled);
     await sheet.screenshot({path:dir+`/screenshots/${file}.png`});
     await page.emulateMedia({media:"screen"});
   }
   const van=await api("POST","/api/camionetas",{nombre:"Vehículo de prueba",placas:"QA-DEL-08",tipo:"PROPIA"});
   const driver=await api("POST","/api/choferes",{nombreCompleto:"Chofer de prueba",telefono:"5550100000"});
   assert.equal(van.status,201,JSON.stringify(van.body));
   assert.equal(driver.status,201,JSON.stringify(driver.body));
   const byClient=await api("GET","/api/viajes/elegibles?origenId=10&search=QA%20Optional%20Credit");
   assert.ok(byClient.body.tickets.some(t=>t.id===12));
   const trip=await api("POST","/api/viajes",{origenId:10,camionetaId:van.body.id,choferId:driver.body.id,salidaAt:new Date().toISOString(),ticketIds:[12],salidaIds:[]});
   assert.equal(trip.status,201,JSON.stringify(trip.body));
   fs.writeFileSync(dir+"/trip-without-recipient.json",JSON.stringify({byFolio:available.body,byClient:byClient.body,trip:trip.body},null,2));
   await page.goto(cred.origin+"/viajes",{waitUntil:"domcontentloaded"});
   await page.waitForTimeout(1600);
   await page.screenshot({path:dir+"/screenshots/31-trip-without-recipient.png",fullPage:true});
   console.log("PASS printing fields optional and trip without recipient");
 }
 if(process.argv.includes("--complete")) {
   assert.ok(!fs.existsSync(dir+"/main-confirmations.json"),"Already executed");
   const receipt=await api("POST","/api/inventario/entradas",{
     ubicacionId:10,proveedorId:1,uuidCliente:crypto.randomUUID(),
     lineas:[{productoId:1,costoUnitario:"40",cantidades:["10","10"]}],
   });
   assert.equal(receipt.status,201,JSON.stringify(receipt.body));
   const stock=await api("GET","/api/inventario/rollos?estado=DISPONIBLE&ubicacionId=10&pageSize=100");
   const usable=stock.body.items.filter(r=>r.proveedorId===1);
   assert.equal(usable.length,2);
   const create=async(roll,documentoTipo,filled)=>api("POST","/api/tickets",{
     uuidCliente:crypto.randomUUID(),ubicacionId:10,tipo:"NORMAL",facturado:false,
     clienteId:documentoTipo==="NOTA"?18:1,diasPlazo:documentoTipo==="NOTA"?7:null,
     documentoTipo,notaSinPrecios:false,
     nombreDestinatario:filled?"Destinatario de prueba":null,
     direccionEntregaSnapshot:filled?"Calle de prueba 123":null,
     lineas:[{rolloId:roll.id,productoId:1,tipo:"NORMAL",cantidad:10,precioUnitario:100}],
   });
   const filled=await create(usable[0],"NOTA",true);
   assert.equal(filled.status,201,JSON.stringify(filled.body));
   const emptyTicket=await create(usable[1],"TICKET",false);
   assert.equal(emptyTicket.status,201,JSON.stringify(emptyTicket.body));
   fs.writeFileSync(dir+"/main-confirmations.json",JSON.stringify({emptyNote:ticket.body,filled:filled.body,emptyTicket:emptyTicket.body},null,2));
   const detail=await api("GET",`/api/tickets/${filled.body.id}`);
   assert.equal(detail.body.nombreDestinatario,"Destinatario de prueba");
   assert.equal(detail.body.direccionEntregaSnapshot,"Calle de prueba 123");
   await page.goto(cred.origin+`/tickets/${filled.body.id}`,{waitUntil:"domcontentloaded"});
   await page.waitForTimeout(1800);
   await page.screenshot({path:dir+"/screenshots/25-confirmed-filled-note-api.png",fullPage:true});
   for(const [id,file] of [[12,"26-empty-note-print"],[filled.body.id,"27-filled-note-print"]]){
     await page.goto(cred.origin+`/tickets/${id}`,{waitUntil:"domcontentloaded"});
     await page.waitForTimeout(1200);
     await page.emulateMedia({media:"print"});
     await page.screenshot({path:dir+`/screenshots/${file}.png`,fullPage:true});
     await page.emulateMedia({media:"screen"});
   }
   const byClient=await api("GET","/api/viajes/elegibles?origenId=10&search=QA%20Optional%20Credit");
   assert.ok(byClient.body.tickets.some(t=>t.id===12));
   const trip=await api("POST","/api/viajes",{
     origenId:10,transportista:"Transportista de prueba",ticketIds:[12],salidaIds:[],
   });
   assert.equal(trip.status,201,JSON.stringify(trip.body));
   fs.writeFileSync(dir+"/trip-without-recipient.json",JSON.stringify({byFolio:available.body,byClient:byClient.body,trip:trip.body},null,2));
   await page.goto(cred.origin+"/viajes",{waitUntil:"domcontentloaded"});
   await page.waitForTimeout(1600);
   await page.screenshot({path:dir+"/screenshots/28-trip-without-recipient.png",fullPage:true});
   console.log("PASS confirmations, persistence, lookup, trip");
 }
}finally{clearTimeout(timer);await browser.close();}
