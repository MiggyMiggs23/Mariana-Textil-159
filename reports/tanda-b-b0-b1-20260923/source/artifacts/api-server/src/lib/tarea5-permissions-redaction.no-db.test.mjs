import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
// The optional root is exclusively a disposable source copy for mutation proofs.
const root = process.env.TAREA5_SOURCE_ROOT || process.cwd();
function load(relative, dependencies = {}) {
  const filename = resolve(root, relative);
  const source = readFileSync(filename, "utf8");
  const javascript = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(javascript, {
    exports,
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), `Unreviewed import: ${name}`);
      return dependencies[name];
    },
  }, { filename, timeout: 3000 });
  return exports;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const values = (v) => ({ puedeVer: v, puedeCrear: v, puedeEditar: v, puedeAutorizar: v });
const sensitive = () => load("artifacts/api-server/src/lib/sensitive-data.ts");

test("T5 permisos: resolution, matrix, overrides and middleware without persisted actors", async () => {
  const tables = Object.fromEntries(
    ["permisosRolTable", "permisosUsuarioTable", "permisosUbicacionTable", "usuariosTable"]
      .map((name) => [name, new Proxy({ name }, { get: (obj, key) => key === "name" ? obj.name : `${name}.${String(key)}` })]),
  );
  const rows = Object.fromEntries(Object.keys(tables).map((key) => [key, []]));
  const matches = (row, condition) => condition.every(([column, value]) => row[column.split(".")[1]] === value);
  const db = {
    select() {
      return { from(table) {
        const builder = {
          innerJoin() { return builder; },
          where(condition) {
            const result = rows[table.name].filter((row) => matches(row, condition));
            return Object.assign(Promise.resolve(result), { limit: async (n) => result.slice(0, n) });
          },
        };
        return builder;
      } };
    },
  };
  const forbidden = () => { throw new Error("SQL/lock execution forbidden"); };
  const api = load("artifacts/api-server/src/lib/permisos.ts", {
    "./tarea4-gates": load("artifacts/api-server/src/lib/tarea4-gates.ts"),
    "@workspace/db": { db, ...tables },
    "drizzle-orm": { eq: (column, value) => [[column, value]], and: (...args) => args.flat(), or: forbidden, sql: forbidden, isNotNull: forbidden },
    "@workspace/db/advisory-locks": { transactionAdvisoryLock: forbidden, ADVISORY_LOCK_NAMESPACES: {} },
  });
  const id = 91; // scalar context only; no user entity or session is created
  const noRead = { select: () => { throw new Error("ADMIN must not read storage"); } };
  for (const modulo of api.MODULOS) {
    assert.deepEqual(plain(await api.resolvePermiso(id, "ADMIN", modulo, noRead)), { modulo, ...values(true) });
    assert.equal(await api.resolvePermiso(id, "CAJA", modulo), null);
  }
  const matrix = plain(await api.buildPermissionMatrix(id, "ADMIN", noRead));
  assert.deepEqual(Object.keys(matrix), plain(api.MODULOS));
  for (const modulo of api.MODULOS) assert.deepEqual(matrix[modulo], { modulo, ...values(true) });
  const deny = plain(await api.buildPermissionMatrix(id, "CAJA"));
  for (const modulo of api.MODULOS) assert.deepEqual(deny[modulo], { modulo, ...values(false) });
  const modulo = "inventario";
  const role = { rol: "CAJA", modulo, ...values(false), updatedPor: null };
  const location = { id, rol: "CAJA", modulo, ...values(true) };
  rows.permisosRolTable.push(role);
  rows.permisosUbicacionTable.push(location);
  for (const custom of [false, true]) {
    role.updatedPor = custom ? 12 : null;
    for (const override of [undefined, null, false, true]) {
      rows.permisosUsuarioTable = override === undefined ? [] : [{ usuarioId: id, modulo, ...values(override) }];
      const expected = { modulo, ...values(override ?? !custom) };
      assert.deepEqual(plain(await api.resolvePermiso(id, "CAJA", modulo)), expected);
      assert.deepEqual(plain((await api.buildPermissionMatrix(id, "CAJA"))[modulo]), expected);
    }
  }
  rows.permisosUsuarioTable = [];
  for (const granted of [false, true]) {
    Object.assign(role, values(granted));
    for (const action of ["ver", "crear", "editar", "autorizar"]) {
      const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
      let next = 0;
      await api.requierePermiso(modulo, action)({ auth: { user: { id, rol: "CAJA" } } }, response, () => next++);
      assert.equal(next, granted ? 1 : 0);
      assert.equal(response.statusCode, granted ? 200 : 403);
    }
  }
  const response = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  await api.requierePermiso(modulo, "ver")({}, response, () => assert.fail("unauthenticated next"));
  assert.equal(response.code, 401);
});

test("T5 productos-cache: TERMINAL redaction preserves stock and source payload", () => {
  const api = sensitive();
  const input = {
    id: 7, tela: "Lino", existencia: 14.25, costoPromedio: "12.00",
    rollos: [{ serie: "R-7", cantidadActual: 14.25, precio_venta: "20.00", costoUnitario: "12.00",
      detalle: { margen: "8.00", utilidad: "114.00", ubicacionId: 3 } }],
    metadata: null,
  };
  const before = structuredClone(input);
  assert.deepEqual(plain(api.omitTerminalSensitiveFields(input, true)), {
    id: 7, tela: "Lino", existencia: 14.25,
    rollos: [{ serie: "R-7", cantidadActual: 14.25, detalle: { ubicacionId: 3 } }], metadata: null,
  });
  assert.deepEqual(input, before);
  assert.equal(api.omitTerminalSensitiveFields(input, false), input);
});

test("T5 role-access-matrix: SUPERVISOR nested confidentiality without login", () => {
  const api = sensitive();
  const fields = ["costoUnitario", "precio_sugerido", "margen", "utilidad", "saldo", "limiteCredito",
    "creditoDisponible", "totalDeuda", "totalPagado", "importe", "formaPago", "pagos", "efectivo",
    "ineUrl", "documentoUrl", "nombreArchivo", "mimeType", "objectKey", "storageMetadata"];
  const input = { id: 7, nombre: "Producto", lineas: [{ serie: "R7", cantidad: 5, ...Object.fromEntries(fields.map((key) => [key, "private"])) }] };
  const before = structuredClone(input);
  for (const key of fields) assert.equal(api.isSupervisorSensitiveKey(key), true, key);
  assert.deepEqual(plain(api.omitSupervisorSensitiveFields(input, true)), {
    id: 7, nombre: "Producto", lineas: [{ serie: "R7", cantidad: 5 }],
  });
  assert.deepEqual(input, before);
  assert.equal(api.omitSupervisorSensitiveFields(input, false), input);
  for (const key of ["id", "serie", "cantidad", "nombre"]) assert.equal(api.isSupervisorSensitiveKey(key), false, key);
});