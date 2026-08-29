import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const testUrl = process.env.TEST_DATABASE_URL;
const applicationUrl = process.env.DATABASE_URL;

if (!testUrl) {
  test.skip("admin analytics database integration (TEST_DATABASE_URL not set)", () => {});
} else if (testUrl === applicationUrl) {
  throw new Error(
    "TEST_DATABASE_URL must differ from DATABASE_URL; refusing to mutate the application database.",
  );
} else {
  test("ADMIN analytics queries agree over isolated two-store fixtures", async () => {
    const [{ pool }, analytics, { requireRole }] = await Promise.all([
      import("@workspace/db"),
      import("./lib/admin-analytics"),
      import("./middlewares/auth"),
    ]);
    const tag = `AAI-${randomUUID()}`;
    const ids = {
      tickets: [] as number[], sessions: [] as number[], rollos: [] as number[],
      products: [] as number[], users: [] as number[], locations: [] as number[],
       clients: [] as number[], creditMovements: [] as number[], creditApplications: [] as number[],
    };
    const one = async (text: string, values: unknown[] = []) => {
      const result = await pool.query(text, values);
      return result.rows[0]!;
    };
    const now = new Date();
    const from = new Date(now.getTime() - 4 * 60 * 60_000);
    const to = new Date(now.getTime() + 60 * 60_000);
    let folio = 1_500_000_000 + Math.floor(Math.random() * 100_000_000);

    try {
      for (const name of ["Norte", "Sur"]) {
        const initials = randomUUID()
          .replace(/-/g, "")
          .slice(0, 3)
          .split("")
          .map((character) => String.fromCharCode(65 + Number.parseInt(character, 16)))
          .join("");
        const row = await one(
          `INSERT INTO ubicaciones(nombre,iniciales,tipo,activa) VALUES($1,$2,'TIENDA',true) RETURNING id`,
          [`${tag}-${name}`, initials],
        );
        ids.locations.push(Number(row.id));
      }
      for (const [index, role] of ["ADMIN", "CAJA", "TERMINAL"].entries()) {
        const row = await one(
          `INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id,activo)
           VALUES($1,$2,'integration-only',$3,$4,true) RETURNING id`,
          [`${tag}-U${index}`, `${tag.toLowerCase()}-${index}`, role, ids.locations[index % 2]],
        );
        ids.users.push(Number(row.id));
      }
      const client = await one(
        `INSERT INTO clientes(nombre,activo) VALUES($1,true) RETURNING id`,
        [`${tag}-Cliente`],
      );
      ids.clients.push(Number(client.id));
      for (const unit of ["METRO", "KILO", "BOLSA"]) {
        const product = await one(
          `INSERT INTO productos(sku,tela,color,unidad,precio_sugerido)
           VALUES($1,$2,$3,$4,100) RETURNING id`,
          [`${tag}-${unit}`, `${tag}-Tela-${unit}`, `${tag}-Color-${unit}`, unit],
        );
        ids.products.push(Number(product.id));
        const roll = await one(
          `INSERT INTO rollos(serie,producto_id,ubicacion_id,estado,cantidad_inicial,cantidad_actual,costo_unitario,costo_total)
           VALUES($1,$2,$3,'DISPONIBLE',100,100,50,5000) RETURNING id`,
          [`${Date.now()}${unit === "METRO" ? "1" : "2"}`, product.id, ids.locations[unit === "METRO" ? 0 : 1]],
        );
        ids.rollos.push(Number(roll.id));
      }

      // Two closed cuts in the report window: shortage 200 and surplus 150.
      const closedA = await one(
          `INSERT INTO sesiones_caja(ubicacion_id,usuario_id,abierta_at,fecha_operativa,cerrada_at,fondo_inicial,efectivo_contado,estado)
          VALUES($1,$2,$3,($3 AT TIME ZONE 'America/Mexico_City')::date,$4,100,0,'CERRADA') RETURNING id`,
        [ids.locations[0], ids.users[1], new Date(now.getTime() - 3 * 60 * 60_000), new Date(now.getTime() - 2 * 60 * 60_000)],
      );
      const closedB = await one(
          `INSERT INTO sesiones_caja(ubicacion_id,usuario_id,abierta_at,fecha_operativa,cerrada_at,fondo_inicial,efectivo_contado,estado)
          VALUES($1,$2,$3,($3 AT TIME ZONE 'America/Mexico_City')::date,$4,100,250,'CERRADA') RETURNING id`,
        [ids.locations[1], ids.users[2], new Date(now.getTime() - 3 * 60 * 60_000), new Date(now.getTime() - 2 * 60 * 60_000)],
      );
      ids.sessions.push(Number(closedA.id), Number(closedB.id));
      // An exact cut in the preceding week makes the trend's numerator and
      // denominator independently observable.
      const closedExact = await one(
          `INSERT INTO sesiones_caja(ubicacion_id,usuario_id,abierta_at,fecha_operativa,cerrada_at,fondo_inicial,efectivo_contado,estado)
          VALUES($1,$2,$3,($3 AT TIME ZONE 'America/Mexico_City')::date,$4,100,100,'CERRADA') RETURNING id`,
        [ids.locations[0], ids.users[1],
          new Date(now.getTime() - 9 * 24 * 60 * 60_000),
          new Date(now.getTime() - 8 * 24 * 60 * 60_000)],
      );
      ids.sessions.push(Number(closedExact.id));

      // Three additional current-month shortages, deliberately outside the selected report hours.
      const mexicoParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Mexico_City",
        year: "numeric",
        month: "2-digit",
      }).formatToParts(now);
      const mexicoYear = mexicoParts.find((part) => part.type === "year")!.value;
      const mexicoMonth = mexicoParts.find((part) => part.type === "month")!.value;
      const monthStart = analytics.parseAnalyticsFilters({
        desde: `${mexicoYear}-${mexicoMonth}-01`,
      }).desde!;
      for (let index = 0; index < 3; index += 1) {
        const session = await one(
          `INSERT INTO sesiones_caja(ubicacion_id,usuario_id,abierta_at,fecha_operativa,cerrada_at,fondo_inicial,efectivo_contado,estado)
            VALUES($1,$2,$3,($3 AT TIME ZONE 'America/Mexico_City')::date,$4,10,0,'CERRADA') RETURNING id`,
          [ids.locations[0], ids.users[1],
            new Date(monthStart.getTime() + index * 120_000),
            new Date(monthStart.getTime() + index * 120_000 + 60_000)],
        );
        ids.sessions.push(Number(session.id));
      }

      // Open sessions keep realtime store cards operational after historical cuts.
      for (let index = 0; index < 2; index += 1) {
        const session = await one(
          `INSERT INTO sesiones_caja(ubicacion_id,usuario_id,abierta_at,fecha_operativa,fondo_inicial,estado)
            VALUES($1,$2,$3,($3 AT TIME ZONE 'America/Mexico_City')::date,0,'ABIERTA') RETURNING id`,
          [ids.locations[index], ids.users[index + 1], from],
        );
        ids.sessions.push(Number(session.id));
      }

      const addTicket = async (input: {
        store: number; session: number; subtotal: number; iva?: number;
        state?: "VENDIDO" | "CANCELADO"; paid?: boolean; facturado?: boolean;
        payment?: "EFECTIVO" | "TRANSFERENCIA" | "CREDITO"; oldPending?: boolean;
         unit?: 0 | 1; paymentCreatedAt?: Date; createdAt?: Date;
      }) => {
        const created = input.createdAt ?? (input.oldPending ? new Date(now.getTime() - 90 * 60_000) : now);
        const total = input.subtotal + (input.iva ?? 0);
        const ticket = await one(
          `INSERT INTO tickets(folio,ubicacion_id,usuario_terminal_id,cliente_id,subtotal,iva,total,
             estado,cobrado,cobrado_at,usuario_caja_id,facturado,sesion_caja_id,uuid_cliente,created_at,
             cancelado_at,cancelado_por,motivo_cancelacion)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
           RETURNING id`,
          [folio++, ids.locations[input.store], ids.users[2], ids.clients[0], input.subtotal,
            input.iva ?? 0, total, input.state ?? "VENDIDO", input.paid ?? false,
            input.paid ? now : null, input.paid ? ids.users[1] : null,
            input.facturado ?? false, ids.sessions[input.session], randomUUID(), created,
            input.state === "CANCELADO" ? now : null,
            input.state === "CANCELADO" ? ids.users[0] : null,
            input.state === "CANCELADO" ? `${tag}-cancel` : null],
        );
        ids.tickets.push(Number(ticket.id));
        await pool.query(
          `INSERT INTO ticket_lineas(ticket_id,rollo_id,producto_id,tipo,cantidad,precio_unitario,
             precio_sugerido,importe,costo_unitario_congelado,costo_total_congelado)
            VALUES($1,$2,$3,'NORMAL',$4,$5,$5,$6,50,$7)`,
          [ticket.id, ids.rollos[input.unit ?? input.store], ids.products[input.unit ?? input.store],
            input.unit === 1 ? 2 : 3, input.subtotal / (input.unit === 1 ? 2 : 3),
            input.subtotal, input.subtotal / 2],
        );
        if (input.paid && input.payment) {
          await pool.query(
            `INSERT INTO ticket_pagos(ticket_id,forma_pago,importe,usuario_id,created_at)
             VALUES($1,$2,$3,$4,$5)`,
             [ticket.id, input.payment, total, ids.users[1], input.paymentCreatedAt ?? now],
          );
        }
        return Number(ticket.id);
      };

      // Closed cut A gets 100 cash: expected=200, counted=0 => shortage 200.
      await addTicket({ store: 0, session: 0, subtotal: 100, paid: true, payment: "EFECTIVO", unit: 0 });
      // A pending sold ticket in the same cut must not count as collected.
      await addTicket({ store: 0, session: 0, subtotal: 75, unit: 0 });
      // Four destination cards across both stores.
      await addTicket({ store: 0, session: 5, subtotal: 100, iva: 16, paid: true, payment: "EFECTIVO", unit: 0 });
       await addTicket({ store: 0, session: 5, subtotal: 200, iva: 32, paid: true, payment: "TRANSFERENCIA", facturado: true, unit: 0, createdAt: new Date(from.getTime() - 60_000), paymentCreatedAt: new Date(now.getTime() + 10_000) });
      await addTicket({ store: 1, session: 6, subtotal: 300, iva: 48, paid: true, payment: "TRANSFERENCIA", unit: 1 });
       const creditTicket = await addTicket({ store: 1, session: 6, subtotal: 400, paid: true, payment: "CREDITO", unit: 1 });
       const creditSale = await one(
         `INSERT INTO movimientos_credito(cliente_id,ticket_id,tipo,importe,usuario_id,created_at)
          VALUES($1,$2,'VENTA_CREDITO',400,$3,$4) RETURNING id`,
         [ids.clients[0], creditTicket, ids.users[1], now],
       );
       ids.creditMovements.push(Number(creditSale.id));
       // Production payment flow: ABONO has no ticket. Its applications resolve
       // the paid sales/documents; unapplied remainder remains client credit.
       const fiscalAbono = await one(
         `INSERT INTO movimientos_credito(cliente_id,ticket_id,tipo,importe,usuario_id,forma_pago,cuenta_destino,created_at)
          VALUES($1,NULL,'ABONO',-50,$2,'TRANSFERENCIA','CUENTA_FISCAL',$3) RETURNING id`,
         [ids.clients[0], ids.users[1], new Date(now.getTime() + 20_000)],
       );
       ids.creditMovements.push(Number(fiscalAbono.id));
       const creditApplication = await one(
         `INSERT INTO aplicaciones_credito(abono_movimiento_id,venta_movimiento_id,importe)
          VALUES($1,$2,30) RETURNING id`,
         [fiscalAbono.id, creditSale.id],
       );
       ids.creditApplications.push(Number(creditApplication.id));
       const reversedAbono = await one(
         `INSERT INTO movimientos_credito(cliente_id,tipo,importe,movimiento_origen_id,usuario_id,created_at)
          VALUES($1,'REVERSO',50,$2,$3,$4) RETURNING id`,
         [ids.clients[0], fiscalAbono.id, ids.users[0], new Date(now.getTime() + 30_000)],
       );
       ids.creditMovements.push(Number(reversedAbono.id));
       const fullyAppliedAbono = await one(
         `INSERT INTO movimientos_credito(cliente_id,tipo,importe,usuario_id,forma_pago,cuenta_destino,created_at)
          VALUES($1,'ABONO',-10,$2,'TRANSFERENCIA','CUENTA_FISCAL',$3) RETURNING id`,
         [ids.clients[0], ids.users[1], new Date(now.getTime() + 40_000)],
       );
       ids.creditMovements.push(Number(fullyAppliedAbono.id));
       const fullApplication = await one(
         `INSERT INTO aplicaciones_credito(abono_movimiento_id,venta_movimiento_id,importe)
          VALUES($1,$2,10) RETURNING id`,
         [fullyAppliedAbono.id, creditSale.id],
       );
       ids.creditApplications.push(Number(fullApplication.id));
       // Cancellation does not erase immutable credit evidence, but neither
       // the cancelled sale nor an application to it is a destination entry.
       const cancelledCreditTicket = await addTicket({
         store: 1, session: 6, subtotal: 60, state: "CANCELADO", unit: 1,
       });
       const cancelledCreditSale = await one(
         `INSERT INTO movimientos_credito(cliente_id,ticket_id,tipo,importe,usuario_id,created_at)
          VALUES($1,$2,'VENTA_CREDITO',60,$3,$4) RETURNING id`,
         [ids.clients[0], cancelledCreditTicket, ids.users[1], now],
       );
       ids.creditMovements.push(Number(cancelledCreditSale.id));
       const cancelledSaleAbono = await one(
         `INSERT INTO movimientos_credito(cliente_id,tipo,importe,usuario_id,forma_pago,cuenta_destino,created_at)
          VALUES($1,'ABONO',-60,$2,'TRANSFERENCIA','CUENTA_FISCAL',$3) RETURNING id`,
         [ids.clients[0], ids.users[1], new Date(now.getTime() + 50_000)],
       );
       ids.creditMovements.push(Number(cancelledSaleAbono.id));
       const cancelledSaleApplication = await one(
         `INSERT INTO aplicaciones_credito(abono_movimiento_id,venta_movimiento_id,importe)
          VALUES($1,$2,60) RETURNING id`,
         [cancelledSaleAbono.id, cancelledCreditSale.id],
       );
       ids.creditApplications.push(Number(cancelledSaleApplication.id));
      await addTicket({ store: 0, session: 5, subtotal: 50, oldPending: true, unit: 0 });
      await addTicket({ store: 1, session: 6, subtotal: 999, state: "CANCELADO", unit: 1 });

      const filters = { desde: from, hasta: to };
      const timed =
        await Promise.all([
          analytics.measureKpi("resumen", () => analytics.getSalesSummary(filters)),
          analytics.measureKpi("pendientes", () => analytics.getPending(filters)),
          analytics.measureKpi("tiendas-tiempo-real", () => analytics.getRealtimeStores(filters)),
          analytics.measureKpi("cortes", () => analytics.listCuts(filters, 1, 20, { soloConDiferencia: true })),
          analytics.measureKpi("diferencias", () => analytics.getDifferences(
            filters,
            { agrupacion: "semana", umbralCorte: 100, umbralTienda: 100 },
          )),
          analytics.measureKpi("cuentas-destino", () => analytics.getDestinationAccounts(filters)),
          analytics.measureKpi("cantidades", () => analytics.getQuantities(filters)),
          analytics.measureKpi("comparativo", () => analytics.compareStores(filters)),
        ]);
      for (const measurement of timed) {
        assert.ok(
          measurement.durationMs < 2_000,
          `${measurement.name} tardó ${measurement.durationMs.toFixed(1)} ms`,
        );
      }
      const [summary, pending, cards, cuts, differences, destinations, quantities, comparison] =
        [
          timed[0].value,
          timed[1].value,
          timed[2].value,
          timed[3].value,
          timed[4].value,
          timed[5].value,
          timed[6].value,
          timed[7].value,
        ] as const;

      assert.equal(Number(summary.ventas), Number(summary.cobrado) + Number(summary.pendiente));
      assert.ok(Number(summary.margen) > 0);
       assert.equal(summary.cancelaciones, 2);
      assert.equal(pending.tickets, 2);
      assert.ok(cards.some((card) => card.alertas.includes("PENDIENTE_MAS_30_MIN")));
      assert.ok(cards.reduce((sum, card) => sum + Number(card.margen), 0) > 0);
      assert.equal(cuts.total, 2);
      assert.equal(new Set(cuts.items.map((cut) => cut.ubicacionId)).size, 2);
      assert.deepEqual(cuts.items.map((cut) => Number(cut.diferencia)).sort((a, b) => a - b), [-200, 150]);
      assert.equal(cuts.items.find((cut) => cut.id === Number(closedA.id))?.ticketsCobrados, 1);

      assert.equal(differences.resumen.importeFaltantes, "200.00");
      assert.equal(differences.resumen.importeSobrantes, "150.00");
      assert.equal(differences.resumen.diferenciaNeta, "50.00");
      assert.equal(differences.resumen.diferenciaAbsoluta, "350.00");
      assert.ok(differences.alertas.some((alert) => alert.mensaje.includes("más de tres cortes con faltante")));
      assert.ok(differences.tendencia.length > 0);
      assert.deepEqual(differences.tendencia.map((period) => ({
        cortes: period.cortes,
        exactos: period.exactos,
        porcentajeExactos: period.porcentajeExactos,
      })), [{ cortes: 2, exactos: 0, porcentajeExactos: "0.00" }]);

      const exactPeriodTrend = await analytics.getDifferences({
        desde: new Date(now.getTime() - 9 * 24 * 60 * 60_000 - 60 * 60_000),
        hasta: new Date(now.getTime() - 8 * 24 * 60 * 60_000 + 60 * 60_000),
        ubicacionId: ids.locations[0],
      }, { agrupacion: "semana" });
      const exactPeriod = exactPeriodTrend.tendencia[0];
      assert.deepEqual(exactPeriod && {
        cortes: exactPeriod.cortes,
        exactos: exactPeriod.exactos,
        porcentajeExactos: exactPeriod.porcentajeExactos,
      }, { cortes: 1, exactos: 1, porcentajeExactos: "100.00" });
      for (const period of [...differences.tendencia, ...exactPeriodTrend.tendencia]) {
        assert.equal(
          Number(period.porcentajeExactos),
          period.cortes === 0 ? 0 : (period.exactos / period.cortes) * 100,
        );
      }

      assert.equal(destinations.resumen.length, 4);
      assert.equal(
        destinations.resumen.reduce((sum, row) => sum + Number(row.importe), 0),
        Number(destinations.totalCobrado),
      );
       assert.equal(destinations.ivaCobrado, "64.00");
       assert.equal(destinations.resumen.find((row) => row.cuentaDestino === "CUENTA_FISCAL")!.importe, "302.00");
       const destinationDetails = await Promise.all(
        (["CAJA_FISICA", "CUENTA_FISCAL", "CUENTA_NO_FISCAL", "CUENTAS_POR_COBRAR"] as const).map(
          (destination) => analytics.listDestinationAccountMovements(
            filters,
            destination,
            1,
             10,
          ),
        ),
      );
       assert.deepEqual(destinationDetails.map((detail) => detail.total), [2, 7, 1, 1]);
       const fiscalDetail = destinationDetails[1]!;
       const effectiveAbonoDate = new Date(now.getTime() + 20_000).toISOString();
       const appliedProjection = fiscalDetail.items.find(
         (item) => item.documentoTipo === "TICKET" && item.documentoId === creditTicket && item.monto === "30.00",
       );
       const remainderProjection = fiscalDetail.items.find(
          (item) =>
            item.documentoTipo === "CLIENTE" &&
            item.documentoId === ids.clients[0] &&
            item.monto === "20.00",
        );
        const reversedRemainderProjection = fiscalDetail.items.find(
          (item) =>
            item.documentoTipo === "CLIENTE" &&
            item.documentoId === ids.clients[0] &&
            item.monto === "-20.00",
       );
       assert.deepEqual(appliedProjection && {
         monto: appliedProjection.monto,
         fecha: appliedProjection.fecha,
         ubicacionId: appliedProjection.ubicacionId,
         sitio: appliedProjection.sitio,
       }, {
         monto: "30.00",
         fecha: effectiveAbonoDate,
         ubicacionId: ids.locations[1],
         sitio: `${tag}-Sur`,
       });
       assert.deepEqual(remainderProjection && {
         monto: remainderProjection.monto,
         fecha: remainderProjection.fecha,
         ubicacionId: remainderProjection.ubicacionId,
         sitio: remainderProjection.sitio,
       }, {
         monto: "20.00",
         fecha: effectiveAbonoDate,
         ubicacionId: null,
         sitio: "Estado de cuenta",
       });
       assert.equal(
         Number(appliedProjection!.monto) + Number(remainderProjection!.monto),
         50,
       );
        assert.deepEqual(reversedRemainderProjection && {
          monto: reversedRemainderProjection.monto,
          fecha: reversedRemainderProjection.fecha,
          ubicacionId: reversedRemainderProjection.ubicacionId,
          sitio: reversedRemainderProjection.sitio,
        }, {
          monto: "-20.00",
          fecha: new Date(now.getTime() + 30_000).toISOString(),
          ubicacionId: null,
          sitio: "Estado de cuenta",
        });
       assert.equal(fiscalDetail.items.filter((item) => item.documentoTipo === "CLIENTE").length, 3);
       assert.ok(!fiscalDetail.items.some((item) =>
         item.documentoTipo === "TICKET" && item.documentoId === cancelledCreditTicket,
       ));
       assert.ok(fiscalDetail.items.some((item) =>
         item.documentoTipo === "CLIENTE" && item.monto === "60.00" && item.sitio === "Estado de cuenta",
       ));
       const siteFiscalDetail = await analytics.listDestinationAccountMovements(
         { ...filters, ubicacionId: ids.locations[1] },
         "CUENTA_FISCAL",
         1,
         10,
       );
       assert.equal(siteFiscalDetail.total, 3);
       assert.equal(siteFiscalDetail.montoTotal, "10.00");
       assert.equal(siteFiscalDetail.items[0]!.documentoTipo, "TICKET");
       assert.equal(await analytics.getDestinationCollectedAmount(filters, "CUENTA_FISCAL"), "302.00");
       assert.equal(await analytics.getDestinationCollectedAmount(
         { ...filters, ubicacionId: ids.locations[1] },
         "CUENTA_FISCAL",
       ), "10.00");
      for (const detail of destinationDetails) {
        assert.equal(detail.montoTotal, destinations.resumen.find(
          (row) => row.cuentaDestino === detail.cuentaDestino,
        )!.importe);
      }
      assert.equal(
        Math.round(comparison.tiendas.reduce((sum, store) => sum + Number(store.participacion), 0)),
        100,
      );
      assert.ok(Number(quantities.find((row) => row.unidad === "METRO")!.cantidad) > 0);
      assert.ok(Number(quantities.find((row) => row.unidad === "KILO")!.cantidad) > 0);
      for (const period of ["diario", "semanal", "mensual", "trimestral", "semestral", "anual"]) {
        const range = analytics.comparisonRange(period);
        assert.ok(range.desde <= range.hasta);
        const periodResult = await analytics.compareStores(analytics.parseAnalyticsFilters(range));
        assert.ok(
          periodResult.tiendas.some((store) => ids.locations.includes(Number(store.ubicacionId))),
          `${period} must include an integration store`,
        );
      }

      // The router applies this same literal middleware to every /admin route.
      for (const role of ["CAJA", "TERMINAL"] as const) {
        for (const path of [
          "/dashboard/realtime", "/dashboard/realtime/pendientes", "/cortes",
          "/cortes/1", "/cortes/1/export.xlsx", "/cortes/1/export.pdf",
          "/diferencias", "/cuentas-destino", "/comparacion-tiendas",
          "/cortes/export.xlsx", "/cortes/export.pdf",
          "/cuentas-destino/export.xlsx", "/cuentas-destino/export.pdf",
        ]) {
          let status = 0;
          requireRole("ADMIN")(
            { auth: { user: { rol: role } }, path } as never,
            { status(value: number) { status = value; return this; }, json() { return this; } } as never,
            (() => assert.fail(`${role} reached ${path}`)) as never,
          );
          assert.equal(status, 403, `${role} ${path}`);
        }
      }
    } finally {
      if (ids.tickets.length) {
        await pool.query(`DELETE FROM ticket_pagos WHERE ticket_id = ANY($1::int[])`, [ids.tickets]);
         if (ids.creditApplications.length) await pool.query(`DELETE FROM aplicaciones_credito WHERE id = ANY($1::int[])`, [ids.creditApplications]);
        if (ids.creditMovements.length) await pool.query(`DELETE FROM movimientos_credito WHERE id = ANY($1::int[])`, [ids.creditMovements]);
        await pool.query(`DELETE FROM ticket_lineas WHERE ticket_id = ANY($1::int[])`, [ids.tickets]);
        await pool.query(`DELETE FROM tickets WHERE id = ANY($1::int[])`, [ids.tickets]);
      }
      if (ids.sessions.length) await pool.query(`DELETE FROM sesiones_caja WHERE id = ANY($1::int[])`, [ids.sessions]);
      if (ids.rollos.length) await pool.query(`DELETE FROM rollos WHERE id = ANY($1::int[])`, [ids.rollos]);
      if (ids.products.length) await pool.query(`DELETE FROM productos WHERE id = ANY($1::int[])`, [ids.products]);
      if (ids.clients.length) await pool.query(`DELETE FROM clientes WHERE id = ANY($1::int[])`, [ids.clients]);
      if (ids.users.length) await pool.query(`DELETE FROM usuarios WHERE id = ANY($1::int[])`, [ids.users]);
      if (ids.locations.length) await pool.query(`DELETE FROM ubicaciones WHERE id = ANY($1::int[])`, [ids.locations]);
      await pool.end();
    }
  });
}