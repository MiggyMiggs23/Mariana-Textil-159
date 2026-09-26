import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { load, browserKit, session, api, recorder } from "./runtime.mjs";
const { m, credentials } = load(), b = await browserKit(m), r = recorder(4, "desktop-keyboard-scan");
try {
  const p = await session(b, m, credentials.auditUsers[3]);
  await r.check("configured-first-floor-real-keyboard-scan", async () => {
    await p.goto(m.origin + "/inventario/auditorias");
    await p.getByTestId("select-audit-site").click(); await p.getByRole("option").filter({ hasText: m.audit.siteName }).click();
    await p.getByRole("button", { name: "Unirme a la auditoría", exact: true }).click();
    await p.getByTestId("input-audit-scan").waitFor(); await p.waitForTimeout(750);
    assert.equal(await p.getByTestId("audit-floor-name").innerText(), m.audit.floors[0].name);
    assert.equal(await p.getByTestId("button-change-audit-floor").count(), 0);
    const d = await api(p, `/api/inventario/auditorias/${m.audit.auditId}`); assert.equal(d.status, 200);
    const before = d.body.resultados.find(x => x.serie === m.audit.series[4]);
    assert.equal(before.clasificacion, "FALTANTE", "Do not replay already observed scan");
    const marker = path.join(m.privateDir, "desktop-scan-intent.json");
    assert.ok(!fs.existsSync(marker), "Scan attempted already; fresh readback required");
    fs.writeFileSync(marker, JSON.stringify({ auditId: m.audit.auditId, series: m.audit.series[4], status: "UNCERTAIN" }), { mode: 0o600 });
    const response = p.waitForResponse(x => x.request().method() === "POST" && new URL(x.url()).pathname.endsWith("/escaneos"));
    await p.getByTestId("input-audit-scan").fill(m.audit.series[4]); await p.getByTestId("input-audit-scan").press("Enter");
    const http = await response; r.result.scanStatus = http.status(); assert.ok(http.ok());
    await p.getByTestId("shared-escaneados").filter({ hasText: /^5$/ }).waitFor();
    const after = await api(p, `/api/inventario/auditorias/${m.audit.auditId}`);
    const row = after.body.resultados.find(x => x.serie === m.audit.series[4]); assert.equal(row.pisoRealId, m.audit.floors[0].id);
    fs.writeFileSync(marker, JSON.stringify({ auditId: m.audit.auditId, series: m.audit.series[4], status: "ACK_READBACK" }), { mode: 0o600 });
    return { series: row.serie, actor: row.usuarioNombre, pisoReal: row.pisoReal, firstConfiguredFloor: m.audit.floors[0].name, physicalScanner: false };
  }, [p]);
} catch (e) { await r.check("setup", async () => { throw e; }); }
finally { r.finish(); await b.close(); }