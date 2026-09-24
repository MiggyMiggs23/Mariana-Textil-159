import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

// Offline only: never connects to a database or starts an application.
const root = process.cwd();
const source = path.resolve(process.env.TASK1_SOURCE || root);
const out = path.join(root, 'reports/tanda-g-ampliada/task1');
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const baselineFile = 'reports/tanda-f/tarea-4/followup/combined-cell-classification.json';
const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
const residual = baseline.filter(c => !c.status.startsWith('DENIED'));
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(p)) files.push(p);
  }
}
walk(path.join(source, 'artifacts/api-server/src/routes'));
walk(path.join(source, 'artifacts/api-server/src/lib'));
walk(path.join(source, 'artifacts/api-server/src/middlewares'));
walk(path.join(source, 'artifacts/mariana-textil/src'));
const operations = [], consumers = [], ui = [], manifest = [];
for (const file of files.sort()) {
  const text = fs.readFileSync(file, 'utf8');
  const relative = path.relative(source, file);
  manifest.push({ file: relative, sha256: sha(text) });
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const cite = n => ({ file: relative, line: ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1 });
  const literal = n => n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null;
  function guardCalls(node) {
    const found = [];
    function visit(n) {
      if (ts.isCallExpression(n) && /^(requierePermiso|hasPermission|checkPermission)$/.test(n.expression.getText(ast))) {
        found.push({ ...cite(n), callee: n.expression.getText(ast),
          args: n.arguments.map(a => literal(a) ?? a.getText(ast)), literalArgs: n.arguments.map(literal) });
      }
      ts.forEachChild(n, visit);
    }
    visit(node);
    return found;
  }
  function visit(n) {
    if (ts.isCallExpression(n)) {
      const callee = n.expression.getText(ast);
      if (/^(requierePermiso|hasPermission|checkPermission)$/.test(callee)) {
        const item = { ...cite(n), callee, args: n.arguments.map(a => literal(a) ?? a.getText(ast)),
          literalArgs: n.arguments.map(literal) };
        (relative.includes('mariana-textil') ? ui : consumers).push(item);
      }
      if (ts.isPropertyAccessExpression(n.expression) &&
          /^(get|post|put|patch|delete|use)$/.test(n.expression.name.text) &&
          /router/i.test(n.expression.expression.getText(ast))) {
        const first = n.arguments[0];
        const paths = first && ts.isArrayLiteralExpression(first)
          ? first.elements.map(a => literal(a) ?? a.getText(ast))
          : [literal(first) ?? first?.getText(ast) ?? ''];
        for (const endpoint of paths) operations.push({
          ...cite(n), method: n.expression.name.text.toUpperCase(), endpoint,
          dynamicPath: !(literal(first) || (first && ts.isArrayLiteralExpression(first) && first.elements.every(a => literal(a)))),
          guards: guardCalls(n),
          middleware: n.arguments.slice(1).filter(a => !ts.isArrowFunction(a) && !ts.isFunctionExpression(a)).map(a => a.getText(ast)),
        });
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(ast);
}
// Explicitly reviewed action-parameter wrappers, not invented operations.
for (const operation of operations) {
  if (/\/routes\/(inventario|auditorias-inventario)\.ts$/.test(operation.file)) {
    operation.routerLocalPath = operation.endpoint;
    operation.endpoint = '/inventario' + operation.endpoint;
    operation.mountCitation = 'artifacts/api-server/src/routes/index.ts:77-78';
  }
  for (const module of ['camionetas', 'choferes']) {
    const wrapper = module === 'camionetas' ? 'requiereGestorCamionetas' : 'requiereGestorChoferes';
    for (const middleware of operation.middleware) {
      const action = middleware.match(new RegExp(`${wrapper}\\("(crear|editar)"\\)`))?.[1];
      if (action) operation.guards.push({ file: operation.file, line: operation.line,
        callee: wrapper, args: [module, action], literalArgs: [module, action],
        qualification: 'Reviewed wrapper forwards action to requierePermiso; role guard remains independent.' });
    }
  }
}
const matches = (guard, module, action) => guard.literalArgs[0] === module && guard.literalArgs[1] === action;
const groups = [...new Set(residual.map(c => `${c.module}.${c.action}`))].map(key => {
  const [module, action] = key.split('.');
  const cells = residual.filter(c => c.module === module && c.action === action);
  const direct = operations.filter(o => o.method !== 'USE' && o.guards.some(g => matches(g, module, action)));
  const references = consumers.filter(g => matches(g, module, action));
  const related = operations.filter(o => o.guards.some(g => g.literalArgs[0] === module));
  return { key, module, action, uniqueCells: cells.length, roles: cells.map(c => c.role),
    status: direct.length ? 'OPERATION_MAPPED_NOT_EXECUTED' : 'OWNER_SEMANTICS_REQUIRED',
    ownership: { implementation: [...new Set([...direct, ...related, ...references].map(x => x.file))],
      decision: 'Product/security owner must define intended action semantics; implementation file is not a named accountable owner.' },
    operations: direct, exactConsumerReferences: references,
    relatedOperationsNotAuthorizationEvidence: related,
    uiReferences: ui.filter(g => matches(g, module, action)),
    priorReasons: [...new Set(cells.map(c => c.reason))],
    limitation: direct.length
      ? 'Static mapping only. Valid fixture, natural-role denial, side-effect check and UI evidence still required. Inline branches and outer middleware need runtime attribution.'
      : 'No direct action endpoint identified. Related endpoints consume different permissions and cannot close this cell. Dynamic consumers still require review; not proof of impossible coverage.',
  };
});
const mapped = residual.map(cell => {
  const group = groups.find(g => g.key === `${cell.module}.${cell.action}`);
  return { id: `${cell.role}:${cell.module}:${cell.action}`, role: cell.role, module: cell.module,
    action: cell.action, priorStatus: cell.status, status: group.status, group: group.key,
    newlyCovered: false, apiEvidence: [], browserEvidence: [] };
});
if (new Set(mapped.map(c => c.id)).size !== residual.length) throw Error('Duplicate residual cells');
const count = rows => rows.reduce((a, c) => (a[c.status] = (a[c.status] || 0) + 1, a), {});
const summary = {
  source, sourceMode: source === root ? 'CURRENT_WORKTREE_HASHED_NOT_ISOLATED_FROZEN_COPY' : 'EXPLICIT_SOURCE_PATH_HASHED',
  workspaceHeadAtExtraction: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  frozenBuildCommit: source !== root ? JSON.parse(fs.readFileSync(path.join(root, 'reports/tanda-g-ampliada/setup/build-identity.json'))).commit : null,
  sourceManifestSha256: sha(JSON.stringify(manifest)),
  baselineSha256: sha(fs.readFileSync(baselineFile)), residualUniqueCells: residual.length,
  priorResidualStatuses: residual.reduce((a, c) => (a[c.status] = (a[c.status] || 0) + 1, a), {}),
  staticStatuses: count(mapped), uniqueModuleActions: groups.length,
  newlyCoveredUniqueCells: 0, remainingUniqueCells: residual.length,
  actualApiRequests: 0, actualRoleBrowsers: 0, rolesRequired: ['ADMIN', 'TERMINAL', 'CAJA', 'SUPERVISOR', 'BODEGA', 'SISTEMAS', 'CONTADOR'],
  runtimeEvidence: 'See runtime-summary.json; counts here intentionally describe static extraction only.',
  staticLimitations: [
    'Unconsumed flags require owner semantics; do not substitute arbitrary 403 routes.',
    'Static extraction does not expand arbitrary computed factory routes; review dynamic references.'],
};
fs.mkdirSync(out, { recursive: true });
for (const [name, data] of Object.entries({ 'source-manifest': manifest, 'api-operations': operations,
  'api-consumers': consumers, 'ui-consumers': ui, 'operation-ownership': groups, 'residual-cells': mapped, summary })) {
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(data, null, 2) + '\n');
}
console.log(JSON.stringify(summary, null, 2));