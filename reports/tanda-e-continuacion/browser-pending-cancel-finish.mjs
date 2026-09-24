import {open,snap} from "./browser-common.mjs";
const {browser,page}=await open("admin","pending-cancel-finish");
try{
 await page.goto("http://127.0.0.1:43820/tickets/113");
 await page.getByRole("button",{name:"Cancelar Ticket",exact:true}).click();
 await page.getByRole("dialog").locator("textarea").fill("TANDA EC cancelar pendiente sin cobro; devolver rollo006");
 await page.getByRole("button",{name:"Continuar",exact:true}).click();
 await page.getByLabel("Confirmación del folio de Ticket",{exact:true}).fill("1007");
 await snap(page,"pending-cancel-06-exact-confirmation");
 await page.getByRole("button",{name:"Cancelar ticket definitivamente",exact:true}).click();
 await page.getByText("Ticket: cancelación completada correctamente",{exact:true}).waitFor();
 await snap(page,"pending-cancel-07-cancelled");
 await page.goto("http://127.0.0.1:43820/inventario/rollos/6238");
 await page.getByText("993000006",{exact:true}).first().waitFor();
 await snap(page,"pending-cancel-08-roll-restored");
}catch(e){await snap(page,"pending-cancel-finish-blocked");console.log("BLOCKED",e.message);}
finally{await browser.close();}