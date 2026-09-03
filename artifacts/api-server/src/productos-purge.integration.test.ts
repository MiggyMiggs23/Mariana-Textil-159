import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import test from "node:test";

const testUrl = process.env.TEST_DATABASE_URL;
const appUrl = process.env.DATABASE_URL;

if (!testUrl) {
  test.skip("product purge integration requires explicit TEST_DATABASE_URL", () => {});
} else if (testUrl === appUrl) {
  throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL.");
} else {
  test("producto solo se borra sin existencia ni historia y su SKU queda reservado", async () => {
    const [
      { pool, db },
      { default: app },
      { crearRollo },
      { crearTicket },
    ] = await Promise.all([
      import("@workspace/db"),
      import("./app"),
      import("./lib/inventario"),
      import("./lib/pos"),
    ]);
    const expectedDb = decodeURIComponent(new URL(testUrl).pathname.slice(1));
    const tag = `PURGE-${randomUUID()}`;
    const session = randomUUID();
    let server: Server | undefined;
    let baseUrl = "";

    const mutate = async (text: string, values: unknown[] = []) => {
      const identity = await pool.query<{ database: string }>(
        "SELECT current_database() AS database",
      );
      assert.equal(
        identity.rows[0]?.database,
        expectedDb,
        "TEST_DATABASE_URL database identity changed",
      );
      return pool.query(text, values);
    };
    const request = async (
      path: string,
      options: { method?: string; body?: unknown } = {},
    ) => {
      const response = await fetch(`${baseUrl}${path}`, {
        method: options.method ?? "GET",
        headers: {
          cookie: `mariana_session=${session}`,
          ...(options.body === undefined
            ? {}
            : { "content-type": "application/json" }),
        },
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      const text = await response.text();
      return {
        response,
        body: text ? (JSON.parse(text) as any) : null,
      };
    };

    try {
      const admin = await pool.query<{ id: number }>(
        "SELECT id FROM usuarios WHERE rol='ADMIN' AND activo=true ORDER BY id LIMIT 1",
      );
      const location = await pool.query<{ id: number; nombre: string }>(
        "SELECT id,nombre FROM ubicaciones WHERE activa=true AND tipo IN ('TIENDA','BODEGA') ORDER BY id LIMIT 1",
      );
      assert.ok(admin.rows[0], "La base aislada requiere el ADMIN del seed.");
      assert.ok(location.rows[0], "La base aislada requiere un sitio del seed.");
      await mutate(
        "INSERT INTO sesiones(id,usuario_id,expira_at,ip,user_agent) VALUES($1,$2,now()+interval '1 hour','127.0.0.1',$3)",
        [session, admin.rows[0].id, tag],
      );

      server = createServer(app);
      await new Promise<void>((resolve) =>
        server!.listen(0, "127.0.0.1", resolve),
      );
      const address = server.address();
      assert(address && typeof address !== "string");
      baseUrl = `http://127.0.0.1:${address.port}`;

      const cleanTela = `${tag} Tela Limpia`;
      const cleanColor = "Azul Prueba";
      const csv = [
        "tela,color,unidad",
        `${cleanTela},${cleanColor},METRO`,
      ].join("\n");
      const imported = await request("/api/productos/import/confirm", {
        method: "POST",
        body: {
          fileName: "producto-borrable.csv",
          content: Buffer.from(csv, "utf8").toString("base64"),
        },
      });
      assert.equal(imported.response.status, 200);
      assert.equal(imported.body.insertados, 1);

      const cleanProduct = await pool.query<{
        id: number;
        sku: string;
        tela: string;
        color: string;
      }>(
        "SELECT id,sku,tela,color FROM productos WHERE tela ILIKE $1 LIMIT 1",
        [`${tag}%Tela Limpia`],
      );
      assert.ok(cleanProduct.rows[0]);
      const original = cleanProduct.rows[0];
      await mutate(
        "INSERT INTO existencias(producto_id,ubicacion_id,cantidad_total,rollos_count) VALUES($1,$2,0,0)",
        [original.id, location.rows[0].id],
      );

      const cleanPreflight = await request(
        `/api/purga/productos/${original.id}/preflight`,
      );
      assert.equal(cleanPreflight.response.status, 200);
      assert.equal(cleanPreflight.body.puedeEliminar, true);
      assert.equal(cleanPreflight.body.inactivo, false);
      assert.equal(cleanPreflight.body.totalReferencias, 0);

      const wrongConfirmation = await request(
        `/api/purga/productos/${original.id}`,
        {
          method: "DELETE",
          body: { confirmacion: original.sku },
        },
      );
      assert.equal(wrongConfirmation.response.status, 409);
      assert.match(wrongConfirmation.body.error, /no coincide exactamente/);

      const deleted = await request(`/api/purga/productos/${original.id}`, {
        method: "DELETE",
        body: { confirmacion: cleanPreflight.body.nombreVisible },
      });
      assert.equal(deleted.response.status, 200);
      assert.deepEqual(deleted.body, { eliminado: true });

      const deletedRow = await pool.query(
        "SELECT id FROM productos WHERE id=$1",
        [original.id],
      );
      assert.equal(deletedRow.rowCount, 0);
      const zeroCache = await pool.query(
        "SELECT producto_id FROM existencias WHERE producto_id=$1",
        [original.id],
      );
      assert.equal(zeroCache.rowCount, 0);
      const purgeAudit = await pool.query<{
        usuario_id: number;
        sku: string;
      }>(
        `SELECT usuario_id,(datos_antes->>'sku')::text AS sku
         FROM auditoria
         WHERE accion='PURGAR' AND entidad='productos' AND entidad_id=$1
         ORDER BY id DESC LIMIT 1`,
        [String(original.id)],
      );
      assert.equal(purgeAudit.rows[0]?.usuario_id, admin.rows[0].id);
      assert.equal(purgeAudit.rows[0]?.sku, original.sku);

      const catalog = await request("/api/productos");
      assert.equal(catalog.response.status, 200);
      assert.ok(!JSON.stringify(catalog.body).includes(original.sku));
      const posSearch = await request(
        `/api/pos/buscar?q=${encodeURIComponent(original.sku)}&ubicacionId=${location.rows[0].id}`,
      );
      assert.equal(posSearch.response.status, 200);
      assert.ok(!JSON.stringify(posSearch.body).includes(original.sku));
      const deletedDetail = await request(`/api/productos/${original.id}`);
      assert.equal(deletedDetail.response.status, 404);

      const reimported = await request("/api/productos/import/confirm", {
        method: "POST",
        body: {
          fileName: "producto-reimportado.csv",
          content: Buffer.from(csv, "utf8").toString("base64"),
        },
      });
      assert.equal(reimported.response.status, 200);
      assert.equal(reimported.body.insertados, 1);
      const reimportedProduct = await pool.query<{
        id: number;
        sku: string;
      }>(
        "SELECT id,sku FROM productos WHERE tela ILIKE $1 LIMIT 1",
        [`${tag}%Tela Limpia`],
      );
      assert.ok(reimportedProduct.rows[0]);
      assert.notEqual(reimportedProduct.rows[0].sku, original.sku);
      const reimportedPreflight = await request(
        `/api/purga/productos/${reimportedProduct.rows[0].id}/preflight`,
      );
      assert.equal(reimportedPreflight.body.puedeEliminar, true);
      const reimportedDelete = await request(
        `/api/purga/productos/${reimportedProduct.rows[0].id}`,
        {
          method: "DELETE",
          body: { confirmacion: reimportedPreflight.body.nombreVisible },
        },
      );
      assert.equal(reimportedDelete.response.status, 200);

      const replacement = await request("/api/productos", {
        method: "POST",
        body: {
          tela: cleanTela,
          color: cleanColor,
          unidad: "METRO",
          precioSugerido: null,
        },
      });
      assert.equal(replacement.response.status, 201);
      assert.notEqual(replacement.body.sku, original.sku);
      const customReuse = await request("/api/productos", {
        method: "POST",
        body: {
          tela: `${tag} Otro`,
          color: "Morado",
          unidad: "METRO",
          sku: original.sku,
          precioSugerido: null,
        },
      });
      assert.equal(customReuse.response.status, 400);
      assert.match(customReuse.body.error, /reservado por un producto borrado/);
      const updateReuse = await request(
        `/api/productos/${replacement.body.id}`,
        {
          method: "PATCH",
          body: { sku: original.sku },
        },
      );
      assert.equal(updateReuse.response.status, 400);
      assert.match(updateReuse.body.error, /reservado por un producto borrado/);

      const stockProduct = await mutate(
        `INSERT INTO productos(sku,tela,color,unidad,precio_sugerido)
         VALUES($1,$2,$3,'METRO','20.00') RETURNING id`,
        [`${tag}-STOCK`, `${tag} Stock`, "Rojo"],
      );
      await mutate(
        "INSERT INTO existencias(producto_id,ubicacion_id,cantidad_total,rollos_count) VALUES($1,$2,'5.000',1)",
        [stockProduct.rows[0].id, location.rows[0].id],
      );
      const stockPreflight = await request(
        `/api/purga/productos/${stockProduct.rows[0].id}/preflight`,
      );
      assert.equal(stockPreflight.body.puedeEliminar, false);
      assert.match(stockPreflight.body.motivoBloqueo, /existencia/);
      assert.match(stockPreflight.body.motivoBloqueo, /5\.000 METRO/);
      assert.match(
        stockPreflight.body.motivoBloqueo,
        new RegExp(location.rows[0].nombre),
      );

      const movedProduct = await mutate(
        `INSERT INTO productos(sku,tela,color,unidad,precio_sugerido)
         VALUES($1,$2,$3,'METRO','30.00') RETURNING id`,
        [`${tag}-MOVED`, `${tag} Vendido`, "Verde"],
      );
      const soldRoll = await db.transaction((tx) =>
        crearRollo(tx, {
          productoId: Number(movedProduct.rows[0].id),
          ubicacionId: location.rows[0].id,
          cantidadInicial: "10.000",
          costoUnitario: "15.00",
          usuarioId: admin.rows[0].id,
          estado: "DISPONIBLE",
        }),
      );
      const soldTicket = await db.transaction((tx) =>
        crearTicket(
          tx,
          {
            ubicacionId: location.rows[0].id,
            usuarioTerminalId: admin.rows[0].id,
            clienteId: 1,
            facturado: false,
            uuidCliente: randomUUID(),
            lineas: [
              {
                rolloId: soldRoll.rollo.id,
                productoId: Number(movedProduct.rows[0].id),
                tipo: "NORMAL",
                cantidad: "10.000",
                precioUnitario: "30.00",
              },
            ],
            ip: "127.0.0.1",
          },
          true,
        ),
      );
      assert.ok(soldTicket, "La venta real debe crear un ticket.");
      const movedPreflight = await request(
        `/api/purga/productos/${movedProduct.rows[0].id}/preflight`,
      );
      assert.equal(movedPreflight.body.puedeEliminar, false);
      assert.match(movedPreflight.body.motivoBloqueo, /historial operativo/);
      assert.match(movedPreflight.body.motivoBloqueo, /Desactívalo/);
      const movedDelete = await request(
        `/api/purga/productos/${movedProduct.rows[0].id}`,
        {
          method: "DELETE",
          body: { confirmacion: movedPreflight.body.nombreVisible },
        },
      );
      assert.equal(movedDelete.response.status, 409);
      const ticketDocument = await request(`/api/tickets/${soldTicket.id}`);
      assert.equal(ticketDocument.response.status, 200);
      assert.ok(
        JSON.stringify(ticketDocument.body).includes(`${tag}-MOVED`),
        "El documento histórico conserva el producto vendido.",
      );
      const preservedHistory = await pool.query(
        `SELECT
           count(DISTINCT m.id)::int AS movimientos,
           count(DISTINCT tl.id)::int AS lineas_reporte
         FROM productos p
         JOIN movimientos m ON m.producto_id=p.id
         JOIN ticket_lineas tl ON tl.producto_id=p.id
         WHERE p.id=$1`,
        [movedProduct.rows[0].id],
      );
      assert.equal(preservedHistory.rows[0].movimientos, 2);
      assert.equal(preservedHistory.rows[0].lineas_reporte, 1);

      const raceProduct = await mutate(
        `INSERT INTO productos(sku,tela,color,unidad,precio_sugerido)
         VALUES($1,$2,$3,'METRO','40.00') RETURNING id`,
        [`${tag}-RACE`, `${tag} Carrera`, "Gris"],
      );
      const racePreflight = await request(
        `/api/purga/productos/${raceProduct.rows[0].id}/preflight`,
      );
      assert.equal(racePreflight.body.puedeEliminar, true);
      const blocker = await pool.connect();
      await blocker.query("BEGIN");
      await blocker.query("SELECT id FROM productos WHERE id=$1 FOR UPDATE", [
        raceProduct.rows[0].id,
      ]);
      const racingDelete = request(
        `/api/purga/productos/${raceProduct.rows[0].id}`,
        {
          method: "DELETE",
          body: { confirmacion: racePreflight.body.nombreVisible },
        },
      );
      await new Promise((resolve) => setTimeout(resolve, 75));
      const racingStock = pool
        .query(
          "INSERT INTO existencias(producto_id,ubicacion_id,cantidad_total,rollos_count) VALUES($1,$2,'1.000',1)",
          [raceProduct.rows[0].id, location.rows[0].id],
        )
        .then(() => ({ inserted: true, code: null }))
        .catch((error: { code?: string }) => ({
          inserted: false,
          code: error.code ?? null,
        }));
      await new Promise((resolve) => setTimeout(resolve, 75));
      await blocker.query("COMMIT");
      blocker.release();
      const [raceDeleteResult, raceStockResult] = await Promise.all([
        racingDelete,
        racingStock,
      ]);
      assert.ok(
        !(
          raceDeleteResult.response.status === 200 &&
          raceStockResult.inserted
        ),
        "La purga y una existencia nueva nunca pueden confirmarse juntas.",
      );
      if (raceDeleteResult.response.status === 200) {
        assert.equal(raceStockResult.inserted, false);
        assert.equal(raceStockResult.code, "23503");
      } else {
        assert.equal(raceDeleteResult.response.status, 409);
        assert.equal(raceStockResult.inserted, true);
      }

      const pricedProduct = await mutate(
        `INSERT INTO productos(sku,tela,color,unidad,precio_sugerido)
         VALUES($1,$2,$3,'METRO',NULL) RETURNING id`,
        [`${tag}-PRICE`, `${tag} Precio`, "Negro"],
      );
      const priced = await request(
        `/api/precios/${pricedProduct.rows[0].id}/cambiar`,
        {
          method: "POST",
          body: {
            precioListaNuevo: "80.00",
            motivo: "Primer precio de prueba",
          },
        },
      );
      assert.equal(priced.response.status, 200);
      const pricedPreflight = await request(
        `/api/purga/productos/${pricedProduct.rows[0].id}/preflight`,
      );
      assert.equal(pricedPreflight.body.puedeEliminar, false);
      assert.match(pricedPreflight.body.motivoBloqueo, /historial de precios/);
      const priceHistory = await pool.query(
        "SELECT id FROM precio_historial WHERE producto_id=$1",
        [pricedProduct.rows[0].id],
      );
      assert.equal(priceHistory.rowCount, 1);
    } finally {
      if (server) {
        await new Promise<void>((resolve) => server!.close(() => resolve()));
      }
      await mutate("DELETE FROM sesiones WHERE id=$1", [session]);
    }
  });
}