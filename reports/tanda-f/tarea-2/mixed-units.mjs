import fs from "node:fs";
import {run,snap,origin,dir} from "./browser.mjs";
await run(async p=>{
 await p.goto(origin+"/salidas/nueva");await p.getByText("Seleccione origen",{exact:true}).click();await p.getByRole("option",{name:"TANDA F TIENDA 1",exact:true}).click();
 await p.getByText("Seleccione destino",{exact:true}).click();await p.getByRole("option",{name:"TANDA F TIENDA 3",exact:true}).click();
 await p.getByPlaceholder("Nombre, placas...").fill("TANDA F T2 UNIDADES");await p.getByPlaceholder("Notas del envío...").fill("TANDA F T2 unidades separadas");
 for(const serie of ["994000101","994000201","994000301"]){await p.getByPlaceholder("Escanea o ingresa la serie del rollo y presiona Enter...").fill(serie);await p.getByPlaceholder("Escanea o ingresa la serie del rollo y presiona Enter...").press("Enter");await p.waitForTimeout(400);}
 await snap(p,"26-multiunit-preview");await p.getByRole("button",{name:"Guardar y enviar",exact:true}).click();await p.waitForTimeout(1000);await snap(p,"27-multiunit-transfer");fs.writeFileSync(dir+"/multiunit-url.txt",p.url());
});