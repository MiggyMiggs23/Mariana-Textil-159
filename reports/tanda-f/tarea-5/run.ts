import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { db, pool } from "../../../lib/db/src/index";
import { ajustarRollo, revertirMovimiento, venderRollo } from "../../../artifacts/api-server/src/lib/inventario";
import { crearSalida, enviarSalida, recibirSalida } from "../../../artifacts/api-server/src/lib/salidas";
import { crearTicket, cancelarTicket } from "../../../artifacts/api-server/src/lib/pos";

const dir = "reports/tanda-f/tarea-5";
const manifest = JSON.parse(fs.readFileSync("reports/tanda-f/setup/fixture-manifest-redacted.json", "utf8"));
const selected = Number(process.argv[2]);
const report: any = { case: selected, started: new Date().toISOString(), transport: "real production helpers / real PostgreSQL, not HTTP", steps: [] };
function save() { fs.writeFileSync(`${dir}/case-${selected}.json`, JSON.stringify(report, null, 2)); }
async function identity() {
  const pid = Number(fs.readFileSync(".local/tanda-f/cluster/postmaster.pid", "utf8").split("\n")[0]);
  const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0");
  if (!cmd.includes("/home/runner/workspace/.local/tanda-f/cluster") || !cmd.includes("55440")) throw Error("Process mismatch");
  const row = (await pool.query("select current_database() db,current_setting('data_directory') directory,inet_server_port() port")).rows[0];
  if (row.db !== "tanda_f_reversal" || row.port !== 55440 || row.directory !== "/home/runner/workspace/.local/tanda-f/cluster") throw Error("Database mismatch");
  return { ...row, pid };
}
const reconciliationSql = `with pairs as (
 select producto_id,ubicacion_id from movimientos where producto_id=$1
 union select producto_id,ubicacion_id from rollos where producto_id=$1
 union select producto_id,ubicacion_id from existencias where producto_id=$1)
 select p.producto_id,p.ubicacion_id,pr.unidad,
 coalesce((select sum(cantidad_actual) from rollos r where r.producto_id=p.producto_id and r.ubicacion_id=p.ubicacion_id and estado='DISPONIBLE'),0)::text available_roll_sum,
 coalesce((select sum(cantidad_actual) from rollos r where r.producto_id=p.producto_id and r.ubicacion_id=p.ubicacion_id and estado in ('DISPONIBLE','EN_TRANSITO')),0)::text inventory_roll_sum,
 coalesce((select sum(cantidad) from movimientos m where m.producto_id=p.producto_id and m.ubicacion_id=p.ubicacion_id),0)::text signed_ledger,
 (select cantidad_total::text from existencias e where e.producto_id=p.producto_id and e.ubicacion_id=p.ubicacion_id) cache
 from pairs p join productos pr on pr.id=p.producto_id order by p.ubicacion_id`;
let fixture: any;
async function snapshot() {
  return {
    balance: (await pool.query(reconciliationSql, [fixture.productId])).rows,
    roll: (await pool.query("select id,producto_id,ubicacion_id,estado,cantidad_actual from rollos where id=$1", [fixture.id])).rows,
    movements: (await pool.query("select id,tipo,cantidad,ubicacion_id,movimiento_origen_id,documento_tipo,documento_id from movimientos where rollo_id=$1 order by id", [fixture.id])).rows,
    documents: (await pool.query("select s.id,s.estado,s.origen_id,s.destino_id from salidas s join salida_rollos sr on sr.salida_id=s.id where sr.rollo_id=$1", [fixture.id])).rows,
  };
}
async function step(name: string, fn: (tx: any) => Promise<any>) {
  report.identity = await identity();
  try {
    const result = await db.transaction(fn);
    report.steps.push({ name, committed: true, snapshot: await snapshot() }); save();
    return result;
  } catch (error: any) {
    report.steps.push({ name, committed: false, error: { message: error.message, code: error.code, cause: error.cause?.message, causeCode: error.cause?.code }, snapshot: await snapshot() }); save();
    throw error;
  }
}
const actor = manifest.actors.admin.id;
const justification = "Tanda F diagnóstico autorizado";
const reverse = (movement: any) => step(`reverse movement ${movement}`, tx => revertirMovimiento(tx, { movimientoOrigenId: Number(movement), usuarioId: actor, justificacion: justification, uuidCliente: randomUUID() }));
const adjust = (amount?: string) => step(amount === undefined ? "manual BAJA" : `adjust to ${amount}`, tx => ajustarRollo(tx, { rolloId: fixture.id, usuarioId: actor, justificacion: justification, cantidadNueva: amount, uuidCliente: randomUUID() }));
async function transfer(receive = true) {
  const doc = await step("create transfer document", tx => crearSalida(tx, { origenId: fixture.siteId, destinoId: manifest.sites[1].id, usuarioSolicitaId: actor, uuidCliente: randomUUID(), rolloIds: [fixture.id] }));
  await step("send transfer document", tx => enviarSalida(tx, { salidaId: doc.id, usuarioId: actor, transportista: "Tanda F" }));
  if (receive) await step("receive transfer document", tx => recibirSalida(tx, { salidaId: doc.id, usuarioId: actor, completa: true, ip: "127.0.0.1" }));
  return doc;
}
try {
  report.identity = await identity();
  fs.writeFileSync(`${dir}/reconciliation.sql`, reconciliationSql);
  if (selected === 10) {
    report.historical = (await pool.query("select count(*)::int count from movimientos where tipo='DEVOLUCION'")).rows;
    report.status = report.historical[0].count === 0 ? "BLOCKED_NO_HISTORICAL_ROWS; no fabricated DEVOLUCION producer" : "HISTORICAL_ROWS_REQUIRE_REVIEW";
  } else {
    const candidates = manifest.rolls.filter((r: any) => r.siteId === manifest.sites[0].id && (selected <= 8 ? r.unit === "METRO" : r.unit === "KILO"));
    fixture = candidates[selected <= 8 ? selected - 1 : 0];
    report.fixture = fixture;
    report.baseline = await snapshot(); save();
    if ([1,2,4,5].includes(selected)) {
      await transfer();
      const movements = (await snapshot()).movements;
      const out = movements.find((m: any) => m.tipo === "TRANSFERENCIA_SALIDA" && m.ubicacion_id === fixture.siteId);
      const incoming = movements.find((m: any) => m.tipo === "TRANSFERENCIA_ENTRADA" && m.ubicacion_id === manifest.sites[1].id);
      if (selected === 1) await reverse(fixture.movementId);
      if (selected === 4) await reverse(out.id);
      if (selected === 5) await reverse(incoming.id);
      if (selected === 2) {
        const sale = await step("administrative whole sale", tx => venderRollo(tx, { rolloId: fixture.id, usuarioId: actor, uuidCliente: randomUUID() }));
        await reverse(out.id); await reverse(sale.movimiento.id);
      }
    } else if (selected === 3) {
      const ticket = await step("partial metered ticket 5 of 10", tx => crearTicket(tx, { ubicacionId: fixture.siteId, usuarioTerminalId: actor, clienteId: manifest.customer.id, facturado: false, uuidCliente: randomUUID(), ip: "127.0.0.1", lineas: [{ productoId: fixture.productId, tipo: "METREADO", cantidad: "5", precioUnitario: "150", fuentesRollo: [{ rolloId: fixture.id, cantidad: "5" }] }] }, true));
      report.ticketId = ticket.id;
      await transfer();
      await step("cancel partial ticket after remnant receipt", tx => cancelarTicket(tx, { ticketId: ticket.id, usuarioId: actor, autorizadoPor: actor, motivo: justification, ip: "127.0.0.1" }, true));
    } else if (selected === 6 || selected === 7) {
      const adjustment = await adjust(selected === 6 ? "12" : "8");
      await adjust(); await reverse(adjustment.movimiento.id);
    } else if (selected === 8) {
      await transfer(false); const baja = await adjust(); await reverse(baja.movimiento.id);
    } else if (selected === 9) {
      const adjustment = await adjust("12");
      const cancellation = await reverse(adjustment.movimiento.id);
      await reverse(cancellation.movimiento.id);
    }
    report.status = "EXECUTED_REQUIRES_BALANCE_INTERPRETATION";
  }
} catch (error: any) { report.status = "BLOCKED_OR_REJECTED"; report.error = error.message; }
finally { report.finished = new Date().toISOString(); save(); await pool.end(); }