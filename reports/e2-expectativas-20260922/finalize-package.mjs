// Authorized metadata generation only. No DB connection, app startup or workflow action.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
const pkg = "reports/e2-paquete-liberacion-preparado-20260921";
const out = "reports/e2-expectativas-20260922";
const sha = p => createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const read = p => fs.readFileSync(p, "utf8");
const json = p => JSON.parse(read(p));
const save = (p, value) => fs.writeFileSync(p, JSON.stringify(value, null, 2) + "\n");
const replaceOnce = (text, from, to) => {
  assert.equal(text.split(from).length, 2, `Expected single occurrence: ${from}`);
  return text.replace(from, to);
};
const protectedBefore = json(`${out}/protected-before.json`);
const mutable = new Set(["release-expected.json", "release-assets.sha256", "api-start-audit.sh",
  "manifest-final.json", "manifest-final.sha256", "package-integrity.sha256", "09-fase-b-texto.md"].map(p => `${pkg}/${p}`));
for (const [p, oldHash] of Object.entries(protectedBefore)) {
  if (!mutable.has(p)) assert.equal(sha(p), oldHash, `STOP: unauthorized change ${p}`);
}
const liveEvidence = json(`${out}/live-read-evidence.json`);
assert.equal(fs.readFileSync(`/proc/${liveEvidence.pid}/stat`, "utf8").split(") ")[1].split(" ")[19], liveEvidence.startTicks);
const expected = json(`${pkg}/release-expected.json`);
assert.deepEqual(expected, json(`${out}/release-expected.validated.json`));
const wrapperProof = json(`${out}/wrapper-verification.json`);
assert.equal(wrapperProof.nineTests.passed, 9);
assert.equal(wrapperProof.exactWrapperSha256, sha(`${pkg}/api-start-audit.sh`));
assert.equal(wrapperProof.expectedInventorySha256, sha(`${pkg}/release-assets.sha256`));
const tests = json(`${out}/preflight/preflight-results.json`);
assert.equal(tests.filter(t => t.result === "PASS").length, 24);
assert.ok(!tests.some(t => t.result === "FAIL"));
// Byte-level allowlist for the two newly authorized modifications.
const gitRead = p => {
  const r = spawnSync("git", ["show", `HEAD:${p}`], { encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.equal(createHash("sha256").update(r.stdout).digest("hex"), protectedBefore[p]);
  return r.stdout;
};
assert.equal(read(`${pkg}/release-assets.sha256`),
  replaceOnce(gitRead(`${pkg}/release-assets.sha256`),
    protectedBefore[`${pkg}/release-expected.json`], sha(`${pkg}/release-expected.json`)));
assert.equal(read(`${pkg}/api-start-audit.sh`),
  replaceOnce(gitRead(`${pkg}/api-start-audit.sh`),
    protectedBefore[`${pkg}/release-assets.sha256`], sha(`${pkg}/release-assets.sha256`)));
const oldManifestHash = sha(`${pkg}/manifest-final.json`);
assert.equal(oldManifestHash, protectedBefore[`${pkg}/manifest-final.json`]);
const oldManifest = json(`${pkg}/manifest-final.json`);
const phaseOld = read(`${pkg}/09-fase-b-texto.md`);
fs.writeFileSync(`${out}/fase-b-anterior-conservada.md`, phaseOld);
save(`${out}/manifest-anterior-conservado.json`, oldManifest);
save(`${out}/scope-preservation.json`, {
  at: new Date().toISOString(), onlyAuthorizedPackagePaths: [...mutable],
  allOtherProtectedFilesUnchanged: true, protectedFileCount: Object.keys(protectedBefore).length,
  assetsChange: "Only release-expected.json entry replaced",
  wrapperChange: "Only literal release-assets.sha256 hash replaced; byte-for-byte comparison passed",
  apiPid: liveEvidence.pid, apiStartTicksUnchanged: true, apiRestarts: 0, workflowChanges: 0,
  liveSQLWrites: 0, originalPreflightLogicAndSQLUnchanged: true, bundlesUnchanged: true,
});
fs.writeFileSync(`${out}/resultado.md`, `# Expectativas B0/B1 regeneradas — 2026-09-22

Preparación completada; **no se ejecutó la liberación de fase B**.

- Autorización ampliada guardada literalmente antes de cualquier otra escritura.
- Catálogo nuevo de la conexión efectiva de la API en REPEATABLE READ READ ONLY,
  con default_transaction_read_only=on y ROLLBACK. Coincide íntegramente con el
  diagnóstico aceptado: ninguna diferencia adicional.
- B0 reconstruido vacío e idéntico al catálogo real antes de A+C.
- B1 obtenido solo con el SQL A+C aprobado. Enums completos y trigger ALWAYS
  preservados. Comparación completa con B1 histórico: solo las diez diferencias
  aceptadas de B0, sin cambios adicionales.
- Preflight: **24/24 PASS**, incluidos CLI real, symlink, rechazos negativos,
  restauraciones y postflight SQL. Instancia PostgreSQL detenida y eliminada.
- Wrapper actualizado: **9/9 PASS**. Además, copia exacta del wrapper final
  rechazó un inventario alterado con exit 1, etapa release_hash_before,
  preflight not_run y api_exec_attempted=false. No arrancó una API.
- La primera ejecución de las nueve pruebas pasó, pero el lector del resultado
  esperaba TAP y Node emitió su formato predeterminado. Se conservó esa salida y
  se repitió con TAP explícito; no se cambió ninguna prueba ni lógica del wrapper.
- Inventario: cambió únicamente la entrada de release-expected.json.
  Wrapper: cambió únicamente el hash literal del inventario.
- Bundle activo y candidato, SQL, preflight y workflow conservados.
  Mismo proceso API, sin reinicios. Ningún SQL de escritura en la base real.
- Las evidencias de arranque previas del manifiesto son HISTÓRICAS: no son
  nuevos ensayos del paquete regenerado. No se repitió ningún arranque.
- El bloqueo descrito en bloqueo-wrapper.md es histórico y quedó resuelto por
  autorizacion-ampliada-del-propietario.txt.

## Hashes vigentes

| Archivo / catálogo | SHA-256 |
| --- | --- |
| B0 esquema | ${expected.baseSchemaSha256} |
| B0 atributos | ${expected.baseAttributesSha256} |
| B1 esquema | ${expected.schemaSha256} |
| B1 atributos | ${expected.attributesSha256} |
| release-expected.json | ${sha(`${pkg}/release-expected.json`)} |
| release-assets.sha256 | ${sha(`${pkg}/release-assets.sha256`)} |
| api-start-audit.sh | ${sha(`${pkg}/api-start-audit.sh`)} |

El manifiesto final y su sidecar están en ${pkg}/.
El inventario package-integrity.sha256 incluye el texto final y estas evidencias
sin dependencia circular. Las pruebas originales no se editaron.
El texto para pegar se entrega en fase-b-20260922.txt y en
${pkg}/09-fase-b-texto.md.
`);
const manifest = structuredClone(oldManifest);
for (const name of ["release-expected.json", "release-assets.sha256", "api-start-audit.sh"]) {
  manifest.files[`${pkg}/${name}`] = sha(`${pkg}/${name}`);
}
manifest.checks.wrapper = "Current 2026-09-22: 9/9 PASS after authorized literal hash repin; exact final wrapper also rejects altered inventory before preflight/exec.";
manifest.checks.preflight = "Current 2026-09-22: 24/24 disposable checks PASS; fresh READ ONLY live B0 reproduced exactly; exact A+C B1 preserves enums/ALWAYS. No new API startup.";
manifest.expectationsRegeneration = {
  date: "2026-09-22", status: "VALIDATED_NOT_RELEASED", expectations: expected,
  evidenceDirectory: out,
  authorization: `${out}/autorizacion-ampliada-del-propietario.txt`,
  liveCatalog: `${out}/catalog-B0-live.json`, disposableB1: `${out}/preflight/catalog-B1.json`,
  wrapperProof: `${out}/wrapper-verification.json`,
  historicalEvidenceNotice: "All pre-existing actualStartup, control/candidate startup, preflightFix, historicalFirstFailedStartup and verificacion* records remain historical and unchanged. No current API startup was authorized or performed. Prior hash references in historical records are not current expectations.",
  scope: "Expectations and derived hashes only; wrapper literal pin only; no bundle, SQL, preflight logic, workflow, API restart or live write.",
};
manifest.authorizationDraft = {
  ...manifest.authorizationDraft, status: "PREPARED_NOT_GRANTED", blankFields: [],
  date: "2026-09-22", time: "a partir del momento en que el propietario pegue el texto",
};
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = `${dir}/${e.name}`; return e.isDirectory() ? walk(p) : e.isFile() ? [p] : [];
  });
}
// The final phase-B text references this manifest, so exclude it from the
// manifest itself and cover it in package-integrity instead.
for (const p of walk(out).filter(p => !p.endsWith("/fase-b-20260922.txt"))) manifest.evidenceFiles[p] = sha(p);
for (const name of ["autorizacion-regenerar-expectativas-b0-b1.txt", "autorizacion-diagnostico-b0-solo-lectura.txt"]) {
  manifest.packageSupportFiles[`${pkg}/${name}`] = sha(`${pkg}/${name}`);
}
manifest.packageIntegrity = "package-integrity.sha256 covers prior inventory, all package files, 2026-09-22 regeneration evidence and final phase-B text; excludes only itself.";
save(`${pkg}/manifest-final.json`, manifest);
const manifestHash = sha(`${pkg}/manifest-final.json`);
fs.writeFileSync(`${pkg}/manifest-final.sha256`, `${manifestHash}  ${pkg}/manifest-final.json\n`);
let phase = phaseOld;
phase = replaceOnce(phase,
  "**Paquete validado, no liberado. Esta autorización NO ha sido otorgada ni\n ejecutada.**".replace("\n ", "\n"),
  "**Paquete con expectativas regeneradas y validado, no liberado. Este nuevo texto de autorización NO ha sido otorgado ni\n ejecutado.**".replace("\n ", "\n"));
phase = replaceOnce(phase,
  "Control y candidato corregido pasaron el ensayo real. El único\ncampo por completar es la hora; el propietario debe emitir expresamente el\ntexto con esa hora. Los fallos previos permanecen como evidencia histórica.",
  "Los ensayos de arranque de control y candidato son históricos; no se repitieron.\nEl preflight pasó 24 comprobaciones desechables y el wrapper sus 9 pruebas más\nel rechazo del inventario alterado. No hay campos en blanco. El propietario\ndebe pegar expresamente el texto siguiente para autorizar esta fase B.\nSe conservan todos los fallos y resultados previos como evidencia histórica.");
phase = replaceOnce(phase,
  "> Autorizo la liberación E2 CLOSED el domingo 27 de septiembre de 2026,\n> a las ______, hora local de Mariana, en una ventana sin escritores.",
  "> Autorizo la liberación E2 CLOSED el martes 22 de septiembre de 2026,\n> a partir del momento en que el propietario pegue el texto,\n> hora local de Mariana, en una ventana sin escritores.");
for (const [oldHash, newHash] of [
  [oldManifestHash, manifestHash],
  [protectedBefore[`${pkg}/release-expected.json`], sha(`${pkg}/release-expected.json`)],
  [protectedBefore[`${pkg}/release-assets.sha256`], sha(`${pkg}/release-assets.sha256`)],
  [protectedBefore[`${pkg}/api-start-audit.sh`], sha(`${pkg}/api-start-audit.sh`)],
]) phase = replaceOnce(phase, oldHash, newHash);
phase = replaceOnce(phase,
  "> Se acepta el arrastre enumerado:",
  "> Acepto la regeneración de expectativas del 22 de septiembre de 2026:\n> B0 es el catálogo real leído en READ ONLY; B1 es ese mismo B0 más exactamente\n> A+C, validado en PostgreSQL desechable, sin alterar enums ni el trigger ALWAYS.\n> Solo cambian las expectativas y sus hashes derivados, incluida la entrada del\n> inventario y su hash literal en el wrapper; no su lógica ni sus controles.\n> La evidencia nueva está en reports/e2-expectativas-20260922/.\n> Los ensayos de arranque anteriores permanecen históricos; esta regeneración\n> no reinició la API ni modificó el workflow o la base real.\n> Se acepta el arrastre enumerado:");
phase = replaceOnce(phase, `> B0 catálogo: ${expected.baseSchemaSha256}.`,
  `> B0 catálogo: ${expected.baseSchemaSha256}.\n> B0 atributos: ${expected.baseAttributesSha256}.`);
phase = replaceOnce(phase, `> B1 catálogo: ${expected.schemaSha256}.`,
  `> B1 catálogo: ${expected.schemaSha256}.\n> B1 atributos: ${expected.attributesSha256}.`);
fs.writeFileSync(`${pkg}/09-fase-b-texto.md`, phase);
const pasteText = phase.split("\n").filter(l => l.startsWith(">")).map(l => l.replace(/^> ?/, "")).join("\n") + "\n";
fs.writeFileSync(`${out}/fase-b-20260922.txt`, pasteText);
const oldPaths = read(`${pkg}/package-integrity.sha256`).trim().split("\n").map(l => l.slice(66));
const paths = [...new Set([...oldPaths, ...walk(pkg), ...walk(out)])]
  .filter(p => p !== `${pkg}/package-integrity.sha256`).sort();
fs.writeFileSync(`${pkg}/package-integrity.sha256`, paths.map(p => `${sha(p)}  ${p}`).join("\n") + "\n");
for (const f of ["release-assets.sha256", "manifest-final.sha256", "package-integrity.sha256"]) {
  const r = spawnSync("sha256sum", ["--check", "--status", `${pkg}/${f}`], { encoding: "utf8" });
  assert.equal(r.status, 0, `${f}: ${r.stderr}`);
}
for (const [p, oldHash] of Object.entries(protectedBefore)) if (!mutable.has(p)) assert.equal(sha(p), oldHash);
// Validate every file-hash map in the manifest, not only the outer inventory.
for (const map of [manifest.files, manifest.evidenceFiles, manifest.packageSupportFiles]) {
  for (const [p, expectedHash] of Object.entries(map)) assert.equal(sha(p), expectedHash, p);
}
assert.equal(fs.readFileSync(`/proc/${liveEvidence.pid}/stat`, "utf8").split(") ")[1].split(" ")[19], liveEvidence.startTicks);
console.log(JSON.stringify({
  status: "PREPARED_VALIDATED_NOT_RELEASED", manifestSha256: manifestHash,
  packageIntegritySha256: sha(`${pkg}/package-integrity.sha256`),
  integrityFiles: paths.length, hashMapsVerified: true, authorizedScopeVerified: true,
  phaseB: `${out}/fase-b-20260922.txt`, apiSameProcess: true,
}, null, 2));