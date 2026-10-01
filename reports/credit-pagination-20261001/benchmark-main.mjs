// MAIN-only execution. No app credentials/URLs are inherited. Never activate builds.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { DisposablePostgresRunner, assertPostgres16Binaries, installSignalHandlers, redactSensitiveText } from "../../lib/db/src/run-isolated-tests.mjs";
import { prepareTestDatabase } from "../../lib/db/src/prepare-test-database.mjs";

assert.equal(process.argv[2], "--main-authorized", "MAIN must explicitly execute --main-authorized");
const root = path.resolve(import.meta.dirname, "../..");
const out = fs.mkdtempSync(path.join(import.meta.dirname, "run-"));
const write = (name, data) => fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 2));
const sha = data => createHash("sha256").update(data).digest("hex");
const api = path.join(root, "artifacts/api-server/dist-driver-phones-20261001/index.mjs");
const ui = path.join(root, "artifacts/mariana-textil/dist-sidebar-order-20261001");
const requireApi = createRequire(path.join(root, "artifacts/api-server/package.json"));
const { Pool } = createRequire(path.join(root, "lib/db/package.json"))("pg");
const ExcelJS = requireApi("exceljs");
const playwrightPath = path.join(root, ".cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs");
const { chromium } = await import(pathToFileURL(playwrightPath));
assert.ok(fs.existsSync("/repl/tools/bin/chromium"));
assert.equal(spawnSync("pdftotext", ["-v"]).status, 0, "pdftotext must already be installed");
const files = {};
for (const file of fs.readdirSync(ui, { recursive: true })) {
  const full = path.join(ui, file);
  if (fs.statSync(full).isFile()) files[file] = sha(fs.readFileSync(full));
}
// Only the bytes served by this private proxy change. No on-disk app file changes.
const patchFile = "assets/index-TteXdrEC.js";
const patchFrom = "d=r!==void 0,[m,f]=v.useState(50)";
const patchTo = "d=false,[m,f]=v.useState(50)";
const original = fs.readFileSync(path.join(ui, patchFile), "utf8");
assert.equal(original.split(patchFrom).length, 2, "Frozen report pagination switch must match exactly once");
const disabled = original.replace(patchFrom, patchTo);
const cleanEnvironment = Object.fromEntries(["PATH", "HOME", "USER", "LANG", "TMPDIR"].filter(k => process.env[k]).map(k => [k, process.env[k]]));
assertPostgres16Binaries();
const runner = new DisposablePostgresRunner({ parentEnvironment: cleanEnvironment, actorMode: true });
let pool, apiChild, web, browser, mode = "on";
const evidence = {
  status: "RUNNING", liveDatabaseAccess: false, samples: [],
  provenance: { api, apiSha256: sha(fs.readFileSync(api)), ui, frontendFiles: files, patchFile, patchFrom, patchTo, disabledSha256: sha(disabled),
    loaderSha256: sha(fs.readFileSync(path.join(root, "reports/noche-20260926/tarea-2/annual-load.mjs"))) },
  limitations: [
    "Fresh local PostgreSQL and 2575 synthetic customers, not the old Neon snapshot or inherited customer histories; historical 11792ms/12355ms and rejected-index 11496ms are context only.",
    "SQL historical fixtures are performance workload, not native producer correctness evidence.",
    "OFF changes one presentation boolean in HTTP-served frozen JS; API, SQL, data, sorting, financial calculations and exports are unchanged.",
    "Current canonical schema preparation, not a historical schema clone. No financial indexes added by this harness.",
    "API timing is actual HTTP including PostgreSQL work; render remainder also includes browser/network overhead and is not pure CPU time.",
  ],
};
// Request credentials remain in memory only, including on request-error paths.
const runtimeSecrets = [];
const redact = e => redactSensitiveText(String(e?.stack || e), [...runtimeSecrets, runner.password, runner.seedPassword, runner.testDatabaseUrl, runner.controlDatabaseUrl]);
async function cleanup() {
  await browser?.close().catch(() => {});
  if (web) { web.closeAllConnections(); await new Promise(r => web.close(r)); web = null; }
  if (apiChild && apiChild.exitCode === null) {
    const closed = new Promise(r => apiChild.once("close", r));
    apiChild.kill("SIGTERM");
    const timer = setTimeout(() => apiChild.kill("SIGKILL"), 3000);
    await closed; clearTimeout(timer);
  }
  await pool?.end(); pool = null;
  await runner.cleanup();
  evidence.cleanupPassed = !runner.rootDirectory || !fs.existsSync(runner.rootDirectory);
}
const removeSignals = installSignalHandlers(async () => { runner.abort(); await cleanup(); write("result.json", evidence); }, {});
const listen = server => new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve(server.address().port)); });
const frames = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const findTables = value => {
  const found = [];
  const visit = v => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v.columns) && Array.isArray(v.rows)) { found.push(v); return; }
    Object.values(v).forEach(visit);
  };
  visit(value); return found;
};
const stable = value => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([k]) => k !== "generatedAt").map(([k,v]) => [k,stable(v)]));
  return value;
};
try {
  await runner.start(); await runner.verifyIdentity();
  const identity = JSON.stringify([runner.verifiedIdentity, runner.verifiedControlIdentity]);
  await prepareTestDatabase({ environment: runner.childEnvironment(), signal: runner.signal, onChild: (c, control) => runner.trackChild(c, control) });
  await runner.verifyIdentity();
  assert.equal(JSON.stringify([runner.verifiedIdentity, runner.verifiedControlIdentity]), identity);
  assert.equal(runner.verifiedIdentity.listen_addresses, "");
  evidence.identitySha256 = sha(identity);
  pool = new Pool({ connectionString: runner.testDatabaseUrl, max: 1 });
  const authSource = fs.readFileSync(path.join(root, "reports/e11/01-preparado.sql"), "utf8");
  const authTable = authSource.match(/CREATE TABLE public\.e11_perfiles \([\s\S]*?\n\);/)?.[0];
  assert.ok(authTable);
  if (!(await pool.query("SELECT to_regclass('public.e11_perfiles') t")).rows[0].t) await pool.query(authTable);
  evidence.authSidecarSha256 = sha(authTable);
  const admin = (await pool.query("SELECT id,usuario FROM usuarios WHERE usuario='admin' AND rol='ADMIN'")).rows[0];
  assert.ok(admin);
  // Canonical preparation includes synthetic customers. Preserve their IDs and
  // any fixture references; rename only this verified fresh disposable's rows.
  const seedCustomerCount = (await pool.query("SELECT count(*)::int n FROM clientes WHERE id<>1")).rows[0].n;
  assert.ok(seedCustomerCount <= 2575, "Canonical seed exceeds benchmark population");
  assert.equal((await pool.query("SELECT count(*)::int n FROM clientes WHERE id=1 AND es_sistema")).rows[0].n, 1);
  await pool.query(`WITH numbered AS (
    SELECT id,row_number() OVER(ORDER BY id) n FROM clientes WHERE id<>1
  ) UPDATE clientes c SET nombre='SYN'||lpad(numbered.n::text,5,'0'),
    dias_credito=30,limite_credito=100000
    FROM numbered WHERE c.id=numbered.id`);
  await pool.query("INSERT INTO clientes(nombre,dias_credito,limite_credito) SELECT 'SYN'||lpad(g::text,5,'0'),30,100000 FROM generate_series($1::int,2575) g", [seedCustomerCount+1]);
  assert.equal((await pool.query("SELECT count(*)::int n FROM clientes WHERE id<>1 AND nombre ~ '^SYN[0-9]{5}$'")).rows[0].n, 2575);
  evidence.customerPreparation = { canonicalSyntheticPreserved: seedCustomerCount, added: 2575-seedCustomerCount, totalDistributed: 2575, deleted: 0 };
  if (!(await pool.query("SELECT id FROM proveedores LIMIT 1")).rowCount) await pool.query("INSERT INTO proveedores(nombre,tipo) VALUES('Synthetic benchmark supplier','NACIONAL')");
  let loader = fs.readFileSync(path.join(root, "reports/noche-20260926/tarea-2/annual-load.mjs"), "utf8");
  // Reuse original SQL byte-for-byte, adapting only wrapper identity and IO.
  const start = loader.indexOf('const tables = ["clientes"');
  assert.ok(start > 0);
  loader = loader.slice(start).replaceAll('"noche_20260926"', "database");
  const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
  const client = await pool.connect();
  try {
    await new AsyncFunction("c", "fs", "out", "config", "admin", "database", loader)(
      { query: (...args) => client.query(...args), end: async () => {} }, fs, pathToFileURL(out + "/"),
      { days: 365, stores: 3, ticketsPerStoreDay: 50, start: "2025-09-27" }, admin, runner.database);
  } finally { client.release(); }
  const load = JSON.parse(fs.readFileSync(path.join(out, "load-results.json")));
  load.assumptions.distribution = "Round robin over 2575 synthetic customers (canonical synthetic IDs preserved and renamed; remainder newly inserted), 4 meter products, 3 synthetic stores";
  load.customerPreparation = evidence.customerPreparation;
  write("load-results.json", load);
  for (const [table, delta] of Object.entries({ tickets: 54750, ticket_lineas: 54750, rollos: 54750, ticket_pagos: 41063, movimientos_credito: 13687 }))
    assert.equal(load.after[table] - load.before[table], delta, table);
  await pool.query("ANALYZE");
  const reservation = http.createServer();
  const apiPort = await listen(reservation);
  await new Promise(r => reservation.close(r));
  const bootstrap = path.join(out, "bootstrap.mjs");
  fs.writeFileSync(bootstrap, `import net from 'node:net';import fs from 'node:fs';import crypto from 'node:crypto';
const api=${JSON.stringify(api)};
if(crypto.createHash('sha256').update(fs.readFileSync(api)).digest('hex')!==${JSON.stringify(evidence.provenance.apiSha256)})throw Error('API changed');
if(process.env.DATABASE_URL!==${JSON.stringify(runner.testDatabaseUrl)})throw Error('Wrong target');
const listen=net.Server.prototype.listen;net.Server.prototype.listen=function(...args){if(typeof args[0]==='object')args[0]={...args[0],host:'127.0.0.1'};else if(typeof args[1]==='string')args[1]='127.0.0.1';else args.splice(1,0,'127.0.0.1');return listen.apply(this,args)};
await import(${JSON.stringify(pathToFileURL(api).href)});
`, { mode: 0o600 });
  // Bootstrap contains only the temporary local credential and is removed in finally.
  const fd = fs.openSync(path.join(out, "private-api.log"), "w", 0o600);
  apiChild = spawn(process.execPath, [bootstrap], { cwd: root, env: { ...cleanEnvironment, DATABASE_URL: runner.testDatabaseUrl, NODE_ENV: "development", PORT: String(apiPort), API_STARTUP_MODE: "NORMAL", API_INSPECTION_BOOT: "1", DB_POOL_MAX: "12" }, stdio: ["ignore", fd, fd] });
  fs.closeSync(fd);
  let ready = false;
  for (let i=0;i<240;i++) {
    assert.equal(apiChild.exitCode, null, "Private API exited");
    try { if ((await fetch(`http://127.0.0.1:${apiPort}/api/healthz`)).ok) { ready=true; break; } } catch {}
    await new Promise(r=>setTimeout(r,500));
  }
  assert.ok(ready, "Private API startup timed out");
  web = http.createServer((req,res) => {
    const u = new URL(req.url, "http://localhost");
    if (u.pathname.startsWith("/api/")) {
      const upstream = http.request({ hostname:"127.0.0.1", port:apiPort, path:u.pathname+u.search, method:req.method, headers:{...req.headers,host:`127.0.0.1:${apiPort}`} }, incoming => { res.writeHead(incoming.statusCode,incoming.headers);incoming.pipe(res); });
      upstream.on("error",()=>{res.writeHead(502);res.end();});req.pipe(upstream);return;
    }
    let file = decodeURIComponent(u.pathname).slice(1);
    if (!file || !path.extname(file)) file="index.html";
    if (!Object.hasOwn(files,file)) {res.writeHead(404);res.end();return;}
    const bytes=fs.readFileSync(path.join(ui,file));
    if(sha(bytes)!==files[file]){res.writeHead(500);res.end("Frozen bytes changed");return;}
    res.writeHead(200,{"content-type":({".html":"text/html",".js":"application/javascript",".css":"text/css",".svg":"image/svg+xml"})[path.extname(file)]||"application/octet-stream","cache-control":"no-store"});
    res.end(mode==="off"&&file===patchFile?disabled:bytes);
  });
  const origin = `http://127.0.0.1:${await listen(web)}`;
  let reference, referenceFooters;
  for (mode of ["on","off"]) for (let sample=1;sample<=3;sample++) {
    browser = await chromium.launch({ executablePath:"/repl/tools/bin/chromium",headless:true,args:["--no-sandbox","--disable-dev-shm-usage"] });
    const page = await browser.newPage({viewport:{width:1360,height:1000}});
    page.setDefaultTimeout(120000);
    const errors=[], requests=[], pending=[];
    await page.route("**/*",route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    page.on("pageerror",e=>errors.push(e.message));
    let responseJson, reportTiming, authenticatedHeaders;
    page.on("response",r=>{
      if(new URL(r.url()).pathname.startsWith("/api/")) requests.push({url:r.url().replace(origin,""),status:r.status()});
      if(new URL(r.url()).pathname==="/api/reportes/clientes")
        pending.push((async()=>{
          responseJson=await r.json();await r.finished();
          if(r.status()===200){
            const headers=await r.request().allHeaders();
            authenticatedHeaders=Object.fromEntries(Object.entries(headers).filter(([key])=>
              key==="authorization"||key==="cookie"||key.startsWith("x-")));
            for(const value of Object.values(authenticatedHeaders)){
              runtimeSecrets.push(value);
              if(value.startsWith("Bearer "))runtimeSecrets.push(value.slice(7));
            }
          }
          reportTiming={url:r.url().replace(origin,""),status:r.status(),timing:r.request().timing(),serverTiming:await r.headerValue("server-timing")};
        })());
    });
    await page.goto(origin+"/login",{waitUntil:"domcontentloaded"});
    await page.getByLabel("Usuario",{exact:true}).fill(admin.usuario);
    await page.getByLabel("Contraseña",{exact:true}).fill(runner.seedPassword);
    await page.getByRole("button",{name:"Ingresar",exact:true}).click();
    await page.waitForURL(u=>!u.pathname.includes("login"));
    // An anonymous session probe before login is expected, not a report failure.
    // Login/initial navigation are outside the legacy measurement interval.
    requests.length = 0;
    const started=performance.now();
    await page.goto(origin+"/reportes/clientes?periodo=personalizado&desde=2025-09-27&hasta=2026-09-26",{waitUntil:"domcontentloaded"});
    await page.getByTestId("report-content-clientes").waitFor();
    await frames(page);
    const durationMs=performance.now()-started;
    const readyEpochMs=Date.now();
    // Preserve the actual ready state even if a later validation fails.
    await page.screenshot({path:path.join(out,`${mode}-${sample}.png`)});
    await Promise.all(pending);
    assert.ok(responseJson && reportTiming);
    assert.equal(reportTiming.status,200);
    assert.ok(authenticatedHeaders?.authorization||authenticatedHeaders?.cookie,
      "Reuse actual successful browser request credentials; never assume cookies alone");
    assert.match(reportTiming.url,/desde=2025-09-27/);assert.match(reportTiming.url,/hasta=2026-09-26/);
    const tables=responseJson.tables;
    assert.ok(Array.isArray(tables));
    assert.ok(tables.length);
    const signature=sha(JSON.stringify(stable(responseJson)));
    if(reference) assert.equal(signature,reference,"Full financial response must match across all samples"); else reference=signature;
    write(`${mode}-${sample}-response.json`,responseJson);
    // The composed Clientes tab also mounts a separate pagos-dirigidos report.
    // Its table IDs overlap with tables in clientes. Scope by source report,
    // never count matching table IDs across the entire composed page.
    const reportContent=page.getByTestId("report-content-clientes");
    assert.equal(await reportContent.count(),1);
    const dom=[];
    for(const table of tables){
      const card=reportContent.getByTestId(`report-table-${table.id}`);
      assert.equal(await card.count(),1,`Exactly one clientes source table ${table.id}`);
      const rows=await card.locator('tbody tr[data-testid^="tr-"]').count();
      assert.equal(rows,Math.min(mode==="on"?50:Infinity,table.rows.length),`DOM data rows ${table.id}`);
      assert.equal(await card.locator("tbody tr").count(),rows||1,`Only data or one empty-state row ${table.id}`);
      if(!table.rows.length)assert.equal((await card.locator("tbody").innerText()).trim(),"No hay datos disponibles");
      const expectedFooter=table.totals&&table.rows.length>0?1:0;
      assert.equal(await card.locator("tfoot").count(),expectedFooter,`Full-data footer presence ${table.id}`);
      if(expectedFooter){
        const visibleColumns=table.columns.filter(c=>c.kind!=="money"||responseJson.hasEconomicAccess);
        assert.equal(await card.locator("tfoot td").count(),visibleColumns.length,`Every footer column ${table.id}`);
        for(const [index,column] of visibleColumns.entries()){
          const total=table.totals[column.key];
          if(total===undefined||total===null)continue;
          const text=(await card.locator("tfoot td").nth(index).innerText()).trim();
          if(typeof total==="number"&&["money","count","quantity","percentage","days"].includes(column.kind)){
            assert.ok(text.length>0,`Nonempty numeric footer ${table.id}.${column.key}`);
            const displayed=Number(text.replace(/[^0-9.\-]/g,""));
            assert.ok(Number.isFinite(displayed)&&Math.abs(displayed-total)<0.011,
              `Footer must equal full API total ${table.id}.${column.key}: ${text} vs ${total}`);
          } else if(column.kind==="text")assert.equal(text,String(total));
        }
      }
      dom.push({id:table.id,payloadRows:table.rows.length,domRows:rows,totals:table.totals,footer:await card.locator("tfoot").allTextContents()});
    }
    assert.ok(dom.some(t=>t.payloadRows>50),"Must exercise actual large table");
    const footers=JSON.stringify(dom.map(t=>({id:t.id,totals:t.totals,footer:t.footer})));
    if(referenceFooters)assert.equal(footers,referenceFooters,"All visible full-data footers must match");else referenceFooters=footers;
    const measured={mode,sample,durationMs,reportTiming,apiMs:reportTiming.timing.responseEnd,postApiToReadyMs:readyEpochMs-(reportTiming.timing.startTime+reportTiming.timing.responseEnd),signature,dom,requests,errors};
    // Browser's absolute request timestamps provide a separate API boundary;
    // duration remains the exact legacy action -> visible -> two-frame metric.
    measured.renderRemainderUpperBoundMs=Math.max(0,durationMs-measured.apiMs);
    evidence.samples.push(measured);write(`${mode}-${sample}.json`,measured);
    await page.screenshot({path:path.join(out,`${mode}-${sample}.png`)});
    assert.deepEqual(errors,[]);assert.ok(!requests.some(r=>r.status>=400), "HTTP errors are not passing samples");
    if(sample===1){
      const exports={csv:{status:"UNSUPPORTED",reason:"Released report route exposes XLSX and PDF only"},tables:tables.map(t=>({id:t.id,title:t.title,rows:t.rows.length,totals:t.totals}))};
      write(`${mode}-exports.json`,exports);
      const query=new URL(origin+reportTiming.url).search;
      for(const format of ["xlsx","pdf"]){
        const response=await page.request.get(`${origin}/api/reportes/clientes/export.${format}${query}`,{
          timeout:180000,headers:authenticatedHeaders,maxRedirects:0,
        });
        assert.equal(response.status(),200);
        const bytes=await response.body(),file=path.join(out,`${mode}-export.${format}`);fs.writeFileSync(file,bytes);
        exports[format]={status:200,bytes:bytes.length,sha256:sha(bytes)};
        if(format==="xlsx"){
          const book=new ExcelJS.Workbook();await book.xlsx.load(bytes);
          exports.xlsx.sheets=book.worksheets.map(s=>({name:s.name,rows:s.rowCount}));
          // Canonical exporter writes Periodo, Indicadores, then each report table.
          exports.xlsx.tableChecks=tables.map((t,i)=>{
            const sheet=book.worksheets[i+2];assert.ok(sheet);
            const hasTotals=t.totals&&Object.values(t.totals).some(v=>v!==null&&v!==undefined&&v!=="");
            const expected=1+t.rows.length+(hasTotals?1:0);
            assert.equal(sheet.rowCount,expected,`Export sheet rows ${t.id}`);
            return {id:t.id,sheet:sheet.name,dataRows:t.rows.length,worksheetRows:sheet.rowCount,expected};
          });
        } else {
          const text=spawnSync("pdftotext",["-layout",file,"-"],{encoding:"utf8",maxBuffer:32*1024*1024});
          assert.equal(text.status,0);
          fs.writeFileSync(path.join(out,`${mode}-export-pdf.txt`),text.stdout);
          const expectedNames=new Set(tables.flatMap(t=>t.rows.flatMap(r=>Object.values(r).filter(v=>typeof v==="string").flatMap(v=>v.match(/SYN\d{5}/g)||[]))));
          const observedNames=new Set(text.stdout.match(/SYN\d{5}/g)||[]);
          assert.ok(expectedNames.size>50);
          for(const name of expectedNames)assert.ok(observedNames.has(name),`PDF missing ${name}`);
          exports.pdf.customerCoverage={expectedUnique:expectedNames.size,observedUnique:observedNames.size,allPresent:true};
          exports.pdf.rowCountLimitation="PDF validates every synthetic customer identifier, not a structural count of every non-customer table row; XLSX checks each table row count.";
        }
        write(`${mode}-exports.json`,exports);
      }
      // Exporting must leave full response, table totals and viewport unchanged.
      const again=await page.request.get(origin+reportTiming.url,{
        timeout:120000,headers:authenticatedHeaders,maxRedirects:0,
      });
      assert.equal(again.status(),200);assert.equal(sha(JSON.stringify(stable(await again.json()))),reference);
      for(const t of dom){
        const card=reportContent.getByTestId(`report-table-${t.id}`);
        assert.equal(await card.locator('tbody tr[data-testid^="tr-"]').count(),t.domRows);
        assert.deepEqual(await card.locator("tfoot").allTextContents(),t.footer,"Export preserves full-data footer");
      }
      write(`${mode}-exports.json`,exports);
    }
    await browser.close();browser=null;
  }
  const stats=values=>{const sorted=[...values].sort((a,b)=>a-b);return {n:values.length,min:sorted[0],median:sorted[Math.floor(sorted.length/2)],max:sorted.at(-1)};};
  evidence.summary=Object.fromEntries(["on","off"].map(m=>[m,{browserMs:stats(evidence.samples.filter(s=>s.mode===m).map(s=>s.durationMs)),apiMs:stats(evidence.samples.filter(s=>s.mode===m).map(s=>s.apiMs))}]));
  fs.writeFileSync(path.join(out,"samples.csv"),"mode,sample,browser_ms,api_ms,render_remainder_upper_bound_ms\n"+evidence.samples.map(s=>[s.mode,s.sample,s.durationMs,s.apiMs,s.renderRemainderUpperBoundMs].join(",")).join("\n")+"\n");
  evidence.status="COMPLETED";
} catch(error) { evidence.status="FAILED";evidence.error=redact(error);process.exitCode=1; }
finally {
  try { await cleanup(); } catch(error){evidence.cleanupError=redact(error);process.exitCode=1;}
  removeSignals();
  fs.rmSync(path.join(out,"bootstrap.mjs"),{force:true});
  const log=path.join(out,"private-api.log");
  if(fs.existsSync(log))fs.writeFileSync(log,redact(fs.readFileSync(log,"utf8")),{mode:0o600});
  write("result.json",evidence);
  fs.writeFileSync(path.join(out,"resultado.md"),[
    "# Annual credit pagination benchmark",
    `Status: ${evidence.status}. Cleanup: ${evidence.cleanupPassed}.`,
    "Exact legacy browser metric: annual navigation → report-content-clientes visible → two animation frames. Three fresh browser/login samples per mode; login excluded. HTTP timing is separate.",
    "## Summary (milliseconds)",
    JSON.stringify(evidence.summary||{samplesCompleted:evidence.samples.length},null,2),
    "## Limits",...evidence.limitations.map(s=>`- ${s}`),
    "- PDF verifies complete synthetic-customer identifier coverage; XLSX verifies every table row count. CSV is unsupported by this released report API.",
    evidence.error?`## Failure\n${evidence.error}`:"",
  ].join("\n\n"));
  console.log(JSON.stringify({directory:out,status:evidence.status,error:evidence.error,summary:evidence.summary,cleanupPassed:evidence.cleanupPassed},null,2));
}