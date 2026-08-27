import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import test from "node:test";

const testUrl = process.env.TEST_DATABASE_URL;
const applicationUrl = process.env.DATABASE_URL;

test("pagos dirigidos conserva FIFO, autorización, alcance, reversos y reporte", async (t) => {
  if (!testUrl) {
    t.skip("TEST_DATABASE_URL no está configurada.");
    return;
  }
  if (testUrl === applicationUrl) {
    throw new Error("TEST_DATABASE_URL debe ser distinta de DATABASE_URL.");
  }

  const [{ db, pool, ensureClientesSchema, ensureSolicitudesPagoDirigidoSchema }, { default: app }, { buildCommercialReport }] =
    await Promise.all([
      import("@workspace/db"),
      import("./app"),
      import("./lib/reportes-commercial"),
    ]);
  const { createTestDatabaseGuard } = await import("@workspace/db");
  const {
    loadCustomerCreditProjection,
    loadCustomerCreditProjectionInTransaction,
  } = await import("./lib/credit-aging-read-model");
  const { assertIsolated } = await createTestDatabaseGuard(
    pool,
    testUrl,
    applicationUrl,
  );
  await assertIsolated();
  await ensureClientesSchema(pool);
  await ensureSolicitudesPagoDirigidoSchema(pool);

  const tag = `DIRECTED-${randomUUID()}`;
  const one = async (text: string, values: unknown[] = []) =>
    (await pool.query(text, values)).rows[0]!;
  const unusedLocationInitials = async () => {
    const row = await one(
      `SELECT candidate AS iniciales
       FROM (
         SELECT chr(first_code) || chr(second_code)
           || CASE WHEN third_code = 0 THEN '' ELSE chr(third_code) END AS candidate
         FROM generate_series(65,90) AS first_code
         CROSS JOIN generate_series(65,90) AS second_code
         CROSS JOIN generate_series(0,90) AS third_code
         WHERE third_code = 0 OR third_code >= 65
       ) AS candidates
       WHERE NOT EXISTS (
         SELECT 1 FROM ubicaciones WHERE iniciales = candidates.candidate
       )
       ORDER BY length(candidate), candidate
       LIMIT 1`,
    );
    assert.ok(row, "No hay iniciales válidas disponibles para la prueba.");
    return String(row.iniciales);
  };
  const admin = await one(
    "SELECT id,nombre FROM usuarios WHERE rol='ADMIN' AND activo ORDER BY id LIMIT 1",
  );
  assert.ok(admin, "El seed aislado debe contener un ADMIN.");
  const location = await one(
    `INSERT INTO ubicaciones(nombre,tipo,activa,iniciales)
     VALUES($1,'TIENDA',true,$2) RETURNING id`,
    [`${tag} Tienda`, await unusedLocationInitials()],
  );
  const otherLocation = await one(
    `INSERT INTO ubicaciones(nombre,tipo,activa,iniciales)
     VALUES($1,'TIENDA',true,$2) RETURNING id`,
    [`${tag} Otra`, await unusedLocationInitials()],
  );
  const caja = await one(
    `INSERT INTO usuarios(
       nombre,usuario,password_hash,rol,ubicacion_id,activo,alcance_consulta
     ) VALUES($1,$2,'integration-only','CAJA',$3,true,'PROPIA')
     RETURNING id,nombre`,
    [`${tag} Caja`, `${tag.toLowerCase()}-caja`, location.id],
  );
  for (const modulo of ["clientes_finanzas", "proveedores_finanzas"]) {
    await pool.query(
      `INSERT INTO permisos_usuario(
         usuario_id,modulo,puede_ver,puede_crear,puede_editar,puede_autorizar,updated_por
       ) VALUES($1,$2,true,true,false,false,$3)`,
      [caja.id, modulo, admin.id],
    );
  }
  const adminSession = randomUUID();
  const cajaSession = randomUUID();
  for (const [sessionId, userId] of [
    [adminSession, admin.id],
    [cajaSession, caja.id],
  ]) {
    await pool.query(
      `INSERT INTO sesiones(id,usuario_id,expira_at,ip,user_agent)
       VALUES($1,$2,now()+interval '2 hours','127.0.0.1',$3)`,
      [sessionId, userId, tag],
    );
  }

  const cliente = await one(
    `INSERT INTO clientes(
       nombre,activo,es_sistema,limite_credito,saldo_credito,dias_credito
     ) VALUES($1,true,false,1000,0,30) RETURNING id`,
    [`${tag} Cliente`],
  );
  let folio = 1_800_000_000 + Math.floor(Math.random() * 90_000_000);
  const ticket = async (siteId: number, amount: number) =>
    one(
      `INSERT INTO tickets(
         folio,uuid_cliente,ubicacion_id,usuario_terminal_id,cliente_id,
         subtotal,iva,tasa_iva,total,estado,cobrado,facturado,created_at
       ) VALUES(
         $1,gen_random_uuid(),$2,$3,$4,$5,0,0,$5,
         'VENDIDO',false,false,now()
       ) RETURNING id,folio`,
      [folio++, siteId, caja.id, cliente.id, amount],
    );
  const oldTicket = await ticket(location.id, 120);
  const newTicket = await ticket(location.id, 90);
  const otherSiteTicket = await ticket(otherLocation.id, 70);
  const oldSale = await one(
    `INSERT INTO movimientos_credito(
       cliente_id,ticket_id,tipo,importe,usuario_id,forma_pago,created_at
     ) VALUES($1,$2,'VENTA_CREDITO','120.00',$3,'CREDITO',now()-interval '2 days')
     RETURNING id`,
    [cliente.id, oldTicket.id, admin.id],
  );
  const newSale = await one(
    `INSERT INTO movimientos_credito(
       cliente_id,ticket_id,tipo,importe,usuario_id,forma_pago,created_at
     ) VALUES($1,$2,'VENTA_CREDITO','90.00',$3,'CREDITO',now()-interval '1 day')
     RETURNING id`,
    [cliente.id, newTicket.id, admin.id],
  );
  const reversalClient = await one(
    `INSERT INTO clientes(
       nombre,activo,es_sistema,limite_credito,saldo_credito,dias_credito
     ) VALUES($1,true,false,1000,0,30) RETURNING id`,
    [`${tag} Cliente reverso`],
  );
  const reversalTicket = await one(
    `INSERT INTO tickets(
       folio,uuid_cliente,ubicacion_id,usuario_terminal_id,cliente_id,
       subtotal,iva,tasa_iva,total,estado,cobrado,facturado,created_at
     ) VALUES(
       $1,gen_random_uuid(),$2,$3,$4,100,0,0,100,
       'VENDIDO',false,false,now()
     ) RETURNING id,folio`,
    [folio++, location.id, caja.id, reversalClient.id],
  );
  const reversalSale = await one(
    `INSERT INTO movimientos_credito(
       cliente_id,ticket_id,tipo,importe,usuario_id,forma_pago,created_at
     ) VALUES($1,$2,'VENTA_CREDITO','100.00',$3,'CREDITO',now())
     RETURNING id`,
    [reversalClient.id, reversalTicket.id, admin.id],
  );
  await pool.query(
    `INSERT INTO ticket_pagos(ticket_id,forma_pago,importe,usuario_id,created_at)
     VALUES($1,'CREDITO','100.00',$2,now())`,
    [reversalTicket.id, admin.id],
  );

  const proveedor = await one(
    `INSERT INTO proveedores(nombre,tipo,moneda_default,activo)
     VALUES($1,'NACIONAL','MXN',true) RETURNING id`,
    [`${tag} Proveedor`],
  );
  let entradaFolio = 800_000 + Math.floor(Math.random() * 90_000);
  const compra = async (amount: number, age: string) => {
    const entrada = await one(
      `INSERT INTO entradas(
         folio,ubicacion_id,proveedor_id,usuario_id,fecha,total_rollos,total_costo,uuid_cliente
       ) VALUES($1,$2,$3,$4,now()-$5::interval,0,$6,gen_random_uuid())
       RETURNING id,folio`,
      [entradaFolio++, location.id, proveedor.id, admin.id, age, amount],
    );
    return one(
      `INSERT INTO pagos_proveedor(
         proveedor_id,entrada_id,tipo,importe,fecha,usuario_id
       ) VALUES($1,$2,'COMPRA',$3,now()-$4::interval,$5) RETURNING id`,
      [proveedor.id, entrada.id, amount, age, admin.id],
    );
  };
  const oldPurchase = await compra(150, "2 days");
  const newPurchase = await compra(100, "1 day");

  let server: Server | undefined;
  try {
    server = createServer(app);
    const baseUrl = await new Promise<string>((resolve) => {
      server!.listen(0, "127.0.0.1", () => {
        const address = server!.address();
        assert.ok(address && typeof address !== "string");
        resolve(`http://127.0.0.1:${address.port}/api`);
      });
    });
    const api = async (
      sessionId: string,
      path: string,
      init: RequestInit = {},
    ) =>
      fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          Cookie: `mariana_session=${sessionId}`,
          "Content-Type": "application/json",
          ...init.headers,
        },
      });
    const post = (
      sessionId: string,
      path: string,
      body: Record<string, unknown>,
    ) => api(sessionId, path, { method: "POST", body: JSON.stringify(body) });

    const clientBody = {
      tipo: "CLIENTE",
      entidadId: Number(cliente.id),
      documentoMovimientoId: Number(newSale.id),
      importe: 30,
      formaPago: "EFECTIVO",
      cuentaDestino: "CAJA_FISICA",
      motivo: "Pago separado autorizado por la gerencia",
    };
    assert.equal(
      (await post(cajaSession, "/pagos-dirigidos", {
        ...clientBody,
        motivo: "muy corto",
      })).status,
      400,
    );
    assert.equal(
      (await post(cajaSession, "/pagos-dirigidos", {
        ...clientBody,
        importe: 500,
      })).status,
      409,
      "La solicitud debe validar el saldo antes de quedar pendiente.",
    );
    const beforePending = Number(
      (await one(
        "SELECT COUNT(*)::int count FROM movimientos_credito WHERE cliente_id=$1 AND tipo='ABONO'",
        [cliente.id],
      )).count,
    );
    const pendingResponse = await post(cajaSession, "/pagos-dirigidos", clientBody);
    assert.equal(pendingResponse.status, 201);
    const pending = (await pendingResponse.json()) as {
      id: number;
      estado: string;
      movimientoId: number | null;
    };
    assert.equal(pending.estado, "PENDIENTE");
    assert.equal(pending.movimientoId, null);
    assert.equal(
      Number(
        (await one(
          "SELECT COUNT(*)::int count FROM movimientos_credito WHERE cliente_id=$1 AND tipo='ABONO'",
          [cliente.id],
        )).count,
      ),
      beforePending,
      "Una solicitud no ADMIN no debe tocar el ledger.",
    );

    const cajaFeedResponse = await api(cajaSession, "/notificaciones/feed");
    assert.equal(cajaFeedResponse.status, 200);
    const cajaFeed = (await cajaFeedResponse.json()) as {
      sessionKey: string;
      events: Array<{
        id: string;
        family: string;
        kind: string;
        siteId: number | null;
      }>;
    };
    assert.match(cajaFeed.sessionKey, /^[a-f0-9]{24}$/);
    assert.ok(
      cajaFeed.events.some(
        (event) =>
          event.id === `directed-payment:${pending.id}` &&
          event.family === "SOLICITUD",
      ),
    );
    assert.ok(
      cajaFeed.events.some(
        (event) =>
          event.id === `ticket-ready:${oldTicket.id}` &&
          event.family === "AVISO" &&
          event.siteId === Number(location.id),
      ),
    );
    assert.ok(
      !cajaFeed.events.some(
        (event) => event.id === `ticket-ready:${otherSiteTicket.id}`,
      ),
      "Caja no debe recibir tickets de otro sitio.",
    );

    const adminFeedResponse = await api(adminSession, "/notificaciones/feed");
    assert.equal(adminFeedResponse.status, 200);
    const adminFeed = (await adminFeedResponse.json()) as {
      sessionKey: string;
      events: Array<{ id: string; family: string }>;
    };
    assert.notEqual(adminFeed.sessionKey, cajaFeed.sessionKey);
    assert.ok(
      adminFeed.events.some(
        (event) =>
          event.id === `directed-payment:${pending.id}` &&
          event.family === "SOLICITUD",
      ),
    );

    const approvalResponse = await post(
      adminSession,
      `/pagos-dirigidos/${pending.id}/aprobar`,
      {},
    );
    assert.equal(approvalResponse.status, 201);
    const approval = (await approvalResponse.json()) as { movimientoId: number };
    assert.equal(
      (await post(
        adminSession,
        `/pagos-dirigidos/${pending.id}/aprobar`,
        {},
      )).status,
      409,
    );
    const directedApplication = await one(
      `SELECT importe::text
       FROM aplicaciones_credito
       WHERE abono_movimiento_id=$1 AND venta_movimiento_id=$2`,
      [approval.movimientoId, newSale.id],
    );
    assert.equal(directedApplication.importe, "30.00");

    const rejectedResponse = await post(cajaSession, "/pagos-dirigidos", {
      ...clientBody,
      importe: 10,
      motivo: "El cliente pidió separar este segundo abono",
    });
    assert.equal(rejectedResponse.status, 201);
    const rejected = (await rejectedResponse.json()) as { id: number };
    assert.equal(
      (
        await post(
          adminSession,
          `/pagos-dirigidos/${rejected.id}/rechazar`,
          { motivoRechazo: "Debe mantenerse el orden normal del adeudo" },
        )
      ).status,
      200,
    );
    const fifoResponse = await post(
      cajaSession,
      `/clientes/${cliente.id}/pagos`,
      {
        importe: 50,
        formaPago: "EFECTIVO",
        cuentaDestino: "CAJA_FISICA",
      },
    );
    assert.equal(fifoResponse.status, 201);
    const fifoPayment = (await fifoResponse.json()) as {
      id: number;
      asignaciones: Array<{ movimientoVentaId: number; aplicado: string }>;
    };
    assert.equal(
      fifoPayment.asignaciones[0]?.movimientoVentaId,
      Number(oldSale.id),
    );
    assert.equal(fifoPayment.asignaciones[0]?.aplicado, "50.00");

    const isolatedPaymentResponse = await post(
      cajaSession,
      `/clientes/${reversalClient.id}/pagos`,
      {
        importe: 100,
        formaPago: "EFECTIVO",
        cuentaDestino: "CAJA_FISICA",
      },
    );
    assert.equal(isolatedPaymentResponse.status, 201);
    const isolatedPayment = (await isolatedPaymentResponse.json()) as {
      id: number;
    };
    const reverseFifoResponse = await post(
      adminSession,
      `/clientes/${reversalClient.id}/pagos/${isolatedPayment.id}/reversar`,
      { motivo: "Corrección de abono aplicado por error" },
    );
    assert.equal(reverseFifoResponse.status, 201);
    const restoredTicketResponse = await api(
      adminSession,
      `/tickets/${reversalTicket.id}`,
    );
    assert.equal(restoredTicketResponse.status, 200);
    const restoredTicket = (await restoredTicketResponse.json()) as {
      saldoPendiente: string;
    };
    assert.equal(
      restoredTicket.saldoPendiente,
      "100.00",
      "El detalle debe restaurar el saldo al revertir el ABONO.",
    );
    const restoredPreviewResponse = await post(
      cajaSession,
      `/clientes/${reversalClient.id}/pagos/vista-previa`,
      { importe: 50 },
    );
    assert.equal(restoredPreviewResponse.status, 200);
    const restoredPreview = (await restoredPreviewResponse.json()) as {
      asignaciones: Array<{
        movimientoVentaId: number;
        ticketId: number;
        aplicado: string;
      }>;
    };
    assert.equal(
      restoredPreview.asignaciones[0]?.movimientoVentaId,
      Number(reversalSale.id),
    );
    assert.equal(
      restoredPreview.asignaciones[0]?.ticketId,
      Number(reversalTicket.id),
    );
    assert.equal(restoredPreview.asignaciones[0]?.aplicado, "50.00");

    await pool.query(
      `INSERT INTO movimientos_credito(
         cliente_id,ticket_id,tipo,importe,usuario_id,forma_pago,created_at
       ) VALUES($1,$2,'REVERSO','-60.00',$3,'EFECTIVO',now())`,
      [cliente.id, oldTicket.id, admin.id],
    );
    const paymentAfterLinkedReversalResponse = await post(
      cajaSession,
      `/clientes/${cliente.id}/pagos`,
      {
        importe: 20,
        formaPago: "EFECTIVO",
        cuentaDestino: "CAJA_FISICA",
      },
    );
    assert.equal(paymentAfterLinkedReversalResponse.status, 201);
    const paymentAfterLinkedReversal =
      (await paymentAfterLinkedReversalResponse.json()) as {
        asignaciones: Array<{
          movimientoVentaId: number;
          aplicado: string;
        }>;
      };
    assert.deepEqual(
      paymentAfterLinkedReversal.asignaciones.map((item) => [
        item.movimientoVentaId,
        item.aplicado,
      ]),
      [
        [Number(oldSale.id), "10.00"],
        [Number(newSale.id), "10.00"],
      ],
      "El cobro real debe descontar el reverso ligado antes de continuar FIFO.",
    );

    const directAdminResponse = await post(adminSession, "/pagos-dirigidos", {
      ...clientBody,
      importe: 15,
      formaPago: "TRANSFERENCIA",
      cuentaDestino: "CUENTA_FISCAL",
      referencia: `${tag}-TRANSFER`,
      motivo: "Aplicación excepcional revisada por administración",
    });
    assert.equal(directAdminResponse.status, 201);
    const directAdmin = (await directAdminResponse.json()) as {
      estado: string;
      movimientoId: number;
    };
    assert.equal(directAdmin.estado, "APROBADA");

    const supplierPendingResponse = await post(
      cajaSession,
      "/pagos-dirigidos",
      {
        tipo: "PROVEEDOR",
        entidadId: Number(proveedor.id),
        documentoMovimientoId: Number(newPurchase.id),
        importe: 30,
        formaPago: "TRANSFERENCIA",
        referencia: `${tag}-SUPPLIER`,
        motivo: "Pago específico solicitado por compras urgentes",
      },
    );
    assert.equal(supplierPendingResponse.status, 201);
    const supplierPending = (await supplierPendingResponse.json()) as {
      id: number;
      movimientoId: number | null;
    };
    assert.equal(supplierPending.movimientoId, null);
    const supplierApprovalResponse = await post(
      adminSession,
      `/pagos-dirigidos/${supplierPending.id}/aprobar`,
      {},
    );
    assert.equal(supplierApprovalResponse.status, 201);
    const supplierApproval = (await supplierApprovalResponse.json()) as {
      movimientoId: number;
    };
    assert.equal(
      (
        await one(
          `SELECT importe::text
           FROM aplicaciones_pago_proveedor
           WHERE pago_proveedor_id=$1 AND compra_proveedor_id=$2`,
          [supplierApproval.movimientoId, newPurchase.id],
        )
      ).importe,
      "30.00",
    );

    const supplierFifoResponse = await post(
      adminSession,
      `/proveedores/${proveedor.id}/pagos`,
      { importe: 40, formaPago: "EFECTIVO" },
    );
    assert.equal(supplierFifoResponse.status, 201);
    const supplierFifo = (await supplierFifoResponse.json()) as {
      id: number;
      aplicaciones: Array<{ compraProveedorId: number; importe: string }>;
    };
    assert.equal(
      supplierFifo.aplicaciones[0]?.compraProveedorId,
      Number(oldPurchase.id),
    );
    assert.equal(supplierFifo.aplicaciones[0]?.importe, "40.00");

    const report = await buildCommercialReport("clientes", {
      input: {},
      range: {
        desde: new Date(Date.now() - 86_400_000),
        hasta: new Date(Date.now() + 86_400_000),
        previousDesde: new Date(Date.now() - 3 * 86_400_000),
        previousHasta: new Date(Date.now() - 2 * 86_400_000),
        yearAgoDesde: new Date(Date.now() - 366 * 86_400_000),
        yearAgoHasta: new Date(Date.now() - 365 * 86_400_000),
      },
    });
    const directedTable = report.tables.find(
      (table) => table.id === "pagos-dirigidos",
    );
    assert.ok(directedTable);
    assert.ok(
      directedTable.rows.some(
        (row: Record<string, unknown>) =>
          row.motivo === clientBody.motivo &&
          row.clienteProveedor === `${tag} Cliente` &&
          row.solicitante === `${tag} Caja` &&
          row.autorizador === admin.nombre,
      ),
      "Reportes debe conservar contraparte, documento, motivo y actores.",
    );

    assert.equal(
      (
        await post(
          adminSession,
          `/clientes/${cliente.id}/pagos/${approval.movimientoId}/reversar`,
          { motivo: "Reverso de verificación del pago dirigido" },
        )
      ).status,
      201,
    );
    assert.equal(
      (
        await one(
          `SELECT COUNT(*)::int count
           FROM movimientos_credito
           WHERE tipo='REVERSO' AND movimiento_origen_id=$1`,
          [approval.movimientoId],
        )
      ).count,
      1,
    );
    assert.equal(
      (
        await post(
          adminSession,
          `/proveedores/${proveedor.id}/pagos/${supplierApproval.movimientoId}/reversar`,
          { motivo: "Reverso de verificación del pago dirigido" },
        )
      ).status,
      201,
    );
    assert.equal(
      (
        await one(
          `SELECT COUNT(*)::int count
           FROM pagos_proveedor
           WHERE tipo='REVERSO' AND movimiento_origen_id=$1`,
          [supplierApproval.movimientoId],
        )
      ).count,
      1,
    );

    const legacyClient = await one(
      `INSERT INTO clientes(
         nombre,activo,es_sistema,limite_credito,saldo_credito,dias_credito
       ) VALUES($1,true,false,1000,0,30) RETURNING id`,
      [`${tag} Cliente dirigido histórico`],
    );
    const legacyOldTicket = await one(
      `INSERT INTO tickets(
         folio,uuid_cliente,ubicacion_id,usuario_terminal_id,cliente_id,
         subtotal,iva,tasa_iva,total,estado,cobrado,facturado,created_at
       ) VALUES(
         $1,gen_random_uuid(),$2,$3,$4,100,0,0,100,
         'VENDIDO',false,false,now()-interval '4 days'
       ) RETURNING id,folio`,
      [folio++, location.id, caja.id, legacyClient.id],
    );
    const legacyNewTicket = await one(
      `INSERT INTO tickets(
         folio,uuid_cliente,ubicacion_id,usuario_terminal_id,cliente_id,
         subtotal,iva,tasa_iva,total,estado,cobrado,facturado,created_at
       ) VALUES(
         $1,gen_random_uuid(),$2,$3,$4,100,0,0,100,
         'VENDIDO',false,false,now()-interval '3 days'
       ) RETURNING id,folio`,
      [folio++, location.id, caja.id, legacyClient.id],
    );
    const legacyOldSale = await one(
      `INSERT INTO movimientos_credito(
         cliente_id,ticket_id,tipo,importe,usuario_id,forma_pago,created_at
       ) VALUES($1,$2,'VENTA_CREDITO','100.00',$3,'CREDITO',now()-interval '4 days')
       RETURNING id`,
      [legacyClient.id, legacyOldTicket.id, admin.id],
    );
    const legacyNewSale = await one(
      `INSERT INTO movimientos_credito(
         cliente_id,ticket_id,tipo,importe,usuario_id,forma_pago,created_at
       ) VALUES($1,$2,'VENTA_CREDITO','100.00',$3,'CREDITO',now()-interval '3 days')
       RETURNING id`,
      [legacyClient.id, legacyNewTicket.id, admin.id],
    );
    const legacyDirectedAbono = await one(
      `INSERT INTO movimientos_credito(
         cliente_id,ticket_id,tipo,importe,usuario_id,forma_pago,cuenta_destino,
         created_at,metadata
       ) VALUES(
         $1,NULL,'ABONO','-30.00',$2,'EFECTIVO','CAJA_FISICA',
         now()-interval '2 days',$3
       ) RETURNING id`,
      [
        legacyClient.id,
        admin.id,
        JSON.stringify({ origen: "PAGO_DIRIGIDO", solicitudId: "legacy-test" }),
      ],
    );
    await pool.query(
      `INSERT INTO solicitudes_pago_dirigido(
         tipo,entidad_id,documento_movimiento_id,importe,forma_pago,cuenta_destino,
         motivo,solicitante_id,solicitante_nombre,autorizador_id,autorizador_nombre,
         contraparte_nombre,documento_folio,movimiento_id,estado,resuelta_at
       ) VALUES(
         'CLIENTE',$1,$2,30,'EFECTIVO','CAJA_FISICA',
         'Reconstrucción de pago dirigido histórico',$3,$4,$3,$4,
         $5,$6,$7,'APROBADA',now()
       )`,
      [
        legacyClient.id,
        legacyNewSale.id,
        admin.id,
        admin.nombre,
        `${tag} Cliente dirigido histórico`,
        String(legacyNewTicket.folio),
        legacyDirectedAbono.id,
      ],
    );
    await pool.query(
      `INSERT INTO aplicaciones_credito(
         abono_movimiento_id,venta_movimiento_id,importe
       ) VALUES($1,$2,'30.00')`,
      [legacyDirectedAbono.id, legacyNewSale.id],
    );

    const legacyReadProjection = await loadCustomerCreditProjection(
      Number(legacyClient.id),
    );
    const legacyTransactionProjection = await db.transaction((tx) =>
      loadCustomerCreditProjectionInTransaction(Number(legacyClient.id), tx)
    );
    for (const projection of [
      legacyReadProjection,
      legacyTransactionProjection,
    ]) {
      assert.deepEqual(
        projection.allCharges.map((charge) => [
          charge.movimientoId,
          charge.pendienteCents,
        ]),
        [
          [Number(legacyOldSale.id), 10_000],
          [Number(legacyNewSale.id), 7_000],
        ],
        "Historical directed payments must remain targeted in shared reads and POS transactions.",
      );
    }
  } finally {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await pool.end();
  }
});