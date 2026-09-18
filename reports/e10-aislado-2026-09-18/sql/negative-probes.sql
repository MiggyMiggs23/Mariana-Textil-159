-- E10 direct SQL negative probes for the authorized pinned isolated copy only.
-- Run after operativo.sql while the new ledger is empty. Never run on OPERATIVA.
-- Each attempted INSERT is rolled back by its PL/pgSQL exception subtransaction.

DO $probe$
DECLARE fondo uuid; actor integer; rejected boolean := false;
BEGIN
  SELECT id INTO STRICT fondo FROM fondo_mariana;
  SELECT id INTO STRICT actor FROM usuarios WHERE activo IS TRUE AND rol::text='ADMIN' ORDER BY id LIMIT 1;
  BEGIN
    INSERT INTO fondo_movimientos
      (fondo_id,naturaleza,categoria,importe_centavos,motivo,autor_id,idempotency_key,idempotency_producer,payload_hash,conciliacion_inicial)
    VALUES
      (fondo,'INGRESO','SALDO_INICIAL',0,'saldo inicial',actor,'00000000-0000-4000-8000-000000000001',
       'FONDO_API_MOVIMIENTO_V1',repeat('a',64),
       '{"efectivoFisicoContado":"0.00","evidencia":"probe missing declaration"}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    rejected := position('FONDO_SALDO_INICIAL_INVALIDO' in SQLERRM) > 0;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'E10_NEGATIVE_PROBE_FAILED: missing declaration was accepted'; END IF;
END $probe$;

DO $probe$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    TRUNCATE TABLE fondo_arqueos;
  EXCEPTION WHEN OTHERS THEN
    rejected := position('FONDO_IMMUTABLE' in SQLERRM) > 0;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'E10_NEGATIVE_PROBE_FAILED: TRUNCATE was accepted'; END IF;
END $probe$;

DO $probe$
DECLARE fondo uuid; actor integer; rejected boolean := false;
BEGIN
  SELECT id INTO STRICT fondo FROM fondo_mariana;
  SELECT id INTO STRICT actor FROM usuarios WHERE activo IS TRUE AND rol::text='ADMIN' ORDER BY id LIMIT 1;
  BEGIN
    INSERT INTO fondo_movimientos
      (fondo_id,naturaleza,categoria,importe_centavos,motivo,autor_id,idempotency_key,idempotency_producer,payload_hash,conciliacion_inicial)
    VALUES
      (fondo,'INGRESO','SALDO_INICIAL',0,'saldo inicial',actor,'00000000-0000-4000-8000-000000000002',
       'FONDO_API_MOVIMIENTO_V1',repeat('b',64),
       '{"declaracionSinDuplicacion":true,"evidencia":"probe missing count"}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    rejected := position('FONDO_SALDO_INICIAL_INVALIDO' in SQLERRM) > 0;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'E10_NEGATIVE_PROBE_FAILED: missing count was accepted'; END IF;
END $probe$;

DO $probe$
DECLARE fondo uuid; actor integer; rejected boolean := false;
BEGIN
  SELECT id INTO STRICT fondo FROM fondo_mariana;
  SELECT id INTO STRICT actor FROM usuarios WHERE activo IS TRUE AND rol::text='ADMIN' ORDER BY id LIMIT 1;
  BEGIN
    INSERT INTO fondo_movimientos
      (fondo_id,naturaleza,categoria,importe_centavos,motivo,autor_id,idempotency_key,idempotency_producer,payload_hash,conciliacion_inicial)
    VALUES
      (fondo,'INGRESO','SALDO_INICIAL',0,'saldo inicial',actor,'00000000-0000-4000-8000-000000000003',
       'FONDO_API_MOVIMIENTO_V1',repeat('c',64),'null'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    rejected := position('FONDO_SALDO_INICIAL_INVALIDO' in SQLERRM) > 0;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'E10_NEGATIVE_PROBE_FAILED: JSON null reconciliation was accepted'; END IF;
END $probe$;