import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import test from "node:test";
import { omitSupervisorSensitiveFields } from "./lib/sensitive-data";

const testUrl = process.env.TEST_DATABASE_URL;
const applicationUrl = process.env.DATABASE_URL;

if (!testUrl || process.env.REQUIRE_ISOLATED_TEST_DATABASE !== "1") {
  throw new Error("store-sales-global integration requires TEST_DATABASE_URL and REQUIRE_ISOLATED_TEST_DATABASE=1.");
}

function databaseNameFromUrl(value: string): string {
  const name = decodeURIComponent(new URL(value).pathname).replace(/^\/+/, "");
  if (!name || name.includes("/")) throw new Error("TEST_DATABASE_URL must name one database.");
  return name;
}

function assertNoFinancialKeys(value: unknown, path = "response"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoFinancialKeys(item, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]/g, "");
    assert.ok(!normalized.includes("costo") && !normalized.includes("margen") &&
      !normalized.includes("utilidad"), `SUPERVISOR leaked ${path}.${key}`);
    assertNoFinancialKeys(nested, `${path}.${key}`);
  }
}

test("store sales global reports isolated sold-line hierarchy and enforces scope", async () => {
  const expectedDatabase = databaseNameFromUrl(testUrl!);
  const {
    pool,
    createTestDatabaseGuard,
    ensureCashSessionSchema,
    ensureTicketIvaSchema,
    ensureTicketLineTypesSchema,
    ensurePendingCostsSchema,
    ensureClientesSchema,
    ensureSupervisorRole,
  } = await import("@workspace/db");
  const { assertIsolated } = await createTestDatabaseGuard(pool, testUrl!, applicationUrl);
  await assertIsolated();
  assert.equal(
    (await pool.query<{ database: string }>("SELECT current_database() AS database")).rows[0]?.database,
    expectedDatabase,
    "the test connection must use TEST_DATABASE_URL's database",
  );

  // These migrations must finish before app (and its route graph) is imported.
  await Promise.all([
    ensureCashSessionSchema(pool),
    ensureTicketIvaSchema(pool),
    ensureTicketLineTypesSchema(pool),
    ensurePendingCostsSchema(pool),
    ensureClientesSchema(pool),
    ensureSupervisorRole(pool),
  ]);
  const { summarizeStoreSalesGlobal } = await import("./lib/admin-analytics");
  const allUnknown = summarizeStoreSalesGlobal([{
    ticketId: 999_001,
    tela: "prueba pendiente",
    color: "sin costo",
    tipo: "METREADO",
    unidad: "METRO",
    cantidad: 1,
    importe: 25,
    allocatedGross: 25,
    costoTotal: null,
  }]);
  assert.deepEqual((allUnknown.modalidades as Array<Record<string, unknown>>)[0], {
    tipo: "METREADO", unidad: "METRO", cantidad: "1.000", operaciones: 1,
    importe: "25.00", utilidad: null, utilidadStatus: "PENDIENTE",
    lineasSinCosto: 1, lineasExcluidasSinCosto: 1,
  }, "an all-unknown bucket is pending, never zero utility");
  const { default: app } = await import("./app");
  const tag = `GSA-${randomUUID()}`;
  const one = async (text: string, values: unknown[] = []) =>
    (await pool.query<Record<string, unknown>>(text, values)).rows[0]!;
  let server: Server | undefined;
  try {
    const initials = await pool.query<{ initials: string }>(
      `SELECT chr(a)||chr(b)||chr(c) initials FROM generate_series(65,90) a
       CROSS JOIN generate_series(65,90) b CROSS JOIN generate_series(65,90) c
       WHERE NOT EXISTS (SELECT 1 FROM ubicaciones u WHERE u.iniciales=chr(a)||chr(b)||chr(c))
       LIMIT 2`,
    );
    assert.equal(initials.rows.length, 2);
    const store = await one(`INSERT INTO ubicaciones(nombre,iniciales,tipo) VALUES($1,$2,'TIENDA') RETURNING id`,
      [`${tag} tienda`, initials.rows[0]!.initials]);
    const otherStore = await one(`INSERT INTO ubicaciones(nombre,iniciales,tipo) VALUES($1,$2,'TIENDA') RETURNING id`,
      [`${tag} otra`, initials.rows[1]!.initials]);
    const addUser = async (role: string, location: number | null, scope = "TODAS") => one(
      `INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id,alcance_consulta)
       VALUES($1,$2,crypt('Test1234!',gen_salt('bf',8)),$3,$4,$5) RETURNING id,usuario`,
      [`${tag} ${role}`, `${tag}-${role}`.toLowerCase(), role, location, scope],
    );
    const admin = await addUser("ADMIN", null);
    const propia = await addUser("CAJA", Number(store.id), "PROPIA");
    const supervisor = await addUser("SUPERVISOR", Number(store.id));
    const client = await one(`INSERT INTO clientes(nombre) VALUES($1) RETURNING id`, [`${tag} cliente`]);
    const productMetro = await one(
      `INSERT INTO productos(sku,tela,color,unidad,precio_sugerido) VALUES($1,$2,$3,'METRO',100) RETURNING id`,
      [`${tag}-M`, `${tag} tela`, `${tag} color`],
    );
    const productKilo = await one(
      `INSERT INTO productos(sku,tela,color,unidad,precio_sugerido) VALUES($1,$2,$3,'KILO',100) RETURNING id`,
      [`${tag}-K`, `${tag} tela`, `${tag} color kilo`],
    );
    const roll = await one(
      `INSERT INTO rollos(serie,producto_id,ubicacion_id,estado,cantidad_inicial,cantidad_actual)
       VALUES($1,$2,$3,'DISPONIBLE',10,10) RETURNING id`,
      [`${tag}-rollo`, productMetro.id, store.id],
    );
    let folio = 1_800_000_000 + Math.floor(Math.random() * 10_000_000);
    const createdAt = new Date("2025-01-10T18:00:00.000Z");
    const addTicket = async (total: number, state: "VENDIDO" | "CANCELADO", credit = false) => one(
      `INSERT INTO tickets(folio,ubicacion_id,usuario_terminal_id,cliente_id,subtotal,iva,total,estado,cobrado,
        credito,dias_plazo,fecha_vencimiento,uuid_cliente,created_at)
       VALUES($1,$2,$3,$4,$5,0,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [++folio, store.id, admin.id, client.id, total, state, credit, credit,
        credit ? 30 : null, credit ? "2025-02-09" : null, randomUUID(), createdAt],
    );
    const creditTicket = await addTicket(160, "VENDIDO", true);
    const kiloTicket = await addTicket(50, "VENDIDO");
    const cancelled = await addTicket(99, "CANCELADO");
    await pool.query(
      `INSERT INTO ticket_lineas(ticket_id,rollo_id,producto_id,tipo,cantidad,precio_unitario,precio_sugerido,importe,costo_unitario_congelado,costo_total_congelado,costo_referencia_estado)
       VALUES ($1,$2,$3,'NORMAL',1,100,100,100,60,60,NULL),
              ($1,NULL,$3,'METREADO',2,20,100,40,10,20,'AVERAGE_12_MONTHS'),
              ($1,NULL,$3,'METREADO',1,20,100,20,NULL,NULL,'NO_COST'),
               ($4,NULL,$5,'METREADO',1,50,100,50,10,10,'AVERAGE_12_MONTHS'),
              ($6,$2,$3,'NORMAL',1,99,100,99,50,50,NULL)`,
      [creditTicket.id, roll.id, productMetro.id, kiloTicket.id, productKilo.id, cancelled.id],
    );

    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server!.listen(0, "127.0.0.1", resolve);
      server!.once("error", reject);
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api`;
    const login = async (usuario: string) => {
      const response = await fetch(`${base}/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, password: "Test1234!" }),
      });
      assert.equal(response.status, 200, await response.text());
      const cookie = response.headers.get("set-cookie")?.match(/mariana_session=([^;]+)/)?.[0];
      assert.ok(cookie);
      return cookie!;
    };
    const get = async (path: string, cookie: string) => {
      const response = await fetch(`${base}${path}`, { headers: { Cookie: cookie } });
      return { status: response.status, body: await response.json() as Record<string, unknown> };
    };
    const adminCookie = await login(String(admin.usuario));
    const global = await get(`/caja/tiendas/${store.id}/ventas/global?desde=2025-01-10&hasta=2025-01-10`, adminCookie);
    assert.equal(global.status, 200);
    assert.equal(global.body.totalImporte, "210.00");
    assert.equal(global.body.totalOperaciones, 2, "cancelled ticket must not be an operation");
    assert.equal(global.body.lineasSinCosto, 1);
    assert.equal(global.body.lineasExcluidasSinCosto, 1);
    const telas = global.body.telas as Array<Record<string, unknown>>;
    assert.equal(telas.reduce((sum, item) => sum + Number(item.importe), 0), 210);
    const colors = telas[0]!.colores as Array<Record<string, unknown>>;
    const color = colors.find((item) => item.color === `${tag} color`)!;
    assert.equal(color.utilityRollos, "40.00");
    assert.equal(color.utilityRollosStatus, "COMPLETA");
    assert.equal(color.utilityMetraje, "20.00");
    assert.equal(color.utilityMetrajeStatus, "PARCIAL");
    const modes = color.modalidades as Array<Record<string, unknown>>;
    assert.deepEqual(modes.map((mode) => [mode.tipo, mode.unidad, mode.cantidad, mode.utilidadStatus]), [
      ["NORMAL", "METRO", "1.000", "COMPLETA"],
      ["METREADO", "METRO", "3.000", "PARCIAL"],
    ]);
    const metered = modes.find((mode) => mode.tipo === "METREADO")!;
    assert.equal(metered.lineasSinCosto, 1);
    assert.equal(metered.lineasExcluidasSinCosto, 1);
    const kiloColor = colors.find((item) => item.color === `${tag} color kilo`)!;
    assert.deepEqual(
      (kiloColor.modalidades as Array<Record<string, unknown>>).map((mode) => [
        mode.tipo, mode.unidad, mode.cantidad, mode.utilidad,
      ]),
      [["METREADO", "KILO", "1.000", "40.00"]],
    );

    let detailSum = 0;
    const detailIds: number[] = [];
    for (let page = 1; ; page += 1) {
      const detail = await get(`/caja/tiendas/${store.id}/ventas?desde=2025-01-10&hasta=2025-01-10&page=${page}&pageSize=1`, adminCookie);
      assert.equal(detail.status, 200);
      for (const item of detail.body.items as Array<Record<string, unknown>>) {
        detailSum += Number(item.importe);
        detailIds.push(Number(item.id));
      }
      if (page * Number(detail.body.pageSize) >= Number(detail.body.total)) break;
    }
    assert.equal(detailSum.toFixed(2), global.body.totalImporte);
    assert.ok(!detailIds.includes(Number(cancelled.id)), "cancelled ticket must be excluded from detail");

    const empty = await get(`/caja/tiendas/${store.id}/ventas/global?desde=2025-01-11&hasta=2025-01-11`, adminCookie);
    assert.equal(empty.status, 200);
    assert.equal(empty.body.lineasSinCosto, 0);
    assert.equal(empty.body.lineasExcluidasSinCosto, 0);
    assert.equal((await get(`/caja/tiendas/${otherStore.id}/ventas/global?desde=2025-01-10&hasta=2025-01-10`,
      await login(String(propia.usuario)))).status, 403);
    const supervisorResult = await get(`/caja/tiendas/${store.id}/ventas/global?desde=2025-01-10&hasta=2025-01-10`,
      await login(String(supervisor.usuario)));
    assert.equal(supervisorResult.status, 403, "SUPERVISOR matrix denies resumen_caja");
    const redacted = omitSupervisorSensitiveFields(global.body, true);
    assertNoFinancialKeys(redacted);
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await pool.end();
  }
});