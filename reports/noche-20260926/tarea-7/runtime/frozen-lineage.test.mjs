// Offline lineage/diagnosis checks only; no database, server, or browser access.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const read = name => readFileSync(resolve(root, name), "utf8");
const hash = value => createHash("sha256").update(value).digest("hex");
const entry = "artifacts/api-server/dist-auditoria-colaborativa-final-20260925/index.mjs";
const map = JSON.parse(read(`${entry}.map`));
const sources = {
  "src/middlewares/auth.ts": "7bb195f9ab2233e55aff004df49676713c39a5b6650baa1cc06126b45a9f0ec1",
  "src/routes/auth.ts": "d81dc2372a7f3ebcc266c5ea73bfa8c3201dfdca5ec566d68c77abbee6c7be15",
  "src/lib/e11-repository.ts": "d0672d27a900e75946e3c6ae28986432ec6077290e605e9a76ae5d3bd0ab2ec2",
  "src/lib/e11-runtime.ts": "ad64af6f1efe5d1bd96ab90f35cd01b7e417362a5e4143fdb31af4c0f04cc28f",
  "src/routes/e11.ts": "cc75e3a9073088e08ee216889d6960708f3ffac661131ab44a4346ceb77857b2",
  "db/src/index.ts": "ac59b087d8537abcfe6f021f9264bf0cce1aadd0b5c35923d65d20c7b58b9afd",
};
test("API entry remains exact final lineage", () => {
  assert.equal(hash(read(entry)), "e62a79333d0ee1433c114656af980e33ff420b728688a121ee586efdfab1b30d");
});
for (const [suffix, sha256] of Object.entries(sources)) {
  test(`inspected source equals frozen API: ${suffix}`, () => {
    const matches = map.sources.map((s, i) => s.endsWith(suffix) ? i : -1).filter(i => i >= 0);
    assert.equal(matches.length, 1);
    const frozen = map.sourcesContent[matches[0]];
    assert.equal(hash(frozen), sha256);
    const current = suffix.startsWith("db/") ? `lib/${suffix}` : `artifacts/api-server/${suffix}`;
    assert.equal(read(current), frozen);
  });
}
test("global fail-closed identity provider equals mensaje frozen source", () => {
  const name = "artifacts/mariana-textil/src/lib/e11-session.tsx";
  const frozen = read(`reports/auditoria-colaborativa/staging/frontend-root-mensaje/${name}`);
  assert.equal(read(name), frozen);
  assert.match(frozen, /refetchInterval: 15000, retry: false/);
  assert.match(frozen, /if \(available\.error \|\| identity\.error\) return/);
});
test("diagnosis explicitly makes no source-fix or runtime-pass claim", () => {
  const result = JSON.parse(read("reports/noche-20260926/tarea-7/runtime/diagnosis.json"));
  assert.equal(result.status, "BLOCKED_ROOT_CAUSE_NOT_PROVEN");
  assert.deepEqual(result.decision.sourceOverlays, []);
  assert.deepEqual(result.decision.productionSourceChanges, []);
  assert.equal(result.decision.releaseClaim, "none");
});