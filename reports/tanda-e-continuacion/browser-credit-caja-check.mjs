import {open,snap} from "./browser-common.mjs";
const {browser,page}=await open("caja","credit-final-caja");
try{
 await page.goto("http://127.0.0.1:43820/recibos-e3/E3-835-00000001");
 await page.getByText("Sin acceso",{exact:true}).waitFor();
 await snap(page,"credit-final-caja-02-receipt-denied");
 await page.goto("http://127.0.0.1:43820/cobros");
 await page.getByText(/Saldo Caja \(servidor\): 700.00/).waitFor();
 await snap(page,"credit-final-caja-03-cash700");
}catch(e){await snap(page,"credit-final-caja-blocked");console.log("BLOCKED",e.message);}
finally{await browser.close();}