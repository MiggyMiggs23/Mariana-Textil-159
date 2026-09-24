import {open,snap} from "./browser-common.mjs";
const {browser,page}=await open("caja","cash");
try{
 await page.goto("http://127.0.0.1:43820/cobros");
 await page.getByRole("button",{name:"Cobrar",exact:true}).first().waitFor();
 await snap(page,"cash-02-pending");
 await page.getByRole("button",{name:"Cobrar",exact:true}).first().click();
 await snap(page,"cash-03-dialog");
 await page.getByRole("dialog").getByRole("button",{name:"Efectivo",exact:true}).click();
 await snap(page,"cash-04-selected");
 await page.getByRole("button",{name:"Confirmar Pago",exact:true}).click();
 await page.getByRole("dialog").waitFor({state:"hidden"});
 await snap(page,"cash-05-paid");
}catch(e){await snap(page,"cash-blocked");console.log("BLOCKED",e.message);}
finally{await browser.close();}