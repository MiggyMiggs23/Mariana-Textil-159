// Loader-only repair authorized after the aborted preparation (zero cases).
// Original aborted runner/evidence are preserved. SQL and cases are unchanged.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const prior = new URL('../postgresql-validacion-corregida-20260921/run.mjs', import.meta.url);
let source = readFileSync(prior, 'utf8');
const inheritedRunnerSha256 = createHash('sha256').update(source).digest('hex');
function replaceOnce(before, after) {
  assert.equal(source.split(before).length, 2, `unique runner edit: ${before}`);
  source = source.replace(before, after);
}
replaceOnce("const revision = 'd3b3154753563adc1a64ee1427518a6e6a0a22d6';",
  "const revision = '31804125a1e752bde128d72e9fd44d23972ffff1';");
replaceOnce("../autorizacion-propietario-correccion-sql-y-registro-arranques.txt",
  "../autorizacion-propietario-subtransacciones-savepoint.txt");
replaceOnce("/tmp/e2-ac-corrected-pg16-", "/tmp/e2-ac-savepoint-firstcases-pg16-");
assert.equal(source.split("e2-isolated-corrected-harness").length,3);
source = source.replaceAll("e2-isolated-corrected-harness", "e2-isolated-savepoint-firstcases");
replaceOnce("runnerSha256:hash(readFileSync(fileURLToPath(import.meta.url))),",
  `runnerSha256:hash(readFileSync(fileURLToPath(import.meta.url))), inheritedRunnerSha256:'${inheritedRunnerSha256}',`);
replaceOnce("} catch(e) {\n  failed=true;log(e.stack);",
  `  assert.equal(results.length,51,'exact original case count');
  assert(results.every(r=>r.status==='PASS'),'supplements require all original cases PASS');
  const {supplement}=await import(${JSON.stringify(new URL('./supplement.mjs', import.meta.url).href)});
  await identity('before-separate-supplement');
  await supplement({c,runDir,fixture:bytes(harnessBase+'fixture.sql').toString(),
    install:bytes(sqlBase+'01-install-evidence-prepared.sql').toString()});
} catch(e) {
  failed=true;log(e.stack);`);
// Repair BOTH filesystem imports; data modules require explicit file URLs.
replaceOnce("import { fileURLToPath } from 'node:url';",
  "import { fileURLToPath, pathToFileURL } from 'node:url';");
replaceOnce("import(path.join(workspace,'node_modules/.pnpm/pg@8.22.0/node_modules/pg/lib/index.js'))",
  "import(pathToFileURL(path.join(workspace,'node_modules/.pnpm/pg@8.22.0/node_modules/pg/lib/index.js')).href)");
replaceOnce("import(candidate(harnessBase+'cases.mjs'))",
  "import(pathToFileURL(candidate(harnessBase+'cases.mjs')).href)");
source = source.replaceAll('import.meta.url', JSON.stringify(import.meta.url));
if(process.argv[2] === '--verify-loader-only') {
  const pgUrl=pathToFileURL(path.resolve('node_modules/.pnpm/pg@8.22.0/node_modules/pg/lib/index.js')).href;
  const casesUrl=new URL('./candidate/reports/e2-apertura-limitada/evidencia-a-c/postgresql-validacion/cases.mjs',import.meta.url).href;
  const supplementUrl=new URL('./supplement.mjs',import.meta.url).href;
  // Exercise imports from the SAME data-module base, without constructing any
  // client, invoking cases/supplements, initdb, or connecting to any database.
  await import(`data:text/javascript;base64,${Buffer.from(`
    import assert from 'node:assert/strict';
    const pg=await import(${JSON.stringify(pgUrl)});
    const cases=await import(${JSON.stringify(casesUrl)});
    const extra=await import(${JSON.stringify(supplementUrl)});
    assert.equal(typeof pg.default.Client,'function');
    assert.equal(typeof cases.runCases,'function');
    assert.equal(typeof extra.supplement,'function');
  `).toString('base64')}`);
  console.log(JSON.stringify({status:'PASS',scope:'offline import resolution only; no clients or DB',pgUrl,casesUrl,supplementUrl}));
} else {
  await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}