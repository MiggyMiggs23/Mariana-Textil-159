import fs from "node:fs";
import {open,snap,evidence} from "./browser-common.mjs";
const {browser,page}=await open("admin","receipt");
const printResponses=[];
page.on("response",r=>{if(r.request().method()==="POST")printResponses.push({path:new URL(r.url()).pathname,status:r.status()});});
try{
 await page.goto("http://127.0.0.1:43820/recibos-e3/E3-835-00000001");
 await page.getByTestId("button-print-receipt").waitFor();
 await snap(page,"receipt-02-visible");
 await page.evaluate(()=>{window.__printEvents=[];window.addEventListener("beforeprint",()=>window.__printEvents.push("beforeprint"));window.addEventListener("afterprint",()=>window.__printEvents.push("afterprint"));});
 await page.getByTestId("button-print-receipt").click();
 await page.waitForFunction(()=>window.__printEvents.includes("beforeprint"));
 await snap(page,"receipt-03-print-requested");
 await page.emulateMedia({media:"print"});
 await snap(page,"receipt-04-print-css");
 await page.pdf({path:evidence+"/receipt-E3-835-00000001.pdf",preferCSSPageSize:true,printBackground:true,timeout:20000});
 fs.writeFileSync(evidence+"/receipt-print-evidence.json",JSON.stringify({timestamp:new Date().toISOString(),folio:"E3-835-00000001",postResponses:printResponses,printEvents:await page.evaluate(()=>window.__printEvents),physicalPrint:false,pdf:"receipt-E3-835-00000001.pdf"},null,2));
}catch(e){await snap(page,"receipt-blocked");console.log("BLOCKED",e.message);}
finally{await browser.close();}