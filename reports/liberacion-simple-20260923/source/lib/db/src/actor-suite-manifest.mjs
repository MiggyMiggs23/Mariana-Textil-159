export const ACTOR_SUITE_GROUPS = Object.freeze({
  "grupo-1": Object.freeze([
    "artifacts/api-server/src/admin-alertas.integration.test.ts",
    "artifacts/api-server/src/admin-invariants.integration.test.ts",
    "artifacts/api-server/src/aplicaciones-pago-proveedor.integration.test.ts",
    "artifacts/api-server/src/auditoria.integration.test.ts",
    "artifacts/api-server/src/clientes-ajustes-api.test.ts",
    "artifacts/api-server/src/contenedores.integration.test.ts",
    "artifacts/api-server/src/cuadre-fiscal.integration.test.ts",
    "artifacts/api-server/src/equipos.integration.test.ts",
    "artifacts/api-server/src/etiquetas-api.integration.test.ts",
    "artifacts/api-server/src/inventory-six-view.integration.test.ts",
  ]),
  "grupo-2": Object.freeze([
    "artifacts/api-server/src/kardex-api.test.ts",
    "artifacts/api-server/src/lib/notificaciones-credito.test.ts",
    "artifacts/api-server/src/lib/permisos.test.ts",
    "artifacts/api-server/src/metered-reference-cost.integration.test.ts",
    "artifacts/api-server/src/pagos-dirigidos.integration.test.ts",
    "artifacts/api-server/src/pos-location-authorization.integration.test.ts",
    "artifacts/api-server/src/postgres-unique-concurrency.integration.test.ts",
    "artifacts/api-server/src/precios.integration.test.ts",
    "artifacts/api-server/src/productos-cache.integration.test.ts",
  ]),
  "grupo-3": Object.freeze([
    "artifacts/api-server/src/proveedores-alcance-fechas.integration.test.ts",
    "artifacts/api-server/src/reportes.integration.test.ts",
    "artifacts/api-server/src/role-access-matrix.integration.test.ts",
    "artifacts/api-server/src/productos-purge.integration.test.ts",
    "artifacts/api-server/src/security-api.test.ts",
    "artifacts/api-server/src/store-sales-global.integration.test.ts",
    "artifacts/api-server/src/task57.integration.test.ts",
    "artifacts/api-server/src/task58.integration.test.ts",
    "artifacts/api-server/src/viajes.integration.test.ts",
  ]),
});

export const ACTOR_SUITE_PATHS = Object.freeze(
  Object.values(ACTOR_SUITE_GROUPS).flat(),
);

if (ACTOR_SUITE_PATHS.length !== 28 ||
    new Set(ACTOR_SUITE_PATHS).size !== ACTOR_SUITE_PATHS.length) {
  throw new Error("El manifiesto Adaptación 28 debe contener exactamente 28 rutas únicas.");
}

export function selectActorSuites({ group, ids, all = false } = {}) {
  const modes = Number(Boolean(group)) + Number(Boolean(ids)) + Number(all);
  if (modes !== 1) {
    throw new Error("Selecciona exactamente uno de --actor-group, --actor-ids o --actor-all.");
  }
  if (all) return [...ACTOR_SUITE_PATHS];
  if (group) {
    const selected = ACTOR_SUITE_GROUPS[group];
    if (!selected) throw new Error(`Grupo actor desconocido: ${group}`);
    return [...selected];
  }
  const requested = String(ids).split(",").map(value => value.trim());
  if (requested.some(value => !value) || new Set(requested).size !== requested.length) {
    throw new Error("--actor-ids no admite rutas vacías ni duplicadas.");
  }
  const requestedSet = new Set(requested);
  const unknown = requested.filter(value => !ACTOR_SUITE_PATHS.includes(value));
  if (unknown.length) throw new Error(`Rutas actor desconocidas: ${unknown.join(", ")}`);
  const selected = ACTOR_SUITE_PATHS.filter(value => requestedSet.has(value));
  if (selected.length === 0) throw new Error("La selección actor no puede quedar vacía.");
  return selected;
}

export function actorSuiteManifestJson() {
  return `${JSON.stringify({
    version: 1,
    count: ACTOR_SUITE_PATHS.length,
    groups: ACTOR_SUITE_GROUPS,
    paths: ACTOR_SUITE_PATHS,
  }, null, 2)}\n`;
}