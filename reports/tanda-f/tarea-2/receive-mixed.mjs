import {run,snap,origin} from "./browser.mjs";
await run(async p=>{
 await p.goto(origin+"/salidas?tab=recepcion");await p.getByText("Folio TFA-000003",{exact:true}).click();await snap(p,"28-multiunit-reception");
 await p.getByRole("button",{name:"Confirmar recepción de todos los rollos",exact:true}).click();await p.waitForTimeout(1000);await snap(p,"29-multiunit-received");
});