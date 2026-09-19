-- PREPARED OFFLINE ONLY. Included inside the locked activation transaction.
-- This is a catalog contract, never an initializer or repair/backfill.
WITH expected_constraints(table_name, name, definition) AS (
  VALUES
    ('finalizaciones_abono_e2','finalizaciones_abono_e2_pkey','PRIMARY KEY (abono_id)'),
    ('finalizaciones_abono_e2','finalizaciones_abono_e2_abono_id_fkey','FOREIGN KEY (abono_id) REFERENCES movimientos_credito(id)'),
    ('finalizaciones_abono_e2','finalizaciones_abono_e2_cliente_id_fkey','FOREIGN KEY (cliente_id) REFERENCES clientes(id)'),
    ('finalizaciones_abono_e2','finalizaciones_abono_e2_operacion_productor_operacion_clave_key','UNIQUE (operacion_productor, operacion_clave)'),
    ('finalizaciones_abono_e2','finalizaciones_abono_e2_importe_check','CHECK (((importe > (0)::numeric) AND (importe < ''Infinity''::numeric)))'),
    ('finalizaciones_abono_e2','finalizaciones_abono_e2_resultado_check','CHECK ((resultado = ANY (ARRAY[''UNUSED''::text, ''PARTIAL''::text, ''FULL''::text])))'),
    ('finalizaciones_abono_e2','finalizaciones_abono_e2_aplicado_check','CHECK (((aplicado >= (0)::numeric) AND (aplicado <= importe)))'),
    ('finalizaciones_abono_e2','finalizaciones_abono_e2_evaluacion_check','CHECK ((jsonb_typeof(evaluacion) = ''object''::text))'),
    ('finalizaciones_abono_e2','finalizaciones_abono_e2_contrato_revision_check','CHECK ((contrato_revision = ''e2-abono-evidence-v1''::text))'),
    ('finalizaciones_abono_e2','finalizaciones_abono_e2_check','CHECK ((((resultado = ''UNUSED''::text) AND (aplicado = (0)::numeric)) OR ((resultado = ''PARTIAL''::text) AND (aplicado > (0)::numeric) AND (aplicado < importe)) OR ((resultado = ''FULL''::text) AND (aplicado = importe))))'),
    ('finalizaciones_abono_e2','finalizaciones_abono_e2_operacion_productor_check','CHECK ((operacion_productor = ANY (ARRAY[''ABONO_ORDINARIO''::text, ''ABONO_DIRIGIDO''::text])))'),
    ('evidencia_no_aplicada_e2','evidencia_no_aplicada_e2_pkey','PRIMARY KEY (fuente)'),
    ('evidencia_no_aplicada_e2','evidencia_no_aplicada_e2_abono_id_key','UNIQUE (abono_id)'),
    ('evidencia_no_aplicada_e2','evidencia_no_aplicada_e2_cobro_clave_key','UNIQUE (cobro_clave)'),
    ('evidencia_no_aplicada_e2','evidencia_no_aplicada_e2_cobro_productor_cobro_clave_fkey','FOREIGN KEY (cobro_productor, cobro_clave) REFERENCES cobros_credito_pendientes_e1(operacion_productor, operacion_clave)'),
    ('evidencia_no_aplicada_e2','evidencia_no_aplicada_e2_abono_id_fkey','FOREIGN KEY (abono_id) REFERENCES finalizaciones_abono_e2(abono_id)'),
    ('evidencia_no_aplicada_e2','evidencia_no_aplicada_e2_cliente_id_fkey','FOREIGN KEY (cliente_id) REFERENCES clientes(id)'),
    ('evidencia_no_aplicada_e2','evidencia_no_aplicada_e2_importe_check','CHECK (((importe > (0)::numeric) AND (importe < ''Infinity''::numeric)))'),
    ('evidencia_no_aplicada_e2','evidencia_no_aplicada_e2_forma_pago_check','CHECK ((forma_pago = ''EFECTIVO''::text))'),
    ('evidencia_no_aplicada_e2','evidencia_no_aplicada_e2_naturaleza_check','CHECK ((naturaleza = ''INGRESO_FISICO''::text))'),
    ('evidencia_no_aplicada_e2','evidencia_no_aplicada_e2_check','CHECK ((((abono_id IS NOT NULL) AND (cobro_productor IS NULL) AND (cobro_clave IS NULL) AND (fuente = (''ABONO:''::text || (abono_id)::text))) OR ((abono_id IS NULL) AND (cobro_productor IS NOT NULL) AND (cobro_clave IS NOT NULL) AND (cobro_productor = ''COBRO_PENDIENTE''::text) AND (fuente = (''COBRO_RETENIDO:''::text || (cobro_clave)::text)))))')
), actual_constraints AS (
  SELECT t.relname::text AS table_name, c.conname::text AS name,
         pg_catalog.pg_get_constraintdef(c.oid) AS definition,
         c.convalidated AND NOT c.condeferrable AND NOT c.condeferred
         AND CASE WHEN c.contype IN ('p','u')
           THEN i.indisvalid AND i.indisready AND i.indisunique ELSE true END AS valid
  FROM pg_catalog.pg_constraint c
  JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_catalog.pg_index i ON i.indexrelid = c.conindid
  WHERE n.nspname = 'public'
    AND t.relname IN ('finalizaciones_abono_e2','evidencia_no_aplicada_e2')
), expected_columns(table_name, column_name, data_type, column_default) AS (
  VALUES
    ('finalizaciones_abono_e2','abono_id','integer',NULL::text),
    ('finalizaciones_abono_e2','operacion_productor','text',NULL),
    ('finalizaciones_abono_e2','operacion_clave','uuid',NULL),
    ('finalizaciones_abono_e2','cliente_id','integer',NULL),
    ('finalizaciones_abono_e2','importe','numeric',NULL),
    ('finalizaciones_abono_e2','resultado','text',NULL),
    ('finalizaciones_abono_e2','aplicado','numeric',NULL),
    ('finalizaciones_abono_e2','evaluacion','jsonb',NULL),
    ('finalizaciones_abono_e2','contrato_revision','text',NULL),
    ('finalizaciones_abono_e2','created_at','timestamp with time zone','transaction_timestamp()'),
    ('evidencia_no_aplicada_e2','fuente','text',NULL),
    ('evidencia_no_aplicada_e2','abono_id','integer',NULL),
    ('evidencia_no_aplicada_e2','cobro_productor','text',NULL),
    ('evidencia_no_aplicada_e2','cobro_clave','uuid',NULL),
    ('evidencia_no_aplicada_e2','cliente_id','integer',NULL),
    ('evidencia_no_aplicada_e2','importe','numeric',NULL),
    ('evidencia_no_aplicada_e2','forma_pago','text','''EFECTIVO''::text'),
    ('evidencia_no_aplicada_e2','naturaleza','text','''INGRESO_FISICO''::text'),
    ('evidencia_no_aplicada_e2','created_at','timestamp with time zone','transaction_timestamp()')
), actual_columns AS (
  SELECT table_name::text, column_name::text, data_type::text, column_default::text,
         is_nullable = CASE WHEN table_name = 'evidencia_no_aplicada_e2'
           AND column_name IN ('abono_id','cobro_productor','cobro_clave')
           THEN 'YES' ELSE 'NO' END AND (data_type <> 'numeric'
           OR (numeric_precision = 12 AND numeric_scale = 2)) AS valid
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('finalizaciones_abono_e2','evidencia_no_aplicada_e2')
)
SELECT
  NOT EXISTS (
    SELECT 1 FROM expected_constraints e FULL JOIN actual_constraints a USING (table_name, name)
    WHERE a.valid IS DISTINCT FROM true OR e.name IS NULL OR a.name IS NULL
      OR regexp_replace(a.definition, '\s+', ' ', 'g')
         IS DISTINCT FROM regexp_replace(e.definition, '\s+', ' ', 'g')
  ) AND NOT EXISTS (
    SELECT 1 FROM expected_columns e FULL JOIN actual_columns a USING (table_name, column_name)
    WHERE a.valid IS DISTINCT FROM true OR e.column_name IS NULL OR a.column_name IS NULL
      OR a.data_type IS DISTINCT FROM e.data_type
      OR a.column_default IS DISTINCT FROM e.column_default
  ) AS evidence_schema_ok
\gset
\if :evidence_schema_ok
\else
  \echo 'REFUSED: canonical A+C schema contract mismatch'
  \quit 3
\endif