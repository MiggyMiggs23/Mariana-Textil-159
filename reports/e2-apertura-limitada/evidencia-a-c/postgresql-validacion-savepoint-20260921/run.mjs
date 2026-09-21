// Reuse the previously reviewed 51-case runner without editing it or its cases.
// Only execution identity/provenance and a separate post-51 supplement are added.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
replaceOnce("/tmp/e2-ac-corrected-pg16-", "/tmp/e2-ac-savepoint-pg16-");
assert.equal(source.split("e2-isolated-corrected-harness").length,3);
source = source.replaceAll("e2-isolated-corrected-harness", "e2-isolated-savepoint-harness");
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
// Retain filesystem-based relative paths and hash this wrapper, not a data URL.
source = source.replaceAll('import.meta.url', JSON.stringify(import.meta.url));
await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);