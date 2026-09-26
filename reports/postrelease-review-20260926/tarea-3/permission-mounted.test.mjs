import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import test from 'node:test';
import { createRequire } from 'node:module';
import ts from 'typescript';
const root = path.resolve(import.meta.dirname, '../../..');
const req = createRequire(path.join(root, 'artifacts/mariana-textil/package.json'));
const React = req('react'), { act } = React;
const { createRoot } = req('react-dom/client');
const { JSDOM } = req('jsdom');
const dom = new JSDOM("<div id='root'></div>", { url: 'http://localhost/conciliacion' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
const primitive = tag => ({ children, ...props }) => React.createElement(tag,
  Object.fromEntries(Object.entries(props).filter(([key]) => ['role','onClick','disabled'].includes(key))), children);
let user, isPending = false, isError = false, calls = [];
function compile(file, dependencies) {
  const result = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  assert.deepEqual(result.diagnostics, []);
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${result.outputText}\n})`)(name => {
    assert(name in dependencies, `Unexpected dependency ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}
const frozen = path.join(root, 'reports/priority-20260926/credit-presentation/frozen-root/artifacts/mariana-textil/src');
const permissions = compile(path.join(frozen, 'lib/permisos.ts'), { '@/lib/e3-feature-flags': { E3_ENABLED: false } });
const stubs = {
  react: React, 'react/jsx-runtime': req('react/jsx-runtime'),
  '@/lib/permisos': permissions, wouter: { Link: primitive('a') },
  '@/pages/e11': { E11AdminNotices: () => null },
  '@/components/layout/app-layout': { AppLayout: primitive('main') },
  '@/components/product-combobox': { ProductCombobox: () => null },
  '@tanstack/react-query': { useQueryClient: () => ({ invalidateQueries() {} }) },
  '@workspace/api-client-react': {
    useGetCurrentUser: () => ({ data: user }), getGetCurrentUserQueryKey: () => ['/api/auth/me'],
    useListProductos: () => ({ data: [] }), useListLocations: () => ({ data: [] }),
    useGetConciliacion: () => ({ isLoading: false, isError, refetch() {}, data: [{
      productoId: 12, ubicacionId: 3, ubicacionNombre: 'Test site', ubicacionActiva: true,
      discrepancia: true, cantidadMovimientos: '12', cantidadCache: '10', rollosMovimientos: 2, rollosCache: 1,
    }] }),
    useRecalcularExistencias: () => ({ isPending, mutate: body => calls.push(body) }),
    getGetConciliacionQueryKey: () => ['/api/conciliacion'],
  },
  '@workspace/number-format': { formatNumber: String },
  sonner: { toast: { error() {}, success() {} } },
  'lucide-react': new Proxy({}, { get: () => () => null }),
};
for (const [file, names] of Object.entries({
  card: ['Card','CardContent','CardHeader','CardTitle','CardDescription'], badge: ['Badge'],
  select: ['Select','SelectContent','SelectItem','SelectTrigger','SelectValue'],
  table: ['Table','TableBody','TableCell','TableHead','TableHeader','TableRow'],
})) stubs[`@/components/ui/${file}`] = Object.fromEntries(names.map(n => [n, primitive('div')]));
stubs['@/components/ui/button'] = { Button: primitive('button') };
const source = process.env.REVIEW_SOURCE || path.join(import.meta.dirname, 'permission-overlay/artifacts/mariana-textil/src/pages/conciliacion.tsx');
const Component = compile(source, stubs).default;
const auth = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'auth-me.json')));
const button = () => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Recalcular'));
test('mounted released component permission contract with authentic role permissions and controlled eligible discrepancy', async () => {
  const mount = createRoot(document.getElementById('root'));
  const render = async () => act(async () => mount.render(React.createElement(Component)));
  try {
    user = auth.SISTEMAS; await render();
    assert.equal(permissions.hasPermission(user, 'conciliacion', 'autorizar'), false);
    assert.equal(button().disabled, true, 'SISTEMAS has no effective conciliacion/autorizar');
    user = undefined; await render();
    assert.equal(button().disabled, true, 'unresolved auth cannot repair');
    for (const role of ['TERMINAL','CAJA','SUPERVISOR','BODEGA','SISTEMAS','CONTADOR']) {
      user = auth[role]; await render();
      const permitted = permissions.hasPermission(user, 'conciliacion', 'autorizar');
      assert.equal(button().disabled, !permitted, role);
      if (!permitted) { const before = calls.length; await act(async () => button().click()); assert.equal(calls.length, before); }
    }
    user = auth.ADMIN; await render();
    assert.equal(button().disabled, false, 'ADMIN existing bypass preserved');
    await act(async () => button().click());
    assert.deepEqual(calls.at(-1), { data: { productoId: 12, ubicacionId: 3 } });
    isPending = true; await render(); assert.equal(button().disabled, true);
    isPending = false;
    user = { ...auth.SISTEMAS, ubicacion: { id: 3 }, permisos: [{ modulo: 'conciliacion', puedeVer: true, puedeAutorizar: true }] };
    await render(); assert.equal(button().disabled, false, 'configured non-admin authorization preserved');
    await act(async () => button().click());
    isError = true; await render();
    assert.equal(button(), undefined, 'Task4 stale-error protection preserved');
    assert.match(document.body.textContent, /No se pudo consultar/);
  } finally { await act(async () => mount.unmount()); dom.window.close(); }
});