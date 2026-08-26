import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import test from "node:test";

const originalDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is required; refusing to use DATABASE_URL.");
}
if (originalDatabaseUrl && originalDatabaseUrl === testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL must differ from the original DATABASE_URL.");
}
const parsedTestUrl = new URL(testDatabaseUrl);
const expectedDatabase = decodeURIComponent(parsedTestUrl.pathname.replace(/^\//, ""));
if (!expectedDatabase || !/(test|ci)/i.test(`${parsedTestUrl.hostname}/${expectedDatabase}`)) {
  throw new Error("TEST_DATABASE_URL must visibly identify an isolated test/CI database.");
}

// Do not assign DATABASE_URL here. @workspace/db detects this *.test.ts file,
// validates TEST_DATABASE_URL against the original DATABASE_URL, and selects
// TEST_DATABASE_URL internally before it creates the pool.

type Actor = { id: number; cookie: string; role: string };
type ApiResult = { status: number; body: any; response: Response; bytes?: Buffer };

test("isolated live contenedores HTTP and transaction matrix", async (t) => {
  const [{ pool }, { default: app }, { default: ExcelJS }] = await Promise.all([
    import("@workspace/db"),
    import("./app"),
    import("exceljs"),
  ]);
  let server: Server | undefined;
  let baseUrl = "";
  const tag = `CONT-IT-${randomUUID()}`;
  const created = {
    sites: [] as number[],
    providers: [] as number[],
    products: [] as number[],
    users: [] as number[],
    sessions: [] as string[],
    containers: [] as number[],
  };

  async function assertDatabaseIdentity(stage: string) {
    const result = await pool.query("SELECT current_database() AS name");
    const actual = String(result.rows[0]?.name ?? "");
    assert.equal(actual, expectedDatabase, `${stage}: pool points at the URL pathname database`);
    assert.match(actual, /test|ci/i, `${stage}: database name is visibly isolated`);
  }

  // The first live database operation is intentionally this identity query.
  await t.test("database identity before every mutation", async () => {
    await assertDatabaseIdentity("initial");
    assert.notEqual(testDatabaseUrl, originalDatabaseUrl);
  });

  const one = async (text: string, values: unknown[] = []) =>
    (await pool.query(text, values)).rows[0] as Record<string, unknown>;

  async function actor(
    role: string,
    siteId: number | null,
    permissions: Record<string, [boolean, boolean, boolean, boolean]>,
  ): Promise<Actor> {
    const username = `${tag}-${role}-${randomUUID()}`.toLowerCase();
    const row = await one(
      `INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id,alcance_consulta,activo)
       VALUES($1,$2,'integration-session-only',$3,$4,'PROPIA',true) RETURNING id`,
      [`${tag} ${role}`, username, role, siteId],
    );
    const id = Number(row.id);
    created.users.push(id);
    for (const [module, flags] of Object.entries(permissions)) {
      await pool.query(
        `INSERT INTO permisos_usuario(usuario_id,modulo,puede_ver,puede_crear,puede_editar,puede_autorizar)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [id, module, ...flags],
      );
    }
    const session = randomUUID();
    await pool.query(
      `INSERT INTO sesiones(id,usuario_id,expira_at,ip,user_agent)
       VALUES($1,$2,now()+interval '1 hour','127.0.0.1',$3)`,
      [session, id, tag],
    );
    created.sessions.push(session);
    return { id, role, cookie: `mariana_session=${session}` };
  }

  async function api(
    method: string,
    path: string,
    who: Actor,
    body?: unknown,
    binary = false,
  ): Promise<ApiResult> {
    const response = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: {
        Cookie: who.cookie,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (binary) {
      return {
        status: response.status,
        body: null,
        response,
        bytes: Buffer.from(await response.arrayBuffer()),
      };
    }
    return {
      status: response.status,
      body: contentType.includes("json") ? await response.json() : await response.text(),
      response,
    };
  }

  const noEconomicKeys = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.every(noEconomicKeys);
    if (!value || typeof value !== "object") return true;
    return Object.entries(value as Record<string, unknown>).every(
      ([key, child]) =>
        !/(costo|participacion)/i.test(key) && noEconomicKeys(child),
    );
  };

  const containerBody = (
    providerId: number,
    siteId: number,
    lines: Array<{ productoId: number; cantidadEsperada: string; rollosEsperados?: number }>,
    reference = tag,
  ) => ({
    proveedorId: providerId,
    referencia: reference,
    fechaPedido: "2026-01-02",
    fechaEstimadaLlegada: "2026-02-02",
    sitioDestinoId: siteId,
    notas: tag,
    lineas: lines,
  });

  let ownSite = 0;
  let otherSite = 0;
  let providerId = 0;
  let meterExpected = 0;
  let kiloExpected = 0;
  let expectedOnly = 0;
  let unexpected = 0;
  let admin!: Actor;
  let inventarios!: Actor;
  let bodega!: Actor;
  let bodegaNoSite!: Actor;
  let terminal!: Actor;
  let caja!: Actor;

  try {
    await assertDatabaseIdentity("before fixture mutation");
    ownSite = Number((await one(
      "INSERT INTO ubicaciones(nombre,tipo,activa) VALUES($1,'BODEGA',true) RETURNING id",
      [`${tag}-own`],
    )).id);
    otherSite = Number((await one(
      "INSERT INTO ubicaciones(nombre,tipo,activa) VALUES($1,'TIENDA',true) RETURNING id",
      [`${tag}-other`],
    )).id);
    created.sites.push(ownSite, otherSite);
    providerId = Number((await one(
      "INSERT INTO proveedores(nombre,tipo,activo) VALUES($1,'NACIONAL',true) RETURNING id",
      [`${tag}-provider`],
    )).id);
    created.providers.push(providerId);

    for (const [suffix, unit] of [
      ["meter", "METRO"],
      ["kilo", "KILO"],
      ["expected-only", "METRO"],
      ["unexpected", "METRO"],
    ] as const) {
      const product = await one(
        `INSERT INTO productos(sku,tela,color,unidad,precio_sugerido,activo)
         VALUES($1,$2,$3,$4,10,true) RETURNING id`,
        [`${tag}-${suffix}`, `${tag}-fabric-${suffix}`, `${tag}-color-${suffix}`, unit],
      );
      created.products.push(Number(product.id));
    }
    [meterExpected, kiloExpected, expectedOnly, unexpected] = created.products;

    const contFull: [boolean, boolean, boolean, boolean] = [true, true, true, true];
    const contEdit: [boolean, boolean, boolean, boolean] = [true, true, true, false];
    const contView: [boolean, boolean, boolean, boolean] = [true, false, false, false];
    const denied: [boolean, boolean, boolean, boolean] = [false, false, false, false];
    admin = await actor("ADMIN", ownSite, {});
    inventarios = await actor("SUPERVISOR", ownSite, {
      contenedores: contEdit,
      entradas: [true, true, false, false],
    });
    bodega = await actor("BODEGA", ownSite, {
      contenedores: contView,
      entradas: [true, true, false, false],
    });
    bodegaNoSite = await actor("BODEGA", null, { contenedores: contView });
    terminal = await actor("TERMINAL", ownSite, { contenedores: denied });
    caja = await actor("CAJA", ownSite, { contenedores: denied });
    void contFull;

    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    baseUrl = `http://127.0.0.1:${address.port}`;
    await t.test("database identity after HTTP harness start", () =>
      assertDatabaseIdentity("after harness start"));

    await t.test("role permission matrix is enforced by live endpoints", async () => {
      assert.equal((await api("GET", "/contenedores", terminal)).status, 403);
      assert.equal((await api("GET", "/contenedores", caja)).status, 403);
      assert.equal((await api("GET", "/contenedores", bodegaNoSite)).status, 403);
      assert.equal((await api("GET", "/contenedores/catalogos", bodegaNoSite)).status, 403);
      const catalogs = await api("GET", "/contenedores/catalogos", bodega);
      assert.equal(catalogs.status, 200);
      assert.deepEqual(catalogs.body.sitios.map((site: any) => site.id), [ownSite]);
    });

    let cancelledId = 0;
    await t.test("ADMIN create/list/detail/update/cancel lifecycle and folio sequence", async () => {
      const before = await one(
        `SELECT
          (SELECT count(*) FROM rollos WHERE producto_id=ANY($1::int[])) rollos,
          (SELECT count(*) FROM movimientos m JOIN rollos r ON r.id=m.rollo_id WHERE r.producto_id=ANY($1::int[])) movimientos,
          (SELECT count(*) FROM existencias WHERE producto_id=ANY($1::int[])) existencias`,
        [created.products],
      );
      const first = await api("POST", "/contenedores", admin,
        containerBody(providerId, ownSite, [{ productoId: meterExpected, cantidadEsperada: "10", rollosEsperados: 2 }], `${tag}-cancel`));
      assert.equal(first.status, 201);
      cancelledId = first.body.id;
      created.containers.push(cancelledId);
      const second = await api("POST", "/contenedores", admin,
        containerBody(providerId, ownSite, [{ productoId: meterExpected, cantidadEsperada: "11" }], `${tag}-folio-2`));
      assert.equal(second.status, 201);
      created.containers.push(second.body.id);
      assert.equal(second.body.folio, first.body.folio + 1);
      const patched = await api("PATCH", `/contenedores/${cancelledId}`, admin,
        containerBody(providerId, ownSite, [{ productoId: meterExpected, cantidadEsperada: "12", rollosEsperados: 3 }], `${tag}-updated`));
      assert.equal(patched.status, 200);
      assert.equal(patched.body.referencia, `${tag}-updated`);
      const list = await api("GET", `/contenedores?search=${encodeURIComponent(tag)}`, admin);
      assert.equal(list.status, 200);
      assert.ok(list.body.items.some((row: any) => row.id === cancelledId && row.lineas === 1));
      assert.equal((await api("GET", `/contenedores/${cancelledId}`, admin)).status, 200);
      const cancelled = await api("POST", `/contenedores/${cancelledId}/cancelar`, admin,
        { motivo: "Cancelación válida del escenario aislado" });
      assert.equal(cancelled.status, 200);
      assert.equal(cancelled.body.estado, "CANCELADO");
      assert.equal((await api("PATCH", `/contenedores/${cancelledId}`, admin,
        containerBody(providerId, ownSite, [{ productoId: meterExpected, cantidadEsperada: "9" }]))).status, 409);
      const after = await one(
        `SELECT
          (SELECT count(*) FROM rollos WHERE producto_id=ANY($1::int[])) rollos,
          (SELECT count(*) FROM movimientos m JOIN rollos r ON r.id=m.rollo_id WHERE r.producto_id=ANY($1::int[])) movimientos,
          (SELECT count(*) FROM existencias WHERE producto_id=ANY($1::int[])) existencias`,
        [created.products],
      );
      assert.deepEqual(after, before, "container CRUD must not mutate inventory");
    });

    await t.test("line duplicate and quantity validation are rejected", async () => {
      const duplicate = containerBody(providerId, ownSite, [
        { productoId: meterExpected, cantidadEsperada: "1" },
        { productoId: meterExpected, cantidadEsperada: "2" },
      ]);
      assert.equal((await api("POST", "/contenedores", admin, duplicate)).status, 400);
      const invalid = containerBody(providerId, ownSite, [
        { productoId: meterExpected, cantidadEsperada: "0" },
      ]);
      assert.equal((await api("POST", "/contenedores", admin, invalid)).status, 400);
    });

    await t.test("SUPERVISOR creates and edits but cannot cancel", async () => {
      const made = await api("POST", "/contenedores", inventarios,
        containerBody(providerId, ownSite, [{ productoId: meterExpected, cantidadEsperada: "3" }], `${tag}-inv`));
      assert.equal(made.status, 201);
      created.containers.push(made.body.id);
      assert.equal((await api("PATCH", `/contenedores/${made.body.id}`, inventarios,
        containerBody(providerId, ownSite, [{ productoId: meterExpected, cantidadEsperada: "4" }]))).status, 200);
      assert.equal((await api("POST", `/contenedores/${made.body.id}/cancelar`, inventarios,
        { motivo: "No debe autorizar cancelación" })).status, 403);
    });

    await t.test("BODEGA sees only its assigned site and unassigned BODEGA is fail-closed", async () => {
      const other = await api("POST", "/contenedores", admin,
        containerBody(providerId, otherSite, [{ productoId: meterExpected, cantidadEsperada: "1" }], `${tag}-other-site`));
      assert.equal(other.status, 201);
      created.containers.push(other.body.id);
      const own = await api("GET", `/contenedores?search=${encodeURIComponent(tag)}`, bodega);
      assert.equal(own.status, 200);
      assert.ok(own.body.items.every((row: any) => row.sitioDestinoId === ownSite));
      assert.equal((await api("GET", `/contenedores/${other.body.id}`, bodega)).status, 404);
      assert.equal((await api("GET", "/contenedores/resumen?year=2026", bodegaNoSite)).status, 403);
    });

    let linkedContainer = 0;
    let linkedEntry = 0;
    const linkUuid = randomUUID();
    await t.test("linked entrada is idempotent, receives container, and creates inventory once", async () => {
      const made = await api("POST", "/contenedores", admin,
        containerBody(providerId, ownSite, [
          { productoId: meterExpected, cantidadEsperada: "10", rollosEsperados: 2 },
          { productoId: kiloExpected, cantidadEsperada: "5", rollosEsperados: 1 },
          { productoId: expectedOnly, cantidadEsperada: "7", rollosEsperados: 1 },
        ], `${tag}-linked`));
      assert.equal(made.status, 201);
      linkedContainer = made.body.id;
      created.containers.push(linkedContainer);
      const payload = {
        ubicacionId: ownSite,
        proveedorId: providerId,
        contenedorId: linkedContainer,
        uuidCliente: linkUuid,
        observaciones: tag,
        lineas: [
          { productoId: meterExpected, costoUnitario: "2.00", cantidades: ["4", "6"] },
          { productoId: kiloExpected, costoUnitario: "4.00", cantidades: ["5"] },
          { productoId: unexpected, costoUnitario: "3.00", cantidades: ["3"] },
        ],
      };
      const [a, b] = await Promise.all([
        api("POST", "/inventario/entradas", admin, payload),
        api("POST", "/inventario/entradas", admin, payload),
      ]);
      assert.equal(a.status, 201);
      assert.equal(b.status, 201);
      assert.equal(a.body.id, b.body.id);
      linkedEntry = a.body.id;
      const counts = await one(
        `SELECT
          (SELECT count(*) FROM entradas WHERE uuid_cliente=$1)::int entradas,
          (SELECT count(*) FROM rollos WHERE recepcion_id=$2)::int rollos,
          (SELECT count(*) FROM movimientos m JOIN rollos r ON r.id=m.rollo_id WHERE r.recepcion_id=$2)::int movimientos,
          (SELECT count(*) FROM existencias WHERE ubicacion_id=$3 AND producto_id=ANY($4::int[]))::int existencias`,
        [linkUuid, linkedEntry, ownSite, created.products],
      );
      assert.equal(Number(counts.entradas), 1);
      assert.equal(Number(counts.rollos), 4);
      assert.equal(Number(counts.movimientos), 4);
      assert.equal(Number(counts.existencias), 3);
      const detail = await api("GET", `/contenedores/${linkedContainer}`, admin);
      assert.equal(detail.body.estado, "RECIBIDO");
      assert.match(detail.body.fechaRealLlegada, /^\d{4}-\d{2}-\d{2}$/);
      const byProduct = new Map<number, any>(
        detail.body.lineas.map((line: any) => [line.productoId, line]),
      );
      assert.equal(byProduct.get(expectedOnly)?.cantidadRecibida, "0.000");
      assert.equal(byProduct.get(unexpected)?.id, null);
      assert.equal(byProduct.get(unexpected)?.cantidadEsperada, "0.000");
      assert.equal(byProduct.get(unexpected)?.rollosRecibidos, 1);
      assert.equal(byProduct.get(meterExpected)?.costoUnitarioReal, "2.0000");
      assert.equal(detail.body.totalesRecibidos.rollos, 4);
      assert.equal((await api("POST", "/inventario/entradas", admin, {
        ...payload,
        uuidCliente: randomUUID(),
      })).status, 400, "a received container cannot be linked to a second entrada");
      assert.equal((await api("PATCH", `/contenedores/${linkedContainer}`, admin,
        containerBody(providerId, ownSite, [{ productoId: meterExpected, cantidadEsperada: "1" }]))).status, 409);
    });

    await t.test("pending costs stay null and summary units/differences are complete", async () => {
      const pending = await api("POST", "/contenedores", admin,
        containerBody(providerId, ownSite, [{ productoId: meterExpected, cantidadEsperada: "2" }], `${tag}-pending`));
      created.containers.push(pending.body.id);
      const pendingEntry = await api("POST", "/inventario/entradas", bodega, {
        ubicacionId: ownSite,
        proveedorId: providerId,
        contenedorId: pending.body.id,
        uuidCliente: randomUUID(),
        observaciones: tag,
        lineas: [{ productoId: meterExpected, cantidades: ["2"] }],
      });
      assert.equal(pendingEntry.status, 201);
      const year = new Date().getFullYear();
      const summary = await api("GET", `/contenedores/resumen?year=${year}`, admin);
      assert.equal(summary.status, 200);
      assert.equal(summary.body.periodo.costoTotal, null);
      assert.equal(summary.body.periodo.costoPromedio, null);
      assert.ok(summary.body.porProveedor.some((row: any) => row.costoTotal === null && row.participacion === null));
      assert.ok(summary.body.porProducto.some((row: any) => row.productoId === unexpected));
      assert.ok(summary.body.porTela.every((row: any) => row.unidad === "METRO" || row.unidad === "KILO"));
      assert.ok(summary.body.porColor.every((row: any) => row.unidad === "METRO" || row.unidad === "KILO"));
      assert.ok(summary.body.diferencias.some((row: any) => row.producto_id === unexpected && Number(row.esperado) === 0));
    });

    await t.test("ADMIN economics exist and non-admin JSON economics are recursively absent", async () => {
      const year = new Date().getFullYear();
      const adminDetail = await api("GET", `/contenedores/${linkedContainer}`, admin);
      assert.ok(Object.hasOwn(adminDetail.body, "costoTotal"));
      const bodegaDetail = await api("GET", `/contenedores/${linkedContainer}`, bodega);
      assert.equal(bodegaDetail.status, 200);
      assert.ok(noEconomicKeys(bodegaDetail.body));
      const adminList = await api("GET", `/contenedores?search=${encodeURIComponent(tag)}`, admin);
      assert.ok(adminList.body.items.some((row: any) => Object.hasOwn(row, "costoTotal")));
      const bodegaList = await api("GET", `/contenedores?search=${encodeURIComponent(tag)}`, bodega);
      assert.ok(noEconomicKeys(bodegaList.body));
      const bodegaSummary = await api("GET", `/contenedores/resumen?year=${year}`, bodega);
      assert.ok(noEconomicKeys(bodegaSummary.body));
    });

    await t.test("XLSX and PDF exports are complete, typed, nonempty, and non-admin-redacted", async () => {
      const year = new Date().getFullYear();
      const xlsx = await api("GET", `/contenedores/export.xlsx?year=${year}`, bodega, undefined, true);
      assert.equal(xlsx.status, 200);
      assert.match(xlsx.response.headers.get("content-type") ?? "", /spreadsheetml/);
      assert.ok((xlsx.bytes?.length ?? 0) > 500);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(xlsx.bytes! as any);
      assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), [
        "Situacion actual", "Periodo", "Proveedores", "Productos",
        "Telas", "Colores", "Mensual", "Diferencias",
      ]);
      for (const sheet of workbook.worksheets) {
        const headers = (sheet.getRow(1).values as unknown[]).map(String);
        assert.ok(headers.every((header) => !/(costo|participacion)/i.test(header)));
      }
      const pdf = await api("GET", `/contenedores/export.pdf?year=${year}`, bodega, undefined, true);
      assert.equal(pdf.status, 200);
      assert.match(pdf.response.headers.get("content-type") ?? "", /application\/pdf/);
      assert.ok((pdf.bytes?.length ?? 0) > 200);
      const text = pdf.bytes!.toString("latin1");
      for (const label of ["Situacion actual", "Periodo", "Proveedores", "Productos", "Diferencias"]) {
        assert.match(text, new RegExp(label));
      }
      assert.doesNotMatch(text, /costo|participacion/i);
    });
  } finally {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => (error ? reject(error) : resolve())),
      );
    }
    // Cleanup is ID/tag-scoped and ordered from transactional children outward.
    if (created.users.length) {
      await pool.query(
        `DELETE FROM movimientos WHERE usuario_id=ANY($1::int[])
          OR rollo_id IN (SELECT id FROM rollos WHERE recepcion_id IN
            (SELECT id FROM entradas WHERE usuario_id=ANY($1::int[])))`,
        [created.users],
      );
      await pool.query(
        `DELETE FROM existencias WHERE ubicacion_id=ANY($1::int[])
          AND producto_id=ANY($2::int[])`,
        [created.sites, created.products],
      );
      await pool.query(
        `DELETE FROM rollos WHERE recepcion_id IN
          (SELECT id FROM entradas WHERE usuario_id=ANY($1::int[]))`,
        [created.users],
      );
      await pool.query("UPDATE contenedores SET entrada_id=NULL,estado='EN_TRANSITO',fecha_real_llegada=NULL WHERE usuario_id=ANY($1::int[])", [created.users]);
      await pool.query(
        `DELETE FROM pagos_proveedor WHERE entrada_id IN
          (SELECT id FROM entradas WHERE usuario_id=ANY($1::int[]))`,
        [created.users],
      );
      await pool.query("DELETE FROM entradas WHERE usuario_id=ANY($1::int[])", [created.users]);
      await pool.query("DELETE FROM contenedores WHERE usuario_id=ANY($1::int[])", [created.users]);
      await pool.query("DELETE FROM sesiones WHERE usuario_id=ANY($1::int[])", [created.users]);
      await pool.query("DELETE FROM permisos_usuario WHERE usuario_id=ANY($1::int[])", [created.users]);
      await pool.query("DELETE FROM auditoria WHERE usuario_id=ANY($1::int[])", [created.users]);
      await pool.query("DELETE FROM usuarios WHERE id=ANY($1::int[])", [created.users]);
    }
    if (created.products.length)
      await pool.query("DELETE FROM productos WHERE id=ANY($1::int[])", [created.products]);
    if (created.providers.length)
      await pool.query("DELETE FROM proveedores WHERE id=ANY($1::int[])", [created.providers]);
    if (created.sites.length)
      await pool.query("DELETE FROM ubicaciones WHERE id=ANY($1::int[])", [created.sites]);
  }
});