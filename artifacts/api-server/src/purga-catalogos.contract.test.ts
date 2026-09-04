import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildPreflight,
  sanitizeAuditSnapshot,
} from "./lib/purga-catalogos";

test("la purga es ADMIN, transaccional, bloquea y vuelve a contar", async () => {
  const [route, engine] = await Promise.all([
    readFile(new URL("./routes/purga.ts", import.meta.url), "utf8"),
    readFile(new URL("./lib/purga-catalogos.ts", import.meta.url), "utf8"),
  ]);
  assert.match(route, /requireSession, requireRole\("ADMIN"\)/);
  assert.doesNotMatch(route, /\/auth\/login/);
  assert.doesNotMatch(route, /LOGIN_FALLIDO|sesionesTable|clearSessionCookie/);
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
  assert.match(
    engine,
    /rol, "ADMIN"[\s\S]*activo, true[\s\S]*passwordHash\} = crypt/,
  );
  assert.match(engine, /confirmadorAdmin:[\s\S]*id:[\s\S]*usuario:/);
  assert.doesNotMatch(engine, /LOGIN_FALLIDO|\/auth\/login|sesionesTable/);
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

test("clientes y proveedores con cualquier movimiento financiero jamás se purgan", () => {
  for (const fixture of [
    {
      entidad: "clientes" as const,
      tipo: "Movimientos de crédito",
      noun: "cliente",
    },
    {
      entidad: "proveedores" as const,
      tipo: "Pagos del proveedor",
      noun: "proveedor",
    },
  ]) {
    for (const activo of [true, false]) {
      for (const cantidad of [1, 7]) {
        const result = buildPreflight(
          fixture.entidad,
          41,
          { activo, es_sistema: false, __nombre_visible: "Histórico" },
          [{ tipo: fixture.tipo, cantidad, financialMovement: true }],
        );
        assert.equal(result.puedeEliminar, false);
        assert.match(result.motivoBloqueo!, new RegExp(fixture.noun));
        assert.match(result.motivoBloqueo!, /movimientos en su estado de cuenta/);
        assert.match(result.motivoBloqueo!, /Desactívalo en vez de purgarlo/);
        assert.deepEqual(result.referencias, [
          { tipo: fixture.tipo, cantidad },
        ]);
      }
    }
  }
});

test("cliente y proveedor inactivos sin movimientos conservan la purga previa", () => {
  for (const entidad of ["clientes", "proveedores"] as const) {
    const result = buildPreflight(
      entidad,
      42,
      { activo: false, es_sistema: false, __nombre_visible: "Sin historia" },
      [],
    );
    assert.equal(result.puedeEliminar, true);
    assert.equal(result.motivoBloqueo, null);
    assert.equal(result.totalReferencias, 0);
  }
});

test("la baja y las consultas conservan el histórico de clientes inactivos", async () => {
  const [adminRoute, clientRoutes, providerRoutes, providerLedger] =
    await Promise.all([
      readFile(new URL("./routes/clientes-admin.ts", import.meta.url), "utf8"),
      readFile(new URL("./routes/clientes.ts", import.meta.url), "utf8"),
      readFile(new URL("./routes/proveedores.ts", import.meta.url), "utf8"),
      readFile(new URL("./lib/compras-proveedor.ts", import.meta.url), "utf8"),
    ]);
  assert.match(
    adminRoute,
    /saldo <= 0 && tickets === 0 && movimientos === 0[\s\S]*DELETE FROM clientes/,
  );
  assert.match(
    adminRoute,
    /if \(saldo <= 0\)[\s\S]*UPDATE clientes SET activo=false/,
  );
  assert.match(
    clientRoutes,
    /\/clientes\/:id\/estado-cuenta[\s\S]*WHERE m\.cliente_id=\$1/,
  );
  assert.doesNotMatch(
    clientRoutes.slice(
      clientRoutes.indexOf('"/clientes/:id/estado-cuenta"'),
      clientRoutes.indexOf('"/clientes/:id/estado-cuenta/imprimir"'),
    ),
    /activo\s*=\s*true|WHERE activo/,
  );
  assert.match(
    providerRoutes,
    /\/proveedores\/:id\/estado-cuenta[\s\S]*estadoCuenta\(\{[\s\S]*proveedorId/,
  );
  assert.match(providerLedger, /WHERE pp\.proveedor_id = \$\{opts\.proveedorId\}/);
});

test("productos solo se borran sin existencia ni historia, aunque estén activos", () => {
  const clean = buildPreflight(
    "productos",
    50,
    { activo: true, __nombre_visible: "Tela / Color (SKU)" },
    [],
  );
  assert.equal(clean.puedeEliminar, true);
  assert.equal(clean.motivoBloqueo, null);

  const stock = buildPreflight(
    "productos",
    51,
    { activo: true, __nombre_visible: "Tela / Color (SKU)" },
    [
      {
        tipo: "Existencia actual en Mariana: 12.000 METRO (2 rollos)",
        cantidad: 1,
      },
    ],
  );
  assert.equal(stock.puedeEliminar, false);
  assert.match(stock.motivoBloqueo!, /Mariana: 12\.000 METRO/);

  const moved = buildPreflight(
    "productos",
    52,
    { activo: false, __nombre_visible: "Tela / Color (SKU)" },
    [{ tipo: "Movimientos de producto", cantidad: 3 }],
  );
  assert.equal(moved.puedeEliminar, false);
  assert.match(moved.motivoBloqueo!, /historial operativo/);
  assert.match(moved.motivoBloqueo!, /Desactívalo/);

  const priced = buildPreflight(
    "productos",
    53,
    { activo: true, __nombre_visible: "Tela / Color (SKU)" },
    [{ tipo: "Historial de precios", cantidad: 1 }],
  );
  assert.equal(priced.puedeEliminar, false);
  assert.match(priced.motivoBloqueo!, /historial de precios/);
  assert.match(priced.motivoBloqueo!, /Pendiente de decisión/);
});

test("la purga de producto conserva auditoría, limpia caché cero y reserva SKU", async () => {
  const [engine, productsRoute] = await Promise.all([
    readFile(new URL("./lib/purga-catalogos.ts", import.meta.url), "utf8"),
    readFile(new URL("./routes/productos.ts", import.meta.url), "utf8"),
  ]);
  assert.match(engine, /Product audit rows intentionally survive deletion/);
  assert.match(
    engine,
    /DELETE FROM existencias[\s\S]*cantidad_total = 0[\s\S]*rollos_count = 0/,
  );
  assert.ok(
    engine.indexOf("INSERT INTO auditoria") <
      engine.lastIndexOf("DELETE FROM existencias"),
  );
  assert.match(
    productsRoute,
    /accion = 'PURGAR'[\s\S]*datos_antes->>'sku'/,
  );
  assert.match(productsRoute, /loadUnavailableProductSkus/);
});

test("cinco catálogos conservan purga común y producto la mueve a su edición", async () => {
  const files = [
    ["usuarios", "../../../artifacts/mariana-textil/src/pages/usuarios.tsx"],
    ["camionetas", "../../../artifacts/mariana-textil/src/pages/configuracion/camionetas.tsx"],
    ["choferes", "../../../artifacts/mariana-textil/src/pages/configuracion/choferes.tsx"],
    ["clientes", "../../../artifacts/mariana-textil/src/pages/clientes.tsx"],
    ["proveedores", "../../../artifacts/mariana-textil/src/pages/proveedores.tsx"],
  ] as const;
  for (const [entity, path] of files) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /INACTIVE|inactive/);
    assert.ok(source.includes(`entidad="${entity}"`));
    assert.match(source, /PurgaCatalogoButton/);
  }
  const [products, productDetail] = await Promise.all([
    readFile(
      new URL(
        "../../../artifacts/mariana-textil/src/pages/productos.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../../../artifacts/mariana-textil/src/pages/producto-detail.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.doesNotMatch(products, /PurgaCatalogoButton/);
  assert.match(productDetail, /isAdmin && isEditing/);
  assert.match(productDetail, /useGetPurgaPreflight\("productos"/);
  assert.match(productDetail, /data-testid="product-delete-reason"/);
  assert.doesNotMatch(productDetail, /ConfirmacionTextoExacto/);
  assert.doesNotMatch(productDetail, /textoRequerido|confirmacion:/);
  assert.match(productDetail, /Usuario ADMIN/);
  assert.match(productDetail, /PasswordInput/);
  assert.match(productDetail, /toggle-product-delete-password/);
  assert.match(productDetail, /product\.tela/);
  assert.match(productDetail, /product\.color/);
  assert.match(productDetail, /product\.sku/);
  assert.match(productDetail, /w-\[calc\(100vw-2rem\)\]/);
  assert.match(
    productDetail,
    /if \(deletePreflight\.data\?\.puedeEliminar\)[\s\S]*setDeleteConfirmOpen\(true\)/,
  );
  assert.equal(
    productDetail.match(/Esta acción no se puede deshacer\./g)?.length,
    1,
    "La duplicación era local: producto repetía la advertencia que agregaba el componente compartido.",
  );
  assert.match(productDetail, /navigate\("\/productos"\)/);
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
  const exactConfirmation = await readFile(
    new URL(
      "../../../artifacts/mariana-textil/src/components/confirmacion-texto-exacto.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.equal(
    exactConfirmation.match(/Esta acción no se puede deshacer\./g)?.length,
    1,
    "El componente compartido agrega una sola advertencia; la repetición no era global.",
  );
});