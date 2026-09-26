import fs from "node:fs";
import assert from "node:assert/strict";
import { load, browserKit, session, api, recorder } from "./runtime.mjs";
const { m, credentials } = load(), r = recorder(3, "close-independent-precheck"), b = await browserKit(m);
try {
  const p = await session(b, m, credentials.admin);
  await r.check("prior-close-never-submitted-current-open", async () => {
    const old = JSON.parse(fs.readFileSync("reports/noche-20260926/tarea-3/flow-close/close-result.json"));
    assert.equal(old.error, "Native login 500"); assert.equal(old.steps.length, 0);
    const d = await api(p, `/api/sesiones-caja/actual?ubicacionId=${m.site.id}`);
    assert.equal(d.status, 200); assert.equal(d.body.sesion.estado, "ABIERTA");
    assert.equal(d.body.resumen.efectivoEsperado, "2548.00", "Must equal native independently calculated ledger, not copied expected balance");
    m.targets["flow-close-recovery"] = { countedCash: "2548", closeReadbackPath: `/api/sesiones-caja/${d.body.sesion.id}/corte` };
    const broad = JSON.parse(fs.readFileSync("reports/noche-20260926/tarea-6/broad/result.json"));
    const navigation = broad.checks[0].evidence.links.map(x => x.href).filter(x => x?.startsWith("/") && !x.includes("logout"));
    m.broad.paths = [...new Set([...navigation, ...m.broad.paths])];
    fs.writeFileSync(process.env.NIGHT_BROWSER_MANIFEST, JSON.stringify(m, null, 2), { mode: 0o600 });
    return { sessionId: d.body.sesion.id, expected: d.body.resumen.efectivoEsperado, independentNativeLedger: "0 opening +1000 cash ticket +100 ordinary +1450 settlement -1 insufficient authorized exit -1 ordinary exit =2548; transfer and retained transfer excluded." };
  });
} catch (e) { await r.check("setup", async () => { throw e; }); }
finally { r.finish(); await b.close(); }