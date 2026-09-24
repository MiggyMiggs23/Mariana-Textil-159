import fs from "node:fs";
import {open,snap,evidence} from "./browser-common.mjs";
const {browser,page}=await open("admin","open-corte");
const reads=[];
page.on("response",async r=>{const path=new URL(r.url()).pathname;if(r.request().method()==="GET"&&path.includes("/46/")&&path.includes("corte")){try{reads.push({path,status:r.status(),body:await r.json()});}catch{}}});
try{
 await page.goto("http://127.0.0.1:43820/cobros");
 await page.getByRole("combobox").first().click();
 await page.getByRole("option",{name:"TANDA E CONTINUACION",exact:true}).click();
 await page.getByRole("button",{name:"Realizar Corte",exact:true}).waitFor();
 await snap(page,"open-corte-02-session-open");
 await page.getByRole("button",{name:"Realizar Corte",exact:true}).click();
 await page.getByRole("dialog").getByText("Efectivo Esperado:",{exact:true}).waitFor();
 await snap(page,"open-corte-03-preview765");
 fs.writeFileSync(evidence+"/open-corte-read-evidence.json",JSON.stringify({timestamp:new Date().toISOString(),reads,visibleText:await page.getByRole("dialog").innerText(),closed:false},null,2));
 await page.getByRole("dialog").getByRole("button",{name:"Cancelar",exact:true}).click();
 await snap(page,"open-corte-04-left-open");
}catch(e){await snap(page,"open-corte-blocked");console.log("BLOCKED",e.message);}
finally{await browser.close();}