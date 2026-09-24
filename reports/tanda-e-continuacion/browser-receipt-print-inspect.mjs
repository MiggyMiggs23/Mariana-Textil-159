import fs from "node:fs";
import {open,snap,evidence} from "./browser-common.mjs";
const {browser,page}=await open("admin","receipt-inspect");
try{
 await page.goto("http://127.0.0.1:43820/recibos-e3/E3-835-00000001");
 await page.locator("#e3-pages[data-ready=true]").waitFor();
 await snap(page,"receipt-inspect-screen");
 await page.emulateMedia({media:"print"});
 const css=await page.evaluate(()=>{
 const root=document.querySelector("#e3-pages");const ancestors=[];
 for(let e=root;e;e=e.parentElement){const s=getComputedStyle(e);ancestors.push({tag:e.tagName,id:e.id,className:e.className,display:s.display,visibility:s.visibility,position:s.position,rect:{x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}});}
 return {sheets:root.querySelectorAll(".e3-sheet").length,ancestors};
 });
 await snap(page,"receipt-inspect-print-blank");
 fs.writeFileSync(evidence+"/receipt-print-defect.json",JSON.stringify({timestamp:new Date().toISOString(),status:"FAIL_PRINT_RENDERING",description:"Receipt renders on screen, real print button audits successfully and fires beforeprint, but print-media screenshot and exported PDF are blank. No app fixes applied.",pdfPages:1,pdfExtractedTextBytes:1,css},null,2));
}finally{await browser.close();}