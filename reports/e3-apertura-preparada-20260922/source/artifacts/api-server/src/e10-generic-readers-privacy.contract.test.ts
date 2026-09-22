import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  exportAuditoriaQuery,
  getAuditoriaQuery,
  listAuditoriaQuery,
  nonFondoAuditSql,
} from "./lib/auditoria-queries";
import { nonFondoSystemNotification } from "./routes/notificaciones";

const dialect = new PgDialect();
const compile = (query: Parameters<PgDialect["sqlToQuery"]>[0]) =>
  dialect.sqlToQuery(query);

function assertFondoBoundary(sql: string) {
  assert.match(sql, /'fondo_movimiento'[\s\S]*'fondo_movimientos'/);
  assert.match(sql, /'fondo_arqueo'[\s\S]*'fondo_arqueos'/);
  assert.match(sql, /LEFT\(upper\(a\.accion\), 6\) = 'FONDO_'/);
  assert.match(sql, /lower\(COALESCE\(a\.modulo, ''\)\) IN \('fondo', 'fondo_mariana'\)/);
  assert.match(sql, /a\.datos_antes::text[\s\S]*a\.datos_despues::text/);
}

test("actual list query applies privacy before count and paging only for non-ADMIN", () => {
  const restricted = compile(listAuditoriaQuery({ search: "fixture" }, 2, 25, false));
  const admin = compile(listAuditoriaQuery({ search: "fixture" }, 2, 25, true));
  assertFondoBoundary(restricted.sql);
  assert.ok(restricted.sql.indexOf("NOT (") < restricted.sql.indexOf("ORDER BY"));
  assert.ok(restricted.sql.indexOf("NOT (") < restricted.sql.indexOf("LIMIT"));
  assert.match(restricted.sql, /COUNT\(\*\) OVER\(\)::int AS total/);
  assert.doesNotMatch(admin.sql, /LEFT\(upper\(a\.accion\), 6\)/);
});

test("compiled predicate is exact and preserves ordinary Caja fondoInicial metadata", () => {
  const compiled = compile(nonFondoAuditSql());
  assertFondoBoundary(compiled.sql);
  assert.doesNotMatch(compiled.sql, /LIKE|ESCAPE/);
  assert.deepEqual(compiled.params, []);

  const ordinaryCajaMetadata = JSON.stringify({
    modulo: "caja",
    accion: "ABRIR_CAJA",
    fondoInicial: "100.00",
    fechaOperativa: "2026-09-18",
    ubicacionId: 2,
  });
  const sourceMarkers =
    /(fondo_mariana|fondo_movimientos?|fondo_arqueos?|"accion"\s*:\s*"FONDO_)/i;
  assert.equal(sourceMarkers.test(ordinaryCajaMetadata), false);
  assert.equal(sourceMarkers.test('{"accion":"FONDO_AJUSTAR"}'), true);
  for (const emitted of [
    { modulo: "FONDO", accion: "CREAR", entidad: "FONDO_MOVIMIENTO" },
    { modulo: "FONDO", accion: "INVERTIR", entidad: "FONDO_MOVIMIENTO" },
    { modulo: "FONDO", accion: "ARQUEO", entidad: "FONDO_ARQUEO" },
  ]) {
    assert.equal(emitted.modulo.toLowerCase(), "fondo");
    assert.match(emitted.entidad.toLowerCase(), /^fondo_(?:movimiento|arqueo)$/);
  }
});

test("actual detail and export query builders share the role-sensitive boundary", () => {
  const restrictedDetail = compile(getAuditoriaQuery("91", false));
  const adminDetail = compile(getAuditoriaQuery("91", true));
  const restrictedExport = compile(exportAuditoriaQuery({ modulo: "caja" }, false));
  const adminExport = compile(exportAuditoriaQuery({ modulo: "caja" }, true));
  assertFondoBoundary(restrictedDetail.sql);
  assertFondoBoundary(restrictedExport.sql);
  assert.match(restrictedDetail.sql, /LIMIT 1/);
  assert.match(restrictedExport.sql, /LIMIT \$\d+/);
  assert.doesNotMatch(adminDetail.sql, /LEFT\(upper\(a\.accion\), 6\)/);
  assert.doesNotMatch(adminExport.sql, /LEFT\(upper\(a\.accion\), 6\)/);
});

test("actual generic notification predicate excludes entities, type and source payload", () => {
  const compiled = compile(nonFondoSystemNotification());
  assert.match(compiled.sql, /"notificaciones_sistema"\."entidad"/);
  assert.match(compiled.sql, /fondo_mariana[\s\S]*fondo_movimiento[\s\S]*fondo_movimientos/);
  assert.match(compiled.sql, /fondo_arqueo[\s\S]*fondo_arqueos/);
  assert.match(compiled.sql, /LEFT\(upper\("notificaciones_sistema"\."tipo"\), 6\) = 'FONDO_'/);
  assert.match(compiled.sql, /"notificaciones_sistema"\."titulo"[\s\S]*"notificaciones_sistema"\."mensaje"/);
  assert.doesNotMatch(compiled.sql, /LIKE|ESCAPE/);
});