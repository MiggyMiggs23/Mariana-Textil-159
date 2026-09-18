-- PREPARED OFFLINE ONLY. Safe only before any A+C receipt exists.
-- Operational rollback after accepting receipts must KEEP evidence tables.
BEGIN;
DO $block$
BEGIN
  IF EXISTS (SELECT 1 FROM public.finalizaciones_abono_e2)
     OR EXISTS (SELECT 1 FROM public.evidencia_no_aplicada_e2) THEN
    RAISE EXCEPTION 'REFUSED: evidence exists; close capture but preserve evidence';
  END IF;
END;
$block$;
DROP TRIGGER e2_abono_finalization_complete ON public.movimientos_credito;
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