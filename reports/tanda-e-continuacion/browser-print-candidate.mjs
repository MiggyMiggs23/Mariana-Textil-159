import fs from "node:fs";
import {open,snap,evidence} from "./browser-common.mjs";
const {browser,page}=await open("admin","candidate-print");
const posts=[];
page.on("response",r=>{if(r.request().method()==="POST")posts.push({path:new URL(r.url()).pathname,status:r.status()});});
try{
 await page.goto("http://127.0.0.1:43820/recibos-e3/E3-835-00000001");
 await page.locator("#e3-pages[data-ready=true]").waitFor();
 await snap(page,"candidate-print-02-screen");
 await page.evaluate(()=>{window.__candidatePrintEvents=[];window.addEventListener("beforeprint",()=>window.__candidatePrintEvents.push("beforeprint"));window.addEventListener("afterprint",()=>window.__candidatePrintEvents.push("afterprint"));});
 await page.getByTestId("button-print-receipt").click();
 await page.waitForFunction(()=>window.__candidatePrintEvents.includes("beforeprint"));
 await snap(page,"candidate-print-03-audited");
 await page.emulateMedia({media:"print"});
 const geometry=await page.locator(".e3-sheet").evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {copy:e.getAttribute("data-copy"),width:r.width,height:r.height,x:r.x,y:r.y,visibility:s.visibility,display:s.display,text:e.textContent};}));
 await snap(page,"candidate-print-04-print-media");
 await page.pdf({path:evidence+"/candidate-receipt-natural-pages.pdf",preferCSSPageSize:true,printBackground:true,timeout:20000});
 fs.writeFileSync(evidence+"/candidate-print-result.json",JSON.stringify({timestamp:new Date().toISOString(),posts,geometry,events:await page.evaluate(()=>window.__candidatePrintEvents),physicalPrint:false,noPageRange:true},null,2));
}catch(e){await snap(page,"candidate-print-blocked");console.log("BLOCKED",e.message);}
finally{await browser.close();}