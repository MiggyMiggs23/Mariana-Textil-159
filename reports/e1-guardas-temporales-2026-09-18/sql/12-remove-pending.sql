-- Independent retirement. Requires separate feature/readiness authorization.
DROP TRIGGER zz_e1_pending_receipts_closed ON public.cobros_credito_pendientes_e1;
DROP FUNCTION public.e1_guard_pending_receipts_closed();