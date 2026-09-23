import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * These guards exercise the review-control contract without creating users,
 * rolls, or reprints.  Database journeys belong to the disposable isolated
 * integration environment and must not be run against development data.
 */
const route = await readFile(new URL("./routes/etiquetas.ts", import.meta.url), "utf8");
const schema = await readFile(
  new URL("../../../lib/db/src/schema/etiquetas.ts", import.meta.url),
  "utf8",
);
const initializer = await readFile(
  new URL("../../../lib/db/src/lib/etiquetas-schema.ts", import.meta.url),
  "utf8",
);
const page = await readFile(
  new URL("../../mariana-textil/src/pages/etiquetas.tsx", import.meta.url),
  "utf8",
);
const apiSpec = await readFile(
  new URL("../../../lib/api-spec/openapi.yaml", import.meta.url),
  "utf8",
);

test("pending predicate is shared by the list and ADMIN badge", () => {
  assert.match(route, /function pendingReviewPredicate\(\)/);
  assert.match(route, /if \(q\.pendientesRevision\) conditions\.push\(pendingReviewPredicate\(\)\)/);
  assert.match(route, /HAVING COUNT\(\*\) >= 3[\s\S]*pendingReviewPredicate\(\)/);
  assert.match(route, /NOT EXISTS \([\s\S]*revisiones_etiqueta pending_review/);
});

test("pending state uses the latest immutable reprint watermark", () => {
  assert.match(route, /ultima_reimpresion_id/);
  assert.match(route, /ORDER BY latest\.id DESC/);
  assert.match(route, /ARRAY_AGG\(re\.id ORDER BY re\.id DESC\)/);
  assert.doesNotMatch(route, /ORDER BY latest\.created_at DESC, latest\.id DESC/);
  assert.match(route, /ultimaReimpresionId/);
  assert.match(route, /revisionPendiente/);
});

test("a higher reprint ID reopens a review even with an older transaction timestamp", () => {
  const reprints = [
    { id: 700, createdAt: "2027-01-02T12:00:00.000Z" },
    // PostgreSQL now() is transaction-scoped; this insert can have an older
    // timestamp while its sequence ID is still the newer immutable event.
    { id: 701, createdAt: "2027-01-01T12:00:00.000Z" },
  ];
  const reviewedReprintIds = new Set([700]);
  const latest = [...reprints].sort((left, right) => right.id - left.id)[0];
  assert.equal(latest.id, 701);
  assert.equal(reviewedReprintIds.has(latest.id), false);
  assert.match(route, /ORDER BY latest\.id DESC/);
});

test("review is strict, ADMIN-only, server-attributed, and stale-safe", () => {
  const reviewBody = route.slice(
    route.indexOf("const reviewBody"),
    route.indexOf("type DbRow"),
  );
  assert.match(reviewBody, /z\.object\(\{[\s\S]*ultimaReimpresionId: z\.number\(\)\.int\(\)\.positive\(\)[\s\S]*\}\)\.strict\(\)/);
  assert.match(route, /"\/etiquetas\/rollos\/:id\/revisar"/);
  assert.match(route, /if \(auth\.user\.rol !== "ADMIN"\)/);
  assert.match(route, /FOR UPDATE OF r/);
  assert.match(route, /const watermark = await tx\.execute/);
  assert.match(route, /REPRINT_WATERMARK_MISMATCH/);
  assert.match(route, /res\.status\(409\)/);
  assert.match(route, /ON CONFLICT \(rollo_id, reimpresion_id\) DO NOTHING/);
  assert.match(route, /auth\.user\.id[\s\S]*auth\.user\.nombre[\s\S]*auth\.user\.usuario/);
  assert.doesNotMatch(reviewBody, /createdAt/);
});

test("review history is separate and append-only", () => {
  assert.match(schema, /revisionesEtiquetaTable/);
  assert.match(schema, /uniqueIndex\("revisiones_etiqueta_rollo_reimpresion_uidx"\)/);
  assert.match(initializer, /CREATE TABLE IF NOT EXISTS revisiones_etiqueta/);
  assert.match(initializer, /bloquear_mutacion_revision_etiqueta/);
  assert.match(initializer, /revisiones_etiqueta_inmutable/);
  assert.match(initializer, /validar_revision_etiqueta_reimpresion/);
  assert.doesNotMatch(initializer, /app\.etiquetas_cleanup[\s\S]*revisiones_etiqueta/);
  assert.doesNotMatch(initializer, /INSERT\s+INTO\s+revisiones_etiqueta/i);
  assert.match(route, /"\/etiquetas\/rollos\/:id\/revisiones"/);
  assert.match(route, /revisiones: parseReviewHistory\(row\.revisiones\)/);
});

test("labels page opens with pending controls and refreshes all affected caches", () => {
  assert.match(page, /useState\(initialTab === "buscar"\)/);
  assert.match(page, /pendientesRevision: pendingOnly \? "true" : undefined/);
  assert.match(page, /Marcar revisado/);
  assert.match(page, /ultimaReimpresionId: rollo\.ultimaReimpresionId/);
  assert.match(page, /queryClient\.invalidateQueries\(\{ queryKey: \["etiquetas"\] \}\)/);
  assert.match(page, /queryKey: \["etiquetas", "rollo", rollo\.id\]/);
  assert.match(page, /refetchInterval: pendingOnly \? 30_000 : false/);
});

test("rollo page exposes all 50-row pages and resets selection", () => {
  assert.match(route, /pageSize: z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(50\)/);
  assert.match(route, /OFFSET \$\{\(q\.page - 1\) \* q\.pageSize\}/);
  assert.match(page, /const ROLLOS_PAGE_SIZE = 50/);
  assert.match(page, /setRollosPage\(1\)[\s\S]*setSelected\(new Map\(\)\)/);
  assert.match(page, /Mostrando .* de/);
  assert.match(page, /Página \{rollosPage\} de \{totalRollosPages\}/);
  assert.match(page, /A anterior|Anterior/);
  assert.match(page, /Siguiente/);
  assert.match(page, /rollosPage <= totalRollosPages/);
});

test("OpenAPI exposes the review and historical response fields", () => {
  assert.match(apiSpec, /\/etiquetas\/rollos\/\{id\}\/revisar:/);
  assert.match(apiSpec, /\/etiquetas\/rollos\/\{id\}\/revisiones:/);
  assert.match(apiSpec, /ultimaReimpresionId/);
  assert.match(apiSpec, /revisadoEn/);
});

test("OpenAPI exposes validated rollo pagination", () => {
  assert.match(apiSpec, /name: page,/);
  assert.match(apiSpec, /name: pageSize,[\s\S]*maximum: 50/);
  assert.match(apiSpec, /required: \[items, limit, page, pageSize, total\]/);
});