import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  GetAuditoriaResponse,
  ListAuditoriaQueryParams,
  ListAuditoriaResponse,
} from "@workspace/api-zod";

test("contrato de auditoría conserva evidencia histórica desconocida", () => {
  const entry = {
    id: "1",
    fecha: new Date("2025-01-01T12:00:00Z"),
    usuarioId: null,
    usuario: null,
    rolSnapshot: null,
    accion: "LOGIN_FALLIDO",
    modulo: null,
    entidad: "usuarios",
    entidadId: "alguien",
    sitioId: null,
    sitio: null,
    ip: "127.0.0.1",
  };
  assert.equal(ListAuditoriaResponse.parse({
    items: [entry], total: 1, page: 1, pageSize: 50,
  }).items[0]?.rolSnapshot, null);
  assert.equal(GetAuditoriaResponse.parse({
    ...entry, datosAntes: null, datosDespues: { motivo: "credenciales" },
  }).datosAntes, null);
  assert.deepEqual(ListAuditoriaQueryParams.parse({ page: "2", pageSize: "25" }), {
    page: 2,
    pageSize: 25,
  });
  assert.equal(ListAuditoriaQueryParams.parse({ rol: "SISTEMAS" }).rol, "SISTEMAS");
  assert.equal(ListAuditoriaQueryParams.parse({ rol: "CONTADOR" }).rol, "CONTADOR");
});

test("cobertura mínima corresponde a acciones reales", () => {
  const auth = readFileSync(new URL("./routes/auth.ts", import.meta.url), "utf8");
  const etiquetas = readFileSync(new URL("./routes/etiquetas.ts", import.meta.url), "utf8");
  const pos = readFileSync(new URL("./lib/pos.ts", import.meta.url), "utf8");
  assert.match(auth, /LOGIN_FALLIDO/);
  assert.match(etiquetas, /REIMPRIMIR_ETIQUETA/);
  assert.match(pos, /ABRIR_CAJA/);
  assert.match(pos, /CERRAR_CAJA/);
});

test("la migración central congela inserciones sin inferir históricos", () => {
  const migration = readFileSync(
    new URL("../../../lib/db/src/lib/audit-schema.ts", import.meta.url),
    "utf8",
  );
  assert.match(migration, /BEFORE INSERT ON auditoria/);
  assert.match(migration, /NEW\.usuario_snapshot/);
  assert.match(migration, /NEW\.rol_snapshot/);
  assert.match(migration, /NEW\.sitio_snapshot/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON auditoria/);
  assert.match(migration, /RAISE EXCEPTION 'auditoria es append-only'/);
  assert.doesNotMatch(migration, /integration_test_database_guard/);
  assert.doesNotMatch(migration, /app\.audit_test_cleanup/);
  assert.doesNotMatch(migration, /current_setting\s*\(/);
});

test("las consultas de auditoría usan exclusivamente snapshots", () => {
  const presentation = readFileSync(new URL("./lib/auditoria.ts", import.meta.url), "utf8");
  assert.match(presentation, /a\.usuario_snapshot AS usuario/);
  assert.doesNotMatch(presentation, /JOIN\s+usuarios/i);
  assert.match(presentation, /a\.rol_snapshot =/);
});

test("los endpoints de auditoría se autorizan por permiso y siguen sin mutaciones", () => {
  const route = readFileSync(new URL("./routes/auditoria.ts", import.meta.url), "utf8");
  assert.match(route, /requierePermiso\("auditoria", "ver"\)/);
  assert.doesNotMatch(route, /user\.rol !== "ADMIN"/);
  assert.doesNotMatch(route, /router\.(post|put|patch|delete)\(/i);
});