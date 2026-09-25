import { readFileSync, writeFileSync } from "node:fs";
const text = readFileSync("reports/e11/01-preparado.sql", "utf8");
const start = text.indexOf("CREATE FUNCTION public.e11_graph()");
const end = text.indexOf("\nEND $$;", start) + "\nEND $$;".length;
if (start < 0 || end <= start) throw new Error("Prepared E11 graph absent");
let sql = text.slice(start, end).replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION");
function renameBlock(begin, finish, aliases) {
  const left = sql.indexOf(begin), right = sql.indexOf(finish, left);
  if (left < 0 || right < left) throw new Error("Expected graph alias block missing");
  let block = sql.slice(left, right);
  for (const [alias, name] of Object.entries(aliases)) {
    block = block.replace(new RegExp(`\\b${alias}\\.`, "g"), `${name}.`)
      .replace(new RegExp(`(FROM public\\.[a-z0-9_]+ )${alias}\\b`, "g"), `$1${name}`);
  }
  sql = sql.slice(0, left) + block + sql.slice(right);
}
renameBlock("    IF NOT EXISTS (SELECT 1 FROM public.e11_perfil_eventos e WHERE e.usuario_id=a.usuario_id",
  "    THEN RAISE EXCEPTION 'E11: cambio usuario", { e: "profile_event" });
renameBlock("    IF NOT EXISTS (SELECT 1 FROM public.e11_decisiones d WHERE d.id=a.decision_id",
  "    THEN RAISE EXCEPTION 'E11: aviso/decisión", { d: "decision_row" });
renameBlock("    IF o.operacion='PERFIL' AND NOT EXISTS", "    THEN RAISE EXCEPTION 'E11: replay sin efecto",
  { e: "profile_event", s: "snapshot_row", d: "decision_row" });
sql = sql.replace("SELECT to_jsonb(p) INTO actual FROM public.e5_operaciones p WHERE p.clave=a.clave;",
  "SELECT to_jsonb(operation_row) INTO actual FROM public.e5_operaciones operation_row WHERE operation_row.clave=a.clave;");
writeFileSync("reports/trabajo-nocturno-20260925/tarea-2/disposable-current-graph.sql", sql);
writeFileSync("reports/trabajo-nocturno-20260925/tarea-2/00-graph-correction-candidate.sql", `-- CANDIDATE: MAIN review required; only SQL alias disambiguation, no policy change.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF md5(pg_get_functiondef('public.e11_graph()'::regprocedure)) <> '39dc276e7192e01691011f271882c09b'
 THEN RAISE EXCEPTION 'E11 graph differs from reviewed current definition'; END IF;
END $$;
${sql}
COMMIT;
`);