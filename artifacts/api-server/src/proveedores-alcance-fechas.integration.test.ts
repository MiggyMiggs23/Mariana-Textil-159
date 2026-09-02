import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import test from "node:test";

const testUrl = process.env.TEST_DATABASE_URL;
const applicationUrl = process.env.DATABASE_URL;
if (process.env.NODE_ENV !== "test") throw new Error("La prueba requiere NODE_ENV=test.");
if (!testUrl) throw new Error("La prueba requiere TEST_DATABASE_URL explícita.");
if (testUrl === applicationUrl) throw new Error("TEST_DATABASE_URL debe ser distinta de DATABASE_URL.");

test("compras y reportes respetan PROPIA y las compras usan fecha de recepción", async () => {
  const [{ pool, createTestDatabaseGuard }, { default: app }] = await Promise.all([
    import("@workspace/db"),
    import("./app"),
  ]);
  const { assertIsolated } = await createTestDatabaseGuard(pool, testUrl, applicationUrl);
  await assertIsolated();

  const tag = `PAF-${randomUUID()}`;
  const initials = randomUUID()
    .replaceAll("-", "")
    .slice(0, 6)
    .split("")
    .map((character) => String.fromCharCode(65 + (Number.parseInt(character, 16) % 26)))
    .join("");
  const one = async <T extends Record<string, unknown>>(query: string, values: unknown[] = []) => {
    await assertIsolated();
    const row = (await pool.query<T>(query, values)).rows[0];
    assert.ok(row);
    return row;
  };
  let server: Server | undefined;

  try {
    const ownSite = await one<{ id: number }>(
      "INSERT INTO ubicaciones(nombre,iniciales,tipo,activa) VALUES($1,$2,'TIENDA',true) RETURNING id",
      [`${tag}-propio`, initials.slice(0, 3)],
    );
    const otherSite = await one<{ id: number }>(
      "INSERT INTO ubicaciones(nombre,iniciales,tipo,activa) VALUES($1,$2,'TIENDA',true) RETURNING id",
      [`${tag}-ajeno`, initials.slice(3, 6)],
    );
    const actor = await one<{ id: number }>(
      `INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id,alcance_consulta,activo)
       VALUES($1,$2,'integration-only','BODEGA',$3,'PROPIA',true) RETURNING id`,
      [tag, tag.toLowerCase(), ownSite.id],
    );
    for (const modulo of ["proveedores_finanzas", "reportes"]) {
      await one(
        `INSERT INTO permisos_usuario(usuario_id,modulo,puede_ver,puede_crear,puede_editar,puede_autorizar)
         VALUES($1,$2,true,false,false,false) RETURNING id`,
        [actor.id, modulo],
      );
    }
    const sessionId = randomUUID();
    await one(
      `INSERT INTO sesiones(id,usuario_id,expira_at,ip,user_agent)
       VALUES($1,$2,now()+interval '2 hours','127.0.0.1',$3) RETURNING id`,
      [sessionId, actor.id, tag],
    );
    const supplier = await one<{ id: number }>(
      "INSERT INTO proveedores(nombre,tipo,activo) VALUES($1,'NACIONAL',true) RETURNING id",
      [`${tag}-proveedor`],
    );
    const receiptDates = ["2026-01-05T18:00:00.000Z", "2026-01-10T18:00:00.000Z"];
    const ledgerDates = ["2026-03-01T18:00:00.000Z", "2025-11-01T18:00:00.000Z"];
    const entries: number[] = [];
    for (const [index, siteId] of [ownSite.id, otherSite.id].entries()) {
      const entry = await one<{ id: number }>(
        `INSERT INTO entradas(folio,ubicacion_id,proveedor_id,usuario_id,fecha,total_rollos,total_costo,uuid_cliente)
         VALUES($1,$2,$3,$4,$5,1,100,$6) RETURNING id`,
        [1_800_000_000 + index, siteId, supplier.id, actor.id, receiptDates[index], randomUUID()],
      );
      entries.push(Number(entry.id));
      await one(
        `INSERT INTO pagos_proveedor(proveedor_id,entrada_id,importe,tipo,fecha,usuario_id)
         VALUES($1,$2,100,'COMPRA',$3,$4) RETURNING id`,
        [supplier.id, entry.id, ledgerDates[index], actor.id],
      );
    }

    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const request = async (path: string) => {
      const response = await fetch(`http://127.0.0.1:${address.port}/api${path}`, {
        headers: { Cookie: `mariana_session=${sessionId}` },
      });
      return { status: response.status, body: await response.json() as Record<string, unknown> };
    };

    const list = await request(`/proveedores/${supplier.id}/compras?desde=2026-01-01&hasta=2026-01-31`);
    assert.equal(list.status, 200);
    const items = list.body.items as Array<{ entradaId: number; fecha: string }>;
    assert.deepEqual(items.map((item) => item.entradaId), [entries[0]]);
    assert.equal(items[0]?.fecha, receiptDates[0]);

    assert.equal((await request(`/proveedores/${supplier.id}/compras/${entries[0]}`)).status, 200);
    assert.equal((await request(`/proveedores/${supplier.id}/compras/${entries[1]}`)).status, 404);

    const catalogs = await request("/reportes/catalogos");
    assert.equal(catalogs.status, 200);
    assert.deepEqual(
      (catalogs.body.sites as Array<{ id: number }>).map((site) => site.id),
      [Number(ownSite.id)],
    );
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await pool.end();
  }
});