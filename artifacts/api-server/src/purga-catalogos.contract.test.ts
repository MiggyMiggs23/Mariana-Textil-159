import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sanitizeAuditSnapshot } from "./lib/purga-catalogos";

test("la purga es ADMIN, transaccional, bloquea y vuelve a contar", async () => {
  const [route, engine] = await Promise.all([
    readFile(new URL("./routes/purga.ts", import.meta.url), "utf8"),
    readFile(new URL("./lib/purga-catalogos.ts", import.meta.url), "utf8"),
  ]);
  assert.match(route, /requireSession, requireRole\("ADMIN"\)/);
  assert.match(route, /code === "23503"/);
  assert.match(engine, /db\.transaction/);
  assert.match(
    engine,
    /LOCK TABLE auditoria, notificaciones_sistema, solicitudes_pago_dirigido IN SHARE ROW EXCLUSIVE MODE/,
  );
  assert.ok(
    engine.indexOf("LOCK TABLE auditoria") < engine.indexOf("loadTarget(tx"),
    "el bloqueo lógico debe ocurrir antes de cargar/contar el objetivo",
  );
  assert.match(engine, /FOR UPDATE/);
  assert.match(engine, /countReferences\(tx/);
  assert.match(engine, /FROM auditoria[\s\S]*WHERE entidad = \$\{descriptor\.entityName\}[\s\S]*entidad_id = \$\{String\(id\)\}/);
  assert.match(engine, /FROM notificaciones_sistema/);
  assert.match(engine, /FROM solicitudes_pago_dirigido/);
  assert.match(engine, /INSERT INTO auditoria/);
  assert.match(engine, /DELETE FROM/);
  assert.ok(engine.indexOf("INSERT INTO auditoria") < engine.lastIndexOf("DELETE FROM"));
  assert.match(engine, /row\.es_sistema === true/);
  assert.match(engine, /sanitizeAuditSnapshot\(row\)/);
  for (const entity of [
    "usuarios",
    "camionetas",
    "choferes",
    "clientes",
    "proveedores",
    "productos",
  ]) {
    assert.match(engine, new RegExp(`${entity}:`));
  }
  for (const essential of [
    "auditoria.usuario_id",
    "sesiones.usuario_id",
    "viajes.camioneta_id",
    "viajes.chofer_id",
    "tickets.cliente_id",
    "rollos.producto_id",
    "rollos.proveedor_id",
    "auditoria_inventario_resultados.producto_id",
  ]) {
    assert.ok(engine.includes(essential), `falta referencia esencial ${essential}`);
  }
});

test("el snapshot de purga nunca conserva credenciales ni campos artificiales", () => {
  const snapshot = sanitizeAuditSnapshot({
    id: 7,
    nombre: "Persona",
    password_hash: "hash",
    passwordHash: "hash camel",
    hash: "hash top-level",
    credentials: { api_key: "secret", etiqueta: "visible" },
    __nombre_visible: "Persona",
    perfil: { tokenAcceso: "token", hash: "hash anidado", telefono: "555" },
  });
  assert.deepEqual(snapshot, {
    id: 7,
    nombre: "Persona",
    perfil: { telefono: "555" },
  });
  assert.ok(!JSON.stringify(snapshot).toLowerCase().includes("password"));
});

test("los seis catálogos cablean filtro y purga con componente común", async () => {
  const files = [
    ["usuarios", "../../../artifacts/mariana-textil/src/pages/usuarios.tsx"],
    ["camionetas", "../../../artifacts/mariana-textil/src/pages/configuracion/camionetas.tsx"],
    ["choferes", "../../../artifacts/mariana-textil/src/pages/configuracion/choferes.tsx"],
    ["clientes", "../../../artifacts/mariana-textil/src/pages/clientes.tsx"],
    ["proveedores", "../../../artifacts/mariana-textil/src/pages/proveedores.tsx"],
    ["productos", "../../../artifacts/mariana-textil/src/pages/productos.tsx"],
  ] as const;
  for (const [entity, path] of files) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /INACTIVE|inactive/);
    assert.ok(source.includes(`entidad="${entity}"`));
    assert.match(source, /PurgaCatalogoButton/);
  }
  const common = await readFile(
    new URL(
      "../../../artifacts/mariana-textil/src/components/purga-catalogo-button.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(common, /useGetPurgaPreflight/);
  assert.match(common, /useDeleteRegistroInactivo/);
  assert.match(common, /ConfirmacionTextoExacto/);
  assert.match(common, /totalReferencias/);
  assert.match(common, /isLoading/);
  assert.match(common, /preflight\.error/);
});