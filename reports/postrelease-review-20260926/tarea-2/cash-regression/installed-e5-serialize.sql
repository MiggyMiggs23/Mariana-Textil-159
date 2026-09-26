CREATE OR REPLACE FUNCTION public.e5_serialize()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  -- El adapter ya puede tener CUSTOMER_CREDIT/sesión/Fondo/aggregate antes
  -- del primer DML. NUNCA esperar este lock global detrás de ellos: otro
  -- escritor puede tenerlo y necesitar esos mismos locks en validadores.
  -- NOWAIT lógico: conflicto aborta la sentencia con serialization_failure.
  -- El llamador debe abortar/reintentar la transacción completa, nunca continuar
  -- sólo la sentencia; adapter transaccional propaga el error, no hace retry SQL.
  IF NOT pg_try_advisory_xact_lock(650005,5) THEN
    RAISE EXCEPTION USING ERRCODE='40001',
      MESSAGE='E5: grafo ocupado; abortar transacción completa, sin espera global';
  END IF;
  RETURN NULL;
END $function$
