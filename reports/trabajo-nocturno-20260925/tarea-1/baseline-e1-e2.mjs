import { readFileSync } from "node:fs";
export function baselineE1E2() {
  const fixture = readFileSync("reports/liberacion-simple-20260923/fixture.sql", "utf8");
  let sql = fixture.slice(fixture.indexOf("CREATE OR REPLACE FUNCTION public.validar_movimiento_credito_e1()"));
  // Canonical push/seed already owns permisos_rol and atribuciones_credito_e1.
  // Keep the real E1/E2 functions, E2 sidecars and triggers, not snapshot scaffolding.
  const scaffold = sql.indexOf("CREATE TABLE public.tanda_b_probe");
  const e2 = sql.indexOf('CREATE TABLE public."finalizaciones_abono_e2"');
  if (scaffold < 0 || e2 <= scaffold) throw new Error("Unexpected baseline scaffold boundaries");
  sql = sql.slice(0, scaffold) + sql.slice(e2);
  const sequence = sql.indexOf("CREATE SEQUENCE public.permisos_rol_id_seq");
  const cash = sql.indexOf("CREATE OR REPLACE FUNCTION public.e1_guard_cash_capture_closed()");
  if (sequence < 0 || cash <= sequence) throw new Error("Unexpected baseline sequence boundaries");
  const check = fixture.split("\n").find(line => line.startsWith('ALTER TABLE public."operaciones_credito_e1" ADD CONSTRAINT "operaciones_productor_naturaleza_ck_e1"'));
  if (!check) throw new Error("Historical E1 check missing");
  return `DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.operaciones_credito_e1)
    THEN RAISE EXCEPTION 'Disposable baseline requires empty financial operation ledger'; END IF; END $$;
ALTER TABLE public.operaciones_credito_e1 DROP CONSTRAINT operaciones_productor_naturaleza_ck_e1;
${check}\n` + sql.slice(0, sequence) + sql.slice(cash);
}