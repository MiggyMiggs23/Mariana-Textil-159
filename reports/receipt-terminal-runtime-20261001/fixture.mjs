import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { installFinancialSchema as installHistoricalFinancialSchema } from "../permission-nine-runtime-20261001/fixture.mjs";
import { installReceiptPrintAuthority } from "../../lib/db/src/lib/receipt-print-authority.mjs";

/** Fresh receipt-feature databases finish the historical E5/E11 chain with the current guard. */
export async function installFinancialSchema(pool, provenance) {
  await installHistoricalFinancialSchema(pool, provenance);
  provenance.push(await installReceiptPrintAuthority(pool));
}

export async function prepareFixture(pool, password) {
  const admin = (await pool.query("SELECT id,usuario username,rol role FROM usuarios WHERE usuario='admin' AND rol='ADMIN'")).rows[0];
  assert.ok(admin);
  // Default-role actors deliberately have NO overrides for the receipt module.
  const defaults = (await pool.query("SELECT * FROM permisos_rol WHERE modulo='recibos_abonos' ORDER BY rol")).rows;
  assert.ok(defaults.some(p => p.rol === "ADMIN" && p.puede_ver), "Candidate initializer must install ADMIN receipt default");
  assert.ok(defaults.some(p => p.rol === "TERMINAL" && p.puede_ver), "Candidate initializer must install TERMINAL receipt default");
  assert.ok(defaults.some(p => p.rol === "CAJA" && p.puede_ver === false), "Custom-grant proof requires a nondefault CAJA receipt role");
  const fixture = {admin, defaults, sites: [], actors: [], sources: [], receipts: []};
  for (const [index, name, initials] of [[1,"Receipt isolated own","RTO"],[2,"Receipt isolated other","RTB"]]) {
    const site = (await pool.query("INSERT INTO ubicaciones(nombre,iniciales,tipo) VALUES($1,$2,'TIENDA') RETURNING id,nombre", [name,initials])).rows[0];
    fixture.sites.push(site);
    for (const [role, variant] of index === 1 ? [["CAJA","receive"],["TERMINAL","default"],["CAJA","custom-granted"],["CAJA","custom-denied"]] : [["CAJA","receive"]]) {
      const username = `receipt_${index}_${role.toLowerCase()}_${variant.replaceAll("-","_")}`;
      const actor = (await pool.query(`INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id,alcance_consulta)
        VALUES($1,$1,crypt($2,gen_salt('bf',10)),$3,$4,'PROPIA') RETURNING id`,
        [username,password,role,site.id])).rows[0];
      Object.assign(actor,{username,role,variant,site:site.id});
      if (role === "CAJA") {
        // Only operational inputs; no ADMIN authority or financial application grants.
        await pool.query(`INSERT INTO permisos_usuario(usuario_id,modulo,puede_ver,puede_crear,puede_editar,puede_autorizar)
          SELECT $1,modulo,true,true,false,false FROM permisos_rol
          WHERE modulo IN ('caja_abonos','clientes_finanzas','cortes','clientes') GROUP BY modulo`,[actor.id]);
      }
      if (variant.startsWith("custom-")) await pool.query(`INSERT INTO permisos_usuario(usuario_id,modulo,puede_ver,puede_crear,puede_editar,puede_autorizar)
        VALUES($1,'recibos_abonos',$2,false,false,false)`, [actor.id,variant === "custom-granted"]);
      fixture.actors.push(actor);
    }
    for (const kind of ["api-e3","api-e5","browser-e3","browser-e5-directed","browser-e5-retained"]) {
      const clientName = `Receipt ${index} ${kind}`;
      const client = (await pool.query(`INSERT INTO clientes(nombre,es_sistema,dias_credito,limite_credito)
        VALUES($1,false,30,1000) RETURNING id`,[clientName])).rows[0].id;
      const key = randomUUID(), folio = 13000 + fixture.sources.length;
      const ticket = (await pool.query(`INSERT INTO tickets(folio,uuid_cliente,ubicacion_id,cliente_id,usuario_terminal_id,
        estado,documento_tipo,autorizacion_estado,facturado,credito,cobrado,total,subtotal,iva,tasa_iva,dias_plazo,fecha_vencimiento)
        VALUES($1,$2,$3,$4,$5,'VENDIDO','NOTA','AUTORIZADA',false,true,true,10,10,0,0,30,current_date+30) RETURNING id`,
      [folio,key,site.id,client,admin.id])).rows[0].id;
      await pool.query(`INSERT INTO operaciones_credito_e1(productor,clave,naturaleza,usuario_id,solicitud_canonica)
        VALUES('VENTA_CREDITO',$1,'OPERACION_CREDITO_SIN_DINERO',$2,'{"fixture":"receipt-terminal-native"}')`,[key,admin.id]);
      const movement = (await pool.query(`INSERT INTO movimientos_credito(cliente_id,ticket_id,tipo,importe,usuario_id,
        naturaleza,sitio_origen_id,operacion_productor,operacion_clave)
        VALUES($1,$2,'VENTA_CREDITO',10,$3,'OPERACION_CREDITO_SIN_DINERO',$4,'VENTA_CREDITO',$5) RETURNING id`,
      [client,ticket,admin.id,site.id,key])).rows[0].id;
      fixture.sources.push({kind,site:site.id,client,clientName,ticket,folio,movement});
    }
  }
  return fixture;
}

export async function seedReceipts(api, fixture, persist) {
  for (const site of fixture.sites) {
    if (!site.session) {
      const r = await api("POST","/api/sesiones-caja/abrir",{ubicacionId:site.id,fondoInicial:0});
      assert.equal(r.status,201,JSON.stringify(r));site.session=r.body.id;assert.ok(site.session);persist();
    }
    for (const source of fixture.sources.filter(s=>s.site===site.id && s.kind.startsWith("api-"))) {
      if (fixture.receipts.some(r=>r.source===source.kind && r.site===site.id)) continue;
      source.key ??= randomUUID();persist();
      if (source.kind === "api-e3") {
        const input={clienteId:source.client,importeCentavos:1000,formaPago:"TRANSFERENCIA",cuentaDestino:"CUENTA_FISCAL",
          sitioId:site.id,sesionCajaId:site.session,operacionClave:source.key};
        const preview=await api("POST","/api/caja/abonos-e3/vista-previa",input);
        assert.equal(preview.status,200,JSON.stringify(preview));
        const r=await api("POST","/api/caja/abonos-e3",{...input,previewToken:preview.body.previewToken});
        assert.equal(r.status,201,JSON.stringify(r));
        assert.ok(r.body.recibo?.folio);
        fixture.receipts.push({family:"e3",source:source.kind,site:site.id,client:source.client,folio:r.body.recibo.folio,body:r.body});
      } else {
        const ctx=await api("GET",`/api/e5/contexto?clienteId=${source.client}&ubicacionId=${site.id}`);
        assert.equal(ctx.status,200,JSON.stringify(ctx));
        source.input ??= {claveOperacion:source.key,clienteId:source.client,ubicacionId:site.id,versionContexto:ctx.body.versionContexto,
          entrada:"CAJA",sesionOperativaId:site.session,importe:"10.00",formaPago:"TRANSFERENCIA",cuentaDestino:"CUENTA_FISCAL",
          notasIndicadas:[source.ticket],evidencia:{descripcion:"Native isolated receipt fixture",referencias:["receipt-terminal-runtime"]}};
        persist();
        const r=await api("POST","/api/e5/cobros",source.input);
        assert.ok([200,201].includes(r.status),JSON.stringify(r));
        assert.equal(r.body.importePendiente,"10.00");
        fixture.receipts.push({family:"e5",source:source.kind,site:site.id,client:source.client,id:r.body.id,documentId:r.body.reciboId,body:r.body});
      }
      persist();
    }
  }
}

// Full SQL-native text rows, sorted independent of driver date/numeric parsers.
// Include immutable financial graphs, money, status, allocations and document snapshots.
// Exclude ONLY authentication, view tokens, and printing's intended append-only audit.
export async function financialSnapshot(pool) {
  const tables=(await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='public'
    AND (tablename ~ '^e5_' OR tablename ~ '^fondo_' OR tablename ~ '^e11_'
      OR tablename ~ 'credito|^ticket_|^sesiones_caja|^salidas_dinero|^aplicaciones_|^operaciones_'
      OR tablename IN ('movimientos_credito','operaciones_credito_e1','cobros_credito_pendientes_e1',
      'tickets','ticket_pagos','aplicaciones_credito','recibos_abono_e3','recibo_folio_e3','sesiones_caja',
      'movimientos_caja','salidas_dinero','clientes'))
    AND tablename <> 'e5_impresiones' ORDER BY tablename`)).rows.map(r=>r.tablename);
  assert.ok(tables.includes("e5_cobros") && tables.includes("recibos_abono_e3"));
  const result={};
  for (const table of tables) {
    assert.match(table,/^[a-z0-9_]+$/);
    const rows=(await pool.query(`SELECT row_to_json(t)::text value FROM public."${table}" t ORDER BY row_to_json(t)::text`)).rows.map(r=>r.value);
    result[table]={count:rows.length,sha256:createHash("sha256").update(JSON.stringify(rows)).digest("hex"),rows};
  }
  const guards=(await pool.query(`SELECT c.relname table_name,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) definition
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE NOT t.tgisinternal AND n.nspname='public' ORDER BY c.relname,t.tgname`)).rows;
  assert.ok(guards.length>0);
  assert.ok(guards.every(g=>g.tgenabled==="O" || g.tgenabled==="A"),"A native guard was disabled");
  result.nativeGuards={count:guards.length,sha256:createHash("sha256").update(JSON.stringify(guards)).digest("hex"),rows:guards};
  return result;
}

export async function printAudit(pool) {
  return {
    audit:(await pool.query(`SELECT id::text,usuario_id,accion,entidad,entidad_id,datos_despues
      FROM auditoria WHERE accion IN ('E3_RECIBO_IMPRESION_SOLICITADA','E5_IMPRIMIR') ORDER BY id`)).rows,
    e5:(await pool.query("SELECT * FROM e5_impresiones ORDER BY clave")).rows,
    receipts:(await pool.query("SELECT folio,cliente_id,movimiento_id,snapshot FROM recibos_abono_e3 ORDER BY folio")).rows,
    e5Documents:(await pool.query("SELECT id,cobro_id FROM e5_documentos ORDER BY id")).rows,
  };
}