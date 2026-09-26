import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { load, browserKit, session, api, recorder } from "./runtime.mjs";
assert.equal(process.env.NIGHT_INVENTORY_READY, "MAIN_READY", "Wait for MAIN candidate readiness");
const { m, credentials } = load();
// MAIN explicitly selected this candidate; retain the original browser manifest untouched.
m.bundle.frontendRoot = path.resolve("artifacts/mariana-textil/dist-noche-task7-inventory-20260926");
m.bundle.frontendFiles = { "index.html": crypto.createHash("sha256").update(fs.readFileSync(path.join(m.bundle.frontendRoot, "index.html"))).digest("hex") };
const r = recorder(7, "inventory-piece-candidate-confirmation"), b = await browserKit(m);
try {
  const p = await session(b, m, credentials.admin);
  await r.check("served-candidate-fingerprint", async () => {
    const response = await p.request.get(m.origin + "/index.html");
    const sha = crypto.createHash("sha256").update(await response.body()).digest("hex");
    assert.equal(sha, m.bundle.frontendFiles["index.html"]);
    return { servedIndexSha256: sha, apiSha256: m.bundle.apiSha256, frontendRoot: m.bundle.frontendRoot };
  });
  await r.check("actual-inventory-component-piece-column-and-filtered-totals", async () => {
    await p.goto(m.origin + "/inventario");
    await p.getByRole("heading", { name: "Control de Inventario" }).waitFor();
    await p.getByPlaceholder("Buscar SKU, tela, color, serie...").fill("NOCHE26 UNIDADES");
    await p.locator("thead th").filter({ hasText: "Total Pzas." }).waitFor();
    for (const [unit, qty] of [["PIEZA", 17], ["KILO", 13], ["BOLSA", 19]]) {
      const row = p.locator('[data-testid^="group-"]').filter({ hasText: `NOCHE26 UNIDADES ${unit}` });
      await row.waitFor();
      const text = await row.innerText();
      assert.match(text, new RegExp(`\\b${qty}(?:[.,]00)?\\b`));
    }
    const footer = p.getByTestId("global-filtered-totals");
    await footer.waitFor();
    const headers = await p.locator("thead th").allInnerTexts();
    const cells = await footer.locator("td").allInnerTexts();
    const quantity = label => Number(cells[headers.findIndex(x => x === label)].replaceAll(",", ""));
    assert.equal(quantity("Total Pzas."), 17);
    assert.equal(quantity("Total Kg."), 13);
    assert.equal(quantity("Total Bolsas"), 19);
    await r.snap(p, "actual-inventory-separated-piece-kilo-bolsa");
    return { headers, cells, caveat: "Search filters three new products; METRO from entry5 is independently shown in roll detail, not falsely asserted as total of its preexisting product." };
  }, [p]);
  await r.check("entry5-metro11-in-actual-inventory-roll-detail", async () => {
    const entry = JSON.parse(fs.readFileSync(path.join(m.privateDir, "exploratory-native.json"))).entry;
    assert.equal(entry.id, 5);
    const roll = entry.rollos.find(x => Number(x.cantidadInicial) === 11);
    const readback = await api(p, "/api/inventario/entradas/5");
    assert.equal(readback.status, 200);
    await p.getByRole("tab", { name: "Detalle de Rollos" }).click();
    await p.getByPlaceholder("Buscar SKU, tela, color, serie...").fill(roll.serie);
    const row = p.getByText(roll.serie, { exact: true }).locator("xpath=ancestor::*[contains(@class,'cursor-pointer')][1]");
    await row.waitFor();
    const text = await row.innerText();
    assert.match(text, /\b11(?:[.,]00)?\b/);
    await r.snap(p, "actual-inventory-entry5-metro11");
    return { entryId: 5, series: roll.serie, actualRow: text };
  }, [p]);
  await r.check("read-only-open-synthetic-site-preflight", async () => {
    const sites = await api(p, "/api/locations"); assert.equal(sites.status, 200);
    const list = Array.isArray(sites.body) ? sites.body : sites.body.items;
    assert.ok(Array.isArray(list));
    const synthetic = list.filter(x => /NOCHE|PERF/i.test(x.nombre));
    const eligible = [];
    for (const site of synthetic) {
      const cash = await api(p, `/api/sesiones-caja/actual?ubicacionId=${site.id}`);
      if (cash.status === 200 && cash.body.sesion?.estado === "ABIERTA") eligible.push({ site, cash: cash.body, floors: await api(p, `/api/locations/${site.id}/pisos`) });
    }
    fs.writeFileSync(path.join(m.privateDir, "fresh-performance-preflight.json"), JSON.stringify(eligible, null, 2), { mode: 0o600 });
    return { syntheticSiteIds: synthetic.map(x => x.id), open: eligible.map(x => ({ id: x.site.id, name: x.site.nombre })) };
  });
} catch (e) { await r.check("setup", async () => { throw e; }); }
finally { r.finish(); await b.close(); }