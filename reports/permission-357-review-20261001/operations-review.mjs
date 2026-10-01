// Offline evidence generation only: reads retained sources/matrices; writes this report directory.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
const out = "reports/permission-357-review-20261001";
const apiMapPath = "artifacts/api-server/dist-driver-phones-20261001/index.mjs.map";
const apiFrozen = "reports/driver-multiple-phones-20261001/frozen-root";
const uiFrozen = "reports/sidebar-order-20261001/frozen-root";
const sha = s => crypto.createHash("sha256").update(s).digest("hex");
const read = p => fs.readFileSync(p, "utf8");
const excluded = "auditoria,caja_abonos,camionetas,choferes,clientes,clientes_credito,clientes_finanzas,clientes_precios,clientes_recapturas,cobros_pagos,conciliacion,cortes,dashboard,entradas,equipos,etiquetas".split(",");
const populationPath = "reports/trabajo-nocturno-20260925/tarea-7/owner-357.csv";
const matrixPath = "reports/tanda-f/tarea-4/effective-matrices.json";
const allRows = read(populationPath).trim().split(/\r?\n/).slice(1).map(l => {
  const [id,role,module,action,field] = l.slice(1,-1).split('","');
  return {id,role,module,action,field};
});
const rows = allRows.filter(r => !excluded.includes(r.module));
if (allRows.length !== 357 || rows.length !== 178) throw Error("Population changed");
const matrix = JSON.parse(read(matrixPath));
const sourceMap = JSON.parse(read(apiMapPath));
const sources = [];
sourceMap.sources.forEach((s,i) => {
  const p = path.relative(process.cwd(), path.resolve(path.dirname(apiMapPath),s));
  if (!p.includes("node_modules") && sourceMap.sourcesContent[i] != null)
    sources.push({kind:"api-active-sourcemap",file:p,text:sourceMap.sourcesContent[i],citation:`${apiMapPath}#sources[${i}] (${p})`});
});
function walk(d) {
  for (const e of fs.readdirSync(d,{withFileTypes:true})) {
    const f = `${d}/${e.name}`;
    if (e.isDirectory()) walk(f);
    else if (/\.(ts|tsx|js|mjs)$/.test(f)) sources.push({kind:"ui-active-frozen",file:f.slice(uiFrozen.length+1),text:read(f),citation:f});
  }
}
walk(`${uiFrozen}/artifacts/mariana-textil/src`);
const operational = sources.filter(s => !/(\.test\.|\.contract\.|\/observable-test\/|\/render-test|\/behavior-)/.test(s.file));
const modules = [...new Set(rows.map(r=>r.module))];
const lineHits = (s,re) => s.text.split("\n").flatMap((text,i) => re.test(text) ? [{citation:`${s.citation}:${i+1}`,line:i+1,text}] : []);
const permissionPattern = /requierePermiso|resolvePermiso|hasPermission|allowedModule|allowedAction|allowedAnyModules|puedeVer|puedeCrear|puedeEditar|puedeAutorizar|permission\(|check\.modulo|check\.accion|router\.use\(|app\.use\(/;
const globalPermissionGrep = operational.flatMap(s=>lineHits(s,permissionPattern));
const moduleEvidence = Object.fromEntries(modules.map(m => [m, operational.flatMap(s => lineHits(s,new RegExp(`\\b${m}\\b|Modules\\.${m.toUpperCase()}\\b`)))]));
const manifest = sources.map(s=>{
  const current = fs.existsSync(s.file) ? read(s.file) : null;
  let head = null;
  try { head = execFileSync("git", ["show", `HEAD:${s.file}`], {encoding:"utf8",stdio:["ignore","pipe","ignore"],maxBuffer:10*1024*1024}); } catch {}
  const frozenFile = s.kind.startsWith("api") ? `${apiFrozen}/${s.file}` : `${uiFrozen}/${s.file}`;
  return {file:s.file,kind:s.kind,citation:s.citation,sha256:sha(s.text),
    frozenPath:fs.existsSync(frozenFile)?frozenFile:null,
    frozenMatchesActive:fs.existsSync(frozenFile)?sha(read(frozenFile))===sha(s.text):null,
    headWorkingTreeSha256:current===null?null:sha(current),
    matchesHeadWorkingTree:current===null?null:sha(current)===sha(s.text),
    gitHeadSha256:head===null?null:sha(head),
    matchesGitHead:head===null?null:sha(head)===sha(s.text),
    permissionLinesActiveVsGitHead:head!==null&&sha(head)!==sha(s.text)?{
      active:s.text.split("\n").flatMap((text,i)=>permissionPattern.test(text)?[{line:i+1,text}]:[]),
      gitHead:head.split("\n").flatMap((text,i)=>permissionPattern.test(text)?[{line:i+1,text}]:[])
    }:null};
});
const api = f => {
  const s=sources.find(s=>s.kind.startsWith("api") && s.file===`artifacts/api-server/src/${f}`);
  if(!s) throw Error(`Missing map source ${f}`);
  return s;
};
const cite = (f,start,end=start) => `${api(f).citation}:${start}-${end}`;
const uic = (f,start,end=start) => `${uiFrozen}/artifacts/mariana-textil/src/${f}:${start}-${end}`;
const rationales = {
  marcar_remate:"Marcar remate sí existe, pero el adaptador consulta exclusivamente marcar_remate.puedeAutorizar. Consultar el rollo usa inventario:ver y quitar marca exige ADMIN; no consume ver/crear/editar de marcar_remate.",
  pos:"POS opera con ver/crear. El wrapper requiereAlguno sólo acepta ver|crear. Editar o autorizar tickets, devoluciones/caja no equivale a consumir pos:editar/autorizar.",
  movimientos:"Kardex y documentos consultan movimientos:ver. Ajustar/revisar/revertir se gobierna por ajustes:crear/autorizar u otras celdas, no por crear/editar/autorizar de movimientos.",
  inventario:"Inventario consulta con ver y cambia rollos/mínimos con editar. Crear entradas, salidas y ajustes usa sus módulos; no consume inventario:crear/autorizar.",
  productos:"El catálogo tiene ver/crear/editar, sin autorización separada productos:autorizar.",
  precios:"Consulta precios:ver y cambios simples/masivos/venta por metro precios:editar. POST no significa precios:crear; no existe guard precios:autorizar.",
  ajustes:"Ajustes usa crear para ajustar y autorizar para revisar/revertir; no existe operación de edición independiente ajustes:editar.",
  proveedores:"Catálogo usa ver/crear/editar; las autorizaciones financieras consultan proveedores_finanzas:autorizar, no proveedores:autorizar.",
  proveedores_finanzas:"Finanzas del proveedor usa ver/crear/autorizar; sus pagos/reversiones no consumen editar. El wrapper de pagos dirigidos escoge cliente/proveedor pero lee puedeCrear.",
  ubicaciones:"Sitios y pisos usan ver/crear/editar. No se consume ubicaciones:autorizar.",
  usuarios:"Usuarios usa ver/crear/editar. Invariantes de recuperación ADMIN no son usuarios:autorizar.",
  permisos:"El editor administra matrices con permisos:ver/editar. Validar cualquier columna del módulo editado para evitar escalación no constituye una operación permisos:crear/autorizar.",
  resumen_caja:"Resumen y lista de ventas consumen resumen_caja:ver. Escrituras de caja/ventas usan otros módulos; no crear/editar/autorizar de resumen_caja.",
  reportes:"Reportes se protege por reportes:ver, con gates de rol ADMIN para operaciones de control. Generar/exportar reporte no consume crear/editar/autorizar.",
  viajes:"Viajes sólo expone catálogo/elegibles, creación y consulta con ver/crear. No hay guard viajes:editar/autorizar.",
  salidas_venta:"Venta desde salida usa salidas_venta:ver/crear. Editar salida pertenece a salidas:editar; no a salidas_venta:editar/autorizar."
};
const filesByModule = {
  marcar_remate:["lib/tarea4-remate-store.ts","lib/tarea4-remate.ts","routes/inventario.ts"],
  pos:["routes/pos.ts"],movimientos:["routes/inventario.ts"],inventario:["routes/inventario.ts","routes/stock-minimos.ts"],
  productos:["routes/productos.ts"],precios:["routes/precios.ts"],ajustes:["routes/inventario.ts"],
  proveedores:["routes/proveedores.ts"],proveedores_finanzas:["routes/proveedores.ts","routes/pagos-dirigidos.ts"],
  ubicaciones:["routes/locations.ts"],usuarios:["routes/users.ts"],permisos:["routes/permisos.ts"],
  resumen_caja:["routes/caja-ventas.ts"],reportes:["routes/reportes.ts"],viajes:["routes/viajes.ts"],salidas_venta:["routes/salidas.ts"]
};
const removal = "A significa celda sin consumidor operacional en estas fuentes, no permiso global eliminable. Se puede proponer ocultarla/deshabilitarla como no aplicable en el editor mediante cambio futuro revisado; no se modificó nada. No borrar columnas puedeVer/Crear/Editar/Autorizar: son compartidas por otros módulos. Tampoco borrar la fila del módulo: contiene acciones usadas. La eliminación literal de la celda requiere rediseñar matriz rectangular/catálogo de capacidades, migrar matrices rol/usuario/ubicación (preservar null=heredar), defaults/seeds, resolver, API/OpenAPI/clientes y editor; versionar contrato y probar recuperación ADMIN/antiescalación y rollback.";
const historical = "La lista histórica deriva de NO_OPERATION_FOUND_STATIC → OWNER_SEMANTICS_REQUIRED; el mapper buscaba guards directos por celda. Ese estado no demostraba inexistencia ni atribuía una operación al nombre de acción. Esta revisión sustituye la pregunta al dueño para A por análisis de consumidor. No se ejecutaron APIs ni se leyó BD.";
const labels = {ver:"Consultar",crear:"Crear",editar:"Editar",autorizar:"Autorizar"};
const items = [...new Set(rows.map(r=>`${r.module}:${r.action}`))].map(key=>{
  const [module,action]=key.split(":");
  const rr=rows.filter(r=>r.module===module && r.action===action);
  const c=key==="ajustes:ver";
  const roles=Object.values(matrix).map(m=>{
    const p=m.permissions.find(p=>p.modulo===module);
    return {role:m.role,value:p?.[rr[0].field]??null};
  });
  const relevant=filesByModule[module].map(api);
  const apiGuardCitations=relevant.flatMap(s=>lineHits(s,permissionPattern));
  const exactApiGuards=operational.filter(s=>s.kind.startsWith("api")).flatMap(s=>{
    const re=new RegExp(`requierePermiso\\(\\s*["']${module}["']\\s*,\\s*["']${action}["']\\s*\\)`,"g");
    return [...s.text.matchAll(re)].map(m=>`${s.citation}:${s.text.slice(0,m.index).split("\n").length}`);
  });
  return {key,module,action,label:`${labels[action]} · ${module.replaceAll("_"," ")}`,category:c?"C":"A",ids:rr.map(r=>r.id),
    rolesGrantedHistorical:roles.filter(r=>r.value===true).map(r=>r.role),
    rolesDeniedHistorical:roles.filter(r=>r.value===false).map(r=>r.role),
    rolesUnknownHistorical:roles.filter(r=>r.value===null).map(r=>r.role),
    populationRoles:rr.map(r=>r.role),matrixSource:matrixPath,
    rationale:c?"La UI activa consume ajustes:ver por ProtectedRoute y navegación, pero ninguna API observada verifica esa celda. Es C por consumidor UI omitido; NO implica que exista prueba API exacta posible hoy. La página carga rollos con inventario:ver, movimiento con movimientos:ver y pendientes con ajustes:autorizar.":rationales[module],
    historicalWhy:c?"El mapper histórico registraba llamadas hasPermission pero no conectaba allowedModule={Modules.AJUSTES} con allowedAction por defecto ver en ProtectedRoute; además no había guard directo ajustes:ver en API.":historical,
    citations:{apiGuards:apiGuardCitations,moduleAllOccurrencesEvidence:`chunk-operations-evidence.json#/moduleEvidence/${module}`,
      ui:c?[uic("App.tsx",117,133),uic("App.tsx",201,206),uic("App.tsx",444,452),uic("components/layout/app-navigation.ts",66),uic("pages/ajustes.tsx",49,68),uic("pages/ajustes.tsx",99,120)]:[],
      mounts:[cite("app.ts",57),cite("routes/index.ts",68,100)]},
    negativeConsumerProof:c?null:{exactLiteralApiGuards:exactApiGuards,completeModuleGrep:`chunk-operations-evidence.json#/moduleEvidence/${module}`,completePermissionGrep:"chunk-operations-evidence.json#/globalPermissionGrep",scope:"Todos los sourcesContent locales del sourcemap API activo y todos los TS/TSX/JS/MJS UI frozen; pruebas excluidas de consumidores pero incluidas en manifest. Se examinaron wrappers computados, resolución indirecta y guards de rutas. Sin consumidor operacional de esta pareja.",genericExclusions:["columnas de matriz y defaults ADMIN","editor genérico de permisos y validación antiescalación","tipos/contrato/semillas","acción del mismo nombre en otro módulo"]},
    endpointFixtureForC:c?{uiRoute:"/inventario/ajustes",endpoints:["GET /api/inventario/rollos — inventario:ver, no ajustes:ver","GET /api/inventario/movimientos/:id — movimientos:ver, no ajustes:ver","GET /api/inventario/ajustes/pendientes — ajustes:autorizar, no ajustes:ver"],fixture:"Usuario no ADMIN con sesión y sitio/equipo válidos, rol no bloqueado por E11; dos variantes idénticas salvo ajustes.puedeVer true/false, permisos de lectura dependientes constantes; rollo accesible y movimiento real de fixture aislado. Comprobar navegación/ruta UI visible/denegada y registrar consultas. Variar sólo ajustes:ver no debe presentarse como denegación API exacta: no existe guard observado; para cubrir esa celda por API se necesitaría cambio explícito del contrato/gate, fuera de este reporte.",executed:false}:null,
    safeRemoval:c?"No retirar: consumidor UI real. Resolver la brecha de cobertura API sin atribuir guard de otro permiso.":removal,ownerDecisionRequired:false};
});
const counts={pairs:items.length,ids:rows.length,byCategory:Object.fromEntries(["A","B","C"].map(c=>[c,{pairs:items.filter(i=>i.category===c).length,ids:items.filter(i=>i.category===c).flatMap(i=>i.ids).length}]))};
if(items.length!==31 || new Set(items.flatMap(i=>i.ids)).size!==178) throw Error("Coverage mismatch");
const evidence = {scope:"Read-only offline report; no DB/API/browser/workflow execution.",apiMapPath,uiFrozen,manifest,
  gitHeadCommit:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),
  gitHeadDifferenceFiles:manifest.filter(m=>m.matchesGitHead===false),
  headDifferenceFiles:manifest.filter(m=>m.matchesHeadWorkingTree===false),
  globalPermissionGrep,moduleEvidence,
  computedWrappersReviewed:[
    {citations:[cite("routes/pos.ts",175,220)],finding:"requiereAlguno acepta sólo ver|crear; no pos editar/autorizar."},
    {citations:[cite("lib/tarea4-remate-store.ts",13,22)],finding:"resolvePermiso marcar_remate seguido de puedeAutorizar; no tres celdas revisadas."},
    {citations:[cite("routes/pagos-dirigidos.ts",270,280),cite("routes/pagos-dirigidos.ts",310,320)],finding:"Módulo computado CLIENTE/PROVEEDOR, sólo ver/crear; no proveedores_finanzas editar."},
    {citations:[cite("routes/permisos.ts",111,154)],finding:"Edición de matriz y antiescalación dinámica excluidas como consumidor operacional; requiere permisos editar."},
    {citations:[cite("routes/index.ts",53,67)],finding:"Wrapper createE3Router recibe requierePermiso; sólo módulos E3 ajenos a este alcance. E11 outer boundary no prueba acción."},
    {citations:[uic("App.tsx",117,133),uic("App.tsx",201,206),uic("lib/permisos.ts",53,76)],finding:"ProtectedRoute convierte allowedModule/allowedAnyModules y default allowedAction=ver en hasPermission; rescata ajustes:ver."}
  ],
  structuralRemovalCitations:sources.filter(s=>s.file==="lib/db/src/schema/permisos.ts"||s.file==="artifacts/api-server/src/lib/permisos.ts"||s.file==="artifacts/api-server/src/routes/permisos.ts").flatMap(s=>lineHits(s,/puedeVer|puedeCrear|puedeEditar|puedeAutorizar|pgTable|inherit|hered|boolean/)),
  historicalCitations:["reports/tanda-g-ampliada/task1/static-map.mjs:31-48 (callees analizados)","reports/tanda-g-ampliada/task1/summarize-runtime.mjs:20","reports/trabajo-nocturno-20260925/tarea-7/matrix-audit.mjs:16-18,50-58"]};
const report = {title:"Revisión permisos — operaciones restantes",population:"178 IDs exactos de owner-357.csv (subconjunto de 357), 31 parejas. Matriz histórica, NO permisos actuales de BD.",sources:{populationPath,matrixPath,apiMapPath,apiMapSha256:sha(read(apiMapPath)),uiFrozen},counts,exactIds:rows.map(r=>r.id),items,
  qualifications:["Clasificación estática del consumidor, no cobertura ejecutada ni prueba de seguridad.", "B=0: no decisiones al dueño en este chunk.", "C ajustes:ver tiene consumidor UI sin guard API exacto; incertidumbre de ejecución explicitada, no se fuerza una prueba API ficticia.", "A sólo autoriza conclusión de no uso operacional observado; NO eliminación literal sin migraciones.", "Fuente activa identificada por artifacts/*/.replit-artifact/artifact.toml y hashes/build retenidos; no se inspeccionaron workflows ni logs. El build-manifest UI conserva estado histórico NOT_ACTIVATED: la configuración actual apunta al dist-sidebar-order, por eso prevalece sobre ese estado anterior."],
  evidenceFile:"chunk-operations-evidence.json",headComparison:"chunk-operations-evidence.json#/manifest (hash activo/frozen/HEAD working tree; diferencias detalladas por archivo)",safeRemoval:removal};
fs.writeFileSync(`${out}/chunk-operations-evidence.json`,JSON.stringify(evidence,null,2)+"\n");
fs.writeFileSync(`${out}/chunk-operations.json`,JSON.stringify(report,null,2)+"\n");
const md = [`# Operaciones restantes — revisión de las 357 celdas`,
  `\n**Alcance:** ${counts.ids} IDs exactos, ${counts.pairs} parejas. Matriz **histórica** ${matrixPath}; no consulta de BD actual.`,
  `\n**Resultado:** A ${counts.byCategory.A.pairs} parejas / ${counts.byCategory.A.ids} IDs; B 0; C ${counts.byCategory.C.pairs} pareja / ${counts.byCategory.C.ids} IDs.`,
  `\nFuente API: ${apiMapPath} (sourcesContent activo). UI: ${uiFrozen}. Evidencia negativa íntegra, wrappers, hashes y comparación HEAD: chunk-operations-evidence.json. ${manifest.filter(m=>m.matchesHeadWorkingTree===false).length} archivos escaneados difieren de HEAD working tree; no se usó HEAD para atribuir consumidores.`,
  `\n## Resultado por pareja\n\n| Acción | Cat. | Concedido históricamente | Denegado históricamente | IDs |\n|---|---|---|---|---|`,
  ...items.map(i=>`| ${i.label} | ${i.category} | ${i.rolesGrantedHistorical.join(", ")} | ${i.rolesDeniedHistorical.join(", ")} | ${i.ids.length} |`),
  `\n## Razonamiento y citas`,
  ...items.map(i=>`\n### ${i.key} — ${i.category}\n${i.rationale}\n\nPor qué quedó sin identificar: ${i.historicalWhy}\n\nCitas API: ${i.citations.apiGuards.map(c=>c.citation).join("; ")}.\n${i.citations.ui.length?`Citas UI: ${i.citations.ui.join("; ")}.\n`:""}Prueba completa: ${i.citations.moduleAllOccurrencesEvidence}; grep global y revisión de wrappers en evidencia. Guards API literales exactos: ${i.negativeConsumerProof?.exactLiteralApiGuards.length??"no aplicable"}.\n\n${i.endpointFixtureForC?`Endpoints y fixture: ${JSON.stringify(i.endpointFixtureForC)}\n`:""}IDs: ${i.ids.map(x=>`\`${x}\``).join(", ")}.`),
  `\n## Retirada segura\n${removal}\n\nNo se requieren decisiones del dueño para A. No hay B. C no debe retirarse ni confundirse con una celda cubierta por API. Toda evidencia es estática; sin llamadas reales ni fixtures creados.`,
  `\n## Comparación fuentes activas / HEAD\nSe conserva cada hash en manifest de chunk-operations-evidence.json. Diferencias entre API frozen y sourcesContent se registran también: el sourcemap tiene precedencia. Los paths/líneas API en las citas corresponden al texto retenido en sourcesContent, no al HEAD.`,
  `\nSe comparó además git HEAD real ${evidence.gitHeadCommit}: ${evidence.gitHeadDifferenceFiles.length} archivos distintos y ${manifest.filter(m=>m.gitHeadSha256===null).length} ausente en HEAD. El JSON conserva líneas de permisos y montajes activas frente a git HEAD por archivo diferente. Los archivos operacionales de guards centrales y App.tsx no cambiaron; routes/index.ts sí difiere y se conservan sus montajes activos. Se revisó la configuración actual de artifact; no se inspeccionaron workflows/logs. El estado NOT_ACTIVATED del build-manifest es histórico y no sustituye el comando actual configurado.`,
  ...manifest.filter(m=>m.matchesHeadWorkingTree===false).map(m=>`- ${m.file}: activo ${m.sha256}; HEAD working tree ${m.headWorkingTreeSha256}; fuente ${m.kind}.`),
  `\n## Cobertura exacta (178 IDs)\n${rows.map(r=>`- ${r.id}`).join("\n")}\n`].join("\n");
fs.writeFileSync(`${out}/chunk-operations.md`,md);
console.log(JSON.stringify(counts));