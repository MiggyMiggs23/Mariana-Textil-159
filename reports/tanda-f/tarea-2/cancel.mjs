import fs from "node:fs";
import {run,snap,dir} from "./browser.mjs";
await run(async p=>{
 await p.goto(fs.readFileSync(dir+"/transfer-cancel-url.txt","utf8"));
 await p.getByRole("button",{name:"Cancelar Salida",exact:true}).click();await snap(p,"23-cancel-dialog");console.log(await p.locator("input,textarea").evaluateAll(es=>es.map(e=>({placeholder:e.placeholder,type:e.type}))));
 await p.getByPlaceholder("Motivo de la cancelación (Mínimo 10 caracteres)...").fill("TANDA F T2 cancelación sintética para conciliación");
 await p.getByRole("button",{name:"Confirmar Cancelación",exact:true}).click();await p.waitForTimeout(1000);await snap(p,"24-cancelled");
});