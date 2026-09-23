import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("./cleanup-bloque-7.mjs", import.meta.url),
  "utf8",
);

test("retained automated candidates are planned before any deletion", () => {
  const decisionStart = source.indexOf(
    "const candidateDeletionPlans = [];",
  );
  const blockerLookup = source.indexOf(
    "await inboundReferences(client, table, ids)",
    decisionStart,
  );
  const candidateDelete = source.indexOf(
    "await deleteCandidates(",
    decisionStart,
  );

  assert.ok(decisionStart >= 0, "candidate deletion plan is required");
  assert.ok(blockerLookup > decisionStart, "blockers must be read");
  assert.ok(
    candidateDelete > blockerLookup,
    "no candidate may be deleted before blocker evaluation",
  );

  for (const forbiddenDelete of [
    "DELETE FROM cliente_documentos",
    "DELETE FROM permisos_usuario WHERE usuario_id",
    "DELETE FROM entrada_folio WHERE ubicacion_id",
    "DELETE FROM salida_folio WHERE ubicacion_id",
    "DELETE FROM viaje_folio WHERE ubicacion_id",
  ]) {
    assert.equal(
      source.includes(forbiddenDelete),
      false,
      `${forbiddenDelete} would partially mutate a retained candidate`,
    );
  }
});

test("financial cleanup restores exact triggers and never disables audit", () => {
  assert.match(source, /enableAuthorizedImmutableDeleteTriggers\(client\)/);
  assert.match(source, /verifyImmutableDeleteTriggers\(client, true\)/);
  assert.doesNotMatch(source, /DISABLE TRIGGER ALL/i);
  assert.doesNotMatch(source, /session_replication_role/i);
  assert.doesNotMatch(source, /auditoria_append_only/);
});