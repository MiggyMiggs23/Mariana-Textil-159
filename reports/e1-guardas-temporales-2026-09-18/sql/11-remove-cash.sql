-- Independent retirement. Requires separate feature/readiness authorization.
-- Never CASCADE; absence or unexpected dependency is a refusal.
DROP TRIGGER zz_e1_cash_capture_closed ON public.movimientos_credito;
DROP FUNCTION public.e1_guard_cash_capture_closed();