import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import test from "node:test";

const testUrl = process.env.TEST_DATABASE_URL;
const appUrl = process.env.DATABASE_URL;

if (!testUrl) {
  test.skip("precios integration requires explicit TEST_DATABASE_URL", () => {});
} else if (testUrl === appUrl) {
  throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL.");
} else {
  test("precios is ADMIN-only and changes only catalog price/history", async () => {
    const [{ pool, ensureProductMeterSchema, ensureProductPricingSchema }, { default: app }] = await Promise.all([
      import("@workspace/db"),
      import("./app"),
    ]);
    await ensureProductMeterSchema(pool);
    await ensureProductPricingSchema(pool);
    const tag = `PRECIO-IT-${randomUUID()}`;
    const initials = [...randomUUID().replaceAll("-", "").slice(0, 3)]
      .map((digit) => String.fromCharCode(65 + Number.parseInt(digit, 16)))
      .join("");
    const expectedDb = decodeURIComponent(new URL(testUrl).pathname.slice(1));
    let server: Server | undefined;
    const ids: Record<string, number[]> = {
      locations: [], users: [], products: [], rolls: [], clients: [], tickets: [], lines: [],
    };
    const sessions: string[] = [];

    // This assertion is deliberately performed before *each* fixture/cleanup
    // mutation, preventing an accidentally redirected pool from touching dev.
    const mutate = async (text: string, values: unknown[] = []) => {
      const identity = await pool.query<{ database: string }>("SELECT current_database() AS database");
      assert.equal(identity.rows[0]?.database, expectedDb, "TEST_DATABASE_URL database identity changed");
      return pool.query(text, values);
    };
    const one = async (text: string, values: unknown[] = []) => (await mutate(text, values)).rows[0]!;
    const request = async (method: string, path: string, session: string, body?: unknown) => {
      const response = await fetch(`${baseUrl}${path}`, {
        method, headers: { cookie: `mariana_session=${session}`, ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { response, body: await response.json() as any };
    };
    let baseUrl = "";

    try {
      const location = await one(
        "INSERT INTO ubicaciones(nombre,iniciales,tipo,activa) VALUES($1,$2,'TIENDA',true) RETURNING id",
        [`${tag} location`, initials],
      );
      ids.locations.push(Number(location.id));
      for (const role of ["ADMIN", "CAJA"] as const) {
        const user = await one(
          `INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id,activo,alcance_consulta)
           VALUES($1,$2,'integration-only',$3,$4,true,'PROPIA') RETURNING id`,
          [`${tag} ${role}`, `${tag}-${role}`, role, location.id],
        );
        ids.users.push(Number(user.id));
        const session = randomUUID(); sessions.push(session);
        await mutate("INSERT INTO sesiones(id,usuario_id,expira_at,ip,user_agent) VALUES($1,$2,now()+interval '1 hour','127.0.0.1',$3)", [session, user.id, tag]);
      }
      await mutate(
        "INSERT INTO permisos_usuario(usuario_id,modulo,puede_ver,puede_crear,puede_editar,puede_autorizar) VALUES($1,'productos',true,true,true,true)",
        [ids.users[1]],
      );
      const product = await one(
        "INSERT INTO productos(sku,tela,color,unidad,precio_sugerido,activo) VALUES($1,$2,$3,'METRO',100,true) RETURNING id",
        [`${tag}-SKU`, `${tag} Tela`, "Azul"],
      );
      ids.products.push(Number(product.id));
      const noCostProduct = await one(
        "INSERT INTO productos(sku,tela,color,unidad,precio_sugerido,activo) VALUES($1,$2,$3,'KILO',50,false) RETURNING id",
        [`${tag}-NOCOST`, `${tag} Sin costo`, "Gris"],
      );
      ids.products.push(Number(noCostProduct.id));
      // 2×10 + 8×20 => 18.00; all remaining rows must be excluded.
      for (const [serie, estado, cantidad, costo] of [["1","DISPONIBLE","2","10"], ["2","DISPONIBLE","8","20"], ["3","EN_TRANSITO","7","1"], ["4","MOSTRADOR","0","1"], ["5","DISPONIBLE","0","99"], ["6","DISPONIBLE","1",null]] as const) {
        const roll = await one(
          "INSERT INTO rollos(serie,producto_id,ubicacion_id,estado,cantidad_inicial,cantidad_actual,costo_unitario) VALUES($1,$2,$3,$4,$5,$5,$6) RETURNING id",
          [`${tag}-${serie}`, product.id, location.id, estado, cantidad, costo],
        ); ids.rolls.push(Number(roll.id));
      }
      const client = await one("INSERT INTO clientes(nombre,activo) VALUES($1,true) RETURNING id", [`${tag} client`]);
      ids.clients.push(Number(client.id));
      const ticket = await one(
        `INSERT INTO tickets(folio,uuid_cliente,ubicacion_id,usuario_terminal_id,cliente_id,subtotal,iva,tasa_iva,total,estado,cobrado,facturado)
         VALUES($1,gen_random_uuid(),$2,$3,$4,100,0,0,100,'VENDIDO',false,false) RETURNING id`,
        [1700000000 + Math.floor(Math.random() * 100000000), location.id, ids.users[1], client.id],
      ); ids.tickets.push(Number(ticket.id));
      const line = await one(
        "INSERT INTO ticket_lineas(ticket_id,tipo,rollo_id,producto_id,cantidad,precio_unitario,precio_sugerido,importe,costo_unitario_congelado,costo_total_congelado) VALUES($1,'NORMAL',$3,$2,1,100,100,100,10,10) RETURNING id",
        [ticket.id, product.id, ids.rolls[0]],
      ); ids.lines.push(Number(line.id));

      server = createServer(app); await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
      const address = server.address(); assert(address && typeof address !== "string");
      baseUrl = `http://127.0.0.1:${address.port}`;
      // Non-admin has no permission-table escape hatch: every endpoint is 403.
      for (const [method, path, body] of [
        ["GET","/api/precios", undefined],
        ["GET",`/api/precios/${product.id}`, undefined],
        ["POST",`/api/precios/${product.id}/cambiar`, { precioListaNuevo: "90.00", motivo: "blocked" }],
        ["PATCH",`/api/precios/${product.id}/venta-por-metro`, { seVendePorMetro: true }],
      ] as const) {
        assert.equal((await request(method, path, sessions[1]!, body)).response.status, 403);
      }
      const listed = await request("GET", "/api/precios?search=SKU&unidad=METRO&semaforo=VERDE", sessions[0]!);
      assert.equal(listed.response.status, 200); assert.equal(listed.body[0].costoUnitarioPonderado, "18.00");
      assert.equal(listed.body[0].semaforo, "VERDE");
      assert.equal(listed.body[0].seVendePorMetro, false);
       // This product has an inventory-backed ROLLO cost but no reception
       // history, so its ROLLO and MAYOREO semaphores intentionally differ.
       const mayoreoListed = await request("GET", "/api/precios?search=SKU&modoPrecio=MAYOREO&semaforo=SIN_COSTO", sessions[0]!);
       assert.equal(mayoreoListed.response.status, 200);
       assert.equal(mayoreoListed.body.length, 1);
       assert.equal(mayoreoListed.body[0].preciosPorModo.ROLLO.semaforo, "VERDE");
       assert.equal(mayoreoListed.body[0].preciosPorModo.MAYOREO.semaforo, "SIN_COSTO");
      const enabled = await request("PATCH", `/api/precios/${product.id}/venta-por-metro`, sessions[0]!, { seVendePorMetro: true });
      assert.equal(enabled.response.status, 200);
      assert.equal(enabled.body.seVendePorMetro, true);
      const kiloRejected = await request("PATCH", `/api/precios/${noCostProduct.id}/venta-por-metro`, sessions[0]!, { seVendePorMetro: true });
      assert.equal(kiloRejected.response.status, 400);
      assert.equal(kiloRejected.body.code, "KILO_VENTA_POR_METRO_NO_PERMITIDA");
      const kiloInvariant = await pool.query("SELECT se_vende_por_metro FROM productos WHERE id=$1", [noCostProduct.id]);
      assert.equal(kiloInvariant.rows[0]?.se_vende_por_metro, false);
      await assert.rejects(
        mutate("UPDATE productos SET se_vende_por_metro=true WHERE id=$1", [noCostProduct.id]),
        (error: any) => error?.code === "23514",
      );
      const noCost = await request("GET", "/api/precios?search=NOCOST", sessions[0]!);
      assert.equal(noCost.body[0].costoUnitarioPonderado, null);
      assert.equal(noCost.body[0].semaforo, "SIN_COSTO");
      assert.equal((await request("POST", `/api/precios/${product.id}/cambiar`, sessions[0]!, { precioListaNuevo: "90.00", motivo: "ajuste normal" })).response.status, 200);
      assert.equal((await request("POST", `/api/precios/${product.id}/cambiar`, sessions[0]!, { precioListaNuevo: "17.00", motivo: "   precio bajo costo   " })).response.status, 200);
      const wholesale = await request("POST", `/api/precios/${product.id}/cambiar`, sessions[0]!, {
        modoPrecio: "MAYOREO", precioListaNuevo: "125.00", motivo: "precio mayoreo",
      });
      assert.equal(wholesale.response.status, 200);
      assert.equal(wholesale.body.producto.precioLista, "17.00");
      assert.equal(wholesale.body.producto.precioMayoreo, "125.00");
      const retail = await request("POST", `/api/precios/${product.id}/cambiar`, sessions[0]!, {
        modoPrecio: "MENUDEO", precioListaNuevo: "150.00", motivo: "precio menudeo",
      });
      assert.equal(retail.response.status, 200);
      assert.equal(retail.body.producto.precioMayoreo, "125.00");
      assert.equal(retail.body.producto.precioMenudeo, "150.00");
      assert.equal((await request("POST", `/api/precios/${product.id}/cambiar`, sessions[0]!, { precioListaNuevo: "0", motivo: "no" })).response.status, 400);
      assert.equal((await request("PATCH", `/api/productos/${product.id}`, sessions[0]!, { precioSugerido: "22.00" })).response.status, 400);
      const detail = await request("GET", `/api/precios/${product.id}`, sessions[0]!);
      const rolloHistory = detail.body.historial.find((item: { modoPrecio: string }) => item.modoPrecio === "ROLLO");
      assert.equal(rolloHistory.advertenciaBajoCosto, true);
      assert.equal(rolloHistory.precioListaNuevo, "17.00");
      assert.equal(detail.body.historial[0].modoPrecio, "MENUDEO");
      assert.equal(detail.body.historial[1].modoPrecio, "MAYOREO");
      assert.deepEqual(detail.body.puntosGrafica.map((x: { id: number }) => x.id), [...detail.body.historial].reverse().map((x: { id: number }) => x.id));
      const frozen = await pool.query("SELECT precio_sugerido,costo_unitario_congelado,costo_total_congelado FROM ticket_lineas WHERE id=$1", [line.id]);
      assert.deepEqual(frozen.rows[0], { precio_sugerido: "100.00", costo_unitario_congelado: "10.00", costo_total_congelado: "10.00" });
      const audit = await pool.query("SELECT usuario_id FROM auditoria WHERE entidad='productos' AND entidad_id=$1 AND accion='CAMBIAR_PRECIO'", [String(product.id)]);
      assert.equal(Number(audit.rows[0]?.usuario_id), ids.users[0]);
    } finally {
      if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
      // FK-safe, tag/id-scoped cleanup only.
      if (ids.lines.length) await mutate("DELETE FROM ticket_lineas WHERE id = ANY($1::int[])", [ids.lines]);
      if (ids.tickets.length) await mutate("DELETE FROM tickets WHERE id = ANY($1::int[])", [ids.tickets]);
      if (ids.products.length) {
        await mutate("DELETE FROM precio_historial WHERE producto_id = ANY($1::int[])", [ids.products]);
        await mutate("DELETE FROM auditoria WHERE entidad='productos' AND entidad_id = ANY($1::text[])", [ids.products.map(String)]);
      }
      if (ids.rolls.length) await mutate("DELETE FROM rollos WHERE id = ANY($1::int[])", [ids.rolls]);
      if (ids.products.length) await mutate("DELETE FROM productos WHERE id = ANY($1::int[])", [ids.products]);
      if (ids.clients.length) await mutate("DELETE FROM clientes WHERE id = ANY($1::int[])", [ids.clients]);
      if (sessions.length) await mutate("DELETE FROM sesiones WHERE id = ANY($1::uuid[])", [sessions]);
      if (ids.users.length) await mutate("DELETE FROM permisos_usuario WHERE usuario_id = ANY($1::int[])", [ids.users]);
      if (ids.users.length) await mutate("DELETE FROM usuarios WHERE id = ANY($1::int[])", [ids.users]);
      if (ids.locations.length) await mutate("DELETE FROM ubicaciones WHERE id = ANY($1::int[])", [ids.locations]);
    }
  });
}