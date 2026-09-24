import {open,snap} from "./browser-common.mjs";
const {browser,page}=await open("caja","credit-caja");
try{
 await page.goto("http://127.0.0.1:43820/cobros");
 await page.getByRole("button",{name:"Autorizar",exact:true}).first().waitFor();
 await snap(page,"credit-caja-02-pending");
 await page.getByRole("button",{name:"Autorizar",exact:true}).first().click();
 await snap(page,"credit-caja-03-authorization");
 await page.getByRole("dialog").getByRole("button",{name:"Autorizar",exact:true}).click();
 await page.getByRole("dialog").waitFor({state:"hidden"});
 await snap(page,"credit-caja-04-authorized");
}catch(e){await snap(page,"credit-authorize-blocked");console.log("BLOCKED",e.message);}
finally{await browser.close();}