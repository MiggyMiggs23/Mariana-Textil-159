import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import test from "node:test";

// Fail closed before importing anything that can initialize @workspace/db.
const testUrl = process.env.TEST_DATABASE_URL;
const applicationUrl = process.env.DATABASE_URL;
if (process.env.NODE_ENV !== "test") throw new Error("Task 58 requiere NODE_ENV=test.");
if (!testUrl) throw new Error("Task 58 requiere TEST_DATABASE_URL explícita.");
if (testUrl === applicationUrl) throw new Error("TEST_DATABASE_URL debe ser distinta de DATABASE_URL.");
const parsedTestUrl = new URL(testUrl);
const expectedDatabase = decodeURIComponent(parsedTestUrl.pathname).replace(/^\/+/, "");
if (!expectedDatabase || expectedDatabase.includes("/")) {
  throw new Error("TEST_DATABASE_URL debe nombrar exactamente una base.");
}
if (!/(test|ci|e2e)/i.test(`${parsedTestUrl.hostname}/${expectedDatabase}`)) {
  throw new Error("TEST_DATABASE_URL debe identificar visiblemente una base aislada.");
}

type Actor = { id: number; sessionId: string; cookie: string };
type Json = Record<string, unknown>;

test("Task 58: pisos funcionan de extremo a extremo sin contaminar el kardex", async (t) => {
  const [
    {
      db,
      pool,
      ensureAuditSchema,
      ensureAuditoriaInventarioSchema,
      ensurePisosSchema,
      ensureSalidasSchema,
      createTestDatabaseGuard,
    },
    { default: app },
    salidas,
    inventario,
    auditoriaInventario,
  ] = await Promise.all([
    import("@workspace/db"),
    import("./app"),
    import("./lib/salidas"),
    import("./lib/inventario"),
    import("./lib/auditoria-inventario"),
  ]);
  const { assertIsolated } = await createTestDatabaseGuard(pool, testUrl, applicationUrl);
  const assertDatabase = async (stage: string) => {
    await assertIsolated();
    const current = (await pool.query<{ database: string }>(
      "SELECT current_database() AS database",
    )).rows[0]?.database;
    assert.equal(current, expectedDatabase, `${stage}: conexión fuera de TEST_DATABASE_URL`);
    assert.match(current ?? "", /test|ci|e2e/i);
  };
  await assertDatabase("inicio");
  await assertDatabase("antes de ensureAuditSchema");
  await ensureAuditSchema(pool);
  await assertDatabase("antes de ensurePisosSchema");
  await ensurePisosSchema(pool);
  await assertDatabase("antes de ensureSalidasSchema");
  await ensureSalidasSchema(pool);
  await assertDatabase("antes de ensureAuditoriaInventarioSchema");
  await ensureAuditoriaInventarioSchema(pool);

  const tag = `T58-${randomUUID()}`;
  const hex = randomUUID().replaceAll("-", "");
  const initialsBase = String.fromCharCode(
    65 + (Number.parseInt(hex.slice(0, 2), 16) % 26),
  );
  const initials = (offset: number) =>
    `Z${initialsBase}${String.fromCharCode(65 + (offset % 26))}`;
  const fixture = {
    sites: [] as number[],
    users: [] as number[],
    sessions: [] as string[],
    products: [] as number[],
  };
  let server: Server | undefined;

  // Every fixture mutation rechecks current_database immediately beforehand.
  const mutate = async <T extends Json>(sql: string, values: unknown[] = []): Promise<T[]> => {
    await assertDatabase("antes de mutar fixture");
    return (await pool.query<T>(sql, values)).rows;
  };
  const one = async <T extends Json>(sql: string, values: unknown[] = []) => {
    const row = (await mutate<T>(sql, values))[0];
    assert.ok(row);
    return row;
  };
  type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
  const domainMutation = async <T>(operation: (tx: Tx) => Promise<T>): Promise<T> => {
    await assertDatabase("antes de mutación de dominio");
    return db.transaction(operation);
  };
  const makeActor = async (
    role: "ADMIN" | "BODEGA" | "CAJA",
    siteId: number,
    permissions: string[],
  ): Promise<Actor> => {
    const user = await one<{ id: number }>(
      `INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id,alcance_consulta,activo)
       VALUES($1,$2,'integration-session-only',$3,$4,'PROPIA',true) RETURNING id`,
      [`${tag} ${role}`, `${tag}-${role}-${randomUUID()}`.toLowerCase(), role, siteId],
    );
    fixture.users.push(Number(user.id));
    for (const modulo of permissions) {
      await mutate(
        `INSERT INTO permisos_usuario(usuario_id,modulo,puede_ver,puede_crear,puede_editar,puede_autorizar)
         VALUES($1,$2,true,true,true,true)`,
        [user.id, modulo],
      );
    }
    const sessionId = randomUUID();
    await mutate(
      `INSERT INTO sesiones(id,usuario_id,expira_at,ip,user_agent)
       VALUES($1,$2,now()+interval '2 hours','127.0.0.1',$3)`,
      [sessionId, user.id, tag],
    );
    fixture.sessions.push(sessionId);
    return { id: Number(user.id), sessionId, cookie: `mariana_session=${sessionId}` };
  };

  try {
    const [source, destination, floorless] = await Promise.all([
      one<{ id: number }>(
        "INSERT INTO ubicaciones(nombre,iniciales,tipo,activa) VALUES($1,$2,'BODEGA',true) RETURNING id",
        [`${tag} origen`, initials(0)],
      ),
      one<{ id: number }>(
        "INSERT INTO ubicaciones(nombre,iniciales,tipo,activa) VALUES($1,$2,'BODEGA',true) RETURNING id",
        [`${tag} destino`, initials(4)],
      ),
      one<{ id: number }>(
        "INSERT INTO ubicaciones(nombre,iniciales,tipo,activa) VALUES($1,$2,'BODEGA',true) RETURNING id",
        [`${tag} sin pisos`, initials(8)],
      ),
    ]);
    const sourceId = Number(source.id);
    const destinationId = Number(destination.id);
    const floorlessId = Number(floorless.id);
    fixture.sites.push(sourceId, destinationId, floorlessId);

    const product = await one<{ id: number }>(
      `INSERT INTO productos(sku,tela,color,unidad,precio_sugerido,activo,se_vende_por_metro)
       VALUES($1,$2,$3,'METRO',20,true,true) RETURNING id`,
      [`${tag}-SKU`, `${tag} tela`, `${tag} color`],
    );
    const productId = Number(product.id);
    fixture.products.push(productId);
    const admin = await makeActor("ADMIN", sourceId, []);
    const bodega = await makeActor("BODEGA", sourceId, [
      "ubicaciones",
      "entradas",
      "inventario",
      "auditoria_inventario",
    ]);
    const cajaDestino = await makeActor("CAJA", destinationId, []);

    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const api = async (method: string, path: string, actor: Actor, body?: unknown) => {
      if (method !== "GET") await assertDatabase(`antes de HTTP ${method} ${path}`);
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Cookie: actor.cookie,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const value = (await response.json()) as unknown;
      return { status: response.status, body: value };
    };

    let floorA = 0;
    let floorB = 0;
    let inactiveFloor = 0;
    let destinationFloor = 0;
    await t.test("CRUD/listado usa sesión real, ADMIN administra y no ADMIN es rechazado", async () => {
      const deniedCreate = await api("POST", `/locations/${sourceId}/pisos`, bodega, {
        nombre: "Prohibido",
        activo: true,
      });
      assert.equal(deniedCreate.status, 403);

      const createdA = await api("POST", `/locations/${sourceId}/pisos`, admin, {
        nombre: "  Planta   Baja  ",
        activo: true,
      });
      assert.equal(createdA.status, 201);
      floorA = Number((createdA.body as Json).id);
      assert.equal((createdA.body as Json).nombre, "Planta Baja");
      const createdB = await api("POST", `/locations/${sourceId}/pisos`, admin, {
        nombre: "Mezanine",
        activo: true,
      });
      floorB = Number((createdB.body as Json).id);
      const inactive = await api("POST", `/locations/${sourceId}/pisos`, admin, {
        nombre: "Archivo",
        activo: true,
      });
      inactiveFloor = Number((inactive.body as Json).id);
      const destinationCreated = await api("POST", `/locations/${destinationId}/pisos`, admin, {
        nombre: "Recepción",
        activo: true,
      });
      destinationFloor = Number((destinationCreated.body as Json).id);
      assert.ok(floorA && floorB && inactiveFloor && destinationFloor);

      assert.equal(
        (await api("PATCH", `/locations/${sourceId}/pisos/${floorA}`, bodega, {
          nombre: "No autorizado",
        })).status,
        403,
      );
      const patched = await api("PATCH", `/locations/${sourceId}/pisos/${floorB}`, admin, {
        nombre: "Mezanine Norte",
      });
      assert.equal(patched.status, 200);
      assert.equal((patched.body as Json).nombre, "Mezanine Norte");
      const deactivated = await api(
        "PATCH",
        `/locations/${sourceId}/pisos/${inactiveFloor}`,
        admin,
        { activo: false },
      );
      assert.equal(deactivated.status, 200);
      assert.equal((deactivated.body as Json).activo, false, "la baja lógica completa el CRUD");

      const adminList = await api("GET", `/locations/${sourceId}/pisos`, admin);
      const bodegaList = await api("GET", `/locations/${sourceId}/pisos`, bodega);
      assert.equal(adminList.status, 200);
      assert.equal((adminList.body as unknown[]).length, 3);
      assert.deepEqual(
        (bodegaList.body as Json[]).map((item) => item.id).sort(),
        [floorA, floorB].sort(),
        "el listado operativo oculta pisos inactivos",
      );
    });

    const entryBody = (siteId: number, pisosPorCantidad?: Array<number | null>) => ({
      ubicacionId: siteId,
      uuidCliente: randomUUID(),
      observaciones: tag,
      lineas: [{
        productoId: productId,
        costoUnitario: "2.00",
        cantidades: pisosPorCantidad ? pisosPorCantidad.map(() => "5") : ["5"],
        ...(pisosPorCantidad === undefined ? {} : { pisosPorCantidad }),
      }],
    });
    let rolls: Array<{ id: number; serie: string }> = [];
    await t.test("entrada exige piso sólo si el sitio lo tiene y valida pertenencia/actividad", async () => {
      assert.equal(
        (await api("POST", "/inventario/entradas", admin, entryBody(sourceId))).status,
        400,
        "un sitio con pisos activos exige asignación por rollo",
      );
      assert.equal(
        (await api("POST", "/inventario/entradas", admin, entryBody(sourceId, [inactiveFloor]))).status,
        400,
      );
      assert.equal(
        (await api("POST", "/inventario/entradas", admin, entryBody(sourceId, [destinationFloor]))).status,
        400,
        "no acepta un piso de otro sitio",
      );
      const floorlessEntry = await api("POST", "/inventario/entradas", admin, entryBody(floorlessId));
      assert.equal(floorlessEntry.status, 201);
      assert.equal(((floorlessEntry.body as Json).rollos as Json[])[0]?.pisoId, null);

      const entry = await api(
        "POST",
        "/inventario/entradas",
        admin,
        entryBody(sourceId, [floorA, floorA, floorA, floorA]),
      );
      assert.equal(entry.status, 201);
      rolls = ((entry.body as Json).rollos as Json[]).map((roll) => ({
        id: Number(roll.id),
        serie: String(roll.serie),
      }));
      assert.equal(rolls.length, 4);
    });

    await t.test("cambio y filtro por piso son físicos: Bitácora sí, movimientos/existencias no", async () => {
      const roll = rolls[0]!;
      const movementsBefore = Number((await pool.query(
        "SELECT count(*)::int count FROM movimientos WHERE rollo_id=$1",
        [roll.id],
      )).rows[0]?.count);
      const stockBefore = (await pool.query(
        `SELECT producto_id,ubicacion_id,cantidad_total,rollos_count
           FROM existencias WHERE producto_id=$1 AND ubicacion_id=$2`,
        [productId, sourceId],
      )).rows;
      const changed = await api("PATCH", `/inventario/rollos/${roll.id}/piso`, admin, {
        pisoId: floorB,
      });
      assert.equal(changed.status, 200);
      assert.equal((changed.body as Json).pisoId, floorB);
      assert.equal(
        Number((await pool.query("SELECT count(*)::int count FROM movimientos WHERE rollo_id=$1", [roll.id])).rows[0]?.count),
        movementsBefore,
      );
      assert.deepEqual(
        (await pool.query(
          `SELECT producto_id,ubicacion_id,cantidad_total,rollos_count
             FROM existencias WHERE producto_id=$1 AND ubicacion_id=$2`,
          [productId, sourceId],
        )).rows,
        stockBefore,
      );
      assert.equal(
        (await pool.query(
          `SELECT 1 FROM auditoria WHERE entidad='rollos' AND entidad_id=$1 AND accion='CAMBIAR_PISO'`,
          [String(roll.id)],
        )).rowCount,
        1,
        "Bitácora conserva el cambio físico",
      );
      const filtered = await api(
        "GET",
        `/inventario/rollos?ubicacionId=${sourceId}&pisoId=${floorB}`,
        admin,
      );
      assert.equal(filtered.status, 200);
      assert.deepEqual(((filtered.body as Json).items as Json[]).map((item) => item.id), [roll.id]);
    });

    await t.test("tránsito limpia piso y recepción exige/asigna el piso destino", async () => {
      const roll = rolls[1]!;
      const transit = (await pool.query<{ id: number }>(
        "SELECT id FROM ubicaciones WHERE tipo='TRANSITO' AND activa=true ORDER BY id LIMIT 1",
      )).rows[0];
      assert.ok(transit, "la fixture aislada requiere la ubicación técnica TRANSITO");
      const salida = await domainMutation((tx) => salidas.crearSalida(tx, {
        origenId: sourceId,
        destinoId: destinationId,
        usuarioSolicitaId: admin.id,
        uuidCliente: randomUUID(),
        rolloIds: [roll.id],
      }));
      await domainMutation((tx) => salidas.enviarSalida(tx, {
        salidaId: salida.id,
        usuarioId: admin.id,
        transportista: "Integración Task 58",
      }));
      const inTransit = (await pool.query(
        "SELECT estado,ubicacion_id,piso_id FROM rollos WHERE id=$1",
        [roll.id],
      )).rows[0];
      assert.deepEqual(
        { estado: inTransit?.estado, ubicacionId: Number(inTransit?.ubicacion_id), pisoId: inTransit?.piso_id },
        { estado: "EN_TRANSITO", ubicacionId: Number(transit.id), pisoId: null },
      );
      assert.equal(
        (await api("POST", `/salidas/${salida.id}/recibir`, cajaDestino, {
          completa: true,
          pisosPorRollo: [{ rolloId: roll.id, pisoId: destinationFloor }],
        })).status,
        403,
        "un usuario destino sin salidas/crear no puede recibir ni asignar piso",
      );
      await assert.rejects(
        () => domainMutation((tx) => salidas.recibirSalida(tx, {
          salidaId: salida.id,
          usuarioId: admin.id,
          completa: true,
          ip: "127.0.0.1",
        })),
        /piso destino es obligatorio/,
      );
      await domainMutation((tx) => salidas.recibirSalida(tx, {
        salidaId: salida.id,
        usuarioId: admin.id,
        completa: true,
        ip: "127.0.0.1",
        pisosPorRollo: [{ rolloId: roll.id, pisoId: destinationFloor }],
      }));
      const received = (await pool.query(
        "SELECT estado,ubicacion_id,piso_id FROM rollos WHERE id=$1",
        [roll.id],
      )).rows[0];
      assert.deepEqual(
        { estado: received?.estado, ubicacionId: Number(received?.ubicacion_id), pisoId: Number(received?.piso_id) },
        { estado: "DISPONIBLE", ubicacionId: destinationId, pisoId: destinationFloor },
      );
    });

    await t.test("auditoría reporta MAL_ACOMODADO, confirma sólo piso y deja carreras manuales", async () => {
      const misplaced = rolls[2]!;
      const raced = rolls[3]!;
      const transit = (await pool.query<{ id: number }>(
        "SELECT id FROM ubicaciones WHERE tipo='TRANSITO' AND activa=true ORDER BY id LIMIT 1",
      )).rows[0]!;
      const opened = await domainMutation((tx) => auditoriaInventario.createAuditoria(tx, {
        ubicacionId: sourceId,
        usuarioId: admin.id,
        ip: "127.0.0.1",
      }));
      await domainMutation((tx) => auditoriaInventario.scanAuditoria(tx, {
        auditoriaId: opened.id,
        serie: rolls[0]!.serie,
        pisoId: floorB,
        usuarioId: admin.id,
        ip: "127.0.0.1",
      }));
      await domainMutation((tx) => auditoriaInventario.scanAuditoria(tx, {
        auditoriaId: opened.id,
        serie: misplaced.serie,
        pisoId: floorB,
        usuarioId: admin.id,
        ip: "127.0.0.1",
      }));
      await domainMutation((tx) => auditoriaInventario.scanAuditoria(tx, {
        auditoriaId: opened.id,
        serie: raced.serie,
        pisoId: floorB,
        usuarioId: admin.id,
        ip: "127.0.0.1",
      }));
      const detail = await db.transaction((tx) =>
        auditoriaInventario.buildAuditoriaDetail(tx, opened.id),
      );
      const result = detail.resultados.find((item) => item.rolloId === misplaced.id);
      assert.deepEqual(
        {
          clasificacion: result?.clasificacion,
          esperado: result?.pisoEsperadoId,
          real: result?.pisoRealId,
        },
        { clasificacion: "MAL_ACOMODADO", esperado: floorA, real: floorB },
      );
      await domainMutation((tx) => auditoriaInventario.transitionAuditoria(tx, {
        auditoriaId: opened.id,
        usuarioId: admin.id,
        ip: "127.0.0.1",
        action: "CERRAR",
      }));

      // Simula una carrera real posterior al cierre: el rollo cambia a sitio
      // técnico y estado EN_TRANSITO mediante la primitiva de dominio.
      await domainMutation((tx) => inventario.moverRollo(tx, {
        rolloId: raced.id,
        ubicacionOrigenId: sourceId,
        ubicacionTransitoId: transit.id,
        usuarioId: admin.id,
        documentoTipo: "PRUEBA_CARRERA",
        documentoId: String(opened.id),
      }));
      const movementCountBeforeConfirm = Number((await pool.query(
        "SELECT count(*)::int count FROM movimientos",
      )).rows[0]?.count);
      const existenceBeforeConfirm = (await pool.query(
        `SELECT producto_id,ubicacion_id,cantidad_total,rollos_count
           FROM existencias WHERE producto_id=$1 ORDER BY ubicacion_id`,
        [productId],
      )).rows;

      await domainMutation((tx) => auditoriaInventario.confirmAuditoria(tx, {
        auditoriaId: opened.id,
        usuarioId: admin.id,
        ip: "127.0.0.1",
      }));
      assert.equal(
        Number((await pool.query("SELECT piso_id FROM rollos WHERE id=$1", [misplaced.id])).rows[0]?.piso_id),
        floorB,
      );
      assert.equal(
        Number((await pool.query("SELECT count(*)::int count FROM movimientos")).rows[0]?.count),
        movementCountBeforeConfirm,
        "confirmar MAL_ACOMODADO no crea kardex",
      );
      assert.deepEqual(
        (await pool.query(
          `SELECT producto_id,ubicacion_id,cantidad_total,rollos_count
             FROM existencias WHERE producto_id=$1 ORDER BY ubicacion_id`,
          [productId],
        )).rows,
        existenceBeforeConfirm,
        "confirmar MAL_ACOMODADO no altera existencias",
      );
      assert.equal(
        (await pool.query(
          `SELECT resolucion FROM auditoria_inventario_snapshot
            WHERE auditoria_id=$1 AND rollo_id=$2`,
          [opened.id, raced.id],
        )).rows[0]?.resolucion,
        "RESOLUCION_MANUAL",
        "la carrera de sitio/estado no pisa inventario concurrente",
      );

      const surplusAudit = await domainMutation((tx) => auditoriaInventario.createAuditoria(tx, {
        ubicacionId: sourceId,
        usuarioId: admin.id,
        ip: "127.0.0.1",
      }));
      const expectedAtSource = (await pool.query<{ serie: string }>(
        "SELECT serie FROM rollos WHERE ubicacion_id=$1 AND estado='DISPONIBLE' ORDER BY id",
        [sourceId],
      )).rows;
      for (const item of expectedAtSource) {
        await domainMutation((tx) => auditoriaInventario.scanAuditoria(tx, {
          auditoriaId: surplusAudit.id,
          serie: item.serie,
          pisoId: floorB,
          usuarioId: admin.id,
          ip: "127.0.0.1",
        }));
      }
      const availableSurplus = rolls[1]!;
      for (const item of [availableSurplus, raced]) {
        await domainMutation((tx) => auditoriaInventario.scanAuditoria(tx, {
          auditoriaId: surplusAudit.id,
          serie: item.serie,
          pisoId: floorB,
          usuarioId: admin.id,
          ip: "127.0.0.1",
        }));
      }
      await domainMutation((tx) => auditoriaInventario.transitionAuditoria(tx, {
        auditoriaId: surplusAudit.id,
        usuarioId: admin.id,
        ip: "127.0.0.1",
        action: "CERRAR",
      }));
      await domainMutation((tx) => auditoriaInventario.confirmAuditoria(tx, {
        auditoriaId: surplusAudit.id,
        usuarioId: admin.id,
        ip: "127.0.0.1",
      }));
      for (const item of [availableSurplus, raced]) {
        const relocated = (await pool.query(
          "SELECT ubicacion_id,estado,piso_id FROM rollos WHERE id=$1",
          [item.id],
        )).rows[0];
        assert.deepEqual(
          {
            ubicacionId: Number(relocated?.ubicacion_id),
            estado: relocated?.estado,
            pisoId: Number(relocated?.piso_id),
          },
          { ubicacionId: sourceId, estado: "DISPONIBLE", pisoId: floorB },
          "los sobrantes disponibles o en tránsito usan el piso real capturado",
        );
        assert.equal(
          (await pool.query(
            `SELECT resolucion FROM auditoria_inventario_escaneos
              WHERE auditoria_id=$1 AND rollo_id=$2`,
            [surplusAudit.id, item.id],
          )).rows[0]?.resolucion,
          "APLICADA",
        );
      }
    });

    const cols = await pool.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.columns
       WHERE table_name IN ('movimientos','existencias') AND column_name='piso_id'`);
    assert.equal(cols.rows.length, 0, "piso_id no pertenece al kardex ni al cache");
  } finally {
    if (server) await new Promise<void>((resolve, reject) =>
      server!.close((error) => error ? reject(error) : resolve()));
    await assertDatabase("limpieza");
    // Auditoría es append-only. Sólo se retiran las credenciales efímeras; las
    // entidades etiquetadas quedan en la base desechable para no mutilar Bitácora.
    if (fixture.sessions.length) {
      await mutate("DELETE FROM sesiones WHERE id = ANY($1::uuid[])", [fixture.sessions]);
    }
    await pool.end();
  }
});