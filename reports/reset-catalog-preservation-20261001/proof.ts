import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import pg from "../../artifacts/api-server/node_modules/pg/lib/index.js";
import * as manifest from "../../artifacts/api-server/src/lib/test-reset/manifest";
import { inspectResetSchema, resetTestData } from "../../artifacts/api-server/src/lib/test-reset/service";

async function main() {
const out = resolve("reports/reset-catalog-preservation-20261001");
const hash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const bundle = resolve("artifacts/api-server/dist-driver-phones-20261001/index.mjs");
const map = JSON.parse(readFileSync(bundle + ".map", "utf8"));
const hashes: Record<string, string> = { bundle: hash(readFileSync(bundle)), schema: hash(readFileSync("reports/test-reset-20260925/schema-only.sql")) };
for (const name of ["service", "manifest"]) {
  const suffix = `/test-reset/${name}.ts`;
  const i = map.sources.findIndex((s: string) => s.endsWith(suffix));
  assert.ok(i >= 0, suffix);
  const source = readFileSync(`artifacts/api-server/src/lib/test-reset/${name}.ts`, "utf8");
  assert.equal(map.sourcesContent[i], source, `active embedded ${name} source`);
  hashes[name] = hash(source);
}
assert.equal(manifest.PROTECT_CUSTOMERS, true);
const root = mkdtempSync(join(tmpdir(), "catalog-reset-proof-"));
const data = join(root, "pgdata");
const port = 25439;
let started = false;
let pool: pg.Pool | undefined;
let pid = 0;
const evidence: any = { status: "RUNNING", hashes, sourceMatchesEmbeddedMap: true, protectCustomers: true, liveDatabaseAccess: false };
const q = (s: string) => `"${s.replaceAll('"', '""')}"`;
try {
  execFileSync("initdb", ["-D", data, "-A", "trust", "-U", "reset_tester"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", data, "-l", join(root, "postgres.log"), "-o", `-k ${root} -h '' -p ${port}`, "-w", "start"], { stdio: "pipe" });
  started = true;
  pid = Number(readFileSync(join(data, "postmaster.pid"), "utf8").split("\n")[0]);
  pool = new pg.Pool({ host: root, port, user: "reset_tester", database: "postgres" });
  await pool.query(readFileSync("reports/test-reset-20260925/schema-only.sql", "utf8").replace(/^\\.*$/gm, ""));
  await pool.query("SET search_path=public,pg_catalog");
  await pool.query("ALTER TABLE choferes ADD COLUMN IF NOT EXISTS telefonos jsonb");
  const tables = await inspectResetSchema(pool);
  const groups = Object.fromEntries(["PRESERVED_TABLES", "CLEARED_TABLES", "COUNTER_TABLES", "MIXED_TABLES"].map(key => {
    const declared = [...(manifest as any)[key]];
    return [key, { declared, present: declared.filter(n => tables.includes(n)), absentOptional: declared.filter(n => !tables.includes(n)) }];
  }));
  const cleared = manifest.CLEARED_TABLES.filter(n => tables.includes(n) && n !== "cliente_documentos");
  evidence.classification = { inventory: tables, groups, required: manifest.REQUIRED_TABLES, effectiveClear: cleared,
    effectivePreserve: [...manifest.PRESERVED_TABLES.filter(n => tables.includes(n)), "cliente_documentos"],
    mixedRules: { clientes: "preserve every field except saldo_credito -> 0", e11_operaciones: "retain PERFIL only", e11_resoluciones: "retain PERFIL only" },
    additiveCopyOnly: "choferes.telefonos nullable jsonb (current schema)" };
  // Canonical schema fixture pattern from service.isolated.test.ts; synthetic rows only.
  await pool.query(`
    INSERT INTO ubicaciones(id,nombre,iniciales,tipo) VALUES(1,'Sitio sintético','SS','TIENDA');
    INSERT INTO usuarios(id,nombre,usuario,password_hash,rol,ubicacion_id) VALUES(1,'Admin sintético','fixture-admin','not-a-login-secret','ADMIN',1);
    INSERT INTO proveedores(id,nombre,tipo) VALUES(1,'Proveedor sintético','NACIONAL');
    INSERT INTO productos(id,sku,tela,color,unidad,precio_sugerido,precio_mayoreo,precio_menudeo) VALUES(1,'TEST-0001','Tela prueba','Azul','METRO',17,17,17);
    INSERT INTO clientes(id,nombre,telefono,correo,rfc,direccion_particular,direccion_entrega,contacto_nombre,notas,activo,dias_credito,limite_credito,saldo_credito)
      VALUES(1,'Cliente sintético','0000000000','fixture@example.invalid','TEST010101ABC','Particular','Entrega','Contacto','Conservar',false,30,900,123);
    INSERT INTO cliente_documentos(cliente_id,lado,nombre_archivo,ruta_archivo,mime_type,tamano_bytes,subido_por)
      VALUES(1,'FRENTE','fixture.pdf','fixture/ine.pdf','application/pdf',100,1);
    INSERT INTO sesiones(id,usuario_id,expira_at,ip,user_agent) VALUES('00000000-0000-4000-8000-000000000001',1,now()+interval '1 hour','local','test');
    INSERT INTO camionetas(id,nombre,placas,marca,modelo,tipo,activa) VALUES(1,'Camioneta sintética','TEST-01','Marca','Modelo','PROPIA',false);
    INSERT INTO choferes(id,nombre_completo,telefono,telefonos,activo) VALUES(1,'Chofer sintético','0000000001','[{"numero":"0000000001","etiqueta":"Principal"},{"numero":"0000000002","etiqueta":"Alterno"}]',false);
    INSERT INTO equipos(id,ubicacion_id,tipo,identificador,marca,modelo,numero_serie,notas,creado_por,actualizado_por)
      VALUES(1,1,'IMPRESORA_TICKETS','TEST-EQ','Marca','Modelo','TEST-SERIE','Conservar',1,1);
    INSERT INTO equipos_checklist(equipo_id,item_key,checked_por) VALUES(1,'TICKET_REAL',1);
    INSERT INTO entradas(id,fecha,folio,total_rollos,ubicacion_id,usuario_id,uuid_cliente) VALUES(1,now(),4,1,1,1,'00000000-0000-4000-8000-000000000010');
    INSERT INTO rollos(id,producto_id,serie,cantidad_actual,cantidad_inicial,ubicacion_id,estado,recepcion_id) VALUES(1,1,'12345678',5,5,1,'DISPONIBLE',1);
    INSERT INTO existencias(producto_id,ubicacion_id,cantidad_total,rollos_count) VALUES(1,1,5,1);
    INSERT INTO tickets(id,cliente_id,folio,subtotal,total,ubicacion_id,usuario_terminal_id,uuid_cliente) VALUES(1,1,1000,17,17,1,1,'00000000-0000-4000-8000-000000000011');
    INSERT INTO salidas(id,folio,origen_id,modalidad,cliente_id,ticket_id,uuid_cliente) VALUES(1,1,1,'VENTA_CLIENTE',1,1,'00000000-0000-4000-8000-000000000012');
    INSERT INTO salida_lineas(id,salida_id,producto_id,cantidad_solicitada) VALUES(1,1,1,5);
    INSERT INTO salida_rollos(salida_id,linea_id,rollo_id,cantidad_enviada) VALUES(1,1,1,5);
    INSERT INTO viajes(id,folio,origen_id,camioneta_id,chofer_id,salida_at,creado_por_id,observaciones) VALUES(1,1,1,1,1,now(),1,'Fixture');
    INSERT INTO viaje_salidas VALUES(1,1);
    INSERT INTO viaje_tickets VALUES(1,1);
    INSERT INTO movimientos(rollo_id,producto_id,ubicacion_id,tipo,cantidad,saldo_posterior,usuario_id,documento_tipo,documento_id) VALUES(1,1,1,'ALTA',5,5,1,'ENTRADA','1');
    INSERT INTO operaciones_credito_e1(productor,clave,naturaleza,usuario_id,solicitud_canonica) VALUES('AJUSTE_MANUAL','00000000-0000-4000-8000-000000000052','CORRECCION_CONTABLE',1,'{"fixture":true}');
    INSERT INTO movimientos_credito(cliente_id,ticket_id,tipo,importe,usuario_id,sitio_origen_id,naturaleza,operacion_productor,operacion_clave,origen_justificacion)
      VALUES(1,1,'AJUSTE',123,1,1,'CORRECCION_CONTABLE','AJUSTE_MANUAL','00000000-0000-4000-8000-000000000052','Saldo sintético');
    INSERT INTO ticket_folio(id,ultimo_folio) VALUES(1,1099);
    INSERT INTO series_consecutivo(id,ultimo_numero) VALUES(1,12345678);
  `);
  const snapshot = async (table: string, customer = false) => (await pool!.query(`SELECT ${customer ? "to_jsonb(t)-'saldo_credito'" : "to_jsonb(t)"} AS row FROM ${q(table)} t ORDER BY 1::text,to_jsonb(t)::text`)).rows;
  const preserve = [...manifest.PRESERVED_TABLES.filter(n => tables.includes(n) && n !== "test_reset_history"), "cliente_documentos", "clientes"];
  const before = Object.fromEntries(await Promise.all(preserve.map(async n => [n, await snapshot(n, n === "clientes")])));
  const triggerSql = `SELECT c.relname,t.tgname,t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgname<>'test_reset_history_immutable' ORDER BY 1,2`;
  const triggers = (await pool.query(triggerSql)).rows;
  evidence.seedCounts = Object.fromEntries(await Promise.all(tables.map(async n => [n, Number((await pool!.query(`SELECT count(*) n FROM ${q(n)}`)).rows[0].n)])));
  const oldHistory = tables.includes("test_reset_history") ? await snapshot("test_reset_history") : [];
  evidence.result = await resetTestData(pool, { actorId: 1, sessionId: "00000000-0000-4000-8000-000000000001", confirmation: "BORRAR" }, { enabled: true });
  // Independent connection proves COMMIT, not merely an in-transaction view.
  const observer = new pg.Client({ host: root, port, user: "reset_tester", database: "postgres" });
  await observer.connect();
  try {
    assert.equal(Number((await observer.query("SELECT count(*) n FROM sesiones")).rows[0].n), 0);
    assert.equal(Number((await observer.query("SELECT count(*) n FROM test_reset_history")).rows[0].n), oldHistory.length + 1);
    assert.equal((await observer.query("SELECT protected_customers FROM test_reset_history ORDER BY id DESC LIMIT 1")).rows[0].protected_customers, true);
    evidence.independentConnectionObservedCommit = true;
  } finally { await observer.end(); }
  for (const n of cleared) assert.equal(Number((await pool.query(`SELECT count(*) n FROM ${q(n)}`)).rows[0].n), 0, n);
  evidence.preservation = {};
  for (const n of preserve) {
    const after = await snapshot(n, n === "clientes");
    assert.deepEqual(after, before[n], n);
    evidence.preservation[n] = { rows: after.length, beforeHash: hash(JSON.stringify(before[n])), afterHash: hash(JSON.stringify(after)) };
  }
  assert.equal(Number((await pool.query("SELECT count(*) n FROM clientes WHERE saldo_credito<>0")).rows[0].n), 0);
  assert.deepEqual((await pool.query(triggerSql)).rows, triggers);
  evidence.triggerModesPreserved = { count: triggers.length, hash: hash(JSON.stringify(triggers)) };
  evidence.counters = {};
  for (const n of manifest.COUNTER_TABLES.filter(n => tables.includes(n))) {
    const column = n === "series_consecutivo" ? "ultimo_numero" : "ultimo_folio";
    const expected = n === "series_consecutivo" ? 10000000 : 0;
    const rows = (await pool.query(`SELECT ${q(column)} value FROM ${q(n)}`)).rows;
    assert.ok(rows.length);
    for (const r of rows) assert.equal(Number(r.value), expected, n);
    evidence.counters[n] = { rows: rows.length, expected };
  }
  // Every installed FK, including all catalog references and composite keys.
  const fks = (await pool.query(`SELECT conname,conrelid::regclass::text child,confrelid::regclass::text parent,
    ARRAY(SELECT attname::text FROM unnest(conkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=conrelid AND a.attnum=k.num ORDER BY ord) ck,
    ARRAY(SELECT attname::text FROM unnest(confkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=confrelid AND a.attnum=k.num ORDER BY ord) pk
    FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace`)).rows;
  for (const fk of fks) {
    const nonnull = fk.ck.map((c: string) => `c.${q(c)} IS NOT NULL`).join(" AND ");
    const match = fk.ck.map((c: string, i: number) => `c.${q(c)}=p.${q(fk.pk[i])}`).join(" AND ");
    assert.equal(Number((await pool.query(`SELECT count(*) n FROM ${fk.child} c WHERE ${nonnull} AND NOT EXISTS(SELECT 1 FROM ${fk.parent} p WHERE ${match})`)).rows[0].n), 0, fk.conname);
  }
  evidence.orphanChecks = { installedForeignKeys: fks.length, orphans: 0 };
  assert.deepEqual((await snapshot("test_reset_history")).slice(0, oldHistory.length), oldHistory);
  assert.deepEqual((await pool.query("SELECT cleared_tables FROM test_reset_history ORDER BY id DESC LIMIT 1")).rows[0].cleared_tables, cleared);
  assert.equal(hash(readFileSync(bundle)), hashes.bundle);
  evidence.bundleUnchanged = true;
  evidence.status = "PASS";
} catch (error) {
  evidence.status = "FAIL";
  evidence.error = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  await pool?.end();
  if (started) execFileSync("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
  let processGone = !pid;
  if (pid) { try { process.kill(pid, 0); } catch (e: any) { processGone = e.code === "ESRCH"; } }
  rmSync(root, { recursive: true, force: true });
  evidence.cleanup = { processGone, clusterDirectoryGone: !existsSync(root), socketGone: !existsSync(join(root, `.s.PGSQL.${port}`)) };
  writeFileSync(join(out, "evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
  const groups = evidence.classification?.groups ?? {};
  writeFileSync(join(out, "report.md"), `# Disposable reset catalog proof\n\nStatus: **${evidence.status}**. Actual service called directly; no API server launched, no live DB access.\n\nService/manifest exactly match active bundle embedded source map; bundle SHA-256: ${hashes.bundle}.\n\nFull-row catalog/document equality (customer balance excepted), ordered JSONB phones, effective-clear emptiness, installed-FK orphan scans, trigger modes, counters and independent-connection commit assertions are in evidence.json. Cleanup: ${JSON.stringify(evidence.cleanup)}.\n\nFixture uses canonical isolated-test SQL patterns, not native creation HTTP flows. Mixed E11 business/profile rows are not seeded in this focused proof. No browser/UI verification is applicable.\n\n${Object.entries(groups).map(([k,v]: any) => `## ${k}\nPresent: ${v.present.join(", ")}.\n\nDeclared optional absent: ${v.absentOptional.join(", ") || "(none)"}.\n`).join("\n")}\n## Effective clear\n${evidence.classification?.effectiveClear.join(", ")}\n\n## Mixed rules\nCustomers retained except saldo_credito=0; E11 operations/resolutions retain PERFIL only. cliente_documentos is declared cleared but effectively preserved with PROTECT_CUSTOMERS=true. History is append-only. Counters: folios 0, series 10000000.\n`);
}
assert.equal(evidence.cleanup.processGone, true);
console.log("PASS: disposable cluster reset and cleanup; evidence.json");
}
main().catch(error => { console.error(error); process.exitCode = 1; });