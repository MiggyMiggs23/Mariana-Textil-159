import fs from "node:fs";
import {run,snap,origin,dir} from "./browser.mjs";
const suffix=process.argv[2]?"-cancel":"";
await run(async p=>{
 await p.goto(origin+"/salidas/nueva");await p.getByText("Seleccione origen",{exact:true}).click();await p.getByRole("option",{name:"TANDA F TIENDA 1",exact:true}).click();
 await p.getByText("Seleccione destino",{exact:true}).click();await p.getByRole("option",{name:"TANDA F TIENDA 2",exact:true}).click();
 await p.getByPlaceholder("Nombre, placas...").fill("TANDA F T2 TRANSPORTE");
 await p.getByPlaceholder("Notas del envío...").fill("TANDA F T2 traslado de entrada 471");
 await p.getByPlaceholder("Escanea o ingresa la serie del rollo y presiona Enter...").fill(process.argv[2]||"10000741");
 await p.getByPlaceholder("Escanea o ingresa la serie del rollo y presiona Enter...").press("Enter");await p.waitForTimeout(500);
 await snap(p,"10-transfer-captured"+suffix);await p.getByRole("button",{name:"Guardar y enviar",exact:true}).click();await p.waitForTimeout(1000);await snap(p,"11-transfer-submit"+suffix);fs.writeFileSync(dir+"/transfer"+suffix+"-url.txt",p.url());
});