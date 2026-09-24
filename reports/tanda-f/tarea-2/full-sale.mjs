import fs from "node:fs";
import {run,snap,origin,dir} from "./browser.mjs";
await run(async p=>{
 await p.goto(origin+"/pos");await p.getByRole("combobox").first().click();await p.getByRole("option",{name:"TANDA F TIENDA 2",exact:true}).click();
 await p.getByText("Notas (Crédito)",{exact:true}).click();
 await p.getByPlaceholder("Buscar por serie de rollo, SKU o tela...").fill("10000741");await p.getByRole("button",{name:"Agregar",exact:true}).first().click();
 await p.getByPlaceholder("Nombre completo de quien recibe").fill("TANDA F T2 PUBLICO");await p.getByPlaceholder("Calle, número, colonia, ciudad...").fill("TANDA F SITIO SINTETICO 2");
 await snap(p,"20-full-sale-public-preview");await p.getByRole("button",{name:"Confirmar Venta",exact:true}).click();await p.waitForTimeout(1300);await snap(p,"21-full-sale-result");fs.writeFileSync(dir+"/sale-url.txt",p.url());
});