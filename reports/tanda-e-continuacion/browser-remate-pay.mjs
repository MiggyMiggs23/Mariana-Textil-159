import {open,snap} from "./browser-common.mjs";
const {browser,page}=await open("caja","remate-caja");
try{
 await page.goto("http://127.0.0.1:43820/cobros");
 await page.getByRole("button",{name:"Cobrar",exact:true}).first().waitFor();
 await snap(page,"remate-caja-02-pending");
 await page.getByRole("button",{name:"Cobrar",exact:true}).first().click();
 await page.getByRole("dialog").getByText("$90.00",{exact:true}).first().waitFor();
 await page.getByRole("dialog").getByRole("button",{name:"Efectivo",exact:true}).click();
 await snap(page,"remate-caja-03-cash90");
 await page.getByRole("button",{name:"Confirmar Pago",exact:true}).click();
 await page.getByRole("dialog").waitFor({state:"hidden"});
 await snap(page,"remate-caja-04-paid");
}catch(e){await snap(page,"remate-caja-blocked");console.log("BLOCKED",e.message);}
finally{await browser.close();}