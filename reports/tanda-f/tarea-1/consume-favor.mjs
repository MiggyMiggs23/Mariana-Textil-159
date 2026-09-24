import {open,snap,origin} from "./browser-common.mjs";
const {browser,page}=await open("caja3");
try{
await page.goto(origin+"/cobros");
await page.getByRole("button",{name:"Autorizar",exact:true}).first().click();
await snap(page,"16-favor-authorization-preview");
await page.getByRole("dialog").getByRole("button",{name:"Autorizar",exact:true}).click();
await page.getByRole("dialog").waitFor({state:"hidden"});
await snap(page,"17-favor-applied-success");
}catch(e){await snap(page,"17-favor-blocked");throw e;}finally{await browser.close();}