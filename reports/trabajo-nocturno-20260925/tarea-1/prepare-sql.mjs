import { readFileSync, writeFileSync } from "node:fs";

// Generate a narrow candidate from the reviewed prepared function, never execute it.
const source = readFileSync("reports/e5/01-preparado.sql", "utf8");
const start = source.indexOf("CREATE FUNCTION public.e5_graph_guard()");
const end = source.indexOf("\nEND $$;", start) + "\nEND $$;".length;
if (start < 0 || end <= start) throw new Error("Prepared graph function not found");
const graph = source.slice(start, end).replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION");
const installed = readFileSync("reports/trabajo-nocturno-20260925/tarea-1/installed-graph-readonly.sql", "utf8");
const preparedBody = graph.slice(graph.indexOf("$$") + 2, graph.lastIndexOf("$$")).trim();
const installedBody = installed.slice(installed.indexOf("$function$") + "$function$".length,
  installed.lastIndexOf("$function$")).trim();
if (preparedBody !== installedBody) throw new Error("Installed graph differs; review a corrective plan, do not silently replace it");
const tables = ["e5_recepciones", "e5_cobros", "e5_aplicaciones", "e5_vinculos_credito",
  "e5_documentos", "e5_operaciones", "e5_impresiones"];
const candidate = `-- CANDIDATE ONLY. MAIN review and disposable rehearsal required before application.
-- Existing E5/E11 schemas MUST NOT be reinstalled. Monetary refund closures remain.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$
BEGIN
  IF md5(pg_get_functiondef('public.e5_graph_guard()'::regprocedure)) <> '5333a5027dfadf8d459e057035ef76e7'
    THEN RAISE EXCEPTION 'E5 graph differs from readonly reviewed identity'; END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE tgname='e5_closed' AND tgenabled='O'
    AND tgfoid='public.e5_closed()'::regprocedure AND NOT tgisinternal) <> 9
    THEN RAISE EXCEPTION 'E5 closure inventory differs'; END IF;
END $preflight$;
-- The current installed graph body equals the prepared corrected graph exactly.
-- No function replacement is necessary.
${tables.map(t => `DROP TRIGGER e5_closed ON public.${t};`).join("\n")}
DO $verify$
BEGIN
  IF (SELECT count(*) FROM pg_trigger WHERE tgname='e5_closed' AND tgenabled='O'
    AND tgrelid IN ('public.e5_devoluciones'::regclass,'public.e5_salidas_bancarias'::regclass)
    AND tgfoid='public.e5_closed()'::regprocedure AND NOT tgisinternal) <> 2
    THEN RAISE EXCEPTION 'Monetary refund closures must remain'; END IF;
END $verify$;
COMMIT;
`;
writeFileSync("reports/trabajo-nocturno-20260925/tarea-1/01-candidate-not-approved.sql", candidate);