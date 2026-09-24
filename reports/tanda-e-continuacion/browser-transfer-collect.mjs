import {open,snap} from "./browser-common.mjs";
const {browser,page}=await open("caja","transfer-caja");
try{
 await page.goto("http://127.0.0.1:43820/cobros");
 await page.getByRole("button",{name:"Cobrar",exact:true}).first().waitFor();
 await snap(page,"transfer-caja-02-pending");
 await page.getByRole("button",{name:"Cobrar",exact:true}).first().click();
 await page.getByRole("dialog").getByRole("button",{name:"Transf.",exact:true}).click();
 await snap(page,"transfer-caja-03-selected");
 await page.getByPlaceholder("Número de rastreo o autorización").fill("TANDA-EC-TRANSFER-002");
 await snap(page,"transfer-caja-04-reference");
 await page.getByRole("button",{name:"Confirmar Pago",exact:true}).click();
 await page.getByRole("dialog").waitFor({state:"hidden"});
 await snap(page,"transfer-caja-05-paid");
}catch(e){await snap(page,"transfer-caja-blocked");console.log("BLOCKED",e.message);}
finally{await browser.close();}