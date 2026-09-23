import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// No imports of application modules or DB package; execute actual transpiled
// source using an import allowlist. Defects affect this isolated VM copy only.
const defect = process.argv.find(arg => arg.startsWith("--defect="))?.split("=")[1];
const root = new URL("./", import.meta.url);
function load(path, mocks, transform = value => value) {
  const source = transform(readFileSync(new URL(path, root), "utf8"));
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  }}).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", js)(name => {
    assert.ok(Object.hasOwn(mocks, name), `Forbidden import: ${name}`);
    return mocks[name];
  }, module, module.exports);
  return module.exports;
}
const floor = load("lib/tarea4-price-floor.ts", {});

test("real locked price mutation: three modes, equality, unlimited increase, unknown decision and closed gate", async () => {
  let writes = [];
  let cost = "10.00";
  const tx = {
    update: () => ({ set: value => ({ where: () => ({ returning: async () => {
      writes.push(value); return [{ id: 1 }];
    }}) }) }),
    insert: table => ({ values: value => {
      writes.push({ table, ...value });
      return { returning: async () => [value] };
    } }),
  };
  function mutation(gate) {
    let source = readFileSync(new URL("routes/precios.ts", root), "utf8");
    source = source.slice(source.indexOf("async function mutateLockedPrecio("), source.indexOf("\nasync function presentProduct("));
    if (defect === "price") source = source.replace("if (PRICE_FLOOR_RELEASED)", "if (false)");
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 }}).outputText;
    return new Function("PRICE_FLOOR_RELEASED", "assertPriceFloor", "meteredReferenceCost",
      "currentCost", "priceMetrics", "productosTable", "precioHistorialTable", "auditoriaTable", "eq",
      `${js}; return mutateLockedPrecio;`)(
      gate, floor.assertPriceFloor, async () => ({ cost }), async () => cost, () => ({}),
      { id: 1 }, "history", "audit", () => true);
  }
  for (const modoPrecio of ["ROLLO", "MAYOREO", "MENUDEO"]) {
    const input = { precioListaNuevo: "9.99", modoPrecio, motivo: "Cambio autorizado", usuarioId: 2, ip: "" };
    writes = [];
    await assert.rejects(mutation(true)(tx, { id: 1 }, input), { code: "PRECIO_BAJO_COSTO" });
    assert.equal(writes.length, 0);
    for (const price of ["10.00", "99999999.00"]) {
      writes = [];
      await mutation(true)(tx, { id: 1 }, { ...input, precioListaNuevo: price });
      assert.equal(writes.length, 3);
      assert.equal(writes[2].accion, "CAMBIAR_PRECIO");
    }
    cost = null;
    writes = [];
    await mutation(true)(tx, { id: 1 }, input);
    assert.equal(writes.length, 3, "precio sin costo permitido por decisión del 21/09");
    cost = "10.00";
    writes = [];
    await mutation(false)(tx, { id: 1 }, input);
    assert.equal(writes.length, 3, "closed gate preserves old warning behavior");
  }
});

test("real remate handler: closed gate, all roles, permission override, reason, replay, scope and rollback", async () => {
  let marks = [], audits = [], allowed = false, accessible = true, auditFails = false;
  const store = { transaction: async work => {
    const previous = [structuredClone(marks), structuredClone(audits)];
    try { return await work({
      allowed: async () => allowed, lockAccessibleRoll: async () => accessible,
      markExists: async id => marks.some(mark => mark.rolloId === id),
      insertMark: async mark => { marks.push(mark); },
      audit: async mark => { if (auditFails) throw new Error("audit failure"); audits.push(mark); },
    }); } catch (error) { [marks, audits] = previous; throw error; }
  }};
  const handler = gate => load("lib/tarea4-remate.ts", {
    "./tarea4-gates": { REMATE_RELEASED: gate },
  }, source => defect === "remate" ? source.replace('actor.rol !== "ADMIN" && !await tx.allowed(actor)', "false") : source)
    .createMarkRemateHandler(store);
  async function invoke(gate, rol, body = { motivo: "Liquidación" }, id = "5") {
    let status, result, error;
    await handler(gate)({ auth: rol ? { user: { id: 2, rol } } : undefined, params: { id }, body },
      { status: value => { status = value; return { json: value => { result = value; } }; } },
      value => { error = value; });
    return { status, result, error };
  }
  assert.equal((await invoke(false, "ADMIN")).status, 404);
  assert.equal((await invoke(true, null)).status, 401);
  for (const rol of ["CAJA", "BODEGA", "SUPERVISOR", "SISTEMAS", "CONTADOR", "TERMINAL"]) {
    assert.equal((await invoke(true, rol)).status, 403);
    allowed = true;
    assert.equal((await invoke(true, rol)).status, 201);
    marks = []; audits = []; allowed = false;
  }
  assert.equal((await invoke(true, "ADMIN", { motivo: " " })).status, 400);
  assert.equal((await invoke(true, "ADMIN", { motivo: "x", precio: 1 })).status, 400);
  assert.equal((await invoke(true, "ADMIN", { motivo: "x" }, "0")).status, 400);
  accessible = false;
  assert.equal((await invoke(true, "ADMIN")).status, 404);
  accessible = true; auditFails = true;
  assert.match((await invoke(true, "ADMIN")).error.message, /audit failure/);
  assert.equal(marks.length, 0);
  auditFails = false;
  assert.equal((await invoke(true, "ADMIN")).status, 201);
  assert.equal((await invoke(true, "ADMIN", { motivo: "new reason" })).status, 409);
  assert.equal(marks[0].motivo, "Liquidación");
  assert.equal(audits.length, 1);
});

test("actual purge: only price history exempt, movement/stock blocks, credentials, atomic rollback and permanent audit", async () => {
  const sql = (parts, ...values) => parts.reduce((text, part, i) => text + part + (i < values.length ? String(values[i]) : ""), "");
  sql.raw = value => value;
  let history, product, movement, stock, credentials, audit, failDelete;
  const reset = () => { history = 2; product = true; movement = 0; stock = false; credentials = true; audit = ["CAMBIAR_PRECIO"]; failDelete = false; };
  reset();
  const execute = async query => {
    if (query.includes("pg_constraint")) return { rows: [
      { table_name: "precio_historial", column_name: "producto_id" },
      { table_name: "rollo_eventos", column_name: "producto_id" },
      { table_name: "rollos", column_name: "producto_id" },
    ] };
    if (query.startsWith("SELECT *, ")) return { rows: product ? [{ id: 1, activo: true, sku: "RESERVADO", __nombre_visible: "Tela" }] : [] };
    if (query.includes("FROM existencias e")) return { rows: stock ? [{ nombre: "Sitio", cantidad: "1", rollos: 1, unidad: "METRO" }] : [] };
    if (query.includes("count(*)")) return { rows: [{ count: query.includes('"precio_historial"') ? history : query.includes('"rollo_eventos"') ? movement : 0 }] };
    if (query.includes("INSERT INTO auditoria")) audit.push("PURGAR");
    if (query.includes("DELETE FROM precio_historial")) history = 0;
    if (query.startsWith('DELETE FROM "productos"')) { if (failDelete) throw new Error("FK race"); product = false; }
    return { rows: [] };
  };
  const tx = { execute, select: () => ({ from: () => ({ where: () => ({
    limit: async () => credentials ? [{ id: 9, usuario: "confirmador" }] : [],
  }) }) }) };
  const db = { ...tx, transaction: async work => {
    const snapshot = { history, product, audit: [...audit] };
    try { return await work(tx); } catch (error) { ({ history, product, audit } = snapshot); throw error; }
  }};
  const service = gate => load("lib/purga-catalogos.ts", {
    "drizzle-orm": { sql, and: () => true, eq: () => true },
    "@workspace/db": { db, usuariosTable: {} },
    "./auth-identifiers": { normalizeUsername: value => value },
    "./tarea4-gates": { PRODUCT_HISTORY_DELETE_RELEASED: gate },
  }, source => defect === "purge" ? source.replace('key === "precio_historial.producto_id"', 'true') : source);
  const input = { entidad: "productos", id: 1, actorId: 2, adminUsuario: "admin", adminPassword: "not-a-real-credential", ip: "" };
  await assert.rejects(service(false).purgeInactiveRecord(input), /historial/);
  movement = 1;
  await assert.rejects(service(true).purgeInactiveRecord(input), /movimientos|referencias|historia/);
  movement = 0; stock = true;
  await assert.rejects(service(true).purgeInactiveRecord(input), /existencia/);
  stock = false; credentials = false;
  await assert.rejects(service(true).purgeInactiveRecord(input), /credenciales/);
  credentials = true; failDelete = true;
  await assert.rejects(service(true).purgeInactiveRecord(input), /FK race/);
  assert.equal(history, 2); assert.equal(product, true); assert.deepEqual(audit, ["CAMBIAR_PRECIO"]);
  failDelete = false;
  await service(true).purgeInactiveRecord(input);
  assert.equal(product, false); assert.equal(history, 0);
  assert.deepEqual(audit, ["CAMBIAR_PRECIO", "PURGAR"]);
});

test("real remate component: closed gate exposes nothing, permitted form requires reason and reports failure", async () => {
  const path = "../../mariana-textil/src/components/tarea4-remate.tsx";
  let calls = [], state = [], cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = value; }];
    },
  };
  function render(gate, props) {
    cursor = 0;
    // JSX transpilation is React classic by default; binding is test-only.
    const source = readFileSync(new URL(path, root), "utf8");
    const js = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React,
    }}).outputText;
    const module = { exports: {} };
    new Function("require", "module", "exports", "React", js)(name => {
      if (name === "react") return react;
      if (name === "@/lib/tarea4-gates") return { REMATE_UI_RELEASED: defect === "ui" ? true : gate };
      throw new Error(`Forbidden import ${name}`);
    }, module, module.exports, react);
    return module.exports.RemateControl(props);
  }
  const props = { rolloId: 5, marked: false, canMark: true, onMark: async (...args) => { calls.push(args); } };
  assert.equal(render(false, props), null);
  assert.equal(render(true, { ...props, canMark: false }), null);
  assert.equal(render(true, { ...props, marked: true }).props.role, "status");
  let form = render(true, props);
  assert.equal(form.type, "form");
  await form.props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 0);
  form.props.children[0].props.children.find(child => child?.type === "textarea").props.onChange({ target: { value: "  Liquidación  " } });
  form = render(true, props);
  await form.props.onSubmit({ preventDefault() {} });
  assert.deepEqual(calls, [[5, "Liquidación"]]);
  state = ["Motivo", false, ""];
  form = render(true, { ...props, onMark: async () => { throw new Error("Sin permiso"); } });
  await form.props.onSubmit({ preventDefault() {} });
  form = render(true, props);
  assert.equal(form.props.children[1].props.role, "alert");
  assert.deepEqual(form.props.children[1].props.children, ["Sin permiso"]);
});