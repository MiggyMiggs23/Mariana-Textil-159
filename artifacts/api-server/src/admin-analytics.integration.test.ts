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
    const creditAt = new Date(now.getTime() + 2 * 60_000);
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
      const seededAdmin = await one(
        `SELECT id FROM usuarios WHERE rol='ADMIN' AND activo=true ORDER BY id LIMIT 1`,
      );
      assert.ok(seededAdmin?.id, "the isolated seed must provide its canonical ADMIN actor");
      ids.users.push(Number(seededAdmin.id), Number(seededAdmin.id), Number(seededAdmin.id));
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
        payment?: "EFECTIVO" | "TRANSFERENCIA"; credit?: boolean; oldPending?: boolean;
        documentoTipo?: "TICKET" | "NOTA";
        autorizacionEstado?: "NO_APLICA" | "PENDIENTE" | "AUTORIZADA";
        autorizadoAt?: Date;
        unit?: 0 | 1; paymentCreatedAt?: Date; cobradoAt?: Date; createdAt?: Date;
      }) => {
        const created = input.createdAt ?? (input.oldPending ? new Date(now.getTime() - 90 * 60_000) : now);
        const total = input.subtotal + (input.iva ?? 0);
        const ticket = await one(
          `INSERT INTO tickets(folio,ubicacion_id,usuario_terminal_id,cliente_id,subtotal,iva,total,
             estado,cobrado,cobrado_at,usuario_caja_id,facturado,credito,dias_plazo,fecha_vencimiento,
             documento_tipo,autorizacion_estado,autorizado_at,sesion_caja_id,uuid_cliente,created_at,
             cancelado_at,cancelado_por,motivo_cancelacion)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
           RETURNING id`,
          [folio++, ids.locations[input.store], ids.users[2], ids.clients[0], input.subtotal,
            input.iva ?? 0, total, input.state ?? "VENDIDO", input.paid ?? false,
            input.paid ? (input.cobradoAt ?? input.paymentCreatedAt ?? now) : null, input.paid ? ids.users[1] : null,
             input.facturado ?? false, input.credit ?? false,
             input.credit ? 30 : null,
             input.credit ? new Date(created.getTime() + 30 * 86_400_000).toISOString().slice(0, 10) : null,
             input.documentoTipo ?? "TICKET",
             input.autorizacionEstado ?? (input.documentoTipo === "NOTA" ? "PENDIENTE" : "NO_APLICA"),
             input.autorizadoAt ?? null, ids.sessions[input.session], randomUUID(), created,
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
      const closedCashTicket =
        await addTicket({ store: 0, session: 0, subtotal: 100, paid: true, payment: "EFECTIVO", unit: 0 });
      // A pending sold ticket in the same cut must not count as collected.
      const northPendingTicket = await addTicket({ store: 0, session: 0, subtotal: 75, unit: 0 });
      // Four destination cards across both stores.
      const northCashTicket =
        await addTicket({ store: 0, session: 5, subtotal: 100, iva: 16, paid: true, payment: "EFECTIVO", unit: 0 });
       const northOutOfRangeTransferTicket =
          await addTicket({ store: 0, session: 5, subtotal: 200, iva: 32, paid: true, payment: "TRANSFERENCIA", facturado: true, unit: 0, createdAt: new Date(from.getTime() - 60_000), paymentCreatedAt: new Date(from.getTime() - 60_000), cobradoAt: new Date(now.getTime() + 10_000) });
      const southTransferTicket =
        await addTicket({ store: 1, session: 6, subtotal: 300, iva: 48, paid: true, payment: "TRANSFERENCIA", unit: 1 });
       const creditTicket = await addTicket({
         store: 1, session: 6, subtotal: 400, credit: true, unit: 1,
         documentoTipo: "NOTA", autorizacionEstado: "AUTORIZADA",
         autorizadoAt: creditAt, createdAt: now,
       });
       const creditSale = await one(
         `INSERT INTO movimientos_credito(cliente_id,ticket_id,tipo,importe,usuario_id,created_at)
          VALUES($1,$2,'VENTA_CREDITO',400,$3,$4) RETURNING id`,
           [ids.clients[0], creditTicket, ids.users[1], new Date(from.getTime() - 60_000)],
       );
       ids.creditMovements.push(Number(creditSale.id));
        const creditEvidence = await one(
          `SELECT
             (SELECT COUNT(*)::int FROM ticket_pagos WHERE ticket_id=$1) AS payment_rows,
             (SELECT COUNT(*)::int FROM movimientos_credito
               WHERE ticket_id=$1 AND tipo='VENTA_CREDITO') AS ledger_rows`,
          [creditTicket],
        );
        assert.deepEqual(creditEvidence, { payment_rows: 0, ledger_rows: 1 });
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
       const oldNorthPendingTicket =
         await addTicket({ store: 0, session: 5, subtotal: 50, oldPending: true, unit: 0 });
       const cancelledSouthTicket =
         await addTicket({ store: 1, session: 6, subtotal: 999, state: "CANCELADO", unit: 1 });

      const filters = { desde: from, hasta: to };
      const northStoreFilters = { ...filters, ubicacionId: ids.locations[0] };
      const southStoreFilters = { ...filters, ubicacionId: ids.locations[1] };
      const [northSalesFirstPage, northSalesSecondPage, northCashSales, northTransferSales,
         southTransferSales, southCreditSales, southSales] = await Promise.all([
        analytics.listStoreSales(northStoreFilters, undefined, 1, 2),
        analytics.listStoreSales(northStoreFilters, undefined, 2, 2),
        analytics.listStoreSales(northStoreFilters, "EFECTIVO"),
        analytics.listStoreSales(northStoreFilters, "TRANSFERENCIA"),
        analytics.listStoreSales(southStoreFilters, "TRANSFERENCIA"),
        analytics.listStoreSales(southStoreFilters, "CREDITO"),
         analytics.listStoreSales(southStoreFilters, undefined),
      ]);
      assert.deepEqual(
        {
          ubicacionId: northSalesFirstPage.ubicacionId,
          nombreUbicacion: northSalesFirstPage.nombreUbicacion,
          total: northSalesFirstPage.total,
          page: northSalesFirstPage.page,
          pageSize: northSalesFirstPage.pageSize,
          ids: northSalesFirstPage.items.map((item) => item.id),
        },
        {
          ubicacionId: ids.locations[0],
          nombreUbicacion: `${tag}-Norte`,
          total: 3,
          page: 1,
          pageSize: 2,
          ids: [northOutOfRangeTransferTicket, northCashTicket],
        },
      );
       assert.deepEqual(
         northSalesSecondPage.items.map((item) => item.id),
         [closedCashTicket],
       );
      assert.ok(northSalesFirstPage.items.every((item) =>
        item.createdAt >= from.toISOString() && item.createdAt <= to.toISOString(),
      ));
      assert.deepEqual(northSalesFirstPage.items.map((item) => item.estadoCobro), ["COBRADO", "COBRADO"]);
      assert.deepEqual(northCashSales.items.map((item) => ({
        id: item.id, formaPago: item.formaPago, importe: item.importe, utilidad: item.utilidad,
      })), [
        { id: northCashTicket, formaPago: "EFECTIVO", importe: "116.00", utilidad: "50.00" },
        { id: closedCashTicket, formaPago: "EFECTIVO", importe: "100.00", utilidad: "50.00" },
      ]);
      assert.deepEqual(northTransferSales.items.map((item) => item.id), [northOutOfRangeTransferTicket]);
      assert.equal(
        northTransferSales.items[0]?.createdAt,
        new Date(now.getTime() + 10_000).toISOString(),
        "financial ranges use the Caja processing timestamp, not ticket creation",
      );
      assert.deepEqual(southTransferSales.items.map((item) => ({
        id: item.id, formaPago: item.formaPago, estadoCobro: item.estadoCobro,
        importe: item.importe, utilidad: item.utilidad,
      })), [{
        id: southTransferTicket, formaPago: "TRANSFERENCIA", estadoCobro: "COBRADO",
        importe: "348.00", utilidad: "150.00",
      }]);
      assert.deepEqual(southCreditSales.items.map((item) => ({
        id: item.id, formaPago: item.formaPago, estadoCobro: item.estadoCobro,
        importe: item.importe, utilidad: item.utilidad,
      })), [{
        id: creditTicket, formaPago: "CREDITO", estadoCobro: "CREDITO",
        importe: "400.00", utilidad: "200.00",
      }]);
       assert.ok(
         !southSales.items.some((item) => item.id === cancelledSouthTicket),
         "cancelled tickets are not store sales",
       );
       const realtimeTickets = await analytics.getRealtimeTickets(filters);
       assert.ok(
         !realtimeTickets.some((item) =>
           item.id === cancelledSouthTicket || item.id === cancelledCreditTicket),
         "cancelled tickets are not rendered as recent realtime sales",
       );
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

      const realtimeCredit = analytics.summarizeRealtimeCredit(cards);
      assert.equal(
        Number(summary.ventas),
         Number(summary.cobrado) + Number(realtimeCredit.importe),
      );
       assert.equal(summary.ventas, "1196.00");
       assert.equal(summary.cobrado, "796.00");
       assert.equal(summary.pendiente, "125.00");
       assert.notEqual(
         Number(summary.ventas),
         Number(summary.cobrado) + Number(realtimeCredit.importe) + Number(summary.pendiente),
         "pending cash Tickets remain operational and never inflate Sales",
       );
      assert.ok(Number(summary.margen) > 0);
       assert.equal(
         summary.cancelaciones,
         0,
         "un documento sin procesamiento financiero no entra al rango contable",
       );
      assert.equal(pending.tickets, 2);
      assert.equal(pending.importe, "125.00");
      assert.ok(cards.some((card) => card.alertas.includes("PENDIENTE_MAS_30_MIN")));
      assert.ok(cards.reduce((sum, card) => sum + Number(card.margen), 0) > 0);
      assert.deepEqual(realtimeCredit, {
        importe: "400.00",
        operaciones: 1,
      });
      assert.equal(cards.reduce((sum, card) => sum + Number(card.cobrado), 0), Number(summary.cobrado));
      assert.equal(cards.reduce((sum, card) => sum + card.ticketsCobrados, 0), summary.ticketsCobrados);
      const northStoreCard = cards.find((card) => card.ubicacionId === ids.locations[0]);
      const southStoreCard = cards.find((card) => card.ubicacionId === ids.locations[1]);
      assert.deepEqual(
        northStoreCard && {
          ticketPromedio: northStoreCard.ticketPromedio,
          ticketsCobrados: northStoreCard.ticketsCobrados,
        },
        { ticketPromedio: "149.33", ticketsCobrados: 3 },
      );
      assert.deepEqual(
        southStoreCard && {
          ticketPromedio: southStoreCard.ticketPromedio,
          ticketsCobrados: southStoreCard.ticketsCobrados,
        },
        { ticketPromedio: "348.00", ticketsCobrados: 1 },
        "credit tickets must not inflate a store's collected ticket count or average",
      );

      const creditOnlyFilters = {
        desde: new Date(creditAt.getTime() - 1_000),
        hasta: new Date(creditAt.getTime() + 1_000),
        ubicacionId: ids.locations[1],
      };
      const [creditOnlySummary, creditOnlyCards] = await Promise.all([
        analytics.getSalesSummary(creditOnlyFilters),
        analytics.getRealtimeStores(creditOnlyFilters),
      ]);
      const creditOnly = analytics.summarizeRealtimeCredit(creditOnlyCards);
      assert.equal(creditOnlySummary.ventas, "400.00");
      assert.equal(creditOnlySummary.cobrado, "0.00");
      assert.equal(creditOnlySummary.ticketsCobrados, 0);
      assert.equal(creditOnlySummary.pendiente, "0.00");
      assert.equal(creditOnlySummary.margen, "200.00");
      assert.deepEqual(creditOnly, { importe: "400.00", operaciones: 1 });
      const creditOnlyStore = creditOnlyCards.find(
        (card) => card.ubicacionId === ids.locations[1],
      );
      assert.equal(creditOnlyStore?.vendido, "400.00");
      assert.equal(creditOnlyStore?.margen, "200.00");
      assert.equal(creditOnlyStore?.credito, "400.00");
      assert.equal(creditOnlyStore?.cobrado, "0.00");
      assert.equal(creditOnlyStore?.ticketsCobrados, 0);
      assert.equal(
        Number(creditOnlySummary.ventas),
         Number(creditOnlySummary.cobrado) + Number(creditOnly.importe),
      );
      const siteCreditCards = await analytics.getRealtimeStores({
        ...filters,
        ubicacionId: ids.locations[0],
      });
      assert.deepEqual(analytics.summarizeRealtimeCredit(siteCreditCards), {
        importe: "0.00",
        operaciones: 0,
      });
      assert.deepEqual(analytics.summarizeRealtimeCredit(await analytics.getRealtimeStores({
        ...filters,
        ubicacionId: ids.locations[1],
      })), {
        importe: "400.00",
        operaciones: 1,
      });
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
         Number(destinations.encabezado.cobrado.total),
      );
       assert.equal(destinations.encabezado.vendido.total, "1196.00");
       assert.equal(destinations.encabezado.vendido.contado, "796.00");
       assert.equal(destinations.encabezado.vendido.credito, "400.00");
       assert.equal(destinations.encabezado.cobrado.contado, "796.00");
       assert.equal(destinations.encabezado.cobrado.abonos, "10.00");
       assert.equal(destinations.encabezado.cobrado.saldosFavor, "60.00");
       assert.notEqual(
         Number(destinations.encabezado.cobrado.total)
           + Number(destinations.encabezado.porCobrar.periodo),
         Number(destinations.encabezado.vendido.total),
         "current collections include payments of credit from other periods",
       );
       assert.equal(destinations.totalCobrado, destinations.encabezado.cobrado.total);
       assert.equal(destinations.matriz.cierra, true);
       assert.deepEqual(destinations.incongruencias, {
         conteo: 2,
         importe: "40.00",
       });
       const [facturado, noFacturado, matrixTotal] = destinations.matriz.filas;
       for (const row of destinations.matriz.filas) {
         assert.equal(
           Number(row.efectivo.importe) + Number(row.transferencia.importe)
             + Number(row.porCobrar.importe) + Number(row.otras.importe),
           Number(row.total),
         );
       }
       for (const column of ["efectivo", "transferencia", "porCobrar", "otras"] as const) {
         assert.equal(
           Number(facturado![column].importe) + Number(noFacturado![column].importe),
           Number(matrixTotal![column].importe),
         );
       }
       assert.equal(matrixTotal!.total, destinations.encabezado.vendido.total);
       assert.equal(
         destinations.ivaCobrado,
         (16 + 32 + 48).toFixed(2),
         "IVA includes the north invoiced transfer by its effective Caja payment date despite earlier creation",
       );
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
        const processedTransfer = fiscalDetail.items.find(
          (item) => item.documentoTipo === "TICKET" && item.documentoId === northOutOfRangeTransferTicket,
        );
        assert.equal(
          processedTransfer?.fecha,
          new Date(now.getTime() + 10_000).toISOString(),
          "destination detail dates a Ticket by cobrado_at, not its payment row creation",
        );
        const creditDestination = destinationDetails[3]!.items.find(
          (item) => item.documentoTipo === "TICKET" && item.documentoId === creditTicket,
        );
        assert.equal(
          creditDestination?.fecha,
          creditAt.toISOString(),
          "destination detail dates authorized credit by autorizado_at, not movement creation",
        );
       const effectiveAbonoDate = new Date(now.getTime() + 20_000).toISOString();
       const appliedProjection = fiscalDetail.items.find(
         (item) =>
           item.documentoTipo === "MOVIMIENTO_CREDITO" &&
           item.documentoId === Number(fiscalAbono.id) &&
           item.monto === "30.00",
       );
       const remainderProjection = fiscalDetail.items.find(
          (item) =>
            item.documentoTipo === "MOVIMIENTO_CREDITO" &&
            item.documentoId === Number(fiscalAbono.id) &&
            item.monto === "20.00",
        );
        const reversedRemainderProjection = fiscalDetail.items.find(
          (item) =>
            item.documentoTipo === "MOVIMIENTO_CREDITO" &&
            item.documentoId === Number(reversedAbono.id) &&
            item.monto === "-20.00",
       );
       assert.deepEqual(appliedProjection && {
         documentoTipo: appliedProjection.documentoTipo,
         documentoId: appliedProjection.documentoId,
         clienteId: appliedProjection.clienteId,
         monto: appliedProjection.monto,
         fecha: appliedProjection.fecha,
         ubicacionId: appliedProjection.ubicacionId,
         sitio: appliedProjection.sitio,
       }, {
         documentoTipo: "MOVIMIENTO_CREDITO",
         documentoId: Number(fiscalAbono.id),
         clienteId: ids.clients[0],
         monto: "30.00",
         fecha: effectiveAbonoDate,
         ubicacionId: ids.locations[1],
         sitio: `${tag}-Sur`,
       });
       assert.deepEqual(remainderProjection && {
         documentoTipo: remainderProjection.documentoTipo,
         documentoId: remainderProjection.documentoId,
         clienteId: remainderProjection.clienteId,
         monto: remainderProjection.monto,
         fecha: remainderProjection.fecha,
         ubicacionId: remainderProjection.ubicacionId,
         sitio: remainderProjection.sitio,
       }, {
         documentoTipo: "MOVIMIENTO_CREDITO",
         documentoId: Number(fiscalAbono.id),
         clienteId: ids.clients[0],
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
         documentoTipo: reversedRemainderProjection.documentoTipo,
         documentoId: reversedRemainderProjection.documentoId,
         clienteId: reversedRemainderProjection.clienteId,
          monto: reversedRemainderProjection.monto,
          fecha: reversedRemainderProjection.fecha,
          ubicacionId: reversedRemainderProjection.ubicacionId,
          sitio: reversedRemainderProjection.sitio,
        }, {
         documentoTipo: "MOVIMIENTO_CREDITO",
         documentoId: Number(reversedAbono.id),
         clienteId: ids.clients[0],
          monto: "-20.00",
          fecha: new Date(now.getTime() + 30_000).toISOString(),
          ubicacionId: null,
          sitio: "Estado de cuenta",
        });
       assert.equal(
         fiscalDetail.items.filter((item) => item.documentoTipo === "MOVIMIENTO_CREDITO").length,
         6,
       );
       assert.ok(!fiscalDetail.items.some((item) =>
         item.documentoTipo === "TICKET" && item.documentoId === cancelledCreditTicket,
       ));
       assert.ok(fiscalDetail.items.some((item) =>
         item.documentoTipo === "MOVIMIENTO_CREDITO" &&
         item.monto === "60.00" &&
         item.sitio === "Estado de cuenta",
       ));
       const siteFiscalDetail = await analytics.listDestinationAccountMovements(
         { ...filters, ubicacionId: ids.locations[1] },
         "CUENTA_FISCAL",
         1,
         10,
       );
       assert.equal(siteFiscalDetail.total, 3);
       assert.equal(siteFiscalDetail.montoTotal, "10.00");
       assert.equal(siteFiscalDetail.items[0]!.documentoTipo, "MOVIMIENTO_CREDITO");
        const incongruentFiscalDetail = await analytics.listDestinationAccountMovements(
          filters,
          "CUENTA_FISCAL",
          1,
          10,
          { incongruente: true },
        );
        assert.equal(incongruentFiscalDetail.total, 2);
        assert.equal(incongruentFiscalDetail.montoTotal, "40.00");
        assert.ok(incongruentFiscalDetail.items.every((item) =>
          item.incongruente && item.facturado === false),
        );
       assert.equal(await analytics.getDestinationCollectedAmount(filters, "CUENTA_FISCAL"), "302.00");
       assert.equal(await analytics.getDestinationCollectedAmount(
         { ...filters, ubicacionId: ids.locations[1] },
         "CUENTA_FISCAL",
       ), "10.00");
       for (const detail of destinationDetails) {
         const collectionDetails = await Promise.all(
           (["POS", "ABONO", "ABONO_SALDO_FAVOR"] as const).map((fuente) =>
             analytics.listDestinationAccountMovements(
               filters, detail.cuentaDestino, 1, 100, { fuentes: [fuente] },
             )),
         );
         assert.equal(
           collectionDetails.reduce((sum, item) => sum + Number(item.montoTotal), 0),
           Number(destinations.resumen.find(
             (row) => row.cuentaDestino === detail.cuentaDestino,
           )!.importe),
         );
      }
       const headerDetails = await Promise.all([
         analytics.listDestinationAccountMovements(
           filters, "TODAS", 1, 100, { fuentes: ["POS", "CREDITO"] },
         ),
         analytics.listDestinationAccountMovements(
           filters, "TODAS", 1, 100, { fuentes: ["POS"] },
         ),
         analytics.listDestinationAccountMovements(
           filters, "TODAS", 1, 100, { fuentes: ["CREDITO"] },
         ),
         analytics.listDestinationAccountMovements(
           filters, "TODAS", 1, 100, {
             fuentes: ["POS", "ABONO", "ABONO_SALDO_FAVOR"],
           },
         ),
         analytics.listDestinationAccountMovements(
           filters, "TODAS", 1, 100, { fuentes: ["ABONO"] },
         ),
         analytics.listDestinationAccountMovements(
           filters, "TODAS", 1, 100, { fuentes: ["ABONO_SALDO_FAVOR"] },
         ),
       ]);
       assert.deepEqual(
         headerDetails.map((detail) => detail.montoTotal),
         [
           destinations.encabezado.vendido.total,
           destinations.encabezado.vendido.contado,
           destinations.encabezado.vendido.credito,
           destinations.encabezado.cobrado.total,
           destinations.encabezado.cobrado.abonos,
           destinations.encabezado.cobrado.saldosFavor,
         ],
       );
       const matrixDestination = (value: string | null) => {
         switch (value) {
           case "CAJA_FISICA":
           case "CUENTA_FISCAL":
           case "CUENTA_NO_FISCAL":
           case "CUENTAS_POR_COBRAR":
             return value;
           default:
             assert.equal(value, null);
             return "TODAS";
         }
       };
       for (const matrixRow of destinations.matriz.filas) {
         const facturado = matrixRow.facturado == null
           ? {}
           : { facturado: matrixRow.facturado };
         const [cash, transfer, credit, other, total] = await Promise.all([
           analytics.listDestinationAccountMovements(
             filters,
             matrixDestination(matrixRow.efectivo.cuentaDestino),
             1,
             100,
             { ...facturado, formaPago: "EFECTIVO", fuentes: ["POS"] },
           ),
           analytics.listDestinationAccountMovements(
             filters,
             matrixDestination(matrixRow.transferencia.cuentaDestino),
             1,
             100,
             { ...facturado, formaPago: "TRANSFERENCIA", fuentes: ["POS"] },
           ),
           analytics.listDestinationAccountMovements(
             filters,
             matrixDestination(matrixRow.porCobrar.cuentaDestino),
             1,
             100,
             { ...facturado, formaPago: "POR_COBRAR", fuentes: ["CREDITO"] },
           ),
           analytics.listDestinationAccountMovements(
             filters,
             matrixDestination(matrixRow.otras.cuentaDestino),
             1,
             100,
             { ...facturado, formaPago: "OTRAS", fuentes: ["POS"] },
           ),
           analytics.listDestinationAccountMovements(
             filters,
             "TODAS",
             1,
             100,
             { ...facturado, fuentes: ["POS", "CREDITO"] },
           ),
         ]);
         assert.deepEqual(
           [cash.montoTotal, transfer.montoTotal, credit.montoTotal, other.montoTotal, total.montoTotal],
           [
             matrixRow.efectivo.importe,
             matrixRow.transferencia.importe,
             matrixRow.porCobrar.importe,
             matrixRow.otras.importe,
             matrixRow.total,
           ],
         );
       }
       for (const priorCollection of destinations.cobrosAnteriores) {
         const detail = await analytics.listDestinationAccountMovements(
           filters,
           priorCollection.cuentaDestino,
           1,
           100,
           { fuentes: [priorCollection.fuente] },
         );
         assert.equal(detail.montoTotal, priorCollection.importe);
       }
       const [cashInvoicedDetail, incongruenceDetail] = await Promise.all([
         analytics.listDestinationAccountMovements(
           filters,
           "CAJA_FISICA",
           1,
           100,
           {
             facturado: true,
             fuentes: ["POS", "ABONO", "ABONO_SALDO_FAVOR"],
           },
         ),
         analytics.listDestinationAccountMovements(
           filters,
           "TODAS",
           1,
           100,
           { incongruente: true },
         ),
       ]);
       assert.equal(
         cashInvoicedDetail.montoTotal,
         destinations.resumen.find(
           (row) => row.cuentaDestino === "CAJA_FISICA",
         )!.cajaFisicaFacturado,
       );
       assert.equal(incongruenceDetail.total, destinations.incongruencias.conteo);
       assert.equal(incongruenceDetail.montoTotal, destinations.incongruencias.importe);
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

       // Isolated chronology: the credit note is a sale only in its document
       // period; a later ABONO is collection only and must not create a sale.
       const laterSaleAt = new Date(now.getTime() + 10 * 86_400_000);
       const laterPaymentAt = new Date(now.getTime() + 20 * 86_400_000);
       const laterTicket = await addTicket({
         store: 1, session: 6, subtotal: 70, credit: true, unit: 1,
         documentoTipo: "NOTA", autorizacionEstado: "AUTORIZADA",
         autorizadoAt: laterSaleAt, createdAt: laterSaleAt,
       });
       const laterSale = await one(
         `INSERT INTO movimientos_credito(cliente_id,ticket_id,tipo,importe,usuario_id,created_at)
          VALUES($1,$2,'VENTA_CREDITO',70,$3,$4) RETURNING id`,
         [ids.clients[0], laterTicket, ids.users[1], laterSaleAt],
       );
       ids.creditMovements.push(Number(laterSale.id));
       const laterAbono = await one(
         `INSERT INTO movimientos_credito(cliente_id,tipo,importe,usuario_id,forma_pago,cuenta_destino,created_at)
          VALUES($1,'ABONO',-70,$2,'TRANSFERENCIA','CUENTA_FISCAL',$3) RETURNING id`,
         [ids.clients[0], ids.users[1], laterPaymentAt],
       );
       ids.creditMovements.push(Number(laterAbono.id));
       const laterApplication = await one(
         `INSERT INTO aplicaciones_credito(abono_movimiento_id,venta_movimiento_id,importe)
          VALUES($1,$2,70) RETURNING id`,
         [laterAbono.id, laterSale.id],
       );
       ids.creditApplications.push(Number(laterApplication.id));
       const around = (date: Date) => ({
         desde: new Date(date.getTime() - 1_000),
         hasta: new Date(date.getTime() + 1_000),
       });
       const [salePeriod, paymentPeriod] = await Promise.all([
         analytics.getDestinationAccounts(around(laterSaleAt), false),
         analytics.getDestinationAccounts(around(laterPaymentAt), false),
       ]);
       assert.equal(salePeriod.encabezado.vendido.total, "70.00");
       assert.equal(salePeriod.encabezado.porCobrar.periodo, "70.00");
       assert.equal(salePeriod.encabezado.cobrado.total, "0.00");
       assert.equal(paymentPeriod.encabezado.vendido.total, "0.00");
       assert.equal(paymentPeriod.encabezado.cobrado.total, "70.00");
       assert.equal(paymentPeriod.encabezado.cobrado.abonos, "70.00");

       // Credit reversals are exact inverse movements. The database rejects
       // partial reversals before they can become accounting evidence.
       const rejectionPaymentAt = new Date(now.getTime() + 30 * 86_400_000);
       const rejectionAbono = await one(
         `INSERT INTO movimientos_credito(cliente_id,tipo,importe,usuario_id,forma_pago,cuenta_destino,created_at)
          VALUES($1,'ABONO',-50,$2,'TRANSFERENCIA','CUENTA_FISCAL',$3) RETURNING id`,
         [ids.clients[0], ids.users[1], rejectionPaymentAt],
       );
       ids.creditMovements.push(Number(rejectionAbono.id));
       await assert.rejects(
         () => one(
           `INSERT INTO movimientos_credito(
              cliente_id,tipo,importe,movimiento_origen_id,usuario_id,created_at
            ) VALUES($1,'REVERSO',20,$2,$3,$4) RETURNING id`,
           [
             ids.clients[0],
             rejectionAbono.id,
             ids.users[0],
             new Date(rejectionPaymentAt.getTime() + 1_000),
           ],
         ),
         /El reverso de crédito debe tener un origen compatible, del mismo cliente y por el importe exacto/,
       );
       const rejectedReversal = await one(
         `SELECT COUNT(*)::int total FROM movimientos_credito
          WHERE tipo='REVERSO' AND movimiento_origen_id=$1`,
         [rejectionAbono.id],
       );
       assert.equal(rejectedReversal.total, 0);

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
      // Financial records are append-only. The disposable Neon branch is the
      // cleanup boundary for this integration fixture.
      await pool.end();
    }
  });
}