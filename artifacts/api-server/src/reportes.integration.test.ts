import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import ExcelJS from "exceljs";

const testUrl = process.env.TEST_DATABASE_URL;
const applicationUrl = process.env.DATABASE_URL;

/*
 * This suite is deliberately opt-in.  Do this validation before importing the
 * pool: importing @workspace/db creates a connection using DATABASE_URL.
 */
if (!testUrl) {
  test.skip("reportes database integration (TEST_DATABASE_URL not set)", () => {});
} else {
  if (testUrl === applicationUrl) {
    throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL; refusing to mutate the application database.");
  }
  test("reportes build committed, isolated decision reports", async (t) => {
    const [{ pool }, reports, sales, inventory, commercial, { requierePermiso }, { toExcelNumber }] = await Promise.all([
      import("@workspace/db"),
      import("./lib/reportes"),
      import("./lib/reportes-sales"),
      import("./lib/reportes-inventory"),
      import("./lib/reportes-commercial"),
      import("./lib/permisos"),
      import("@workspace/number-format"),
    ]);
    const { createTestDatabaseGuard } = await import("@workspace/db");
    const { assertIsolated } = await createTestDatabaseGuard(
      pool,
      testUrl,
      applicationUrl,
    );
    await assertIsolated();
    const tag = `RPI-${randomUUID()}`;
    const ids = { sites: [] as number[], users: [] as number[], clients: [] as number[], suppliers: [] as number[],
      products: [] as number[], entries: [] as number[], rolls: [] as number[], tickets: [] as number[],
      payments: [] as number[], credit: [] as number[], movements: [] as number[] };
    const one = async (sql: string, values: unknown[] = []) => (await pool.query(sql, values)).rows[0]!;
    const now = new Date();
    const from = new Date(now.getTime() - 8 * 86400000);
    const date = (offset: number) => new Date(now.getTime() + offset * 86400000);
    let folio = 1_900_000_000 + Math.floor(Math.random() * 10_000_000);
    const table = (report: Record<string, any>, id: string) =>
      report.tables.find((item: { id: string }) => item.id === id) as { rows: Record<string, unknown>[] };
    const kpi = (report: Record<string, any>, id: string) =>
      report.kpis.find((item: { id: string }) => item.id === id) as { value: number };

    try {
      for (const [index, name] of ["Norte", "Sur"].entries()) {
        const initials = randomUUID()
          .replace(/-/g, "")
          .slice(0, 3)
          .split("")
          .map((character) => String.fromCharCode(65 + Number.parseInt(character, 16)))
          .join("");
        ids.sites.push(Number((await one(
          "INSERT INTO ubicaciones(nombre,iniciales,tipo,activa) VALUES($1,$2,'TIENDA',true) RETURNING id",
          [`${tag}-${name}`, initials],
        )).id));
      }
      for (const [index, role] of ["ADMIN", "CAJA"].entries()) {
        ids.users.push(Number((await one(
          `INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id,activo)
           VALUES($1,$2,'integration-only',$3,$4,true) RETURNING id`,
          [`${tag}-U${index}`, `${tag.toLowerCase()}-${index}`, role, ids.sites[index]],
        )).id));
      }
      for (const name of ["Cliente A", "Cliente B"]) ids.clients.push(Number((await one(
        "INSERT INTO clientes(nombre,activo) VALUES($1,true) RETURNING id", [`${tag}-${name}`],
      )).id));
      ids.suppliers.push(Number((await one(
        "INSERT INTO proveedores(nombre,tipo,activo) VALUES($1,'NACIONAL',true) RETURNING id", [`${tag}-Proveedor`],
      )).id));
      const products = [
        ["M-ROJO", "Algodon", "Rojo", "METRO"], ["M-AZUL", "Lino", "Azul", "METRO"],
        ["K-ROJO", "Mezclilla", "Rojo", "KILO"], ["K-VERDE", "Lana", "Verde", "KILO"],
      ];
      for (const [sku, tela, color, unidad] of products) ids.products.push(Number((await one(
        "INSERT INTO productos(sku,tela,color,unidad,precio_sugerido) VALUES($1,$2,$3,$4,100) RETURNING id",
        [`${tag}-${sku}`, tela, color, unidad],
      )).id));
      for (let index = 0; index < ids.products.length; index += 1) {
        const entry = await one(
          `INSERT INTO entradas(folio,fecha,ubicacion_id,proveedor_id,usuario_id,total_rollos,total_costo,uuid_cliente)
           VALUES($1,$2,$3,$4,$5,1,$6,$7) RETURNING id`,
          [
            folio++,
            date(-7),
            ids.sites[index % 2],
            ids.suppliers[0],
            ids.users[0],
            2000 + index * 500,
            randomUUID(),
          ],
        );
        ids.entries.push(Number(entry.id));
        const roll = await one(
          `INSERT INTO rollos(serie,producto_id,ubicacion_id,recepcion_id,estado,cantidad_inicial,cantidad_actual,costo_unitario,costo_total)
           VALUES($1,$2,$3,$4,'DISPONIBLE',100,80,$5,$6) RETURNING id`,
          [`${tag}-${index}`, ids.products[index], ids.sites[index % 2], entry.id, 20 + index * 5, 2000 + index * 500],
        );
        ids.rolls.push(Number(roll.id));
        await pool.query(
          "INSERT INTO existencias(producto_id,ubicacion_id,cantidad_total,rollos_count) VALUES($1,$2,80,1)",
          [ids.products[index], ids.sites[index % 2]],
        );
        const movement = await one(
          `INSERT INTO movimientos(tipo,producto_id,rollo_id,ubicacion_id,cantidad,saldo_posterior,usuario_id,created_at)
           VALUES('RECEPCION',$1,$2,$3,100,100,$4,$5) RETURNING id`,
          [ids.products[index], roll.id, ids.sites[index % 2], ids.users[0], date(-7)],
        );
        ids.movements.push(Number(movement.id));
      }
      const adjustment = await one(
        `INSERT INTO movimientos(tipo,producto_id,rollo_id,ubicacion_id,cantidad,saldo_posterior,usuario_id,created_at)
         VALUES('AJUSTE_NEGATIVO',$1,$2,$3,-3,77,$4,$5) RETURNING id`,
        [ids.products[0], ids.rolls[0], ids.sites[0], ids.users[1], date(-2)],
      );
      ids.movements.push(Number(adjustment.id));

      const addTicket = async (input: { product: number; site: number; qty: number; price: number; cost: number;
        state?: "VENDIDO" | "CANCELADO"; roll?: boolean; client?: number; days?: number; facturado?: boolean }) => {
        const subtotal = input.qty * input.price;
        const ticket = await one(
          `INSERT INTO tickets(folio,uuid_cliente,ubicacion_id,usuario_terminal_id,cliente_id,subtotal,iva,tasa_iva,total,
            estado,cobrado,cobrado_at,facturado,created_at,cancelado_at,cancelado_por,motivo_cancelacion)
            VALUES($1,$2,$3,$4,$5,$6,16,0.16,$7,$8,true,$9,$10,$9,$11,$12,$13) RETURNING id`,
          [folio++, randomUUID(), ids.sites[input.site], ids.users[1], ids.clients[input.client ?? 0], subtotal, subtotal + 16,
            input.state ?? "VENDIDO", date(input.days ?? -1), input.facturado ?? false, input.state === "CANCELADO" ? date(-1) : null,
            input.state === "CANCELADO" ? ids.users[0] : null, input.state === "CANCELADO" ? `${tag}-cancel` : null],
        );
        ids.tickets.push(Number(ticket.id));
        await pool.query(
          `INSERT INTO ticket_lineas(ticket_id,rollo_id,producto_id,tipo,cantidad,precio_unitario,precio_sugerido,importe,costo_unitario_congelado,costo_total_congelado)
           VALUES($1,$2,$3,$4,$5,$6,100,$7,$8,$9)`,
          [ticket.id, input.roll === false ? null : ids.rolls[input.product], ids.products[input.product],
            input.roll === false ? "METREADO" : "NORMAL", input.qty, input.price, subtotal,
            input.roll === false ? null : input.cost, input.roll === false ? null : input.cost * input.qty],
        );
        const payment = await one("INSERT INTO ticket_pagos(ticket_id,forma_pago,importe,usuario_id,created_at) VALUES($1,'EFECTIVO',$2,$3,$4) RETURNING id",
          [ticket.id, subtotal + 16, ids.users[1], date(input.days ?? -1)]);
        ids.payments.push(Number(payment.id));
        return Number(ticket.id);
      };
      const sold = await addTicket({ product: 0, site: 0, qty: 4, price: 80, cost: 20, days: -1, facturado: true });
      await addTicket({ product: 0, site: 1, qty: 2, price: 60, cost: 20, client: 1, days: -1 });
      await addTicket({ product: 2, site: 0, qty: 3, price: 90, cost: 30, days: -2 });
      await addTicket({ product: 1, site: 1, qty: 1, price: 100, cost: 25, roll: false, days: -1 });
      await addTicket({ product: 3, site: 1, qty: 2, price: 120, cost: 35, state: "CANCELADO", days: -1 });
      const mixedTicket = await one(
        `INSERT INTO tickets(folio,uuid_cliente,ubicacion_id,usuario_terminal_id,cliente_id,subtotal,iva,total,
          estado,cobrado,cobrado_at,facturado,created_at)
         VALUES($1,$2,$3,$4,$5,100,0,100,'VENDIDO',true,$6,false,$6) RETURNING id`,
        [folio++, randomUUID(), ids.sites[0], ids.users[1], ids.clients[0], date(-1)],
      );
      ids.tickets.push(Number(mixedTicket.id));
      await pool.query(
        `INSERT INTO ticket_lineas(ticket_id,rollo_id,producto_id,tipo,cantidad,precio_unitario,precio_sugerido,
          importe,costo_unitario_congelado,costo_total_congelado,costo_referencia_estado)
         VALUES
          ($1,$2,$3,'NORMAL',3,20,100,60,10,30,NULL),
          ($1,NULL,$4,'METREADO',2,20,100,40,10,20,'AVERAGE_12_MONTHS')`,
        [mixedTicket.id, ids.rolls[0], ids.products[0], ids.products[1]],
      );
      ids.payments.push(Number((await one(
        "INSERT INTO ticket_pagos(ticket_id,forma_pago,importe,usuario_id,created_at) VALUES($1,'EFECTIVO',100,$2,$3) RETURNING id",
        [mixedTicket.id, ids.users[1], date(-1)],
      )).id));
      for (const [type, amount] of [["VENTA_CREDITO", 100], ["ABONO", -25]] as const) {
        ids.credit.push(Number((await one(
          `INSERT INTO movimientos_credito(cliente_id,ticket_id,tipo,importe,usuario_id,notas,dias_plazo,fecha_vencimiento)
           VALUES($1,$2,$3,$4,$5,$6,30,(now() AT TIME ZONE 'America/Mexico_City')::date+30) RETURNING id`,
          [ids.clients[0], sold, type, amount, ids.users[0], tag],
        )).id));
      }

      const input = { periodo: "personalizado", desde: from.toISOString().slice(0, 10), hasta: now.toISOString().slice(0, 10) };
      await t.test("sales and margin use frozen, valid lines and filter correctly", async () => {
        const ventas = await reports.buildReport("ventas", input, undefined, true) as Record<string, any>;
        const utilidad = await reports.buildReport("utilidad", input, undefined, true) as Record<string, any>;
        assert.equal(kpi(ventas, "ventas").value, 910, "cancelled sale excluded; mixed sale components remain");
        assert.equal(kpi(utilidad, "utilidad-exacta").value, null, "missing metered cost keeps utility pending");
        assert.equal(kpi(utilidad, "margen-exacto").value, null, "pending cost never becomes a false margin");
        assert.equal(kpi(utilidad, "margen-rollos").value, 530 / 770 * 100, "roll margin uses line subtotal, not IVA");
        const facturado = await reports.buildReport("utilidad", { ...input, facturado: true }, undefined, true) as Record<string, any>;
        assert.equal(kpi(facturado, "margen-rollos").value, 75, "an invoiced ticket margin still uses its 320 subtotal, not its 336 total");
        assert.equal(kpi(utilidad, "margen-metraje").value, null, "metered component remains independently pending");
        assert.deepEqual(table(utilidad, "utilidad-por-modalidad").rows.map(row => row.modalidad).sort(), ["METRAJE", "ROLLOS"]);
        assert.equal(table(utilidad, "calidad-costos").rows.find(r => r.calidad === "Costo pendiente")?.lineas, 1);
        const porSitio = table(ventas, "por-sitio").rows;
        assert.equal(new Set(porSitio.map((row) => row.dimension)).size, 2);
        assert.ok(porSitio.every((row) => row.modalidad && row.unidad));
        const red = await reports.buildReport("ventas", { ...input, colores: "Rojo", unidades: "METRO", ubicacionIds: String(ids.sites[0]) }, undefined, true) as Record<string, any>;
        assert.equal(kpi(red, "ventas").value, 380, "combined transversal color/site/unit filters");
        const metraje = await reports.buildReport("ventas", { ...input, modalidad: "METRAJE" }, undefined, true) as Record<string, any>;
        assert.equal(kpi(metraje, "ventas").value, 140, "modality filter is enforced by sale-line SQL");
        assert.ok(table(metraje, "por-sitio").rows.every(row => row.modalidad === "METRAJE"));
        const rollos = await reports.buildReport("ventas", { ...input, modalidad: "ROLLOS" }, undefined, true) as Record<string, any>;
        assert.equal(kpi(rollos, "ventas").value, 770);
        assert.deepEqual((await reports.buildReport("ventas", { ...input, colores: "" }, undefined, true) as Record<string, any>).activeFilters.includes("colores="), false);
        assert.ok(table(ventas, "canasta-pares").rows.length >= 0);
      });
      await t.test("inventory, color, heat map, purchase and client blocks are coherent", async () => {
        const [inv, color, heat, purchases, clients] = await Promise.all(["inventario", "color", "mapas-calor", "compras", "clientes"].map(section =>
          reports.buildReport(section as any, { ...input, coberturaMinima: 25, coberturaMaxima: 70 }, undefined, true) as Promise<Record<string, any>>));
        assert.ok(table(inv, "existencia-actual").rows.some(r => r.unidad === "METRO") && table(inv, "existencia-actual").rows.some(r => r.unidad === "KILO"));
        assert.ok(table(inv, "existencia-actual").rows.some(r => Number(r.vendidoRollos) > 0));
        assert.ok(table(inv, "existencia-actual").rows.some(r => Number(r.vendidoMetraje) > 0));
        assert.ok(table(inv, "comprado-vendido").rows.some(r => r.ajusteNegativo === 3));
        assert.ok(table(inv, "sin-movimiento").rows.some(r => r.sku === `${tag}-K-VERDE`) === false);
        assert.ok(table(color, "ranking-color").rows.filter(r => r.color === "Rojo").length >= 2, "color ranks across fabrics");
        assert.ok((color.charts as any[]).some(c => c.id === "color-tela"));
        assert.ok((heat.charts as any[]).every(c => ["cantidad", "ventas", "utilidad"].every(key => c.series.some((s: any) => s.key === key))));
        assert.ok(table(purchases, "compras-por-rollo").rows.length === 4);
        assert.ok(table(purchases, "productos").rows.every(r => r.estadoCostoReferencia === "AVERAGE_12_MONTHS"));
        assert.ok(table(clients, "clientes").rows.some(r => Number(r.comprasRollos) > 0 && Number(r.comprasMetraje) > 0));
        assert.ok(table(clients, "cuentas-por-cobrar-fifo").rows.some(r => Number(r.saldo) === 75));
        const paymentRows = table(clients, "formas-pago").rows;
        assert.deepEqual(paymentRows.map((row) => row.modalidad).sort(), ["METRAJE", "ROLLOS"]);
        assert.equal(paymentRows.reduce((sum, row) => sum + Number(row.importe), 0), 974);
        const [heatMetered, colorMetered, clientMetered, clientRolls] = await Promise.all([
          reports.buildReport("mapas-calor", { ...input, modalidad: "METRAJE" }, undefined, true),
          reports.buildReport("color", { ...input, modalidad: "METRAJE" }, undefined, true),
          reports.buildReport("clientes", { ...input, modalidad: "METRAJE" }, undefined, true),
          reports.buildReport("clientes", { ...input, modalidad: "ROLLOS" }, undefined, true),
        ] as Array<Promise<Record<string, any>>>);
        assert.ok((heatMetered.charts as any[]).every(chart => chart.rows.every((row: any) => row.modalidad === "METRAJE")));
        assert.ok(table(colorMetered, "ranking-color").rows.every(r => r.modalidad === "METRAJE"));
        assert.ok(table(clientMetered, "clientes").rows.every(r => Number(r.comprasRollos) === 0));
        assert.equal(table(clientMetered, "formas-pago").rows.reduce((sum, row) => sum + Number(row.importe), 0), 156);
        assert.equal(table(clientRolls, "formas-pago").rows.reduce((sum, row) => sum + Number(row.importe), 0), 818);
      });
      await t.test("ranges, helper invariants, access redaction, exports and timing", async () => {
        const { GetReporteSeccionResponse } = await import("@workspace/api-zod");
        for (const period of ["diario", "semanal", "mensual", "trimestral", "semestral", "anual"]) assert.ok(reports.reportRange({ periodo: period }).desde <= reports.reportRange({ periodo: period }).hasta);
        const range = reports.reportRange(input); assert.equal(range.previousHasta.getTime() - range.previousDesde.getTime(), range.hasta.getTime() - range.desde.getTime());
        assert.equal(range.yearAgoDesde.getUTCFullYear(), range.desde.getUTCFullYear() - 1);
        // Representative invariants of the report engines (kept explicit, not duplicated loops).
        assert.equal(sales.safePercent(20, 10), 100); assert.equal(sales.safePercent(1, 0), 0);
        assert.equal(sales.abcClass(80), "A"); assert.equal(sales.abcClass(90), "B"); assert.equal(sales.abcClass(96), "C");
        assert.equal(inventory.classifyCoverage(null), "SIN_VENTAS"); assert.equal(inventory.classifyCoverage(10, 7, 15, 45, 90), "BAJO");
        assert.equal(inventory.classifyCoverage(20, 7, 15, 45, 90), "NORMAL"); assert.equal(inventory.classifyCoverage(91, 7, 15, 45, 90), "EXCESO");
        assert.equal(inventory.classifyNoMovement(null), "SIN_MOVIMIENTOS"); assert.ok(inventory.reconciles(10, 10, null));
        assert.deepEqual(commercial.fifoAllocateAging([{ amount: 100 }], 25)[0].outstanding, 75);
        const timed = await Promise.all(reports.REPORT_SECTIONS.map(async (section: any) => {
          const start = performance.now();
          const value = await reports.buildReport(section, input, undefined, true);
          assert.ok(performance.now() - start < 3000, `${section} exceeded 3000ms`);
          GetReporteSeccionResponse.parse(value);
          return value as Record<string, any>;
        }));
        const publicReport = await reports.buildReport("inventario", input, undefined, false) as Record<string, any>;
        assert.doesNotMatch(
          JSON.stringify(publicReport),
          /"economic":true|"(?:[^"]*(?:costo|margen|utilidad|importe|precio|capital|ahorro|saldo|cobrar|valor)[^"]*)":/i,
          "economic fields are physically redacted",
        );
        let status = 0; await requierePermiso("reportes", "ver")({ auth: { user: { id: -1, rol: "CAJA" } } } as never, { status(code: number) { status = code; return this; }, json() { return this; } } as never, (() => assert.fail("permission bypass")) as never);
        assert.equal(status, 403);
        const sheet = new ExcelJS.Workbook().addWorksheet("x"); sheet.columns = [{ header: "Ventas", key: "ventas" }]; sheet.addRow({ ventas: toExcelNumber(kpi(timed[0], "ventas").value) }); assert.equal(typeof sheet.getCell("A2").value, "number");
      });
    } finally {
      // Finance ledgers may be immutable in production-like schemas; disable only
      // the known immutability trigger and always restore it.
      try { await pool.query("ALTER TABLE movimientos_credito DISABLE TRIGGER movimientos_credito_inmutables"); } catch {}
      try { await pool.query("ALTER TABLE ticket_pagos DISABLE TRIGGER ticket_pagos_inmutables"); } catch {}
      for (const [sql, values] of [
        ["DELETE FROM movimientos_credito WHERE id=ANY($1::int[])", ids.credit], ["DELETE FROM ticket_pagos WHERE id=ANY($1::int[])", ids.payments],
        ["DELETE FROM ticket_lineas WHERE ticket_id=ANY($1::int[])", ids.tickets], ["DELETE FROM tickets WHERE id=ANY($1::int[])", ids.tickets],
        ["DELETE FROM movimientos WHERE id=ANY($1::int[])", ids.movements],
        ["DELETE FROM existencias WHERE producto_id=ANY($1::int[])", ids.products],
        ["DELETE FROM rollos WHERE id=ANY($1::int[])", ids.rolls], ["DELETE FROM entradas WHERE id=ANY($1::int[])", ids.entries],
        ["DELETE FROM productos WHERE id=ANY($1::int[])", ids.products], ["DELETE FROM proveedores WHERE id=ANY($1::int[])", ids.suppliers],
        ["DELETE FROM clientes WHERE id=ANY($1::int[])", ids.clients], ["DELETE FROM usuarios WHERE id=ANY($1::int[])", ids.users],
        ["DELETE FROM ubicaciones WHERE id=ANY($1::int[])", ids.sites],
      ] as Array<[string, number[]]>) if (values.length) await pool.query(sql, [values]);
      try { await pool.query("ALTER TABLE movimientos_credito ENABLE TRIGGER movimientos_credito_inmutables"); } catch {}
      try { await pool.query("ALTER TABLE ticket_pagos ENABLE TRIGGER ticket_pagos_inmutables"); } catch {}
      await pool.end();
    }
  });
}