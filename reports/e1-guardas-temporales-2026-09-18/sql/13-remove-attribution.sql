-- Independent retirement. Historical evidence + explicit owner approval required.
DROP TRIGGER zz_e1_historical_attribution_closed ON public.atribuciones_credito_e1;
DROP FUNCTION public.e1_guard_historical_attribution_closed();