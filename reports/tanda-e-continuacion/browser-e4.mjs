import {open,snap} from "./browser-common.mjs";
const {browser,page}=await open("caja","e4");
try{
 await page.goto("http://127.0.0.1:43820/cobros");
 await page.getByText(/Saldo Caja \(servidor\): 790.00/).waitFor();
 await snap(page,"e4-02-balance790");
 await page.getByLabel("Monto",{exact:true}).fill("25");
 await page.getByLabel("Motivo",{exact:true}).fill("TANDA EC salida suficiente de caja25 sin desbloqueo");
 await snap(page,"e4-03-filled");
 await page.getByRole("button",{name:"Registrar salida extraordinaria",exact:true}).click();
 await page.getByText("Salida de dinero registrada.",{exact:true}).waitFor();
 await page.getByText(/Saldo Caja \(servidor\): 765.00/).waitFor();
 await snap(page,"e4-04-success765");
}catch(e){await snap(page,"e4-blocked");console.log("BLOCKED",e.message);}
finally{await browser.close();}