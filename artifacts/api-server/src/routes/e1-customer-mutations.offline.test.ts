/**
 * Offline route execution: no app import, listener, pool, network, users or sessions.
 * Production modules are transpiled without bundling; every import is intercepted.
 * Parent runs these later. E1_CUSTOMER_MUTANT selects a targeted defect; that run
 * MUST fail the corresponding behavioral assertion (not a source-regex assertion).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { transformSync } from "esbuild";
import * as contract from "../lib/credit-evidence-contract";

const evidence = {
  sitioOrigenId: 7, naturaleza: "CORRECCION_CONTABLE", operacionClave: "11111111-1111-4111-8111-111111111111",
  sesionCajaId: null, notaOrigenId: null, origenJustificacion: "Recaptura documentada sin dinero nuevo",
};
const movement = { id: 91, clienteId: 3, importe: "-100.00", cuentaDestino: "CUENTA_FISCAL" };
type Handler = (req: any, res: any, next: (error: unknown) => void) => Promise<void>;

const mutations: Record<string, { file: string; before: string; after: string }> = {
  "ordinary-replay-order": {
    file: "clientes.ts",
    before: "if (claim.replay) {\n          const audit =",
    after: "if (false && claim.replay) {\n          const audit =",
  },
  "reverse-replay-order": {
    file: "clientes.ts",
    before: "if (claim.replay) return claim.movement;",
    after: "if (false && claim.replay) return claim.movement;",
  },
  "directed-uuid": {
    file: "pagos-dirigidos.ts",
    before: "if (canonicalCreditContent(stored.evidence) !== canonicalCreditContent(supplied))",
    after: "if (false)",
  },
  "directed-secret-whitelist": {
    file: "pagos-dirigidos.ts",
    before: "tipo: data.tipo, entidadId: data.entidadId, documentoMovimientoId: data.documentoMovimientoId,",
    after: "...data, tipo: data.tipo, entidadId: data.entidadId, documentoMovimientoId: data.documentoMovimientoId,",
  },
  "access-recheck": {
    file: "clientes.ts",
    before: "const reverso = await db.transaction(async (tx) => {\n        await assertCreditEvidenceAccess(req, evidence, tx);",
    after: "const reverso = await db.transaction(async (tx) => {",
  },
  "directed-approval-binding": {
    file: "pagos-dirigidos.ts",
    before: "assertDirectedApprovalIdentity(e1, evidence);",
    after: "/* defect: accept any approval UUID */",
  },
  "directed-replay-order": {
    file: "pagos-dirigidos.ts",
    before: "if (claim.replay) {",
    after: "if (false && claim.replay) {",
  },
  "writeoff-replay-order": {
    file: "clientes-admin.ts",
    before: "if (claim.replay) {",
    after: "if (false && claim.replay) {",
  },
  "writeoff-auth-recheck": {
    file: "clientes-admin.ts",
    before: 'if (!auth.rows[0]) throw new CreditEvidenceError("Las credenciales del ADMIN no son válidas.", 401);',
    after: "if (!auth.rows[0]) auth.rows.push({ id: 77 });",
  },
  "writeoff-credentials-code": {
    file: "clientes-admin.ts",
    before: 'code: "ADMIN_CREDENTIALS_REQUIRED",',
    after: 'code: "ADMIN_AUTH_REQUIRED",',
  },
  "manual-note-owner": {
    file: "clientes.ts",
    before: 'if (!note) throw new CreditEvidenceError("La nota de origen no pertenece al cliente y sitio autorizado.", 400);',
    after: "if (false) throw new Error('mutated note check');",
  },
  "directed-cash-gate": {
    file: "pagos-dirigidos.ts",
    before: "assertCreditCaptureEnabled(e1.evidence, data.formaPago);",
    after: "/* defect: activate physical credit cash */",
  },
};

function queryResult(rows: unknown[]) {
  const chain: any = {};
  for (const key of ["from", "where", "for", "limit", "orderBy"]) chain[key] = () => chain;
  chain.then = (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => Promise.resolve(rows).then(resolve, reject);
  return chain;
}

function loadRoute(file: string, options: {
  tx?: any; helpers?: Record<string, unknown>; pool?: any; extra?: Record<string, unknown>;
} = {}) {
  const routes: Record<string, Handler> = {};
  const router: any = {};
  for (const verb of ["get", "post", "patch", "put", "delete", "use"]) {
    router[verb] = (path: string, ...handlers: Handler[]) => {
      routes[`${verb} ${path}`] = handlers[handlers.length - 1]!;
    };
  }
  const schema = new Proxy({}, { get: (_target, name) => String(name) });
  const forbidden = (name: string) => () => { throw new Error(`Unmocked dependency: ${name}`); };
  const permissiveExports = (values: Record<string, unknown>) => new Proxy(values, {
    get(target, name: string) {
      if (name === "__esModule") return true;
      return name in target ? target[name] : forbidden(name);
    },
  });
  const db = { transaction: (fn: (tx: any) => unknown) => fn(options.tx) };
  const dbExports = new Proxy({ db, pool: options.pool }, {
    get(target: any, name: string) {
      if (name === "__esModule") return true;
      if (name in target) return target[name];
      if (name.endsWith("Table")) return schema;
      throw new Error(`Forbidden database export ${name}`);
    },
  });
  const passSchema = {
    parse: (value: any) => value,
    safeParse: (value: any) => ({ success: true, data: value }),
  };
  const imports = (name: string): any => {
    if (name === "express") return { Router: () => router };
    if (name === "@workspace/db") return dbExports;
    if (name === "@workspace/db/advisory-locks") return {
      ADVISORY_LOCK_NAMESPACES: { CUSTOMER_CREDIT: 1, SUPPLIER_LEDGER: 2 },
      transactionAdvisoryLock: async () => undefined,
    };
    if (name === "drizzle-orm") return { eq: (...args: unknown[]) => args, and: (...args: unknown[]) => args, sql: Object.assign((...args: unknown[]) => args, { join: (a: unknown) => a }) };
    if (name === "drizzle-orm/node-postgres") return { drizzle: () => options.tx };
    if (name === "@workspace/api-zod") return new Proxy({}, { get: () => passSchema });
    if (name === "../lib/credit-evidence") return {
      ...contract,
      assertCreditEvidenceAccess: async () => undefined,
      assertCreditEvidenceScope: async () => undefined,
      claimCreditOperation: forbidden("claimCreditOperation"),
      insertCreditMovementE1: forbidden("insertCreditMovementE1"),
      ...options.helpers,
    };
    return permissiveExports({
      default: {}, requireSession: () => undefined, requireRole: () => () => undefined,
      requierePermiso: () => () => undefined, resolvePermiso: async () => ({ puedeCrear: true }),
      parseFechaEfectiva: (value: unknown) => value ? new Date(String(value)) : new Date("2026-01-01T00:00:00Z"),
      FechaEfectivaValidationError: class extends Error {},
      canLinkAdjustmentToTicket: () => true,
      isValidPaymentDestination: () => true, normalizeUsername: (value: string) => value.trim().toLowerCase(),
      moneyToCents: (value: unknown) => Math.round(Number(value) * 100),
      centsToMoney: (value: number) => (value / 100).toFixed(2),
      ...options.extra,
    });
  };
  let source = readFileSync(new URL(file, import.meta.url), "utf8");
  const mutation = mutations[process.env.E1_CUSTOMER_MUTANT ?? ""];
  if (mutation?.file === file) {
    assert.ok(source.includes(mutation.before), "Mutant anchor must identify real production code");
    source = source.replace(mutation.before, mutation.after);
  }
  const module = { exports: {} as any };
  const code = transformSync(source, { loader: "ts", format: "cjs", target: "es2022" }).code;
  new Function("require", "module", "exports", code)(imports, module, module.exports);
  return { routes, exports: module.exports };
}

async function invoke(handler: Handler, body: unknown, params: Record<string, number> = { id: 3, pagoId: 8 }) {
  let status = 200;
  let payload: any;
  let forwarded: unknown;
  const res: any = {
    status(value: number) { status = value; return this; },
    json(value: unknown) { payload = value; return this; },
  };
  await handler({ body, params, auth: { user: { id: 5, rol: "ADMIN", ubicacionId: 7, alcanceConsulta: "TODAS" } } }, res, (e) => { forwarded = e; });
  if (forwarded) throw forwarded;
  return { status, payload };
}

test("ordinary replay returns saved monetary response before live business state", async () => {
  const calls: string[] = [];
  const saved = { asignaciones: [{ notaId: 22 }], saldoAFavor: "4.00", saldoAFavorGenerado: "2.00" };
  const { routes } = loadRoute("clientes.ts", {
    tx: { select: () => { calls.push("audit-read"); return queryResult([{ data: saved }]); } },
    helpers: {
      assertCreditEvidenceAccess: async () => { calls.push("access"); },
      claimCreditOperation: async () => { calls.push("claim"); return { replay: true, movement }; },
      assertCreditEvidenceScope: async () => { assert.fail("Replay revalidated committed site/session state"); },
    },
  });
  const result = await invoke(routes["post /clientes/:id/pagos"]!, { ...evidence, importe: 100, formaPago: "TRANSFERENCIA", cuentaDestino: "CUENTA_FISCAL" });
  assert.equal(result.status, 201);
  assert.equal(result.payload.id, movement.id);
  assert.equal(result.payload.saldoAFavor, "4.00");
  assert.deepEqual(calls, ["access", "claim", "audit-read"]);
});

test("reversal replay wins over already-reversed state without inheriting nature", async () => {
  const { routes } = loadRoute("clientes.ts", {
    tx: { execute: () => { assert.fail("Already-reversed state must not be read on replay"); } },
    helpers: { claimCreditOperation: async (_tx: unknown, input: any) => {
      assert.equal(input.productor, "REVERSO_ABONO");
      assert.equal(input.contenido.formaPago, null);
      assert.equal(input.naturaleza, "CORRECCION_CONTABLE");
      return { replay: true, movement };
    } },
  });
  const result = await invoke(routes["post /clientes/:id/pagos/:pagoId/reversar"]!, { ...evidence, importe: 100, motivo: "Revertir recaptura incorrecta" });
  assert.equal(result.status, 201);
  assert.equal(result.payload.id, movement.id);
});

test("revoked operational access prevents replay and identity claim", async () => {
  let claimed = false;
  const { routes } = loadRoute("clientes.ts", {
    helpers: {
      assertCreditEvidenceAccess: async () => { throw new contract.CreditEvidenceError("Sitio ya no autorizado", 403); },
      claimCreditOperation: async () => { claimed = true; return { replay: true, movement }; },
    },
  });
  const result = await invoke(routes["post /clientes/:id/pagos/:pagoId/reversar"]!, { ...evidence, importe: 100, motivo: "Motivo" });
  assert.equal(result.status, 403);
  assert.equal(claimed, false);
});

test("manual note from another customer/site is rejected before financial writes", async () => {
  let selections = 0;
  const { routes } = loadRoute("clientes.ts", {
    tx: { select: () => { selections++; if (selections > 1) assert.fail("Invalid origin reached customer mutation"); return queryResult([]); } },
    helpers: { claimCreditOperation: async () => ({ replay: false, movement: null }) },
  });
  const result = await invoke(routes["post /clientes/:id/ajustes"]!, { ...evidence, notaOrigenId: 44, importe: -100, motivo: "Corrección de saldo documentada" });
  assert.equal(result.status, 400);
  assert.match(result.payload.error, /nota de origen/);
  assert.equal(selections, 1);
});

const payment = { tipo: "CLIENTE", entidadId: 3, documentoMovimientoId: 22, importe: 100, formaPago: "TRANSFERENCIA", cuentaDestino: "CUENTA_FISCAL", motivo: "Pago dirigido por referencia", referencia: "BANCO-1" };
test("directed canonical intent whitelists destination and excludes all credential fields", () => {
  const { exports } = loadRoute("pagos-dirigidos.ts");
  const input = { ...payment, adminPassword: "not-a-real-secret", sessionToken: "not-a-real-token", destinations: [{ password: "excluded" }] };
  const intent = exports.directedCreditIntent(input, evidence);
  assert.equal(intent.importe, "100.00");
  assert.equal(intent.documentoMovimientoId, 22);
  assert.equal(intent.adminPassword, undefined);
  assert.equal(intent.sessionToken, undefined);
  assert.equal(intent.destinations, undefined);
});

test("directed approval cannot approve another UUID or changed nature/site", () => {
  const { exports } = loadRoute("pagos-dirigidos.ts");
  const stored = { evidence, intent: exports.directedCreditIntent(payment, evidence) };
  for (const change of [
    { operacionClave: "22222222-2222-4222-8222-222222222222" },
    { naturaleza: "INGRESO_FISICO" }, { sitioOrigenId: 8 },
  ]) {
    assert.throws(() => exports.assertDirectedApprovalIdentity(stored, { ...evidence, ...change }), (error: any) => error.statusCode === 409);
  }
});

test("directed approved replay returns original movement before resolved-state errors", async () => {
  let executeCount = 0;
  let stored: any;
  const { routes, exports } = loadRoute("pagos-dirigidos.ts", {
    tx: { execute: async () => {
      executeCount++;
      if (executeCount === 1) return { rows: [{ id: 12, tipo: "CLIENTE", estado: "APROBADA", movimiento_id: movement.id }] };
      if (executeCount === 2) return { rows: [{ e1: stored }] };
      throw new Error("Replay performed another business read");
    } },
    helpers: { claimCreditOperation: async () => ({ replay: true, movement }) },
  });
  stored = { evidence, intent: exports.directedCreditIntent(payment, evidence) };
  const result = await invoke(routes["post /pagos-dirigidos/:id/aprobar"]!, evidence, { id: 12 });
  assert.equal(result.status, 201);
  assert.equal(result.payload.movimientoId, movement.id);
  assert.equal(executeCount, 2);
});

test("mounted directed approval rejects another UUID before claiming or applying", async () => {
  let executeCount = 0;
  let claimed = false;
  let stored: any;
  const { routes, exports } = loadRoute("pagos-dirigidos.ts", {
    tx: { execute: async () => {
      executeCount++;
      if (executeCount === 1) return { rows: [{ id: 12, tipo: "CLIENTE", estado: "PENDIENTE", movimiento_id: movement.id }] };
      if (executeCount === 2) return { rows: [{ e1: stored }] };
      throw new Error("Wrong UUID reached another business read");
    } },
    helpers: { claimCreditOperation: async () => { claimed = true; return { replay: true, movement }; } },
  });
  stored = { evidence, intent: exports.directedCreditIntent(payment, evidence) };
  const result = await invoke(routes["post /pagos-dirigidos/:id/aprobar"]!, {
    ...evidence, operacionClave: "22222222-2222-4222-8222-222222222222",
  }, { id: 12 });
  assert.equal(result.status, 409);
  assert.equal(claimed, false);
});

test("directed new physical cash is fenced before request or financial writes", async () => {
  let reads = 0;
  const { routes } = loadRoute("pagos-dirigidos.ts", {
    tx: { execute: async () => {
      reads++;
      if (reads <= 2) return { rows: [] }; // operation lock and original submission lookup
      assert.fail("Disabled cash reached business balance or request writes");
    } },
    helpers: { claimCreditOperation: async () => ({ replay: false, movement: null }) },
  });
  const result = await invoke(routes["post /pagos-dirigidos"]!, {
    ...payment, ...evidence, naturaleza: "INGRESO_FISICO", formaPago: "EFECTIVO",
    cuentaDestino: "CAJA_FISICA", sesionCajaId: 4,
  });
  assert.equal(result.status, 403);
  assert.match(result.payload.error, /deshabilitada/);
  assert.equal(reads, 2);
});

test("bad-debt replay rechecks ADMIN credentials and returns original audited amounts", async () => {
  const calls: string[] = [];
  const client = {
    query: async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("password_hash=crypt")) { calls.push("auth"); return { rows: [{ id: 77 }] }; }
      if (sql.includes("FROM auditoria")) return { rows: [{ datos_despues: { monto: "100.00", desdeCuando: "2026-01-01" } }] };
      assert.fail("Replay read changed balance or changed customer");
    },
    release: () => undefined,
  };
  const { routes } = loadRoute("clientes-admin.ts", {
    tx: {}, pool: { connect: async () => client },
    helpers: { claimCreditOperation: async (_tx: unknown, input: any) => {
      calls.push("claim");
      assert.equal(input.contenido.adminPassword, undefined);
      assert.equal(input.contenido.adminUsuario, undefined);
      assert.equal(input.contenido.montoIncobrable, "100.00");
      return { replay: true, movement };
    } },
  });
  const result = await invoke(routes["post /clientes/:id/baja"]!, {
    ...evidence, montoIncobrable: 100, motivo: "Baja incobrable autorizada y documentada",
    adminUsuario: "admin", adminPassword: "offline-input",
  });
  assert.equal(result.status, 200);
  assert.equal(result.payload.movimientoId, movement.id);
  assert.equal(result.payload.montoIncobrable, "100.00");
  assert.deepEqual(calls, ["auth", "claim"]);
});

test("missing ADMIN credentials open the authorization UI; invalid credentials cannot replay", async () => {
  for (const missing of [true, false]) {
    let claimed = false;
    const queries: string[] = [];
    const client = { query: async (sql: string) => { queries.push(sql); return { rows: [] }; }, release: () => undefined };
    const { routes } = loadRoute("clientes-admin.ts", {
      tx: {}, pool: { connect: async () => client },
      helpers: { claimCreditOperation: async () => { claimed = true; return { replay: true, movement }; } },
    });
    const result = await invoke(routes["post /clientes/:id/baja"]!, {
      ...evidence, montoIncobrable: 100, motivo: "Baja incobrable autorizada y documentada",
      ...(missing ? {} : { adminUsuario: "admin", adminPassword: "invalid-offline-input" }),
    });
    assert.equal(result.status, 401);
    assert.equal(claimed, false);
    if (missing) {
      assert.equal(result.payload.code, "ADMIN_CREDENTIALS_REQUIRED");
      assert.equal(result.payload.requiereAutorizacion, true);
      assert.deepEqual(queries, ["BEGIN", "ROLLBACK"]);
    }
  }
});