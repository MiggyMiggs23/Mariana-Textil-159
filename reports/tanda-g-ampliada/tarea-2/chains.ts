import fs from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db, pool } from "@inventory-db";
import { crearRollo, transferirRolloInmediato, moverRollo, recibirTransferencia, reactivarFaltanteAuditoria, venderRollo, salidaMostrador, crearSalidaExtraordinaria, revertirMovimiento, consumirBolsasFifo, reconstruirCacheExistencias } from "@inventory-engine";
const c = JSON.parse(fs.readFileSync(process.env.INVENTORY_HANDOFF!, "utf8"));
assert.equal(process.env.MAIN_READY, "yes");
const identity = (await pool.query("select current_database() db,inet_server_port() port,current_user actor")).rows[0];
assert.equal(identity.db, "tanda_ga_inventory"); assert.equal(identity.port, 55442); assert.equal(identity.actor, "ga_inventory");
const constraint = (await pool.query("select convalidated,pg_get_constraintdef(oid) definition from pg_constraint where conname='tanda_ga_t2_physical_nonnegative'")).rows;
const f = JSON.parse(fs.readFileSync(c.fixtureManifest, "utf8"));
const transit = (await pool.query("select id from ubicaciones where tipo='TRANSITO' order by id limit 1")).rows[0];
assert.ok(transit, "Existing transit location required");
const records: any[] = [], rollback = new Error("rollback");
for (const site of f.sites.slice(0, 2)) for (const unit of ["METRO", "KILO", "PIEZA", "BOLSA"]) {
  const other = f.sites.find((s: any) => s.id !== site.id);
  const product = f.products.find((p: any) => p.unidad === unit);
  const base = { productoId: product.id, ubicacionId: site.id, usuarioId: f.actors.admin.id, cantidadInicial: "10", costoUnitario: "100", estado: "DISPONIBLE" as const };
  for (const scenario of ["transfer-roundtrip", "transit-receive-repeat", "audit-without-evidence", "sale-reverse", "mostrador-terminal", "extraordinary-terminal", ...(unit === "BOLSA" ? ["FIFO-valid", "FIFO-negative", "FIFO-insufficient"] : [])]) {
    const row: any = { site: site.id, unit, scenario };
    try {
      await db.transaction(async (tx: any) => {
        const created = await crearRollo(tx, base);
        const rolloId = created.rollo.id, usuarioId = base.usuarioId;
        if (scenario === "transit-receive-repeat") {
          const moved = await moverRollo(tx, { rolloId, usuarioId, ubicacionOrigenId: site.id, ubicacionTransitoId: transit.id });
          assert.equal(moved.rollo.estado, "EN_TRANSITO"); assert.equal(moved.rollo.ubicacionId, transit.id);
          const received = await recibirTransferencia(tx, { rolloId, usuarioId, ubicacionDestinoId: other.id });
          assert.equal(received.rollo.estado, "DISPONIBLE"); assert.equal(received.rollo.ubicacionId, other.id);
          assert.equal(Number(received.rollo.cantidadActual), 10);
          let code;
          try { await recibirTransferencia(tx, { rolloId, usuarioId, ubicacionDestinoId: site.id }); } catch (e: any) { code = e.code; }
          assert.ok(code); row.repeatReceptionCode = code; row.after = received.rollo;
        } else if (scenario === "audit-without-evidence") {
          let code;
          try { await reactivarFaltanteAuditoria(tx, { rolloId, usuarioId, auditoriaOrigenId: 0, origen: "ROLLO", ubicacionId: site.id, pisoId: null, motivo: "Tanda GA rejects missing audit evidence", uuidCliente: randomUUID(), rol: "ADMIN", ip: "127.0.0.1" }); } catch (e: any) { code = e.code; }
          assert.ok(code); row.rejectedCode = code;
        } else if (scenario === "transfer-roundtrip") {
          const outbound = await transferirRolloInmediato(tx, { rolloId, usuarioId, ubicacionOrigenId: site.id, ubicacionDestinoId: other.id, documentoTipo: "TANDA_GA", documentoId: randomUUID() });
          assert.equal(outbound.rollo.ubicacionId, other.id);
          assert.equal(Number(outbound.salidaMovimiento.cantidad), -10);
          assert.equal(Number(outbound.entradaMovimiento.cantidad), 10);
          let code;
          try { await transferirRolloInmediato(tx, { rolloId, usuarioId, ubicacionOrigenId: site.id, ubicacionDestinoId: other.id, documentoTipo: "TANDA_GA", documentoId: randomUUID() }); } catch (e: any) { code = e.code; }
          assert.ok(code, "Stale origin should fail");
          const back = await transferirRolloInmediato(tx, { rolloId, usuarioId, ubicacionOrigenId: other.id, ubicacionDestinoId: site.id, documentoTipo: "TANDA_GA", documentoId: randomUUID() });
          assert.equal(back.rollo.ubicacionId, site.id); assert.equal(Number(back.rollo.cantidadActual), 10);
          row.staleOriginCode = code; row.after = back.rollo;
        } else if (scenario === "sale-reverse") {
          const sold = await venderRollo(tx, { rolloId, usuarioId });
          assert.equal(sold.rollo.estado, "VENDIDO");
          assert.equal(Number(sold.movimiento.cantidad), -10);
          const reversed = await revertirMovimiento(tx, { movimientoOrigenId: sold.movimiento.id, usuarioId, justificacion: "Tanda GA reverse valid sale" });
          assert.equal(reversed.rollo.estado, "DISPONIBLE"); assert.equal(Number(reversed.rollo.cantidadActual), 10);
          row.after = reversed.rollo;
        } else if (scenario.startsWith("FIFO")) {
          const quantity = scenario === "FIFO-valid" ? "2" : scenario === "FIFO-negative" ? "-2" : "9999999";
          try {
            const movements = await consumirBolsasFifo(tx, { ...base, cantidad: quantity, documentoId: randomUUID() });
            assert.equal(scenario, "FIFO-valid");
            assert.equal(movements.reduce((sum: number, m: any) => sum + Number(m.cantidad), 0), -2);
            row.movements = movements;
          } catch (error: any) {
            if (scenario === "FIFO-valid" || !error.code || error.code === "ERR_ASSERTION") throw error;
            row.rejectedCode = error.code;
          }
        } else {
          const result = scenario === "mostrador-terminal"
            ? await salidaMostrador(tx, { rolloId, usuarioId })
            : await crearSalidaExtraordinaria(tx, { rolloId, usuarioId, motivo: "MERMA", justificacion: "Tanda GA valid whole physical exit", uuidCliente: randomUUID(), ip: "127.0.0.1" });
          assert.equal(Number(result.rollo.cantidadActual), 0);
          assert.equal(Number(result.movimiento.cantidad), -10);
          let code;
          try { await venderRollo(tx, { rolloId, usuarioId }); } catch (e: any) { code = e.code; }
          assert.ok(code, "Terminal cannot be resold"); row.repeatSaleCode = code; row.after = result.rollo;
        }
        await reconstruirCacheExistencias(tx);
        row.pass = true;
        throw rollback;
      });
    } catch (error: any) { if (error !== rollback) Object.assign(row, { pass: false, code: error.code, message: error.message }); }
    records.push(row);
  }
}
fs.writeFileSync(`reports/tanda-g-ampliada/tarea-2/chains-${constraint.length ? "check" : "baseline"}.json`, JSON.stringify({ identity, constraint, records }, null, 2));
await pool.end();
assert.ok(records.every(r => r.pass), "Chain scenario failure: inspect evidence");