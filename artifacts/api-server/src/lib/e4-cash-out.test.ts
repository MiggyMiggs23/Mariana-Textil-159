import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { Socket } from "node:net";
import { spawn } from "node:child_process";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  createE4CashOut, reviewE4CashOut, e4CashOutPermission, E4CashOutError,
  type E4Actor, type E4Repository, type E4CreateInput, type E4ReviewInput,
  type E4Salida, type E4Operation, type E4Session, type E4Revision,
} from "./e4-cash-out";
import { e4CashOutRepository, readE4CashOutRevisions } from "./e4-cash-out-repository";
import { calculateCash } from "./caja-cash-ledger";
import {
  CrearSalidaDineroCajaBody, CrearSalidaDineroCajaResponse, ListarSalidasDineroCajaResponse,
  ObtenerCorteCajaResponse, RevisarSalidaDineroCajaBody, RevisarSalidaDineroCajaResponse,
} from "@workspace/api-zod";

const actor: E4Actor = { id: 11, rol: "CAJA", ubicacionId: 2 };
const supervisor: E4Actor = { id: 12, rol: "SUPERVISOR", ubicacionId: 2 };
const admin: E4Actor = { id: 13, rol: "ADMIN", ubicacionId: null };
const key = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function input(overrides: Partial<E4CreateInput> = {}): E4CreateInput {
  return { sesionCajaId: 10, monto: "10.00", motivo: "Gasto extraordinario documentado", cuentaOrigen: "CAJA_FISICA",
    tipo: "EXTRAORDINARIA", claveOperacion: key(1), ip: "offline", ...overrides };
}
function review(overrides: Partial<E4ReviewInput> = {}): E4ReviewInput {
  return { sesionCajaId: 10, salidaId: 1, accion: "RECLAMAR", version: 0,
    claveOperacion: key(2), explicacion: "Explica el gasto", ip: "offline", ...overrides };
}
/** Deliberately synthetic data. Serial transaction boundary is not a PostgreSQL concurrency proof. */
class MemoryRepo implements E4Repository {
  currentSession: E4Session = { id: 10, ubicacionId: 2, estado: "ABIERTA", esTienda: true };
  salidas = new Map<number, E4Salida>();
  operations = new Map<string, E4Operation>();
  audits: unknown[] = [];
  locks: string[] = [];
  activeProvider = true;
  failAudit = false;
  private tail: Promise<unknown> = Promise.resolve();
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(async () => {
      const snapshot = structuredClone({ salidas: this.salidas, operations: this.operations, audits: this.audits });
      try { return await fn(); } catch (error) {
        this.salidas = snapshot.salidas; this.operations = snapshot.operations; this.audits = snapshot.audits;
        throw error;
      }
    });
    this.tail = run.catch(() => undefined);
    return run;
  }
  async lockOperation(value: string) { this.locks.push(value); }
  async session(id: number) { return id === this.currentSession.id ? this.currentSession : undefined; }
  async operation(value: string) { return this.operations.get(value); }
  async providerActive() { return this.activeProvider; }
  async insert(value: E4CreateInput & { tipo: "EXTRAORDINARIA" | "PROVEEDOR"; claveOperacion: string }, user: E4Actor) {
    const record: E4Salida = {
      id: this.salidas.size + 1, sesionCajaId: value.sesionCajaId, monto: value.monto, motivo: value.motivo,
      proveedorId: value.proveedorId ?? null, cuentaOrigen: value.cuentaOrigen, creadoPorId: user.id,
      createdAt: "2026-09-22T12:00:00.000Z", e4: {
        tipo: value.tipo, estado: value.tipo === "EXTRAORDINARIA" ? "PENDIENTE" : "NO_APLICA",
        version: 0, claveOperacion: value.claveOperacion, historial: [],
      },
    };
    this.salidas.set(record.id, record); return structuredClone(record);
  }
  async lockSalida(id: number) {
    const salida = this.salidas.get(id);
    return salida ? { salida: structuredClone(salida), ubicacionId: this.currentSession.ubicacionId } : undefined;
  }
  async updateRevision(id: number, revision: E4Revision) { this.salidas.get(id)!.e4 = structuredClone(revision); }
  async saveOperation(value: string, _salidaId: number, operation: E4Operation) {
    assert.equal(this.operations.has(value), false, "synthetic UNIQUE operation key");
    this.operations.set(value, structuredClone(operation));
  }
  async audit(_id: number, _actor: number, action: string, data: unknown) {
    if (this.failAudit) throw new Error("INJECTED_LAST_AUDIT_FAILURE");
    this.audits.push({ action, data });
  }
}
async function errorCode(run: () => Promise<unknown>) {
  try { await run(); return "NO_ERROR"; } catch (error) {
    return error instanceof E4CashOutError ? error.code : (error as Error).message;
  }
}
const create = (repo: MemoryRepo, user = actor, data = input()) =>
  repo.transaction(() => createE4CashOut(repo, user, data, true));
const revise = (repo: MemoryRepo, user = admin, data = review()) =>
  repo.transaction(() => reviewE4CashOut(repo, user, data, true));

test("E4-OFF-CREATE", async () => {
  const repo = new MemoryRepo();
  assert.equal(await errorCode(() => createE4CashOut(repo, actor, input())), "E4_DISABLED");
  assert.equal(repo.locks.length, 0); assert.equal(repo.salidas.size, 0);
});
test("E4-OFF-REVIEW", async () => {
  const repo = new MemoryRepo();
  assert.equal(await errorCode(() => reviewE4CashOut(repo, admin, review())), "E4_DISABLED");
  assert.equal(repo.locks.length, 0);
});
test("E4-OFF-READ", async () => {
  let reads = 0;
  assert.equal((await readE4CashOutRevisions({ execute: async () => { reads++; return { rows: [] }; } }, 10)).size, 0);
  assert.equal(reads, 0);
});
test("E4-CAPTURE-ROLE", async () => {
  const repo = new MemoryRepo();
  for (const rol of ["CONTADOR", "SISTEMAS", "BODEGA", "TERMINAL"]) {
    assert.equal(await errorCode(() => create(repo, { ...actor, rol })), "E4_ROLE_FORBIDDEN");
  }
  assert.equal(repo.salidas.size, 0);
});
test("E4-OWN-STORE", async () => {
  const repo = new MemoryRepo();
  assert.equal(await errorCode(() => create(repo, { ...actor, ubicacionId: 3 })), "E4_LOCATION_FORBIDDEN");
  assert.equal(repo.salidas.size, 0);
});
test("E4-PROVIDER-LOCATION", async () => {
  const repo = new MemoryRepo();
  assert.equal(await errorCode(() => create(repo, actor, input({ tipo: "PROVEEDOR", proveedorId: 7 }))), "E4_PROVIDER_LOCATION");
  repo.currentSession.ubicacionId = 1;
  const out = await create(repo, admin, input({ tipo: "PROVEEDOR", proveedorId: 7, cuentaOrigen: "CUENTA_FISCAL" }));
  assert.equal(out.e4.estado, "NO_APLICA");
});
test("E4-PROVIDER-REQUIRED", async () => {
  const repo = new MemoryRepo(); repo.currentSession.ubicacionId = 1;
  assert.equal(await errorCode(() => create(repo, admin, input({ tipo: "PROVEEDOR", proveedorId: null }))), "E4_PROVIDER_REQUIRED");
});
test("E4-PROVIDER-ACTIVE", async () => {
  const repo = new MemoryRepo(); repo.currentSession.ubicacionId = 1; repo.activeProvider = false;
  assert.equal(await errorCode(() => create(repo, admin, input({ tipo: "PROVEEDOR", proveedorId: 7 }))), "E4_PROVIDER_INACTIVE");
});
test("E4-EXTRA-ACCOUNT", async () => {
  const repo = new MemoryRepo();
  assert.equal(await errorCode(() => create(repo, actor, input({ cuentaOrigen: "CUENTA_FISCAL" }))), "E4_EXTRAORDINARY_ACCOUNT");
  assert.equal(await errorCode(() => create(repo, actor, input({ proveedorId: 7 }))), "E4_EXTRAORDINARY_ACCOUNT");
  assert.equal(await errorCode(() => create(repo, actor, { ...input(), cuentaOrigen: "FONDO" as never })), "E4_INVALID_ACCOUNT");
});
test("E4-EXPLICIT-KIND", async () => {
  assert.equal(await errorCode(() => create(new MemoryRepo(), actor, input({ tipo: undefined }))), "E4_KIND_REQUIRED");
});
test("E4-REASON", async () => {
  assert.equal(await errorCode(() => create(new MemoryRepo(), actor, input({ motivo: "  " }))), "E4_INVALID_REASON");
});
test("E4-AMOUNT", async () => {
  assert.equal(await errorCode(() => create(new MemoryRepo(), actor, input({ monto: "0.00" }))), "E4_INVALID_AMOUNT");
});
test("E4-CLOSED", async () => {
  const repo = new MemoryRepo(); repo.currentSession.estado = "CERRADA";
  assert.equal(await errorCode(() => create(repo)), "E4_SESSION_CLOSED");
});
test("E4-CAPTURE-RETRY", async () => {
  const repo = new MemoryRepo();
  const [a, b] = await Promise.all([create(repo), create(repo)]);
  assert.equal(a.id, b.id); assert.equal(repo.salidas.size, 1); assert.equal(repo.audits.length, 1);
  repo.currentSession.estado = "CERRADA";
  assert.equal((await create(repo)).id, a.id);
});
test("E4-RETRY-CONTENT", async () => {
  const repo = new MemoryRepo(); await create(repo);
  assert.equal(await errorCode(() => create(repo, actor, input({ monto: "11.00" }))), "E4_IDEMPOTENCY_CONFLICT");
});
test("E4-RETRY-ACTOR", async () => {
  const repo = new MemoryRepo(); await create(repo);
  assert.equal(await errorCode(() => create(repo, supervisor)), "E4_IDEMPOTENCY_CONFLICT");
});
test("E4-REVIEW-ROLE", async () => {
  const repo = new MemoryRepo(); await create(repo);
  assert.equal(await errorCode(() => revise(repo, supervisor)), "E4_ROLE_FORBIDDEN");
  await revise(repo);
  assert.equal(await errorCode(() => revise(repo, admin, review({ accion: "RESPONDER", version: 1, claveOperacion: key(3) }))), "E4_ROLE_FORBIDDEN");
  assert.equal(await errorCode(() => revise(repo, actor, review({ accion: "RESPONDER", version: 1, claveOperacion: key(3) }))), "E4_ROLE_FORBIDDEN");
});
test("E4-RESPONSE-REASON", async () => {
  const repo = new MemoryRepo(); await create(repo); await revise(repo);
  assert.equal(await errorCode(() => revise(repo, supervisor,
    review({ accion: "RESPONDER", version: 1, claveOperacion: key(3), explicacion: " " }))), "E4_INVALID_REASON");
});
test("E4-RESPONSE-SCOPE", async () => {
  const repo = new MemoryRepo(); await create(repo); await revise(repo);
  assert.equal(await errorCode(() => revise(repo, { ...supervisor, ubicacionId: 3 },
    review({ accion: "RESPONDER", version: 1, claveOperacion: key(3) }))), "E4_LOCATION_FORBIDDEN");
});
test("E4-REVIEW-VERSION", async () => {
  const repo = new MemoryRepo(); await create(repo);
  assert.equal(await errorCode(() => revise(repo, admin, review({ version: 2 }))), "E4_VERSION_CONFLICT");
});
test("E4-REVIEW-STATE", async () => {
  const repo = new MemoryRepo(); await create(repo);
  assert.equal(await errorCode(() => revise(repo, supervisor, review({ accion: "RESPONDER" }))), "E4_STATE_CONFLICT");
});
test("E4-REVIEW-RETRY", async () => {
  const repo = new MemoryRepo(); await create(repo);
  const result = await errorCode(async () => {
    const [a, b] = await Promise.all([revise(repo), revise(repo)]);
    assert.deepEqual(a, b);
  });
  assert.equal(result, "NO_ERROR");
  assert.equal(repo.salidas.get(1)!.e4.version, 1); assert.equal(repo.audits.length, 2);
});
test("E4-COMPETING-REVIEWS", async () => {
  const repo = new MemoryRepo(); await create(repo);
  const results = await Promise.all([
    errorCode(() => revise(repo)),
    errorCode(() => revise(repo, admin, review({ accion: "ACEPTAR", claveOperacion: key(3) }))),
  ]);
  assert.deepEqual(results, ["NO_ERROR", "E4_VERSION_CONFLICT"]);
  assert.equal(repo.salidas.get(1)!.e4.version, 1);
});
test("E4-CYCLE-CASH", async () => {
  const repo = new MemoryRepo();
  for (const location of [1, 2, 3]) {
    repo.currentSession.ubicacionId = location;
    await create(repo, { ...supervisor, ubicacionId: location }, input({ claveOperacion: key(10 + location) }));
  }
  repo.currentSession.ubicacionId = 2;
  const expected = () => calculateCash([
    { origen: "FONDO_INICIAL", id: "10", folio: null, importe: "100.00", href: null },
    ...[...repo.salidas.values()].map(out => ({ origen: "SALIDA" as const, id: String(out.id), folio: null, importe: out.monto, href: null })),
  ]).efectivoEsperado;
  assert.equal(expected(), "70.00"); // all pending, already deducted
  repo.currentSession.estado = "CERRADA";
  await revise(repo);
  assert.equal(expected(), "70.00"); // claim is not a fictitious return
  const response = await revise(repo, supervisor, review({ accion: "RESPONDER", version: 1, claveOperacion: key(3), explicacion: "Servicio urgente de tienda" }));
  assert.equal(response.estado, "RESPONDIDA"); assert.equal(response.historial[1]!.comprobanteUrl, null);
  const accepted = await revise(repo, admin, review({ accion: "ACEPTAR", version: 2, claveOperacion: key(4), explicacion: undefined }));
  assert.equal(accepted.estado, "ACEPTADA"); assert.equal(accepted.historial.length, 3);
  assert.equal(expected(), "70.00"); assert.equal(repo.salidas.size, 3);
});
test("E4-ATOMIC-AUDIT", async () => {
  const repo = new MemoryRepo(); repo.failAudit = true;
  assert.equal(await errorCode(() => create(repo)), "INJECTED_LAST_AUDIT_FAILURE");
  assert.equal(repo.salidas.size, 0); assert.equal(repo.operations.size, 0); assert.equal(repo.audits.length, 0);
  repo.failAudit = false; await create(repo); repo.failAudit = true;
  assert.equal(await errorCode(() => revise(repo)), "INJECTED_LAST_AUDIT_FAILURE");
  assert.equal(repo.salidas.get(1)!.e4.version, 0); assert.equal(repo.operations.size, 1);
});
test("E4-PROOF", async () => {
  const repo = new MemoryRepo(); await create(repo); await revise(repo);
  assert.equal(await errorCode(() => revise(repo, supervisor, review({
    accion: "RESPONDER", version: 1, claveOperacion: key(3), comprobanteUrl: "javascript:alert(1)",
  }))), "E4_INVALID_PROOF");
  const response = await revise(repo, supervisor, review({
    accion: "RESPONDER", version: 1, claveOperacion: key(3), comprobanteUrl: "https://example.invalid/evidence",
  }));
  assert.equal(response.historial[1]!.comprobanteUrl, "https://example.invalid/evidence");
});
test("E4-ADAPTER-LOCKS", async () => {
  const queries: string[] = [];
  const tx = { execute: async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => {
    queries.push(new PgDialect().sqlToQuery(query).sql);
    return { rows: [] };
  } };
  const repo = e4CashOutRepository(tx as never);
  await repo.lockOperation(key(1)); await repo.session(10); await repo.lockSalida(1);
  assert.match(queries[0]!, /pg_advisory_xact_lock/);
  assert.match(queries[1]!, /FOR UPDATE OF s/);
  assert.match(queries[2]!, /FOR UPDATE OF e/);
});
test("E4-ADAPTER-CAS", async () => {
  const repo = e4CashOutRepository({ execute: async () => ({ rows: [] }) } as never);
  assert.equal(await errorCode(() => repo.updateRevision(1, {
    tipo: "EXTRAORDINARIA", estado: "ACEPTADA", version: 1, claveOperacion: key(1), historial: [],
  })), "E4_VERSION_CONFLICT");
});
test("E4-READER", async () => {
  const repo = new MemoryRepo(); const created = await create(repo);
  const rows = await readE4CashOutRevisions({ execute: async () => ({ rows: [{ id: 1, revision: created.e4 }] }) }, 10, true);
  assert.equal(rows.get(1)?.estado, "PENDIENTE");
});
test("E4-CONTRACT", async () => {
  const repo = new MemoryRepo(); const created = await create(repo);
  const sent = CrearSalidaDineroCajaBody.parse(input());
  assert.equal(sent.tipo, "EXTRAORDINARIA"); assert.equal(sent.claveOperacion, key(1));
  assert.equal(CrearSalidaDineroCajaResponse.parse(created).e4!.estado, "PENDIENTE");
  assert.equal(ListarSalidasDineroCajaResponse.parse({ salidas: [created] }).salidas[0]!.e4!.estado, "PENDIENTE");
  const fixture = {
    sesion: { id: 10, ubicacionId: 2, nombreUbicacion: "Sintética", usuarioId: 11, nombreUsuario: "Fixture",
      abiertaAt: created.createdAt, cerradaAt: null, fondoInicial: "100.00", efectivoContado: null, estado: "ABIERTA" },
    formasPago: [], cuentasDestino: [], salidas: [{ ...created, proveedor: null }],
    salidasPorCuenta: { CAJA_FISICA: "10.00", CUENTA_NO_FISCAL: "0.00", CUENTA_FISCAL: "0.00" },
    facturacion: [], metreado: [], productos: [], pendientes: [], ticketsCobradosDetalle: [], ticketsCobrados: 0,
    cancelaciones: [], fondoInicial: "100.00", totalCobrado: "0.00", ivaCobrado: "0.00",
    efectivoEsperado: "90.00", efectivoContado: null, diferencia: null,
    hojaVentasDia: { sitio: "Sintética", fechaOperativa: "2026-09-22", cerrada: false, quienCerro: null,
      secciones: [], totalRollos: "0", totalMetros: "0", totalKilos: "0", totalBolsas: "0", totalPiezas: "0",
      subtotal: "0.00", ivaFacturado: "0.00", totalGeneral: "0.00" },
  };
  assert.equal(ObtenerCorteCajaResponse.parse(fixture).salidas[0]!.e4?.estado, "PENDIENTE");
  assert.equal(RevisarSalidaDineroCajaBody.parse(review()).accion, "RECLAMAR");
  assert.equal(RevisarSalidaDineroCajaResponse.parse(await revise(repo)).estado, "RECLAMADA");
});
test("E4-OFFLINE-GUARD", () => {
  assert.throws(() => Reflect.apply(Socket.prototype.connect, {}, []), /E4_OFFLINE_ACCESS_BLOCKED/);
  assert.throws(() => fetch("https://example.invalid"), /E4_OFFLINE_ACCESS_BLOCKED/);
  assert.throws(() => createRequire(import.meta.url)("pg"), /E4_OFFLINE_ACCESS_BLOCKED/);
  assert.throws(() => spawn("true"), /E4_OFFLINE_ACCESS_BLOCKED/);
});
test("E4-ADAPTER-WRITE", async () => {
  const queries: { sql: string; params: unknown[] }[] = [];
  const tx = { execute: async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => {
    const built = new PgDialect().sqlToQuery(query); queries.push(built);
    if (built.sql.includes("INSERT INTO salidas_dinero_caja")) return { rows: [{
      id: 1, sesionCajaId: 10, monto: "10.00", motivo: "Fixture", proveedorId: null,
      cuentaOrigen: "CAJA_FISICA", creadoPorId: 11, createdAt: new Date("2026-09-22T12:00:00Z"),
    }] };
    return { rows: [{ salida_id: 1 }] };
  } };
  const repo = e4CashOutRepository(tx as never);
  const created = await repo.insert({ ...input(), tipo: "EXTRAORDINARIA", claveOperacion: key(1) }, actor);
  await repo.saveOperation(key(1), 1, { actorId: actor.id, request: "fixture", response: created });
  await repo.audit(1, actor.id, "SALIDA_DINERO_CAJA", created, "offline");
  assert.equal(created.e4.estado, "PENDIENTE");
  assert.match(queries[0]!.sql, /INSERT INTO salidas_dinero_caja/);
  assert.equal(queries[0]!.params[1], "10.00");
  assert.match(queries[1]!.sql, /INSERT INTO caja_salidas_e4/);
  assert.match(queries[2]!.sql, /INSERT INTO caja_salidas_e4_operaciones/);
  assert.match(queries[3]!.sql, /INSERT INTO auditoria/);
  assert.equal(queries.length, 4);
});
test("E4-PERMISSIONS-ON", () => {
  // Synthetic permission rows match the inherited CAJA default: operational
  // cobros_pagos ver/crear, not administrative cortes. No grant is fabricated.
  const defaults: Record<string, { ver: boolean; crear: boolean }> = {
    cobros_pagos: { ver: true, crear: true }, cortes: { ver: false, crear: false },
  };
  const calls: string[] = [];
  const resolver = (module: string, action: "ver" | "crear") => {
    calls.push(`${module}/${action}`);
    return () => defaults[module]?.[action] === true;
  };
  assert.equal(e4CashOutPermission("ver", resolver, true)(), true);
  assert.equal(e4CashOutPermission("crear", resolver, true)(), true);
  assert.deepEqual(calls, ["cobros_pagos/ver", "cobros_pagos/crear"]);
});
test("E4-PERMISSIONS-OFF", () => {
  const calls: string[] = [];
  const resolver = (module: string, action: "ver" | "crear") => {
    calls.push(`${module}/${action}`);
    return () => module === "cortes";
  };
  assert.equal(e4CashOutPermission("ver", resolver)(), true);
  assert.equal(e4CashOutPermission("crear", resolver)(), true);
  assert.deepEqual(calls, ["cortes/ver", "cortes/crear"]);
});