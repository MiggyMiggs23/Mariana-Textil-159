// Report-only reproducible source audit. No network, database or application execution.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
const out = "reports/permission-357-review-20261001";
const apiMap = "artifacts/api-server/dist-driver-phones-20261001/index.mjs.map";
const apiFrozen = "reports/driver-multiple-phones-20261001/frozen-root";
const uiFrozen = "reports/sidebar-order-20261001/frozen-root";
const modules = "auditoria,caja_abonos,camionetas,choferes,clientes,clientes_credito,clientes_finanzas,clientes_precios,clientes_recapturas,cobros_pagos,conciliacion,cortes,dashboard,entradas,equipos,etiquetas".split(",");
const csvPath = "reports/trabajo-nocturno-20260925/tarea-7/owner-357.csv";
const matrixPath = "reports/tanda-f/tarea-4/effective-matrices.json";
const historicalPath = "reports/tanda-g-ampliada/task1/runtime-cell-classification.json";
const rows = fs.readFileSync(csvPath, "utf8").trim().split("\n").slice(1).map(l => {
  const [id, role, module, action, field] = l.replace(/\r$/, "").slice(1, -1).split('","');
  return { id, role, module, action, field };
}).filter(r => modules.includes(r.module));
const matrix = JSON.parse(fs.readFileSync(matrixPath));
const historical = JSON.parse(fs.readFileSync(historicalPath));
const map = JSON.parse(fs.readFileSync(apiMap));
const sha = s => crypto.createHash("sha256").update(s).digest("hex");
const sources = [];
for (let i = 0; i < map.sources.length; i++) {
  const name = map.sources[i];
  if (!map.sourcesContent[i] || name.includes("node_modules") || !name.includes("/src/")) continue;
  const normalized = name.startsWith("../src/") ? `artifacts/api-server/${name.slice(3)}` :
    name.includes("lib/") ? name.slice(name.indexOf("lib/")) : name;
  sources.push({ kind: "API", file: normalized, original: name, text: map.sourcesContent[i] });
}
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() && d.name !== "node_modules" ? walk(path.join(dir, d.name)) : d.isFile() && /\.(tsx?|mjs)$/.test(d.name) ? [path.join(dir, d.name)] : []);
}
for (const file of walk(`${uiFrozen}/artifacts/mariana-textil/src`)) {
  sources.push({ kind: "UI", file: file.slice(uiFrozen.length + 1), original: file, text: fs.readFileSync(file, "utf8") });
}
const ignored = s => /(?:\.test\.|test-harness|test-fixture|\/generated\/|\/observable-test\/|render-test|contract.test)/.test(s.file);
const evidence = {};
const comparisons = [];
const relevant = new Set();
for (const module of modules) {
  // Exhaustive lexical module search, including enum spelling. Output retains false positives deliberately.
  const re = new RegExp(`\\b(?:${module}|${module.toUpperCase()})\\b`, "i");
  evidence[module] = [];
  for (const s of sources) {
    const lines = s.text.split("\n");
    const hits = [];
    lines.forEach((line, i) => {
      if (re.test(line)) hits.push({ line: i + 1, text: line, context: lines.slice(Math.max(0, i - 2), i + 3).join("\n") });
    });
    if (hits.length) {
      evidence[module].push({ kind: s.kind, file: s.file, nonOperationalCorpus: ignored(s), hits });
      relevant.add(s);
    }
  }
}
// Guard inventory is independent of module-name matching; includes dynamic module/action callsites.
const guardInventory = sources.filter(s => !ignored(s)).flatMap(s => s.text.split("\n").flatMap((line, i) =>
  /requierePermiso|resolvePermiso|hasPermission|deps\.permission|requirePermission|allowedModule|allowedAnyModules|allowedAction|puedeVer|puedeCrear|puedeEditar|puedeAutorizar/.test(line)
    ? [{ kind: s.kind, file: s.file, line: i + 1, text: line }] : []));
for (const s of relevant) {
  if (ignored(s)) continue;
  const frozenPath = `${s.kind === "API" ? apiFrozen : uiFrozen}/${s.file}`;
  const frozenText = fs.existsSync(frozenPath) ? fs.readFileSync(frozenPath, "utf8") : null;
  const working = fs.existsSync(s.file) ? fs.readFileSync(s.file, "utf8") : null;
  let head = null;
  try { head = execFileSync("git", ["show", `HEAD:${s.file}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch {}
  const changedLines = other => {
    if (other === null) return { missing: true };
    const a = s.text.split("\n"), b = other.split("\n");
    return { activeLines: a.length, comparedLines: b.length,
      differences: a.flatMap((line, i) => line === b[i] ? [] : [{ line: i + 1, active: line, compared: b[i] ?? null }]),
      trailingComparedLines: b.slice(a.length) };
  };
  comparisons.push({ kind: s.kind, file: s.file, activeSha256: sha(s.text),
    frozenMatchesActive: frozenText === s.text,
    workingTreeMatchesActive: working === s.text, gitHEADMatchesActive: head === s.text,
    workingTreeDelta: working === s.text ? null : changedLines(working),
    gitHEADDelta: head === s.text ? null : changedLines(head) });
}
const notes = {
  dashboard: ["Sólo lectura del tablero; crear, editar y autorizar no son operaciones de este módulo.", ["API routes/dashboard.ts:12-15", "UI App.tsx:260-269"]],
  entradas: ["Las altas y modificaciones usan entradas.crear/editar. No confundir autorizar con validaciones de la entrada o autorización bajo otro módulo.", ["API routes/inventario.ts:770,972,1237,1331", "UI pages/entradas.tsx:203"]],
  etiquetas: ["Imprimir usa crear; configuración usa editar; historial usa sesión/otras condiciones. Ninguna autorización consume etiquetas.autorizar.", ["API routes/etiquetas.ts:183,325,561,675-734", "UI pages/etiquetas.tsx:60", "UI components/reprint-labels-dialog.tsx:83"]],
  clientes: ["El directorio consume ver/crear/editar. Ajustes financieros son clientes_finanzas.autorizar, no clientes.autorizar.", ["API routes/clientes.ts:635,683,1079,2372,2472", "UI pages/cliente-detail.tsx:337-344"]],
  clientes_credito: ["Consulta usa ver y cambio de límite usa editar. Crear crédito no selecciona crear/autorizar de esta celda.", ["API routes/clientes.ts:1007,1017,1189,1259", "UI pages/cliente-detail.tsx:337,343"]],
  clientes_precios: ["Pestaña de precios del cliente es lectura (ver). Los cambios de precios en otro módulo no consumen clientes_precios.crear/editar/autorizar.", ["API routes/clientes.ts:1318", "UI pages/cliente-detail.tsx:338"]],
  clientes_finanzas: ["Las operaciones financieras consumen ver, crear o autorizar; ninguna selecciona editar. El nombre editar de una pantalla no acredita esta celda.", ["API routes/clientes.ts:2109,2166,2372,2472", "UI pages/cliente-detail.tsx:339-342"]],
  caja_abonos: ["E3 usa crear, incluso para contexto; E5 lee ver/crear. E5 autorizar usa reglas de actor/rol, no caja_abonos.autorizar. Serializar las cuatro banderas en clave de caché no convierte editar/autorizar en permisos de operación.", ["API routes/e3-collections.ts:25,45-50", "API routes/e5.ts:18-34", "UI lib/e5-authorization.ts:5-22"]],
  clientes_recapturas: ["El bucle E3 enlaza module=clientes_recapturas con acción crear en ambas rutas. Recibos exigen ADMIN, no ver/editar/autorizar de recapturas.", ["API routes/e3-collections.ts:45-50,52-75", "UI pages/cliente-detail.tsx:345"]],
  cortes: ["Ver/crear controlan cortes. Revisiones y entregas no seleccionan editar/autorizar. El wrapper E4 sólo admite ver|crear y puede elegir otro módulo.", ["API routes/pos.ts:1022-1127", "API lib/e4-cash-out.ts:5-12", "API routes/e9.ts:18-19", "UI components/e9-entregas-panel.tsx:26"]],
  cobros_pagos: ["Wrapper E4 elige cobros_pagos o cortes, pero sólo ver/crear. No deriva editar/autorizar del nombre de la operación. E5 decide autorizaciones por rol, no por esta celda.", ["API lib/e4-cash-out.ts:5-12", "API routes/pos.ts:1070-1085,1127", "UI App.tsx:559-581"]],
  conciliacion: ["Consulta consume ver y reconstrucción autorizar; no crear/editar. Conciliaciones E11 usan FISCAL_CONCILIAR, permiso distinto.", ["API routes/inventario.ts:2458,2484-2489", "API routes/e11.ts:117-131", "UI App.tsx:700"]],
  auditoria: ["Bitácora sólo consume auditoria.ver. Auditorías de inventario tienen módulo auditoria_inventario; sus crear/editar/autorizar NO son estas celdas.", ["API routes/auditoria.ts:20-26", "API routes/auditorias-inventario.ts:172,252,314-315", "UI App.tsx:404,709"]],
  camionetas: ["Wrapper requiereGestorCamionetas recibe crear/editar; no autorizar. Roles gestores adicionales no son consumo de autorizar.", ["API routes/camionetas.ts:35-38,65,111", "UI pages/configuracion/camionetas.tsx:58"]],
  choferes: ["Wrapper de gestores consume crear/editar. No hay llamada con autorizar, aunque existan restricciones por rol.", ["API routes/choferes.ts:64-67,87,155", "UI pages/configuracion/choferes.tsx:73-75"]],
  equipos: ["Alta usa crear y cambios/desactivación editar; ninguna operación selecciona equipos.autorizar.", ["API routes/equipos.ts:208,242,276,352,470", "UI pages/equipos/index.tsx:64-65"]],
};
const actions = { ver: "Consultar", crear: "Crear", editar: "Modificar", autorizar: "Autorizar" };
const safe = "Sin consumidores operativos de la celda encontrados en los corpus activos auditados: candidata a marcar no aplicable/obsoleta, NO a borrar literalmente una columna. El contrato ModulePermission/AccionPermiso, resolución y matrices rol/usuario/ubicación comparten las cuatro acciones. Retirar representación o semántica requiere diseño de capacidades aplicables por módulo, migraciones de datos/esquema si corresponde, actualización de API/OpenAPI, tipos/clientes/editor, herencia y pruebas de compatibilidad; preservar historial. No se ha cambiado nada.";
const items = [...new Set(rows.map(r => `${r.module}:${r.action}`))].map(key => {
  const rr = rows.filter(r => `${r.module}:${r.action}` === key);
  const { module, action, field } = rr[0];
  const c = key === "caja_abonos:ver";
  const grants = Object.values(matrix).map(m => ({ role: m.role, auditedUserId: m.id, value: m.permissions.find(p => p.modulo === module)?.[field] ?? null }));
  return { key, module, action, label_es: c ? "Consultar cobros pendientes E5 desde Caja" : `${actions[action]} — ${module.replaceAll("_", " ")}`,
    category: c ? "C" : "A", categoryMeaning: c ? "Uso operativo API y UI que el mapeo histórico no identificó" : "Celda sin consumidor operativo identificado (no aplicable/obsoleta)",
    exactOwnerCellIds: rr.map(r => r.id), historicalMatrix: grants,
    rolesGranted: grants.filter(g => g.value === true).map(g => g.role),
    rolesDenied: grants.filter(g => g.value === false).map(g => g.role),
    rolesUnknown: grants.filter(g => g.value === null).map(g => g.role),
    rationale: c ? "API resolvePermiso(caja_abonos) toma puedeVer y lo combina OR con clientes_finanzas.ver. UI e5CanRead itera E5_READ_MODULES con ver y E5Entry lo aplica. Es consumo real de esta celda, no sólo registro de módulo. Persisten restricciones por rol y alcance." : notes[module][0],
    citations: c ? ["API routes/index.ts:45,61", "API routes/e5.ts:18-34,50-77", "UI lib/e5-authorization.ts:5,19-22", "UI components/e5-pendientes.tsx:48,58,281", "UI pages/cobros.tsx:6,282", "UI pages/cliente-detail.tsx:636", "UI App.tsx:559-581", "API lib/e5-feature.ts:2", "UI lib/e5-feature-flags.ts:2"] : notes[module][1],
    negativeConsumerProof: c ? null : { file: "chunk-business-evidence.json", moduleIndex: module, fullGuardInventory: true, directAndComputedReviewed: true, exclusions: "Editor genérico, resolución de matrices, defaults ADMIN, contrato/tipos, cache keys y tests no son consumidores operativos de la acción. Inventario conserva estos hits para revisión; ausencia no se infiere de cero coincidencias de texto." },
    historicalReason: {
      evidence: rr.map(r => { const h = historical.find(h => h.id === r.id); return { id: r.id, priorStatus: h?.priorStatus, status: h?.status, directActionApiEvidence: h?.directActionApiEvidence, combinedActionCoverage: h?.combinedActionCoverage }; }),
      explanation: c ? "El histórico conserva NO_OPERATION_FOUND_STATIC/OWNER_SEMANTICS_REQUIRED sin enlace de API/UI. El acceso calculado resolvePermiso + puedeVer y E5_READ_MODULES.some no equivale a un literal requierePermiso(module,action). Es la explicación técnica del falso negativo; no consta traza histórica del parser para atribuir causalidad exacta." : "El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno."
    },
    endpointAndFixtureNeeded: c ? {
      endpoints: ["GET /api/e5/disponibilidad", "GET /api/e5/cobros", "GET /api/e5/contexto", "GET /api/e5/cobros/:id"],
      fixture: "Prueba futura aislada (no ejecutada): usuario activo CAJA/TERMINAL/SUPERVISOR, no ADMIN (bypass), rol permitido por E5, sitio y alcance válidos, sesión autenticada. Permisos efectivos clientes_finanzas.ver=false y caja_abonos.ver=true; para la navegación dar cobros_pagos.ver sin confundirlo con el control interno E5. Cobro E5 válido del sitio/cliente y capacidad/disponibilidad coherentes. Control negativo: cambiar sólo caja_abonos.ver=false manteniendo clientes_finanzas.ver=false, esperar 403 API y bloqueo E5Entry; positivo: true y respuesta/esquema correctos. Control OR: caja_abonos.ver=false/clientes_finanzas.ver=true debe seguir permitido. Montar /cobros, abrir listado E5, observar petición y resultado; listar/detalle deben respetar alcance. También comprobar roles excluidos CONTADOR/SISTEMAS/BODEGA. No se necesita dinero real ni DB real; repositorio fixture o DB aislada autorizada."
    } : null,
    removal: c ? "No retirar: consumidor real API/UI." : safe,
    ownerDecisionNeeded: false,
    uncertainty: "Análisis estático de fuentes activas y matriz histórica; no prueba runtime ni lectura de permisos actuales. Los posibles consumidores externos no incluidos en los corpus no pueden descartarse."
  };
});
const result = {
  scope: "Sólo informe; 16 módulos delegados; matriz histórica de población owner-357, NO permisos actuales.",
  sourceOfTruth: { api: apiMap, apiFrozen, ui: uiFrozen, activeApiProcess: "node artifacts/api-server/dist-driver-phones-20261001/index.mjs", activeUiPreview: "vite preview --outDir dist-sidebar-order-20261001", sourceMapSha256: sha(fs.readFileSync(apiMap)) },
  citationConvention: "API rutas relativas a artifacts/api-server/src dentro del sourcesContent del sourcemap activo; UI relativas a artifacts/mariana-textil/src dentro del frozen UI indicado. Nunca HEAD como verdad activa.",
  coverage: { modules, exactCellCount: rows.length, distinctModuleActions: items.length, ids: rows.map(r => r.id), categoryCells: Object.fromEntries(["A","B","C"].map(c => [c, items.filter(i => i.category === c).reduce((n,i) => n+i.exactOwnerCellIds.length, 0)])), categoryModuleActions: Object.fromEntries(["A","B","C"].map(c => [c, items.filter(i => i.category === c).length])) },
  genericContractCitations: ["API lib/permisos.ts:29-48,58-70,75-100,264+", "UI lib/permisos.ts:4-38,53-77"],
  method: "Inventario completo de referencias módulo/enum en todas las fuentes propias del bundle API y todos los TS/TSX activos UI. Inventario independiente de todas las llamadas de guardas y lecturas puede*. Revisión de bucles E3, wrapper E4, actor E5, gestores de camionetas/choferes, rutas montadas y helper UI. Comparación textual/hash de archivos relevantes contra frozen, árbol de trabajo y git HEAD. No se ejecutó aplicación, API, DB, pruebas ni workflows.",
  evidenceFile: "chunk-business-evidence.json",
  comparisonsFile: "chunk-business-head-comparison.json",
  comparisonSummary: { relevantFiles: comparisons.length, frozenApiMismatches: comparisons.filter(c => c.kind === "API" && !c.frozenMatchesActive).map(c => c.file), headDifferences: comparisons.filter(c => !c.gitHEADMatchesActive).map(c => ({ kind: c.kind, file: c.file })), workingTreeDifferences: comparisons.filter(c => !c.workingTreeMatchesActive).map(c => ({ kind: c.kind, file: c.file })) },
  items
};
fs.writeFileSync(`${out}/chunk-business-evidence.json`, JSON.stringify({ sourceFiles: sources.map(s => ({ kind: s.kind, file: s.file, sha256: sha(s.text), lines: s.text.split("\n").length })), moduleSearch: evidence, guardInventory }, null, 2));
fs.writeFileSync(`${out}/chunk-business-head-comparison.json`, JSON.stringify(comparisons, null, 2));
fs.writeFileSync(`${out}/chunk-business.json`, JSON.stringify(result, null, 2));
const md = [
  "# Revisión business — permisos 357 (histórico)",
  `Cobertura exacta: **${rows.length} IDs**, **${items.length} módulo/acción**, 16 módulos. A=${result.coverage.categoryCells.A} celdas; B=0; C=${result.coverage.categoryCells.C}.`,
  "No se modificaron código de aplicación, permisos, DB ni workflows; no se hicieron solicitudes a DB/API ni pruebas runtime. Los roles concedidos/denegados son exclusivamente los de effective-matrices.json histórico (incluye el usuario auditado), no inferencias sobre producción.",
  `Fuente API: ${apiMap}. Fuente UI: ${uiFrozen}. Las citas API/UI usan la convención documentada en JSON. Diferencias completas frente a HEAD/working tree en chunk-business-head-comparison.json; no se sustituyó evidencia activa por HEAD.`,
  `Comparación: ${comparisons.length} archivos relevantes, ${result.comparisonSummary.headDifferences.length} diferentes de git HEAD, ${result.comparisonSummary.workingTreeDifferences.length} diferentes del árbol de trabajo; ${result.comparisonSummary.frozenApiMismatches.length} discrepancias API sourcemap/frozen. Archivos distintos de HEAD: ${result.comparisonSummary.headDifferences.map(c => c.file).join("; ")}. No se atribuye automáticamente efecto sobre permisos a estas diferencias; la clasificación se hizo sobre el contenido activo.`,
  "## Criterio de evidencia negativa",
  result.method,
  "chunk-business-evidence.json conserva TODOS los hits por módulo y un inventario independiente de guardas, incluidos falsos positivos. Los registros de matriz, defaults ADMIN, editor genérico, tipos y cache keys no prueban una operación. Las acciones bajo otros módulos tampoco.",
  safe,
  ...items.flatMap(i => [
    `## ${i.key} — ${i.label_es} — ${i.category}`,
    `IDs exactos (${i.exactOwnerCellIds.length}): ${i.exactOwnerCellIds.join(", ")}.`,
    `Matriz histórica — concedido: ${i.rolesGranted.join(", ") || "ninguno"}; denegado: ${i.rolesDenied.join(", ") || "ninguno"}; desconocido: ${i.rolesUnknown.join(", ") || "ninguno"}.`,
    i.rationale,
    `Citas: ${i.citations.join("; ")}.`,
    `Motivo histórico: ${i.historicalReason.explanation}`,
    i.endpointAndFixtureNeeded ? `Endpoints: ${i.endpointAndFixtureNeeded.endpoints.join("; ")}. Fixture pendiente: ${i.endpointAndFixtureNeeded.fixture}` : `Prueba negativa completa: chunk-business-evidence.json → moduleSearch.${i.module}, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.`,
    "No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI."
  ]),
  "## Límites",
  "Ningún elemento se clasifica B en este bloque. No se declara ninguna prueba ejecutada. Las ausencias son de consumidores operativos internos en fuentes activas auditadas; contratos externos desconocidos impiden prometer eliminación universal segura. La causa interna del parser histórico no se puede demostrar sin su traza."
].join("\n\n");
fs.writeFileSync(`${out}/chunk-business.md`, md + "\n");
if (rows.length !== 179 || items.length !== 30 || new Set(rows.map(r => r.id)).size !== rows.length) throw Error("Cobertura inesperada");
console.log(JSON.stringify({ coverage: result.coverage.categoryCells, moduleActions: result.coverage.categoryModuleActions, comparisons: comparisons.length, apiFrozenMismatches: comparisons.filter(c => c.kind === "API" && !c.frozenMatchesActive).map(c => c.file) }, null, 2));