import assert from "node:assert/strict";
import test from "node:test";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { assertAuditAdmin, clasificarSobrante, estadoDecisionSobrante, prioridadCierreAuditoria, getSobranteContexto, resolverSobrante } from "./auditoria-resoluciones";
import { esBajaAuditoriaReactivable } from "./reactivacion-faltante-evidencia";
import { reactivarFaltanteAuditoria, revertirMovimiento, type Tx } from "./inventario";
import { resolveDocument } from "./kardex-document";
import { confirmAuditoria, transitionAuditoria } from "./auditoria-inventario";

test("Prompt T clasifica los cinco sobrantes sin inventar registros y destaca vendido", () => {
  const base = { existe: true, estado: "DISPONIBLE", sitio: 1, sitioAuditoria: 2, salidaAbierta: false, transitoHaciaSitio: false };
  assert.equal(clasificarSobrante(base), "DISPONIBLE_OTRO_SITIO");
  assert.equal(clasificarSobrante({ ...base, estado: "EN_TRANSITO", salidaAbierta: true, transitoHaciaSitio: true }), "EN_TRANSITO_HACIA_SITIO");
  assert.equal(clasificarSobrante({ ...base, salidaAbierta: true }), "APARTADO_SALIDA_ABIERTA");
  assert.equal(clasificarSobrante({ ...base, estado: "VENDIDO", salidaAbierta: true }), "VENDIDO_FISICAMENTE_AQUI");
  assert.equal(clasificarSobrante({ ...base, existe: false, estado: null, sitio: null }), "SIN_REGISTRO_PREVIO");
  assert.equal(clasificarSobrante({ ...base, estado: "BAJA" }), "REQUIERE_INVESTIGACION");
});

test("Prompt T ADMIN y motivo no dependen de que la interfaz oculte botones", () => {
  assert.throws(() => assertAuditAdmin("BODEGA", "Motivo válido"), /Solo ADMIN/);
  assert.throws(() => assertAuditAdmin("ADMIN", "         x       "), /10 y 1000/);
  assert.doesNotThrow(() => assertAuditAdmin("ADMIN", "  Reapareció físicamente  "));
});

test("Prompt T investigar y devolver no resuelven pendiente hasta recepción real", () => {
  const base = { decision: null, recibido: false, salidaEstado: null, aplicadaAnteriormente: false };
  assert.equal(estadoDecisionSobrante(base), "PENDIENTE");
  assert.equal(estadoDecisionSobrante({ ...base, decision: "INVESTIGAR" }), "EN_INVESTIGACION");
  assert.equal(estadoDecisionSobrante({ ...base, decision: "REGRESAR", salidaEstado: "EN_TRANSITO" }), "EN_TRANSITO");
  assert.equal(estadoDecisionSobrante({ ...base, decision: "REGRESAR", salidaEstado: "CANCELADA" }), "PENDIENTE");
  assert.equal(estadoDecisionSobrante({ ...base, decision: "REGRESAR", salidaEstado: "RECIBIDA", recibido: true }), "RESUELTO");
  assert.equal(estadoDecisionSobrante({ ...base, decision: "DEJAR" }), "RESUELTO");
});

test("Prompt T cierre normal sin diferencias y urgente incluso con solo piso mal acomodado", () => {
  const base = { faltantes: 0, sobrantes: 0, malAcomodados: 0 };
  assert.equal(prioridadCierreAuditoria(base), "NORMAL");
  for (const key of ["faltantes", "sobrantes", "malAcomodados"]) assert.equal(prioridadCierreAuditoria({ ...base, [key]: 1 }), "URGENTE");
});

test("Prompt T evidencia exige baja íntegra sin reactivación ni reverso ni movimiento posterior", () => {
  const valid = { estado: "BAJA", cantidadActual: "0.000", movimientoBajaId: 55, ultimoMovimientoId: 55, auditoriaConfirmada: true, cantidadAnterior: "50.125", yaReactivada: false, yaRevertida: false };
  assert.equal(esBajaAuditoriaReactivable(valid), true);
  for (const invalid of [
    { estado: "DISPONIBLE" }, { cantidadActual: "1.000" }, { movimientoBajaId: null },
    { ultimoMovimientoId: 56 }, { auditoriaConfirmada: false }, { cantidadAnterior: null },
    { cantidadAnterior: "0.000" }, { yaReactivada: true }, { yaRevertida: true },
  ]) assert.equal(esBajaAuditoriaReactivable({ ...valid, ...invalid }), false);
});

const input = {
  rolloId: 7, auditoriaOrigenId: 3, origen: "AUDITORIA" as const,
  ubicacionId: 2, pisoId: 20, motivo: "Reapareció físicamente durante revisión",
  uuidCliente: "2d7f9c01-5c28-4aa3-9f37-4d665b861e11", usuarioId: 8, rol: "ADMIN", ip: "unit-test",
};

/**
 * Transaction double only. No connection, user, session or business-data writes.
 * Executes the real inventory engine and its ledger/cache implementation.
 */
function fixture(options: { stale?: boolean; commitment?: boolean; invalidFloor?: boolean } = {}) {
  const dialect = new PgDialect();
  const rollo = { id: 7, serie: "100007", productoId: 10, ubicacionId: 1, pisoId: 10,
    estado: "BAJA", cantidadActual: "0.000", cantidadInicial: "50.125",
    costoUnitario: "12.50", costoTotal: "626.56", recepcionId: 91, proveedorId: 92 };
  const original = { id: 55, rolloId: 7, tipo: "AJUSTE_NEGATIVO", cantidad: "-50.125", documentoTipo: "AUDITORIA_INVENTARIO", documentoId: "3" };
  const movements: Array<Record<string, unknown>> = [structuredClone(original)];
  const caches: Array<Record<string, unknown>> = [];
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  let reactivation: Record<string, unknown> | undefined;
  let rollReads = 0;
  const tx = {
    execute: async (statement: Parameters<PgDialect["sqlToQuery"]>[0]) => {
      const query = dialect.sqlToQuery(statement); queries.push(query);
      if (query.sql.includes("SELECT * FROM auditoria_faltante_reactivaciones")) return { rows: reactivation ? [reactivation] : [] };
      if (query.sql.includes("SELECT r.*, p.sku")) return { rows: [{
        id: rollo.id, serie: rollo.serie, estado: rollo.estado, cantidad_actual: rollo.cantidadActual,
        costo_unitario: rollo.costoUnitario, recepcion_id: rollo.recepcionId, proveedor_id: rollo.proveedorId,
        sku: "TEL-A", tela: "Tela", color: "Azul", unidad: "METRO", proveedor_nombre: "Proveedor verificado",
        entrada_folio: 4, entrada_iniciales: "ORI", movimiento_baja_id: 55, cantidad_baja: "-50.125",
        ubicacion_baja_id: 1, ubicacion_baja: "Origen", auditoria_origen_id: 3, auditoria_estado: "CONFIRMADA",
        cerrada_at: new Date("2026-01-01T12:00:00.123Z"), ultimo_movimiento_id: movements.at(-1)!.id,
        ya_reactivada: Boolean(reactivation), ya_revertida: false,
      }] };
      if (query.sql.includes("SELECT id, ubicacion_id, folio, cerrada_at")) return { rows: [
        { id: 4, ubicacion_id: 2, folio: 2, cerrada_at: new Date("2026-01-02T12:00:00Z") },
        { id: 5, ubicacion_id: 9, folio: 1, cerrada_at: new Date("2026-01-03T12:00:00Z") },
      ] };
      if (query.sql.includes("SELECT sr.id FROM salida_rollos")) return { rows: options.commitment ? [{ id: 6 }] : [] };
      if (query.sql.includes("INSERT INTO auditoria_faltante_reactivaciones")) {
        const p = query.params;
        reactivation = { rollo_id: p[0], auditoria_origen_id: p[1], movimiento_baja_id: p[2], movimiento_reactivacion_id: p[3],
          ubicacion_aparicion_id: p[4], piso_aparicion_id: p[5], cantidad_restaurada: p[6], usuario_id: p[7],
          motivo: p[8], origen: p[9], uuid_cliente: p[10], auditorias_posteriores: JSON.parse(String(p[11])) };
      }
      return { rows: [] };
    },
    select: (fields?: Record<string, unknown>) => {
      let table = "";
      const resolve = () => {
        if (table === "rollos") {
          if (fields?.cnt) return [{ cnt: rollo.estado === "DISPONIBLE" ? 1 : 0 }];
          rollReads++;
          const copy = structuredClone(rollo);
          return [options.stale && rollReads === 2 ? { ...copy, ubicacionId: 9 } : copy];
        }
        if (table === "ubicaciones") return [{ id: 2, activa: true, tipo: "BODEGA", nombre: "Destino" }];
        if (table === "pisos") return [{ id: options.invalidFloor ? 99 : 20, ubicacionId: 2, activo: true }];
        if (table === "movimientos") return fields?.id ? [] : fields ? [{ saldo: "0.000", total: "50.125" }] : [movements.at(-1)];
        return [];
      };
      const chain: Record<string, unknown> = {};
      for (const method of ["where", "limit", "for", "orderBy", "innerJoin", "leftJoin"]) chain[method] = () => chain;
      chain.from = (t: Parameters<typeof getTableName>[0]) => { table = getTableName(t); return chain; };
      chain.then = (fulfilled: (v: unknown) => unknown, rejected: (e: unknown) => unknown) => Promise.resolve(resolve()).then(fulfilled, rejected);
      return chain;
    },
    update: () => ({ set: (values: object) => ({ where: async () => { Object.assign(rollo, values); return []; } }) }),
    insert: (t: Parameters<typeof getTableName>[0]) => ({ values: (values: Record<string, unknown>) => {
      const name = getTableName(t);
      const result = name === "movimientos" ? { id: 99, ...values } : values;
      if (name === "movimientos") movements.push(result);
      if (name === "existencias") caches.push(values);
      return { returning: async () => [result], onConflictDoUpdate: async () => [], then: (f: (v: unknown) => unknown) => Promise.resolve([]).then(f) };
    } }),
  } as unknown as Tx;
  return { tx, rollo, movements, original, caches, queries, get reactivation() { return reactivation; } };
}

test("Prompt T motor reactiva mismo rollo en otro sitio, conserva baja y costos, kardex distinto y relación explícita", async () => {
  const f = fixture();
  await reactivarFaltanteAuditoria(f.tx, input);
  assert.equal(f.rollo.estado, "DISPONIBLE");
  assert.equal(f.rollo.cantidadActual, "50.125");
  assert.equal(f.rollo.ubicacionId, 2); assert.equal(f.rollo.pisoId, 20);
  assert.equal(f.rollo.serie, "100007"); assert.equal(f.rollo.productoId, 10);
  assert.equal(f.rollo.recepcionId, 91); assert.equal(f.rollo.proveedorId, 92);
  assert.equal(f.rollo.costoUnitario, "12.50"); assert.equal(f.rollo.costoTotal, "626.56");
  assert.deepEqual(f.movements[0], f.original);
  assert.equal(f.movements[1]!.tipo, "REACTIVACION_FALTANTE");
  assert.equal(f.movements[1]!.cantidad, "50.125");
  assert.equal(f.movements[1]!.movimientoOrigenId, null);
  assert.equal(f.movements[1]!.usuarioId, 8);
  assert.match(String(f.movements[1]!.justificacion), /Reapareció físicamente/);
  assert.equal(f.reactivation!.movimiento_baja_id, 55);
  assert.deepEqual((f.reactivation!.auditorias_posteriores as Array<{id:number}>).map((a) => a.id), [4]);
  assert.deepEqual(f.caches.map((c) => c.ubicacionId), [1, 2]);
});

test("Prompt T reintento idempotente no duplica reactivación y UUID no admite otros datos", async () => {
  const f = fixture();
  await reactivarFaltanteAuditoria(f.tx, input);
  await reactivarFaltanteAuditoria(f.tx, input);
  assert.equal(f.movements.length, 2);
  await assert.rejects(() => reactivarFaltanteAuditoria(f.tx, { ...input, ubicacionId: 3 }), /identificador/);
});

test("Prompt T vía propia rechaza rol, origen y motivo antes de consultar inventario", async () => {
  const f = fixture();
  await assert.rejects(() => reactivarFaltanteAuditoria(f.tx, { ...input, rol: "BODEGA" }), /Solo ADMIN/);
  await assert.rejects(() => reactivarFaltanteAuditoria(f.tx, { ...input, origen: "AJUSTE" as "ROLLO" }), /auditoría de origen/);
  await assert.rejects(() => reactivarFaltanteAuditoria(f.tx, { ...input, motivo: "       x      " }), /10 y 1000/);
  assert.equal(f.queries.length, 0); assert.equal(f.movements.length, 1);
});

test("Prompt T relectura previa a FOR UPDATE rechaza par cambiado sin escribir movimiento", async () => {
  const f = fixture({ stale: true });
  await assert.rejects(() => reactivarFaltanteAuditoria(f.tx, input), /cambió mientras/);
  assert.equal(f.movements.length, 1);
});

test("Prompt T reactivación rechaza documento comprometido o piso ajeno", async () => {
  const committed = fixture({ commitment: true });
  await assert.rejects(() => reactivarFaltanteAuditoria(committed.tx, input), /comprometida/);
  const floor = fixture({ invalidFloor: true });
  await assert.rejects(() => reactivarFaltanteAuditoria(floor.tx, input), /piso/);
  assert.equal(committed.movements.length, 1); assert.equal(floor.movements.length, 1);
});

test("Prompt T solo el nuevo tipo rechaza reverso ordinario sin escribir cancelación", async () => {
  const f = fixture();
  await reactivarFaltanteAuditoria(f.tx, input);
  await assert.rejects(() => revertirMovimiento(f.tx, { movimientoOrigenId: 99, usuarioId: 8, justificacion: "Intento de reverso" }), /reaparición física/);
  assert.equal(f.movements.length, 2);
  assert.equal(f.rollo.cantidadActual, "50.125");
});

test("Prompt T kardex enlaza la reaparición y su baja a la auditoría sin confundirla con cancelación", () => {
  const doc = resolveDocument({ tipo: "AUDITORIA_INVENTARIO", id: "3" }, new Map(), new Map(), new Map());
  assert.equal(doc.label, "Auditoría 3");
  assert.equal(doc.route, "/inventario/auditorias?auditoriaId=3");
  assert.equal(resolveDocument({ tipo: "AUDITORIA_INVENTARIO", id: "x" }, new Map(), new Map(), new Map()).route, null);
});

test("Prompt T resolver rechaza INVESTIGAR durante devolución y un histórico posterior no oculta recepción", async () => {
  const dialect = new PgDialect();
  let recibido = false;
  const writes: string[] = [];
  const tx = {
    select: () => {
      const chain: Record<string, unknown> = {};
      for (const method of ["from", "where", "for", "limit"]) chain[method] = () => chain;
      chain.then = (f: (v: unknown) => unknown) => Promise.resolve([{ id: 3, estado: "CONFIRMADA", ubicacionId: 2 }]).then(f);
      return chain;
    },
    execute: async (statement: Parameters<PgDialect["sqlToQuery"]>[0]) => {
      const { sql: statementSql } = dialect.sqlToQuery(statement);
      if (statementSql.includes("INSERT")) { writes.push(statementSql); return { rows: [] }; }
      if (statementSql.includes("SELECT r.id, r.estado")) return { rows: [{ id: 7, estado: "EN_TRANSITO", ubicacion_id: 9, ubicacion: "Tránsito" }] };
      if (statementSql.includes("SELECT d.*, u.nombre")) return { rows: [
        { id: 2, decision: "INVESTIGAR", motivo: "Registro histórico durante traslado", usuario_id: 8, usuario: "Actor de prueba en memoria", created_at: new Date(), salida_id: null, recibido: null, salida_estado: null },
        { id: 1, decision: "REGRESAR", motivo: "Devolución autorizada", usuario_id: 8, usuario: "Actor de prueba en memoria", created_at: new Date(), salida_id: 10, recibido, salida_estado: recibido ? "RECIBIDA" : "EN_TRANSITO" },
      ] };
      if (statementSql.includes("SELECT resolucion")) return { rows: [{ resolucion: "RESOLUCION_MANUAL" }] };
      if (statementSql.includes("SELECT e.rollo_id")) return { rows: [{ rollo_id: 7, piso_real_id: 20, ubicacion_cierre_id: 1 }] };
      return { rows: [] };
    },
    insert: () => ({ values: async () => { writes.push("audit"); } }),
  } as unknown as Tx;
  const pending = await getSobranteContexto(tx, 3, 2, "100007");
  assert.equal(pending.estadoResolucion, "EN_TRANSITO");
  await assert.rejects(() => resolverSobrante(tx, {
    auditoriaId: 3, usuarioId: 8, rol: "ADMIN", ip: "unit-test", serie: "100007",
    decision: "INVESTIGAR", motivo: "Quiero investigar durante el traslado", uuidCliente: input.uuidCliente,
  }), /devolución sigue en tránsito/);
  assert.deepEqual(writes, []);
  recibido = true;
  const resolved = await getSobranteContexto(tx, 3, 2, "100007");
  assert.equal(resolved.estadoResolucion, "RESUELTO");
  assert.equal(resolved.pendiente, false);
});

function auditFixture(initialState: string, withSurplus: boolean, withMisplaced = false) {
  const dialect = new PgDialect();
  const header = { id: 3, estado: initialState, ubicacionId: 2, folio: 1, nombreUbicacion: "Destino",
    iniciales: "DES", abiertaAt: new Date("2026-01-01T00:00:00Z"), cerradaAt: null as Date | null,
    confirmadaAt: null as Date | null, motivoCancelacion: null, creadaPor: "Autor en memoria" };
  const rollo = { id: 7, productoId: 10, ubicacionId: 1, estado: "DISPONIBLE", cantidadActual: "50.125", serie: "100007" };
  const writes: Array<{ table: string; values: Record<string, unknown> }> = [];
  const tx = {
    select: (fields?: Record<string, unknown>) => {
      let table = "";
      const chain: Record<string, unknown> = {};
      for (const method of ["where", "for", "limit", "orderBy", "leftJoin", "innerJoin"]) chain[method] = () => chain;
      chain.from = (t: Parameters<typeof getTableName>[0]) => { table = getTableName(t); return chain; };
      chain.then = (f: (v: unknown) => unknown) => Promise.resolve(
        table === "auditorias_inventario" ? [structuredClone(header)]
          : table === "auditoria_inventario_escaneos" ? fields?.count ? [{ count: 0 }] : withSurplus ? [{ rollo, serie: rollo.serie, pisoRealId: 20 }] : []
            : table === "rollos" ? [structuredClone(rollo)] : [],
      ).then(f);
      return chain;
    },
    execute: async (statement: Parameters<PgDialect["sqlToQuery"]>[0]) => {
      const q = dialect.sqlToQuery(statement);
      if (q.sql.includes("FULL OUTER JOIN") && withMisplaced) return { rows: [{
        serie: "100007", clasificacion: "MAL_ACOMODADO", rollo_id: 7, sku: "TEL", tela: "Tela", color: "Azul",
        cantidad: "50.125", unidad: "METRO", ubicacion_actual_id: 2, ubicacion_actual: "Destino", estado_actual: "DISPONIBLE",
        resolucion_snapshot: "PENDIENTE", piso_snapshot_id: 1, piso_snapshot: "Piso uno", piso_real_id: 2, piso_real: "Piso dos",
      }] };
      return { rows: [] };
    },
    update: (t: Parameters<typeof getTableName>[0]) => ({ set: (values: Record<string, unknown>) => ({ where: async () => {
      const table = getTableName(t); writes.push({ table, values });
      if (table === "auditorias_inventario") Object.assign(header, values);
      return [];
    } }) }),
    insert: (t: Parameters<typeof getTableName>[0]) => ({ values: (values: Record<string, unknown>) => {
      writes.push({ table: getTableName(t), values });
      return { onConflictDoNothing: async () => [], then: (f: (v: unknown) => unknown) => Promise.resolve([]).then(f) };
    } }),
  } as unknown as Tx;
  return { tx, header, writes };
}

test("Prompt T confirmación real termina con sobrante pendiente sin transferir ni recibir", async () => {
  const f = auditFixture("CERRADA", true);
  await confirmAuditoria(f.tx, { auditoriaId: 3, usuarioId: 8, ip: "unit-test" });
  assert.equal(f.header.estado, "CONFIRMADA");
  assert.equal(f.writes.some((w) => ["rollos", "movimientos", "existencias"].includes(w.table)), false);
  assert.equal(f.writes.some((w) => w.table === "auditoria_inventario_escaneos" && w.values.resolucion === "RESOLUCION_MANUAL"), true);
});

test("Prompt T cerrar persiste aviso global ADMIN normal o urgente dentro de la misma transacción", async () => {
  for (const misplaced of [false, true]) {
    const f = auditFixture("ABIERTA", false, misplaced);
    await transitionAuditoria(f.tx, { auditoriaId: 3, usuarioId: 8, ip: "unit-test", action: "CERRAR" });
    assert.equal(f.header.estado, "CERRADA");
    const notices = f.writes.filter((w) => w.table === "notificaciones_sistema");
    assert.equal(notices.length, 1);
    assert.equal(notices[0]!.values.tipo, "AUDITORIA_INVENTARIO_CERRADA");
    assert.equal(notices[0]!.values.prioridad, misplaced ? "URGENTE" : "NORMAL");
    assert.equal(notices[0]!.values.destinatarioUsuarioId, null);
    assert.equal(notices[0]!.values.entidadId, "3");
  }
});