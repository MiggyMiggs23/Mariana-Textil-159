import fs from "node:fs";
import {open,snap,evidence} from "./browser-common.mjs";
const prefix=process.env.TANDA_E_CHROMIUM_EXECUTABLE?"final-chrome153":"final-diagnosis";
const {browser,page}=await open("admin",prefix);
try{
 await page.goto("http://127.0.0.1:43820/recibos-e3/E3-835-00000001");
 await page.locator("#e3-pages[data-ready=true]").waitFor();
 await page.emulateMedia({media:"print"});
 const state=await page.evaluate(()=>{
 const parents=[];for(let e=document.querySelector("#e3-pages");e;e=e.parentElement){let s=getComputedStyle(e);parents.push({tag:e.tagName,id:e.id,display:s.display,visibility:s.visibility});}
 return {scripts:[...document.scripts].map(e=>e.src).filter(Boolean),parents,printStyle:[...document.querySelectorAll("style")].map(e=>e.textContent).filter(t=>t.includes("#e3-pages"))};
 });
 await snap(page,prefix+"-print");
 await page.pdf({path:evidence+"/"+prefix+"-readonly.pdf",preferCSSPageSize:true,printBackground:true,timeout:20000});
 fs.writeFileSync(evidence+"/"+prefix+".json",JSON.stringify(state,null,2));console.log(JSON.stringify(state));
}finally{await browser.close();}