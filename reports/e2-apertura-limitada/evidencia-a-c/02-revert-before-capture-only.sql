-- PREPARED OFFLINE ONLY. Safe only before any A+C receipt exists.
-- Operational rollback after accepting receipts must KEEP evidence tables.
BEGIN;
-- Serialize the empty check against producers; no CASCADE or history removal.
LOCK TABLE public.movimientos_credito, public.finalizaciones_abono_e2,
  public.evidencia_no_aplicada_e2, public.aplicaciones_credito,
  public.cobros_credito_pendientes_e1 IN ACCESS EXCLUSIVE MODE;
DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE t.tgrelid = 'public.movimientos_credito'::regclass
      AND t.tgname = 'zz_e1_cash_capture_closed' AND t.tgenabled = 'O'
      AND t.tgtype = 5 AND NOT t.tgisinternal
      AND t.tgqual IS NULL AND t.tgattr::text = ''
      AND octet_length(t.tgargs) = 0 AND t.tgconstraint = 0
      AND n.nspname = 'public' AND p.proname = 'e1_guard_cash_capture_closed'
      AND p.prosrc = E'\nBEGIN\n  IF NEW.forma_pago::text = ''EFECTIVO''\n     AND NEW.naturaleza::text IN (''INGRESO_FISICO'', ''DEVOLUCION_FISICA'') THEN\n    RAISE EXCEPTION USING\n      ERRCODE = ''E1C01'',\n      MESSAGE = ''E1: la captura física de efectivo de crédito está deshabilitada.'';\n  END IF;\n  RETURN NEW;\nEND;\n'
  ) THEN
    RAISE EXCEPTION 'REFUSED: close cash capture before removing empty evidence';
  END IF;
  IF EXISTS (SELECT 1 FROM public.finalizaciones_abono_e2)
     OR EXISTS (SELECT 1 FROM public.evidencia_no_aplicada_e2) THEN
    RAISE EXCEPTION 'REFUSED: evidence exists; close capture but preserve evidence';
  END IF;
END;
$block$;
DROP TRIGGER e2_abono_finalization_complete ON public.movimientos_credito;
DROP TRIGGER e2_capture_application_order ON public.aplicaciones_credito;
DROP FUNCTION public.e2_guard_finalized_capture_application();
DROP FUNCTION public.e2_attest_new_retained(uuid);
DROP FUNCTION public.e2_require_abono_finalization();
DROP FUNCTION public.e2_finalize_new_abono(integer,text,text,bigint,jsonb,text);
DROP TRIGGER e2_validate_unused_proof ON public.evidencia_no_aplicada_e2;
DROP FUNCTION public.e2_validate_unused_proof();
DROP TRIGGER e2_validate_abono_finalization ON public.finalizaciones_abono_e2;
DROP FUNCTION public.e2_validate_abono_finalization();
DROP TRIGGER e2_proof_immutable ON public.evidencia_no_aplicada_e2;
DROP TRIGGER e2_finalization_immutable ON public.finalizaciones_abono_e2;
DROP FUNCTION public.e2_reject_evidence_mutation();
DROP TABLE public.evidencia_no_aplicada_e2;
DROP TABLE public.finalizaciones_abono_e2;
COMMIT;