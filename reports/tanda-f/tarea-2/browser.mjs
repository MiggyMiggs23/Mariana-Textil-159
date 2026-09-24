import fs from "node:fs";
import {open,root,fixture,origin} from "../tarea-1/browser-common.mjs";
export {root,fixture,origin};
export const dir=root+"/reports/tanda-f/tarea-2";
fs.mkdirSync(dir+"/evidence",{recursive:true});
export async function snap(page,name){
 await page.screenshot({path:dir+"/evidence/"+name+".png",fullPage:true});
 const text=await page.locator("body").innerText();
 fs.writeFileSync(dir+"/evidence/"+name+".txt",text);
 console.log(text.slice(-14000));
 fs.appendFileSync(dir+"/progress.txt",new Date().toISOString()+" "+name+"\n");
}
export async function run(fn){const {browser,page}=await open("admin");try{await fn(page);}catch(e){await snap(page,"error-"+Date.now());throw e;}finally{await browser.close();}}