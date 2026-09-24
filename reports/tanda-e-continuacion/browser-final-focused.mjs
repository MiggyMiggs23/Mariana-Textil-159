import fs from "node:fs";
import {open,snap,evidence} from "./browser-common.mjs";
const {browser,page}=await open("admin","final-focused");
const posts=[];
page.on("response",r=>{if(r.request().method()==="POST")posts.push({path:new URL(r.url()).pathname,status:r.status()});});
try{
 await page.goto("http://127.0.0.1:43820/recibos-e3/E3-835-00000001");
 await page.locator("#e3-pages[data-ready=true]").waitFor();
 await snap(page,"final-focused-02-receipt-screen");
 await page.evaluate(()=>{window.__finalPrintEvents=[];window.addEventListener("beforeprint",()=>window.__finalPrintEvents.push("beforeprint"));window.addEventListener("afterprint",()=>window.__finalPrintEvents.push("afterprint"));});
 await page.getByTestId("button-print-receipt").click();
 await page.waitForFunction(()=>window.__finalPrintEvents.includes("beforeprint"));
 await snap(page,"final-focused-03-print-audited");
 await page.emulateMedia({media:"print"});
 const geometry=await page.locator("#e3-pages .e3-sheet").evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {copy:e.getAttribute("data-copy"),width:r.width,height:r.height,x:r.x,y:r.y,visibility:getComputedStyle(e).visibility};}));
 await snap(page,"final-focused-04-print-media");
 await page.pdf({path:evidence+"/final-receipt-natural-pages.pdf",preferCSSPageSize:true,printBackground:true,timeout:20000});
 const events=await page.evaluate(()=>window.__finalPrintEvents);
 await page.emulateMedia({media:"screen"});
 await page.goto("http://127.0.0.1:43820/inventario/rollos/6238");
 const row=page.getByRole("row").filter({hasText:"CANCELACION"});
 await row.getByText("+1.00",{exact:true}).waitFor();
 await snap(page,"final-focused-05-cancellation-plus1");
 fs.writeFileSync(evidence+"/final-focused-result.json",JSON.stringify({timestamp:new Date().toISOString(),posts,geometry,events,physicalPrint:false,noPageRange:true,cancellationRow:await row.innerText()},null,2));
}catch(e){await snap(page,"final-focused-blocked");console.log("BLOCKED",e.message);process.exitCode=1;}
finally{await browser.close();}