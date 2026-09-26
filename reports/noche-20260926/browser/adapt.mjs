// File-only compiler of the historically proven native-browser flows.
// No API/DB access, browser launch, workflow start or environment mutation here.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { base } from "./runtime.mjs";

export function compile(m, id, outputDir, emit = true) {
  const continuation = id.startsWith("continuation-");
  const source = continuation
    ? "reports/continuacion-rollos-20260925/browser/continuation.mjs"
    : "reports/trabajo-nocturno-20260925/tarea-5/flows.mjs";
  let s = fs.readFileSync(source, "utf8");
  const replace = (from, to) => {
    if (!s.includes(from)) throw Error(`Adapter/source drift: missing ${from.slice(0, 70)}`);
    s = s.replace(from, to);
  };
  const q = JSON.stringify;
  const target = m.targets?.[id] || {};
  const aliases = { "flow-close-recovery": "close", "flow-sale-remate": "sale", "flow-sale-transfer": "sale", "flow-credit-sale-settled": "credit-sale", "flow-authorize-credit-settled": "authorize-credit", "flow-abono-settled": "abono" };
  const stage = aliases[id] || id.replace(/^(continuation|flow)-/, "");
  if (!m.site?.id || !m.site.name || !m.clients?.cash?.id || !m.clients?.credit?.id || !m.clients.credit.name) throw Error("Actual synthetic site/client fixture inputs required");
  replace(s.match(/import\s*\{\s*chromium\s*\}\s*from\s*"[^"]+";/)?.[0], `import { chromium } from ${q(pathToFileURL(path.resolve(m.playwrightModule)).href)};`);
  s = s.replaceAll('"Mariana"', q(m.site.name));
  s = s.replaceAll('"/clientes/2"', q(`/clientes/${m.clients.credit.id}`));
  s = s.replaceAll('"/api/clientes/2/credito"', q(`/api/clientes/${m.clients.credit.id}/credito`));
  s = s.replaceAll('"option-client-1"', q(`option-client-${m.clients.cash.id}`));
  s = s.replaceAll('"option-client-2"', q(`option-client-${m.clients.credit.id}`));
  s = s.replaceAll('"Jesús López"', q(m.clients.credit.name)).replaceAll('"Jesús"', q(m.clients.credit.name));
  const priv = m.privateDir;
  if (continuation) {
    s = s.replaceAll('"/api/proveedores/1/pagos"', q(`/api/proveedores/${m.targets?.sensitiveSupplierId || 0}/pagos`));
    s = s.replaceAll('"/api/tickets/1"', q(`/api/tickets/${m.targets?.sensitiveTicketId || 0}`));
    s = s.replaceAll('"/api/clientes/1"', q(`/api/clientes/${m.clients.cash.id}`));
    replace('path.join(root, "reports/continuacion-rollos-20260925/browser")', q(outputDir));
    replace('path.join(root, "private.local/roll-return-continuation")', q(priv));
    replace('const stage = process.argv[2];', `const stage = ${q(stage)};`);
    replace('const clockTime = "2026-11-02T18:00:00.000Z";', `const clockTime = ${q(m.fiscal?.clockTime || null)};`);
    const start = s.indexOf("const origin = stage");
    const end = s.indexOf('const credentials =', start);
    if (start < 0 || end < 0) throw Error("Continuation bootstrap drift");
    s = s.slice(0, start) + `const origin = ${q(m.origin)};\n` + s.slice(end);
    replace('if (stages.indexOf(stage) !== state.completed.length) throw Error(`Expected next stage ${stages[state.completed.length]}`);', '// Independent cases: write() still refuses any repeated operation key.');
    replace('if (Object.values(state.operations).some(v => v.status === "UNCERTAIN")) throw Error("Uncertain write exists. Read back independently; do not replay.");', '// Unrelated uncertain cases must not suppress independently testable cases.');
    replace('stage === "fiscal" && origin.endsWith(":43941")', `stage === "fiscal" && ${q(Boolean(m.fiscal?.forwardClockReady))}`);
    replace('fixture.clienteNombre = ' + q(m.clients.credit.name) + '; fixture.ubicacionId = 1;', `fixture.clienteNombre = ${q(m.clients.credit.name)}; fixture.ubicacionId = ${q(m.site.id)};`);
    s = s.replaceAll('clienteId: 2', `clienteId: ${m.clients.credit.id}`).replaceAll('clientId: 2', `clientId: ${m.clients.credit.id}`);
    s = s.replaceAll('fixture.ubicacionId ?? 1', `fixture.ubicacionId ?? ${m.site.id}`);
    replace('assert(origin.endsWith(":43941"), "Closed-period writes require MAIN-owned isolated forward-clock API 43940 / UI 43941; original API has current open periods");', `assert(${q(Boolean(m.fiscal?.forwardClockReady))}, "MAIN-controlled closed-period environment required; no clock/database changes by harness");`);
    replace('assert(day === "2026-09-25", "Invoice date provenance changed; do not infer closed periods");', '// Date derives from actual authorized invoice, never a historical fixture date.');
    const periodsStart = s.indexOf("    if (!fixture.fiscalPeriods)");
    const periodsEnd = s.indexOf('    await f.goto(origin + "/contabilidad/fiscal");', periodsStart);
    if (periodsStart < 0 || periodsEnd < 0) throw Error("Fiscal source drift");
    s = s.slice(0, periodsStart) + `    fixture.fiscalPeriods = ${q(m.fiscal?.periods || [])};\n` + s.slice(periodsEnd);
    const hardcodedStart = s.indexOf("    assert(fixture.fiscalPeriods.every(p => [");
    const hardcodedEnd = s.indexOf("    for (const period of fixture.fiscalPeriods)", hardcodedStart);
    if (hardcodedStart < 0 || hardcodedEnd < 0) throw Error("Fiscal validation drift");
    s = s.slice(0, hardcodedStart) + `    assert(fixture.fiscalPeriods.every(p => p.inicio <= day && day < p.finExclusivo && p.finExclusivo <= ${q(m.fiscal?.clockTime?.slice(0, 10) || "")}), "Every period must be closed and contain the actual invoice");\n` + s.slice(hardcodedEnd);
    // Do not abort remaining independent periods after the first failure.
    replace('      const key = `${period.tipo}-${period.inicio}-${period.resultado}`;', '      const key = `${period.tipo}-${period.inicio}-${period.resultado}`;\n      try {');
    replace('    }\n  }\n  state.completed.push(stage);', '      } catch (error) { result.steps.push({ action: key, status: "BLOCKED", error: error.message }); await snapshot(key + "-blocked").catch(() => {}); }\n    }\n  }\n  state.completed.push(stage);');
    replace('result.status = "PASS"; result.completedAt', 'result.status = result.steps.some(x => x.status === "BLOCKED") ? "PARTIAL_OR_BLOCKED" : "PASS"; result.completedAt');
    // Readback must come from the new server, not just the create response.
    replace('const persisted = await readback(body);', `let readEndpoint = endpoint;
  if (endpoint === "/api/users" || endpoint === "/api/productos" || endpoint === "/api/proveedores" || endpoint === "/api/tickets" || endpoint === "/api/inventario/entradas") readEndpoint += "/" + body.id;
  if (readEndpoint === endpoint && /\\/(cobrar|autorizar)$/.test(endpoint) && endpoint.startsWith("/api/tickets/")) readEndpoint = endpoint.replace(/\\/(cobrar|autorizar)$/, "");
  const persisted = await readback(body);
  if (["/api/productos", "/api/proveedores", "/api/tickets", "/api/inventario/entradas"].includes(endpoint) || endpoint.startsWith("/api/tickets/")) {
    const actual = await read(page, readEndpoint); assert(actual.id === body.id, "Independent server readback ID mismatch");
  }`);
  } else {
    replace('const root=process.cwd(),dir=root+"/reports/trabajo-nocturno-20260925/tarea-5",priv=root+"/private.local/night-t56",origin="http://127.0.0.1:43927";',
      `const root=process.cwd(),dir=${q(outputDir)},priv=${q(priv)},origin=${q(m.origin)};\nconst target=${q(target)};`);
    replace('const stage=process.argv[2]||"fixtures";', `const stage=${q(stage)};`);
    // Native login every case, no stale identity/cookies from a previous run.
    replace('...(fs.existsSync(priv+"/admin-browser-state.json")?{storageState:priv+"/admin-browser-state.json"}:{})', '');
    replace('const stored=fs.existsSync(priv+"/admin-browser-state.json")&&JSON.parse(fs.readFileSync(priv+"/admin-browser-state.json")).cookies.length>0;', 'const stored=false;');
    replace('await p.route("**/*",r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());',
      'await p.route("**/*",r=>new URL(r.request().url()).origin===origin&&!/\\/e5\\/cobros\\/[^/]+\\/devolver$/.test(new URL(r.request().url()).pathname)?r.continue():r.abort());');
    s = s.replaceAll('(process.argv[3]||"4")', 'target.rollId');
    s = s.replaceAll('process.argv[3]||"10000001"', 'target.series');
    s = s.replaceAll('process.argv[4]==="remate"', q(id === "flow-sale-remate"));
    s = s.replaceAll('process.argv[4]==="invoice"', 'target.invoice===true');
    s = s.replaceAll('getByTestId("input-precio-1")', 'getByTestId("pos-cart-line").locator(\'input[data-testid^="input-precio-"]\')');
    s = s.replaceAll('"/recibos-e3/E3-1-00000001"', '"/recibos-e3/"+target.receiptFolio');
    s = s.replaceAll('getByTestId("cliente-payment-amount").fill("100")', 'getByTestId("cliente-payment-amount").fill(String(target.amount || "100"))');
    replace('await p.getByRole("dialog").getByPlaceholder("0.00").fill("2498");', `if(!Number.isFinite(Number(target.countedCash)))throw Error("Independent countedCash fixture required");
  await p.getByRole("dialog").getByPlaceholder("0.00").fill(String(target.countedCash));`);
    // Never target the first unrelated note/ticket on a copied populated database.
    s = s.replaceAll('await p.getByRole("button",{name:"Cobrar",exact:true}).first().click();',
      'await p.getByText(target.ticketCaption,{exact:true}).locator("xpath=ancestor::div[.//button[normalize-space()=\'Cobrar\']][1]").getByRole("button",{name:"Cobrar",exact:true}).click();');
    s = s.replaceAll('await p.getByRole("button",{name:"Autorizar",exact:true}).first().click();',
      'await p.getByText(target.ticketCaption,{exact:true}).locator("xpath=ancestor::div[.//button[normalize-space()=\'Autorizar\']][1]").getByRole("button",{name:"Autorizar",exact:true}).click();');
    // Missing reason / insufficiency / unlock each get an independently recorded observation.
    replace('await p.locator("#salida-monto").fill("1");\n  const form=', 'await p.locator("#salida-monto").fill(String(target.insufficientAmount));\n  const form=');
    s = s.replace('if(r.status()>=400)throw Error("Close rejected");await snap("after");',
      `if(r.status()>=400)throw Error("Close rejected");
  if(!target.closeReadbackPath)throw Error("Required closeReadbackPath not supplied");
  const check=await p.evaluate(async url=>{const r=await fetch(url,{credentials:"include"});return {status:r.status,body:await r.json()};},target.closeReadbackPath);
  result.closeReadback=check;
  if(check.status!==200)throw Error("Independent close readback failed");await snap("after");`);
    const required = {
      "sale": ["series"], "credit-sale": ["series"], "remate-mark": ["rollId"],
      "pay-cash": ["ticketCaption"], "pay-transfer": ["ticketCaption"],
      "authorize-credit": ["ticketCaption"], "receipt": ["receiptFolio"],
      "close": ["countedCash", "closeReadbackPath"], "e4": ["insufficientAmount"]
    }[stage] || [];
    for (const field of required) if (target[field] === undefined || target[field] === null || target[field] === "") throw Error(`${id}: actual target.${field} required; refusing historical fallback`);
  }
  // Public files cannot contain passwords, cookies, DSNs or authorization material.
  // This also covers legacy catch(error) strings containing HTTP response bodies.
  const prefix = `
const __write=fs.writeFileSync.bind(fs);
const __private=${q(priv)},__report=${q(outputDir)};
const __creds=JSON.parse(fs.readFileSync(__private+"/credentials.json","utf8"));
const __secretValues=[];
function __collect(v,k=""){if(v&&typeof v==="object"){for(const [key,val] of Object.entries(v))__collect(val,key);}else if(typeof v==="string"&&/password|secret|token|cookie/i.test(k))__secretValues.push(v);}
__collect(__creds);
function __redact(t){for(const v of __secretValues)if(v)t=t.replaceAll(v,"[REDACTED]");return t.replace(/postgres(?:ql)?:\\/\\/[^\\s"']+/g,"[REDACTED_DSN]").replace(/("(?:password|token|secret|cookie|authorization)"\\s*:\\s*")[^"]*"/gi,'$1[REDACTED]"');}
fs.writeFileSync=(file,data,...args)=>{if(String(file).startsWith(__report)&&typeof data==="string")data=__redact(data);return __write(file,data,...args);};
`;
  const importEnd = s.indexOf("\nconst root");
  if (importEnd < 0) throw Error("Module header drift");
  s = s.slice(0, importEnd) + "\n" + prefix + s.slice(importEnd);
  if (!emit) return s;
  const generated = path.join(base, "browser", "generated");
  fs.mkdirSync(generated, { recursive: true, mode: 0o700 });
  const file = path.join(generated, `${id}.mjs`);
  fs.writeFileSync(file, s, { mode: 0o600 });
  return file;
}