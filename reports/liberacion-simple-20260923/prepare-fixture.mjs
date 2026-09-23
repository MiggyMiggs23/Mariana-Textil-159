// Offline only. Copy a narrow dependency fixture, not a catalog projection.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const root = process.cwd();
const out = path.join(root, "reports/liberacion-simple-20260923");
const prior = "reports/tanda-b-b0-b1-20260923/r5/evidencia/rehearsal-r5/fixture-minimal.sql";
const raw = "reports/e3-apertura-preparada-20260922/evidencia/live/catalog-B0-real.json";
const c = JSON.parse(fs.readFileSync(path.join(root, raw)));
let ddl = fs.readFileSync(path.join(root, prior), "utf8");
const q = s => `"${s.replaceAll('"', '""')}"`;
const extra = ["permisos_rol", "atribuciones_credito_e1", "finalizaciones_abono_e2", "evidencia_no_aplicada_e2"];
for (const name of extra) {
  const cols = c.schemaRows.filter(r => r.kind === "column" && r.object_name === name && r.schema_name === "public");
  assert(cols.length, `Missing dependency ${name}`);
  ddl += `\nCREATE TABLE public.${q(name)} (${cols.map(r => `${q(r.parent_name)} ${r.definition.split(/:[tf]:/)[0]}`).join(",")});\n`;
  for (const r of c.schemaRows.filter(r => r.kind === "constraint" && r.parent_name === name && /^(PRIMARY KEY|UNIQUE) /.test(r.definition))) {
    ddl += `ALTER TABLE public.${q(name)} ADD CONSTRAINT ${q(r.object_name)} ${r.definition};\n`;
  }
}
// E3 inserts role permissions without an explicit id. Copy the existing sequence
// and DEFAULT declarations verbatim from the prior raw dump (no operational rows).
const dump = fs.readFileSync(path.join(root, "reports/e3-apertura-preparada-20260922/evidencia/live/schema-B0-real.sql"), "utf8");
const sequence = dump.match(/CREATE SEQUENCE public\.permisos_rol_id_seq[\s\S]*?;/);
const defaultId = dump.match(/ALTER TABLE ONLY public\.permisos_rol ALTER COLUMN id SET DEFAULT [^;]+;/);
assert(sequence && defaultId, "Missing existing permisos_rol serial definitions");
ddl += `${sequence[0]}\n${defaultId[0]}\n`;
const functions = c.schemaRows.filter(r => r.kind === "function" && (/^e2_/.test(r.object_name) ||
  ["e1_guard_cash_capture_closed", "e1_guard_historical_attribution_closed", "impedir_mutacion_credito_e1",
    "validar_atribucion_credito_e1", "validar_cobro_pendiente_e1", "validar_contexto_credito_e1"].includes(r.object_name)));
assert(functions.some(r => r.object_name === "e1_guard_cash_capture_closed"));
// PostgreSQL resolves PL/pgSQL relation references at execution, not definition.
for (const r of functions) ddl += `${r.definition};\n`;
for (const r of c.schemaRows.filter(r => r.kind === "trigger" && (/^e2_/.test(r.object_name) ||
  ["zz_e1_cash_capture_closed", "zz_e1_historical_attribution_closed", "atribuciones_inmutables_e1",
    "atribuciones_validas_e1", "cobros_inmutables_e1", "cobros_validos_e1", "movimientos_validos_e1",
    "operaciones_inmutables_e1"].includes(r.object_name)))) ddl += `${r.definition};\n`;
fs.writeFileSync(path.join(out, "fixture.sql"), ddl, { flag: "wx" });
fs.writeFileSync(path.join(out, "fixture-provenance.json"), JSON.stringify({
  status: "PREPARED_NOT_EXECUTED", base: prior, additionalDefinitionsFrom: raw,
  extraTables: extra, functions: functions.map(r => r.object_name),
  limitations: "Dependency-only synthetic empty tables; not an operational database copy or full catalog equivalence."
}, null, 2), { flag: "wx" });