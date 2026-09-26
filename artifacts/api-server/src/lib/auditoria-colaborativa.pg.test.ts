import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

if (process.env.NODE_ENV !== "test" || process.env.REQUIRE_ISOLATED_TEST_DATABASE !== "1" ||
    !process.env.TEST_DATABASE_URL || process.env.TEST_DATABASE_URL === process.env.DATABASE_URL ||
    !decodeURIComponent(new URL(process.env.TEST_DATABASE_URL).hostname).startsWith("/tmp/")) {
  throw new Error("Requires the private disposable PostgreSQL runner; no application database access.");
}
const { db, pool, createTestDatabaseGuard } = await import("@workspace/db");
await (await createTestDatabaseGuard(pool, process.env.TEST_DATABASE_URL, process.env.DATABASE_URL)).assertIsolated();
const { participarAuditoria, scanAuditoria, transitionAuditoria, buildAuditoriaDetail, isDesktopAuditScanner } = await import("./auditoria-inventario");
let site: number;
const users: number[] = [];
let folio = 0;
before(async () => {
  site = (await pool.query(`INSERT INTO ubicaciones(nombre,iniciales,tipo) VALUES('Audit collaboration test','ACT','BODEGA') RETURNING id`)).rows[0].id;
  for (let i = 0; i < 8; i++) {
    users.push((await pool.query(`INSERT INTO usuarios(nombre,usuario,password_hash,rol,activo,alcance_consulta)
      VALUES($1,$2,'test-only','ADMIN',true,'TODAS') RETURNING id`, [`Actor ${i}`, `audit-collaboration-${i}`])).rows[0].id);
  }
});
after(() => pool.end());
async function audit() {
  return (await pool.query(`INSERT INTO auditorias_inventario(folio,ubicacion_id,creada_por_id)
    VALUES($1,$2,$3) RETURNING id`, [++folio, site, users[0]])).rows[0].id as number;
}
const join = (id: number, user: number) => db.transaction(tx => participarAuditoria(tx, { auditoriaId: id, usuarioId: users[user]! }));
const scan = (id: number, user: number, serie: string) => db.transaction(tx => scanAuditoria(tx, {
  auditoriaId: id, usuarioId: users[user]!, serie, ip: "127.0.0.1",
}));
const cancel = (id: number) => db.transaction(tx => transitionAuditoria(tx, {
  auditoriaId: id, usuarioId: users[0]!, ip: "127.0.0.1", action: "CANCELAR", motivo: "Disposable test complete",
}));
function rejectedLimit(result: PromiseSettledResult<unknown>) {
  return result.status === "rejected" && result.reason.code === "AUDIT_PARTICIPANT_LIMIT";
}

test("three parallel unique scans, original author collision, counts and historical detail", async () => {
  const id = await audit();
  await assert.rejects(scan(id, 0, "NO-FLOORS"), { code: "FLOOR_CONFIGURATION_REQUIRED" });
  const floors = (await pool.query(`INSERT INTO pisos(ubicacion_id,nombre,activo)
    VALUES($1,'A mezzanine',true),($1,'B rooftop',true),($1,'C cellar',true) RETURNING id`, [site])).rows;
  await assert.rejects(db.transaction(tx => scanAuditoria(tx, {
    auditoriaId: id, usuarioId: users[0]!, serie: "WRONG-DESKTOP", ip: "test", desktop: true, pisoId: floors[1].id,
  })), { code: "DESKTOP_ACCESS_FLOOR_REQUIRED" });
  await assert.rejects(scan(id, 0, "NO-SELECTION"), { code: "INVALID_FLOOR" });
  const three = await Promise.all([0, 1, 2].map(n => db.transaction(tx => scanAuditoria(tx, {
    auditoriaId: id, usuarioId: users[n]!, serie: `UNIQUE-${n}`, ip: "test", desktop: n === 0, pisoId: floors[n].id,
  }))));
  assert.equal(three.filter(r => !r.duplicado).length, 3);
  // First writer holds header lock until the collision has been submitted.
  let release!: () => void;
  let ready!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const entered = new Promise<void>(resolve => { ready = resolve; });
  const first = db.transaction(async tx => {
    const result = await scanAuditoria(tx, { auditoriaId: id, usuarioId: users[0]!, serie: "COLLISION", ip: "test", pisoId: floors[0].id });
    ready(); await held; return result;
  });
  await entered;
  const second = db.transaction(tx => scanAuditoria(tx, { auditoriaId: id, usuarioId: users[1]!, serie: "COLLISION", ip: "test", pisoId: floors[1].id, desktop: false }));
  release();
  const [original, duplicate] = await Promise.all([first, second]);
  assert.equal(original.duplicado, false);
  assert.equal(duplicate.duplicado, true);
  assert.equal(duplicate.usuarioId, users[0]);
  assert.equal(duplicate.usuarioNombre, "Actor 0");
  assert.equal(duplicate.escaneadoAt, original.escaneadoAt);
  const detail = await db.transaction(tx => buildAuditoriaDetail(tx, id));
  assert.equal(detail.totalEscaneados, 4);
  assert.equal(detail.participantes.reduce((n, p) => n + p.escaneos, 0), 4);
  assert.equal(detail.resultados.find(r => r.serie === "COLLISION")?.usuarioId, users[0]);
  assert.equal(detail.resultados.find(r => r.serie === "COLLISION")?.pisoRealId, floors[0].id);
  assert.deepEqual([0, 1, 2].map(n => detail.resultados.find(r => r.serie === `UNIQUE-${n}`)?.pisoRealId), floors.map(f => f.id));
  await cancel(id);
  await pool.query(`UPDATE pisos SET activo=false WHERE ubicacion_id=$1`, [site]);
});

test("concurrent admissions at four/five, direct sixth scan, renewal and expiry/rejoin", async () => {
  const id = await audit();
  await Promise.all([0, 1, 2, 3].map(n => join(id, n)));
  const competing = await Promise.allSettled([join(id, 4), join(id, 5)]);
  assert.equal(competing.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(competing.filter(rejectedLimit).length, 1);
  const winner = competing[0]!.status === "fulfilled" ? 4 : 5;
  const loser = winner === 4 ? 5 : 4;
  assert.equal((await join(id, winner)).participantesActivos, 5);
  const full = await Promise.allSettled([join(id, loser), join(id, 6), scan(id, 7, "FORBIDDEN")]);
  assert.equal(full.filter(rejectedLimit).length, 3);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM auditoria_inventario_escaneos WHERE auditoria_id=$1`, [id])).rows[0].n, 0);
  // Fixture-only ageing exercises expiry without sleeps or changing production clock.
  await pool.query(`UPDATE auditoria_inventario_participantes SET ultimo_at=clock_timestamp()-interval '91 seconds' WHERE auditoria_id=$1 AND usuario_id=$2`, [id, users[0]]);
  assert.equal((await join(id, loser)).participantesActivos, 5);
  await assert.rejects(join(id, 0), { code: "AUDIT_PARTICIPANT_LIMIT" });
  await pool.query(`UPDATE auditoria_inventario_participantes SET ultimo_at=clock_timestamp()-interval '91 seconds' WHERE auditoria_id=$1 AND usuario_id=$2`, [id, users[loser]]);
  assert.equal((await join(id, 0)).participantesActivos, 5);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM auditoria_inventario_participantes WHERE auditoria_id=$1`, [id])).rows[0].n, 6);
  await cancel(id);
});

test("closing header lock prevents queued admission and scan after close", async () => {
  const id = await audit();
  let release!: () => void;
  let ready!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const entered = new Promise<void>(resolve => { ready = resolve; });
  const closing = db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM auditorias_inventario WHERE id=${id} FOR UPDATE`);
    await transitionAuditoria(tx, { auditoriaId: id, usuarioId: users[0]!, ip: "test", action: "CERRAR" });
    ready(); await held;
  });
  await entered;
  const pending = Promise.allSettled([join(id, 1), scan(id, 2, "AFTER-CLOSE")]);
  release(); await closing;
  for (const result of await pending) {
    assert.equal(result.status, "rejected");
    if (result.status === "rejected") assert.equal(result.reason.code, "NOT_OPEN");
  }
});

test("participation reuses scan edit/session/role/site guards, never autorizar", () => {
  const route = readFileSync(new URL("../routes/auditorias-inventario.ts", import.meta.url), "utf8");
  const block = route.slice(route.indexOf('"/auditorias/:id/participar"'), route.indexOf('"/auditorias/:id/escaneos"'));
  for (const required of ["requireSession", 'requierePermiso("auditoria_inventario", "editar")', "requireOperationalRole", "getVisibleHeader", "visible.error", "status(403)"]) assert.ok(block.includes(required));
  assert.ok(!block.includes('"autorizar"'));
  assert.ok(route.includes('desktop: isDesktopAuditScanner(req.get("user-agent"))'));
  assert.equal(isDesktopAuditScanner(undefined), true);
  assert.equal(isDesktopAuditScanner("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), true);
  assert.equal(isDesktopAuditScanner("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile"), false);
  assert.equal(isDesktopAuditScanner("Mozilla/5.0 (Linux; Android 14)"), false);
  const floorRoute = route.slice(route.indexOf('"/auditorias/:id/pisos"'), route.indexOf('"/auditorias/:id/participar"'));
  for (const required of ["requireSession", 'requierePermiso("auditoria_inventario", "ver")', "requireOperationalRole", "getVisibleHeader", "visible.error", "eq(pisosTable.activo, true)", "asc(pisosTable.nombre)"]) assert.ok(floorRoute.includes(required));
  assert.ok(!floorRoute.includes('requierePermiso("ubicaciones"'));
});

test("actual registered close guards deny editar-only BODEGA and require both permissions; cancel unchanged", async () => {
  const { default: router } = await import("../routes/auditorias-inventario");
  type Handler = (req: Request, res: Response, next: NextFunction) => unknown;
  const stack = router.stack as Array<{ route?: { path: string; stack: Array<{ handle: Handler }> } }>;
  const closing = stack.find(layer => layer.route?.path === "/auditorias/:id/cerrar")!.route!;
  const cancelling = stack.find(layer => layer.route?.path === "/auditorias/:id/cancelar")!.route!;
  const userId = users[7]!;
  await pool.query(`UPDATE usuarios SET rol='BODEGA',ubicacion_id=$2 WHERE id=$1`, [userId, site]);
  await pool.query(`INSERT INTO permisos_usuario(usuario_id,modulo,puede_ver,puede_crear,puede_editar,puede_autorizar)
    VALUES($1,'auditoria_inventario',true,true,true,false)`, [userId]);
  const req = { auth: { user: { id: userId, rol: "BODEGA", ubicacionId: site } } } as Request;
  async function invoke(handler: Handler) {
    let status = 200;
    let passed = false;
    const res = {
      status(value: number) { status = value; return this; },
      json() { return this; },
    } as unknown as Response;
    await handler(req, res, () => { passed = true; });
    return { status, passed };
  }
  assert.deepEqual(await invoke(closing.stack[1]!.handle), { status: 200, passed: true });
  assert.deepEqual(await invoke(closing.stack[2]!.handle), { status: 403, passed: false });
  assert.deepEqual(await invoke(cancelling.stack[1]!.handle), { status: 200, passed: true });
  assert.deepEqual(await invoke(cancelling.stack[2]!.handle), { status: 200, passed: true });
  await pool.query(`UPDATE permisos_usuario SET puede_autorizar=true WHERE usuario_id=$1 AND modulo='auditoria_inventario'`, [userId]);
  assert.deepEqual(await invoke(closing.stack[2]!.handle), { status: 200, passed: true });
  await pool.query(`UPDATE permisos_usuario SET puede_editar=false WHERE usuario_id=$1 AND modulo='auditoria_inventario'`, [userId]);
  assert.deepEqual(await invoke(closing.stack[1]!.handle), { status: 403, passed: false });
  req.auth!.user.rol = "ADMIN";
  assert.deepEqual(await invoke(closing.stack[1]!.handle), { status: 200, passed: true });
  assert.deepEqual(await invoke(closing.stack[2]!.handle), { status: 200, passed: true });
});